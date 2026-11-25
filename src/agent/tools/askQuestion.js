/**
 * `ask_question` 工具：生成问题数据后立即返回，不等待学生作答。
 * 学生的回答是下一轮 user 消息，不是工具结果。
 *
 * 校验分三层：SDK schema、手写校验（长度/字段/类型）、业务校验（模式/重复/幂等）。
 *
 * 每轮创建一个实例，记忆表不跨轮：
 * - `resultsByCallId`：同一调用重放时返回上次结果
 * - `askedTexts`：本轮已问文本，用于拒绝重复提问
 */
import { jsonSchema, tool } from 'ai';

import { LATEST_FIGURE, MAX_REFS } from '../references.js';
import {
  OPTION_ERROR_FAILED,
  OPTION_ERROR_NOT_CONFIGURED,
  buildOptionPrompt,
  generateAnswerOptions,
  isOptionConfigReady,
} from '../services/generateAnswerOptions.js';

export const ASK_QUESTION_TOOL_NAME = 'ask_question';

/** 参数上限：改这里要同步 `docs/knowledge/agent-upgrade.md`。 */
export const QUESTION_MAX_LENGTH = 500;
export const CONTEXT_MAX_LENGTH = 2000;
/** 参考答案只作材料，超长截断而不拒绝问题。 */
export const ANSWER_MAX_LENGTH = 1000;

export const REJECT_INVALID_INPUT = 'invalid_input';
export const REJECT_DUPLICATE_QUESTION = 'duplicate_question';
export const REJECT_MODE_NOT_ALLOWED = 'mode_not_allowed';
export const REJECT_INTERNAL_ERROR = 'internal_error';

/** 给模型看的工具描述：只说用途与边界，参数规则交给 schema。 */
export const ASK_QUESTION_DESCRIPTION =
  '向学生提出一个需要他作答的问题。需要同时了解几个方面时，可以在一轮里调用多次；不要在正文里写问题。';

/** 形状声明。`additionalProperties: false` 让 SDK 先拦一次未知字段。 */
export const ASK_QUESTION_INPUT_SCHEMA = jsonSchema({
  type: 'object',
  properties: {
    question: {
      type: 'string',
      description: `要学生作答的问题，一个问题只包含一个主题（去空白后 1–${QUESTION_MAX_LENGTH} 字）`,
    },
    context: {
      type: 'string',
      description: `回答这个问题必需的事实、约定和前文结论，例如「本例中数组从 0 开始编号；前面已得出比较次数不超过 2log₂(n+1)」。系统会附上你本轮的讲解和学生本轮的输入，不必重复；更早的依据只能靠这里提供。确实没有依赖时写「无」（≤${CONTEXT_MAX_LENGTH} 字）`,
    },
    answer: {
      type: 'string',
      description:
        `这道题的参考答案，学生看不到，只用来约束候选答案。计算题先逐步算清再写，给出关键步骤和最终数值；` +
        `没有标准答案的开放题或了解学生情况的题写「无」（≤${ANSWER_MAX_LENGTH} 字）`,
    },
    refs: {
      type: 'array',
      items: { type: 'string' },
      description:
        `可选，这道题要学生对照的图或讲解，至多 ${MAX_REFS} 个：图的 refId（如 fig-k3x9ab）、` +
        `concept:概念id；本轮刚画、还不知道编号的图写 ${LATEST_FIGURE}。学生可从题目跳过去看`,
    },
  },
  // 声明必填以促使主模型填写；漏写时不拒绝问题，由材料组装兜底
  required: ['question', 'context', 'answer'],
  additionalProperties: false,
});

const ALLOWED_FIELDS = new Set(['question', 'context', 'answer', 'refs']);

/** 按码点计长度，避免 emoji 之类被算成两个字符。 */
const charLength = (text) => [...text].length;

/**
 * 手写校验（schema 之外的第二层）。
 * 返回 `{ ok:true, question, context }` 或 `{ ok:false, message }`。
 */
export function validateAskQuestionInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, message: '参数必须是一个对象' };
  }

  const unknown = Object.keys(input).filter((key) => !ALLOWED_FIELDS.has(key));
  if (unknown.length > 0) {
    return { ok: false, message: `不支持的字段：${unknown.join('、')}` };
  }

  if (typeof input.question !== 'string') {
    return { ok: false, message: 'question 必须是字符串' };
  }
  const question = input.question.trim();
  if (!question) return { ok: false, message: 'question 不能为空' };
  if (charLength(question) > QUESTION_MAX_LENGTH) {
    return { ok: false, message: `question 不能超过 ${QUESTION_MAX_LENGTH} 字` };
  }

  const rawContext = input.context;
  if (rawContext !== undefined && typeof rawContext !== 'string') {
    return { ok: false, message: 'context 必须是字符串' };
  }
  const context = typeof rawContext === 'string' ? rawContext.trim() : '';
  if (charLength(context) > CONTEXT_MAX_LENGTH) {
    return { ok: false, message: `context 不能超过 ${CONTEXT_MAX_LENGTH} 字` };
  }

  const answer = typeof input.answer === 'string' ? [...input.answer.trim()].slice(0, ANSWER_MAX_LENGTH).join('') : '';

  return { ok: true, question, context: context || undefined, ...(answer ? { answer } : {}), ...(input.refs === undefined ? {} : { refs: input.refs }) };
}

let fallbackSequence = 0;

/** 问题 ID 由程序生成（模型不能传）：`q_` + 12 位十六进制。 */
function createQuestionId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (typeof uuid === 'string') return `q_${uuid.replace(/-/g, '').slice(0, 12)}`;
  fallbackSequence += 1;
  return `q_${Date.now().toString(36)}${fallbackSequence.toString(36)}`.padEnd(14, '0');
}

/**
 * 创建 `ask_question` 工具（每轮一个实例）。
 *
 * @param {Object} params
 * @param {Object} params.mode                 模式对象（`modes.js` 的产物），读 `allowsQuestions`
 * @param {Object} params.optionConfig         副模型配置快照 `{ endpoint, apiKey, model }`
 * @param {string} params.optionSystemPrompt   副模型提示词（上层从配置层读取后传入）
 * @param {Function} [params.generateOptions]  副模型服务，默认 `generateAnswerOptions`；测试注入假函数
 * @param {Function} [params.getRemainingMs]   主运行剩余时间，用于夹住副模型预算
 * @param {Function} [params.resolveRefs]      解析引用，返回 { refs, unknown }；缺省时忽略引用
 * @param {Function} [params.buildContext]     把主模型的补充说明扩展为完整教学材料；缺省时只用补充说明
 * @param {(record: Object) => void} [params.onDebug] 调试记录回调
 * @returns {Object} AI SDK 工具对象
 */
export function createAskQuestionTool({
  mode,
  optionConfig,
  optionSystemPrompt,
  generateOptions = generateAnswerOptions,
  getRemainingMs,
  resolveRefs,
  buildContext,
  onDebug,
} = {}) {
  const resultsByCallId = new Map();
  const askedTexts = new Set();

  const remember = (toolCallId, result) => {
    if (toolCallId) resultsByCallId.set(toolCallId, result);
    return result;
  };

  async function execute(input, options = {}) {
    const { toolCallId, abortSignal } = options || {};

    // ── 1. 幂等优先：同一调用重放，直接返回上次结果，不再校验 ──
    if (toolCallId && resultsByCallId.has(toolCallId)) {
      return resultsByCallId.get(toolCallId);
    }

    try {
      // ── 2. 业务校验：模式不允许提问 ──
      if (!mode?.allowsQuestions) {
        return remember(toolCallId, { status: 'rejected', reason: REJECT_MODE_NOT_ALLOWED });
      }

      // ── 3. 参数校验（长度 / 去空白 / 未知字段）──
      const checked = validateAskQuestionInput(input);
      if (!checked.ok) {
        return remember(toolCallId, {
          status: 'rejected',
          reason: REJECT_INVALID_INPUT,
          message: checked.message,
        });
      }

      // ── 4. 本轮文本去重（只判去空白后完全相同）──
      if (askedTexts.has(checked.question)) {
        return remember(toolCallId, { status: 'rejected', reason: REJECT_DUPLICATE_QUESTION });
      }
      askedTexts.add(checked.question);

      // ── 5. 问题 ID 由程序生成 ──
      const questionId = createQuestionId();
      // 引用有误只忽略，不影响问题
      const { refs, unknown } = resolveRefs?.(checked.refs) ?? { refs: [], unknown: [] };
      const referenceFields = {
        ...(refs.length > 0 ? { refs } : {}),
        ...(unknown.length > 0 ? { notice: `以下引用不存在，已忽略：${unknown.join('、')}` } : {}),
      };

      const material =
        typeof buildContext === 'function' ? buildContext(checked.context, refs, checked.answer) : { text: checked.context };
      const startedAt = Date.now();
      const debug = (patch) => onDebug?.({ toolCallId, ...patch });
      debug({
        kind: 'option',
        at: startedAt,
        status: 'running',
        question: checked.question,
        modelContext: checked.context ?? '',
        source: material.source,
        prompt: buildOptionPrompt(checked.question, material.text),
        system: optionSystemPrompt,
        model: optionConfig?.model,
      });

      // ── 6. 未配置副模型：问题照常就绪，不发起任何请求 ──
      if (!isOptionConfigReady(optionConfig)) {
        debug({ status: 'unavailable', errorCode: OPTION_ERROR_NOT_CONFIGURED });
        return remember(toolCallId, {
          status: 'ready',
          questionId,
          question: checked.question,
          ...referenceFields,
          options: [],
          optionsStatus: 'unavailable',
          errorCode: OPTION_ERROR_NOT_CONFIGURED,
          nextAction: 'await_user',
        });
      }

      // ── 7. 生成候选答案（失败也只降级，不影响问题本身）──
      const optionResult = await generateOptions({
        question: checked.question,
        context: material.text,
        config: optionConfig,
        systemPrompt: optionSystemPrompt,
        abortSignal,
        timeoutMs: typeof getRemainingMs === 'function' ? getRemainingMs() : undefined,
      });

      debug({
        status: optionResult?.status === 'ready' ? 'ready' : 'unavailable',
        durationMs: Date.now() - startedAt,
        options: optionResult?.options,
        errorCode: [optionResult?.errorCode, optionResult?.detail].filter(Boolean).join(' / '),
      });

      if (optionResult?.status === 'ready') {
        return remember(toolCallId, {
          status: 'ready',
          questionId,
          question: checked.question,
          ...referenceFields,
          options: optionResult.options,
          optionsStatus: 'ready',
          nextAction: 'await_user',
        });
      }

      return remember(toolCallId, {
        status: 'ready',
        questionId,
        question: checked.question,
        ...referenceFields,
        options: [],
        optionsStatus: 'unavailable',
        errorCode: optionResult?.errorCode || OPTION_ERROR_FAILED,
        nextAction: 'await_user',
      });
    } catch {
      // 程序错误如实标注，但绝不把异常原文回给模型（可能含端点 / 请求头 / 密钥）。
      return remember(toolCallId, {
        status: 'rejected',
        reason: REJECT_INTERNAL_ERROR,
        message: '工具内部错误，请调整参数后重试或改为在正文中讲解',
      });
    }
  }

  return tool({
    description: ASK_QUESTION_DESCRIPTION,
    inputSchema: ASK_QUESTION_INPUT_SCHEMA,
    execute,
  });
}

export default createAskQuestionTool;
