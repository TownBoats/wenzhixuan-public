import { STORAGE_KEY_V1, STORAGE_KEY_V2, sanitizeConversation } from './historyStore.js';

export const BACKUP_FORMAT = 'wenzhixuan-backup';
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;
// Explicit scope: never copy unrelated data belonging to the same origin.
export const BACKUP_KEYS = Object.freeze([
  STORAGE_KEY_V2, STORAGE_KEY_V1, 'learning_journals_v1',
  'mainAgentConfig', 'optionAgentConfig', 'mainAgentPrompt', 'optionAgentPrompt',
  'option_ai_prompt', 'learning_mode_prompt', 'enableWaitTime', 'waitTime',
  'answerCardSize', 'developerMode', 'prompt_migration_notice_dismissed',
  'welcome_setup_guide_dismissed',
]);
const CONFIG_KEYS = new Set(['mainAgentConfig', 'optionAgentConfig']);
const COLLECTIONS = new Map([
  [STORAGE_KEY_V2, ['id', 'timestamp']],
  [STORAGE_KEY_V1, ['id', 'timestamp']],
  ['learning_journals_v1', ['conversationId', 'updatedAt']],
]);
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = (reason) => ({ ok: false, reason });

function validConfig(config) {
  if (!object(config)) return false;
  const strings = ['baseURL', 'customEndpoint', 'apiKey', 'model', 'fullURL'];
  return strings.every((key) => config[key] == null || typeof config[key] === 'string')
    && ['useCustomURL', 'enableThinking'].every((key) => config[key] == null || typeof config[key] === 'boolean')
    && ['thinkingBudget', 'contextWindow'].every((key) => config[key] == null
      || (['number', 'string'].includes(typeof config[key]) && Number.isFinite(Number(config[key]))));
}

/** Raw strings preserve legacy payloads and even damaged data for recovery. */
export function createDataBackup(storage, { includeCredentials = true, now = new Date() } = {}) {
  try {
    const data = {};
    for (const key of BACKUP_KEYS) {
      let value = storage.getItem(key);
      if (value === null) continue;
      if (!includeCredentials && CONFIG_KEYS.has(key)) {
        // A malformed config cannot be reliably redacted: fail instead of leaking it.
        const config = JSON.parse(value);
        if (!object(config)) return fail('invalid');
        // URL fields may themselves contain tokens, so omit connection details too.
        value = JSON.stringify(Object.fromEntries(Object.entries(config).filter(([field]) =>
          ['model', 'enableThinking', 'thinkingBudget', 'contextWindow'].includes(field))));
      }
      data[key] = value;
    }
    return { ok: true, backup: { format: BACKUP_FORMAT, version: BACKUP_VERSION,
      exportedAt: now.toISOString(), includesCredentials: includeCredentials, data } };
  } catch {
    return fail('unavailable');
  }
}

function parseCollection(raw, key) {
  const records = raw === null ? [] : JSON.parse(raw);
  if (!Array.isArray(records)) throw new Error('invalid collection');
  const [idField] = COLLECTIONS.get(key);
  const ids = new Set();
  for (const record of records) {
    if (!object(record) || typeof record[idField] !== 'string' || !record[idField].trim()
      || record[idField] !== record[idField].trim() || ids.has(record[idField])) throw new Error('invalid identity');
    ids.add(record[idField]);
    if (key === STORAGE_KEY_V2 && (record.schemaVersion !== 2 || !Array.isArray(record.turns))) throw new Error('invalid v2');
    if (key === STORAGE_KEY_V1 && !Array.isArray(record.messages)) throw new Error('invalid v1');
    if (key === 'learning_journals_v1' && !Array.isArray(record.units)) throw new Error('invalid archive');
  }
  return records;
}

/** Accept versioned backups and historical bare v1 arrays; never silently skip bad records. */
export function parseDataBackup(text) {
  try {
    if (typeof text !== 'string' || new Blob([text]).size > MAX_BACKUP_BYTES) return fail('too_large');
    const parsed = JSON.parse(text.replace(/^\uFEFF/, ''));
    let data;
    let includesCredentials = true;
    if (Array.isArray(parsed)) data = { [STORAGE_KEY_V1]: JSON.stringify(parsed) };
    else {
      if (!object(parsed) || parsed.format !== BACKUP_FORMAT) return fail('invalid');
      if (parsed.version !== BACKUP_VERSION) return fail('version');
      if (!object(parsed.data)) return fail('invalid');
      data = parsed.data;
      includesCredentials = parsed.includesCredentials !== false;
    }
    if (Object.keys(data).length === 0) return { ok: true, data: {}, includesCredentials };
    for (const [key, raw] of Object.entries(data)) {
      if (!BACKUP_KEYS.includes(key) || typeof raw !== 'string') return fail('invalid');
      if (COLLECTIONS.has(key)) parseCollection(raw, key);
      if (CONFIG_KEYS.has(key) && !validConfig(JSON.parse(raw))) return fail('invalid');
      if (key === 'answerCardSize') {
        const size = JSON.parse(raw);
        if (!object(size) || !['width', 'height'].every((field) => Number.isFinite(size[field]) && size[field] > 0)) return fail('invalid');
      }
    }
    return { ok: true, data, includesCredentials };
  } catch {
    return fail('invalid');
  }
}

/** Prepare a reviewable plan without changing storage. Recomputed when applying. */
export function planDataImport(storage, text) {
  const parsed = parseDataBackup(text);
  if (!parsed.ok) return parsed;
  const changes = [];
  const summary = { added: 0, updated: 0, kept: 0, settings: 0, archived: 0 };
  for (const [key, raw] of Object.entries(parsed.data)) {
    let before;
    try { before = storage.getItem(key); } catch { return fail('unavailable'); }
    let after = raw;
    if (COLLECTIONS.has(key)) {
      let local;
      try { local = parseCollection(before, key); } catch { return fail('local_corrupt'); }
      const incoming = parseCollection(raw, key);
      const [idField, timeField] = COLLECTIONS.get(key);
      const merged = new Map(local.map((record) => [record[idField], record]));
      for (const entry of incoming) {
        // v2 always follows the existing storage projection (no reasoning/previews).
        const record = key === STORAGE_KEY_V2 ? sanitizeConversation(entry) : entry;
        const current = merged.get(record[idField]);
        const time = (item) => Number.isFinite(item?.[timeField]) ? item[timeField] : 0;
        let action = 'kept';
        if (!current) action = 'added';
        else if (time(record) > time(current)) action = 'updated';
        if (key === 'learning_journals_v1') summary.archived += 1;
        else summary[action] += 1;
        if (action !== 'kept') merged.set(record[idField], record);
      }
      after = JSON.stringify([...merged.values()]);
    } else {
      if (!parsed.includesCredentials && CONFIG_KEYS.has(key)) {
        // A redacted backup must not erase keys/connection details on this device.
        try {
          const current = before === null ? {} : JSON.parse(before);
          if (!object(current)) return fail('local_corrupt');
          after = JSON.stringify({ ...current, ...JSON.parse(raw) });
        } catch { return fail('local_corrupt'); }
      }
      if (after !== before) summary.settings += 1;
    }
    if (after !== before) changes.push({ key, before, after });
  }
  return { ok: true, summary, changes };
}

/** Roll back earlier writes on error; do not pretend localStorage is transactional. */
export function importDataBackup(storage, text) {
  const plan = planDataImport(storage, text);
  if (!plan.ok) return plan;
  const written = [];
  try {
    for (const change of plan.changes) {
      storage.setItem(change.key, change.after);
      written.push(change);
    }
    return { ok: true, summary: plan.summary };
  } catch (error) {
    let restored = true;
    for (const change of written.reverse()) {
      try {
        if (change.before === null) storage.removeItem(change.key);
        else storage.setItem(change.key, change.before);
      } catch { restored = false; }
    }
    if (!restored) return fail('rollback_failed');
    return fail(/quota|exceed/i.test(`${error?.name} ${error?.message}`) || [22, 1014].includes(error?.code)
      ? 'quota' : 'unavailable');
  }
}
