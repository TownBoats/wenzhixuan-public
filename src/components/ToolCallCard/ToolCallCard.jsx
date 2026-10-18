import { memo, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Icon, cn } from '@/components/ui';

/**
 * ToolCallCard — 单个工具调用的生命周期卡片（D3，决策记录 D-1 决策 2）
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
 */

// 文案全部在 translation.json 的 AgentChat.toolCard（D7），组件里只留键名与图标
const TOOL_LABEL_KEYS = {
  ask_question: 'AgentChat.toolCard.toolLabels.ask_question',
};

const CARD_STATES = {
  running: {
    labelKey: 'AgentChat.toolCard.states.running',
    icon: 'LoaderCircle',
    iconClass: 'animate-spin text-ink-500',
  },
  completed: {
    labelKey: 'AgentChat.toolCard.states.completed',
    icon: 'Check',
    iconClass: 'text-sage-700',
  },
  unavailable: {
    labelKey: 'AgentChat.toolCard.states.unavailable',
    icon: 'CircleAlert',
    iconClass: 'text-amber-600',
  },
  rejected: {
    labelKey: 'AgentChat.toolCard.states.rejected',
    icon: 'CircleX',
    iconClass: 'text-ink-500',
  },
  failed: {
    labelKey: 'AgentChat.toolCard.states.failed',
    icon: 'CircleX',
    iconClass: 'text-red-600',
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

function DetailRow({ label, children }) {
  return (
    <div>
      <dt className="text-small font-medium text-ink-500">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-small text-ink-900">{children}</dd>
    </div>
  );
}

DetailRow.propTypes = { label: PropTypes.string.isRequired, children: PropTypes.node };

function ResultSummary({ cardState, output, error }) {
  const { t } = useTranslation();
  if (cardState === 'running') {
    return (
      <DetailRow label={t('AgentChat.toolCard.fields.result')}>
        {t('AgentChat.toolCard.fields.pendingResult')}
      </DetailRow>
    );
  }
  if (cardState === 'failed') {
    return (
      <DetailRow label={t('AgentChat.toolCard.fields.failureReason')}>
        {error ?? t('AgentChat.toolCard.fields.toolFailedFallback')}
      </DetailRow>
    );
  }
  if (cardState === 'unavailable') {
    return (
      <DetailRow label={t('AgentChat.toolCard.fields.degradeReason')}>
        {t('AgentChat.toolCard.fields.degradeDetail', {
          errorCode: output?.errorCode ?? 'unknown',
        })}
      </DetailRow>
    );
  }
  if (cardState === 'rejected') {
    const reason = output?.reason ?? 'unknown';
    return (
      <DetailRow label={t('AgentChat.toolCard.fields.rejectReason')}>
        {output?.message
          ? t('AgentChat.toolCard.fields.rejectDetail', { reason, message: output.message })
          : reason}
      </DetailRow>
    );
  }
  return (
    <>
      {output?.question ? (
        <DetailRow label={t('AgentChat.toolCard.fields.generatedQuestion')}>
          {output.question}
        </DetailRow>
      ) : null}
      <DetailRow label={t('AgentChat.toolCard.fields.options')}>
        {t('AgentChat.toolCard.fields.optionsCount', { count: output?.options?.length ?? 0 })}
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
  const detailId = `tool-card-detail-${toolCallId ?? 'unknown'}`;

  return (
    <div className="rounded-sm border border-paper-200 bg-paper-50 shadow-soft">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={detailId}
        onClick={() => setExpanded((value) => !value)}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2 text-left',
          'transition-colors duration-fast outline-none',
          'focus-visible:ring-2 focus-visible:ring-sage-500/20',
        )}
      >
        <Icon name={meta.icon} size={16} className={meta.iconClass} />
        <span className="text-small font-medium text-ink-900">{toolLabel}</span>
        <span className="text-small text-ink-500">{t(meta.labelKey)}</span>
        <Icon
          name="ChevronDown"
          size={16}
          className={cn('ml-auto transition-transform duration-fast', expanded && 'rotate-180')}
        />
      </button>

      {expanded && (
        <div id={detailId} className="border-t border-paper-200 px-3 py-2">
          <dl className="space-y-2">
            <DetailRow label={t('AgentChat.toolCard.fields.tool')}>
              <span className="font-mono">{toolName ?? 'unknown'}</span>
              <span className="ml-2 font-mono text-ink-500">{toolCallId ?? ''}</span>
            </DetailRow>
            {input?.question ? (
              <DetailRow label={t('AgentChat.toolCard.fields.inputQuestion')}>
                {input.question}
              </DetailRow>
            ) : null}
            {input?.context ? (
              <DetailRow label={t('AgentChat.toolCard.fields.inputContext')}>
                {input.context}
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
