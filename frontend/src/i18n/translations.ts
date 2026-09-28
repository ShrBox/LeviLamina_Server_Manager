import { en } from './locales/en';
import { ar } from './locales/ar';
import { zhCN } from './locales/zh-CN';
import { zhTW } from './locales/zh-TW';
import { ja } from './locales/ja';
import { ko } from './locales/ko';
import { es } from './locales/es';
import { fr } from './locales/fr';
import { de } from './locales/de';
import { it } from './locales/it';
import { ru } from './locales/ru';
import { ptBR } from './locales/pt-BR';
import { LanguageCode } from './index';

export const TRANSLATIONS: Record<LanguageCode, Record<string, string>> = {
  en,
  ar,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  ja,
  ko,
  es,
  fr,
  de,
  it,
  ru,
  'pt-BR': ptBR,
};

export { useI18n, getStoredTranslation } from './index';
