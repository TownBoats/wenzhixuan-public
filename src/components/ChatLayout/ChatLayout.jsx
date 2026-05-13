import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import QuestionCard from '../QuestionCard/QuestionCard';
import ChatWindow from '../ChatWindow/ChatWindow';
import { Button, Icon, cn } from '@/components/ui';

/**
 * ChatLayout — 主布局：消息区 + 待回答问题
 *
 * 响应式策略（cursor/responsive-layout-49ca）：
 *   - desktop (≥ md, 768px)：左侧 256px 浮窗（旧行为）
 *   - mobile  (< md)        ：顶部一行 chip "X 个待答 (Y/X 已答)"，
 *                              点击展开为顶部下拉抽屉，背后蒙层关闭
 *
 * 同一份数据 + 同一个 showQuestionCards state，只是渲染分两套；
 * 父组件 ChatPage 完全不感知差异。
 */
const ChatLayout = ({
  singleTurnQuestion,
  showQuestionCards,
  setShowQuestionCards,
  handleQuestionClick,
  handleCancelQuestion,
  uiMessages,
  isLoading,
  onRetryMessage,
  onRetryUserMessage,
  selectedQuestion,
  onLevelSelect,
  onCloseAnswer,
  currResponse,
  currThinking,
}) => {
  const { t } = useTranslation();
  const hasQuestions = singleTurnQuestion && singleTurnQuestion.length > 0;
  const totalCount = singleTurnQuestion?.length || 0;
  const answeredCount =
    singleTurnQuestion?.filter((q) => q.hasFetchedAnswer).length || 0;

  // ── ESC 关闭 mobile 抽屉 ──
  useEffect(() => {
    if (!showQuestionCards) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setShowQuestionCards(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showQuestionCards, setShowQuestionCards]);

  if (!hasQuestions) {
    // 没有问题时只渲染消息区（保持父布局不抖动）
    return (
      <div className="absolute inset-0 overflow-y-auto scrollbar-none">
        <ChatWindow
          messages={uiMessages}
          isLoading={isLoading}
          questions={singleTurnQuestion}
          onQuestionClick={handleQuestionClick}
          onRetryMessage={onRetryMessage}
          onRetryUserMessage={onRetryUserMessage}
          selectedQuestion={selectedQuestion}
          onLevelSelect={onLevelSelect}
          onCloseAnswer={onCloseAnswer}
          currResponse={currResponse}
          currThinking={currThinking}
        />
      </div>
    );
  }

  const summaryLabel = `${t('ChatLayout.totalQuestions')} ${totalCount} ${t(
    'ChatLayout.questions',
  )} · ${answeredCount} ${t('ChatLayout.answered')}`;

  return (
    <>
      {/* ── Mobile 顶部 chip：< md 显示 ── */}
      <div className="absolute left-3 right-3 top-3 z-20 md:hidden">
        <button
          type="button"
          onClick={() => setShowQuestionCards(!showQuestionCards)}
          className={cn(
            'flex w-full items-center justify-between gap-2 rounded-md border border-paper-200',
            'bg-paper-50/90 px-3 py-2 shadow-soft backdrop-blur-sm',
            'transition-colors duration-fast hover:bg-paper-100',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/30',
          )}
          aria-expanded={showQuestionCards}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Icon name="ListChecks" size={16} className="text-sage-700 shrink-0" />
            <div className="min-w-0 text-left">
              <p className="truncate font-serif text-small text-ink-900">
                {t('ChatLayout.pendingQuestions')}
              </p>
              <p className="truncate font-mono text-caption text-ink-500">
                {summaryLabel}
              </p>
            </div>
          </div>
          <Icon
            name="ChevronDown"
            size={16}
            className={cn(
              'shrink-0 text-ink-500 transition-transform duration-base ease-soft',
              showQuestionCards && 'rotate-180',
            )}
          />
        </button>

        {/* Mobile 抽屉 + 蒙层 */}
        {showQuestionCards && (
          <>
            <button
              type="button"
              aria-label="关闭问题列表"
              className="fixed inset-0 z-[-1] bg-ink-900/15 backdrop-blur-[1px]"
              onClick={() => setShowQuestionCards(false)}
            />
            <div className="mt-2 max-h-[60vh] overflow-hidden rounded-md border border-paper-200 bg-paper-50 shadow-lift">
              <div className="max-h-[calc(60vh-1rem)] space-y-3 overflow-y-auto p-3 scrollbar-custom">
                {singleTurnQuestion.map((questionObj) => (
                  <QuestionCard
                    key={questionObj.id}
                    question={questionObj}
                    onClick={(q) => {
                      handleQuestionClick(q);
                      setShowQuestionCards(false);
                    }}
                    onCancel={handleCancelQuestion}
                    width="100%"
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Desktop 左侧浮窗：≥ md 显示 ── */}
      <div className="absolute left-4 top-4 z-10 hidden w-64 space-y-4 md:block lg:left-8 lg:top-6">
        <div className="rounded-md border border-paper-200 bg-paper-50/85 shadow-soft backdrop-blur-sm transition-all duration-base ease-soft">
          <div
            className="flex cursor-pointer items-center justify-between p-4"
            onClick={() => setShowQuestionCards(!showQuestionCards)}
          >
            <div>
              <h2 className="font-serif text-body text-ink-900">
                {t('ChatLayout.pendingQuestions')}
              </h2>
              <div className="mt-1 font-mono text-caption text-ink-500">
                {summaryLabel}
              </div>
            </div>
            <Button
              intent="ghost"
              size="sm"
              iconOnly
              onClick={(e) => {
                e.stopPropagation();
                setShowQuestionCards(!showQuestionCards);
              }}
              aria-label={showQuestionCards ? '折叠' : '展开'}
              aria-expanded={showQuestionCards}
            >
              <Icon
                name="ChevronDown"
                size={16}
                className={cn(
                  'transition-transform duration-base ease-soft',
                  showQuestionCards && 'rotate-180',
                )}
              />
            </Button>
          </div>

          <div
            className={cn(
              'overflow-hidden transition-all duration-base ease-soft',
              showQuestionCards ? 'max-h-[60vh]' : 'max-h-0',
            )}
          >
            <div className="max-h-[calc(60vh-4rem)] space-y-4 overflow-y-auto p-4 pt-0 scrollbar-custom">
              {singleTurnQuestion.map((questionObj) => (
                <QuestionCard
                  key={questionObj.id}
                  question={questionObj}
                  onClick={handleQuestionClick}
                  onCancel={handleCancelQuestion}
                  width="100%"
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 overflow-y-auto scrollbar-none">
        <ChatWindow
          messages={uiMessages}
          isLoading={isLoading}
          questions={singleTurnQuestion}
          onQuestionClick={handleQuestionClick}
          onRetryMessage={onRetryMessage}
          onRetryUserMessage={onRetryUserMessage}
          selectedQuestion={selectedQuestion}
          onLevelSelect={onLevelSelect}
          onCloseAnswer={onCloseAnswer}
          currResponse={currResponse}
          currThinking={currThinking}
        />
      </div>
    </>
  );
};

ChatLayout.propTypes = {
  singleTurnQuestion: PropTypes.array,
  showQuestionCards: PropTypes.bool,
  setShowQuestionCards: PropTypes.func.isRequired,
  handleQuestionClick: PropTypes.func.isRequired,
  handleCancelQuestion: PropTypes.func.isRequired,
  uiMessages: PropTypes.array,
  isLoading: PropTypes.bool,
  onRetryMessage: PropTypes.func,
  onRetryUserMessage: PropTypes.func,
  selectedQuestion: PropTypes.object,
  onLevelSelect: PropTypes.func,
  onCloseAnswer: PropTypes.func,
  currResponse: PropTypes.array,
  currThinking: PropTypes.string,
};

export default ChatLayout;
