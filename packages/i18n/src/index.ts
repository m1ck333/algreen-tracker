export { initI18n } from './config';
export { useEnumTranslation } from './use-enum-translation';
export { useTranslation, Trans } from 'react-i18next';
// Re-export the i18next instance for code that runs outside React (axios
// interceptors, API client error handlers) and needs to translate at the
// moment of the event rather than via a hook.
export { default as i18n } from 'i18next';
