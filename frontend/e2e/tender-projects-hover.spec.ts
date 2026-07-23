import { expect, test, type Locator, type Page } from '@playwright/test';

type MockProject = {
  id: number;
  name: string;
  ownerId: number;
  ownerName: string;
  statusId: number;
  statusName: string;
  tenderStageId: number;
  tenderStageName: string;
  typeOfProjectId: number;
  typeOfProjectName: string;
  degreeOfImportanceId: number;
  degreeOfImportanceName: string;
  countryId: number;
  countryName: string;
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
};

type SelectionCellState = {
  indexOpacity: string;
  checkboxOpacity: string;
  checkboxVisibility: string;
  checkboxPointerEvents: string;
};

type RowHoverBackgroundState = {
  selectionBackground: string;
  dataBackground: string;
};

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

const buildProjects = (count: number): MockProject[] =>
  Array.from({ length: count }, (_, index) => {
    const day = String((index % 28) + 1).padStart(2, '0');
    const id = index + 1;
    return {
      id,
      name: `Hover Regression Project ${id}`,
      ownerId: 1,
      ownerName: 'TAMEAR',
      statusId: index % 3 === 0 ? 2 : 1,
      statusName: index % 3 === 0 ? 'Postponed' : 'Under Study',
      tenderStageId: 1,
      tenderStageName: 'Under Study INHAND',
      typeOfProjectId: (index % 4) + 1,
      typeOfProjectName: ['Plumbing', 'HVAC', 'FIRE FIGHTING', 'Elec'][index % 4],
      degreeOfImportanceId: 1,
      degreeOfImportanceName: 'High',
      countryId: 1,
      countryName: 'Saudi Arabia',
      assignTo: index % 5 === 0 ? 'Fatma Hesham' : null,
      inCharge: null,
      consultant: null,
      startDate: null,
      acceptDate: null,
      deadline: `2026-01-${day}T00:00:00`,
      endDate: null,
      price: id * 1000,
      prb: null,
      delayReasons: null
    };
  });

const buildLookupList = (items: string[]) =>
  Array.from(new Set(items))
    .filter(item => item.trim().length > 0)
    .map((name, index) => ({ id: index + 1, name }));

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

const installProjectsApiMock = async (page: Page, projects: MockProject[]) => {
  await page.route('**/api/**', async route => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = new URL(request.url());
    const path = url.pathname.toLowerCase();

    if (path.endsWith('/api/projects/bootstrap') && method === 'GET') {
      const pageNumber = Number(url.searchParams.get('pageNumber') ?? url.searchParams.get('page') ?? '1');
      const pageSize = Number(url.searchParams.get('pageSize') ?? url.searchParams.get('size') ?? '100');
      const paged = paginate(projects, pageNumber, pageSize);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          wrap({
            projects: paged,
            owners: buildLookupList(projects.map(project => project.ownerName)),
            statuses: buildLookupList(projects.map(project => project.statusName)),
            stages: buildLookupList(projects.map(project => project.tenderStageName)),
            types: buildLookupList(projects.map(project => project.typeOfProjectName)),
            degreesOfImportance: buildLookupList(
              projects.map(project => project.degreeOfImportanceName)
            ),
            countries: buildLookupList(projects.map(project => project.countryName)),
            loadedAt: new Date().toISOString()
          })
        )
      });
      return;
    }

    if (path.endsWith('/api/projects') && method === 'GET') {
      const pageNumber = Number(url.searchParams.get('pageNumber') ?? url.searchParams.get('page') ?? '1');
      const pageSize = Number(url.searchParams.get('pageSize') ?? url.searchParams.get('size') ?? '100');

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wrap(paginate(projects, pageNumber, pageSize)))
      });
      return;
    }

    const payload = method === 'GET' ? [] : null;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(wrap(payload))
    });
  });
};

const gotoTenderProjectsPage = async (page: Page) => {
  const gridSelector =
    "engineers-salary-reference-data-grid[data-grid-layout-preset='default']";
  await page.goto('/tender/projects');
  await expect(page).toHaveURL(/\/tender\/projects/);
  await expect(page.locator(gridSelector)).toBeVisible({ timeout: 30000 });
  await expect(page.locator(`${gridSelector} .data-grid-table tbody tr.data-row`).first()).toBeVisible({
    timeout: 30000
  });
};

const groupByColumn = async (page: Page, header: string) => {
  const headerCell = page.locator('th', {
    has: page.locator('.header-text', { hasText: header })
  }).first();

  await expect(headerCell).toBeVisible();
  await headerCell.click({ button: 'right' });
  await page.getByText(`Group by ${header}`, { exact: true }).click();
};

const readGroupingState = async (page: Page) =>
  page.evaluate(() => {
    const grid = document.querySelector<HTMLElement>('engineers-salary-reference-data-grid');
    const groupChipLabels = Array.from(
      grid?.querySelectorAll<HTMLElement>('.group-chip .chip-label') ?? []
    ).map(element => element.textContent?.trim() ?? '');
    const groupRows = Array.from(
      grid?.querySelectorAll<HTMLElement>('tr.group-row') ?? []
    ).map(row => (row.textContent ?? '').trim());
    const headerTexts = Array.from(
      grid?.querySelectorAll<HTMLElement>('.header-table .header-text, .table-scroll .header-text') ?? []
    ).map(element => element.textContent?.trim() ?? '');
    const groupedContainers = grid?.querySelectorAll(
      'tr.group-body-wrapper .data-grid-table.subgroup tbody.grouped-display-body'
    ).length ?? 0;

    return {
      groupChipLabels,
      groupRows,
      headerTexts,
      groupedContainers
    };
  });

const readSelectionCellState = async (cell: Locator): Promise<SelectionCellState> =>
  cell.evaluate(element => {
    const checkbox = element.querySelector<HTMLInputElement>("input[type='checkbox']");
    if (!checkbox) {
      throw new Error('Selection checkbox was not found in the row cell.');
    }

    const indexStyle = getComputedStyle(element, '::before');
    const checkboxStyle = getComputedStyle(checkbox);

    return {
      indexOpacity: indexStyle.opacity,
      checkboxOpacity: checkboxStyle.opacity,
      checkboxVisibility: checkboxStyle.visibility,
      checkboxPointerEvents: checkboxStyle.pointerEvents
    };
  });

const readRowHoverBackgroundState = async (row: Locator): Promise<RowHoverBackgroundState> =>
  row.evaluate(element => {
    const cells = Array.from(element.querySelectorAll<HTMLElement>('td'));
    const selectionCell = cells.find(cell => cell.classList.contains('selection-cell'));
    const dataCell = cells.find(cell => !cell.classList.contains('selection-cell'));

    if (!selectionCell || !dataCell) {
      throw new Error('Could not find both selection and data cells in the hovered row.');
    }

    return {
      selectionBackground: getComputedStyle(selectionCell).backgroundColor,
      dataBackground: getComputedStyle(dataCell).backgroundColor
    };
  });

const readHeaderBodyAlignment = async (page: Page) =>
  page.evaluate(() => {
    const grid = document.querySelector<HTMLElement>('engineers-salary-reference-data-grid');
    const fixedHeader = grid?.querySelector<HTMLElement>('.fixed-table-header') ?? null;
    const nativeHeader = grid?.querySelector<HTMLElement>(
      '.table-scroll .data-grid-table.native-sticky-header-table thead'
    ) ?? null;
    const headerRoot = fixedHeader ?? nativeHeader;
    const bodyScroller = grid?.querySelector<HTMLElement>('.table-scroll') ?? null;
    const scrollerRect = bodyScroller?.getBoundingClientRect() ?? null;
    const headerCells = Array.from(
      headerRoot?.querySelectorAll<HTMLElement>('.header-row th') ?? []
    );
    const firstRow = grid?.querySelector<HTMLElement>('.data-grid-table tbody tr.data-row') ?? null;
    const bodyCells = firstRow ? Array.from(firstRow.querySelectorAll<HTMLElement>('td')) : [];

    return {
      headerPresent: !!headerRoot,
      fixedHeaderPresent: !!fixedHeader,
      nativeHeaderPresent: !!nativeHeader,
        bodyScrollerLeft: bodyScroller ? Math.round(bodyScroller.getBoundingClientRect().left) : null,
        scrollLeft: bodyScroller?.scrollLeft ?? null,
        columns: headerCells
          .map((header, index) => {
            const body = bodyCells[index];
            const headerRect = header.getBoundingClientRect();
            const bodyRect = body.getBoundingClientRect();

          return {
            index,
            headerLeft: Math.round(headerRect.left),
            bodyLeft: Math.round(bodyRect.left),
            headerWidth: Math.round(headerRect.width),
            bodyWidth: Math.round(bodyRect.width),
            leftDelta: Math.round(headerRect.left - bodyRect.left),
              widthDelta: Math.round(headerRect.width - bodyRect.width),
              headerText: header.textContent?.trim() || '',
              bodyText: body.textContent?.trim() || ''
            };
          })
          .filter(column => {
            if (!scrollerRect) {
              return true;
            }

            const visibleLeft = Math.round(scrollerRect.left);
            const visibleRight = Math.round(scrollerRect.right);
            const headerVisible = column.headerLeft < visibleRight && column.headerLeft + column.headerWidth > visibleLeft;
            const bodyVisible = column.bodyLeft < visibleRight && column.bodyLeft + column.bodyWidth > visibleLeft;

            return headerVisible && bodyVisible;
          })
      };
    });

const readPinnedSelectionScrollState = async (page: Page) =>
  page.evaluate(() => {
    const grid = document.querySelector<HTMLElement>(
      "engineers-salary-reference-data-grid[data-grid-layout-preset='default']"
    );
    const scroller = grid?.querySelector<HTMLElement>('.table-scroll') ?? null;
    const row = grid?.querySelector<HTMLElement>('.data-grid-table tbody tr.data-row') ?? null;
    const selectionCell = row?.querySelector<HTMLElement>('td.selection-cell') ?? null;
    const firstDataCell =
      row?.querySelector<HTMLElement>('td:not(.selection-cell)') ?? null;

    if (!grid || !scroller || !row || !selectionCell || !firstDataCell) {
      throw new Error('Could not resolve grid, scroller, selection cell, and first data cell.');
    }

    const selectionRect = selectionCell.getBoundingClientRect();
    const dataRect = firstDataCell.getBoundingClientRect();

    return {
      hostHasHorizontalScrollClass: grid.classList.contains('has-x-scroll'),
      pinnedLeftWidth: getComputedStyle(grid).getPropertyValue('--dg-pinned-left-width').trim(),
      scrollLeft: scroller.scrollLeft,
      selectionLeft: Math.round(selectionRect.left),
      dataLeft: Math.round(dataRect.left)
    };
  });

const readGroupedHeaderBodyAlignment = async (page: Page) =>
  page.evaluate(() => {
    const grid = document.querySelector<HTMLElement>(
      "engineers-salary-reference-data-grid[data-grid-layout-preset='default']"
    );
    const fixedHeader = grid?.querySelector<HTMLElement>('.fixed-table-header') ?? null;
    const tableScroller = grid?.querySelector<HTMLElement>('.table-scroll') ?? null;
    const firstGroupedRow =
      grid?.querySelector<HTMLElement>('.group-items-scroll tbody.grouped-display-body tr.data-row') ??
      null;

    if (!grid || !fixedHeader || !tableScroller || !firstGroupedRow) {
      throw new Error(
        'Could not resolve grouped grid header, main scroller, and first grouped data row.'
      );
    }

    const headerCells = Array.from(fixedHeader.querySelectorAll<HTMLElement>('.header-row th'));
    const bodyCells = Array.from(firstGroupedRow.querySelectorAll<HTMLElement>('td'));
    const scrollerRect = tableScroller.getBoundingClientRect();

    return {
      scrollLeft: tableScroller.scrollLeft,
      columns: headerCells
        .map((header, index) => {
          const body = bodyCells[index];

          if (!body) {
            return null;
          }

          const headerRect = header.getBoundingClientRect();
          const bodyRect = body.getBoundingClientRect();

          return {
            index,
            headerLeft: Math.round(headerRect.left),
            bodyLeft: Math.round(bodyRect.left),
            headerWidth: Math.round(headerRect.width),
            bodyWidth: Math.round(bodyRect.width),
            leftDelta: Math.round(headerRect.left - bodyRect.left),
            widthDelta: Math.round(headerRect.width - bodyRect.width),
            headerText: header.textContent?.trim() || '',
            bodyText: body.textContent?.trim() || ''
          };
        })
        .filter((column): column is NonNullable<typeof column> => !!column)
        .filter(column => {
          const visibleLeft = Math.round(scrollerRect.left);
          const visibleRight = Math.round(scrollerRect.right);
          const headerVisible =
            column.headerLeft < visibleRight && column.headerLeft + column.headerWidth > visibleLeft;
          const bodyVisible =
            column.bodyLeft < visibleRight && column.bodyLeft + column.bodyWidth > visibleLeft;

          return headerVisible && bodyVisible;
        })
    };
  });

test.describe('Tender Projects hover selection column', () => {
  test.beforeEach(async ({ page }) => {
    await installAuth(page);
  });

  test('swaps row number and checkbox immediately before and after scroll', async ({ page }) => {
    await installProjectsApiMock(page, buildProjects(120));
    await gotoTenderProjectsPage(page);

    const grid = page.locator('engineers-salary-reference-data-grid').first();
    const scroller = grid.locator('.table-scroll');
    const rows = grid.locator('.data-grid-table tbody tr.data-row');

    const firstRow = rows.nth(0);
    const firstSelectionCell = firstRow.locator('td.selection-cell').first();

    await expect(firstRow).toBeVisible();
    await page.mouse.move(20, 200);

    const initialState = await readSelectionCellState(firstSelectionCell);
    expect(initialState.indexOpacity).toBe('1');
    expect(initialState.checkboxVisibility).toBe('hidden');
    expect(initialState.checkboxPointerEvents).toBe('none');

    await firstRow.hover();

    const firstHoverState = await readSelectionCellState(firstSelectionCell);
    expect(firstHoverState.indexOpacity).toBe('0');
    expect(firstHoverState.checkboxVisibility).toBe('visible');
    expect(firstHoverState.checkboxPointerEvents).toBe('auto');

    const initialHoverBackgroundState = await readRowHoverBackgroundState(firstRow);
    expect(initialHoverBackgroundState.selectionBackground).toBe(
      initialHoverBackgroundState.dataBackground
    );

    await scroller.evaluate(element => {
      element.scrollTop = 520;
      element.scrollLeft = 280;
      element.dispatchEvent(new Event('scroll', { bubbles: true }));
    });

    const gridClassName = await grid.evaluate(element => element.className);
    expect(gridClassName).not.toMatch(/\bdg-scrolling-v\b/);
    expect(gridClassName).not.toMatch(/\bdg-fast-scroll-x\b/);

    const scrolledRow = rows.nth(20);
    const scrolledSelectionCell = scrolledRow.locator('td.selection-cell').first();

    await expect(scrolledRow).toBeVisible();
    await scrolledRow.hover();

    const scrolledHoverState = await readSelectionCellState(scrolledSelectionCell);
    expect(scrolledHoverState.indexOpacity).toBe('0');
    expect(scrolledHoverState.checkboxVisibility).toBe('visible');
    expect(scrolledHoverState.checkboxPointerEvents).toBe('auto');

    const scrolledHoverBackgroundState = await readRowHoverBackgroundState(scrolledRow);
    expect(scrolledHoverBackgroundState.selectionBackground).toBe(
      scrolledHoverBackgroundState.dataBackground
    );
  });

  test('keeps sticky header columns aligned with body cells after horizontal scroll', async ({ page }) => {
    await installProjectsApiMock(page, buildProjects(120));
    await gotoTenderProjectsPage(page);

    const scroller = page.locator('engineers-salary-reference-data-grid').first().locator('.table-scroll');

    await scroller.evaluate(element => {
      element.scrollLeft = 280;
      element.dispatchEvent(new Event('scroll', { bubbles: true }));
    });

    await page.waitForTimeout(100);

    const alignment = await readHeaderBodyAlignment(page);

    expect(alignment.headerPresent).toBe(true);

    for (const column of alignment.columns.slice(0, 4)) {
      expect(Math.abs(column.leftDelta)).toBeLessThanOrEqual(1);
      expect(Math.abs(column.widthDelta)).toBeLessThanOrEqual(1);
    }
  });

  test('keeps the checkbox selection column pinned while horizontal scroll starts after it', async ({ page }) => {
    await installProjectsApiMock(page, buildProjects(120));
    await gotoTenderProjectsPage(page);

    const scroller = page.locator('engineers-salary-reference-data-grid').first().locator('.table-scroll');

    const beforeScroll = await readPinnedSelectionScrollState(page);
    expect(beforeScroll.pinnedLeftWidth).toBe('44px');

    await scroller.evaluate(element => {
      element.scrollLeft = 320;
      element.dispatchEvent(new Event('scroll', { bubbles: true }));
    });

    await page.waitForTimeout(100);

    const afterScroll = await readPinnedSelectionScrollState(page);

    expect(afterScroll.hostHasHorizontalScrollClass).toBe(true);
    expect(afterScroll.scrollLeft).toBeGreaterThanOrEqual(300);
    expect(Math.abs(afterScroll.selectionLeft - beforeScroll.selectionLeft)).toBeLessThanOrEqual(1);
    expect(Math.abs(afterScroll.dataLeft - beforeScroll.dataLeft)).toBeGreaterThanOrEqual(40);
  });

  test('renders grouped rows while keeping the grouped column visible after grouping by status', async ({
    page
  }) => {
    await installProjectsApiMock(page, buildProjects(40));
    await gotoTenderProjectsPage(page);

    await groupByColumn(page, 'Status');
    await page.waitForTimeout(150);
    await page.locator('tr.group-row .group-toggle').first().click();
    await page.waitForTimeout(100);

    const groupingState = await readGroupingState(page);

    expect(groupingState.groupChipLabels).toContain('Status');
    expect(groupingState.groupRows.length).toBe(2);
    expect(groupingState.groupRows.some(text => text.includes('Under Study'))).toBe(true);
    expect(groupingState.groupRows.some(text => text.includes('Postponed'))).toBe(true);
    expect(groupingState.headerTexts).toContain('Status');
    expect(groupingState.groupedContainers).toBeGreaterThan(0);
  });

  test('keeps grouped header columns aligned with grouped body cells after horizontal scroll', async ({
    page
  }) => {
    await installProjectsApiMock(page, buildProjects(120));
    await gotoTenderProjectsPage(page);

    await groupByColumn(page, 'Status');
    await page.waitForTimeout(150);
    await page.locator('tr.group-row .group-toggle').first().click();
    await page.waitForTimeout(100);

    const groupedScroller = page.locator('.table-scroll').first();
    await groupedScroller.evaluate(element => {
      element.scrollLeft = 420;
      element.dispatchEvent(new Event('scroll', { bubbles: true }));
    });

    await page.waitForTimeout(120);

    const alignment = await readGroupedHeaderBodyAlignment(page);

    expect(alignment.scrollLeft).toBeGreaterThanOrEqual(400);

    for (const column of alignment.columns.slice(0, 4)) {
      expect(Math.abs(column.leftDelta)).toBeLessThanOrEqual(1);
      expect(Math.abs(column.widthDelta)).toBeLessThanOrEqual(1);
    }
  });
});
