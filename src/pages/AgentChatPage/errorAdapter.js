/**
 * 失败分类：把 `errorKind` 与错误原文映射为展示用的 `{ kind, textKey, detail }`。
 *
 * 优先使用运行层标记的类别（超时与取消在传输层原文相同），没有类别时按原文粗判。
 * 「疑似不支持工具」只用于提示，不触发自动降级。
 */

/** 三类可读文案的键；『工具不支持』那一条沿用已有的整句建议，不在这里重复。 */
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
 * 端点疑似「不支持工具调用」的粗判（放在这里以便单测）。
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
