import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { sentryVitePlugin } from '@sentry/vite-plugin';

// Upload source maps to Sentry so production error stack traces are readable
// (not minified). Only active when SENTRY_AUTH_TOKEN is set — i.e. during
// deploy; local/CI builds without the token skip upload entirely.
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;

export default defineConfig({
  build: {
    // 'hidden' emits source maps without a sourceMappingURL comment, so they
    // aren't referenced/served publicly; the Sentry plugin uploads then deletes
    // them (filesToDeleteAfterUpload). Off entirely when not uploading.
    sourcemap: sentryAuthToken ? 'hidden' : false,
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.png', 'mpms-logo.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'MPMS - Tablet',
        short_name: 'MPMS',
        description: 'Factory floor tablet app for MPMS',
        theme_color: '#1677ff',
        background_color: '#f5f5f5',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
      devOptions: {
        enabled: false,
      },
    }),
    // Keep the Sentry plugin LAST so it sees the final emitted bundle.
    ...(sentryAuthToken
      ? [
          sentryVitePlugin({
            org: 'sky-hard',
            project: 'mes-api',
            authToken: sentryAuthToken,
            // Region (de.sentry.io) + org are embedded in the org auth token.
            release: { name: process.env.VITE_SENTRY_RELEASE },
            sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.js.map'] },
            telemetry: false,
          }),
        ]
      : []),
  ],
  server: {
    port: 5942,
  },
});
