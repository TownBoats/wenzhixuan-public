import React, { useState } from 'react';
import MarkdownRenderer from '../MarkdownRenderer/MarkdownRenderer';
import { useTranslation } from 'react-i18next';

const ThinkingIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
    />
  </svg>
);

const ChevronIcon = ({ open }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    fill="none" viewBox="0 0 24 24" stroke="currentColor"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

/**
 * ThinkingBlock — 可折叠的模型思考内容块。
 *
 * @param {string}  content     思考文本（Markdown）
 * @param {boolean} isStreaming 是否仍在流式输出中
 */
const ThinkingBlock = ({ content = '', isStreaming = false }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const charCount = content.length;
  const charLabel = charCount.toLocaleString();

  return (
    <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50/60 overflow-hidden text-sm">
      {/* 折叠头部 */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100/70 transition-colors duration-150"
      >
        <span className="text-violet-400">
          <ThinkingIcon />
        </span>

        {isStreaming ? (
          <span className="flex items-center gap-1.5 text-xs text-violet-500 font-medium animate-pulse">
            {t('ThinkingBlock.thinking', { defaultValue: '思考中' })}
            <span className="inline-flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-violet-400 animate-bounce [animation-delay:0ms]" />
              <span className="w-1 h-1 rounded-full bg-violet-400 animate-bounce [animation-delay:150ms]" />
              <span className="w-1 h-1 rounded-full bg-violet-400 animate-bounce [animation-delay:300ms]" />
            </span>
          </span>
        ) : (
          <span className="text-xs font-medium">
            {open
              ? t('ThinkingBlock.hideProcess', { defaultValue: '收起思考过程' })
              : t('ThinkingBlock.showProcess', { defaultValue: '查看思考过程' })}
          </span>
        )}

        {!isStreaming && charCount > 0 && (
          <span className="ml-auto text-xs text-slate-400 font-normal">
            {t('ThinkingBlock.charCount', { count: charLabel, defaultValue: `思考了 ${charLabel} 字` })}
          </span>
        )}

        {!isStreaming && (
          <span className={isStreaming ? 'hidden' : ''}>
            <ChevronIcon open={open} />
          </span>
        )}
      </button>

      {/* 展开内容 */}
      {open && !isStreaming && content && (
        <div className="px-4 py-3 border-t border-slate-200 bg-white/50">
          <div className="font-mono text-xs text-slate-600 leading-relaxed whitespace-pre-wrap break-words">
            <MarkdownRenderer content={content} />
          </div>
        </div>
      )}

      {/* 流式阶段展示最新内容片段（尾部 200 字） */}
      {isStreaming && content && (
        <div className="px-4 py-3 border-t border-slate-200 bg-white/50 max-h-28 overflow-hidden relative">
          <div className="font-mono text-xs text-slate-400 leading-relaxed whitespace-pre-wrap break-words">
            {content.slice(-200)}
          </div>
          {/* 顶部渐隐遮罩 */}
          <div className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-white/70 to-transparent pointer-events-none" />
        </div>
      )}
    </div>
  );
};

export default ThinkingBlock;
