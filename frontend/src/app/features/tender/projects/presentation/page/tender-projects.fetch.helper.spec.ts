import { Subject, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import type { TenderRow } from './tender-project-details/project-details.component';
import type { TenderProject } from './tender-projects.contracts';
import {
  fetchTenderProjects,
  reconcileStableFetchedRows,
  type TenderProjectsFetchHost
} from './tender-projects.fetch.helper';

type TestRow = TenderRow & { id: number };
type TestProject = TenderProject & { id: number };

const createRow = (id: number): TestRow => ({ id }) as TestRow;
const createProject = (id: number): TestProject => ({ id }) as TestProject;

function createHost(
  options: Partial<TenderProjectsFetchHost> & {
    rows?: TestRow[];
    pageItems?: TestProject[];
    isLoadingMore?: boolean;
  } = {}
): TenderProjectsFetchHost {
  const rows = options.rows ?? [];
  const pageItems = options.pageItems ?? [];

  return {
    fetchToken: 0,
    rows,
    clearExistingRowsBeforeFetch: false,
    loading: false,
    isLoadingMore: options.isLoadingMore ?? false,
    error: null,
    pageSkeletonLoading: false,
    pageSkeletonShownAt: 0,
    pageSkeletonHideTimer: null,
    projectsPrimaryFetchInFlight: false,
    projectsFetchFailureCount: 0,
    projectsAutoRefreshBackoffUntil: 0,
    currentProjectsPage: 1,
    currentPageSize: 25,
    totalProjectRecords: rows.length,
    projectRemoteGroups: [],
    destroy$: new Subject<void>(),
    INITIAL_PAGE_SKELETON_MIN_MS: 0,
    api: {
      listWithMeta: vi.fn(() =>
        of({
          items: pageItems,
          meta: { totalCount: pageItems.length }
        })
      )
    },
    zone: {
      run: fn => fn()
    },
    cdr: {
      markForCheck: vi.fn()
    },
    debugLog: vi.fn(),
    toast: vi.fn(),
    mapToRow: vi.fn((project: TestProject) => createRow(project.id)),
    appendUniqueRows: vi.fn((existing: TestRow[], incoming: TestRow[]) => [
      ...existing,
      ...incoming
    ]),
    pinNewlyCreatedRowToTop: vi.fn((incoming: TestRow[]) => incoming),
    resetRowKeySet: vi.fn(),
    writeProjectsCache: vi.fn(),
    finishPrimaryProjectsFetch: vi.fn(),
    scheduleActivityPrefetch: vi.fn(),
    onProjectsPageLoaded: vi.fn(),
    buildProjectsListParams: vi.fn(() => ({
      pageNumber: 1,
      pageSize: 25
    })),
    syncProjectGridConfig: vi.fn(),
    ...options
  };
}

describe('fetchTenderProjects', () => {
  it('reuses the existing row array and objects when a refresh returns identical values', () => {
    const existing = [createRow(1), createRow(2)];
    const refreshed = [createRow(1), createRow(2)];

    const reconciled = reconcileStableFetchedRows(existing, refreshed);

    expect(reconciled).toBe(existing);
    expect(reconciled[0]).toBe(existing[0]);
    expect(reconciled[1]).toBe(existing[1]);
  });

  it('reuses unchanged row objects while replacing only records whose values changed', () => {
    const existing = [createRow(1), { ...createRow(2), title: 'Before' }];
    const refreshed = [createRow(1), { ...createRow(2), title: 'After' }];

    const reconciled = reconcileStableFetchedRows(existing, refreshed);

    expect(reconciled).not.toBe(existing);
    expect(reconciled[0]).toBe(existing[0]);
    expect(reconciled[1]).toBe(refreshed[1]);
  });

  it('replaces rows during regular page fetches', () => {
    const incomingRows = [createRow(2)];
    const host = createHost({
      rows: [createRow(1)],
      pageItems: [createProject(2)],
      isLoadingMore: false,
      pinNewlyCreatedRowToTop: vi.fn(() => incomingRows)
    });

    fetchTenderProjects(host);

    expect(host.pinNewlyCreatedRowToTop).toHaveBeenCalledWith(incomingRows);
    expect(host.appendUniqueRows).not.toHaveBeenCalled();
    expect(host.rows).toEqual(incomingRows);
  });

  it('deduplicates rows during load-more fetches', () => {
    const existingRow = createRow(1);
    const appendedRows = [existingRow, createRow(2)];
    const host = createHost({
      rows: [existingRow],
      pageItems: [createProject(1), createProject(2)],
      isLoadingMore: true,
      appendUniqueRows: vi.fn(() => appendedRows)
    });

    fetchTenderProjects(host);

    expect(host.appendUniqueRows).toHaveBeenCalledWith(host.rows.slice(0, 1), [
      createRow(1),
      createRow(2)
    ]);
    expect(host.pinNewlyCreatedRowToTop).not.toHaveBeenCalled();
    expect(host.rows).toEqual(appendedRows);
  });

  it('clears stale rows before a regroup fetch so the grid does not regroup old page data', () => {
    const response$ = new Subject<{
      items: TestProject[];
      meta: { totalCount: number };
    }>();
    const host = createHost({
      rows: [createRow(1)],
      clearExistingRowsBeforeFetch: true,
      api: {
        listWithMeta: vi.fn(() => response$.asObservable())
      }
    });

    fetchTenderProjects(host);

    expect(host.rows).toEqual([]);
    expect(host.loading).toBe(true);
    expect(host.clearExistingRowsBeforeFetch).toBe(false);

    response$.next({
      items: [createProject(2)],
      meta: { totalCount: 1 }
    });
    response$.complete();

    expect(host.rows).toEqual([createRow(2)]);
  });
});
