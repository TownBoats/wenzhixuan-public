import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { createDataBackup, createConversationBackup, parseDataBackup, planDataImport, importDataBackup,
  BACKUP_FORMAT, BACKUP_VERSION, MAX_BACKUP_BYTES } from '../dataBackup.js';
import { createHistoryStore, sanitizeConversation } from '../historyStore.js';
import { projectV1Record } from '../historyV1.js';
import { buildModelContext, createInitialState, reduceSession } from '../conversationState.js';
import useConversationHistory from '../../pages/AgentChatPage/useConversationHistory.js';

const { act, create } = ReactTestRenderer;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
function memory(initial = {}) {
  const map = new Map(Object.entries(initial));
  return { map, getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, String(value)), removeItem: (key) => map.delete(key) };
}
const pack = (data, fields = {}) => JSON.stringify({ format: BACKUP_FORMAT,
  version: BACKUP_VERSION, includesCredentials: true, data, ...fields });
const record = (id = 'c1', timestamp = 10) => sanitizeConversation({ id, timestamp,
  title: '我的自定义标题', mode: 'socratic', turns: [{ id: 't1', runId: 'r1',
    modeSnapshot: 'socratic', status: 'awaiting_user', userMessage: { text: '解释闭包' },
    parts: [{ type: 'text', text: '中文和 emoji 🌱' },
      { type: 'tool', toolCallId: 'v1', toolName: 'visualize', status: 'completed',
        output: { html: '<html><body>可视化</body></html>' } },
      { type: 'tool', toolCallId: 'e1', toolName: 'explain_card', status: 'completed',
        output: { svg: '<svg viewBox="0 0 100 100"></svg>' } }],
    modelMessages: [{ role: 'assistant', content: [{ type: 'text', text: '讲解' }] }],
    questions: [{ id: 'q1', toolCallId: 'ask1', text: '什么是闭包？', state: 'pending',
      options: [{ level: 'basic', text: '保留词法环境的函数' }] }],
    contextUsage: { inputTokens: 120, outputTokens: 80 }, usageModel: 'test-model' }] });
const legacy = { id: 'old', timestamp: 1, title: '旧会话',
  messages: [{ role: 'user', content: '旧问题' }, { role: 'assistant', content: '旧回答' }],
  uiMessages: [{ role: 'assistant', content: [{ type: 'response', value: '旧回答' }] }] };

test('full backup round trip preserves both schemas, tool content, answers, configs and preferences', () => {
  const current = record();
  current.turns[0].questions.push({ ...current.turns[0].questions[0], id: 'q2', state: 'answered', answer: '已作答' });
  const source = memory({ chat_histories_v2: JSON.stringify([current]), chat_histories: JSON.stringify([legacy]),
    mainAgentConfig: JSON.stringify({ apiKey: 'fake-key', baseURL: 'https://example.test', model: 'test-model', contextWindow: 12345 }),
    optionAgentConfig: JSON.stringify({ apiKey: 'fake-option-key', model: 'test-model' }),
    optionAgentPrompt: '自定义候选提示词', mainAgentPrompt: '旧主提示词', enableWaitTime: 'false', waitTime: '8',
    answerCardSize: JSON.stringify({ width: 500, height: 600 }), developerMode: 'true',
    learning_journals_v1: JSON.stringify([{ conversationId: 'old', units: [], updatedAt: 1 }]),
    unrelated: 'must stay private' });
  const exported = createDataBackup(source, { now: new Date('2026-11-14T00:00:00Z') });
  assert.equal(exported.ok, true);
  assert.equal(exported.backup.data.unrelated, undefined);
  const destination = memory({ unrelated: 'destination data' });
  const text = JSON.stringify(exported.backup);
  const before = [...destination.map];
  const plan = planDataImport(destination, text);
  assert.equal(plan.ok, true);
  assert.deepEqual([...destination.map], before, 'preview must not write');
  assert.deepEqual(plan.summary, { added: 2, updated: 0, kept: 0, settings: 8, archived: 1 });
  assert.equal(importDataBackup(destination, text).ok, true);
  for (const [key, value] of source.map) {
    if (key !== 'unrelated') assert.equal(destination.getItem(key), value, key);
  }
  const store = createHistoryStore(destination);
  assert.equal(store.listForSidebar().items.length, 2);
  assert.deepEqual(store.loadById('c1').record, current);
  assert.equal(projectV1Record(store.loadById('old').record).turns.length, 1);
  assert.deepEqual(buildModelContext(current.turns), buildModelContext(store.loadById('c1').record.turns));
  const opened = reduceSession(createInitialState(), { type: 'OPEN_CONVERSATION', conversationId: 'c1', mode: 'socratic', turns: current.turns });
  assert.equal(opened.turns[0].questions[0].state, 'pending');
  assert.equal(destination.getItem('unrelated'), 'destination data');
});

test('single-conversation export selects v2 only, preserves its content and round trips without settings', () => {
  const item = record('chosen');
  item.turns[0].questions.push({ ...item.turns[0].questions[0], id: 'answered', state: 'answered', answer: '我的回答' });
  const source = memory({ chat_histories_v2: JSON.stringify([item, record('other')]),
    chat_histories: JSON.stringify([{ ...legacy, id: item.id }, legacy]),
    mainAgentConfig: JSON.stringify({ apiKey: 'must-not-export' }),
    learning_journals_v1: JSON.stringify([{ conversationId: item.id, units: [] }]) });
  const before = [...source.map];
  const result = createConversationBackup(source, item.id);
  assert.equal(result.ok, true);
  assert.equal(result.backup.includesCredentials, false);
  assert.deepEqual(Object.keys(result.backup.data), ['chat_histories_v2']);
  assert.deepEqual(JSON.parse(result.backup.data.chat_histories_v2), [item]);
  assert.deepEqual([...source.map], before, 'export is read-only');
  const destination = memory({ mainAgentConfig: '{"apiKey":"destination-key"}', waitTime: '4' });
  const text = JSON.stringify(result.backup);
  assert.equal(planDataImport(destination, text).summary.added, 1);
  assert.equal(importDataBackup(destination, text).ok, true);
  assert.deepEqual(createHistoryStore(destination).loadById(item.id).record, item);
  assert.equal(createHistoryStore(destination).listForSidebar().items.length, 1);
  assert.equal(destination.getItem('mainAgentConfig'), '{"apiKey":"destination-key"}');
  assert.equal(destination.getItem('waitTime'), '4');
});

test('single legacy export keeps the original v1 payload and remains importable', () => {
  const source = memory({ chat_histories_v2: ' ', chat_histories: JSON.stringify([legacy, { ...legacy, id: 'other' }]) });
  const result = createConversationBackup(source, legacy.id);
  assert.deepEqual(Object.keys(result.backup.data), ['chat_histories']);
  assert.deepEqual(JSON.parse(result.backup.data.chat_histories), [legacy]);
  const destination = memory();
  assert.equal(importDataBackup(destination, JSON.stringify(result.backup)).ok, true);
  assert.deepEqual(createHistoryStore(destination).loadById(legacy.id).record, legacy);
  assert.equal(projectV1Record(legacy).turns.length, 1);
});

test('single export does not read model settings or require other records to be valid', () => {
  const source = memory({ chat_histories_v2: JSON.stringify([null, record('chosen')]) });
  const get = source.getItem;
  source.getItem = (key) => {
    assert.equal(['chat_histories_v2', 'chat_histories'].includes(key), true);
    return get(key);
  };
  assert.equal(createConversationBackup(source, 'chosen').ok, true);
});

test('single export reports missing, damaged and inaccessible records instead of downloading stale data', () => {
  assert.equal(createConversationBackup(memory(), 'missing').reason, 'not_found');
  assert.equal(createConversationBackup(memory(), '').reason, 'invalid');
  const damaged = memory({ chat_histories_v2: '{broken', chat_histories: JSON.stringify([legacy]) });
  assert.equal(createConversationBackup(damaged, legacy.id).reason, 'corrupt');
  assert.equal(createConversationBackup(memory({ chat_histories_v2: JSON.stringify([record(), record()]) }), 'c1').reason, 'corrupt');
  assert.equal(createConversationBackup({ getItem() { throw new Error('denied'); } }, 'c1').reason, 'unavailable');
});

test('merge is idempotent, keeps local-only entries and newer/tied local versions', () => {
  const source = [record('new', 2), record('update', 3), record('keep', 1), record('tie', 2)];
  const local = [record('local', 1), record('update', 2), record('keep', 3), record('tie', 2)];
  source[3].title = '另一设备的同时间版本';
  const storage = memory({ chat_histories_v2: JSON.stringify(local) });
  const backup = pack({ chat_histories_v2: JSON.stringify(source) });
  const result = importDataBackup(storage, backup);
  assert.deepEqual(result.summary, { added: 1, updated: 1, kept: 2, settings: 0, archived: 0 });
  assert.equal(createHistoryStore(storage).loadById('tie').record.title, local[3].title);
  const once = storage.getItem('chat_histories_v2');
  assert.equal(importDataBackup(storage, backup).ok, true);
  assert.equal(storage.getItem('chat_histories_v2'), once);
  assert.equal(JSON.parse(once).length, 5);
});

test('legacy bare arrays and UTF-8 BOM import without rewriting existing v2 data', () => {
  const raw = JSON.stringify([record('old', 2)]);
  const storage = memory({ chat_histories_v2: raw });
  assert.equal(importDataBackup(storage, '\uFEFF' + JSON.stringify([legacy])).ok, true);
  assert.equal(storage.getItem('chat_histories_v2'), raw);
  assert.equal(createHistoryStore(storage).loadById('old').source, 'v2');
});

test('redacted backup excludes keys and URLs, preserves destination connections on import', () => {
  const source = memory({ mainAgentConfig: JSON.stringify({ apiKey: 'secret', model: 'new-model',
    baseURL: 'https://example.test?token=secret', fullURL: 'https://secret@example.test', custom: 'secret' }) });
  const result = createDataBackup(source, { includeCredentials: false });
  assert.equal(result.ok, true);
  const text = JSON.stringify(result.backup);
  assert.equal(text.includes('secret'), false);
  const destination = memory({ mainAgentConfig: JSON.stringify({ apiKey: 'local-key', baseURL: 'local-url', model: 'old-model' }) });
  assert.equal(importDataBackup(destination, text).ok, true);
  assert.deepEqual(JSON.parse(destination.getItem('mainAgentConfig')), { apiKey: 'local-key', baseURL: 'local-url', model: 'new-model' });
});

test('invalid input, duplicate identities, future schemas and unknown keys never mutate storage', () => {
  const storage = memory({ waitTime: '8' });
  const inputs = ['{', '{}', 'null', pack({ waitTime: '1' }, { version: 99 }),
    pack({ unrelated: 'no' }), pack({ waitTime: 1 }), pack({ mainAgentConfig: '{' }),
    pack({ mainAgentConfig: JSON.stringify({ baseURL: {} }) }),
    pack({ answerCardSize: JSON.stringify({ width: 'bad', height: 4 }) }),
    pack({ chat_histories_v2: JSON.stringify([record(), record()]) }),
    pack({ chat_histories_v2: JSON.stringify([{ ...record(), schemaVersion: 3 }]) }),
    pack({ chat_histories: JSON.stringify([{ id: 'bad' }]) }),
    pack({ waitTime: '1', chat_histories_v2: '[null]' })];
  for (const input of inputs) {
    assert.equal(importDataBackup(storage, input).ok, false);
    assert.deepEqual([...storage.map], [['waitTime', '8']]);
  }
});

test('oversized input is rejected before parsing', () => {
  assert.equal(parseDataBackup(' '.repeat(MAX_BACKUP_BYTES + 1)).reason, 'too_large');
});

test('damaged local collections block import but remain exportable for recovery', () => {
  const storage = memory({ chat_histories_v2: '{broken', waitTime: '8' });
  const backup = pack({ waitTime: '1', chat_histories_v2: JSON.stringify([record()]) });
  assert.equal(importDataBackup(storage, backup).reason, 'local_corrupt');
  assert.equal(storage.getItem('waitTime'), '8');
  assert.equal(createDataBackup(storage).backup.data.chat_histories_v2, '{broken');
});

test('read failures are explicit and missing keys never delete local data', () => {
  const unavailable = { getItem() { throw new Error('denied'); } };
  assert.equal(createDataBackup(unavailable).reason, 'unavailable');
  assert.equal(planDataImport(unavailable, pack({ waitTime: '2' })).reason, 'unavailable');
  const storage = memory({ waitTime: '8' });
  assert.equal(importDataBackup(storage, pack({})).ok, true);
  assert.equal(storage.getItem('waitTime'), '8');
});

test('write failure rolls back both replaced and newly added keys', () => {
  for (const initial of [{}, { waitTime: '8' }]) {
    const storage = memory(initial);
    const set = storage.setItem;
    storage.setItem = (key, value) => {
      if (key === 'enableWaitTime') { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; }
      set(key, value);
    };
    assert.equal(importDataBackup(storage, pack({ waitTime: '1', enableWaitTime: 'false' })).reason, 'quota');
    assert.deepEqual([...storage.map], Object.entries(initial));
  }
});

test('rollback failure is distinguished from successful rollback', () => {
  const storage = memory({ waitTime: '8' });
  const set = storage.setItem;
  storage.setItem = (key, value) => {
    if (key === 'enableWaitTime' || value === '8') throw new Error('denied');
    set(key, value);
  };
  assert.equal(importDataBackup(storage, pack({ waitTime: '1', enableWaitTime: 'false' })).reason, 'rollback_failed');
});

test('v2 import applies the existing persistence projection, stripping reasoning and transient preview', () => {
  const item = record();
  item.turns[0].parts.push({ type: 'reasoning', text: 'private reasoning' });
  item.turns[0].parts[0].text += '\u200B';
  item.turns[0].parts[0].preview = 'transient';
  const storage = memory();
  assert.equal(importDataBackup(storage, pack({ chat_histories_v2: JSON.stringify([item]) })).ok, true);
  assert.equal(storage.getItem('chat_histories_v2').includes('private reasoning'), false);
  assert.equal(storage.getItem('chat_histories_v2').includes('transient'), false);
  assert.equal(storage.getItem('chat_histories_v2').includes('\u200B'), false);
});

function mountHistory(storage, initialSession) {
  let session = initialSession;
  let history;
  const opened = [];
  function Harness() {
    history = useConversationHistory({ storage, session: { ...session, openConversation: (item) => opened.push(item) } });
    return null;
  }
  let renderer;
  act(() => { renderer = create(React.createElement(Harness)); });
  return { get history() { return history; }, opened,
    update: (next) => act(() => { session = next; renderer.update(React.createElement(Harness)); }),
    close: () => act(() => renderer.unmount()) };
}

test('checkpoint retries a failed save and preserves renamed conversation titles', () => {
  const storage = memory();
  const set = storage.setItem;
  let fail = true;
  storage.setItem = (key, value) => {
    if (fail) { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; }
    set(key, value);
  };
  const item = record();
  const session = { conversationId: item.id, mode: item.mode, turns: item.turns, isRunning: false };
  const view = mountHistory(storage, session);
  assert.equal(view.history.saveFailure, 'quota');
  act(() => assert.equal(view.history.checkpoint().reason, 'quota'));
  fail = false;
  act(() => assert.equal(view.history.checkpoint().ok, true));
  assert.equal(view.history.saveFailure, null);
  createHistoryStore(storage).renameConversation(item.id, '保留手动标题');
  view.update({ ...session, turns: [...item.turns, { ...item.turns[0], id: 't2' }] });
  assert.equal(createHistoryStore(storage).loadById(item.id).record.title, '保留手动标题');
  view.update({ ...session, isRunning: true });
  assert.equal(view.history.checkpoint().reason, 'busy');
  view.close();
});

test('refresh after import reopens updated current data without issuing model requests or overwriting it', () => {
  const item = record();
  const storage = memory({ chat_histories_v2: JSON.stringify([item]) });
  const view = mountHistory(storage, { conversationId: item.id, mode: item.mode, turns: item.turns });
  const newer = record(item.id, 20);
  newer.title = '另一设备的新版本';
  importDataBackup(storage, pack({ chat_histories_v2: JSON.stringify([newer]) }));
  act(() => view.history.refreshAfterImport());
  assert.equal(view.opened.at(-1).title, newer.title);
  assert.equal(view.history.conversations[0].title, newer.title);
  assert.equal(createHistoryStore(storage).loadById(item.id).record.title, newer.title);
  view.close();
});

test('single export checkpoints the current conversation but allows exporting another during an active run', () => {
  const item = record();
  const other = record('other');
  const storage = memory({ chat_histories_v2: JSON.stringify([item, other]) });
  const session = { conversationId: item.id, mode: item.mode, turns: item.turns, isRunning: false };
  const view = mountHistory(storage, session);
  const modified = [...item.turns, { ...item.turns[0], id: 'second-turn' }];
  view.update({ ...session, turns: modified });
  let result;
  act(() => { result = view.history.exportConversation(item.id); });
  assert.equal(JSON.parse(result.backup.data.chat_histories_v2)[0].turns.length, 2);
  view.update({ ...session, isRunning: true });
  assert.equal(view.history.exportConversation(item.id).reason, 'busy');
  const before = [...storage.map];
  const openedBefore = view.opened.length;
  assert.equal(view.history.exportConversation('other').ok, true);
  assert.deepEqual([...storage.map], before);
  assert.equal(view.opened.length, openedBefore, 'export must not switch the active conversation');
  view.close();
});
