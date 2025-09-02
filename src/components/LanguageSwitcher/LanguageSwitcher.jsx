import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();

  const handleLanguageChange = (lng) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div>
      <button onClick={() => handleLanguageChange('zh')}>中文</button>
      <button onClick={() => handleLanguageChange('en')}>English</button>
    </div>
  );
};

export default LanguageSwitcher;