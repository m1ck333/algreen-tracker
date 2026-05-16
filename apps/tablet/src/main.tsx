import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { setOnForceLogout } from '@algreen/api-client';
import { useAuthStore } from '@algreen/auth';
import './i18n';
import { App } from './App';
import './styles/index.css';
import { initSentry } from './sentry';

initSentry();

setOnForceLogout(() => useAuthStore.getState().logout());

// Register service worker only in production (vite build outputs sw.js)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary
      fallback={<div style={{ padding: 24 }}>Došlo je do greške. Pokušajte ponovo.</div>}
      showDialog={false}
    >
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
);
