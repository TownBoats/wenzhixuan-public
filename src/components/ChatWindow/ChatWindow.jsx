import React from 'react';
import MessageBubble from '../MessageBubble/MessageBubble';
import { useTranslation } from 'react-i18next';

// 轻量加载指示器 - 侧边线风格，与 ThinkingBlock 及助手气泡暖色系一致
const LoadingIndicator = () => {
  const { t } = useTranslation();

  return (
    <div className="flex justify-start mb-4 px-4">
      <div className="border-l-2 border-amber-400/70 pl-3 py-2">
        <div className="flex items-center gap-2 text-sm text-stone-500">
          <span className="inline-flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse [animation-delay:200ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse [animation-delay:400ms]" />
          </span>
          <span className="font-medium">{t('ChatWindow.thinking')}</span>
        </div>
      </div>
    </div>
  );
};

// 主聊天窗口组件
const ChatWindow = ({ 
  messages, 
  questions, 
  isLoading, 
  onQuestionClick, 
  onRetryMessage,
  onRetryUserMessage,
  currResponse,
  currThinking,
  selectedQuestion,
  onLevelSelect,
  onCloseAnswer,
  theme = 'default'
}) => {
  // 计算聊天窗口的类名
  const chatWindowClasses = `flex flex-col h-full relative transition-colors duration-300 ${
    theme === 'tech' ? 'bg-tech-primary' : 'bg-gradient-to-br from-slate-50/50 to-white/50'
  }`;

  return (
    <div className={chatWindowClasses}>
      {theme === 'tech' && (
        <div className="absolute inset-0 bg-tech-grid bg-[size:20px_20px] opacity-[0.03]"></div>
      )}

      {theme === 'default' && (
        <>
          <div className="absolute left-0 top-1/2 -translate-x-1/2 transform">
          </div>
          <div className="absolute right-0 top-1/3 translate-x-1/2 transform">
          </div>
        </>
      )}

      {/* 消息列表区域 */}
      <div className="flex-1 overflow-y-auto scrollbar-custom py-6 relative">
        <div className="max-w-[48rem] mx-auto">
          {messages.map((message, index) => (
            <MessageBubble
              key={message.id || index}
              isUser={message.role === "user"}
              content={message.content}
              status={message.status}
              error={message.error}
              theme={theme}
              onRetry={
                message.retryable === false
                  ? undefined
                  : message.role === "assistant"
                    ? () => onRetryMessage(message.sourceMessageId || message.id)
                    : () => onRetryUserMessage(message.sourceMessageId || message.id)
              }
            />
          ))}

          {isLoading && (
            <div>
              {(currThinking || (currResponse && currResponse.length > 0)) ? (
                <MessageBubble
                  isUser={false}
                  content={[
                    ...(currThinking ? [{ type: 'thinking', value: currThinking }] : []),
                    ...(currResponse || []),
                  ]}
                  isStreaming={true}
                  theme={theme}
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

export default ChatWindow;
