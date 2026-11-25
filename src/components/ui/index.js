// 问知轩原子组件 barrel
//
// 设计约定见 src/components/ui/README.md
// ESLint 强制：本目录下严禁 hex / 旧色家族 (eslint.config.js)
//
// 推荐导入：
//   import { Button, Input, Icon } from '@/components/ui';

export { default as Button } from './Button';
export { buttonVariants } from './Button.variants';
export { default as Input } from './Input';
export { default as Textarea } from './Textarea';
export { default as Icon } from './Icon';
export { default as Tag } from './Tag';
export { default as Tooltip } from './Tooltip';
export { cn } from './cn';

// 自绘图标层（品牌 logo / 五档生长 / 状态插画）
export * from './icons';
