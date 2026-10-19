/**
 * 展示层 · VisualizeCard 的 srcDoc 装配（纯函数，可被 node --test 直接导入）
 *
 * 把模型给的 HTML 片段包成一个完整文档，注入四样东西：
 *   1. CSP meta：默认全禁，只放行内联脚本 / 内联样式 + CDN 白名单（jsdelivr / unpkg /
 *      cdnjs / esm.sh / Google & Bunny 字体），`connect-src 'none'` 掐死 fetch/XHR/WebSocket；
 *   2. 主题变量与工具类：从 tailwind.config.js 的 paper / ink / sage / sun / state 调色板
 *      映射成 ZCode visualize skill 约定的 `--background` `--card` `--viz-series-*` 等变量，
 *      模型在 skill 文档里看到的就是这套名字，两边对齐；
 *   3. 高度回报脚本：ResizeObserver 监听内容高度，postMessage 通知外层调 iframe 高度；
 *   4. 片段本身。
 *
 * 安全边界不在这个文件：iframe 的 `sandbox="allow-scripts"`（无 allow-same-origin）
 * 让文档处于 opaque origin，读不到 localStorage 里的 apikey——那是组件层的责任。
 */

/** postMessage 的消息标记：外层只认这个字段，且必须校验 event.source。 */
export const VIZ_MESSAGE_TAG = '__wenzhixuanViz';

/**
 * 主题变量：值取自 tailwind.config.js（paper/ink/sage/sun/state），
 * 改名对齐 ZCode skill 的语义命名，模型只需记一套名字。
 */
const THEME_CSS = `
:root {
  --background: #FBF8F3;        /* paper-50  */
  --foreground: #1F2330;        /* ink-900   */
  --card: #FFFFFF;
  --card-foreground: #1F2330;
  --popover: #FFFFFF;
  --popover-foreground: #1F2330;
  --primary: #4F6D7A;           /* sage-700  */
  --primary-foreground: #FFFFFF;
  --secondary: #EEF2F1;         /* sage-50   */
  --secondary-foreground: #2C3E45; /* sage-900 */
  --muted: #F4EFE6;             /* paper-100 */
  --muted-foreground: #6B7280;  /* ink-500   */
  --accent: #F8E7D3;            /* sun-300 淡色 */
  --accent-foreground: #4F4234;
  --destructive: #C77B68;       /* state.alert */
  --border: #E9E2D2;            /* paper-200 */
  --input: #E9E2D2;
  --ring: rgba(107, 142, 140, 0.35); /* sage-500 35% */
  --viz-series-1: #4F6D7A;      /* sage-700    */
  --viz-series-2: #C97D4A;      /* sun-700     */
  --viz-series-3: #7FA99B;      /* state.good  */
  --viz-series-4: #6B8E8C;      /* sage-500    */
  --viz-series-5: #E8A87C;      /* sun-500     */
  --viz-series-6: #C77B68;      /* state.alert */
  --font-size-base: 14px;
  --radius-lg: 12px;
  --radius-md: 8px;
  --radius-sm: 6px;
}
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0;
  background: transparent;      /* 融进聊天表面，不加自己的底色 */
  color: var(--foreground);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
  font-size: var(--font-size-base);
  line-height: 1.6;
}
h1 { font-size: calc(var(--font-size-base) + 4px); font-weight: 500; margin: 0 0 8px; }
h2 { font-size: calc(var(--font-size-base) + 2px); font-weight: 500; margin: 0 0 6px; }
h3, h4, h5, h6 { font-size: var(--font-size-base); font-weight: 500; margin: 0 0 4px; }
p { margin: 0 0 8px; }
hr { border: none; border-top: 1px solid var(--border); margin: 12px 0; }
code {
  font-family: ui-monospace, "Cascadia Code", Menlo, Consolas, monospace;
  font-size: 0.92em;
  background: var(--muted);
  border-radius: 4px;
  padding: 1px 5px;
}
pre {
  background: var(--muted);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  overflow-x: auto;
}
pre code { background: none; padding: 0; }
a { color: var(--primary); }

/* ── 工具类（ZCode skill 约定的子集）── */
.card {
  background: var(--card);
  color: var(--card-foreground);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 12px 14px;
}
.viz-stat .viz-stat-value {
  font-size: calc(var(--font-size-base) + 6px);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.viz-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
}
.viz-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.viz-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.viz-badge {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 9999px;
  background: var(--accent);
  color: var(--accent-foreground);
  font-size: 12px;
}
.text-small { font-size: calc(var(--font-size-base) - 2px); }
.text-muted { color: var(--muted-foreground); }
.text-destructive { color: var(--destructive); }
.tabular-nums { font-variant-numeric: tabular-nums; }
.sr-only {
  position: absolute; width: 1px; height: 1px;
  clip: rect(0 0 0 0); clip-path: inset(50%); overflow: hidden; white-space: nowrap;
}

/* ── 控件 ── */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 28px;
  padding: 3px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--foreground);
  font: inherit;
  font-size: calc(var(--font-size-base) - 1px);
  cursor: pointer;
  transition: background-color 120ms ease, border-color 120ms ease;
}
.btn:hover { background: var(--muted); }
.btn:focus-visible, .form-control:focus-visible, .form-select:focus-visible,
input[type="range"]:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 1px;
}
.btn-primary {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--primary-foreground);
}
.btn-primary:hover { background: var(--primary); filter: brightness(1.08); }
.btn-ghost { border-color: transparent; }
.btn[disabled] { opacity: 0.5; cursor: not-allowed; }
.form-label {
  display: block;
  font-size: calc(var(--font-size-base) - 2px);
  color: var(--muted-foreground);
  margin-bottom: 3px;
}
.form-control, .form-select {
  min-height: 32px;
  padding: 4px 10px;
  border: 1px solid var(--input);
  border-radius: var(--radius-md);
  background: var(--card);
  color: var(--foreground);
  font: inherit;
  font-size: calc(var(--font-size-base) - 1px);
}
.form-range { accent-color: var(--primary); }
.form-check { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.form-check-input { accent-color: var(--primary); }

/* ── 表格 ── */
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: calc(var(--font-size-base) - 1px);
}
.table th, .table td {
  text-align: left;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border);
}
.table th { font-weight: 500; color: var(--muted-foreground); }
.table .text-end, td.text-end, th.text-end { text-align: right; font-variant-numeric: tabular-nums; }
.table-responsive { overflow-x: auto; }

/* ── 进度条 ── */
.progress {
  height: 8px;
  border-radius: 9999px;
  background: var(--muted);
  overflow: hidden;
}
.progress-bar {
  height: 100%;
  border-radius: 9999px;
  background: var(--viz-series-1);
  transition: width 220ms ease;
}

@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
`.trim();

/** CSP：与 ZCode 白名单对齐；connect-src 'none' 掐死一切运行时请求。 */
const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com https://esm.sh",
  "style-src 'unsafe-inline' https://fonts.googleapis.com https://fonts.bunny.net",
  "font-src https://fonts.gstatic.com https://fonts.bunny.net data:",
  "img-src data: https:",
  "connect-src 'none'",
].join('; ');

/** 高度回报脚本：load / DOMContentLoaded / ResizeObserver 三路触发，去抖到一帧。 */
const HEIGHT_SCRIPT = `
(function () {
  var pending = false;
  function report() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      var h = Math.ceil(document.documentElement.getBoundingClientRect().height);
      if (h > 0) parent.postMessage({ ${VIZ_MESSAGE_TAG}: 'height', height: h }, '*');
    });
  }
  window.addEventListener('load', report);
  document.addEventListener('DOMContentLoaded', report);
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(report).observe(document.documentElement);
  }
  report();
})();
`.trim();

/**
 * 把 HTML 片段装配成 iframe srcDoc 文档。
 *
 * @param {string} fragment 模型产出的 HTML 片段（已校验非空）
 * @returns {string} 完整 HTML 文档
 */
export function buildSrcDoc(fragment) {
  if (typeof fragment !== 'string' || !fragment.trim()) {
    throw new Error('buildSrcDoc: fragment 必须是非空字符串');
  }
  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">`,
    `<style>${THEME_CSS}</style>`,
    '</head>',
    '<body>',
    fragment,
    `<script>${HEIGHT_SCRIPT}</script>`,
    '</body>',
    '</html>',
  ].join('\n');
}

export default buildSrcDoc;
