import React, { useState, useEffect } from 'react';
import { SYSTEM_PROMPTS } from '../../services/prompts';
import { useTranslation } from 'react-i18next';

const AgentConfigPanel = ({
  currentPrompt,
  onPromptChange,
  agentType = 'main'
}) => {
  // 获取i18n实例
  const { t } = useTranslation();
  const [selectedMode, setSelectedMode] = useState('');

  // 监听语言变化事件，更新提示词
  useEffect(() => {
    const handleLanguageChange = (event) => {
      // 仅当为选项模型且当前选中的是OPTION_AI_MODE时才更新
      if (agentType === 'option' && selectedMode === 'OPTION_AI_MODE') {
        try {
          // 尝试使用事件中传递的提示词
          let newPrompt = event.detail?.prompt;
          
          // 如果事件中没有提供提示词，则从localStorage获取
          if (!newPrompt) {
            newPrompt = localStorage.getItem('option_ai_prompt') || t('SystemPrompts.optionAiMode');
          }
          
          if (newPrompt && newPrompt !== currentPrompt) {
            console.log('AgentConfigPanel: 收到语言变化事件，更新提示词', event.detail?.language);
            onPromptChange(newPrompt);
          }
        } catch (error) {
          console.error('AgentConfigPanel: 处理语言变化事件出错', error);
        }
      }
    };

    // 监听自定义语言变化事件
    window.addEventListener('language-changed', handleLanguageChange);
    
    // 监听localStorage变化
    const handleStorageChange = (e) => {
      if (e.key === 'option_ai_prompt' && agentType === 'option' && selectedMode === 'OPTION_AI_MODE') {
        const newPrompt = e.newValue;
        if (newPrompt && newPrompt !== currentPrompt) {
          console.log('AgentConfigPanel: 检测到localStorage变化，更新提示词');
          onPromptChange(newPrompt);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('language-changed', handleLanguageChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [agentType, selectedMode, onPromptChange, t, currentPrompt]);

  // 从翻译文件获取最新的OPTION_AI_MODE提示词
  useEffect(() => {
    if (agentType === 'option' && selectedMode === 'OPTION_AI_MODE') {
      const translatedPrompt = t('SystemPrompts.optionAiMode');
      if (translatedPrompt && translatedPrompt !== currentPrompt) {
        onPromptChange(translatedPrompt);
      }
    }
  }, [t, agentType, selectedMode, onPromptChange, currentPrompt]);

  // 将AGENT_MODES移到组件内部，这样可以使用t函数
  const AGENT_MODES = {
    'LEARNING_MODE': {
      name: t('AgentConfigPanel.learningMode'),
      description: t('AgentConfigPanel.learningModeDesc') || '启发思考，引领超越。通过问答互动，激发独立思维。不同凡想。',
      prompt: SYSTEM_PROMPTS.LEARNING_MODE || '你是一个专注于教学的AI助手，擅长解释复杂概念并提供详细的教程。'
    },

    "TEST_MODE": {
      name: t('AgentConfigPanel.testMode'),
      description: t('AgentConfigPanel.testModeDesc') || '随心交流，自然畅聊。',
      prompt: SYSTEM_PROMPTS.TEST_MODE || '聊天助手，擅长聊天，帮助用户进行聊天。'
    },
    "OPTION_AI_MODE": {
      name: t('AgentConfigPanel.optionAiMode'),
      description: t('AgentConfigPanel.optionAiModeDesc') || '量身打造您的选项，站在您的角度思考回答。',
      // 从翻译文件中获取optionAiMode提示词，与语言绑定
      prompt: t('SystemPrompts.optionAiMode') || SYSTEM_PROMPTS.OPTION_AI_MODE || '你是一个选项助手，擅长选项和选择，帮助用户进行选项和选择。'
    }
  };

  // 根据当前提示词找到对应的模式
  const findModeByPrompt = (prompt) => {
    // 特殊处理：如果是翻译文件中的提示词
    if (prompt === t('SystemPrompts.optionAiMode')) {
      return 'OPTION_AI_MODE';
    }
    
    // 检查localStorage中是否有存储的提示词
    const storedPrompt = localStorage.getItem('option_ai_prompt');
    if (storedPrompt && prompt === storedPrompt) {
      return 'OPTION_AI_MODE';
    }
    
    const mode = Object.entries(AGENT_MODES).find(([_, config]) =>
      config.prompt === prompt
    );
    return mode ? mode[0] : '';
  };

  // 初始化选中的模式
  useEffect(() => {
    const mode = findModeByPrompt(currentPrompt);
    setSelectedMode(mode);
  }, [currentPrompt, t]);  // 添加t为依赖，当语言变化时重新计算

  // 处理模式选择
  const handleModeSelect = (e) => {
    const mode = e.target.value;
    setSelectedMode(mode);

    if (mode && AGENT_MODES[mode]) {
      onPromptChange(AGENT_MODES[mode].prompt);
    }
  };

  return (
    <div className="p-4 rounded-xl shadow-sm bg-white border border-gray-200">
      <h3 className="text-lg font-medium mb-3 text-gray-800">
        {agentType === 'main' ? t('AgentConfigPanel.mainAgent') : t('AgentConfigPanel.optionAgent')}
      </h3>

      <div className="space-y-4">
        {/* 模式选择 */}
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-600">
            {t('AgentConfigPanel.selectMode')}
          </label>
          <select
            value={selectedMode}
            onChange={handleModeSelect}
            className="w-full p-2.5 rounded-lg border bg-white border-gray-300 text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500/50"
          >
            <option value="">{t('AgentConfigPanel.optionDefault')}</option>
            {Object.entries(AGENT_MODES).map(([key, config]) => (
              <option key={key} value={key}>
                {config.name}
              </option>
            ))}
          </select>
        </div>

        {/* 模式描述 */}
        {selectedMode && (
          <div className="bg-gray-100 p-3 rounded-lg border border-gray-200">
            <h4 className="font-medium text-gray-800 mb-1">
              {AGENT_MODES[selectedMode].name}
            </h4>
            <p className="text-sm text-gray-600">
              {AGENT_MODES[selectedMode].description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentConfigPanel; 