import { buildModelContext } from './conversationState.js';
import { sanitizeTokenUsage } from './tokenUsage.js';

// Official metadata checked 2026-11-03: https://api-docs.deepseek.com/api/list-models/
const DEEPSEEK_WINDOWS = { 'deepseek-flash': 1_048_576, 'deepseek-v4-pro': 1_048_576 };

export function normalizeContextWindow(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

export function resolveContextWindow(config) {
  const configured = normalizeContextWindow(config?.contextWindow);
  if (configured) return { tokens: configured, source: 'configured' };
  try {
    const url = new URL(config?.endpoint);
    if (url.protocol === 'https:' && url.hostname === 'api.deepseek.com' && !url.port) {
      const tokens = DEEPSEEK_WINDOWS[config?.model];
      if (tokens) return { tokens, source: 'catalog' };
    }
  } catch { /* Custom or incomplete endpoint: no guessed capacity. */ }
  return { tokens: null, source: 'unknown' };
}

/** Rough mixed-language estimate, not a model tokenizer. No network requests. */
export function estimateTextTokens(text) {
  let units = 0;
  for (const character of String(text ?? '').replace(/\u200B/g, '')) {
    units += character.codePointAt(0) < 128 ? 0.25 : 1.5;
  }
  return Math.ceil(units);
}

const estimateJson = (value) => estimateTextTokens(JSON.stringify(value));

/** Count the model projection, never arbitrary UI fields or reasoning. */
export function estimateContextTokens({ turns = [], system = '', tools = [], draft = '' } = {}) {
  const messages = buildModelContext(turns);
  const last = turns.at(-1);
  let generating = 0;
  if (last?.status === 'streaming') {
    const userText = last.userMessage?.text?.trim();
    if (userText) messages.push({ role: 'user', content: userText });
    for (const part of last.parts ?? []) {
      if (part?.runId !== last.runId) continue;
      if (part.type === 'text') generating += estimateTextTokens(part.text);
      if (part.type === 'tool' && part.status === 'completed') {
        generating += estimateJson({ name: part.toolName, input: part.input, output: part.output });
      }
    }
  }
  const breakdown = {
    system: system ? estimateTextTokens(system) + 4 : 0,
    tools: tools.length ? estimateJson(tools) : 0,
    conversation: messages.reduce((sum, message) => sum + estimateJson(message) + 4, 0),
    generating,
    draft: draft.trim() ? estimateTextTokens(draft.trim()) + 4 : 0,
  };
  return { tokens: Object.values(breakdown).reduce((sum, count) => sum + count, 0), breakdown };
}

const MEASURABLE_STATUSES = new Set(['completed', 'awaiting_user']);

/**
 * Context occupancy anchored on real API usage.
 *
 * Anchor = the latest context-eligible turn whose last request reported usage for the
 * current model. Its `input + output − reasoning` is what the provider actually counted
 * for everything up to and including that turn (reasoning is never resent). Only content
 * after the anchor — later turns, the active generation and the draft — is estimated.
 * Without an anchor (new conversation, model switch, old records) this falls back to the
 * full character estimate, labelled as such.
 *
 * Known approximation: the anchor reflects the system prompt and tools of that request;
 * a later mode switch is not re-counted. Tool results of the anchor's final step are tiny
 * and are not added.
 */
export function measureContextTokens({ turns = [], model, system = '', tools = [], draft = '' } = {}) {
  let anchorIndex = -1;
  let usage = null;
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (!MEASURABLE_STATUSES.has(turn?.status) || !model || turn.usageModel !== model) continue;
    usage = sanitizeTokenUsage(turn.contextUsage);
    if (usage) { anchorIndex = index; break; }
  }

  if (!usage) {
    return { source: 'estimated', ...estimateContextTokens({ turns, system, tools, draft }) };
  }

  const measured = usage.inputTokens + usage.outputTokens - (usage.reasoningTokens ?? 0);
  const delta = estimateContextTokens({ turns: turns.slice(anchorIndex + 1), draft }).breakdown;
  const breakdown = {
    measured,
    conversation: delta.conversation,
    generating: delta.generating,
    draft: delta.draft,
  };
  const estimatedPart = breakdown.conversation + breakdown.generating + breakdown.draft;
  return {
    source: estimatedPart > 0 ? 'mixed' : 'measured',
    tokens: measured + estimatedPart,
    breakdown,
  };
}

export function latestContextUsage(turns, model) {
  // Only the latest turn: never show an older run as the current request after a retry/failure.
  const turn = turns?.at(-1);
  if (!['completed', 'awaiting_user'].includes(turn?.status) || turn.usageModel !== model) return null;
  return sanitizeTokenUsage(turn.contextUsage);
}
