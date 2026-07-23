import { isDefaultGridContext } from '../../utils/layout';
import { resolveDataGridMainScrollHost } from '../../utils/dom';
import {
  cleanupColumnDragPreviewHelper,
  queueDefaultGridOverflowSyncHelper,
  setupDefaultGridOverflowObserverHelper,
  teardownDefaultGridOverflowObserverHelper
} from './data-grid.component.part2.internal.impl';
import {
  clearRemoteDataStructureRefreshFallbackTimer,
  clearRemoteDataStructureRefreshPending
} from './data-grid.component.runtime-remote-refresh';

type LooseValue = ReturnType<typeof JSON.parse>;
type HelperContext = Record<string, LooseValue>;

function resolveCurrentFixedHeader(ctx: HelperContext): HTMLElement | null {
  const viewChildHeader = (ctx.fixedHeader?.nativeElement as HTMLElement | undefined) ?? null;
  if (viewChildHeader?.isConnected) {
    return viewChildHeader;
  }
  const root = (ctx.elementRef?.nativeElement as HTMLElement | undefined) ?? null;
  return (root?.querySelector('.fixed-table-header') as HTMLElement | null) ?? null;
}

function resolveCurrentViewport(ctx: HelperContext): HTMLElement | null {
  const viewChildViewport = (ctx.gridViewport?.nativeElement as HTMLElement | undefined) ?? null;
  if (viewChildViewport?.isConnected) {
    return viewChildViewport;
  }
  const root = (ctx.elementRef?.nativeElement as HTMLElement | undefined) ?? null;
  return resolveDataGridMainScrollHost(root);
}

function resolveBottomScrollbarViewport(ctx: HelperContext): HTMLElement | null {
  const viewChildViewport =
    (ctx.bottomScrollbarViewport?.nativeElement as HTMLElement | undefined) ?? null;
  if (viewChildViewport?.isConnected) {
    return viewChildViewport;
  }
  const root = (ctx.elementRef?.nativeElement as HTMLElement | undefined) ?? null;
  return (root?.querySelector('.grid-bottom-scrollbar-strip') as HTMLElement | null) ?? null;
}

export function isHoverEnabled(ctx: HelperContext): boolean {
  return ctx.config?.hover !== false;
}

export function shouldRunAutomaticAutoSizeHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  return !!ctx.config?.autoSizeColumns;
}

function hasExplicitColumnWidth(column: LooseValue): boolean {
  if (typeof column?.width === 'number') {
    return Number.isFinite(column.width);
  }
  if (typeof column?.width === 'string') {
    return column.width.trim().length > 0;
  }
  return false;
}

function shouldApplyAutomaticAutoSizeNow(ctx: HelperContext): boolean {
  if (!shouldRunAutomaticAutoSizeHelper(ctx) || ctx.automaticAutoSizeApplied) {
    return false;
  }

  const visibleColumns = (ctx.visibleColumns?.() as LooseValue[] | undefined) ?? [];
  if (!visibleColumns.length) {
    return false;
  }

  const rows = (ctx.dataSignal?.() as LooseValue[] | undefined) ?? [];
  if (!rows.length) {
    return false;
  }

  const hasUnsizedColumns = visibleColumns.some(column => !hasExplicitColumnWidth(column));
  if (!hasUnsizedColumns) {
    ctx.automaticAutoSizeApplied = true;
    return false;
  }

  return true;
}

function areConfigInputsEquivalent(previousConfig: LooseValue, nextConfig: LooseValue): boolean {
  const previous =
    previousConfig && typeof previousConfig === 'object'
      ? (previousConfig as Record<string, unknown>)
      : {};
  const next =
    nextConfig && typeof nextConfig === 'object' ? (nextConfig as Record<string, unknown>) : {};
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);

  for (const key of keys) {
    if (previous[key] !== next[key]) {
      return false;
    }
  }

  return true;
}

function teardownNativeScrollListeners(ctx: HelperContext): void {
  const cleanup = (ctx.nativeScrollListenerCleanup as Array<() => void> | undefined) ?? [];
  cleanup.forEach(unlisten => {
    try {
      unlisten();
    } catch {
      // no-op cleanup guard
    }
  });
  ctx.nativeScrollListenerCleanup = [];
  ctx.nativeScrollListenerTargets = null;
}

function bindNativeScrollListeners(ctx: HelperContext): void {
  const fixedHeader = resolveCurrentFixedHeader(ctx);
  const viewport = resolveCurrentViewport(ctx);
  const root = (ctx.elementRef?.nativeElement as HTMLElement | undefined) ?? null;
  const container = (root?.querySelector('.grid-container') as HTMLElement | null) ?? null;
  const bottomScrollbar = resolveBottomScrollbarViewport(ctx);
  const isDefaultGridGrid = isDefaultGridContext(ctx);
  const headerScrollTarget = fixedHeader;
  const normalizedContainer =
    container && container !== viewport && !isDefaultGridGrid ? container : null;
  if (!viewport || !fixedHeader) return;

  const previous = ctx.nativeScrollListenerTargets as
    | {
        fixedHeader: HTMLElement | null;
        viewport: HTMLElement | null;
        container: HTMLElement | null;
        bottomScrollbar: HTMLElement | null;
      }
    | undefined;
  if (
    previous &&
    previous.fixedHeader === headerScrollTarget &&
    previous.viewport === viewport &&
    previous.container === normalizedContainer &&
    previous.bottomScrollbar === bottomScrollbar
  ) {
    return;
  }

  teardownNativeScrollListeners(ctx);

  const setup = () => {
    const onHeaderScroll = (event: Event) => ctx.onFixedHeaderScroll(event);
    const onViewportScroll = (event: Event) => ctx.onGridContainerScroll(event);
    const onContainerScroll = (event: Event) => ctx.onGridContainerScroll(event);
    const onBottomScrollbarScroll = (event: Event) => ctx.onGridContainerScroll(event);

    if (headerScrollTarget) {
      headerScrollTarget.addEventListener('scroll', onHeaderScroll, { passive: true });
    }
    viewport.addEventListener('scroll', onViewportScroll, { passive: true });
    if (normalizedContainer) {
      normalizedContainer.addEventListener('scroll', onContainerScroll, { passive: true });
    }
    if (bottomScrollbar && bottomScrollbar !== viewport) {
      bottomScrollbar.addEventListener('scroll', onBottomScrollbarScroll, { passive: true });
    }

    ctx.nativeScrollListenerCleanup = [
      ...(headerScrollTarget
        ? [() => headerScrollTarget.removeEventListener('scroll', onHeaderScroll)]
        : []),
      () => viewport.removeEventListener('scroll', onViewportScroll),
      ...(normalizedContainer
        ? [() => normalizedContainer.removeEventListener('scroll', onContainerScroll)]
        : []),
      ...(bottomScrollbar && bottomScrollbar !== viewport
        ? [() => bottomScrollbar.removeEventListener('scroll', onBottomScrollbarScroll)]
        : [])
    ];
    ctx.nativeScrollListenerTargets = {
      fixedHeader: headerScrollTarget,
      viewport,
      container: normalizedContainer,
      bottomScrollbar
    };

    // Prime synchronization from the real body scroller after listeners are active.
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        ctx.onGridContainerScroll({ target: viewport });
      });
    } else {
      setTimeout(() => ctx.onGridContainerScroll({ target: viewport }), 0);
    }
  };

  if (ctx.ngZone?.runOutsideAngular) {
    ctx.ngZone.runOutsideAngular(setup);
  } else {
    setup();
  }
}

export function scheduleNativeScrollBindingHelper(ctx: HelperContext): void {
  if (ctx.nativeScrollBindTimer) {
    clearTimeout(ctx.nativeScrollBindTimer as ReturnType<typeof setTimeout>);
  }
  ctx.nativeScrollBindTimer = setTimeout(() => {
    ctx.nativeScrollBindTimer = null;
    bindNativeScrollListeners(ctx);
  }, 0);
}

function scheduleDefaultGridOverflowBinding(ctx: HelperContext): void {
  if (!isDefaultGridContext(ctx)) {
    teardownDefaultGridOverflowObserverHelper(ctx);
    return;
  }

  const bind = () => {
    setupDefaultGridOverflowObserverHelper(ctx);
    queueDefaultGridOverflowSyncHelper(ctx);
  };

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => bind());
  } else {
    setTimeout(bind, 0);
  }
}

function isRemoteDataStructureRefreshPending(ctx: HelperContext): boolean {
  return (
    typeof ctx.remoteDataStructureRefreshPending === 'function' &&
    Boolean(ctx.remoteDataStructureRefreshPending())
  );
}

function schedulePostRemoteStructureRefreshLayout(ctx: HelperContext): void {
  if (ctx.remoteDataStructureLayoutRefreshQueued) {
    return;
  }
  ctx.remoteDataStructureLayoutRefreshQueued = true;

  const refresh = () => {
    ctx.remoteDataStructureLayoutRefreshQueued = false;
    scheduleNativeScrollBindingHelper(ctx);
    ctx.syncHeaderBodyWidths?.();
    scheduleDefaultGridOverflowBinding(ctx);
  };

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => requestAnimationFrame(refresh));
    return;
  }

  setTimeout(refresh, 32);
}

function syncRemoteDataStructureRefreshLoadingState(ctx: HelperContext): void {
  if (!isRemoteDataStructureRefreshPending(ctx)) {
    return;
  }

  if (ctx.loading) {
    ctx.remoteDataStructureRefreshSawLoading = true;
    return;
  }

  if (ctx.remoteDataStructureRefreshSawLoading) {
    clearRemoteDataStructureRefreshPending(ctx);
    schedulePostRemoteStructureRefreshLayout(ctx);
  }
}

export function focusEditingInput(ctx: HelperContext, rowIndex: number, field: string): void {
  const focusInput = () => {
    const root = (ctx.elementRef?.nativeElement as HTMLElement | undefined) ?? null;
    if (!root) {
      return;
    }
    const selector = `input[data-edit-row="${rowIndex}"][data-edit-field="${field}"], textarea[data-edit-row="${rowIndex}"][data-edit-field="${field}"]`;
    const input = root.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement | null;
    if (!input) {
      return;
    }
    if (input instanceof HTMLTextAreaElement) {
      const editorWrap = input.closest('.cell-editor-wrap');
      if (editorWrap instanceof HTMLElement && editorWrap.classList.contains('wrap-editor')) {
        input.style.height = 'auto';
        input.style.height = `${input.scrollHeight}px`;
        editorWrap.style.minHeight = `${input.scrollHeight}px`;
      }
    }
    input.focus();
    const valueLength = input.value?.length ?? 0;
    if (typeof input.setSelectionRange === 'function') {
      input.setSelectionRange(valueLength, valueLength);
    }
  };

  const raf =
    typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (callback: FrameRequestCallback) => setTimeout(callback, 0);

  raf(() => raf(() => focusInput()));
}

export function ngAfterViewInitHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  ctx.syncHeaderBodyWidths?.();
  scheduleNativeScrollBindingHelper(ctx);
  scheduleDefaultGridOverflowBinding(ctx);
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      ctx.syncHeaderBodyWidths?.();
      scheduleNativeScrollBindingHelper(ctx);
      scheduleDefaultGridOverflowBinding(ctx);
    });
  }
}

export function getGroupViewportHeightHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [block] = args;
  const rowHeight = Math.max(ctx.virtualRowHeight, 1);
  const rowCount = block.rows?.length ?? 0;
  if (rowCount <= 0) {
    return rowHeight;
  }
  const footerOffset = ctx.shouldShowGroupFooterAggregates() ? rowHeight : 0;
  const maxHeight = Math.max(ctx.groupBodyMaxHeight - footerOffset, rowHeight);
  return Math.min(maxHeight, rowCount * rowHeight);
}
export function ngOnDestroyHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  cleanupColumnDragPreviewHelper(ctx);
  // ? Clean up resize listeners
  ctx.detachResizeListeners();
  // ? Clear any pending timeouts/intervals
  if (ctx.cellSubmenuHideTimeout) {
    clearTimeout(ctx.cellSubmenuHideTimeout);
  }
  // ? Clear quick filter debounce timers
  ctx.quickFilterDebounceTimers.forEach((timer: LooseValue) => clearTimeout(timer));
  ctx.quickFilterDebounceTimers.clear();
  if (ctx.submenuTimeout) {
    clearTimeout(ctx.submenuTimeout);
  }
  if (ctx.scrollActiveTimeoutId) {
    clearTimeout(ctx.scrollActiveTimeoutId);
    ctx.scrollActiveTimeoutId = null;
  }
  if (ctx.fastScrollClassTimeoutId) {
    clearTimeout(ctx.fastScrollClassTimeoutId as ReturnType<typeof setTimeout>);
    ctx.fastScrollClassTimeoutId = null;
  }
  const host = (ctx.elementRef?.nativeElement as HTMLElement | undefined) ?? null;
  host?.classList.remove('dg-fast-scroll-x');
  if (ctx.nativeScrollBindTimer) {
    clearTimeout(ctx.nativeScrollBindTimer as ReturnType<typeof setTimeout>);
    ctx.nativeScrollBindTimer = null;
  }
  if (ctx.stateSaveTimer) {
    clearTimeout(ctx.stateSaveTimer as ReturnType<typeof setTimeout>);
    ctx.stateSaveTimer = null;
    if (ctx.stateKey && typeof ctx.saveState === 'function') {
      ctx.saveState();
    }
  }
  clearRemoteDataStructureRefreshFallbackTimer(ctx);
  teardownNativeScrollListeners(ctx);
  teardownDefaultGridOverflowObserverHelper(ctx);
  if (ctx.headerScrollSyncRAF) {
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(ctx.headerScrollSyncRAF as number);
    } else {
      clearTimeout(ctx.headerScrollSyncRAF as ReturnType<typeof setTimeout>);
    }
    ctx.headerScrollSyncRAF = null;
    ctx.pendingHeaderScrollLeft = null;
  }
  if (ctx.headerBodyWidthSyncRAF) {
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(ctx.headerBodyWidthSyncRAF as number);
    } else {
      clearTimeout(ctx.headerBodyWidthSyncRAF as ReturnType<typeof setTimeout>);
    }
    ctx.headerBodyWidthSyncRAF = null;
  }
  // ? Clear cell value cache to free memory
  ctx.cellValueCache.clear();
  ctx.columnRangeCache.clear();
  ctx.columnStatsCache.clear();
  ctx.columnMinWidthCache?.clear();
  ctx.columnAutoWidthCache?.clear();
  // ? Clear spreadsheet caches
  ctx.spreadsheetFormulaCache.clear();
  ctx.spreadsheetFormulaDeps.clear();
  // ? MEMORY LEAK FIX: Destroy canvas element
  if (ctx.measureCanvas) {
    ctx.measureCanvas.width = 0;
    ctx.measureCanvas.height = 0;
    ctx.measureCanvas = undefined;
  }
  ctx.detachGlobalDismissListener?.();
}
export function ngOnInitHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  // Clone column definitions locally so runtime mutations never leak back to the caller.
  ctx.columns = ctx.columns.map((col: LooseValue) => ({ ...col }));
  ctx.syncDefaultGridRowHeightPreference?.(ctx.config);
  // Merge default config with provided config
  ctx.setResolvedConfig?.({ ...ctx.defaultConfig, ...ctx.config });
  ctx.syncExportFormat();
  // Set initial density
  if (ctx.config.density) {
    ctx.currentDensity.set(ctx.config.density);
  }
  // Load saved state if stateKey is provided
  if (ctx.stateKey) {
    ctx.loadState();
    ctx.loadPresetsFromStorage();
  }
  // Initialize pagination
  const initialPageSize = ctx.config.pageSize || 10;
  const initialTotalRecords =
    ctx.config.remoteData && typeof ctx.config.remoteTotalRecords === 'number'
      ? Math.max(0, ctx.config.remoteTotalRecords)
      : ctx.dataSignal().length;
  const initialCurrentPage =
    ctx.config.remoteData && typeof ctx.config.remoteCurrentPage === 'number'
      ? Math.max(1, ctx.config.remoteCurrentPage)
      : 1;
  ctx.paginationState.update((state: LooseValue) => ({
    ...state,
    pageSize: initialPageSize,
    currentPage: initialCurrentPage,
    totalRecords: initialTotalRecords,
    totalPages: Math.max(1, Math.ceil(initialTotalRecords / initialPageSize))
  }));
  ctx.lastRefreshTime.set(new Date());
  ctx.loadSnapshotsFromStorage();
  setTimeout(() => {
    if (shouldApplyAutomaticAutoSizeNow(ctx)) {
      ctx.autoSizeAllColumnsInternal({ automatic: true, save: false });
    }
    // ? Sync header/body widths on initialization
    ctx.syncHeaderBodyWidths();
    queueDefaultGridOverflowSyncHelper(ctx);
    scheduleNativeScrollBindingHelper(ctx);
  }, 0);
}
export function ngOnChangesHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [changes] = args;
  let shouldRefreshLayoutBindings = false;
  if (changes['columns']) {
    ctx.captureInitialColumns(changes['columns'].currentValue ?? ctx.columns);
    ctx.cellValueCache?.clear?.();
    shouldRefreshLayoutBindings = true;
  }
  if (changes['loading']) {
    syncRemoteDataStructureRefreshLoadingState(ctx);
  }
  if (changes['config'] && !changes['config'].firstChange) {
    const nextConfig = changes['config'].currentValue ?? ctx.config;
    ctx.syncDefaultGridRowHeightPreference?.(nextConfig);
    if (!areConfigInputsEquivalent(changes['config'].previousValue, nextConfig)) {
      // Re-merge defaults with incoming config to pull updated page size/options
      ctx.setResolvedConfig?.({ ...ctx.defaultConfig, ...ctx.config });
      ctx.syncExportFormat();
      ctx.invalidateFilteredSortedCache();
      ctx.cellValueCache?.clear?.();
      // When page size changes from parent config, sync pagination state
      const nextPageSize = ctx.config.pageSize || 10;
      // ? Mark for check when config changes (OnPush compatibility)
      ctx.cdr.markForCheck();
      ctx.paginationState.update((state: LooseValue) => {
        const remoteTotalRecords =
          ctx.config.remoteData && typeof ctx.config.remoteTotalRecords === 'number'
            ? Math.max(0, ctx.config.remoteTotalRecords)
            : null;
        const nextTotalRecords =
          remoteTotalRecords !== null
            ? ctx.loading && remoteTotalRecords === 0 && ctx.dataSignal().length === 0
              ? Math.max(0, state.totalRecords ?? 0)
              : remoteTotalRecords
            : state.totalRecords || ctx.dataSignal().length;
        const nextCurrentPage =
          ctx.config.remoteData && typeof ctx.config.remoteCurrentPage === 'number'
            ? Math.max(1, ctx.config.remoteCurrentPage)
            : 1;
        return {
          ...state,
          pageSize: nextPageSize,
          currentPage: nextCurrentPage,
          totalRecords: nextTotalRecords,
          totalPages: Math.max(1, Math.ceil(nextTotalRecords / nextPageSize))
        };
      });
      shouldRefreshLayoutBindings = true;
    }
  }
  if (changes['data']) {
    ctx.gridService.clearCache();
    ctx.columnAutoWidthCache?.clear();
    const totalRecords =
      ctx.config.remoteData && typeof ctx.config.remoteTotalRecords === 'number'
        ? Math.max(0, ctx.config.remoteTotalRecords)
        : ctx.dataSignal().length;
    ctx.updatePaginationState(totalRecords);
    ctx.cellValueCache.clear();
    ctx.columnRangeCache.clear();
    ctx.columnStatsCache.clear();
    ctx.bumpAggregateCache();
    if (ctx.activeFilterColumn) {
      const activeColumn = ctx.activeFilterColumn;
      setTimeout(() => {
        if (ctx.activeFilterColumn !== activeColumn) {
          return;
        }
        ctx.buildFilterMenuOptions(activeColumn);
      }, 0);
    }
    // ? Sync header/body widths when data changes
    setTimeout(() => {
      if (shouldApplyAutomaticAutoSizeNow(ctx)) {
        ctx.autoSizeAllColumnsInternal({ automatic: true, save: false });
      }
      ctx.syncHeaderBodyWidths();
    }, 0);
    shouldRefreshLayoutBindings = true;
  }
  if (changes['stateKey'] && !changes['stateKey'].firstChange) {
    ctx.loadSnapshotsFromStorage();
  }
  if (shouldRefreshLayoutBindings) {
    scheduleNativeScrollBindingHelper(ctx);
    scheduleDefaultGridOverflowBinding(ctx);
  }
}
