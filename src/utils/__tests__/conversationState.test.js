/**
 * 会话状态机：乱序、重复与迟到事件、双击、取消、重试及上下文投影。
 * 只导入纯函数，不联网、不渲染。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  QUESTION_STATE,
  TURN_STATUS,
  buildModelContext,
  createInitialState,
  collectStudentTexts,
  deriveViewState,
  projectLearningPlan,
  projectReferences,
  projectTurns,
  reduceSession,
} from '../conversationState.js';

const ZWSP = '\u200B';
const CONV = 'c1';

/** 从「空会话」造一条正在运行的 turn。 */
function runningState({ text = '讲讲闭包', match3 = null } = {}) {
  let state = createInitialState({ mode: 'socratic' });
  state = reduceSession(state, {
    type: 'SEND_MESSAGE',
    conversationId: CONV,
    turnId: 't1',
    runId: 'r1',
    mode: 'socratic',
    text,
  });
  state = reduceSession(state, {
    type: 'RUN_STARTED',
    conversationId: CONV,
    turnId: 't1',
    runId: 'r1',
    mode: 'socratic',
  });
  if (match3) state = reduceSession(state, match3);
  return state;
}

const readyOutput = (id, question, options = []) => ({
  status: 'ready',
  questionId: id,
  question,
  options,
  optionsStatus: options.length > 0 ? 'ready' : 'unavailable',
  nextAction: 'await_user',
});

/** 一次工具往返：started（可省）+ completed。 */
function completeTool(state, { toolCallId = 'k1', output, withStart = true } = {}) {
  let next = state;
  if (withStart) {
    next = reduceSession(next, {
      type: 'TOOL_STARTED',
      runId: next.turns.at(-1).runId,
      toolCallId,
      toolName: 'ask_question',
      input: { question: 'x' },
    });
  }
  return reduceSession(next, {
    type: 'TOOL_COMPLETED',
    runId: next.turns.at(-1).runId,
    toolCallId,
    output,
  });
}

/** 造一条「问题就绪、等待作答」的 turn。 */
function awaitingState({ responseMessages = [] } = {}) {
  let state = runningState();
  state = completeTool(state, { toolCallId: 'k1', output: readyOutput('q1', '闭包捕获的是什么？') });
  return reduceSession(state, {
    type: 'RUN_FINISHED',
    runId: 'r1',
    reason: 'awaiting_user',
    responseMessages,
  });
}

const submit = (state, over = {}) =>
  reduceSession(state, {
    type: 'SUBMIT_ANSWER',
    questionId: 'q1',
    answer: '变量本身',
    selectedLevel: 'expert',
    turnId: 't2',
    runId: 'r2',
    mode: 'socratic',
    ...over,
  });

// ───────────────────────────── 发送与运行边界 ─────────────────────────────

test('SEND_MESSAGE 建一条 streaming turn，模式固定在本轮上', () => {
  const state = runningState();
  const turn = state.turns.at(-1);

  assert.equal(state.turns.length, 1);
  assert.equal(state.conversationId, CONV);
  assert.equal(turn.status, TURN_STATUS.STREAMING);
  assert.equal(turn.modeSnapshot, 'socratic');
  assert.deepEqual(turn.userMessage, { text: '讲讲闭包', source: 'input' });
  assert.deepEqual(turn.parts, []);
  assert.deepEqual(turn.questions, []);
});

test('发送的三种空操作：文本为空、运行中、还有待答问题', () => {
  const running = runningState();
  assert.equal(
    reduceSession(running, {
      type: 'SEND_MESSAGE',
      conversationId: CONV,
      turnId: 't2',
      runId: 'r2',
      text: '再来一条',
    }),
    running,
  );

  const withBlank = reduceSession(createInitialState(), {
    type: 'SEND_MESSAGE',
    conversationId: CONV,
    turnId: 't1',
    runId: 'r1',
    text: `  ${ZWSP}  `,
  });
  assert.equal(withBlank.turns.length, 0);

  const awaiting = awaitingState();
  assert.equal(
    reduceSession(awaiting, {
      type: 'SEND_MESSAGE',
      conversationId: CONV,
      turnId: 't2',
      runId: 'r2',
      text: '先不等问题卡',
    }),
    awaiting,
  );
});

test('RUN_STARTED：旧 runId 丢弃、重复 started 不复活已收尾的 turn、事件先到则补建', () => {
  const finished = awaitingState();
  const stale = reduceSession(finished, {
    type: 'RUN_STARTED',
    conversationId: CONV,
    turnId: 't9',
    runId: 'r-old',
    mode: 'socratic',
  });
  assert.equal(stale, finished, '旧 run 不应造出第二条 turn');

  const replay = reduceSession(finished, {
    type: 'RUN_STARTED',
    conversationId: CONV,
    turnId: 't1',
    runId: 'r1',
    mode: 'socratic',
  });
  assert.equal(replay, finished, '重复 started 不能把 awaiting_user 拉回 streaming');

  const created = reduceSession(createInitialState({ mode: 'socratic' }), {
    type: 'RUN_STARTED',
    conversationId: CONV,
    turnId: 't0',
    runId: 'r0',
    mode: 'socratic',
  });
  assert.equal(created.turns.length, 1);
  assert.equal(created.turns[0].userMessage, null);
});

// ───────────────────────────── 片段与工具事件 ─────────────────────────────

test('同一 partId 的片段合并成一块，U+200B 被清掉，空片段不建块', () => {
  let state = runningState();
  state = reduceSession(state, { type: 'TEXT_DELTA', runId: 'r1', partId: 'p1', delta: `你好${ZWSP}` });
  state = reduceSession(state, { type: 'TEXT_DELTA', runId: 'r1', partId: 'p1', delta: '世界' });
  state = reduceSession(state, { type: 'TEXT_DELTA', runId: 'r1', partId: 'p1', delta: ZWSP });
  state = reduceSession(state, { type: 'TEXT_DELTA', runId: 'r1', partId: 'p2', delta: '第二块' });

  const texts = state.turns[0].parts.filter((part) => part.type === 'text');
  assert.deepEqual(texts.map((part) => part.text), ['你好世界', '第二块']);
  assert.equal(JSON.stringify(state).includes(ZWSP), false);
});

test('规则与乱序：TOOL_COMPLETED 先到也补建卡片并生成问题；重复不产生第二张', () => {
  let state = runningState();
  state = reduceSession(state, {
    type: 'TOOL_COMPLETED',
    runId: 'r1',
    toolCallId: 'k1',
    output: readyOutput('q1', '第一个问题'),
  });
  const card = state.turns[0].parts.find((part) => part.toolCallId === 'k1');
  assert.equal(card.status, 'completed');
  assert.equal(card.toolName, null, '补建的卡没有工具名（事件本身不带）');

  // 迟到的 started 只更新，不追加第二张卡，也不把卡退回 running
  state = reduceSession(state, {
    type: 'TOOL_STARTED',
    runId: 'r1',
    toolCallId: 'k1',
    toolName: 'ask_question',
    input: { question: '第一个问题' },
  });
  assert.equal(state.turns[0].parts.filter((part) => part.type === 'tool').length, 1);
  assert.equal(state.turns[0].parts.find((part) => part.toolCallId === 'k1').status, 'completed');

  // 重复完成：卡片与问题都不增加
  state = reduceSession(state, {
    type: 'TOOL_COMPLETED',
    runId: 'r1',
    toolCallId: 'k1',
    output: readyOutput('q1', '第一个问题'),
  });
  assert.equal(state.turns[0].parts.filter((part) => part.toolCallId === 'k1').length, 1);
  assert.equal(state.turns[0].questions.length, 1);
  assert.equal(state.turns[0].questions[0].state, QUESTION_STATE.PENDING);
});

test('问题卡顺序＝模型调用顺序，结果乱序回来也不打乱（真实端点的顺序）', () => {
  let state = runningState();
  for (const [toolCallId, text] of [
    ['k1', 'Q1'],
    ['k2', 'Q2'],
    ['k3', 'Q3'],
  ]) {
    state = reduceSession(state, {
      type: 'TOOL_STARTED',
      runId: 'r1',
      toolCallId,
      toolName: 'ask_question',
      input: { question: text },
    });
  }
  // 结果按 1 / 3 / 2 回来（`scripts/socratic-once.output.json` 里是 00 / 02 / 01）
  for (const [toolCallId, questionId, text] of [
    ['k1', 'q1', 'Q1'],
    ['k3', 'q3', 'Q3'],
    ['k2', 'q2', 'Q2'],
  ]) {
    state = reduceSession(state, {
      type: 'TOOL_COMPLETED',
      runId: 'r1',
      toolCallId,
      output: readyOutput(questionId, text),
    });
  }

  assert.deepEqual(
    state.turns[0].questions.map((question) => question.id),
    ['q1', 'q2', 'q3'],
    '问题卡按调用顺序排列，而不是完成顺序',
  );

  // 完成先于开始时没有调用顺序可读，退化为完成顺序（与卡片顺序一致）
  const rebuilt = reduceSession(runningState(), {
    type: 'TOOL_COMPLETED',
    runId: 'r1',
    toolCallId: 'kx',
    output: readyOutput('qx', 'QX'),
  });
  assert.deepEqual(rebuilt.turns[0].questions.map((question) => question.id), ['qx']);
});

test('rejected 与 tool-failed 不生成问题卡，失败原因只留可展示文案', () => {
  let state = runningState();
  state = completeTool(state, {
    toolCallId: 'k1',
    output: { status: 'rejected', reason: 'invalid_input', message: 'question 不能为空' },
  });
  assert.equal(state.turns[0].questions.length, 0);
  assert.equal(state.turns[0].parts[0].output.reason, 'invalid_input');

  state = reduceSession(state, {
    type: 'TOOL_FAILED',
    runId: 'r1',
    toolCallId: 'k2',
    error: new Error('boom'),
  });
  const failed = state.turns[0].parts.find((part) => part.toolCallId === 'k2');
  assert.equal(failed.status, 'failed');
  assert.equal(failed.error, 'boom', 'Error 对象要转成文案，不能进状态');
});

// ───────────────────────────── 收尾与归属 ─────────────────────────────

test('RUN_FINISHED 映射五种结束原因；重复收尾与未知原因不改变已定状态', () => {
  const cases = [
    ['completed', TURN_STATUS.COMPLETED],
    ['awaiting_user', TURN_STATUS.AWAITING_USER],
    ['failed', TURN_STATUS.FAILED],
    ['cancelled', TURN_STATUS.CANCELLED],
    ['limit_reached', TURN_STATUS.COMPLETED],
  ];

  for (const [reason, status] of cases) {
    const state = reduceSession(runningState(), {
      type: 'RUN_FINISHED',
      runId: 'r1',
      reason,
      responseMessages: [],
    });
    assert.equal(state.turns[0].status, status, `reason=${reason} 应映射到 ${status}`);
  }

  const finished = reduceSession(runningState(), {
    type: 'RUN_FINISHED',
    runId: 'r1',
    reason: 'completed',
    responseMessages: [{ role: 'assistant', content: [{ type: 'text', text: '完成' }] }],
  });
  const replay = reduceSession(finished, {
    type: 'RUN_FINISHED',
    runId: 'r1',
    reason: 'failed',
    responseMessages: [],
  });
  assert.equal(replay, finished, '重复收尾应被丢弃');

  const unknown = reduceSession(runningState(), {
    type: 'RUN_FINISHED',
    runId: 'r1',
    reason: 'weird',
    responseMessages: [],
  });
  assert.equal(unknown.turns[0].status, TURN_STATUS.FAILED);
});

test('迟到事件：旧 runId 的片段 / 工具 / 收尾三连都不改状态', () => {
  const state = awaitingState();
  const snapshot = JSON.stringify(state);

  let next = state;
  next = reduceSession(next, { type: 'TEXT_DELTA', runId: 'r-old', partId: 'p9', delta: '旧流' });
  next = reduceSession(next, {
    type: 'TOOL_COMPLETED',
    runId: 'r-old',
    toolCallId: 'k9',
    output: readyOutput('q9', '旧问题'),
  });
  next = reduceSession(next, { type: 'TOOL_STARTED', runId: 'r-old', toolCallId: 'k9', toolName: 'ask_question' });
  next = reduceSession(next, { type: 'RUN_FINISHED', runId: 'r-old', reason: 'completed', responseMessages: [] });

  assert.equal(JSON.stringify(next), snapshot);
});

// ───────────────────────────── 用户命令 ─────────────────────────────

test('CANCEL_RUN：标记 cancelled，之后同 runId 的片段被丢弃，重复取消幂等', () => {
  const running = runningState();
  const cancelled = reduceSession(running, { type: 'CANCEL_RUN', runId: 'r1' });
  assert.equal(cancelled.turns[0].status, TURN_STATUS.CANCELLED);

  const late = reduceSession(cancelled, { type: 'TEXT_DELTA', runId: 'r1', partId: 'p1', delta: '迟到' });
  assert.equal(late, cancelled);

  const again = reduceSession(cancelled, { type: 'CANCEL_RUN', runId: 'r1' });
  assert.equal(again, cancelled);

  // 取消后收尾仍要落盘（modelMessages 不能丢）
  const finished = reduceSession(cancelled, {
    type: 'RUN_FINISHED',
    runId: 'r1',
    reason: 'cancelled',
    responseMessages: [{ role: 'assistant', content: [{ type: 'text', text: '半截' }] }],
  });
  assert.equal(finished.turns[0].status, TURN_STATUS.CANCELLED);
  assert.equal(finished.turns[0].modelMessages.length, 1);
});

test('SUBMIT_ANSWER：一轮全部答完才起新一轮，模板固定', () => {
  // 同一轮里两个问题（工具事件只能在运行中到达）
  let built = runningState();
  built = completeTool(built, { toolCallId: 'k1', output: readyOutput('q1', '闭包捕获的是什么？') });
  built = completeTool(built, { toolCallId: 'k2', output: readyOutput('q2', '为什么循环里是同一个 i？') });
  const state = reduceSession(built, {
    type: 'RUN_FINISHED',
    runId: 'r1',
    reason: 'awaiting_user',
    responseMessages: [],
  });
  assert.equal(state.turns[0].questions.length, 2);

  // 只答第一个：只更新状态，不起新一轮
  const partial = submit(state);
  assert.equal(partial.turns.length, 1);
  assert.equal(partial.turns[0].status, TURN_STATUS.AWAITING_USER);
  assert.equal(partial.turns[0].questions[0].state, QUESTION_STATE.ANSWERED);
  assert.equal(deriveViewState(partial).pendingQuestions.length, 1);

  // 第二个跳过：问题全部结束 → 起新一轮
  const done = reduceSession(partial, {
    type: 'SKIP_QUESTION',
    questionId: 'q2',
    turnId: 't2',
    runId: 'r2',
    mode: 'socratic',
  });
  assert.equal(done.turns.length, 2);
  assert.equal(done.turns[0].status, TURN_STATUS.COMPLETED);
  assert.equal(done.turns[1].status, TURN_STATUS.STREAMING);

  const text = done.turns[1].userMessage.text;
  assert.match(text, /针对问题「闭包捕获的是什么？」，我的回答是：变量本身/);
  assert.match(text, /（来自选项：expert）/);
  assert.match(text, /针对问题「为什么循环里是同一个 i？」：（学生选择了跳过，未作答）/);
  assert.equal(done.turns[1].userMessage.source, 'answer');
  assert.equal(done.turns[1].userMessage.questionId, null, '多个答案没有单一来源问题');
});

test('双击防护：第二次 SUBMIT_ANSWER 不改状态，空答案与非待答问题都是空操作', () => {
  const state = awaitingState();
  const first = submit(state);
  const second = submit(first, { questionId: 'q1', turnId: 't3', runId: 'r3' });

  assert.equal(second, first, '第二次提交必须原样返回（防双击靠这里，不靠按钮）');
  assert.equal(first.turns.length, 2);

  assert.equal(submit(state, { answer: '   ' }), state, '空答案不算作答');

  const running = runningState();
  assert.equal(submit(running), running, '不是待答状态时不处理');
});

test('RETRY_LAST_TURN：换 runId 保留内容，运行中是空操作', () => {
  const failed = reduceSession(runningState(), {
    type: 'RUN_FINISHED',
    runId: 'r1',
    reason: 'failed',
    responseMessages: [],
  });
  const textsBefore = failed.turns[0].parts.length;

  const retried = reduceSession(failed, { type: 'RETRY_LAST_TURN', runId: 'r2' });
  assert.equal(retried.turns.length, 1);
  assert.equal(retried.turns[0].runId, 'r2');
  assert.equal(retried.turns[0].status, TURN_STATUS.STREAMING);
  assert.equal(retried.turns[0].error, null);
  assert.equal(retried.turns[0].parts.length, textsBefore, '旧内容必须保留');

  // 新运行的片段另起一块，不拼到旧文本后面
  const after = reduceSession(retried, { type: 'TEXT_DELTA', runId: 'r2', partId: 'p1', delta: '重来' });
  assert.equal(after.turns[0].parts.length, textsBefore + 1);

  const running = runningState();
  assert.equal(reduceSession(running, { type: 'RETRY_LAST_TURN', runId: 'r9' }), running);
});

test('projectTurns：重试后相同 partId 的两个 run 必须分成两块', () => {
  // AI SDK 的 text 片段 id 是每次流内自增的（实测两次独立运行都是 `0`），
  // 所以「旧正文被拼到新正文后面」只有在合并键带上 runId 时才能避免。
  const spoken = reduceSession(runningState(), {
    type: 'TEXT_DELTA',
    runId: 'r1',
    partId: '0',
    delta: '旧正文',
  });
  const failed = reduceSession(spoken, {
    type: 'RUN_FINISHED',
    runId: 'r1',
    reason: 'failed',
    responseMessages: [],
  });
  const retried = reduceSession(failed, { type: 'RETRY_LAST_TURN', runId: 'r2' });
  const after = reduceSession(retried, {
    type: 'TEXT_DELTA',
    runId: 'r2',
    partId: '0',
    delta: '重试后的回答',
  });

  const blocks = projectTurns(after.turns)[0].blocks.filter((block) => block.type === 'text');
  assert.equal(blocks.length, 2, '旧运行与新运行各自一块');
  assert.deepEqual(blocks.map((block) => block.text), ['旧正文', '重试后的回答']);
  assert.deepEqual(blocks.map((block) => block.runId), ['r1', 'r2']);
});

test('errorKind：失败轮记录类别，取消一律为空，重试时清掉', () => {
  const timedOut = reduceSession(runningState(), {
    type: 'RUN_FINISHED',
    runId: 'r1',
    reason: 'failed',
    responseMessages: [],
    error: new Error('运行已中断'),
    errorKind: 'timeout',
  });
  assert.equal(timedOut.turns[0].error, '运行已中断');
  assert.equal(timedOut.turns[0].errorKind, 'timeout');
  assert.equal(projectTurns(timedOut.turns)[0].errorKind, 'timeout');

  const cancelled = reduceSession(runningState(), {
    type: 'RUN_FINISHED',
    runId: 'r1',
    reason: 'cancelled',
    responseMessages: [],
    error: null,
    errorKind: null,
  });
  assert.equal(cancelled.turns[0].status, TURN_STATUS.CANCELLED);
  assert.equal(cancelled.turns[0].errorKind, null, '取消不是错误，不得留下类别');

  const retried = reduceSession(timedOut, { type: 'RETRY_LAST_TURN', runId: 'r2' });
  assert.equal(retried.turns[0].error, null);
  assert.equal(retried.turns[0].errorKind, null, '重试开始即清掉上一轮的类别');
});

test('SET_MODE：空闲时生效，运行中或有待答问题时不生效', () => {
  const idle = createInitialState({ mode: 'socratic' });
  assert.equal(reduceSession(idle, { type: 'SET_MODE', mode: 'normal' }).mode, 'normal');
  assert.equal(reduceSession(idle, { type: 'SET_MODE' }), idle, '没有 mode 字段是空操作');

  const running = runningState();
  assert.equal(reduceSession(running, { type: 'SET_MODE', mode: 'normal' }), running);

  const awaiting = awaitingState();
  assert.equal(reduceSession(awaiting, { type: 'SET_MODE', mode: 'normal' }), awaiting);
});

test('OPEN_CONVERSATION：streaming 降级 interrupted，缺失字段补默认值', () => {
  const state = reduceSession(createInitialState(), {
    type: 'OPEN_CONVERSATION',
    conversationId: 'c-old',
    mode: 'socratic',
    turns: [{ id: 't-old', runId: 'r-old', status: 'streaming', userMessage: { text: '旧', source: 'input' } }],
  });

  assert.equal(state.conversationId, 'c-old');
  assert.equal(state.turns[0].status, TURN_STATUS.INTERRUPTED);
  assert.deepEqual(state.turns[0].modelMessages, []);
  assert.deepEqual(state.turns[0].parts, []);
  assert.deepEqual(state.turns[0].questions, []);
});

// ───────────────────────────── 上下文与投影 ─────────────────────────────

test('buildModelContext：只取已完成 turn、只保留配对调用，无 reasoning / U+200B / 空块', () => {
  const responseMessages = [
    {
      role: 'assistant',
      content: [
        { type: 'reasoning', text: '不该进上下文的推理' },
        { type: 'text', text: `先回答一个问题。${ZWSP}` },
        { type: 'tool-call', toolCallId: 'k1', toolName: 'ask_question', input: { question: 'Q1' } },
        { type: 'tool-call', toolCallId: 'k-orphan', toolName: 'ask_question', input: { question: '悬空' } },
        { type: 'text', text: '' },
      ],
    },
    {
      role: 'tool',
      content: [
        { type: 'tool-result', toolCallId: 'k1', toolName: 'ask_question', output: { status: 'ready' } },
        { type: 'tool-result', toolCallId: 'k-stray', toolName: 'ask_question', output: { status: 'ready' } },
      ],
    },
  ];

  // 作答产生的新一轮还在 streaming，本函数不发送它；这里让它收尾，检查稳态上下文
  const answering = submit(awaitingState({ responseMessages }));
  const answered = reduceSession(answering, {
    type: 'RUN_FINISHED',
    runId: 'r2',
    reason: 'completed',
    responseMessages: [],
  });
  const context = buildModelContext(answered.turns);

  assert.deepEqual(context.map((message) => message.role), ['user', 'assistant', 'tool', 'user']);
  assert.equal(context[0].content, '讲讲闭包');

  const assistant = context[1].content;
  assert.deepEqual(assistant.map((part) => part.type), ['text', 'tool-call']);
  assert.equal(assistant[0].text, '先回答一个问题。', '空文本块被丢弃、U+200B 被清');
  assert.equal(assistant[1].toolCallId, 'k1', '悬空的调用不进上下文');

  const tool = context[2].content;
  assert.deepEqual(tool.map((part) => part.toolCallId), ['k1'], '没有对应调用的结果也不进上下文');

  assert.match(context[3].content, /我的回答是：变量本身/);
  assert.equal(JSON.stringify(context).includes(ZWSP), false);
  assert.equal(JSON.stringify(context).includes('推理'), false);
});

test('buildModelContext：failed / cancelled / interrupted / streaming 的 turn 整轮不进上下文', () => {
  const failed = reduceSession(runningState(), {
    type: 'RUN_FINISHED',
    runId: 'r1',
    reason: 'failed',
    responseMessages: [{ role: 'assistant', content: [{ type: 'text', text: '半截' }] }],
  });
  assert.deepEqual(buildModelContext(failed.turns), []);

  const cancelled = reduceSession(runningState(), { type: 'CANCEL_RUN', runId: 'r1' });
  assert.deepEqual(buildModelContext(cancelled.turns), []);

  const running = runningState();
  assert.deepEqual(buildModelContext(running.turns), [], '运行中的轮次不发送');
});

test('projectTurns 与 deriveViewState：渲染块合并、问题卡保序、派生字段只有一处来源', () => {
  let state = awaitingState();
  state = reduceSession(state, { type: 'REASONING_DELTA', runId: 'r1-ignored', partId: 'x', delta: '旧' });
  state = reduceSession(state, {
    type: 'TEXT_DELTA',
    runId: state.turns[0].runId,
    partId: 'p1',
    delta: '正文',
  });

  // 上面的 delta 发生在收尾之后，应被守卫丢弃
  const projected = projectTurns(state.turns);
  assert.deepEqual(projected[0].blocks.map((block) => block.type), ['tool']);
  assert.deepEqual(projected[0].questions.map((question) => question.id), ['q1']);
  assert.equal(projected[0].status, TURN_STATUS.AWAITING_USER);

  const view = deriveViewState(state);
  assert.equal(view.isRunning, false);
  assert.equal(view.isAwaitingUser, true);
  assert.equal(view.pendingQuestions.length, 1);
  assert.equal(view.canSendMessage, false);
  assert.equal(view.canChangeMode, false);
  assert.equal(view.canRetryLastTurn, true);

  // 取消后待答问题不再展示（状态不是 awaiting_user）
  const cancelled = reduceSession(runningState(), { type: 'CANCEL_RUN', runId: 'r1' });
  assert.equal(deriveViewState(cancelled).pendingQuestions.length, 0);
  assert.equal(deriveViewState(cancelled).isRunning, false);
});


// ── 工具参数增量（partialInput）──

test('TOOL_INPUT_STARTED 提前建卡，TOOL_INPUT_DELTA 累积，完成后清空且不进投影', () => {
  let state = runningState();

  // 参数开始流出：卡片立刻出现（running，还没有完整 input）
  state = reduceSession(state, {
    type: 'TOOL_INPUT_STARTED',
    runId: 'r1',
    toolCallId: 's1',
    toolName: 'explain_card',
  });
  let toolPart = state.turns.at(-1).parts.find((part) => part.toolCallId === 's1');
  assert.equal(toolPart.status, 'running');
  assert.equal(toolPart.input, null);
  assert.equal(toolPart.partialInput, '');

  // 逐字增量累积
  state = reduceSession(state, {
    type: 'TOOL_INPUT_DELTA',
    runId: 'r1',
    toolCallId: 's1',
    delta: '{"title":"',
  });
  state = reduceSession(state, {
    type: 'TOOL_INPUT_DELTA',
    runId: 'r1',
    toolCallId: 's1',
    delta: '时序图"',
  });
  toolPart = state.turns.at(-1).parts.find((part) => part.toolCallId === 's1');
  assert.equal(toolPart.partialInput, '{"title":"时序图"');

  // 投影透出 partialInput（展示层流式渲染的输入）
  let blocks = projectTurns(state.turns)[0].blocks;
  assert.equal(blocks.find((block) => block.toolCallId === 's1').partialInput, '{"title":"时序图"');

  // TOOL_STARTED 补全 input 后 partialInput 保留（流式渲染持续到 completed）
  state = reduceSession(state, {
    type: 'TOOL_STARTED',
    runId: 'r1',
    toolCallId: 's1',
    toolName: 'explain_card',
    input: { title: '时序图', svg: '<svg/>' },
  });
  toolPart = state.turns.at(-1).parts.find((part) => part.toolCallId === 's1');
  assert.deepEqual(toolPart.input, { title: '时序图', svg: '<svg/>' });

  // 完成：partialInput 清空，投影为 null
  state = reduceSession(state, {
    type: 'TOOL_COMPLETED',
    runId: 'r1',
    toolCallId: 's1',
    output: { status: 'ready', title: '时序图', svg: '<svg/>', viewBox: { width: 680, height: 200 } },
  });
  toolPart = state.turns.at(-1).parts.find((part) => part.toolCallId === 's1');
  assert.equal(toolPart.partialInput, null);
  blocks = projectTurns(state.turns)[0].blocks;
  assert.equal(blocks.find((block) => block.toolCallId === 's1').partialInput, null);

  // 完成后的迟到 delta 不再改变卡片
  const after = reduceSession(state, {
    type: 'TOOL_INPUT_DELTA',
    runId: 'r1',
    toolCallId: 's1',
    delta: 'late',
  });
  assert.equal(after, state);
});

test('TOOL_INPUT_DELTA 找不到卡片时补建（不静默丢弃）', () => {
  let state = runningState();
  state = reduceSession(state, {
    type: 'TOOL_INPUT_DELTA',
    runId: 'r1',
    toolCallId: 'orphan',
    delta: '{"svg":"<svg',
  });
  const toolPart = state.turns.at(-1).parts.find((part) => part.toolCallId === 'orphan');
  assert.equal(toolPart.status, 'running');
  assert.equal(toolPart.partialInput, '{"svg":"<svg');
});

test('不属于当前 runId 的增量事件不改变状态', () => {
  const state = runningState();
  const next = reduceSession(state, {
    type: 'TOOL_INPUT_DELTA',
    runId: 'someone-else',
    toolCallId: 's1',
    delta: 'x',
  });
  assert.equal(next, state);
});

test('RETRY_LAST_TURN：旧问题作废，只显示、不可作答、不进答案汇总', () => {
  const ask = (state, runId, toolCallId, questionId, text) =>
    reduceSession(state, {
      type: 'TOOL_COMPLETED',
      runId,
      toolCallId,
      toolName: 'ask_question',
      output: { status: 'ready', nextAction: 'await_user', questionId, question: text, options: [] },
    });
  const finish = (state, runId, reason) =>
    reduceSession(state, { type: 'RUN_FINISHED', runId, reason, responseMessages: [] });
  const retry = (toolCallId) => {
    const failed = finish(ask(runningState(), 'r1', 'old-call', 'old-q', '旧问题'), 'r1', 'failed');
    const retried = reduceSession(failed, { type: 'RETRY_LAST_TURN', runId: 'r2' });
    return finish(ask(retried, 'r2', toolCallId, 'new-q', '新问题'), 'r2', 'awaiting_user');
  };

  const waiting = retry('new-call');
  assert.deepEqual(deriveViewState(waiting).pendingQuestions.map((item) => item.id), ['new-q']);
  const shown = projectTurns(waiting.turns)[0].questions;
  assert.equal(shown.find((item) => item.id === 'old-q').resolution, 'superseded');
  const answer = { type: 'SUBMIT_ANSWER', answer: '答', turnId: 't2', runId: 'r3' };
  assert.equal(reduceSession(waiting, { ...answer, questionId: 'old-q' }), waiting);

  const next = reduceSession(waiting, { ...answer, questionId: 'new-q' });
  assert.equal(next.turns.length, 2, '只剩新题，答完即续轮');
  assert.match(next.turns[1].userMessage.text, /新问题/);
  assert.doesNotMatch(next.turns[1].userMessage.text, /旧问题/);
  assert.equal(next.turns[1].userMessage.questionId, 'new-q');

  // 端点复用 toolCallId 时，新题必须可作答
  assert.deepEqual(deriveViewState(retry('old-call')).pendingQuestions.map((item) => item.id), ['new-q']);
});

/** 一轮两问的待答状态。 */
function awaitingTwoQuestions() {
  let state = runningState();
  for (const [toolCallId, questionId, question] of [['c1', 'q1', '题一'], ['c2', 'q2', '题二']]) {
    state = reduceSession(state, {
      type: 'TOOL_COMPLETED',
      runId: 'r1',
      toolCallId,
      toolName: 'ask_question',
      output: { status: 'ready', nextAction: 'await_user', questionId, question, options: [] },
    });
  }
  return reduceSession(state, { type: 'RUN_FINISHED', runId: 'r1', reason: 'awaiting_user', responseMessages: [] });
}
const explain = (questionId) => ({ type: 'EXPLAIN_QUESTION', questionId, turnId: 't2', runId: 'r2' });

test('EXPLAIN_QUESTION：多题时立即起新一轮，其余待答题暂缓，重复点击只生效一次', () => {
  const next = reduceSession(awaitingTwoQuestions(), explain('q1'));
  assert.equal(next.turns.length, 2);
  assert.equal(next.turns[0].status, TURN_STATUS.COMPLETED);
  assert.deepEqual(next.turns[0].questions.map((item) => [item.state, item.resolution]), [
    ['skipped', 'explain'],
    ['skipped', 'deferred'],
  ]);
  assert.equal(
    next.turns[1].userMessage.text,
    '针对问题「题一」：（学生想不出来，希望直接讲解这一点，未作答）\n\n' +
      '针对问题「题二」：（学生暂未作答，先处理其他请求；之后可按需重新提问）',
  );
  assert.equal(next.turns[1].userMessage.source, 'answer');
  assert.equal(reduceSession(next, explain('q1')), next);
  assert.equal(reduceSession(next, explain('q2')), next);
});

test('EXPLAIN_QUESTION：已答题照常进汇总，普通跳过文案不变', () => {
  const answered = reduceSession(awaitingTwoQuestions(), {
    type: 'SUBMIT_ANSWER', questionId: 'q1', answer: '我的答案', turnId: 'x', runId: 'x',
  });
  const text = reduceSession(answered, explain('q2')).turns[1].userMessage.text;
  assert.match(text, /题一」，我的回答是：我的答案/);
  assert.match(text, /题二」：（学生想不出来/);

  const skipped = reduceSession(awaitingTwoQuestions(), {
    type: 'SKIP_QUESTION', questionId: 'q1', turnId: 'x', runId: 'x',
  });
  assert.match(reduceSession(skipped, explain('q2')).turns[1].userMessage.text, /题一」：（学生选择了跳过，未作答）/);
});

test('EXPLAIN_QUESTION：运行中、未知题、缺身份都是空操作', () => {
  const running = runningState();
  assert.equal(reduceSession(running, explain('q1')), running);
  const waiting = awaitingTwoQuestions();
  assert.equal(reduceSession(waiting, explain('nope')), waiting);
  assert.equal(reduceSession(waiting, { ...explain('q1'), runId: '' }), waiting);
});

const PLAN = { goal: '目标', conventions: [], currentConceptId: '', nextStep: '', concepts: [] };
const planMessages = (plan) => [
  { role: 'assistant', content: [{ type: 'tool-call', toolCallId: 'p', toolName: 'update_learning_plan', input: {} }] },
  { role: 'tool', content: [{ type: 'tool-result', toolCallId: 'p', toolName: 'update_learning_plan', output: { type: 'json', value: { status: 'ready', plan } } }] },
];
const planTurn = (status, goal, extra = {}) => ({ id: goal, runId: 'r', status, questions: [], parts: [], modelMessages: planMessages({ ...PLAN, goal }), ...extra });

test('projectLearningPlan：只认合格轮次；运行中取本次运行，旧运行不算', () => {
  assert.equal(projectLearningPlan([]), null);
  assert.equal(projectLearningPlan([planTurn('completed', '一'), planTurn('awaiting_user', '二')]).goal, '二');
  for (const status of ['failed', 'cancelled', 'interrupted']) {
    assert.equal(projectLearningPlan([planTurn('completed', '一'), planTurn(status, '坏')]).goal, '一');
  }
  const part = (runId, goal) => ({ type: 'tool', toolName: 'update_learning_plan', toolCallId: goal, runId, status: 'completed', output: { status: 'ready', plan: { ...PLAN, goal } } });
  const streaming = (parts) => planTurn('streaming', '旧协议', { runId: 'r2', parts });
  assert.equal(projectLearningPlan([planTurn('completed', '一'), streaming([part('r2', '新')])]).goal, '新');
  assert.equal(projectLearningPlan([planTurn('completed', '一'), streaming([part('r1', '重试前')])]).goal, '一');
});

test('collectStudentTexts：自由输入、手答与调整要求算，点选候选和答案汇总不算', () => {
  assert.deepEqual(
    collectStudentTexts([
      { userMessage: { source: 'input', text: '自由输入' }, questions: [
        { state: 'answered', answer: '手答', selectedLevel: null },
        { state: 'answered', answer: '候选文本', selectedLevel: 'expert' },
        { state: 'skipped', answer: null },
      ] },
      { userMessage: { source: 'answer', text: '汇总模板' }, questions: [] },
      { userMessage: { source: 'plan_request', text: '整条消息', requestText: '调整要求' }, questions: [] },
    ]),
    ['自由输入', '手答', '调整要求'],
  );
});

test('REQUEST_PLAN_CHANGE：待答题暂缓并立即续轮，原话单独保存，重复提交只生效一次', () => {
  const action = { type: 'REQUEST_PLAN_CHANGE', text: ' 跳过条件概率 ', turnId: 't2', runId: 'r2' };
  const waiting = awaitingTwoQuestions();
  const answered = reduceSession(waiting, { type: 'SUBMIT_ANSWER', questionId: 'q1', answer: '我的答案', turnId: 'x', runId: 'x' });
  const next = reduceSession(answered, action);
  assert.equal(next.turns.length, 2);
  assert.equal(next.turns[0].status, TURN_STATUS.COMPLETED);
  assert.deepEqual(next.turns[0].questions.map((item) => item.resolution), [undefined, 'deferred']);
  assert.equal(next.turns[1].userMessage.source, 'plan_request');
  assert.equal(next.turns[1].userMessage.requestText, '跳过条件概率');
  assert.match(next.turns[1].userMessage.text, /^要求调整学习计划：跳过条件概率\n\n针对问题「题一」，我的回答是：我的答案[^]*题二」：（学生暂未作答/);
  assert.equal(reduceSession(next, action), next, '运行中是空操作');
  assert.equal(reduceSession(waiting, { ...action, text: ' ' }), waiting);
  assert.equal(reduceSession(waiting, { ...action, runId: '' }), waiting);
  assert.deepEqual(collectStudentTexts(next.turns).slice(-2), ['我的答案', '跳过条件概率']);
});

test('REQUEST_PLAN_CHANGE：没有待答题时不重复发送旧答案', () => {
  const done = reduceSession(runningState(), { type: 'RUN_FINISHED', runId: 'r1', reason: 'completed', responseMessages: [] });
  const next = reduceSession(done, { type: 'REQUEST_PLAN_CHANGE', text: '先讲例子', turnId: 't2', runId: 'r2' });
  assert.equal(next.turns[1].userMessage.text, '要求调整学习计划：先讲例子');
});

test('引用：题目保存合法引用并进入投影，重复完成事件不丢', () => {
  const output = { ...readyOutput('q1', '看图'), refs: ['fig-aaaaaa', 'bad', 'concept:a'] };
  let state = completeTool(runningState(), { output });
  state = completeTool(state, { output, withStart: false });
  assert.deepEqual(projectTurns(state.turns)[0].questions[0].refs, ['fig-aaaaaa', 'concept:a']);
  const plain = completeTool(runningState(), { output: readyOutput('q1', '无引用') });
  assert.equal('refs' in plain.turns[0].questions[0], false);
  assert.deepEqual(projectTurns(plain.turns)[0].questions[0].refs, []);
});

test('引用目标：图按顺序编号、旧图不编号、概念指向最近一次成为当前的轮次、失败轮的计划不计', () => {
  const figure = (refId, title) => ({ type: 'tool', toolName: 'visualize', output: { status: 'ready', refId, title } });
  const planMessages = (currentConceptId) => [{
    role: 'tool',
    content: [{ type: 'tool-result', toolName: 'update_learning_plan', toolCallId: 'p', output: {
      status: 'ready',
      plan: { goal: 'g', currentConceptId, concepts: [{ id: 'a', name: '甲' }, { id: 'b', name: '乙' }] },
    } }],
  }];
  const turn = (id, status, parts, modelMessages) => ({ id, runId: id, status, parts, modelMessages });
  const references = projectReferences([
    turn('t1', 'completed', [figure(undefined, '旧图'), figure('fig-aaaaaa', '一')], planMessages('a')),
    turn('t2', 'completed', [], planMessages('b')),
    turn('t3', 'failed', [figure('fig-bbbbbb', '二')], planMessages('b')),
    turn('t4', 'completed', [figure('fig-cccccc', '三')], planMessages('a')),
    turn('t5', 'completed', [], planMessages('a')),
  ]);
  assert.deepEqual(
    [...references.values()].map((item) => [item.ref, item.number, item.anchor]),
    [
      ['fig-aaaaaa', 1, 'fig-aaaaaa'],
      ['concept:a', undefined, 'turn:t4'],
      ['concept:b', undefined, 'turn:t2'],
      ['fig-bbbbbb', 2, 'fig-bbbbbb'],
      ['fig-cccccc', 3, 'fig-cccccc'],
    ],
  );
  assert.equal(projectReferences(null).size, 0);
});
