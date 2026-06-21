import { useTranslation } from '@alblue/i18n';

// Lives in its own file so main.tsx can stay non-component (initSentry,
// setOnForceLogout, ReactDOM.createRoot). react-refresh requires every
// component to be in a module that exports only components — co-locating
// it with the boot script breaks Fast Refresh in dev.
export function BootErrorFallback() {
  const { t } = useTranslation('tablet');
  return <div style={{ padding: 24 }}>{t('errorBoundary.bootFallback')}</div>;
}
