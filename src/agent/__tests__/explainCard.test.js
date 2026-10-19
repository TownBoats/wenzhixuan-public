/**
 * explain_card 工具判据（explore/visualize 分支 · 讲解卡片）：
 *   ① 正常输入 → ready，svg 去空白带回，viewBox 解析出宽高；
 *   ② 非对象 / 未知字段 / title 空或超长 / svg 空或超长 → rejected('invalid_input')；
 *   ③ svg 非单根 <svg>、缺 viewBox、含 <script> → rejected('invalid_input')；
 *   ④ viewBox 宽高为 0 或非法值 → rejected；
 *   ⑤ 同一 toolCallId 重放 → 返回上次结果（同一引用）；
 *   ⑥ 边界：恰好 80 字 title、恰好 30000 字符 svg → ready。
 *
 * 全部直接调用工具对象的 execute，不走 SDK、不联网。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SVG_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  createExplainCardTool,
  parseViewBox,
  validateExplainCardInput,
} from '../tools/explainCard.js';

const VALID_SVG =
  '<svg role="img" viewBox="0 0 680 320" width="100%">' +
  '<title>三次握手</title><desc>客户端与服务端建立连接的三步</desc>' +
  '<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5"/></marker></defs>' +
  '<rect x="40" y="40" width="105" height="44" rx="8"/></svg>';

test('正常输入 → ready，viewBox 解析出宽高', async () => {
  const tool = createExplainCardTool();
  const result = await tool.execute(
    { title: '  三次握手  ', svg: `\n${VALID_SVG}\n` },
    { toolCallId: 'call_1' },
  );
  assert.equal(result.status, 'ready');
  assert.equal(result.title, '三次握手');
  assert.equal(result.svg, VALID_SVG);
  assert.deepEqual(result.viewBox, { width: 680, height: 320 });
});

test('非法输入 → rejected(invalid_input)', async () => {
  const tool = createExplainCardTool();
  const cases = [
    [null, '非对象'],
    [{ title: 't' }, '缺 svg'],
    [{ svg: VALID_SVG }, '缺 title'],
    [{ title: '  ', svg: VALID_SVG }, 'title 全空白'],
    [{ title: 't', svg: '  ' }, 'svg 全空白'],
    [{ title: 't', svg: VALID_SVG, extra: 1 }, '未知字段'],
    [{ title: 't'.repeat(TITLE_MAX_LENGTH + 1), svg: VALID_SVG }, 'title 超长'],
    [{ title: 't', svg: 'x'.repeat(SVG_MAX_LENGTH + 1) }, 'svg 超长'],
  ];
  for (const [input, label] of cases) {
    const result = await tool.execute(input, {});
    assert.equal(result.status, 'rejected', label);
    assert.equal(result.reason, 'invalid_input', label);
  }
});

test('形状约束：非单根 / 缺 viewBox / 含 script → rejected', async () => {
  const tool = createExplainCardTool();
  const cases = [
    ['<div>不是 svg</div>', '非 svg 根'],
    [`${VALID_SVG}<svg viewBox="0 0 680 10"></svg>`, '两个根元素'],
    ['<svg width="100%"><rect x="0" y="0"/></svg>', '缺 viewBox'],
    ['<svg viewBox="0 0 0 320"></svg>', 'viewBox 宽为 0'],
    ['<svg viewBox="0 0 680 abc"></svg>', 'viewBox 高非法'],
    ['<svg viewBox="0 0 680 320"><script>alert(1)</script></svg>', '含 script'],
  ];
  for (const [svg, label] of cases) {
    const result = await tool.execute({ title: 't', svg }, {});
    assert.equal(result.status, 'rejected', label);
    assert.equal(result.reason, 'invalid_input', label);
  }
});

test('parseViewBox 支持逗号分隔与整数解析', () => {
  assert.deepEqual(parseViewBox('<svg viewBox="0 0 680 480"></svg>'), { width: 680, height: 480 });
  assert.deepEqual(parseViewBox('<svg viewBox="0,0,680,240"></svg>'), { width: 680, height: 240 });
  assert.equal(parseViewBox('<svg></svg>'), null);
  assert.equal(parseViewBox('<svg viewBox="0 0 -5 100"></svg>'), null);
});

test('validateExplainCardInput 与 execute 的校验一致', () => {
  const ok = validateExplainCardInput({ title: 't', svg: VALID_SVG });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.viewBox, { width: 680, height: 320 });
  assert.equal(validateExplainCardInput({ title: 't', svg: 'nope' }).ok, false);
});

test('同一 toolCallId 重放 → 返回上次结果（幂等）', async () => {
  const tool = createExplainCardTool();
  const first = await tool.execute({ title: '图', svg: VALID_SVG }, { toolCallId: 'c_replay' });
  const second = await tool.execute({ bad: true }, { toolCallId: 'c_replay' });
  assert.equal(second, first);
});

test('边界：恰好上限 → ready', async () => {
  const tool = createExplainCardTool();
  // 在闭合标签前填充文本节点，凑到恰好 SVG_MAX_LENGTH
  const exact =
    VALID_SVG.slice(0, -'</svg>'.length).padEnd(SVG_MAX_LENGTH - '</svg>'.length, 'x') + '</svg>';
  assert.equal(exact.length, SVG_MAX_LENGTH);
  const result = await tool.execute({ title: '题'.repeat(TITLE_MAX_LENGTH), svg: exact }, {});
  assert.equal(result.status, 'ready');
});
