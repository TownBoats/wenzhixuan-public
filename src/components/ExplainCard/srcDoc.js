/**
 * 展示层 · ExplainCard 的 srcDoc 装配（纯函数，可被 node --test 直接导入）
 *
 * 与 VisualizeCard 的关键区别：这个文档里**一行脚本都没有**。
 * iframe 用空 sandbox（连 allow-scripts 都不给），CSP 只允许内联样式——
 * SVG 是纯标记，SMIL / CSS @keyframes 动画不依赖脚本，规范第 09 模块
 * 许可的动效在这个盒子里照常工作。
 *
 * 高度不由文档回报：工具执行时已从 viewBox 解析出宽高，
 * 组件用 CSS aspect-ratio 定高（见 ExplainCard.jsx），
 * 所以这里连 VisualizeCard 那套 ResizeObserver / postMessage 都不需要。
 */

/** CSP：默认全禁，只放内联样式；图片、字体、连接、脚本全部禁死。 */
const CSP = ["default-src 'none'", "style-src 'unsafe-inline'"].join('; ');

/** 基底样式：透明背景融入聊天表面；SVG 宽度撑满、高度由纵横比驱动。 */
const BASE_CSS = `
html, body {
  margin: 0; padding: 0;
  background: transparent;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
}
svg { display: block; width: 100%; height: auto; }
`.trim();

/**
 * 把 SVG 片段装配成 iframe srcDoc 文档。
 *
 * @param {string} svg 单根 <svg> 元素（工具层已校验）
 * @returns {string} 完整 HTML 文档
 */
export function buildExplainSrcDoc(svg) {
  if (typeof svg !== 'string' || !svg.trim()) {
    throw new Error('buildExplainSrcDoc: svg 必须是非空字符串');
  }
  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">`,
    `<style>${BASE_CSS}</style>`,
    '</head>',
    '<body>',
    svg,
    '</body>',
    '</html>',
  ].join('\n');
}

export default buildExplainSrcDoc;
