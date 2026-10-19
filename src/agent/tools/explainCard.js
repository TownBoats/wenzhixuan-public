/**
 * 运行层 · `explain_card` 工具（explore/visualize 分支 · 讲解卡片）
 *
 * 与 `visualize` 的分工（规范速查表第 08 模块「图表类型路由」）：
 *   - explain_card：纯 SVG 静态图（示意图 / 结构图 / 流程图），无脚本、无交互、无网络；
 *   - visualize：需要交互的 HTML 片段（分步器 / 滑杆 / Chart.js 图表）。
 *
 * 「轻量」落在三处：
 *   1. 渲染不需要脚本：规范把 viewBox 固定为 "0 0 680 H"（第 06 模块），
 *      本工具执行时解析出宽高，展示层用 CSS aspect-ratio 定高——
 *      iframe 用空 sandbox（连 allow-scripts 都不给），文档里一行脚本都没有；
 *   2. 体积上限 30K 字符（visualize 的一半），静态图本就不该超过这个量级；
 *   3. 校验可以在文本层做硬约束：单根 <svg>、必须有 viewBox、禁止 <script>。
 *
 * 纪律与 ask_question / visualize 一致：每轮一个实例、按 toolCallId 幂等、
 * 异常不回传原文。本文件不碰 React / localStorage，可被 node --test 直接导入。
 */
import { jsonSchema, tool } from 'ai';

export const EXPLAIN_CARD_TOOL_NAME = 'explain_card';

export const TITLE_MAX_LENGTH = 80;
export const SVG_MAX_LENGTH = 30_000;

export const REJECT_INVALID_INPUT = 'invalid_input';
export const REJECT_INTERNAL_ERROR = 'internal_error';

/** 给模型看的工具描述：只说用途与边界，画法规则在教学指令第 7 节。 */
export const EXPLAIN_CARD_DESCRIPTION =
  '渲染一张轻量 SVG 讲解卡片（示意图 / 结构图 / 流程图），把抽象概念画出来给学生看。' +
  '只用于不需要交互的静态图；需要点击、拖拽或图表库时使用可视化工具。';

/** 形状声明。`additionalProperties: false` 让 SDK 先拦一次未知字段。 */
export const EXPLAIN_CARD_INPUT_SCHEMA = jsonSchema({
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: `这张图的一句话标题（去空白后 1–${TITLE_MAX_LENGTH} 字）`,
    },
    svg: {
      type: 'string',
      description:
        `单根 <svg> 元素（≤${SVG_MAX_LENGTH} 字符）。viewBox 固定 "0 0 680 H"，width="100%"，` +
        '根节点带 role="img"，首个子元素为 <title> 与 <desc>；禁止 <script> 与事件属性。',
    },
  },
  required: ['title', 'svg'],
  additionalProperties: false,
});

const ALLOWED_FIELDS = new Set(['title', 'svg']);

/** 按码点计长度，避免 emoji 之类被算成两个字符。 */
const charLength = (text) => [...text].length;

/** viewBox="0 0 680 320" → { width: 680, height: 320 }；分隔符允许空格或逗号。 */
const VIEWBOX_RE = /viewBox\s*=\s*"(-?[\d.]+)[ ,]+(-?[\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)"/;

/**
 * 从 SVG 文本解析 viewBox 宽高。解析失败返回 null（由调用方决定拒绝还是兜底）。
 *
 * @param {string} svg
 * @returns {{ width: number, height: number } | null}
 */
export function parseViewBox(svg) {
  const match = typeof svg === 'string' ? svg.match(VIEWBOX_RE) : null;
  if (!match) return null;
  const width = Number(match[3]);
  const height = Number(match[4]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
}

/**
 * 手写校验（schema 之外的第二层）。
 * 返回 `{ ok:true, title, svg, viewBox }` 或 `{ ok:false, message }`。
 *
 * 文本层只管「形状」，不管「内容安全」：script 执行由空 sandbox 硬阻断，
 * 这里拒掉 <script> 只是省一次无意义的渲染，不是安全边界本身。
 */
export function validateExplainCardInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, message: '参数必须是一个对象' };
  }

  const unknown = Object.keys(input).filter((key) => !ALLOWED_FIELDS.has(key));
  if (unknown.length > 0) {
    return { ok: false, message: `不支持的字段：${unknown.join('、')}` };
  }

  if (typeof input.title !== 'string') {
    return { ok: false, message: 'title 必须是字符串' };
  }
  const title = input.title.trim();
  if (!title) return { ok: false, message: 'title 不能为空' };
  if (charLength(title) > TITLE_MAX_LENGTH) {
    return { ok: false, message: `title 不能超过 ${TITLE_MAX_LENGTH} 字` };
  }

  if (typeof input.svg !== 'string') {
    return { ok: false, message: 'svg 必须是字符串' };
  }
  const svg = input.svg.trim();
  if (!svg) return { ok: false, message: 'svg 不能为空' };
  if (charLength(svg) > SVG_MAX_LENGTH) {
    return { ok: false, message: `svg 不能超过 ${SVG_MAX_LENGTH} 字符，请简化图形` };
  }
  if (!/^<svg[\s>]/.test(svg) || !svg.endsWith('</svg>')) {
    return { ok: false, message: 'svg 必须是单根 <svg> 元素（不要包外层 div / 说明文字）' };
  }
  // 单根的第二道判据：闭合标签只能出现一次、且就在末尾——否则说明有并列根元素
  if (svg.indexOf('</svg>') !== svg.length - '</svg>'.length) {
    return { ok: false, message: '一次调用只产出一张 SVG（检测到并列的根元素）' };
  }
  if (/<script[\s>]/i.test(svg)) {
    return { ok: false, message: '讲解卡片不允许 <script>；需要交互请改用可视化工具' };
  }

  const viewBox = parseViewBox(svg);
  if (!viewBox) {
    return { ok: false, message: 'svg 缺少合法的 viewBox（应为 "0 0 680 H"，H 为内容底边 + 20）' };
  }

  return { ok: true, title, svg, viewBox };
}

/**
 * 创建 `explain_card` 工具（每轮一个实例）。
 *
 * @returns {Object} AI SDK 工具对象
 */
export function createExplainCardTool() {
  const resultsByCallId = new Map();

  const remember = (toolCallId, result) => {
    if (toolCallId) resultsByCallId.set(toolCallId, result);
    return result;
  };

  async function execute(input, options = {}) {
    const { toolCallId } = options || {};

    // ── 1. 幂等优先：同一调用重放，直接返回上次结果 ──
    if (toolCallId && resultsByCallId.has(toolCallId)) {
      return resultsByCallId.get(toolCallId);
    }

    try {
      // ── 2. 参数校验（长度 / 单根 / viewBox / 无脚本）──
      const checked = validateExplainCardInput(input);
      if (!checked.ok) {
        return remember(toolCallId, {
          status: 'rejected',
          reason: REJECT_INVALID_INPUT,
          message: checked.message,
        });
      }

      // ── 3. 就绪：viewBox 一并返回，展示层靠它定高（无需 iframe 内脚本）──
      return remember(toolCallId, {
        status: 'ready',
        title: checked.title,
        svg: checked.svg,
        viewBox: checked.viewBox,
      });
    } catch {
      return remember(toolCallId, {
        status: 'rejected',
        reason: REJECT_INTERNAL_ERROR,
        message: '工具内部错误，请改为在正文中讲解',
      });
    }
  }

  return tool({
    description: EXPLAIN_CARD_DESCRIPTION,
    inputSchema: EXPLAIN_CARD_INPUT_SCHEMA,
    execute,
  });
}

export default createExplainCardTool;
