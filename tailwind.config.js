// tailwind.config.js
//
// 设计 token 来源：docs/REDESIGN_KARE.md (Layer 1)
// 本文件保留旧 `tech-*` 色板与默认 Tailwind 类做软迁移，
// 在新组件中应统一使用下方 ink / paper / sage / sun / level / state token。
module.exports = {
  content: [
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      // ─── E1·新增 colors ──────────────────────────────────────────
      colors: {
        // ── 旧 token（保留以便软迁移，后续 PR 迁完再清理） ──
        'tech': {
          'primary': '#0A192F',
          'secondary': '#112240',
          'accent': '#64FFDA',
          'text': '#8892B0',
          'highlight': '#CCD6F6',
        },

        // ── 新 token：6 个语义 namespace ──
        // 文字与轮廓
        ink: {
          900: '#1F2330',
          700: '#3F4554',
          500: '#6B7280',
          300: '#C4C9D2',
        },
        // 暖中性底色（占比 60%）
        paper: {
          50:  '#FBF8F3',
          100: '#F4EFE6',
          200: '#E9E2D2',
          900: '#1C1B1F',
        },
        // 主色 雾蓝灰（占比 30%）
        sage: {
          50:  '#EEF2F1',
          300: '#A7BFC0',
          500: '#6B8E8C',
          700: '#4F6D7A',
          900: '#2C3E45',
        },
        // 强调色 暖橙（占比 10%）
        sun: {
          300: '#F4C28A',
          500: '#E8A87C',
          700: '#C97D4A',
        },
        // 五档答案专属色（不参与全局调色，避免污染）
        level: {
          seed:    '#D9D2C5',
          sprout:  '#A7C4A0',
          sapling: '#7FA99B',
          tree:    '#4F8A8B',
          forest:  '#2E5E5C',
        },
        // 状态色（避免直接使用 red/green，去考试感）
        state: {
          good:  '#7FA99B',
          warn:  '#E8A87C',
          alert: '#C77B68',
          info:  '#6B8E8C',
        },
      },

      // ─── E5·语义 fontSize（与默认 text-xs/sm/base/... 共存）──
      fontSize: {
        'display': ['28px', { lineHeight: '36px', letterSpacing: '-0.01em' }],
        'h1':      ['22px', { lineHeight: '30px' }],
        'h2':      ['18px', { lineHeight: '26px' }],
        'body':    ['15px', { lineHeight: '24px' }],
        'small':   ['13px', { lineHeight: '20px' }],
        'caption': ['11px', { lineHeight: '16px' }],
      },

      // ─── 新 fontFamily（仅声明 stack，字体文件 P0 不引入）──
      // 实际字体文件加载延后到 P3 阶段（避免在 P0 引入 ~150KB 网络资产）。
      fontFamily: {
        sans:    ['"Inter Variable"', '"PingFang SC"', '"HarmonyOS Sans"', 'system-ui', 'sans-serif'],
        serif:   ['"Source Serif Variable"', '"Noto Serif SC"', 'Georgia', 'serif'],
        mono:    ['"JetBrains Mono Variable"', 'Menlo', 'Consolas', 'monospace'],
        display: ['"Fraunces"', '"Noto Serif SC"', 'serif'],
      },

      // ─── E2·圆角四档 + pill ────────────────────────────────────
      borderRadius: {
        'xs':   '4px',   // tag/badge/code-inline
        'sm':   '8px',   // 按钮、输入框、tooltip
        'md':   '12px',  // 卡片、消息气泡
        'lg':   '20px',  // 浮层、模态框
        'pill': '9999px',
      },

      // ─── E3·柔光阴影 ──────────────────────────────────────────
      boxShadow: {
        'soft':  '0 1px 2px rgba(31,35,48,0.04), 0 2px 8px rgba(31,35,48,0.04)',
        'lift':  '0 2px 6px rgba(31,35,48,0.06), 0 12px 32px rgba(31,35,48,0.08)',
        'float': '0 8px 24px rgba(31,35,48,0.10), 0 24px 64px rgba(31,35,48,0.12)',
        'inset': 'inset 0 1px 0 rgba(255,255,255,0.6)',
      },

      // ─── E4·动效曲线 ──────────────────────────────────────────
      transitionTimingFunction: {
        'soft': 'cubic-bezier(0.32, 0.72, 0.24, 1)',
        'snap': 'cubic-bezier(0.18, 0.89, 0.32, 1.28)',
      },
      transitionDuration: {
        'fast':    '120ms',
        'base':    '220ms',
        'slow':    '420ms',
        'theatre': '800ms',
      },

      // ─── E6·删除未使用动画 (blob / border-flow / pulse-slow) ──
      // 仅保留实际有引用的 fade-in-out / blink；bounce 在 Tailwind 默认已有
      animation: {
        'fade-in-out': 'fade-in-out 2s ease-in-out',
        'blink':       'blink 1s steps(2, start) infinite',
      },
      keyframes: {
        'fade-in-out': {
          '0%':   { opacity: '0', transform: 'translateY(-10px)' },
          '20%':  { opacity: '1', transform: 'translateY(0)' },
          '80%':  { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-10px)' },
        },
        'blink': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0' },
        },
      },

      backgroundImage: {
        // 旧 tech 渐变保留（仍在 ChatWindow tech 分支被用）
        'tech-gradient': 'linear-gradient(45deg, #112240 0%, #0A192F 100%)',
        'tech-grid': 'radial-gradient(#64FFDA 1px, transparent 1px)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    function({ addUtilities }) {
      const newUtilities = {
        '.scrollbar-custom': {
          '&::-webkit-scrollbar': {
            width: '4px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(100, 116, 139, 0.2)',
            borderRadius: '2px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: 'rgba(100, 116, 139, 0.3)',
          },
          '&::-webkit-scrollbar-button': {
            display: 'none',
          },
          'scrollbar-width': 'thin',
          'scrollbar-color': 'rgba(100, 116, 139, 0.2) transparent',
        },
        '.scrollbar-none': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
      };
      addUtilities(newUtilities, ['responsive', 'hover']);
    },
    require('tailwind-scrollbar'),
  ],
}
