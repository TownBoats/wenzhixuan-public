/**
 * 图与讲解的引用：编号、收集、解析（纯函数）。
 *
 * - 图的编号 `fig-xxxxxx` 由程序生成，随工具结果保存；「图 N」只是界面的显示编号
 * - 概念以 `concept:<id>` 引用，指向它最近一次成为当前概念的那一轮
 * - 引用只是定位标识，不含地址，也不会被执行
 */
import { PLAN_TOOL_NAME, planFromToolOutput } from './learningPlan.js';

export const MAX_REFS = 3;

/** 同一步里刚画的图还没有编号可用，用它指代。 */
export const LATEST_FIGURE = 'latest_figure';

const FIGURE_TOOLS = new Set(['explain_card', 'visualize']);
const FIGURE_RE = /^fig-[a-z0-9]{6}$/;
const CONCEPT_RE = /^concept:[a-z0-9][a-z0-9_-]{0,39}$/i;
const REFERENCE_MAX_CHARS = 500;

/** 去掉模型可能带上的 `#`、`ref:` 前缀；不是合法引用返回 null。 */
export function normalizeRef(value) {
  if (typeof value !== 'string') return null;
  const ref = value.trim().replace(/^#/, '').replace(/^ref:/, '');
  return FIGURE_RE.test(ref) || CONCEPT_RE.test(ref) ? ref : null;
}

/** 形如引用的链接，无论编号是否有效。 */
export function isRefHref(href) {
  return typeof href === 'string' && /^#(ref|concept):/.test(href);
}

/** 链接地址 → 引用；普通链接返回 null。 */
export function refFromHref(href) {
  return isRefHref(href) ? normalizeRef(href) : null;
}

/** 清洗已保存的引用列表。 */
export function sanitizeRefs(value) {
  const refs = (Array.isArray(value) ? value : []).map(normalizeRef).filter(Boolean);
  return [...new Set(refs)].slice(0, MAX_REFS);
}

/** 工具结果是带编号的就绪图时返回 { refId, title }。 */
export function figureFromToolOutput(toolName, output) {
  const value = output?.type === 'json' ? output.value : output;
  if (!FIGURE_TOOLS.has(toolName) || value?.status !== 'ready') return null;
  if (typeof value.refId !== 'string' || !FIGURE_RE.test(value.refId)) return null;
  return { refId: value.refId, title: typeof value.title === 'string' ? value.title : '' };
}

/** 生成会话内不重复的图编号。 */
export function createFigureId(isTaken = () => false, random = Math.random) {
  for (;;) {
    const suffix = Math.floor(random() * 36 ** 6).toString(36).padStart(6, '0');
    const refId = `fig-${suffix}`;
    if (!isTaken(refId)) return refId;
  }
}

/** 协议消息 → 可引用的目标：`ref → { title, text }`，text 是所在轮的讲解。 */
export function collectReferences(messages) {
  const targets = new Map();
  let turn = { text: '' };
  let currentConceptId = '';
  for (const message of Array.isArray(messages) ? messages : []) {
    if (message?.role === 'user') turn = { text: '' };
    if (message?.role === 'assistant' && typeof message.content === 'string') turn.text += `${message.content}\n`;
    for (const part of Array.isArray(message?.content) ? message.content : []) {
      if (message.role === 'assistant' && part?.type === 'text') turn.text += `${part.text}\n`;
      if (part?.type !== 'tool-result') continue;
      const figure = figureFromToolOutput(part.toolName, part.output);
      if (figure) targets.set(figure.refId, { title: `图「${figure.title}」`, turn });
      if (part.toolName !== PLAN_TOOL_NAME) continue;
      const plan = planFromToolOutput(part.output);
      if (!plan || plan.currentConceptId === currentConceptId) continue;
      currentConceptId = plan.currentConceptId;
      const concept = plan.concepts.find((item) => item.id === currentConceptId);
      if (concept) targets.set(`concept:${concept.id}`, { title: `概念「${concept.name}」`, turn });
    }
  }
  return new Map([...targets].map(([ref, item]) => [ref, { title: item.title, text: item.turn.text.trim() }]));
}

/**
 * 解析模型给出的引用：未知的忽略并单独列出，不报错。
 *
 * @returns {{ refs: string[], unknown: string[] }}
 */
export function resolveRefs(input, isKnown, latestFigure = null) {
  const refs = [];
  const unknown = [];
  for (const value of (Array.isArray(input) ? input : []).slice(0, MAX_REFS * 2)) {
    const ref = value === LATEST_FIGURE ? latestFigure : normalizeRef(value);
    if (!ref || !isKnown(ref)) unknown.push(String(value).slice(0, 50));
    else if (!refs.includes(ref) && refs.length < MAX_REFS) refs.push(ref);
  }
  return { refs, unknown };
}

/** 被引用内容 → 候选答案材料：标题与所在轮讲解的开头。 */
export function describeRefs(refs, targets) {
  return refs
    .map((ref) => targets.get(ref))
    .filter(Boolean)
    .map(({ title, text }) => {
      const chars = [...(text ?? '')];
      const body = chars.slice(0, REFERENCE_MAX_CHARS).join('') + (chars.length > REFERENCE_MAX_CHARS ? '……' : '');
      return body ? `${title}，当时的讲解：\n${body}` : title;
    })
    .join('\n');
}
