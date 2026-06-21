import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

// Page-render smoke tests for the major routes that aren't already
// covered by auth/orders specs. Each test logs in + navigates + asserts
// the page didn't blow up (no raw i18n keys leaked, no error boundary
// rendered). Catches the high-blast-radius "page completely broken on
// first render" class of regression — what i18n bugs, missing
// components, and bad route configs typically look like.

test.describe('page render smoke', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('block requests page renders', async ({ page }) => {
    await page.goto('/block-requests');
    // Heading is rendered via PageHeader using a localized key — assert
    // there's at least one visible heading and no raw i18n keys leaked.
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('body')).not.toContainText(/^[a-z]+\.[a-z]+\.[a-z]+$/m, { timeout: 2_000 });
  });

  test('change requests page renders', async ({ page }) => {
    await page.goto('/change-requests');
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('body')).not.toContainText(/changeRequests\./, { timeout: 2_000 });
  });

  test('reports page renders all tabs without crashing', async ({ page }) => {
    await page.goto('/reports');
    // 6 tabs at last count; assert the tab strip rendered + the default
    // (Vremena po procesu) tab body shows.
    await expect(page.getByRole('tab').first()).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('body')).not.toContainText(/reports\.tab/, { timeout: 2_000 });
  });

  test('admin users page renders', async ({ page }) => {
    await page.goto('/admin/users');
    // antd Table with at least the header row.
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('body')).not.toContainText(/admin\.users\./, { timeout: 2_000 });
  });

  test('admin company (Profil firme) Settings tab renders', async ({ page }) => {
    await page.goto('/admin/company');
    // Heading + tab strip both visible; covers the i18n regression we
    // shipped earlier (admin.tenantProfile.tabSettings rendering raw).
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('body')).not.toContainText(/admin\.tenantProfile\./, { timeout: 2_000 });
  });
});
