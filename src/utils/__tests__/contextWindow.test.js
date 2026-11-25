import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateContextTokens, latestContextUsage, measureContextTokens, normalizeContextWindow, resolveContextWindow } from '../contextWindow.js';
import { sanitizeTokenUsage } from '../tokenUsage.js';
import { createInitialState, reduceSession, buildModelContext } from '../conversationState.js';
import { sanitizeConversation } from '../historyStore.js';
import { createModes } from '../../agent/modes.js';
import { contextToolDefinitions } from '../../agent/contextSchemas.js';

const CONFIG = { endpoint: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-flash' };

test('capacity: verified provider/model only, manual override wins, invalid values stay unknown', () => {
  assert.deepEqual(resolveContextWindow(CONFIG), { tokens: 1048576, source: 'catalog' });
  assert.deepEqual(resolveContextWindow({ ...CONFIG, contextWindow: '32768' }), { tokens: 32768, source: 'configured' });
  for (const endpoint of ['https://proxy.example/v1', 'https://api.deepseek.com.example/v1', 'http://api.deepseek.com/v1', '/v1']) {
    assert.deepEqual(resolveContextWindow({ ...CONFIG, endpoint }), { tokens: null, source: 'unknown' });
  }
  assert.equal(resolveContextWindow({ ...CONFIG, model: 'unknown' }).tokens, null);
  for (const value of [0, -1, 1.1, Infinity, NaN, '', null, true, [], {}, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(normalizeContextWindow(value), null);
  }
});

test('estimate: includes actual eligible model messages, instructions, tools and draft, excludes reasoning and failed turns', () => {
  const turn = { status: 'completed', userMessage: { text: '学习闭包' }, modelMessages: [{ role: 'assistant', content: '捕获变量' }] };
  const initial = estimateContextTokens({ turns: [turn] });
  const polluted = { ...turn, parts: [{ type: 'reasoning', text: 'secret'.repeat(1000) }], modelMessages: [
    ...turn.modelMessages, { role: 'assistant', content: [{ type: 'reasoning', text: 'secret'.repeat(1000) }] },
  ] };
  assert.equal(estimateContextTokens({ turns: [polluted, { ...turn, status: 'failed' }, { ...turn, status: 'cancelled' }] }).tokens, initial.tokens);
  const modes = createModes({ normal: 'Teach', socratic: 'Teach by asking' });
  const tools = contextToolDefinitions(modes.socratic);
  assert.equal(tools.length, 4);
  assert.equal(tools[1].parameters.properties.question.type, 'string');
  assert.deepEqual(contextToolDefinitions(modes.normal), []);
  const complete = estimateContextTokens({ turns: [turn], system: modes.socratic.teaching, tools, draft: '继续解释'.repeat(100) });
  assert.ok(complete.tokens > initial.tokens);
  assert.ok(complete.breakdown.system > 0 && complete.breakdown.tools > 0 && complete.breakdown.draft > 0);
});

test('streaming estimate ignores old retry output, reasoning and unfinished tool previews', () => {
  const active = { status: 'streaming', runId: 'new', userMessage: { text: '继续' }, parts: [
    { runId: 'new', type: 'text', text: '最新输出' },
  ] };
  const baseline = estimateContextTokens({ turns: [active] });
  const noisy = { ...active, parts: [...active.parts,
    { runId: 'old', type: 'text', text: '旧输出'.repeat(500) },
    { runId: 'new', type: 'reasoning', text: '思考'.repeat(500) },
    { runId: 'new', type: 'tool', status: 'running', partialInput: 'preview'.repeat(500) },
  ] };
  assert.deepEqual(estimateContextTokens({ turns: [noisy] }), baseline);
  assert.ok(baseline.breakdown.generating > 0);
});

test('usage: allowlist numbers, reject incomplete/invalid telemetry, clear retry and ignore late finishes', () => {
  const usage = { inputTokens: 120, outputTokens: 7, apiKey: 'secret', raw: { headers: 'secret' } };
  assert.deepEqual(sanitizeTokenUsage(usage), { inputTokens: 120, outputTokens: 7 });
  for (const value of [{}, { inputTokens: -1, outputTokens: 1 }, { inputTokens: 1 }, { inputTokens: 1, outputTokens: Infinity }]) {
    assert.equal(sanitizeTokenUsage(value), null);
  }
  let state = reduceSession(createInitialState(), { type: 'SEND_MESSAGE', conversationId: 'c', turnId: 't', runId: 'r', text: 'hi' });
  state = reduceSession(state, { type: 'RUN_FINISHED', runId: 'r', reason: 'completed', responseMessages: [], contextUsage: usage, usageModel: 'm' });
  assert.deepEqual(latestContextUsage(state.turns, 'm'), { inputTokens: 120, outputTokens: 7 });
  assert.equal(latestContextUsage(state.turns, 'other-model'), null);
  assert.equal(JSON.stringify(buildModelContext(state.turns)).includes('inputTokens'), false);
  const stored = sanitizeConversation({ id: 'c', turns: state.turns });
  assert.deepEqual(stored.turns[0].contextUsage, { inputTokens: 120, outputTokens: 7 });
  assert.equal(JSON.stringify(stored).includes('secret'), false);
  const restored = reduceSession(createInitialState(), { type: 'OPEN_CONVERSATION', conversationId: 'c', turns: stored.turns });
  assert.deepEqual(latestContextUsage(restored.turns, 'm'), { inputTokens: 120, outputTokens: 7 });
  state = reduceSession(state, { type: 'RETRY_LAST_TURN', runId: 'r2' });
  assert.equal(state.turns[0].contextUsage, null);
  assert.equal(latestContextUsage(state.turns, 'm'), null);
  assert.equal(reduceSession(state, { type: 'RUN_FINISHED', runId: 'r', reason: 'completed', contextUsage: usage }), state);
});

test('usage: keeps reasoning tokens from SDK details or legacy field, drops invalid values', () => {
  assert.deepEqual(
    sanitizeTokenUsage({ inputTokens: 100, outputTokens: 40, outputTokenDetails: { reasoningTokens: 30, textTokens: 10 } }),
    { inputTokens: 100, outputTokens: 40, reasoningTokens: 30 },
  );
  assert.deepEqual(sanitizeTokenUsage({ inputTokens: 100, outputTokens: 40, reasoningTokens: 5 }), { inputTokens: 100, outputTokens: 40, reasoningTokens: 5 });
  for (const reasoningTokens of [0, 41, -1, 1.5, '3', undefined]) {
    assert.deepEqual(sanitizeTokenUsage({ inputTokens: 100, outputTokens: 40, reasoningTokens }), { inputTokens: 100, outputTokens: 40 });
  }
  // Persisted through reducer and history sanitizer; old records without the field stay valid.
  let state = reduceSession(createInitialState(), { type: 'SEND_MESSAGE', conversationId: 'c', turnId: 't', runId: 'r', text: 'hi' });
  state = reduceSession(state, { type: 'RUN_FINISHED', runId: 'r', reason: 'completed', responseMessages: [],
    contextUsage: { inputTokens: 100, outputTokens: 40, outputTokenDetails: { reasoningTokens: 30 } }, usageModel: 'm' });
  assert.deepEqual(sanitizeConversation({ id: 'c', turns: state.turns }).turns[0].contextUsage, { inputTokens: 100, outputTokens: 40, reasoningTokens: 30 });
});

const doneTurn = (overrides = {}) => ({
  status: 'completed', usageModel: 'm', userMessage: { text: '学习闭包' },
  modelMessages: [{ role: 'assistant', content: '闭包会捕获外层变量。'.repeat(20) }],
  contextUsage: { inputTokens: 5000, outputTokens: 300, reasoningTokens: 200 },
  ...overrides,
});

test('measure: anchors on the latest real usage and subtracts reasoning that is never resent', () => {
  const result = measureContextTokens({ turns: [doneTurn()], model: 'm', system: '系统'.repeat(100), tools: [{ name: 'ask' }] });
  assert.equal(result.source, 'measured');
  assert.equal(result.tokens, 5000 + 300 - 200);
  // System and tools are already inside the measured input: not counted again.
  assert.deepEqual(result.breakdown, { measured: 5100, conversation: 0, generating: 0, draft: 0 });
});

test('measure: only content after the anchor is estimated (draft, later turns, active generation)', () => {
  const anchor = doneTurn();
  const withDraft = measureContextTokens({ turns: [anchor], model: 'm', draft: '继续讲' });
  assert.equal(withDraft.source, 'mixed');
  assert.equal(withDraft.breakdown.measured, 5100);
  assert.ok(withDraft.breakdown.draft > 0);
  assert.equal(withDraft.tokens, 5100 + withDraft.breakdown.draft);

  const streaming = { status: 'streaming', runId: 'r2', userMessage: { text: '那作用域链呢？' }, parts: [
    { runId: 'r2', type: 'text', text: '作用域链是……' },
    { runId: 'r2', type: 'reasoning', text: '思考'.repeat(500) },
  ] };
  const live = measureContextTokens({ turns: [anchor, streaming], model: 'm' });
  assert.equal(live.source, 'mixed');
  assert.equal(live.breakdown.measured, 5100);
  assert.ok(live.breakdown.conversation > 0 && live.breakdown.generating > 0);
  assert.equal(live.tokens, 5100 + live.breakdown.conversation + live.breakdown.generating);
  // The anchor turn itself is never estimated on top of its measurement.
  assert.equal(live.breakdown.conversation, estimateContextTokens({ turns: [streaming] }).breakdown.conversation);
});

test('measure: later eligible turns without usage are estimated; failed turns and other models are ignored', () => {
  const legacy = doneTurn({ contextUsage: null, usageModel: null, modelMessages: [{ role: 'assistant', content: '旧记录' }] });
  const mixed = measureContextTokens({ turns: [doneTurn(), legacy], model: 'm' });
  assert.equal(mixed.source, 'mixed');
  assert.equal(mixed.breakdown.measured, 5100);
  assert.equal(mixed.breakdown.conversation, estimateContextTokens({ turns: [legacy] }).breakdown.conversation);

  const failed = doneTurn({ status: 'failed', contextUsage: { inputTokens: 99999, outputTokens: 1 } });
  assert.deepEqual(measureContextTokens({ turns: [doneTurn(), failed], model: 'm' }).breakdown.measured, 5100);

  const other = measureContextTokens({ turns: [doneTurn()], model: 'other', system: 'S', tools: [] });
  assert.equal(other.source, 'estimated');
  assert.deepEqual(other, { source: 'estimated', ...estimateContextTokens({ turns: [doneTurn()], system: 'S', tools: [] }) });
  assert.equal(measureContextTokens({ turns: [], model: 'm' }).source, 'estimated');
});

test('measure: retry clears the last turn usage so the anchor falls back to the earlier turn', () => {
  let state = reduceSession(createInitialState(), { type: 'SEND_MESSAGE', conversationId: 'c', turnId: 't1', runId: 'r1', text: 'one' });
  state = reduceSession(state, { type: 'RUN_FINISHED', runId: 'r1', reason: 'completed', responseMessages: [],
    contextUsage: { inputTokens: 1000, outputTokens: 50 }, usageModel: 'm' });
  state = reduceSession(state, { type: 'SEND_MESSAGE', conversationId: 'c', turnId: 't2', runId: 'r2', text: 'two' });
  state = reduceSession(state, { type: 'RUN_FINISHED', runId: 'r2', reason: 'completed', responseMessages: [],
    contextUsage: { inputTokens: 2000, outputTokens: 80 }, usageModel: 'm' });
  assert.equal(measureContextTokens({ turns: state.turns, model: 'm' }).tokens, 2080);
  state = reduceSession(state, { type: 'RETRY_LAST_TURN', runId: 'r3' });
  const retrying = measureContextTokens({ turns: state.turns, model: 'm' });
  assert.equal(retrying.breakdown.measured, 1050);
  assert.ok(retrying.tokens >= 1050);
});
