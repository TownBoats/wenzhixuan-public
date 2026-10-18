/**
 * 运行层 · 教学指令的读取入口（阶段 B · 任务 B2）
 *
 * 全项目只有这一个文件使用 Vite 的 `?raw` 导入。
 * 原因（实测）：`node --test` 不经过 Vite，Node 22 没有 `.md` 加载器，
 * 直接 import 会抛 `ERR_UNKNOWN_FILE_EXTENSION: Unknown file extension ".md"`。
 * 所以把「环境相关的读法」关在这一个文件里，`modes.js` 保持纯函数、可被 Node 直接导入。
 *
 * 这个文件不含任何逻辑：只把两份 Markdown 变成字符串，交给 `createModes` 装配。
 * 页面路径（B5）import 这里拿到成品；测试 import `modes.js`，不经过本文件。
 */
import normalMd from './skills/normal.md?raw';
import socraticMd from './skills/socratic.md?raw';
import { createModes, MODE_NORMAL, MODE_SOCRATIC } from './modes.js';

export const MODES = createModes({
  [MODE_NORMAL]: normalMd,
  [MODE_SOCRATIC]: socraticMd,
});

export default MODES;
