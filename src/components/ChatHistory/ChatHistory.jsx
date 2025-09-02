import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const ChatHistory = ({ 
  histories, 
  currentChatId, 
  onSelectHistory, 
  onDeleteHistory,
  onUpdateTitle,
  theme = 'default' 
}) => {
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');

  const handleEditClick = (history) => {
    setEditingId(history.id);
    setEditingTitle(history.title || '未命名对话');
  };

  const handleTitleSubmit = (id) => {
    onUpdateTitle(id, editingTitle);
    setEditingId(null);
  };

  const getMessagePreview = (messages) => {
    if (!messages || !Array.isArray(messages)) return '空对话';
    
    // 尝试找到最后一条用户消息
    const lastUserMessage = messages.find(msg => msg.role === 'user')?.content;
    if (!lastUserMessage) {
      // 如果没有用户消息，尝试获取第一条消息
      const firstMessage = messages[0]?.content;
      if (!firstMessage) return '空对话';
      
      // 处理消息内容
      if (Array.isArray(firstMessage)) {
        const firstTextContent = firstMessage.find(item => item.type === 'text' || item.type === 'response')?.value;
        return firstTextContent ? `${firstTextContent.slice(0, 50)}...` : '空对话';
      }
      return `${String(firstMessage).slice(0, 50)}...`;
    }
    
    // 处理用户消息
    if (Array.isArray(lastUserMessage)) {
      const textContent = lastUserMessage.find(item => item.type === 'text' || item.type === 'response')?.value;
      return textContent ? `${textContent.slice(0, 50)}...` : '空对话';
    }
    
    return `${String(lastUserMessage).slice(0, 50)}...`;
  };

  return (
    <div className="space-y-2">
      {histories.map((history) => (
        <div
          key={history.id}
          className={`group p-3 rounded-lg transition-all duration-200 ${
            currentChatId === history.id
              ? theme === 'tech'
                ? 'bg-tech-accent/20 border border-tech-accent/30'
                : 'bg-cyan-50 border border-cyan-200'
              : theme === 'tech'
                ? 'hover:bg-tech-accent/10 border border-tech-text/10'
                : 'hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <div className="flex justify-between items-start gap-2">
            <div 
              className="flex-1 min-w-0 cursor-pointer"
              onClick={() => onSelectHistory(history.id)}
            >
              {editingId === history.id ? (
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={() => handleTitleSubmit(history.id)}
                  onKeyPress={(e) => e.key === 'Enter' && handleTitleSubmit(history.id)}
                  className={`w-full px-2 py-1 rounded border ${
                    theme === 'tech' 
                      ? 'bg-tech-secondary border-tech-text/20 text-tech-highlight' 
                      : 'bg-white border-slate-200 text-slate-800'
                  }`}
                  autoFocus
                />
              ) : (
                <>
                  <h4 className={`font-medium truncate ${
                    theme === 'tech' ? 'text-tech-text' : 'text-slate-700'
                  }`}>
                    {history.title || '未命名对话'}
                  </h4>
                  <p className={`text-sm mt-1 ${
                    theme === 'tech' ? 'text-tech-text/70' : 'text-slate-500'
                  }`}>
                    {formatDistanceToNow(new Date(history.timestamp), { 
                      addSuffix: true,
                      locale: zhCN 
                    })}
                  </p>
                  <p className={`text-xs mt-1 truncate ${
                    theme === 'tech' ? 'text-tech-text/50' : 'text-slate-400'
                  }`}>
                    {getMessagePreview(history.uiMessages)}
                  </p>
                </>
              )}
            </div>
            
            <div className={`flex items-center gap-1 ${
              currentChatId === history.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            } transition-opacity`}>
              <button
                onClick={() => handleEditClick(history)}
                className={`p-1.5 rounded-lg transition-all ${
                  theme === 'tech'
                    ? 'hover:bg-tech-accent/20 text-tech-text'
                    : 'hover:bg-slate-100 text-slate-600'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </button>
              <button
                onClick={() => onDeleteHistory(history.id)}
                className={`p-1.5 rounded-lg transition-all ${
                  theme === 'tech'
                    ? 'hover:bg-red-500/20 text-red-400'
                    : 'hover:bg-red-50 text-red-500'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ChatHistory; 