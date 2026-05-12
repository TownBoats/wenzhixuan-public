// 问知轩自绘图标层
//
// 设计规格：docs/REDESIGN_KARE.md §2.3（自绘 7 + 状态扩展）
//
// 与 lucide-react 的分工：
//   - lucide：通用工具图标（Settings, Send, Trash2, ChevronDown ...）
//   - 本目录：与产品人格强相关的"自绘资产"，currentColor 染色，
//     可在文档/营销/产品页混用，体积小（每个 < 2KB）。
//
// 推荐导入：
//   import { BrandLogo, LevelIcon, CoffeeCup } from '@/components/ui/icons';

export { default as BrandLogo } from './BrandLogo';

// ── 五档生长 ──
export { default as LevelSeed }    from './LevelSeed';
export { default as LevelSprout }  from './LevelSprout';
export { default as LevelSapling } from './LevelSapling';
export { default as LevelTree }    from './LevelTree';
export { default as LevelForest }  from './LevelForest';
export { default as LevelIcon, LEVEL_COMPONENTS, LEGACY_LEVEL_ALIAS } from './LevelIcon';

// ── 状态插画 ──
export { default as CoffeeCup }   from './CoffeeCup';
export { default as Flag }        from './Flag';
export { default as Key }         from './Key';
export { default as Hourglass }   from './Hourglass';
export { default as Screwdriver } from './Screwdriver';
