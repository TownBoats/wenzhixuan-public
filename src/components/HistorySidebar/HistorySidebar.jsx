import React from 'react';
import ChatHistory from '../ChatHistory/ChatHistory';
import { useTranslation } from 'react-i18next';
const HistorySidebar = ({
  showRightSidebar,
  setShowRightSidebar,
  histories,
  currentChatId,
  handleSelectHistory,
  handleDeleteHistory,
  handleUpdateTitle
}) => {
  const { t } = useTranslation();
  if (!showRightSidebar) return null;

  return (
    <div 
      className="fixed right-0 top-0 h-full bg-white/80 border-l transition-all duration-300 ease-in-out transform translate-x-0"
      style={{ 
        width: '320px',
        top: '72px',
        height: 'calc(100% - 72px)'
      }}
    >
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200/10">
          <h2 className="text-sm font-medium text-slate-600">
            {t('HistorySidebar.title')}
          </h2>
          <button
            onClick={() => setShowRightSidebar(false)}
            className="p-2 rounded-lg transition-all duration-300 hover:bg-slate-100 text-slate-600"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-rounded-full scrollbar-track-rounded-full scrollbar-thumb-slate-400/20 scrollbar-track-slate-100">
          <div className="p-4">
            <ChatHistory
              histories={histories}
              currentChatId={currentChatId}
              onSelectHistory={handleSelectHistory}
              onDeleteHistory={handleDeleteHistory}
              onUpdateTitle={handleUpdateTitle}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistorySidebar; 