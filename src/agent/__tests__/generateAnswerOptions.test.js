/**
 * B3 判据（`B-运行层与提问工具.md` B3，按 `决策记录.md` B-10 放宽后）：
 *   ① 五档齐全 → ready 5 条、顺序固定；
 *   ② 只有三档 → ready 3 条（缺档不再算失败）；
 *   ③ 同一档两条 → 只保留第一条；
 *   ④ 零条可识别档位 → unavailable + invalid_output；
 *   ⑤ 请求失败 → detail 白名单，且不含端点/密钥/请求头；
 *   ⑥ 未配置副模型 → not_configured 且零请求；
 *   ⑦ 超时 → detail: timeout。
 * 另有两条边界：空问题/缺 systemPrompt 抛错（调用方契约错误）；开闸标记不进候选答案。
 *
 * 全部用假 fetch 返回的 SSE，不联网。标签用 String.fromCharCode 拼，避免源码里出现空心括号。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OPTION_ERROR_FAILED,
  OPTION_ERROR_NOT_CONFIGURED,
  OPTION_LEVELS,
  extractOptions,
  generateAnswerOptions,
  isOptionConfigReady,
} from '../services/generateAnswerOptions.js';

const OPEN = String.fromCharCode(0x3016); // 空心左括号
const CLOSE = String.fromCharCode(0x3017); // 空心右括号

const tag = (level, text) => `${OPEN}${level}${CLOSE}${text}${OPEN}/${level}${CLOSE}`;

const CONFIG = {
  endpoint: 'https://example.invalid/v1',
  apiKey: 'test-key-should-not-leak',
  model: 'test-model',
};
const SYSTEM_PROMPT = '请用五个档位回答，每档一条。';

/** 构造一个 OpenAI 兼容的 SSE 事件。 */
const sse = (delta, finishReason = null) =>
  `data: ${JSON.stringify({
    id: 'chatcmpl-test',
    object: 'chat.completion.chunk',
    created: 0,
    model: 'test-model',
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  })}\n\n`;

const DONE = 'data: [DONE]\n\n';

/** 把若干段正文拼成一条完整的流式响应。 */
function textStream(chunks) {
  const payloads = [
    sse({ role: 'assistant', content: '' }),
    ...chunks.map((text) => sse({ content: text })),
    sse({}, 'stop'),
    DONE,
  ];
  return streamFrom(payloads);
}

function streamFrom(payloads) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const payload of payloads) controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

/** 永不产出数据、永不关闭的流，用于超时。 */
function hangingStream() {
  const body = new ReadableStream({ start() {} });
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

function createFetch(response, counter) {
  return async () => {
    if (counter) counter.count += 1;
    return response;
  };
}

const run = (fetchImpl, overrides = {}) =>
  generateAnswerOptions({
    question: '你听说过闭包吗？',
    context: '上一段讲解讲到了函数作用域。',
    config: CONFIG,
    systemPrompt: SYSTEM_PROMPT,
    baseFetch: fetchImpl,
    ...overrides,
  });

const FULL_TEXT = [
  tag('none', '完全没听过这个词'),
  tag('heard', '听过，但说不清是什么'),
  tag('basic', '大概知道是函数里的变量'),
  tag('familiar', '能说清它和词法作用域的关系'),
  tag('expert', '能举例说明闭包的内存行为'),
].join('');

test('五档齐全 → ready，5 条且顺序固定', async () => {
  const counter = { count: 0 };
  const result = await run(createFetch(textStream([FULL_TEXT]), counter));

  assert.equal(result.status, 'ready');
  assert.deepEqual(
    result.options.map((item) => item.level),
    [...OPTION_LEVELS],
  );
  assert.equal(result.options[0].text, '完全没听过这个词');
  assert.equal(counter.count, 1, '一次调用只应发一次请求（maxRetries: 0）');
});

test('只有三档 → 仍然 ready，返回 3 条（放宽后缺档不算失败）', async () => {
  const text = [tag('none', '没听过'), tag('basic', '知道一点'), tag('expert', '很熟')].join('');
  const result = await run(createFetch(textStream([text])));

  assert.equal(result.status, 'ready');
  assert.deepEqual(result.options, [
    { level: 'none', text: '没听过' },
    { level: 'basic', text: '知道一点' },
    { level: 'expert', text: '很熟' },
  ]);
});

test('同一档出现两条 → 只保留第一条', async () => {
  const text = [tag('basic', '第一条'), tag('basic', '第二条'), tag('expert', '很熟')].join('');
  const result = await run(createFetch(textStream([text])));

  assert.equal(result.status, 'ready');
  assert.deepEqual(result.options, [
    { level: 'basic', text: '第一条' },
    { level: 'expert', text: '很熟' },
  ]);
});

test('零条可识别档位 → unavailable + invalid_output', async () => {
  const result = await run(createFetch(textStream(['我理解了，你觉得呢？'])));

  assert.deepEqual(result, {
    status: 'unavailable',
    errorCode: OPTION_ERROR_FAILED,
    detail: 'invalid_output',
  });
});

test('请求失败 → detail 只允许白名单，且不含端点/密钥/请求头', async () => {
  const failure = new Response('{"error":"upstream boom"}', {
    status: 500,
    headers: { 'content-type': 'application/json', 'x-trace': 'trace-abc' },
  });
  const result = await run(createFetch(failure));

  assert.equal(result.status, 'unavailable');
  assert.equal(result.errorCode, OPTION_ERROR_FAILED);
  assert.match(result.detail, /^(HTTP \d{3}|request_failed)$/);

  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes('example.invalid'), false);
  assert.equal(serialized.includes('test-key-should-not-leak'), false);
  assert.equal(serialized.includes('trace-abc'), false);
});

test('超时 → detail: timeout', async () => {
  const result = await run(createFetch(hangingStream()), { timeoutMs: 60 });

  assert.deepEqual(result, {
    status: 'unavailable',
    errorCode: OPTION_ERROR_FAILED,
    detail: 'timeout',
  });
});

test('未配置副模型 → not_configured，且不发起任何请求', async () => {
  const counter = { count: 0 };
  const result = await run(createFetch(textStream([FULL_TEXT]), counter), {
    config: { endpoint: '', apiKey: '', model: '' },
  });

  assert.deepEqual(result, { status: 'unavailable', errorCode: OPTION_ERROR_NOT_CONFIGURED });
  assert.equal(counter.count, 0);
});

test('isOptionConfigReady：三项齐全且端点必须是绝对地址', () => {
  assert.equal(isOptionConfigReady(CONFIG), true);
  assert.equal(isOptionConfigReady({ ...CONFIG, apiKey: '' }), false);
  assert.equal(isOptionConfigReady({ ...CONFIG, model: '  ' }), false);
  assert.equal(isOptionConfigReady({ ...CONFIG, endpoint: '/v1/chat/completions' }), false);
  assert.equal(isOptionConfigReady(null), false);
});

test('开闸标记（U+200B）不会出现在候选答案里', async () => {
  const result = await run(createFetch(textStream([FULL_TEXT])));

  assert.equal(result.status, 'ready');
  for (const option of result.options) {
    assert.equal(option.text.includes('\u200B'), false);
  }
});

test('候选答案只认五档标签：标签外正文与未知标签一律丢弃', () => {
  assert.deepEqual(extractOptions('随便说两句'), []);
  assert.deepEqual(extractOptions(`${tag('unknown', '野标签')}`), []);
  assert.deepEqual(extractOptions(`${tag('basic', '  ')},`), []);
  assert.deepEqual(extractOptions(''), []);
  assert.deepEqual(extractOptions(undefined), []);
});

test('调用契约错误直接抛错（不由服务静默兜底）', async () => {
  await assert.rejects(() => run(createFetch(textStream([FULL_TEXT])), { question: '   ' }), /question/);
  await assert.rejects(
    () => run(createFetch(textStream([FULL_TEXT])), { systemPrompt: '' }),
    /systemPrompt/,
  );
});
