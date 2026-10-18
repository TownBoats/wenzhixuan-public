/**
 * 存储层单测（阶段 E · 任务 E4）
 *
 * 全部是纯函数用例：假 storage（内存 Map），不联网、不渲染、不碰真实 localStorage。
 * 断言对应 `决策记录.md` E-1 与 `E-开发指导.md` E4 的六项判据。
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  SCHEMA_VERSION,
  STORAGE_KEY_V1,
  STORAGE_KEY_V2,
  STORE_REASONS,
  TITLE_MAX_LENGTH,
  createHistoryStore,
  deriveTitle,
  sanitizeConversation,
} from '../historyStore.js';

const GATE = '\u200B';

function quotaError({ name = 'QuotaExceededError', code } = {}) {
  const error = new Error('The quota has been exceeded.');
  error.name = name;
  if (code !== undefined) error.code = code;
  return error;
}

/** 内存 storage；`failWith` 让 setItem 抛指定异常。 */
function fakeStorage(initial = {}, { failWith = null } = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem(key, value) {
      if (failWith) throw failWith;
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

function makeTurn(overrides = {}) {
  return {
    id: 't1',
    runId: 'r1',
    modeSnapshot: 'socratic',
    status: 'completed',
    userMessage: { text: '什么是闭包？', source: 'input' },
    modelMessages: [],
    parts: [{ type: 'text', partId: 'p1', runId: 'r1', text: '回答正文' }],
    questions: [],
    error: null,
    ...overrides,
  };
}

function makeRecord(overrides = {}) {
  return {
    id: 'c1',
    title: '',
    timestamp: 1700000000000,
    schemaVersion: SCHEMA_VERSION,
    mode: 'socratic',
    turns: [makeTurn()],
    ...overrides,
  };
}

describe('createHistoryStore · 不可用与空键', () => {
  it('storage 缺失或缺少方法 → 六个函数都回 unavailable，不抛', () => {
    for (const storage of [null, undefined, {}, { getItem: () => null }]) {
      const store = createHistoryStore(storage);
      assert.equal(store.loadAll().reason, STORE_REASONS.UNAVAILABLE);
      assert.equal(store.loadById('c1').reason, STORE_REASONS.UNAVAILABLE);
      assert.equal(store.listForSidebar().reason, STORE_REASONS.UNAVAILABLE);
      assert.equal(store.saveConversation(makeRecord()).reason, STORE_REASONS.UNAVAILABLE);
      assert.equal(store.deleteConversation('c1').reason, STORE_REASONS.UNAVAILABLE);
      assert.equal(store.renameConversation('c1', 'x').reason, STORE_REASONS.UNAVAILABLE);
    }
  });

  it('两个键都不存在 → ok:true、空数组、corrupt 全 0', () => {
    const store = createHistoryStore(fakeStorage());
    const result = store.loadAll();
    assert.equal(result.ok, true);
    assert.deepEqual(result.v2, []);
    assert.deepEqual(result.v1, []);
    assert.deepEqual(result.corrupt, { v2: 0, v1: 0 });
    assert.deepEqual(store.listForSidebar().items, []);
  });
});

describe('createHistoryStore · 损坏数据', () => {
  it('新键整键非法 JSON → 计数 1、不抛；保存拒写且原文不动', () => {
    const broken = '[{"id":';
    const storage = fakeStorage({ [STORAGE_KEY_V2]: broken });
    const store = createHistoryStore(storage);

    const all = store.loadAll();
    assert.equal(all.ok, true);
    assert.equal(all.corrupt.v2, 1);
    assert.deepEqual(all.v2, []);

    const saved = store.saveConversation(makeRecord({ id: 'new' }));
    assert.equal(saved.ok, false);
    assert.equal(saved.reason, STORE_REASONS.CORRUPT);
    assert.equal(storage.getItem(STORAGE_KEY_V2), broken);
  });

  it('新键不是数组（JSON 对象）→ 同样按整键损坏处理', () => {
    const storage = fakeStorage({ [STORAGE_KEY_V2]: '{"a":1}' });
    const store = createHistoryStore(storage);
    assert.equal(store.loadAll().corrupt.v2, 1);
    assert.equal(store.saveConversation(makeRecord()).reason, STORE_REASONS.CORRUPT);
  });

  it('条目级损坏被跳过并计数，可读条目仍返回', () => {
    const storage = fakeStorage({
      [STORAGE_KEY_V2]: JSON.stringify([1, { noId: true }, { id: 'a', turns: [] }]),
    });
    const result = createHistoryStore(storage).loadAll();
    assert.equal(result.corrupt.v2, 2);
    assert.equal(result.v2.length, 1);
    assert.equal(result.v2[0].id, 'a');
  });

  it('存在坏条目时保存仍成功，坏条目原样保留', () => {
    const storage = fakeStorage({
      [STORAGE_KEY_V2]: JSON.stringify([1, { id: 'a', turns: [] }]),
    });
    const store = createHistoryStore(storage);

    assert.equal(store.saveConversation(makeRecord({ id: 'b' })).ok, true);
    const entries = JSON.parse(storage.getItem(STORAGE_KEY_V2));
    assert.equal(entries.length, 3);
    assert.equal(entries[1], 1);
    assert.equal(entries[2].id, 'a');
    assert.equal(entries[0].id, 'b');
  });
});

describe('createHistoryStore · 写入失败', () => {
  it('配额满（QuotaExceededError）→ reason:quota 且没有写入', () => {
    const storage = fakeStorage({}, { failWith: quotaError() });
    const store = createHistoryStore(storage);
    const saved = store.saveConversation(makeRecord());
    assert.equal(saved.ok, false);
    assert.equal(saved.reason, STORE_REASONS.QUOTA);
    assert.equal(storage.getItem(STORAGE_KEY_V2), null);
  });

  it('只有 code:22 的错误也认作配额', () => {
    const storage = fakeStorage({}, { failWith: quotaError({ name: 'Error', code: 22 }) });
    assert.equal(
      createHistoryStore(storage).saveConversation(makeRecord()).reason,
      STORE_REASONS.QUOTA,
    );
  });

  it('非配额写失败 → unavailable（不假装是配额）', () => {
    const error = new Error('denied');
    error.name = 'SecurityError';
    const storage = fakeStorage({}, { failWith: error });
    assert.equal(
      createHistoryStore(storage).saveConversation(makeRecord()).reason,
      STORE_REASONS.UNAVAILABLE,
    );
  });
});

describe('createHistoryStore · 保存与读取', () => {
  it('保存 → 读取往返：版本号、模式、标题、时间都落地', () => {
    const storage = fakeStorage();
    const store = createHistoryStore(storage);

    const saved = store.saveConversation(makeRecord({ id: 'c1', title: '' }));
    assert.equal(saved.ok, true);
    assert.equal(saved.id, 'c1');
    assert.equal(saved.title, '什么是闭包？');

    const loaded = store.loadById('c1');
    assert.equal(loaded.ok, true);
    assert.equal(loaded.source, 'v2');
    assert.equal(loaded.record.schemaVersion, SCHEMA_VERSION);
    assert.equal(loaded.record.mode, 'socratic');
    assert.equal(loaded.record.title, '什么是闭包？');
    assert.equal(loaded.record.timestamp, 1700000000000);
    assert.equal(loaded.record.turns.length, 1);
    assert.equal(loaded.record.turns[0].parts[0].text, '回答正文');
  });

  it('没有 id / 非对象 → invalid', () => {
    const store = createHistoryStore(fakeStorage());
    assert.equal(store.saveConversation({ turns: [] }).reason, STORE_REASONS.INVALID);
    assert.equal(store.saveConversation(null).reason, STORE_REASONS.INVALID);
  });

  it('标题按首条用户消息截 20 字（按码点，不切半个 emoji）', () => {
    const long = '😀'.repeat(30);
    assert.equal(Array.from(deriveTitle({ turns: [makeTurn({ userMessage: { text: long } })] })).length, TITLE_MAX_LENGTH);
    assert.equal(deriveTitle({ turns: [] }), '');
    assert.equal(deriveTitle(null), '');
  });

  it('同一 ID 保存两次 → 仍然一条，内容为最新，且在数组首位', () => {
    const storage = fakeStorage();
    const store = createHistoryStore(storage);

    store.saveConversation(makeRecord({ id: 'c1' }));
    store.saveConversation(
      makeRecord({ id: 'c1', turns: [makeTurn({ userMessage: { text: '第二问' } })] }),
    );

    const entries = JSON.parse(storage.getItem(STORAGE_KEY_V2));
    assert.equal(entries.length, 1);
    assert.equal(entries[0].turns[0].userMessage.text, '第二问');
    assert.equal(store.loadById('c1').record.turns[0].userMessage.text, '第二问');
  });

  it('同一 ID 同时存在于两键 → 读取取新键、侧栏只一条', () => {
    const storage = fakeStorage({
      [STORAGE_KEY_V1]: JSON.stringify([
        { id: 'same', title: '旧标题', timestamp: 1000, messages: [], uiMessages: [] },
      ]),
      [STORAGE_KEY_V2]: JSON.stringify([
        {
          id: 'same',
          title: '新标题',
          timestamp: 2000,
          schemaVersion: 2,
          mode: 'socratic',
          turns: [makeTurn()],
        },
      ]),
    });
    const store = createHistoryStore(storage);

    const loaded = store.loadById('same');
    assert.equal(loaded.source, 'v2');
    assert.equal(loaded.record.title, '新标题');

    const items = store.listForSidebar().items;
    assert.equal(items.length, 1);
    assert.equal(items[0].source, 'v2');
    assert.equal(items[0].title, '新标题');
  });

  it('旧键条目原样返回（保留 messages / uiMessages，供 E2 投影）', () => {
    const legacy = {
      id: 'old1',
      title: '旧会话',
      timestamp: 900,
      messages: [{ role: 'user', content: '旧问题' }],
      uiMessages: [{ role: 'assistant', content: [{ type: 'response', value: '旧回答' }] }],
    };
    const storage = fakeStorage({ [STORAGE_KEY_V1]: JSON.stringify([legacy]) });
    const loaded = createHistoryStore(storage).loadById('old1');

    assert.equal(loaded.source, 'v1');
    assert.deepEqual(loaded.record.messages, legacy.messages);
    assert.deepEqual(loaded.record.uiMessages, legacy.uiMessages);
  });

  it('保存只写新键，旧键字符串逐字节不变', () => {
    const v1Raw = JSON.stringify([
      { id: 'old1', title: '旧会话', timestamp: 1, messages: [], uiMessages: [] },
    ]);
    const storage = fakeStorage({ [STORAGE_KEY_V1]: v1Raw });
    const store = createHistoryStore(storage);

    store.saveConversation(makeRecord({ id: 'old1' }));
    assert.equal(storage.getItem(STORAGE_KEY_V1), v1Raw);
  });

  it('侧栏按时间倒序，时间相同按 id 稳定，缺失时间按 0', () => {
    const storage = fakeStorage({
      [STORAGE_KEY_V2]: JSON.stringify([
        { id: 'b', timestamp: 100, turns: [] },
        { id: 'a', timestamp: 100, turns: [] },
        { id: 'c', timestamp: 300, turns: [] },
        { id: 'd', turns: [] },
      ]),
    });
    const items = createHistoryStore(storage).listForSidebar().items;
    assert.deepEqual(
      items.map((item) => item.id),
      ['c', 'a', 'b', 'd'],
    );
    assert.equal(items[3].timestamp, 0);
  });
});

describe('createHistoryStore · 删除与重命名', () => {
  it('删除同时作用于两个键，其余条目保留', () => {
    const storage = fakeStorage({
      [STORAGE_KEY_V2]: JSON.stringify([
        { id: 'd1', timestamp: 2, turns: [] },
        { id: 'd2', timestamp: 1, turns: [] },
      ]),
      [STORAGE_KEY_V1]: JSON.stringify([{ id: 'd1', timestamp: 1, messages: [] }]),
    });
    const store = createHistoryStore(storage);

    const removed = store.deleteConversation('d1');
    assert.equal(removed.ok, true);
    assert.deepEqual(removed.removed, { v2: true, v1: true });
    assert.equal(storage.getItem(STORAGE_KEY_V2).includes('d1'), false);
    assert.equal(storage.getItem(STORAGE_KEY_V1).includes('d1'), false);
    assert.equal(storage.getItem(STORAGE_KEY_V2).includes('d2'), true);
  });

  it('删除不存在 → not_found；非法 id → invalid', () => {
    const store = createHistoryStore(fakeStorage());
    assert.equal(store.deleteConversation('nope').reason, STORE_REASONS.NOT_FOUND);
    assert.equal(store.deleteConversation('').reason, STORE_REASONS.INVALID);
  });

  it('任一键损坏 → 拒绝删除，两键都不动（不做半删）', () => {
    const broken = '[{"id":';
    const v1Raw = JSON.stringify([{ id: 'd1', messages: [] }]);
    const storage = fakeStorage({ [STORAGE_KEY_V2]: broken, [STORAGE_KEY_V1]: v1Raw });

    const result = createHistoryStore(storage).deleteConversation('d1');
    assert.equal(result.reason, STORE_REASONS.CORRUPT);
    assert.equal(storage.getItem(STORAGE_KEY_V2), broken);
    assert.equal(storage.getItem(STORAGE_KEY_V1), v1Raw);
  });

  it('重命名新键：折叠空白；空标题回退自动标题', () => {
    const store = createHistoryStore(fakeStorage());
    store.saveConversation(makeRecord({ id: 'c1' }));

    const renamed = store.renameConversation('c1', '  自定义   标题 ');
    assert.equal(renamed.ok, true);
    assert.equal(renamed.title, '自定义 标题');
    assert.equal(renamed.source, 'v2');

    const reset = store.renameConversation('c1', '');
    assert.equal(reset.title, '什么是闭包？');
  });

  it('重命名旧键：只改 title，messages / uiMessages 原样保留', () => {
    const legacy = {
      id: 'old1',
      title: '原名',
      timestamp: 5,
      messages: [{ role: 'user', content: '旧会话第一问' }],
      uiMessages: [{ role: 'assistant', content: [{ type: 'response', value: '保留' }] }],
    };
    const storage = fakeStorage({ [STORAGE_KEY_V1]: JSON.stringify([legacy]) });
    const store = createHistoryStore(storage);

    const renamed = store.renameConversation('old1', '');
    assert.equal(renamed.ok, true);
    assert.equal(renamed.title, '旧会话第一问');
    assert.equal(renamed.source, 'v1');

    const stored = JSON.parse(storage.getItem(STORAGE_KEY_V1))[0];
    assert.equal(stored.title, '旧会话第一问');
    assert.deepEqual(stored.messages, legacy.messages);
    assert.deepEqual(stored.uiMessages, legacy.uiMessages);
  });

  it('重命名不存在 → not_found', () => {
    const store = createHistoryStore(fakeStorage());
    assert.equal(store.renameConversation('nope', 'x').reason, STORE_REASONS.NOT_FOUND);
  });
});

describe('createHistoryStore · 脏字段白名单', () => {
  it('函数 / AbortController / 未知键 / reasoning / U+200B 都进不去', () => {
    const controller = new AbortController();
    const storage = fakeStorage();
    const store = createHistoryStore(storage);

    const dirty = {
      id: 'c1',
      title: `  标题${GATE}  `,
      mode: 'socratic',
      apiKey: 'sk-should-not-be-stored',
      extra: { a: 1 },
      turns: [
        {
          id: 't1',
          status: 'bogus',
          strayField: '不该入库',
          userMessage: { text: `问题${GATE}`, source: 'answer', questionId: 'q1', hidden: 1 },
          modelMessages: [
            {
              role: 'assistant',
              content: [
                { type: 'text', text: `正文${GATE}` },
                { type: 'reasoning', text: '这是推理原文' },
                {
                  type: 'tool-call',
                  toolCallId: 'call_1',
                  toolName: 'ask_question',
                  input: { question: 'q', ctrl: controller, fn: () => 1 },
                },
              ],
            },
          ],
          parts: [
            { type: 'reasoning', text: '这是推理原文' },
            { type: 'text', text: `正文${GATE}` },
            {
              type: 'tool',
              toolCallId: 'call_1',
              toolName: 'ask_question',
              input: { question: 'q' },
              output: { status: 'ready' },
              runId: 'r1',
            },
            { type: 'unknown', text: '未知片段' },
          ],
          questions: [
            {
              toolCallId: 'call_1',
              id: 'q1',
              text: `问题${GATE}`,
              options: [{ level: 'basic', text: '基本了解' }, { text: '没有档位' }],
              optionsStatus: 'ready',
              answer: `答${GATE}`,
              selectedLevel: 'basic',
              state: 'answered',
              secret: 1,
            },
            { id: 'q2', text: '第二问', options: [] },
          ],
          error: null,
        },
      ],
    };

    assert.equal(store.saveConversation(dirty).ok, true);
    const raw = storage.getItem(STORAGE_KEY_V2);
    const stored = JSON.parse(raw);
    const record = stored[0];
    const turn = record.turns[0];

    assert.equal(record.title, '标题');
    assert.equal('apiKey' in record, false);
    assert.equal('extra' in record, false);
    assert.equal(record.schemaVersion, 2);

    assert.equal(turn.status, 'interrupted');
    assert.equal('strayField' in turn, false);
    assert.equal(turn.userMessage.text, '问题');
    assert.equal(turn.userMessage.source, 'answer');
    assert.equal(turn.userMessage.questionId, 'q1');
    assert.equal('hidden' in turn.userMessage, false);

    assert.equal(turn.parts.length, 2);
    assert.deepEqual(turn.parts.map((part) => part.type), ['text', 'tool']);
    assert.equal(turn.parts[1].status, 'completed');

    assert.equal(turn.modelMessages[0].content.length, 2);
    assert.deepEqual(turn.modelMessages[0].content.map((part) => part.type), ['text', 'tool-call']);
    assert.deepEqual(turn.modelMessages[0].content[1].input.ctrl, {});

    assert.equal(turn.questions.length, 2);
    assert.equal(turn.questions[0].options.length, 1);
    assert.equal(turn.questions[0].state, 'answered');
    assert.equal(turn.questions[0].answer, '答');
    assert.equal('secret' in turn.questions[0], false);
    assert.equal(turn.questions[1].state, 'pending');
    assert.equal(turn.questions[1].optionsStatus, 'unavailable');

    assert.equal(raw.includes(GATE), false);
    assert.equal(raw.includes('推理原文'), false);
    assert.equal(raw.includes('sk-should-not-be-stored'), false);
    assert.equal(/=>/.test(raw), false);
  });

  it('缺 id 的 turn 保留内容；缺 status 视为 interrupted', () => {
    const record = sanitizeConversation({
      id: 'c1',
      turns: [{ userMessage: { text: '只有正文' }, parts: [{ type: 'text', text: '正文' }] }],
    });
    assert.equal(record.turns.length, 1);
    assert.equal(record.turns[0].id, '');
    assert.equal(record.turns[0].status, 'interrupted');
    assert.equal(record.turns[0].parts[0].text, '正文');
  });
});

describe('createHistoryStore · 失败类别（F3，协议 §5）', () => {
  it('errorKind 只落地 timeout / failed，其余归 null，写入后可原样读回', () => {
    const store = createHistoryStore(fakeStorage());

    const saved = store.saveConversation(
      makeRecord({
        turns: [makeTurn({ status: 'failed', error: '运行已中断', errorKind: 'timeout' })],
      }),
    );
    assert.equal(saved.ok, true);
    assert.equal(store.loadById('c1').record.turns[0].errorKind, 'timeout');

    store.saveConversation(
      makeRecord({ turns: [makeTurn({ status: 'failed', error: 'x', errorKind: 'unknown_kind' })] }),
    );
    assert.equal(store.loadById('c1').record.turns[0].errorKind, null);
  });
});
