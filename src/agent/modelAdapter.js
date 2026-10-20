import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';

/**
 * 运行层 · 一次模型执行（阶段 B · 任务 B1）
 *
 * 职责只有四件，别的一概不做：
 *   1. 装载：按配置快照建一次连接（用完即弃，不复用单例、不读全局配置）
 *   2. 翻译：把 SDK 的 fullStream 方言翻成规范事件（带 runId / partId / toolCallId）
 *   3. 净化：开闸标记（U+200B）在「出口」两处清掉；reasoning 只展示、不回传
 *   4. 交账：返回整轮的 responseMessages（来自 SDK，不手工拼）与传输层结束原因
 *
 * 边界（见 `docs/agent-mvp/决策记录.md` B-1 ~ B-7 与 `01-核心协议.md` §4）：
 *   - 不决定「下一步做不做」：stopWhen 由上层构造后传入，本模块只透传
 *   - 不重试：maxRetries 固定 0（工具可能已执行，重放不幂等；重试是上层策略）
 *   - 不发 run-started / run-finished：那是整轮语义，由 B5 统一发出
 *   - 不碰 React / localStorage / window / JSX：本文件要能被 node --test 直接导入
 */

/** 开闸标记（零宽空格）。它属于传输层，不属于模型输出。 */
const GATE_MARKER = '\u200B';
const GATE_MARKER_RE = /\u200B/g;

/** 主运行预算（协议：主运行 120s）。可由配置快照覆盖。 */
const DEFAULT_TIMEOUT_MS = 120_000;

/** AI SDK 允许的 reasoningEffort 取值；`max` 等不在其中，只能注入请求体（决策 A-6）。 */
const SDK_REASONING_EFFORTS = new Set(['none', 'minimal', 'low', 'medium', 'high', 'xhigh']);

const stripGate = (value) => (typeof value === 'string' ? value.replace(GATE_MARKER_RE, '') : value);

/**
 * 给失败错误打类别标记（协议 §5 的 `errorKind`）。
 *
 * 为什么不让上层去猜：会话层只拿得到 `message`，而「超时」与「取消」在传输层是同一句
 * `运行已中断`，`Failed to fetch` 也只是 TypeError 的默认文案。类别在**产生它的地方**记录，
 * 上层才能把它映射成可读文案（F3）。
 */
function tagError(error, endedBy) {
  const target = error instanceof Error ? error : new Error(String(error ?? '运行失败'));
  try {
    target.endedBy = endedBy;
  } catch {
    // 冻结对象等极端情况：打不上标记就退化为「普通失败」，不影响返回值
  }
  return target;
}

/** 递归清理任意结构里的开闸标记（协议不变量 2 覆盖所有字段，不只是 text）。 */
const sanitizeValue = (value) => {
  if (typeof value === 'string') return stripGate(value);
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === 'object') {
    const next = {};
    for (const [key, item] of Object.entries(value)) next[key] = sanitizeValue(item);
    return next;
  }
  return value;
};

/**
 * 清理协议消息：先递归去标记，再丢弃「清理后变成空文本」的片段。
 * 留空文本片段会让下一轮上下文里出现空的 assistant 片段，某些端点会拒绝。
 */
function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  const cleaned = sanitizeValue(messages).map((message) => {
    if (!message || !Array.isArray(message.content)) return message;
    const content = message.content.filter(
      (part) => !(part && part.type === 'text' && typeof part.text === 'string' && part.text === ''),
    );
    return { ...message, content };
  });
  return cleaned.filter((message) => !(message && Array.isArray(message.content) && message.content.length === 0));
}

/** 运行层不读 window：只接受绝对 URL，最多去掉末尾的 /chat/completions。 */
export function normalizeEndpoint(endpoint) {
  if (typeof endpoint !== 'string' || !endpoint.trim()) {
    throw new Error('modelAdapter: 配置快照缺少端点（endpoint）');
  }
  const trimmed = endpoint.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('modelAdapter: 端点必须是绝对 URL（运行层不做相对路径补全）');
  }
  return trimmed.replace(/\/chat\/completions(\?.*)?$/, '').replace(/\/+$/, '');
}

/**
 * 把「思考开关」与「思考强度」分成两条通道：
 *   - SDK 认识的强度值 → providerOptions.openai.reasoningEffort
 *   - SDK 不认识的值（如 max）与 thinking → 注入请求体
 * 只增不改：注入时保留请求体里其余字段。
 */
function buildRequestInjection(config) {
  const bodyPatch = {};

  if (config.thinking === 'enabled' || config.thinking === 'disabled') {
    bodyPatch.thinking = { type: config.thinking };
  }

  let providerEffort;
  if (config.reasoningEffort) {
    if (SDK_REASONING_EFFORTS.has(config.reasoningEffort)) providerEffort = config.reasoningEffort;
    else bodyPatch.reasoning_effort = config.reasoningEffort;
  }

  return {
    providerEffort,
    bodyPatch: Object.keys(bodyPatch).length > 0 ? bodyPatch : null,
  };
}

/**
 * 自定义 fetch：一次包装里做两件事，保证互不覆盖。
 *   a) 请求体注入（thinking / reasoning_effort=max）
 *   b) 开闸：在 SSE 响应最前面补一条 content=U+200B 的事件
 *
 * 为什么需要 (b)：@ai-sdk/openai 会先读到「首个输出 chunk」才放行整条流，
 * 而 DeepSeek 的 delta.reasoning_content 不算输出 chunk，思考内容会被整段扣住。
 * 补一颗不可见的「哑弹」让探测立刻放行；该字符随后在两处被清掉（见文件头）。
 */
function createGateFetch({ baseFetch, bodyPatch }) {
  const fetchImpl = baseFetch || globalThis.fetch;

  return async function gateFetch(input, init) {
    let nextInit = init;

    if (bodyPatch && init && typeof init.body === 'string') {
      try {
        const parsed = JSON.parse(init.body);
        nextInit = { ...init, body: JSON.stringify({ ...parsed, ...bodyPatch }) };
      } catch {
        nextInit = init; // 不是 JSON 请求体：保持原样，不猜
      }
    }

    const response = await fetchImpl(input, nextInit);
    const contentType = response?.headers?.get?.('content-type') || '';

    if (!response?.ok || !response.body || !contentType.includes('text/event-stream')) {
      return response;
    }

    const gateEvent = `data: ${JSON.stringify({
      id: 'gate-opener',
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: 'gate-opener',
      choices: [{ index: 0, delta: { content: GATE_MARKER }, finish_reason: null }],
    })}\n\n`;

    const encoder = new TextEncoder();
    let gateSent = false;

    const stream = response.body.pipeThrough(
      new TransformStream({
        transform(chunk, controller) {
          if (!gateSent) {
            gateSent = true;
            controller.enqueue(encoder.encode(gateEvent));
          }
          controller.enqueue(chunk);
        },
      }),
    );

    return new Response(stream, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
}

function normalizeConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('modelAdapter: 缺少配置快照');
  }
  if (!config.model) {
    throw new Error('modelAdapter: 配置快照缺少 model');
  }

  const { providerEffort, bodyPatch } = buildRequestInjection(config);

  return {
    baseURL: normalizeEndpoint(config.endpoint ?? config.baseURL),
    model: config.model,
    apiKey: config.apiKey || 'placeholder', // 本地代理端点可能不校验密钥
    timeoutMs: Number.isFinite(config.timeoutMs) ? config.timeoutMs : DEFAULT_TIMEOUT_MS,
    maxOutputTokens: Number.isFinite(config.maxOutputTokens) ? config.maxOutputTokens : undefined,
    providerOptions: providerEffort ? { openai: { reasoningEffort: providerEffort } } : undefined,
    bodyPatch,
  };
}

/**
 * 跑一次模型执行（可能含多步：模型调工具 → 程序执行 → 结果回传 → 继续）。
 *
 * @param {Object} params
 * @param {string} params.runId        本次运行的身份，所有事件都会带上它
 * @param {Object} params.config       配置快照 { endpoint, apiKey, model, thinking?, reasoningEffort?, timeoutMs?, maxOutputTokens? }
 * @param {Array}  params.messages     上下文消息
 * @param {Object} [params.tools]      工具集合；普通模式传空对象
 * @param {Array}  [params.stopWhen]   停止条件，由上层（B5）构造后传入
 * @param {string} [params.system]     系统提示词，由上层（B2/B5）装配后传入
 * @param {AbortSignal} [params.abortSignal] 外部取消信号
 * @param {(event: Object) => void} params.onEvent 规范事件回调
 * @param {Function} [params.baseFetch] 可注入的 fetch（测试用）
 * @param {Object} [params.model] 直接注入的语言模型（测试用：`ai/test` 的 MockLanguageModelV3）。
 *   不传时按配置快照装配 provider —— 生产路径永远不传它（`决策记录.md` B-13）。
 * @returns {Promise<{ ok: boolean, endedBy: 'finished'|'cancelled'|'timeout'|'failed',
 *   finishReason: string|null, stepCount: number, responseMessages: Array, error?: Error }>}
 */
export async function runModelTurn({
  runId,
  config,
  messages,
  tools,
  stopWhen,
  system,
  abortSignal,
  onEvent,
  baseFetch,
  model,
}) {
  if (!runId) throw new Error('modelAdapter: 缺少 runId');
  if (typeof onEvent !== 'function') throw new Error('modelAdapter: 缺少 onEvent');
  if (!Array.isArray(messages)) throw new Error('modelAdapter: messages 必须是数组');

  const snapshot = normalizeConfig(config);

  // ── 1. 取消与超时：两件不同的事，最后要能分别上报 ──
  const controller = new AbortController();
  let timedOut = false;
  let cancelled = false;

  const handleExternalAbort = () => {
    cancelled = true;
    controller.abort();
  };

  if (abortSignal) {
    if (abortSignal.aborted) handleExternalAbort();
    else abortSignal.addEventListener('abort', handleExternalAbort, { once: true });
  }

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, snapshot.timeoutMs);

  // ── 2. provider：每轮按快照新建，不复用、不传 compatibility（锁定版本无此选项）──
  const provider = createOpenAI({
    baseURL: snapshot.baseURL,
    apiKey: snapshot.apiKey,
    fetch: createGateFetch({ baseFetch, bodyPatch: snapshot.bodyPatch }),
  });

  // 注入的模型（测试）优先；生产路径永远走配置装配。
  const languageModel = model ?? provider.chat(snapshot.model);

  const hasTools = Boolean(tools && Object.keys(tools).length > 0);

  const emit = (event) => {
    // 取消/超时之后不再产生任何事件（B1 判据③）
    if (controller.signal.aborted) return;
    onEvent(event);
  };

  let streamError = null;
  let sawProviderReasoning = false;
  const reasoningPartId = `reasoning:${runId}`;

  // 卡住的流也必须能被取消/超时打断：abort 只是置标志，pending 的 read 不会自己返回，
  // 所以用一个「中断承诺」与每次 read 赛跑（否则端点只发 headers 不给数据时会一直挂着）。
  let reader = null;
  let interrupt = () => {};
  const interrupted = new Promise((_, reject) => {
    interrupt = reject;
  });
  interrupted.catch(() => {}); // 正常结束时没人等它，避免未处理的拒绝
  const interruptOnAbort = () => interrupt(new DOMException('运行已中断', 'AbortError'));
  if (controller.signal.aborted) interruptOnAbort();
  else controller.signal.addEventListener('abort', interruptOnAbort, { once: true });

  try {
    const result = streamText({
      model: languageModel,
      ...(system ? { system } : {}),
      messages,
      ...(hasTools ? { tools } : {}),
      ...(stopWhen ? { stopWhen } : {}),
      ...(snapshot.providerOptions ? { providerOptions: snapshot.providerOptions } : {}),
      ...(snapshot.maxOutputTokens != null ? { maxOutputTokens: snapshot.maxOutputTokens } : {}),
      abortSignal: controller.signal,
      maxRetries: 0,
      // 用于从原始 chunk 提取 delta.reasoning_content（openai provider 不映射该字段）
      includeRawChunks: true,
    });

    reader = result.fullStream.getReader();

    for (;;) {
      if (controller.signal.aborted) break;

      const { value: part, done } = await Promise.race([reader.read(), interrupted]);
      if (done) break;

      switch (part.type) {
        case 'text-delta': {
          const delta = stripGate(part.text ?? '');
          if (!delta) continue;
          emit({ type: 'text-delta', runId, partId: part.id ?? `text:${runId}`, delta });
          continue;
        }
        case 'reasoning-delta': {
          sawProviderReasoning = true;
          const delta = stripGate(part.text ?? '');
          if (!delta) continue;
          emit({ type: 'reasoning-delta', runId, partId: part.id ?? reasoningPartId, delta });
          continue;
        }
        case 'raw': {
          if (sawProviderReasoning) continue;
          const raw = part.rawValue?.choices?.[0]?.delta?.reasoning_content;
          const delta = stripGate(raw ?? '');
          if (!delta) continue;
          emit({ type: 'reasoning-delta', runId, partId: reasoningPartId, delta });
          continue;
        }
        case 'tool-input-start': {
          // 参数开始流出（explore/streaming-cards）：比 tool-call 早得多，
          // 展示层靠它把「运行中」卡片提前摆出来。
          // 实测（ai@6.0.177）：该部分的调用 ID 字段叫 `id`，与 tool-call 的 toolCallId 同值。
          if (!part.id) continue; // 没有身份就不建卡（不变量 5 的前提）
          emit({
            type: 'tool-input-started',
            runId,
            toolCallId: part.id,
            toolName: part.toolName,
          });
          continue;
        }
        case 'tool-input-delta': {
          // 参数 JSON 的逐字增量；展示层据此做流式渲染（如 explain_card 的 SVG）。
          // 实测（ai@6.0.177）：增量字段叫 `delta`，归属字段叫 `id`。
          if (!part.id) continue;
          const delta = stripGate(part.delta ?? '');
          if (!delta) continue;
          emit({
            type: 'tool-input-delta',
            runId,
            toolCallId: part.id,
            delta,
          });
          continue;
        }
        case 'tool-call': {
          emit({
            type: 'tool-started',
            runId,
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            input: part.input,
          });
          continue;
        }
        case 'tool-result': {
          emit({
            type: 'tool-completed',
            runId,
            toolCallId: part.toolCallId,
            output: part.output,
          });
          continue;
        }
        case 'tool-error': {
          emit({
            type: 'tool-failed',
            runId,
            toolCallId: part.toolCallId,
            error: part.error,
          });
          continue;
        }
        case 'error': {
          streamError = part.error ?? new Error('模型流返回错误');
          break;
        }
        default:
          break;
      }
    }

    if (controller.signal.aborted) {
      return {
        ok: false,
        endedBy: timedOut ? 'timeout' : 'cancelled',
        finishReason: null,
        stepCount: 0,
        responseMessages: [],
      };
    }

    if (streamError) {
      return {
        ok: false,
        endedBy: 'failed',
        finishReason: null,
        stepCount: 0,
        responseMessages: [],
        error: tagError(streamError, 'failed'),
      };
    }

    // ── 3. 交账：整轮消息必须从 steps 合并（result.response 只有最后一步）──
    const steps = await result.steps;
    const finalResponse = await result.response;
    // 实测（ai@6.0.177）：`steps[i].response.messages` 是「累积到该步」的，
    // 逐 step 拼接会重复；整轮消息取最后一次 response 即可（最后一步已含前面所有步）。
    const responseMessages = sanitizeMessages(finalResponse?.messages ?? []);

    return {
      ok: true,
      endedBy: 'finished',
      finishReason: steps.at(-1)?.finishReason ?? null,
      stepCount: steps.length,
      responseMessages,
    };
  } catch (error) {
    const endedBy = timedOut ? 'timeout' : cancelled || error?.name === 'AbortError' ? 'cancelled' : 'failed';
    return {
      ok: false,
      endedBy,
      finishReason: null,
      stepCount: 0,
      responseMessages: [],
      // 取消是用户意图，不是错误（协议 §4 / F1 判据②）：
      // 把 AbortError 交出去，会话层会写进 `turn.error`，界面就会冒出「运行已中断」的错误块。
      // 其余失败带上类别（`timeout` / `failed`），供会话层存成 `errorKind`（协议 §5 / F3）。
      error: endedBy === 'cancelled' ? null : tagError(error, endedBy),
    };
  } finally {
    clearTimeout(timeoutId);
    controller.signal.removeEventListener('abort', interruptOnAbort);
    if (abortSignal) abortSignal.removeEventListener('abort', handleExternalAbort);
    if (reader) {
      try {
        await reader.cancel();
      } catch {
        // 流可能已自然结束，取消失败不影响返回值
      }
    }
  }
}

export default runModelTurn;
