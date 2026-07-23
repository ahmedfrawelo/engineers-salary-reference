import { describe, expect, it, vi } from 'vitest';

import { tryTenderProjectsAutoRefresh } from './tender-projects.auto-refresh.helper';
import type { TenderProjectsAutoRefreshHost } from './tender-projects.auto-refresh.helper';

const createHost = (refreshLookupsOnAutoRefresh: boolean): TenderProjectsAutoRefreshHost => ({
  isBrowser: true,
  pageBootstrapPending: false,
  PROJECTS_AUTO_REFRESH_MS: 30_000,
  PROJECTS_REFRESH_MIN_INTERVAL_MS: 0,
  refreshLookupsOnAutoRefresh,
  selectedRows: [],
  deferredProjectsRefreshWhileBusy: false,
  projectsAutoRefreshTimer: null,
  projectsPrimaryFetchInFlight: false,
  queuedProjectsRefresh: false,
  projectsAutoRefreshBackoffUntil: 0,
  lastProjectsRefreshTriggerAt: 0,
  fetchToken: 0,
  showAdd: false,
  showDetails: false,
  showSettings: false,
  deleteDialogOpen: false,
  doc: { visibilityState: 'visible' } as Document,
  loadLookups: vi.fn().mockResolvedValue(undefined),
  fetchProjects: vi.fn()
});

describe('tender projects auto refresh', () => {
  it('refreshes salary rows without requesting tender lookup endpoints', () => {
    const host = createHost(false);

    tryTenderProjectsAutoRefresh(host, true);

    expect(host.fetchProjects).toHaveBeenCalledOnce();
    expect(host.loadLookups).not.toHaveBeenCalled();
  });

  it('preserves lookup refresh for the tender projects route', () => {
    const host = createHost(true);

    tryTenderProjectsAutoRefresh(host, true);

    expect(host.fetchProjects).toHaveBeenCalledOnce();
    expect(host.loadLookups).toHaveBeenCalledOnce();
  });
});
