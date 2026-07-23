import { test, expect, type Page } from '@playwright/test';

const wrap = <T>(data: T, message = 'ok') => ({
  success: true,
  statusCode: 200,
  message,
  data,
  errors: []
});

type SessionOptions = {
  roles?: string[];
  permissions?: string[];
};

async function installSession(page: Page, options: SessionOptions): Promise<void> {
  const roles = options.roles ?? [];
  const permissions = options.permissions ?? [];
  await page.addInitScript(
    ({ sessionRoles, sessionPermissions }) => {
      const session = {
        tokens: {
          accessToken: 'e2e-token',
          refreshToken: 'e2e-refresh-token',
          expiresAt: Date.now() + 60 * 60 * 1000
        },
        user: {
          id: 'e2e-user',
          name: 'E2E User',
          email: 'e2e@engineers-salary-reference.sa',
          roles: sessionRoles,
          permissions: sessionPermissions
        }
      };
      const serialized = JSON.stringify(session);
      window.localStorage.setItem('engineers-salary-reference.portal.session', serialized);
      window.sessionStorage.setItem('engineers-salary-reference.portal.session', serialized);
    },
    { sessionRoles: roles, sessionPermissions: permissions }
  );
}

async function installApiMocks(page: Page, options: SessionOptions): Promise<void> {
  const roles = options.roles ?? [];
  const permissions = options.permissions ?? [];

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
        body: JSON.stringify(
          wrap({
            id: 'e2e-user',
            name: 'E2E User',
            email: 'e2e@engineers-salary-reference.sa',
            roles,
            permissions
          })
        )
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(wrap({}))
    });
  });

  await page.route('**/api/**', async route => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const path = new URL(request.url()).pathname.toLowerCase();

    if (path.endsWith('/api/users') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wrap([]))
      });
      return;
    }

    if (path.endsWith('/api/roles') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wrap([]))
      });
      return;
    }

    if (path.endsWith('/api/roles/permissions-tree') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wrap([]))
      });
      return;
    }

    if (path.endsWith('/api/tender-suppliers/bootstrap') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          wrap({
            suppliers: {
              items: [],
              totalCount: 0,
              pageNumber: 1,
              pageSize: 100,
              totalPages: 0,
              hasPreviousPage: false,
              hasNextPage: false
            },
            countries: [],
            materialCategories: [],
            brands: [],
            loadedAt: new Date().toISOString()
          })
        )
      });
      return;
    }

    if (path.endsWith('/api/tender-suppliers') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          wrap({
            items: [],
            totalCount: 0,
            pageNumber: 1,
            pageSize: 100,
            totalPages: 0,
            hasPreviousPage: false,
            hasNextPage: false
          })
        )
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(wrap(method === 'GET' ? [] : null))
    });
  });
}

async function bootWithPermissions(page: Page, options: SessionOptions): Promise<void> {
  await installSession(page, options);
  await installApiMocks(page, options);
}

test.describe('Authorization UI', () => {
  test('suppliers view-only session hides add action', async ({ page }) => {
    await bootWithPermissions(page, {
      permissions: ['tender.suppliers.view']
    });

    await page.goto('/tender/suppliers');
    await expect(page).toHaveURL(/\/tender\/suppliers$/);
    await expect(page.getByRole('toolbar', { name: 'Suppliers page actions' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add New Supplier' })).toHaveCount(0);
  });

  test('suppliers create-capable session shows add action', async ({ page }) => {
    await bootWithPermissions(page, {
      permissions: [
        'tender.suppliers.view',
        'Permissions.Supplier.Create'
      ]
    });

    await page.goto('/tender/suppliers');
    await expect(page).toHaveURL(/\/tender\/suppliers$/);
    await expect(page.getByRole('button', { name: 'Add New Supplier' })).toBeVisible();
  });

  test('access control view-only session hides permissions workspace tab', async ({ page }) => {
    await bootWithPermissions(page, {
      permissions: ['settings.access_control.view']
    });

    await page.goto('/settings/access-control');
    await expect(page).toHaveURL(/\/settings\/access-control$/);
    await expect(page.getByRole('tab', { name: 'Profile status' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Permissions' })).toHaveCount(0);
  });

  test('access control manager session shows permissions workspace tab', async ({ page }) => {
    await bootWithPermissions(page, {
      permissions: ['Permissions.Identity.ManagePermissions']
    });

    await page.goto('/settings/access-control');
    await expect(page).toHaveURL(/\/settings\/access-control$/);
    await expect(page.getByRole('tab', { name: 'Permissions' })).toBeVisible();
  });
});
