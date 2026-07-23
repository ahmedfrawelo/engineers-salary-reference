import { expect, test, type Page } from '@playwright/test';

type MockProject = {
  id: number;
  name: string;
  ownerId: number | null;
  ownerName: string | null;
  statusId: number | null;
  statusName: string | null;
  tenderStageId: number | null;
  tenderStageName: string | null;
  typeOfProjectId: number | null;
  typeOfProjectName: string | null;
  degreeOfImportanceId: number | null;
  degreeOfImportanceName: string | null;
  countryId: number | null;
  countryName: string | null;
  assignTo: string | null;
  inCharge: string | null;
  consultant: string | null;
  startDate: string | null;
  acceptDate: string | null;
  deadline: string | null;
  endDate: string | null;
  price: number | null;
  prb: number | null;
  delayReasons: string | null;
  description?: string | null;
};

const wrap = <T>(data: T) => ({
  success: true,
  statusCode: 200,
  message: 'ok',
  data,
  errors: []
});

const buildLookupList = (items: Array<string | null | undefined>) =>
  Array.from(new Set(items.map(item => (item ?? '').trim()).filter(Boolean))).map(
    (name, index) => ({
      id: index + 1,
      name
    })
  );

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

const installProjectsApiMock = async (page: Page, project: MockProject) => {
  await page.route('**/api/**', async route => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = new URL(request.url());
    const path = url.pathname.toLowerCase();

    if (path.endsWith('/api/projects/bootstrap') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          wrap({
            projects: {
              items: [project],
              meta: {
                pageNumber: 1,
                pageSize: 100,
                totalCount: 1,
                totalPages: 1,
                hasPreviousPage: false,
                hasNextPage: false
              }
            },
            lookups: {
              owners: buildLookupList([project.ownerName]),
              statuses: buildLookupList([project.statusName]),
              stages: buildLookupList([project.tenderStageName]),
              types: buildLookupList([project.typeOfProjectName]),
              degreesOfImportance: buildLookupList([project.degreeOfImportanceName]),
              countries: buildLookupList([project.countryName]),
              assignToSettings: buildLookupList([project.assignTo]),
              inChargeSettings: buildLookupList([project.inCharge])
            },
            loadedAt: new Date().toISOString()
          })
        )
      });
      return;
    }

    if (path.endsWith('/api/projects') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          wrap({
            items: [project],
            totalCount: 1,
            pageNumber: 1,
            pageSize: 100,
            totalPages: 1,
            hasPreviousPage: false,
            hasNextPage: false
          })
        )
      });
      return;
    }

    if (/\/api\/projects\/\d+$/.test(path) && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          wrap({
            project,
            checklists: [],
            activity: [],
            includesActivity: true,
            includesSupplementalActivity: false,
            loadedAt: new Date().toISOString()
          })
        )
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(wrap([]))
    });
  });
};

const gotoTenderProjectsPage = async (page: Page) => {
  const gridSelector = "engineers-salary-reference-data-grid[data-grid-layout-preset='default']";
  await page.goto('/tender/projects');
  await expect(page).toHaveURL(/\/tender\/projects/);
  await expect(page.locator(gridSelector)).toBeVisible({ timeout: 30000 });
  await expect(
    page.locator(`${gridSelector} .data-grid-table tbody tr.data-row`).first()
  ).toBeVisible({
    timeout: 30000
  });
};

test.describe('Tender project details panel', () => {
  test.beforeEach(async ({ page }) => {
    await installAuth(page);
  });

  test('opens the details panel with the task-style body sections and validation summary', async ({
    page
  }) => {
    const project: MockProject = {
      id: 7023,
      name: 'Validation Coverage Project',
      ownerId: null,
      ownerName: '',
      statusId: 2,
      statusName: 'Lose',
      tenderStageId: 1,
      tenderStageName: 'InHand',
      typeOfProjectId: 4,
      typeOfProjectName: 'Elec',
      degreeOfImportanceId: 3,
      degreeOfImportanceName: 'High',
      countryId: 1,
      countryName: 'Saudi Arabia',
      assignTo: '',
      inCharge: '',
      consultant: '',
      startDate: null,
      acceptDate: null,
      deadline: null,
      endDate: null,
      price: 22412868,
      prb: null,
      delayReasons: '',
      description: ''
    };

    await installProjectsApiMock(page, project);
    await gotoTenderProjectsPage(page);

    await page.getByText(project.name, { exact: true }).first().click();
    const panel = page.locator('.project-details-clickup');
    await expect(panel).toBeVisible({ timeout: 30000 });
    await panel.getByRole('button', { name: 'Toggle project sidebar' }).click();

    await expect(panel.getByRole('heading', { name: 'Checklists' })).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'Attachments' })).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'Sections' })).toBeVisible();
    await expect(panel.getByRole('button', { name: /Overview/i })).toBeVisible();
    await expect(panel.getByText('Owner')).toBeVisible();
    await expect(panel.getByText('Tender Stage')).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Review first issue' })).toBeVisible();
    await expect(panel.locator('.project-detail-pill-attention')).toBeVisible();
  });
});
