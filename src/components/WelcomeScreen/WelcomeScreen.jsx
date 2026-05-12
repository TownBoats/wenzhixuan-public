import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import UserInput from '../UserInput/UserInput';
import QuickPrompts from '../QuickPrompts/QuickPrompts';
import { Button, BrandLogo, Key, cn } from '@/components/ui';

const SETUP_GUIDE_DISMISSED_KEY = 'welcome_setup_guide_dismissed';

/**
 * WelcomeScreen — 首屏欢迎面板（P3h Susan Kare 重设计版）
 *
 * 视觉迁移自旧版：
 *   - 标题 text-2xl + slate                → display 28/36 衬线 + ink-900
 *   - "欢迎来到 问知轩" + 描述                 → BrandLogo(happy) +
 *                                            "你好，我是问知" 副标题
 *   - 旧 setup guide modal:
 *       white/90 + amber pill badge         → paper-50 + sun-300 badge + Key icon
 *       slate-300/slate-900 buttons         → ui Button(secondary/primary)
 *
 * 行为完全一致：localStorage 引导关闭 / Esc 关闭 / 已配置自动隐藏。
 */
const WelcomeScreen = ({
  inputText,
  setInputText,
  handleSendMessage,
  isLoading,
  showQuickPrompts,
  handleQuickPromptSelect,
  onOpenSettings,
  isModelConfigured = false,
}) => {
  const { t } = useTranslation();

  const [showSetupGuideModal, setShowSetupGuideModal] = useState(() => {
    if (typeof window === 'undefined') return false;
    const dismissed = window.localStorage.getItem(SETUP_GUIDE_DISMISSED_KEY) === 'true';
    return !isModelConfigured && !dismissed;
  });

  const setupGuideTitle = t('WelcomeScreen.setupGuideTitle', { defaultValue: '使用提示' });
  const setupGuide = t('WelcomeScreen.setupGuide', {
    defaultValue: '在我们聊天前，先去设置里把你的 API Key 给我看一眼。它只会存在你的浏览器里。',
  });
  const openSettings = t('WelcomeScreen.openSettings', { defaultValue: '去设置' });
  const closeGuide = t('WelcomeScreen.closeGuide', { defaultValue: '稍后再说' });
  const setupGuideSub = t('WelcomeScreen.setupGuideSub', {
    defaultValue: '一步配置即可开始对话。',
  });

  const dismissSetupGuide = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SETUP_GUIDE_DISMISSED_KEY, 'true');
    }
    setShowSetupGuideModal(false);
  };

  const handleOpenSettings = () => {
    if (onOpenSettings) onOpenSettings();
    dismissSetupGuide();
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isModelConfigured) {
      setShowSetupGuideModal(false);
      return;
    }
    const dismissed = window.localStorage.getItem(SETUP_GUIDE_DISMISSED_KEY) === 'true';
    setShowSetupGuideModal(!dismissed);
  }, [isModelConfigured]);

  useEffect(() => {
    if (!showSetupGuideModal) return;
    const onKeydown = (event) => {
      if (event.key === 'Escape') dismissSetupGuide();
    };
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, [showSetupGuideModal]);

  const setupGuideModal =
    showSetupGuideModal && typeof document !== 'undefined'
      ? createPortal(
          <div className="fixed inset-0 z-[1200] flex items-start justify-center px-4 pt-20">
            <button
              type="button"
              aria-label="Close guide"
              className="absolute inset-0 bg-ink-900/15 backdrop-blur-sm"
              onClick={dismissSetupGuide}
            />
            <div
              role="dialog"
              aria-modal="true"
              className={cn(
                'relative w-full max-w-lg rounded-lg border border-paper-200',
                'bg-paper-50 p-6 shadow-float backdrop-blur-md',
              )}
            >
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-pill bg-sun-300/40 px-2.5 py-1 text-caption font-medium text-sun-700">
                <Key size={12} className="text-current" />
                {setupGuideTitle}
              </div>
              <p className="text-body font-serif text-ink-900">{setupGuide}</p>
              <p className="mt-2 text-small font-serif text-ink-500">{setupGuideSub}</p>
              <div className="mt-5 flex justify-end gap-2">
                <Button intent="secondary" size="sm" onClick={dismissSetupGuide}>
                  {closeGuide}
                </Button>
                <Button intent="primary" size="sm" onClick={handleOpenSettings}>
                  {openSettings}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {setupGuideModal}
      <div className="mx-auto w-full max-w-2xl space-y-8 px-4 transition-all duration-slow ease-soft">
        <div className="flex flex-col items-center text-center">
          <BrandLogo size={64} expression="happy" className="mb-4" />
          <h1 className="text-display font-display text-ink-900">
            {t('WelcomeScreen.welcome')}
            <span className="font-bold">{t('WelcomeScreen.title')}</span>
          </h1>
          <p className="mt-2 text-body font-serif text-ink-500">
            {t('WelcomeScreen.description')}
          </p>
        </div>

        <div className="transition-all duration-slow ease-soft">
          <UserInput
            inputText={inputText}
            setInputText={setInputText}
            handleSendMessage={handleSendMessage}
            isLoading={isLoading}
            centered={true}
          />
        </div>

        {showQuickPrompts && (
          <div className="mt-8 transition-all duration-base ease-soft">
            <h2 className="mb-4 text-center text-h2 font-serif text-ink-700">
              {t('WelcomeScreen.quickStart')}
            </h2>
            <QuickPrompts onSelect={handleQuickPromptSelect} />
          </div>
        )}

        <p className="pt-2 text-center text-caption font-mono text-ink-300">
          你的对话只保存在浏览器里。
        </p>
      </div>
    </>
  );
};

WelcomeScreen.propTypes = {
  inputText: PropTypes.string.isRequired,
  setInputText: PropTypes.func.isRequired,
  handleSendMessage: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
  showQuickPrompts: PropTypes.bool,
  handleQuickPromptSelect: PropTypes.func,
  onOpenSettings: PropTypes.func,
  isModelConfigured: PropTypes.bool,
};

export default WelcomeScreen;
