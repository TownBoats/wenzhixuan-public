/**
 * `visualize` 工具：校验并返回一段自包含 HTML，由展示层沙箱渲染，不打断运行。
 *
 * - 上限 60K 字符：结果随历史存入 localStorage（配额约 5MB）
 * - 每轮一个实例，按 toolCallId 幂等；异常不回传原文
 */
import { jsonSchema, tool } from 'ai';

export const VISUALIZE_TOOL_NAME = 'visualize';

export const TITLE_MAX_LENGTH = 80;
export const HTML_MAX_LENGTH = 60_000;

export const REJECT_INVALID_INPUT = 'invalid_input';
export const REJECT_INTERNAL_ERROR = 'internal_error';

/** 给模型看的工具描述：用途与边界，参数细节交给 schema。 */
export const VISUALIZE_DESCRIPTION =
  '在对话中渲染一个交互式可视化（图表、流程演示、可拖拽的模拟器），帮助学生「看见」抽象概念。' +
  '当一张图胜过一段话时使用；纯文字能讲清楚的不要调用。';

/** 形状声明。`additionalProperties: false` 让 SDK 先拦一次未知字段。 */
export const VISUALIZE_INPUT_SCHEMA = jsonSchema({
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: `可视化的一句话标题（去空白后 1–${TITLE_MAX_LENGTH} 字）`,
    },
    html: {
      type: 'string',
      description:
        `自包含 HTML 片段（不含 <!doctype>/<html>/<head>/<body>，≤${HTML_MAX_LENGTH} 字符）。` +
        '可用宿主注入的主题变量与工具类；禁止 <script src> 以外的网络请求，禁止 fetch/XHR。',
    },
  },
  required: ['title', 'html'],
  additionalProperties: false,
});

const ALLOWED_FIELDS = new Set(['title', 'html']);

/** 按码点计长度，避免 emoji 之类被算成两个字符。 */
const charLength = (text) => [...text].length;

/**
 * 手写校验（schema 之外的第二层）。
 * 返回 `{ ok:true, title, html }` 或 `{ ok:false, message }`。
 *
 * 不做的校验（有意为之）：
 *   - 不解析 / 不 sanitize HTML：片段在展示层进 sandbox iframe（无 allow-same-origin），
 *     拿不到页面凭据，危险面由沙箱承担，文本层再做白名单只会误伤合法可视化；
 *   - 不检查「是否真的只含允许的标签」：教学可视化需要 SVG / canvas / script，放行为主。
 */
export function validateVisualizeInput(input) {
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

  if (typeof input.html !== 'string') {
    return { ok: false, message: 'html 必须是字符串' };
  }
  const html = input.html.trim();
  if (!html) return { ok: false, message: 'html 不能为空' };
  if (charLength(html) > HTML_MAX_LENGTH) {
    return { ok: false, message: `html 不能超过 ${HTML_MAX_LENGTH} 字符，请精简（聚合数据 / 去掉无关样式）` };
  }

  return { ok: true, title, html };
}

/**
 * 创建 `visualize` 工具（每轮一个实例）。
 *
 * 无外部依赖：不联网、不读存储、不碰 React，可被 `node --test` 直接导入。
 *
 * @returns {Object} AI SDK 工具对象
 */
export function createVisualizeTool() {
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
      // ── 2. 参数校验（长度 / 去空白 / 未知字段）──
      const checked = validateVisualizeInput(input);
      if (!checked.ok) {
        return remember(toolCallId, {
          status: 'rejected',
          reason: REJECT_INVALID_INPUT,
          message: checked.message,
        });
      }

      // ── 3. 片段就绪：展示层从 output 里取 title / html 渲染沙箱 ──
      return remember(toolCallId, {
        status: 'ready',
        title: checked.title,
        html: checked.html,
      });
    } catch {
      // 程序错误如实标注，但绝不把异常原文回给模型。
      return remember(toolCallId, {
        status: 'rejected',
        reason: REJECT_INTERNAL_ERROR,
        message: '工具内部错误，请改为在正文中讲解',
      });
    }
  }

  return tool({
    description: VISUALIZE_DESCRIPTION,
    inputSchema: VISUALIZE_INPUT_SCHEMA,
    execute,
  });
}

export default createVisualizeTool;
