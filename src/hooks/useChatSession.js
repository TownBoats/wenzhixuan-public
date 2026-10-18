/**
 * 会话层 · 只发命令的 hook（阶段 C · 任务 C2）
 *
 * 职责：持有 `useReducer` 状态、分配三个 ID（`conversationId` / `turnId` / `runId`）、
 * 持有每次运行的 `AbortController`、把运行层的规范事件转成 action。
 *
 * 边界（`C-会话状态层.md` C2 + 规则 §3）：
 *   - 对页面**只暴露数据与命令**，不返回任何 state setter、不返回 `dispatch`
 *   - 状态转换全部在 `reduceSession`（C1 的纯函数）里，本文件不写状态分支
 *   - `isRunning` 等一律由 `deriveViewState` 从 turns 派生，不新增可写布尔量
 *   - 命令必须可安全重复调用：运行中重发 / 双击 / 无运行时取消，都是空操作
 *
 * 与运行层的接线：`runTeachingAgent({ conversationId, turnId, runId, mode, config, messages,
 * optionConfig, optionSystemPrompt, abortSignal, onEvent })`——三个 ID 由本层分配（决策 B-12）。
 */

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';

import { MODE_SOCRATIC } from '../agent/modes.js';
import { runTeachingAgent } from '../agent/runTeachingAgent.js';
import {
  buildModelContext,
  createInitialState,
  deriveViewState,
  projectTurns,
  reduceSession,
} from '../utils/conversationState.js';

/** 规范事件 → action 类型（协议 §4）。事件本身已经带 `runId`，会话层只做归属过滤。 */
const EVENT_ACTION_TYPES = Object.freeze({
  'run-started': 'RUN_STARTED',
  'text-delta': 'TEXT_DELTA',
  'reasoning-delta': 'REASONING_DELTA',
  'tool-started': 'TOOL_STARTED',
  'tool-completed': 'TOOL_COMPLETED',
  'tool-failed': 'TOOL_FAILED',
});

let fallbackSequence = 0;

/**
 * 运行身份由会话层生成（B-12）。纯函数层不许造 ID，所以生成只发生在这里。
 * 没有 `randomUUID` 的环境（少数测试运行时）用一个进程内自增序列兜底，仍保证唯一。
 */
function createId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (typeof uuid === 'string') return uuid;
  fallbackSequence += 1;
  return `run-${Date.now().toString(36)}-${fallbackSequence.toString(36)}`;
}

/**
 * 新运行的上下文：**已完成 turn 的全部消息 + 本轮用户消息**。
 *
 * 为什么不是直接 `buildModelContext(turns)`：该函数按协议只纳入已完成的 turn，
 * 而正要开跑的这一轮还是 `streaming`，它的用户消息必须显式补上（不改 C1 的纯函数）。
 * 用户答案的文本由 reducer 生成（协议 §6 模板），这里只搬运 `userMessage.text`。
 */
function contextForRun(nextState) {
  const turn = nextState?.turns?.at(-1);
  const messages = buildModelContext(nextState?.turns ?? []);
  const userText = turn?.userMessage?.text;
  if (typeof userText === 'string' && userText.trim()) {
    messages.push({ role: 'user', content: userText });
  }
  return messages;
}

/**
 * @param {Object} params
 * @param {Object} params.modes    `modes.js` 的 `createModes()` 产物（id → 模式对象），D 阶段由页面装配
 * @param {string} [params.mode]   初始模式 id
 * @param {Object} params.config   主模型配置快照（每次运行前由页面传入，hook 不读配置层）
 * @param {Object} [params.optionConfig]      副模型配置快照
 * @param {string} [params.optionSystemPrompt] 副模型提示词
 * @param {string} [params.conversationId]     续接既有会话时传入
 * @param {Function} [params.runner]           运行层入口（默认 B5；C3/C4 可注入假运行层）
 */
export function useChatSession({
  modes,
  mode = MODE_SOCRATIC,
  config,
  optionConfig,
  optionSystemPrompt,
  conversationId = null,
  runner = runTeachingAgent,
} = {}) {
  const [state, dispatch] = useReducer(reduceSession, undefined, () =>
    createInitialState({ conversationId, mode }),
  );

  /**
   * `stateRef` 是「最新已知状态」的镜像。
   *
   * 为什么需要它：一次点击里要「先判断能不能发、再算上下文、再起运行」，
   * 而 `useReducer` 的更新要到下次渲染才可见；两次快速点击都会读到同一个旧 `state`。
   * 这里在派发的同时把纯函数算出的结果写进镜像，第二条命令读到的就是「已有一条 turn 在跑」，
   * 于是被 reducer 的守卫挡掉——**防双击仍然在 reducer 里，镜像只让判断及时**。
   * 它不参与渲染，也不代表运行状态（`isRunning` 始终来自 `deriveViewState`）。
   */
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  /** 当前运行的控制器：`{ runId, controller }`。属于「这次运行」，随 runId 管理。 */
  const controllerRef = useRef(null);

  const modesRef = useRef(modes);
  modesRef.current = modes;

  /** 派发一次状态转换，并把结果同步到镜像；返回 null 表示这次命令是空操作。 */
  const apply = useCallback((action) => {
    const next = reduceSession(stateRef.current, action);
    if (next === stateRef.current) return null;
    stateRef.current = next;
    dispatch(action);
    return next;
  }, []);

  /**
   * 跑一次运行。
   *
   * `run-finished` 不在这里的事件回调里落地：事件本身不带 `error`，而运行层返回值带。
   * 统一等 Promise 结束后用返回值派发一次，保证「一次运行恰好一次收尾」且错误不丢。
   */
  const startRun = useCallback(
    async ({ turnId, runId, messages }) => {
      const modeObject = modesRef.current?.[stateRef.current.mode];
      if (!modeObject) {
        apply({
          type: 'RUN_FINISHED',
          runId,
          reason: 'failed',
          responseMessages: [],
          error: new Error('会话层缺少模式对象：请把 createModes() 的产物传给 useChatSession'),
          errorKind: 'failed',
        });
        return null;
      }

      const controller = new AbortController();
      controllerRef.current = { runId, controller };

      const handleEvent = (event) => {
        const type = EVENT_ACTION_TYPES[event?.type];
        if (!type) return; // `run-finished` 由下面统一处理
        apply({ ...event, type });
      };

      try {
        const result = await runner({
          conversationId: stateRef.current.conversationId,
          turnId,
          runId,
          mode: modeObject,
          config,
          messages,
          optionConfig,
          optionSystemPrompt,
          abortSignal: controller.signal,
          onEvent: handleEvent,
        });

        apply({
          type: 'RUN_FINISHED',
          runId,
          reason: result?.reason ?? 'failed',
          responseMessages: result?.responseMessages ?? [],
          error: result?.error ?? null,
          // 失败类别来自运行层的 `endedBy`（协议 §5 / F3）：超时与取消是两件事，
          // 只靠 error.message 区分不了（两者原文都是「运行已中断」）。
          errorKind: result?.endedBy ?? null,
        });
        return result ?? null;
      } catch (error) {
        apply({
          type: 'RUN_FINISHED',
          runId,
          reason: 'failed',
          responseMessages: [],
          error,
          errorKind: 'failed',
        });
        return null;
      } finally {
        // 只清理自己这一轮的控制器，避免覆盖后来者的
        if (controllerRef.current?.runId === runId) controllerRef.current = null;
      }
    },
    [apply, config, optionConfig, optionSystemPrompt, runner],
  );

  /** 取消当前运行：只 abort 这一轮自己的控制器，没有运行时空操作。 */
  const cancelRun = useCallback(() => {
    const turn = stateRef.current.turns.at(-1);
    if (!turn || turn.status !== 'streaming') return;
    apply({ type: 'CANCEL_RUN', runId: turn.runId });
    if (controllerRef.current?.runId === turn.runId) {
      controllerRef.current.controller.abort();
    }
  }, [apply]);

  /** 发送一条用户输入，并开跑新一轮。运行中 / 有待答问题时是空操作。 */
  const sendMessage = useCallback(
    (text) => {
      const current = stateRef.current;
      const turnId = createId();
      const runId = createId();
      const nextState = apply({
        type: 'SEND_MESSAGE',
        conversationId: current.conversationId ?? createId(),
        turnId,
        runId,
        mode: current.mode,
        text,
      });
      if (!nextState) return null;
      return startRun({ turnId, runId, messages: contextForRun(nextState) });
    },
    [apply, startRun],
  );

  /** 作答 / 跳过的共同骨架：一次 action 完成「写答案 + 问题改状态 +（必要时）起新一轮」。 */
  const resolveQuestion = useCallback(
    (type, { questionId, answer, selectedLevel }) => {
      const current = stateRef.current;
      const turnId = createId();
      const runId = createId();
      const nextState = apply({
        type,
        questionId,
        answer,
        selectedLevel,
        turnId,
        runId,
        mode: current.mode,
      });
      if (!nextState) return null;

      // 还有问题没答：只更新状态，不起新一轮（协议 §6：一轮的答案一起进上下文）
      const turn = nextState.turns.at(-1);
      if (!turn || turn.id !== turnId || turn.status !== 'streaming') return null;
      return startRun({ turnId, runId, messages: contextForRun(nextState) });
    },
    [apply, startRun],
  );

  const submitAnswer = useCallback(
    (payload) => resolveQuestion('SUBMIT_ANSWER', payload ?? {}),
    [resolveQuestion],
  );

  const skipQuestion = useCallback(
    (payload) => resolveQuestion('SKIP_QUESTION', payload ?? {}),
    [resolveQuestion],
  );

  /**
   * 只重试最后一轮（决策 C-1 结论 3）：换新 `runId` 重跑，旧内容保留到新运行产出。
   * 重试的上下文由「该轮之前的已完成 turn + 该轮自己的用户消息」组成。
   */
  const retryLastTurn = useCallback(() => {
    const current = stateRef.current;
    const turn = current.turns.at(-1);
    if (!turn || turn.status === 'streaming' || !turn.userMessage?.text) return null;

    const runId = createId();
    const messages = buildModelContext(current.turns.slice(0, -1));
    messages.push({ role: 'user', content: turn.userMessage.text });

    const nextState = apply({ type: 'RETRY_LAST_TURN', runId, turnId: turn.id, mode: current.mode });
    if (!nextState) return null;
    return startRun({ turnId: turn.id, runId, messages });
  }, [apply, startRun]);

  /** 切换模式。运行中或还有待答问题时由 reducer 拒绝。 */
  const setMode = useCallback(
    (nextMode) => {
      if (!modesRef.current?.[nextMode]) return false;
      return Boolean(apply({ type: 'SET_MODE', mode: nextMode }));
    },
    [apply],
  );

  /** 打开既有会话（E 阶段的存储读取结果）。先中止当前运行，再整体替换。 */
  const openConversation = useCallback(
    (record) => {
      const controller = controllerRef.current;
      if (controller) {
        controller.controller.abort();
        controllerRef.current = null;
      }
      apply({
        type: 'OPEN_CONVERSATION',
        conversationId: record?.conversationId ?? record?.id ?? null,
        mode: record?.mode ?? stateRef.current.mode,
        turns: record?.turns ?? [],
      });
    },
    [apply],
  );

  /** 新会话：换 `conversationId` 并清空 turns（同样是整体替换，不逐个删）。 */
  const newConversation = useCallback(() => {
    const controller = controllerRef.current;
    if (controller) {
      controller.controller.abort();
      controllerRef.current = null;
    }
    apply({
      type: 'OPEN_CONVERSATION',
      conversationId: createId(),
      mode: stateRef.current.mode,
      turns: [],
    });
  }, [apply]);

  // 卸载时中止在跑的那一次，避免运行层继续往已卸载的会话推事件
  useEffect(
    () => () => {
      controllerRef.current?.controller.abort();
      controllerRef.current = null;
    },
    [],
  );

  const view = deriveViewState(state);
  const renderedTurns = useMemo(() => projectTurns(state.turns), [state.turns]);

  return {
    // ── 数据（只读投影，页面不持有任何可写状态）──
    conversationId: view.conversationId,
    mode: view.mode,
    turns: view.turns,
    renderedTurns,
    pendingQuestions: view.pendingQuestions,
    isRunning: view.isRunning,
    isAwaitingUser: view.isAwaitingUser,
    canSendMessage: view.canSendMessage,
    canCancel: view.canCancel,
    canChangeMode: view.canChangeMode,
    canRetryLastTurn: view.canRetryLastTurn,
    error: view.error,
    // ── 命令（全部幂等：条件不满足时是空操作）──
    sendMessage,
    submitAnswer,
    skipQuestion,
    cancelRun,
    retryLastTurn,
    setMode,
    openConversation,
    newConversation,
  };
}

export default useChatSession;
