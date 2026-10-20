/**
 * 工具层 · 增量 JSON 字符串字段提取器（explore/streaming-cards）
 *
 * 用途：工具参数以 JSON 逐字流出（`tool-input-delta`），展示层要在 JSON 尚未闭合时
 * 就把某个字符串字段的**已到达部分**读出来——比如 explain_card 的 `svg` 流式渲染。
 *
 * 不引入增量 JSON 解析库：我们只读「顶层字符串字段」这一种形状，一个小状态机就够。
 * 纯函数、无依赖，可被 node --test 直接导入。
 *
 * 行为约定：
 *   - 字段未出现 → { found: false, value: '', complete: false }
 *   - 字段出现但未闭合 → found: true，value 为已到达且已解码的内容，complete: false
 *   - 字段已闭合 → complete: true（value 是完整解码值）
 *   - 结尾恰好是半个转义序列（如 `\u12`）→ 半个的部分丢弃，等下一段再拼
 */

/** JSON 字符串的单字符转义表（\uXXXX 单独处理）。 */
const SIMPLE_ESCAPES = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };

/**
 * @param {string} jsonText  工具参数的累计增量文本（可以是半截 JSON）
 * @param {string} fieldName 顶层字符串字段名
 * @returns {{ found: boolean, value: string, complete: boolean }}
 */
export function extractPartialStringField(jsonText, fieldName) {
  const notFound = { found: false, value: '', complete: false };
  if (typeof jsonText !== 'string' || !jsonText || typeof fieldName !== 'string' || !fieldName) {
    return notFound;
  }

  // ── 定位字段名：允许空白，必须跟着冒号和开引号 ──
  const keyRe = new RegExp(`"${fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:\\s*"`);
  const match = keyRe.exec(jsonText);
  if (!match) return notFound;

  // ── 从开引号之后扫描内容，边扫边解码 ──
  let value = '';
  let i = match.index + match[0].length;
  while (i < jsonText.length) {
    const ch = jsonText[i];

    if (ch === '"') {
      // 未转义的引号 = 字段结束
      return { found: true, value, complete: true };
    }

    if (ch === '\\') {
      const next = jsonText[i + 1];
      if (next === undefined) break; // 半截反斜杠：等下一段
      if (next === 'u') {
        const hex = jsonText.slice(i + 2, i + 6);
        if (hex.length < 4 || !/^[0-9a-fA-F]{4}$/.test(hex)) break; // 半截 \uXXXX：等下一段
        value += String.fromCharCode(parseInt(hex, 16));
        i += 6;
        continue;
      }
      const simple = SIMPLE_ESCAPES[next];
      if (simple === undefined) break; // 非法转义：保守截断，不猜
      value += simple;
      i += 2;
      continue;
    }

    value += ch;
    i += 1;
  }

  return { found: true, value, complete: false };
}

export default extractPartialStringField;
