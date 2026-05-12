import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import MarkdownRenderer from '../MarkdownRenderer/MarkdownRenderer';
import { Icon, Tag, cn } from '@/components/ui';

/**
 * QuestionCard — 待答问题卡（P3c Susan Kare 重设计版）
 *
 * 设计规格见 docs/REDESIGN_KARE.md §3.1 (门把手 hover) + §2.4 (Tag 状态)。
 *
 * 视觉迁移自旧版：
 *   - cyan/green/red 三色叠用       → sage（默认/请求/响应/完成）+
 *                                     state-good（已答）+ state-warn（错误）
 *   - rounded-xl + slate border    → rounded-md + paper-200 border
 *   - 内联 SVG spinner / check / dot → ui/Icon (lucide)
 *   - 删除按钮 hover red           → state-alert + Trash2
 *   - hover 右侧出现箭头            → "门把手" hover：卡片 translate-y -1px
 *                                     + 右侧 ChevronRight 浮出
 *
 * Props 接口完全保持不变。
 */
const QuestionCard = ({ question, onClick, onCancel, width }) => {
  const { t } = useTranslation();

  // ── 容器配色 ──
  const containerByState = (() => {
    if (question.isAnswered) return 'border-state-good/40 bg-sage-50';
    switch (question.status) {
      case 'requesting':
      case 'responding':
        return 'border-sage-300 bg-sage-50/60';
      case 'completed':
        return 'border-sage-300 bg-sage-50';
      case 'error':
        return 'border-state-alert/40 bg-sun-300/15';
      default:
        return 'border-paper-200 bg-paper-50';
    }
  })();

  // ── 状态指示器 ──
  const renderStatusTag = () => {
    if (question.isAnswered) {
      return (
        <Tag variant="good">
          <Icon name="Check" size={14} className="text-current" />
          {t('QuestionCard.confirmed')}
        </Tag>
      );
    }
    switch (question.status) {
      case 'requesting':
        return (
          <Tag variant="active">
            <Icon name="Loader2" size={14} className="animate-spin text-current" />
            {t('QuestionCard.AIPreparing')}
          </Tag>
        );
      case 'responding':
        return (
          <Tag variant="active">
            <Icon name="Sparkles" size={14} className="animate-pulse text-current" />
            {t('QuestionCard.AIProcessing')}
          </Tag>
        );
      case 'completed':
        return (
          <Tag variant="active">
            <Icon name="Check" size={14} className="text-current" />
            {t('QuestionCard.AICompleted')}
          </Tag>
        );
      case 'error':
        return (
          <Tag variant="alert">
            <Icon name="AlertCircle" size={14} className="text-current" />
            {t('QuestionCard.AIError')}
          </Tag>
        );
      default:
        return (
          <Tag variant="neutral">
            <Icon name="Loader2" size={14} className="animate-spin text-current" />
            {t('QuestionCard.AIPreparing')}
          </Tag>
        );
    }
  };

  return (
    <div
      onClick={() => {
        if (!question.isProcessing) onClick(question);
      }}
      style={{ width }}
      className={cn(
        'group flex-shrink-0 rounded-md border p-4',
        'transition-all duration-base ease-soft',
        containerByState,
        question.isProcessing
          ? 'cursor-not-allowed opacity-80'
          : 'cursor-pointer hover:-translate-y-px hover:shadow-lift',
      )}
    >
      <div className="mb-2 text-small font-mono text-ink-500">
        {t('QuestionCard.exploreQuestion')}{' '}
        {question.hasFetchedAnswer && t('QuestionCard.answered')}
      </div>

      <div className="flex items-start gap-2 text-body font-serif leading-relaxed text-ink-900">
        <div className="flex-1 min-w-0">
          <MarkdownRenderer content={question.question} />
        </div>
        {!question.isProcessing && (
          <Icon
            name="ChevronRight"
            size={18}
            className="mt-1 shrink-0 opacity-0 text-sage-700 transition-all duration-fast group-hover:opacity-100"
          />
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        {renderStatusTag()}
        {!question.isAnswered && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCancel(question.id);
            }}
            className={cn(
              'rounded-sm p-1.5 text-ink-300',
              'transition-colors duration-fast hover:bg-state-alert/10 hover:text-state-alert',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-state-alert/30',
            )}
            title={t('QuestionCard.deleteQuestion')}
            aria-label={t('QuestionCard.deleteQuestion')}
          >
            <Icon name="Trash2" size={14} className="text-current" />
          </button>
        )}
      </div>
    </div>
  );
};

QuestionCard.propTypes = {
  question: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    question: PropTypes.string,
    status: PropTypes.string,
    isAnswered: PropTypes.bool,
    isProcessing: PropTypes.bool,
    hasFetchedAnswer: PropTypes.bool,
  }).isRequired,
  onClick: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  width: PropTypes.string,
};

export default QuestionCard;
