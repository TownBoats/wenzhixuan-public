/**
 * 运行层 · 副模型服务（阶段 B · 任务 B3）
 *
 * 职责：一个问题 → 五档候选答案（档位见 `OPTION_LEVELS`）。只做这一件事。
 *
 * 边界（`决策记录.md` B-10）：
 *   - 不生成 questionId、不拼 nextAction、不产生卡片、不等待学生（B4 负责）
 *   - 不控制并发（B5 的并发上限 4）
 *   - 不读 localStorage：副模型配置与 system prompt 由上层传入（运行层硬约束）
 *   - 不抛业务异常：失败一律返回结构化结果，`detail` 只允许白名单取值
 *
 * 为什么用 `modelAdapter` 而不是 `AgentModel`：
 *   `AgentModel` 没有 `abortSignal` 入参、没有 `abort()`，内部 60s 超时的 abort 还会被它自己的
 *   3 次整轮重试当作普通错误继续重试——「45s 且不超过主运行剩余时间」「可取消」在它身上做不出来。
 *
 * 为什么仍然用 `ContentParser`：
 *   本期副模型协议不变（仍是「用空心方括号包裹档位名」的文本，见 `B-运行层与提问工具.md` 2.4），
 *   而 `ContentParser` 是通用的标签提取器（`tags` 是构造参数），无浏览器依赖、可在 Node 测试中导入。
 *   注意它返回的是**对象**（每档是数组），不是字符串。
 */
import ContentParser from '../../utils/ContentParser.js';
import { runModelTurn } from '../modelAdapter.js';

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

const parser = new ContentParser([...OPTION_LEVELS]);

let runCounter = 0;
const nextRunId = () => `option-${++runCounter}`;

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
 * 从副模型文本里提取档位。
 * - 只有五档标签内的文本才算候选答案；标签外正文、未知标签一律丢弃（不会出现"无等级"的选项）
 * - 同一档出现多次时**只保留第一条**（避免同一屏两个「基本了解」）
 * - 输出顺序固定为 `OPTION_LEVELS`
 */
export function extractOptions(text) {
  if (typeof text !== 'string' || !text) return [];
  const parsed = parser.parse(text);

  const options = [];
  for (const level of OPTION_LEVELS) {
    const first = parsed?.[level]?.[0];
    const content = typeof first?.content === 'string' ? first.content.trim() : '';
    if (!content) continue;
    options.push({ level, text: content });
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

/**
 * 生成候选答案。
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
 * @param {string} [params.runId]        事件归属用；不传则自动生成
 * @param {Function} [params.baseFetch]  测试用 fetch 注入
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
  runId,
  baseFetch,
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
  if (!isOptionConfigReady(config)) {
    return { status: 'unavailable', errorCode: OPTION_ERROR_NOT_CONFIGURED };
  }

  const messages = [];
  const trimmedContext = typeof context === 'string' ? context.trim() : '';
  if (trimmedContext) messages.push({ role: 'assistant', content: trimmedContext });
  messages.push({ role: 'user', content: trimmedQuestion });

  let text = '';
  const result = await runModelTurn({
    runId: runId || nextRunId(),
    config: {
      endpoint: config.endpoint || config.baseURL,
      apiKey: config.apiKey,
      model: config.model,
      timeoutMs: resolveTimeout(timeoutMs),
    },
    system: systemPrompt,
    messages,
    abortSignal,
    onEvent: (event) => {
      if (event?.type === 'text-delta') text += event.delta;
    },
    baseFetch,
  });

  if (!result.ok) {
    const detail =
      result.endedBy === 'timeout'
        ? OPTION_DETAIL_TIMEOUT
        : result.endedBy === 'cancelled'
          ? OPTION_DETAIL_CANCELLED
          : detailFromError(result.error);
    return { status: 'unavailable', errorCode: OPTION_ERROR_FAILED, detail };
  }

  const options = extractOptions(text);
  if (options.length === 0) {
    return {
      status: 'unavailable',
      errorCode: OPTION_ERROR_FAILED,
      detail: OPTION_DETAIL_INVALID_OUTPUT,
    };
  }

  return { status: 'ready', options };
}

export default generateAnswerOptions;
