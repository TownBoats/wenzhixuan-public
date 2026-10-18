import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Icon, cn } from '@/components/ui';
import MarkdownContent from '../../components/MessageContent/MarkdownContent';
import { QUESTION_STATE } from '../../utils/conversationState';

/**
 * QuestionGroup — 本轮问题卡组（D4 行为 / G2 视觉改版）
 *
 * 渲染一轮的全部问题（按模型调用顺序，协议 §5）：卡片数＝问题数。
 *
 * G2 之前这里直接套用旧路径的 `QuestionCard`；现在改为本目录内的磁贴，
 * 原因有三：① 旧卡把「AI 回答完毕！」之类旧状态文案绑在 `status` 上，
 * 而新协议只有 `state`（pending / answered / skipped）与 `optionsStatus`；
 * ② 旧卡的 ✕ 语义是「删除问题」，新路径实际是「跳过此题」，图标与位置都容易误读；
 * ③ 需要答题后可回看「我当时选了什么」，旧卡做不到。
 *
 * 交互契约不变：
 *   - 只有 `pending` 的问题可点开（onOpen），已答/已跳过不可再点
 *   - 跳过按钮只在 `pending` 出现，点击调 onSkip，不冒泡到整卡
 *   - 不在这里拼答案、不触发下一轮（C-3：答案只经 submitAnswer / skipQuestion）
 */

const STATE_META = {
  [QUESTION_STATE.PENDING]: {
    labelKey: 'AgentChat.questionGroup.pending',
    pillClass: 'bg-sage-50 text-sage-700',
    ringClass: 'border-paper-200 bg-paper-50',
  },
  [QUESTION_STATE.ANSWERED]: {
    labelKey: 'AgentChat.questionGroup.answered',
    pillClass: 'bg-state-good/20 text-sage-700',
    ringClass: 'border-sage-300/50 bg-sage-50/40',
  },
  [QUESTION_STATE.SKIPPED]: {
    labelKey: 'AgentChat.questionGroup.skipped',
    pillClass: 'bg-paper-200 text-ink-500',
    ringClass: 'border-paper-200/70 bg-paper-100/40',
  },
};

function QuestionTile({ question, index, onOpen, onSkip }) {
  const { t } = useTranslation();
  const meta = STATE_META[question.state] ?? STATE_META[QUESTION_STATE.PENDING];
  const isPending = question.state === QUESTION_STATE.PENDING;
  const isAnswered = question.state === QUESTION_STATE.ANSWERED;
  const hasOptions = question.optionsStatus === 'ready';
  const optionsCount = Array.isArray(question.options) ? question.options.length : 0;

  const handleOpen = () => {
    if (isPending) onOpen(question.id);
  };

  return (
    <div
      role={isPending ? 'button' : undefined}
      tabIndex={isPending ? 0 : undefined}
      aria-label={isPending ? t('AgentChat.questionGroup.openAria') : undefined}
      onClick={handleOpen}
      onKeyDown={(event) => {
        if (!isPending) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleOpen();
        }
      }}
      className={cn(
        'group relative flex h-full flex-col rounded-md border p-3.5',
        'transition-all duration-base ease-soft',
        meta.ringClass,
        isPending
          ? 'cursor-pointer hover:-translate-y-0.5 hover:border-sage-300 hover:bg-paper-50 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/30'
          : 'text-ink-700',
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="font-mono text-caption tabular-nums text-sage-500">
          {String(index + 1).padStart(2, '0')}
        </span>
        <span
          className={cn('rounded-pill px-2 py-0.5 text-caption font-medium', meta.pillClass)}
        >
          {t(meta.labelKey)}
        </span>
        <span className="ml-auto shrink-0 text-caption text-ink-500">
          {hasOptions
            ? t('AgentChat.questionGroup.optionsReady', { count: optionsCount })
            : t('AgentChat.questionGroup.manual')}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <MarkdownContent content={question.text ?? ''} compact />
      </div>

      {isAnswered && question.answer ? (
        <p className="mt-2.5 line-clamp-2 border-t border-dashed border-paper-200 pt-2 text-caption leading-relaxed text-ink-500">
          {t('AgentChat.questionGroup.yourAnswer', { answer: question.answer })}
        </p>
      ) : null}

      {isPending ? (
        <div className="mt-3 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-caption font-medium text-sage-700">
            {t('AgentChat.questionGroup.open')}
            <Icon
              name="ArrowRight"
              size={12}
              className="text-current transition-transform duration-fast group-hover:translate-x-0.5"
            />
          </span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSkip(question.id);
            }}
            className={cn(
              'inline-flex items-center gap-1 rounded-pill px-2 py-1 text-caption text-ink-500',
              'transition-colors duration-fast hover:bg-paper-200 hover:text-ink-700',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/30',
            )}
          >
            <Icon name="SkipForward" size={12} className="text-current" />
            {t('AgentChat.questionGroup.skip')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

QuestionTile.propTypes = {
  question: PropTypes.shape({
    id: PropTypes.string,
    text: PropTypes.string,
    state: PropTypes.string,
    optionsStatus: PropTypes.string,
    options: PropTypes.array,
    answer: PropTypes.string,
  }).isRequired,
  index: PropTypes.number.isRequired,
  onOpen: PropTypes.func.isRequired,
  onSkip: PropTypes.func.isRequired,
};

function QuestionGroup({ questions, onOpen, onSkip }) {
  const { t } = useTranslation();
  if (!Array.isArray(questions) || questions.length === 0) return null;

  return (
    <section className="rounded-md border border-paper-200/80 bg-paper-100/40 p-3 sm:p-4">
      <header className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="flex items-center gap-1.5 text-small font-semibold text-ink-900">
          <Icon name="ListChecks" size={14} className="text-sage-700" />
          {t('AgentChat.questionGroup.title', { count: questions.length })}
        </span>
        <span className="text-caption text-ink-500">{t('AgentChat.questionGroup.hint')}</span>
      </header>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {questions.map((question, index) => (
          <QuestionTile
            key={question.id}
            question={question}
            index={index}
            onOpen={onOpen}
            onSkip={onSkip}
          />
        ))}
      </div>
    </section>
  );
}

QuestionGroup.propTypes = {
  questions: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      text: PropTypes.string,
      optionsStatus: PropTypes.string,
      state: PropTypes.string,
      answer: PropTypes.string,
      options: PropTypes.array,
    }),
  ),
  onOpen: PropTypes.func.isRequired,
  onSkip: PropTypes.func.isRequired,
};

export default QuestionGroup;
