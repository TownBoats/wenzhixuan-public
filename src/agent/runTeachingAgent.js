/**
 * 运行层 · 一次教学运行（阶段 B · 任务 B5）
 *
 * 职责：把 B1（模型执行）、B2（模式）、B3（副模型）、B4（提问工具）装配成**唯一入口**，
 * 并负责整轮语义的两件事——预算与结束原因。细粒度事件（text / reasoning / tool）由 B1 产出，
 * B5 只做「转发 + 归属过滤」，外加首尾两个边界事件。
 *
 * 边界（`决策记录.md` B-12）：
 *   - 不生成身份：`conversationId` / `turnId` / `runId` 必须由会话层（或 B7 脚本）传入，缺失当场抛错
 *   - 不重试：一次调用恰好一对 `run-started` / `run-finished`；重试是上层换新 `runId` 再调一次
 *   - 不拼协议消息：`responseMessages` 一律取 B1 的返回值
 *   - 不读 localStorage / 不碰 React：配置与提示词由上层传入，本文件可被 `node --test` 直接导入
 *
 * 结束原因五选一且不可合并（`01-核心协议.md` §4）：
 *   `completed | awaiting_user | limit_reached | failed | cancelled`
 */

import { stepCountIs } from 'ai';

import { runModelTurn } from './modelAdapter.js';
import {
  ASK_QUESTION_TOOL,
  EXPLAIN_CARD_TOOL,
  VISUALIZE_TOOL,
  buildSystemPrompt,
  toolsForMode,
} from './modes.js';
import { REJECT_INTERNAL_ERROR, createAskQuestionTool } from './tools/askQuestion.js';
import { createExplainCardTool } from './tools/explainCard.js';
import { createVisualizeTool } from './tools/visualize.js';

/** 每轮最多 3 步（安全上限，防模型跑飞）。 */
export const MAX_STEPS = 3;

/** 主运行预算 120 秒。副模型预算由 B3 在 45s 与「主运行剩余」之间取小。 */
export const MAIN_RUN_TIMEOUT_MS = 120_000;

/** 副模型并发上限 4（`决策记录.md` B-3）：超出排队，失败隔离。 */
export const OPTION_CONCURRENCY_LIMIT = 4;

/** 五个业务结束原因。 */
export const RUN_REASONS = Object.freeze({
  COMPLETED: 'completed',
  AWAITING_USER: 'awaiting_user',
  LIMIT_REACHED: 'limit_reached',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
});

/**
 * 身份校验：三个 ID 都必须是去空白后非空的字符串。
 * 放在发出 `run-started` 之前——否则会出现「有 started 没有可归属的 runId」的悬空事件。
 */
function assertRunIdentity({ conversationId, turnId, runId }) {
  const fields = { conversationId, turnId, runId };
  const missing = Object.entries(fields)
    .filter(([, value]) => typeof value !== 'string' || !value.trim())
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(
      `runTeachingAgent: 缺少运行身份 ${missing.join(' / ')}（应由会话层分配后传入，运行层不自造）`,
    );
  }
  return {
    conversationId: conversationId.trim(),
    turnId: turnId.trim(),
    runId: runId.trim(),
  };
}

/** 装配前置校验：模式、配置、上下文、事件回调缺一不可，且都要在 `run-started` 之前失败。 */
function assertRunInputs({ mode, config, messages, onEvent }) {
  if (!mode || typeof mode.id !== 'string' || !Array.isArray(mode.toolNames)) {
    throw new Error('runTeachingAgent: mode 必须是 modes.js 产出的模式对象');
  }
  if (!config || typeof config !== 'object') {
    throw new Error('runTeachingAgent: 缺少主模型配置快照（config）');
  }
  if (!Array.isArray(messages)) {
    throw new Error('runTeachingAgent: messages 必须是数组');
  }
  if (typeof onEvent !== 'function') {
    throw new Error('runTeachingAgent: 缺少 onEvent');
  }
}

/**
 * 本轮私有的并发限流器（不放进 B3，也不做成模块级全局状态）。
 *
 * 为什么在装配层：上限属于「本轮预算」，只有 B5 知道本轮边界；
 * 放在副模型服务里会跨轮累积，取消后槽位还可能泄漏（`决策记录.md` B-12 结论 1）。
 */
function createLimiter(limit) {
  let active = 0;
  const waiting = [];

  return {
    get active() {
      return active;
    },
    acquire() {
      if (active < limit) {
        active += 1;
        return Promise.resolve();
      }
      return new Promise((resolve) => waiting.push(resolve));
    },
    release() {
      const next = waiting.shift();
      // 直接移交给下一个等待者：active 不变，避免「先减再加」被并发读到瞬时 -1
      if (next) next();
      else active -= 1;
    },
  };
}

/**
 * 给 B4 的工具套一层并发闸门。
 *
 * **不改 B4**：对象展开保留 `description` / `inputSchema`，只覆写 `execute`
 * （实测 `tool()` 返回的就是 `{ description, inputSchema, execute }` 纯对象）。
 * 缺 `execute` 时不包装——漏掉 `inputSchema` 会让 SDK 失去参数校验，
 * 所以这里只做「加一层」，不做「重造」。
 */
function withOptionConcurrency(baseTool, limiter) {
  const originalExecute = baseTool?.execute;
  if (typeof originalExecute !== 'function') return baseTool;

  return {
    ...baseTool,
    async execute(input, options = {}) {
      // 排队前已取消：不进 execute，也不打副模型请求（该运行不会把结果写进上下文）
      if (options?.abortSignal?.aborted) {
        return {
          status: 'rejected',
          reason: REJECT_INTERNAL_ERROR,
          message: '运行已取消，本次调用未执行',
        };
      }
      await limiter.acquire();
      try {
        return await originalExecute(input, options);
      } finally {
        limiter.release();
      }
    },
  };
}

/**
 * 业务结束原因（`决策记录.md` B-12 结论 3 / 5）。
 *
 * 顺序即优先级：
 *   取消 → 取消；其余传输层失败（含超时）→ 失败；
 *   问题已就绪 → 等待作答；最后一步仍以工具调用收尾（被步数上限截断）→ 达到上限；其余 → 正常完成。
 *
 * 为什么用 `finishReason === 'tool-calls'` 而不是 `stepCount === 3`：
 * 前者表达「模型还想继续调工具、被上限切断」，后者会把「第 3 步自然说完」误报成越界。
 */
export function resolveRunReason({ endedBy, finishReason }, awaitingUser) {
  if (endedBy === 'cancelled') return RUN_REASONS.CANCELLED;
  if (endedBy !== 'finished') return RUN_REASONS.FAILED;
  if (awaitingUser) return RUN_REASONS.AWAITING_USER;
  if (finishReason === 'tool-calls') return RUN_REASONS.LIMIT_REACHED;
  return RUN_REASONS.COMPLETED;
}

/**
 * 跑一次教学运行。
 *
 * @param {Object} params
 * @param {string} params.conversationId  会话身份（会话层 / B7 脚本分配）
 * @param {string} params.turnId          本轮身份（同上）
 * @param {string} params.runId           本次运行身份（同上；事件归属与迟到丢弃都以它为准）
 * @param {Object} params.mode            模式对象（`modes.js` 的产物）
 * @param {Object} params.config          主模型配置快照 `{ endpoint, apiKey, model, thinking?, reasoningEffort? }`
 * @param {Array}  params.messages        已配对、已完成的上下文消息
 * @param {Object} [params.optionConfig]  副模型配置快照 `{ endpoint, apiKey, model }`
 * @param {string} [params.optionSystemPrompt] 副模型提示词（上层从配置层读出后传入）
 * @param {AbortSignal} [params.abortSignal]
 * @param {(event: Object) => void} params.onEvent 规范事件回调
 * @param {Function} [params.generateOptions] 副模型服务（默认 B3；测试注入假函数）
 * @param {Function} [params.baseFetch]       主模型 fetch 注入（测试用）
 * @param {Object} [params.model]             主模型对象注入（测试用 `ai/test` 的 MockLanguageModelV3）；
 *   生产路径永远不传（`决策记录.md` B-13）
 * @returns {Promise<{ runId: string, conversationId: string, turnId: string,
 *   reason: string, endedBy: string|null, finishReason: string|null, stepCount: number,
 *   awaitingUser: boolean, responseMessages: Array, error: Error|null }>}
 */
export async function runTeachingAgent({
  conversationId,
  turnId,
  runId,
  mode,
  config,
  messages,
  optionConfig,
  optionSystemPrompt,
  abortSignal,
  onEvent,
  generateOptions,
  baseFetch,
  model,
} = {}) {
  // ── 1. 前置校验与装配：全部在 run-started 之前，失败即抛错、不产生任何事件 ──
  const identity = assertRunIdentity({ conversationId, turnId, runId });
  assertRunInputs({ mode, config, messages, onEvent });

  const startedAt = Date.now();
  const deadline = startedAt + MAIN_RUN_TIMEOUT_MS;

  /**
   * 副模型剩余预算。**必须 ≥1**：B3 的 `resolveTimeout` 只在 `> 0` 时夹取，
   * 返回 0 会回落到 45s（`generateAnswerOptions.js:76-79`）。
   */
  const getRemainingMs = () => Math.max(1, deadline - Date.now());

  let awaitingUser = false;

  /**
   * 停止条件之一（`01-核心协议.md` §3）：最后一步的**任一**工具结果带 `nextAction:'await_user'`。
   * 不用「按工具名判定停止」的内置条件：它在「模型调用了工具」时就停，参数非法也会停，
   * 方案里「预算内允许修正一次」会直接失效（理由见协议 §3）。
   *
   * `awaitingUser` 只在这里置位：停止原因与「为什么停」来自同一处判断，避免第二真相源。
   */
  const askQuestionReady = ({ steps }) => {
    const results = Array.isArray(steps?.at(-1)?.toolResults) ? steps.at(-1).toolResults : [];
    const hit = results.some(
      (item) => item?.toolName === ASK_QUESTION_TOOL && item?.output?.nextAction === 'await_user',
    );
    if (hit) awaitingUser = true;
    return hit;
  };

  const limiter = createLimiter(OPTION_CONCURRENCY_LIMIT);
  const askQuestionTool = withOptionConcurrency(
    createAskQuestionTool({
      mode,
      optionConfig,
      optionSystemPrompt,
      generateOptions,
      getRemainingMs,
    }),
    limiter,
  );
  const tools = toolsForMode(mode, {
    [ASK_QUESTION_TOOL]: askQuestionTool,
    // visualize / explain_card 无外部依赖、不打断运行，无需并发闸门，每轮新实例保证幂等表不跨轮。
    [VISUALIZE_TOOL]: createVisualizeTool(),
    [EXPLAIN_CARD_TOOL]: createExplainCardTool(),
  });

  // ── 2. 事件转发：不属于本次运行的事件丢弃（返回原状态、不报错、不记日志）──
  const forwardEvent = (event) => {
    if (!event || event.runId !== identity.runId) return;
    onEvent(event);
  };

  onEvent({
    type: 'run-started',
    conversationId: identity.conversationId,
    turnId: identity.turnId,
    runId: identity.runId,
    mode: mode.id,
  });

  // ── 3. 执行：三条出口（正常 / 传输层失败 / 抛错）都必须落到 run-finished ──
  let result = null;
  let reason = RUN_REASONS.FAILED;

  try {
    result = await runModelTurn({
      runId: identity.runId,
      // 主运行预算由本层固定 120s（不采信调用方覆盖，否则「120s」不可断言）；
      // 它同时是副模型「剩余时间」的计算基准。
      config: { ...config, timeoutMs: MAIN_RUN_TIMEOUT_MS },
      messages,
      tools,
      stopWhen: [stepCountIs(MAX_STEPS), askQuestionReady],
      system: buildSystemPrompt(mode),
      abortSignal,
      onEvent: forwardEvent,
      baseFetch,
      model,
    });
    reason = resolveRunReason(result, awaitingUser);
  } catch (error) {
    result = {
      endedBy: abortSignal?.aborted ? 'cancelled' : 'failed',
      finishReason: null,
      stepCount: 0,
      responseMessages: [],
      error,
    };
    reason = abortSignal?.aborted ? RUN_REASONS.CANCELLED : RUN_REASONS.FAILED;
  } finally {
    onEvent({
      type: 'run-finished',
      runId: identity.runId,
      reason,
      responseMessages: result?.responseMessages ?? [],
    });
  }

  return {
    runId: identity.runId,
    conversationId: identity.conversationId,
    turnId: identity.turnId,
    reason,
    endedBy: result?.endedBy ?? null,
    finishReason: result?.finishReason ?? null,
    stepCount: result?.stepCount ?? 0,
    awaitingUser,
    // 一律取 B1 的返回值：手工拼装会与 SDK 内部记录重复，产生重复的 tool 消息。
    responseMessages: result?.responseMessages ?? [],
    error: result?.error ?? null,
  };
}

export default runTeachingAgent;
