/**
 * 旧教学提示词的检测。
 *
 * 旧 `mainAgentPrompt` 可能含已废弃的标签协议，现行系统提示不使用它，
 * 因此只判断是否需要告知用户，不拼接、不迁移。
 * 与内置原文完全相等才算未自定义；不做模糊匹配，以免误判用户改过的内容。
 * 内置原文与存储由调用方注入，本文件可被 Node 直接导入。
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
