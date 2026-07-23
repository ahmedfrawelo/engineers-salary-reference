import { expect, test, type Page } from '@playwright/test';

const wrap = <T>(data: T) => ({
  success: true,
  statusCode: 200,
  message: 'ok',
  data,
  errors: []
});

const paginate = <T>(items: T[], pageNumber: number, pageSize: number) => {
  const safePageNumber = Math.max(1, pageNumber || 1);
  const safePageSize = Math.max(1, pageSize || 1);
  const start = (safePageNumber - 1) * safePageSize;
  const pagedItems = items.slice(start, start + safePageSize);
  const totalCount = items.length;
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / safePageSize) : 0;

  return {
    items: pagedItems,
    totalCount,
    pageNumber: safePageNumber,
    pageSize: safePageSize,
    totalPages,
    hasPreviousPage: safePageNumber > 1,
    hasNextPage: safePageNumber < totalPages
  };
};

const setLightTheme = async (page: Page) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('engineers-salary-reference.theme', 'light');
    document.documentElement.setAttribute('data-theme', 'light');
  });
};

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

const installProjectsApiMock = async (page: Page) => {
  const projects = Array.from({ length: 20 }, (_, index) => ({
    id: index + 1,
    name: `Theme Project ${index + 1}`,
    ownerId: 1,
    ownerName: 'Alya',
    statusId: 1,
    statusName: 'Under Study',
    tenderStageId: 1,
    tenderStageName: 'InHand',
    typeOfProjectId: 1,
    typeOfProjectName: 'HVAC',
    degreeOfImportanceId: 1,
    degreeOfImportanceName: 'High',
    countryId: 1,
    countryName: 'Saudi Arabia',
    assignTo: null,
    inCharge: null,
    consultant: null,
    startDate: null,
    acceptDate: null,
    deadline: `2026-04-${String((index % 28) + 1).padStart(2, '0')}T00:00:00`,
    endDate: null,
    price: (index + 1) * 5000,
    prb: null,
    delayReasons: null
  }));

  await page.route('**/api/**', async route => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = new URL(request.url());
    const path = url.pathname.toLowerCase();

    if (path.endsWith('/api/projects/bootstrap') && method === 'GET') {
      const pageNumber = Number(url.searchParams.get('pageNumber') ?? '1');
      const pageSize = Number(url.searchParams.get('pageSize') ?? '100');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          wrap({
            projects: paginate(projects, pageNumber, pageSize),
            owners: [{ id: 1, name: 'Alya' }],
            statuses: [{ id: 1, name: 'Under Study' }],
            stages: [{ id: 1, name: 'InHand' }],
            types: [{ id: 1, name: 'HVAC' }],
            degreesOfImportance: [{ id: 1, name: 'High' }],
            countries: [{ id: 1, name: 'Saudi Arabia' }],
            loadedAt: new Date().toISOString()
          })
        )
      });
      return;
    }

    if (path.endsWith('/api/projects') && method === 'GET') {
      const pageNumber = Number(url.searchParams.get('pageNumber') ?? '1');
      const pageSize = Number(url.searchParams.get('pageSize') ?? '100');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wrap(paginate(projects, pageNumber, pageSize)))
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(wrap(method === 'GET' ? [] : null))
    });
  });
};

const installSuppliersApiMock = async (page: Page) => {
  const supplierRow = {
    id: 77,
    supplier: 'Carrier Kuwait Air Conditioning',
    country: 'Kuwait',
    address: 'Kuwait City',
    phone: '24819733',
    website: 'https://carrier.example.com',
    rating: '4 / 5',
    status: 'Active',
    primaryEmail: 'info@carrier-kw.com',
    supplierEmail: 'info@carrier-kw.com',
    officialName: 'Ahmed Rahma',
    officialEmail: 'ahmed.rahma@carrier-kw.com',
    brand: 'Carrier',
    item: 'Air Handling Units',
    connectionId: 9001,
    materialCategoryId: 101,
    brandId: 201,
    officialId: 3101
  };

  await page.route('**/api/**', async route => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = new URL(request.url());
    const path = url.pathname.toLowerCase();

    if (path.endsWith('/api/tender-suppliers/bootstrap') && method === 'GET') {
      const pageNumber = Number(url.searchParams.get('pageNumber') ?? '1');
      const pageSize = Number(url.searchParams.get('pageSize') ?? '100');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          wrap({
            suppliers: paginate([supplierRow], pageNumber, pageSize),
            countries: [{ id: 414, name: 'Kuwait' }],
            materialCategories: [{ id: 101, name: 'Air Handling Units' }],
            brands: [{ id: 201, name: 'Carrier' }],
            loadedAt: new Date().toISOString()
          })
        )
      });
      return;
    }

    if (path.endsWith('/api/tender-suppliers/filter-options') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wrap([]))
      });
      return;
    }

    if (path.endsWith('/api/tender-suppliers') && method === 'GET') {
      const pageNumber = Number(url.searchParams.get('pageNumber') ?? '1');
      const pageSize = Number(url.searchParams.get('pageSize') ?? '100');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wrap(paginate([supplierRow], pageNumber, pageSize)))
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(wrap(method === 'GET' ? [] : null))
    });
  });
};

const readGridThemeSnapshot = async (page: Page) =>
  page.locator('engineers-salary-reference-data-grid').first().evaluate(element => {
    const headerCell = element.querySelector<HTMLElement>('.data-grid-table thead th');
    const bodyRow = element.querySelector<HTMLElement>('.data-grid-table tbody tr.data-row');
    const bodySurface =
      element.querySelector<HTMLElement>('.table-scroll') ??
      element.querySelector<HTMLElement>('.grid-container') ??
      bodyRow;
    const selectionCell =
      element.querySelector<HTMLElement>('.data-grid-table tbody tr.data-row td.selection-cell') ??
      bodyRow?.querySelector<HTMLElement>('td');
    const footer =
      element.querySelector<HTMLElement>('.grid-pagination-footer') ??
      element.querySelector<HTMLElement>('.grid-bottom-bar');

    if (!headerCell || !bodyRow || !bodySurface || !selectionCell) {
      throw new Error('Could not resolve DataGrid theme snapshot nodes.');
    }

    return {
      htmlTheme: document.documentElement.getAttribute('data-theme'),
      bodySurfaceBackground: getComputedStyle(bodySurface).backgroundColor,
      headerBackground: getComputedStyle(headerCell).backgroundColor,
      selectionBackground: getComputedStyle(selectionCell).backgroundColor,
      footerBackground: footer ? getComputedStyle(footer).backgroundColor : null,
      rowText: getComputedStyle(bodyRow).color
    };
  });

const brightness = (color: string | null) => {
  if (!color) {
    return null;
  }

  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) {
    return null;
  }

  const [, r, g, b] = match.map(Number);
  return (r * 299 + g * 587 + b * 114) / 1000;
};

const isTransparentSurface = (color: string | null) => {
  if (!color) {
    return false;
  }

  const normalized = color.trim().toLowerCase();
  if (normalized === 'transparent') {
    return true;
  }

  const rgbaMatch = normalized.match(/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)/i);
  if (rgbaMatch) {
    return true;
  }

  return false;
};

test.describe('DataGrid theme compatibility', () => {
  test.beforeEach(async ({ page }) => {
    await setLightTheme(page);
    await installAuth(page);
  });

  test('renders Tender Projects with light shell colors under light theme', async ({ page }) => {
    await installProjectsApiMock(page);
    await page.goto('/tender/projects');
    await expect(page).toHaveURL(/\/tender\/projects/);
    await expect(page.locator('engineers-salary-reference-data-grid').first()).toBeVisible({ timeout: 30000 });
    await expect(
      page.locator("engineers-salary-reference-data-grid .data-grid-table tbody tr.data-row").first()
    ).toBeVisible({ timeout: 30000 });

    const snapshot = await readGridThemeSnapshot(page);

    expect(snapshot.htmlTheme).toBe('light');
    expect(brightness(snapshot.headerBackground)).toBeGreaterThan(180);
    expect(isTransparentSurface(snapshot.bodySurfaceBackground)).toBe(true);
    expect(brightness(snapshot.selectionBackground)).toBeGreaterThan(180);
    expect(brightness(snapshot.footerBackground)).toBeGreaterThan(180);
  });

  test('renders Suppliers with light shell colors under light theme', async ({ page }) => {
    await installSuppliersApiMock(page);
    await page.goto('/tender/suppliers');
    await expect(page).toHaveURL(/\/tender\/suppliers/);
    await expect(page.getByRole('toolbar', { name: 'Suppliers page actions' })).toBeVisible({
      timeout: 30000
    });
    await expect(page.locator('engineers-salary-reference-data-grid').first()).toBeVisible({ timeout: 30000 });
    await expect(
      page.locator("engineers-salary-reference-data-grid .data-grid-table tbody tr.data-row").first()
    ).toBeVisible({ timeout: 30000 });

    const snapshot = await readGridThemeSnapshot(page);

    expect(snapshot.htmlTheme).toBe('light');
    expect(brightness(snapshot.headerBackground)).toBeGreaterThan(180);
    expect(isTransparentSurface(snapshot.bodySurfaceBackground)).toBe(true);
    expect(brightness(snapshot.selectionBackground)).toBeGreaterThan(180);
    expect(brightness(snapshot.footerBackground)).toBeGreaterThan(180);
  });
});
