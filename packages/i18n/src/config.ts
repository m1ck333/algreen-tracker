import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import srCommon from './locales/sr/common.json';
import enCommon from './locales/en/common.json';

export type AppResources = Record<string, Record<string, unknown>>;

export function initI18n(
  appNamespace: string,
  appResources: { sr: Record<string, unknown>; en: Record<string, unknown> },
) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        sr: {
          common: srCommon,
          [appNamespace]: appResources.sr,
        },
        en: {
          common: enCommon,
          [appNamespace]: appResources.en,
        },
      },
      defaultNS: appNamespace,
      fallbackNS: 'common',
      fallbackLng: 'sr',
      supportedLngs: ['sr', 'en'],
      interpolation: {
        escapeValue: false,
      },
      detection: {
        order: ['localStorage'],
        lookupLocalStorage: 'i18nextLng',
        caches: ['localStorage'],
      },
    });

  return i18n;
}
