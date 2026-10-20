import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Icon, cn } from '@/components/ui';
import { parseViewBox } from '@/agent/tools/explainCard.js';
import { extractPartialStringField } from '@/utils/partialJsonField.js';
import { STREAM_MESSAGE_TAG, buildExplainSrcDoc, buildStreamSrcDoc } from './srcDoc';

/**
 * ExplainCard — `explain_card` 工具结果的静态 SVG 渲染卡（explore/visualize 分支）
 *               + 流式生成中实时预览（explore/streaming-cards 分支）
 *
 * 三种状态：
 *   - running  ：桥接 iframe（sandbox=allow-scripts），postMessage 增量 + 消毒后实时渲染；
 *               viewBox 在根标签最前流出，一到达就用 aspect-ratio 定高，卡片不跳动。
 *   - completed：零脚本静态 iframe（空 sandbox），这也是「最终的干净渲染」——
 *               流式预览可能残留的半截状态，由这次整体重绘抹平。
 *   - rejected / failed：不路由到这里（MessageContent 交给 ToolCallCard）。
 *
 * 安全模型（流式态是新增的妥协面，见 srcDoc.js 文件头）：
 *   桥接脚本是我们注入的；模型内容经消毒（剥 script / foreignObject / on* 属性）
 *   才进 DOM；iframe 处于 opaque origin，读不到 localStorage。
 */

/** viewBox 数据缺失时的兜底（历史数据或异常输出），按规范的 680 基准给一个 2:1。 */
const FALLBACK_VIEWBOX = { width: 680, height: 340 };
/** 流式早期（viewBox 尚未流出）的占位高度。 */
const STREAM_PLACEHOLDER_HEIGHT = 160;

function ExplainCard({ title, svg, viewBox, status = 'completed', partialInput = null }) {
  const { t } = useTranslation();
  const streaming = status === 'running';
  const [showCode, setShowCode] = useState(false);
  const codeId = useId();
  const streamRef = useRef(null);
  const latestSvgRef = useRef('');

  // ── 流式期间：从参数增量里读出 title / svg 的已到达部分 ──
  const partialSvg = streaming
    ? extractPartialStringField(partialInput ?? '', 'svg')
    : { found: false, value: '', complete: false };
  const partialTitle = streaming
    ? extractPartialStringField(partialInput ?? '', 'title')
    : { found: false, value: '', complete: false };

  const displayTitle = streaming
    ? partialTitle.value || t('AgentChat.explainCard.drawing')
    : title;

  const box = streaming
    ? parseViewBox(partialSvg.value)
    : viewBox && Number.isFinite(viewBox.width) && Number.isFinite(viewBox.height) && viewBox.width > 0
      ? viewBox
      : FALLBACK_VIEWBOX;

  // 桥接文档只在进入流式态时装配一次（内容恒定，增量走 postMessage）
  const streamSrcDoc = useMemo(() => (streaming ? buildStreamSrcDoc() : null), [streaming]);
  const staticSrcDoc = useMemo(() => (streaming ? null : buildExplainSrcDoc(svg)), [streaming, svg]);

  // ── 增量投递：svg 文本每变一次发一次；iframe 内桥接器 rAF 合帧 ──
  latestSvgRef.current = partialSvg.value;
  const postLatest = () => {
    const win = streamRef.current?.contentWindow;
    if (win && latestSvgRef.current) {
      win.postMessage({ [STREAM_MESSAGE_TAG]: 1, svg: latestSvgRef.current }, '*');
    }
  };
  useEffect(() => {
    if (streaming && partialSvg.found) postLatest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streaming, partialSvg.value]);

  const frameStyle = box
    ? { aspectRatio: `${box.width} / ${box.height}` }
    : { height: STREAM_PLACEHOLDER_HEIGHT };

  return (
    <div className="overflow-hidden rounded-md border border-paper-200/80 bg-white shadow-soft">
      <div className="flex items-center gap-2.5 border-b border-paper-200/60 px-3 py-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage-50 text-sage-700">
          <Icon name="Shapes" size={14} />
        </span>
        <span
          className="min-w-0 flex-1 truncate text-small font-medium text-ink-900"
          title={displayTitle}
        >
          {displayTitle}
        </span>
        {streaming ? (
          <span className="shrink-0 rounded-pill bg-sage-50 px-2 py-0.5 text-caption font-medium text-sage-700">
            {t('AgentChat.explainCard.drawing')}
          </span>
        ) : (
          <button
            type="button"
            aria-expanded={showCode}
            aria-controls={codeId}
            onClick={() => setShowCode((value) => !value)}
            className={cn(
              'shrink-0 rounded-pill px-2 py-0.5 text-caption text-ink-500',
              'transition-colors duration-fast hover:bg-paper-100 hover:text-ink-700',
              'outline-none focus-visible:ring-2 focus-visible:ring-sage-500/25',
            )}
          >
            {showCode
              ? t('AgentChat.visualizeCard.hideCode')
              : t('AgentChat.visualizeCard.viewCode')}
          </button>
        )}
      </div>

      {!streaming && showCode && (
        <pre
          id={codeId}
          className="max-h-64 overflow-auto border-b border-dashed border-paper-200 bg-paper-100/60 px-3 py-2 text-caption text-ink-700 scrollbar-custom"
        >
          <code>{svg}</code>
        </pre>
      )}

      {streaming ? (
        <iframe
          ref={streamRef}
          title={displayTitle}
          sandbox="allow-scripts"
          srcDoc={streamSrcDoc}
          onLoad={postLatest}
          className="block w-full border-0"
          style={frameStyle}
        />
      ) : (
        <iframe
          title={title}
          sandbox=""
          srcDoc={staticSrcDoc}
          className="block w-full border-0"
          style={frameStyle}
        />
      )}
    </div>
  );
}

ExplainCard.propTypes = {
  /** 就绪态必填；流式态允许为空（标题可能还没流出来）。 */
  title: PropTypes.string,
  svg: PropTypes.string,
  viewBox: PropTypes.shape({
    width: PropTypes.number,
    height: PropTypes.number,
  }),
  status: PropTypes.oneOf(['running', 'completed']),
  /** 工具参数的累计增量文本（半截 JSON），仅 running 态使用。 */
  partialInput: PropTypes.string,
};

export default memo(ExplainCard);
