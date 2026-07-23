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

test.describe('Add New Project panel', () => {
  test.beforeEach(async ({ page }) => {
    await installAuth(page);
  });

  test('opens with the task-style shell and shows project validation review state', async ({
    page
  }) => {
    const project: MockProject = {
      id: 7023,
      name: 'Existing Project',
      ownerId: 1,
      ownerName: 'Built TECH',
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
      assignTo: 'Ahmed Mosbah',
      inCharge: 'Ranine',
      consultant: null,
      startDate: null,
      acceptDate: null,
      deadline: null,
      endDate: null,
      price: null,
      prb: null,
      delayReasons: null,
      description: null
    };

    await installProjectsApiMock(page, project);
    await gotoTenderProjectsPage(page);

    await page.getByRole('button', { name: 'Add New Project' }).click();

    const panel = page.locator('.project-editor-panel');
    const tabs = panel.getByLabel('Project panel views');
    await expect(panel).toBeVisible({ timeout: 30000 });
    await expect(tabs.getByRole('button', { name: 'Project', exact: true })).toBeVisible();
    await expect(tabs.getByRole('button', { name: 'Doc', exact: true })).toBeVisible();
    await expect(tabs.getByRole('button', { name: 'Reminder', exact: true })).toBeVisible();
    await expect(tabs.getByRole('button', { name: 'Whiteboard', exact: true })).toBeVisible();
    await expect(tabs.getByRole('button', { name: 'Dashboard', exact: true })).toBeVisible();
    await expect(panel.locator('.cu-title-textarea')).toHaveAttribute('placeholder', 'Project name');
    await expect(panel.getByRole('button', { name: 'Add description' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Add delay reason' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Create Project' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Write with AI' })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Templates' })).toHaveCount(0);

    await panel.getByRole('button', { name: 'Create Project' }).click();
    await expect(panel.getByText('Title is required.')).toBeVisible();

    await panel.locator('.cu-title-textarea').fill('Task-style project shell');
    await panel.getByRole('button', { name: 'Create Project' }).click();

    await expect(panel.getByText('Some fields are empty')).toBeVisible();
    await expect(panel.getByText('Owner')).toBeVisible();
    await expect(panel.getByText('Deadline')).toBeVisible();
    await expect(panel.getByText('Country')).toBeVisible();
  });
});
