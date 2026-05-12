import { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import MarkdownRenderer from '../MarkdownRenderer/MarkdownRenderer';
import AnswerMessageCard from '../AnswerMessageCard/AnswerMessageCard';
import ThinkingBlock from '../ThinkingBlock/ThinkingBlock';
import { Button, Icon, BrandLogo, Flag, cn } from '@/components/ui';

/**
 * MessageBubble — 单条对话气泡（P3a Susan Kare 重设计版）
 *
 * 视觉迁移自旧版：
 *   - 用户气泡：bg-cyan-50 border-cyan-200       → bg-sage-50 (无 border)
 *   - 助手气泡：bg-[#F5F1EA] border-gray-300     → bg-paper-100
 *   - 错误气泡：bg-red-50 border-red-200         → bg-paper-100 + Flag + state-warn
 *   - 助手左侧 32×32 BrandLogo 头像，表情随状态变脸（thinking / error / default）
 *   - 内联 SVG copy/retry 按钮         → ui/Button + ui/Icon (lucide)
 *   - amber 三点 loading              → italic serif "let me think..."
 *
 * Props 接口与旧版完全兼容，包括 ChatWindow 透传的 `theme` prop（已忽略，
 * 新设计是单主题，未来暗色模式由 dark: 前缀统一处理）。
 */

const ASSISTANT_AVATAR_EXPRESSION = (isLoading, isStreaming, isError) => {
  if (isError) return 'error';
  if (isLoading || isStreaming) return 'thinking';
  return 'default';
};

const MessageBubble = ({
  isUser,
  content = [],
  onRetry,
  isLoading = false,
  isStreaming = false,
  status = 'completed',
  error = null,
  // theme prop 仅为兼容旧 ChatWindow 透传，新设计不再分主题
  // eslint-disable-next-line no-unused-vars
  theme,
}) => {
  const [showButtons, setShowButtons] = useState(false);
  const [showCopyTip, setShowCopyTip] = useState(false);
  const { t } = useTranslation();

  const normalizedContent = Array.isArray(content) ? content : [];
  const isError = status === 'error';
  const isAnswerCard = normalizedContent[0]?.type === 'answer-card';

  // ── 气泡颜色 ──────────────────────────────────────────────
  const bubbleClass = isAnswerCard
    ? 'bg-transparent'
    : cn(
        'rounded-md break-words transition-colors duration-base ease-soft',
        'px-5 py-4',
        isUser
          ? 'bg-sage-50 text-ink-900'
          : 'bg-paper-100 text-ink-900',
      );

  // ── 复制按钮 ──────────────────────────────────────────────
  const handleCopy = async (overrideText) => {
    const text =
      typeof overrideText === 'string'
        ? overrideText
        : normalizedContent
            .map((item) => {
              switch (item.type) {
                case 'text':
                case 'math':
                  return item.value;
                case 'code':
                  return `\`\`\`\n${item.value}\n\`\`\``;
                case 'question':
                  return Array.isArray(item.value)
                    ? item.value.join('\n')
                    : item.value;
                default:
                  return item.value;
              }
            })
            .join('\n\n');

    try {
      await navigator.clipboard.writeText(text);
      setShowCopyTip(true);
      setTimeout(() => setShowCopyTip(false), 1600);
    } catch (err) {
      console.error(t('MessageBubble.copyError'), err);
    }
  };

  // ── 内容渲染 ──────────────────────────────────────────────
  const renderContent = () => {
    return normalizedContent.map((item, index) => {
      switch (item.type) {
        case 'text':
          return (
            <div key={index} className="mb-2 last:mb-0">
              <MarkdownRenderer content={item.value} />
            </div>
          );

        case 'math':
          return (
            <div
              key={index}
              className="relative mb-3 overflow-x-auto rounded-md border border-paper-200 bg-paper-50 p-4 font-mono text-base shadow-soft"
            >
              <button
                type="button"
                onClick={() => handleCopy(item.value)}
                className="absolute right-2 top-2 rounded-sm p-1.5 text-ink-500 transition-colors duration-fast hover:bg-paper-100 hover:text-sage-700"
                title={t('MessageBubble.copy')}
              >
                <Icon name="Copy" size={16} className="text-current" />
              </button>
              <MarkdownRenderer content={item.value} />
            </div>
          );

        case 'code':
          return (
            <div key={index} className="relative mb-2 last:mb-0">
              <button
                type="button"
                onClick={() => handleCopy(item.value)}
                className="absolute right-2 top-2 z-10 rounded-sm p-1.5 text-ink-500 transition-colors duration-fast hover:bg-paper-100 hover:text-sage-700"
                title={t('MessageBubble.copy')}
              >
                <Icon name="Copy" size={16} className="text-current" />
              </button>
              <MarkdownRenderer content={`\`\`\`\n${item.value}\n\`\`\``} />
            </div>
          );

        case 'question':
          return (
            <div key={index} className="mb-2 last:mb-0">
              {Array.isArray(item.value)
                ? renderQuestionList(item.value)
                : renderInlineQuestionString(item.value)}
            </div>
          );

        case 'thinking':
          return (
            <ThinkingBlock
              key={index}
              content={item.value}
              isStreaming={isStreaming && index === 0}
            />
          );

        case 'answer-card':
          return (
            <div key={index} className="mb-2 last:mb-0">
              <AnswerMessageCard
                question={item.value.question}
                level={item.value.level}
                answer={item.value.answer}
              />
            </div>
          );

        default:
          return (
            <div key={index} className="mb-2 last:mb-0">
              <MarkdownRenderer content={item.value} />
            </div>
          );
      }
    });
  };

  // ── 加载态：BrandLogo 已表达"思考中"，气泡内只放一句衬线斜体 ──
  const renderLoading = () => (
    <div className="text-body italic font-serif text-ink-500">
      {t('MessageBubble.thinking')}
    </div>
  );

  return (
    <div
      className={cn(
        'mb-3 flex items-start gap-3 px-4',
        isUser ? 'justify-end' : 'justify-start',
      )}
    >
      {!isUser && !isAnswerCard && (
        <BrandLogo
          size={32}
          expression={ASSISTANT_AVATAR_EXPRESSION(isLoading, isStreaming, isError)}
          className={cn('mt-1 shrink-0', isError ? 'text-state-warn' : 'text-ink-700')}
        />
      )}

      <div
        className="group relative max-w-[85%]"
        onMouseEnter={() => setShowButtons(true)}
        onMouseLeave={() => setShowButtons(false)}
      >
        <div className={cn('relative', bubbleClass)}>
          {showButtons && !isAnswerCard && !isLoading && (
            <div className="absolute -top-3 right-2 z-10 flex gap-1 rounded-sm bg-paper-50 p-0.5 shadow-soft">
              {onRetry && (
                <Button
                  intent="ghost"
                  size="sm"
                  iconOnly
                  onClick={onRetry}
                  aria-label={t('MessageBubble.retry')}
                  title={t('MessageBubble.retry')}
                >
                  <Icon name="RotateCw" size={14} />
                </Button>
              )}
              <Button
                intent="ghost"
                size="sm"
                iconOnly
                onClick={() => handleCopy()}
                aria-label={t('MessageBubble.copy')}
                title={t('MessageBubble.copy')}
              >
                <Icon name="Copy" size={14} />
              </Button>
            </div>
          )}

          {showCopyTip && (
            <div className="absolute -top-8 right-2 animate-fade-in-out rounded-xs bg-ink-900 px-2 py-1 text-caption font-mono text-paper-50 shadow-lift">
              {t('MessageBubble.copied')}
            </div>
          )}

          {isLoading ? renderLoading() : renderContent()}

          {isError && !isUser && (
            <div className="mt-3 flex items-center gap-2 rounded-xs bg-sun-300/30 px-3 py-2 text-small font-serif text-ink-700">
              <Flag size={16} className="shrink-0 text-state-warn" />
              <span>
                {error?.message ||
                  t('MessageBubble.failed', {
                    defaultValue: '我这边出了点小状况，要不要再试一次？',
                  })}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── 子渲染：question 数组形态 ──────────────────────────────
function renderQuestionList(values) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {values.map((question, qIndex) => (
          <div
            key={qIndex}
            className={question.length > 50 ? 'w-full' : 'max-w-[48%]'}
          >
            <QuestionChip content={question} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 子渲染：question 字符串形态（按问号分割） ───────────────
function renderInlineQuestionString(value) {
  const lines = value.split('\n').filter((q) => q.trim());

  let questions = [];
  if (lines.length === 1) {
    const splitByQuestionMark = lines[0]
      .split(/(?<=[?？])/g)
      .filter((q) => q.trim());
    questions = splitByQuestionMark.length > 1 ? splitByQuestionMark : lines;
  } else {
    for (const line of lines) {
      const splitByQuestionMark = line
        .split(/(?<=[?？])/g)
        .filter((q) => q.trim());
      questions = questions.concat(splitByQuestionMark);
    }
  }

  if (questions.length === 1) {
    return <QuestionChip content={questions[0]} />;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {questions.map((question, qIndex) => (
          <div
            key={qIndex}
            className={question.length > 50 ? 'w-full' : 'max-w-[48%]'}
          >
            <QuestionChip content={question} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 子组件：单个问题 chip（衬线 + paper 底） ────────────────
function QuestionChip({ content }) {
  return (
    <div className="relative w-full cursor-pointer overflow-hidden rounded-sm border border-paper-200 bg-paper-50 px-4 py-2.5 font-serif text-ink-700 shadow-soft transition-colors duration-fast hover:bg-paper-100 hover:text-ink-900">
      <MarkdownRenderer content={content} />
    </div>
  );
}

QuestionChip.propTypes = {
  content: PropTypes.string.isRequired,
};

MessageBubble.propTypes = {
  isUser: PropTypes.bool,
  content: PropTypes.array,
  onRetry: PropTypes.func,
  isLoading: PropTypes.bool,
  isStreaming: PropTypes.bool,
  status: PropTypes.string,
  error: PropTypes.shape({ message: PropTypes.string }),
  theme: PropTypes.string,
};

export default MessageBubble;
