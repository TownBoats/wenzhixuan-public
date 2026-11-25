/**
 * 学习计划：结构、增量合并与证据校验（纯函数）。
 *
 * 计划没有独立存储：每次工具结果都是全量快照，最近一份合格的快照就是当前计划。
 * 程序只保证结构与证据来源，不判断教学内容是否正确。
 */

export const PLAN_TOOL_NAME = 'update_learning_plan';

export const CONCEPT_STATUSES = Object.freeze(['unknown', 'gap', 'claimed', 'verified']);

export const PLAN_LIMITS = Object.freeze({
  goal: 200,
  nextStep: 200,
  conventions: 10,
  convention: 100,
  concepts: 20,
  name: 30,
  requires: 10,
  evidence: 300,
});

/** 证据去掉标点空白后的最短长度：太短的片段到处都能匹配。 */
const EVIDENCE_MIN_CHARS = 4;

const PLAN_FIELDS = new Set([
  'goal',
  'conventions',
  'concepts',
  'removedConceptIds',
  'currentConceptId',
  'nextStep',
]);
const CONCEPT_FIELDS = new Set(['id', 'name', 'status', 'requires', 'evidence']);
const ID_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/i;

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const clean = (value) => (typeof value === 'string' ? value.split('\u200B').join('').trim() : '');
const charLength = (text) => [...text].length;
const isStringArray = (value) => Array.isArray(value) && value.every((item) => typeof item === 'string');

// ────────────────────────────── 读取 ──────────────────────────────

/** 把任意来源（历史、备份）的快照整理成合法计划；没有目标时返回 null。 */
export function normalizePlan(value) {
  if (!isObject(value)) return null;
  const goal = clean(value.goal);
  if (!goal) return null;

  const concepts = [];
  const ids = new Set();
  for (const item of Array.isArray(value.concepts) ? value.concepts : []) {
    const id = clean(item?.id);
    const name = clean(item?.name);
    if (!ID_RE.test(id) || !name || ids.has(id)) continue;
    ids.add(id);
    const status = CONCEPT_STATUSES.includes(item.status) ? item.status : 'unknown';
    const evidence = clean(item.evidence);
    concepts.push({
      id,
      name,
      // 没有证据的「已验证」不可信
      status: status === 'verified' && !evidence ? 'claimed' : status,
      requires: isStringArray(item.requires) ? item.requires.map(clean) : [],
      ...(status === 'verified' && evidence ? { evidence } : {}),
    });
  }
  const currentConceptId = clean(value.currentConceptId);
  return {
    goal,
    conventions: isStringArray(value.conventions) ? value.conventions.map(clean).filter(Boolean) : [],
    currentConceptId: ids.has(currentConceptId) ? currentConceptId : '',
    nextStep: clean(value.nextStep),
    concepts: concepts.map((item) => ({ ...item, requires: item.requires.filter((id) => ids.has(id)) })),
  };
}

/** 工具结果 → 计划；兼容 SDK 的 `{ type:'json', value }` 包装。 */
export function planFromToolOutput(output) {
  const value = output?.type === 'json' ? output.value : output;
  return value?.status === 'ready' ? normalizePlan(value.plan) : null;
}

/** 协议消息中最近一份合格的计划。 */
export function planFromMessages(messages) {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const parts = Array.isArray(list[i]?.content) ? list[i].content : [];
    for (let j = parts.length - 1; j >= 0; j -= 1) {
      if (parts[j]?.type !== 'tool-result' || parts[j].toolName !== PLAN_TOOL_NAME) continue;
      const plan = planFromToolOutput(parts[j].output);
      if (plan) return plan;
    }
  }
  return null;
}

// ────────────────────────────── 证据 ──────────────────────────────

const stripMarks = (text) => clean(text).toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');

/** 比对用：只去空白与标点，保留运算符等符号，避免 a>b 与 a<b 被当成一样。 */
const normalizeQuote = (text) => clean(text).toLowerCase().replace(/[\s\p{P}]/gu, '');

/** 自评用语。长词在前，避免「完全」先被「全」拆开。 */
const SELF_RATING_RE =
  /我觉得|我感觉|我认为|觉得|感觉|应该是|应该|已经|完全|全部|基本上|基本|差不多|大概|真的|现在|终于|没有问题|没问题|没有疑问|没疑问|都会|明白|理解|知道|掌握|清楚|学会|弄懂|搞懂|听懂|看懂|这个概念|这个|这些|这里|这块|概念|内容|地方|好的|是的|谢谢|老师|继续|可以|iunderstand|understand|igetit|gotit|iknow|ithink|yes|ok|我|你|全|都|懂|会|了|的|吧|呢|啊|嗯|哦|对|好|很|也|就|能|it|this|now/g;

/** 「懂了」「会了」这类只有自评、没有内容的话。 */
export function isSelfRating(text) {
  return charLength(stripMarks(text).replace(SELF_RATING_RE, '')) < 3;
}

/** 证据不合格的原因；合格返回 null。证据必须是学生自己写的连续原文，且不只是自评。 */
export function evidenceProblem(evidence, studentTexts) {
  const text = clean(evidence);
  if (!text) return '没有附学生原话';
  if (charLength(text) > PLAN_LIMITS.evidence) return `引用超过 ${PLAN_LIMITS.evidence} 字`;
  const quote = normalizeQuote(text);
  const found = (Array.isArray(studentTexts) ? studentTexts : []).some((item) =>
    normalizeQuote(item).includes(quote),
  );
  if (!quote || !found) return '不是学生手写内容中的连续原文';
  if (isSelfRating(text)) return '只是自评，没有说出理由';
  if (charLength(quote) < EVIDENCE_MIN_CHARS) return '引用太短';
  return null;
}

export const isValidEvidence = (evidence, studentTexts) => evidenceProblem(evidence, studentTexts) === null;

/** 同一句话不能验证多个概念：与其他已验证概念的证据互相包含即视为同一句。 */
function isEvidenceUsed(evidence, id, concepts) {
  const quote = normalizeQuote(evidence);
  return [...concepts.values()].some((item) => {
    if (item.id === id || item.status !== 'verified' || !item.evidence) return false;
    const used = normalizeQuote(item.evidence);
    return used.includes(quote) || quote.includes(used);
  });
}

// ────────────────────────────── 合并 ──────────────────────────────

function hasCycle(concepts) {
  const state = new Map();
  const visit = (id) => {
    if (state.get(id) === 'open') return true;
    if (state.get(id) === 'done') return false;
    state.set(id, 'open');
    const cyclic = (concepts.get(id)?.requires ?? []).some(visit);
    state.set(id, 'done');
    return cyclic;
  };
  return [...concepts.keys()].some(visit);
}

/** 可选文本字段：未传返回 fallback，非法返回 null。 */
function readText(input, key, fallback) {
  if (input[key] === undefined) return fallback;
  const text = clean(input[key]);
  return typeof input[key] === 'string' && charLength(text) <= PLAN_LIMITS[key] ? text : null;
}

function validateConcept(item) {
  if (!isObject(item)) return '概念必须是对象';
  const extra = Object.keys(item).filter((key) => !CONCEPT_FIELDS.has(key));
  if (extra.length > 0) return `概念含不支持的字段：${extra.join('、')}`;
  if (!ID_RE.test(clean(item.id))) return '概念 id 须为 1–40 位英文、数字、下划线或连字符';
  if (item.name !== undefined) {
    const length = charLength(clean(item.name));
    if (length < 1 || length > PLAN_LIMITS.name) return `概念名须为 1–${PLAN_LIMITS.name} 字：${item.id}`;
  }
  if (item.status !== undefined && !CONCEPT_STATUSES.includes(item.status)) {
    return `未知状态：${item.status}`;
  }
  if (item.requires !== undefined) {
    if (!isStringArray(item.requires) || item.requires.length > PLAN_LIMITS.requires) {
      return `requires 须为至多 ${PLAN_LIMITS.requires} 个概念 id：${item.id}`;
    }
  }
  if (item.evidence !== undefined && typeof item.evidence !== 'string') return `evidence 须为字符串：${item.id}`;
  return null;
}

/**
 * 合并一次增量更新。非法输入返回 `{ ok:false, message }`，原计划不变。
 *
 * @param {Object|null} current 当前计划
 * @param {Object} input        工具参数
 * @param {string[]} studentTexts 学生手写的原文
 * @returns {{ ok: true, plan: Object, downgraded: { id: string, reason: string }[] } | { ok: false, message: string }}
 */
export function mergePlan(current, input, studentTexts) {
  const reject = (message) => ({ ok: false, message });
  if (!isObject(input)) return reject('参数必须是一个对象');
  const unknown = Object.keys(input).filter((key) => !PLAN_FIELDS.has(key));
  if (unknown.length > 0) return reject(`不支持的字段：${unknown.join('、')}`);

  const base = normalizePlan(current);
  const goal = readText(input, 'goal', base?.goal ?? '');
  if (goal === null) return reject(`goal 须为至多 ${PLAN_LIMITS.goal} 字的文本`);
  if (!goal) return reject('首次建立计划需要 goal');
  const nextStep = readText(input, 'nextStep', base?.nextStep ?? '');
  if (nextStep === null) return reject(`nextStep 须为至多 ${PLAN_LIMITS.nextStep} 字的文本`);

  let conventions = base?.conventions ?? [];
  if (input.conventions !== undefined) {
    if (!isStringArray(input.conventions)) return reject('conventions 须为字符串数组');
    conventions = input.conventions.map(clean).filter(Boolean);
    if (conventions.length > PLAN_LIMITS.conventions) {
      return reject(`conventions 至多 ${PLAN_LIMITS.conventions} 条`);
    }
    if (conventions.some((item) => charLength(item) > PLAN_LIMITS.convention)) {
      return reject(`每条约定至多 ${PLAN_LIMITS.convention} 字`);
    }
  }

  const concepts = new Map((base?.concepts ?? []).map((item) => [item.id, item]));
  if (input.removedConceptIds !== undefined) {
    if (!isStringArray(input.removedConceptIds)) return reject('removedConceptIds 须为字符串数组');
    const removed = new Set(input.removedConceptIds.map(clean));
    for (const id of removed) concepts.delete(id);
    for (const [id, item] of concepts) {
      concepts.set(id, { ...item, requires: item.requires.filter((ref) => !removed.has(ref)) });
    }
  }

  if (input.concepts !== undefined && !Array.isArray(input.concepts)) return reject('concepts 须为数组');
  const seen = new Set();
  const downgraded = [];
  for (const item of input.concepts ?? []) {
    const problem = validateConcept(item);
    if (problem) return reject(problem);
    const id = clean(item.id);
    if (seen.has(id)) return reject(`重复的概念 id：${id}`);
    seen.add(id);

    const old = concepts.get(id);
    const name = item.name === undefined ? old?.name : clean(item.name);
    if (!name) return reject(`新概念缺少 name：${id}`);

    let status = item.status ?? old?.status ?? 'unknown';
    let evidence = status === 'verified' ? old?.evidence : undefined;
    if (item.status === 'verified') {
      const quote = clean(item.evidence);
      const reason =
        evidenceProblem(quote, studentTexts) ??
        (isEvidenceUsed(quote, id, concepts) ? '这句话已用于验证另一个概念' : null);
      if (!reason) {
        evidence = quote;
      } else if (old?.status !== 'verified') {
        // 已有合格证据的概念保持原状，其余降级
        status = 'claimed';
        evidence = undefined;
        downgraded.push({ id, reason });
      }
    }
    concepts.set(id, {
      id,
      name,
      status,
      requires: item.requires === undefined ? (old?.requires ?? []) : [...new Set(item.requires.map(clean))],
      ...(evidence ? { evidence } : {}),
    });
  }

  if (concepts.size > PLAN_LIMITS.concepts) {
    return reject(`概念至多 ${PLAN_LIMITS.concepts} 个，请用 removedConceptIds 移除不再需要的`);
  }
  const missing = [...concepts.values()].flatMap((item) => item.requires).filter((id) => !concepts.has(id));
  if (missing.length > 0) return reject(`前置概念不存在：${[...new Set(missing)].join('、')}`);
  if (hasCycle(concepts)) return reject('前置关系存在循环');

  let currentConceptId = base?.currentConceptId ?? '';
  if (input.currentConceptId !== undefined) {
    currentConceptId = clean(input.currentConceptId);
    if (currentConceptId && !concepts.has(currentConceptId)) {
      return reject(`currentConceptId 不存在：${currentConceptId}`);
    }
  } else if (!concepts.has(currentConceptId)) {
    currentConceptId = '';
  }

  return {
    ok: true,
    downgraded,
    plan: { goal, conventions, currentConceptId, nextStep, concepts: [...concepts.values()] },
  };
}
