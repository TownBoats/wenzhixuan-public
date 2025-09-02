import React from 'react';
import UserInput from '../UserInput/UserInput';
import QuickPrompts from '../QuickPrompts/QuickPrompts';
import { useTranslation } from 'react-i18next';
const WelcomeScreen = ({
  inputText,
  setInputText,
  handleSendMessage,
  isLoading,
  showQuickPrompts,
  handleQuickPromptSelect
}) => {
  const { t } = useTranslation();
  return (
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
  );
};

export default WelcomeScreen; 