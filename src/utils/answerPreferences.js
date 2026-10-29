// Shared with the legacy settings panel; keep existing browser preferences.
export function readAnswerPreferences(storage = localStorage) {
  const saved = storage.getItem('waitTime');
  const seconds = saved === null || saved.trim() === '' ? 5 : Number(saved);
  return {
    enabled: storage.getItem('enableWaitTime') !== 'false',
    seconds: Number.isInteger(seconds) && seconds >= 0 && seconds <= 30 ? seconds : 5,
  };
}

export function getAnswerWaitSeconds(storage = localStorage) {
  const { enabled, seconds } = readAnswerPreferences(storage);
  return enabled ? seconds : 0;
}
