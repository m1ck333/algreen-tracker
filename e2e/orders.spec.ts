import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

// Order listing is the central page of the app — every coordinator/admin
// lands here multiple times per shift. This test verifies the master
// table reaches the network and renders, which exercises:
//   - JWT auth + tenant filter on /api/orders
//   - SignalR connection (optional — not asserted)
//   - antd Table render against PagedResult<T>

test('order list page loads', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/orders');

  // The page header is the most stable anchor — it's localized via
  // common:labels.orders or similar and present even on empty data.
  await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 5_000 });

  // antd Table renders a <table> with at least the header row.
  await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 });
});

test('admin can open Profil firme → Naplata tab', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/firma?tab=billing');

  // The Naplata tab card with the subscription summary should render.
  // We're not asserting specific content (depends on tenant payment
  // state) — just that the page didn't blow up.
  await expect(page.locator('body')).not.toContainText('admin.tenantProfile.', { timeout: 5_000 });
});
