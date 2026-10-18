/**
 * 运行层 · `ask_question` 工具（阶段 B · 任务 B4）
 *
 * 这个工具只做一件事：把「模型想提问」翻译成「问题数据已就绪」，然后**立刻返回**。
 * 它不接收学生的答案，也不等学生——学生的回答在语义上是**下一轮的 user 消息**（协议 §2.2）。
 *
 * 校验分三层，缺一不可：
 *   1. `jsonSchema` + `additionalProperties: false`：告诉模型参数长什么样，并在 SDK 层拦一次
 *   2. 本文件的手写校验：长度、去空白、未知字段、字段类型（schema 不保证范围，也不保证 provider 都校验）
 *   3. 业务校验：模式是否允许提问、本轮是否问过同一句话、同一 toolCallId 是否已执行
 *
 * 两张"记忆表"（`决策记录.md` B-11）只活在本轮：工具实例由 B5 每轮创建一次，
 * 轮结束即销毁。不能放模块级全局表（上一轮问过的内容，下一轮再问是合法的）。
 *
 * 状态记忆的用途：
 *   - `resultsByCallId`：同一调用被重放时直接返回上次结果，不再打第二次副模型
 *   - `askedTexts`：本轮已问过的文本（去空白后相同），用于 `duplicate_question`
 */
import { jsonSchema, tool } from 'ai';

import {
  OPTION_ERROR_FAILED,
  OPTION_ERROR_NOT_CONFIGURED,
  generateAnswerOptions,
  isOptionConfigReady,
} from '../services/generateAnswerOptions.js';

export const ASK_QUESTION_TOOL_NAME = 'ask_question';

/** 参数上限（`决策记录.md` B-5）：改这里要同步 `01-核心协议.md` 与 RULE §6。 */
export const QUESTION_MAX_LENGTH = 500;
export const CONTEXT_MAX_LENGTH = 2000;

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
      description: `生成候选答案所需的有限教学上下文，例如「学生已了解函数作用域」（可选，≤${CONTEXT_MAX_LENGTH} 字）`,
    },
  },
  required: ['question'],
  additionalProperties: false,
});

const ALLOWED_FIELDS = new Set(['question', 'context']);

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

  return { ok: true, question, context: context || undefined };
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
 * @param {Function} [params.generateOptions]  副模型服务，默认 B3；测试注入假函数
 * @param {Function} [params.getRemainingMs]   主运行剩余时间，用于夹住副模型预算
 * @returns {Object} AI SDK 工具对象
 */
export function createAskQuestionTool({
  mode,
  optionConfig,
  optionSystemPrompt,
  generateOptions = generateAnswerOptions,
  getRemainingMs,
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

      // ── 6. 未配置副模型：问题照常就绪，不发起任何请求 ──
      if (!isOptionConfigReady(optionConfig)) {
        return remember(toolCallId, {
          status: 'ready',
          questionId,
          question: checked.question,
          options: [],
          optionsStatus: 'unavailable',
          errorCode: OPTION_ERROR_NOT_CONFIGURED,
          nextAction: 'await_user',
        });
      }

      // ── 7. 生成候选答案（失败也只降级，不影响问题本身）──
      const optionResult = await generateOptions({
        question: checked.question,
        context: checked.context,
        config: optionConfig,
        systemPrompt: optionSystemPrompt,
        abortSignal,
        timeoutMs: typeof getRemainingMs === 'function' ? getRemainingMs() : undefined,
      });

      if (optionResult?.status === 'ready') {
        return remember(toolCallId, {
          status: 'ready',
          questionId,
          question: checked.question,
          options: optionResult.options,
          optionsStatus: 'ready',
          nextAction: 'await_user',
        });
      }

      return remember(toolCallId, {
        status: 'ready',
        questionId,
        question: checked.question,
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
