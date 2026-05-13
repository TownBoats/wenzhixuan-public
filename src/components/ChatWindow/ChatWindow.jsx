import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import MessageBubble from '../MessageBubble/MessageBubble';
import { CoffeeCup } from '@/components/ui';

/**
 * ChatWindow — 主聊天画布（设计 token 重写版）
 *
 * 视觉迁移自旧版：
 *   - LoadingIndicator amber 三点 + stone 文 → CoffeeCup + sage 三点 + serif italic
 *     （与新 ThinkingBlock 同语言）
 *   - bg-gradient slate-50/50 to white/50    → bg-paper-50（暖中性纸感）
 *   - 旧 tech 主题分支整体删除
 *   - 旧两个空 div 装饰 → 删除
 */

const LoadingIndicator = () => {
  const { t } = useTranslation();

  return (
    <div className="mb-4 flex justify-start px-4">
      <div className="flex items-center gap-2 rounded-md border border-paper-200 bg-paper-50 px-3 py-2">
        <CoffeeCup size={16} className="text-sage-500 shrink-0" />
        <span className="inline-flex gap-0.5">
          <span className="h-1.5 w-1.5 rounded-pill bg-sage-300 animate-pulse" />
          <span className="h-1.5 w-1.5 rounded-pill bg-sage-300 animate-pulse [animation-delay:200ms]" />
          <span className="h-1.5 w-1.5 rounded-pill bg-sage-300 animate-pulse [animation-delay:400ms]" />
        </span>
        <span className="text-small font-serif italic text-ink-500">
          {t('ChatWindow.thinking')}
        </span>
      </div>
    </div>
  );
};

const ChatWindow = ({
  messages,
  isLoading,
  onRetryMessage,
  onRetryUserMessage,
  currResponse,
  currThinking,
  // theme prop 仍接收以兼容上层透传，新设计单主题，未来 dark: 接管
  // eslint-disable-next-line no-unused-vars
  theme,
}) => {
  return (
    <div className="relative flex h-full flex-col bg-paper-50 transition-colors duration-base">
      <div className="relative flex-1 overflow-y-auto px-2 py-4 sm:px-4 sm:py-6 scrollbar-custom">
        <div className="mx-auto w-full max-w-[48rem]">
          {messages.map((message, index) => (
            <MessageBubble
              key={message.id || index}
              isUser={message.role === 'user'}
              content={message.content}
              status={message.status}
              error={message.error}
              onRetry={
                message.retryable === false
                  ? undefined
                  : message.role === 'assistant'
                    ? () => onRetryMessage(message.sourceMessageId || message.id)
                    : () => onRetryUserMessage(message.sourceMessageId || message.id)
              }
            />
          ))}

          {isLoading && (
            <div>
              {currThinking || (currResponse && currResponse.length > 0) ? (
                <MessageBubble
                  isUser={false}
                  content={[
                    ...(currThinking ? [{ type: 'thinking', value: currThinking }] : []),
                    ...(currResponse || []),
                  ]}
                  isStreaming={true}
                />
              ) : (
                <LoadingIndicator />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

ChatWindow.propTypes = {
  messages: PropTypes.array.isRequired,
  isLoading: PropTypes.bool,
  questions: PropTypes.array,
  onQuestionClick: PropTypes.func,
  onRetryMessage: PropTypes.func,
  onRetryUserMessage: PropTypes.func,
  currResponse: PropTypes.array,
  currThinking: PropTypes.string,
  selectedQuestion: PropTypes.object,
  onLevelSelect: PropTypes.func,
  onCloseAnswer: PropTypes.func,
  theme: PropTypes.string,
};

export default ChatWindow;
