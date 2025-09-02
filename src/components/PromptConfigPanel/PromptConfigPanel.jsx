import React, { useState, useEffect } from 'react';
import { SYSTEM_PROMPTS } from '../../services/prompts';
import { useTranslation } from 'react-i18next';

// 定义Agent模式映射
const AGENT_MODES = {
  'LEARNING_MODE': {
    name: '学习模式',
    description: '专注于解释概念和提供详细教程，适合学习新知识',
    prompt: SYSTEM_PROMPTS.LEARNING_MODE || '你是一个专注于教学的AI助手，擅长解释复杂概念并提供详细的教程。'
  },
  'CREATIVE_MODE': {
    name: '创意模式',
    description: '注重创意思维和头脑风暴，适合创作和想法生成',
    prompt: SYSTEM_PROMPTS.CREATIVE_MODE || '你是一个创意助手，擅长头脑风暴和创意思维，帮助用户发散思维并产生新想法。'
  },
  'CODING_MODE': {
    name: '编程模式',
    description: '专注于代码编写和技术问题解决，提供详细的代码示例',
    prompt: SYSTEM_PROMPTS.CODING_MODE || '你是一个编程助手，擅长编写代码、解决技术问题，并提供详细的代码示例和解释。'
  },
  'ANALYSIS_MODE': {
    name: '分析模式',
    description: '专注于数据分析和逻辑推理，适合解决复杂问题',
    prompt: SYSTEM_PROMPTS.ANALYSIS_MODE || '你是一个分析助手，擅长数据分析、逻辑推理和解决复杂问题，提供深入的见解和建议。'
  },
  'CHAT_MODE': {
    name: '聊天模式',
    description: '友好的对话体验，适合日常交流和闲聊',
    prompt: SYSTEM_PROMPTS.CHAT_MODE || '你是一个友好的聊天助手，擅长日常交流和闲聊，提供轻松愉快的对话体验。'
  }
};

const AgentConfigPanel = ({
  currentPrompt,
  onPromptChange,
  agentType = 'main'
}) => {
  const { t } = useTranslation();
  const [selectedMode, setSelectedMode] = useState('');
  
  // 根据当前提示词找到对应的模式
  const findModeByPrompt = (prompt) => {
    const mode = Object.entries(AGENT_MODES).find(([_, config]) => 
      config.prompt === prompt
    );
    return mode ? mode[0] : '';
  };
  
  // 初始化选中的模式
  useEffect(() => {
    const mode = findModeByPrompt(currentPrompt);
    setSelectedMode(mode);
  }, [currentPrompt]);

  // 处理模式选择
  const handleModeSelect = (e) => {
    const mode = e.target.value;
    setSelectedMode(mode);
    
    if (mode && AGENT_MODES[mode]) {
      onPromptChange(AGENT_MODES[mode].prompt);
    }
  };

  return (
    <div className="p-5 rounded-xl shadow-sm bg-white border border-slate-200">
      <h3 className="text-lg font-medium mb-4 text-slate-800">
        {agentType === 'main' ? t('PromptConfigPanel.mainAgent') : t('PromptConfigPanel.optionAgent')}
      </h3>

      <div className="space-y-6">
        {/* 模式选择 */}
        <div>
          <label className="block text-sm font-medium mb-2 text-slate-600">
            {t('PromptConfigPanel.selectMode')}
          </label>
          <select
            value={selectedMode}
            onChange={handleModeSelect}
            className="w-full p-2.5 rounded-lg border bg-white border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          >
            <option value="">{t('PromptConfigPanel.optionDefault')}</option>
            {Object.entries(AGENT_MODES).map(([key, config]) => (
              <option key={key} value={key}>
                {config.name}
              </option>
            ))}
          </select>
        </div>

        {/* 模式描述 */}
        {selectedMode && (
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <h4 className="font-medium text-slate-800 mb-2">
              {AGENT_MODES[selectedMode].name}
            </h4>
            <p className="text-sm text-slate-600">
              {AGENT_MODES[selectedMode].description}
            </p>
          </div>
        )}
        
        {/* 自定义提示词提示 */}
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-blue-500 mt-0.5 mr-2 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="font-medium text-blue-800 mb-1">{t('PromptConfigPanel.advancedTitle')}</h4>
              <p className="text-sm text-blue-600">
                {t('PromptConfigPanel.advancedTips')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentConfigPanel; 