// src/i18n.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// 引入自己创建的翻译资源
import translationEN from './locales/en/translation.json';
import translationZH from './locales/zh/translation.json';

const resources = {
  en: {
    translation: translationEN
  },
  zh: {
    translation: translationZH
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'zh',          // 默认语言，可改为 'en' 或做动态设置
    fallbackLng: 'zh',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;