import React from 'react';
import MessageBubble from '../MessageBubble/MessageBubble';
import { RingLoader, HashLoader, PuffLoader, PulseLoader } from 'react-spinners';
import { useTranslation } from 'react-i18next';
// 加载动画组件
const LoadingIndicator = ({ theme = 'default' }) => {
  const { t } = useTranslation();
  // 根据主题设置颜色，与消息气泡匹配
  const themeColor = theme === 'tech' ? '#6366f1' : '#0ea5e9';
  
  return (
    <div className="flex justify-start mb-4 px-4">
      <div className={`${
        theme === 'tech' 
          ? 'bg-tech-primary/90 border-tech-text/20' 
          : 'bg-[#F5F1EA] border-[#F5F1EA]/60'
      } border p-4 rounded-xl rounded-tl-sm shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex flex-col items-center`}>
        <div className="mb-2">
          {theme === 'tech' ? (
            <HashLoader color={themeColor} size={36} speedMultiplier={0.8} />
          ) : (
            <PuffLoader color="#6B7280" size={40} speedMultiplier={0.8} />
          )}
        </div>
        <div className={`text-sm mt-1 ${
          theme === 'tech' ? 'text-tech-accent' : 'text-gray-700'
        } font-medium animate-pulse`}>
          {t('ChatWindow.thinking')}
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
              key={index}
              isUser={message.role === "user"}
              content={message.content}
              theme={theme}
              onRetry={
                message.role === "assistant" 
                  ? () => onRetryMessage(index)
                  : () => onRetryUserMessage(index)
              }
            />
          ))}

          {isLoading && (
            <div>
              {(currResponse && currResponse.length > 0) ? (
                <MessageBubble
                  isUser={false}
                  content={currResponse}
                  theme={theme}
                />
              ) : (
                <LoadingIndicator theme={theme} />
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default ChatWindow;