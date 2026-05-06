import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MarkdownRenderer from '../MarkdownRenderer/MarkdownRenderer';
import { useTranslation } from 'react-i18next';

/**
 * ThinkingBlock — 侧边线风格的思考内容块
 *
 * 色彩方案与助手气泡(bg-[#F5F1EA])协调，使用 amber/stone 暖色系。
 *
 * 三态：
 * 1. 流式中：侧边线 + 渐隐内容 + 闪烁光标
 * 2. 完成折叠：侧边线 + 摘要行（可点击展开）
 * 3. 完成展开：侧边线 + 完整 Markdown 内容
 *
 * @param {string}  content     思考文本（Markdown）
 * @param {boolean} isStreaming 是否仍在流式输出中
 */
const ThinkingBlock = ({ content = '', isStreaming = false }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const charCount = content.length;
  const charLabel = charCount.toLocaleString();

  // 流式阶段：截取最后 400 字用于渲染
  const streamingContent = content.slice(-400);

  if (isStreaming) {
    return (
      <div className="mb-3 border-l-2 border-amber-400/70 pl-3 py-1">
        {/* 标题行 */}
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse [animation-delay:200ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse [animation-delay:400ms]" />
          </span>
          <span className="text-xs text-stone-500 font-medium">
            {t('ThinkingBlock.thinking', { defaultValue: '正在思考' })}
          </span>
        </div>

        {/* 流式内容区域 */}
        {content && (
          <div
            className="relative max-h-32 overflow-hidden"
            style={{
              maskImage: 'linear-gradient(to bottom, transparent 0%, black 30%)',
              WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 30%)',
            }}
          >
            <div className="text-sm text-stone-500 leading-relaxed">
              <MarkdownRenderer content={streamingContent} />
            </div>
          </div>
        )}

        {/* 闪烁光标 */}
        <span className="inline-block w-0.5 h-4 bg-amber-500/70 animate-blink ml-0.5 align-middle" />
      </div>
    );
  }

  // 完成态
  return (
    <div className="mb-3 border-l-2 border-stone-300/60 hover:border-amber-400/70 transition-colors duration-200 pl-3 py-1">
      {/* 摘要行 - 可点击 */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs text-stone-500 hover:text-stone-700 transition-colors duration-150 w-full text-left"
      >
        <span className="text-amber-500/80">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
        </span>
        <span className="font-medium">
          {t('ThinkingBlock.done', { defaultValue: '已深度思考' })}
        </span>
        {charCount > 0 && (
          <span className="text-stone-400">
            · {t('ThinkingBlock.charCount', { count: charLabel, defaultValue: `${charLabel} 字` })}
          </span>
        )}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-3 w-3 ml-auto transition-transform duration-200 text-stone-400 ${open ? 'rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* 展开内容 */}
      <AnimatePresence initial={false}>
        {open && content && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="mt-2 pt-2 border-t border-stone-200/60">
              <div className="text-sm text-stone-600 leading-relaxed">
                <MarkdownRenderer content={content} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ThinkingBlock;
