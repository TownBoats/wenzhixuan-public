/** Only numeric last-request telemetry; never retain provider metadata or credentials. */
export function sanitizeTokenUsage(usage) {
  const valid = (value) => Number.isSafeInteger(value) && value >= 0;
  if (!valid(usage?.inputTokens) || !valid(usage?.outputTokens)) return null;
  return { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens };
}
