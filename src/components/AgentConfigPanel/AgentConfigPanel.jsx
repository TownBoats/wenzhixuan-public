import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { SYSTEM_PROMPTS } from '../../services/prompts';
import { Icon, cn } from '@/components/ui';

/**
 * AgentConfigPanel — Agent 提示词模式选择（设计 token 重写版）
 *
 * 视觉迁移自旧版：
 *   - bg-white + gray-200 卡片        → bg-paper-50 + paper-200 + shadow-soft
 *   - select gray border + 灰色 focus  → paper-200 + sage-500 focus ring + caret
 *   - 模式描述 bg-gray-100 矩形         → bg-paper-100 + ChevronRight 提示
 *   - 标题 text-lg gray-800            → text-h2 font-serif text-ink-900
 *
 * 行为完全保留：language-changed 事件 / localStorage 同步 / 模式映射。
 */
const AgentConfigPanel = ({ currentPrompt, onPromptChange, agentType = 'main' }) => {
  const { t } = useTranslation();
  const [selectedMode, setSelectedMode] = useState('');

  // ── 监听语言切换事件 + localStorage ──
  useEffect(() => {
    const handleLanguageChange = (event) => {
      if (agentType === 'option' && selectedMode === 'OPTION_AI_MODE') {
        try {
          let newPrompt = event.detail?.prompt;
          if (!newPrompt) {
            newPrompt =
              localStorage.getItem('option_ai_prompt') || t('SystemPrompts.optionAiMode');
          }
          if (newPrompt && newPrompt !== currentPrompt) {
            onPromptChange(newPrompt);
          }
        } catch (error) {
          console.error('AgentConfigPanel: 处理语言变化事件出错', error);
        }
      }
    };

    window.addEventListener('language-changed', handleLanguageChange);

    const handleStorageChange = (e) => {
      if (
        e.key === 'option_ai_prompt' &&
        agentType === 'option' &&
        selectedMode === 'OPTION_AI_MODE'
      ) {
        const newPrompt = e.newValue;
        if (newPrompt && newPrompt !== currentPrompt) {
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

  // ── 语言切换后同步 OPTION_AI_MODE 提示词 ──
  useEffect(() => {
    if (agentType === 'option' && selectedMode === 'OPTION_AI_MODE') {
      const translatedPrompt = t('SystemPrompts.optionAiMode');
      if (translatedPrompt && translatedPrompt !== currentPrompt) {
        onPromptChange(translatedPrompt);
      }
    }
  }, [t, agentType, selectedMode, onPromptChange, currentPrompt]);

  const AGENT_MODES = {
    LEARNING_MODE: {
      name: t('AgentConfigPanel.learningMode'),
      description:
        t('AgentConfigPanel.learningModeDesc') ||
        '启发思考，引领超越。通过问答互动，激发独立思维。不同凡想。',
      prompt:
        SYSTEM_PROMPTS.LEARNING_MODE ||
        '你是一个专注于教学的AI助手，擅长解释复杂概念并提供详细的教程。',
    },
    TEST_MODE: {
      name: t('AgentConfigPanel.testMode'),
      description: t('AgentConfigPanel.testModeDesc') || '随心交流，自然畅聊。',
      prompt: SYSTEM_PROMPTS.TEST_MODE || '聊天助手，擅长聊天，帮助用户进行聊天。',
    },
    OPTION_AI_MODE: {
      name: t('AgentConfigPanel.optionAiMode'),
      description:
        t('AgentConfigPanel.optionAiModeDesc') ||
        '量身打造您的选项，站在您的角度思考回答。',
      prompt:
        t('SystemPrompts.optionAiMode') ||
        SYSTEM_PROMPTS.OPTION_AI_MODE ||
        '你是一个选项助手，擅长选项和选择，帮助用户进行选项和选择。',
    },
  };

  const findModeByPrompt = useCallback(
    (prompt) => {
      if (prompt === t('SystemPrompts.optionAiMode')) return 'OPTION_AI_MODE';
      const storedPrompt = localStorage.getItem('option_ai_prompt');
      if (storedPrompt && prompt === storedPrompt) return 'OPTION_AI_MODE';
      const mode = Object.entries(AGENT_MODES).find(([, conf]) => conf.prompt === prompt);
      return mode ? mode[0] : '';
    },
    // 仅用于初始化，AGENT_MODES 在每次渲染都新建，故不放进 deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  );

  useEffect(() => {
    setSelectedMode(findModeByPrompt(currentPrompt));
  }, [currentPrompt, findModeByPrompt]);

  const handleModeSelect = (e) => {
    const mode = e.target.value;
    setSelectedMode(mode);
    if (mode && AGENT_MODES[mode]) {
      onPromptChange(AGENT_MODES[mode].prompt);
    }
  };

  return (
    <div className="rounded-md border border-paper-200 bg-paper-50 p-4 shadow-soft">
      <h3 className="mb-3 text-h2 font-serif text-ink-900">
        {agentType === 'main'
          ? t('AgentConfigPanel.mainAgent')
          : t('AgentConfigPanel.optionAgent')}
      </h3>

      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-small font-medium text-ink-700">
            {t('AgentConfigPanel.selectMode')}
          </label>
          <div className="relative">
            <select
              value={selectedMode}
              onChange={handleModeSelect}
              className={cn(
                'w-full appearance-none rounded-sm border border-paper-200 bg-paper-50 py-2 pl-3 pr-10',
                'text-body text-ink-900 caret-sage-500',
                'transition-colors duration-fast outline-none',
                'focus:border-sage-500 focus:ring-2 focus:ring-sage-500/20',
              )}
            >
              <option value="">{t('AgentConfigPanel.optionDefault')}</option>
              {Object.entries(AGENT_MODES).map(([key, conf]) => (
                <option key={key} value={key}>
                  {conf.name}
                </option>
              ))}
            </select>
            <Icon
              name="ChevronDown"
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-500"
            />
          </div>
        </div>

        {selectedMode && (
          <div className="rounded-sm border border-paper-200 bg-paper-100 p-3">
            <h4 className="mb-1 flex items-center gap-1.5 font-serif text-body text-ink-900">
              <Icon name="ChevronRight" size={14} className="text-sage-700" />
              {AGENT_MODES[selectedMode].name}
            </h4>
            <p className="font-serif text-small italic text-ink-700">
              {AGENT_MODES[selectedMode].description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

AgentConfigPanel.propTypes = {
  currentPrompt: PropTypes.string,
  onPromptChange: PropTypes.func.isRequired,
  agentType: PropTypes.oneOf(['main', 'option']),
};

export default AgentConfigPanel;
