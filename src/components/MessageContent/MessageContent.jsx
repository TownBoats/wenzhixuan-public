import { memo, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Icon, cn } from '@/components/ui';
import ToolCallCard from '../ToolCallCard/ToolCallCard';

/**
 * MessageContent — 按 blocks 顺序渲染一条 assistant 消息（D3）
 *
 * blocks 来自 `projectTurns` 投影，只渲染、不拼数据（C-3 结论 2）：
 *   { type:'text',      partId, runId, text }
 *   { type:'reasoning', partId, runId, text }
 *   { type:'tool',      toolCallId, toolName, status, input, output, error }
 *
 * 文本块的 key 必须带 `runId`：AI SDK 的片段 id 是每次流内自增的（两次运行都可能是 `0`），
 * 重试后同一轮里会有两个 `partId` 相同的块，只用 `partId` 会触发 React 重复 key（F2）。
 *
 * 顺序即实际发生顺序，工具卡不挪到末尾（协议保留有序 parts 的直接原因）。
 * reasoning 只显示接口真实返回的内容，默认折叠（2026-10-17 与用户拍板）。
 */

function ThinkingBlock({ text }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const contentId = useState(() => `thinking-${Math.random().toString(36).slice(2, 10)}`)[0];

  return (
    <div className="rounded-sm border border-paper-200 bg-paper-100">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((value) => !value)}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2 text-left',
          'transition-colors duration-fast outline-none',
          'focus-visible:ring-2 focus-visible:ring-sage-500/20',
        )}
      >
        <Icon name="Brain" size={16} className="text-ink-500" />
        <span className="text-small font-medium text-ink-700">
          {t('AgentChat.messageContent.thinking')}
        </span>
        <span className="text-small text-ink-500">
          {t('AgentChat.messageContent.charCount', { count: text.length })}
        </span>
        <Icon
          name="ChevronDown"
          size={16}
          className={cn('ml-auto transition-transform duration-fast', expanded && 'rotate-180')}
        />
      </button>
      {expanded && (
        <div id={contentId} className="border-t border-paper-200 px-3 py-2">
          <p className="whitespace-pre-wrap text-small leading-relaxed text-ink-500">{text}</p>
        </div>
      )}
    </div>
  );
}

ThinkingBlock.propTypes = { text: PropTypes.string.isRequired };

function MessageContent({ blocks }) {
  return (
    <div className="space-y-2">
      {(Array.isArray(blocks) ? blocks : []).map((block, index) => {
        if (!block) return null;

        if (block.type === 'text') {
          return (
            <p
              key={`${block.runId ?? 'run'}:${block.partId ?? `text-${index}`}`}
              className="whitespace-pre-wrap text-body leading-relaxed text-ink-900"
            >
              {block.text}
            </p>
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
