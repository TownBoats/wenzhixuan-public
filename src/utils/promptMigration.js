/**
 * D6 · 提示词迁移判定（决策记录 D-1 决策 4 / D-4）
 *
 * 老用户的 `mainAgentPrompt` 可能存着含旧协议标签规则（〖response〗/〖question〗）
 * 的提示词。新路径的系统提示只由 `buildSystemPrompt` 生成，用户提示词没有入口，
 * 所以这里只做「判定 + 告知」，不拼接、不迁移。
 *
 * 判定规则（D-页面与模式.md 2.2）：存储值与「中英任一份当前内置提示词的原文」
 * **完全相等** → 视为未自定义；否则视为已自定义。模糊匹配会误判真正改过的
 * 提示词（静默丢用户内容），所以只做精确比对。
 *
 * 本文件不 import 翻译文件、不碰 localStorage：内置原文与存储由调用方注入，
 * 这样 Node 测试可以直接加载（`prompts.js` 顶层即碰 localStorage，不可 import）。
 */

export const MAIN_PROMPT_STORAGE_KEY = 'mainAgentPrompt';
export const PROMPT_MIGRATION_NOTICE_DISMISSED_KEY = 'prompt_migration_notice_dismissed';

/** 判定结果：'unset'（没存过）| 'builtin'（等于内置原文）| 'customized'（用户改过）。 */
export function classifyMainPrompt(storedValue, builtIns) {
  if (typeof storedValue !== 'string' || storedValue.length === 0) return 'unset';
  const list = Array.isArray(builtIns) ? builtIns : [];
  return list.some((builtIn) => builtIn === storedValue) ? 'builtin' : 'customized';
}

/**
 * 读取迁移状态。`storage` 只需提供 `getItem`（浏览器传 localStorage，测试传假对象）。
 * 任何读取异常都按「无需提示」处理——这条提示永远不该阻断页面。
 *
 * @returns {{ status: string, dismissed: boolean, shouldNotify: boolean }}
 */
export function readMainPromptMigrationState({ storage, builtIns } = {}) {
  let stored = null;
  let dismissed = false;
  try {
    stored = storage?.getItem?.(MAIN_PROMPT_STORAGE_KEY) ?? null;
    dismissed = storage?.getItem?.(PROMPT_MIGRATION_NOTICE_DISMISSED_KEY) === 'true';
  } catch {
    return { status: 'unset', dismissed: true, shouldNotify: false };
  }
  const status = classifyMainPrompt(stored, builtIns);
  return { status, dismissed, shouldNotify: status === 'customized' && !dismissed };
}

/** 记录「提示已关闭」。写入失败（隐私模式等）静默忽略，关闭态只保在内存里。 */
export function dismissMainPromptMigrationNotice(storage) {
  try {
    storage?.setItem?.(PROMPT_MIGRATION_NOTICE_DISMISSED_KEY, 'true');
  } catch {
    // 见上：提示相关的任何失败都不该影响页面
  }
}
