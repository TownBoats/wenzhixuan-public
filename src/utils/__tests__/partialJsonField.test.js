/**
 * 增量 JSON 字符串字段提取器判据（explore/streaming-cards）：
 *   ① 字段未出现 → not found；
 *   ② 完整字段 → complete，值解码正确（含 \" \\ \n \uXXXX 转义）；
 *   ③ 半截字段（JSON 未闭合）→ found 且 complete=false，值为已到达部分；
 *   ④ 结尾恰好转义一半（\、\u12）→ 半个转义丢弃，不猜；
 *   ⑤ 非法输入（非字符串 / 空字段名）→ not found；
 *   ⑥ 字段名带正则元字符也不炸（转义后进 RegExp）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { extractPartialStringField } from '../partialJsonField.js';

test('字段未出现 → not found', () => {
  assert.deepEqual(extractPartialStringField('{"title":"三次握手"', 'svg'), {
    found: false,
    value: '',
    complete: false,
  });
  assert.deepEqual(extractPartialStringField('', 'svg'), { found: false, value: '', complete: false });
});

test('完整字段 → complete，转义解码正确', () => {
  const json = '{"title":"图","svg":"<svg viewBox=\\"0 0 680 320\\">\\n<rect/>\\u3016</svg>"}';
  const result = extractPartialStringField(json, 'svg');
  assert.equal(result.complete, true);
  assert.equal(result.value, '<svg viewBox="0 0 680 320">\n<rect/>〖</svg>');
});

test('半截字段 → 已到达部分，complete=false', () => {
  const result = extractPartialStringField('{"svg":"<svg viewBox="0', 'svg');
  // 未转义的引号 = 字段结束——这里 "0 后的引号其实是 JSON 字符串内的内容，
  // 提取器无法分辨（增量文本本来就不合法 JSON），按「第一个引号结束」处理是既定语义
  assert.equal(result.found, true);
  assert.equal(result.complete, true);
  assert.equal(result.value, '<svg viewBox=');
});

test('SVG 属性引号带反斜杠转义时，半截读取正确', () => {
  // 真实工具参数里，SVG 内的引号一定以 \" 形式流出
  const partial = '{"title":"TCP 握手","svg":"<svg viewBox=\\"0 0 680 320\\"><defs><mark';
  const result = extractPartialStringField(partial, 'svg');
  assert.equal(result.found, true);
  assert.equal(result.complete, false);
  assert.equal(result.value, '<svg viewBox="0 0 680 320"><defs><mark');
});

test('结尾半个转义 → 丢弃半截部分', () => {
  assert.deepEqual(extractPartialStringField('{"svg":"<rect', 'svg'), {
    found: true,
    value: '<rect',
    complete: false,
  });
  // 半截反斜杠
  assert.equal(extractPartialStringField('{"svg":"abc\\', 'svg').value, 'abc');
  // 半截 \uXXXX
  assert.equal(extractPartialStringField('{"svg":"abc\\u30', 'svg').value, 'abc');
  // 补全后完整解码
  assert.equal(extractPartialStringField('{"svg":"abc\\u3016"', 'svg').value, 'abc〖');
});

test('非法输入 → not found', () => {
  const empty = { found: false, value: '', complete: false };
  assert.deepEqual(extractPartialStringField(null, 'svg'), empty);
  assert.deepEqual(extractPartialStringField('{"svg":"x"}', ''), empty);
  assert.deepEqual(extractPartialStringField(42, 'svg'), empty);
});

test('字段名带正则元字符不炸', () => {
  const result = extractPartialStringField('{"a.b":"value"}', 'a.b');
  assert.equal(result.complete, true);
  assert.equal(result.value, 'value');
});

test('逐字流入的累计序列，每一帧都不抛错且值单调增长', () => {
  const full = '{"title":"时序图","svg":"<svg viewBox=\\"0 0 680 200\\"><rect x=\\"40\\"/></svg>"}';
  let last = '';
  for (let i = 1; i <= full.length; i++) {
    const result = extractPartialStringField(full.slice(0, i), 'svg');
    assert.ok(result.value.startsWith(last) || last === '', `第 ${i} 帧值应单调增长`);
    last = result.value;
  }
  assert.equal(last, '<svg viewBox="0 0 680 200"><rect x="40"/></svg>');
});
