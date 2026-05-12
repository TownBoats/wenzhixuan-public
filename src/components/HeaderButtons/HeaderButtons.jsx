import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import i18next from 'i18next';
import { Button, Icon, Tooltip, cn } from '@/components/ui';

/**
 * HeaderButtons — 顶栏按钮组（Susan Kare 重设计版）
 *
 * 视觉迁移自旧版：
 *   - 全部内联 SVG + slate hover           → ui Button(ghost iconOnly) + lucide
 *   - 旧 Tooltip 组件                       → ui/Tooltip atom（深底浅字 + 500ms 延迟）
 *   - 模型胶囊：slate / zinc 两套色         → 统一 paper-100 + ink-700 + Bot/Sparkles 图标
 *   - 调试激活：cyan-50/cyan-600            → sage-50/sage-700
 *
 * 功能逻辑（响应式断点 / 语言切换 / 模型显示截断）保持完全一致。
 */
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
  toggleDevPanel,
}) => {
  const [screenSize, setScreenSize] = useState('large');
  const { t, i18n } = useTranslation();

  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      if (width < 480) setScreenSize('xsmall');
      else if (width < 768) setScreenSize('small');
      else setScreenSize('large');
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const getShortModelName = (modelName) => {
    if (!modelName) return '';
    if (modelName.includes('gpt-4')) return 'GPT-4';
    if (modelName.includes('gpt-3.5')) return '3.5';
    if (modelName.includes('gemini')) return 'Gemini';
    if (modelName.includes('claude')) return 'Claude';
    if (modelName.includes('deepseek')) return 'DeepSeek';
    return modelName.slice(0, 8);
  };

  const displayModelName = (modelName) => {
    if (screenSize === 'xsmall') return null;
    if (screenSize === 'small') return getShortModelName(modelName);
    return modelName;
  };

  const toggleLanguage = () => {
    const currentLang = i18n.language;
    const newLang = currentLang === 'zh' ? 'en' : 'zh';
    i18n.changeLanguage(newLang);

    setTimeout(() => {
      try {
        const newOptionPrompt = i18next.t('SystemPrompts.optionAiMode', { lng: newLang });
        if (newOptionPrompt && !newOptionPrompt.includes('SystemPrompts.')) {
          localStorage.setItem('option_ai_prompt', newOptionPrompt);
          if (typeof handleOptionPromptChange === 'function') {
            handleOptionPromptChange(newOptionPrompt);
          }
        }

        const newMainPrompt = i18next.t('SystemPrompts.learningMode', { lng: newLang });
        if (newMainPrompt && !newMainPrompt.includes('SystemPrompts.')) {
          localStorage.setItem('learning_mode_prompt', newMainPrompt);
          if (typeof handleMainPromptChange === 'function') {
            handleMainPromptChange(newMainPrompt);
          }
        }

        window.dispatchEvent(
          new CustomEvent('language-changed', {
            detail: {
              language: newLang,
              optionPrompt: newOptionPrompt,
              mainPrompt: newMainPrompt,
            },
          }),
        );
      } catch (error) {
        console.error('HeaderButtons: 更新提示词时出错:', error);
      }
    }, 100);
  };

  // ── 模型胶囊（mainModelConfig / optionModelConfig 共用） ──
  const ModelChip = ({ icon, label, model }) => (
    <Tooltip content={label}>
      <button
        type="button"
        onClick={() => setShowSettings(true)}
        className={cn(
          'inline-flex h-7 items-center gap-1 rounded-pill px-2',
          'bg-paper-100 text-caption font-mono text-ink-700',
          'border border-paper-200',
          'transition-colors duration-fast hover:bg-paper-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/30',
        )}
      >
        <Icon name={icon} size={12} className="text-sage-700" />
        {displayModelName(model) && <span>{displayModelName(model)}</span>}
      </button>
    </Tooltip>
  );

  ModelChip.propTypes = {
    icon: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    model: PropTypes.string,
  };

  return (
    <div className="flex items-center gap-2">
      <div className="mr-2 flex items-center gap-2">
        {mainModelConfig && (
          <ModelChip
            icon="Brain"
            label={t('HeaderButtons.mainModel')}
            model={mainModelConfig.model}
          />
        )}
        {optionModelConfig && (
          <ModelChip
            icon="Sparkles"
            label={t('HeaderButtons.optionModel')}
            model={optionModelConfig.model}
          />
        )}
      </div>

      <Tooltip content={t('HeaderButtons.language')}>
        <Button intent="ghost" size="sm" iconOnly onClick={toggleLanguage} aria-label={t('HeaderButtons.language')}>
          <Icon name="Languages" size={18} />
        </Button>
      </Tooltip>

      <Tooltip content={t('HeaderButtons.settings')}>
        <Button
          intent="ghost"
          size="sm"
          iconOnly
          onClick={() => setShowSettings(!showSettings)}
          aria-label={t('HeaderButtons.settings')}
        >
          <Icon name="Settings" size={18} />
        </Button>
      </Tooltip>

      <Tooltip content={t('HeaderButtons.history')}>
        <Button
          intent="ghost"
          size="sm"
          iconOnly
          onClick={() => setShowRightSidebar(!showRightSidebar)}
          aria-label={t('HeaderButtons.history')}
        >
          <Icon name="History" size={18} />
        </Button>
      </Tooltip>

      <Tooltip content={t('HeaderButtons.newChat')}>
        <Button
          intent="ghost"
          size="sm"
          iconOnly
          onClick={() => handleNewChat()}
          aria-label={t('HeaderButtons.newChat')}
        >
          <Icon name="PenLine" size={18} />
        </Button>
      </Tooltip>

      {developerMode && (
        <Tooltip content={t('HeaderButtons.debug')}>
          <button
            type="button"
            onClick={() =>
              typeof toggleDevPanel === 'function'
                ? toggleDevPanel()
                : setShowDebugPanel(!showDebugPanel)
            }
            className={cn(
              'inline-flex h-8 w-8 items-center justify-center rounded-sm',
              'transition-all duration-fast ease-snap',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/30',
              showDebugPanel
                ? 'bg-sage-50 text-sage-700'
                : 'text-ink-500 hover:bg-paper-100 hover:text-ink-700',
            )}
            aria-label={t('HeaderButtons.debug')}
            aria-pressed={showDebugPanel}
          >
            <Icon name="Bug" size={18} className="text-current" />
          </button>
        </Tooltip>
      )}
    </div>
  );
};

HeaderButtons.propTypes = {
  handleNewChat: PropTypes.func.isRequired,
  setShowSettings: PropTypes.func.isRequired,
  showSettings: PropTypes.bool,
  setShowDebugPanel: PropTypes.func,
  showDebugPanel: PropTypes.bool,
  setShowRightSidebar: PropTypes.func.isRequired,
  showRightSidebar: PropTypes.bool,
  developerMode: PropTypes.bool,
  mainModelConfig: PropTypes.shape({ model: PropTypes.string }),
  optionModelConfig: PropTypes.shape({ model: PropTypes.string }),
  handleOptionPromptChange: PropTypes.func,
  handleMainPromptChange: PropTypes.func,
  toggleDevPanel: PropTypes.func,
};

export default HeaderButtons;
