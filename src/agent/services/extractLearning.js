/**
 * 学习链路 · 单元提取器（ADR-001 §3.4）
 *
 * 一个教学单元 → 一组结构化链路节点。只做这一件事：
 * 不读 localStorage、不写存储、不碰 React，配置与提示词由调用方传入。
 *
 * 通道与候选答案服务同源（`generateAnswerOptions.js`）：单次非流式 `generateText`，
 * 强制 `submit_learning_update` 工具，`stopWhen: stepCountIs(1)`、`maxRetries: 0`。
 * 因此这里不做流式解析，也不让模型在正文里作答。
 *
 * 为什么复制「关闭思考」那 20 行而不抽公共模块：
 * 候选服务已验收，抽公共函数会连带改动它的行为边界；本服务先保持独立，
 * 两份实现的口径由测试各自固定。等两边都要改时再合并。
 *
 * 校验不在这里做：证据必须是学生原话，这需要证据池，属于调用方知识。
 * 本服务只保证「拿到了结构合法的 JSON」。
 */
import { generateText, jsonSchema, stepCountIs, tool } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

import { normalizeEndpoint } from '../modelAdapter.js';
import { LEARNING_EVENT_TYPES } from '../../utils/learningJournal.js';

export const EXTRACT_ERROR_NOT_CONFIGURED = 'learning_model_not_configured';
export const EXTRACT_ERROR_FAILED = 'learning_model_failed';

export const EXTRACT_DETAIL_TIMEOUT = 'timeout';
export const EXTRACT_DETAIL_CANCELLED = 'cancelled';
export const EXTRACT_DETAIL_REQUEST_FAILED = 'request_failed';
export const EXTRACT_DETAIL_INVALID_OUTPUT = 'invalid_output';

/** 副模型预算：30 秒。提取不属于关键路径，比候选答案更短。 */
export const EXTRACT_TIMEOUT_MS = 30_000;

export const SUBMIT_LEARNING_TOOL = 'submit_learning_update';

const LEARNING_SCHEMA = jsonSchema({
  type: 'object',
  properties: {
    goal: {
      type: 'string',
      description: '仅第一个单元填写：一句话概括学习目标，不超过 40 字；其余单元留空字符串',
    },
    nodes: {
      type: 'array',
      description: '本单元真正发生的变化，通常 0–2 个；没有就提交空数组',
      items: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description:
              '这一段在讨论的概念或关系，用名词短语，2–10 字，例如「派生与继承」「引用与复制」；不要写「不理解派生」这类状态描述',
          },
          type: {
            type: 'string',
            enum: [...LEARNING_EVENT_TYPES],
            description: 'stuck 卡点 / misconception 误区 / breakthrough 转折 / verified 检验通过 / residual 未解 / goal_change 目标变化',
          },
          points: {
            type: 'array',
            items: { type: 'string' },
            description: '1–2 条要点，每条不超过 16 字，写学生在这个概念上的实际状态',
          },
          evidence: {
            type: 'string',
            description: '学生原话片段，必须一字不差取自手答或自由输入；residual 与 goal_change 可留空',
          },
        },
        required: ['topic', 'type', 'points'],
        additionalProperties: false,
      },
    },
  },
  required: ['nodes'],
  additionalProperties: false,
});

const NEEDS_THINKING_OFF = /deepseek|bigmodel/i;

/** 对拒绝强制 tool_choice 的端点关闭思考模式（与候选服务同一处理）。 */
function createThinkingOffFetch(baseFetch) {
  const fetchImpl = baseFetch || globalThis.fetch;
  return async function learningFetch(input, init) {
    let nextInit = init;
    if (init && typeof init.body === 'string') {
      try {
        const parsed = JSON.parse(init.body);
        parsed.thinking = { type: 'disabled' };
        nextInit = { ...init, body: JSON.stringify(parsed) };
      } catch {
        // 非 JSON 请求体保持原样
      }
    }
    return fetchImpl(input, nextInit);
  };
}

function resolveTimeout(timeoutMs) {
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : EXTRACT_TIMEOUT_MS;
}

/** `detail` 只允许白名单值或 `HTTP 三位数`，避免把端点与密钥带进日志。 */
function detailFromError(error) {
  const status = error?.statusCode ?? error?.status ?? error?.response?.status;
  if (Number.isInteger(status) && status >= 100 && status < 600) return `HTTP ${status}`;
  return EXTRACT_DETAIL_REQUEST_FAILED;
}

const unavailable = (errorCode, detail) =>
  detail ? { status: 'unavailable', errorCode, detail } : { status: 'unavailable', errorCode };

export function isExtractConfigReady(config) {
  if (!config) return false;
  return Boolean(
    String(config.model ?? '').trim() &&
      String(config.apiKey ?? '').trim() &&
      String(config.endpoint ?? config.baseURL ?? '').trim(),
  );
}

/**
 * @param {Object} params
 * @param {string} params.input       已经拼好的单元文本（`buildExtractionInput`）
 * @param {Object} params.config      副模型配置快照 { endpoint, apiKey, model }
 * @param {string} params.systemPrompt 提取提示词原文
 * @param {AbortSignal} [params.abortSignal]
 * @param {number} [params.timeoutMs]
 * @param {Object} [params.model]     测试注入（MockLanguageModelV3），生产路径不传
 * @returns {Promise<{ status:'ready', goal:string, nodes:Array }
 *   | { status:'unavailable', errorCode:string, detail?:string }>}
 */
export async function extractLearning({
  input,
  config,
  systemPrompt,
  abortSignal,
  timeoutMs,
  baseFetch,
  model,
} = {}) {
  const trimmedInput = typeof input === 'string' ? input.trim() : '';
  if (!trimmedInput) {
    throw new Error('extractLearning: input 不能为空（调用方应先校验）');
  }
  if (typeof systemPrompt !== 'string' || !systemPrompt.trim()) {
    throw new Error('extractLearning: 缺少提取提示词（运行层不读配置）');
  }
  if (!model && !isExtractConfigReady(config)) {
    return unavailable(EXTRACT_ERROR_NOT_CONFIGURED);
  }

  const timeoutSignal = AbortSignal.timeout(resolveTimeout(timeoutMs));
  const signal = abortSignal ? AbortSignal.any([abortSignal, timeoutSignal]) : timeoutSignal;

  const endpoint = String(config?.endpoint ?? config?.baseURL ?? '');
  const languageModel =
    model ??
    createOpenAI({
      baseURL: normalizeEndpoint(config.endpoint ?? config.baseURL),
      apiKey: config.apiKey || 'placeholder',
      fetch: NEEDS_THINKING_OFF.test(endpoint) ? createThinkingOffFetch(baseFetch) : baseFetch,
    }).chat(config.model);

  const submitTool = tool({
    description: '提交本单元的学习链路节点。这是唯一的输出通道，不要在正文里解释。',
    inputSchema: LEARNING_SCHEMA,
    execute: async (payload) => payload,
  });

  let result;
  try {
    result = await generateText({
      model: languageModel,
      system: systemPrompt,
      prompt: trimmedInput,
      tools: { [SUBMIT_LEARNING_TOOL]: submitTool },
      toolChoice: { type: 'tool', toolName: SUBMIT_LEARNING_TOOL },
      stopWhen: stepCountIs(1),
      abortSignal: signal,
      maxRetries: 0,
    });
  } catch (error) {
    if (abortSignal?.aborted) return unavailable(EXTRACT_ERROR_FAILED, EXTRACT_DETAIL_CANCELLED);
    if (timeoutSignal.aborted) return unavailable(EXTRACT_ERROR_FAILED, EXTRACT_DETAIL_TIMEOUT);
    return unavailable(EXTRACT_ERROR_FAILED, detailFromError(error));
  }

  // schema 违约不会抛错，只会留下没有 tool-result 的 tool-error
  const toolResults = result.steps?.flatMap((step) => step.toolResults ?? []) ?? [];
  const submitted = toolResults.find((entry) => entry.toolName === SUBMIT_LEARNING_TOOL);
  if (!submitted || !submitted.output || !Array.isArray(submitted.output.nodes)) {
    return unavailable(EXTRACT_ERROR_FAILED, EXTRACT_DETAIL_INVALID_OUTPUT);
  }

  return {
    status: 'ready',
    goal: typeof submitted.output.goal === 'string' ? submitted.output.goal : '',
    nodes: submitted.output.nodes,
  };
}

export default extractLearning;
