/**
 * 候选答案的教学材料：选取、截断并拼成文本（纯函数）。
 *
 * 分工：主模型判断相关性（写 context），程序提供原文（本轮正文、学生本轮输入）。
 * 最近几轮对话只在主模型没写 context 时兜底。
 * 学习计划里的约定由程序每题附上，不依赖主模型是否填写。
 * 优先级：补充说明 > 约定 > 被引用内容 > 本轮正文 > 学生本轮输入 > 兜底历史；超预算时从低优先级开始截断。
 * 图只取标题，工具结果、源码、候选项和 reasoning 不进入材料。
 */

/** 材料总预算（字符，含分节标题）。 */
export const OPTION_CONTEXT_MAX_CHARS = 6000;

/** 兜底时最多回看的用户轮数（含本轮输入）。 */
export const OPTION_CONTEXT_MAX_TURNS = 6;

/** 材料来源：主模型已写 / 主模型声明无依赖 / 主模型漏写、程序兜底。 */
export const CONTEXT_SOURCES = Object.freeze({
  MODEL: 'model',
  NONE: 'none',
  FALLBACK: 'fallback',
});

/** 剩余预算小于此值时不再放入残段。 */
const MIN_FRAGMENT_CHARS = 40;

const VISUAL_TOOLS = new Set(['explain_card', 'visualize']);
const ELLIPSIS = '……';

/** 主模型声明「没有前置依赖」的写法。 */
const NO_CONTEXT_RE = /^(?:无|没有|none|n\/a)[。.]?$/i;

const clean = (value) => (typeof value === 'string' ? value.split('\u200B').join('').trim() : '');

/** 图只留标题；不是图或没有标题时返回空串。 */
export function visualTitle(toolName, input) {
  const title = VISUAL_TOOLS.has(toolName) ? clean(input?.title) : '';
  return title ? `（图：${title}）` : '';
}

function messageText(message) {
  if (typeof message?.content === 'string') return clean(message.content);
  if (!Array.isArray(message?.content)) return '';
  return message.content
    .map((part) => {
      if (part?.type === 'text') return clean(part.text);
      if (part?.type === 'tool-call') return visualTitle(part.toolName, part.input);
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

/** 协议消息 → 按时间排列的对话条目，只保留最近几轮。 */
function recentEntries(messages, maxTurns) {
  const entries = [];
  let turns = 0;
  for (let i = messages.length - 1; i >= 0 && turns < maxTurns; i -= 1) {
    const { role } = messages[i] ?? {};
    if (role !== 'user' && role !== 'assistant') continue;
    const text = messageText(messages[i]);
    if (text) entries.unshift(`${role === 'user' ? '学生' : '老师'}：${text}`);
    if (role === 'user') turns += 1;
  }
  return entries;
}

/** 截断到 max 个字符：补充说明保留开头，其余保留离问题最近的结尾。 */
function fit(text, max, keep) {
  const chars = [...text];
  if (chars.length <= max) return text;
  const room = max - ELLIPSIS.length;
  if (room < MIN_FRAGMENT_CHARS) return '';
  return keep === 'start'
    ? chars.slice(0, room).join('') + ELLIPSIS
    : ELLIPSIS + chars.slice(-room).join('');
}

/**
 * @param {Object} params
 * @param {Array}  [params.messages]     本轮发给主模型的消息，末条 user 为学生本轮输入
 * @param {string} [params.currentText]  本轮已生成的正文
 * @param {string} [params.modelContext] 主模型随问题给出的补充说明
 * @param {string[]} [params.conventions] 学习计划中的全程约定
 * @param {string} [params.references] 题目引用的图与讲解
 * @param {number} [params.maxChars]
 * @returns {{ text: string, source: string }} 没有可用材料时 text 为空串
 */
export function buildOptionContext({
  messages,
  currentText,
  modelContext,
  conventions,
  references,
  maxChars = OPTION_CONTEXT_MAX_CHARS,
} = {}) {
  const list = Array.isArray(messages) ? messages : [];
  const written = clean(modelContext);
  const declaredNone = NO_CONTEXT_RE.test(written);
  let source = CONTEXT_SOURCES.FALLBACK;
  if (declaredNone) source = CONTEXT_SOURCES.NONE;
  else if (written) source = CONTEXT_SOURCES.MODEL;

  let remaining = maxChars;

  /** 预留标题与段间空行；放不下则整节不要。 */
  const take = (title, body, keep) => {
    const overhead = [...title].length + 3;
    const text = body ? fit(body, remaining - overhead, keep) : '';
    if (!text) return '';
    remaining -= overhead + [...text].length;
    return `${title}\n${text}`;
  };

  const lastUser = list.findLastIndex((message) => message?.role === 'user');

  const note = declaredNone ? '' : take('【老师的补充说明】', written, 'start');
  const rules = (Array.isArray(conventions) ? conventions : []).map(clean).filter(Boolean);
  const agreed = take('【全程约定】', rules.map((item) => `- ${item}`).join('\n'), 'start');
  const quoted = take('【题目引用的内容】', clean(references), 'start');
  const current = take('【老师刚才的讲解】', clean(currentText), 'end');
  const input = take('【学生本轮的输入】', messageText(list[lastUser]), 'end');

  let history = '';
  if (source === CONTEXT_SOURCES.FALLBACK && lastUser > 0) {
    const title = '【之前的对话】';
    const picked = [];
    let room = remaining - [...title].length - 3;
    const entries = recentEntries(list.slice(0, lastUser), OPTION_CONTEXT_MAX_TURNS - 1);
    for (const entry of entries.reverse()) {
      const text = fit(entry, room, 'end');
      if (!text) break;
      picked.unshift(text);
      room -= [...text].length + 1;
      if (text !== entry) break;
    }
    if (picked.length > 0) history = `${title}\n${picked.join('\n')}`;
  }

  return { text: [history, input, current, quoted, agreed, note].filter(Boolean).join('\n\n'), source };
}

export default buildOptionContext;
