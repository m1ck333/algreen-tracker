import * as Sentry from '@sentry/react';

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    // No DSN = SDK is disabled. Matches the backend pattern so dev runs
    // without sending anything to Sentry.
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? 'development',
    release: import.meta.env.VITE_SENTRY_RELEASE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 1.0,
    beforeSend(event) {
      if (event.breadcrumbs) {
        event.breadcrumbs.forEach((bc) => {
          if (bc.data && typeof bc.data === 'object') {
            const data = bc.data as Record<string, unknown>;
            if (data.Authorization) data.Authorization = '[Filtered]';
            if (data.Cookie) data.Cookie = '[Filtered]';
          }
        });
      }
      return event;
    },
  });
}
