/**
 * 学习记录存储判据：
 *   ① 没有记录不是错误；② 同会话替换、不同会话并存；
 *   ③ 整键损坏时拒写，不覆盖用户数据；
 *   ④ 清洗丢弃非法单元与非法节点；⑤ 删除幂等。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LEARNING_STORAGE_KEY,
  LEARNING_STORE_REASONS,
  createLearningJournalStore,
} from '../learningJournalStore.js';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => {
      data.set(key, String(value));
    },
    removeItem: (key) => {
      data.delete(key);
    },
    dump: () => Object.fromEntries(data),
  };
}

function makeRecord(conversationId, units = []) {
  return {
    conversationId,
    schemaVersion: 1,
    units,
    updatedAt: 0,
  };
}

function makeUnit(key, overrides = {}) {
  return {
    key,
    turnId: key.split(':')[0],
    nextTurnId: null,
    runId: 'run-1',
    inputHash: 'hash',
    prevDigest: '',
    stateDigest: 'digest',
    extractorVersion: 'v1',
    status: 'ready',
    goal: '',
    nodes: [{ topic: '变量生命周期', type: 'stuck', points: ['变量随函数消失'], evidence: '' }],
    updatedAt: 1,
    ...overrides,
  };
}

test('load：没有记录返回 null，而不是错误', () => {
  const store = createLearningJournalStore(memoryStorage());
  const result = store.load('conv-1');

  assert.equal(result.ok, true);
  assert.equal(result.record, null);
});

test('save / load：写入后读回结构一致', () => {
  const store = createLearningJournalStore(memoryStorage());
  const saved = store.save(makeRecord('conv-1', [makeUnit('t1:run-1:tail')]));

  assert.equal(saved.ok, true);

  const loaded = store.load('conv-1');
  assert.equal(loaded.ok, true);
  assert.equal(loaded.record.conversationId, 'conv-1');
  assert.equal(loaded.record.units.length, 1);
  assert.deepEqual(loaded.record.units[0].nodes, [
    { topic: '变量生命周期', type: 'stuck', points: ['变量随函数消失'], evidence: '' },
  ]);
});

test('save：同会话替换，其他会话保留', () => {
  const store = createLearningJournalStore(memoryStorage());
  store.save(makeRecord('conv-1', [makeUnit('t1:run-1:t2')]));
  store.save(makeRecord('conv-2', []));
  store.save(makeRecord('conv-1', [makeUnit('t1:run-1:t2'), makeUnit('t2:run-2:tail')]));

  assert.equal(store.load('conv-1').record.units.length, 2);
  assert.equal(store.load('conv-2').ok, true);
});

test('save：整键损坏时拒写，不覆盖原始数据', () => {
  const storage = memoryStorage({ [LEARNING_STORAGE_KEY]: '{ not json' });
  const store = createLearningJournalStore(storage);

  const result = store.save(makeRecord('conv-1', []));
  assert.equal(result.ok, false);
  assert.equal(result.reason, LEARNING_STORE_REASONS.CORRUPT);
  assert.equal(storage.getItem(LEARNING_STORAGE_KEY), '{ not json');
});

test('load：清洗丢弃非法单元与非法节点', () => {
  const storage = memoryStorage({
    [LEARNING_STORAGE_KEY]: JSON.stringify([
      {
        conversationId: 'conv-1',
        schemaVersion: 1,
        units: [
          makeUnit('t1:run-1:tail'),
          { key: '', turnId: 'x' },
          makeUnit('t2:run-2:tail', {
            nodes: [
              { topic: '变量生命周期', type: 'unknown-type', points: ['非法'] },
              { topic: '变量生命周期', type: 'residual', points: [] },
              { topic: '变量生命周期', type: 'residual', points: ['变量何时回收'] },
            ],
          }),
        ],
      },
    ]),
  });

  const loaded = createLearningJournalStore(storage).load('conv-1');

  assert.equal(loaded.ok, true);
  assert.equal(loaded.record.units.length, 2);
  assert.deepEqual(loaded.record.units[1].nodes, [
    { topic: '变量生命周期', type: 'residual', points: ['变量何时回收'], evidence: '' },
  ]);
});

test('remove：删除后读不到，重复删除不报错', () => {
  const store = createLearningJournalStore(memoryStorage());
  store.save(makeRecord('conv-1', []));

  const first = store.remove('conv-1');
  assert.equal(first.ok, true);
  assert.equal(first.removed, true);
  assert.equal(store.load('conv-1').record, null);

  const second = store.remove('conv-1');
  assert.equal(second.ok, true);
  assert.equal(second.removed, false);
});

test('不可用 storage：返回 unavailable，不抛错', () => {
  const store = createLearningJournalStore(null);
  assert.equal(store.load('conv-1').ok, false);
  assert.equal(store.save(makeRecord('conv-1', [])).ok, false);
  assert.equal(store.remove('conv-1').ok, false);
});
