import type { GridColumn, GridState } from '../../models';
import { GRID_FEEDBACK_MESSAGES, showGridAlert } from '../../utils/feedback';
import { debugGridWarn, reportGridError } from '../../utils';
import { beginRemoteDataStructureRefresh } from './data-grid.component.runtime-remote-refresh';
type LooseValue = ReturnType<typeof JSON.parse>;
type HelperContext = Record<string, LooseValue>;
type T = unknown;
interface GridSnapshot {
  id: string;
  name: string;
  createdAt: number;
  state: GridState;
}

function shouldPersistColumnWidths(ctx: HelperContext): boolean {
  return ctx.config?.persistColumnWidths !== false;
}

function shouldPersistColumnLayout(ctx: HelperContext): boolean {
  return ctx.config?.persistColumnLayout !== false;
}

function isSourceManagedColumnDefinition(column: LooseValue): boolean {
  return !!(
    column?.searchSelect ||
    column?.headerSelect ||
    typeof column?.cellRenderer === 'function'
  );
}

function sanitizeLoadedState(ctx: HelperContext, state: GridState): GridState {
  let nextState = state;

  if (shouldPersistColumnWidths(ctx)) {
    // no-op
  } else if (state.columnWidths && Object.keys(state.columnWidths).length > 0) {
    nextState = {
      ...nextState,
      columnWidths: {}
    };
  }

  if (!shouldPersistColumnLayout(ctx)) {
    const hasColumnOrder = Array.isArray(nextState.columnOrder) && nextState.columnOrder.length > 0;
    const hasHiddenColumns =
      Array.isArray(nextState.hiddenColumns) && nextState.hiddenColumns.length > 0;
    const hasPinnedColumns =
      !!nextState.pinnedColumns && Object.keys(nextState.pinnedColumns).length > 0;

    if (hasColumnOrder || hasHiddenColumns || hasPinnedColumns) {
      nextState = {
        ...nextState,
        columnOrder: [],
        hiddenColumns: [],
        pinnedColumns: {}
      };
    }
  }

  return nextState;
}

export function saveStateHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (!ctx.stateKey) return;
  if (ctx.stateSaveTimer) {
    clearTimeout(ctx.stateSaveTimer as ReturnType<typeof setTimeout>);
    ctx.stateSaveTimer = null;
  }
  const state = ctx.buildGridState();
  try {
    localStorage.setItem(`grid-state-${ctx.stateKey}`, JSON.stringify(state));
  } catch (error) {
    reportGridError('Failed to save grid state:', error);
  }
}
export function scheduleStateSaveHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (!ctx.stateKey) return;
  const [delayMs] = args;
  const delay = Math.max(0, Number(delayMs) || 0);

  if (ctx.stateSaveTimer) {
    clearTimeout(ctx.stateSaveTimer as ReturnType<typeof setTimeout>);
    ctx.stateSaveTimer = null;
  }

  if (delay === 0) {
    saveStateHelper(ctx);
    return;
  }

  ctx.stateSaveTimer = setTimeout(() => {
    ctx.stateSaveTimer = null;
    saveStateHelper(ctx);
  }, delay);
}
export function loadStateHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (!ctx.stateKey) return;
  try {
    const saved = localStorage.getItem(`grid-state-${ctx.stateKey}`);
    if (!saved) return;
    const parsedState: GridState = JSON.parse(saved);
    const state = sanitizeLoadedState(ctx, parsedState);
    if (state.version !== '1.0') {
      debugGridWarn('Grid state version mismatch, ignoring saved state');
      return;
    }
    if (state !== parsedState) {
      localStorage.setItem(`grid-state-${ctx.stateKey}`, JSON.stringify(state));
    }
    ctx.restoreState(state);
  } catch (error) {
    reportGridError('Failed to load grid state:', error);
  }
}
export function clearStateHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (!ctx.stateKey) return;
  try {
    localStorage.removeItem(`grid-state-${ctx.stateKey}`);
  } catch (error) {
    reportGridError('Failed to clear grid state:', error);
  }
}
export function buildGridStateHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const isPersistableFilter = (filter: LooseValue): boolean => {
    if (filter.operator === 'globalSearch' || filter.operator === 'menuSearch') {
      return false;
    }
    return !(
      filter.operator === 'in' &&
      Array.isArray(filter.value) &&
      (filter.value as LooseValue[]).length === 0
    );
  };
  const persistColumnWidths = shouldPersistColumnWidths(ctx);
  const persistColumnLayout = shouldPersistColumnLayout(ctx);
  const columnWidths: Record<string, number | string> = {};
  const columnOrder: string[] = [];
  const hiddenColumns: string[] = [];
  const pinnedColumns: Record<string, 'left' | 'right'> = {};
  const columnAggregates: Record<string, NonNullable<GridColumn<T>['aggregate']>> = {};
  const columnDefinitions: NonNullable<GridState['columnDefinitions']> = {};

  for (const col of ctx.columns) {
    const field = col.field as string;
    if (persistColumnWidths && col.width) {
      columnWidths[field] = col.width;
    }
    if (persistColumnLayout) {
      columnOrder.push(field);
      if (col.hidden) {
        hiddenColumns.push(field);
      }
      if (col.pinned) {
        pinnedColumns[field] = col.pinned;
      }
    }
    if (!ctx.aggregateFooter?.enabled && col.aggregate) {
      columnAggregates[field] = col.aggregate;
    }
    if (
      !isSourceManagedColumnDefinition(col) &&
      (col.type || col.cellType || (Array.isArray(col.options) && col.options.length))
    ) {
      columnDefinitions[field] = {
        type: col.type,
        cellType: col.cellType,
        options: Array.isArray(col.options)
          ? col.options.map((option: LooseValue) => ({ ...option }))
          : undefined
      };
    }
  }

  const groupExpansionAuto = ctx.groupExpansionAuto?.() ?? true;
  let expandedGroups: string[] = [];
  if (typeof ctx.expandedGroupsSnapshot === 'function') {
    expandedGroups = ctx.expandedGroupsSnapshot() as string[];
  } else if (!groupExpansionAuto) {
    const expandedSet = ctx.expandedGroups?.() ?? new Set();
    for (const id of expandedSet) {
      if (typeof id === 'string' && id.trim().length > 0) {
        expandedGroups.push(id);
      }
    }
  }

  const filters: LooseValue[] = [];
  for (const filter of ctx.filterStates()) {
    if (isPersistableFilter(filter)) {
      filters.push(filter);
    }
  }

  return {
    sorts: ctx.sortStates(),
    filters,
    columnOrder: persistColumnLayout ? columnOrder : [],
    columnWidths,
    hiddenColumns: persistColumnLayout ? hiddenColumns : [],
    columnDefinitions,
    pinnedColumns: persistColumnLayout ? pinnedColumns : ({} as Record<string, 'left' | 'right'>),
    columnAggregates: ctx.aggregateFooter?.enabled
      ? ({} as Record<string, NonNullable<GridColumn<T>['aggregate']>>)
      : columnAggregates,
    groupHeaderAggregates: ctx.showGroupHeaderAggregates(),
    groupFooterAggregates: ctx.showGroupFooterAggregates(),
    grandTotalAggregates: ctx.showGrandTotalAggregates(),
    pageSize: ctx.paginationState().pageSize,
    groupColumns: ctx.groupColumns(),
    groupDateIntervals: ctx.groupDateIntervals?.() ?? {},
    expandedGroups,
    groupExpansionAuto,
    version: '1.0'
  };
}
export function restoreStateHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [state] = args;
  const isRestorableFilter = (filter: LooseValue): boolean => {
    if (filter.operator === 'globalSearch' || filter.operator === 'menuSearch') {
      return false;
    }
    return !(
      filter.operator === 'in' &&
      Array.isArray(filter.value) &&
      (filter.value as LooseValue[]).length === 0
    );
  };
  ctx.displayRowsEffectsSuspended?.set?.(true);
  try {
    if (state.sorts) {
      ctx.sortStates.set(state.sorts);
    }
    if (state.filters) {
      const filters: LooseValue[] = [];
      for (const filter of state.filters) {
        if (isRestorableFilter(filter)) {
          filters.push(filter);
        }
      }
      ctx.filterStates.set(filters);
    }
    if (shouldPersistColumnWidths(ctx) && state.columnWidths) {
      ctx.columns.forEach((col: LooseValue) => {
        const field = col.field as string;
        const savedWidth = state.columnWidths[field];
        const isPlainNumericString =
          typeof savedWidth === 'string' && /^\s*\d+(\.\d+)?(px)?\s*$/i.test(savedWidth);
        const numericWidth =
          typeof savedWidth === 'number'
            ? savedWidth
            : isPlainNumericString
              ? Number.parseFloat(savedWidth)
              : Number.NaN;

        if (Number.isFinite(numericWidth) && numericWidth > 0) {
          const minWidth = ctx.getMinimumColumnWidth(col);
          const maxWidth = ctx.getMaximumColumnWidth
            ? ctx.getMaximumColumnWidth(col)
            : (col.maxWidth ?? 800);
          col.width = Math.round(Math.min(Math.max(numericWidth, minWidth), maxWidth));
        } else if (savedWidth) {
          col.width = savedWidth;
        }
      });
    }
    if (shouldPersistColumnLayout(ctx) && state.hiddenColumns) {
      const hiddenColumns = new Set(state.hiddenColumns);
      ctx.columns.forEach((col: LooseValue) => {
        const field = col.field as string;
        col.hidden = hiddenColumns.has(field);
      });
    }
    if (state.columnDefinitions) {
      ctx.columns.forEach((col: LooseValue) => {
        const field = col.field as string;
        const definition = state.columnDefinitions?.[field];
        if (!definition) {
          return;
        }
        if (isSourceManagedColumnDefinition(col)) {
          return;
        }
        col.type = definition.type;
        col.cellType = definition.cellType;
        col.options = Array.isArray(definition.options)
          ? definition.options.map((option: LooseValue) => ({ ...option }))
          : undefined;
      });
    }
    if (ctx.aggregateFooter?.enabled) {
      ctx.columns.forEach((col: LooseValue) => {
        delete col.aggregate;
      });
    } else if (state.columnAggregates) {
      ctx.columns.forEach((col: LooseValue) => {
        const field = col.field as string;
        const aggregate = state.columnAggregates?.[field];
        if (aggregate) {
          col.aggregate = aggregate;
        } else {
          delete col.aggregate;
        }
      });
    }
    if (typeof state.groupHeaderAggregates === 'boolean') {
      ctx.showGroupHeaderAggregates.set(state.groupHeaderAggregates);
    }
    if (typeof state.groupFooterAggregates === 'boolean') {
      ctx.showGroupFooterAggregates.set(state.groupFooterAggregates);
    }
    if (typeof state.grandTotalAggregates === 'boolean') {
      ctx.showGrandTotalAggregates.set(state.grandTotalAggregates);
    }
    if (state.pageSize) {
      ctx.paginationState.update((ps: LooseValue) => ({ ...ps, pageSize: state.pageSize }));
    }
    const restoredGroupExpansionAuto =
      typeof state.groupExpansionAuto === 'boolean' ? state.groupExpansionAuto : true;
    ctx.groupExpansionAuto?.set?.(restoredGroupExpansionAuto);
    if (state.groupColumns) {
      if (state.groupColumns.length > 0) {
        beginRemoteDataStructureRefresh(ctx);
      }
      ctx.groupColumns.set(state.groupColumns);
    }
    if (state.groupDateIntervals && ctx.groupDateIntervals?.set) {
      ctx.groupDateIntervals.set(state.groupDateIntervals);
    }
    const restoredExpandedGroups = new Set<string>();
    if (!restoredGroupExpansionAuto && Array.isArray(state.expandedGroups)) {
      for (const id of state.expandedGroups) {
        if (typeof id === 'string' && id.trim().length > 0) {
          restoredExpandedGroups.add(id);
        }
      }
    }
    ctx.expandedGroups?.set?.(restoredExpandedGroups);
    ctx.groupFilterTerms?.set?.(new Map());
    if (
      shouldPersistColumnLayout(ctx) &&
      state.columnOrder &&
      state.columnOrder.length === ctx.columns.length
    ) {
      const columnsByField = new Map<string, GridColumn<T>>();
      for (const column of ctx.columns) {
        columnsByField.set(column.field as string, column as GridColumn<T>);
      }

      const ordered: GridColumn<T>[] = [];
      for (const field of state.columnOrder) {
        const column = columnsByField.get(String(field));
        if (column) {
          ordered.push(column);
        }
      }
      if (ordered.length === ctx.columns.length) {
        ctx.columns = ordered;
      }
    }
    if (shouldPersistColumnLayout(ctx) && state.pinnedColumns) {
      ctx.columns.forEach((col: LooseValue) => {
        const field = col.field as string;
        col.pinned = state.pinnedColumns?.[field];
      });
      ctx.applyPinnedOrdering();
    }
    ctx.automaticAutoSizeApplied = false;
    ctx.columnAutoWidthCache?.clear();
    ctx.columnRangeCache.clear();
    ctx.columnStatsCache.clear();
  } finally {
    ctx.displayRowsEffectsSuspended?.set?.(false);
  }
}
export function toggleSnapshotManagerHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  ctx.snapshotManagerOpen.update((v: LooseValue) => !v);
}
export function closeSnapshotManagerHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  ctx.snapshotManagerOpen.set(false);
}
export function saveSnapshotFromUIHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (!ctx.stateKey) {
    showGridAlert(GRID_FEEDBACK_MESSAGES.stateKeyRequiredToSaveSnapshots);
    return;
  }
  const name = (ctx.newSnapshotName || '').trim() || `Snapshot ${new Date().toLocaleTimeString()}`;
  const snapshot: GridSnapshot = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    createdAt: Date.now(),
    state: ctx.buildGridState()
  };
  const updated = [snapshot, ...ctx.savedSnapshots()].slice(0, 12);
  ctx.savedSnapshots.set(updated);
  ctx.newSnapshotName = '';
  ctx.persistSnapshots();
}
export function applySnapshotHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [id] = args;
  const snapshot = ctx.savedSnapshots().find((s: LooseValue) => s.id === id);
  if (!snapshot) return;
  ctx.restoreState(snapshot.state);
  ctx.snapshotManagerOpen.set(false);
}
export function deleteSnapshotHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [id, event] = args;
  event?.stopPropagation();
  ctx.savedSnapshots.update((snaps: LooseValue) => snaps.filter((s: LooseValue) => s.id !== id));
  ctx.persistSnapshots();
}
export function loadSnapshotsFromStorageHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const key = ctx.getSnapshotStorageKey();
  if (!key) {
    ctx.savedSnapshots.set([]);
    return;
  }
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      ctx.savedSnapshots.set([]);
      return;
    }
    const snapshots: GridSnapshot[] = JSON.parse(raw);
    ctx.savedSnapshots.set(snapshots);
  } catch (error) {
    reportGridError('Failed to load snapshots', error);
    ctx.savedSnapshots.set([]);
  }
}
export function persistSnapshotsHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const key = ctx.getSnapshotStorageKey();
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(ctx.savedSnapshots()));
  } catch (error) {
    reportGridError('Failed to persist snapshots', error);
  }
}
export function getSnapshotStorageKeyHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  return ctx.stateKey ? `grid-snapshots-${ctx.stateKey}` : null;
}
export function toggleColumnVisibilityPanelHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [event] = args;
  event.stopPropagation();
  ctx.showColumnVisibilityPanel = !ctx.showColumnVisibilityPanel;
}
export function closeColumnVisibilityPanelHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  ctx.showColumnVisibilityPanel = false;
}
export function handleColumnToggleHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [event] = args;
  event.column.hidden = event.hidden;
  ctx.columns = [...ctx.columns]; // Trigger change detection
  // Save state after column visibility change
  if (ctx.stateKey) {
    ctx.saveState();
  }
}
export function changeDensityHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [density] = args;
  ctx.currentDensity.set(density);
  ctx.config.density = density;
  ctx.logAuditEvent('density', `Density set to ${density}`);
}
export function toggleFullScreenHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  ctx.isFullScreen.update((v: LooseValue) => !v);
  const host = (ctx.elementRef?.nativeElement as HTMLElement | undefined) ?? null;
  const gridElement =
    (host?.querySelector('.engineers-salary-reference-data-grid') as HTMLElement | null) ??
    (host?.closest?.('.engineers-salary-reference-data-grid') as HTMLElement | null) ??
    null;
  if (!gridElement) return;
  if (ctx.isFullScreen()) {
    if (gridElement.requestFullscreen) {
      gridElement.requestFullscreen();
    }
  } else {
    if (document.exitFullscreen && document.fullscreenElement) {
      document.exitFullscreen();
    }
  }
  ctx.logAuditEvent('display', `Fullscreen ${ctx.isFullScreen() ? 'enabled' : 'disabled'}`);
}
