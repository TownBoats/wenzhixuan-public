import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Icon, cn } from '@/components/ui';
import MarkdownContent from '../../components/MessageContent/MarkdownContent';
import { QUESTION_STATE } from '../../utils/conversationState';
import { extractPartialStringField } from '../../utils/partialJsonField';

/**
 * QuestionGroup — 本轮问题卡组（D4 行为 / G2 视觉改版 / 2026-10-20 准备态融合）
 *
 * 「准备中」与「待作答」融合（2026-10-20 与用户拍板）：
 * 准备中的提问（ask_question 工具还在跑）不再是消息流里的占位卡，而是直接在本组里
 * 渲染成磁贴——问题文本随工具参数逐字流出（partialInput + extractPartialStringField，
 * 与 explain_card 流式预览同一套机制）。准备中的磁贴与就绪问题共享同一个 toolCallId，
 * 用它做 key：就绪时 React 复用同一 DOM 节点，磁贴**原地**从「准备中」变成「待作答」
 * （tailwind 的 question-ready 动效），位置不跳、内容不闪。等待感靠「看着问题被打出来」
 * 消解，而不是进度条。
 *
 * 顺序恒等于模型调用顺序（按 blocks 里的工具卡顺序合并，与状态层 questions 的排序口径
 * 一致）：工具先完成的一方不会插队，就绪转化永远发生在原位。
 *
 * 交互契约不变：
 *   - 只有 `pending` 的问题可点开（onOpen），已答/已跳过/准备中不可点
 *   - 跳过按钮只在 `pending` 出现，点击调 onSkip，不冒泡到整卡
 *   - 不在这里拼答案、不触发下一轮（C-3：答案只经 submitAnswer / skipQuestion）
 *
 * 2026-10-19 调整（用户反馈「排列紧凑一点」）：外层 p-3→p-2.5、
 * grid gap-2.5→2、磁贴 p-3.5→3、头行 mb-2→1.5、底行 mt-3→2。
 */

/** 仅展示层使用的「准备中」态：问题尚未进入 turn.questions，正在从工具参数流里生长。 */
const PREPARING = 'preparing';

const STATE_META = {
  [PREPARING]: {
    labelKey: 'AgentChat.questionGroup.preparing',
    pillClass: 'bg-sage-50 text-sage-700',
    ringClass: 'border-paper-200 bg-white',
  },
  [QUESTION_STATE.PENDING]: {
    labelKey: 'AgentChat.questionGroup.pending',
    pillClass: 'bg-sage-50 text-sage-700',
    ringClass: 'border-paper-200 bg-white',
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

/**
 * 把「准备中的工具调用」与「已就绪问题」按调用顺序合并成一个渲染列表。
 *
 * rejected / failed 的调用既不产生问题也不产生磁贴——那一行灰字交代在
 * MessageContent 的 AskQuestionTrace 里，这里直接跳过。
 * 兜底：历史里 toolCallId 对不上 blocks 的问题原样追加，不丢。
 */
function mergeQuestions(questions, blocks) {
  const list = Array.isArray(questions) ? questions : [];
  const byToolCallId = new Map();
  for (const question of list) {
    if (question?.toolCallId) byToolCallId.set(question.toolCallId, question);
  }

  const merged = [];
  const placed = new Set();
  for (const block of Array.isArray(blocks) ? blocks : []) {
    if (block?.type !== 'tool' || block.toolName !== 'ask_question' || !block.toolCallId) {
      continue;
    }
    const ready = byToolCallId.get(block.toolCallId);
    if (ready) {
      merged.push(ready);
      placed.add(ready);
      continue;
    }
    if (block.status === 'running') {
      const partial = extractPartialStringField(block.partialInput ?? '', 'question');
      merged.push({
        id: block.toolCallId,
        toolCallId: block.toolCallId,
        text: partial.found ? partial.value : (block.input?.question ?? ''),
        state: PREPARING,
        optionsStatus: null,
        options: [],
        answer: null,
      });
    }
  }
  for (const question of list) {
    if (question && !placed.has(question)) merged.push(question);
  }
  return merged;
}

function QuestionTile({ question, index, onOpen, onSkip }) {
  const { t } = useTranslation();
  const meta = STATE_META[question.state] ?? STATE_META[QUESTION_STATE.PENDING];
  const isPreparing = question.state === PREPARING;
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
      aria-busy={isPreparing || undefined}
      onClick={handleOpen}
      onKeyDown={(event) => {
        if (!isPending) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleOpen();
        }
      }}
      className={cn(
        'group relative flex h-full flex-col rounded-md border p-3',
        'transition-all duration-base ease-soft',
        meta.ringClass,
        // 就绪瞬间的原地转化动效：同一 DOM 节点（key = toolCallId）从准备中变为待作答时触发一次
        isPending && 'animate-question-ready',
        isPending
          ? 'cursor-pointer hover:-translate-y-0.5 hover:border-sage-300 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/30'
          : 'text-ink-700',
      )}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span className="font-mono text-caption tabular-nums text-sage-500">
          {String(index + 1).padStart(2, '0')}
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-caption font-medium',
            meta.pillClass,
          )}
        >
          {isPreparing && (
            <Icon name="LoaderCircle" size={12} className="animate-spin text-current" />
          )}
          {t(meta.labelKey)}
        </span>
        {!isPreparing && (
          <span className="ml-auto shrink-0 text-caption text-ink-500">
            {hasOptions
              ? t('AgentChat.questionGroup.optionsReady', { count: optionsCount })
              : t('AgentChat.questionGroup.manual')}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {question.text ? (
          <MarkdownContent content={question.text} compact />
        ) : (
          // 参数还没流到：骨架条撑着磁贴高度，问题文本到达后直接替换，不跳版
          <div className="space-y-2 pt-1" aria-hidden="true">
            <div className="h-3 w-3/4 animate-pulse rounded-sm bg-paper-200" />
            <div className="h-3 w-1/2 animate-pulse rounded-sm bg-paper-200" />
          </div>
        )}
      </div>

      {isAnswered && question.answer ? (
        <p className="mt-2 line-clamp-2 border-t border-dashed border-paper-200 pt-1.5 text-caption leading-relaxed text-ink-500">
          {t('AgentChat.questionGroup.yourAnswer', { answer: question.answer })}
        </p>
      ) : null}

      {isPending ? (
        <div className="mt-2 flex items-center justify-between">
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
    toolCallId: PropTypes.string,
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

function QuestionGroup({ questions, blocks, onOpen, onSkip }) {
  const { t } = useTranslation();
  const merged = mergeQuestions(questions, blocks);
  if (merged.length === 0) return null;

  return (
    <section className="rounded-md border border-paper-200/80 bg-paper-100/40 p-2.5 sm:p-3">
      <header className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="flex items-center gap-1.5 text-small font-semibold text-ink-900">
          <Icon name="ListChecks" size={14} className="text-sage-700" />
          {t('AgentChat.questionGroup.title', { count: merged.length })}
        </span>
        <span className="text-caption text-ink-500">{t('AgentChat.questionGroup.hint')}</span>
      </header>

      <div className="grid gap-2 sm:grid-cols-2">
        {merged.map((question, index) => (
          <QuestionTile
            key={question.toolCallId ?? question.id}
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
      toolCallId: PropTypes.string,
      text: PropTypes.string,
      optionsStatus: PropTypes.string,
      state: PropTypes.string,
      answer: PropTypes.string,
      options: PropTypes.array,
    }),
  ),
  blocks: PropTypes.arrayOf(
    PropTypes.shape({
      type: PropTypes.string,
      toolName: PropTypes.string,
      toolCallId: PropTypes.string,
      status: PropTypes.string,
      input: PropTypes.object,
      partialInput: PropTypes.string,
    }),
  ),
  onOpen: PropTypes.func.isRequired,
  onSkip: PropTypes.func.isRequired,
};

export default QuestionGroup;
