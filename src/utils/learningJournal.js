/**
 * 学习链路 · 纯函数层（ADR-001）
 *
 * 只做四件事：从 turns 推导教学单元、把单元拼成提取输入、校验模型产出、把单元折叠成链路。
 * 不导入 React、不访问存储、不发请求，`node --test` 可直接导入。
 *
 * 关键口径：
 *   - 只有 `completed` / `awaiting_user` 的轮参与，与模型上下文一致；
 *   - 学生证据只取「手答」和「自由输入」。点选候选项是副模型生成的文本，
 *     存进 `question.answer` 后与手答同形，靠 `selectedLevel` 区分；
 *   - 答案汇总轮（`userMessage.source === 'answer'`）含题干与模板文字，整体不做证据池。
 */

export const LEARNING_SCHEMA_VERSION = 1;

/** 事件类型：与 ADR-001 §3.2 一致，不做扩展。 */
export const LEARNING_EVENT_TYPES = Object.freeze([
  'stuck',
  'misconception',
  'breakthrough',
  'verified',
  'residual',
  'goal_change',
]);

/** 不需要学生原话的类型：残留问题是「还没解决」，目标变化由目标本身表达。 */
const TYPES_WITHOUT_EVIDENCE = new Set(['residual', 'goal_change']);

/** 单个节点最多几条 bullet；超出丢弃多余条目而不是截断文本。 */
export const MAX_POINTS_PER_NODE = 3;

/** 单条 bullet 的最大字符数（按 code point 计，中文一个字算一个）。 */
export const POINT_MAX_LENGTH = 16;

/** 目标的最大字符数。 */
export const GOAL_MAX_LENGTH = 40;

/** 概念主题的最大字符数：标题要短，长了就不像主题。 */
export const TOPIC_MAX_LENGTH = 12;

/** 只有这两类轮次可以进入学习记录。 */
const ELIGIBLE_TURN_STATUSES = new Set(['completed', 'awaiting_user']);

// ────────────────────────────── 基础工具 ──────────────────────────────

/** 证据比对口径：全半角统一、去空白、忽略大小写。 */
export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\s+/gu, '')
    .toLowerCase();
}

/** 按字符（code point）计数，避免 emoji / 生僻字被算成两个。 */
export function textLength(value) {
  return [...String(value ?? '')].length;
}

/**
 * FNV-1a 32 位哈希。只用于「输入是否变化」的比较，不做安全用途，
 * 因此不引入加密依赖，也不承诺抗碰撞。
 */
export function hashText(value) {
  let hash = 0x811c9dc5;
  const text = String(value ?? '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function findTurn(turns, id) {
  return (Array.isArray(turns) ? turns : []).find((turn) => turn?.id === id) ?? null;
}

// ────────────────────────────── 单元推导 ──────────────────────────────

/**
 * 推导可提取的教学单元。
 *
 * `U(T)` 的成立条件是「T 合格且 T+1 已创建」。尾轮没有后继，
 * 只有显式要求（用户展开链路）时才作为 tail 单元出现。
 *
 * @param {Array} turns reducer 里的 turn 真值，不是 UI 投影
 * @param {{ includeTail?: boolean }} [options]
 */
export function deriveUnits(turns, { includeTail = false } = {}) {
  const list = Array.isArray(turns) ? turns : [];
  const units = [];

  for (let index = 0; index < list.length; index += 1) {
    const turn = list[index];
    if (!turn || !ELIGIBLE_TURN_STATUSES.has(turn.status)) continue;
    if (typeof turn.id !== 'string' || !turn.id) continue;

    const next = list[index + 1] ?? null;
    const isTail = !next;
    if (isTail && !includeTail) continue;

    units.push({
      key: `${turn.id}:${turn.runId ?? 'no-run'}:${next?.id ?? 'tail'}`,
      turnId: turn.id,
      runId: turn.runId ?? null,
      nextTurnId: next?.id ?? null,
      isTail,
    });
  }

  return units;
}

// ────────────────────────────── 内容抽取 ──────────────────────────────

/**
 * 取该轮**最新运行**的正文。
 * 片段带 runId：重试后旧正文必须排除，否则会把两版讲解拼在一起。
 */
function collectTurnText(turn) {
  const parts = Array.isArray(turn?.parts) ? turn.parts : [];
  return parts
    .filter((part) => part && part.type === 'text' && (part.runId ?? null) === (turn.runId ?? null))
    .map((part) => part.text ?? '')
    .join('')
    .trim();
}

/** 卡片只取标题：HTML/SVG 载荷既不进提示词，也不进学习记录。 */
function collectCardTitles(turn) {
  const parts = Array.isArray(turn?.parts) ? turn.parts : [];
  const titles = [];

  for (const part of parts) {
    if (!part || part.type !== 'tool') continue;
    if (part.status !== 'completed') continue;
    if (part.toolName !== 'visualize' && part.toolName !== 'explain_card') continue;
    const title = part.output?.title ?? part.input?.title;
    if (typeof title === 'string' && title.trim() && !titles.includes(title.trim())) {
      titles.push(title.trim());
    }
  }

  return titles;
}

/** 作答来源：手答可以当证据，点选候选不行，跳过没有内容。 */
export function describeAnswer(question) {
  if (!question) return { kind: 'unknown', text: '' };
  if (question.state === 'skipped') return { kind: 'skipped', text: '' };
  if (question.state !== 'answered') return { kind: 'pending', text: '' };
  // selectedLevel 非空 = 学生点了副模型生成的候选，文本不是学生写的
  if (question.selectedLevel != null) {
    return { kind: 'option', text: '', level: question.selectedLevel };
  }
  return { kind: 'written', text: String(question.answer ?? '').trim() };
}

/**
 * 证据池：只收学生自己写的文本。
 * 刻意不收首轮提问——那是在描述困惑，不是对理解的陈述。
 */
export function buildEvidencePool({ unit, turns }) {
  const turn = findTurn(turns, unit.turnId);
  const next = unit.nextTurnId ? findTurn(turns, unit.nextTurnId) : null;
  const texts = [];

  for (const question of Array.isArray(turn?.questions) ? turn.questions : []) {
    const answer = describeAnswer(question);
    if (answer.kind === 'written' && answer.text) texts.push(answer.text);
  }

  if (next?.userMessage?.source === 'input') {
    const freeText = String(next.userMessage.text ?? '').trim();
    if (freeText) texts.push(freeText);
  }

  return texts;
}

// ────────────────────────────── 提取输入 ──────────────────────────────

function formatAnswerLines(question) {
  const answer = describeAnswer(question);
  const lines = [`问题：${String(question?.text ?? '').trim()}`];

  if (answer.kind === 'written') lines.push(`学生手答：${answer.text}`);
  else if (answer.kind === 'option') lines.push(`学生点选档位：${answer.level}（模型生成的候选，不是学生原话）`);
  else if (answer.kind === 'skipped') lines.push('学生跳过：未作答');
  else lines.push('学生未作答');

  return lines.join('\n');
}

/**
 * 拼提取输入。用标签分隔而不是序列化 JSON：省 token，模型也更稳。
 *
 * @param {{ unit: Object, turns: Array, prevState?: { goal?: string, nodes?: Array } }} params
 */
export function buildExtractionInput({ unit, turns, prevState } = {}) {
  const turn = findTurn(turns, unit?.turnId);
  if (!turn) return '';

  const next = unit?.nextTurnId ? findTurn(turns, unit.nextTurnId) : null;
  const blocks = [];

  if (prevState?.goal) blocks.push(`[已归纳的目标]\n${prevState.goal}`);
  if (Array.isArray(prevState?.nodes) && prevState.nodes.length > 0) {
    const lines = prevState.nodes.map(
      (node) => `- ${node.topic}（${node.type}）：${node.points.join(' / ')}`,
    );
    blocks.push(`[已归纳的链路]\n${lines.join('\n')}`);
  }

  const studentPrompt = String(turn.userMessage?.text ?? '').trim();
  if (studentPrompt) blocks.push(`[本轮学生输入]\n${studentPrompt}`);

  const teacherText = collectTurnText(turn);
  if (teacherText) blocks.push(`[本轮教师正文]\n${teacherText.slice(0, 2000)}`);

  const titles = collectCardTitles(turn);
  if (titles.length > 0) blocks.push(`[卡片标题]\n${titles.join(' / ')}`);

  const questions = Array.isArray(turn.questions) ? turn.questions : [];
  if (questions.length > 0) {
    blocks.push(`[本轮问题与作答]\n${questions.map(formatAnswerLines).join('\n\n')}`);
  }

  if (next) {
    const nextText = String(next.userMessage?.text ?? '').trim();
    if (nextText) {
      const kind = next.userMessage?.source === 'input' ? '自由输入' : '答案汇总';
      blocks.push(`[下一轮学生输入 · ${kind}]\n${nextText.slice(0, 800)}`);
    }
  }

  return blocks.join('\n\n');
}

// ────────────────────────────── 产出校验 ──────────────────────────────

/**
 * 主题是节点的标题，必须是概念短语。
 * 太长的描述（「不理解派生和继承是不是一回事」）不算主题，直接丢。
 */
function sanitizeTopic(value) {
  if (typeof value !== 'string') return '';
  const text = value.trim().replace(/\s+/gu, ' ');
  if (!text) return '';
  if (textLength(text) > TOPIC_MAX_LENGTH) return '';
  return text;
}

function sanitizePoints(points) {
  const list = Array.isArray(points) ? points : [];
  const result = [];

  for (const raw of list) {
    if (typeof raw !== 'string') continue;
    const text = raw.trim().replace(/\s+/gu, ' ');
    if (!text) continue;
    if (textLength(text) > POINT_MAX_LENGTH) continue;
    if (result.includes(text)) continue;
    result.push(text);
    if (result.length >= MAX_POINTS_PER_NODE) break;
  }

  return result;
}

/**
 * 校验模型产出。丢弃单个非法节点，不整批失败——一条编造的证据不该毁掉整轮。
 *
 * @param {Object} raw 模型提交的结构
 * @param {{ evidencePool: string[], isFirstUnit?: boolean, fallbackGoal?: string }} options
 * @returns {{ goal: string, nodes: Array, dropped: number }}
 */
export function validateNodes(raw, { evidencePool = [], isFirstUnit = false, fallbackGoal = '' } = {}) {
  const pool = (Array.isArray(evidencePool) ? evidencePool : []).map(normalizeText).filter(Boolean);
  const hasEvidence = (quote) => {
    const normalized = normalizeText(quote);
    if (textLength(normalized) < 2) return false;
    return pool.some((text) => text.includes(normalized));
  };

  const input = Array.isArray(raw?.nodes) ? raw.nodes : [];
  const nodes = [];
  let dropped = 0;

  for (const candidate of input) {
    if (!candidate || typeof candidate !== 'object') {
      dropped += 1;
      continue;
    }
    if (!LEARNING_EVENT_TYPES.includes(candidate.type)) {
      dropped += 1;
      continue;
    }

    const topic = sanitizeTopic(candidate.topic);
    if (!topic) {
      dropped += 1;
      continue;
    }

    const points = sanitizePoints(candidate.points);
    if (points.length === 0) {
      dropped += 1;
      continue;
    }

    if (!TYPES_WITHOUT_EVIDENCE.has(candidate.type) && !hasEvidence(candidate.evidence)) {
      dropped += 1;
      continue;
    }

    nodes.push({
      topic,
      type: candidate.type,
      points,
      // 证据原文存规范化前的版本，便于在界面上展示学生措辞
      evidence: typeof candidate.evidence === 'string' ? candidate.evidence.trim() : '',
    });
  }

  let goal = '';
  if (isFirstUnit) {
    const proposed = typeof raw?.goal === 'string' ? raw.goal.trim().replace(/\s+/gu, ' ') : '';
    const usable = proposed && textLength(proposed) <= GOAL_MAX_LENGTH ? proposed : '';
    goal = usable || String(fallbackGoal ?? '').trim().slice(0, GOAL_MAX_LENGTH);
  }

  return { goal, nodes, dropped };
}

// ────────────────────────────── 折叠与投影 ──────────────────────────────

/**
 * 把按单元顺序排好的节点折叠成链路：相邻且**同主题同状态**才合并，bullet 去重。
 *
 * 按主题而不是按状态合并：链路的主角是概念。
 * 但同一概念的「卡点」和「转折」要留成两个节点，否则演进过程会被压平。
 */
export function foldNodes(sequences) {
  const merged = [];

  for (const sequence of Array.isArray(sequences) ? sequences : []) {
    for (const node of Array.isArray(sequence) ? sequence : []) {
      if (!node || !Array.isArray(node.points) || node.points.length === 0) continue;
      if (typeof node.topic !== 'string' || !node.topic) continue;
      const last = merged[merged.length - 1];

      if (last && last.type === node.type && last.topic === node.topic) {
        for (const point of node.points) {
          if (last.points.length >= MAX_POINTS_PER_NODE) break;
          if (!last.points.includes(point)) last.points.push(point);
        }
        continue;
      }

      merged.push({
        topic: node.topic,
        type: node.type,
        points: [...node.points].slice(0, MAX_POINTS_PER_NODE),
      });
    }
  }

  return merged;
}

/** 由已就绪的单元算出当前链路与目标，供下一个单元的提取输入与界面共用。 */
export function projectRecord(units) {
  const ready = (Array.isArray(units) ? units : []).filter((unit) => unit?.status === 'ready');
  const goal = ready.find((unit) => unit.goal)?.goal ?? '';
  return {
    goal,
    nodes: foldNodes(ready.map((unit) => unit.nodes)),
    unitCount: ready.length,
  };
}

/**
 * 折叠状态的指纹：前序一旦重算，后续单元的 `prevDigest` 就对不上，
 * 自动判为过期。只比结果，不比原始输入，避免无关格式变化引发连锁重算。
 */
export function digestState({ goal, nodes }) {
  const serialized = JSON.stringify({
    goal: String(goal ?? ''),
    nodes: (Array.isArray(nodes) ? nodes : []).map((node) => [node.topic, node.type, node.points]),
  });
  return hashText(serialized);
}

/** 单个单元的输入指纹：包含前序状态，输入或依赖任一变化都会变。 */
export function computeUnitInputHash({ unit, turns, prevDigest = '' }) {
  return hashText(`${prevDigest}\n${buildExtractionInput({ unit, turns, prevState: null })}`);
}

// ────────────────────────────── 调度判断 ──────────────────────────────

/**
 * 找下一个需要提取的单元。
 *
 * 判定为需要（任一成立）：没有结果、输入变了、前序状态变了、提取器版本变了、
 * 上次失败（重试）。**串行且遇错即停**：后续单元建立在前序状态上，
 * 跳过失败单元会让链路默默缺一段。
 *
 * @returns {{ unit: Object, inputHash: string, prevDigest: string, isFirstUnit: boolean } | null}
 */
export function nextPendingUnit({ turns, record, extractorVersion = 'v1', includeTail = false } = {}) {
  const units = deriveUnits(turns, { includeTail });
  const stored = new Map(
    (Array.isArray(record?.units) ? record.units : []).map((unit) => [unit?.key, unit]),
  );

  let prevDigest = '';

  for (let index = 0; index < units.length; index += 1) {
    const unit = units[index];
    const existing = stored.get(unit.key);
    const inputHash = computeUnitInputHash({ unit, turns, prevDigest });
    const isFirstUnit = index === 0;

    const stale =
      !existing ||
      existing.status !== 'ready' ||
      existing.inputHash !== inputHash ||
      existing.prevDigest !== prevDigest ||
      existing.extractorVersion !== extractorVersion;

    if (stale) return { unit, inputHash, prevDigest, isFirstUnit };

    prevDigest = existing.stateDigest ?? digestState(projectRecord(record.units.slice(0, index + 1)));
  }

  return null;
}

/**
 * 合并一个新单元结果：同键整单元替换，其余保持顺序。
 * 尾单元变成闭合单元时键会变，旧尾键必须删除，否则折叠时重复计入。
 */
export function applyUnitResult(record, { unit, goal, nodes, inputHash, prevDigest, stateDigest, extractorVersion }) {
  const units = (Array.isArray(record?.units) ? record.units : []).filter(
    (entry) => entry?.key !== unit.key && !(unit.nextTurnId && entry?.nextTurnId === null && entry?.turnId === unit.turnId),
  );

  units.push({
    key: unit.key,
    turnId: unit.turnId,
    nextTurnId: unit.nextTurnId,
    runId: unit.runId,
    inputHash,
    prevDigest,
    stateDigest,
    extractorVersion,
    status: 'ready',
    goal: goal || '',
    nodes: Array.isArray(nodes) ? nodes : [],
    updatedAt: Date.now(),
  });

  return units;
}

/** 失败也留一条记录，调度器据此重试，而不是每帧重新排队。 */
export function applyUnitFailure(record, { unit, inputHash, prevDigest, extractorVersion, reason }) {
  const units = (Array.isArray(record?.units) ? record.units : []).filter((entry) => entry?.key !== unit.key);

  units.push({
    key: unit.key,
    turnId: unit.turnId,
    nextTurnId: unit.nextTurnId,
    runId: unit.runId,
    inputHash,
    prevDigest,
    stateDigest: '',
    extractorVersion,
    status: 'failed',
    goal: '',
    nodes: [],
    reason: typeof reason === 'string' ? reason : 'failed',
    updatedAt: Date.now(),
  });

  return units;
}
