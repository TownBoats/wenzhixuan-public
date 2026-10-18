/**
 * 运行层 · 教学模式（阶段 B · 任务 B2）
 *
 * 本文件只做一件事：把「这一轮给模型看什么指令、给它哪些工具」表达成**纯数据 + 纯函数**。
 * 它不读文件、不 import Markdown、不碰 React / localStorage，因此可以被 `node --test` 直接导入。
 * 教学指令的文本由调用方注入；唯一把 `.md` 变成字符串的入口是 `modePrompts.js`（Vite 的 `?raw`）。
 *
 * 为什么工具只存**名字**而不是工具实现（`决策记录.md` B-9）：
 *   - B2 不应提前依赖 B4 的 `askQuestion.js`，否则 B2 无法独立交付；
 *   - 「某个模式不注册工具」这件事，在数据层只需一个空数组就能被断言；
 *   - 名字映射成实现的动作放在装配层，缺实现时**直接抛错**，而不是悄悄变成一个没有工具的模式。
 *
 * 为什么 `normal` 的工具集合为空（`决策记录.md` B-1）：
 *   模型看不到工具就不可能调用它——这是代码级保证，不依赖提示词里写「不要提问」。
 *   `normal` 只作为「端点不支持工具」时的兜底模式存在，不出现在任何界面上。
 */

/** 唯一的提问工具名。B4 会用这个名字注册实现。 */
export const ASK_QUESTION_TOOL = 'ask_question';

/** 无工具兜底模式。名字与 `01-核心协议.md` §5 的 `modeSnapshot` 取值一致，不另起别名。 */
export const MODE_NORMAL = 'normal';

/** 唯一对用户可见的教学模式。 */
export const MODE_SOCRATIC = 'socratic';

export const MODE_IDS = Object.freeze([MODE_NORMAL, MODE_SOCRATIC]);

/** 每种模式允许注册的工具名（顺序即声明顺序）。 */
const TOOL_NAMES_BY_MODE = Object.freeze({
  [MODE_NORMAL]: Object.freeze([]),
  [MODE_SOCRATIC]: Object.freeze([ASK_QUESTION_TOOL]),
});

/**
 * 造一个模式对象。
 * `allowsQuestions` 是给工具执行层用的判据（B4 的 `mode_not_allowed`），
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
 * （旧路径的 `localStorage.mainAgentPrompt` 迁移属于 D6，不在运行层混装）。
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
