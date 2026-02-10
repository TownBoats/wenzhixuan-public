import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import UserInput from '../UserInput/UserInput';
import QuickPrompts from '../QuickPrompts/QuickPrompts';
import { useTranslation } from 'react-i18next';
const WelcomeScreen = ({
  inputText,
  setInputText,
  handleSendMessage,
  isLoading,
  showQuickPrompts,
  handleQuickPromptSelect,
  onOpenSettings
}) => {
  const { t } = useTranslation();
  const [showSetupGuideModal, setShowSetupGuideModal] = useState(true);
  const setupGuideTitle = t('WelcomeScreen.setupGuideTitle', {
    defaultValue: '\u4f7f\u7528\u63d0\u793a'
  });
  const setupGuide = t('WelcomeScreen.setupGuide', {
    defaultValue: '\u9996\u6b21\u4f7f\u7528\u8bf7\u5148\u5728\u8bbe\u7f6e\u4e2d\u6dfb\u52a0\u81ea\u5b9a\u4e49 API \u548c\u6a21\u578b\uff08\u6a21\u578b\u9875\uff09\u3002'
  });
  const openSettings = t('WelcomeScreen.openSettings', {
    defaultValue: '\u6253\u5f00\u8bbe\u7f6e'
  });
  const closeGuide = t('WelcomeScreen.closeGuide', {
    defaultValue: '\u7a0d\u540e\u518d\u8bf4'
  });
  const setupGuideSub = t('WelcomeScreen.setupGuideSub', {
    defaultValue: '\u4ec5\u9700\u4e00\u6b65\u914d\u7f6e\uff0c\u5373\u53ef\u5f00\u59cb\u5bf9\u8bdd\u3002'
  });

  const handleOpenSettings = () => {
    if (onOpenSettings) {
      onOpenSettings();
    }
    setShowSetupGuideModal(false);
  };

  useEffect(() => {
    if (!showSetupGuideModal) return;
    const onKeydown = (event) => {
      if (event.key === 'Escape') {
        setShowSetupGuideModal(false);
      }
    };
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, [showSetupGuideModal]);

  const setupGuideModal = showSetupGuideModal && typeof document !== 'undefined'
    ? createPortal(
      <div className="fixed inset-0 z-[1200] flex items-start justify-center px-4 pt-20">
        <button
          type="button"
          aria-label="Close guide"
          className="absolute inset-0 bg-slate-900/10 backdrop-blur-[1px]"
          onClick={() => setShowSetupGuideModal(false)}
        />
        <div
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-lg rounded-3xl border border-white/60 bg-white/90 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-md"
        >
          <div className="mb-2 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
            {setupGuideTitle}
          </div>
          <p className="text-base text-slate-900">{setupGuide}</p>
          <p className="mt-2 text-sm text-slate-600">{setupGuideSub}</p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowSetupGuideModal(false)}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {closeGuide}
            </button>
            <button
              type="button"
              onClick={handleOpenSettings}
              className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
            >
              {openSettings}
            </button>
          </div>
        </div>
      </div>,
      document.body
    )
    : null;

  return (
    <>
      {setupGuideModal}
      <div className="w-full max-w-2xl mx-auto px-4 space-y-8 transform transition-all duration-500">
      <div className="text-center">
        <h1 className="text-2xl font-medium text-slate-800 mb-4">
          {t('WelcomeScreen.welcome')}
          <span className="font-bold">{t('WelcomeScreen.title')}</span>
        </h1>
        <p className="text-slate-600">
          {t('WelcomeScreen.description')}
        </p>
      </div>
      
      <div className="transition-all duration-500">
        <UserInput
          inputText={inputText}
          setInputText={setInputText}
          handleSendMessage={handleSendMessage}
          isLoading={isLoading}
          centered={true}
        />
      </div>
      
      {showQuickPrompts && (
        <div className="mt-8 transition-all duration-300">
          <h2 className="text-lg font-medium text-center mb-4 text-slate-700">
            {t('WelcomeScreen.quickStart')}
          </h2>
          <QuickPrompts 
            onSelect={handleQuickPromptSelect}
          />
        </div>
      )}
      </div>
    </>
  );
};

export default WelcomeScreen; 
