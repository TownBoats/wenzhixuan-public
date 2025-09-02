import React, { useState } from 'react';
import MarkdownRenderer from '../MarkdownRenderer/MarkdownRenderer';
import { useTranslation } from 'react-i18next';

const AnswerMessageCard = ({ question, level, answer, theme = 'default' }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { t } = useTranslation();

  // 不同理解程度对应的样式
  const levelStyles = {
    default: {
      none: {
        card: 'border-gray-200',
        tag: 'bg-gray-50 text-gray-700 border-gray-200',
        header: 'bg-gradient-to-r from-gray-50/40 to-white',
        accent: 'text-gray-600'
      },
      heard: {
        card: 'border-blue-200',
        tag: 'bg-blue-50 text-blue-700 border-blue-200',
        header: 'bg-gradient-to-r from-blue-50/40 to-white',
        accent: 'text-blue-600'
      },
      basic: {
        card: 'border-green-200',
        tag: 'bg-green-50 text-green-700 border-green-200',
        header: 'bg-gradient-to-r from-green-50/40 to-white',
        accent: 'text-green-600'
      },
      familiar: {
        card: 'border-orange-200',
        tag: 'bg-orange-50 text-orange-700 border-orange-200',
        header: 'bg-gradient-to-r from-orange-50/40 to-white',
        accent: 'text-orange-600'
      },
      expert: {
        card: 'border-yellow-200',
        tag: 'bg-yellow-50 text-yellow-700 border-yellow-200',
        header: 'bg-gradient-to-r from-yellow-50/40 to-white',
        accent: 'text-yellow-600'
      },
      custom: {
        card: 'border-purple-200',
        tag: 'bg-purple-50 text-purple-700 border-purple-200',
        header: 'bg-gradient-to-r from-purple-50/40 to-white',
        accent: 'text-purple-600'
      }
    },
    tech: {
      none: {
        card: 'border-gray-500/30',
        tag: 'bg-gray-500/10 text-gray-500 border-gray-500/30',
        header: 'bg-gradient-to-r from-gray-500/5 to-transparent',
        accent: 'text-gray-500'
      },
      heard: {
        card: 'border-tech-warning/30',
        tag: 'bg-tech-warning/10 text-tech-warning border-tech-warning/30',
        header: 'bg-gradient-to-r from-tech-warning/5 to-transparent',
        accent: 'text-tech-warning'
      },
      basic: {
        card: 'border-tech-accent/30',
        tag: 'bg-tech-accent/10 text-tech-accent border-tech-accent/30',
        header: 'bg-gradient-to-r from-tech-accent/5 to-transparent',
        accent: 'text-tech-accent'
      },
      familiar: {
        card: 'border-tech-success/30',
        tag: 'bg-tech-success/10 text-tech-success border-tech-success/30',
        header: 'bg-gradient-to-r from-tech-success/5 to-transparent',
        accent: 'text-tech-success'
      },
      expert: {
        card: 'border-tech-highlight/30',
        tag: 'bg-tech-highlight/10 text-tech-highlight border-tech-highlight/30',
        header: 'bg-gradient-to-r from-tech-highlight/5 to-transparent',
        accent: 'text-tech-highlight'
      },
      custom: {
        card: 'border-tech-accent/30',
        tag: 'bg-tech-accent/10 text-tech-accent border-tech-accent/30',
        header: 'bg-gradient-to-r from-tech-accent/5 to-transparent',
        accent: 'text-tech-accent'
      }
    }
  };

  // 理解程度对应的图标
  const levelIcons = {
    none: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    heard: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
      </svg>
    ),
    basic: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    familiar: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    expert: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
    custom: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    )
  };

  // 理解程度的中文描述
  const levelDescriptions = {
    none: t('AnswerMessageCard.none'),
    heard: t('AnswerMessageCard.heard'),
    basic: t('AnswerMessageCard.basic'),
    familiar: t('AnswerMessageCard.familiar'),
    expert: t('AnswerMessageCard.expert'),
    custom: t('AnswerMessageCard.custom')
  };

  // 确保 level 有效，如果无效则使用默认值
  const validLevel = levelStyles[theme]?.[level] ? level : 'custom';

  return (
    <div 
      onClick={() => setIsCollapsed(!isCollapsed)}
      className={`w-full rounded-xl overflow-hidden transition-all duration-300 border hover:shadow-md cursor-pointer ${
        theme === 'tech' 
          ? `${levelStyles.tech[validLevel].card} bg-tech-primary/20`
          : `${levelStyles.default[validLevel].card} bg-white`
      }`}
    >
      {isCollapsed ? (
        // 折叠状态 - 固定大小的正方形布局
        <div className="flex items-center justify-center w-[72px] h-[72px]">
          <div className={`flex flex-col items-center gap-1 ${
            theme === 'tech' 
              ? levelStyles.tech[validLevel].accent
              : levelStyles.default[validLevel].accent
          }`}>
            <div className="p-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {levelIcons[validLevel].props.children}
              </svg>
            </div>
            <div className="text-xs font-medium text-center whitespace-nowrap">
              {levelDescriptions[validLevel]}
            </div>
          </div>
        </div>
      ) : (
        // 展开状态 - 原有的完整内容
        <div className="grid grid-cols-[1fr,auto] gap-4 px-5 py-4">
          <div className="flex flex-col min-w-0">
            <div className={`${
              theme === 'tech'
                ? `${levelStyles.tech[validLevel].header}`
                : `${levelStyles.default[validLevel].header}`
            }`}>
              <div className={`flex items-center gap-2 mb-1.5 ${
                theme === 'tech' 
                  ? levelStyles.tech[validLevel].accent
                  : levelStyles.default[validLevel].accent
              }`}>
                <div className="text-xs font-medium uppercase tracking-wide">{t('AnswerMessageCard.questionAnswer')}</div>
                <div className={`h-px flex-1 ${
                  theme === 'tech' 
                    ? 'bg-gradient-to-r from-current to-transparent opacity-20' 
                    : 'bg-gradient-to-r from-current to-transparent opacity-10'
                }`}></div>
              </div>
              <div className={`text-base font-medium leading-normal ${
                theme === 'tech' ? 'text-tech-highlight' : 'text-slate-700'
              }`}>
                <MarkdownRenderer content={question} theme={theme} />
              </div>
            </div>

            <div className={`mt-3 ${
              theme === 'tech' 
                ? 'bg-tech-secondary/10' 
                : 'bg-slate-50/30'
            }`}>
              <div className={`text-sm leading-relaxed ${
                theme === 'tech' ? 'text-tech-text' : 'text-slate-600'
              }`}>
                <MarkdownRenderer content={answer} theme={theme} />
              </div>
            </div>
          </div>

          <div className={`flex items-start ${
            theme === 'tech'
              ? `${levelStyles.tech[validLevel].header}`
              : `${levelStyles.default[validLevel].header}`
          }`}>
            <div className={`flex flex-col items-center gap-1 px-2.5 py-2 rounded-lg border ${
              theme === 'tech' 
                ? levelStyles.tech[validLevel].tag
                : levelStyles.default[validLevel].tag
            }`}>
              <div className="p-1">
                {levelIcons[validLevel]}
              </div>
              <div className="text-xs font-medium whitespace-nowrap">
                {levelDescriptions[validLevel]}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnswerMessageCard; 