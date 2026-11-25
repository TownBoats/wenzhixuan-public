/**
 * 候选答案材料：取材范围、来源、优先级与预算。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OPTION_CONTEXT_MAX_CHARS,
  OPTION_CONTEXT_MAX_TURNS,
  buildOptionContext,
} from '../services/buildOptionContext.js';

const user = (content) => ({ role: 'user', content });
const assistant = (...content) => ({ role: 'assistant', content });
const text = (value) => ({ type: 'text', text: value });
const length = (value) => [...value].length;
const HISTORY = [user('教我闭包'), assistant(text('先讲作用域')), user('我的回答是：懂了')];

test('主模型写了 context：带本轮正文与学生本轮输入，不带历史', () => {
  assert.deepEqual(
    buildOptionContext({ messages: HISTORY, currentText: '现在讲闭包', modelContext: '学生已知作用域' }),
    {
      source: 'model',
      text:
        '【学生本轮的输入】\n我的回答是：懂了\n\n' +
        '【老师刚才的讲解】\n现在讲闭包\n\n【老师的补充说明】\n学生已知作用域',
    },
  );
});

test('主模型声明无依赖：不带补充说明，也不触发兜底', () => {
  for (const modelContext of ['无', ' 无。', 'None', 'n/a', '没有']) {
    const result = buildOptionContext({ messages: HISTORY, currentText: '现在讲闭包', modelContext });
    assert.equal(result.source, 'none');
    assert.doesNotMatch(result.text, /补充说明|之前的对话/);
    assert.match(result.text, /现在讲闭包/);
  }
  assert.equal(buildOptionContext({ modelContext: '无序数组' }).source, 'model');
});

test('主模型漏写：用最近几轮兜底，学生本轮输入不重复', () => {
  const result = buildOptionContext({ messages: HISTORY, currentText: '现在讲闭包' });
  assert.equal(result.source, 'fallback');
  assert.equal(
    result.text,
    '【之前的对话】\n学生：教我闭包\n老师：先讲作用域\n\n' +
      '【学生本轮的输入】\n我的回答是：懂了\n\n【老师刚才的讲解】\n现在讲闭包',
  );
});

test('兜底窗口：窗口内的结论可见，更早的不放', () => {
  const messages = [];
  for (let i = 1; i <= OPTION_CONTEXT_MAX_TURNS + 2; i += 1) {
    messages.push(user(`输入${i}`), assistant(text(`结论${i}`)));
  }
  messages.push(user('本轮'));
  const result = buildOptionContext({ messages }).text;
  assert.match(result, /输入4\n老师：结论4/);
  assert.doesNotMatch(result, /输入3/);
});

test('图只留标题；源码、工具结果、候选项、reasoning 与零宽字符不进入', () => {
  const result = buildOptionContext({
    messages: [
      user(`开始${String.fromCharCode(0x200b)}`),
      assistant(
        { type: 'reasoning', text: '秘密思考' },
        text('看图'),
        { type: 'tool-call', toolCallId: 'a', toolName: 'explain_card', input: { title: '作用域图', svg: '<svg>源码</svg>' } },
        { type: 'tool-call', toolCallId: 'b', toolName: 'visualize', input: { title: '演示', html: '<div>源码</div>' } },
        { type: 'tool-call', toolCallId: 'c', toolName: 'ask_question', input: { question: '题', context: '内部' } },
      ),
      { role: 'tool', content: [{ type: 'tool-result', toolCallId: 'c', output: { options: [{ text: '候选项' }] } }] },
      { role: 'system', content: '系统指令' },
      user('本轮'),
    ],
  }).text;
  assert.match(result, /（图：作用域图）/);
  assert.match(result, /（图：演示）/);
  assert.doesNotMatch(result, /源码|秘密思考|候选项|内部|系统指令/);
  assert.equal(result.includes(String.fromCharCode(0x200b)), false);
});

test('超预算时先丢低优先级，补充说明优先保留', () => {
  const { text: result } = buildOptionContext({
    messages: [user('旧'.repeat(5000)), assistant(text('史'.repeat(5000))), user('输'.repeat(5000))],
    currentText: `${'文'.repeat(9000)}结尾`,
    modelContext: '关键前提',
  });
  assert.ok(length(result) <= OPTION_CONTEXT_MAX_CHARS, `实际 ${length(result)}`);
  assert.match(result, /关键前提/);
  assert.match(result, /结尾/);
  assert.doesNotMatch(result, /旧|史|输{50}/);
});

test('任意预算都不超限，兜底历史优先保留最近的内容', () => {
  const messages = [user('很早'.repeat(100)), assistant(text('较早'.repeat(30))), user('本轮输入')];
  for (const modelContext of ['说明', undefined]) {
    for (let maxChars = 0; maxChars <= 900; maxChars += 7) {
      const result = buildOptionContext({ messages, currentText: '讲解'.repeat(40), modelContext, maxChars });
      assert.ok(length(result.text) <= maxChars, `预算 ${maxChars} 实际 ${length(result.text)}`);
    }
  }
  const result = buildOptionContext({ messages, maxChars: 120 }).text;
  assert.match(result, /较早/);
  assert.doesNotMatch(result, /很早/);
});

test('题目引用的内容：缺省不出现，任意预算不超限', () => {
  assert.match(buildOptionContext({ references: '图「一」' }).text, /^【题目引用的内容】\n图「一」$/);
  assert.doesNotMatch(buildOptionContext({ messages: HISTORY }).text, /题目引用/);
  for (let maxChars = 0; maxChars <= 300; maxChars += 7) {
    const { text: result } = buildOptionContext({ references: '引'.repeat(200), currentText: '讲'.repeat(200), maxChars });
    assert.ok(length(result) <= maxChars);
  }
});

test('没有材料或输入异常时 text 为空串', () => {
  assert.equal(buildOptionContext().text, '');
  assert.equal(buildOptionContext({ messages: null, currentText: 1, modelContext: ' ' }).text, '');
  assert.equal(buildOptionContext({ messages: [null, {}, user('')] }).text, '');
});

test('全程约定每题附上，不受主模型是否填写影响', () => {
  for (const modelContext of ['说明', '无', undefined]) {
    const { text: result } = buildOptionContext({ messages: HISTORY, modelContext, conventions: ['下标从 1 开始', ' '] });
    assert.match(result, /【全程约定】\n- 下标从 1 开始/);
  }
  assert.doesNotMatch(buildOptionContext({ messages: HISTORY, conventions: [] }).text, /全程约定/);
  for (let maxChars = 0; maxChars <= 400; maxChars += 7) {
    const { text: result } = buildOptionContext({ messages: HISTORY, modelContext: '说明'.repeat(30), conventions: ['约'.repeat(80)], maxChars });
    assert.ok(length(result) <= maxChars);
  }
});
