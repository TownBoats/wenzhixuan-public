import { memo, useId, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Icon, cn } from '@/components/ui';

/**
 * ToolCallCard — 单个工具调用的生命周期卡片（D3 行为 / G2 视觉改版）
 *
 * 数据来自 `projectTurns` 投影的 tool block：
 *   { type:'tool', toolCallId, toolName, status, input, output, error }
 *   - status：running / completed / failed（conversationState.js TOOL_PART_STATUS）
 *   - output.status：ready / unavailable / rejected（B4 ask_question 的返回结构）
 *
 * 五态（2026-10-17 与用户拍板）：进行中 / 完成 / 候选答案不可用 / 被拒绝 / 失败。
 * 文档原写的「准备问题中 / 生成候选答案中」两个进行态在会话层无法区分
 * （运行层只有 tool-started / tool-completed 两个事件），合并为一个进行态。
 *
 * 默认折叠；展开显示工具名 + 输入的问题 + 结果摘要，错误/降级原因在展开区可见。
 * 状态用文字 + 图形区分，不只靠颜色；展开按钮原生 <button>，键盘可操作。
 *
 * G2 视觉：
 *   - 折叠条从「一行灰字」改成「状态圆徽 + 工具名 + 状态胶囊」，扫一眼能分清五种态
 *   - 展开区改成两列标签网格，长文本（问题 / 原因）用引用块与等宽 chip 区分
 *   - 进行中加一条呼吸感的进度条，避免用户以为卡住
 */

// 文案全部在 translation.json 的 AgentChat.toolCard（D7），组件里只留键名与图标
const TOOL_LABEL_KEYS = {
  ask_question: 'AgentChat.toolCard.toolLabels.ask_question',
};

const CARD_STATES = {
  running: {
    labelKey: 'AgentChat.toolCard.states.running',
    icon: 'LoaderCircle',
    iconClass: 'animate-spin text-sage-700',
    badgeClass: 'bg-sage-50 text-sage-700',
    pillClass: 'bg-sage-50 text-sage-700',
  },
  completed: {
    labelKey: 'AgentChat.toolCard.states.completed',
    icon: 'Check',
    iconClass: 'text-sage-700',
    badgeClass: 'bg-sage-50 text-sage-700',
    pillClass: 'bg-sage-50 text-sage-700',
  },
  unavailable: {
    labelKey: 'AgentChat.toolCard.states.unavailable',
    icon: 'CircleAlert',
    iconClass: 'text-sun-700',
    badgeClass: 'bg-sun-300/25 text-sun-700',
    pillClass: 'bg-sun-300/25 text-sun-700',
  },
  rejected: {
    labelKey: 'AgentChat.toolCard.states.rejected',
    icon: 'CircleSlash2',
    iconClass: 'text-ink-500',
    badgeClass: 'bg-paper-200 text-ink-700',
    pillClass: 'bg-paper-200 text-ink-700',
  },
  failed: {
    labelKey: 'AgentChat.toolCard.states.failed',
    icon: 'CircleX',
    iconClass: 'text-state-alert',
    badgeClass: 'bg-state-alert/12 text-state-alert',
    pillClass: 'bg-state-alert/12 text-state-alert',
  },
};

function resolveCardState(status, output) {
  if (status === 'running') return 'running';
  if (status === 'failed') return 'failed';
  // 候选答案不可用在协议里是 `optionsStatus`（`ask_question` 成功返回时 status 恒为 'ready'，
  // 见 src/agent/tools/askQuestion.js）；D8 走查发现只判 status 会让这一态永远进不去，
  // 故同时认 optionsStatus，并保留对旧 status 值的兼容。
  const optionsUnavailable =
    output?.optionsStatus === 'unavailable' || output?.status === 'unavailable';
  if (optionsUnavailable) return 'unavailable';
  if (output?.status === 'rejected') return 'rejected';
  return 'completed';
}

function DetailRow({ label, children, wide = false }) {
  return (
    <div className={cn('min-w-0', wide && 'col-span-2')}>
      <dt className="text-caption uppercase tracking-[0.08em] text-ink-500">{label}</dt>
      <dd className="mt-1 break-words text-small leading-relaxed text-ink-900">{children}</dd>
    </div>
  );
}

DetailRow.propTypes = {
  label: PropTypes.string.isRequired,
  children: PropTypes.node,
  wide: PropTypes.bool,
};

function ResultSummary({ cardState, output, error }) {
  const { t } = useTranslation();
  if (cardState === 'running') {
    return (
      <DetailRow label={t('AgentChat.toolCard.fields.result')} wide>
        <span className="text-ink-500">{t('AgentChat.toolCard.fields.pendingResult')}</span>
      </DetailRow>
    );
  }
  if (cardState === 'failed') {
    return (
      <DetailRow label={t('AgentChat.toolCard.fields.failureReason')} wide>
        <span className="text-state-alert">
          {error ?? t('AgentChat.toolCard.fields.toolFailedFallback')}
        </span>
      </DetailRow>
    );
  }
  if (cardState === 'unavailable') {
    return (
      <DetailRow label={t('AgentChat.toolCard.fields.degradeReason')} wide>
        <span className="text-sun-700">
          {t('AgentChat.toolCard.fields.degradeDetail', {
            errorCode: output?.errorCode ?? 'unknown',
          })}
        </span>
      </DetailRow>
    );
  }
  if (cardState === 'rejected') {
    const reason = output?.reason ?? 'unknown';
    return (
      <DetailRow label={t('AgentChat.toolCard.fields.rejectReason')} wide>
        {output?.message
          ? t('AgentChat.toolCard.fields.rejectDetail', { reason, message: output.message })
          : reason}
      </DetailRow>
    );
  }
  return (
    <>
      {output?.question ? (
        <DetailRow label={t('AgentChat.toolCard.fields.generatedQuestion')} wide>
          <span className="block rounded-r-sm border-l-2 border-sage-300 bg-sage-50/60 py-1.5 pl-3 pr-2">
            {output.question}
          </span>
        </DetailRow>
      ) : null}
      <DetailRow label={t('AgentChat.toolCard.fields.options')} wide>
        <span className="inline-flex items-center gap-1.5 rounded-pill bg-paper-200/70 px-2 py-0.5 font-mono text-caption tabular-nums text-ink-700">
          <Icon name="List" size={12} className="text-ink-500" />
          {t('AgentChat.toolCard.fields.optionsCount', { count: output?.options?.length ?? 0 })}
        </span>
      </DetailRow>
    </>
  );
}

ResultSummary.propTypes = {
  cardState: PropTypes.string.isRequired,
  output: PropTypes.object,
  error: PropTypes.string,
};

function ToolCallCard({ toolCallId, toolName, status, input, output, error }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const cardState = resolveCardState(status, output);
  const meta = CARD_STATES[cardState];
  const toolLabelKey = TOOL_LABEL_KEYS[toolName];
  const toolLabel = toolLabelKey
    ? t(toolLabelKey)
    : (toolName ?? t('AgentChat.toolCard.toolLabels.fallback'));
  const detailId = useId();

  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border bg-paper-50/80 transition-shadow duration-base ease-soft',
        cardState === 'failed' ? 'border-state-alert/30' : 'border-paper-200/80',
        'hover:shadow-soft',
      )}
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={detailId}
        onClick={() => setExpanded((value) => !value)}
        className={cn(
          'flex w-full items-center gap-2.5 px-3 py-2 text-left',
          'transition-colors duration-fast outline-none hover:bg-paper-100/60',
          'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sage-500/25',
        )}
      >
        <span
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
            meta.badgeClass,
          )}
        >
          <Icon name={meta.icon} size={14} className={meta.iconClass} />
        </span>
        <span className="truncate text-small font-medium text-ink-900">{toolLabel}</span>
        <span
          className={cn(
            'shrink-0 rounded-pill px-2 py-0.5 text-caption font-medium',
            meta.pillClass,
          )}
        >
          {t(meta.labelKey)}
        </span>
        <Icon
          name="ChevronDown"
          size={16}
          className={cn(
            'ml-auto shrink-0 text-ink-300 transition-transform duration-base ease-soft',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {cardState === 'running' && (
        <div className="h-0.5 w-full overflow-hidden bg-sage-50">
          <div className="h-full w-1/3 animate-pulse rounded-pill bg-sage-300" />
        </div>
      )}

      {expanded && (
        <div id={detailId} className="border-t border-dashed border-paper-200 px-3 py-3">
          <dl className="grid grid-cols-2 gap-x-5 gap-y-3">
            <DetailRow label={t('AgentChat.toolCard.fields.tool')} wide>
              <span className="inline-flex flex-wrap items-center gap-1.5">
                <span className="rounded-xs bg-paper-100 px-1.5 py-0.5 font-mono text-caption text-sage-700">
                  {toolName ?? 'unknown'}
                </span>
                <span className="truncate rounded-xs bg-paper-100 px-1.5 py-0.5 font-mono text-caption text-ink-500">
                  {toolCallId ?? ''}
                </span>
              </span>
            </DetailRow>
            {input?.question ? (
              <DetailRow label={t('AgentChat.toolCard.fields.inputQuestion')} wide>
                <span className="block rounded-r-sm border-l-2 border-paper-200 py-0.5 pl-3 pr-2 text-ink-700">
                  {input.question}
                </span>
              </DetailRow>
            ) : null}
            {input?.context ? (
              <DetailRow label={t('AgentChat.toolCard.fields.inputContext')} wide>
                <span className="text-ink-500">{input.context}</span>
              </DetailRow>
            ) : null}
            <ResultSummary cardState={cardState} output={output} error={error} />
          </dl>
        </div>
      )}
    </div>
  );
}

ToolCallCard.propTypes = {
  toolCallId: PropTypes.string,
  toolName: PropTypes.string,
  status: PropTypes.oneOf(['running', 'completed', 'failed']),
  input: PropTypes.shape({
    question: PropTypes.string,
    context: PropTypes.string,
  }),
  output: PropTypes.object,
  error: PropTypes.string,
};

export default memo(ToolCallCard);
