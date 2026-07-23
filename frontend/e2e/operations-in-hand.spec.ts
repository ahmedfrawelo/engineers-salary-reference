import { test, expect, type Page } from '@playwright/test';

const installAuth = async (page: Page) => {
  await page.addInitScript(() => {
    const expiresAt = Date.now() + 60 * 60 * 1000;
    const session = {
      tokens: {
        accessToken: 'e2e-token',
        refreshToken: 'e2e-refresh-token',
        expiresAt
      },
      user: {
        id: 'e2e-user',
        name: 'E2E User',
        email: 'e2e@engineers-salary-reference.sa',
        permissions: ['*']
      }
    };
    const serialized = JSON.stringify(session);
    window.localStorage.setItem('engineers-salary-reference.portal.session', serialized);
    window.sessionStorage.setItem('engineers-salary-reference.portal.session', serialized);
  });

  await page.route(/.*\/auth\/.*/i, async route => {
    const path = new URL(route.request().url()).pathname.toLowerCase();
    if (path.includes('/refresh')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'e2e-token',
          refreshToken: 'e2e-refresh-token',
          expiresAt: Date.now() + 60 * 60 * 1000,
          expiresIn: 3600,
          tokenType: 'Bearer'
        })
      });
      return;
    }

    if (path.includes('/me')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'e2e-user',
          name: 'E2E User',
          email: 'e2e@engineers-salary-reference.sa',
          permissions: ['*']
        })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({})
    });
  });
};

const installEmptyApiMock = async (page: Page) => {
  await page.route('**/api/**', async route => {
    const payload = route.request().method() === 'GET' ? [] : null;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        statusCode: 200,
        message: 'ok',
        data: payload,
        errors: []
      })
    });
  });
};

const expectPageReady = async (page: Page, path: string, heading: string, marker: string) => {
  await page.goto(path);
  await expect(page).toHaveURL(new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(marker, { exact: true })).toBeVisible();
};

test.describe('Operations and In-Hand routes', () => {
  test.beforeEach(async ({ page }) => {
    await installAuth(page);
    await installEmptyApiMock(page);
  });

  test('should open the new in-hand workspaces', async ({ page }) => {
    await expectPageReady(page, '/in-hand/daily/site-diary', 'Site Diary', 'Shift log');
    await expectPageReady(page, '/in-hand/cost/variations', 'Variations', 'Variation register');
    await expectPageReady(page, '/in-hand/meetings/mom', 'Minutes of Meeting', 'Meeting log');
  });

  test('should open the operations workspaces and keep the legacy alias working', async ({
    page
  }) => {
    await expectPageReady(page, '/operations/billing', 'Billing', 'Billing register');
    await expectPageReady(page, '/operations/hse', 'HSE', 'Observation board');
    await expectPageReady(page, '/operations/analytics', 'Analytics', 'Workspace delivery score');

    await page.goto('/qaqc');
    await expect(page).toHaveURL(/\/operations\/hse$/);
    await expect(page.getByRole('heading', { name: 'HSE' })).toBeVisible({ timeout: 30000 });
  });
});
