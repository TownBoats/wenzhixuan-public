/**
 * A3 · 端点探针（一次性脚本，不进 src/、不被 Vite 打包）
 *
 * 目的：用真实端点回答「这个端点支不支持『模型调工具 → 工具结果回传 → 继续生成』的闭环」，
 *      并顺带确认 DeepSeek「带 tools 时 reasoning_content 必须回传」这条规则是否真实生效。
 *
 * 用法：
 *   PROBE_BASE_URL=https://api.deepseek.com/v1
 *   PROBE_API_KEY=<你的 key>
 *   PROBE_MODEL=deepseek-flash
 *   node scripts/probe-tools.mjs
 *
 * 输出：控制台打印每个用例的判读要点；完整结果写入 scripts/probe-tools.output.json。
 * 安全：密钥只在内存中使用，打印时打码，不写入任何文件。
 *
 * 本脚本是"最小版机制"的探针：设置 thinking / reasoning_effort、提取 reasoning_content、
 * 以及把 reasoning_content 回填到后续请求的 assistant 消息上——这三件事在 B 阶段要由运行层正式实现，
 * 这里只用来验证端点行为，不作为产品代码复用。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, stepCountIs, tool, jsonSchema } from 'ai';

const BASE_URL = process.env.PROBE_BASE_URL;
const API_KEY = process.env.PROBE_API_KEY;
const MODEL = process.env.PROBE_MODEL;
const CALL_TIMEOUT_MS = 60_000;

if (!BASE_URL || !API_KEY || !MODEL) {
  console.error('缺少环境变量。需要 PROBE_BASE_URL / PROBE_API_KEY / PROBE_MODEL 三个都设置。');
  process.exit(1);
}

const mask = (s) => (typeof s === 'string' && s.length > 8 ? `${s.slice(0, 4)}****${s.slice(-4)}` : '****');
const preview = (s, n = 120) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').slice(0, n) : '');

console.log('=== A3 端点探针 ===');
console.log(`base URL : ${BASE_URL}`);
console.log(`model    : ${MODEL}`);
console.log(`api key  : ${mask(API_KEY)}`);

const baseFetch = (...args) => globalThis.fetch(...args);

/**
 * 包装 fetch，做三件事：
 * 1) 把 extras（如 DeepSeek 的 thinking）注入请求体——AI SDK 的 openai provider 只认自己的已知字段；
 * 2) 记录每次请求的关键信息与响应状态，供判读；
 * 3) 从响应体里提取 reasoning_content，并在 fillReasoning 时回填到后续请求的 assistant 消息上。
 */
function makeProbeFetch(state) {
  return async (input, init) => {
    let record = { url: String(input), status: null, injectedExtras: null, reasoningInjected: 0 };
    if (typeof init?.body === 'string') {
      let body;
      try {
        body = JSON.parse(init.body);
      } catch {
        body = null;
      }
      if (body) {
        if (state.extras && Object.keys(state.extras).length > 0) {
          Object.assign(body, state.extras);
          record.injectedExtras = Object.keys(state.extras);
        }
        // 关键观测：SDK 自己组装的 assistant 消息里，有没有原生带上 reasoning_content
        // （如果带了，说明"reasoning 不进模型上下文"这条不变量在当前实现下已经不成立）
        record.nativeAssistantReasoning = (body.messages ?? []).filter(
          (m) =>
            m.role === 'assistant' &&
            typeof m.reasoning_content === 'string' &&
            m.reasoning_content.length > 0
        ).length;
        if (state.fillReasoning && state.reasoningText) {
          for (const m of body.messages ?? []) {
            if (m.role === 'assistant' && Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
              m.reasoning_content = state.reasoningText;
              record.reasoningInjected += 1;
            }
          }
        }
        record.model = body.model;
        record.roles = (body.messages ?? []).map((m) => m.role).join(',');
        record.toolCount = (body.tools ?? []).length;
        record.temperature = body.temperature;
        record.reasoningEffort = body.reasoning_effort;
        record.thinking = body.thinking ? body.thinking.type : undefined;
        record.parallelToolCalls = body.parallel_tool_calls;
        init = { ...init, body: JSON.stringify(body) };
      }
    }

    const res = await baseFetch(input, init);
    record.status = res.status;

    // 必须在返回响应前读完克隆体：下一步请求要用本轮提取到的 reasoning_content
    let raw = null;
    try {
      raw = await res.clone().text();
    } catch {
      raw = null;
    }
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        const choice = parsed?.choices?.[0];
        const msg = choice?.message;
        record.finishReason = choice?.finish_reason;
        record.reasoningChars = (msg?.reasoning_content ?? '').length;
        record.reasoningPreview = preview(msg?.reasoning_content, 100);
        record.hasToolCalls = Array.isArray(msg?.tool_calls) && msg.tool_calls.length > 0;
        if (msg?.reasoning_content) state.reasoningText = msg.reasoning_content;
        if (parsed?.error) record.errorBody = JSON.stringify(parsed.error).slice(0, 400);
      } catch {
        record.bodyNotJson = preview(raw, 200);
      }
    }
    state.requests.push(record);
    return res;
  };
}

const WEATHER_TOOL = tool({
  description:
    'Get the weather of a location on a given date. The user must supply both location and date.',
  inputSchema: jsonSchema({
    type: 'object',
    properties: {
      location: { type: 'string', description: 'The city name' },
      date: { type: 'string', description: 'The date in format YYYY-MM-DD' },
    },
    required: ['location', 'date'],
    additionalProperties: false,
  }),
  execute: async ({ location, date }) => ({ location, date, weather: 'Cloudy 7~13°C' }),
});

const TOOLS = { get_weather: WEATHER_TOOL };
const WEATHER_PROMPT =
  '请先调用 get_weather 工具查询杭州 2026-10-17 的天气，拿到工具结果后再用一句话回答我。';

const results = [];

function describeRequests(state) {
  return state.requests.map((r, i) => ({
    第几步: i + 1,
    status: r.status,
    roles: r.roles,
    toolCount: r.toolCount,
    thinking: r.thinking,
    reasoningEffort: r.reasoningEffort,
    parallelToolCalls: r.parallelToolCalls,
    reasoningInjected: r.reasoningInjected,
    原生assistant含reasoning: r.nativeAssistantReasoning,
    响应reasoning字符数: r.reasoningChars,
    响应finishReason: r.finishReason,
    errorBody: r.errorBody,
  }));
}

async function runCase({ id, title, extras = null, fillReasoning = false, providerOptions, run }) {
  const state = { extras, fillReasoning, reasoningText: '', requests: [] };
  const provider = createOpenAI({ baseURL: BASE_URL, apiKey: API_KEY, fetch: makeProbeFetch(state) });

  console.log(`\n===== 用例 ${id} · ${title} =====`);
  const entry = { id, title, extras, fillReasoning, ok: false, error: null, summary: null };
  try {
    const out = await run(provider, state);
    entry.ok = true;
    entry.summary = out?.summary ?? null;
    if (out?.lines?.length) out.lines.forEach((l) => console.log(`  ${l}`));
  } catch (err) {
    entry.error = {
      name: err?.name,
      message: preview(err?.message, 300),
      statusCode: err?.statusCode ?? err?.status ?? null,
      responseBody: preview(err?.responseBody, 400),
    };
    console.log(`  结果：失败 —— ${err?.name ?? 'Error'}（status=${entry.error.statusCode}）`);
    console.log(`  message: ${entry.error.message}`);
    if (entry.error.responseBody) console.log(`  responseBody: ${entry.error.responseBody}`);
  }
  entry.requests = describeRequests(state);
  entry.requests.forEach((r) => {
    console.log(
      `  · 第${r.第几步}次请求 status=${r.status} roles=[${r.roles}] tools=${r.toolCount} ` +
        `thinking=${r.thinking ?? '-'} effort=${r.reasoningEffort ?? '-'} ` +
        `parallel=${r.parallelToolCalls ?? '-'} 回填reasoning=${r.reasoningInjected} ` +
        `原生assistant含reasoning=${r.原生assistant含reasoning ?? '-'} ` +
        `响应reasoning=${r.响应reasoning字符数 ?? '-'} finish=${r.响应finishReason ?? '-'}`
    );
  });
  results.push(entry);
  return entry;
}

const signal = () => AbortSignal.timeout(CALL_TIMEOUT_MS);
const thinkingOn = { thinking: { type: 'enabled' } };
const thinkingOff = { thinking: { type: 'disabled' } };

// ── ① 单个工具调用：参数必须是结构化对象，不是正文里的 JSON 文本 ──
await runCase({
  id: '①',
  title: '单个工具调用（thinking 关闭，1 步）',
  extras: thinkingOff,
  run: async (provider) => {
    const r = await generateText({
      model: provider.chat(MODEL),
      prompt: WEATHER_PROMPT,
      tools: TOOLS,
      stopWhen: stepCountIs(1),
      maxRetries: 0,
      abortSignal: signal(),
    });
    const call = r.toolCalls?.[0];
    return {
      summary: {
        步数: r.steps.length,
        工具调用数: r.toolCalls?.length ?? 0,
        工具名: call?.toolName ?? null,
        参数类型: call ? typeof call.input : null,
        参数: call?.input ?? null,
      },
      lines: [
        `步数=${r.steps.length} 工具调用数=${r.toolCalls?.length ?? 0}`,
        `工具名=${call?.toolName ?? '(无)'} 参数类型=${call ? typeof call.input : '(无)'}`,
        `参数=${JSON.stringify(call?.input ?? null)}`,
      ],
    };
  },
});

// ── ② 工具结果回传后继续生成：B 阶段的核心假设 ──
await runCase({
  id: '②',
  title: '工具结果回传后继续生成（thinking 关闭，目标 2 步）',
  extras: thinkingOff,
  run: async (provider) => {
    const r = await generateText({
      model: provider.chat(MODEL),
      prompt: WEATHER_PROMPT,
      tools: TOOLS,
      stopWhen: stepCountIs(2),
      maxRetries: 0,
      abortSignal: signal(),
    });
    const stepTexts = r.steps.map((s, i) => `step${i + 1}:${preview(s.text, 80) || '(无文本)'}`);
    return {
      summary: {
        步数: r.steps.length,
        每步文本: stepTexts,
        第二步文本长度: r.steps[1]?.text?.length ?? 0,
        工具调用数: r.toolCalls?.length ?? 0,
      },
      lines: [
        `步数=${r.steps.length}（期望 2）`,
        ...stepTexts.map((t) => `  ${t}`),
        `第二步文本长度=${r.steps[1]?.text?.length ?? 0}`,
      ],
    };
  },
});

// ── ③a 思考模式 + 工具，第二步不回传 reasoning_content ──
await runCase({
  id: '③a',
  title: 'thinking 开启 + 工具 + 第二步【不】回传 reasoning_content',
  extras: thinkingOn,
  fillReasoning: false,
  run: async (provider) => {
    const r = await generateText({
      model: provider.chat(MODEL),
      prompt: WEATHER_PROMPT,
      tools: TOOLS,
      stopWhen: stepCountIs(2),
      maxRetries: 0,
      abortSignal: signal(),
    });
    return { summary: { 步数: r.steps.length, 第二步文本: preview(r.steps[1]?.text, 80) } };
  },
});

// ── ③b 同上，但第二步回传 reasoning_content ──
await runCase({
  id: '③b',
  title: 'thinking 开启 + 工具 + 第二步【回传】reasoning_content',
  extras: thinkingOn,
  fillReasoning: true,
  run: async (provider) => {
    const r = await generateText({
      model: provider.chat(MODEL),
      prompt: WEATHER_PROMPT,
      tools: TOOLS,
      stopWhen: stepCountIs(2),
      maxRetries: 0,
      abortSignal: signal(),
    });
    return {
      summary: { 步数: r.steps.length, 第二步文本: preview(r.steps[1]?.text, 80) },
      lines: [`步数=${r.steps.length}`, `第二步文本=${preview(r.steps[1]?.text, 80)}`],
    };
  },
});

// ── ③c thinking 开启 + 工具，但只走 1 步（对应"提问成功即停"）──
await runCase({
  id: '③c',
  title: 'thinking 开启 + 工具 + 只走 1 步（单步无需回传）',
  extras: thinkingOn,
  run: async (provider) => {
    const r = await generateText({
      model: provider.chat(MODEL),
      prompt: WEATHER_PROMPT,
      tools: TOOLS,
      stopWhen: stepCountIs(1),
      maxRetries: 0,
      abortSignal: signal(),
    });
    return { summary: { 步数: r.steps.length, 工具调用数: r.toolCalls?.length ?? 0 } };
  },
});

// ── ④ 开闸标记（U+200B）是否出现在文本与协议消息里 ──
const GATE = '\u200B';
await runCase({
  id: '④',
  title: '开闸标记（U+200B）检查',
  extras: thinkingOff,
  run: async (provider) => {
    const r = await generateText({
      model: provider.chat(MODEL),
      prompt: '用一句话介绍你自己。',
      stopWhen: stepCountIs(1),
      maxRetries: 0,
      abortSignal: signal(),
    });
    const inText = r.text.includes(GATE);
    const msgJson = JSON.stringify(r.response.messages);
    const inMessages = msgJson.includes(GATE);
    return {
      summary: { 文本含零宽空格: inText, 协议消息含零宽空格: inMessages, 文本长度: r.text.length },
      lines: [
        `文本含零宽空格=${inText}；协议消息含零宽空格=${inMessages}（这一项只确认存在与否，不算失败）`,
        `response.messages 结构=${JSON.stringify(r.response.messages?.map?.((m) => ({ role: m.role, parts: (m.content ?? []).map?.((p) => p.type) })) ?? null).slice(0, 400)}`,
      ],
    };
  },
});

// ── ⑤ parallelToolCalls: false 是否被端点接受 ──
await runCase({
  id: '⑤',
  title: 'parallelToolCalls: false 是否被接受',
  extras: thinkingOff,
  providerOptions: { openai: { parallelToolCalls: false } },
  run: async (provider) => {
    const r = await generateText({
      model: provider.chat(MODEL),
      prompt: WEATHER_PROMPT,
      tools: TOOLS,
      stopWhen: stepCountIs(1),
      maxRetries: 0,
      providerOptions: { openai: { parallelToolCalls: false } },
      abortSignal: signal(),
    });
    return { summary: { 步数: r.steps.length, 工具调用数: r.toolCalls?.length ?? 0 } };
  },
});

// ── ⑤b / ⑤c 并行工具调用：用"一次问两个城市"的提示对比开/关该选项后的工具调用数 ──
const TWO_CITY_PROMPT =
  '请调用 get_weather 工具，一次把杭州 2026-10-17 和上海 2026-10-17 两个城市的天气都查出来，然后一起回答。';

async function twoCityRun(provider, useFlag) {
  const r = await generateText({
    model: provider.chat(MODEL),
    prompt: TWO_CITY_PROMPT,
    tools: TOOLS,
    stopWhen: stepCountIs(2),
    maxRetries: 0,
    ...(useFlag
      ? { providerOptions: { openai: { parallelToolCalls: false } } }
      : {}),
    abortSignal: signal(),
  });
  const inputCities = (r.toolCalls ?? []).map((c) => c.input?.location ?? '(未解析)');
  return {
    summary: { 步数: r.steps.length, 工具调用数: r.toolCalls?.length ?? 0, 工具调用城市: inputCities },
    lines: [`工具调用数=${r.toolCalls?.length ?? 0}，城市=${JSON.stringify(inputCities)}`],
  };
}

await runCase({
  id: '⑤b',
  title: '一次问两个城市（不传 parallelToolCalls）',
  extras: thinkingOff,
  run: (provider) => twoCityRun(provider, false),
});

await runCase({
  id: '⑤c',
  title: '一次问两个城市（parallelToolCalls=false）',
  extras: thinkingOff,
  run: (provider) => twoCityRun(provider, true),
});

// ── ⑥ 跨轮：把上一轮的协议消息（含 tool_calls）放进下一轮请求 ──
async function crossTurnRun(provider, state, fill) {
  const first = await generateText({
    model: provider.chat(MODEL),
    prompt: WEATHER_PROMPT,
    tools: TOOLS,
    stopWhen: stepCountIs(2),
    maxRetries: 0,
    abortSignal: signal(),
  });
  const priorMessages = first.response.messages;
  state.fillReasoning = fill;
  const second = await generateText({
    model: provider.chat(MODEL),
    messages: [...priorMessages, { role: 'user', content: '那上海 2026-10-17 呢？' }],
    tools: TOOLS,
    stopWhen: stepCountIs(1),
    maxRetries: 0,
    abortSignal: signal(),
  });
  return {
    summary: {
      第一轮步数: first.steps.length,
      上一轮协议消息角色: priorMessages.map((m) => m.role),
      第二轮步数: second.steps.length,
    },
    lines: [
      `第一轮步数=${first.steps.length}`,
      `上一轮协议消息角色=[${priorMessages.map((m) => m.role).join(',')}]`,
      `第二轮步数=${second.steps.length}`,
    ],
  };
}

await runCase({
  id: '⑥a',
  title: '跨轮上下文（上一轮含 tool_calls）【不】回传 reasoning_content',
  extras: thinkingOn,
  run: (provider, state) => crossTurnRun(provider, state, false),
});

await runCase({
  id: '⑥b',
  title: '跨轮上下文（上一轮含 tool_calls）【回传】reasoning_content',
  extras: thinkingOn,
  run: (provider, state) => crossTurnRun(provider, state, true),
});

// ── ⑦ 思考强度：provider 允许的 low，以及 DeepSeek 的 max（provider 的 schema 不接受 max，改用注入）──
await runCase({
  id: '⑦',
  title: '思考强度：low 走 providerOptions，max 走请求体注入',
  extras: thinkingOn,
  run: async (provider, state) => {
    const low = await generateText({
      model: provider.chat(MODEL),
      prompt: '9.11 和 9.8 哪个大？',
      stopWhen: stepCountIs(1),
      maxRetries: 0,
      providerOptions: { openai: { reasoningEffort: 'low' } },
      abortSignal: signal(),
    });
    // max / ultra 不在 provider 允许值内（none|minimal|low|medium|high|xhigh），只能注入请求体
    state.extras = { ...thinkingOn, reasoning_effort: 'max' };
    const max = await generateText({
      model: provider.chat(MODEL),
      prompt: '9.11 和 9.8 哪个大？',
      stopWhen: stepCountIs(1),
      maxRetries: 0,
      abortSignal: signal(),
    });
    return {
      summary: {
        low: { 文本: preview(low.text, 60), reasoning长度: low.reasoningText?.length ?? 0 },
        max: { 文本: preview(max.text, 60), reasoning长度: max.reasoningText?.length ?? 0 },
      },
      lines: [
        `low（providerOptions）：文本=${preview(low.text, 60)}；reasoning 长度=${low.reasoningText?.length ?? 0}`,
        `max（请求体注入）：文本=${preview(max.text, 60)}；reasoning 长度=${max.reasoningText?.length ?? 0}`,
      ],
    };
  },
});

// ── 汇总 ──
console.log('\n\n================ 判读汇总 ================');
const verdict = (id) => {
  const e = results.find((r) => r.id === id);
  if (!e) return '未执行';
  if (e.ok) return '成功';
  return `失败(status=${e.error?.statusCode ?? '?'})`;
};
['①', '②', '③a', '③b', '③c', '④', '⑤', '⑤b', '⑤c', '⑥a', '⑥b', '⑦'].forEach((id) => {
  const e = results.find((r) => r.id === id);
  console.log(`${id.padEnd(4)} ${verdict(id).padEnd(18)} ${e?.title ?? ''}`);
});
console.log('\n判据提示：A 阶段通过要求 ① 与 ② 都成功；③a/③b 的对比决定 B 阶段能否保留思考能力。');

const here = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.join(here, 'probe-tools.output.json');
fs.writeFileSync(
  outFile,
  JSON.stringify(
    { when: new Date().toISOString(), baseURL: BASE_URL, model: MODEL, apiKey: mask(API_KEY), results },
    null,
    2
  ),
  'utf8'
);
console.log(`完整结果已写入 ${outFile}`);
