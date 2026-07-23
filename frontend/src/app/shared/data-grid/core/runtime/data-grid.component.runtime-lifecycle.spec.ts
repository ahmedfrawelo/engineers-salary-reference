import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ngOnChangesHelper,
  ngOnInitHelper,
  scheduleNativeScrollBindingHelper
} from './data-grid.component.runtime-lifecycle';

describe('data-grid.component.runtime-lifecycle', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does not generate recommendations during grid init', () => {
    vi.useFakeTimers();

    const host = document.createElement('div');
    host.setAttribute('data-grid-layout-preset', 'shell');

    const ctx = {
      columns: [{ field: 'id' }],
      syncDefaultGridRowHeightPreference: vi.fn(),
      defaultConfig: {},
      config: { pageSize: 10, autoSizeColumns: false },
      setResolvedConfig: vi.fn(),
      syncExportFormat: vi.fn(),
      currentDensity: { set: vi.fn() },
      stateKey: undefined,
      dataSignal() {
        return [];
      },
      paginationState: { update: vi.fn() },
      lastRefreshTime: { set: vi.fn() },
      loadSnapshotsFromStorage: vi.fn(),
      autoSizeAllColumnsInternal: vi.fn(),
      syncHeaderBodyWidths: vi.fn(),
      visibleColumns() {
        return [];
      },
      generateRecommendations: vi.fn(),
      elementRef: { nativeElement: host }
    };

    ngOnInitHelper(ctx);
    vi.runAllTimers();

    expect(ctx.generateRecommendations).not.toHaveBeenCalled();
  });

  it('does not regenerate recommendations on generic grid changes', () => {
    vi.useFakeTimers();

    const host = document.createElement('div');
    host.setAttribute('data-grid-layout-preset', 'shell');

    const ctx = {
      columns: [{ field: 'id' }],
      config: { pageSize: 10, remoteData: false, autoSizeColumns: false },
      defaultConfig: {},
      captureInitialColumns: vi.fn(),
      syncDefaultGridRowHeightPreference: vi.fn(),
      setResolvedConfig: vi.fn(),
      syncExportFormat: vi.fn(),
      invalidateFilteredSortedCache: vi.fn(),
      cdr: { markForCheck: vi.fn() },
      paginationState: { update: vi.fn() },
      gridService: { clearCache: vi.fn() },
      columnAutoWidthCache: { clear: vi.fn() },
      dataSignal() {
        return [];
      },
      updatePaginationState: vi.fn(),
      cellValueCache: { clear: vi.fn() },
      columnRangeCache: { clear: vi.fn() },
      columnStatsCache: { clear: vi.fn() },
      bumpAggregateCache: vi.fn(),
      activeFilterColumn: null,
      loadSnapshotsFromStorage: vi.fn(),
      syncHeaderBodyWidths: vi.fn(),
      visibleColumns() {
        return [];
      },
      autoSizeAllColumnsInternal: vi.fn(),
      generateRecommendations: vi.fn(),
      elementRef: { nativeElement: host }
    };

    ngOnChangesHelper(ctx, {
      data: {
        firstChange: false
      }
    });
    vi.runAllTimers();

    expect(ctx.generateRecommendations).not.toHaveBeenCalled();
  });

  it('skips expensive config reprocessing when the next config is value-equivalent', () => {
    const host = document.createElement('div');
    host.setAttribute('data-grid-layout-preset', 'shell');

    const ctx = {
      columns: [{ field: 'id' }],
      config: {
        pageSize: 100,
        pageSizeOptions: [10, 20, 50, 100],
        remoteData: true,
        remoteCurrentPage: 1,
        remoteTotalRecords: 500,
        autoSizeColumns: false
      },
      defaultConfig: {},
      captureInitialColumns: vi.fn(),
      syncDefaultGridRowHeightPreference: vi.fn(),
      setResolvedConfig: vi.fn(),
      syncExportFormat: vi.fn(),
      invalidateFilteredSortedCache: vi.fn(),
      cdr: { markForCheck: vi.fn() },
      paginationState: { update: vi.fn() },
      gridService: { clearCache: vi.fn() },
      columnAutoWidthCache: { clear: vi.fn() },
      dataSignal() {
        return [];
      },
      updatePaginationState: vi.fn(),
      cellValueCache: { clear: vi.fn() },
      columnRangeCache: { clear: vi.fn() },
      columnStatsCache: { clear: vi.fn() },
      bumpAggregateCache: vi.fn(),
      activeFilterColumn: null,
      loadSnapshotsFromStorage: vi.fn(),
      syncHeaderBodyWidths: vi.fn(),
      visibleColumns() {
        return [];
      },
      autoSizeAllColumnsInternal: vi.fn(),
      elementRef: { nativeElement: host }
    };

    ngOnChangesHelper(ctx, {
      config: {
        firstChange: false,
        previousValue: {
          pageSize: 100,
          pageSizeOptions: ctx.config.pageSizeOptions,
          remoteData: true,
          remoteCurrentPage: 1,
          remoteTotalRecords: 500,
          autoSizeColumns: false
        },
        currentValue: {
          pageSize: 100,
          pageSizeOptions: ctx.config.pageSizeOptions,
          remoteData: true,
          remoteCurrentPage: 1,
          remoteTotalRecords: 500,
          autoSizeColumns: false
        }
      }
    });

    expect(ctx.syncDefaultGridRowHeightPreference).toHaveBeenCalledTimes(1);
    expect(ctx.setResolvedConfig).not.toHaveBeenCalled();
    expect(ctx.syncExportFormat).not.toHaveBeenCalled();
    expect(ctx.invalidateFilteredSortedCache).not.toHaveBeenCalled();
    expect(ctx.paginationState.update).not.toHaveBeenCalled();
    expect(ctx.cdr.markForCheck).not.toHaveBeenCalled();
  });

  it('preserves the previous remote pagination total while a config refresh is still loading', () => {
    let pagination = {
      currentPage: 4,
      pageSize: 100,
      totalRecords: 500,
      totalPages: 5
    };
    const host = document.createElement('div');
    host.setAttribute('data-grid-layout-preset', 'shell');

    const ctx = {
      columns: [{ field: 'id' }],
      loading: true,
      config: {
        pageSize: 100,
        pageSizeOptions: [10, 20, 50, 100],
        remoteData: true,
        remoteCurrentPage: 4,
        remoteTotalRecords: 0,
        autoSizeColumns: false
      },
      defaultConfig: {},
      captureInitialColumns: vi.fn(),
      syncDefaultGridRowHeightPreference: vi.fn(),
      setResolvedConfig: vi.fn(),
      syncExportFormat: vi.fn(),
      invalidateFilteredSortedCache: vi.fn(),
      cdr: { markForCheck: vi.fn() },
      paginationState: {
        update: vi.fn((updater: (state: typeof pagination) => typeof pagination) => {
          pagination = updater(pagination);
        })
      },
      gridService: { clearCache: vi.fn() },
      columnAutoWidthCache: { clear: vi.fn() },
      dataSignal() {
        return [];
      },
      updatePaginationState: vi.fn(),
      cellValueCache: { clear: vi.fn() },
      columnRangeCache: { clear: vi.fn() },
      columnStatsCache: { clear: vi.fn() },
      bumpAggregateCache: vi.fn(),
      activeFilterColumn: null,
      loadSnapshotsFromStorage: vi.fn(),
      syncHeaderBodyWidths: vi.fn(),
      visibleColumns() {
        return [];
      },
      autoSizeAllColumnsInternal: vi.fn(),
      elementRef: { nativeElement: host }
    };

    ngOnChangesHelper(ctx, {
      config: {
        firstChange: false,
        previousValue: {
          pageSize: 100,
          pageSizeOptions: ctx.config.pageSizeOptions,
          remoteData: true,
          remoteCurrentPage: 4,
          remoteTotalRecords: 500,
          autoSizeColumns: false
        },
        currentValue: ctx.config
      }
    });

    expect(pagination).toEqual({
      currentPage: 4,
      pageSize: 100,
      totalRecords: 500,
      totalPages: 5
    });
  });

  it('clears remote structural refresh suspension when remote loading finishes', () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        setTimeout(() => callback(0), 0);
        return 1;
      })
    );
    let pending = true;
    const pendingSignal = Object.assign(
      vi.fn(() => pending),
      {
        set: vi.fn((value: boolean) => {
          pending = value;
        })
      }
    );
    const fallbackTimer = setTimeout(() => undefined, 15_000);
    const ctx = {
      loading: false,
      remoteDataStructureRefreshPending: pendingSignal,
      remoteDataStructureRefreshSawLoading: true,
      remoteDataStructureRefreshToken: 4,
      remoteDataStructureRefreshFallbackTimer: fallbackTimer,
      syncHeaderBodyWidths: vi.fn(),
      elementRef: { nativeElement: document.createElement('div') }
    };

    ngOnChangesHelper(ctx, {
      loading: {
        firstChange: false,
        previousValue: true,
        currentValue: false
      }
    });

    expect(pendingSignal.set).toHaveBeenCalledWith(false);
    expect(ctx.remoteDataStructureRefreshSawLoading).toBe(false);
    expect(ctx.remoteDataStructureRefreshToken).toBe(5);
    expect(ctx.remoteDataStructureRefreshFallbackTimer).toBeNull();

    vi.runAllTimers();

    expect(ctx.syncHeaderBodyWidths).toHaveBeenCalled();
  });

  it('binds the fixed header scroll listener for default-grid grids', () => {
    vi.useFakeTimers();

    const host = document.createElement('div');
    host.setAttribute('data-grid-layout-preset', 'default');
    const fixedHeader = document.createElement('div');
    fixedHeader.className = 'fixed-table-header';
    const viewport = document.createElement('div');
    viewport.className = 'table-scroll';
    viewport.setAttribute('data-grid-scroll-host', 'main');
    const container = document.createElement('div');
    container.className = 'grid-container';
    container.append(viewport);
    host.append(fixedHeader, container);
    document.body.append(host);

    const ctx = {
      elementRef: { nativeElement: host },
      fixedHeader: { nativeElement: fixedHeader },
      gridViewport: { nativeElement: viewport },
      nativeScrollBindTimer: null,
      onFixedHeaderScroll: vi.fn(),
      onGridContainerScroll: vi.fn()
    };

    scheduleNativeScrollBindingHelper(ctx);
    vi.runOnlyPendingTimers();
    fixedHeader.dispatchEvent(new Event('scroll'));

    expect(ctx.onFixedHeaderScroll).toHaveBeenCalledTimes(1);
    host.remove();
  });
});
