import React, { useState, useEffect } from 'react';
import Tooltip from '../Tooltip/Tooltip';
import { useTranslation } from 'react-i18next';
import i18next from 'i18next';

const HeaderButtons = ({
  handleNewChat,
  setShowSettings,
  showSettings,
  setShowDebugPanel,
  showDebugPanel,
  setShowRightSidebar,
  showRightSidebar,
  developerMode = false,
  mainModelConfig,
  optionModelConfig,
  handleOptionPromptChange,
  handleMainPromptChange,
  toggleDevPanel
}) => {
  // 添加响应式状态
  const [screenSize, setScreenSize] = useState('large');
  const { t, i18n } = useTranslation();
  
  // 引入SYSTEM_PROMPTS，用于在语言切换时更新提示词
  const [systemPrompts, setSystemPrompts] = useState({});
  
  // 导入和监听当前配置
  useEffect(() => {
    // 动态导入SYSTEM_PROMPTS
    import('../../services/prompts').then(module => {
      setSystemPrompts(module.SYSTEM_PROMPTS);
    });
  }, []);

  // 监听窗口大小变化
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      if (width < 480) {
        setScreenSize('xsmall');
      } else if (width < 768) {
        setScreenSize('small');
      } else {
        setScreenSize('large');
      }
    };
    
    // 初始检查
    checkScreenSize();
    
    // 添加窗口大小变化监听
    window.addEventListener('resize', checkScreenSize);
    
    // 清理监听器
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // 获取模型名称的简短版本
  const getShortModelName = (modelName) => {
    if (!modelName) return '';
    
    // 处理常见模型名称
    if (modelName.includes('gpt-4')) return 'GPT-4';
    if (modelName.includes('gpt-3.5')) return '3.5';
    if (modelName.includes('gemini')) return 'Gemini';
    if (modelName.includes('claude')) return 'Claude';
    if (modelName.includes('deepseek')) return 'DeepSeek';
    
    // 如果是其他模型，取前8个字符
    return modelName.slice(0, 8);
  };

  // 根据屏幕大小显示模型名称
  const displayModelName = (modelName) => {
    if (screenSize === 'xsmall') {
      return null; // 超小屏幕不显示文本
    } else if (screenSize === 'small') {
      return getShortModelName(modelName);
    } else {
      return modelName;
    }
  };

  // 切换语言并更新提示词
  const toggleLanguage = () => {
    const currentLang = i18n.language;
    const newLang = currentLang === 'zh' ? 'en' : 'zh';
    
    // 切换语言
    i18n.changeLanguage(newLang);
    
    // 让i18next有时间完成语言切换
    setTimeout(() => {
      try {
        // 从翻译文件中获取新语言的选项AI提示词
        const newOptionPrompt = i18next.t('SystemPrompts.optionAiMode', { lng: newLang });
        
        // 如果获取到有效的提示词（不是翻译键本身）
        if (newOptionPrompt && !newOptionPrompt.includes('SystemPrompts.')) {
          // 将更新后的提示词存入localStorage
          localStorage.setItem('option_ai_prompt', newOptionPrompt);
          
          // 直接调用handleOptionPromptChange函数来更新选项AI的提示词
          if (typeof handleOptionPromptChange === 'function') {
            handleOptionPromptChange(newOptionPrompt);
            console.log('HeaderButtons: 成功更新选项AI提示词', newLang);
          }
        } else {
          console.warn('HeaderButtons: 无法获取新语言的选项AI提示词');
        }

        // 从翻译文件中获取新语言的主AI提示词
        const newMainPrompt = i18next.t('SystemPrompts.learningMode', { lng: newLang });
        
        // 如果获取到有效的提示词（不是翻译键本身）
        if (newMainPrompt && !newMainPrompt.includes('SystemPrompts.')) {
          // 将更新后的提示词存入localStorage
          localStorage.setItem('learning_mode_prompt', newMainPrompt);
          
          // 直接调用handleMainPromptChange函数来更新主AI的提示词
          if (typeof handleMainPromptChange === 'function') {
            handleMainPromptChange(newMainPrompt);
            console.log('HeaderButtons: 成功更新主AI提示词', newLang);
          }
        } else {
          console.warn('HeaderButtons: 无法获取新语言的主AI提示词');
        }
        
        // 继续保留事件触发，保持兼容性
        const event = new CustomEvent('language-changed', { 
          detail: { language: newLang, optionPrompt: newOptionPrompt, mainPrompt: newMainPrompt } 
        });
        window.dispatchEvent(event);
      } catch (error) {
        console.error('HeaderButtons: 更新提示词时出错:', error);
      }
    }, 100); // 给i18next一点时间完成切换
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center mr-2 space-x-2">
        {mainModelConfig && (
          <Tooltip content={t('HeaderButtons.mainModel')}>
            <div 
              className="text-xs px-2 py-1 bg-slate-100 text-slate-800 rounded-md border border-slate-200 flex items-center cursor-pointer hover:bg-slate-200 transition-colors duration-200"
              onClick={() => setShowSettings(true)}
            >
              <svg className="w-3 h-3 mr-1 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {displayModelName(mainModelConfig.model) && (
                <span>{displayModelName(mainModelConfig.model)}</span>
              )}
            </div>
          </Tooltip>
        )}
        
        {optionModelConfig && (
          <Tooltip content={t('HeaderButtons.optionModel')}>
            <div 
              className="text-xs px-2 py-1 bg-zinc-100 text-zinc-800 rounded-md border border-zinc-200 flex items-center cursor-pointer hover:bg-zinc-200 transition-colors duration-200"
              onClick={() => setShowSettings(true)}
            >
              <svg className="w-3 h-3 mr-1 text-zinc-700" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              {displayModelName(optionModelConfig.model) && (
                <span>{displayModelName(optionModelConfig.model)}</span>
              )}
            </div>
          </Tooltip>
        )}
      </div>

      {/* 语言切换按钮 */}
      <Tooltip content={t('HeaderButtons.language')}>
        <button
          onClick={toggleLanguage}
          className="p-2 rounded-lg transition-all duration-300 hover:bg-slate-100 text-slate-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
              d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
          </svg>
        </button>
      </Tooltip>

      <Tooltip content={t('HeaderButtons.settings')}>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 rounded-lg transition-all duration-300 hover:bg-slate-100 text-slate-600"
        >
          <svg 
            className="w-5 h-5" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth="2" 
              d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
            />
          </svg>
        </button>
      </Tooltip>

      <Tooltip content={t('HeaderButtons.history')}>
        <button
          onClick={() => setShowRightSidebar(!showRightSidebar)}
          className="p-2 rounded-lg transition-all duration-300 hover:bg-slate-100 text-slate-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
              d="M4 6h16M4 12h16M4 18h7" />
          </svg>
        </button>
      </Tooltip>

      <Tooltip content={t('HeaderButtons.newChat')}>
        <button
          onClick={() => handleNewChat()}
          className="p-2 rounded-lg transition-all duration-300 hover:bg-slate-100 text-slate-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
              d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </Tooltip>

      {/* 仅在开发者模式下显示调试按钮 */}
      {developerMode && (
        <Tooltip content={t('HeaderButtons.debug')}>
          <button
            onClick={() => (typeof toggleDevPanel === 'function' ? toggleDevPanel() : setShowDebugPanel(!showDebugPanel))}
            className={`p-2 rounded-lg transition-all duration-300 ${
              showDebugPanel ? 'bg-cyan-50 text-cyan-600' : 'hover:bg-slate-100 text-slate-600'
            }`}
          >
            <svg 
              className="w-5 h-5" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth="2" 
                d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
              />
            </svg>
          </button>
        </Tooltip>
      )}
    </div>
  );
};

export default HeaderButtons; 