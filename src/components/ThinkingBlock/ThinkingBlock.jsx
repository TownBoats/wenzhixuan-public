import { useState } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import MarkdownRenderer from '../MarkdownRenderer/MarkdownRenderer';
import { Icon, CoffeeCup, cn } from '@/components/ui';

/**
 * ThinkingBlock — 助手"内心独白"块（P3d Susan Kare 重设计版）
 *
 * 设计规格见 docs/REDESIGN_KARE.md §3.4：从"编译器输出"变成"咖啡杯"。
 *
 * 视觉迁移自旧版：
 *   - 左侧 amber 竖线 + stone 文字     → paper-100 卡片 + ink 文字
 *   - 内联 SVG 灯泡 + amber 三点 pulse → CoffeeCup 自绘插画 +
 *                                       sage-300 三点 pulse
 *   - amber 闪烁光标                  → sage-500 闪烁光标
 *   - 摘要行普通 sans                 → 衬线 italic（"内心独白"语气）
 *
 * 三态保持不变：streaming / collapsed / expanded。
 */
const ThinkingBlock = ({ content = '', isStreaming = false }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const charCount = content.length;
  const charLabel = charCount.toLocaleString();
  const streamingContent = content.slice(-400);

  // ── 流式态：咖啡杯 + 渐隐截取 + 闪烁光标 ──
  if (isStreaming) {
    return (
      <div className="mb-3 rounded-md border border-paper-200 bg-paper-50 p-3">
        <div className="mb-2 flex items-center gap-2">
          <CoffeeCup size={18} className="text-sage-500 shrink-0" />
          <span className="inline-flex gap-0.5">
            <span className="h-1.5 w-1.5 rounded-pill bg-sage-300 animate-pulse" />
            <span className="h-1.5 w-1.5 rounded-pill bg-sage-300 animate-pulse [animation-delay:200ms]" />
            <span className="h-1.5 w-1.5 rounded-pill bg-sage-300 animate-pulse [animation-delay:400ms]" />
          </span>
          <span className="text-small font-serif italic text-ink-500">
            {t('ThinkingBlock.thinking', { defaultValue: '让我想一下…' })}
          </span>
        </div>

        {content && (
          <div
            className="relative max-h-32 overflow-hidden"
            style={{
              maskImage: 'linear-gradient(to bottom, transparent 0%, black 30%)',
              WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 30%)',
            }}
          >
            <div className="text-small font-serif italic leading-relaxed text-ink-500">
              <MarkdownRenderer content={streamingContent} />
            </div>
          </div>
        )}

        <span className="ml-0.5 inline-block h-4 w-0.5 bg-sage-500 align-middle animate-blink" />
      </div>
    );
  }

  // ── 完成态：可点击展开 ──
  return (
    <div className="mb-3 rounded-md border border-paper-200 bg-paper-50 transition-colors duration-base hover:border-sage-300">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2 text-left',
          'text-small text-ink-500 transition-colors duration-fast',
          'hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/30 rounded-md',
        )}
      >
        <CoffeeCup size={16} className="text-sage-500 shrink-0" />
        <span className="font-medium font-serif italic">
          {t('ThinkingBlock.done', { defaultValue: '想清楚了' })}
        </span>
        {charCount > 0 && (
          <span className="text-ink-300 font-mono text-caption">
            · {t('ThinkingBlock.charCount', { count: charLabel, defaultValue: `${charLabel} 字` })}
          </span>
        )}
        <Icon
          name="ChevronRight"
          size={14}
          className={cn(
            'ml-auto text-ink-300 transition-transform duration-fast',
            open && 'rotate-90',
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && content && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0.24, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-paper-200 px-3 py-2">
              <div className="text-small font-serif italic leading-relaxed text-ink-700">
                <MarkdownRenderer content={content} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

ThinkingBlock.propTypes = {
  content: PropTypes.string,
  isStreaming: PropTypes.bool,
};

export default ThinkingBlock;
