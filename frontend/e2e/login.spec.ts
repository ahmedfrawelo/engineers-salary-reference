import { test, expect } from '@playwright/test';

/**
 * Login Flow E2E Tests
 */
test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#email')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#password')).toBeVisible({ timeout: 15000 });
  });

  test('should display login form', async ({ page }) => {
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should allow submit once form is valid', async ({ page }) => {
    const submit = page.locator('button[type="submit"]');
    await expect(submit).toBeEnabled();

    await page.fill('input[type="email"]', 'admin@engineers-salary-reference.sa');
    await page.fill('input[type="password"]', 'password');
    await expect(submit).toBeEnabled();
  });

  test('should toggle remember me state', async ({ page }) => {
    const chip = page.getByRole('button', { name: /remember me/i });
    await expect(chip).toBeVisible({ timeout: 10000 });
    await expect(chip).toHaveClass(/active/);

    await chip.click();
    await expect(chip).not.toHaveClass(/active/);
  });

  test('should toggle password visibility', async ({ page }) => {
    const password = page.locator('#password');
    const eye = page.getByRole('button', { name: /show password|hide password/i }).first();

    await expect(password).toBeVisible({ timeout: 10000 });
    await expect(password).toHaveAttribute('type', 'password');
    await eye.click();
    await expect(password).toHaveAttribute('type', 'text');
    await eye.click();
    await expect(password).toHaveAttribute('type', 'password');
  });
});
