import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Icon, cn } from '@/components/ui';
import { VIZ_MESSAGE_TAG, buildSrcDoc } from './srcDoc';

/**
 * VisualizeCard — `visualize` 工具结果的沙箱渲染卡（explore/visualize 分支）
 *
 * 只承接「就绪」一种情况：completed + output.status === 'ready'。
 * running / rejected / failed 由 MessageContent 路由回 ToolCallCard，
 * 两种卡片不会同时出现，状态切换即换卡。
 *
 * 安全模型（与 ZCode visualize skill 对齐）：
 *   - iframe `sandbox="allow-scripts"`，**故意不给 allow-same-origin**：
 *     文档处于 opaque origin，读不到父页面的 localStorage（apikey 不出这条边界）；
 *   - srcDoc 里注入 CSP：脚本仅限内联 + CDN 白名单，`connect-src 'none'` 禁 fetch；
 *   - 高度经 postMessage 回报，只认 event.source 为本 iframe 且带 VIZ_MESSAGE_TAG 的消息。
 *
 * 高度策略：跟随内容，下限 120px，上限 720px——超出部分 iframe 内部滚动。
 * ZCode 的宿主允许撑到 10000px，聊天气泡里那样会把对话流顶得没法看，
 * 所以这里留了上限（skill 文档同时要求模型把可视化做紧凑）。
 */

const MIN_HEIGHT = 120;
const MAX_HEIGHT = 720;

function VisualizeCard({ title, html }) {
  const { t } = useTranslation();
  const iframeRef = useRef(null);
  const [height, setHeight] = useState(MIN_HEIGHT);
  const [showCode, setShowCode] = useState(false);
  const codeId = useId();

  const srcDoc = useMemo(() => buildSrcDoc(html), [html]);

  useEffect(() => {
    function onMessage(event) {
      // 只收本 iframe 发来的、带标记的高度消息；其余一律丢弃
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data;
      if (!data || data[VIZ_MESSAGE_TAG] !== 'height') return;
      const next = Number(data.height);
      if (!Number.isFinite(next) || next <= 0) return;
      setHeight(Math.min(Math.max(Math.ceil(next), MIN_HEIGHT), MAX_HEIGHT));
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <div className="overflow-hidden rounded-md border border-paper-200/80 bg-white shadow-soft">
      <div className="flex items-center gap-2.5 border-b border-paper-200/60 px-3 py-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage-50 text-sage-700">
          <Icon name="ChartColumn" size={14} />
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
          <code>{html}</code>
        </pre>
      )}

      <iframe
        ref={iframeRef}
        title={title}
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        className="block w-full border-0"
        style={{ height }}
      />
    </div>
  );
}

VisualizeCard.propTypes = {
  title: PropTypes.string.isRequired,
  html: PropTypes.string.isRequired,
};

export default memo(VisualizeCard);
