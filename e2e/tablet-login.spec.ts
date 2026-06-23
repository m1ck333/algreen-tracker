import { test, expect } from '@playwright/test';
import { TEST_EMAIL, TEST_PASSWORD, TEST_TENANT } from './helpers';

// Tablet PWA — smoke coverage. Until today the tablet had ZERO automated
// tests of any kind (Vitest, Playwright, etc.). These specs prove the
// PWA boots on a mobile-form-factor viewport, the login form renders
// without an error boundary, and a known-good credential pair reaches
// the post-login route. They are deliberately minimal — we want a
// regression net for "tablet completely broken", not exhaustive coverage
// of every flow. Worker-specific paths (start process / complete process)
// need fixture data (worker with process assignments + shift) and can
// be added later when there's a seeded test worker.

test.describe('tablet PWA — boot + login smoke', () => {
  test('login page renders the MPMS form on tablet viewport', async ({ page }) => {
    await page.goto('/login');

    // MPMS logo (rendered by an explicit <img>); a missing PWA asset
    // pipeline (vite-plugin-pwa misconfigured) typically breaks this.
    await expect(page.locator('img[alt="MPMS"]')).toBeVisible({ timeout: 10_000 });

    // Three labelled inputs + a submit button. Locators are loose
    // (regex-matched on the visible label text) so an i18n translation
    // tweak doesn't break the test.
    await expect(page.locator('input[type="text"]').first()).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /prijav|sign in|login/i })).toBeVisible();
  });

  test('valid credentials redirect off /login', async ({ page }) => {
    // Uses the same DEMO tenant + admin creds the dashboard specs use.
    // The tablet doesn't have a role gate at login — admin can sign in
    // even without a Department-role assignment; the worker-specific
    // path (queue + active work) just renders empty in that case.
    await page.goto('/login');
    await page.locator('input[type="text"]').first().fill(TEST_TENANT);
    await page.locator('input[type="email"]').fill(TEST_EMAIL);
    await page.locator('input[type="password"]').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /prijav|sign in|login/i }).click();

    // TabletLoginPage navigates to /queue on success. If auth failed
    // we'd stay on /login with an error banner.
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 10_000 });
  });
});
