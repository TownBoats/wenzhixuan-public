/**
 * Only numeric last-request telemetry; never retain provider metadata or credentials.
 * `reasoningTokens` is optional (older records and many providers omit it) and is
 * kept only when it is a positive count no larger than `outputTokens`. The OpenAI
 * provider reports 0 when the API sends no reasoning detail, so 0 is not stored.
 */
export function sanitizeTokenUsage(usage) {
  const valid = (value) => Number.isSafeInteger(value) && value >= 0;
  if (!valid(usage?.inputTokens) || !valid(usage?.outputTokens)) return null;
  const clean = { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens };
  const reasoning = usage.outputTokenDetails?.reasoningTokens ?? usage.reasoningTokens;
  if (valid(reasoning) && reasoning > 0 && reasoning <= usage.outputTokens) clean.reasoningTokens = reasoning;
  return clean;
}
