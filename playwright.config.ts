import { defineConfig, devices } from '@playwright/test';

// Golden-path E2E tests for the dashboard. Each test assumes a running
// stack:
//   - BE at http://localhost:5030 (or PLAYWRIGHT_BASE_API)
//   - Dashboard at http://localhost:5941 (or PLAYWRIGHT_BASE_URL)
// In CI we'll point them at the staging URLs once the workflow is wired.
//
// Tests live in e2e/ at the repo root. Run with `pnpm e2e`.

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5941';

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
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
