import { memo, useId, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Icon, cn } from '@/components/ui';
import ToolCallCard from '../ToolCallCard/ToolCallCard';
import VisualizeCard from '../VisualizeCard/VisualizeCard';
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

/**
 * MessageContent — 按 blocks 顺序渲染一条 assistant 消息（D3 / G2 排版改版）
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
 *
 * G2 的改动只在展示层：
 *   - 正文改 Markdown 渲染（此前是 `whitespace-pre-wrap` 纯文本，模型输出的列表 / 代码 / 表格全成了字面量）
 *   - 思考块改成「纸色折叠条」，展开区限高、可滚动，不把整段推理顶到正文上面
 *   - 块之间的间距从 8px 放宽到 12px，正文与卡片不再挤在一起
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
          if (isReadyVisualizeBlock(block)) {
            return (
              <VisualizeCard
                key={block.toolCallId ?? `tool-${index}`}
                title={block.output.title}
                html={block.output.html}
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
