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

// Register service worker only in production (vite build outputs sw.js).
// SW powers offline + push; failure is non-critical and often device-specific
// (Safari private mode, iOS PWA quirks). Catch so it doesn't surface as an
// unhandled promise rejection in Sentry — the app works without the SW.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
    console.warn('[SW] registration failed:', err);
  });
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
