/**
 * 运行层 · 副模型服务（阶段 B · 任务 B3；explore/structured-options 起改为结构化输出）
 *
 * 职责：一个问题 → 五档候选答案（档位见 `OPTION_LEVELS`）。只做这一件事。
 *
 * 为什么是结构化输出而不是标签解析：
 *   旧协议让模型用空心方括号包裹档位名，再用 ContentParser 从正文里抠标签——
 *   模型漏闭合、嵌套写错、正文里提到标签名，解析就碎。`generateObject` 把输出契约
 *   交给 JSON Schema：SDK 负责约束格式、解析、校验，本文本只做业务归一化
 *   （去重 / 定序 / 去空白），标签解析这条路整体废弃。
 *
 * 边界（`决策记录.md` B-10，不变）：
 *   - 不生成 questionId、不拼 nextAction、不产生卡片、不等待学生（B4 负责）
 *   - 不控制并发（B5 的并发上限 4）
 *   - 不读 localStorage：副模型配置与 system prompt 由上层传入（运行层硬约束）
 *   - 不抛业务异常：失败一律返回结构化结果，`detail` 只允许白名单取值
 *   - 不重试：maxRetries 固定 0，与 B1 同纪律
 *
 * 与 B1 的关系：本服务**不再经过** `runModelTurn`——generateObject 是非流式调用，
 * 不需要 SSE 翻译与开闸哑弹；超时 / 取消 / 端点规范化在本文件内自行处理
 * （端点规范化复用 modelAdapter 导出的 `normalizeEndpoint`，两处口径一致）。
 */
import { generateObject, jsonSchema } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

import { normalizeEndpoint } from '../modelAdapter.js';

/** 五档，顺序即界面从低到高的排列顺序。 */
export const OPTION_LEVELS = Object.freeze(['none', 'heard', 'basic', 'familiar', 'expert']);

export const OPTION_ERROR_NOT_CONFIGURED = 'option_model_not_configured';
export const OPTION_ERROR_FAILED = 'option_model_failed';

/** `detail` 只允许这四种固定值，或 `HTTP <三位数>`。 */
export const OPTION_DETAIL_TIMEOUT = 'timeout';
export const OPTION_DETAIL_CANCELLED = 'cancelled';
export const OPTION_DETAIL_REQUEST_FAILED = 'request_failed';
export const OPTION_DETAIL_INVALID_OUTPUT = 'invalid_output';

/** 副模型预算：45 秒，且不得超过主运行剩余时间（由上层传入更小的值）。 */
export const OPTION_TIMEOUT_MS = 45_000;

/**
 * 输出契约：SDK 在 json 模式下会把这份 schema 注入提示词并校验结果。
 * `level` 用 enum 锁死五档——模型想造第六个档位，在校验阶段就会被拒，
 * 这是标签解析做不到的事。
 */
const OPTIONS_SCHEMA = jsonSchema({
  type: 'object',
  properties: {
    options: {
      type: 'array',
      description: '五档候选答案，每档一条',
      items: {
        type: 'object',
        properties: {
          level: {
            type: 'string',
            enum: [...OPTION_LEVELS],
            description: '档位：none 茫然 / heard 耳闻 / basic 入门 / familiar 熟悉 / expert 精通',
          },
          text: { type: 'string', description: '该档位学生的第一人称回答，简短精准' },
        },
        required: ['level', 'text'],
        additionalProperties: false,
      },
    },
  },
  required: ['options'],
  additionalProperties: false,
});

/** SDK 校验失败时抛出的错误名（ai 包的 NoObjectGeneratedError）。 */
const NO_OBJECT_ERROR_NAME = 'AI_NoObjectGeneratedError';

/**
 * 副模型是否可用：model / apiKey / 绝对 endpoint 三项齐全。
 * 与 `ConfigManager.isModelConfigured` 同口径，但这里不碰 localStorage。
 */
export function isOptionConfigReady(config) {
  if (!config || typeof config !== 'object') return false;
  const model = String(config.model || '').trim();
  const apiKey = String(config.apiKey || '').trim();
  const endpoint = String(config.endpoint || config.baseURL || '').trim();
  return Boolean(model) && Boolean(apiKey) && /^https?:\/\//i.test(endpoint);
}

/**
 * 把 SDK 校验过的结构化结果归一化成候选答案：
 * - 同一档出现多次时**只保留第一条**（避免同一屏两个「基本了解」）
 * - 去空白后为空文本的条目丢弃
 * - 输出顺序固定为 `OPTION_LEVELS`
 * 与旧 `extractOptions` 的语义完全一致，只是输入从「待解析的正文」变成「已校验的对象」。
 */
export function normalizeOptions(raw) {
  const list = Array.isArray(raw?.options) ? raw.options : [];
  const seen = new Set();
  const byLevel = new Map();

  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const level = typeof item.level === 'string' ? item.level.trim() : '';
    const text = typeof item.text === 'string' ? item.text.trim() : '';
    if (!OPTION_LEVELS.includes(level) || !text || seen.has(level)) continue;
    seen.add(level);
    byLevel.set(level, text);
  }

  const options = [];
  for (const level of OPTION_LEVELS) {
    if (byLevel.has(level)) options.push({ level, text: byLevel.get(level) });
  }
  return options;
}

function resolveTimeout(timeoutMs) {
  if (Number.isFinite(timeoutMs) && timeoutMs > 0) return Math.min(timeoutMs, OPTION_TIMEOUT_MS);
  return OPTION_TIMEOUT_MS;
}

/** 错误脱敏：只允许状态码，绝不把 responseBody / responseHeaders / actualUrl 带出去。 */
function detailFromError(error) {
  const status = Number(error?.statusCode);
  if (Number.isInteger(status) && status >= 100 && status <= 599) return `HTTP ${status}`;
  return OPTION_DETAIL_REQUEST_FAILED;
}

const unavailable = (errorCode, detail) =>
  detail ? { status: 'unavailable', errorCode, detail } : { status: 'unavailable', errorCode };

/**
 * 生成候选答案（结构化输出）。
 *
 * @param {Object} params
 * @param {string} params.question       学生要回答的问题（B4 已校验非空）
 * @param {string} [params.context]      副模型所需的有限教学上下文
 * @param {string} [params.language]     本期不使用（`决策记录.md` B-1 结论 6），仅为协议保留
 * @param {{ endpoint?: string, baseURL?: string, apiKey?: string, model?: string }} params.config
 *                                       副模型配置快照（绝对 endpoint）
 * @param {string} params.systemPrompt   副模型提示词（上层从配置层读取后传入）
 * @param {AbortSignal} [params.abortSignal]
 * @param {number} [params.timeoutMs]    主运行剩余时间；内部再夹一层 45s 上限
 * @param {Function} [params.baseFetch]  测试用 fetch 注入
 * @param {Object} [params.model]        测试用模型注入（`ai/test` 的 MockLanguageModelV3）；
 *   生产路径永远不传，与 B1 同一纪律（`决策记录.md` B-13）
 * @returns {Promise<{ status:'ready', options: Array<{level:string,text:string}> }
 *   | { status:'unavailable', errorCode:string, detail?:string }>}
 */
export async function generateAnswerOptions({
  question,
  context = '',
  language,
  config,
  systemPrompt,
  abortSignal,
  timeoutMs,
  baseFetch,
  model,
} = {}) {
  void language; // 本期不处理双语（保留签名，不改协议）

  const trimmedQuestion = typeof question === 'string' ? question.trim() : '';
  if (!trimmedQuestion) {
    throw new Error('generateAnswerOptions: question 不能为空（调用方应先校验）');
  }
  if (typeof systemPrompt !== 'string' || !systemPrompt.trim()) {
    throw new Error('generateAnswerOptions: 缺少副模型 systemPrompt（运行层不读配置）');
  }

  // 未配置副模型：不发请求（判据要求零网络）
  if (!model && !isOptionConfigReady(config)) {
    return unavailable(OPTION_ERROR_NOT_CONFIGURED);
  }

  const messages = [];
  const trimmedContext = typeof context === 'string' ? context.trim() : '';
  if (trimmedContext) messages.push({ role: 'assistant', content: trimmedContext });
  messages.push({ role: 'user', content: trimmedQuestion });

  // ── 超时与取消是两件不同的事，最后要能分别上报（与 B1 同口径）──
  const timeoutSignal = AbortSignal.timeout(resolveTimeout(timeoutMs));
  const signal = abortSignal ? AbortSignal.any([abortSignal, timeoutSignal]) : timeoutSignal;

  // provider：每次按快照新建，不复用（与 B1 同纪律）；测试注入模型时不建连接。
  const languageModel =
    model ??
    createOpenAI({
      baseURL: normalizeEndpoint(config.endpoint ?? config.baseURL),
      apiKey: config.apiKey || 'placeholder',
      fetch: baseFetch,
    }).chat(config.model);

  let object;
  try {
    ({ object } = await generateObject({
      model: languageModel,
      schema: OPTIONS_SCHEMA,
      // json 模式：SDK 注入 schema 说明并用 JSON 响应格式，OpenAI 兼容端点普遍支持；
      // 比 tool 模式少一层 function calling 依赖，比提示词标签多一层 SDK 校验。
      mode: 'json',
      system: systemPrompt,
      messages,
      abortSignal: signal,
      maxRetries: 0,
    }));
  } catch (error) {
    if (abortSignal?.aborted) return unavailable(OPTION_ERROR_FAILED, OPTION_DETAIL_CANCELLED);
    if (timeoutSignal.aborted) return unavailable(OPTION_ERROR_FAILED, OPTION_DETAIL_TIMEOUT);
    if (error?.name === NO_OBJECT_ERROR_NAME) {
      return unavailable(OPTION_ERROR_FAILED, OPTION_DETAIL_INVALID_OUTPUT);
    }
    return unavailable(OPTION_ERROR_FAILED, detailFromError(error));
  }

  const options = normalizeOptions(object);
  if (options.length === 0) {
    return unavailable(OPTION_ERROR_FAILED, OPTION_DETAIL_INVALID_OUTPUT);
  }

  return { status: 'ready', options };
}

export default generateAnswerOptions;
