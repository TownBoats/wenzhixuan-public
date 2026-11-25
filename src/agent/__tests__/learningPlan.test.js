/**
 * 学习计划：增量合并、非法输入、证据校验、从消息读取，以及工具的幂等与降级通知。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PLAN_LIMITS,
  isSelfRating,
  isValidEvidence,
  mergePlan,
  normalizePlan,
  planFromMessages,
} from '../learningPlan.js';
import { createUpdateLearningPlanTool } from '../tools/updateLearningPlan.js';

const BASE = mergePlan(
  null,
  {
    goal: '学会二分',
    conventions: ['下标从 1 开始'],
    concepts: [
      { id: 'sorted', name: '有序数组' },
      { id: 'shrink', name: '区间收缩', requires: ['sorted'] },
    ],
    currentConceptId: 'sorted',
    nextStep: '摸底',
  },
  [],
).plan;
const SAID = '中间的数比目标小，目标就只能在右边，因为数组是有序的';
const byId = (plan, id) => plan.concepts.find((item) => item.id === id);

test('首次建立；增量合并保留未提及的内容', () => {
  assert.equal(byId(BASE, 'sorted').status, 'unknown');
  const { plan } = mergePlan(BASE, { concepts: [{ id: 'sorted', status: 'gap' }] }, []);
  assert.equal(byId(plan, 'sorted').status, 'gap');
  assert.equal(byId(plan, 'sorted').name, '有序数组');
  assert.deepEqual(byId(plan, 'shrink').requires, ['sorted']);
  assert.deepEqual([plan.goal, plan.conventions, plan.currentConceptId, plan.nextStep], ['学会二分', ['下标从 1 开始'], 'sorted', '摸底']);
  assert.equal(byId(BASE, 'sorted').status, 'unknown', '不得改动原计划');
});

test('约定整体替换；移除概念时清理前置与当前位置', () => {
  assert.deepEqual(mergePlan(BASE, { conventions: ['左闭右开'] }, []).plan.conventions, ['左闭右开']);
  assert.deepEqual(mergePlan(BASE, { conventions: [] }, []).plan.conventions, []);
  const { plan } = mergePlan(BASE, { goal: '新目标', removedConceptIds: ['sorted'] }, []);
  assert.deepEqual(plan.concepts.map((item) => [item.id, item.requires]), [['shrink', []]]);
  assert.equal(plan.currentConceptId, '');
});

test('非法输入被拒绝并给出原因', () => {
  const many = Array.from({ length: PLAN_LIMITS.concepts + 1 }, (_, i) => ({ id: `c${i}`, name: `概念${i}` }));
  for (const [input, pattern] of [
    [null, /对象/],
    [{ foo: 1 }, /不支持的字段：foo/],
    [{ goal: '' }, /goal/],
    [{ goal: 'x'.repeat(PLAN_LIMITS.goal + 1) }, /goal/],
    [{ conventions: 'x' }, /conventions/],
    [{ conventions: ['x'.repeat(PLAN_LIMITS.convention + 1)] }, /约定/],
    [{ concepts: {} }, /数组/],
    [{ concepts: [{ id: 'a b', name: 'x' }] }, /id/],
    [{ concepts: [{ id: 'n', name: '' }] }, /概念名/],
    [{ concepts: [{ id: 'new' }] }, /缺少 name/],
    [{ concepts: [{ id: 'sorted', status: 'mastered' }] }, /未知状态/],
    [{ concepts: [{ id: 'sorted', score: 1 }] }, /不支持的字段/],
    [{ concepts: [{ id: 'sorted' }, { id: 'sorted' }] }, /重复/],
    [{ concepts: [{ id: 'sorted', requires: ['nope'] }] }, /不存在：nope/],
    [{ concepts: [{ id: 'sorted', requires: ['shrink'] }] }, /循环/],
    [{ concepts: [{ id: 'sorted', requires: ['sorted'] }] }, /循环/],
    [{ currentConceptId: 'nope' }, /currentConceptId/],
    [{ concepts: many }, /至多/],
  ]) {
    const result = mergePlan(BASE, input, []);
    assert.equal(result.ok, false, JSON.stringify(input)?.slice(0, 60));
    assert.match(result.message, pattern);
  }
  assert.match(mergePlan(null, { concepts: [] }, []).message, /首次/);
});

test('verified 须有学生原话：伪造、过短、缺失都降为 claimed', () => {
  const update = (evidence) =>
    mergePlan(BASE, { concepts: [{ id: 'sorted', status: 'verified', ...(evidence ? { evidence } : {}) }] }, [SAID]);
  const good = update('目标就只能在右边, 因为数组是有序的');
  assert.equal(byId(good.plan, 'sorted').status, 'verified');
  assert.deepEqual(good.downgraded, []);
  for (const evidence of ['我明白了单调性的作用', '在右边', undefined]) {
    const result = update(evidence);
    assert.equal(byId(result.plan, 'sorted').status, 'claimed');
    assert.equal('evidence' in byId(result.plan, 'sorted'), false);
    assert.deepEqual(result.downgraded.map((item) => item.id), ['sorted']);
    assert.ok(result.downgraded[0].reason);
  }
});

test('已有合格证据的概念不会因后续坏证据降级，但可被明确改回', () => {
  const verified = mergePlan(BASE, { concepts: [{ id: 'sorted', status: 'verified', evidence: SAID }] }, [SAID]).plan;
  const kept = mergePlan(verified, { concepts: [{ id: 'sorted', status: 'verified', evidence: '编造的一句话' }] }, [SAID]);
  assert.equal(byId(kept.plan, 'sorted').evidence, SAID);
  assert.deepEqual(kept.downgraded, []);
  const gap = mergePlan(verified, { concepts: [{ id: 'sorted', status: 'gap' }] }, [SAID]).plan;
  assert.equal(byId(gap, 'sorted').status, 'gap');
  assert.equal('evidence' in byId(gap, 'sorted'), false);
});

test('同一句话只能验证一个概念，互相包含也算；不同的话可以', () => {
  const said = [SAID, '每次都去掉一半，所以区间会变短'];
  const verify = (plan, ...items) => mergePlan(plan, { concepts: items.map(([id, evidence]) => ({ id, status: 'verified', evidence })) }, said);
  const same = verify(BASE, ['sorted', SAID], ['shrink', '目标就只能在右边']);
  assert.equal(byId(same.plan, 'sorted').status, 'verified');
  assert.equal(byId(same.plan, 'shrink').status, 'claimed');
  assert.match(same.downgraded[0].reason, /另一个概念/);
  const later = verify(same.plan, ['shrink', SAID]);
  assert.equal(byId(later.plan, 'shrink').status, 'claimed');
  assert.equal(byId(verify(same.plan, ['shrink', said[1]]).plan, 'shrink').status, 'verified');
  assert.equal(byId(verify(same.plan, ['sorted', SAID]).plan, 'sorted').status, 'verified');
});

test('纯自评即使是原话也不算证据；有内容的话不误伤', () => {
  for (const text of ['我觉得我全懂了', '我已经完全明白了，谢谢老师', '懂了懂了，继续吧', '这个概念我掌握了', 'OK, I got it']) {
    assert.equal(isSelfRating(text), true, text);
    assert.equal(isValidEvidence(text, [text]), false, text);
  }
  for (const text of [SAID, '只看阳性的人里真正患病的占多少', '我知道区间长度等于右端减左端', '因为每次都去掉一半']) {
    assert.equal(isValidEvidence(text, [text]), true, text);
  }
  for (const text of ['因为基数大', '假阳性更多']) assert.equal(isValidEvidence(text, [text]), true, text);
  for (const text of ['在右边', '我不太懂', '我会了呀']) assert.equal(isValidEvidence(text, [text]), false, text);
  assert.equal(isValidEvidence('当 a>b 时取左边', ['当 a<b 时取左边']), false);
});

test('从消息读取最近一份合格计划，兼容 SDK 包装，忽略被拒绝与其他工具', () => {
  const result = (toolName, output) => ({ role: 'tool', content: [{ type: 'tool-result', toolCallId: 'x', toolName, output }] });
  const messages = [
    result('update_learning_plan', { type: 'json', value: { status: 'ready', plan: { ...BASE, goal: '旧' } } }),
    result('update_learning_plan', { type: 'json', value: { status: 'ready', plan: BASE } }),
    result('update_learning_plan', { type: 'json', value: { status: 'rejected', message: 'x' } }),
    result('visualize', { status: 'ready', plan: { ...BASE, goal: '伪装' } }),
    { role: 'user', content: '文本' },
  ];
  assert.deepEqual(planFromMessages(messages), BASE);
  assert.equal(planFromMessages([]), null);
  assert.equal(planFromMessages(null), null);
});

test('工具：降级说明原因，同一轮可更正一次，再次不合格时不再提示重试', async () => {
  const create = () => createUpdateLearningPlanTool({ initialPlan: BASE, studentTexts: [SAID] });
  const verify = (tool, evidence, toolCallId) =>
    tool.execute({ concepts: [{ id: 'sorted', status: 'verified', evidence }] }, { toolCallId });
  const tool = create();
  const bad = await verify(tool, '目标只能在右边，数组有序', 'a');
  assert.match(bad.notice, /连续原文.*再更新一次/);
  const fixed = await verify(tool, SAID, 'b');
  assert.equal(byId(fixed.plan, 'sorted').status, 'verified');
  assert.equal('notice' in fixed, false);
  const other = create();
  await verify(other, '编造的一句话', 'a');
  assert.match((await verify(other, '又编造了一句', 'b')).notice, /不要再重试/);
});

test('损坏的快照被整理，不抛错', () => {
  assert.equal(normalizePlan({ goal: ' ' }), null);
  assert.deepEqual(
    normalizePlan({
      goal: 'g',
      conventions: 'x',
      currentConceptId: 'gone',
      concepts: [null, { id: 'a', name: '甲', status: 'verified', requires: ['gone'] }, { id: 'a', name: '重复' }, { id: '坏 id', name: 'x' }],
    }),
    { goal: 'g', conventions: [], currentConceptId: '', nextStep: '', concepts: [{ id: 'a', name: '甲', status: 'claimed', requires: [] }] },
  );
});

test('工具：幂等、拒绝不改计划、降级有通知、不要求等待', async () => {
  const seen = [];
  const tool = createUpdateLearningPlanTool({ initialPlan: BASE, studentTexts: [SAID], onPlan: (plan) => seen.push(plan) });
  const first = await tool.execute({ concepts: [{ id: 'sorted', status: 'verified', evidence: '假的证据假的' }] }, { toolCallId: 'a' });
  assert.match(first.notice, /sorted/);
  assert.equal('nextAction' in first, false);
  assert.equal(await tool.execute({ goal: '别的' }, { toolCallId: 'a' }), first);
  const rejected = await tool.execute({ currentConceptId: 'nope' }, { toolCallId: 'b' });
  assert.deepEqual([rejected.status, rejected.reason], ['rejected', 'invalid_input']);
  const next = await tool.execute({ nextStep: '继续' }, { toolCallId: 'c' });
  assert.equal(next.plan.goal, '学会二分');
  assert.equal(byId(next.plan, 'sorted').status, 'claimed');
  assert.equal(seen.length, 2);
});
