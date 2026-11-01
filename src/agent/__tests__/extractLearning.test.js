/**
 * 学习提取器判据（ADR-001 §3.4）：
 *   ① 正常提交 → ready，原样带回 goal / nodes；
 *   ② 模型只在正文作答、不调工具 → invalid_output；
 *   ③ 未配置副模型 → not_configured 且零请求；
 *   ④ 请求失败 → detail 白名单，不含端点与密钥；
 *   ⑤ 超时 / 外部取消 → detail 分通道；
 *   ⑥ DeepSeek 端点注入 thinking:disabled；
 *   ⑦ 空输入或缺少提示词是调用方契约错误，直接抛。
 *
 * 全部用假 fetch 返回非流式 JSON，不联网，也不代表真实模型能力。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EXTRACT_DETAIL_CANCELLED,
  EXTRACT_DETAIL_INVALID_OUTPUT,
  EXTRACT_DETAIL_REQUEST_FAILED,
  EXTRACT_DETAIL_TIMEOUT,
  EXTRACT_ERROR_FAILED,
  EXTRACT_ERROR_NOT_CONFIGURED,
  extractLearning,
  isExtractConfigReady,
} from '../services/extractLearning.js';

const CONFIG = {
  endpoint: 'https://example.invalid/v1',
  apiKey: 'secret-key-should-not-leak',
  model: 'test-model',
};

const SYSTEM_PROMPT = '从这一段对话里提取学习链路。';
const INPUT = '[本轮学生输入]\n闭包是什么';

function toolCallResponse(payload) {
  return new Response(
    JSON.stringify({
      id: 'chatcmpl-test',
      object: 'chat.completion',
      created: 0,
      model: 'test-model',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: '',
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: { name: 'submit_learning_update', arguments: JSON.stringify(payload) },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

function plainTextResponse() {
  return new Response(
    JSON.stringify({
      id: 'chatcmpl-test',
      object: 'chat.completion',
      created: 0,
      model: 'test-model',
      choices: [{ index: 0, message: { role: 'assistant', content: '我读完了这段对话。' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

function hangingFetch(input, init) {
  return new Promise((_, reject) => {
    const onAbort = () => reject(new DOMException('The operation was aborted.', 'AbortError'));
    if (init?.signal?.aborted) return onAbort();
    init?.signal?.addEventListener('abort', onAbort);
    setTimeout(() => reject(new Error('hangingFetch 未被 abort 收尾')), 5000).unref();
  });
}

function failingFetch() {
  return async () => {
    throw new Error('connect ECONNREFUSED 10.0.0.1');
  };
}

function recordingFetch(response, record) {
  return async (input, init) => {
    record.count += 1;
    try {
      record.body = JSON.parse(init.body);
    } catch {
      record.body = null;
    }
    return response;
  };
}

const run = (fetchImpl, overrides = {}) =>
  extractLearning({
    input: INPUT,
    config: CONFIG,
    systemPrompt: SYSTEM_PROMPT,
    baseFetch: fetchImpl,
    ...overrides,
  });

test('正常提交 → ready，原样带回 goal 与 nodes', async () => {
  const payload = {
    goal: '弄懂闭包为什么能记住变量',
    nodes: [
      {
        topic: '变量生命周期',
        type: 'stuck',
        points: ['变量随函数消失'],
        evidence: '函数结束后变量就没了',
      },
    ],
  };

  const result = await run(async () => toolCallResponse(payload));

  assert.equal(result.status, 'ready');
  assert.equal(result.goal, payload.goal);
  assert.deepEqual(result.nodes, payload.nodes);
});

test('模型不调工具 → invalid_output', async () => {
  const result = await run(async () => plainTextResponse());

  assert.equal(result.status, 'unavailable');
  assert.equal(result.errorCode, EXTRACT_ERROR_FAILED);
  assert.equal(result.detail, EXTRACT_DETAIL_INVALID_OUTPUT);
});

test('未配置副模型 → not_configured，且零请求', async () => {
  let count = 0;
  const result = await run(async () => {
    count += 1;
    return toolCallResponse({ nodes: [] });
  }, { config: { endpoint: '', apiKey: '', model: '' } });

  assert.equal(result.status, 'unavailable');
  assert.equal(result.errorCode, EXTRACT_ERROR_NOT_CONFIGURED);
  assert.equal(count, 0);
});

test('请求失败 → detail 白名单，不泄露端点与密钥', async () => {
  const result = await run(failingFetch());

  assert.equal(result.status, 'unavailable');
  assert.equal(result.detail, EXTRACT_DETAIL_REQUEST_FAILED);
  assert.ok(!String(result.detail).includes('secret-key'));
  assert.ok(!String(result.detail).includes('example.invalid'));
});

test('超时 → timeout', async () => {
  // AbortSignal.timeout 的计时器是 unref 的：没人持有事件循环时进程会先退出，
  // promise 永远不 settle（既有的候选服务测试同样卡在这里）。
  // 这里显式保活，只影响测试进程，不改产品实现。
  const keepAlive = setInterval(() => {}, 1000);
  try {
    const result = await run(hangingFetch, { timeoutMs: 120 });

    assert.equal(result.status, 'unavailable');
    assert.equal(result.detail, EXTRACT_DETAIL_TIMEOUT);
  } finally {
    clearInterval(keepAlive);
  }
});

test('外部取消 → cancelled', async () => {
  const controller = new AbortController();
  const pending = run(hangingFetch, { abortSignal: controller.signal });
  controller.abort();

  const result = await pending;
  assert.equal(result.status, 'unavailable');
  assert.equal(result.detail, EXTRACT_DETAIL_CANCELLED);
});

test('DeepSeek 端点注入 thinking:disabled', async () => {
  const record = { count: 0, body: null };
  await run(recordingFetch(toolCallResponse({ nodes: [] }), record), {
    config: { ...CONFIG, endpoint: 'https://api.deepseek.com/v1' },
  });

  assert.equal(record.count, 1);
  assert.deepEqual(record.body.thinking, { type: 'disabled' });
});

test('其他端点不注入 thinking', async () => {
  const record = { count: 0, body: null };
  await run(recordingFetch(toolCallResponse({ nodes: [] }), record));

  assert.equal(record.count, 1);
  assert.equal(record.body.thinking, undefined);
});

test('空输入或缺提示词 → 抛调用方错误', async () => {
  await assert.rejects(() => extractLearning({ input: '  ', config: CONFIG, systemPrompt: SYSTEM_PROMPT }));
  await assert.rejects(() => extractLearning({ input: INPUT, config: CONFIG, systemPrompt: '' }));
});

test('isExtractConfigReady：三项缺一即不可用', () => {
  assert.equal(isExtractConfigReady(CONFIG), true);
  assert.equal(isExtractConfigReady({ ...CONFIG, apiKey: '' }), false);
  assert.equal(isExtractConfigReady({ ...CONFIG, model: '  ' }), false);
  assert.equal(isExtractConfigReady(null), false);
});
