import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { message } from 'antd';
import { i18n, useTranslation } from '@alblue/i18n';
import { setOnForceLogout, setOnForbidden } from '@alblue/api-client';
import { useAuthStore } from '@alblue/auth';
import './i18n';
import './styles/global.css';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initSentry } from './sentry';

initSentry();

setOnForceLogout(() => useAuthStore.getState().logout());

// 403 fallback toast. The FE hides actions users can't perform via
// RequireRole/canManage predicates; this is the safety net for cases
// the FE can't catch (race, stale session, programmatic call, BE-only
// guards like self-demotion). Specific error codes from the BE map to
// specific messages; everything else gets the generic line. i18n.t
// resolves at call time, so the toast follows the active locale.
const FORBIDDEN_MESSAGE_KEY: Record<string, string> = {
  FORBIDDEN_ROLE_ASSIGNMENT: 'errors.forbiddenRoleChange',
  FORBIDDEN_ROLE_CHANGE: 'errors.forbiddenRoleChange',
  LAST_ADMIN_REMOVAL: 'errors.lastAdminRemoval',
  SELF_DELETE_FORBIDDEN: 'errors.selfDeleteForbidden',
  FORBIDDEN_SUPERADMIN_DELETE: 'errors.superAdminDeleteForbidden',
  CHANGE_PASSWORD_NOT_SELF: 'errors.changePasswordNotSelf',
};
setOnForbidden((code) => {
  // If the code already has a per-form translation in common:errors, the
  // page-level mutation onError will surface it via getTranslatedError —
  // staying silent here prevents the duplicate toast (Milos 15.06.2026,
  // two stacked toasts for READ_ONLY_CROSS_TENANT in different locales).
  if (code && i18n.t(`common:errors.${code}`, { defaultValue: '' })) {
    return;
  }
  const key = (code && FORBIDDEN_MESSAGE_KEY[code]) ?? 'errors.forbiddenGeneric';
  message.error(i18n.t(key));
});

// Sentry's fallback prop is a React element, not a render function — making
// it a real component lets useTranslation react to language changes.
function BootErrorFallback() {
  const { t } = useTranslation();
  return <div style={{ padding: 24 }}>{t('errorBoundary.bootFallback')}</div>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary
      fallback={<BootErrorFallback />}
      showDialog={false}
    >
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
);
