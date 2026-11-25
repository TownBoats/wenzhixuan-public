/**
 * 教学指令的唯一读取入口（Vite `?raw`）。
 *
 * Node 无法直接导入 `.md`，因此把读取方式隔离在本文件，
 * `modes.js` 保持为纯函数。测试导入 `modes.js`，不经过这里。
 */
import normalMd from './skills/normal.md?raw';
import socraticMd from './skills/socratic.md?raw';
import { createModes, MODE_NORMAL, MODE_SOCRATIC } from './modes.js';

export const MODES = createModes({
  [MODE_NORMAL]: normalMd,
  [MODE_SOCRATIC]: socraticMd,
});

export default MODES;
