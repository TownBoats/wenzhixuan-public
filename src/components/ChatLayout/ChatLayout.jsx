import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import QuestionCard from '../QuestionCard/QuestionCard';
import ChatWindow from '../ChatWindow/ChatWindow';
import { Button, Icon, cn } from '@/components/ui';

/**
 * ChatLayout — 聊天页主布局：左侧问题抽屉 + 全屏滚动消息区
 *
 * 视觉迁移自旧版：
 *   - bg-white/80 + slate-200 + rounded-xl  → bg-paper-50/85 + paper-200 +
 *                                              rounded-md + shadow-soft + backdrop-blur
 *   - 标题 slate-600 + 副标题 slate-500       → ink-900 衬线 + ink-500 mono
 *   - 折叠按钮内联 SVG + slate hover          → ui Button(ghost iconOnly) + ChevronDown
 *   - 旧滚动条类名                              → .scrollbar-custom 工具
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
  const answeredCount = singleTurnQuestion?.filter((q) => q.hasFetchedAnswer).length || 0;

  return (
    <>
      <div className="absolute left-8 top-6 z-10 w-64 space-y-4">
        {singleTurnQuestion && singleTurnQuestion.length > 0 && (
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
                  {`${t('ChatLayout.totalQuestions')} ${singleTurnQuestion.length} ${t(
                    'ChatLayout.questions',
                  )} · ${answeredCount} ${t('ChatLayout.answered')}`}
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
        )}
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
