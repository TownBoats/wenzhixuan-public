import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import MessageBubble from '../MessageBubble/MessageBubble';
import { CoffeeCup, Icon, cn } from '@/components/ui';

/**
 * ChatWindow — 主聊天画布（设计 token 重写版）
 *
 * 视觉迁移自旧版：
 *   - LoadingIndicator amber 三点 + stone 文 → CoffeeCup + sage 三点 + serif
 *     （与新 ThinkingBlock 同语言）
 *   - bg-gradient slate-50/50 to white/50    → bg-paper-50（暖中性纸感）
 *   - 旧 tech 主题分支整体删除
 *   - 旧两个空 div 装饰 → 删除
 *
 * 滚动策略（视觉跟手）：
 *   1. 贴底跟随：内容高度变化时若用户仍在底部附近，自动滚到最新
 *   2. 阈值保护：用户上滚超过 BOTTOM_THRESHOLD_PX 后不再打断其阅读
 *   3. 回到底部按钮：不在底部时右下角浮出箭头，一键平滑回底
 */

/**
 * 贴底判定阈值（px）。
 * 滚动位置距底部 ≤ 该值视为「用户仍在看最新消息」，新内容到达会自动跟随；
 * 超过该值视为用户正在翻阅历史，滚动位置保持不变。
 */
const BOTTOM_THRESHOLD_PX = 96;

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
        <span className="text-small font-sans text-ink-500">
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
  conversationKey,
  // theme prop 仍接收以兼容上层透传，新设计单主题，未来 dark: 接管
  // eslint-disable-next-line no-unused-vars
  theme,
}) => {
  const { t } = useTranslation();
  const scrollRef = useRef(null);
  const contentRef = useRef(null);
  // 是否处于「跟随最新消息」状态：用户主动上滚后置 false，回到底部后自动恢复
  const stickToBottomRef = useRef(true);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const isNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return (
      el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_THRESHOLD_PX
    );
  }, []);

  const scrollToBottom = useCallback((behavior = 'auto') => {
    const el = scrollRef.current;
    if (!el) return;
    if (typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight, behavior });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  const handleScroll = useCallback(() => {
    const atBottom = isNearBottom();
    stickToBottomRef.current = atBottom;
    setIsAtBottom(atBottom);
  }, [isNearBottom]);

  const handleScrollToBottomClick = useCallback(() => {
    stickToBottomRef.current = true;
    setIsAtBottom(true);
    scrollToBottom('smooth');
  }, [scrollToBottom]);

  // ① 会话切换 / 首次挂载：重置跟随状态并落到底部
  useLayoutEffect(() => {
    stickToBottomRef.current = true;
    setIsAtBottom(true);
    scrollToBottom();
  }, [conversationKey, scrollToBottom]);

  // ② 用户自己发言（发送消息 / 选择答案）：无论此前是否在翻阅历史，都回到最新
  const lastMessage = messages[messages.length - 1];
  const lastMessageId = lastMessage?.id;
  const lastMessageRole = lastMessage?.role;
  useLayoutEffect(() => {
    if (lastMessageRole !== 'user') return;
    stickToBottomRef.current = true;
    setIsAtBottom(true);
    scrollToBottom();
  }, [lastMessageId, lastMessageRole, scrollToBottom]);

  // ③ 新一轮请求开始（发送 / 重试）：回到最新
  useLayoutEffect(() => {
    if (!isLoading) return;
    stickToBottomRef.current = true;
    setIsAtBottom(true);
    scrollToBottom();
  }, [isLoading, scrollToBottom]);

  // ④ 内容高度变化（流式增量、Markdown 渲染、代码块/图片撑高）：贴底时持续跟随
  useEffect(() => {
    const scrollEl = scrollRef.current;
    const contentEl = contentRef.current;
    if (!scrollEl || !contentEl || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      if (!stickToBottomRef.current) return;
      scrollEl.scrollTop = scrollEl.scrollHeight;
    });
    observer.observe(contentEl);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative flex h-full flex-col bg-paper-50 transition-colors duration-base">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative min-h-0 flex-1 overflow-y-auto px-2 py-4 sm:px-4 sm:py-6 scrollbar-custom"
      >
        <div ref={contentRef} className="mx-auto w-full max-w-[48rem]">
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

      {/* 不在底部时浮出，一键回到最新消息 */}
      {!isAtBottom && (
        <button
          type="button"
          onClick={handleScrollToBottomClick}
          aria-label={t('ChatWindow.scrollToBottom')}
          title={t('ChatWindow.scrollToBottom')}
          className={cn(
            'absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5',
            'rounded-pill border border-paper-200 bg-paper-50/95 px-3 py-1.5',
            'shadow-lift backdrop-blur-sm',
            'font-sans text-caption text-ink-700 transition-colors duration-fast',
            'hover:bg-paper-100',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/30',
          )}
        >
          <Icon name="ArrowDown" size={14} className="text-sage-700" />
          <span>{t('ChatWindow.scrollToBottom')}</span>
        </button>
      )}
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
  conversationKey: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  selectedQuestion: PropTypes.object,
  onLevelSelect: PropTypes.func,
  onCloseAnswer: PropTypes.func,
  theme: PropTypes.string,
};

export default ChatWindow;
