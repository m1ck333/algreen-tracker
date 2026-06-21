import { test, expect } from '@playwright/test';

// Login + post-auth redirect golden path. If this breaks, the entire app
// is unreachable for new sessions — highest-blast-radius single test we
// can write.

const TEST_TENANT = process.env.E2E_TENANT_CODE ?? 'DEMO';
const TEST_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@demo.com';
const TEST_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'Admin123!';

test.describe('auth', () => {
  test('unauthenticated user is redirected to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('valid credentials sign in and land on the role default page', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder(/email/i).fill(TEST_EMAIL);
    await page.getByPlaceholder(/lozinka|password/i).fill(TEST_PASSWORD);
    await page.getByPlaceholder(/firme|tenant|kod/i).fill(TEST_TENANT);
    await page.getByRole('button', { name: /prijav|sign in|login/i }).click();

    // After login the role redirector lands the Admin on /dashboard or
    // /orders depending on role. Either is fine — what we're verifying
    // is that we left /login and the app shell rendered.
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });
    // App shell renders the sidebar with the Orders menu item — using a
    // role+name lookup so it doesn't collide with role text elsewhere.
    await expect(page.getByRole('menuitem', { name: /orders|narudžbine/i })).toBeVisible({ timeout: 10_000 });
  });

  test('invalid credentials surface the error toast', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder(/email/i).fill(TEST_EMAIL);
    await page.getByPlaceholder(/lozinka|password/i).fill('wrong-password');
    await page.getByPlaceholder(/firme|tenant|kod/i).fill(TEST_TENANT);
    await page.getByRole('button', { name: /prijav|sign in|login/i }).click();

    // antd Message renders as a top-of-viewport toast.
    await expect(page.getByText(/pogreš|invalid|wrong/i)).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/login/);
  });
});
