/**
 * 失败文案分类（阶段 F · F3，`F-取消重试与验收.md` §4 的五种情况）
 *
 * 职责只有一个：把「运行层给的失败类别 + 清洗后的错误原文」翻成**展示层**要的东西
 *   → `{ kind, textKey, detail }`
 * 它不生成文案（文案在 `translation.json`）、不碰会话状态、不决定是否重试。
 *
 * 为什么需要 `errorKind` 而不只看原文：超时与取消在传输层是同一个 `AbortError`，
 * 浏览器网络失败又只有 `Failed to fetch` 这一句。类别由运行层在产生错误处标记（协议 §5），
 * 这里只做「有类别优先信类别，没类别时按原文粗判」的兜底。
 *
 * 边界（D-2）：端点「疑似不支持工具」只用于显示建议，**不触发任何自动降级**。
 */

/** 三类可读文案的键；『工具不支持』那一条沿用 D-2 已有的整句建议，不在这里重复。 */
export const ERROR_TEXT_KEYS = Object.freeze({
  timeout: 'AgentChat.page.errorTimeout',
  network: 'AgentChat.page.errorNetwork',
  failed: 'AgentChat.page.errorFailed',
});

export const ERROR_KIND = Object.freeze({
  TOOL_UNSUPPORTED: 'tool_unsupported',
  TIMEOUT: 'timeout',
  NETWORK: 'network',
  FAILED: 'failed',
});

/**
 * 端点疑似「不支持工具调用」的粗判（D-2 原样保留，从页面搬到这里以便单测）。
 * 误判的代价只是多显示一行建议，因此从宽匹配。
 */
export const TOOL_UNSUPPORTED_PATTERN = /tools?|function.?call|\b400\b/i;

/** 传输层「连不上」的常见文案：浏览器 `Failed to fetch`、Node 的 ECONNREFUSED / ENOTFOUND 等。 */
const NETWORK_PATTERN =
  /failed to fetch|fetch failed|network ?error|err_network|econn|enotfound|eai_again|etimedout|offline|网络/i;

/**
 * @param {{ error?: string|null, errorKind?: string|null }} turn 投影后的轮次
 * @returns {{ kind: string|null, textKey: string|null, detail: string }}
 *   `kind` 为 `null` 表示这一轮没有可展示的失败（例如取消）。
 */
export function classifyTurnError(turn) {
  const detail = typeof turn?.error === 'string' ? turn.error : '';
  if (!detail.trim()) return { kind: null, textKey: null, detail: '' };

  if (turn?.errorKind === ERROR_KIND.TIMEOUT) {
    return { kind: ERROR_KIND.TIMEOUT, textKey: ERROR_TEXT_KEYS.timeout, detail };
  }
  if (TOOL_UNSUPPORTED_PATTERN.test(detail)) {
    // 工具不支持的建议句自带端点与模型名，由页面渲染，故 textKey 为空
    return { kind: ERROR_KIND.TOOL_UNSUPPORTED, textKey: null, detail };
  }
  if (NETWORK_PATTERN.test(detail)) {
    return { kind: ERROR_KIND.NETWORK, textKey: ERROR_TEXT_KEYS.network, detail };
  }
  return { kind: ERROR_KIND.FAILED, textKey: ERROR_TEXT_KEYS.failed, detail };
}

export default classifyTurnError;
