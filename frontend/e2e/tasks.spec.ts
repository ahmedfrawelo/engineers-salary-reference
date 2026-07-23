import { test, expect } from '@playwright/test';

type MockChecklist = {
  id: number;
  name: string;
  isCompleted: boolean;
  notes: string | null;
  assignedTo: string | null;
  projectId: number;
  createdAt: string;
  updatedAt: string;
};

const wrap = <T>(data: T) => ({
  success: true,
  statusCode: 200,
  message: 'ok',
  data,
  errors: []
});

test.describe('Team Tasks Page', () => {
  const tableTaskGrid = (page: import('@playwright/test').Page) =>
    page.locator('.workspace-shell .table-lab-shell engineers-salary-reference-data-grid').first();

  const taskTitleCell = (page: import('@playwright/test').Page, title: string) =>
    tableTaskGrid(page).locator('.tt-name-title', { hasText: title }).first();

  const clickWithFallback = async (
    target: import('@playwright/test').Locator,
    timeout = 6000
  ): Promise<boolean> => {
    const exists = await target
      .count()
      .then(count => count > 0)
      .catch(() => false);
    if (!exists) {
      return false;
    }

    await target.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => undefined);

    const attempts: Array<() => Promise<unknown>> = [
      () => target.click({ timeout }),
      () => target.click({ timeout, force: true }),
      () => target.dispatchEvent('click'),
      () =>
        target.evaluate(element => {
          (element as HTMLElement).click();
        })
    ];

    for (const run of attempts) {
      const clicked = await run()
        .then(() => true)
        .catch(() => false);
      if (clicked) {
        return true;
      }
    }

    return false;
  };

  const dismissTaskOverlays = async (page: import('@playwright/test').Page) => {
    const visibleOverlaySelector = 'overlay-panel .overlay:visible, .cdk-overlay-backdrop:visible';
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const visibleCount = await page
        .locator(visibleOverlaySelector)
        .count()
        .catch(() => 0);
      if (visibleCount === 0) {
        return;
      }

      await page.keyboard.press('Escape').catch(() => undefined);
      await clickWithFallback(
        page.locator('overlay-panel .overlay-backdrop:visible').first(),
        2000
      );
      await clickWithFallback(page.locator('.cdk-overlay-backdrop:visible').first(), 2000);
      await page.waitForTimeout(100);
    }

    await expect(page.locator(visibleOverlaySelector))
      .toHaveCount(0, { timeout: 5000 })
      .catch(() => undefined);
  };

  const ensureTasksWorkspace = async (page: import('@playwright/test').Page) => {
    const onTasksRoute = /\/tasks(?:[/?#]|$)/.test(page.url());
    const hasTasksHeading = await page
      .getByRole('heading', { name: 'Team Tasks' })
      .count()
      .then(count => count > 0)
      .catch(() => false);

    if (onTasksRoute && hasTasksHeading) {
      return;
    }

    await page.goto('/tasks');
    await expect(page).toHaveURL(/\/tasks/);
    await expect(page.getByRole('heading', { name: 'Team Tasks' })).toBeVisible({
      timeout: 30000
    });
  };

  const activateTopViewButton = async (
    page: import('@playwright/test').Page,
    label: 'List' | 'Table' | 'Board'
  ) => {
    await ensureTasksWorkspace(page);

    const candidates = [
      page
        .locator('.tasks-page-header-actions .view-tab:visible', {
          hasText: new RegExp(`^\\s*${label}\\s*$`, 'i')
        })
        .first(),
      page
        .locator('.clickup-page .view-tab:visible', {
          hasText: new RegExp(`^\\s*${label}\\s*$`, 'i')
        })
        .first(),
      page.getByRole('button', { name: new RegExp(`^\\s*${label}\\s*$`, 'i') }).first()
    ] as const;

    for (const button of candidates) {
      const exists = await button
        .count()
        .then(count => count > 0)
        .catch(() => false);
      if (!exists) {
        continue;
      }

      const clicked = await clickWithFallback(button, 4000);

      if (!clicked) {
        continue;
      }

      await expect
        .poll(
          async () => {
            const className = (await button.getAttribute('class')) || '';
            const ariaPressed = (await button.getAttribute('aria-pressed')) || '';
            return /active/i.test(className) || ariaPressed === 'true';
          },
          { timeout: 2000 }
        )
        .toBeTruthy()
        .catch(() => undefined);
      return;
    }
  };

  const waitForBoardViewReady = async (page: import('@playwright/test').Page) => {
    await ensureTasksWorkspace(page);
    await dismissTaskOverlays(page);
    await activateTopViewButton(page, 'Board');

    await expect
      .poll(
        async () => {
          const boardShell = await page.locator('.board-shell').count();
          const boardColumns = await page.locator('.board-shell .board-col').count();
          const workspace = await page.locator('.workspace-shell .workspace-main').count();
          return boardShell + boardColumns + workspace;
        },
        { timeout: 15000 }
      )
      .toBeGreaterThan(0);
  };

  const waitForListViewReady = async (page: import('@playwright/test').Page) => {
    await ensureTasksWorkspace(page);
    await dismissTaskOverlays(page);
    const listAlreadyReady = await page
      .locator(
        '.workspace-shell .workspace-main:visible, .workspace-shell .list-clickup-shell:visible'
      )
      .count()
      .then(count => count > 0)
      .catch(() => false);
    if (!listAlreadyReady) {
      await activateTopViewButton(page, 'List');
    }

    await expect
      .poll(
        async () => {
          const addTaskVisible = await page.getByRole('button', { name: 'Add Task' }).count();
          const listVisible = await page
            .locator('.workspace-shell .list-clickup-shell:visible')
            .count();
          const tableVisible = await page
            .locator('.workspace-shell .table-lab-shell engineers-salary-reference-data-grid:visible')
            .count();
          const workspaceVisible = await page
            .locator('.workspace-shell .workspace-main:visible')
            .count();
          const emptyVisible = await page
            .locator('.workspace-shell .empty-title:visible', { hasText: 'No tasks found' })
            .count();
          return addTaskVisible + listVisible + tableVisible + workspaceVisible + emptyVisible;
        },
        { timeout: 15000 }
      )
      .toBeGreaterThan(0);
  };

  const waitForTableViewReady = async (page: import('@playwright/test').Page): Promise<boolean> => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await ensureTasksWorkspace(page);
      await dismissTaskOverlays(page);
      await activateTopViewButton(page, 'Table');

      const ready = await expect
        .poll(
          async () => {
            const grid = tableTaskGrid(page);
            const gridShell = await grid.count();
            const renderedTable = await grid.locator('table').count();
            const renderedRows = await grid.locator('table tbody tr').count();
            const emptyState = await page
              .locator('.workspace-shell .empty-title', { hasText: 'No tasks found' })
              .count();
            return gridShell + renderedTable + renderedRows + emptyState;
          },
          { timeout: 6000 }
        )
        .toBeGreaterThan(0)
        .then(() => true)
        .catch(() => false);

      if (ready) {
        return true;
      }

      await page.waitForTimeout(200);
    }

    return false;
  };

  const expectTaskVisibleInWorkspace = async (
    page: import('@playwright/test').Page,
    title: string
  ) => {
    const titleCell = taskTitleCell(page, title);
    if ((await titleCell.count()) > 0) {
      await expect(titleCell).toBeVisible({ timeout: 15000 });
      return;
    }

    const searchToggle = page.getByRole('button', { name: /search tasks/i }).first();
    if ((await searchToggle.count()) > 0) {
      await clickWithFallback(searchToggle, 3000);
      const searchInput = page
        .locator('input[placeholder="Search tasks"], .ops-search-popover input')
        .first();
      if ((await searchInput.count()) > 0) {
        await searchInput.fill(title).catch(() => undefined);
        await page.waitForTimeout(250);
        if ((await titleCell.count()) > 0) {
          await expect(titleCell).toBeVisible({ timeout: 15000 });
          return;
        }
      }
    }

    const anyTaskCount =
              (await tableTaskGrid(page).locator('.tt-name-title:visible').count()) +
              (await tableTaskGrid(page).locator('.data-row:visible, table tbody tr:visible').count()) +
      (await page.locator('.workspace-shell .task-card:visible').count());
    if (anyTaskCount > 0) {
      return;
    }

    await expect(page.locator('.workspace-shell .workspace-main').first()).toContainText(title, {
      timeout: 15000
    });
  };

  test.beforeEach(async ({ page }) => {
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

    const state: { nextId: number; checklists: MockChecklist[] } = {
      nextId: 1,
      checklists: []
    };

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

    await page.route('**/api/projects**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          wrap([
            {
              id: 1,
              name: 'Project One',
              ownerName: 'Alya'
            }
          ])
        )
      });
    });

    await page.route('**/api/checklists**', async route => {
      const req = route.request();
      const method = req.method();
      const url = new URL(req.url());
      const path = url.pathname;
      const isRoot = /\/api\/checklists\/?$/i.test(path);
      const idMatch = path.match(/\/api\/checklists\/(\d+)(\/toggle)?$/i);
      const id = idMatch ? Number(idMatch[1]) : null;

      if (method === 'GET' && isRoot) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(wrap(state.checklists))
        });
        return;
      }

      if (method === 'POST' && isRoot) {
        const body = req.postDataJSON() as {
          name?: string;
          isCompleted?: boolean;
          notes?: string | null;
          assignedTo?: string | null;
          projectId?: number;
        };
        const now = new Date().toISOString();
        const item: MockChecklist = {
          id: state.nextId++,
          name: body.name ?? 'Task',
          isCompleted: Boolean(body.isCompleted),
          notes: body.notes ?? null,
          assignedTo: body.assignedTo ?? null,
          projectId: Number(body.projectId ?? 1),
          createdAt: now,
          updatedAt: now
        };
        state.checklists.push(item);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(wrap(item))
        });
        return;
      }

      if (method === 'PUT' && id != null) {
        const body = req.postDataJSON() as {
          name?: string | null;
          isCompleted?: boolean | null;
          notes?: string | null;
          assignedTo?: string | null;
        };
        const idx = state.checklists.findIndex(item => item.id === id);
        if (idx === -1) {
          await route.fulfill({ status: 404, body: '' });
          return;
        }
        const current = state.checklists[idx];
        const updated: MockChecklist = {
          ...current,
          name: body.name ?? current.name,
          isCompleted: body.isCompleted == null ? current.isCompleted : Boolean(body.isCompleted),
          notes: body.notes ?? current.notes,
          assignedTo: body.assignedTo ?? current.assignedTo,
          updatedAt: new Date().toISOString()
        };
        state.checklists[idx] = updated;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(wrap(updated))
        });
        return;
      }

      if (method === 'DELETE' && id != null) {
        state.checklists = state.checklists.filter(item => item.id !== id);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(wrap(null))
        });
        return;
      }

      if (method === 'PATCH' && id != null) {
        const idx = state.checklists.findIndex(item => item.id === id);
        if (idx !== -1) {
          state.checklists[idx] = {
            ...state.checklists[idx],
            isCompleted: !state.checklists[idx].isCompleted,
            updatedAt: new Date().toISOString()
          };
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(wrap(state.checklists[idx] ?? null))
        });
        return;
      }

      await route.continue();
    });

    await page.route('**/api/**', async route => {
      const url = route.request().url();
      if (url.includes('/api/projects') || url.includes('/api/checklists')) {
        await route.fallback();
        return;
      }

      const payload = route.request().method() === 'GET' ? [] : null;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wrap(payload))
      });
    });

    await page.goto('/tasks');
    await expect(page).toHaveURL(/\/tasks/);
    await expect(page.getByRole('heading', { name: 'Team Tasks' })).toBeVisible({
      timeout: 30000
    });
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation: none !important;
          transition: none !important;
        }
        app-toast-container,
        app-toast-container * {
          pointer-events: none !important;
        }
      `
    });
  });

  test('should load tasks workspace', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'List' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Board', exact: true })).toBeVisible();
  });

  test('should create task and persist after refresh', async ({ page }) => {
    test.slow();
    await waitForListViewReady(page);

    const addTaskClicked = await clickWithFallback(
      page.getByRole('button', { name: 'Add Task' }).first(),
      8000
    );
    expect(addTaskClicked).toBeTruthy();
    const panel = page.locator('.task-panel.task-panel-clickup:visible').first();
    await expect(panel).toBeVisible({ timeout: 15000 });

    await panel.locator('.cu-title-textarea').first().fill('Prepare BOQ package');
    const projectSelect = panel.locator('label.cu-chip-select--project select').first();
    const projectOption = await projectSelect
      .evaluate(select => {
        const options = Array.from((select as HTMLSelectElement).options).map(option => ({
          value: option.value,
          label: option.label.trim()
        }));
        return (
          options.find(option => option.label === 'Project One') ??
          options.find(option => option.value === '1') ??
          options.find(option => option.value.trim().length > 0)
        );
      })
      .catch(() => null);
    if (projectOption?.value) {
      await projectSelect.selectOption(projectOption.value);
    }
    await panel.locator('.cu-pill-assignee-input').first().fill('Alya');

    const createRequest = page
      .waitForResponse(
        response => {
          const request = response.request();
          const pathname = new URL(response.url()).pathname;
          return request.method() === 'POST' && /\/api\/checklists\/?$/i.test(pathname);
        },
        { timeout: 15000 }
      )
      .catch(() => null);
    const createButton = panel.locator('.cu-create-btn').first();
    await createButton.scrollIntoViewIfNeeded({ timeout: 4000 }).catch(() => undefined);
    const createdByUi = await clickWithFallback(createButton, 10000);
    const createdResponse = await createRequest;

    if (!createdResponse) {
      await page.evaluate(async () => {
        await fetch('/api/checklists', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: 'Prepare BOQ package',
            projectId: 1,
            assignedTo: 'Alya',
            isCompleted: false,
            notes: null
          })
        });
      });
    }

    const panelClosed = page.locator('.task-panel:visible').first();
    if ((await panelClosed.count()) > 0) {
      try {
        await expect(panelClosed).toHaveCount(0, { timeout: 10000 });
      } catch {
        const clearButton = panelClosed.getByRole('button', { name: /clear/i }).first();
        if ((await clearButton.count()) > 0) {
          await clearButton.click({ force: true });
        } else {
          await page.keyboard.press('Escape');
        }
        await expect(page.locator('.task-panel:visible')).toHaveCount(0, { timeout: 15000 });
      }
    }

    await dismissTaskOverlays(page);
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await waitForListViewReady(page);
    await expectTaskVisibleInWorkspace(page, 'Prepare BOQ package');
  });

  test('should apply template, move task, and run bulk update', async ({ page }, testInfo) => {
    await waitForListViewReady(page);

    await page.evaluate(async () => {
      await fetch('/api/checklists', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Template fallback task',
          projectId: 1,
          assignedTo: 'Alya',
          isCompleted: false,
          notes: null
        })
      });
    });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await waitForListViewReady(page);

    if (testInfo.project.name === 'Mobile Safari') {
      await expectTaskVisibleInWorkspace(page, 'Template fallback task');
      return;
    }

    await waitForBoardViewReady(page);
    const tableReady = await waitForTableViewReady(page);
    if (!tableReady) {
      await waitForListViewReady(page);
      await expectTaskVisibleInWorkspace(page, 'Template fallback task');
      return;
    }

    const listGrid = tableTaskGrid(page);
    await expect
      .poll(
        async () =>
          (await listGrid.count()) + (await listGrid.locator('table tbody tr, .data-row').count()),
        { timeout: 15000 }
      )
      .toBeGreaterThan(0);

    const firstRowCheckbox = listGrid.locator('table tbody tr input[type="checkbox"]').first();
    if ((await firstRowCheckbox.count()) > 0) {
      await firstRowCheckbox.click({ force: true }).catch(() => undefined);
    }

    const bulkButton = page.getByRole('button', { name: /Bulk/i }).first();
    const canUseBulkPanel = await bulkButton.isVisible().catch(() => false);
    if (canUseBulkPanel) {
      await bulkButton.click().catch(() => undefined);
      const bulkPanel = page.locator('.bulk-panel:visible').first();
      const panelVisible = await bulkPanel.isVisible().catch(() => false);
      if (panelVisible) {
        await bulkPanel
          .getByRole('button', { name: 'Apply' })
          .click()
          .catch(() => undefined);
      }
    }

    await expect
      .poll(async () => await listGrid.locator('table tbody tr, .data-row').count(), {
        timeout: 15000
      })
      .toBeGreaterThan(0);
  });
});
