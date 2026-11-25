/**
 * 引用：编号生成、合法性、从消息收集、解析与材料描述。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  collectReferences,
  createFigureId,
  describeRefs,
  isRefHref,
  refFromHref,
  resolveRefs,
  sanitizeRefs,
} from '../references.js';

const result = (toolName, output) => ({ role: 'tool', content: [{ type: 'tool-result', toolCallId: 'x', toolName, output }] });
const say = (text) => ({ role: 'assistant', content: [{ type: 'text', text }] });
const user = (content) => ({ role: 'user', content });
const plan = (currentConceptId) => ({
  status: 'ready',
  plan: { goal: 'g', conventions: [], nextStep: '', currentConceptId, concepts: [{ id: 'a', name: '甲' }, { id: 'b', name: '乙' }] },
});

test('编号格式固定且避开已用的', () => {
  const values = [0, 0, 0.5];
  const id = createFigureId((ref) => ref === 'fig-000000', () => values.shift());
  assert.match(id, /^fig-[a-z0-9]{6}$/);
  assert.notEqual(id, 'fig-000000');
});

test('只认页内引用；脚本、外链与畸形编号不产生引用', () => {
  assert.equal(refFromHref('#ref:fig-k3x9ab'), 'fig-k3x9ab');
  assert.equal(refFromHref('#concept:loop_1'), 'concept:loop_1');
  for (const href of ['#ref:javascript:alert(1)', '#ref:fig-"><x', '#concept:', 'https://a.b/#ref:fig-k3x9ab', 'javascript:alert(1)', undefined]) {
    assert.equal(refFromHref(href), null, String(href));
  }
  assert.equal(isRefHref('#ref:坏的'), true, '失效引用按引用处理，不当外链打开');
  assert.equal(isRefHref('#标题'), false);
});

test('收集：图与概念带所在轮讲解；旧图、被拒绝的图不可引用', () => {
  const targets = collectReferences([
    user('1'), say('讲甲'), result('update_learning_plan', { type: 'json', value: plan('a') }),
    result('visualize', { type: 'json', value: { status: 'ready', refId: 'fig-aaaaaa', title: '图一' } }),
    result('explain_card', { status: 'ready', title: '旧图' }),
    result('explain_card', { status: 'rejected', refId: 'fig-bbbbbb' }),
    user('2'), result('update_learning_plan', plan('b')), say('讲乙'),
    user('3'), say('再讲甲'), result('update_learning_plan', plan('a')), say('补充'),
  ]);
  assert.deepEqual([...targets.keys()].sort(), ['concept:a', 'concept:b', 'fig-aaaaaa']);
  assert.equal(targets.get('fig-aaaaaa').text, '讲甲');
  assert.equal(targets.get('concept:a').text, '再讲甲\n补充');
  assert.equal(collectReferences(null).size, 0);
});

test('解析：兼容前缀、去重、限量、未知单列、latest_figure', () => {
  const known = new Set(['fig-aaaaaa', 'fig-bbbbbb', 'concept:a', 'concept:b']);
  const isKnown = (ref) => known.has(ref);
  assert.deepEqual(resolveRefs(['#ref:fig-aaaaaa', 'fig-aaaaaa', 'latest_figure', 'fig-zzzzzz', 3], isKnown, 'fig-bbbbbb'), {
    refs: ['fig-aaaaaa', 'fig-bbbbbb'],
    unknown: ['fig-zzzzzz', '3'],
  });
  assert.deepEqual(resolveRefs(['latest_figure'], isKnown).unknown, ['latest_figure']);
  assert.equal(resolveRefs([...known], isKnown).refs.length, 3);
  assert.deepEqual(resolveRefs('fig-aaaaaa', isKnown), { refs: [], unknown: [] });
  assert.deepEqual(sanitizeRefs(['fig-aaaaaa', 'fig-aaaaaa', 'bad', null]), ['fig-aaaaaa']);
  assert.deepEqual(sanitizeRefs(undefined), []);
});

test('材料描述：标题加讲解开头，长文截断', () => {
  const targets = new Map([['concept:a', { title: '概念「甲」', text: '讲'.repeat(800) }], ['fig-aaaaaa', { title: '图「一」', text: '' }]]);
  const text = describeRefs(['concept:a', 'fig-aaaaaa', 'gone'], targets);
  assert.match(text, /^概念「甲」，当时的讲解：\n讲{500}……\n图「一」$/);
});
