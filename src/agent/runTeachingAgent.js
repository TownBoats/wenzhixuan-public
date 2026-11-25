/**
 * 教学运行入口：装配模型、模式、副模型和工具，管理整轮预算与结束原因。
 *
 * - 身份 ID 由会话层传入，缺失即抛错
 * - 一次调用恰好一对 run-started / run-finished；重试由上层换新 runId 再调
 * - responseMessages 一律取模型适配层的返回值，不手工拼装
 * - 配置与提示词由上层传入，不依赖 React 与浏览器存储
 *
 * 结束原因：completed | awaiting_user | limit_reached | failed | cancelled
 */

import { stepCountIs } from 'ai';

import { runModelTurn } from './modelAdapter.js';
import {
  ASK_QUESTION_TOOL,
  EXPLAIN_CARD_TOOL,
  LEARNING_PLAN_TOOL,
  VISUALIZE_TOOL,
  buildSystemPrompt,
  toolsForMode,
} from './modes.js';
import { REJECT_INTERNAL_ERROR, createAskQuestionTool } from './tools/askQuestion.js';
import { CONTEXT_SOURCES, buildOptionContext, visualTitle } from './services/buildOptionContext.js';
import { createExplainCardTool } from './tools/explainCard.js';
import { createUpdateLearningPlanTool } from './tools/updateLearningPlan.js';
import { createVisualizeTool } from './tools/visualize.js';
import { planFromMessages } from './learningPlan.js';
import { collectReferences, createFigureId, describeRefs, resolveRefs } from './references.js';

/** 每轮最多 3 步（安全上限，防模型跑飞）。 */
export const MAX_STEPS = 3;

/** 主运行预算 120 秒。副模型预算由副模型服务在 45s 与「主运行剩余」之间取小。 */
export const MAIN_RUN_TIMEOUT_MS = 120_000;

/** 副模型并发上限 4：超出排队，失败隔离。 */
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
 * 本轮私有的并发限流器（不放进副模型服务，也不做成模块级全局状态）。
 *
 * 为什么在装配层：上限属于「本轮预算」，只有本文件知道本轮边界；
 * 放在副模型服务里会跨轮累积，取消后槽位还可能泄漏。
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
 * 给 `ask_question` 工具套一层并发闸门。
 *
 * **不改工具本身**：对象展开保留 `description` / `inputSchema`，只覆写 `execute`
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
 * 业务结束原因。
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
 * @param {string} params.conversationId  会话身份（会话层或脚本分配）
 * @param {string} params.turnId          本轮身份（同上）
 * @param {string} params.runId           本次运行身份（同上；事件归属与迟到丢弃都以它为准）
 * @param {Object} params.mode            模式对象（`modes.js` 的产物）
 * @param {Object} params.config          主模型配置快照 `{ endpoint, apiKey, model, thinking?, reasoningEffort? }`
 * @param {Array}  params.messages        已配对、已完成的上下文消息
 * @param {Object} [params.optionConfig]  副模型配置快照 `{ endpoint, apiKey, model }`
 * @param {string} [params.optionSystemPrompt] 副模型提示词（上层从配置层读出后传入）
 * @param {string[]} [params.studentTexts] 学生手写的原文，用于计划的证据校验
 * @param {AbortSignal} [params.abortSignal]
 * @param {(event: Object) => void} params.onEvent 规范事件回调
 * @param {(record: Object) => void} [params.onDebug] 调试记录回调，缺省时不产生记录
 * @param {Function} [params.generateOptions] 副模型服务（默认 `generateAnswerOptions`；测试注入假函数）
 * @param {Function} [params.baseFetch]       主模型 fetch 注入（测试用）
 * @param {Object} [params.model]             主模型对象注入（测试用 `ai/test` 的 MockLanguageModelV3）；
 *   生产路径永远不传
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
  studentTexts,
  onEvent,
  onDebug,
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
   * 副模型剩余预算。**必须 ≥1**：副模型服务的 `resolveTimeout` 只在 `> 0` 时夹取，
   * 返回 0 会回落到 45s（`generateAnswerOptions.js:76-79`）。
   */
  const getRemainingMs = () => Math.max(1, deadline - Date.now());

  let awaitingUser = false;

  /** 当前学习计划：本轮开始时取自上下文，本轮更新后取最新。 */
  let currentPlan = planFromMessages(messages);

  /** 可引用的图与概念：先取自上下文，本轮新增的随时补上。 */
  const references = collectReferences(messages);
  let latestFigure = null;
  const figureOptions = {
    createRefId: () => createFigureId((refId) => references.has(refId)),
    onFigure: ({ refId, title }) => {
      references.set(refId, { title: `图「${title}」`, text: '' });
      latestFigure = refId;
    },
  };

  /**
   * 停止条件之一：最后一步的**任一**工具结果带 `nextAction:'await_user'`。
   * 不用「按工具名判定停止」的内置条件：它在「模型调用了工具」时就停，参数非法也会停，
   * 方案里「预算内允许修正一次」会直接失效。
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

  /**
   * 本轮已生成的正文（图只记标题），作为候选答案的材料。
   * 工具执行前的 text-delta 已先到达，测试中有断言。
   */
  let runText = '';
  let lastPartId = null;
  const collectRunText = (event) => {
    if (event.type === 'text-delta') {
      if (runText && event.partId !== lastPartId) runText += '\n';
      lastPartId = event.partId;
      runText += event.delta;
    } else if (event.type === 'tool-started') {
      const title = visualTitle(event.toolName, event.input);
      if (title) runText += `${runText ? '\n' : ''}${title}`;
      // 各步的 partId 会重复，工具调用后的正文另起一行
      lastPartId = null;
    }
  };

  /** 组装失败只影响候选质量，不能连累问题本身。 */
  const buildQuestionContext = (modelContext, refs = []) => {
    try {
      return buildOptionContext({
        messages,
        currentText: runText,
        modelContext,
        conventions: currentPlan?.conventions,
        references: describeRefs(refs, references),
      });
    } catch {
      return { text: modelContext ?? '', source: CONTEXT_SOURCES.MODEL };
    }
  };

  /** 调试记录是旁路：不含端点与密钥，不进事件流；回调出错不影响运行。 */
  const debug = (record) => {
    if (typeof onDebug !== 'function') return;
    try {
      onDebug(record);
    } catch {
      // 忽略
    }
  };

  const limiter = createLimiter(OPTION_CONCURRENCY_LIMIT);
  const askQuestionTool = withOptionConcurrency(
    createAskQuestionTool({
      mode,
      optionConfig,
      optionSystemPrompt,
      generateOptions,
      getRemainingMs,
      resolveRefs: (refs) => resolveRefs(refs, (ref) => references.has(ref), latestFigure),
      buildContext: buildQuestionContext,
      onDebug: (record) => debug({ ...record, id: `option:${identity.runId}:${record.toolCallId}` }),
    }),
    limiter,
  );
  const tools = toolsForMode(mode, {
    [LEARNING_PLAN_TOOL]: createUpdateLearningPlanTool({
      initialPlan: currentPlan,
      studentTexts,
      onPlan: (plan) => {
        const moved = plan.currentConceptId !== currentPlan?.currentConceptId;
        currentPlan = plan;
        const concept = plan.concepts.find((item) => item.id === plan.currentConceptId);
        // 讲解就在本轮正文里，材料已含，不重复附上
        if (moved && concept) references.set(`concept:${concept.id}`, { title: `概念「${concept.name}」`, text: '' });
      },
    }),
    [ASK_QUESTION_TOOL]: askQuestionTool,
    // visualize / explain_card 无外部依赖、不打断运行，无需并发闸门，每轮新实例保证幂等表不跨轮。
    [VISUALIZE_TOOL]: createVisualizeTool(figureOptions),
    [EXPLAIN_CARD_TOOL]: createExplainCardTool(figureOptions),
  });

  // ── 2. 事件转发：不属于本次运行的事件丢弃（返回原状态、不报错、不记日志）──
  const forwardEvent = (event) => {
    if (!event || event.runId !== identity.runId) return;
    collectRunText(event);
    onEvent(event);
  };

  onEvent({
    type: 'run-started',
    conversationId: identity.conversationId,
    turnId: identity.turnId,
    runId: identity.runId,
    mode: mode.id,
  });

  debug({
    id: `main:${identity.runId}`,
    kind: 'main',
    at: startedAt,
    model: config.model,
    system: buildSystemPrompt(mode),
    messages,
    tools: Object.keys(tools),
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
    contextUsage: result?.contextUsage ?? null,
    // 一律取模型适配层的返回值：手工拼装会与 SDK 内部记录重复，产生重复的 tool 消息。
    responseMessages: result?.responseMessages ?? [],
    error: result?.error ?? null,
  };
}

export default runTeachingAgent;
