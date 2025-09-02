import React, { useState, useEffect } from 'react';
import ModelConfigPanel from '../ModelConfigPanel/ModelConfigPanel';
import AgentConfigPanel from '../AgentConfigPanel/AgentConfigPanel';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

// 自定义Checkbox组件
const StyledCheckbox = ({ label, checked, onChange }) => {
  return (
    <label className="flex items-center space-x-2 cursor-pointer group">
      <div className="relative">
        <input 
          type="checkbox" 
          className="sr-only" 
          checked={checked} 
          onChange={onChange}
        />
        <div className={`w-5 h-5 border rounded-md flex items-center justify-center transition-all duration-200 ${
          checked 
            ? 'bg-gradient-to-r from-gray-800 to-black border-transparent' 
            : 'border-slate-300 bg-white group-hover:border-gray-700'
        }`}>
          {checked && (
            <svg 
              className="w-3.5 h-3.5 text-white" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="3"
            >
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
      </div>
      <span className="text-slate-600 text-sm">{label}</span>
    </label>
  );
};

const SettingsPanel = ({
  showSettings,
  setShowSettings,
  mainModelConfig,
  optionModelConfig,
  handleMainConfigChange,
  handleOptionConfigChange,
  mainPrompt,
  optionPrompt,
  handleMainPromptChange,
  handleOptionPromptChange,
  histories,
  setHistories,
  handleNewChat
}) => {
  const [settingsTab, setSettingsTab] = useState('general');
  // 获取i18n实例
  const { i18n, t } = useTranslation();
  
  // 使用当前语言初始化state
  const [language, setLanguage] = useState(() => {
    return i18n.language || 'zh';
  });
  
  // 获取开发者模式状态，但不在界面上显示开关
  const [developerMode, setDeveloperMode] = useState(() => {
    return localStorage.getItem('developerMode') === 'true';
  });
  
  // 添加等待时间设置
  const [enableWaitTime, setEnableWaitTime] = useState(() => {
    return localStorage.getItem('enableWaitTime') !== 'false'; // 默认启用
  });
  
  const [waitTime, setWaitTime] = useState(() => {
    const savedTime = localStorage.getItem('waitTime');
    return savedTime ? parseInt(savedTime) : 5; // 默认5秒
  });
  
  // 处理等待时间设置变更
  const handleWaitTimeChange = (newTime) => {
    const time = parseInt(newTime);
    if (!isNaN(time) && time >= 0 && time <= 30) {
      setWaitTime(time);
      localStorage.setItem('waitTime', time.toString());
    }
  };
  
  // 处理等待时间开关变更
  const handleEnableWaitTimeChange = () => {
    const newValue = !enableWaitTime;
    setEnableWaitTime(newValue);
    localStorage.setItem('enableWaitTime', newValue.toString());
  };

  // 监听开发者模式变化
  useEffect(() => {
    const handleStorageChange = () => {
      const currentValue = localStorage.getItem('developerMode') === 'true';
      if (currentValue !== developerMode) {
        setDeveloperMode(currentValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // 定期检查localStorage中的开发者模式状态
    const interval = setInterval(() => {
      handleStorageChange();
    }, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [developerMode]);

  // 处理语言选择（立即应用并关闭设置面板）
  const handleLanguageSelect = (lng) => {
    // 如果选择的语言与当前语言不同，则应用语言切换
    if (lng !== language) {
      i18n.changeLanguage(lng);
      setLanguage(lng);
      
      // 让i18next有时间完成语言切换
      setTimeout(() => {
        try {
          // 从翻译文件中获取新语言的选项AI提示词
          const newOptionPrompt = i18n.t('SystemPrompts.optionAiMode', { lng });
          
          // 如果获取到有效的提示词（不是翻译键本身）
          if (newOptionPrompt && !newOptionPrompt.includes('SystemPrompts.')) {
            // 将更新后的提示词存入localStorage
            localStorage.setItem('option_ai_prompt', newOptionPrompt);
            
            // 触发提示词更新 - 通过自定义事件广播
            const event = new CustomEvent('language-changed', { 
              detail: { language: lng, prompt: newOptionPrompt } 
            });
            window.dispatchEvent(event);
            
            // 如果当前选中的是选项AI模式，则立即更新提示词
            if (optionPrompt && (
                optionPrompt === localStorage.getItem('optionAgentPrompt') ||
                optionPrompt === i18n.t('SystemPrompts.optionAiMode', { lng: language })
            )) {
              handleOptionPromptChange(newOptionPrompt);
              console.log('SettingsPanel: 成功更新选项AI提示词', lng);
            }
          } else {
            console.warn('SettingsPanel: 无法获取新语言的提示词');
          }
        } catch (error) {
          console.error('SettingsPanel: 更新选项AI提示词时出错:', error);
        }
        
        // 显示切换成功提示
        alert(i18n.t('SettingsPanel.language.changeSuccess', { lng }));
        
        // 关闭设置面板
        setShowSettings(false);
      }, 100); // 给i18next一点时间完成切换
    }
  };
  
  // 处理设置保存
  const handleSaveSettings = () => {
    // 保存等待时间设置
    localStorage.setItem('enableWaitTime', enableWaitTime.toString());
    localStorage.setItem('waitTime', waitTime.toString());
    
    // 显示网页提示
    alert(t('SettingsPanel.footer.saveSuccess'));
    
    // 直接关闭设置面板
    setShowSettings(false);
  };

  if (!showSettings) return null;

  // 标签页定义，包含图标
  const tabs = [
    { 
      id: 'general', 
      label: t('SettingsPanel.tabs.general'), 
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ) 
    },
    { 
      id: 'model', 
      label: t('SettingsPanel.tabs.model'), 
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
        </svg>
      ) 
    },
    { 
      id: 'prompt', 
      label: t('SettingsPanel.tabs.prompt'), 
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      ) 
    },
    { 
      id: 'about', 
      label: t('SettingsPanel.tabs.about'), 
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ) 
    },
  ];

  return (
    <AnimatePresence>
      {showSettings && (
        <motion.div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div 
            className="w-full max-w-4xl h-[80vh] flex flex-col rounded-2xl shadow-2xl bg-white border border-gray-200"
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            {/* Header */}
            <div className="flex-none flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                <svg className="w-5 h-5 mr-2 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {t('SettingsPanel.title')}
                {developerMode && (
                  <span className="ml-2 text-xs text-blue-500 opacity-70">{t('SettingsPanel.developerMode')}</span>
                )}
              </h2>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 rounded-full transition-all duration-300 hover:bg-gray-100 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                aria-label="关闭"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex-none p-3 border-b border-gray-200">
              <div className="flex relative rounded-xl p-1 bg-gray-100">
                {tabs.map((tab, index) => (
                  <button
                    key={tab.id}
                    onClick={() => setSettingsTab(tab.id)}
                    className={`relative flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium z-10 transition-all duration-300 ${
                      settingsTab === tab.id
                        ? 'text-white'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                    {settingsTab === tab.id && (
                      <motion.div
                        className="absolute inset-0 bg-gray-800 rounded-lg shadow-md"
                        layoutId="tab-background"
                        initial={false}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        style={{ zIndex: -1 }}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="p-4 h-full">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={settingsTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    {settingsTab === 'general' && (
                      <div className="space-y-4 pr-2">
                        {/* 界面语言 */}
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                          <h3 className="text-sm font-medium mb-2 text-gray-700 flex items-center">
                            <svg className="w-4 h-4 mr-2 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                            </svg>
                            {t('SettingsPanel.language.label')}
                          </h3>
                          <div className="flex relative rounded-xl p-1 bg-gray-100 mt-2">
                            <button
                              onClick={() => handleLanguageSelect('zh')}
                              className={`relative flex-1 flex items-center justify-center px-3 py-1.5 rounded-lg text-sm font-medium z-10 transition-all duration-300 ${
                                language === 'zh'
                                  ? 'text-white'
                                  : 'text-gray-600 hover:text-gray-900'
                              }`}
                            >
                              {t('SettingsPanel.language.zh')}
                              {language === 'zh' && (
                                <motion.div
                                  className="absolute inset-0 bg-gray-800 rounded-lg shadow-md"
                                  layoutId="language-background"
                                  initial={false}
                                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                                  style={{ zIndex: -1 }}
                                />
                              )}
                            </button>
                            <button
                              onClick={() => handleLanguageSelect('en')}
                              className={`relative flex-1 flex items-center justify-center px-3 py-1.5 rounded-lg text-sm font-medium z-10 transition-all duration-300 ${
                                language === 'en'
                                  ? 'text-white'
                                  : 'text-gray-600 hover:text-gray-900'
                              }`}
                            >
                              {t('SettingsPanel.language.en')}
                              {language === 'en' && (
                                <motion.div
                                  className="absolute inset-0 bg-gray-800 rounded-lg shadow-md"
                                  layoutId="language-background"
                                  initial={false}
                                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                                  style={{ zIndex: -1 }}
                                />
                              )}
                            </button>
                          </div>
                        </div>
                        
                        {/* 添加等待时间设置 */}
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                          <h3 className="text-sm font-medium mb-3 text-gray-700 flex items-center">
                            <svg className="w-4 h-4 mr-2 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {t('SettingsPanel.answerCardWaitingTime')}
                          </h3>
                          
                          <div className="space-y-3">
                            {/* 开关 */}
                            <div className="flex items-center justify-between bg-gray-50 p-2.5 rounded-lg">
                              <span className="text-sm text-gray-600 font-medium">{t('SettingsPanel.enableWaitingTime')}</span>
                              <StyledCheckbox 
                                label="" 
                                checked={enableWaitTime} 
                                onChange={handleEnableWaitTimeChange} 
                              />
                            </div>
                            
                            {/* 时间设置 */}
                            <div className={`${enableWaitTime ? "bg-gray-50 p-3 rounded-lg" : "opacity-50 pointer-events-none bg-gray-50/50 p-3 rounded-lg"} transition-all duration-200`}>
                              <label className="block text-sm text-gray-600 mb-2 font-medium">
                                {t('SettingsPanel.answerCardWaitingTime')} ({waitTime} {t('SettingsPanel.seconds')})
                              </label>
                              <div className="flex items-center space-x-3">
                                <span className="text-xs text-gray-500">0</span>
                                <input
                                  type="range"
                                  min="0"
                                  max="30"
                                  value={waitTime}
                                  onChange={(e) => handleWaitTimeChange(e.target.value)}
                                  className="flex-1 accent-gray-700 h-1.5 rounded-full bg-gray-200"
                                />
                                <span className="text-xs text-gray-500">30</span>
                                <div className="w-12 flex justify-center">
                                  <input
                                    type="number"
                                    min="0"
                                    max="30"
                                    value={waitTime}
                                    onChange={(e) => handleWaitTimeChange(e.target.value)}
                                    className="w-12 px-2 py-1 text-center border border-gray-300 rounded text-sm focus:ring-1 focus:ring-gray-500 focus:border-gray-500 outline-none shadow-sm"
                                  />
                                </div>
                              </div>
                              <p className="mt-2 text-xs text-gray-500">
                                {waitTime === 0 
                                  ? t('SettingsPanel.currentSettingOff') 
                                  : t('SettingsPanel.currentSettingOn', { seconds: waitTime })}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        {/* 聊天记录管理 */}
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                          <h3 className="text-sm font-medium mb-2 text-gray-700 flex items-center">
                            <svg className="w-4 h-4 mr-2 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            {t('SettingsPanel.chatHistory.title')}
                          </h3>
                          <div className="space-y-3">
                            {/* 导出按钮 */}
                            <button
                              onClick={() => {
                                // 导出聊天记录
                                const chatHistories = localStorage.getItem('chat_histories');
                                if (!chatHistories) {
                                  alert('没有可导出的聊天记录');
                                  return;
                                }
                                
                                // 创建下载链接
                                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(chatHistories);
                                const downloadAnchorNode = document.createElement('a');
                                downloadAnchorNode.setAttribute("href", dataStr);
                                downloadAnchorNode.setAttribute("download", `问知轩聊天记录_${new Date().toISOString().slice(0, 10)}.json`);
                                document.body.appendChild(downloadAnchorNode);
                                downloadAnchorNode.click();
                                downloadAnchorNode.remove();
                              }}
                              className="w-full px-4 py-2.5 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors shadow-sm hover:shadow-md active:shadow-inner flex items-center justify-center"
                            >
                              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              {t('SettingsPanel.chatHistory.export')}
                            </button>
                            
                            {/* 导入区域 */}
                            <div>
                              <label className="block text-sm font-medium mb-2 text-slate-700">
                                {t('SettingsPanel.chatHistory.importLabel')}
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="file"
                                  id="chat-history-import"
                                  accept=".json"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (!file) return;
                                    
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                      try {
                                        // 验证JSON格式
                                        const importedData = JSON.parse(event.target.result);
                                        
                                        // 验证数据结构
                                        if (!Array.isArray(importedData)) {
                                          throw new Error('导入的数据格式不正确');
                                        }
                                        
                                        // 合并现有历史记录和导入的历史记录
                                        const existingHistories = localStorage.getItem('chat_histories');
                                        let mergedHistories = [];
                                        
                                        if (existingHistories) {
                                          const existingData = JSON.parse(existingHistories);
                                          // 使用Map去重，以ID为键
                                          const historyMap = new Map();
                                          
                                          // 先添加现有的历史记录
                                          existingData.forEach(history => {
                                            historyMap.set(history.id, history);
                                          });
                                          
                                          // 再添加导入的历史记录（如有重复ID则覆盖）
                                          importedData.forEach(history => {
                                            historyMap.set(history.id, history);
                                          });
                                          
                                          // 转换回数组并按时间戳排序
                                          mergedHistories = Array.from(historyMap.values())
                                            .sort((a, b) => b.timestamp - a.timestamp);
                                        } else {
                                          mergedHistories = importedData;
                                        }
                                        
                                        // 保存合并后的历史记录
                                        localStorage.setItem('chat_histories', JSON.stringify(mergedHistories));
                                        
                                        // 更新状态
                                        setHistories(mergedHistories);
                                        
                                        alert(`成功导入 ${importedData.length} 条聊天记录`);
                                        
                                        // 清空文件输入
                                        e.target.value = null;
                                      } catch (error) {
                                        console.error('导入聊天记录失败:', error);
                                        alert(`导入失败: ${error.message}`);
                                      }
                                    };
                                    
                                    reader.readAsText(file);
                                  }}
                                />
                                <button
                                  onClick={() => document.getElementById('chat-history-import').click()}
                                  className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors shadow-sm hover:shadow-md active:shadow-inner flex items-center justify-center"
                                >
                                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                  </svg>
                                  {t('SettingsPanel.chatHistory.importButton')}
                                </button>
                              </div>
                              <p className="mt-1.5 text-xs text-slate-500">
                                {t('SettingsPanel.chatHistory.importTips')}
                              </p>
                            </div>
                            
                            {/* 清空聊天记录 */}
                            <div>
                              <button
                                onClick={() => {
                                  if (confirm('确定要清空所有聊天记录吗？此操作不可恢复。')) {
                                    // 先导出一份备份
                                    const chatHistories = localStorage.getItem('chat_histories');
                                    if (chatHistories) {
                                      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(chatHistories);
                                      const downloadAnchorNode = document.createElement('a');
                                      downloadAnchorNode.setAttribute("href", dataStr);
                                      downloadAnchorNode.setAttribute("download", `问知轩聊天记录备份_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`);
                                      document.body.appendChild(downloadAnchorNode);
                                      downloadAnchorNode.click();
                                      downloadAnchorNode.remove();
                                    }
                                    
                                    // 清空聊天记录
                                    localStorage.removeItem('chat_histories');
                                    setHistories([]);
                                    
                                    // 创建新对话
                                    handleNewChat();
                                    
                                    alert('所有聊天记录已清空，并已自动创建了一个新的对话。');
                                  }
                                }}
                                className="w-full px-4 py-2.5 bg-gray-200 text-gray-800 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors shadow-sm hover:shadow-md active:shadow-inner flex items-center justify-center group"
                              >
                                <svg className="w-4 h-4 mr-2 text-gray-700 group-hover:text-gray-800" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                {t('SettingsPanel.chatHistory.clearAll')}
                              </button>
                              <p className="mt-1.5 text-xs text-slate-500">
                                {t('SettingsPanel.chatHistory.clearAllTips')}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {settingsTab === 'model' && (
                      <div className="space-y-4 pr-2">
                        <ModelConfigPanel
                          currentConfig={mainModelConfig}
                          onConfigChange={handleMainConfigChange}
                          agentType="main"
                          developerMode={developerMode}
                        />
                        <ModelConfigPanel
                          currentConfig={optionModelConfig}
                          onConfigChange={handleOptionConfigChange}
                          agentType="option"
                          developerMode={developerMode}
                        />
                      </div>
                    )}

                    {settingsTab === 'prompt' && (
                      <div className="space-y-4 pr-2">
                        <AgentConfigPanel
                          currentPrompt={mainPrompt}
                          onPromptChange={handleMainPromptChange}
                          agentType="main"
                        />
                        <AgentConfigPanel
                          currentPrompt={optionPrompt}
                          onPromptChange={handleOptionPromptChange}
                          agentType="option"
                        />
                      </div>
                    )}

                    {settingsTab === 'about' && (
                      <div className="space-y-4 pr-2">
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                          <h3 className="text-lg font-medium mb-4 text-gray-800">{t('SettingsPanel.about.title')}</h3>
                          <div className="space-y-3">
                            <div className="flex items-center space-x-2 text-gray-600">
                              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              <span className="text-sm">{t('SettingsPanel.about.email')}</span>
                              <a href="mailto:2413250743@qq.com" className="text-blue-600 hover:text-blue-800 transition-colors">
                                2413250743@qq.com
                              </a>
                            </div>
                            <div className="flex items-center space-x-2 text-gray-600">
                              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                              </svg>
                              <span className="text-sm">{t('SettingsPanel.about.github')}</span>
                              <a href="https://github.com/TownBoats" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 transition-colors">
                                TownBoats
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Footer */}
            <div className="flex-none flex justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => setShowSettings(false)}
                className="px-5 py-2.5 rounded-lg text-sm font-medium transition-all text-gray-700 hover:bg-gray-100 border border-gray-300 shadow-sm hover:shadow"
              >
                {t('SettingsPanel.footer.cancel')}
              </button>
              <button
                onClick={handleSaveSettings}
                className="px-5 py-2.5 rounded-lg text-sm font-medium transition-all bg-gray-800 hover:bg-gray-900 text-white shadow-sm hover:shadow-md active:shadow-inner"
              >
                {t('SettingsPanel.footer.confirm')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SettingsPanel;