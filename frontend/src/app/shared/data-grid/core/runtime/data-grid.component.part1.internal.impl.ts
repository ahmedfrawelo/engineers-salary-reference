import type {
  ExportOptions,
  FilterOperator,
  FilterState,
  GridChangeEvent,
  SortDirection,
  SortState
} from '../../models';
import { focusEditingInput, isHoverEnabled } from './data-grid.component.runtime-lifecycle';
import {
  getDeletedRowsFeedbackMessage,
  getOverwritePresetConfirmMessage,
  getValidationFeedbackMessage,
  GRID_FEEDBACK_MESSAGES,
  showGridAlert,
  showGridAction,
  requestGridConfirm
} from '../../utils/feedback';
import { reportGridError } from '../../utils';
export {
  getGroupViewportHeightHelper,
  isHoverEnabled,
  ngAfterViewInitHelper,
  ngOnChangesHelper,
  ngOnDestroyHelper,
  ngOnInitHelper,
  focusEditingInput,
  shouldRunAutomaticAutoSizeHelper
} from './data-grid.component.runtime-lifecycle';

type LooseValue = ReturnType<typeof JSON.parse>;
type HelperContext = Record<string, LooseValue>;
type T = unknown;
type ExportScope = 'all' | 'selected' | 'filtered' | 'visible' | 'row';
const LARGE_SELECTION_SYNC_EMIT_LIMIT = 64;
const CELL_RENDER_CACHE_LIMIT = 50_000;
type GroupSelectionViewState = {
  checked: boolean;
  partial: boolean;
  title: string;
};
type CellCacheReadResult =
  | {
      hit: true;
      value: LooseValue;
    }
  | {
      hit: false;
      value?: never;
    };
const cellCacheRowIds = new WeakMap<object, number>();
let nextCellCacheRowId = 0;
const scopedGroupRowsCache = new WeakMap<
  object,
  { source: LooseValue[] | null; rows: LooseValue[] }
>();
const groupSelectionStateCache = new WeakMap<
  object,
  {
    rows: LooseValue[];
    selectedLookup: Set<LooseValue>;
    selectedCount: number;
  }
>();
const groupSelectionViewStateCache = new WeakMap<
  object,
  {
    rows: LooseValue[] | null;
    selectedLookup: Set<LooseValue> | null;
    selectedCount: number;
    hintedTotal: number | null;
    viewState: GroupSelectionViewState;
  }
>();
const emptyGroupSelectionViewState = Object.freeze({
  checked: false,
  partial: false,
  title: 'No rows in this group'
});
const emptySelectionLookup = new Set<LooseValue>();
const deferredSelectionChangeTimers = new WeakMap<
  object,
  { timeout?: ReturnType<typeof setTimeout>; frame?: number }
>();

function getCellCacheMap(ctx: HelperContext): Map<string, LooseValue> | null {
  return ctx.cellValueCache instanceof Map ? (ctx.cellValueCache as Map<string, LooseValue>) : null;
}

function getCellCacheRowId(row: LooseValue): number | null {
  if (!row || typeof row !== 'object') {
    return null;
  }

  const record = row as object;
  const cached = cellCacheRowIds.get(record);
  if (cached !== undefined) {
    return cached;
  }

  nextCellCacheRowId += 1;
  cellCacheRowIds.set(record, nextCellCacheRowId);
  return nextCellCacheRowId;
}

function getCellCacheKey(
  row: LooseValue,
  column: LooseValue,
  purpose: 'value' | 'title' | 'render'
): string | null {
  const rowId = getCellCacheRowId(row);
  const field = column?.field;
  if (rowId === null || field === null || field === undefined) {
    return null;
  }
  return `${purpose}|${rowId}|${String(field)}`;
}

function getCellRenderCacheKey(
  row: LooseValue,
  column: LooseValue,
  searchTerm: string
): string | null {
  const key = getCellCacheKey(row, column, 'render');
  return key ? `${key}|${searchTerm}` : null;
}

function readCellCache(ctx: HelperContext, key: string | null): CellCacheReadResult {
  if (!key) {
    return { hit: false };
  }

  const cache = getCellCacheMap(ctx);
  if (!cache || !cache.has(key)) {
    return { hit: false };
  }

  return {
    hit: true,
    value: cache.get(key)
  };
}

function writeCellCache(ctx: HelperContext, key: string | null, value: LooseValue): LooseValue {
  if (!key) {
    return value;
  }

  const cache = getCellCacheMap(ctx);
  if (!cache) {
    return value;
  }

  if (cache.size > CELL_RENDER_CACHE_LIMIT) {
    cache.clear();
  }
  cache.set(key, value);
  return value;
}

export function captureInitialColumnsHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [columns] = args;
  const nextColumns = columns ?? [];
  const nextOrder = nextColumns.map((col: LooseValue) => ctx.getColumnField(col));
  const sameOrder =
    nextOrder.length === ctx.initialColumnOrder.length &&
    nextOrder.every(
      (field: LooseValue, index: LooseValue) => field === ctx.initialColumnOrder[index]
    );
  if (sameOrder && ctx.initialColumnState.size) {
    return;
  }
  ctx.initialColumnOrder = nextOrder;
  ctx.initialColumnState.clear();
  nextColumns.forEach((col: LooseValue) => {
    const field = ctx.getColumnField(col);
    ctx.initialColumnState.set(field, {
      width: col.width,
      hidden: col.hidden,
      pinned: col.pinned,
      align: col.align,
      aggregate: col.aggregate
    });
  });
}
export function onSortHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column, event] = args;
  if (column.sortable === false) return;
  const field = column.field as string;
  const multiSort = ctx.config.multiSort && event.ctrlKey;
  ctx.sortStates.update((states: LooseValue) => {
    const existingIndex = states.findIndex((s: LooseValue) => s.field === field);
    if (existingIndex >= 0) {
      // Toggle existing sort
      const current = states[existingIndex];
      const newDirection: SortDirection =
        current.direction === 'asc' ? 'desc' : current.direction === 'desc' ? null : 'asc';
      if (newDirection === null) {
        // Remove sort
        return multiSort
          ? states.filter((_: LooseValue, i: LooseValue) => i !== existingIndex)
          : [];
      } else {
        // Update direction
        const newState = { ...current, direction: newDirection };
        return multiSort
          ? states.map((s: LooseValue, i: LooseValue) => (i === existingIndex ? newState : s))
          : [newState];
      }
    } else {
      // Add new sort
      const newState: SortState = { field, direction: 'asc', order: states.length };
      return multiSort ? [...states, newState] : [newState];
    }
  });
  ctx.emitChange('sort');
}
export function getSortDirectionHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  const field = ctx.getColumnField?.(column) ?? column.field;
  const lookup = ctx.sortStateLookup?.();
  if (lookup instanceof Map) {
    return lookup.get(String(field))?.direction || null;
  }
  const state = ctx.sortStates().find((s: LooseValue) => s.field === column.field);
  return state?.direction || null;
}
export function getSortOrderHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  const field = ctx.getColumnField?.(column) ?? column.field;
  const lookup = ctx.sortStateLookup?.();
  if (lookup instanceof Map) {
    const state = lookup.get(String(field));
    return state?.order !== undefined ? state.order + 1 : null;
  }
  const state = ctx.sortStates().find((s: LooseValue) => s.field === column.field);
  return state?.order !== undefined ? state.order + 1 : null;
}
export function onFilterHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column, value] = args;
  if (column.filterable === false) return;
  const field = column.field as string;
  let changed = false;
  ctx.filterStates.update((states: LooseValue) => {
    const filtered = states.filter((s: LooseValue) => s.field !== field);
    const current = states.find((s: LooseValue) => s.field === field);
    if (value !== null && value !== undefined && value !== '') {
      const nextValue = serializeFilterComparisonValue(value);
      if (
        current &&
        current.operator === 'contains' &&
        serializeFilterComparisonValue(current.value ?? '') === nextValue &&
        filtered.length + 1 === states.length
      ) {
        return states;
      }
      changed = true;
      return [...filtered, { field, value, operator: 'contains' }];
    }
    changed = filtered.length !== states.length;
    return filtered;
  });
  if (!changed) {
    return;
  }
  // Reset to first page when filtering
  ctx.paginationState.update((state: LooseValue) => ({ ...state, currentPage: 1 }));
  ctx.emitChange('filter');
}
export function getFilterValueHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  const state = ctx.filterStates().find((s: LooseValue) => s.field === column.field);
  if (!state) {
    return '';
  }
  return Array.isArray(state.value) ? '' : state.value;
}
export function clearFiltersHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (ctx.filterStates().length === 0) {
    return;
  }
  ctx.filterStates.set([]);
  ctx.paginationState.update((state: LooseValue) => ({ ...state, currentPage: 1 }));
  ctx.emitChange('filter');
}
export function hasActiveFilterHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [field] = args;
  const fieldName =
    typeof field === 'string' || typeof field === 'number' || typeof field === 'symbol'
      ? String(field)
      : (field.field as string);
  const lookup = ctx.activeFilterFieldLookup?.();
  if (lookup instanceof Set) {
    return lookup.has(fieldName);
  }
  return ctx
    .filterStates()
    .some(
      (s: LooseValue) =>
        s.field === fieldName && s.operator !== 'globalSearch' && s.operator !== 'menuSearch'
    );
}

function serializeFilterComparisonValue(value: unknown): string {
  if (value === undefined) {
    return '__undefined__';
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function onGlobalSearchHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [searchTerm] = args;
  const nextSearchTerm = String(searchTerm ?? '').trim();
  const searchableColumns = ctx.columns.filter((col: LooseValue) => col.filterable !== false);
  const searchableFields = searchableColumns.map((col: LooseValue) => String(col.field));
  const previousGlobalFilters = ctx
    .filterStates()
    .filter((s: LooseValue) => s.operator === 'globalSearch');
  const previousGlobalFields = new Set(
    previousGlobalFilters.map((filter: LooseValue) => String(filter.field))
  );
  const globalFiltersUnchanged =
    previousGlobalFilters.length === searchableFields.length &&
    searchableFields.every((field: string) => previousGlobalFields.has(field)) &&
    previousGlobalFilters.every((filter: LooseValue) => filter.value === nextSearchTerm);
  if (ctx.globalSearchTerm === nextSearchTerm && nextSearchTerm && globalFiltersUnchanged) {
    return;
  }
  ctx.globalSearchTerm = nextSearchTerm;
  if (!ctx.globalSearchTerm || searchableColumns.length === 0) {
    // Clear all text-based filters when search is empty or no searchable columns remain.
    let changed = false;
    ctx.filterStates.update((states: LooseValue) => {
      const nextStates = states.filter((s: LooseValue) => s.operator !== 'globalSearch');
      changed = nextStates.length !== states.length;
      return nextStates;
    });
    if (!changed) {
      return;
    }
    ctx.paginationState.update((state: LooseValue) => ({ ...state, currentPage: 1 }));
    ctx.emitChange('filter');
    return;
  }
  // Apply global search across all filterable columns
  // This creates an OR condition (any column matches)
  const globalFilters: FilterState[] = searchableColumns.map((col: LooseValue) => ({
    field: col.field as string,
    value: ctx.globalSearchTerm,
    operator: 'globalSearch' as FilterOperator
  }));
  ctx.filterStates.update((states: LooseValue) => [
    ...states.filter((s: LooseValue) => s.operator !== 'globalSearch'),
    ...globalFilters
  ]);
  ctx.paginationState.update((state: LooseValue) => ({ ...state, currentPage: 1 }));
  ctx.emitChange('filter');
}
export function updatePaginationStateHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [totalRecords] = args;
  ctx.paginationState.update((state: LooseValue) => {
    const stableTotalRecords =
      ctx.config?.remoteData &&
      ctx.loading &&
      Number(totalRecords) === 0 &&
      ((ctx.dataSignal?.() as LooseValue[] | undefined) ?? []).length === 0
        ? Math.max(0, Number(state.totalRecords ?? 0))
        : Number(totalRecords);
    const totalPages = Math.max(1, Math.ceil(stableTotalRecords / (state.pageSize || 1)));
    return {
      ...state,
      totalRecords: stableTotalRecords,
      totalPages,
      currentPage: state.currentPage > totalPages ? 1 : Math.max(1, state.currentPage)
    };
  });
}
export function onPageChangeHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [page] = args;
  ctx.paginationState.update((state: LooseValue) => ({ ...state, currentPage: page }));
  // Force change detection for OnPush strategy.
  ctx.cdr.markForCheck();
  ctx.emitChange('page');
}
export function getStartRecordIndexHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const { currentPage, pageSize, totalRecords } = ctx.paginationState();
  if (totalRecords === 0) return 0;
  return (currentPage - 1) * pageSize;
}
export function getEndRecordIndexHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const { currentPage, pageSize, totalRecords } = ctx.paginationState();
  if (totalRecords === 0) return 0;
  return Math.min(currentPage * pageSize, totalRecords);
}

export function getRowSelectionNumberHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [row, rowIndex] = args;
  if (!row || isAppendRow(row)) return null;
  const explicitIndex = Number(rowIndex);
  const resolvedIndex =
    Number.isFinite(explicitIndex) && explicitIndex >= 0
      ? explicitIndex
      : Number(ctx.getGlobalRowIndex(row));
  if (!Number.isFinite(resolvedIndex) || resolvedIndex < 0) {
    return null;
  }
  const pageOffset = ctx.config?.remoteData ? Number(getStartRecordIndexHelper(ctx) ?? 0) : 0;
  return pageOffset + resolvedIndex + 1;
}

function isAppendRow(row: LooseValue): boolean {
  return !!row && typeof row === 'object' && !!(row as Record<string, unknown>)['__appendRow'];
}

export function isAppendRowHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [row] = args;
  return isAppendRow(row);
}

function getVisibleSelectableRows(ctx: HelperContext): LooseValue[] {
  const source =
    typeof ctx.selectableRowsSnapshot === 'function'
      ? ctx.selectableRowsSnapshot()
      : typeof ctx.processedData === 'function'
        ? ctx.processedData()
        : [];
  const seen = new Set<LooseValue>();
  const rows: LooseValue[] = [];
  for (const row of Array.isArray(source) ? source : []) {
    if (isAppendRow(row) || seen.has(row)) {
      continue;
    }
    seen.add(row);
    rows.push(row);
  }
  return rows;
}

function getScopedGroupRows(ctx: HelperContext, scope: LooseValue): LooseValue[] {
  if (!scope || typeof scope !== 'object') {
    return [];
  }
  const trustedRows = getTrustedGroupRows(scope);
  if (trustedRows) {
    return trustedRows;
  }
  const scopedRows = Array.isArray((scope as Record<string, unknown>)['rows'])
    ? ((scope as Record<string, unknown>)['rows'] as LooseValue[])
    : typeof ctx.getGroupData === 'function'
      ? (ctx.getGroupData(scope) as LooseValue[])
      : [];
  const cached = scopedGroupRowsCache.get(scope as object);
  if (cached && cached.source === scopedRows) {
    return cached.rows;
  }
  const sourceRows = Array.isArray(scopedRows) ? scopedRows : [];
  const seen = new Set<LooseValue>();
  let rows: LooseValue[] | null = null;
  for (let index = 0; index < sourceRows.length; index += 1) {
    const row = sourceRows[index];
    const excluded = isAppendRow(row) || seen.has(row);
    if (excluded) {
      if (!rows) {
        rows = sourceRows.slice(0, index);
      }
      continue;
    }
    seen.add(row);
    if (rows) {
      rows.push(row);
    }
  }
  const resolvedRows = rows ?? sourceRows;
  scopedGroupRowsCache.set(scope as object, {
    source: Array.isArray(scopedRows) ? scopedRows : null,
    rows: resolvedRows
  });
  return resolvedRows;
}

function getTrustedGroupRows(scope: LooseValue): LooseValue[] | null {
  if (!scope || typeof scope !== 'object') {
    return null;
  }

  const record = scope as Record<string, unknown>;
  const rows = record['rows'];
  if (!Array.isArray(rows)) {
    return null;
  }

  const count = Number(record['count']);
  if (!Number.isFinite(count) || Math.floor(count) !== rows.length) {
    return null;
  }

  // Rows produced by the DataGrid grouping pipeline already exclude append rows.
  return typeof record['id'] === 'string' && typeof record['field'] === 'string'
    ? (rows as LooseValue[])
    : null;
}

function countRowsInLookup(rows: LooseValue[], lookup: Set<LooseValue>): number {
  let count = 0;
  for (const row of rows) {
    if (lookup.has(row)) {
      count += 1;
    }
  }
  return count;
}

function getGroupSelectionState(
  ctx: HelperContext,
  group: LooseValue
): {
  rows: LooseValue[];
  selectedLookup: Set<LooseValue>;
  selectedCount: number;
} {
  const rows = getScopedGroupRows(ctx, group);
  const totalSelected = getSelectedRowCount(ctx);
  const selectedLookup =
    totalSelected > 0
      ? (ctx.selectedRowLookup?.() ?? new Set(ctx.selectedRows()))
      : emptySelectionLookup;
  if (group && typeof group === 'object') {
    const cached = groupSelectionStateCache.get(group as object);
    if (cached && cached.rows === rows && cached.selectedLookup === selectedLookup) {
      return cached;
    }
  }

  const state = {
    rows,
    selectedLookup,
    selectedCount: totalSelected > 0 ? countRowsInLookup(rows, selectedLookup) : 0
  };
  if (group && typeof group === 'object') {
    groupSelectionStateCache.set(group as object, state);
  }
  return state;
}

function getIndexedRowPosition(
  lookupFactory: (() => WeakMap<object, number>) | undefined,
  row: LooseValue
): number | null {
  if (!row || typeof row !== 'object' || typeof lookupFactory !== 'function') {
    return null;
  }

  const index = lookupFactory().get(row as object);
  return index === undefined ? null : index;
}

function normalizeSelectionIndex(value: LooseValue): number | null {
  const index = Number(value);
  return Number.isFinite(index) && index >= 0 ? Math.floor(index) : null;
}

function getSelectedRowCount(ctx: HelperContext): number {
  if (typeof ctx.selectedRowCount === 'function') {
    const value = Number(ctx.selectedRowCount());
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }

  const rows = ctx.selectedRows?.();
  return Array.isArray(rows) ? rows.length : 0;
}

function getGroupRowCountHint(scope: LooseValue): number | null {
  if (!scope || typeof scope !== 'object') {
    return null;
  }

  const count = Number((scope as Record<string, unknown>)['count']);
  if (!Number.isFinite(count) || count < 0) {
    return null;
  }

  return Math.floor(count);
}

function buildGroupSelectionViewState(
  selectedCount: number,
  loadedTotal: number,
  hintedTotal: number | null
): GroupSelectionViewState {
  const total = hintedTotal ?? loadedTotal;
  if (!total) {
    return emptyGroupSelectionViewState;
  }

  return {
    checked: loadedTotal > 0 && selectedCount === loadedTotal,
    partial: loadedTotal > 0 && selectedCount > 0 && selectedCount < loadedTotal,
    title:
      selectedCount === 0
        ? `0 of ${total} rows selected`
        : `${selectedCount} of ${total} rows selected`
  };
}

function emitSelectionChange(ctx: HelperContext): void {
  ctx.onSelectionChange.emit(ctx.selectedRows());
  ctx.emitChange('selection');
}

function emitSelectionChangeAfterPaint(ctx: HelperContext): void {
  if (!ctx || typeof ctx !== 'object') {
    emitSelectionChange(ctx);
    return;
  }

  const key = ctx as object;
  const currentTimer = deferredSelectionChangeTimers.get(key);
  if (currentTimer?.timeout) {
    clearTimeout(currentTimer.timeout);
  }
  if (typeof cancelAnimationFrame === 'function' && typeof currentTimer?.frame === 'number') {
    cancelAnimationFrame(currentTimer.frame);
  }

  const handle: { timeout?: ReturnType<typeof setTimeout>; frame?: number } = {};
  const scheduleEmit = (): void => {
    handle.timeout = setTimeout(() => {
      deferredSelectionChangeTimers.delete(key);
      emitSelectionChange(ctx);
    }, 0);
    deferredSelectionChangeTimers.set(key, handle);
  };

  ctx.cdr?.markForCheck?.();
  if (typeof requestAnimationFrame === 'function') {
    handle.frame = requestAnimationFrame(() => {
      if (deferredSelectionChangeTimers.get(key) !== handle) {
        return;
      }
      scheduleEmit();
    });
    deferredSelectionChangeTimers.set(key, handle);
    return;
  }

  deferredSelectionChangeTimers.set(key, handle);
  scheduleEmit();
}

function getSelectionSnapshot(ctx: HelperContext): LooseValue[] {
  const rows = ctx.selectedRows?.();
  return Array.isArray(rows) ? [...rows] : [];
}

function setSelectionUndoState(ctx: HelperContext, snapshot: LooseValue[], label: string): void {
  if (typeof ctx.selectionUndoSnapshot?.set === 'function') {
    ctx.selectionUndoSnapshot.set(snapshot);
  }
  if (typeof ctx.selectionUndoLabel?.set === 'function') {
    ctx.selectionUndoLabel.set(label);
  }
}

function clearSelectionUndoState(ctx: HelperContext): void {
  if (typeof ctx.selectionUndoSnapshot?.set === 'function') {
    ctx.selectionUndoSnapshot.set(null);
  }
  if (typeof ctx.selectionUndoLabel?.set === 'function') {
    ctx.selectionUndoLabel.set('');
  }
}

function haveSameSelection(left: LooseValue[], right: LooseValue[]): boolean {
  return left.length === right.length && left.every((row, index) => row === right[index]);
}

function applySelectionWithUndo(
  ctx: HelperContext,
  nextSelection: LooseValue[],
  undoLabel: string
): void {
  const previousSelection = getSelectionSnapshot(ctx);
  if (haveSameSelection(previousSelection, nextSelection)) {
    return;
  }
  setSelectionUndoState(ctx, previousSelection, undoLabel);
  ctx.selectedRows.set(nextSelection);
  ctx.cdr?.markForCheck?.();
  if (
    previousSelection.length > LARGE_SELECTION_SYNC_EMIT_LIMIT ||
    nextSelection.length > LARGE_SELECTION_SYNC_EMIT_LIMIT
  ) {
    emitSelectionChangeAfterPaint(ctx);
    return;
  }
  emitSelectionChange(ctx);
}

function normalizeSelectionRows(rows: LooseValue[]): LooseValue[] {
  const next: LooseValue[] = [];
  const seen = new Set<LooseValue>();

  for (const row of Array.isArray(rows) ? rows : []) {
    if (isAppendRow(row) || seen.has(row)) {
      continue;
    }
    seen.add(row);
    next.push(row);
  }

  return next;
}

export function replaceSelectionHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [rows, options] = args as [
    LooseValue[] | null | undefined,
    { emitChange?: boolean; preserveUndo?: boolean } | null | undefined
  ];
  const nextSelection = normalizeSelectionRows(Array.isArray(rows) ? rows : []);
  const currentSelection = getSelectionSnapshot(ctx);

  if (haveSameSelection(currentSelection, nextSelection)) {
    return;
  }

  if (options?.preserveUndo !== true) {
    clearSelectionUndoState(ctx);
  }

  ctx.selectedRows.set(nextSelection);
  ctx.cdr?.markForCheck?.();

  if (options?.emitChange !== false) {
    emitSelectionChange(ctx);
  }
}

export function clearSelectionUndoHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  clearSelectionUndoState(ctx);
}

export function undoSelectionChangeHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const snapshot =
    typeof ctx.selectionUndoSnapshot === 'function' ? ctx.selectionUndoSnapshot() : null;
  if (!Array.isArray(snapshot)) {
    return;
  }
  ctx.selectedRows.set([...snapshot]);
  ctx.cdr?.markForCheck?.();
  clearSelectionUndoState(ctx);
  emitSelectionChange(ctx);
}

export function toggleSelectAllHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (ctx.allSelected()) {
    applySelectionWithUndo(ctx, [], 'Visible selection restored');
  } else {
    applySelectionWithUndo(ctx, getVisibleSelectableRows(ctx), 'Previous selection restored');
  }
}
export function toggleRowSelectionHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [row, event, rowIndex] = args;
  if (isAppendRow(row)) {
    return;
  }
  const selected = ctx.selectedRows();
  const selectedLookup = ctx.selectedRowLookup?.() ?? new Set(selected);
  const isSelected = selectedLookup.has(row);
  const explicitRowIndex = normalizeSelectionIndex(rowIndex);
  let indexedPosition: number | null | undefined;
  let processedRows: LooseValue[] | null = null;
  const resolveProcessedRows = (): LooseValue[] => {
    if (!processedRows) {
      const rows = ctx.processedData?.();
      processedRows = Array.isArray(rows) ? rows : [];
    }
    return processedRows ?? [];
  };
  const resolveCurrentIndex = () => {
    if (explicitRowIndex !== null) {
      return explicitRowIndex;
    }
    if (indexedPosition === undefined) {
      indexedPosition = getIndexedRowPosition(ctx.processedDataRowIndexLookup, row);
    }
    if (indexedPosition !== null) {
      return indexedPosition;
    }
    return resolveProcessedRows().indexOf(row);
  };

  if (ctx.config.selectMode === 'single') {
    applySelectionWithUndo(ctx, isSelected ? [] : [row], 'Previous selection restored');
    ctx.lastSelectedIndex = resolveCurrentIndex();
  } else {
    // Shift+Click for range selection
    const shouldSelectRange = event?.shiftKey && ctx.lastSelectedIndex >= 0;
    const currentIndex =
      shouldSelectRange ||
      explicitRowIndex !== null ||
      typeof ctx.processedDataRowIndexLookup === 'function'
        ? resolveCurrentIndex()
        : -1;
    if (shouldSelectRange && currentIndex >= 0 && ctx.lastSelectedIndex !== currentIndex) {
      const allRows = resolveProcessedRows();
      const start = Math.min(ctx.lastSelectedIndex, currentIndex);
      const end = Math.max(ctx.lastSelectedIndex, currentIndex);
      const rangeRows = allRows.slice(start, end + 1);
      // Add all rows in range to selection
      const newSelected = [...selected];
      const newSelectedLookup = new Set(selected);
      rangeRows.forEach((r: LooseValue) => {
        if (!newSelectedLookup.has(r)) {
          newSelected.push(r);
          newSelectedLookup.add(r);
        }
      });
      applySelectionWithUndo(ctx, newSelected, 'Previous selection restored');
    } else {
      // Normal toggle
      if (isSelected) {
        applySelectionWithUndo(
          ctx,
          selected.filter((candidate: LooseValue) => candidate !== row),
          'Previous selection restored'
        );
      } else {
        applySelectionWithUndo(ctx, [...selected, row], 'Previous selection restored');
      }
      if (currentIndex >= 0) {
        ctx.lastSelectedIndex = currentIndex;
      }
    }
  }
}
export function isRowSelectedHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [row] = args;
  return (ctx.selectedRowLookup?.() ?? new Set(ctx.selectedRows())).has(row);
}
export function toggleGroupSelectionHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [group, event] = args;
  event?.stopPropagation?.();

  const hintedTotal = getGroupRowCountHint(group);
  const selectedCount = getSelectedRowCount(ctx);
  const cachedView =
    group && typeof group === 'object'
      ? groupSelectionViewStateCache.get(group as object)?.viewState
      : null;
  let shouldSelectGroup = selectedCount === 0 || !cachedView?.checked;
  let groupRows: LooseValue[] | null = null;
  let loadedTotal = hintedTotal ?? 0;
  const directRows =
    group && typeof group === 'object' && Array.isArray((group as Record<string, unknown>)['rows'])
      ? ((group as Record<string, unknown>)['rows'] as LooseValue[])
      : null;

  if (selectedCount > 0 && !cachedView) {
    const groupSelection = getGroupSelectionState(ctx, group);
    groupRows = groupSelection.rows;
    loadedTotal = groupRows.length;
    shouldSelectGroup = groupSelection.selectedCount !== groupRows.length;
  }

  const trustedRows = getTrustedGroupRows(group);
  if (groupRows === null && trustedRows) {
    groupRows = trustedRows;
    loadedTotal = groupRows.length;
  }

  if (groupRows === null && directRows && directRows.length <= LARGE_SELECTION_SYNC_EMIT_LIMIT) {
    groupRows = getScopedGroupRows(ctx, group);
    loadedTotal = groupRows.length;
  }

  if (!loadedTotal && groupRows === null && hintedTotal === null) {
    groupRows = getScopedGroupRows(ctx, group);
    loadedTotal = groupRows.length;
  }

  if (!loadedTotal && (!groupRows || !groupRows.length)) {
    return;
  }

  const applyGroupSelection = (): void => {
    const rows = groupRows ?? getScopedGroupRows(ctx, group);
    if (!rows.length) {
      ctx.cdr?.markForCheck?.();
      return;
    }

    const selected = ctx.selectedRows();
    if (!shouldSelectGroup) {
      const groupLookup = new Set(rows);
      applySelectionWithUndo(
        ctx,
        selected.filter((row: LooseValue) => !groupLookup.has(row)),
        'Group selection restored'
      );
    } else {
      const next = [...selected];
      const nextLookup = new Set(selected);
      for (const row of rows) {
        if (!nextLookup.has(row)) {
          next.push(row);
          nextLookup.add(row);
        }
      }
      applySelectionWithUndo(ctx, next, 'Group selection restored');
    }

    ctx.cdr?.markForCheck?.();
  };

  applyGroupSelection();
}
export function isGroupSelectedHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [group] = args;
  const selectedCount = getSelectedRowCount(ctx);
  if (selectedCount === 0) {
    return false;
  }
  const groupSelection = getGroupSelectionState(ctx, group);
  if (!groupSelection.rows.length) {
    return false;
  }
  return groupSelection.selectedCount === groupSelection.rows.length;
}
export function isGroupPartiallySelectedHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [group] = args;
  if (getSelectedRowCount(ctx) === 0) {
    return false;
  }
  const groupSelection = getGroupSelectionState(ctx, group);
  if (!groupSelection.rows.length) {
    return false;
  }
  return (
    groupSelection.selectedCount > 0 && groupSelection.selectedCount < groupSelection.rows.length
  );
}
export function getGroupSelectionViewStateHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [group] = args;
  const selectedCount = getSelectedRowCount(ctx);
  const hintedTotal = getGroupRowCountHint(group);
  if (selectedCount === 0 && hintedTotal !== null) {
    const cached =
      group && typeof group === 'object' ? groupSelectionViewStateCache.get(group as object) : null;
    if (
      cached &&
      cached.rows === null &&
      cached.selectedLookup === null &&
      cached.selectedCount === 0 &&
      cached.hintedTotal === hintedTotal
    ) {
      return cached.viewState;
    }
    const viewState =
      hintedTotal > 0
        ? {
            checked: false,
            partial: false,
            title: `0 of ${hintedTotal} rows selected`
          }
        : emptyGroupSelectionViewState;
    if (group && typeof group === 'object') {
      groupSelectionViewStateCache.set(group as object, {
        rows: null,
        selectedLookup: null,
        selectedCount: 0,
        hintedTotal,
        viewState
      });
    }
    return viewState;
  }

  const groupSelection = getGroupSelectionState(ctx, group);
  const cached =
    group && typeof group === 'object' ? groupSelectionViewStateCache.get(group as object) : null;
  if (
    cached &&
    cached.rows === groupSelection.rows &&
    cached.selectedLookup === groupSelection.selectedLookup &&
    cached.selectedCount === groupSelection.selectedCount &&
    cached.hintedTotal === hintedTotal
  ) {
    return cached.viewState;
  }

  const loadedTotal = groupSelection.rows.length;
  const total = hintedTotal ?? loadedTotal;
  if (!total) {
    return emptyGroupSelectionViewState;
  }

  const viewState = buildGroupSelectionViewState(
    groupSelection.selectedCount,
    loadedTotal,
    hintedTotal
  );
  if (group && typeof group === 'object') {
    groupSelectionViewStateCache.set(group as object, {
      rows: groupSelection.rows,
      selectedLookup: groupSelection.selectedLookup,
      selectedCount: groupSelection.selectedCount,
      hintedTotal,
      viewState
    });
  }
  return viewState;
}
export function getGroupSelectionSummaryHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [group] = args;
  const selectedCount = getSelectedRowCount(ctx);
  const hintedTotal = getGroupRowCountHint(group);
  if (selectedCount === 0 && hintedTotal !== null) {
    return hintedTotal > 0 ? `0 of ${hintedTotal} rows selected` : 'No rows in this group';
  }

  const groupSelection = getGroupSelectionState(ctx, group);
  const total = hintedTotal ?? groupSelection.rows.length;
  if (!total) {
    return 'No rows in this group';
  }
  if (selectedCount === 0) {
    return `0 of ${total} rows selected`;
  }
  return `${groupSelection.selectedCount} of ${total} rows selected`;
}
export async function copySelectionInsightsHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): Promise<LooseValue> {
  const insights = ctx.selectionInsights();
  if (!insights) {
    return;
  }
  const payload = {
    selectedCount: insights.count,
    percentageOfData: insights.percentage,
    metrics: insights.metrics
  };
  const text = JSON.stringify(payload, null, 2);
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    } else {
      ctx.copyTextFallback(text);
    }
    if (typeof ctx.showCopyFeedback === 'function') {
      ctx.showCopyFeedback('Selection insights copied');
    } else {
      ctx.showAutoSave('Selection insights copied');
    }
  } catch (error) {
    reportGridError('Failed to copy selection insights', error);
    showGridAlert(GRID_FEEDBACK_MESSAGES.unableToCopySelectionInsights);
  }
}
export function startEditHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [rowIndex, column] = args;
  if (!column.editable || ctx.config.editMode === 'none') return;
  const processedRows = ctx.processedData?.();
  const targetRow = Array.isArray(processedRows) ? processedRows[rowIndex] : null;
  if (
    targetRow &&
    typeof column.canEdit === 'function' &&
    column.canEdit(targetRow, column) === false
  ) {
    return;
  }
  if (targetRow && typeof targetRow === 'object' && (targetRow as LooseValue).__appendRow) {
    return;
  }
  const field = String(column.field as string);
  ctx.editingCell.set({ rowIndex, field });
  focusEditingInput(ctx, rowIndex, field);
}
export function cancelEditHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  ctx.editingCell.set(null);
}
export function saveEditHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [row, column, value] = args;
  const field = column.field as string;
  const oldValue = (row as LooseValue)[field];
  const editingPosition = ctx.editingCell();
  // Validate if validator is provided
  if (column.validator) {
    const validation = column.validator(value, row);
    if (validation !== true) {
      showGridAlert(getValidationFeedbackMessage(validation));
      return;
    }
  }
  // Update value
  (row as LooseValue)[field] = value;
  ctx.invalidateFilteredSortedCache();
  ctx.columnRangeCache?.delete?.(field);
  ctx.columnStatsCache?.delete?.(field);
  ctx.cellValueCache?.clear?.();
  ctx.spreadsheetFormulaCache?.clear?.();
  ctx.bumpAggregateCache?.();
  ctx.onCellEdit.emit({ row, field, value });
  if (editingPosition) {
    ctx.flashCell(editingPosition.rowIndex, field);
  }
  let insertedRow: LooseValue | null = null;
  ctx.editingCell.set(null);
  const shouldNavigateAfterEdit =
    ctx.config.enterNavigatesNextCell && !ctx.suppressNextEditNavigation;
  if (shouldNavigateAfterEdit && editingPosition) {
    const visibleColumns = ctx.visibleColumns();
    const currentColumnIndex = visibleColumns.findIndex(
      (candidate: LooseValue) => candidate.field === column.field
    );
    if (currentColumnIndex >= 0) {
      const direction = ctx.config.enterNavigationDirection === 'down' ? 'down' : 'right';
      const processedRows = Array.isArray(ctx.processedData?.()) ? ctx.processedData() : [];
      const totalRows = processedRows.length;
      let nextRowIndex =
        direction === 'down'
          ? Math.min(Math.max(0, totalRows - 1), editingPosition.rowIndex + 1)
          : editingPosition.rowIndex;
      const nextColumnIndex =
        direction === 'down'
          ? currentColumnIndex
          : Math.min(visibleColumns.length - 1, currentColumnIndex + 1);
      if (
        direction === 'down' &&
        processedRows[nextRowIndex] &&
        typeof processedRows[nextRowIndex] === 'object' &&
        (processedRows[nextRowIndex] as LooseValue).__appendRow
      ) {
        if (
          ctx.config.appendRow &&
          typeof ctx.buildEmptyRow === 'function' &&
          typeof ctx.assignRowKey === 'function' &&
          typeof ctx.insertRowAfter === 'function'
        ) {
          insertedRow = ctx.buildEmptyRow();
          ctx.assignRowKey(insertedRow);
          ctx.insertRowAfter(row, insertedRow, 'append');
          nextRowIndex = editingPosition.rowIndex + 1;
        } else {
          nextRowIndex = editingPosition.rowIndex;
        }
      }
      ctx.emitChange('edit');
      ctx.activeCell.set({
        rowIndex: nextRowIndex,
        columnIndex: nextColumnIndex
      });
      if (typeof ctx.scrollToActiveCell === 'function') {
        ctx.scrollToActiveCell();
      }

      const moved =
        nextColumnIndex !== currentColumnIndex || nextRowIndex !== editingPosition.rowIndex;
      if (moved) {
        const nextColumn = visibleColumns[nextColumnIndex];
        if (nextColumn?.editable && ctx.config.editMode !== 'none') {
          ctx.startEdit(nextRowIndex, nextColumn);
        }
      }
      return;
    }
  }
  if (editingPosition && typeof ctx.activeCell?.set === 'function') {
    const visibleColumns = Array.isArray(ctx.visibleColumns?.()) ? ctx.visibleColumns() : [];
    const currentColumnIndex = visibleColumns.findIndex(
      (candidate: LooseValue) => candidate.field === column.field
    );
    if (currentColumnIndex >= 0) {
      const active = typeof ctx.activeCell === 'function' ? ctx.activeCell() : null;
      if (
        active?.rowIndex !== editingPosition.rowIndex ||
        active?.columnIndex !== currentColumnIndex
      ) {
        ctx.activeCell.set({
          rowIndex: editingPosition.rowIndex,
          columnIndex: currentColumnIndex
        });
      }
    }
  }
  ctx.emitChange('edit');
}
export function isEditingHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [rowIndex, column] = args;
  const editing = ctx.editingCell();
  return editing?.rowIndex === rowIndex && editing?.field === column.field;
}
export async function exportDataHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): Promise<LooseValue> {
  const [format] = args;
  const scope: ExportScope = 'all';
  const exportMeta = ctx.buildExportMeta(scope);
  const options: ExportOptions = {
    format,
    fileName: ctx.buildExportFileName(scope),
    allData: true,
    selectedOnly: false,
    includeHeaders: true
  };
  ctx.onExport.emit(options);
  // Use service to export
  const dataToExport = options.selectedOnly ? ctx.selectedRows() : ctx.dataSignal();
  switch (format) {
    case 'excel':
      await ctx.gridService.exportToExcel(
        dataToExport,
        ctx.visibleColumns(),
        options.fileName!,
        exportMeta
      );
      break;
    case 'csv':
      ctx.gridService.exportToCSV(
        dataToExport,
        ctx.visibleColumns(),
        options.fileName!,
        exportMeta
      );
      break;
    case 'pdf':
      await ctx.gridService.exportToPDF(
        dataToExport,
        ctx.visibleColumns(),
        options.fileName!,
        exportMeta
      );
      break;
  }
}
export function setExportScopeHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [scope] = args;
  ctx.exportScope.set(scope);
}
export function setExportFormatHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [format] = args;
  ctx.exportFormat.set(format);
}
export function getExportFormatsHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  return ctx.getAvailableExportFormats();
}
export function getExportFormatLabelHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [format] = args;
  switch (format) {
    case 'excel':
      return 'Excel';
    case 'csv':
      return 'CSV';
    case 'pdf':
      return 'PDF';
    default:
      return format;
  }
}
export function getAvailableExportFormatsHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const formats = ctx.config.exportFormats?.length
    ? ctx.config.exportFormats
    : ctx.defaultConfig.exportFormats;
  return (formats?.length ? formats : ['excel']) as ('excel' | 'csv' | 'pdf')[];
}
export function syncExportFormatHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const formats = ctx.getAvailableExportFormats();
  const current = ctx.exportFormat();
  if (!formats.includes(current)) {
    ctx.exportFormat.set(formats[0] ?? 'excel');
  }
}
export function getFilteredVisibleDataHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  // Get currently displayed data (after filters, search, but before pagination)
  return ctx.processedData();
}
export function buildExportMetaHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [scope] = args;
  const baseTitle = ctx.getExportTitleBase();
  const scopeLabel = ctx.getExportScopeLabel(scope);
  const title = scopeLabel ? `${baseTitle} (${scopeLabel})` : baseTitle;
  return {
    title,
    subtitle: ctx.config.exportSubtitle,
    scopeLabel: scopeLabel || undefined,
    appName: ctx.config.exportAppName,
    footerText: ctx.config.exportFooter,
    generatedAt: new Date()
  };
}
export function getExportTitleBaseHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const configTitle = ctx.config.exportTitle || ctx.config.ariaLabel;
  const docTitle = typeof document !== 'undefined' ? document.title : '';
  const raw = (configTitle || docTitle || 'ENGINEERS_SALARY_REFERENCE Export').trim();
  return raw || 'ENGINEERS_SALARY_REFERENCE Export';
}
export function getExportFileBaseHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const docTitle = typeof document !== 'undefined' ? document.title : '';
  const raw = (
    ctx.config.exportFileName ||
    ctx.config.exportTitle ||
    ctx.config.ariaLabel ||
    docTitle ||
    'engineers-salary-reference_export'
  ).trim();
  return ctx.sanitizeFileName(raw) || 'engineers-salary-reference_export';
}
export function getExportScopeLabelHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [scope] = args;
  switch (scope) {
    case 'all':
      return 'All Data';
    case 'selected':
      return 'Selected Rows';
    case 'filtered':
      return 'Filtered Data';
    case 'visible':
      return 'Visible Data';
    case 'row':
      return 'Single Row';
    default:
      return '';
  }
}
export function getExportScopeSlugHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [scope] = args;
  switch (scope) {
    case 'all':
      return 'all';
    case 'selected':
      return 'selected';
    case 'filtered':
      return 'filtered';
    case 'visible':
      return 'visible';
    case 'row':
      return 'row';
    default:
      return 'export';
  }
}
export function buildExportFileNameHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [scope] = args;
  const base = ctx.getExportFileBase();
  const scopeSlug = ctx.getExportScopeSlug(scope);
  return scopeSlug ? `${base}_${scopeSlug}` : base;
}
export function sanitizeFileNameHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [value] = args;
  return String(value || '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}
export async function exportDataAdvancedHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): Promise<LooseValue> {
  const scope = ctx.exportScope();
  const format = ctx.exportFormat();
  let dataToExport: T[] = [];
  switch (scope) {
    case 'all':
      dataToExport = ctx.dataSignal();
      break;
    case 'selected':
      dataToExport = ctx.selectedRows();
      if (dataToExport.length === 0) {
        showGridAlert(GRID_FEEDBACK_MESSAGES.selectRowsToExport);
        return;
      }
      break;
    case 'filtered':
      dataToExport = ctx.getFilteredVisibleData();
      if (dataToExport.length === 0) {
        showGridAlert(GRID_FEEDBACK_MESSAGES.noFilteredDataToExport);
        return;
      }
      break;
  }
  const exportMeta = ctx.buildExportMeta(scope);
  const options: ExportOptions = {
    format,
    fileName: ctx.buildExportFileName(scope),
    allData: scope === 'all',
    selectedOnly: scope === 'selected',
    includeHeaders: true
  };
  ctx.onExport.emit(options);
  switch (format) {
    case 'excel':
      await ctx.gridService.exportToExcel(
        dataToExport,
        ctx.visibleColumns(),
        options.fileName!,
        exportMeta
      );
      break;
    case 'csv':
      ctx.gridService.exportToCSV(
        dataToExport,
        ctx.visibleColumns(),
        options.fileName!,
        exportMeta
      );
      break;
    case 'pdf':
      await ctx.gridService.exportToPDF(
        dataToExport,
        ctx.visibleColumns(),
        options.fileName!,
        exportMeta
      );
      break;
  }
}
export function canSaveCurrentFiltersHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  return ctx.filterStates().length > 0 || ctx.globalSearchTerm.trim().length > 0;
}
export function openSavePresetDialogHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (!ctx.canSaveCurrentFilters()) {
    showGridAlert(GRID_FEEDBACK_MESSAGES.noActiveFiltersToSave);
    return;
  }
  ctx.showSavePresetDialog.set(true);
  ctx.newPresetName = '';
}
export function closeSavePresetDialogHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  ctx.showSavePresetDialog.set(false);
  ctx.newPresetName = '';
}
export function saveCurrentFiltersAsPresetHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const name = ctx.newPresetName.trim();
  if (!name) {
    showGridAlert(GRID_FEEDBACK_MESSAGES.enterPresetName);
    return;
  }
  const existing = ctx.savedFilterPresets().find((p: LooseValue) => p.name === name);
  if (existing) {
    requestGridConfirm(getOverwritePresetConfirmMessage(name), {
      actionLabel: 'Overwrite',
      tone: 'warning',
      onConfirm: () => {
        ctx.deleteFilterPreset(name);
        const preset = {
          name,
          filters: [...ctx.filterStates()],
          searchTerm: ctx.globalSearchTerm || ''
        };
        ctx.savedFilterPresets.update((presets: LooseValue) => [...presets, preset]);
        ctx.savePresetsToStorage();
        ctx.closeSavePresetDialog();
      }
    });
    return;
  }
  const preset = {
    name,
    filters: [...ctx.filterStates()],
    searchTerm: ctx.globalSearchTerm || ''
  };
  ctx.savedFilterPresets.update((presets: LooseValue) => [...presets, preset]);
  ctx.savePresetsToStorage();
  ctx.closeSavePresetDialog();
}
export function applyFilterPresetHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [preset] = args;
  // Apply filters
  ctx.filterStates.set([...preset.filters]);
  // Apply search term
  ctx.globalSearchTerm = preset.searchTerm;
  // Trigger change
  ctx.emitChange('filter');
}
export function deleteFilterPresetHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [name] = args;
  ctx.savedFilterPresets.update((presets: LooseValue) =>
    presets.filter((p: LooseValue) => p.name !== name)
  );
  ctx.savePresetsToStorage();
}
export function savePresetsToStorageHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (ctx.stateKey) {
    try {
      localStorage.setItem(
        `${ctx.stateKey}_filter_presets`,
        JSON.stringify(ctx.savedFilterPresets())
      );
    } catch (error) {
      reportGridError('Failed to save filter presets:', error);
    }
  }
}
export function loadPresetsFromStorageHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  if (ctx.stateKey) {
    try {
      const saved = localStorage.getItem(`${ctx.stateKey}_filter_presets`);
      if (saved) {
        ctx.savedFilterPresets.set(JSON.parse(saved));
      }
    } catch (error) {
      reportGridError('Failed to load filter presets:', error);
    }
  }
}
export function togglePerformanceStatsHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  ctx.showPerformanceStats.update((val: LooseValue) => !val);
}

function getVisibleRowCountForStats(ctx: HelperContext): number {
  const groups = typeof ctx.groupColumns === 'function' ? ctx.groupColumns() : [];
  const groupCount = Array.isArray(groups) ? groups.length : 0;
  if (groupCount > 0 && typeof ctx.filteredSortedRowBuckets === 'function') {
    const dataRows = ctx.filteredSortedRowBuckets()?.dataRows;
    if (Array.isArray(dataRows)) {
      return dataRows.length;
    }
  }

  if (typeof ctx.processedData === 'function') {
    const rows = ctx.processedData();
    if (Array.isArray(rows)) {
      let count = 0;
      for (const row of rows) {
        if (!isAppendRow(row)) {
          count += 1;
        }
      }
      return count;
    }
  }

  if (typeof ctx.filteredSortedRowBuckets === 'function') {
    const dataRows = ctx.filteredSortedRowBuckets()?.dataRows;
    if (Array.isArray(dataRows)) {
      return dataRows.length;
    }
  }

  return ctx.displayRows().length;
}

export function getPerformanceStatsHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  return {
    totalRows: ctx.dataSignal().length,
    visibleRows: getVisibleRowCountForStats(ctx),
    selectedRows:
      typeof ctx.selectedRowCount === 'function'
        ? ctx.selectedRowCount()
        : ctx.selectedRows().length,
    activeFilters: ctx.filterStates().length,
    sortedColumns: ctx.sortStates().length,
    groupedColumns: ctx.groupColumns().length,
    renderTime: ctx.renderTime()
  };
}
export function toggleKeyboardShortcutsHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  ctx.showKeyboardShortcuts.update((val: LooseValue) => !val);
}
export function closeKeyboardShortcutsHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  ctx.showKeyboardShortcuts.set(false);
}
export function togglePinRowHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [row] = args;
  const pinnedRows = ctx.pinnedRows();
  const index = pinnedRows.findIndex((r: LooseValue) => r === row);
  if (index > -1) {
    // Unpin
    ctx.pinnedRows.update((rows: LooseValue) => rows.filter((r: LooseValue) => r !== row));
  } else {
    // Pin
    ctx.pinnedRows.update((rows: LooseValue) => [row, ...rows]);
  }
}
export function isRowPinnedHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [row] = args;
  return (ctx.pinnedRowLookup?.() ?? new Set(ctx.pinnedRows())).has(row);
}
export function unpinAllRowsHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  ctx.pinnedRows.set([]);
}
export function showAutoSaveHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [message] = args;
  ctx.autoSaveMessage.set(message);
  ctx.showAutoSaveIndicator.set(true);
  setTimeout(() => {
    ctx.showAutoSaveIndicator.set(false);
  }, 2000);
}
function syncGridFillerHoverState(ctx: HelperContext, event: LooseValue): void {
  const rowElement = event?.currentTarget as HTMLElement | null | undefined;
  const root = (ctx.elementRef?.nativeElement as HTMLElement | undefined) ?? null;
  const table = rowElement?.closest?.('.data-grid-table') as HTMLElement | null;
  if (!root || !rowElement || !table || rowElement.classList.contains('append-row')) {
    root?.style.removeProperty('--dg-grid-filler-hover-bg');
    root?.style.removeProperty('--dg-grid-filler-hover-top');
    root?.style.removeProperty('--dg-grid-filler-hover-height');
    return;
  }

  const rowRect = rowElement.getBoundingClientRect?.() ?? null;
  const tableRect = table.getBoundingClientRect?.() ?? null;
  const top =
    rowRect && tableRect && rowRect.bottom >= tableRect.top
      ? rowRect.top - tableRect.top
      : rowElement.offsetTop;
  const height = rowRect?.height ?? rowElement.offsetHeight;
  if (!Number.isFinite(top) || !Number.isFinite(height) || height <= 0) {
    return;
  }

  root.style.setProperty('--dg-grid-filler-hover-top', `${Math.max(0, top)}px`);
  root.style.setProperty('--dg-grid-filler-hover-height', `${height}px`);
  root.style.setProperty('--dg-grid-filler-hover-bg', 'var(--dg-clickup-row-hover)');
}

function clearGridFillerHoverState(ctx: HelperContext): void {
  const root = (ctx.elementRef?.nativeElement as HTMLElement | undefined) ?? null;
  root?.style.removeProperty('--dg-grid-filler-hover-bg');
  root?.style.removeProperty('--dg-grid-filler-hover-top');
  root?.style.removeProperty('--dg-grid-filler-hover-height');
}

export function onRowMouseEnterHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [rowIndex, event] = args;
  if (!isHoverEnabled(ctx)) {
    return;
  }
  const hoverSuspendUntil = Number(ctx.suspendHoverUntilTs) || 0;
  if (hoverSuspendUntil > Date.now()) {
    return;
  }
  if (ctx.hoveredRowIndex() === rowIndex) {
    return;
  }
  ctx.hoveredRowIndex.set(rowIndex);
  syncGridFillerHoverState(ctx, event);
}
export function onRowMouseLeaveHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (!isHoverEnabled(ctx)) {
    if (ctx.hoveredRowIndex() != null) {
      ctx.hoveredRowIndex.set(null);
    }
    clearGridFillerHoverState(ctx);
    return;
  }
  if (ctx.hoveredRowIndex() == null) {
    clearGridFillerHoverState(ctx);
    return;
  }
  ctx.hoveredRowIndex.set(null);
  clearGridFillerHoverState(ctx);
}
export function isRowHoveredHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [rowIndex] = args;
  if (!isHoverEnabled(ctx)) {
    return false;
  }
  return ctx.hoveredRowIndex() === rowIndex;
}
export function canQuickEditHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  return ctx.visibleColumns().some((column: LooseValue) => column.editable);
}
export function triggerQuickEditHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [rowIndex] = args;
  const editableColumn = ctx.getFirstEditableColumn();
  if (!editableColumn) {
    return;
  }
  ctx.startEdit(rowIndex, editableColumn);
}
export function toggleFocusModeHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  ctx.focusModeEnabled.update((val: LooseValue) => !val);
}
export function isColumnHoveredHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [field] = args;
  if (!isHoverEnabled(ctx)) {
    return false;
  }
  return ctx.hoveredColumnField() === field;
}
export function setHoveredColumnHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [field] = args;
  if (!isHoverEnabled(ctx)) {
    return;
  }
  ctx.hoveredColumnField.set(field);
}
export function clearHoveredColumnHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  ctx.hoveredColumnField.set(null);
}
export function flashCellHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [rowIndex, field] = args;
  const key = `${rowIndex}-${field}`;
  ctx.flashingCells.update((cells: LooseValue) => {
    const newSet = new Set(cells);
    newSet.add(key);
    return newSet;
  });
  setTimeout(() => {
    ctx.flashingCells.update((cells: LooseValue) => {
      const newSet = new Set(cells);
      newSet.delete(key);
      return newSet;
    });
  }, 600);
}
export function isCellFlashingHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [rowIndex, field] = args;
  return ctx.flashingCells().has(`${rowIndex}-${field}`);
}
export function getSortIndexHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [field] = args;
  const index = ctx.sortStates().findIndex((s: LooseValue) => s.field === field);
  return index >= 0 ? index + 1 : 0;
}
export function hasMultiColumnSortHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  return ctx.sortStates().length > 1;
}

function restoreRowsInCollectionSignal(
  signalLike: LooseValue,
  snapshot: LooseValue[],
  selectedLookup: Set<LooseValue>
): void {
  signalLike?.update?.((currentRows: LooseValue[]) => {
    const nextRows = Array.isArray(currentRows) ? [...currentRows] : [];
    for (const row of snapshot) {
      if (selectedLookup.has(row) && !nextRows.includes(row)) {
        nextRows.push(row);
      }
    }
    return nextRows;
  });
}

function restoreLocallyDeletedRows(
  ctx: HelperContext,
  sourceRows: LooseValue[],
  selected: LooseValue[],
  pinnedRowsSnapshot: LooseValue[],
  bookmarkedRowsSnapshot: LooseValue[]
): void {
  if (!Array.isArray(sourceRows) || typeof ctx.setDataInternal !== 'function') {
    return;
  }

  const currentRows =
    typeof ctx.dataSignal === 'function' && Array.isArray(ctx.dataSignal())
      ? [...ctx.dataSignal()]
      : [];
  const selectedLookup = new Set(selected);
  const sourceIndexLookup = new Map<LooseValue, number>();
  for (let index = 0; index < sourceRows.length; index += 1) {
    sourceIndexLookup.set(sourceRows[index], index);
  }

  const restoredRows = [...currentRows];
  const restoreEntries = selected
    .map(row => ({
      row,
      index: sourceIndexLookup.get(row) ?? sourceRows.length
    }))
    .sort((a, b) => a.index - b.index);

  for (const entry of restoreEntries) {
    if (restoredRows.includes(entry.row)) {
      continue;
    }
    const insertIndex = Math.max(0, Math.min(entry.index, restoredRows.length));
    restoredRows.splice(insertIndex, 0, entry.row);
  }

  ctx.setDataInternal(restoredRows);
  restoreRowsInCollectionSignal(ctx.pinnedRows, pinnedRowsSnapshot, selectedLookup);
  restoreRowsInCollectionSignal(ctx.bookmarkedRows, bookmarkedRowsSnapshot, selectedLookup);
  ctx.selectedRows.set(selected.filter(row => restoredRows.includes(row)));
  ctx.emitChange('edit');
  emitSelectionChange(ctx);
  ctx.cdr?.markForCheck?.();
}

export function batchDeleteSelectedHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const selected = [...ctx.selectedRows()];
  if (selected.length === 0) {
    showGridAlert(GRID_FEEDBACK_MESSAGES.selectRowsToDelete);
    return;
  }

  const shouldDeleteLocally = !ctx.config?.remoteData && ctx.onBatchDelete?.observers?.length === 0;
  if (!shouldDeleteLocally) {
    ctx.onBatchDelete.emit(selected);
    ctx.selectedRows.set([]);
    emitSelectionChange(ctx);
    return;
  }

  const selectedLookup = new Set(selected);
  const sourceRows = typeof ctx.dataSignal === 'function' ? [...ctx.dataSignal()] : [];
  const pinnedRowsSnapshot = Array.isArray(ctx.pinnedRows?.()) ? [...ctx.pinnedRows()] : [];
  const bookmarkedRowsSnapshot = Array.isArray(ctx.bookmarkedRows?.())
    ? [...ctx.bookmarkedRows()]
    : [];

  if (Array.isArray(sourceRows) && typeof ctx.setDataInternal === 'function') {
    ctx.setDataInternal(sourceRows.filter((row: LooseValue) => !selectedLookup.has(row)));
    ctx.pinnedRows?.update?.((rows: LooseValue[]) =>
      rows.filter((row: LooseValue) => !selectedLookup.has(row))
    );
    ctx.bookmarkedRows?.update?.((rows: LooseValue[]) =>
      rows.filter((row: LooseValue) => !selectedLookup.has(row))
    );
  } else if (typeof ctx.removeRow === 'function') {
    for (const row of selected) {
      ctx.removeRow(row);
    }
  }

  ctx.onBatchDelete.emit(selected);
  ctx.selectedRows.set([]);
  ctx.emitChange('edit');
  emitSelectionChange(ctx);

  showGridAction(getDeletedRowsFeedbackMessage(selected.length), {
    actionLabel: 'Undo',
    duration: 7000,
    title: 'Deleted',
    tone: 'danger',
    onAction: () => {
      restoreLocallyDeletedRows(
        ctx,
        sourceRows,
        selected,
        pinnedRowsSnapshot,
        bookmarkedRowsSnapshot
      );
      showGridAlert(GRID_FEEDBACK_MESSAGES.deletedRowsRestored);
    }
  });
}
export function batchExportSelectedHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [format] = args;
  const selected = ctx.selectedRows();
  if (selected.length === 0) {
    showGridAlert(GRID_FEEDBACK_MESSAGES.selectRowsToExport);
    return;
  }
  const scope: ExportScope = 'selected';
  const exportMeta = ctx.buildExportMeta(scope);
  const options: ExportOptions = {
    format,
    fileName: ctx.buildExportFileName(scope),
    allData: false,
    selectedOnly: true,
    includeHeaders: true
  };
  ctx.onExport.emit(options);
  const visibleColumns = ctx.visibleColumns();
  switch (format) {
    case 'excel':
      ctx.gridService.exportToExcel(selected, visibleColumns, options.fileName!, exportMeta);
      break;
    case 'csv':
      ctx.gridService.exportToCSV(selected, visibleColumns, options.fileName!, exportMeta);
      break;
    case 'pdf':
      ctx.gridService.exportToPDF(selected, visibleColumns, options.fileName!, exportMeta);
      break;
  }
}
export function batchEditFieldHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [field, value] = args;
  const selected = ctx.selectedRows();
  if (selected.length === 0) {
    showGridAlert(GRID_FEEDBACK_MESSAGES.selectRowsToEdit);
    return 0;
  }

  const changedRows: LooseValue[] = [];
  const seen = new Set<LooseValue>();
  for (const row of selected) {
    if (isAppendRow(row) || seen.has(row)) {
      continue;
    }
    seen.add(row);
    if (Object.is((row as LooseValue)[field], value)) {
      continue;
    }
    (row as LooseValue)[field] = value;
    changedRows.push(row);
  }

  if (!changedRows.length) {
    return 0;
  }

  ctx.invalidateFilteredSortedCache();
  ctx.columnRangeCache?.delete?.(field);
  ctx.columnStatsCache?.delete?.(field);
  ctx.cellValueCache?.clear?.();
  ctx.spreadsheetFormulaCache?.clear?.();
  ctx.bumpAggregateCache?.();
  ctx.onBatchEdit.emit({ rows: changedRows, field, value });
  ctx.emitChange('edit');
  return changedRows.length;
}
export function clearSelectionHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  applySelectionWithUndo(ctx, [], 'Selection restored');
}
export function selectAllHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  applySelectionWithUndo(ctx, getVisibleSelectableRows(ctx), 'Previous selection restored');
}
export function invertVisibleSelectionHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const visible = getVisibleSelectableRows(ctx);
  if (!visible.length) {
    return;
  }

  const selected = ctx.selectedRows();
  const visibleLookup = new Set(visible);
  const selectedLookup = ctx.selectedRowLookup?.() ?? new Set(selected);
  const next: LooseValue[] = [];
  for (const row of selected) {
    if (!visibleLookup.has(row)) {
      next.push(row);
    }
  }
  for (const row of visible) {
    if (!selectedLookup.has(row)) {
      next.push(row);
    }
  }

  applySelectionWithUndo(ctx, next, 'Previous selection restored');
}
export function onRowClickHandlerHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [row] = args;
  ctx.onRowClick.emit(row);
}
export function onRowDoubleClickHandlerHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [row] = args;
  ctx.onRowDoubleClick.emit(row);
}
export function onDisplayRowClickHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [row] = args;
  if (row.kind === 'group') {
    ctx.toggleGroup(row);
  } else if (row.kind === 'data') {
    ctx.onRowClickHandler(row.data);
  }
}
export function onDisplayRowDoubleClickHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [row] = args;
  if (row.kind === 'data') {
    ctx.onRowDoubleClickHandler(row.data);
  }
}
export function getEventTargetElementHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [event] = args;
  const rawTarget = event.target;
  if (rawTarget instanceof Element) return rawTarget;
  const path =
    typeof (event as LooseValue).composedPath === 'function'
      ? ((event as LooseValue).composedPath() as EventTarget[])
      : [];
  const fromPath = path.find((node: LooseValue) => node instanceof Element) as Element | undefined;
  return fromPath ?? null;
}
function clearPendingTextClickAction(ctx: HelperContext): void {
  const timer = ctx['cellTextActionClickTimer'] as ReturnType<typeof setTimeout> | null | undefined;
  if (timer) {
    clearTimeout(timer);
  }
  ctx['cellTextActionClickTimer'] = null;
}
export function handleCellClickHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [row, column, event] = args;
  const target = ctx.getEventTargetElement(event);
  const cellActionEl = target?.closest('[data-grid-cell-action], .data-grid-cell-action');
  if (cellActionEl) {
    event.preventDefault?.();
    event.stopPropagation?.();
    ctx.onCellAction.emit({ row, column, event });
    return;
  }

  const textActionEl = column.textClickAction
    ? target?.closest('[data-grid-cell-text-action]')
    : null;
  if (textActionEl) {
    event.preventDefault?.();
    event.stopPropagation?.();
    clearPendingTextClickAction(ctx);
    ctx['cellTextActionClickTimer'] = setTimeout(() => {
      ctx['cellTextActionClickTimer'] = null;
      ctx.onCellAction.emit({ row, column, event });
    }, column.textDoubleClickEdit ? 260 : 0);
    return;
  }

  // ? Check if click is on or inside a data-grid-link element
  const linkEl = target?.closest('.data-grid-link[data-link]');
  if (linkEl) {
    event.stopPropagation?.();
    // Fire action when the text/link itself is clicked
    ctx.onCellAction.emit({ row, column, event });
    return;
  }
  // ? If the cell contains a data-grid-link but the click was on padding, do nothing
  const cellRoot = target?.closest('td');
  const linkInCell = cellRoot?.querySelector('.data-grid-link[data-link]');
  if (linkInCell) {
    // ? Click was on empty space, not on link - ignore it
    return;
  }
  if (isAppendRow(row) && ctx.config.appendRow) {
    event.preventDefault?.();
    event.stopPropagation?.();

    const nextRow = ctx.buildEmptyRow();
    ctx.assignRowKey(nextRow);

    const processedRows = ctx.processedData?.();
    const visibleRows: LooseValue[] = [];
    if (Array.isArray(processedRows)) {
      for (const candidate of processedRows) {
        if (!isAppendRow(candidate)) {
          visibleRows.push(candidate);
        }
      }
    }
    const dataRows = ctx.dataSignal?.();
    const referenceRow =
      visibleRows.length > 0
        ? visibleRows[visibleRows.length - 1]
        : Array.isArray(dataRows) && dataRows.length > 0
          ? dataRows[dataRows.length - 1]
          : null;

    ctx.insertRowAfter(referenceRow, nextRow, 'append');
    ctx.emitChange('edit');

    const targetColumn =
      column.editable && ctx.config.editMode !== 'none'
        ? column
        : typeof ctx.getFirstEditableColumn === 'function'
          ? ctx.getFirstEditableColumn()
          : null;
    if (!targetColumn || ctx.config.editMode === 'none') {
      return;
    }

    const nextRowIndex = visibleRows.length;
    const visibleColumns = ctx.visibleColumns();
    const nextColumnIndex = visibleColumns.findIndex(
      (candidate: LooseValue) => candidate.field === targetColumn.field
    );

    if (nextColumnIndex >= 0 && typeof ctx.activeCell?.set === 'function') {
      ctx.activeCell.set({ rowIndex: nextRowIndex, columnIndex: nextColumnIndex });
    }

    ctx.startEdit(nextRowIndex, targetColumn);
    return;
  }
  const rowIndex = typeof ctx.getGlobalRowIndex === 'function' ? ctx.getGlobalRowIndex(row) : -1;
  const columnIndex = ctx
    .visibleColumns()
    .findIndex((candidate: LooseValue) => candidate.field === column.field);
  if (rowIndex >= 0 && columnIndex >= 0) {
    const active = ctx.activeCell?.();
    if (active?.rowIndex !== rowIndex || active?.columnIndex !== columnIndex) {
      ctx.activeCell.set({ rowIndex, columnIndex });
    }
  }
  if (
    ctx.config.singleClickEdit &&
    column.editable &&
    ctx.config.editMode !== 'none' &&
    rowIndex >= 0
  ) {
    ctx.startEdit(rowIndex, column);
  }
}
export function handleCellDoubleClickHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [row, column, event, useGroupedEditing] = args;
  const target = ctx.getEventTargetElement(event);
  const textActionEl = column.textDoubleClickEdit
    ? target?.closest('[data-grid-cell-text-action]')
    : null;
  if (textActionEl) {
    event.preventDefault?.();
    event.stopPropagation?.();
    clearPendingTextClickAction(ctx);
  }

  if (useGroupedEditing && typeof ctx.startEditFromGroup === 'function') {
    ctx.startEditFromGroup(row, column);
    return;
  }

  const rowIndex = typeof ctx.getGlobalRowIndex === 'function' ? ctx.getGlobalRowIndex(row) : -1;
  if (rowIndex >= 0) {
    ctx.startEdit(rowIndex, column);
  }
}
export function handleDataGridLinkDelegationHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [event] = args;
  const target = ctx.getEventTargetElement(event);
  const linkEl = target?.closest('.data-grid-link[data-link]');
  if (!linkEl) return;
  const columnField = linkEl.dataset.field || linkEl.dataset.column || '';
  const key = linkEl.dataset.key || '';
  const rowId = linkEl.dataset.rowId || '';
  const connId = linkEl.dataset.connId || '';
  const row =
    ctx.findRowByKey(key, linkEl.textContent || '', rowId, connId) ??
    ctx.findRowByTextOnly(linkEl.textContent || '');
  const column = ctx.findColumnForKind(
    columnField || linkEl.dataset.link || linkEl.dataset.kind || ''
  );
  if (row && column) {
    ctx.onCellAction.emit({ row, column, event });
  } else {
    // Fallback: still emit so parent can try to resolve manually
    ctx.onCellAction.emit({ row: row as LooseValue, column: column as LooseValue, event });
  }
}
export function findRowByKeyHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [key, fallbackText, rowId, connId] = args;
  const rows = ctx.dataSignal();
  if (rowId) {
    const found = rows.find((r: LooseValue) => String((r as LooseValue)?.id) === rowId);
    if (found) return found;
  }
  if (connId) {
    const found = rows.find((r: LooseValue) => String((r as LooseValue)?.connectionId) === connId);
    if (found) return found;
  }
  if (!key) return null;
  if (key.startsWith('id:')) {
    const id = key.slice(3);
    const found = rows.find(
      (r: LooseValue) => String((r as LooseValue)?.id ?? (r as LooseValue)?.connectionId) === id
    );
    if (found) return found;
  }
  // Fallback: match by text content against first string column
  const text = fallbackText.trim().toLowerCase();
  if (text) {
    const stringCols = ctx
      .columnsSignal()
      .filter((col: LooseValue) => typeof col.field === 'string');
    for (const col of stringCols) {
      const field = col.field as string;
      const match = rows.find(
        (r: LooseValue) =>
          String((r as LooseValue)?.[field] ?? '')
            .trim()
            .toLowerCase() === text
      );
      if (match) return match;
    }
  }
  return null;
}
export function findRowByTextOnlyHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [text] = args;
  const rows = ctx.dataSignal();
  const normalized = text.trim().toLowerCase();
  if (!normalized) return null;
  for (const row of rows) {
    const values = Object.values(row as LooseValue)
      .filter((v: LooseValue) => typeof v === 'string')
      .map((v: LooseValue) => v.trim().toLowerCase());
    if (values.includes(normalized)) {
      return row;
    }
  }
  return null;
}
export function findColumnForKindHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [field] = args;
  if (!field) return null;
  return ctx.columnsSignal().find((col: LooseValue) => String(col.field) === String(field)) ?? null;
}
export function emitChangeHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [type] = args;
  const includeGroupingSnapshot = type === 'group' || type === 'groupExpansion';
  const event: GridChangeEvent = {
    type,
    sorts: ctx.sortStates(),
    filters: ctx.filterStates(),
    pagination: ctx.paginationState(),
    selectedRows: ctx.selectedRows(),
    groupColumns: ctx.groupColumns?.() ?? [],
    groupDateIntervals: ctx.groupDateIntervals?.() ?? {}
  };
  if (includeGroupingSnapshot) {
    const groupExpansionAuto = ctx.groupExpansionAuto?.() ?? true;
    event.expandedGroups =
      typeof ctx.expandedGroupsSnapshot === 'function'
        ? (ctx.expandedGroupsSnapshot() as string[])
        : groupExpansionAuto
          ? []
          : Array.from(ctx.expandedGroups?.() ?? []).filter(
              (id): id is string => typeof id === 'string' && id.trim().length > 0
            );
    event.groupExpansionAuto = groupExpansionAuto;
  }
  ctx.onChange.emit(event);
  // Auto-save state on changes
  if (ctx.stateKey && ['sort', 'filter', 'pageSize', 'group', 'groupExpansion'].includes(type)) {
    if (type === 'groupExpansion' && typeof ctx.scheduleStateSave === 'function') {
      ctx.scheduleStateSave(120);
    } else {
      ctx.saveState();
    }
  }
  if (type === 'filter') {
    ctx.bumpAggregateCache();
  }
}
export function getCellValueHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [row, column] = args;
  const cacheKey = getCellCacheKey(row, column, 'value');
  const cached = readCellCache(ctx, cacheKey);
  if (cached.hit) {
    return cached.value;
  }

  try {
    const value = (row as LooseValue)[column.field];
    if (
      ctx.config?.spreadsheetMode === true &&
      ctx.config?.enableFormulas !== false &&
      column?.allowFormulas !== false &&
      ctx.formulaEngine?.isFormula?.(value)
    ) {
      const data = ctx.getFilteredSortedData?.() ?? [];
      const columns = ctx.visibleColumns?.() ?? [];
      const rowIndex = data.indexOf(row);
      const columnIndex = columns.findIndex(
        (candidate: LooseValue) => ctx.getColumnField(candidate) === ctx.getColumnField(column)
      );
      if (rowIndex >= 0 && columnIndex >= 0) {
        return writeCellCache(ctx, cacheKey, ctx.getSpreadsheetCellValue(rowIndex, columnIndex));
      }
    }
    // Apply custom renderer first
    if (column.cellRenderer) {
      try {
        const rendered = column.cellRenderer(value, row, column);
        // If it's an HTMLElement, we'll handle it differently in the template
        if (rendered instanceof HTMLElement) {
          // This is expected for custom cell renderers; avoid noisy console logs.
          return writeCellCache(ctx, cacheKey, rendered);
        }
        // If renderAsHtml is true, return as-is (will be sanitized in getCellHtml)
        if (column.renderAsHtml) {
          return writeCellCache(ctx, cacheKey, rendered);
        }
        // Otherwise return as string
        return writeCellCache(ctx, cacheKey, rendered);
      } catch (rendererError) {
        reportGridError(`Error in cell renderer for column "${column.header}":`, rendererError);
        return writeCellCache(ctx, cacheKey, value ?? '');
      }
    }
    // Then apply formatter
    if (column.format) {
      try {
        return writeCellCache(ctx, cacheKey, column.format(value));
      } catch (formatError) {
        reportGridError(`Error in format function for column "${column.header}":`, formatError);
        return writeCellCache(ctx, cacheKey, value ?? '');
      }
    }
    // Return value or empty string if null/undefined
    return writeCellCache(ctx, cacheKey, value ?? '');
  } catch (error) {
    reportGridError(`Error getting cell value for column "${column.header}":`, error);
    return writeCellCache(ctx, cacheKey, '[Error]');
  }
}
export function getCellRawValueHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [row, column] = args;
  try {
    return (row as LooseValue)?.[column.field] ?? '';
  } catch {
    return '';
  }
}
export function getCellTitleHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [row, column] = args;
  const cacheKey = getCellCacheKey(row, column, 'title');
  const cached = readCellCache(ctx, cacheKey);
  if (cached.hit) {
    return cached.value;
  }

  try {
    const value = ctx.getCellValue(row, column);
    if (value == null) {
      return writeCellCache(ctx, cacheKey, ctx.normalizeDisplayValue(value, column) as string);
    }
    if (value instanceof HTMLElement) {
      const text = (value.textContent || value.innerText || '').trim();
      return writeCellCache(ctx, cacheKey, ctx.normalizeDisplayValue(text, column) as string);
    }
    const displayValue = ctx.normalizeDisplayValue(value, column);
    const strValue = String(displayValue);
    if (column.renderAsHtml) {
      return writeCellCache(ctx, cacheKey, ctx.stripHtml(strValue));
    }
    return writeCellCache(ctx, cacheKey, strValue);
  } catch (error) {
    reportGridError(`Error computing cell title for column "${column.header}":`, error);
    return writeCellCache(ctx, cacheKey, '');
  }
}
export function stripHtmlHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [html] = args;
  const temp = document.createElement('div');
  temp.innerHTML = html;
  return (temp.textContent || temp.innerText || '').trim();
}
export function normalizeDisplayValueHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [value, column] = args;
  const emptyDisplayValue =
    column && typeof column === 'object' && 'emptyDisplayValue' in column
      ? String((column as { emptyDisplayValue?: string }).emptyDisplayValue ?? '—')
      : '—';
  if (value === null || value === undefined) {
    return emptyDisplayValue;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '-' || trimmed === '--' || trimmed === '—') {
      return emptyDisplayValue;
    }
  }
  return value;
}
export function getCellHtmlHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [row, column] = args;
  const value = ctx.getCellValue(row, column);
  if (typeof value === 'string') {
    // ? SECURITY FIX: Always sanitize HTML to prevent XSS attacks
    // Angular's sanitizer removes dangerous scripts while preserving safe HTML
    return ctx.sanitizer.sanitize(1, value) || ''; // 1 = SecurityContext.HTML
  }
  return value;
}
export function getCellValueWithHighlightHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [row, column] = args;
  const searchTerm = String(ctx.globalSearchTerm ?? '').trim();
  const cacheKey = getCellRenderCacheKey(row, column, searchTerm);
  const cached = readCellCache(ctx, cacheKey);
  if (cached.hit) {
    return cached.value;
  }

  const value = ctx.getCellValue(row, column);
  // ? Handle HTMLElement from cellRenderer - return directly (don't convert to outerHTML!)
  // This preserves event listeners on the element
  if (value instanceof HTMLElement) {
    return writeCellCache(ctx, cacheKey, value);
  }
  const displayValue = ctx.normalizeDisplayValue(value, column);
  if (!searchTerm) return writeCellCache(ctx, cacheKey, String(displayValue));
  const strValue = String(displayValue);
  // Case-insensitive highlighting - return HTML with mark tags
  const regex = new RegExp(`(${ctx.escapeRegExp(searchTerm)})`, 'gi');
  return writeCellCache(
    ctx,
    cacheKey,
    strValue.replace(regex, '<mark class="search-highlight" style="pointer-events:auto">$1</mark>')
  );
}
export function escapeRegExpHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [text] = args;
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
export function hasSearchHighlightHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  return !!(ctx.globalSearchTerm && ctx.globalSearchTerm.trim());
}
export function isDraggingColumnHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  return ctx.draggingColumnField === String(ctx.getColumnField?.(column) ?? column.field);
}
export function isDropTargetHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  return ctx.dropTargetColumnField === String(ctx.getColumnField?.(column) ?? column.field);
}
export function getDropTargetEdgeHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  if (ctx.dropTargetColumnField !== String(ctx.getColumnField?.(column) ?? column.field)) {
    return null;
  }
  return ctx.dropTargetColumnEdge ?? null;
}
export function isDropTargetBeforeHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  return (
    ctx.dropTargetColumnField === String(ctx.getColumnField?.(column) ?? column.field) &&
    ctx.dropTargetColumnEdge === 'before'
  );
}
export function isDropTargetAfterHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  return (
    ctx.dropTargetColumnField === String(ctx.getColumnField?.(column) ?? column.field) &&
    ctx.dropTargetColumnEdge === 'after'
  );
}
