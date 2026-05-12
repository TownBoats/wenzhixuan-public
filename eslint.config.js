import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

// ─── 设计 token 强制规则 ────────────────────────────────────────────
// 详见 docs/REDESIGN_KARE.md 与 docs/REDESIGN_KARE_FEASIBILITY.md
//
// 现阶段策略：
//   1. 全仓 className 出现的 hex 字面量 → 仅 warn，不阻塞构建（旧代码迁移期）
//   2. 全新 src/components/ui/** 与未来重构子目录 → 严格 error
//      （新增原子组件必须 100% 走 token，无遗留包袱）
//
// 被封禁的家族（应改用 ink/paper/sage/sun/level/state token）：
//   cyan-*, blue-*, amber-*, slate-*, sky-*, emerald-*, rose-* 等任意调色板
const BANNED_COLOR_FAMILY = '(cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|red|orange|amber|yellow|lime|emerald|teal|slate|zinc|stone)'

const hexInClassNameRule = {
  selector: `JSXAttribute[name.name='className'] Literal[value=/#[0-9a-fA-F]{3,8}/]`,
  message:
    'Inline hex color in className is forbidden. Use Tailwind tokens from the design system (ink/paper/sage/sun/level/state). See docs/REDESIGN_KARE.md.',
}

const tailwindFamilyInClassNameRule = {
  selector: `JSXAttribute[name.name='className'] Literal[value=/(^|\\s)(bg|text|border|ring|from|to|via|fill|stroke|divide|placeholder|caret|accent|outline|shadow)-${BANNED_COLOR_FAMILY}-/]`,
  message:
    'Legacy Tailwind color family is forbidden in new code. Migrate to ink/paper/sage/sun/level/state tokens. See docs/REDESIGN_KARE.md.',
}

export default [
  // CommonJS 配置文件不参与 ESM 规则检查
  { ignores: ['dist', 'tailwind.config.js', 'postcss.config.js'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: '18.3' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react/jsx-no-target-blank': 'off',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // 旧代码：仅 hex 字面量警告，迁移期不阻塞
      'no-restricted-syntax': [
        'warn',
        hexInClassNameRule,
      ],
    },
  },
  // ── 新原子组件目录：严格 error，零容忍 ──
  {
    files: ['src/components/ui/**/*.{js,jsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        hexInClassNameRule,
        tailwindFamilyInClassNameRule,
      ],
    },
  },
]
