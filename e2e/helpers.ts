import type { Page } from '@playwright/test';

// Single source of truth for login defaults so individual specs don't drift.
// Override per test via E2E_* env vars when running against an environment
// where admin@demo.com has a non-bootstrap password.
export const TEST_TENANT = process.env.E2E_TENANT_CODE ?? 'DEMO';
export const TEST_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@demo.com';
export const TEST_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'Admin123!';

/**
 * Log in as the test admin and wait until the redirect off /login has
 * happened. Throws if login doesn't succeed within 10s — usually means
 * the password env override is missing or the account is locked.
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByPlaceholder(/email/i).fill(TEST_EMAIL);
  await page.getByPlaceholder(/lozinka|password/i).fill(TEST_PASSWORD);
  await page.getByPlaceholder(/firme|tenant|kod/i).fill(TEST_TENANT);
  await page.getByRole('button', { name: /prijav|sign in|login/i }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 10_000 });
}
