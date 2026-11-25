import test from 'node:test';
import assert from 'node:assert/strict';
import { formatConversationText, plainText } from '../conversationText.js';

test('Markdown becomes readable text while preserving code, formulas, entities and meaningful operators', () => {
  const source = '# 概念\n\n**闭包**保留 _环境_。参见[文档](https://example.test/private)。\n\n- 第一项\n- 第二项\n\n> 引用内容\n\n```js\nconst x = a < b && b > 0;\n```\n\n公式：x * y = 6，a_b，E = mc^2，价格 $5。\n\n| 名称 | 数值 |\n| --- | --- |\n| 数量 | 2 |';
  const text = plainText(source);
  for (const expected of ['概念', '闭包保留 环境', '文档', '第一项', '第二项', '引用内容',
    'const x = a < b && b > 0;', 'x * y = 6', 'a_b', 'E = mc^2', '价格 $5', '名称', '数量']) assert.ok(text.includes(expected), expected);
  for (const removed of ['# ', '**', '```', 'https://example.test', '| ---', '> 引用']) assert.equal(text.includes(removed), false, removed);
});

test('TXT contains the dialogue and actual answers once, excluding protocol, tools, candidates and grading', () => {
  const record = { id: 'secret-id', title: '**闭包学习**', apiKey: 'secret-key', turns: [
    { userMessage: { source: 'input', text: '什么是闭包？' },
      parts: [{ type: 'reasoning', text: 'private reasoning' }, { type: 'text', text: '闭包保留**词法环境**。' },
        { type: 'tool', toolCallId: 'hidden-call-id', output: { svg: '<svg>hidden diagram</svg>' } }],
      questions: [{ text: '记住了什么？', state: 'answered', answer: '外层变量', selectedLevel: 'expert', options: [{ text: 'unselected candidate' }] }] },
    { userMessage: { source: 'answer', text: '针对问题「记住了什么？」，我的回答是：外层变量\n（来自选项：expert）' },
      parts: [{ type: 'text', text: '回答正确。' }], questions: [] },
  ] };
  const before = JSON.stringify(record);
  const text = formatConversationText(record);
  assert.equal(text, '闭包学习\n\n我：\n什么是闭包？\n\n问知轩：\n闭包保留词法环境。\n\n问知轩：\n记住了什么？\n\n我：\n外层变量\n\n问知轩：\n回答正确。\n');
  for (const value of ['secret', '<svg', 'expert', 'candidate', 'private reasoning', '来自选项']) assert.equal(text.includes(value), false, value);
  assert.equal(JSON.stringify(record), before);
});

test('fragmented text, pending questions, skipped questions and failed partial responses remain readable', () => {
  const text = formatConversationText({ title: '学习', turns: [{
    userMessage: { text: '继续' }, status: 'failed', error: 'private diagnostic',
    modelMessages: [{ role: 'assistant', content: 'protocol-only secret' }],
    parts: [{ type: 'text', partId: 'p1', runId: 'r1', text: '闭' }, { type: 'text', partId: 'p1', runId: 'r1', text: '包' }],
    questions: [{ text: '还没回答？', state: 'pending', options: [{ text: 'candidate' }] }, { text: '跳过的问题？', state: 'skipped' }],
  }] });
  assert.ok(text.includes('问知轩：\n闭包'));
  assert.ok(text.includes('问知轩：\n还没回答？'));
  assert.ok(text.includes('我：\n跳过'));
  assert.equal(/diagnostic|protocol-only|candidate/.test(text), false);
});

test('diagram source is retained while hidden thinking is omitted', () => {
  for (const source of ['<svg><text>diagram internals</text></svg>', '```svg\n<svg>diagram</svg>\n```',
    '```mermaid\ngraph TD; A-->B\n```']) assert.ok(plainText(source).includes(source.startsWith('<') ? source : source.split('\n')[1]));
  for (const source of ['<think>private reasoning</think>', '<think>unfinished reasoning',
    '〖thinking〗private reasoning〖/thinking〗']) assert.equal(plainText(source), '');
  const text = formatConversationText({ turns: [{ userMessage: { text: '开始' }, parts: [{ type: 'text', text: '<svg>diagram</svg>' }] }] });
  assert.ok(text.includes('问知轩：\n<svg>diagram</svg>'));
});

test('legacy UI transcript keeps chosen answers and questions without model-summary duplicates or options', () => {
  const text = formatConversationText({ id: 'old', title: '旧对话',
    messages: [{ role: 'user', content: 'hidden generated answer summary' }], uiMessages: [
      { role: 'user', content: [{ type: 'response', value: '闭包是什么？' }] },
      { role: 'assistant', content: [{ type: 'thinking', value: 'hidden thinking' },
        { type: 'response', value: '**闭包**能记住环境。' },
        { type: 'question', value: [{ question: '记住什么？', options: [{ text: 'hidden candidate' }] }] },
        { type: 'visualize', value: '<svg>legacy diagram source</svg>' }] },
      { role: 'user', content: [{ type: 'answer-card', value: { question: '记住什么？', answer: '环境', level: 'expert' } }] },
    ] });
  assert.equal(text.match(/记住什么？/g).length, 1);
  assert.ok(text.includes('我：\n环境'));
  assert.ok(text.includes('<svg>legacy diagram source</svg>'));
  assert.equal(/hidden|expert|\*\*/.test(text), false);
});

test('ready SVG/HTML sources appear in dialogue order verbatim without tool inputs, previews or diagnostics', () => {
  const svg = '<svg viewBox="0 0 20 20">\n  <text>**literal**</text>\n\n\n</svg>';
  const html = '<div id="demo"></div>\n<script>const value = "```";\n  const msg = "<think>literal</think>";</script>';
  const record = { title: '图示', turns: [{ userMessage: { text: '解释图示' }, parts: [
    { type: 'text', text: '图示前的讲解。' },
    { type: 'tool', toolName: 'explain_card', status: 'completed', toolCallId: 'secret-id',
      input: { secret: 'hidden input' }, output: { status: 'ready', title: '静态图', svg } },
    { type: 'text', text: '图示后的讲解。' },
    { type: 'tool', toolName: 'visualize', status: 'completed', output: { status: 'ready', title: '交互图', html } },
    { type: 'tool', toolName: 'visualize', status: 'running', partialInput: { html: 'hidden preview' } },
    { type: 'tool', toolName: 'visualize', status: 'failed', output: { html: 'hidden failed code' } },
    { type: 'tool', toolName: 'unknown_tool', status: 'completed', output: { html: 'hidden unknown output' } },
  ] }] };
  const before = JSON.stringify(record);
  const text = formatConversationText(record);
  assert.ok(text.includes(svg));
  assert.ok(text.includes(html));
  assert.ok(text.indexOf('图示前的讲解') < text.indexOf(svg));
  assert.ok(text.indexOf(svg) < text.indexOf('图示后的讲解'));
  assert.ok(text.indexOf('图示后的讲解') < text.indexOf(html));
  assert.equal(/secret-id|hidden/.test(text), false);
  assert.equal(JSON.stringify(record), before);
});

test('legacy message-only exports remove old protocol tags and allow translated role labels', () => {
  const text = formatConversationText({ messages: [
    { role: 'system', content: 'hidden system config' }, { role: 'user', content: 'Explain closure' },
    { role: 'assistant', content: '〖thinking〗hidden thought〖/thinking〗〖response〗A **function** and its environment.〖/response〗' },
    { role: 'tool', content: 'hidden tool output' },
  ] }, { user: 'Me', assistant: 'Tutor', untitled: 'Conversation' });
  assert.equal(text, 'Conversation\n\nMe：\nExplain closure\n\nTutor：\nA function and its environment.\n');
});

test('answers with missing question records retain their text without internal option levels', () => {
  const text = formatConversationText({ turns: [{ userMessage: { source: 'answer', text: '我的回答：环境\n（来自选项：expert）' } }] });
  assert.ok(text.includes('我的回答：环境'));
  assert.equal(/expert|来自选项/.test(text), false);
});

test('重试后作废的旧题保留题干，不写成学生跳过', () => {
  const question = { id: 'q', text: '旧问题', state: 'skipped', resolution: 'superseded' };
  const text = formatConversationText({ turns: [{ parts: [], questions: [question] }] });
  assert.match(text, /旧问题/);
  assert.doesNotMatch(text, /跳过/);
});

test('请求讲解、暂缓与普通跳过在文本中可区分', () => {
  const build = (resolution) =>
    formatConversationText({ turns: [{ parts: [], questions: [{ id: 'q', text: '题', state: 'skipped', resolution }] }] });
  assert.match(build('explain'), /请直接讲解/);
  assert.match(build('deferred'), /暂未作答/);
  assert.match(build(undefined), /跳过/);
});
