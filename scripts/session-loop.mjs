/**
 * C4 · Node 闭环脚本（阶段 C）
 *
 * 目的：在**不联网、不渲染**的前提下，用假运行层把会话状态机走完一整轮真实语义：
 *   发送 → 待答（一轮 3 问）→ 逐题作答 / 跳过 → 全部结束后自动开下一轮。
 *
 * 为什么在接页面之前做（`C-会话状态层.md` C4）：这是「协议 + 状态机成立」的独立证据。
 * 它跑不通，接页面只会让问题更难定位（分不清是状态错还是渲染错）。
 *
 * 覆盖的判据：
 *   ① 两个 turn 的内容符合预期；
 *   ② 第二个 turn 的上下文含第一个 turn 的问题与用户答案；
 *   ③ 上下文没有悬空调用、没有 reasoning、没有 U+200B。
 *
 * 与 `useChatSession` 的唯一差异：hook 里「把本轮用户消息补进上下文」由 `contextForRun`
 * 完成（`buildModelContext` 按协议只发已完成轮次），本脚本用同名逻辑复刻一次并打印出来，
 * 因此下面看到的「实际发送」与真实运行时完全一致。
 *
 * 运行：`node scripts/session-loop.mjs`；全部判据通过则退出码 0，否则 1。
 */
import {
  buildModelContext,
  createInitialState,
  deriveViewState,
  projectTurns,
  reduceSession,
} from '../src/utils/conversationState.js';

const GATE = '\u200B';
const CONVERSATION = 'conv-demo';

/** 事件类型 → action 类型（和 hook 里的映射同构）。 */
const EVENT_ACTION_TYPES = Object.freeze({
  'run-started': 'RUN_STARTED',
  'text-delta': 'TEXT_DELTA',
  'reasoning-delta': 'REASONING_DELTA',
  'tool-started': 'TOOL_STARTED',
  'tool-completed': 'TOOL_COMPLETED',
  'tool-failed': 'TOOL_FAILED',
});

const checks = [];

function check(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  console.log(`  ${ok ? '✅' : '❌'} ${name}${detail ? ` —— ${detail}` : ''}`);
}

function title(text) {
  console.log(`\n${'─'.repeat(72)}\n${text}\n${'─'.repeat(72)}`);
}

/** 跑一批事件；runId 由调用方给出，模拟运行层「每个事件都带自己的 runId」。 */
function playEvents(state, runId, events) {
  let next = state;
  for (const event of events) {
    const type = EVENT_ACTION_TYPES[event.type];
    if (!type) throw new Error(`未知事件类型：${event.type}`);
    next = reduceSession(next, { ...event, runId, type });
  }
  return next;
}

/** 与 `useChatSession` 的 `contextForRun` 同构：已完成轮次 + 本轮用户消息。 */
function contextForRun(state) {
  const messages = buildModelContext(state.turns);
  const text = state.turns.at(-1)?.userMessage?.text;
  if (typeof text === 'string' && text.trim()) messages.push({ role: 'user', content: text });
  return messages;
}

/** 上下文自检：配对、reasoning、开闸标记。 */
function inspectContext(messages) {
  const calls = new Set();
  const results = new Set();
  let reasoning = 0;

  for (const message of messages) {
    if (!Array.isArray(message.content)) continue;
    for (const part of message.content) {
      if (part.type === 'tool-call') calls.add(part.toolCallId);
      if (part.type === 'tool-result') results.add(part.toolCallId);
      if (part.type === 'reasoning') reasoning += 1;
    }
  }

  const dangling = [...calls].filter((id) => !results.has(id));
  const orphanResults = [...results].filter((id) => !calls.has(id));
  return {
    calls: calls.size,
    results: results.size,
    dangling,
    orphanResults,
    reasoning,
    hasGate: JSON.stringify(messages).includes(GATE),
  };
}

function printTurn(turn, index) {
  const projected = projectTurns([turn])[0];
  console.log(`\n  ── turn #${index + 1} ──`);
  console.log(`  id=${turn.id}  runId=${turn.runId}  mode=${turn.modeSnapshot}  status=${turn.status}`);
  console.log(`  userMessage.source=${turn.userMessage?.source ?? '(无)'}`);
  console.log(`  用户消息：${JSON.stringify(turn.userMessage?.text ?? '')}`);
  console.log(`  modelMessages=${turn.modelMessages.length} 条 / parts=${turn.parts.length} 段 / questions=${turn.questions.length} 个`);

  for (const question of turn.questions) {
    console.log(
      `    问题 ${question.id} [${question.state}] 档位=${question.options.length}` +
        ` 首选=${question.selectedLevel ?? '(无)'} 答案=${JSON.stringify(question.answer ?? null)}`,
    );
    console.log(`      题干：${question.text}`);
  }

  const blocks = projected.blocks.map((block) => {
    if (block.type === 'tool') return `tool(${block.toolName ?? '?'}:${block.status})`;
    return `${block.type}(${block.text.length}字)`;
  });
  console.log(`  渲染块顺序：${blocks.join(' → ') || '(空)'}`);
}

// ────────────────────────────── 第 1 轮：发送 ──────────────────────────────

title('第 1 轮 · 发送');
let state = createInitialState({ mode: 'socratic' });

state = reduceSession(state, {
  type: 'SEND_MESSAGE',
  conversationId: CONVERSATION,
  turnId: 'turn-1',
  runId: 'run-1',
  mode: 'socratic',
  text: '我在学闭包，帮我看看理解得对不对',
});
state = reduceSession(state, {
  type: 'RUN_STARTED',
  conversationId: CONVERSATION,
  turnId: 'turn-1',
  runId: 'run-1',
  mode: 'socratic',
});

const context1 = contextForRun(state);
console.log(`  本轮实际发送的上下文：${context1.length} 条`);
console.log(`  ${JSON.stringify(context1)}`);
console.log(`  isRunning=${deriveViewState(state).isRunning}`);

// ────────────────────────────── 第 1 轮：假运行层 ──────────────────────────────

title('第 1 轮 · 假运行层（模型说了两句、问了 3 个问题）');

const question1 = {
  status: 'ready',
  questionId: 'q_closure_1',
  question: '闭包捕获的是变量的值，还是变量本身？',
  options: [
    { level: 'basic', content: '变量的值（拷贝一份）' },
    { level: 'expert', content: '变量本身（引用同一份存储）' },
  ],
  optionsStatus: 'ready',
  nextAction: 'await_user',
};
const question2 = {
  status: 'ready',
  questionId: 'q_closure_2',
  question: '这段循环里的回调为什么都打印 3？',
  options: [],
  optionsStatus: 'unavailable',
  errorCode: 'option_model_not_configured',
  nextAction: 'await_user',
};
const question3 = {
  status: 'ready',
  questionId: 'q_closure_3',
  question: '你能举一个自己写过的闭包用途吗？',
  options: [{ level: 'familiar', content: '事件监听里保存外层变量' }],
  optionsStatus: 'ready',
  nextAction: 'await_user',
};

state = playEvents(state, 'run-1', [
  // 推理只在界面展示，模型上下文里必须看不到
  { type: 'reasoning-delta', partId: 'reason-1', delta: '先摸底，一次问三个维度' },
  { type: 'text-delta', partId: 'text-1', delta: `先聊两句，再问你三个问题。${GATE}` },
  { type: 'text-delta', partId: 'text-1', delta: '别紧张，答不出也没关系。' },
  // 真实端点的顺序：调用按 1/2/3 出现，结果按 1/3/2 回来（B7 实测过 00/02/01）
  { type: 'tool-started', toolCallId: 'call_1', toolName: 'ask_question', input: { question: question1.question } },
  { type: 'tool-started', toolCallId: 'call_2', toolName: 'ask_question', input: { question: question2.question } },
  { type: 'tool-started', toolCallId: 'call_3', toolName: 'ask_question', input: { question: question3.question } },
  { type: 'tool-completed', toolCallId: 'call_1', output: question1 },
  { type: 'tool-completed', toolCallId: 'call_3', output: question3 },
  { type: 'tool-completed', toolCallId: 'call_2', output: question2 },
]);

// 收尾：一对一的协议消息（另外故意混入 reasoning、空文本块、U+200B、一条悬空调用）
state = reduceSession(state, {
  type: 'RUN_FINISHED',
  runId: 'run-1',
  reason: 'awaiting_user',
  responseMessages: [
    {
      role: 'assistant',
      content: [
        { type: 'reasoning', text: '这段推理不该进上下文' },
        // 运行层（B1）返回前已清过 U+200B，这里如实模拟「干净输入」
        { type: 'text', text: '先聊两句，再问你三个问题。别紧张，答不出也没关系。' },
        { type: 'tool-call', toolCallId: 'call_1', toolName: 'ask_question', input: { question: question1.question } },
        { type: 'tool-call', toolCallId: 'call_2', toolName: 'ask_question', input: { question: question2.question } },
        { type: 'tool-call', toolCallId: 'call_3', toolName: 'ask_question', input: { question: question3.question } },
        { type: 'tool-call', toolCallId: 'call_ghost', toolName: 'ask_question', input: { question: '只有调用没有结果' } },
        { type: 'text', text: '' },
      ],
    },
    {
      role: 'tool',
      content: [
        { type: 'tool-result', toolCallId: 'call_1', toolName: 'ask_question', output: question1 },
        { type: 'tool-result', toolCallId: 'call_2', toolName: 'ask_question', output: question2 },
        { type: 'tool-result', toolCallId: 'call_3', toolName: 'ask_question', output: question3 },
      ],
    },
  ],
});

printTurn(state.turns[0], 0);
const view1 = deriveViewState(state);
console.log(`\n  派生：isRunning=${view1.isRunning} isAwaitingUser=${view1.isAwaitingUser} pendingQuestions=${view1.pendingQuestions.length} canChangeMode=${view1.canChangeMode}`);

// ────────────────────────────── 作答 ──────────────────────────────

title('作答 · 逐题提交（前两个答完都不应开新一轮）');

function answerOrSkip(label, action) {
  const before = state.turns.length;
  state = reduceSession(state, action);
  const view = deriveViewState(state);
  console.log(
    `  ${label} → turns=${state.turns.length}（原 ${before}） 末轮状态=${state.turns.at(-1).status}` +
      ` pending=${view.pendingQuestions.length} isRunning=${view.isRunning}`,
  );
  return state.turns.length !== before;
}

answerOrSkip('答第 1 题（选项 expert）', {
  type: 'SUBMIT_ANSWER',
  questionId: 'q_closure_1',
  answer: '变量本身（引用同一份存储）',
  selectedLevel: 'expert',
  turnId: 'turn-2',
  runId: 'run-2',
  mode: 'socratic',
});

answerOrSkip('跳第 2 题', {
  type: 'SKIP_QUESTION',
  questionId: 'q_closure_2',
  turnId: 'turn-2',
  runId: 'run-2',
  mode: 'socratic',
});

const startedSecondTurn = answerOrSkip('答第 3 题（手动输入）', {
  type: 'SUBMIT_ANSWER',
  questionId: 'q_closure_3',
  answer: '事件监听里保存外层变量',
  selectedLevel: null,
  turnId: 'turn-2',
  runId: 'run-2',
  mode: 'socratic',
});

// 双击演示：同一题再提交一次，必须原样返回
const beforeDoubleClick = state;
state = reduceSession(state, {
  type: 'SUBMIT_ANSWER',
  questionId: 'q_closure_1',
  answer: '重复提交',
  selectedLevel: 'basic',
  turnId: 'turn-3',
  runId: 'run-3',
  mode: 'socratic',
});
const doubleClickIgnored = state === beforeDoubleClick;

printTurn(state.turns[0], 0);
printTurn(state.turns[1], 1);

// ────────────────────────────── 第 2 轮：上下文与收尾 ──────────────────────────────

title('第 2 轮 · 实际发送的上下文');

const context2 = contextForRun(state);
console.log(`  共 ${context2.length} 条：${context2.map((message) => message.role).join(' → ')}`);
for (const [index, message] of context2.entries()) {
  const preview = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
  console.log(`  [${index}] ${message.role}：${preview}`);
}

const inspected = inspectContext(context2);
console.log(
  `\n  自检：tool-call=${inspected.calls} / tool-result=${inspected.results}` +
    ` / 悬空=${inspected.dangling.length} / 孤立结果=${inspected.orphanResults.length}` +
    ` / reasoning=${inspected.reasoning} / U+200B=${inspected.hasGate}`,
);

// 第 2 轮照常跑完，验证「答案已进上下文后继续教学」
state = playEvents(state, 'run-2', [
  { type: 'text-delta', partId: 'text-2', delta: '理解得不错。' },
]);
state = reduceSession(state, {
  type: 'RUN_FINISHED',
  runId: 'run-2',
  reason: 'completed',
  responseMessages: [
    { role: 'assistant', content: [{ type: 'text', text: '理解得不错。' }] },
  ],
});

printTurn(state.turns[1], 1);

// ────────────────────────────── 判据 ──────────────────────────────

title('判据自检');

const answersText = context2.find(
  (message, index) => index === context2.length - 1 && typeof message.content === 'string',
)?.content ?? '';
const questionTexts = state.turns[0].questions.map((question) => question.text);

check('产生两个 turn', state.turns.length === 2, `turns=${state.turns.length}`);
check('第 1 轮停在 awaiting_user 后被改写为 completed', state.turns[0].status === 'completed', state.turns[0].status);
check('第 2 轮已完成', state.turns[1].status === 'completed', state.turns[1].status);
check('第 1 轮 3 个问题全部终结', state.turns[0].questions.every((question) => question.state !== 'pending'));
check(
  '问题卡顺序＝模型调用顺序（结果乱序回来也不打乱）',
  state.turns[0].questions.map((question) => question.id).join(',') === 'q_closure_1,q_closure_2,q_closure_3',
  state.turns[0].questions.map((question) => question.id).join(','),
);
check('前两个答案没有提前开新一轮（第 2 轮只在最后一题后出现）', startedSecondTurn === true && state.turns.length === 2);
check('双击被丢弃（第二次 SUBMIT_ANSWER 原样返回）', doubleClickIgnored);
check(
  '上下文含上一轮三个问题原文',
  questionTexts.every((text) => answersText.includes(text)),
  `命中 ${questionTexts.filter((text) => answersText.includes(text)).length}/3`,
);
check('上下文含第 1 题答案与档位', answersText.includes('我的回答是：变量本身（引用同一份存储）') && answersText.includes('（来自选项：expert）'));
check('上下文含显式跳过记录', answersText.includes('（学生选择了跳过，未作答）'));
check('上下文含手动输入的答案', answersText.includes('我的回答是：事件监听里保存外层变量'));
check('上下文无悬空调用、无孤立结果', inspected.dangling.length === 0 && inspected.orphanResults.length === 0);
check('上下文的调用与结果一对一', inspected.calls === 3 && inspected.results === 3, `${inspected.calls}/${inspected.results}`);
check('上下文无 reasoning', inspected.reasoning === 0);
check('上下文无 U+200B', inspected.hasGate === false);
check('整个状态里没有 U+200B', JSON.stringify(state).includes(GATE) === false);
check('渲染投影：第 1 轮块顺序 reasoning → text → tool×3', (() => {
  const types = projectTurns(state.turns)[0].blocks.map((block) => block.type);
  return types.join(',') === 'reasoning,text,tool,tool,tool';
})());

const failed = checks.filter((item) => !item.ok);
console.log(`\n判据：${checks.length - failed.length}/${checks.length} 通过${failed.length ? `，失败：${failed.map((item) => item.name).join('；')}` : ''}`);

process.exitCode = failed.length === 0 ? 0 : 1;
