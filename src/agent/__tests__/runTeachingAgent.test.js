/**
 * 运行层全链路：给定模拟模型输出，断言事件序列、结束原因与协议消息。
 * 使用 `MockLanguageModelV3` 与假 generateOptions，不联网。
 *
 * 注意：
 * - 不用 `doStream: [...]` 数组形式，其下标从第 2 个元素开始；改用函数 + 自增游标
 * - 流片段是 V3 方言：tool-call 的 input 是字符串化 JSON，finishReason 是对象
 * - `model` / `generateOptions` 注入口只供测试使用
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import http from 'node:http';

import { MockLanguageModelV3, simulateReadableStream } from 'ai/test';

import { createModes, getMode } from '../modes.js';
import { resolveRunReason, runTeachingAgent } from '../runTeachingAgent.js';
import { runModelTurn } from '../modelAdapter.js';

/** Node 侧不能 import `modePrompts.js`（含 `?raw`），只能自己读 md 再装配。 */
const modes = createModes({
  normal: readFileSync(new URL('../skills/normal.md', import.meta.url), 'utf8'),
  socratic: readFileSync(new URL('../skills/socratic.md', import.meta.url), 'utf8'),
});

const CONFIG = {
  endpoint: 'https://example.invalid/v1',
  apiKey: 'test-key-should-not-leak',
  model: 'test-model',
};

const OPTION_CONFIG = {
  endpoint: 'https://example.invalid/v1',
  apiKey: 'test-key-should-not-leak',
  model: 'test-option-model',
};

const USAGE = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};

/** V3 方言的 `finish` 片段。 */
const finish = (unified) => ({
  type: 'finish',
  finishReason: { unified, raw: unified },
  usage: USAGE,
});

/** 一段文本输出（每个 delta 共用一个 `id`，用于断言 `partId` 稳定）。 */
const textScript = (id, deltas, unified = 'stop') => [
  { type: 'text-start', id },
  ...deltas.map((delta) => ({ type: 'text-delta', id, delta })),
  { type: 'text-end', id },
  finish(unified),
];

/**
 * 一步里发起若干 `ask_question` 调用。
 * `toolCallId` 必须**跨步全局唯一**：`ask_question` 的幂等表按 `toolCallId` 记忆，
 * 复用一个 id 会让第二步直接拿回第一步的结果（真实模型每次调用都会生成新 id）。
 */
let callSequence = 0;
const toolScript = (calls) => [
  ...calls.map((call) => {
    callSequence += 1;
    return {
      type: 'tool-call',
      toolCallId: `call_${callSequence}`,
      toolName: 'ask_question',
      input: JSON.stringify(call.input ?? call),
    };
  }),
  finish('tool-calls'),
];

/** 按调用次序回放脚本；用尽后重复最后一个（防止意外多调一次时挂住）。 */
function createModel(scripts) {
  let cursor = 0;
  return new MockLanguageModelV3({
    doStream: () => {
      const chunks = scripts[Math.min(cursor, scripts.length - 1)];
      cursor += 1;
      return { stream: simulateReadableStream({ chunks }) };
    },
  });
}

const readyOptions = async ({ question }) => ({
  status: 'ready',
  options: [{ level: 'basic', text: `${question} 的浅层答案` }],
});

test('context window usage is the last request, not the sum of repeated tool-loop prompts', async () => {
  const final = textScript('final', ['done']);
  final.at(-1).usage = {
    inputTokens: { total: 120, noCache: 20, cacheRead: 100, cacheWrite: 0 },
    outputTokens: { total: 7, text: 7, reasoning: 0 },
  };
  const { result } = await runAgent({ scripts: [toolScript([{ input: { question: '' } }]), final] });
  assert.equal(result.stepCount, 2);
  assert.deepEqual(result.contextUsage, { inputTokens: 120, outputTokens: 7 });
});

test('provider without usage leaves measured context unknown, not zero', async () => {
  const final = textScript('final', ['done']);
  final.at(-1).usage = { inputTokens: { total: undefined }, outputTokens: { total: undefined } };
  const { result } = await runAgent({ scripts: [final], modeId: 'normal' });
  assert.equal(result.reason, 'completed');
  assert.equal(result.contextUsage, null);
});

/**
 * 跑一次 `runTeachingAgent`，回放给定脚本。
 *
 * `useRealOptions`：走真实的 `generateAnswerOptions`（取消取证用），
 * 此时 `generateOptions` 传 `undefined`，由 `createAskQuestionTool` 的默认参数装配。
 */
async function runAgent({
  scripts,
  modeId = 'socratic',
  generateOptions = readyOptions,
  useRealOptions = false,
  optionConfig = OPTION_CONFIG,
  abortSignal,
  onEvent,
  onDebug,
  ids = { conversationId: 'c1', turnId: 't1', runId: 'r1' },
}) {
  const model = createModel(scripts);
  const events = [];
  const result = await runTeachingAgent({
    ...ids,
    mode: getMode(modes, modeId),
    config: CONFIG,
    messages: [{ role: 'user', content: '教教我闭包' }],
    optionConfig,
    optionSystemPrompt: '副模型提示词',
    abortSignal,
    onEvent: (event) => {
      events.push(event);
      onEvent?.(event);
    },
    onDebug,
    generateOptions: useRealOptions ? undefined : generateOptions,
    model,
  });
  return { result, events, calls: model.doStreamCalls.length };
}

const typesOf = (events) => events.map((event) => event.type);

// ── 用例 1：提问后停止，不再有第二步生成 ──────────────
test('提问后停止：收到 tool-completed 立刻 run-finished{awaiting_user}，只请求 1 次', async () => {
  const { result, events, calls } = await runAgent({
    scripts: [toolScript([{ input: { question: '什么是闭包？' } }])],
  });

  assert.equal(result.reason, 'awaiting_user');
  assert.equal(result.awaitingUser, true);
  assert.equal(calls, 1, 'await_user 之后不得再发起第二步生成');
  assert.deepEqual(typesOf(events), ['run-started', 'tool-started', 'tool-completed', 'run-finished']);
  assert.equal(events[0].mode, 'socratic');
  assert.equal(events[0].runId, 'r1');
  assert.equal(events.at(-1).reason, 'awaiting_user');

  // 每个调用都有配对结果
  const callIds = events.filter((e) => e.type === 'tool-started').map((e) => e.toolCallId);
  const resultIds = events.filter((e) => e.type === 'tool-completed').map((e) => e.toolCallId);
  assert.deepEqual(callIds, resultIds);

  // 协议消息由 SDK 提供：assistant(tool-call) + tool(result)
  assert.deepEqual(result.responseMessages.map((m) => m.role), ['assistant', 'tool']);
  assert.equal(result.responseMessages[1].content[0].type, 'tool-result');
  assert.equal(result.responseMessages[1].content[0].output.value.nextAction, 'await_user');
});

// ── 用例 2：副模型失败降级，结束原因仍是 awaiting_user ──
test('副模型失败降级：optionsStatus=unavailable、问题文本仍在、原因仍是 awaiting_user', async () => {
  const { result, events, calls } = await runAgent({
    scripts: [toolScript([{ input: { question: '你了解作用域吗？' } }])],
    generateOptions: async () => ({
      status: 'unavailable',
      errorCode: 'option_model_failed',
      detail: 'timeout',
    }),
  });

  const completed = events.find((e) => e.type === 'tool-completed');
  assert.equal(completed.output.status, 'ready');
  assert.equal(completed.output.question, '你了解作用域吗？');
  assert.equal(completed.output.optionsStatus, 'unavailable');
  assert.equal(completed.output.errorCode, 'option_model_failed');
  assert.deepEqual(completed.output.options, []);
  assert.equal(completed.output.nextAction, 'await_user');
  assert.equal(result.reason, 'awaiting_user');
  assert.equal(calls, 1);
});

// ── 用例 3：一轮多个问题，全部执行、各得结果、顺序不变 ──
test('一轮多个问题：两个不同文本 + 一个重复 → 2 条 ready + 1 条 duplicate_question', async () => {
  const { result, events, calls } = await runAgent({
    scripts: [
      toolScript([
        { input: { question: '闭包是什么？' } },
        { input: { question: '闭包有什么用？' } },
        { input: { question: '闭包是什么？' } },
      ]),
    ],
  });

  const completed = events.filter((e) => e.type === 'tool-completed');
  assert.equal(events.filter((e) => e.type === 'tool-started').length, 3, '三个调用都要开始');
  assert.equal(completed.length, 3, '三个调用都要有配对结果，一个都不丢弃');
  assert.deepEqual(
    completed.map((e) => e.output.status),
    ['ready', 'ready', 'rejected'],
  );
  assert.equal(completed[2].output.reason, 'duplicate_question');
  assert.deepEqual(
    completed.slice(0, 2).map((e) => e.output.question),
    ['闭包是什么？', '闭包有什么用？'],
    '问题顺序＝模型调用顺序',
  );
  assert.notEqual(completed[0].output.questionId, completed[1].output.questionId);
  assert.equal(calls, 1);
  assert.equal(result.reason, 'awaiting_user');
});

// ── 用例 4：参数非法一次后可修正，不立即停止 ─────────
test('无效参数修正一次：第一次非法不停、第二次合法才停', async () => {
  const { result, events, calls } = await runAgent({
    scripts: [
      toolScript([{ input: { context: '只有 context，没有 question' } }]),
      toolScript([{ input: { question: '现在这个合法了，你听说过闭包吗？' } }]),
    ],
  });

  const completed = events.filter((e) => e.type === 'tool-completed');
  assert.equal(calls, 2, '第一次被拒绝后必须继续生成第二步');
  assert.equal(completed.length, 2);
  assert.equal(completed[0].output.status, 'rejected');
  assert.equal(completed[0].output.reason, 'invalid_input');
  assert.equal(completed[1].output.status, 'ready');
  assert.equal(result.reason, 'awaiting_user');
  assert.equal(result.stepCount, 2);
});

// ── 用例 5：超步数 → limit_reached，已完成内容保留 ────
test('超步数：连续三步拿不到 await_user → limit_reached，协议消息保留', async () => {
  // 为什么不用「合法调用」构造：合法调用在第 1 步就带 nextAction:'await_user'，
  // askQuestionReady 立即停止，永远到不了第 3 步。所以每步都给非法参数（缺 question）。
  const invalid = () => toolScript([{ input: { context: '缺 question' } }]);
  const { result, events, calls } = await runAgent({
    scripts: [invalid(), invalid(), invalid(), invalid()],
  });

  assert.equal(calls, 3, '步数上限生效：只允许 3 步');
  assert.equal(result.stepCount, 3);
  assert.equal(result.reason, 'limit_reached');
  assert.equal(result.awaitingUser, false);
  assert.equal(result.finishReason, 'tool-calls');

  const completed = events.filter((e) => e.type === 'tool-completed');
  assert.equal(completed.length, 3);
  assert.equal(completed.every((e) => e.output.reason === 'invalid_input'), true);
  assert.equal(typesOf(events).at(-1), 'run-finished');
  assert.equal(events.at(-1).reason, 'limit_reached');
  assert.equal(result.responseMessages.length > 0, true, '已完成的内容要保留');
});

// ── 用例 6：取消后不再产生事件 ──────────────
test('取消：收到首个 text-delta 即 abort → cancelled，之后事件不增长', async () => {
  const controller = new AbortController();
  const { result, events, calls } = await runAgent({
    scripts: [textScript('t1', ['第一段', '第二段', '第三段'])],
    abortSignal: controller.signal,
    onEvent: (event) => {
      if (event.type === 'text-delta' && !controller.signal.aborted) controller.abort();
    },
  });

  assert.equal(result.reason, 'cancelled');
  assert.deepEqual(result.responseMessages, [], '取消的运行不产出协议消息');
  assert.equal(events.filter((e) => e.type === 'text-delta').length, 1, 'abort 之后不再转发 delta');
  assert.equal(typesOf(events).at(-1), 'run-finished');
  assert.equal(events.at(-1).reason, 'cancelled');
  assert.equal(calls, 1);

  const countAtFinish = events.length;
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(events.length, countAtFinish, '取消后事件数不再增长');
});

// ── 用例 7：同一段文本的多个 delta 共用一个 partId ────────────
test('partId 稳定：同一段文本的多个 delta 落在同一个 partId 上', async () => {
  const { events } = await runAgent({
    scripts: [textScript('block-1', ['闭包', '是', '函数与其词法环境的组合。'])],
  });

  const deltas = events.filter((e) => e.type === 'text-delta');
  assert.equal(deltas.length, 3);
  assert.deepEqual(new Set(deltas.map((e) => e.partId)).size, 1, '三个 delta 必须共用同一 partId');
  assert.equal(deltas.map((e) => e.delta).join(''), '闭包是函数与其词法环境的组合。');
});

// ── 用例 8：开闸标记两处都清，清空的文本块被丢弃 ─────────────
test('开闸标记：事件与 responseMessages 两处都清，清空后的文本块被丢弃', async () => {
  const gate = '\u200B';
  const { result, events } = await runAgent({
    scripts: [textScript('t1', [gate, `你${gate}好${gate}`, gate])],
  });

  assert.equal(events.some((e) => e.type === 'text-delta' && e.delta.includes(gate)), false);
  assert.deepEqual(
    events.filter((e) => e.type === 'text-delta').map((e) => e.delta),
    ['你好'],
    '只有开闸标记的 delta 清理后为空，不产生事件',
  );
  assert.equal(JSON.stringify(events).includes(gate), false);
  assert.equal(JSON.stringify(result.responseMessages).includes(gate), false);

  const assistant = result.responseMessages.find((m) => m.role === 'assistant');
  const textParts = assistant.content.filter((part) => part.type === 'text');
  assert.deepEqual(
    textParts.map((part) => part.text),
    ['你好'],
    '清理后为空的文本块必须被丢弃，不能留空片段',
  );
  assert.equal(
    textParts.some((part) => part.text === ''),
    false,
    '不得留下空文本块（未清理的空块会让部分端点拒绝下一轮请求）',
  );
});

// ── 用例 9：请求次数 = 步数（工具多步场景为 2 次）─────────────
test('请求次数＝步数：一次工具往返必须是 2 次模型调用', async () => {
  const { result, events, calls } = await runAgent({
    scripts: [
      toolScript([{ input: { context: '缺 question，逼出第二步' } }]),
      textScript('t1', ['我再补充一句。']),
    ],
  });

  assert.equal(calls, 2, 'maxRetries: 0，一次工具往返＝2 次请求');
  assert.equal(result.stepCount, 2);
  assert.equal(result.reason, 'completed');
  assert.equal(result.finishReason, 'stop');
  assert.equal(events.at(-1).type, 'run-finished');
});

// ── 用例 10：normal 模式不注册工具（代码级保证，不靠提示词）──────────
test('normal 模式：不注册 ask_question，纯文本收尾即 completed', async () => {
  const { result, events, calls } = await runAgent({
    scripts: [textScript('t1', ['普通模式只讲解，不提问。'])],
    modeId: 'normal',
  });

  assert.equal(result.reason, 'completed');
  assert.equal(calls, 1);
  assert.equal(events.some((e) => e.type === 'tool-started'), false);
  assert.equal(events[0].mode, 'normal');
});

// ══════════════════════════════════════════════════════════════════════
// 取消
//
// 为什么用**真实的本机 HTTP 服务**而不是注入一个假 fetch：
// 要回答的是「副模型那边还在跑吗」，只有 socket 层面才能证明——
// 请求被发出（计数 1）、取消后服务端观察到连接关闭（不是「代码里传了 signal」）。
// 服务只监听 127.0.0.1 的临时端口，不出网、不校验密钥。
// ══════════════════════════════════════════════════════════════════════

/** 只发一个片段就挂住，模拟「副模型还在生成」；不写 [DONE]、不 end 响应。 */
function startHangingOptionServer() {
  const requests = [];
  const server = http.createServer((req, res) => {
    const entry = { url: req.url, body: '', closed: false };
    requests.push(entry);

    req.on('data', (chunk) => {
      entry.body += chunk;
    });
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
      res.write(
        `data: ${JSON.stringify({
          id: 'chunk-1',
          object: 'chat.completion.chunk',
          created: 1,
          model: 'slow-option',
          choices: [{ index: 0, delta: { content: '〖none〗还没想好' }, finish_reason: null }],
        })}\n\n`,
      );
    });
    // 客户端中止时触发：这是「连接真的断了」的现场，不是代码层面的推断
    res.on('close', () => {
      entry.closed = true;
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        requests,
        endpoint: `http://127.0.0.1:${server.address().port}/v1`,
        close: async () => {
          server.closeAllConnections?.();
          await new Promise((done) => server.close(done));
        },
      });
    });
  });
}

/** 轮询等待条件成立（不依赖固定 sleep，避免慢机器上偶发失败）。 */
async function waitFor(predicate, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return predicate();
}

/** 一个只发一个 SSE 片段、永不结束的响应：主运行超时用。 */
function hangingFetch() {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            id: 'chunk-1',
            object: 'chat.completion.chunk',
            created: 1,
            model: 'hanging',
            choices: [{ index: 0, delta: { content: '只发一半' }, finish_reason: null }],
          })}\n\n`,
        ),
      );
      // 故意不 close：让流一直挂着，由超时打断
    },
  });
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

// ── 用例 11：取消时副模型的连接确实被断开 ──────────────────
test('取消：副模型请求在跑时 abort → 端点看到连接关闭、只有 1 次请求、不产生工具卡', async () => {
  const controller = new AbortController();
  const optionServer = await startHangingOptionServer();
  const optionConfig = { ...OPTION_CONFIG, endpoint: optionServer.endpoint };

  try {
    const pending = runAgent({
      scripts: [toolScript([{ input: { question: '你听说过闭包吗？' } }])],
      useRealOptions: true,
      optionConfig,
      abortSignal: controller.signal,
    });

    // 副模型请求必须真的发出去（否则「中止」无从谈起）
    const issued = await waitFor(() => optionServer.requests.length === 1);
    assert.equal(issued, true, '副模型请求应当已经到达端点');
    assert.equal(
      optionServer.requests[0].body.includes(OPTION_CONFIG.model),
      true,
      '这次请求是副模型的（请求体里带副模型名）',
    );
    assert.equal(optionServer.requests[0].closed, false, '取消之前连接还开着');

    controller.abort();
    const { result, events } = await pending;

    // ① 连接被对端关闭：传输层证据，不是「代码里传了 signal」
    const closed = await waitFor(() => optionServer.requests[0].closed);
    assert.equal(closed, true, '取消后端点必须观察到副模型请求的连接被关闭');

    // ② 结束原因是 cancelled，且没有工具卡（abort 之后的 tool-completed 被丢弃）
    assert.equal(result.reason, 'cancelled');
    assert.equal(result.error, null, '取消不是错误：运行层不返回 error');
    assert.equal(events.some((e) => e.type === 'tool-completed'), false, '取消后不得补一张工具卡');
    assert.equal(events.filter((e) => e.type === 'tool-started').length, 1);
    assert.deepEqual(result.responseMessages, [], '取消的运行不产出协议消息');
    assert.equal(events.at(-1).type, 'run-finished');
    assert.equal(events.at(-1).reason, 'cancelled');

    // ③ 取消不会触发第二次副模型请求
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(optionServer.requests.length, 1, '取消后不得重试副模型');
  } finally {
    await optionServer.close();
  }
});

// ── 用例 12：取消与超时是两条不同的结束原因 ────────────────
test('取消与超时区分：主运行超时 → failed，用户取消 → cancelled', async () => {
  const timedOut = await runModelTurn({
    runId: 'r-timeout',
    config: { ...CONFIG, timeoutMs: 60 },
    messages: [{ role: 'user', content: '教教我闭包' }],
    onEvent: () => {},
    baseFetch: hangingFetch,
  });

  assert.equal(timedOut.ok, false);
  assert.equal(timedOut.endedBy, 'timeout', '超时必须在传输层单独上报，不能与取消合并');
  assert.equal(
    resolveRunReason({ endedBy: timedOut.endedBy, finishReason: timedOut.finishReason }, false),
    'failed',
    '超时是失败（界面提示、可重试）',
  );
  assert.equal(
    resolveRunReason({ endedBy: 'cancelled', finishReason: null }, false),
    'cancelled',
    '取消是用户意图（不显示为错误）',
  );
  assert.equal(resolveRunReason({ endedBy: 'cancelled', finishReason: null }, true), 'cancelled');
});

// ── 候选答案材料：提问前的正文、图标题、历史与补充说明 ──────────────
test('副模型能拿到提问前的正文、图标题、历史与补充说明', async () => {
  const seen = [];
  const svg = '<svg viewBox="0 0 680 100"><text>图内源码</text></svg>';
  const step = (id, deltas, calls) => [
    { type: 'text-start', id },
    ...deltas.map((delta) => ({ type: 'text-delta', id, delta })),
    { type: 'text-end', id },
    ...calls,
    finish('tool-calls'),
  ];
  const toolCall = (toolCallId, toolName, input) => ({
    type: 'tool-call', toolCallId, toolName, input: JSON.stringify(input),
  });
  await runAgent({
    scripts: [
      step('0', ['先看', '这张图。'], [toolCall('m1', 'explain_card', { title: '作用域图', svg })]),
      step('0', ['所以', '闭包记住变量。'], [
        toolCall('m2', 'ask_question', { question: '题一', context: '前提甲' }),
        toolCall('m3', 'ask_question', { question: '题二' }),
      ]),
    ],
    generateOptions: async ({ question, context }) => {
      seen.push([question, context]);
      return { status: 'ready', options: [{ level: 'basic', text: 'x' }] };
    },
  });
  assert.deepEqual(seen.map(([question]) => question), ['题一', '题二']);
  for (const [, context] of seen) {
    assert.match(context, /【学生本轮的输入】\n教教我闭包/);
    assert.match(context, /先看这张图。\n（图：作用域图）\n所以闭包记住变量。/);
    assert.doesNotMatch(context, /图内源码/);
  }
  assert.match(seen[0][1], /前提甲/);
  assert.doesNotMatch(seen[1][1], /前提甲/);
});

// ── 调试记录 ──────────────
test('调试记录：含主模型上下文、主模型写的 context、实际材料与结果，不含端点和密钥', async () => {
  const merged = new Map();
  const { events } = await runAgent({
    scripts: [toolScript([
      { input: { question: '题一', context: '前提甲' } },
      { input: { question: '题二' } },
      { input: { question: '题三', context: '无' } },
    ])],
    generateOptions: async ({ question }) =>
      question === '题二'
        ? { status: 'unavailable', errorCode: 'failed', detail: 'timeout' }
        : { status: 'ready', options: [{ level: 'basic', text: 'x' }] },
    onDebug: (record) => merged.set(record.id, { ...merged.get(record.id), ...record }),
  });
  const records = [...merged.values()];
  const main = records.find((item) => item.kind === 'main');
  assert.equal(main.messages[0].content, '教教我闭包');
  assert.ok(main.system.length > 0);
  assert.ok(main.tools.includes('ask_question'));

  const [one, two, three] = records.filter((item) => item.kind === 'option');
  assert.deepEqual([one.source, two.source, three.source], ['model', 'fallback', 'none']);
  assert.equal(one.modelContext, '前提甲');
  assert.match(one.prompt, /前提甲[^]*题一/);
  assert.deepEqual([one.status, two.status, two.errorCode], ['ready', 'unavailable', 'failed / timeout']);
  assert.equal(one.options.length, 1);

  const dump = JSON.stringify(records);
  assert.equal(dump.includes(CONFIG.apiKey), false);
  assert.equal(dump.includes('example.invalid'), false);
  assert.equal(events.some((event) => event.type.includes('debug')), false);
});

test('调试回调抛错不影响运行', async () => {
  const { result } = await runAgent({
    scripts: [toolScript([{ input: { question: '题', context: '无' } }])],
    onDebug: () => {
      throw new Error('boom');
    },
  });
  assert.equal(result.reason, 'awaiting_user');
});

// ── 学习计划 ──────────────
const planCall = (toolCallId, input) => ({
  type: 'tool-call', toolCallId, toolName: 'update_learning_plan', input: JSON.stringify(input),
});
const PLAN_INPUT = {
  goal: '学会二分',
  conventions: ['下标从 1 开始'],
  concepts: [{ id: 'sorted', name: '有序数组', status: 'verified', evidence: '教教我闭包' }],
};

test('计划与提问同一步：不打断、约定进入材料、伪造证据被降级、结果配对', async () => {
  const seen = [];
  const { result, events } = await runAgent({
    scripts: [[
      planCall('p1', { ...PLAN_INPUT, concepts: [{ ...PLAN_INPUT.concepts[0], evidence: '学生没说过的话' }] }),
      { type: 'tool-call', toolCallId: 'p2', toolName: 'ask_question', input: JSON.stringify({ question: '题', context: '无' }) },
      finish('tool-calls'),
    ]],
    generateOptions: async ({ context }) => {
      seen.push(context);
      return { status: 'ready', options: [{ level: 'basic', text: 'x' }] };
    },
  });
  assert.equal(result.reason, 'awaiting_user');
  assert.match(seen[0], /【全程约定】\n- 下标从 1 开始/);
  const done = events.find((event) => event.type === 'tool-completed' && event.toolCallId === 'p1');
  assert.equal(done.output.plan.concepts[0].status, 'claimed');
  assert.match(done.output.notice, /sorted/);
  const results = result.responseMessages.filter((item) => item.role === 'tool').flatMap((item) => item.content);
  assert.deepEqual(results.map((item) => item.toolCallId).sort(), ['p1', 'p2']);
});

test('先前计划取自上下文，学生原话由上层传入', async () => {
  const first = await runAgent({ scripts: [[planCall('a1', { ...PLAN_INPUT, concepts: [{ id: 'sorted', name: '有序数组' }] }), finish('tool-calls')], textScript('0', ['好'])] });
  const model = createModel([
    [planCall('a2', { concepts: [{ id: 'sorted', status: 'verified', evidence: '因为右边的数都更大' }] }), finish('tool-calls')],
    textScript('0', ['好']),
  ]);
  const outputs = [];
  await runTeachingAgent({
    conversationId: 'c', turnId: 't', runId: 'r', mode: getMode(modes, 'socratic'), config: CONFIG,
    messages: [{ role: 'user', content: 'x' }, ...first.result.responseMessages, { role: 'user', content: '因为右边的数都更大' }],
    studentTexts: ['因为右边的数都更大'], optionConfig: OPTION_CONFIG, optionSystemPrompt: 's', model,
    onEvent: (event) => event.type === 'tool-completed' && outputs.push(event.output),
  });
  assert.equal(outputs[0].plan.goal, '学会二分');
  assert.equal(outputs[0].plan.concepts[0].status, 'verified');
});

test('普通模式没有学习计划工具', async () => {
  const merged = [];
  await runAgent({ scripts: [textScript('0', ['x'])], modeId: 'normal', onDebug: (record) => merged.push(record) });
  assert.deepEqual(merged[0].tools, []);
});
