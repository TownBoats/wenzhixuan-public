import React from 'react';
import MarkdownRenderer from '../MarkdownRenderer/MarkdownRenderer';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next'; 

const QuestionCard = ({ question, onClick, onCancel, width }) => {
  const { t } = useTranslation();
  // 根据问题状态返回对应的样式
  const getStatusStyles = () => {
    const baseStyles = {
      pending: 'border-slate-200',
      requesting: 'border-cyan-200 bg-cyan-50/50',
      responding: 'border-cyan-300 bg-cyan-50',
      completed: 'border-cyan-200 bg-cyan-50/50',
      confirmed: 'border-green-200 bg-green-50/50',
      error: 'border-red-200 bg-red-50/50'
    };

    if (question.isAnswered) {
      return baseStyles.confirmed;
    }
    return baseStyles[question.status || 'pending'];
  };

  // 根据问题状态返回对应的状态显示组件
  const renderStatusIndicator = () => {
    if (question.isAnswered) {
      return (
        <div className="flex items-center text-xs font-medium text-green-600">
          <svg className="-ml-1 mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
          </svg>
          {t('QuestionCard.confirmed')}
        </div>
      );
    }

    switch (question.status) {
      case 'requesting':
        return (
          <div className="flex items-center text-xs font-medium text-cyan-500/70">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {t('QuestionCard.AIPreparing')}
          </div>
        );
      
      case 'responding':
        return (
          <div className="flex items-center text-xs font-medium text-cyan-500/70">
            <svg className="animate-pulse -ml-1 mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
            </svg>
            {t('QuestionCard.AIProcessing')}
          </div>
        );
      
      case 'completed':
        return (
          <div className="flex items-center text-xs font-medium text-cyan-500">
            <svg className="-ml-1 mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
            </svg>
            {t('QuestionCard.AICompleted')}
          </div>
        );
      
      case 'error':
        return (
          <div className="flex items-center text-xs font-medium text-red-500/70">
            <svg className="-ml-1 mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            {t('QuestionCard.AIError')}
          </div>
        );
      
      default:
        return (
          <div className="text-xs font-medium text-cyan-500/70">
            {t('QuestionCard.AIPreparing')}
          </div>
        );
    }
  };

  return (
    <div 
      onClick={() => {
        if (!question.isProcessing) {
          onClick(question);
        }
      }}
      style={{ width }}
      className={`flex-shrink-0 p-4 rounded-xl transition-all duration-300 group border ${
        getStatusStyles()
      } ${
        question.isProcessing ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
      }`}
    >
      <div className="text-sm font-medium mb-2 font-['PingFang SC'] text-slate-700">
        {t('QuestionCard.exploreQuestion')} {question.hasFetchedAnswer && t('QuestionCard.answered')}
      </div>
      
      <div className="text-base font-['PingFang SC'] leading-relaxed flex items-start gap-2 group-hover:gap-3 transition-all text-slate-600">
        <div className="flex-1">
          <MarkdownRenderer content={question.question} />
        </div>
        {!question.isProcessing && (
          <svg 
            className="w-5 h-5 flex-shrink-0 mt-1 transition-all text-cyan-500 opacity-0 group-hover:opacity-100"
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth="1.5" 
              d="M9 5l7 7-7 7"
            />
          </svg>
        )}
      </div>

      {/* 状态指示器 */}
      <div className="mt-3 flex items-center justify-between">
        {renderStatusIndicator()}
        {!question.isAnswered && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onCancel(question.id);
            }}
            className="p-1.5 rounded-lg transition-all duration-300 text-red-400/70 hover:text-red-500 hover:bg-red-50"
            title={t('QuestionCard.deleteQuestion')}
          >
            <svg 
              className="w-4 h-4" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth="2" 
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

QuestionCard.propTypes = {
  question: PropTypes.object.isRequired,
  onClick: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  width: PropTypes.string,
};

export default QuestionCard; 