/**
 * B7 · 真实端点单跑（阶段 B 唯一的真实证据来源）
 *
 * 目的：把 `runTeachingAgent`（B5）接到真实端点上跑**一轮** socratic，回答四件离线证据
 * 回答不了的事——模型会不会真的调用 `ask_question`、真实参数是否合规、副模型能否稳定出档位、
 * 工具结果回填进 `response.messages` 后是否配对。顺带覆盖 B6 覆盖不到的三块：
 * provider 装配、开闸 fetch（U+200B）、请求体注入。
 *
 * 用法（PowerShell 里同样可用，三个变量缺一即退出）：
 *   PROBE_BASE_URL=https://api.deepseek.com/v1
 *   PROBE_API_KEY=<你的 key>
 *   PROBE_MODEL=deepseek-flash
 *   node scripts/run-socratic-once.mjs
 *
 * 可选变量：
 *   PROBE_TOPIC          教学主题（默认「闭包」）
 *   PROBE_OPTION_MODEL   副模型名（默认＝PROBE_MODEL，`决策记录.md` B-14 决策 1）
 *   PROBE_OPTION_PROMPT  副模型提示词（默认读 `src/locales/zh/translation.json` 的 `SystemPrompts.optionAiMode`）
 *
 * 输出：控制台打印「问题 / 每档文案 / 步数 / 事件序列 / response.messages 摘要 / 四项判据」，
 *      完整结果写入 `scripts/socratic-once.output.json`（不含密钥）。
 *
 * 退出码：0 = 四项判据全过；1 = 配置缺失、模型没触发工具、或判据有不达标项。
 *
 * 安全：密钥只在内存中使用，打印与落盘时都不出现（只打印掩码）。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createModes, getMode } from '../src/agent/modes.js';
import { runTeachingAgent } from '../src/agent/runTeachingAgent.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUTPUT_PATH = join(HERE, 'socratic-once.output.json');

/** 开闸标记（协议不变量 2 要求两处都没有）。 */
const GATE_MARKER = '\u200B';
/** 脚本看门狗：主运行上限 120s，留 30s 余量。 */
const WATCHDOG_MS = 150_000;

const BASE_URL = (process.env.PROBE_BASE_URL || '').trim();
const API_KEY = (process.env.PROBE_API_KEY || '').trim();
const MODEL = (process.env.PROBE_MODEL || '').trim();
const OPTION_MODEL = (process.env.PROBE_OPTION_MODEL || MODEL).trim();
const TOPIC = (process.env.PROBE_TOPIC || '闭包').trim();

if (!BASE_URL || !API_KEY || !MODEL) {
  console.error(
    '缺少环境变量。需要 PROBE_BASE_URL / PROBE_API_KEY / PROBE_MODEL 三个都设置（参见 A3 的 scripts/probe-tools.mjs）。',
  );
  process.exit(1);
}

const mask = (value) =>
  typeof value === 'string' && value.length > 8 ? `${value.slice(0, 4)}****${value.slice(-4)}` : '****';

const line = (text = '') => console.log(text);
const heading = (text) => {
  line('');
  line(`── ${text} ${'─'.repeat(Math.max(0, 46 - text.length))}`);
};

/** 副模型提示词：优先环境变量，否则读翻译文件（`prompts.js` 顶层碰 localStorage，Node 侧不能 import）。 */
function loadOptionPrompt() {
  const override = (process.env.PROBE_OPTION_PROMPT || '').trim();
  if (override) return { prompt: override, source: 'env:PROBE_OPTION_PROMPT' };

  const localePath = join(ROOT, 'src/locales/zh/translation.json');
  const locale = JSON.parse(readFileSync(localePath, 'utf8'));
  const prompt = locale?.SystemPrompts?.optionAiMode;
  if (typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error(`副模型提示词为空：${localePath} 的 SystemPrompts.optionAiMode 不是非空字符串`);
  }
  return { prompt: prompt.trim(), source: 'src/locales/zh/translation.json#SystemPrompts.optionAiMode' };
}

function loadModes() {
  return createModes({
    normal: readFileSync(join(ROOT, 'src/agent/skills/normal.md'), 'utf8'),
    socratic: readFileSync(join(ROOT, 'src/agent/skills/socratic.md'), 'utf8'),
  });
}

/** `response.messages` 的结构摘要（不打印全文，避免题干全文淹没控制台）。 */
function summarizeMessages(messages) {
  return (messages || []).map((message, index) => ({
    index,
    role: message.role,
    parts: (message.content || []).map((part) => ({
      type: part.type,
      toolCallId: part.toolCallId,
      toolName: part.toolName,
      textLength: typeof part.text === 'string' ? part.text.length : undefined,
    })),
  }));
}

/** 调用与结果是否配对：每个 `tool-call` 都要有同 id 的 `tool-result` 或 `tool-error`。 */
function checkPairing(messages) {
  const calls = [];
  const results = [];
  for (const message of messages || []) {
    for (const part of message.content || []) {
      if (part.type === 'tool-call') calls.push(part.toolCallId);
      if (part.type === 'tool-result' || part.type === 'tool-error') results.push(part.toolCallId);
    }
  }
  const missing = calls.filter((id) => !results.includes(id));
  return {
    calls: calls.length,
    results: results.length,
    paired: calls.length === results.length && missing.length === 0,
    missing,
    callIds: calls,
  };
}

const containsGateMarker = (value) => JSON.stringify(value ?? null).includes(GATE_MARKER);

async function main() {
  const optionPrompt = loadOptionPrompt();
  const modes = loadModes();
  const mode = getMode(modes, 'socratic');

  const runId = `run_${globalThis.crypto.randomUUID()}`;
  const conversationId = `conv_${globalThis.crypto.randomUUID()}`;
  const turnId = `turn_${globalThis.crypto.randomUUID()}`;

  heading('配置');
  line(`端点      : ${BASE_URL}`);
  line(`主模型    : ${MODEL}`);
  line(`副模型    : ${OPTION_MODEL}${OPTION_MODEL === MODEL ? '（与主模型相同）' : '（独立配置）'}`);
  line(`密钥      : ${mask(API_KEY)}`);
  line(`模式      : ${mode.id}（教学指令 ${mode.teaching.length} 字符）`);
  line(`副模型提示: ${optionPrompt.source}（${optionPrompt.prompt.length} 字符）`);
  line(`主题      : ${TOPIC}`);
  line(`身份      : conversationId=${conversationId}`);
  line(`            turnId=${turnId}`);
  line(`            runId=${runId}`);
  line('可选参数  : thinking / reasoningEffort 未传（B7 取最小面，记录在案）');

  const events = [];
  const controller = new AbortController();
  let watchdogFired = false;
  const watchdog = setTimeout(() => {
    watchdogFired = true;
    controller.abort();
  }, WATCHDOG_MS);

  let result;
  try {
    result = await runTeachingAgent({
      conversationId,
      turnId,
      runId,
      mode,
      config: { endpoint: BASE_URL, apiKey: API_KEY, model: MODEL },
      messages: [
        {
          role: 'user',
          content: `我想学「${TOPIC}」。请先弄清楚我现在的理解程度，再决定怎么讲。`,
        },
      ],
      optionConfig: { endpoint: BASE_URL, apiKey: API_KEY, model: OPTION_MODEL },
      optionSystemPrompt: optionPrompt.prompt,
      abortSignal: controller.signal,
      onEvent: (event) => events.push(event),
    });
  } finally {
    clearTimeout(watchdog);
  }

  // ── 结果汇总 ──
  const toolStarted = events.filter((event) => event.type === 'tool-started');
  const toolCompleted = events.filter((event) => event.type === 'tool-completed');
  const toolFailed = events.filter((event) => event.type === 'tool-failed');
  const readyQuestions = toolCompleted.filter((event) => event.output?.status === 'ready');
  const rejectedCalls = toolCompleted.filter((event) => event.output?.status === 'rejected');

  const messages = result.responseMessages || [];
  const pairing = checkPairing(messages);
  const gateInEvents = containsGateMarker(events);
  const gateInMessages = containsGateMarker(messages);
  const gateInQuestions = containsGateMarker(readyQuestions.map((event) => event.output));

  heading('事件序列');
  line(events.map((event) => event.type).join(' > ') || '（没有事件）');
  line(
    `统计：tool-started=${toolStarted.length} tool-completed=${toolCompleted.length} tool-failed=${toolFailed.length}`,
  );

  heading('问题与候选答案');
  if (readyQuestions.length === 0) {
    line('（没有就绪的问题）');
  }
  for (const [index, event] of readyQuestions.entries()) {
    const question = event.output;
    line(`[${index + 1}] ${question.question}`);
    line(`    questionId=${question.questionId} toolCallId=${event.toolCallId}`);
    line(`    档位 ${question.options?.length ?? 0} 档 · optionsStatus=${question.optionsStatus}${
      question.errorCode ? ` · errorCode=${question.errorCode}` : ''
    }`);
    for (const option of question.options || []) {
      line(`      - ${option.level}: ${option.text}`);
    }
  }
  for (const [index, event] of rejectedCalls.entries()) {
    line(`[拒绝 ${index + 1}] reason=${event.output.reason}${event.output.message ? ` message=${event.output.message}` : ''}`);
  }
  for (const [index, event] of toolFailed.entries()) {
    line(`[工具失败 ${index + 1}] toolCallId=${event.toolCallId} error=${String(event.error?.name || event.error)}`);
  }

  heading('步数与结束原因');
  line(`步数          : ${result.stepCount}`);
  line(`结束原因      : ${result.reason}`);
  line(`finishReason  : ${result.finishReason ?? 'null'}`);
  line(`awaitingUser  : ${result.awaitingUser}`);
  line(`传输层 endedBy: ${result.endedBy}`);
  line(`错误          : ${result.error ? result.error.name : 'null'}${watchdogFired ? '（脚本看门狗触发）' : ''}`);

  heading('response.messages 摘要');
  line(JSON.stringify(summarizeMessages(messages), null, 2));

  // ── 四项判据 ──
  const checks = [
    {
      name: '问题真实打印（不是占位文本）',
      ok: readyQuestions.length > 0 && readyQuestions.every((event) => Boolean(event.output?.question)),
      detail: `就绪问题 ${readyQuestions.length} 个；档位数 ${readyQuestions.map((e) => e.output?.options?.length ?? 0).join('/') || '0'}`,
    },
    {
      name: '步数已打印，且停止发生在工具成功之后',
      ok: result.stepCount >= 1 && toolCompleted.length > 0 && result.reason === 'awaiting_user',
      detail: `stepCount=${result.stepCount}，tool-completed=${toolCompleted.length}，reason=${result.reason}`,
    },
    {
      name: 'response.messages 调用与结果配对',
      ok: pairing.paired && pairing.calls > 0,
      detail: `calls=${pairing.calls} results=${pairing.results}${pairing.missing.length ? ` 缺 ${pairing.missing.join(',')}` : ''}`,
    },
    {
      name: '不含开闸标记（U+200B）',
      ok: !gateInEvents && !gateInMessages && !gateInQuestions,
      detail: `events=${gateInEvents} messages=${gateInMessages} questions=${gateInQuestions}`,
    },
  ];

  heading('判据');
  for (const check of checks) {
    line(`${check.ok ? '✅' : '❌'} ${check.name}  —— ${check.detail}`);
  }
  const allPassed = checks.every((check) => check.ok);

  // ── 未通过时的诊断（`决策记录.md` B-14 决策 3：不自动重跑）──
  if (!allPassed) {
    heading('诊断');
    if (result.reason === 'failed') {
      line('运行失败：检查端点地址、模型名、密钥，以及端点是否接受 tools 参数。');
      line(`传输层 endedBy=${result.endedBy}，错误名=${result.error ? result.error.name : 'null'}，步数=${result.stepCount}。`);
    } else if (result.reason === 'cancelled') {
      line(`运行被取消（外部 abort 或脚本看门狗${watchdogFired ? '：看门狗已触发' : ''}）。`);
    } else if (toolStarted.length === 0 && toolCompleted.length === 0 && toolFailed.length === 0) {
      line('模型没有调用 ask_question：它可能把问题写进了正文，或端点不支持工具调用。');
      line(`结束原因=${result.reason}，步数=${result.stepCount}。若正文里有问题文本，说明教学指令压不住"直接讲解"。`);
    } else if (result.reason === 'limit_reached') {
      line('3 步用完仍未拿到 next_action=await_user：检查工具结果是否被拒（见上面的「拒绝」行）。');
    } else {
      line('工具已执行但判据未全过：见上面每一项的 detail。');
    }
  }

  // ── 落盘（不含密钥）──
  const report = {
    when: new Date().toISOString(),
    topic: TOPIC,
    endpoint: BASE_URL,
    model: MODEL,
    optionModel: OPTION_MODEL,
    mode: mode.id,
    ids: { conversationId, turnId, runId },
    optionPromptSource: optionPrompt.source,
    optionalParams: { thinking: null, reasoningEffort: null },
    result: {
      reason: result.reason,
      finishReason: result.finishReason,
      stepCount: result.stepCount,
      awaitingUser: result.awaitingUser,
      endedBy: result.endedBy,
      errorName: result.error ? result.error.name : null,
      watchdogFired,
    },
    eventSequence: events.map((event) => event.type),
    questions: readyQuestions.map((event) => ({
      toolCallId: event.toolCallId,
      questionId: event.output.questionId,
      question: event.output.question,
      optionsStatus: event.output.optionsStatus,
      errorCode: event.output.errorCode ?? null,
      options: event.output.options ?? [],
    })),
    rejected: rejectedCalls.map((event) => ({
      toolCallId: event.toolCallId,
      reason: event.output.reason,
      message: event.output.message ?? null,
    })),
    pairing: { calls: pairing.calls, results: pairing.results, paired: pairing.paired, missing: pairing.missing },
    gateMarker: { inEvents: gateInEvents, inMessages: gateInMessages, inQuestions: gateInQuestions },
    responseMessages: summarizeMessages(messages),
    checks,
    allPassed,
  };
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  heading('落盘');
  line(`完整结果 → scripts/socratic-once.output.json（不含密钥）`);
  line('');
  line(allPassed ? 'B7 四项判据全过。' : 'B7 有判据未过，见上面的 ❌ 与诊断。');

  process.exit(allPassed ? 0 : 1);
}

main().catch((error) => {
  console.error('B7 脚本自身出错：', error?.message || error);
  process.exit(1);
});
