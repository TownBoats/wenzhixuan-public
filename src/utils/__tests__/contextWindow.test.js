import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateContextTokens, latestContextUsage, normalizeContextWindow, resolveContextWindow } from '../contextWindow.js';
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
  assert.equal(tools.length, 3);
  assert.equal(tools[0].parameters.properties.question.type, 'string');
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
