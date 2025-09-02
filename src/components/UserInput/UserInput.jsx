// UserInput.jsx

import React from 'react';
import { useTranslation } from 'react-i18next';
const UserInput = ({ inputText, setInputText, handleSendMessage, isLoading, centered = false }) => {
  const { t } = useTranslation();
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className={`w-full transition-all duration-500 ${
      centered ? 'max-w-2xl' : 'max-w-[48rem]'
    } mx-auto`}>
      <div className="relative">
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={t('UserInput.placeholder')}
          className={`w-full px-4 py-3 pr-14 rounded-xl resize-none transition-all duration-300
            bg-white/80 border-2 border-slate-200 text-slate-800 placeholder-slate-400 
            focus:border-cyan-500 focus:ring-0
            outline-none min-h-[56px] max-h-32`}
        />
        <button
          onClick={handleSendMessage}
          disabled={isLoading || !inputText.trim()}
          className={`absolute right-3 bottom-[12px] p-1.5 rounded-lg transition-all duration-300
            text-cyan-500 disabled:text-slate-300
            hover:transform hover:translate-x-0.5 disabled:cursor-not-allowed`}
        >
          <svg 
            viewBox="0 0 24 24" 
            className="w-5 h-5" 
            fill="currentColor"
          >
            <path d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a.993.993 0 00-1.39.91L2 9.12c0 .5.37.93.87.99L17 12L2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default UserInput;
