import { memo, useId, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Icon, cn } from '@/components/ui';
import { buildExplainSrcDoc } from './srcDoc';

/**
 * ExplainCard — `explain_card` 工具结果的静态 SVG 渲染卡（explore/visualize 分支）
 *
 * 只承接「就绪」一种情况：completed + output.status === 'ready'。
 * running / rejected / failed 由 MessageContent 路由回 ToolCallCard。
 *
 * 与 VisualizeCard 的三处不同：
 *   1. iframe 是**空 sandbox**——不给 allow-scripts，文档里也没有任何脚本，
 *      安全模型从「沙箱 + CSP 限脚本」升级成「根本没有脚本」；
 *   2. 高度用 CSS aspect-ratio 从 viewBox 推出（规范固定 "0 0 680 H"），
 *      不监听 postMessage、不用 ResizeObserver；
 *   3. 没有查看源码以外的任何交互——静态图就该是静态的。
 */

/** viewBox 数据缺失时的兜底（历史数据或异常输出），按规范的 680 基准给一个 2:1。 */
const FALLBACK_VIEWBOX = { width: 680, height: 340 };

function ExplainCard({ title, svg, viewBox }) {
  const { t } = useTranslation();
  const [showCode, setShowCode] = useState(false);
  const codeId = useId();

  const srcDoc = useMemo(() => buildExplainSrcDoc(svg), [svg]);
  const box =
    viewBox && Number.isFinite(viewBox.width) && Number.isFinite(viewBox.height) && viewBox.width > 0
      ? viewBox
      : FALLBACK_VIEWBOX;

  return (
    <div className="overflow-hidden rounded-md border border-paper-200/80 bg-white shadow-soft">
      <div className="flex items-center gap-2.5 border-b border-paper-200/60 px-3 py-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage-50 text-sage-700">
          <Icon name="Shapes" size={14} />
        </span>
        <span className="min-w-0 flex-1 truncate text-small font-medium text-ink-900" title={title}>
          {title}
        </span>
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
          {showCode ? t('AgentChat.visualizeCard.hideCode') : t('AgentChat.visualizeCard.viewCode')}
        </button>
      </div>

      {showCode && (
        <pre
          id={codeId}
          className="max-h-64 overflow-auto border-b border-dashed border-paper-200 bg-paper-100/60 px-3 py-2 text-caption text-ink-700 scrollbar-custom"
        >
          <code>{svg}</code>
        </pre>
      )}

      <iframe
        title={title}
        sandbox=""
        srcDoc={srcDoc}
        className="block w-full border-0"
        style={{ aspectRatio: `${box.width} / ${box.height}` }}
      />
    </div>
  );
}

ExplainCard.propTypes = {
  title: PropTypes.string.isRequired,
  svg: PropTypes.string.isRequired,
  viewBox: PropTypes.shape({
    width: PropTypes.number,
    height: PropTypes.number,
  }),
};

export default memo(ExplainCard);
