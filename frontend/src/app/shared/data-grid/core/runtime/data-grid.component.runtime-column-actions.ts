import { reportGridError } from '../../utils';

import { GRID_FEEDBACK_MESSAGES, requestGridConfirm, showGridAlert } from '../../utils/feedback';
import type { ColumnType } from '../../models';

type LooseValue = ReturnType<typeof JSON.parse>;
type HelperContext = Record<string, LooseValue>;

function hasExplicitColumnWidth(column: LooseValue): boolean {
  if (typeof column?.width === 'number') {
    return Number.isFinite(column.width);
  }
  if (typeof column?.width === 'string') {
    return column.width.trim().length > 0;
  }
  return false;
}

function getColumnPinBucket(column: LooseValue): 'left' | 'normal' | 'right' {
  if (column?.pinned === 'left') {
    return 'left';
  }
  if (column?.pinned === 'right') {
    return 'right';
  }
  return 'normal';
}

function normalizePinnedColumnOrder(columns: LooseValue[]): LooseValue[] {
  const pinnedLeft: LooseValue[] = [];
  const normal: LooseValue[] = [];
  const pinnedRight: LooseValue[] = [];

  for (const column of columns) {
    const bucket = getColumnPinBucket(column);
    if (bucket === 'left') {
      pinnedLeft.push(column);
    } else if (bucket === 'right') {
      pinnedRight.push(column);
    } else {
      normal.push(column);
    }
  }

  return [...pinnedLeft, ...normal, ...pinnedRight];
}

function hasSameColumnSequence(
  ctx: HelperContext,
  first: LooseValue[],
  second: LooseValue[]
): boolean {
  if (first.length !== second.length) {
    return false;
  }

  for (let index = 0; index < first.length; index += 1) {
    if (ctx.getColumnField(first[index]) !== ctx.getColumnField(second[index])) {
      return false;
    }
  }

  return true;
}

function commitColumnLayoutMutation(
  ctx: HelperContext,
  options: {
    close?: boolean;
    notify?: boolean;
    save?: boolean;
    sync?: boolean;
  } = {}
): void {
  ctx.cdr?.markForCheck?.();

  if (options.sync !== false) {
    ctx.syncHeaderBodyWidths?.();
  }

  if (options.notify !== false) {
    ctx.emitColumnsChange?.();
  }

  if (options.save !== false && ctx.stateKey) {
    ctx.saveState?.();
  }

  if (options.close !== false) {
    ctx.closeColumnContextMenu?.();
  }
}

function getPinnedSectionBounds(
  columns: LooseValue[],
  index: number
): { start: number; end: number } {
  const bucket = getColumnPinBucket(columns[index]);
  let start = index;
  let end = index;

  while (start > 0 && getColumnPinBucket(columns[start - 1]) === bucket) {
    start -= 1;
  }

  while (end < columns.length - 1 && getColumnPinBucket(columns[end + 1]) === bucket) {
    end += 1;
  }

  return { start, end };
}

export function showSubmenuHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [type, event] = args;
  const preserveTypeDraft =
    type === 'type' && ctx.showTypeSubmenu?.() === true && !event;
  if (ctx.submenuTimeout) {
    clearTimeout(ctx.submenuTimeout);
  }
  if (type === 'choose' && ctx.showChooseColumnsSubmenu()) {
    return;
  }
  const keepVisibilityOpen = type === 'choose';
  const keepMoreOpen = type === 'copy';
  // Hide all submenus first
  ctx.showSortSubmenu.set(false);
  ctx.showPinSubmenu.set(false);
  ctx.showAlignSubmenu.set(false);
  ctx.showAggregateSubmenu.set(false);
  if (!keepVisibilityOpen) {
    ctx.showColumnVisibilitySubmenu.set(false);
  }
  ctx.showFilterSubmenu.set(false);
  if (!keepMoreOpen) {
    ctx.showMoreSubmenu.set(false);
  }
  if (!keepVisibilityOpen) {
    ctx.showChooseColumnsSubmenu.set(false);
  }
  if (!keepMoreOpen) {
    ctx.showCopySubmenu.set(false);
  }
  ctx.showStatsSubmenu.set(false);
  ctx.showTypeSubmenu?.set?.(false);
  if (event) {
    const target = event.currentTarget as HTMLElement | null;
    if (target?.classList.contains('context-menu-item')) {
      if (type === 'copy' && ctx.showCopySubmenu() && ctx.columnCopySubmenuAnchorEl === target) {
        // keep previous flip to avoid jitter when re-entering
      } else {
        ctx.columnSubmenuAnchorRect = target.getBoundingClientRect();
        ctx.columnSubmenuAnchorEl = target;
        if (type === 'copy') {
          ctx.columnCopySubmenuAnchorEl = target;
        }
        ctx.updateColumnSubmenuPosition(type);
      }
    }
  }
  // Show the requested one
  if (type === 'sort') ctx.showSortSubmenu.set(true);
  else if (type === 'pin') ctx.showPinSubmenu.set(true);
  else if (type === 'align') ctx.showAlignSubmenu.set(true);
  else if (type === 'aggregate') ctx.showAggregateSubmenu.set(true);
  else if (type === 'visibility') ctx.showColumnVisibilitySubmenu.set(true);
  else if (type === 'filter') ctx.showFilterSubmenu.set(true);
  else if (type === 'more') ctx.showMoreSubmenu.set(true);
  else if (type === 'choose') {
    ctx.showColumnVisibilitySubmenu.set(true);
    ctx.showChooseColumnsSubmenu.set(true);
  } else if (type === 'copy') {
    ctx.showMoreSubmenu.set(true);
    ctx.showCopySubmenu.set(true);
  } else if (type === 'stats') {
    ctx.showStatsSubmenu.set(true);
  } else if (type === 'type') {
    const column = ctx.selectedColumnForMenu?.();
    if (!preserveTypeDraft) {
      ctx.columnDropdownOptionsDraft = formatDropdownOptions(column?.options);
    }
    ctx.showTypeSubmenu?.set?.(true);
  }
  if (event && ctx.columnSubmenuAnchorRect) {
    ctx.scheduleColumnSubmenuPosition(type);
  }
}
export function hideSubmenuHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [type] = args;
  ctx.submenuTimeout = setTimeout(() => {
    if (type === 'sort') ctx.showSortSubmenu.set(false);
    else if (type === 'pin') ctx.showPinSubmenu.set(false);
    else if (type === 'align') ctx.showAlignSubmenu.set(false);
    else if (type === 'aggregate') ctx.showAggregateSubmenu.set(false);
    else if (type === 'visibility') ctx.showColumnVisibilitySubmenu.set(false);
    else if (type === 'filter') ctx.showFilterSubmenu.set(false);
    else if (type === 'more') ctx.showMoreSubmenu.set(false);
    else if (type === 'choose') ctx.showChooseColumnsSubmenu.set(false);
    else if (type === 'copy') ctx.showCopySubmenu.set(false);
    else if (type === 'stats') ctx.showStatsSubmenu.set(false);
    else if (type === 'type') ctx.showTypeSubmenu?.set?.(false);
  }, 200); // 200ms delay
}
export function scheduleColumnSubmenuPositionHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [type] = args;
  if (!ctx.columnSubmenuAnchorRect && !ctx.columnSubmenuAnchorEl) return;
  if (ctx.submenuPositionRaf !== null) {
    cancelAnimationFrame(ctx.submenuPositionRaf);
    ctx.submenuPositionRaf = null;
  }
  const attemptPosition = (retries: number) => {
    ctx.submenuPositionRaf = requestAnimationFrame(() => {
      ctx.submenuPositionRaf = null;
      const submenu = ctx.elementRef.nativeElement.querySelector(
        `.column-context-submenu[data-submenu="${type}"]`
      ) as HTMLElement | null;
      if (submenu) {
        const { scale } = ctx.getOverlaySpace();
        const rect = submenu.getBoundingClientRect();
        const width = submenu.offsetWidth || rect.width / scale;
        const height = submenu.offsetHeight || rect.height / scale;
        ctx.columnSubmenuSizeCache.set(type, { width, height });
        ctx.updateColumnSubmenuPosition(type, { width, height });
        return;
      }
      if (retries > 0) {
        attemptPosition(retries - 1);
      }
    });
  };
  attemptPosition(2);
}
export function getColumnSubmenuMetricsHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [type] = args;
  const cached = ctx.columnSubmenuSizeCache.get(type);
  if (cached) {
    return cached;
  }
  switch (type) {
    case 'visibility':
      return { width: 240, height: 320 };
    case 'choose':
      return { width: 240, height: 320 };
    case 'copy':
      return { width: 240, height: 220 };
    case 'stats':
      return { width: 220, height: 260 };
    case 'type':
      return { width: 360, height: 460 };
    case 'aggregate':
      return { width: 260, height: 420 };
    case 'more':
      return { width: 280, height: 520 };
    case 'filter':
      return { width: 200, height: 160 };
    default:
      return { width: 200, height: 240 };
  }
}

function formatDropdownOptions(options: LooseValue): string {
  if (!Array.isArray(options)) {
    return '';
  }
  return options
    .map(option => String(option?.label ?? option?.value ?? '').trim())
    .filter(Boolean)
    .join('\n');
}

function normalizeDropdownOptions(raw: unknown): Array<{ label: string; value: string }> {
  const values = String(raw ?? '')
    .split(/[\n,]+/)
    .map(value => value.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const options: Array<{ label: string; value: string }> = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    options.push({ label: value, value });
  }
  return options;
}

export function getColumnDataTypeHelper(ctx: HelperContext, ...args: LooseValue[]): ColumnType {
  const [column] = args;
  if (column?.type === 'number' || column?.cellType === 'number') return 'number';
  if (column?.type === 'date' || column?.cellType === 'date') return 'date';
  if (
    column?.type === 'dropdown' ||
    column?.cellType === 'select' ||
    column?.cellType === 'search-select' ||
    column?.searchSelect
  ) {
    return 'dropdown';
  }
  return 'text';
}

export function setColumnDataTypeHelper(ctx: HelperContext, ...args: LooseValue[]): void {
  const [column, type] = args as [LooseValue, ColumnType];
  if (!column || !['text', 'number', 'date', 'dropdown'].includes(type)) {
    return;
  }
  if (column.searchSelect || column.headerSelect) {
    return;
  }
  column.type = type;
  column.cellType = type === 'dropdown' ? 'search-select' : type;
  column.filterType = type === 'dropdown' ? 'select' : type;
  if (type === 'dropdown' && !Array.isArray(column.options)) {
    column.options = [];
  }
  ctx.columns = [...ctx.columns];
  commitColumnLayoutMutation(ctx, { close: false, sync: false });
}

export function saveColumnDropdownOptionsHelper(ctx: HelperContext, ...args: LooseValue[]): void {
  const [column] = args;
  if (!column) {
    return;
  }
  column.type = 'dropdown';
  column.cellType = 'search-select';
  column.filterType = 'select';
  column.options = normalizeDropdownOptions(ctx.columnDropdownOptionsDraft);
  ctx.columnDropdownOptionsDraft = formatDropdownOptions(column.options);
  ctx.columns = [...ctx.columns];
  commitColumnLayoutMutation(ctx, { close: false, sync: false });
}

export function updateColumnSubmenuPositionHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [type, size] = args;
  const anchorRect =
    ctx.columnSubmenuAnchorEl?.getBoundingClientRect() ?? ctx.columnSubmenuAnchorRect;
  if (!anchorRect) {
    return;
  }
  const metrics = size ?? ctx.getColumnSubmenuMetrics(type);
  const width = metrics.width;
  const height = metrics.height;
  const margin = 8;
  const openLeftPref = !!ctx.config?.rtl;
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const canRight = anchorRect.right + 4 + width <= viewportW - margin;
  const canLeft = anchorRect.left - 4 - width >= margin;
  const canDown = anchorRect.top + height <= viewportH - margin;
  const canUp = anchorRect.bottom - height >= margin;
  const openLeft = openLeftPref ? canLeft || !canRight : !canRight && canLeft;
  const openUp = !canDown && canUp;
  if (type === 'choose') {
    ctx.columnChooseSubmenuOpenLeft.set(openLeft);
    ctx.columnChooseSubmenuOpenUp.set(openUp);
  } else if (type === 'copy') {
    ctx.columnCopySubmenuOpenLeft.set(openLeft);
    ctx.columnCopySubmenuOpenUp.set(openUp);
  } else {
    ctx.columnSubmenuOpenLeft.set(openLeft);
    ctx.columnSubmenuOpenUp.set(openUp);
  }
  ctx.columnSubmenuPosition.set({ x: 0, y: 0 });
}
export function groupByColumnHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  const field = column.field as string;
  if (!ctx.groupColumns().includes(field)) {
    ctx.addGroupColumn(field);
  }
  ctx.closeColumnContextMenu();
}
export function isMenuColumnSortableHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const column = ctx.selectedColumnForMenu();
  return !!column && column.sortable !== false;
}
export function isMenuColumnFilterableHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const column = ctx.selectedColumnForMenu();
  return !!column && column.filterable !== false;
}
export function sortColumnAscHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  ctx.setExplicitSort(column, 'asc');
}
export function sortColumnDescHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  ctx.setExplicitSort(column, 'desc');
}
export function setExplicitSortHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column, direction] = args;
  if (column.sortable === false) {
    return;
  }
  const field = ctx.getColumnField(column);
  ctx.sortStates.set([{ field, direction, order: 0 }]);
  ctx.emitChange('sort');
  ctx.closeColumnContextMenu();
}
export function hideColumnHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  const field = ctx.getColumnField(column);
  if (column?.hidden === true) {
    ctx.closeColumnContextMenu();
    return;
  }
  ctx.setColumnHidden(field, true);
  commitColumnLayoutMutation(ctx);
}
export function clearSortForColumnHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  const field = ctx.getColumnField(column);
  ctx.sortStates.update((states: LooseValue) => {
    const remaining: LooseValue[] = [];
    for (const sort of states) {
      if (sort.field === field) {
        continue;
      }
      remaining.push({ ...sort, order: remaining.length });
    }
    return remaining;
  });
  ctx.emitChange('sort');
  ctx.closeColumnContextMenu();
}
export function clearColumnFilterHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  const field = ctx.getColumnField(column);
  ctx.filterStates.update((filters: LooseValue) =>
    filters.filter((filter: LooseValue) => filter.field !== field)
  );
  const quickFilters = ctx.quickFilterValues();
  if (quickFilters.has(field)) {
    const updated = new Map(quickFilters);
    updated.delete(field);
    ctx.quickFilterValues.set(updated);
  }
  if (ctx.activeFilterColumn === column) {
    ctx.closeFilterMenu();
  }
  ctx.paginationState.update((state: LooseValue) => ({ ...state, currentPage: 1 }));
  ctx.emitChange('filter');
  ctx.closeColumnContextMenu();
}
export function autoSizeAllColumnsFromMenuHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  ctx.autoSizeAllColumnsInternal();
  ctx.closeColumnContextMenu();
}
export function autoSizeAllColumnsInternalHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [options] = args;
  const automatic = !!options?.automatic;
  const visibleColumns = (ctx.visibleColumns?.() as LooseValue[] | undefined) ?? [];
  const targetColumns = automatic
    ? visibleColumns.filter(column => !hasExplicitColumnWidth(column))
    : visibleColumns;

  targetColumns.forEach((column: LooseValue) => {
    ctx.autoSizeColumn(column, null, {
      automatic,
      save: false,
      sync: false,
      notify: false
    });
  });

  if (automatic) {
    ctx.automaticAutoSizeApplied = true;
  }

  ctx.syncHeaderBodyWidths?.();
  if (targetColumns.length > 0) {
    ctx.emitColumnsChange?.();
  }

  if (options?.save !== false && ctx.stateKey) {
    ctx.saveState();
  }
}
export function showAllColumnsFromMenuHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  let changed = false;
  ctx.columns.forEach((col: LooseValue) => {
    if (col.hidden) {
      col.hidden = false;
      changed = true;
    }
  });
  if (changed) {
    ctx.columnHiddenSnapshot.clear();
    ctx.columns = [...ctx.columns];
    commitColumnLayoutMutation(ctx, { close: false });
  }
}
export function hideAllColumnsFromMenuHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const selectedColumn = ctx.selectedColumnForMenu?.();
  const selectedField = selectedColumn ? ctx.getColumnField(selectedColumn) : '';
  let changed = false;
  ctx.columns.forEach((col: LooseValue) => {
    const field = ctx.getColumnField(col);
    const nextHidden = selectedField ? field !== selectedField : true;
    if (col.hidden !== nextHidden) {
      col.hidden = nextHidden;
      changed = true;
    }
  });
  if (changed) {
    ctx.columns = [...ctx.columns];
    commitColumnLayoutMutation(ctx, { close: false });
  }
}
export function copyColumnValuesFromMenuHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [column, includeHeader] = args;
  ctx.copyColumnData(column, includeHeader);
  ctx.closeColumnContextMenu();
}
function buildNextGeneratedColumnIdentity(ctx: HelperContext): { field: string; header: string } {
  const existingFields = new Set<string>();
  const existingHeaders = new Set<string>();
  const columns = Array.isArray(ctx.columns) ? ctx.columns : [];

  for (const column of columns) {
    existingFields.add(ctx.getColumnField(column));
    existingHeaders.add(
      String(column?.header ?? '')
        .trim()
        .toLowerCase()
    );
  }

  let index = 1;
  while (existingFields.has(`column${index}`) || existingHeaders.has(`column ${index}`)) {
    index += 1;
  }
  return { field: `column${index}`, header: `Column ${index}` };
}
function focusInsertedHeaderEditor(ctx: HelperContext): void {
  if (typeof requestAnimationFrame !== 'function') {
    return;
  }
  requestAnimationFrame(() => {
    const input = ctx.elementRef?.nativeElement?.querySelector?.(
      '.header-text-input'
    ) as HTMLInputElement | null;
    input?.focus?.();
    input?.select?.();
  });
}

export function renameColumnFromMenuHelper(ctx: HelperContext, ...args: LooseValue[]): void {
  const [column] = args;
  const field = ctx.getColumnField?.(column);
  if (!field || column?.headerEditable === false) {
    ctx.closeColumnContextMenu?.();
    ctx.closeContextMenu?.();
    return;
  }

  ctx.editingHeaderField?.set?.(field);
  ctx.editingHeaderValue?.set?.(String(column?.header ?? field).trim() || field);
  ctx.closeColumnContextMenu?.();
  ctx.closeContextMenu?.();
  focusInsertedHeaderEditor(ctx);
}
function removeFieldFromSignalSet(
  signalLike:
    | { update?: (updater: (current: Set<string>) => Set<string>) => void }
    | null
    | undefined,
  field: string
): void {
  signalLike?.update?.((current: Set<string>) => {
    const next = new Set(current);
    next.delete(field);
    return next;
  });
}
function removeFieldFromSignalArray(
  signalLike: { update?: (updater: (current: string[]) => string[]) => void } | null | undefined,
  field: string
): boolean {
  let changed = false;
  signalLike?.update?.((current: string[]) => {
    const next = current.filter(item => item !== field);
    changed = next.length !== current.length;
    return next;
  });
  return changed;
}
function cleanupDeletedColumnState(ctx: HelperContext, field: string): void {
  ctx.sortStates?.update?.((states: LooseValue[]) => {
    const remaining: LooseValue[] = [];
    for (const state of states) {
      if (state.field === field) {
        continue;
      }
      remaining.push({ ...state, order: remaining.length });
    }
    return remaining;
  });
  ctx.filterStates?.update?.((states: LooseValue[]) =>
    states.filter((state: LooseValue) => state.field !== field)
  );

  const quickFilters = ctx.quickFilterValues?.();
  if (quickFilters?.has(field)) {
    const nextQuickFilters = new Map(quickFilters);
    nextQuickFilters.delete(field);
    ctx.quickFilterValues.set(nextQuickFilters);
  }

  const removedFromGrouping = removeFieldFromSignalArray(ctx.groupColumns, field);
  if (removedFromGrouping) {
    ctx.groupDateIntervals?.update?.((current: Record<string, LooseValue>) => {
      const next = { ...(current ?? {}) };
      delete next[field];
      return next;
    });
    ctx.resetGroupExpansion?.();
  }

  removeFieldFromSignalSet(ctx.wrappedColumns, field);
  removeFieldFromSignalSet(ctx.duplicateHighlightColumns, field);

  ctx.columnAutoWidthCache?.delete?.(field);
  ctx.columnMinWidthCache?.delete?.(field);
  ctx.columnRangeCache?.delete?.(field);
  ctx.columnStatsCache?.delete?.(field);
  ctx.columnHiddenSnapshot?.delete?.(field);
  ctx.columnWidthLocks?.delete?.(field);
  ctx.initialColumnState?.delete?.(field);

  if (Array.isArray(ctx.initialColumnOrder)) {
    ctx.initialColumnOrder = ctx.initialColumnOrder.filter((item: string) => item !== field);
  }

  if (ctx.activeFilterColumn && ctx.getColumnField(ctx.activeFilterColumn) === field) {
    ctx.closeFilterMenu?.();
  }

  if (ctx.editingHeaderField?.() === field) {
    ctx.editingHeaderField.set(null);
    ctx.editingHeaderValue?.set?.('');
  }
}
export function insertColumnRelativeHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column, direction] = args;
  const field = ctx.getColumnField(column);
  const referenceIndex = ctx.columns.findIndex(
    (candidate: LooseValue) => ctx.getColumnField(candidate) === field
  );
  const insertIndex =
    referenceIndex === -1
      ? ctx.columns.length
      : direction === 'left'
        ? referenceIndex
        : referenceIndex + 1;
  const nextIdentity = buildNextGeneratedColumnIdentity(ctx);
  const nextField = nextIdentity.field;
  const nextHeader = nextIdentity.header;
  const nextColumn = {
    field: nextField,
    header: nextHeader,
    headerEditable: true,
    editable: true,
    sortable: true,
    filterable: true,
    resizable: true,
    type: 'text',
    align: column?.align,
    pinned: column?.pinned
  };
  const updated = [...ctx.columns];
  updated.splice(insertIndex, 0, nextColumn);
  ctx.columns = normalizePinnedColumnOrder(updated);
  commitColumnLayoutMutation(ctx, { close: false });
  ctx.editingHeaderField?.set?.(nextField);
  ctx.editingHeaderValue?.set?.(nextHeader);
  focusInsertedHeaderEditor(ctx);
  return nextColumn;
}
export function moveColumnLeftHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  const field = ctx.getColumnField(column);
  const updated = normalizePinnedColumnOrder(ctx.columns);
  const index = updated.findIndex((col: LooseValue) => ctx.getColumnField(col) === field);
  if (index === -1) {
    ctx.closeColumnContextMenu();
    return;
  }
  const bounds = getPinnedSectionBounds(updated, index);
  if (index <= bounds.start) {
    if (!hasSameColumnSequence(ctx, ctx.columns, updated)) {
      ctx.columns = updated;
      commitColumnLayoutMutation(ctx);
      return;
    }
    ctx.closeColumnContextMenu();
    return;
  }
  const [moved] = updated.splice(index, 1);
  updated.splice(index - 1, 0, moved);
  ctx.columns = updated;
  commitColumnLayoutMutation(ctx);
}
export function moveColumnRightHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  const field = ctx.getColumnField(column);
  const updated = normalizePinnedColumnOrder(ctx.columns);
  const index = updated.findIndex((col: LooseValue) => ctx.getColumnField(col) === field);
  if (index === -1) {
    ctx.closeColumnContextMenu();
    return;
  }
  const bounds = getPinnedSectionBounds(updated, index);
  if (index >= bounds.end) {
    if (!hasSameColumnSequence(ctx, ctx.columns, updated)) {
      ctx.columns = updated;
      commitColumnLayoutMutation(ctx);
      return;
    }
    ctx.closeColumnContextMenu();
    return;
  }
  const [moved] = updated.splice(index, 1);
  updated.splice(index + 1, 0, moved);
  ctx.columns = updated;
  commitColumnLayoutMutation(ctx);
}
export function deleteColumnHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  const field = ctx.getColumnField(column);

  if (!field) {
    return;
  }

  if ((Array.isArray(ctx.columns) ? ctx.columns.length : 0) <= 1) {
    showGridAlert(GRID_FEEDBACK_MESSAGES.keepAtLeastOneColumn, { tone: 'warning' });
    ctx.closeColumnContextMenu?.();
    return;
  }

  requestGridConfirm(GRID_FEEDBACK_MESSAGES.deleteSingleColumn, {
    actionLabel: 'Delete',
    tone: 'danger',
    onConfirm: () => {
      const updated = ctx.columns.filter(
        (candidate: LooseValue) => ctx.getColumnField(candidate) !== field
      );
      if (updated.length === ctx.columns.length) {
        ctx.closeColumnContextMenu?.();
        return;
      }

      cleanupDeletedColumnState(ctx, field);
      ctx.columns = updated;
      commitColumnLayoutMutation(ctx);
    }
  });
}
export function showOnlyColumnHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  const field = ctx.getColumnField(column);
  let changed = false;
  ctx.columns.forEach((col: LooseValue) => {
    const nextHidden = ctx.getColumnField(col) !== field;
    if (col.hidden !== nextHidden) {
      col.hidden = nextHidden;
      changed = true;
    }
  });
  if (changed) {
    ctx.columns = [...ctx.columns];
    commitColumnLayoutMutation(ctx);
    return;
  }
  ctx.closeColumnContextMenu();
}
export function isColumnWidthLockedHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  return ctx.columnWidthLocks.has(ctx.getColumnField(column));
}
export function lockColumnWidthHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  const field = ctx.getColumnField(column);
  if (ctx.columnWidthLocks.has(field)) {
    return;
  }
  ctx.columnWidthLocks.set(field, {
    resizable: column.resizable,
    minWidth: column.minWidth,
    maxWidth: column.maxWidth
  });
  const width = Math.round(ctx.getColumnPixelWidth(column));
  column.width = width;
  column.minWidth = width;
  column.maxWidth = width;
  column.resizable = false;
  ctx.columns = [...ctx.columns];
  commitColumnLayoutMutation(ctx);
}
export function unlockColumnWidthHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  const field = ctx.getColumnField(column);
  const locked = ctx.columnWidthLocks.get(field);
  if (!locked) {
    return;
  }
  column.resizable = locked.resizable;
  column.minWidth = locked.minWidth;
  column.maxWidth = locked.maxWidth;
  ctx.columnWidthLocks.delete(field);
  ctx.columns = [...ctx.columns];
  commitColumnLayoutMutation(ctx);
}
export function isWrapEnabledHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  return ctx.wrappedColumns().has(ctx.getColumnField(column));
}
export function enableWrapHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  ctx.setColumnWrap(column, true);
}
export function disableWrapHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  ctx.setColumnWrap(column, false);
}
export function setColumnWrapHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column, enabled] = args;
  const field = ctx.getColumnField(column);
  ctx.wrappedColumns.update((set: LooseValue) => {
    const next = new Set(set);
    if (enabled) {
      next.add(field);
    } else {
      next.delete(field);
    }
    return next;
  });
  ctx.closeColumnContextMenu();
}
export function isDuplicateHighlightEnabledHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [column] = args;
  return ctx.duplicateHighlightColumns().has(ctx.getColumnField(column));
}
export function toggleDuplicateHighlightHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [column] = args;
  const field = ctx.getColumnField(column);
  ctx.duplicateHighlightColumns.update((set: LooseValue) => {
    const next = new Set(set);
    if (next.has(field)) {
      next.delete(field);
    } else {
      next.add(field);
    }
    return next;
  });
  ctx.closeColumnContextMenu();
}
export function applyIsEmptyFilterHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  const field = ctx.getColumnField(column);
  ctx.applyColumnFilterState(field, 'isEmpty', true);
  ctx.closeColumnContextMenu();
}
export function applyNotEmptyFilterHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  const field = ctx.getColumnField(column);
  ctx.applyColumnFilterState(field, 'notEmpty', true);
  ctx.closeColumnContextMenu();
}
export function applyTopBottomFilterHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column, direction] = args;
  const field = ctx.getColumnField(column);
  const rows = ctx.getFilteredDataExcludingField(field);
  const numericMap = new Map<number, Set<LooseValue>>();
  for (const row of rows) {
    const rawValue = (row as LooseValue)?.[field];
    const numeric = ctx.normalizeNumericValue(rawValue);
    if (numeric === null) {
      continue;
    }
    if (!numericMap.has(numeric)) {
      numericMap.set(numeric, new Set());
    }
    numericMap.get(numeric)!.add(rawValue);
  }
  if (!numericMap.size) {
    ctx.showAutoSave('No numeric values to rank');
    ctx.closeColumnContextMenu();
    return;
  }
  const sorted = Array.from(numericMap.keys()).sort((a: LooseValue, b: LooseValue) =>
    direction === 'top' ? b - a : a - b
  );
  const selectedKeys = sorted.slice(0, 10);
  const selectedValues = new Set<LooseValue>();
  for (const key of selectedKeys) {
    const values = numericMap.get(key);
    if (!values) {
      continue;
    }
    for (const value of values) {
      selectedValues.add(value);
    }
  }
  ctx.applyColumnFilterState(field, 'in', Array.from(selectedValues));
  ctx.closeColumnContextMenu();
}
export function applyColumnFilterStateHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [field, operator, value] = args;
  ctx.filterStates.update((states: LooseValue) => {
    const preserved = states.filter(
      (state: LooseValue) => state.field !== field || state.operator === 'globalSearch'
    );
    return [...preserved, { field, operator, value }];
  });
  ctx.paginationState.update((state: LooseValue) => ({ ...state, currentPage: 1 }));
  ctx.emitChange('filter');
}
export function getFilteredDataExcludingFieldHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [field] = args;
  if (ctx.config.remoteData) {
    return ctx.dataSignal().slice();
  }
  let result = ctx.dataSignal().slice();
  const quickFilters = ctx.quickFilterValues();
  if (quickFilters.size > 0) {
    const normalizedQuickFilters: Array<[string, string]> = [];
    for (const [filterField, searchTerm] of quickFilters.entries()) {
      const normalized = String(searchTerm ?? '').toLowerCase();
      if (normalized) {
        normalizedQuickFilters.push([filterField, normalized]);
      }
    }

    if (normalizedQuickFilters.length > 0) {
      result = result.filter((row: LooseValue) => {
        for (const [filterField, searchLower] of normalizedQuickFilters) {
          const value = (row as LooseValue)[filterField];
          const strValue = value != null ? String(value).toLowerCase() : '';
          if (!strValue.includes(searchLower)) {
            return false;
          }
        }
        return true;
      });
    }
  }
  const filters = ctx
    .filterStates()
    .filter((filter: LooseValue) => filter.field !== field || filter.operator === 'globalSearch');
  if (filters.length > 0) {
    result = ctx.gridService.applyFilters(result, filters, ctx.columns);
  }
  return result;
}
export async function copyColumnNameFromMenuHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): Promise<LooseValue> {
  const [column] = args;
  const text = column.header || ctx.getColumnField(column);
  await ctx.copyMenuText(text, 'Column name copied!');
  ctx.closeColumnContextMenu();
}
export async function copyColumnFieldFromMenuHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): Promise<LooseValue> {
  const [column] = args;
  const text = ctx.getColumnField(column);
  await ctx.copyMenuText(text, 'Column ID copied!');
  ctx.closeColumnContextMenu();
}
export async function copyMenuTextHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): Promise<LooseValue> {
  const [text, message] = args;
  try {
    await navigator.clipboard.writeText(text);
    ctx.showCopyFeedback(message);
  } catch (error) {
    try {
      ctx.copyTextFallback(text);
      ctx.showCopyFeedback(message);
    } catch (fallbackError) {
      reportGridError('Failed to copy text:', fallbackError);
    }
  }
}
