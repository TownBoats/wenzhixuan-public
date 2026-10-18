/**
 * 存储层 · v2 历史记录读写（阶段 E · 任务 E1）
 *
 * 职责：把 `chat_histories_v2` 的读写收敛到一个**纯模块**里，对上层一律返回结果、
 * 不抛异常（`E-历史存储与恢复.md` §4；决策见 `决策记录.md` **E-1**）。
 *
 * 五条硬约束：
 *   1. 不依赖组件框架、不访问浏览器存储或全局宿主对象、不产生 JSX —— 存储对象由参数注入，
 *      Node 测试传一个内存假实现即可（E4）。
 *   2. 旧键 `chat_histories` **不被新内容改写**：`saveConversation` 只写新键。
 *      只有 `deleteConversation` / `renameConversation` 按阶段文件 E1 的要求同时作用于两个键
 *      （`E-开发指导.md` E5 判据：删除后两个键都查不到该 ID）。
 *   3. 保存失败是**预期分支**（配额满），必须通过返回值暴露给界面；
 *      不允许只有一句 `console.error` 的假成功。
 *   4. 写入前做脏字段白名单剥离：函数、`AbortController`、未知键、reasoning 原文、
 *      开闸标记（U+200B）都进不去（`01-核心协议.md` §7）。
 *   5. 读到的坏数据只**跳过**、不丢弃整键、更不写回（除用户主动删除/重命名）。
 *
 * 为什么用「返回结果」而不是抛异常：配额满、数据损坏都是预期内的分支，
 * 用返回值表达时调用方必须处理；用异常表达很容易被一个空 catch 吞成「假保存成功」。
 */

/** 新键：v2 记录数组。 */
export const STORAGE_KEY_V2 = 'chat_histories_v2';
/** 旧键：v1 记录数组。本模块只读（删除/重命名除外）。 */
export const STORAGE_KEY_V1 = 'chat_histories';

/** 协议 §7 的版本号，写入时强制为这个值。 */
export const SCHEMA_VERSION = 2;

/** 自动标题长度：首条用户消息前 20 字（`决策记录.md` E-1 决策 4）。 */
export const TITLE_MAX_LENGTH = 20;

/** 失败原因。界面按这些值决定提示文案，不要在调用点写裸字符串。 */
export const STORE_REASONS = Object.freeze({
  QUOTA: 'quota',
  CORRUPT: 'corrupt',
  NOT_FOUND: 'not_found',
  INVALID: 'invalid',
  UNAVAILABLE: 'unavailable',
});

const GATE_MARKER = '\u200B';

const TURN_STATUSES = new Set([
  'streaming',
  'awaiting_user',
  'completed',
  'failed',
  'cancelled',
  'interrupted',
]);
const QUESTION_STATES = new Set(['pending', 'answered', 'skipped']);
const TOOL_STATUSES = new Set(['running', 'completed', 'failed']);
const USER_MESSAGE_SOURCES = new Set(['input', 'answer']);
/** 失败类别（协议 §5 / F3）：只落地运行层会产出的值，未知值归 null。 */
const ERROR_KINDS = new Set(['timeout', 'failed']);

/** 递归剥离的最大深度：只在防御循环引用 / 畸形嵌套时生效。 */
const MAX_VALUE_DEPTH = 6;

// ────────────────────────────── 基础工具 ──────────────────────────────

/** 去掉开闸标记；非字符串一律当空串（与 `conversationState.js` 同一口径）。 */
function stripGate(value) {
  if (typeof value !== 'string') return '';
  return value.split(GATE_MARKER).join('');
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

/** 标题归一：去开闸标记、折叠空白、去首尾空白。 */
function normalizeTitle(title) {
  return stripGate(typeof title === 'string' ? title : '')
    .replace(/\s+/g, ' ')
    .trim();
}

function unavailable(fields = {}) {
  return { ok: false, reason: STORE_REASONS.UNAVAILABLE, ...fields };
}

/**
 * 通用值清洗：只保留能安全序列化的部分。
 *
 * 函数 / `undefined` / `symbol` / `bigint` / `NaN` / `Infinity` 一律丢掉；
 * `AbortController` 这类宿主对象的自有可枚举属性为空，落地后是 `{}`，不携带任何运行时能力。
 * 深度上限用来挡住循环引用——这种数据本来就不该入库。
 */
function sanitizeValue(value, depth = 0) {
  if (value === null || value === undefined) return null;

  const type = typeof value;
  if (type === 'string') return stripGate(value);
  if (type === 'number') return Number.isFinite(value) ? value : null;
  if (type === 'boolean') return value;
  if (type !== 'object') return null;

  if (depth >= MAX_VALUE_DEPTH) return null;

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1)).filter((item) => item !== null);
  }

  const output = {};
  for (const key of Object.keys(value)) {
    const sanitized = sanitizeValue(value[key], depth + 1);
    if (sanitized === null) continue;
    output[key] = sanitized;
  }
  return output;
}

// ────────────────────────────── 标题 ──────────────────────────────

/** 旧记录（v1）里第一条用户消息的文本。v1 的 `content` 有字符串和片段数组两种形状。 */
function firstUserTextFromMessages(messages) {
  if (!Array.isArray(messages)) return '';
  for (const message of messages) {
    if (!isPlainObject(message) || message.role !== 'user') continue;
    const content = message.content;
    if (typeof content === 'string' && content.trim()) return content;
    if (Array.isArray(content)) {
      const joined = content
        .map((part) => {
          if (typeof part === 'string') return part;
          if (isPlainObject(part)) return typeof part.value === 'string' ? part.value : (part.text ?? '');
          return '';
        })
        .join('');
      if (joined.trim()) return joined;
    }
  }
  return '';
}

/**
 * 自动标题：首条用户消息前 20 字（按码点截，避免把 emoji 切成半个）。
 *
 * 无可取文本时返回**空串**，由界面决定怎么显示「未命名会话」——
 * 本模块是纯函数，不接触 i18n，也不该硬编码某一种语言的兜底文案。
 */
export function deriveTitle(record) {
  if (!isPlainObject(record)) return '';

  let text = '';
  const turns = Array.isArray(record.turns) ? record.turns : [];
  for (const turn of turns) {
    const candidate = isPlainObject(turn) ? turn.userMessage?.text : '';
    if (typeof candidate === 'string' && candidate.trim()) {
      text = candidate;
      break;
    }
  }
  if (!text) text = firstUserTextFromMessages(record.messages);

  const clean = normalizeTitle(text);
  if (!clean) return '';
  return Array.from(clean).slice(0, TITLE_MAX_LENGTH).join('');
}

// ────────────────────────────── 脏字段剥离（白名单） ──────────────────────────────

function sanitizeUserMessage(message) {
  if (!isPlainObject(message)) return null;
  const text = stripGate(message.text).trim();
  if (!text) return null;
  return {
    text,
    source: USER_MESSAGE_SOURCES.has(message.source) ? message.source : 'input',
    questionId: isNonEmptyString(message.questionId) ? message.questionId : null,
    selectedLevel: isNonEmptyString(message.selectedLevel) ? message.selectedLevel : null,
  };
}

function sanitizeOption(option) {
  if (!isPlainObject(option)) return null;
  const text = stripGate(option.text);
  if (!text.trim()) return null;
  if (typeof option.level !== 'string' || !option.level) return null;
  return { level: option.level, text };
}

function sanitizeQuestion(question) {
  if (!isPlainObject(question)) return null;
  const id = isNonEmptyString(question.id) ? question.id : '';
  const text = stripGate(question.text);
  if (!id || !text.trim()) return null;

  const options = Array.isArray(question.options)
    ? question.options.map(sanitizeOption).filter(Boolean)
    : [];
  const optionsStatus =
    question.optionsStatus === 'ready' || question.optionsStatus === 'unavailable'
      ? question.optionsStatus
      : options.length > 0
        ? 'ready'
        : 'unavailable';

  return {
    toolCallId: isNonEmptyString(question.toolCallId) ? question.toolCallId : null,
    id,
    text,
    options,
    optionsStatus,
    answer: typeof question.answer === 'string' ? stripGate(question.answer) : null,
    selectedLevel: isNonEmptyString(question.selectedLevel) ? question.selectedLevel : null,
    state: QUESTION_STATES.has(question.state) ? question.state : 'pending',
  };
}

/**
 * 展示片段。
 *
 * **reasoning 片段不入库**（协议 §7 禁止 reasoning 原文）：刷新后思考块不再出现，
 * 这是既定取舍，不是丢数据——正文、工具卡、问题卡都在 `parts` / `questions` 里。
 */
function sanitizePart(part) {
  if (!isPlainObject(part)) return null;

  if (part.type === 'text') {
    const text = stripGate(part.text);
    if (!text) return null;
    return {
      type: 'text',
      partId: isNonEmptyString(part.partId) ? part.partId : null,
      runId: isNonEmptyString(part.runId) ? part.runId : null,
      text,
    };
  }

  if (part.type === 'tool') {
    if (!isNonEmptyString(part.toolCallId)) return null;
    const output = sanitizeValue(part.output);
    return {
      type: 'tool',
      toolCallId: part.toolCallId,
      toolName: isNonEmptyString(part.toolName) ? part.toolName : null,
      input: sanitizeValue(part.input),
      // 没有状态时按「有没有结果」推断，避免把已完成的卡显示成失败
      status: TOOL_STATUSES.has(part.status)
        ? part.status
        : output
          ? 'completed'
          : 'failed',
      output,
      error: typeof part.error === 'string' ? stripGate(part.error) : null,
      runId: isNonEmptyString(part.runId) ? part.runId : null,
    };
  }

  // reasoning 与未知类型一律丢弃
  return null;
}

/** 协议消息只保留文本 / 调用 / 结果三类片段，且与原实现同一形状。 */
function sanitizeModelMessage(message) {
  if (!isPlainObject(message)) return null;
  const role = isNonEmptyString(message.role) ? message.role : '';
  if (!role) return null;

  if (typeof message.content === 'string') {
    const content = stripGate(message.content);
    return content.trim() ? { role, content } : null;
  }
  if (!Array.isArray(message.content)) return null;

  const parts = [];
  for (const part of message.content) {
    if (!isPlainObject(part)) continue;

    if (part.type === 'text') {
      const text = stripGate(part.text);
      if (text.trim()) parts.push({ type: 'text', text });
      continue;
    }
    if (part.type === 'tool-call') {
      if (!isNonEmptyString(part.toolCallId)) continue;
      parts.push({
        type: 'tool-call',
        toolCallId: part.toolCallId,
        toolName: isNonEmptyString(part.toolName) ? part.toolName : null,
        input: sanitizeValue(part.input),
      });
      continue;
    }
    if (part.type === 'tool-result') {
      if (!isNonEmptyString(part.toolCallId)) continue;
      parts.push({
        type: 'tool-result',
        toolCallId: part.toolCallId,
        toolName: isNonEmptyString(part.toolName) ? part.toolName : null,
        output: sanitizeValue(part.output),
      });
      continue;
    }
    // reasoning 及其它片段不进上下文、也不入库（不变量 3）
  }

  return parts.length > 0 ? { role, content: parts } : null;
}

function sanitizeTurn(turn) {
  if (!isPlainObject(turn)) return null;

  return {
    // turn 缺 id 时保留内容（宁可少一个可重试身份，也不丢一轮正文）
    id: isNonEmptyString(turn.id) ? turn.id : '',
    runId: isNonEmptyString(turn.runId) ? turn.runId : null,
    modeSnapshot: isNonEmptyString(turn.modeSnapshot) ? turn.modeSnapshot : null,
    /**
     * 缺失或非法状态一律视为 `interrupted`：宁可不进模型上下文，
     * 也不把半截内容当成模型说过的话（`buildModelContext` 只发 completed / awaiting_user）。
     */
    status: TURN_STATUSES.has(turn.status) ? turn.status : 'interrupted',
    userMessage: sanitizeUserMessage(turn.userMessage),
    modelMessages: Array.isArray(turn.modelMessages)
      ? turn.modelMessages.map(sanitizeModelMessage).filter(Boolean)
      : [],
    parts: Array.isArray(turn.parts) ? turn.parts.map(sanitizePart).filter(Boolean) : [],
    questions: Array.isArray(turn.questions) ? turn.questions.map(sanitizeQuestion).filter(Boolean) : [],
    error: typeof turn.error === 'string' ? stripGate(turn.error) : null,
    // 失败类别（协议 §5 / F3）：只接受运行层会产出的两个值，其余归 null
    errorKind: ERROR_KINDS.has(turn.errorKind) ? turn.errorKind : null,
  };
}

/**
 * 把任意输入整理成一条可入库的 v2 记录；`id` 不合法时返回 `null`（调用方回 `invalid`）。
 * 只挑协议 §5 / §7 里的字段，未知字段一律不落地。
 */
export function sanitizeConversation(record) {
  if (!isPlainObject(record)) return null;
  const id = isNonEmptyString(record.id) ? record.id.trim() : '';
  if (!id) return null;

  return {
    id,
    title: normalizeTitle(record.title),
    timestamp: Number.isFinite(record.timestamp) && record.timestamp > 0 ? record.timestamp : 0,
    schemaVersion: SCHEMA_VERSION,
    mode: isNonEmptyString(record.mode) ? record.mode : null,
    turns: Array.isArray(record.turns) ? record.turns.map(sanitizeTurn).filter(Boolean) : [],
  };
}

// ────────────────────────────── 存储适配 ──────────────────────────────

function isUsableStorage(storage) {
  return (
    Boolean(storage) &&
    typeof storage.getItem === 'function' &&
    typeof storage.setItem === 'function' &&
    typeof storage.removeItem === 'function'
  );
}

/**
 * 配额判断：不同宿主抛的错形状不一样（Chrome/Firefox 的 `name`、Safari 的 `code`），
 * 全都认一遍；认不出来的一律算 `unavailable`，不假装是配额问题。
 */
function resolveWriteReason(error) {
  const name = typeof error?.name === 'string' ? error.name : '';
  const code = error?.code;
  const message = typeof error?.message === 'string' ? error.message : '';
  if (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    code === 22 ||
    code === 1014 ||
    /quota/i.test(message) ||
    /exceed/i.test(message)
  ) {
    return STORE_REASONS.QUOTA;
  }
  return STORE_REASONS.UNAVAILABLE;
}

/**
 * 读一个键。
 *
 * - `entries`：JSON 里原样的数组，**写入时用它**，这样无法识别的条目不会被顺手删掉；
 * - `items`：能当作记录用的条目（对象 + 非空字符串 id）；
 * - `corrupt`：不可读条目数；整键不可解析时记 1 并置 `broken`；
 * - `broken`：整键不可用（解析失败 / 不是数组）——此时**禁止写入**，否则等于用一个键覆盖全部历史。
 */
function readRecords(storage, key) {
  let raw;
  try {
    raw = storage.getItem(key);
  } catch {
    return { ok: false, entries: [], items: [], corrupt: 0, broken: false };
  }

  if (typeof raw !== 'string' || raw.trim() === '') {
    return { ok: true, entries: [], items: [], corrupt: 0, broken: false };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: true, entries: [], items: [], corrupt: 1, broken: true };
  }
  if (!Array.isArray(parsed)) {
    return { ok: true, entries: [], items: [], corrupt: 1, broken: true };
  }

  let corrupt = 0;
  const items = [];
  for (const entry of parsed) {
    if (!isPlainObject(entry) || !isNonEmptyString(entry.id)) {
      corrupt += 1;
      continue;
    }
    items.push(entry);
  }

  return { ok: true, entries: parsed, items, corrupt, broken: false };
}

function writeRecords(storage, key, entries) {
  try {
    storage.setItem(key, JSON.stringify(entries));
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: resolveWriteReason(error) };
  }
}

function findIndexById(entries, id) {
  return entries.findIndex((entry) => isPlainObject(entry) && entry.id === id);
}

// ────────────────────────────── 工厂 ──────────────────────────────

/**
 * 创建一个绑定到具体 storage 的读写门面。
 *
 * @param {{getItem: Function, setItem: Function, removeItem: Function}} storage
 *   页面传浏览器的本地存储对象；测试传内存假实现。对象不可用时所有函数返回
 *   `{ ok:false, reason:'unavailable' }`，而不是抛异常。
 */
export function createHistoryStore(storage) {
  /** 读两个键。旧键的条目**原样**返回（E2 还要从 `messages` / `uiMessages` 里投影）。 */
  function loadAll() {
    if (!isUsableStorage(storage)) {
      return unavailable({ v2: [], v1: [], corrupt: { v2: 0, v1: 0 } });
    }

    const v2 = readRecords(storage, STORAGE_KEY_V2);
    const v1 = readRecords(storage, STORAGE_KEY_V1);
    if (!v2.ok || !v1.ok) {
      return unavailable({
        v2: [],
        v1: [],
        corrupt: { v2: v2.corrupt ?? 0, v1: v1.corrupt ?? 0 },
      });
    }

    const conversations = [];
    for (const entry of v2.items) {
      const record = sanitizeConversation(entry);
      if (record) conversations.push(record);
    }

    return {
      ok: true,
      v2: conversations,
      v1: v1.items,
      corrupt: { v2: v2.corrupt, v1: v1.corrupt },
    };
  }

  /** 新键优先，找不到再查旧键（旧键返回原样记录，由 E2 投影）。 */
  function loadById(id) {
    if (!isUsableStorage(storage)) return unavailable();
    if (!isNonEmptyString(id)) return { ok: false, reason: STORE_REASONS.INVALID };

    const v2 = readRecords(storage, STORAGE_KEY_V2);
    const v1 = readRecords(storage, STORAGE_KEY_V1);
    const corrupt = { v2: v2.corrupt ?? 0, v1: v1.corrupt ?? 0 };

    const freshEntry = v2.items.find((entry) => entry.id === id);
    if (freshEntry) {
      const record = sanitizeConversation(freshEntry);
      if (record) return { ok: true, record, source: 'v2', corrupt };
    }

    const legacyEntry = v1.items.find((entry) => entry.id === id);
    if (legacyEntry) return { ok: true, record: legacyEntry, source: 'v1', corrupt };

    return { ok: false, reason: STORE_REASONS.NOT_FOUND, corrupt };
  }

  /**
   * 侧栏列表：合并两键、同 ID 新键优先、按 `timestamp` 倒序。
   *
   * 排序带 `id` 次序作为并列时的兜底，保证同一份数据每次顺序一致（便于测试与比对）。
   */
  function listForSidebar() {
    if (!isUsableStorage(storage)) return unavailable({ items: [], corrupt: { v2: 0, v1: 0 } });

    const v2 = readRecords(storage, STORAGE_KEY_V2);
    const v1 = readRecords(storage, STORAGE_KEY_V1);
    if (!v2.ok || !v1.ok) {
      return unavailable({ items: [], corrupt: { v2: v2.corrupt ?? 0, v1: v1.corrupt ?? 0 } });
    }

    const byId = new Map();

    const toItem = (record, source) => ({
      id: record.id,
      title: normalizeTitle(record.title) || deriveTitle(record),
      timestamp: Number.isFinite(record.timestamp) ? record.timestamp : 0,
      source,
    });

    for (const entry of v1.items) byId.set(entry.id, toItem(entry, 'v1'));
    for (const entry of v2.items) {
      const record = sanitizeConversation(entry);
      if (!record) continue;
      byId.set(record.id, toItem(record, 'v2'));
    }

    const items = [...byId.values()].sort(
      (a, b) => b.timestamp - a.timestamp || String(a.id).localeCompare(String(b.id)),
    );

    return { ok: true, items, corrupt: { v2: v2.corrupt, v1: v1.corrupt } };
  }

  /**
   * 保存一条会话到**新键**（决策 3 = A：旧键不被续聊内容改写）。
   *
   * - 新键整键不可解析时**拒写**并回 `corrupt`（决策点 3 = A）：交给用户抢救，不覆盖。
   * - 其他条目原样保留（含无法识别的条目），只有目标 id 这一条被替换。
   */
  function saveConversation(conversation) {
    if (!isUsableStorage(storage)) return unavailable();

    const record = sanitizeConversation(conversation);
    if (!record) return { ok: false, reason: STORE_REASONS.INVALID };

    const existing = readRecords(storage, STORAGE_KEY_V2);
    if (!existing.ok) return unavailable();
    if (existing.broken) return { ok: false, reason: STORE_REASONS.CORRUPT };

    const title = normalizeTitle(record.title) || deriveTitle(record);
    const nextRecord = {
      ...record,
      title,
      timestamp: record.timestamp > 0 ? record.timestamp : Date.now(),
    };

    const entries = existing.entries.slice();
    const index = findIndexById(entries, nextRecord.id);
    if (index >= 0) entries[index] = nextRecord;
    else entries.unshift(nextRecord);

    const write = writeRecords(storage, STORAGE_KEY_V2, entries);
    if (!write.ok) return write;

    return { ok: true, id: nextRecord.id, title: nextRecord.title };
  }

  /**
   * 删除：**同时作用于两个键**（阶段文件 E1 / E5 判据）。
   *
   * 任一个键整键损坏时直接回 `corrupt` 且不写任何东西——半删比不删更难收拾。
   */
  function deleteConversation(id) {
    if (!isUsableStorage(storage)) return unavailable();
    if (!isNonEmptyString(id)) return { ok: false, reason: STORE_REASONS.INVALID };

    const v2 = readRecords(storage, STORAGE_KEY_V2);
    const v1 = readRecords(storage, STORAGE_KEY_V1);
    if (!v2.ok || !v1.ok) return unavailable();
    if (v2.broken || v1.broken) return { ok: false, reason: STORE_REASONS.CORRUPT };

    const entriesV2 = v2.entries.filter((entry) => !(isPlainObject(entry) && entry.id === id));
    const entriesV1 = v1.entries.filter((entry) => !(isPlainObject(entry) && entry.id === id));
    const removedV2 = entriesV2.length !== v2.entries.length;
    const removedV1 = entriesV1.length !== v1.entries.length;

    if (!removedV2 && !removedV1) return { ok: false, reason: STORE_REASONS.NOT_FOUND };

    if (removedV2) {
      const writeV2 = writeRecords(storage, STORAGE_KEY_V2, entriesV2);
      if (!writeV2.ok) return { ok: false, reason: writeV2.reason, removed: { v2: false, v1: false } };
    }
    if (removedV1) {
      const writeV1 = writeRecords(storage, STORAGE_KEY_V1, entriesV1);
      if (!writeV1.ok) {
        return { ok: false, reason: writeV1.reason, removed: { v2: removedV2, v1: false } };
      }
    }

    return { ok: true, removed: { v2: removedV2, v1: removedV1 } };
  }

  /**
   * 重命名：同样作用于两个键。
   *
   * 空标题回退到自动标题（`deriveTitle`）；两键都取不到时回 `not_found`。
   * 改写旧键**只改 `title`**，其余字段（`messages` / `uiMessages`）原样保留。
   */
  function renameConversation(id, title) {
    if (!isUsableStorage(storage)) return unavailable();
    if (!isNonEmptyString(id)) return { ok: false, reason: STORE_REASONS.INVALID };

    const requested = normalizeTitle(title);

    const v2 = readRecords(storage, STORAGE_KEY_V2);
    if (!v2.ok) return unavailable();
    if (v2.broken) return { ok: false, reason: STORE_REASONS.CORRUPT };

    const indexV2 = findIndexById(v2.entries, id);
    if (indexV2 >= 0) {
      const current = sanitizeConversation(v2.entries[indexV2]);
      if (!current) return { ok: false, reason: STORE_REASONS.INVALID };

      const finalTitle = requested || deriveTitle(current);
      const entries = v2.entries.slice();
      entries[indexV2] = { ...current, title: finalTitle };

      const write = writeRecords(storage, STORAGE_KEY_V2, entries);
      if (!write.ok) return write;

      return { ok: true, id, title: finalTitle, source: 'v2' };
    }

    const v1 = readRecords(storage, STORAGE_KEY_V1);
    if (!v1.ok) return unavailable();
    if (v1.broken) return { ok: false, reason: STORE_REASONS.CORRUPT };

    const indexV1 = findIndexById(v1.entries, id);
    if (indexV1 < 0) return { ok: false, reason: STORE_REASONS.NOT_FOUND };

    const legacy = v1.entries[indexV1];
    const finalTitle = requested || deriveTitle(legacy);
    const entries = v1.entries.slice();
    entries[indexV1] = { ...legacy, title: finalTitle };

    const write = writeRecords(storage, STORAGE_KEY_V1, entries);
    if (!write.ok) return write;

    return { ok: true, id, title: finalTitle, source: 'v1' };
  }

  return {
    loadAll,
    loadById,
    listForSidebar,
    saveConversation,
    deleteConversation,
    renameConversation,
  };
}

export default createHistoryStore;
