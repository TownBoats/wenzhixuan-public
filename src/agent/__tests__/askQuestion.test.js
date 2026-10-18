/**
 * B4 判据（`B-运行层与提问工具.md` B4，按 `决策记录.md` B-11 定案）：
 *   ① 正常输入 → ready，questionId 由程序生成；
 *   ② 空 / 超长 / 未知字段 / context 超长 → rejected('invalid_input')；
 *   ③ 同一 toolCallId 重放 → 返回上次结果，且只调一次副模型；
 *   ④ 本轮已问过相同文本 → rejected('duplicate_question')；
 *   ⑤ normal 模式 → rejected('mode_not_allowed')；
 *   ⑥ 未配置副模型 → ready + unavailable + not_configured，且零请求；
 *   ⑦ 副模型失败 → ready + unavailable + failed（问题仍可用）；
 *   ⑧ 程序异常 → rejected('internal_error')，且不回传异常原文。
 * 另有两条结构保证：去重排在所有校验之前；一轮多个调用各自有结果。
 *
 * 全部直接调用工具对象的 execute，不走 SDK、不联网（`决策记录.md` B-11 决策点 3）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CONTEXT_MAX_LENGTH,
  QUESTION_MAX_LENGTH,
  createAskQuestionTool,
  validateAskQuestionInput,
} from '../tools/askQuestion.js';

const OPTION_CONFIG = {
  endpoint: 'https://example.invalid/v1',
  apiKey: 'test-key-should-not-leak',
  model: 'test-model',
};

const SOCRATIC = { id: 'socratic', allowsQuestions: true };
const NORMAL = { id: 'normal', allowsQuestions: false };

const READY_OPTIONS = [
  { level: 'none', text: '没听过' },
  { level: 'basic', text: '知道一点' },
  { level: 'expert', text: '很熟' },
];

function createSpy(result) {
  const calls = [];
  const fn = async (params) => {
    calls.push(params);
    if (result instanceof Error) throw result;
    return typeof result === 'function' ? result(params) : result;
  };
  return { fn, calls };
}

function createTool({
  mode = SOCRATIC,
  optionConfig = OPTION_CONFIG,
  generateOptions = createSpy({ status: 'ready', options: READY_OPTIONS }).fn,
  getRemainingMs,
} = {}) {
  return createAskQuestionTool({
    mode,
    optionConfig,
    optionSystemPrompt: '副模型提示词',
    generateOptions,
    getRemainingMs,
  });
}

test('正常输入 → ready，问题 ID 由程序生成，带完整 options 与 await_user', async () => {
  const spy = createSpy({ status: 'ready', options: READY_OPTIONS });
  const askTool = createTool({ generateOptions: spy.fn });

  const result = await askTool.execute(
    { question: '你听说过闭包吗？', context: '刚讲过函数作用域' },
    { toolCallId: 'call_1' },
  );

  assert.equal(result.status, 'ready');
  assert.match(result.questionId, /^q_[0-9a-z]+$/i);
  assert.equal(result.question, '你听说过闭包吗？');
  assert.deepEqual(result.options, READY_OPTIONS);
  assert.equal(result.optionsStatus, 'ready');
  assert.equal(result.nextAction, 'await_user');

  assert.equal(spy.calls.length, 1);
  assert.equal(spy.calls[0].question, '你听说过闭包吗？');
  assert.equal(spy.calls[0].context, '刚讲过函数作用域');
});

test('去空白：问题首尾空白被裁掉，只剩空白视为非法', async () => {
  const askTool = createTool();

  const ok = await askTool.execute({ question: '  闭包是什么？  ' }, { toolCallId: 'c1' });
  assert.equal(ok.question, '闭包是什么？');

  const blank = await askTool.execute({ question: '   ' }, { toolCallId: 'c2' });
  assert.equal(blank.status, 'rejected');
  assert.equal(blank.reason, 'invalid_input');
});

test('参数非法：空 / 超长 / 未知字段 / context 超长 / 类型错误', async () => {
  const askTool = createTool();
  const cases = [
    [{}, 'invalid_input'],
    [{ question: '' }, 'invalid_input'],
    [{ question: 'x'.repeat(QUESTION_MAX_LENGTH + 1) }, 'invalid_input'],
    [{ question: '正常问题', extra: '多余字段' }, 'invalid_input'],
    [{ question: '正常问题', context: 'x'.repeat(CONTEXT_MAX_LENGTH + 1) }, 'invalid_input'],
    [{ question: 123 }, 'invalid_input'],
    [{ question: '正常问题', context: 42 }, 'invalid_input'],
  ];

  for (const [input, reason] of cases) {
    const result = await askTool.execute(input, { toolCallId: `bad_${JSON.stringify(input).length}` });
    assert.equal(result.status, 'rejected', JSON.stringify(input));
    assert.equal(result.reason, reason);
  }
});

test('同一 toolCallId 重放 → 返回上次结果，且只调一次副模型', async () => {
  const spy = createSpy({ status: 'ready', options: READY_OPTIONS });
  const askTool = createTool({ generateOptions: spy.fn });

  const first = await askTool.execute({ question: '什么是闭包？' }, { toolCallId: 'call_same' });
  const second = await askTool.execute({ question: '什么是闭包？' }, { toolCallId: 'call_same' });

  assert.equal(second, first, '应返回同一个结果对象');
  assert.equal(spy.calls.length, 1);
});

test('去重排在校验之前：同一 toolCallId 第二次传非法参数也返回第一次结果', async () => {
  const askTool = createTool();
  const first = await askTool.execute({ question: '什么是闭包？' }, { toolCallId: 'call_order' });
  const second = await askTool.execute({ question: '' }, { toolCallId: 'call_order' });

  assert.equal(first.status, 'ready');
  assert.equal(second, first);
});

test('本轮已问过相同文本（不同 toolCallId）→ duplicate_question', async () => {
  const askTool = createTool();
  const first = await askTool.execute({ question: '闭包捕获的是什么？' }, { toolCallId: 'c_a' });
  const second = await askTool.execute({ question: '  闭包捕获的是什么？  ' }, { toolCallId: 'c_b' });

  assert.equal(first.status, 'ready');
  assert.deepEqual(second, { status: 'rejected', reason: 'duplicate_question' });
});

test('一轮多个调用：各自有结果，重复文本只拒那一个', async () => {
  const askTool = createTool();
  const results = await Promise.all([
    askTool.execute({ question: '你了解作用域吗？' }, { toolCallId: 'm1' }),
    askTool.execute({ question: '你了解提升吗？' }, { toolCallId: 'm2' }),
    askTool.execute({ question: '你了解作用域吗？' }, { toolCallId: 'm3' }),
  ]);

  assert.equal(results[0].status, 'ready');
  assert.equal(results[1].status, 'ready');
  assert.deepEqual(results[2], { status: 'rejected', reason: 'duplicate_question' });
  assert.notEqual(results[0].questionId, results[1].questionId);
});

test('normal 模式 → mode_not_allowed，且不调副模型', async () => {
  const spy = createSpy({ status: 'ready', options: READY_OPTIONS });
  const askTool = createTool({ mode: NORMAL, generateOptions: spy.fn });

  const result = await askTool.execute({ question: '你懂闭包吗？' }, { toolCallId: 'n1' });
  assert.deepEqual(result, { status: 'rejected', reason: 'mode_not_allowed' });
  assert.equal(spy.calls.length, 0);
});

test('未配置副模型 → ready + unavailable + not_configured，且零请求', async () => {
  const spy = createSpy({ status: 'ready', options: READY_OPTIONS });
  const askTool = createTool({ optionConfig: {}, generateOptions: spy.fn });

  const result = await askTool.execute({ question: '你懂闭包吗？' }, { toolCallId: 'u1' });

  assert.equal(result.status, 'ready');
  assert.equal(result.optionsStatus, 'unavailable');
  assert.equal(result.errorCode, 'option_model_not_configured');
  assert.deepEqual(result.options, []);
  assert.equal(result.nextAction, 'await_user');
  assert.equal(spy.calls.length, 0);
});

test('副模型失败 → 问题仍就绪，只是候选答案不可用', async () => {
  const spy = createSpy({ status: 'unavailable', errorCode: 'option_model_failed', detail: 'timeout' });
  const askTool = createTool({ generateOptions: spy.fn });

  const result = await askTool.execute({ question: '你懂闭包吗？' }, { toolCallId: 'f1' });

  assert.equal(result.status, 'ready');
  assert.equal(result.question, '你懂闭包吗？');
  assert.equal(result.optionsStatus, 'unavailable');
  assert.equal(result.errorCode, 'option_model_failed');
  assert.equal(result.nextAction, 'await_user');
});

test('程序异常 → internal_error，且不回传异常原文', async () => {
  const boom = new Error('boom at https://secret.example/v1 with key sk-xxx');
  const spy = createSpy(boom);
  const askTool = createTool({ generateOptions: spy.fn });

  const result = await askTool.execute({ question: '你懂闭包吗？' }, { toolCallId: 'e1' });

  assert.equal(result.status, 'rejected');
  assert.equal(result.reason, 'internal_error');
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes('secret.example'), false);
  assert.equal(serialized.includes('sk-xxx'), false);
});

test('把剩余时间传给副模型服务（不超过主运行预算）', async () => {
  const spy = createSpy({ status: 'ready', options: READY_OPTIONS });
  const askTool = createTool({ generateOptions: spy.fn, getRemainingMs: () => 12_345 });

  await askTool.execute({ question: '你懂闭包吗？' }, { toolCallId: 't1' });
  assert.equal(spy.calls[0].timeoutMs, 12_345);
});

test('问题 ID 两两不同', async () => {
  const askTool = createTool();
  const ids = [];
  for (let index = 0; index < 30; index += 1) {
    const result = await askTool.execute({ question: `问题 ${index}` }, { toolCallId: `id_${index}` });
    ids.push(result.questionId);
  }
  assert.equal(new Set(ids).size, ids.length);
});

test('validateAskQuestionInput 直接可用（纯函数）', () => {
  assert.deepEqual(validateAskQuestionInput({ question: '  闭包？  ' }), {
    ok: true,
    question: '闭包？',
    context: undefined,
  });
  assert.equal(validateAskQuestionInput(null).ok, false);
  assert.equal(validateAskQuestionInput([]).ok, false);
});

test('工具对象带 description 与 inputSchema（给模型看的形状）', () => {
  const askTool = createTool();
  assert.equal(typeof askTool.description, 'string');
  assert.ok(askTool.description.includes('不要在正文里写问题'));
  assert.equal(typeof askTool.inputSchema, 'object');
});
