/**
 * 学习链路 · 独立存储（ADR-001 §3.3）
 *
 * 独立的键 `learning_journals_v1`，不改 `chat_histories_v2` 的结构，
 * 也不与会话写入强求原子性：这是可由会话历史重新推导的派生数据。
 *
 * 失败语义沿用 `historyStore`：返回 `{ ok:false, reason }`，调用方显式提示，
 * 不假装保存成功；整键不可解析时拒写（交给用户抢救，不覆盖）。
 */
import { LEARNING_EVENT_TYPES, LEARNING_SCHEMA_VERSION } from './learningJournal.js';

export const LEARNING_STORAGE_KEY = 'learning_journals_v1';

export const LEARNING_STORE_REASONS = Object.freeze({
  INVALID: 'invalid',
  CORRUPT: 'corrupt',
  NOT_FOUND: 'not_found',
  UNAVAILABLE: 'unavailable',
  QUOTA: 'quota',
  UNKNOWN: 'unknown',
});

const VALID_STATUSES = new Set(['ready', 'failed']);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function unavailable(fields = {}) {
  return { ok: false, reason: LEARNING_STORE_REASONS.UNAVAILABLE, ...fields };
}

function isUsableStorage(storage) {
  return Boolean(storage) && typeof storage.getItem === 'function' && typeof storage.setItem === 'function';
}

function sanitizeNodes(nodes) {
  const list = Array.isArray(nodes) ? nodes : [];
  const result = [];

  for (const node of list) {
    if (!isPlainObject(node)) continue;
    if (!LEARNING_EVENT_TYPES.includes(node.type)) continue;
    // 主题是标题；没有主题的旧节点无法展示，按无效处理
    if (typeof node.topic !== 'string' || !node.topic.trim()) continue;
    const points = (Array.isArray(node.points) ? node.points : []).filter(
      (point) => typeof point === 'string' && point.trim(),
    );
    if (points.length === 0) continue;
    result.push({
      topic: node.topic.trim(),
      type: node.type,
      points: points.slice(0, 3),
      evidence: typeof node.evidence === 'string' ? node.evidence : '',
    });
  }

  return result;
}

function sanitizeUnit(unit) {
  if (!isPlainObject(unit)) return null;
  if (!isNonEmptyString(unit.key)) return null;
  if (!isNonEmptyString(unit.turnId)) return null;

  return {
    key: unit.key,
    turnId: unit.turnId,
    nextTurnId: isNonEmptyString(unit.nextTurnId) ? unit.nextTurnId : null,
    runId: isNonEmptyString(unit.runId) ? unit.runId : null,
    inputHash: typeof unit.inputHash === 'string' ? unit.inputHash : '',
    prevDigest: typeof unit.prevDigest === 'string' ? unit.prevDigest : '',
    stateDigest: typeof unit.stateDigest === 'string' ? unit.stateDigest : '',
    extractorVersion: typeof unit.extractorVersion === 'string' ? unit.extractorVersion : '',
    status: VALID_STATUSES.has(unit.status) ? unit.status : 'failed',
    goal: typeof unit.goal === 'string' ? unit.goal : '',
    nodes: sanitizeNodes(unit.nodes),
    reason: typeof unit.reason === 'string' ? unit.reason : '',
    updatedAt: Number.isFinite(unit.updatedAt) ? unit.updatedAt : 0,
  };
}

export function sanitizeJournal(record) {
  if (!isPlainObject(record)) return null;
  if (!isNonEmptyString(record.conversationId)) return null;

  const units = (Array.isArray(record.units) ? record.units : [])
    .map(sanitizeUnit)
    .filter(Boolean);

  return {
    conversationId: record.conversationId,
    schemaVersion: LEARNING_SCHEMA_VERSION,
    units,
    updatedAt: Number.isFinite(record.updatedAt) ? record.updatedAt : 0,
  };
}

function resolveWriteReason(error) {
  const name = String(error?.name ?? '');
  if (name === 'QuotaExceededError') return LEARNING_STORE_REASONS.QUOTA;
  return LEARNING_STORE_REASONS.UNKNOWN;
}

/**
 * 读整键。不可解析时回 `broken:true` 并保留原始条目数，便于上层决定拒写。
 */
function readEntries(storage) {
  if (!isUsableStorage(storage)) return unavailable({ entries: [], broken: false });

  let raw;
  try {
    raw = storage.getItem(LEARNING_STORAGE_KEY);
  } catch {
    return unavailable({ entries: [], broken: false });
  }

  if (raw == null) return { ok: true, entries: [], broken: false };

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: LEARNING_STORE_REASONS.CORRUPT, entries: [], broken: true };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, reason: LEARNING_STORE_REASONS.CORRUPT, entries: [], broken: true };
  }

  return { ok: true, entries: parsed, broken: false };
}

function writeEntries(storage, entries) {
  try {
    storage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(entries));
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: resolveWriteReason(error) };
  }
}

/**
 * @param {Storage} storage 浏览器 localStorage 或测试替身
 */
export function createLearningJournalStore(storage) {
  /** 取一条会话的学习记录；没有就回 `record:null`（不是错误）。 */
  function load(conversationId) {
    if (!isUsableStorage(storage)) return unavailable({ record: null });
    if (!isNonEmptyString(conversationId)) {
      return { ok: false, reason: LEARNING_STORE_REASONS.INVALID, record: null };
    }

    const read = readEntries(storage);
    if (!read.ok) return { ok: false, reason: read.reason, record: null };

    const entry = read.entries.find(
      (item) => isPlainObject(item) && item.conversationId === conversationId,
    );
    if (!entry) return { ok: true, record: null };

    const record = sanitizeJournal(entry);
    if (!record) return { ok: false, reason: LEARNING_STORE_REASONS.CORRUPT, record: null };

    return { ok: true, record };
  }

  /** 整条记录覆盖写入（同 conversationId 替换，其余条目原样保留）。 */
  function save(record) {
    if (!isUsableStorage(storage)) return unavailable();
    const clean = sanitizeJournal(record);
    if (!clean) return { ok: false, reason: LEARNING_STORE_REASONS.INVALID };

    const read = readEntries(storage);
    if (!read.ok) return { ok: false, reason: read.reason };
    if (read.broken) return { ok: false, reason: LEARNING_STORE_REASONS.CORRUPT };

    const entries = read.entries.slice();
    const index = entries.findIndex(
      (item) => isPlainObject(item) && item.conversationId === clean.conversationId,
    );
    const next = { ...clean, updatedAt: Date.now() };

    if (index >= 0) entries[index] = next;
    else entries.unshift(next);

    const write = writeEntries(storage, entries);
    if (!write.ok) return write;

    return { ok: true, conversationId: next.conversationId };
  }

  /** 删除会话时一并删除；本键没有该会话不算错误，回 `removed:false`。 */
  function remove(conversationId) {
    if (!isUsableStorage(storage)) return unavailable({ removed: false });
    if (!isNonEmptyString(conversationId)) {
      return { ok: false, reason: LEARNING_STORE_REASONS.INVALID, removed: false };
    }

    const read = readEntries(storage);
    if (!read.ok) return { ok: false, reason: read.reason, removed: false };

    const entries = read.entries.filter(
      (item) => !(isPlainObject(item) && item.conversationId === conversationId),
    );
    if (entries.length === read.entries.length) return { ok: true, removed: false };

    const write = writeEntries(storage, entries);
    if (!write.ok) return { ok: false, reason: write.reason, removed: false };

    return { ok: true, removed: true };
  }

  return { load, save, remove };
}

export default createLearningJournalStore;
