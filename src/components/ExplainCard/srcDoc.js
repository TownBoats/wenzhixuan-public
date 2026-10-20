/**
 * 展示层 · ExplainCard 的 srcDoc 装配（纯函数，可被 node --test 直接导入）
 *
 * 两份文档对应两种状态：
 *   1. `buildExplainSrcDoc`（就绪态）：一行脚本都没有，iframe 空 sandbox，
 *      「没有脚本」是最硬的边界。
 *   2. `buildStreamSrcDoc`（流式生成中，explore/streaming-cards）：需要脚本来收
 *      postMessage 增量，sandbox 放开 allow-scripts——但脚本是我们注入的桥接器，
 *      模型内容一律经消毒后才进 DOM（剥 <script>/<foreignObject>/on* 属性）。
 *
 * 高度不由文档回报：viewBox 在根标签上、最先流出，父级从增量文本解析后用
 * CSS aspect-ratio 定高（见 ExplainCard.jsx），桥接器不需要量高度。
 */

/** postMessage 的消息标记：桥接器只认这个字段，且必须校验 event.source === parent。 */
export const STREAM_MESSAGE_TAG = '__wzxExplainStream';

/** 就绪态 CSP：默认全禁，只放内联样式。 */
const CSP_STATIC = ["default-src 'none'", "style-src 'unsafe-inline'"].join('; ');

/**
 * 流式态 CSP：脚本仅限内联（桥接器本身）；模型内容里的 <script> 由消毒器剥除，
 * innerHTML 插入的 script 按 HTML 规范本就不执行，真正的洞是 on* 事件属性——消毒堵它。
 * connect/img/font/media 全禁（default-src 'none' 兜底）。
 */
const CSP_STREAM = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
].join('; ');

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
 * 桥接脚本：收增量 → 消毒 → rAF 合帧写入。
 *
 * 消毒策略（白名单思维，宁可错杀）：
 *   - 元素：script / foreignObject / iframe / object / embed / link / meta / base 整体移除
 *     （foreignObject 能塞任意 HTML，是 SVG 里最大的逃逸面）；
 *   - 属性：一切 on* 事件属性；href / xlink:href 以 javascript: / vbscript: / data: 开头。
 * HTML 解析器对半截标签有容错（未闭合的标签暂不渲染，等下一段补全后自然出现），
 * 这正是流式预览想要的行为。
 */
const BRIDGE_SCRIPT = `
(function () {
  var pending = null;
  var scheduled = false;
  var BANNED_TAGS = ['script', 'foreignobject', 'iframe', 'object', 'embed', 'link', 'meta', 'base'];

  function sanitize(text) {
    var tpl = document.createElement('template');
    tpl.innerHTML = text;
    var root = tpl.content;

    for (var t = 0; t < BANNED_TAGS.length; t++) {
      var nodes = root.querySelectorAll(BANNED_TAGS[t]);
      for (var i = nodes.length - 1; i >= 0; i--) nodes[i].remove();
    }

    var all = root.querySelectorAll('*');
    for (var j = 0; j < all.length; j++) {
      var el = all[j];
      for (var a = el.attributes.length - 1; a >= 0; a--) {
        var name = el.attributes[a].name.toLowerCase();
        var value = String(el.attributes[a].value || '').replace(/[\\s\\u0000-\\u001F]/g, '').toLowerCase();
        if (name.indexOf('on') === 0) el.removeAttribute(el.attributes[a].name);
        else if ((name === 'href' || name === 'xlink:href') &&
                 (value.indexOf('javascript:') === 0 || value.indexOf('vbscript:') === 0 || value.indexOf('data:') === 0)) {
          el.removeAttribute(el.attributes[a].name);
        }
      }
    }
    return tpl.innerHTML;
  }

  function apply() {
    scheduled = false;
    if (pending === null) return;
    var host = document.getElementById('viz');
    if (host) host.innerHTML = sanitize(pending);
    pending = null;
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    // 不用 requestAnimationFrame：后台/被遮挡的标签页里 rAF 会饿死，
    // 增量更新必须不依赖可见性（实测 2026-10-20 后台标签页 rAF 不触发）
    setTimeout(apply, 32);
  }

  window.addEventListener('message', function (event) {
    if (event.source !== parent) return;
    var data = event.data;
    if (!data || data.${STREAM_MESSAGE_TAG} !== 1 || typeof data.svg !== 'string') return;
    pending = data.svg;
    schedule();
  });
})();
`.trim();

function wrapDocument(csp, bodyExtra) {
  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
    `<style>${BASE_CSS}</style>`,
    '</head>',
    '<body>',
    bodyExtra,
    '</body>',
    '</html>',
  ].join('\n');
}

/**
 * 就绪态：把 SVG 片段装配成零脚本文档。
 *
 * @param {string} svg 单根 <svg> 元素（工具层已校验）
 * @returns {string} 完整 HTML 文档
 */
export function buildExplainSrcDoc(svg) {
  if (typeof svg !== 'string' || !svg.trim()) {
    throw new Error('buildExplainSrcDoc: svg 必须是非空字符串');
  }
  return wrapDocument(CSP_STATIC, svg);
}

/**
 * 流式态：只含桥接器与一个空容器，等内容经 postMessage 到达。
 *
 * @returns {string} 完整 HTML 文档
 */
export function buildStreamSrcDoc() {
  return wrapDocument(CSP_STREAM, `<div id="viz" aria-live="polite"></div>\n<script>${BRIDGE_SCRIPT}</script>`);
}

export default buildExplainSrcDoc;
