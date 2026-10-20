/**
 * 会话层 · 纯函数状态机（阶段 C · 任务 C1）
 *
 * 本文件是「谁在什么时候改会话状态」的唯一实现：`reduceSession(state, action)` 把
 * 运行层推来的规范事件翻译成一次原子转换。它**没有副作用**：
 *   - 不依赖组件框架，不访问浏览器存储、全局宿主对象或 DOM
 *   - 不产生随机 ID（`turnId` / `runId` 由 hook 生成后作为 action 字段传入）
 *   - 不读时间、不打日志、不抛异常（迟到事件是正常现象，见下文「守卫」）
 *
 * 数据结构与协议以 `docs/agent-mvp/01-核心协议.md` §4 / §5 / §6 为唯一事实源。
 * 本文件只是它的实现，不新增协议字段。
 *
 * 三条硬约束（`决策记录.md` C-1 + C 阶段开发指导）：
 *   1. 每个运行事件最前面先做 `runId` 守卫，不匹配就 `return state`（不报错、不记日志）。
 *      额外要求该 turn 仍处于 `streaming`——取消或结束后到达的片段一律丢弃，
 *      这就是 C3「abort 后运行层再吐事件，状态不变」的机制。
 *   2. 待答状态是**数组**（一轮可以有多个问题），且不独立存储：只在 turn 里，
 *      由 `deriveViewState` 派生。
 *   3. 上下文显式组装（`buildModelContext`），用户答案用协议 §6 的固定模板；
 *      **禁止**「遍历对象所有值再拼成字符串」这类通用拼接。
 */

/** turn 状态（协议 §5）。`interrupted` 只在恢复历史时出现（E 阶段写入）。 */
export const TURN_STATUS = Object.freeze({
  STREAMING: 'streaming',
  AWAITING_USER: 'awaiting_user',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  INTERRUPTED: 'interrupted',
});

/** 问题的三种状态（协议 §5）。 */
export const QUESTION_STATE = Object.freeze({
  PENDING: 'pending',
  ANSWERED: 'answered',
  SKIPPED: 'skipped',
});

/** 工具的三种状态（只用于 `parts` 里的卡片展示，不进协议消息）。 */
export const TOOL_PART_STATUS = Object.freeze({
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
});

/**
 * 单个工具的挂起标记（U+200B）。
 *
 * 清洗的第一现场在运行层适配器（B1）。这里再清一次是**防御性**的：本层是协议消息
 * 进入上下文的最后一道关口，而 `parts` / `userMessage` 里的文本也可能来自别处
 * （历史恢复、测试、将来的迁移脚本）。代价是一次字符串扫描，收益是不变量 2 不会被绕过。
 */
const GATE_MARKER = '\u200B';

/** 去掉挂起标记；非字符串一律当空串处理。 */
function stripGate(text) {
  if (typeof text !== 'string') return '';
  return text.split(GATE_MARKER).join('');
}

/** 只有这两种状态的 turn 才进上下文（协议不变量 8：已配对、已完成）。 */
const CONTEXT_ELIGIBLE_STATUSES = new Set([TURN_STATUS.AWAITING_USER, TURN_STATUS.COMPLETED]);

/** `run-finished` 的结束原因 → turn 状态。 */
const REASON_TO_STATUS = Object.freeze({
  completed: TURN_STATUS.COMPLETED,
  awaiting_user: TURN_STATUS.AWAITING_USER,
  failed: TURN_STATUS.FAILED,
  cancelled: TURN_STATUS.CANCELLED,
  // 协议 §5 的状态里没有 limit_reached：被步数上限截断属于「正常收尾但没问完」，
  // 界面表现为一段可继续的正文，因此归到 completed，不新造状态。
  limit_reached: TURN_STATUS.COMPLETED,
});

// ────────────────────────────── 初始状态 ──────────────────────────────

/**
 * 会话初始状态。
 *
 * `mode` 是「当前选择的模式」，用于下一条 `SEND_MESSAGE` 的 `modeSnapshot`；
 * 每一轮实际用的模式记在 `turn.modeSnapshot` 里，两处不共用同一份真相。
 */
export function createInitialState({ conversationId = null, mode = null } = {}) {
  return {
    conversationId,
    mode,
    turns: [],
  };
}

// ────────────────────────────── 内部工具 ──────────────────────────────

function currentTurn(state) {
  const turns = state?.turns;
  if (!Array.isArray(turns) || turns.length === 0) return null;
  return turns[turns.length - 1];
}

/** 只替换最后一条 turn，其余 turn 引用不变（浅拷贝，便于上层做引用比较）。 */
function replaceLastTurn(state, turn) {
  return { ...state, turns: [...state.turns.slice(0, -1), turn] };
}

/**
 * 运行事件守卫：`runId` 对上、且该 turn 仍在运行。
 * 不匹配 = 迟到 / 过期事件，原样返回状态。
 */
function isStreamingRun(state, action) {
  const turn = currentTurn(state);
  if (!turn) return false;
  if (!action?.runId || turn.runId !== action.runId) return false;
  return turn.status === TURN_STATUS.STREAMING;
}

/**
 * 收尾事件的守卫：`runId` 对上即可，另外允许 `cancelled`——
 * 用户点取消时 `CANCEL_RUN` 会先把状态置为 cancelled，随后的 `run-finished` 仍要落盘
 * （否则 `modelMessages` 与错误信息会丢）。重复到达的 `run-finished` 仍被丢弃。
 */
function isFinishingRun(state, action) {
  const turn = currentTurn(state);
  if (!turn) return false;
  if (!action?.runId || turn.runId !== action.runId) return false;
  return turn.status === TURN_STATUS.STREAMING || turn.status === TURN_STATUS.CANCELLED;
}

function createTurn({ id, runId, modeSnapshot, userMessage, status }) {
  return {
    id,
    runId,
    modeSnapshot: modeSnapshot ?? null,
    status: status ?? TURN_STATUS.STREAMING,
    userMessage: userMessage ?? null,
    modelMessages: [],
    parts: [],
    questions: [],
    error: null,
    // 失败类别（协议 §5 / F3）：'timeout' | 'failed' | null。取消一律 null（取消不是错误）
    errorKind: null,
  };
}

/** 从后往前找工具卡：重试产生的新卡片应覆盖旧卡片，而不是被旧卡片挡住。 */
function findToolPartIndex(parts, toolCallId) {
  if (!toolCallId) return -1;
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    if (part && part.type === 'tool' && part.toolCallId === toolCallId) return index;
  }
  return -1;
}

/** Error 不进状态（不可序列化，且原文可能带端点/密钥），只留一行可展示的信息。 */
function toErrorText(error) {
  if (!error) return null;
  if (typeof error === 'string') return stripGate(error);
  if (typeof error.message === 'string') return stripGate(error.message);
  return '工具执行失败';
}

/**
 * 把 `ask_question` 的工具结果翻译成问题记录（协议 §2.3 / §5）。
 * 只有 `status:'ready'` 且 `nextAction:'await_user'` 才算「问题已就绪」；
 * `rejected` 不产生卡片，理由留在工具卡的 `output.reason` 里。
 */
function questionFromToolResult(toolCallId, output) {
  if (!output || typeof output !== 'object') return null;
  if (output.status !== 'ready' || output.nextAction !== 'await_user') return null;

  const options = Array.isArray(output.options) ? output.options : [];
  return {
    toolCallId,
    id: output.questionId,
    text: stripGate(output.question),
    options,
    optionsStatus: output.optionsStatus ?? (options.length > 0 ? 'ready' : 'unavailable'),
    answer: null,
    selectedLevel: null,
    state: QUESTION_STATE.PENDING,
  };
}

/**
 * 一轮的答案按协议 §6 的模板连续排列。跳过必须写成**显式**的一条记录，
 * 不能留缺口——否则模型会把「没有回应」读成默认同意。
 *
 * 注意这里不用「遍历对象所有值再拼成字符串」这类通用拼接：
 * 字段顺序会变，字段名和内部 ID 也会被顺手带进上下文。
 */
function serializeAnswers(questions) {
  return questions
    .map((question) => {
      const text = stripGate(question.text);
      if (question.state === QUESTION_STATE.SKIPPED) {
        return `针对问题「${text}」：（学生选择了跳过，未作答）`;
      }
      const answer = stripGate(question.answer);
      const level = question.selectedLevel ? stripGate(question.selectedLevel) : '手动输入';
      return `针对问题「${text}」，我的回答是：${answer}\n（来自选项：${level}）`;
    })
    .join('\n\n');
}

// ────────────────────────────── 事件处理 ──────────────────────────────

/** 追加一段正文 / 推理。同一 `partId` 且同一运行内相邻的片段合并成一个块。 */
function appendDelta(state, action, type) {
  if (!isStreamingRun(state, action)) return state;

  const delta = stripGate(action.delta);
  if (!delta) return state; // 空片段不产生空块（不变量 2 的另一半：不留空文本）

  const turn = currentTurn(state);
  const partId = action.partId ?? `${type}:${turn.runId}`;
  const parts = [...turn.parts];
  const last = parts[parts.length - 1];

  if (
    last &&
    last.type === type &&
    last.partId === partId &&
    last.runId === turn.runId
  ) {
    parts[parts.length - 1] = { ...last, text: last.text + delta };
  } else {
    // `runId` 记在片段上：重试时旧内容保留，新运行的片段另起一块，不会拼到旧文本后面。
    parts.push({ type, partId, runId: turn.runId, text: delta });
  }

  return replaceLastTurn(state, { ...turn, parts });
}

/**
 * `run-started`：确认身份并固定本轮模式。
 *
 * 正常情况下 turn 已由 `SEND_MESSAGE` / `SUBMIT_ANSWER` 创建；只有事件先到时才补建
 * （C4 的假运行层会直接推事件）。**若已有 turn 但 `runId` 不同则丢弃**——
 * 否则一个迟到的旧运行会凭空造出第二条 turn。
 */
function handleRunStarted(state, action) {
  const turn = currentTurn(state);

  if (turn) {
    if (!action?.runId || turn.runId !== action.runId) return state;
    // 重复到达的 started 不能把已收尾（completed / failed / interrupted）的 turn 拉回运行中
    if (turn.status !== TURN_STATUS.STREAMING && turn.status !== TURN_STATUS.CANCELLED) return state;
    return replaceLastTurn(state, {
      ...turn,
      modeSnapshot: action.mode ?? turn.modeSnapshot,
      // 已取消的轮次不因为一个迟到/重复的 started 复活
      status: turn.status === TURN_STATUS.CANCELLED ? TURN_STATUS.CANCELLED : TURN_STATUS.STREAMING,
    });
  }

  if (!action?.runId || !action?.turnId) return state;
  return {
    ...state,
    conversationId: state.conversationId ?? action.conversationId ?? null,
    turns: [
      createTurn({
        id: action.turnId,
        runId: action.runId,
        modeSnapshot: action.mode ?? state.mode,
        userMessage: null,
      }),
    ],
  };
}

/**
 * `tool-input-started`（explore/streaming-cards）：参数开始流出，比 `tool-call` 早得多。
 * 提前把「运行中」卡片摆出来；完整 input 要等 TOOL_STARTED 才有。
 */
function handleToolInputStarted(state, action) {
  if (!isStreamingRun(state, action)) return state;
  if (!action.toolCallId) return state; // 没有身份的输入事件不建卡（上游已过滤，双保险）

  const turn = currentTurn(state);
  const parts = [...turn.parts];
  const index = findToolPartIndex(parts, action.toolCallId);

  if (index >= 0) {
    const existing = parts[index];
    parts[index] = { ...existing, toolName: action.toolName ?? existing.toolName };
  } else {
    parts.push({
      type: 'tool',
      toolCallId: action.toolCallId,
      toolName: action.toolName ?? null,
      input: null,
      partialInput: '',
      status: TOOL_PART_STATUS.RUNNING,
      output: null,
      error: null,
      runId: turn.runId,
    });
  }

  return replaceLastTurn(state, { ...turn, parts });
}

/**
 * `tool-input-delta`：参数 JSON 的逐字增量，累积到 `partialInput`。
 * 找不到卡片时补建（与 completed/failed 同纪律：不静默丢弃）。
 * `partialInput` 是瞬态字段：TOOL_COMPLETED / TOOL_FAILED 时清空，不进历史。
 */
function handleToolInputDelta(state, action) {
  if (!isStreamingRun(state, action)) return state;
  if (!action.toolCallId) return state;
  if (typeof action.delta !== 'string' || !action.delta) return state;

  const turn = currentTurn(state);
  const parts = [...turn.parts];
  let index = findToolPartIndex(parts, action.toolCallId);

  if (index < 0) {
    parts.push({
      type: 'tool',
      toolCallId: action.toolCallId,
      toolName: null,
      input: null,
      partialInput: '',
      status: TOOL_PART_STATUS.RUNNING,
      output: null,
      error: null,
      runId: turn.runId,
    });
    index = parts.length - 1;
  }

  const existing = parts[index];
  // 已完结的卡片不再累积增量（迟到事件防御；正常时序下 delta 先于 tool-call 到达）
  if (existing.status !== TOOL_PART_STATUS.RUNNING) return state;
  parts[index] = { ...existing, partialInput: (existing.partialInput ?? '') + action.delta };
  return replaceLastTurn(state, { ...turn, parts });
}

/** `tool-started`：同一 `toolCallId` 视为更新，不追加第二张卡（不变量 5）。 */
function handleToolStarted(state, action) {  if (!isStreamingRun(state, action)) return state;

  const turn = currentTurn(state);
  const parts = [...turn.parts];
  const index = findToolPartIndex(parts, action.toolCallId);

  if (index >= 0) {
    const existing = parts[index];
    parts[index] = {
      ...existing,
      toolName: action.toolName ?? existing.toolName,
      input: action.input ?? existing.input,
      // 已经完成的卡不因为一次重复的 started 退回 running
      status:
        existing.status === TOOL_PART_STATUS.COMPLETED || existing.status === TOOL_PART_STATUS.FAILED
          ? existing.status
          : TOOL_PART_STATUS.RUNNING,
    };
  } else {
    parts.push({
      type: 'tool',
      toolCallId: action.toolCallId,
      toolName: action.toolName ?? null,
      input: action.input ?? null,
      status: TOOL_PART_STATUS.RUNNING,
      output: null,
      error: null,
      runId: turn.runId,
    });
  }

  return replaceLastTurn(state, { ...turn, parts });
}

/**
 * `tool-completed`：更新卡片；找不到卡片时**先补建再更新**。
 * 补建分支的意义：SDK 的顺序可能与我们的假设不同，静默丢弃会同时丢掉卡片和问题数据。
 * 只有 `ready + await_user` 才生成问题；同一 `toolCallId` / 问题 ID 不会产生第二条。
 */
function handleToolCompleted(state, action) {
  if (!isStreamingRun(state, action)) return state;

  const turn = currentTurn(state);
  const parts = [...turn.parts];
  const index = findToolPartIndex(parts, action.toolCallId);
  const patch = {
    status: TOOL_PART_STATUS.COMPLETED,
    output: action.output ?? null,
    error: null,
    // 瞬态增量用完即清：不进投影、不进历史（不变量：持久化只留最终态）
    partialInput: null,
  };

  if (index >= 0) {
    parts[index] = { ...parts[index], ...patch };
  } else {
    parts.push({
      type: 'tool',
      toolCallId: action.toolCallId,
      toolName: action.toolName ?? null,
      input: null,
      runId: turn.runId,
      ...patch,
    });
  }

  const incoming = questionFromToolResult(action.toolCallId, action.output);
  let questions = turn.questions;

  if (incoming) {
    const existingIndex = questions.findIndex(
      (question) => question.toolCallId === action.toolCallId || question.id === incoming.id,
    );
    if (existingIndex >= 0) {
      // 重复事件：只刷新描述性字段，答案与状态不能被覆盖
      const existing = questions[existingIndex];
      questions = [...questions];
      questions[existingIndex] = {
        ...incoming,
        answer: existing.answer,
        selectedLevel: existing.selectedLevel,
        state: existing.state,
      };
    } else {
      /**
       * 顺序＝模型调用顺序（协议 §5），**不是完成顺序**。
       *
       * 真实端点上两者会不一致：B7 的 `response.messages` 里 tool 结果顺序是
       * `call_00 / call_02 / call_01`，而 assistant 里的调用是 `00 / 01 / 02`
       * （`scripts/socratic-once.output.json`）。若按完成顺序追加，问题卡就会排成 1/3/2。
       *
       * 调用顺序只能从卡片顺序读（卡片由 `tool-started` 按调用顺序创建）；
       * 卡片是补建的时候（完成先于开始）顺序信息本来就不存在，此时退化为完成顺序。
       */
      const cardOrder = parts.filter((part) => part.type === 'tool').map((part) => part.toolCallId);
      const targetIndex = cardOrder.indexOf(action.toolCallId);
      const insertAt = questions.findIndex(
        (question) => cardOrder.indexOf(question.toolCallId) > targetIndex,
      );
      const position = insertAt === -1 ? questions.length : insertAt;
      questions = [...questions.slice(0, position), incoming, ...questions.slice(position)];
    }
  }

  return replaceLastTurn(state, { ...turn, parts, questions });
}

/** `tool-failed`：卡片标失败并留下可展示的原因；同样补建，不静默丢弃。 */
function handleToolFailed(state, action) {
  if (!isStreamingRun(state, action)) return state;

  const turn = currentTurn(state);
  const parts = [...turn.parts];
  const index = findToolPartIndex(parts, action.toolCallId);
  const patch = {
    status: TOOL_PART_STATUS.FAILED,
    error: toErrorText(action.error) ?? '工具执行失败',
    partialInput: null,
  };

  if (index >= 0) {
    parts[index] = { ...parts[index], ...patch };
  } else {
    parts.push({
      type: 'tool',
      toolCallId: action.toolCallId,
      toolName: action.toolName ?? null,
      input: null,
      output: null,
      runId: turn.runId,
      ...patch,
    });
  }

  return replaceLastTurn(state, { ...turn, parts });
}

/**
 * `run-finished`：提交协议消息与结束状态。
 *
 * `modelMessages` **只能取运行层返回值**（B1 已清 U+200B、已丢空块、已配对）；
 * 这里不拼任何协议消息。
 */
function handleRunFinished(state, action) {
  if (!isFinishingRun(state, action)) return state;

  const turn = currentTurn(state);
  const status = REASON_TO_STATUS[action.reason] ?? TURN_STATUS.FAILED;

  return replaceLastTurn(state, {
    ...turn,
    status,
    modelMessages: Array.isArray(action.responseMessages) ? action.responseMessages : [],
    error: action.error ? toErrorText(action.error) : turn.error,
    /**
     * 类别与错误文本同生共死：没有 error 就没有类别（取消走这条，因此 `errorKind` 必为 null）；
     * 有 error 时优先用运行层透传的 `endedBy`，缺省归 `failed`。
     */
    errorKind: action.error ? (action.errorKind ?? 'failed') : null,
  });
}

/**
 * 作答 / 跳过的统一处理（`决策记录.md` C-1 结论 2 / 4）。
 *
 * 一个 action 内完成四件事，顺序重要：
 *   写答案 → 问题改已答 → （该轮问题全部结束才）追加用户 turn → 起新运行
 *
 * 为什么必须原子：拆成 effect 会「重复渲染触发两次」，也会出现「还没答完就在生成」的混合态。
 * 防双击靠的是这里的条件——第一次处理完问题已不是 pending，第二次直接原样返回，
 * 而不是按钮上的 `disabled`。
 *
 * 为什么「全部结束」才起新一轮：一轮的几个问题是一个整体（协议 §6），
 * 模型要一次看到全部答案；否则每条答案都会单独触发一轮，问题会被拆散追问。
 */
function resolveAnswer(state, action, questionState) {
  const turn = currentTurn(state);
  if (!turn || turn.status !== TURN_STATUS.AWAITING_USER) return state;

  const index = turn.questions.findIndex(
    (question) => question.id === action.questionId && question.state === QUESTION_STATE.PENDING,
  );
  if (index < 0) return state;

  const isSkip = questionState === QUESTION_STATE.SKIPPED;
  const answer = isSkip ? null : stripGate(action.answer ?? '');
  // 空答案不构成一次作答；静默返回原状态（下拉/输入框的「提交」不会造出空答案）
  if (!isSkip && !answer.trim()) return state;

  const questions = [...turn.questions];
  questions[index] = {
    ...questions[index],
    answer,
    selectedLevel: isSkip ? null : (action.selectedLevel ?? null),
    state: questionState,
  };

  const answeredTurn = { ...turn, questions };
  const allResolved = questions.every((question) => question.state !== QUESTION_STATE.PENDING);

  // 还有问题没答：只更新，不起新运行
  if (!allResolved) return replaceLastTurn(state, answeredTurn);

  // 全部结束：需要新轮次的身份；缺失说明调用方有 bug，宁可不动也不能造出没有身份的 turn
  if (typeof action.turnId !== 'string' || !action.turnId || typeof action.runId !== 'string' || !action.runId) {
    return state;
  }

  const single = questions.length === 1 ? questions[0] : null;
  const nextTurn = createTurn({
    id: action.turnId,
    runId: action.runId,
    modeSnapshot: action.mode ?? turn.modeSnapshot ?? state.mode,
    userMessage: {
      text: serializeAnswers(questions),
      source: 'answer',
      // 单题时带上来源问题，便于展示「这条回答对应哪张卡」；多题时没有单一问题可指。
      questionId: single ? single.id : null,
      selectedLevel: single ? single.selectedLevel : null,
    },
  });

  return {
    ...state,
    turns: [
      ...state.turns.slice(0, -1),
      // 该轮问题已全部结束，turn 不再等待用户；它的 modelMessages 仍进下一轮上下文
      { ...answeredTurn, status: TURN_STATUS.COMPLETED },
      nextTurn,
    ],
  };
}

// ────────────────────────────── 状态转换入口 ──────────────────────────────

/**
 * 所有状态转换的唯一入口。
 *
 * @param {Object} state  `createInitialState()` 的形状
 * @param {Object} action `{ type, ... }`；运行事件类 action 必须带 `runId`
 * @returns {Object} 新状态；无法识别的 action、迟到事件一律返回原状态
 */
export function reduceSession(state, action) {
  if (!state || !action || typeof action.type !== 'string') return state;

  switch (action.type) {
    // ── 用户命令 ──
    case 'SEND_MESSAGE': {
      const turn = currentTurn(state);
      // 运行中不接第二条输入；还有待答问题时不开始新一轮（协议 §6：答完或显式跳过才续轮）
      if (turn && turn.status === TURN_STATUS.STREAMING) return state;
      if (turn && turn.status === TURN_STATUS.AWAITING_USER) {
        if (turn.questions.some((question) => question.state === QUESTION_STATE.PENDING)) return state;
      }
      if (!action.turnId || !action.runId) return state;

      const text = stripGate(action.text ?? '').trim();
      if (!text) return state;

      return {
        ...state,
        conversationId: state.conversationId ?? action.conversationId ?? null,
        turns: [
          ...state.turns,
          createTurn({
            id: action.turnId,
            runId: action.runId,
            modeSnapshot: action.mode ?? state.mode,
            userMessage: { text, source: 'input' },
          }),
        ],
      };
    }

    case 'SUBMIT_ANSWER':
      return resolveAnswer(state, action, QUESTION_STATE.ANSWERED);

    case 'SKIP_QUESTION':
      return resolveAnswer(state, action, QUESTION_STATE.SKIPPED);

    /**
     * 取消只是**标记意图**：真正中断运行由 hook 持有 `AbortController` 完成，
     * 纯函数不能也不该 abort 任何东西。标记后同一个 `runId` 的后续片段全部被守卫丢弃。
     */
    case 'CANCEL_RUN': {
      const turn = currentTurn(state);
      if (!turn || turn.status !== TURN_STATUS.STREAMING) return state;
      if (action.runId && turn.runId !== action.runId) return state;
      return replaceLastTurn(state, { ...turn, status: TURN_STATUS.CANCELLED });
    }

    /**
     * 只允许重试最后一轮（`决策记录.md` C-1 结论 3）：换新 `runId` 重跑，
     * **保留原内容**（`parts` / `modelMessages` / `questions` 都不清空），
     * 新运行的片段因 `runId` 不同而另起一块。
     */
    case 'RETRY_LAST_TURN': {
      const turn = currentTurn(state);
      if (!turn || turn.status === TURN_STATUS.STREAMING) return state;
      if (!action.runId) return state;
      return replaceLastTurn(state, {
        ...turn,
        runId: action.runId,
        status: TURN_STATUS.STREAMING,
        error: null,
        errorKind: null,
      });
    }

    /**
     * 切换模式。运行中或还有待答问题时不变更——问题是用某一轮的模式与提示词生成的，
     * 中途换模式会让「卡片属于哪种教学」说不清（HANDOFF 第 4 节该条仍待最终确认）。
     */
    case 'SET_MODE': {
      const turn = currentTurn(state);
      if (turn && turn.status === TURN_STATUS.STREAMING) return state;
      if (turn && turn.status === TURN_STATUS.AWAITING_USER) {
        if (turn.questions.some((question) => question.state === QUESTION_STATE.PENDING)) return state;
      }
      if (!action.mode) return state;
      return { ...state, mode: action.mode };
    }

    /** 打开既有会话（E 阶段从存储读出的 turns）。`streaming` 一律降级为 `interrupted`。 */
    case 'OPEN_CONVERSATION': {
      const turns = Array.isArray(action.turns) ? action.turns : [];
      return {
        conversationId: action.conversationId ?? null,
        mode: action.mode ?? null,
        turns: turns.map((turn) => {
          const base = createTurn({
            id: turn?.id,
            runId: turn?.runId,
            modeSnapshot: turn?.modeSnapshot ?? null,
            userMessage: turn?.userMessage ?? null,
            status: turn?.status ?? TURN_STATUS.COMPLETED,
          });
          return {
            ...base,
            status: base.status === TURN_STATUS.STREAMING ? TURN_STATUS.INTERRUPTED : base.status,
            modelMessages: Array.isArray(turn?.modelMessages) ? turn.modelMessages : [],
            parts: Array.isArray(turn?.parts) ? turn.parts : [],
            questions: Array.isArray(turn?.questions) ? turn.questions : [],
            error: turn?.error ?? null,
            errorKind: typeof turn?.errorKind === 'string' ? turn.errorKind : null,
          };
        }),
      };
    }

    // ── 运行层事件 ──
    case 'RUN_STARTED':
      return handleRunStarted(state, action);
    case 'TEXT_DELTA':
      return appendDelta(state, action, 'text');
    case 'REASONING_DELTA':
      return appendDelta(state, action, 'reasoning');
    case 'TOOL_STARTED':
      return handleToolStarted(state, action);
    case 'TOOL_INPUT_STARTED':
      return handleToolInputStarted(state, action);
    case 'TOOL_INPUT_DELTA':
      return handleToolInputDelta(state, action);
    case 'TOOL_COMPLETED':
      return handleToolCompleted(state, action);
    case 'TOOL_FAILED':
      return handleToolFailed(state, action);
    case 'RUN_FINISHED':
      return handleRunFinished(state, action);

    default:
      // 未识别的 action 不改变状态：拼写错误由测试暴露，而不是在生产里抛错中断会话
      return state;
  }
}

// ────────────────────────────── 模型上下文 ──────────────────────────────

/**
 * 只保留**已配对**的调用与结果，并丢掉 reasoning 与未知片段。
 *
 * 未配对的调用留在 `parts` 里展示与诊断，但不发送（协议不变量 1 / 8）：
 * 只有 call 没有 result 的消息在某些端点会直接 400。
 */
function sanitizeModelMessages(messages) {
  if (!Array.isArray(messages)) return [];

  const callIds = new Set();
  const resultIds = new Set();
  for (const message of messages) {
    if (!message || !Array.isArray(message.content)) continue;
    for (const part of message.content) {
      if (part?.type === 'tool-call' && part.toolCallId) callIds.add(part.toolCallId);
      if (part?.type === 'tool-result' && part.toolCallId) resultIds.add(part.toolCallId);
    }
  }
  const paired = new Set([...callIds].filter((id) => resultIds.has(id)));

  const output = [];
  for (const message of messages) {
    if (!message || typeof message !== 'object') continue;

    if (typeof message.content === 'string') {
      const text = stripGate(message.content);
      if (text.trim()) output.push({ role: message.role, content: text });
      continue;
    }
    if (!Array.isArray(message.content)) continue;

    const parts = [];
    for (const part of message.content) {
      if (!part || typeof part !== 'object') continue;

      if (part.type === 'text') {
        const text = stripGate(part.text ?? '');
        if (text.trim()) parts.push({ type: 'text', text });
        continue;
      }
      if (part.type === 'tool-call') {
        if (!paired.has(part.toolCallId)) continue;
        parts.push({
          type: 'tool-call',
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          input: part.input,
        });
        continue;
      }
      if (part.type === 'tool-result') {
        if (!paired.has(part.toolCallId)) continue;
        parts.push({
          type: 'tool-result',
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          output: part.output,
        });
        continue;
      }
      // reasoning 及其它片段一律不进上下文（不变量 3）
    }

    if (parts.length > 0) output.push({ role: message.role, content: parts });
  }

  return output;
}

/**
 * 组装下一轮的模型上下文（协议 §6）。
 *
 * 顺序严格为：turn 的用户消息 → 该轮的 assistant/tool 消息 → 下一轮……
 * 只纳入状态为 `awaiting_user` / `completed` 的 turn（运行失败、被取消、
 * 刷新中断的轮次不发送，避免把半截内容当成模型说过的话）。
 *
 * @param {Array} turns
 * @returns {Array<{role: string, content: string|Array}>}
 */
export function buildModelContext(turns) {
  const messages = [];

  for (const turn of Array.isArray(turns) ? turns : []) {
    if (!turn || !CONTEXT_ELIGIBLE_STATUSES.has(turn.status)) continue;

    const userText = stripGate(turn.userMessage?.text ?? '').trim();
    if (userText) messages.push({ role: 'user', content: userText });

    messages.push(...sanitizeModelMessages(turn.modelMessages));
  }

  return messages;
}

// ────────────────────────────── 展示投影 ──────────────────────────────

/**
 * 生成渲染数据：有序片段 + 工具卡 + 问题卡。
 * 只做投影，不改状态、不产生新数据；页面拿到什么就渲染什么。
 */
export function projectTurns(turns) {
  return (Array.isArray(turns) ? turns : []).map((turn) => {
    const blocks = [];

    for (const part of Array.isArray(turn?.parts) ? turn.parts : []) {
      if (!part) continue;

      if (part.type === 'text' || part.type === 'reasoning') {
        const last = blocks[blocks.length - 1];
        // 合并键必须带 `runId`：AI SDK 的 text 片段 id 是**每次流内自增**的（实测两次独立运行
        // 都是 `0`），只比 `partId` 会让重试后的新正文被拼到旧正文后面（F2 判据④）。
        const sameRun = last?.runId === (part.runId ?? null);
        if (last && last.type === part.type && last.partId === part.partId && sameRun) {
          last.text += part.text ?? '';
        } else {
          blocks.push({
            type: part.type,
            partId: part.partId ?? null,
            runId: part.runId ?? null,
            text: part.text ?? '',
          });
        }
        continue;
      }

      if (part.type === 'tool') {
        blocks.push({
          type: 'tool',
          toolCallId: part.toolCallId ?? null,
          toolName: part.toolName ?? null,
          status: part.status ?? TOOL_PART_STATUS.RUNNING,
          input: part.input ?? null,
          partialInput: part.partialInput ?? null,
          output: part.output ?? null,
          error: part.error ?? null,
        });
      }
    }

    return {
      id: turn.id,
      runId: turn.runId,
      mode: turn.modeSnapshot ?? null,
      status: turn.status,
      userText: turn.userMessage?.text ?? '',
      userSource: turn.userMessage?.source ?? null,
      blocks,
      // 问题卡按 questions 顺序渲染，数量与调用数一致（B-3 / D4）
      questions: (Array.isArray(turn.questions) ? turn.questions : []).map((question) => ({
        id: question.id,
        toolCallId: question.toolCallId,
        text: question.text,
        options: question.options,
        optionsStatus: question.optionsStatus,
        answer: question.answer,
        selectedLevel: question.selectedLevel,
        state: question.state,
      })),
      error: turn.error ?? null,
      errorKind: turn.errorKind ?? null,
    };
  });
}

/**
 * 派生视图状态。
 *
 * `isRunning` / `pendingQuestions` 等一律由 turns 现算，**不新增可写布尔量**：
 * 双写的布尔量会被迟到事件写回旧值，这是旧实现「旧流污染新会话」的同源问题。
 */
export function deriveViewState(state) {
  const turn = currentTurn(state);
  const isRunning = turn?.status === TURN_STATUS.STREAMING;
  const isAwaitingUser = turn?.status === TURN_STATUS.AWAITING_USER;

  const pendingQuestions = isAwaitingUser
    ? (Array.isArray(turn.questions) ? turn.questions : [])
        .filter((question) => question.state === QUESTION_STATE.PENDING)
        .map((question) => ({ ...question }))
    : [];

  return {
    conversationId: state?.conversationId ?? null,
    mode: state?.mode ?? null,
    turns: Array.isArray(state?.turns) ? state.turns : [],
    turn,
    isRunning,
    isAwaitingUser,
    pendingQuestions,
    canSendMessage: !isRunning && pendingQuestions.length === 0,
    canCancel: Boolean(isRunning),
    canChangeMode: !isRunning && pendingQuestions.length === 0,
    canRetryLastTurn: Boolean(turn) && !isRunning,
    error: turn?.error ?? null,
  };
}

export default reduceSession;
