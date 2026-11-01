/**
 * ADR-001 纯函数层判据：
 *   ① 只有 completed / awaiting_user 的轮构成单元；尾轮需显式要求；
 *   ② 证据池只收手答与自由输入，点选候选与答案汇总不算；
 *   ③ 无证据、证据不是原话子串、bullet 超长的节点被丢弃；
 *   ④ 相邻同类型节点折叠合并，bullet 去重；
 *   ⑤ 输入变化、前序状态变化、提取器改版、上次失败都触发重提取；
 *   ⑥ 同键整单元替换，尾键转闭合键时旧记录被清掉。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyUnitFailure,
  applyUnitResult,
  buildEvidencePool,
  buildExtractionInput,
  computeUnitInputHash,
  deriveUnits,
  describeAnswer,
  digestState,
  foldNodes,
  nextPendingUnit,
  validateNodes,
} from '../learningJournal.js';

/** 造一轮最小可用的 turn。 */
function makeTurn({
  id,
  status = 'completed',
  runId = `run-${id}`,
  userMessage = { text: `问题 ${id}`, source: 'input' },
  questions = [],
  parts = [],
} = {}) {
  return { id, runId, status, userMessage, questions, parts };
}

function makeQuestion({
  id = 'q1',
  text = '闭包会保留变量吗',
  answer = null,
  selectedLevel = null,
  state = 'answered',
} = {}) {
  return { id, toolCallId: `call-${id}`, text, answer, selectedLevel, state };
}

function textPart(text, runId) {
  return { type: 'text', partId: `p-${text}`, runId, text };
}

test('deriveUnits：只取合格轮，尾轮默认不参与', () => {
  const turns = [
    makeTurn({ id: 't1' }),
    makeTurn({ id: 't2', status: 'awaiting_user' }),
    makeTurn({ id: 't3', status: 'failed' }),
  ];

  // t2 后面已经有 t3，即使 t3 失败，t2 也已经闭合
  assert.deepEqual(
    deriveUnits(turns).map((unit) => unit.turnId),
    ['t1', 't2'],
  );

  // t3 不合格，因此不存在尾单元；includeTail 不改变结果
  assert.deepEqual(
    deriveUnits(turns, { includeTail: true }).map((unit) => unit.turnId),
    ['t1', 't2'],
  );
});

test('deriveUnits：合格尾轮只在 includeTail 时出现', () => {
  const turns = [makeTurn({ id: 't1' }), makeTurn({ id: 't2', status: 'awaiting_user' })];

  assert.deepEqual(
    deriveUnits(turns).map((unit) => unit.turnId),
    ['t1'],
  );
  assert.deepEqual(
    deriveUnits(turns, { includeTail: true }).map((unit) => unit.turnId),
    ['t1', 't2'],
  );
});

test('deriveUnits：单元键包含后继 id，尾单元用 tail', () => {
  const turns = [makeTurn({ id: 't1', runId: 'r1' }), makeTurn({ id: 't2' })];
  const [unit] = deriveUnits(turns);
  assert.equal(unit.key, 't1:r1:t2');

  const tail = deriveUnits([makeTurn({ id: 't9', runId: 'r9' })], { includeTail: true });
  assert.equal(tail[0].key, 't9:r9:tail');
});

test('describeAnswer：手答、点选、跳过必须分开', () => {
  assert.equal(describeAnswer(makeQuestion({ answer: '我自己写的' })).kind, 'written');
  assert.equal(
    describeAnswer(makeQuestion({ answer: '模型写的候选', selectedLevel: 'basic' })).kind,
    'option',
  );
  assert.equal(describeAnswer(makeQuestion({ answer: null, state: 'skipped' })).kind, 'skipped');
});

test('buildEvidencePool：点选候选与答案汇总不进证据池', () => {
  const turns = [
    makeTurn({
      id: 't1',
      questions: [
        makeQuestion({ id: 'q1', answer: '我以为函数结束变量就没了' }),
        makeQuestion({ id: 'q2', answer: '模型生成的候选', selectedLevel: 'familiar' }),
      ],
    }),
    makeTurn({
      id: 't2',
      userMessage: { text: '因为第一次已经把 count 改成 1 了', source: 'input' },
    }),
  ];

  const pool = buildEvidencePool({ unit: deriveUnits(turns)[0], turns });
  assert.deepEqual(pool, ['我以为函数结束变量就没了', '因为第一次已经把 count 改成 1 了']);
});

test('buildEvidencePool：答案汇总轮整段不当作学生原话', () => {
  const turns = [
    makeTurn({ id: 't1' }),
    makeTurn({ id: 't2', userMessage: { text: '问题：…\n我的回答：…', source: 'answer' } }),
  ];

  assert.deepEqual(buildEvidencePool({ unit: deriveUnits(turns)[0], turns }), []);
});

test('buildExtractionInput：只取最新运行的正文，卡片只取标题', () => {
  const turn = makeTurn({
    id: 't1',
    runId: 'run-new',
    parts: [
      textPart('旧运行的正文', 'run-old'),
      textPart('新运行的正文', 'run-new'),
      {
        type: 'tool',
        toolName: 'visualize',
        status: 'completed',
        output: { title: '作用域示意', html: '<svg>大段载荷</svg>' },
      },
    ],
  });

  const input = buildExtractionInput({ unit: deriveUnits([turn, makeTurn({ id: 't2' })])[0], turns: [turn] });

  assert.ok(input.includes('新运行的正文'));
  assert.ok(!input.includes('旧运行的正文'));
  assert.ok(input.includes('作用域示意'));
  assert.ok(!input.includes('大段载荷'));
});

test('validateNodes：无证据或证据不是原话的节点被丢弃', () => {
  const result = validateNodes(
    {
      nodes: [
        { topic: '词法作用域', type: 'breakthrough', points: ['看定义位置'], evidence: '应该看定义的位置' },
        { topic: '闭包的变量', type: 'misconception', points: ['以为存快照'], evidence: '模型编的原话' },
        { topic: '变量生命周期', type: 'stuck', points: ['不知变量去向'], evidence: '' },
      ],
    },
    { evidencePool: ['应该看定义的位置，不是谁调用它'] },
  );

  assert.equal(result.nodes.length, 1);
  assert.equal(result.nodes[0].type, 'breakthrough');
  assert.equal(result.nodes[0].topic, '词法作用域');
  assert.equal(result.dropped, 2);
});

test('validateNodes：缺少主题的节点被丢弃', () => {
  const result = validateNodes(
    {
      nodes: [
        { topic: '变量生命周期', type: 'residual', points: ['变量何时回收'] },
        { topic: '', type: 'residual', points: ['没有主题'] },
        { topic: '这一条主题明显超过了十二个字的限制用来测试丢弃逻辑', type: 'residual', points: ['太长'] },
      ],
    },
    { evidencePool: [] },
  );

  assert.equal(result.nodes.length, 1);
  assert.equal(result.dropped, 2);
});

test('validateNodes：residual 不需要证据，但要点必须存在', () => {
  const result = validateNodes(
    {
      nodes: [
        { topic: '变量生命周期', type: 'residual', points: ['变量何时回收'] },
        { topic: '变量生命周期', type: 'residual', points: [] },
      ],
    },
    { evidencePool: [] },
  );

  assert.equal(result.nodes.length, 1);
  assert.equal(result.dropped, 1);
});

test('validateNodes：超长 bullet 被丢弃，不截断', () => {
  const long = '这一条明显超过了十六个字符的限制用来测试丢弃逻辑';
  const result = validateNodes(
    { nodes: [{ topic: '变量生命周期', type: 'residual', points: [long, '正常要点'] }] },
    { evidencePool: [] },
  );

  assert.deepEqual(result.nodes[0].points, ['正常要点']);
});

test('validateNodes：首单元缺目标时回落到学生输入', () => {
  const result = validateNodes(
    { nodes: [] },
    { isFirstUnit: true, fallbackGoal: '弄懂闭包为什么能记住变量' },
  );

  assert.equal(result.goal, '弄懂闭包为什么能记住变量');
});

test('foldNodes：相邻同主题同状态合并，bullet 去重且有上限', () => {
  const folded = foldNodes([
    [{ topic: '词法作用域', type: 'breakthrough', points: ['看定义位置'] }],
    [{ topic: '词法作用域', type: 'breakthrough', points: ['看定义位置', '不看调用位置'] }],
    [{ topic: '变量生命周期', type: 'residual', points: ['变量何时回收'] }],
  ]);

  assert.equal(folded.length, 2);
  assert.deepEqual(folded[0].points, ['看定义位置', '不看调用位置']);
});

test('foldNodes：同主题不同状态不合并，保留演进', () => {
  const folded = foldNodes([
    [{ topic: '派生与继承', type: 'stuck', points: ['分不清是否同一关系'] }],
    [{ topic: '派生与继承', type: 'breakthrough', points: ['继承是 is-a'] }],
  ]);

  assert.equal(folded.length, 2);
  assert.deepEqual(
    folded.map((node) => node.type),
    ['stuck', 'breakthrough'],
  );
});

test('computeUnitInputHash：正文变化会改变指纹', () => {
  const base = [makeTurn({ id: 't1' }), makeTurn({ id: 't2' })];
  const unit = deriveUnits(base)[0];
  const before = computeUnitInputHash({ unit, turns: base });

  const changed = [
    makeTurn({ id: 't1', parts: [textPart('新的讲解', 'run-t1')] }),
    makeTurn({ id: 't2' }),
  ];
  const after = computeUnitInputHash({ unit: deriveUnits(changed)[0], turns: changed });

  assert.notEqual(before, after);
});

test('nextPendingUnit：串行推进，失败单元会被重试', () => {
  const turns = [
    makeTurn({ id: 't1' }),
    makeTurn({ id: 't2' }),
    makeTurn({ id: 't3' }),
  ];
  const first = nextPendingUnit({ turns, record: null });

  assert.equal(first.unit.turnId, 't1');
  assert.equal(first.isFirstUnit, true);

  const unitOne = applyUnitResult(
    { units: [] },
    {
      unit: first.unit,
      goal: '弄懂闭包',
      nodes: [{ topic: '变量生命周期', type: 'stuck', points: ['变量消失'], evidence: '' }],
      inputHash: first.inputHash,
      prevDigest: first.prevDigest,
      stateDigest: digestState({ goal: '弄懂闭包', nodes: [{ topic: '变量生命周期', type: 'stuck', points: ['变量消失'] }] }),
      extractorVersion: 'v1',
    },
  );

  const second = nextPendingUnit({ turns, record: { units: unitOne } });
  assert.equal(second.unit.turnId, 't2');
  assert.equal(second.isFirstUnit, false);

  const failed = applyUnitFailure(
    { units: unitOne },
    {
      unit: second.unit,
      inputHash: second.inputHash,
      prevDigest: second.prevDigest,
      extractorVersion: 'v1',
      reason: 'timeout',
    },
  );

  const retry = nextPendingUnit({ turns, record: { units: failed } });
  assert.equal(retry.unit.turnId, 't2');
});

test('nextPendingUnit：前序结果变化会让后续单元过期', () => {
  const turns = [makeTurn({ id: 't1' }), makeTurn({ id: 't2' }), makeTurn({ id: 't3' })];
  const first = nextPendingUnit({ turns, record: null });
  let units = applyUnitResult(
    { units: [] },
    {
      unit: first.unit,
      goal: '旧目标',
      nodes: [{ topic: '旧主题', type: 'stuck', points: ['旧要点'], evidence: '' }],
      inputHash: first.inputHash,
      prevDigest: first.prevDigest,
      stateDigest: digestState({ goal: '旧目标', nodes: [{ topic: '旧主题', type: 'stuck', points: ['旧要点'] }] }),
      extractorVersion: 'v1',
    },
  );

  const second = nextPendingUnit({ turns, record: { units } });
  units = applyUnitResult(
    { units },
    {
      unit: second.unit,
      goal: '',
      nodes: [{ topic: '词法作用域', type: 'breakthrough', points: ['转折'], evidence: '' }],
      inputHash: second.inputHash,
      prevDigest: second.prevDigest,
      stateDigest: digestState({
        goal: '旧目标',
        nodes: foldNodes([[{ topic: '旧主题', type: 'stuck', points: ['旧要点'] }], [{ topic: '词法作用域', type: 'breakthrough', points: ['转折'] }]]),
      }),
      extractorVersion: 'v1',
    },
  );

  assert.equal(nextPendingUnit({ turns, record: { units } }), null);

  // 重算第一单元并改写结果：第二单元的 prevDigest 立刻不匹配
  const rewritten = units.map((unit) =>
    unit.key === first.unit.key
      ? {
          ...unit,
          stateDigest: digestState({ goal: '新目标', nodes: [{ topic: '新主题', type: 'stuck', points: ['新要点'] }] }),
        }
      : unit,
  );

  assert.equal(nextPendingUnit({ turns, record: { units: rewritten } }).unit.turnId, 't2');
});

test('applyUnitResult：尾单元转闭合时清掉旧尾键', () => {
  const tailUnit = { key: 't1:r1:tail', turnId: 't1', nextTurnId: null, runId: 'r1' };
  const closedUnit = { key: 't1:r1:t2', turnId: 't1', nextTurnId: 't2', runId: 'r1' };

  const withTail = applyUnitResult(
    { units: [] },
    {
      unit: tailUnit,
      goal: '',
      nodes: [],
      inputHash: 'a',
      prevDigest: '',
      stateDigest: 'x',
      extractorVersion: 'v1',
    },
  );

  const closed = applyUnitResult(
    { units: withTail },
    {
      unit: closedUnit,
      goal: '',
      nodes: [],
      inputHash: 'b',
      prevDigest: '',
      stateDigest: 'y',
      extractorVersion: 'v1',
    },
  );

  assert.equal(closed.length, 1);
  assert.equal(closed[0].key, 't1:r1:t2');
});
