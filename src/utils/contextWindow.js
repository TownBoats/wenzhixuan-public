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

export function latestContextUsage(turns, model) {
  // Only the latest turn: never show an older run as the current request after a retry/failure.
  const turn = turns?.at(-1);
  if (!['completed', 'awaiting_user'].includes(turn?.status) || turn.usageModel !== model) return null;
  return sanitizeTokenUsage(turn.contextUsage);
}
