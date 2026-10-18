/**
 * C2 判据（`C-会话状态层.md` C2 的「判据」三条 + C-1 的原子续轮）：
 *   ① 页面层拿不到任何 `set` 开头的 **setter**（也没有 `dispatch`）；
 *   ② 取消后运行层的 `AbortSignal` 确实被触发，且状态停在 `cancelled`；
 *   ③ `isRunning` 在事件序列的任何时刻都与 `turns` 一致；
 * 另加三条来自 C-1 的行为断言：ID 由会话层分配、双击只起一次运行、答案进入下一轮上下文。
 *
 * 为什么放在 `src/utils/__tests__/`：本阶段允许改动的测试目录只有 `src/agent/__tests__/`
 * 与 `src/utils/__tests__/`，而测试命令也正是按这两个 glob 跑的（不新开目录）。
 *
 * 依赖 `react-test-renderer`（`决策记录.md` **C-2**，用户授权破例新增 devDependency）：
 * hook 必须在真实 React 运行时里跑，reducer 测试覆盖不到「控制器归属」与「派生状态时序」。
 * 运行层一律用假 runner（按脚本调 `onEvent`），不联网、不渲染 DOM。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import { createModes } from '../../agent/modes.js';
import { useChatSession } from '../../hooks/useChatSession.js';

const { act, create } = ReactTestRenderer;

// React 18 的 act 环境开关：不开会打印「update not wrapped in act」并让断言时序失真
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const readSkill = (name) => readFileSync(new URL(`../../agent/skills/${name}`, import.meta.url), 'utf8');
const modes = createModes({ normal: readSkill('normal.md'), socratic: readSkill('socratic.md') });

const config = { endpoint: 'https://example.invalid/v1', apiKey: 'x', model: 'demo' };
const optionConfig = { endpoint: 'https://example.invalid/v1', apiKey: 'x', model: 'demo' };

/** 挂载一个只调用 hook、不渲染任何东西的探针组件，并返回「永远取最新一次渲染」的会话对象。 */
function mount(props) {
  const box = { session: null, renderer: null };

  function Probe() {
    box.session = useChatSession(props);
    return null;
  }

  act(() => {
    box.renderer = create(React.createElement(Probe));
  });

  return {
    get current() {
      return box.session;
    },
    unmount() {
      act(() => box.renderer.unmount());
    },
  };
}

/** 按脚本依次发事件的假运行层；第 n 次调用用第 n 份脚本（超出则复用最后一份）。 */
function createRunner(plans) {
  const calls = [];

  const runner = async (params) => {
    calls.push(params);
    const plan = plans[calls.length - 1] ?? plans[plans.length - 1];
    for (const event of plan.events ?? []) params.onEvent({ ...event, runId: params.runId });
    return {
      reason: plan.reason ?? 'completed',
      responseMessages: plan.responseMessages ?? [],
      error: null,
    };
  };

  runner.calls = calls;
  return runner;
}

/** 「不取消就永不结束」的假运行层：用来证明 `cancelRun` 真的 abort 了本轮的信号。 */
function createAbortableRunner() {
  const state = { calls: 0, aborted: false };

  const runner = (params) => {
    state.calls += 1;
    params.onEvent({ type: 'run-started', runId: params.runId });
    params.onEvent({ type: 'text-delta', runId: params.runId, partId: 'p1', delta: '开始生成' });
    return new Promise((resolve) => {
      params.abortSignal.addEventListener('abort', () => {
        state.aborted = true;
        resolve({ reason: 'cancelled', responseMessages: [], error: null });
      });
    });
  };

  return { runner, state };
}

const readyQuestion = {
  status: 'ready',
  questionId: 'q1',
  question: '闭包捕获的是什么？',
  options: [{ level: 'expert', content: '变量本身（引用）' }],
  optionsStatus: 'ready',
  nextAction: 'await_user',
};

/** 一轮的真实返回：assistant 里带 tool-call，tool 里带配对结果。 */
const firstRunMessages = [
  {
    role: 'assistant',
    content: [
      { type: 'text', text: '先回答一个问题。' },
      { type: 'tool-call', toolCallId: 'k1', toolName: 'ask_question', input: { question: readyQuestion.question } },
    ],
  },
  {
    role: 'tool',
    content: [{ type: 'tool-result', toolCallId: 'k1', toolName: 'ask_question', output: readyQuestion }],
  },
];

test('判据①：返回清单只有只读数据与命令，没有 setter / dispatch', () => {
  const view = mount({ modes, mode: 'socratic', config, runner: createRunner([{ reason: 'completed' }]) });
  const session = view.current;
  const keys = Object.keys(session);

  assert.equal(keys.includes('dispatch'), false, '页面拿到了 dispatch');
  assert.equal(keys.includes('setState'), false, '页面拿到了 setState');
  // 唯一以 set 开头的是命令 setMode（改会话模式），不是 React setter
  assert.deepEqual(keys.filter((key) => key.startsWith('set')), ['setMode']);

  for (const key of ['turns', 'pendingQuestions', 'isRunning', 'isAwaitingUser', 'mode', 'error']) {
    assert.ok(keys.includes(key), `缺少数据字段 ${key}`);
  }
  for (const key of ['sendMessage', 'submitAnswer', 'skipQuestion', 'cancelRun', 'retryLastTurn']) {
    assert.equal(typeof session[key], 'function', `${key} 不是函数`);
  }

  view.unmount();
});

test('判据③：ID 由会话层分配，答案进入下一轮上下文，isRunning 始终与 turns 一致', async () => {
  const runner = createRunner([
    {
      events: [
        { type: 'run-started' },
        { type: 'tool-started', toolCallId: 'k1', toolName: 'ask_question', input: {} },
        { type: 'tool-completed', toolCallId: 'k1', output: readyQuestion },
      ],
      reason: 'awaiting_user',
      responseMessages: firstRunMessages,
    },
    { events: [{ type: 'text-delta', partId: 'p2', delta: '继续讲。' }], reason: 'completed' },
  ]);

  const view = mount({ modes, mode: 'socratic', config, optionConfig, runner });

  const consistent = () =>
    assert.equal(view.current.isRunning, view.current.turns.at(-1)?.status === 'streaming');

  consistent();
  assert.equal(view.current.isRunning, false);

  await act(async () => {
    await view.current.sendMessage('  讲讲闭包  ');
    consistent();
  });

  const first = runner.calls[0];
  assert.equal(typeof first.conversationId, 'string');
  assert.equal(typeof first.turnId, 'string');
  assert.equal(typeof first.runId, 'string');
  assert.equal(first.mode.id, 'socratic');
  assert.deepEqual(first.messages, [{ role: 'user', content: '讲讲闭包' }]);

  assert.equal(view.current.isRunning, false);
  assert.equal(view.current.isAwaitingUser, true);
  assert.equal(view.current.pendingQuestions.length, 1);
  assert.equal(view.current.turns.length, 1);

  await act(async () => {
    await view.current.submitAnswer({ questionId: 'q1', answer: '变量本身', selectedLevel: 'expert' });
    consistent();
  });

  const second = runner.calls[1];
  assert.equal(runner.calls.length, 2);
  assert.equal(second.conversationId, first.conversationId, '同一会话应复用 conversationId');
  assert.notEqual(second.turnId, first.turnId, '新一轮必须是新 turnId');
  assert.notEqual(second.runId, first.runId, '新一轮必须是新 runId');

  // 上下文＝上一轮的 user / assistant / tool + 本轮答案（协议 §6 模板）
  assert.deepEqual(second.messages.map((message) => message.role), ['user', 'assistant', 'tool', 'user']);
  const answerText = second.messages.at(-1).content;
  assert.match(answerText, /针对问题「闭包捕获的是什么？」/);
  assert.match(answerText, /我的回答是：变量本身/);
  assert.match(answerText, /（来自选项：expert）/);
  assert.equal(JSON.stringify(second.messages).includes('\u200B'), false);

  assert.equal(view.current.turns.length, 2);
  assert.equal(view.current.turns[0].status, 'completed');
  consistent();
  view.unmount();
});

test('判据②：cancelRun 触发的是本轮 AbortSignal，晚到事件不再改变状态', async () => {
  const { runner, state } = createAbortableRunner();
  const view = mount({ modes, mode: 'socratic', config, runner });

  let pending = null;
  act(() => {
    pending = view.current.sendMessage('取消我');
  });

  assert.equal(state.calls, 1);
  assert.equal(view.current.isRunning, true);
  assert.equal(view.current.canCancel, true);

  // 运行中重试是空操作：不新增运行、不改变已有轮次
  assert.equal(view.current.retryLastTurn(), null, '运行中重试应为空操作');
  assert.equal(state.calls, 1);

  const runId = view.current.turns.at(-1).runId;

  await act(async () => {
    view.current.cancelRun();
    await pending;
  });

  assert.equal(state.aborted, true, 'AbortSignal 没有被触发');
  assert.equal(view.current.isRunning, false);
  assert.equal(view.current.turns.at(-1).status, 'cancelled');
  assert.equal(view.current.turns.at(-1).runId, runId);

  // 取消是幂等的：再点一次不改变状态，也不会去 abort 别的控制器
  const snapshot = JSON.stringify(view.current.turns);
  act(() => view.current.cancelRun());
  assert.equal(JSON.stringify(view.current.turns), snapshot);

  view.unmount();
});

test('双击只起一次运行：第二次 sendMessage 是空操作', async () => {
  const runner = createRunner([{ reason: 'completed' }]);
  const view = mount({ modes, mode: 'socratic', config, runner });

  await act(async () => {
    const first = view.current.sendMessage('第一次');
    const second = view.current.sendMessage('第二次');
    const [a, b] = await Promise.all([first, second]);
    assert.ok(a);
    assert.equal(b, null, '第二次应该被 reducer 守卫挡掉');
  });

  assert.equal(runner.calls.length, 1);
  assert.equal(view.current.turns.length, 1);
  assert.equal(view.current.turns[0].userMessage.text, '第一次');
  view.unmount();
});

test('重试换新 runId、沿用 turnId，旧内容保留到新运行产出', async () => {
  const runner = createRunner([
    { events: [{ type: 'text-delta', partId: 'p1', delta: '第一版' }], reason: 'failed' },
    { events: [{ type: 'text-delta', partId: 'p2', delta: '第二版' }], reason: 'completed' },
  ]);
  const view = mount({ modes, mode: 'socratic', config, runner });

  await act(async () => {
    await view.current.sendMessage('重试测试');
  });

  const failedRunId = view.current.turns.at(-1).runId;
  assert.equal(view.current.turns.at(-1).status, 'failed');

  await act(async () => {
    await view.current.retryLastTurn();
  });

  assert.equal(runner.calls.length, 2);
  assert.notEqual(runner.calls[1].runId, failedRunId);
  assert.equal(runner.calls[1].turnId, runner.calls[0].turnId, '重试沿用同一个 turnId');
  assert.deepEqual(runner.calls[1].messages.map((message) => message.content), ['重试测试']);

  // 旧内容保留，新片段另起一块（两段文本都能在渲染投影里看到）
  const blocks = view.current.renderedTurns[0].blocks.filter((block) => block.type === 'text');
  assert.deepEqual(blocks.map((block) => block.text), ['第一版', '第二版']);
  assert.equal(view.current.turns.length, 1);
  view.unmount();
});

test('缺模式对象时运行当场收尾为 failed，而不是静默挂住', async () => {
  const runner = createRunner([{ reason: 'completed' }]);
  const view = mount({ modes: {}, mode: 'socratic', config, runner });

  await act(async () => {
    await view.current.sendMessage('没有模式');
  });

  assert.equal(runner.calls.length, 0, '缺少模式对象时不该调运行层');
  assert.equal(view.current.turns.at(-1).status, 'failed');
  assert.match(view.current.error, /模式对象/);
  view.unmount();
});

test('打开既有会话：运行中的轮次降级为 interrupted，且中止当前运行', async () => {
  const { runner, state } = createAbortableRunner();
  const view = mount({ modes, mode: 'socratic', config, runner });

  let pending = null;
  act(() => {
    pending = view.current.sendMessage('进行中');
  });
  assert.equal(view.current.isRunning, true);

  act(() => {
    view.current.openConversation({
      conversationId: 'c-old',
      mode: 'socratic',
      turns: [
        { id: 't-old', runId: 'r-old', status: 'streaming', userMessage: { text: '旧消息', source: 'input' } },
      ],
    });
  });

  assert.equal(state.aborted, true, '打开别的会话应先中止当前运行');
  assert.equal(view.current.conversationId, 'c-old');
  assert.equal(view.current.turns.length, 1);
  assert.equal(view.current.turns[0].status, 'interrupted');

  await act(async () => {
    await pending;
  });

  // 迟到的收尾不能把新打开的会话改回旧状态
  assert.equal(view.current.turns[0].status, 'interrupted');
  view.unmount();
});
