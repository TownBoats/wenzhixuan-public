/**
 * visualize 工具判据（explore/visualize 分支，纪律对齐 askQuestion.test.js）：
 *   ① 正常输入 → ready，title / html 去空白后原样带回；
 *   ② 非对象 / 未知字段 / title 空 / title 超长 / html 空 / html 超长 → rejected('invalid_input')；
 *   ③ 同一 toolCallId 重放 → 返回上次结果（同一个对象引用）；
 *   ④ 边界：恰好 80 字 title、恰好 60000 字符 html → ready；
 *   ⑤ 一轮多个调用各自有结果，互不串台。
 *
 * 全部直接调用工具对象的 execute，不走 SDK、不联网。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HTML_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  createVisualizeTool,
  validateVisualizeInput,
} from '../tools/visualize.js';

const VALID_HTML = '<div class="card"><h2>复利曲线</h2><svg viewBox="0 0 100 40"></svg></div>';

test('正常输入 → ready，字段去空白后带回', async () => {
  const tool = createVisualizeTool();
  const result = await tool.execute(
    { title: '  复利曲线  ', html: `\n${VALID_HTML}\n` },
    { toolCallId: 'call_1' },
  );
  assert.equal(result.status, 'ready');
  assert.equal(result.title, '复利曲线');
  assert.equal(result.html, VALID_HTML);
});

test('非法输入 → rejected(invalid_input)', async () => {
  const tool = createVisualizeTool();
  const cases = [
    [null, '非对象'],
    ['a string', '字符串'],
    [{ title: 't' }, '缺 html'],
    [{ html: VALID_HTML }, '缺 title'],
    [{ title: '   ', html: VALID_HTML }, 'title 全空白'],
    [{ title: 't', html: '  ' }, 'html 全空白'],
    [{ title: 't', html: VALID_HTML, extra: 1 }, '未知字段'],
    [{ title: 't'.repeat(TITLE_MAX_LENGTH + 1), html: VALID_HTML }, 'title 超长'],
    [{ title: 't', html: 'x'.repeat(HTML_MAX_LENGTH + 1) }, 'html 超长'],
  ];
  for (const [input, label] of cases) {
    const result = await tool.execute(input, {});
    assert.equal(result.status, 'rejected', label);
    assert.equal(result.reason, 'invalid_input', label);
    assert.equal(typeof result.message, 'string', label);
  }
});

test('validateVisualizeInput 与 execute 的校验一致', () => {
  assert.equal(validateVisualizeInput({ title: 't', html: VALID_HTML }).ok, true);
  assert.equal(validateVisualizeInput({ title: '', html: VALID_HTML }).ok, false);
});

test('同一 toolCallId 重放 → 返回上次结果（幂等）', async () => {
  const tool = createVisualizeTool();
  const first = await tool.execute(
    { title: '排序演示', html: VALID_HTML },
    { toolCallId: 'call_replay' },
  );
  // 第二次传入非法参数也应直接命中记忆表，不重新校验
  const second = await tool.execute({ bad: true }, { toolCallId: 'call_replay' });
  assert.equal(second, first);
});

test('边界：恰好上限 → ready', async () => {
  const tool = createVisualizeTool();
  const result = await tool.execute(
    { title: '题'.repeat(TITLE_MAX_LENGTH), html: 'x'.repeat(HTML_MAX_LENGTH) },
    {},
  );
  assert.equal(result.status, 'ready');
});

test('一轮多个调用各自有结果', async () => {
  const tool = createVisualizeTool();
  const a = await tool.execute({ title: '图一', html: VALID_HTML }, { toolCallId: 'c1' });
  const b = await tool.execute({ title: '图二', html: VALID_HTML }, { toolCallId: 'c2' });
  assert.equal(a.title, '图一');
  assert.equal(b.title, '图二');
});
