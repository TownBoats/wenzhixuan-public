/**
 * 教学模式：决定每种模式的教学指令与可用工具（纯数据 + 纯函数）。
 *
 * - 教学指令由调用方注入；`.md` 只由 `modePrompts.js` 读取，本文件可被 Node 直接导入
 * - 只存工具名，由装配层映射成实现；缺实现时直接抛错，不静默降级
 * - `normal` 不注册任何工具，作为端点不支持工具时的兜底，不出现在界面上
 */

/** 唯一的提问工具名。工具实现用这个名字注册。 */
export const ASK_QUESTION_TOOL = 'ask_question';

/** 可视化工具名：模型产出 HTML 片段，展示层沙箱渲染。 */
export const VISUALIZE_TOOL = 'visualize';

/** 讲解卡片工具名：模型产出纯 SVG 静态图，空 sandbox 渲染（无脚本）。 */
export const EXPLAIN_CARD_TOOL = 'explain_card';

/** 学习计划工具名：模型维护结构化计划，程序合并与校验。 */
export const LEARNING_PLAN_TOOL = 'update_learning_plan';

/** 无工具兜底模式。名字与 `modeSnapshot` 取值一致，不另起别名。 */
export const MODE_NORMAL = 'normal';

/** 唯一对用户可见的教学模式。 */
export const MODE_SOCRATIC = 'socratic';

export const MODE_IDS = Object.freeze([MODE_NORMAL, MODE_SOCRATIC]);

/** 每种模式允许注册的工具名（顺序即声明顺序）。 */
const TOOL_NAMES_BY_MODE = Object.freeze({
  [MODE_NORMAL]: Object.freeze([]),
  [MODE_SOCRATIC]: Object.freeze([
    LEARNING_PLAN_TOOL,
    ASK_QUESTION_TOOL,
    VISUALIZE_TOOL,
    EXPLAIN_CARD_TOOL,
  ]),
});

/**
 * 造一个模式对象。
 * `allowsQuestions` 是给工具执行层用的判据（`ask_question` 的 `mode_not_allowed`），
 * 与「注册了哪些工具」分开：注册是装配事实，允许与否是业务规则。
 */
function createMode({ id, teaching, toolNames, allowsQuestions }) {
  if (typeof teaching !== 'string' || !teaching.trim()) {
    throw new Error(`modes: 模式 ${id} 的教学指令为空`);
  }
  return Object.freeze({
    id,
    teaching: teaching.trim(),
    toolNames: Object.freeze([...toolNames]),
    allowsQuestions: Boolean(allowsQuestions),
  });
}

/**
 * 装配全部模式。教学指令由调用方注入，本函数不关心它从哪来。
 *
 * @param {{ normal: string, socratic: string }} teachings 各模式的 Markdown 原文
 * @returns {{ normal: Object, socratic: Object }}
 */
export function createModes(teachings) {
  if (!teachings || typeof teachings !== 'object') {
    throw new Error('modes: 缺少教学指令文本');
  }
  const modes = {};
  for (const id of MODE_IDS) {
    modes[id] = createMode({
      id,
      teaching: teachings[id],
      toolNames: TOOL_NAMES_BY_MODE[id],
      allowsQuestions: id === MODE_SOCRATIC,
    });
  }
  return Object.freeze(modes);
}

/** 按 ID 取模式；取不到就抛错（不返回 undefined，避免上层静默降级）。 */
export function getMode(modes, id) {
  const mode = modes?.[id];
  if (!mode) {
    throw new Error(`modes: 未知模式 ${id}（可用：${MODE_IDS.join(' / ')}）`);
  }
  return mode;
}

/**
 * 系统提示词只由模式决定。
 * 签名只有一个参数，这是**结构上的保证**：用户自定义提示词没有入口可拼进来
 * （旧的 `localStorage.mainAgentPrompt` 由 `promptMigration.js` 处理，不在运行层混装）。
 */
export function buildSystemPrompt(mode) {
  if (!mode || typeof mode.teaching !== 'string') {
    throw new Error('modes: buildSystemPrompt 需要模式对象');
  }
  return mode.teaching;
}

/**
 * 把模式声明的工具名映射成真实工具集合，交给 `modelAdapter`。
 * `normal` 返回空对象——「不注册工具」在此处落地为一个空对象，而不是一段提示词。
 * 声明了工具却没给实现，属于装配错误，必须当场失败。
 *
 * @param {Object} mode 模式对象
 * @param {Record<string, Object>} [registry] 工具名 → AI SDK 工具对象
 * @returns {Record<string, Object>}
 */
export function toolsForMode(mode, registry) {
  if (!mode || !Array.isArray(mode.toolNames)) {
    throw new Error('modes: toolsForMode 需要模式对象');
  }
  const tools = {};
  for (const name of mode.toolNames) {
    const implementation = registry?.[name];
    if (!implementation) {
      throw new Error(`modes: 模式 ${mode.id} 需要工具 ${name}，但装配时没有提供实现`);
    }
    tools[name] = implementation;
  }
  return tools;
}

export default createModes;
