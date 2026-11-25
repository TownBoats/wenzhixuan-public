import { memo, useId, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Icon, cn } from '@/components/ui';
import ToolCallCard from '../ToolCallCard/ToolCallCard';
import VisualizeCard from '../VisualizeCard/VisualizeCard';
import ExplainCard from '../ExplainCard/ExplainCard';
import MarkdownContent from './MarkdownContent';

/** visualize 工具的就绪结果交给沙箱渲染卡；其余状态（running / rejected / failed）仍走通用工具卡。 */
function isReadyVisualizeBlock(block) {
  return (
    block.toolName === 'visualize' &&
    block.status === 'completed' &&
    block.output?.status === 'ready' &&
    typeof block.output?.html === 'string'
  );
}

/** explain_card 的就绪结果交给静态 SVG 渲染卡；路由规则与 visualize 相同。 */
function isReadyExplainCardBlock(block) {
  return (
    block.toolName === 'explain_card' &&
    block.status === 'completed' &&
    block.output?.status === 'ready' &&
    typeof block.output?.svg === 'string'
  );
}

/** explain_card 运行中：交给 ExplainCard 的流式预览（参数增量实时渲染）。 */
function isStreamingExplainCardBlock(block) {
  return block.toolName === 'explain_card' && block.status === 'running';
}

/**
 * ask_question 的展示约定（2026-10-20 与用户拍板）：
 * 用户只关心「问题是什么」，不关心工具调用本身——问题就绪后由 QuestionGroup 磁贴接管展示。
 *   - ready（含候选答案不可用）：不渲染。同一问题下方已有磁贴，再摆一张工具卡是重复打扰；
 *     「手动作答」等状态磁贴上已有表达。
 *   - running：不渲染。准备中的磁贴在 QuestionGroup 里与待作答磁贴融合渲染
 *     （同一 toolCallId 原地转化），消息流里不再放占位卡。
 *   - rejected / failed：一行灰字交代「这次提问没发出去」，不暴露工具名 / toolCallId 等技术细节
 *     （细节仍可从投影数据里查）。
 * 与 visualize / explain_card 的就绪路由同理：工具的成功结果由专属 UI 接管，通用工具卡兜底其余工具。
 */
function AskQuestionTrace({ block }) {
  const { t } = useTranslation();

  if (block.status !== 'failed' && block.output?.status !== 'rejected') return null;

  return (
    <p className="flex items-center gap-1.5 px-1 text-caption text-ink-300">
      <Icon
        name={block.status === 'failed' ? 'CircleX' : 'CircleSlash2'}
        size={12}
        className="text-current"
      />
      {block.status === 'failed'
        ? t('AgentChat.messageContent.questionFailed')
        : t('AgentChat.messageContent.questionNotSent')}
    </p>
  );
}

/** 学习计划由页头常驻行展示，消息流里只在更新成功时留一行提示。 */
function LearningPlanTrace({ block }) {
  const { t } = useTranslation();
  if (block.status !== 'completed' || block.output?.status !== 'ready') return null;
  return (
    <p className="flex items-center gap-1.5 px-1 text-caption text-ink-300">
      <Icon name="Map" size={12} className="text-current" />
      {t('AgentChat.plan.updated')}
    </p>
  );
}

LearningPlanTrace.propTypes = {
  block: PropTypes.shape({ status: PropTypes.string, output: PropTypes.object }).isRequired,
};

AskQuestionTrace.propTypes = {
  block: PropTypes.shape({
    status: PropTypes.string,
    output: PropTypes.object,
  }).isRequired,
};

/**
 * MessageContent：按 `projectTurns` 的 blocks 顺序渲染一条助手消息，不拼数据。
 *
 * - key 必须带 runId：SDK 的 partId 每次流内自增，重试后会重复
 * - reasoning 默认折叠
 * - 就绪的 ask_question 由 QuestionGroup 展示，这里只在被拒绝或失败时留一行提示
 */

function ThinkingBlock({ text }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();

  return (
    <div className="overflow-hidden rounded-md border border-paper-200/80 bg-paper-100/50">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((value) => !value)}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2 text-left',
          'transition-colors duration-fast outline-none hover:bg-paper-100',
          'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sage-500/25',
        )}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-paper-200/70">
          <Icon name="Sparkles" size={12} className="text-sage-700" />
        </span>
        <span className="text-small font-medium text-ink-700">
          {t('AgentChat.messageContent.thinking')}
        </span>
        <span className="font-mono text-caption tabular-nums text-ink-300">
          {t('AgentChat.messageContent.charCount', { count: text.length })}
        </span>
        <Icon
          name="ChevronDown"
          size={16}
          className={cn(
            'ml-auto text-ink-300 transition-transform duration-base ease-soft',
            expanded && 'rotate-180',
          )}
        />
      </button>
      {expanded && (
        <div
          id={contentId}
          className="max-h-72 overflow-y-auto border-t border-dashed border-paper-200 px-3 py-2.5 scrollbar-custom"
        >
          <p className="whitespace-pre-wrap text-small leading-relaxed text-ink-500">{text}</p>
        </div>
      )}
    </div>
  );
}

ThinkingBlock.propTypes = { text: PropTypes.string.isRequired };

function MessageContent({ blocks }) {
  return (
    <div className="space-y-3">
      {(Array.isArray(blocks) ? blocks : []).map((block, index) => {
        if (!block) return null;

        if (block.type === 'text') {
          return (
            <MarkdownContent
              key={`${block.runId ?? 'run'}:${block.partId ?? `text-${index}`}`}
              content={block.text ?? ''}
            />
          );
        }

        if (block.type === 'reasoning') {
          return (
            <ThinkingBlock
              key={`${block.runId ?? 'run'}:${block.partId ?? `reasoning-${index}`}`}
              text={block.text ?? ''}
            />
          );
        }

        if (block.type === 'tool') {
          if (block.toolName === 'ask_question') {
            return (
              <AskQuestionTrace
                key={block.toolCallId ?? `tool-${index}`}
                block={block}
              />
            );
          }
          if (block.toolName === 'update_learning_plan') {
            return <LearningPlanTrace key={block.toolCallId ?? `tool-${index}`} block={block} />;
          }
          if (isReadyVisualizeBlock(block)) {
            return (
              <VisualizeCard
                key={block.toolCallId ?? `tool-${index}`}
                title={block.output.title}
                html={block.output.html}
              />
            );
          }
          if (isReadyExplainCardBlock(block)) {
            return (
              <ExplainCard
                key={block.toolCallId ?? `tool-${index}`}
                title={block.output.title}
                svg={block.output.svg}
                viewBox={block.output.viewBox}
              />
            );
          }
          if (isStreamingExplainCardBlock(block)) {
            return (
              <ExplainCard
                key={block.toolCallId ?? `tool-${index}`}
                status="running"
                partialInput={block.partialInput}
              />
            );
          }
          return (
            <ToolCallCard
              key={block.toolCallId ?? `tool-${index}`}
              toolCallId={block.toolCallId}
              toolName={block.toolName}
              status={block.status}
              input={block.input}
              output={block.output}
              error={block.error}
            />
          );
        }

        return null;
      })}
    </div>
  );
}

MessageContent.propTypes = {
  blocks: PropTypes.arrayOf(
    PropTypes.shape({
      type: PropTypes.oneOf(['text', 'reasoning', 'tool']),
      partId: PropTypes.string,
      runId: PropTypes.string,
      text: PropTypes.string,
      toolCallId: PropTypes.string,
      toolName: PropTypes.string,
      status: PropTypes.string,
      input: PropTypes.object,
      output: PropTypes.object,
      error: PropTypes.string,
    }),
  ),
};

export default memo(MessageContent);
