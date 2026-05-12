import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { cn } from '@/components/ui';

/**
 * QuickPrompts — 欢迎页快速提示词列表（Susan Kare 重设计版）
 *
 * 视觉迁移自旧版：
 *   - bg-white/80 + slate-200 hover:cyan-500 → bg-paper-50 + paper-200
 *                                              hover:border-sage-500 + paper-100
 *   - rounded-xl                              → rounded-md
 *   - text-sm + slate                         → text-small + ink-700 衬线
 *
 * Props 接口与旧版完全一致。
 */
const QuickPrompts = ({ onSelect }) => {
  const { t } = useTranslation();

  const prompts = [
    { id: 1, text: t('QuickPrompts.prompt_math'), type: 'math' },
    { id: 3, text: t('QuickPrompts.prompt_language'), type: 'language' },
    { id: 4, text: t('QuickPrompts.prompt_biology'), type: 'biology' },
    { id: 5, text: t('QuickPrompts.prompt_physics'), type: 'physics' },
    { id: 7, text: t('QuickPrompts.prompt_economics'), type: 'economics' },
    { id: 8, text: t('QuickPrompts.prompt_computer'), type: 'computer' },
  ];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <button
            key={prompt.id}
            type="button"
            onClick={() => onSelect(prompt.text)}
            className={cn(
              'max-w-full rounded-md px-4 py-2',
              'bg-paper-50 text-small font-serif text-ink-700',
              'border border-paper-200',
              'transition-all duration-fast ease-snap',
              'hover:bg-paper-100 hover:border-sage-500 hover:text-ink-900 hover:-translate-y-px hover:shadow-soft',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/30',
              'active:scale-[0.99]',
            )}
          >
            {prompt.text}
          </button>
        ))}
      </div>
    </div>
  );
};

QuickPrompts.propTypes = {
  onSelect: PropTypes.func.isRequired,
};

export default QuickPrompts;
