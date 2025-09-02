import React from 'react';
import ConfigManager from "../../utils/ConfigManager";

const DebugPanel = ({
  showDebugPanel,
  setShowDebugPanel,
  mainModelConfig,
  optionModelConfig,
  mainPrompt,
  optionPrompt,
  currentChatId,
  messages,
  singleTurnQuestion,
  histories
}) => {
  if (!showDebugPanel) return null;

  return (
    <div 
      className="fixed right-0 top-0 h-full bg-white/95 border-l shadow-xl transition-all duration-300 ease-in-out transform z-50"
      style={{ 
        width: '400px',
        top: '72px',
        height: 'calc(100% - 72px)'
      }}
    >
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-lg font-medium text-slate-800">
            调试信息
          </h2>
          <button
            onClick={() => setShowDebugPanel(false)}
            className="p-2 rounded-lg transition-all duration-300 hover:bg-slate-100 text-slate-600"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-medium mb-2 text-slate-600">主模型配置</h4>
              <pre className="p-3 rounded bg-slate-50 text-xs overflow-auto max-h-60 whitespace-pre-wrap break-all">
                {JSON.stringify(mainModelConfig, null, 2)}
              </pre>
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-2 text-slate-600">选项模型配置</h4>
              <pre className="p-3 rounded bg-slate-50 text-xs overflow-auto max-h-60 whitespace-pre-wrap break-all">
                {JSON.stringify(optionModelConfig, null, 2)}
              </pre>
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-2 text-slate-600">主模型提示词</h4>
              <pre className="p-3 rounded bg-slate-50 text-xs overflow-auto max-h-60 whitespace-pre-wrap break-all">
                {mainPrompt}
              </pre>
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-2 text-slate-600">选项模型提示词</h4>
              <pre className="p-3 rounded bg-slate-50 text-xs overflow-auto max-h-60 whitespace-pre-wrap break-all">
                {optionPrompt}
              </pre>
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-2 text-slate-600">本地存储状态</h4>
              <button 
                onClick={() => {
                  const localStorageData = {
                    mainAgentConfig: ConfigManager.getMainModelConfig(),
                    optionAgentConfig: ConfigManager.getOptionModelConfig(),
                    mainAgentPrompt: ConfigManager.getMainPrompt(),
                    optionAgentPrompt: ConfigManager.getOptionPrompt()
                  };
                  console.log('本地存储数据:', localStorageData);
                  alert('本地存储数据已输出到控制台');
                }}
                className="px-4 py-2 bg-slate-100 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors"
              >
                查看本地存储数据
              </button>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2 text-slate-600">当前对话状态</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-slate-500">当前对话ID:</span>
                  <span className="text-xs font-mono">{currentChatId || '无'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-500">消息数量:</span>
                  <span className="text-xs font-mono">{messages.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-500">问题数量:</span>
                  <span className="text-xs font-mono">{singleTurnQuestion.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-500">历史记录数量:</span>
                  <span className="text-xs font-mono">{histories.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebugPanel; 