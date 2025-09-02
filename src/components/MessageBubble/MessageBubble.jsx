import React, { useState } from 'react';
import MarkdownRenderer from '../MarkdownRenderer/MarkdownRenderer';
import AnswerMessageCard from '../AnswerMessageCard/AnswerMessageCard';
import { PulseLoader, BeatLoader, ClipLoader } from 'react-spinners';
import { useTranslation } from 'react-i18next';
const MessageBubble = ({ isUser, content = [], onRetry, isLoading = false }) => {
  const [showButtons, setShowButtons] = useState(false);
  const [showCopyTip, setShowCopyTip] = useState(false);
  const { t } = useTranslation();
  const bubbleStyles = {
    user: content[0]?.type === 'answer-card' 
      ? ''
      : 'bg-cyan-50 text-slate-700 border border-cyan-200 rounded-xl',
    assistant: content[0]?.type === 'answer-card'
      ? ''
      : 'bg-[#F5F1EA] rounded-xl text-gray-700 border border-gray-300'
  };

  const handleCopy = async () => {
    const text = content
      .map(item => {
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
      setTimeout(() => setShowCopyTip(false), 2000);
    } catch (err) {
      console.error(t('MessageBubble.copyError'), err);
    }
  };

  const renderContent = () => {
    return content.map((item, index) => {
      switch (item.type) {
        case 'text':
          return (
            <div key={index} className="mb-2">
              <MarkdownRenderer content={item.value} />
            </div>
          );
        case 'math':
          return (
            <div key={index} className="mb-3 font-mono text-base relative bg-slate-50/80 border border-slate-200 rounded-lg shadow-sm overflow-x-auto p-4">
              <button
                onClick={() => handleCopy(item.value)}
                className="absolute top-2 right-2 p-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 transition-all"
                title={t('MessageBubble.copy')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
              <MarkdownRenderer content={item.value} />
            </div>
          );
        case 'code':
          return (
            <div key={index} className="mb-2 relative">
              <button
                onClick={() => handleCopy(item.value)}
                className="absolute top-2 right-2 p-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 transition-all z-10"
                title={t('MessageBubble.copy')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
              <MarkdownRenderer content={`\`\`\`\n${item.value}\n\`\`\``} />
            </div>
          );
        case 'question':
          return (
            <div key={index} className="mb-2">
              {Array.isArray(item.value) ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {item.value.map((question, qIndex) => (
                      <div 
                        key={qIndex}
                        className={`${
                          question.length > 50 ? 'w-full' : 'max-w-[48%]'
                        }`}
                      >
                        <div className="w-full px-4 py-2.5 rounded-lg font-medium cursor-pointer 
                          bg-white text-slate-700 hover:bg-slate-50/80
                          border border-slate-200
                          transition-all hover:scale-[1.02] shadow-sm 
                          relative overflow-hidden">
                          <div className="relative">
                            <MarkdownRenderer content={question} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                (() => {
                  const lines = item.value.split('\n').filter(q => q.trim());
                  
                  let questions = [];
                  if (lines.length === 1) {
                    const splitByQuestionMark = lines[0].split(/(?<=[\?？])/g).filter(q => q.trim());
                    
                    if (splitByQuestionMark.length > 1) {
                      questions = splitByQuestionMark;
                    } else {
                      questions = lines;
                    }
                  } else {
                    for (const line of lines) {
                      const splitByQuestionMark = line.split(/(?<=[\?？])/g).filter(q => q.trim());
                      questions = questions.concat(splitByQuestionMark);
                    }
                  }
                  
                  if (questions.length === 1) {
                    return (
                      <div className="px-4 py-2.5 rounded-lg font-medium cursor-pointer 
                        bg-white text-slate-700 hover:bg-slate-50/80
                        border border-slate-200
                        transition-all hover:scale-[1.02] shadow-sm 
                        relative overflow-hidden">
                        <div className="relative">
                          <MarkdownRenderer content={questions[0]} />
                        </div>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {questions.map((question, qIndex) => (
                          <div 
                            key={qIndex}
                            className={`${
                              question.length > 50 ? 'w-full' : 'max-w-[48%]'
                            }`}
                          >
                            <div className="w-full px-4 py-2.5 rounded-lg font-medium cursor-pointer 
                              bg-white text-slate-700 hover:bg-slate-50/80
                              border border-slate-200
                              transition-all hover:scale-[1.02] shadow-sm 
                              relative overflow-hidden">
                              <div className="relative">
                                <MarkdownRenderer content={question} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          );
        case 'answer-card':
          return (
            <div key={index} className="mb-2">
              <AnswerMessageCard
                question={item.value.question}
                level={item.value.level}
                answer={item.value.answer}
              />
            </div>
          );
        default:
          return (
            <div key={index} className="mb-2">
              <MarkdownRenderer content={item.value} />
            </div>
          );
      }
    });
  };

  const renderLoading = () => {
    return (
      <div className="flex flex-col items-center justify-center py-4">
        <div className="mb-3">
          <BeatLoader color="#4B5563" size={10} margin={3} />
        </div>
        <div className="text-sm text-gray-500 animate-pulse">{t('MessageBubble.thinking')}</div>
      </div>
    );
  };

  return (
    <div className={`flex items-start gap-3 mb-3 px-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div 
        className="relative group max-w-[85%]"
        onMouseEnter={() => setShowButtons(true)}
        onMouseLeave={() => setShowButtons(false)}
      >
        <div 
          className={`relative break-words transition-all ${
            content[0]?.type === 'answer-card' ? '' : 'px-5 py-4'
          } ${
            isUser ? bubbleStyles.user : bubbleStyles.assistant
          } ${
            content[0]?.type === 'answer-card' ? 'bg-transparent' : ''
          }`}
        >
          {showButtons && content[0]?.type !== 'answer-card' && !isLoading && (
            <div className="absolute -top-3 right-2 flex gap-1.5">
              {!isUser && onRetry && (
                <button
                  onClick={onRetry}
                  className="p-1.5 rounded-lg bg-white/90 hover:bg-white text-blue-600 transition-all hover:scale-105 shadow-sm"
                  title={t('MessageBubble.retry')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}
              {isUser && onRetry && (
                <button
                  onClick={onRetry}
                  className="p-1.5 rounded-lg bg-white/90 hover:bg-white text-blue-600 transition-all hover:scale-105 shadow-sm"
                  title={t('MessageBubble.retry')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              )}
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-lg bg-white/90 hover:bg-white text-blue-600 transition-all hover:scale-105 shadow-sm"
                title={t('MessageBubble.copy')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          )}
          
          {showCopyTip && (
            <div className="absolute -top-8 right-2 px-2.5 py-1 rounded-md text-xs font-medium bg-white text-blue-600 shadow-sm transition-all animate-fade-in-out">
              {t('MessageBubble.copied')}
            </div>
          )}
          
          {isLoading ? renderLoading() : renderContent()}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble; 