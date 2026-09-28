import React, { createContext, useContext, useState, useEffect } from 'react';
import { TRANSLATIONS } from './translations';

export type LanguageCode = 
  | 'en' 
  | 'zh-CN' 
  | 'zh-TW' 
  | 'ja' 
  | 'ko' 
  | 'es' 
  | 'fr' 
  | 'de' 
  | 'it' 
  | 'ru' 
  | 'pt-BR' 
  | 'ar';

export interface LanguageInfo {
  code: LanguageCode;
  name: string;
  nativeName: string;
  dir: 'ltr' | 'rtl';
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English (US)', dir: 'ltr' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文', dir: 'ltr' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '繁體中文', dir: 'ltr' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', dir: 'ltr' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', dir: 'ltr' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', dir: 'ltr' },
  { code: 'fr', name: 'French', nativeName: 'Français', dir: 'ltr' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', dir: 'ltr' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', dir: 'ltr' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', dir: 'ltr' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)', dir: 'ltr' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية (Tajawal)', dir: 'rtl' },
];

export { TRANSLATIONS };

interface I18nContextType {
  lang: LanguageCode;
  setLang: (lang: LanguageCode) => void;
  t: (key: string, fallback?: string) => string;
  isRTL: boolean;
  languages: LanguageInfo[];
}

const I18nContext = createContext<I18nContextType>({
  lang: 'en',
  setLang: () => {},
  t: (key, fallback) => fallback || key,
  isRTL: false,
  languages: SUPPORTED_LANGUAGES,
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<LanguageCode>(() => {
    try {
      const saved = localStorage.getItem('llsm_language') as LanguageCode;
      if (saved && TRANSLATIONS[saved]) {
        return saved;
      }
    } catch (e) {
      // fallback
    }
    return 'en';
  });

  const isRTL = lang === 'ar';

  useEffect(() => {
    try {
      localStorage.setItem('llsm_language', lang);
    } catch (e) {
      // ignore
    }

    document.documentElement.lang = lang;
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';

    if (lang === 'ar') {
      document.body.classList.add('lang-ar');
    } else {
      document.body.classList.remove('lang-ar');
    }
  }, [lang, isRTL]);

  const setLang = (newLang: LanguageCode) => {
    if (TRANSLATIONS[newLang]) {
      setLangState(newLang);
    }
  };

  const t = (key: string, fallback?: string): string => {
    const dict = TRANSLATIONS[lang];
    if (dict && dict[key]) {
      return dict[key];
    }
    const enDict = TRANSLATIONS.en;
    if (enDict && enDict[key]) {
      return enDict[key];
    }
    return fallback || key;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t, isRTL, languages: SUPPORTED_LANGUAGES }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);

export const getStoredTranslation = (key: string, fallback?: string): string => {
  try {
    const saved = (typeof localStorage !== 'undefined' ? localStorage.getItem('llsm_language') : null) as LanguageCode | null;
    if (saved && TRANSLATIONS[saved] && TRANSLATIONS[saved][key]) {
      return TRANSLATIONS[saved][key];
    }
  } catch (e) {
    // fallback
  }
  if (TRANSLATIONS.en && TRANSLATIONS.en[key]) {
    return TRANSLATIONS.en[key];
  }
  return fallback || key;
};
