import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

/**
 * Markdown 公式：插件配置与货币符号处理，供各 Markdown 渲染器共用。
 *
 * 公式有误时由 KaTeX 原样显示源码，不影响其余内容。
 * 样式由 `main.jsx` 引入，与 KaTeX 版本一致。
 */

export const MATH_REMARK_PLUGINS = [remarkGfm, remarkMath];

/** errorColor：流式未写完的公式不闪红；maxSize：限制模型输出的超大尺寸。 */
export const MATH_REHYPE_PLUGINS = [
  [rehypeKatex, { errorColor: 'currentColor', strict: 'ignore', maxSize: 20 }],
];

const CJK_RE = /[\u3000-\u303f\u3400-\u9fff\uff00-\uffef]/;
const TEXT_COMMAND_RE = /\\(?:text|textbf|textrm|mathrm|mbox)\s*\{[^{}]*\}/g;

/** 反斜杠转义的字符不参与配对。 */
function isEscaped(text, index) {
  let count = 0;
  for (let i = index - 1; i >= 0 && text[i] === '\\'; i -= 1) count += 1;
  return count % 2 === 1;
}

/** 从 start 起找长度恰为 size 的同字符串；`$` 会跳过转义，反引号不转义。 */
function findRun(text, char, size, start) {
  for (let i = start; i < text.length; i += 1) {
    if (text[i] !== char || (char === '$' && isEscaped(text, i))) continue;
    let end = i;
    while (text[end] === char) end += 1;
    if (end - i === size) return i;
    i = end - 1;
  }
  return -1;
}

/**
 * 以数字开头的 `$` 是货币还是公式。货币的特征：
 * 下一个 `$` 前是空白、后面紧跟数字，或中间夹着普通中文（`\text{}` 内的不算）。
 */
function isCurrency(content, next) {
  if (/\s$/.test(content) || /\d/.test(next)) return true;
  return CJK_RE.test(content.replace(TEXT_COMMAND_RE, ''));
}

/** 处理一段连续文本（不含空行、围栏代码和块公式）。 */
function escapeInParagraph(text) {
  let output = '';
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if ((char !== '$' && char !== '`') || isEscaped(text, index)) {
      output += char;
      index += 1;
      continue;
    }

    let end = index;
    while (text[end] === char) end += 1;
    const size = end - index;
    const close = findRun(text, char, size, end);

    if (close === -1) {
      output += text.slice(index, end);
      index = end;
      continue;
    }
    if (char === '$' && size === 1 && /\d/.test(text[end] ?? '')) {
      if (isCurrency(text.slice(end, close), text[close + 1] ?? '')) {
        output += '\\$';
        index = end;
        continue;
      }
    }
    // 代码、块公式或合法行内公式：整段原样保留
    output += text.slice(index, close + size);
    index = close + size;
  }
  return output;
}

/**
 * 转义会被误当作公式的货币符号（如「苹果 $5，梨 $10」）。
 * 围栏代码、缩进代码、行内代码和公式内容不变。
 */
export function escapeCurrency(markdown) {
  if (typeof markdown !== 'string' || !markdown.includes('$')) return markdown;

  const output = [];
  let paragraph = [];
  let closer = null; // 当前围栏代码或块公式的结束判定

  const flush = () => {
    if (paragraph.length) output.push(escapeInParagraph(paragraph.join('\n')));
    paragraph = [];
  };

  for (const line of markdown.split('\n')) {
    if (closer) {
      output.push(line);
      if (closer.test(line)) closer = null;
      continue;
    }
    const fence = /^[ \t>]*(?:[-*+]\s+|\d+[.)]\s+)?(`{3,}|~{3,}|\${2,})([^\n]*)$/.exec(line);
    // 同一行内闭合的 $$…$$ 与 ```…``` 按行内处理
    if (fence && !fence[2].includes(fence[1][0])) {
      flush();
      output.push(line);
      closer = new RegExp(`^[ \\t>]*\\${fence[1][0]}{${fence[1].length},}\\s*$`);
    } else if (!line.trim()) {
      flush();
      output.push(line);
    } else if (paragraph.length === 0 && /^(?: {4}|\t)/.test(line)) {
      output.push(line);
    } else {
      paragraph.push(line);
    }
  }
  flush();
  return output.join('\n');
}
