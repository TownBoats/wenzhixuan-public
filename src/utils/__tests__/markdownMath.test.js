/**
 * Markdown 公式：用与界面相同的插件渲染成静态 HTML 后断言，不经过 DOM。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';

import { MATH_REHYPE_PLUGINS, MATH_REMARK_PLUGINS, escapeCurrency } from '../markdownMath.js';

const render = (content) =>
  renderToStaticMarkup(
    createElement(
      Markdown,
      { remarkPlugins: MATH_REMARK_PLUGINS, rehypePlugins: MATH_REHYPE_PLUGINS },
      escapeCurrency(content),
    ),
  );
const formulas = (html) =>
  [...html.matchAll(/<annotation encoding="application\/x-tex">(.*?)<\/annotation>/gs)].map((m) => m[1]);

test('行内公式与块公式渲染', () => {
  assert.deepEqual(formulas(render('复杂度 $2\\log_2(n+1)$ 次')), ['2\\log_2(n+1)']);
  assert.match(render('$$\n\\frac{a}{b}\n$$'), /katex-display/);
  assert.deepEqual(formulas(render('$x_1$、$2x$、$2$、$5\\text{米}$、$ x $')), ['x_1', '2x', '2', '5\\text{米}', 'x']);
  assert.deepEqual(formulas(render('- 第一项 $2^n$\n- 第二项 $3n+1$')), ['2^n', '3n+1']);
  assert.deepEqual(formulas(render('| 式 |\n| --- |\n| $2n$ |')), ['2n']);
});

test('货币写法保持原文', () => {
  for (const text of ['苹果 $5，梨 $10', '苹果$5，梨$10', 'costs $5 and $10', '$5-$10', '只要 $5', '$1,200.50 到 $3,000']) {
    const html = render(text);
    assert.deepEqual(formulas(html), [], text);
    assert.equal(html, `<p>${text}</p>`);
  }
});

test('货币与公式混排互不影响', () => {
  assert.deepEqual(formulas(render('单价 $5，公式 $x^2$')), ['x^2']);
  assert.deepEqual(formulas(render('单价$5，公式$x^2$')), ['x^2']);
  assert.deepEqual(formulas(render('公式 $x^2$，单价 $5，再看 $2n$')), ['x^2', '2n']);
});

test('代码与已转义内容不变', () => {
  for (const text of [
    '```sh\necho $5，$10\n```',
    '~~~\n$5 and $10\n~~~',
    '`$5，$10`',
    '``a ` $5，$10``',
    '    $5 and $10',
    '$$\n5，$6\n$$',
    '\\$5，\\$10',
    '- ```js\n  const a = `$5，$10`;\n  ```',
  ]) {
    assert.equal(escapeCurrency(text), text);
  }
});

test('流式未闭合与错误公式不抛错、不丢其余内容', () => {
  const full = '前文 $2\\log_2(n+1)$ 与 $$\n\\frac{a}{b}\n$$\n后文 $5，$10';
  for (let i = 0; i <= full.length; i += 1) assert.doesNotThrow(() => render(full.slice(0, i)));
  const html = render('前 $\\frac{a$ 后');
  assert.match(html, /前/);
  assert.match(html, /后/);
  assert.match(html, /frac/);
});

test('HTML 与危险链接不执行', () => {
  assert.doesNotMatch(render('<img src=x onerror=alert(1)> $x$'), /<img/);
  assert.doesNotMatch(render('$\\href{javascript:alert(1)}{x}$'), /href="javascript/);
});

test('非字符串与无 $ 内容原样返回', () => {
  assert.equal(escapeCurrency(undefined), undefined);
  assert.equal(escapeCurrency('普通文本'), '普通文本');
});
