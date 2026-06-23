import { defineConfig, devices } from '@playwright/test';

// Golden-path E2E tests for the dashboard AND tablet. Each test assumes
// a running stack:
//   - BE at http://localhost:5030 (or PLAYWRIGHT_BASE_API)
//   - Dashboard at http://localhost:5941 (or PLAYWRIGHT_BASE_URL)
//   - Tablet PWA at http://localhost:5942 (or PLAYWRIGHT_TABLET_URL)
//
// Tests live in e2e/ at the repo root. Files prefixed `tablet-` run
// against the tablet PWA via a Pixel-5 device profile; everything else
// runs against the dashboard via Desktop Chrome. Run with `pnpm e2e`.

const DASHBOARD_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5941';
const TABLET_URL = process.env.PLAYWRIGHT_TABLET_URL ?? 'http://localhost:5942';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  // Cap parallelism so localhost doesn't get hammered by concurrent
  // logins (each login mutates the rate-limit counter).
  workers: process.env.CI ? 1 : 2,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'dashboard',
      // Skip tablet-* specs in the dashboard project so they don't run
      // against the wrong origin.
      testIgnore: /tablet-.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: DASHBOARD_URL,
      },
    },
    {
      name: 'tablet',
      // Only run tablet-* specs in this project. Pixel 5 viewport is a
      // representative factory-tablet size; the PWA layout assumes the
      // device is roughly a tablet/large-phone form factor.
      testMatch: /tablet-.*\.spec\.ts$/,
      use: {
        ...devices['Pixel 5'],
        baseURL: TABLET_URL,
      },
    },
  ],
});
