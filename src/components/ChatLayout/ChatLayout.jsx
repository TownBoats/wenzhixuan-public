import React from 'react';
import QuestionCard from '../QuestionCard/QuestionCard';
import ChatWindow from '../ChatWindow/ChatWindow';
import { useTranslation } from 'react-i18next';
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
  currResponse
}) => {
  const { t } = useTranslation();
  return (
    <>
      <div className="absolute left-8 top-6 w-64 z-10 space-y-4">
        {singleTurnQuestion && singleTurnQuestion.length > 0 && (
          <div className="transition-all duration-300 bg-white/80 border border-slate-200 shadow-sm rounded-xl">
            <div 
              className="p-4 flex items-center justify-between cursor-pointer"
              onClick={() => setShowQuestionCards(!showQuestionCards)}
            >
              <div>
                <h2 className="text-sm font-medium text-slate-600">
                  {t('ChatLayout.pendingQuestions')}
                </h2>
                <div className="text-xs mt-1 text-slate-500">
                  {`${t('ChatLayout.totalQuestions')} ${singleTurnQuestion.length} ${t('ChatLayout.questions')} · ${
                    singleTurnQuestion.filter(q => q.hasFetchedAnswer).length
                  } ${t('ChatLayout.answered')}`}
                </div>
              </div>
              <button
                className="p-1 rounded-lg transition-all duration-300 hover:bg-slate-100 text-slate-600"
              >
                <svg 
                  className={`w-5 h-5 transform transition-transform duration-300 ${
                    showQuestionCards ? 'rotate-180' : ''
                  }`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth="2" 
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            </div>

            <div className={`overflow-hidden transition-all duration-300 ${
              showQuestionCards ? 'max-h-[60vh]' : 'max-h-0'
            }`}>
              <div className="p-4 pt-0 space-y-4 overflow-y-auto max-h-[calc(60vh-4rem)] scrollbar-thin scrollbar-thumb-rounded-full scrollbar-track-rounded-full scrollbar-thumb-slate-400/20 scrollbar-track-slate-100">
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
        />
      </div>
    </>
  );
};

export default ChatLayout; 