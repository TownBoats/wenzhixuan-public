/**
 * B3 判据（explore/structured-options · 结构化输出改造后）：
 *   ① 五档齐全 → ready 5 条、顺序固定、一次调用只发一次请求（maxRetries: 0）；
 *   ② 只有三档 → ready 3 条（缺档不算失败）；
 *   ③ 同一档两条 → 只保留第一条；
 *   ④ 全部条目文本为空 → unavailable + invalid_output；
 *   ⑤ 模型返回非 JSON 文本 / enum 违约的档位 → SDK 校验失败 → invalid_output；
 *   ⑥ 请求失败 → detail 白名单，且不含端点/密钥/请求头；
 *   ⑦ 未配置副模型 → not_configured 且零请求；
 *   ⑧ 超时 → detail: timeout；
 *   ⑨ 空问题/缺 systemPrompt 抛错（调用方契约错误）；
 *   ⑩ normalizeOptions：未知档位、空文本、非数组输入一律归一化为空。
 *
 * 全部用假 fetch 返回非流式 JSON 补全，不联网。
 * 与旧标签协议的区别：格式约束由 JSON Schema + SDK 承担，本文件不再有「标签解析」用例。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OPTION_ERROR_FAILED,
  OPTION_ERROR_NOT_CONFIGURED,
  OPTION_LEVELS,
  generateAnswerOptions,
  isOptionConfigReady,
  normalizeOptions,
} from '../services/generateAnswerOptions.js';

const CONFIG = {
  endpoint: 'https://example.invalid/v1',
  apiKey: 'test-key-should-not-leak',
  model: 'test-model',
};
const SYSTEM_PROMPT = '按五个档位给出学生回答。';

const FULL_OPTIONS = [
  { level: 'none', text: '完全没听过这个词' },
  { level: 'heard', text: '听过，但说不清是什么' },
  { level: 'basic', text: '大概知道是函数里的变量' },
  { level: 'familiar', text: '能说清它和词法作用域的关系' },
  { level: 'expert', text: '能举例说明闭包的内存行为' },
];

/** 构造一个 OpenAI 兼容的非流式补全响应，content 为给定字符串。 */
function completionResponse(content) {
  return new Response(
    JSON.stringify({
      id: 'chatcmpl-test',
      object: 'chat.completion',
      created: 0,
      model: 'test-model',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

const optionsResponse = (options) => completionResponse(JSON.stringify({ options }));

/** 挂起的请求：靠 SDK 传入的 signal 收尾；兜底 5s 自毁，宁可测试失败也不能挂死。 */
function hangingFetch(input, init) {
  return new Promise((_, reject) => {
    const onAbort = () => reject(new DOMException('The operation was aborted.', 'AbortError'));
    // 信号可能在 listener 挂上之前就已中止（测试同步 abort 的情形），
    // 与原生 fetch 对齐：已中止的信号要立刻拒绝
    if (init?.signal?.aborted) return onAbort();
    init?.signal?.addEventListener('abort', onAbort);
    setTimeout(() => reject(new Error('hangingFetch 未被 abort 收尾，signal 链路断了')), 5000).unref();
  });
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

test('五档齐全 → ready，5 条且顺序固定', async () => {
  const counter = { count: 0 };
  // 乱序返回，验证归一化会按 OPTION_LEVELS 重排
  const shuffled = [FULL_OPTIONS[2], FULL_OPTIONS[4], FULL_OPTIONS[0], FULL_OPTIONS[1], FULL_OPTIONS[3]];
  const result = await run(createFetch(optionsResponse(shuffled), counter));

  assert.equal(result.status, 'ready');
  assert.deepEqual(
    result.options.map((item) => item.level),
    [...OPTION_LEVELS],
  );
  assert.equal(result.options[0].text, '完全没听过这个词');
  assert.equal(counter.count, 1, '一次调用只应发一次请求（maxRetries: 0）');
});

test('只有三档 → 仍然 ready，返回 3 条（缺档不算失败）', async () => {
  const result = await run(
    createFetch(
      optionsResponse([
        { level: 'none', text: '没听过' },
        { level: 'basic', text: '知道一点' },
        { level: 'expert', text: '很熟' },
      ]),
    ),
  );

  assert.equal(result.status, 'ready');
  assert.deepEqual(result.options, [
    { level: 'none', text: '没听过' },
    { level: 'basic', text: '知道一点' },
    { level: 'expert', text: '很熟' },
  ]);
});

test('同一档出现两条 → 只保留第一条', async () => {
  const result = await run(
    createFetch(
      optionsResponse([
        { level: 'basic', text: '第一条' },
        { level: 'basic', text: '第二条' },
        { level: 'expert', text: '很熟' },
      ]),
    ),
  );

  assert.equal(result.status, 'ready');
  assert.deepEqual(result.options, [
    { level: 'basic', text: '第一条' },
    { level: 'expert', text: '很熟' },
  ]);
});

test('全部条目文本去空白后为空 → unavailable + invalid_output', async () => {
  const result = await run(createFetch(optionsResponse([{ level: 'basic', text: '   ' }])));

  assert.deepEqual(result, {
    status: 'unavailable',
    errorCode: OPTION_ERROR_FAILED,
    detail: 'invalid_output',
  });
});

test('模型返回非 JSON 文本 → SDK 校验失败 → invalid_output', async () => {
  const result = await run(createFetch(completionResponse('我觉得这个问题挺有意思')));

  assert.equal(result.status, 'unavailable');
  assert.equal(result.errorCode, OPTION_ERROR_FAILED);
  assert.equal(result.detail, 'invalid_output');
});

test('模型返回 enum 之外的档位 → SDK 校验失败 → invalid_output', async () => {
  const result = await run(
    createFetch(optionsResponse([{ level: 'master', text: '不存在的档位' }])),
  );

  assert.equal(result.status, 'unavailable');
  assert.equal(result.errorCode, OPTION_ERROR_FAILED);
  assert.equal(result.detail, 'invalid_output');
});

test('请求失败 → detail 只允许白名单，且不含端点/密钥/请求头', async () => {
  const failure = new Response('{"error":"upstream boom","key":"test-key-should-not-leak"}', {
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
  const result = await run(hangingFetch, { timeoutMs: 60 });

  assert.deepEqual(result, {
    status: 'unavailable',
    errorCode: OPTION_ERROR_FAILED,
    detail: 'timeout',
  });
});

test('外部取消 → detail: cancelled', async () => {
  const controller = new AbortController();
  const promise = run(hangingFetch, { abortSignal: controller.signal });
  controller.abort();
  const result = await promise;

  assert.deepEqual(result, {
    status: 'unavailable',
    errorCode: OPTION_ERROR_FAILED,
    detail: 'cancelled',
  });
});

test('未配置副模型 → not_configured，且不发起任何请求', async () => {
  const counter = { count: 0 };
  const result = await run(createFetch(optionsResponse(FULL_OPTIONS), counter), {
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

test('normalizeOptions：未知档位 / 空文本 / 非数组输入一律归一化', () => {
  assert.deepEqual(normalizeOptions({ options: 'not-an-array' }), []);
  assert.deepEqual(normalizeOptions({}), []);
  assert.deepEqual(normalizeOptions(null), []);
  assert.deepEqual(
    normalizeOptions({
      options: [
        { level: 'unknown', text: '野档位' },
        { level: 'basic', text: '  ' },
        { level: 'expert', text: '  有效  ' },
      ],
    }),
    [{ level: 'expert', text: '有效' }],
  );
});

test('调用契约错误直接抛错（不由服务静默兜底）', async () => {
  await assert.rejects(
    () => run(createFetch(optionsResponse(FULL_OPTIONS)), { question: '   ' }),
    /question/,
  );
  await assert.rejects(
    () => run(createFetch(optionsResponse(FULL_OPTIONS)), { systemPrompt: '' }),
    /systemPrompt/,
  );
});
