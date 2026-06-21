/// <reference types="vite/client" />

// Minimal ImportMeta.env shim for workspace packages where vite isn't a
// direct dependency. The Vite reference above already satisfies the apps
// (dashboard, tablet) because they install vite locally; packages that
// don't (api-client, auth, signalr-client, shared-types, i18n) need this
// hand-rolled shape so `import.meta.env?.VITE_FOO` type-checks.
//
// Keep the shape narrow — only the env vars our packages actually read.
// New VITE_* additions should land here too.
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SIGNALR_URL?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  readonly VITE_SENTRY_RELEASE?: string;
}

interface ImportMeta {
  readonly env?: ImportMetaEnv;
}
