import { Observable, type Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import type { TenderProject } from './tender-projects.contracts';
import type { TenderRow } from './tender-project-details/project-details.component';
import { environment } from '../../../../../../environments/environment';

type ProjectsMeta = {
  totalPages?: number | null;
  totalCount?: number | null;
  grouping?: {
    groups?: Array<{
      field: string;
      key: string;
      value?: unknown;
      count: number;
    }> | null;
  } | null;
};

type ProjectsPage = {
  items?: TenderProject[] | null;
  meta?: ProjectsMeta | null;
};

type ProjectsApiLike = {
  listWithMeta(params: {
    pageNumber: number;
    pageSize: number;
    search?: string;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
    groupBy?: string;
    groupDirection?: 'asc' | 'desc';
    groupDateInterval?: 'day' | 'week' | 'month' | 'quarter' | 'year';
    filters?: string;
  }): Observable<ProjectsPage>;
};

type ZoneLike = {
  run<T>(fn: () => T): T;
};

type CdrLike = {
  markForCheck(): void;
};

export interface TenderProjectsFetchHost {
  fetchToken: number;
  rows: TenderRow[];
  clearExistingRowsBeforeFetch?: boolean;
  loading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  pageSkeletonLoading: boolean;
  pageSkeletonShownAt: number;
  pageSkeletonHideTimer: ReturnType<typeof setTimeout> | null;
  projectsPrimaryFetchInFlight: boolean;
  projectsFetchFailureCount: number;
  projectsAutoRefreshBackoffUntil: number;
  currentProjectsPage: number;
  currentPageSize: number;
  totalProjectRecords: number;
  projectRemoteGroups: Array<{ field: string; key: string; value?: unknown; count: number }>;
  destroy$: Subject<void>;
  INITIAL_PAGE_SKELETON_MIN_MS: number;
  api: ProjectsApiLike;
  zone: ZoneLike;
  cdr: CdrLike;
  debugLog(message: string, payload?: unknown): void;
  toast(msg: string, kind?: 'info' | 'success' | 'warning' | 'error', ttlMs?: number): void;
  mapToRow(project: TenderProject): TenderRow;
  appendUniqueRows(existing: TenderRow[], incoming: TenderRow[]): TenderRow[];
  pinNewlyCreatedRowToTop(rows: TenderRow[]): TenderRow[];
  resetRowKeySet(rows: TenderRow[]): void;
  writeProjectsCache(rows: TenderRow[]): void;
  finishPrimaryProjectsFetch(requestToken: number): void;
  scheduleActivityPrefetch(rows: readonly TenderRow[]): void;
  onProjectsPageLoaded?(): void;
  buildProjectsListParams(): {
    pageNumber: number;
    pageSize: number;
    search?: string;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
    groupBy?: string;
    groupDirection?: 'asc' | 'desc';
    groupDateInterval?: 'day' | 'week' | 'month' | 'quarter' | 'year';
    filters?: string;
  };
  syncProjectGridConfig(): void;
  preserveUnchangedFetchedRows?: boolean;
}

function rowsAreShallowEqual(left: TenderRow, right: TenderRow): boolean {
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every(key => Object.prototype.hasOwnProperty.call(rightRecord, key) && Object.is(leftRecord[key], rightRecord[key]));
}

function fetchedRowKey(row: TenderRow): string | null {
  const record = row as Record<string, unknown>;
  for (const key of ['id', 'connectionId', 'key', 'rowKey']) {
    const value = record[key];
    if (typeof value === 'string' || typeof value === 'number') return `${key}:${value}`;
  }
  return null;
}

export function reconcileStableFetchedRows(
  existing: readonly TenderRow[],
  incoming: readonly TenderRow[]
): TenderRow[] {
  if (!existing.length || !incoming.length) return [...incoming];
  const existingByKey = new Map<string, TenderRow>();
  for (const row of existing) {
    const key = fetchedRowKey(row);
    if (key) existingByKey.set(key, row);
  }

  let orderOrValueChanged = existing.length !== incoming.length;
  const reconciled = incoming.map((row, index) => {
    const key = fetchedRowKey(row);
    const previous = key ? existingByKey.get(key) : undefined;
    const stableRow = previous && rowsAreShallowEqual(previous, row) ? previous : row;
    if (existing[index] !== stableRow) orderOrValueChanged = true;
    return stableRow;
  });

  return orderOrValueChanged ? reconciled : (existing as TenderRow[]);
}

export function fetchTenderProjects(host: TenderProjectsFetchHost): void {
  host.fetchToken += 1;
  const requestToken = host.fetchToken;
  if (host.clearExistingRowsBeforeFetch && !host.isLoadingMore && host.rows.length > 0) {
    host.rows = [];
    host.clearExistingRowsBeforeFetch = false;
  }
  const showLoader = host.rows.length === 0;
  host.projectsPrimaryFetchInFlight = true;
  host.pageSkeletonShownAt = Date.now();
  if (host.pageSkeletonLoading) {
    clearTenderProjectsPageSkeletonHideTimer(host);
  }
  host.pageSkeletonLoading = showLoader;
  host.loading = showLoader;
  host.error = null;
  host.cdr.markForCheck();

  const listParams = host.buildProjectsListParams();
  host.debugLog('[fetchProjects] Starting server-driven page fetch...', listParams);

  host.api
    .listWithMeta(listParams)
    .pipe(takeUntil(host.destroy$))
    .subscribe({
      next: page => {
        if (requestToken !== host.fetchToken) {
          return;
        }

        const items = page.items ?? [];
        const meta = page.meta;
        const mappedRows = items.map(project => host.mapToRow(project));
        const resolvedTotalRecords =
          typeof meta?.totalCount === 'number' && Number.isFinite(meta.totalCount)
            ? Math.max(0, meta.totalCount)
            : mappedRows.length;

        host.zone.run(() => {
          if (requestToken !== host.fetchToken) {
            return;
          }

          host.totalProjectRecords = resolvedTotalRecords;
          host.projectRemoteGroups = Array.isArray(meta?.grouping?.groups)
            ? meta.grouping.groups
            : [];
          host.syncProjectGridConfig();
          const previousRows = host.rows;
          if (host.isLoadingMore) {
            host.rows = host.appendUniqueRows(host.rows, mappedRows);
          } else {
            const nextRows = host.pinNewlyCreatedRowToTop(mappedRows);
            host.rows = host.preserveUnchangedFetchedRows
              ? reconcileStableFetchedRows(host.rows, nextRows)
              : nextRows;
          }
          if (host.rows !== previousRows) {
            host.resetRowKeySet(host.rows);
          }
          host.loading = false;
          deferTenderProjectsInitialPageSkeletonHide(host, requestToken);
          host.cdr.markForCheck();
          host.onProjectsPageLoaded?.();
        });

        host.projectsFetchFailureCount = 0;
        host.projectsAutoRefreshBackoffUntil = 0;
        host.writeProjectsCache(host.rows);
        host.finishPrimaryProjectsFetch(requestToken);
        host.scheduleActivityPrefetch(host.rows);
      },
      error: err => {
        if (environment.enableDebugLogs) console.error('[fetchProjects] Error:', err);
        host.projectsFetchFailureCount += 1;
        const backoffMs = Math.min(
          5_000 * Math.pow(2, host.projectsFetchFailureCount - 1),
          120_000
        );
        host.projectsAutoRefreshBackoffUntil = Date.now() + backoffMs;
        host.zone.run(() => {
          const hadData = host.rows.length > 0;
          host.error = hadData ? null : err?.message || 'Failed to load projects';
          host.loading = false;
          deferTenderProjectsInitialPageSkeletonHide(host, requestToken);
          if (!hadData) {
            host.toast('Failed to load projects', 'error');
          }
          host.cdr.markForCheck();
        });
        host.finishPrimaryProjectsFetch(requestToken);
      }
    });
}

export function deferTenderProjectsInitialPageSkeletonHide(
  host: TenderProjectsFetchHost,
  requestToken: number
): void {
  if (requestToken !== 1 || !host.pageSkeletonLoading) {
    host.pageSkeletonLoading = false;
    return;
  }

  const elapsedMs = host.pageSkeletonShownAt > 0 ? Date.now() - host.pageSkeletonShownAt : 0;
  const remainingMs = Math.max(0, host.INITIAL_PAGE_SKELETON_MIN_MS - elapsedMs);
  if (remainingMs <= 0) {
    host.pageSkeletonLoading = false;
    return;
  }

  clearTenderProjectsPageSkeletonHideTimer(host);
  host.pageSkeletonHideTimer = setTimeout(() => {
    host.pageSkeletonHideTimer = null;
    host.zone.run(() => {
      if (!host.pageSkeletonLoading) return;
      host.pageSkeletonLoading = false;
      host.cdr.markForCheck();
    });
  }, remainingMs);
}

export function clearTenderProjectsPageSkeletonHideTimer(host: TenderProjectsFetchHost): void {
  if (host.pageSkeletonHideTimer == null) {
    return;
  }
  clearTimeout(host.pageSkeletonHideTimer);
  host.pageSkeletonHideTimer = null;
}
