import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { message } from 'antd';
import { setOnForceLogout, setOnForbidden } from '@algreen/api-client';
import { useAuthStore } from '@algreen/auth';
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
// specific messages; everything else gets the generic line.
setOnForbidden((code) => {
  switch (code) {
    case 'FORBIDDEN_ROLE_ASSIGNMENT':
      message.error('Nemate dozvolu da dodelite ovu ulogu.');
      break;
    default:
      message.error('Vaša uloga nema dozvolu za ovu akciju.');
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary
      fallback={<div style={{ padding: 24 }}>Došlo je do greške. Pokušajte ponovo.</div>}
      showDialog={false}
    >
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
);
