import { debugGridWarn, reportGridError } from '../../utils';
export {
  markScrollbarActiveHelper,
  onFixedHeaderScrollHelper,
  onGridContainerScrollHelper,
  queueDefaultGridOverflowSyncHelper,
  setupDefaultGridOverflowObserverHelper,
  syncDefaultGridOverflowHelper,
  teardownDefaultGridOverflowObserverHelper
} from './data-grid.component.runtime-scroll';
import { scheduleNativeScrollBindingHelper } from './data-grid.component.runtime-lifecycle';
import { beginRemoteDataStructureRefresh } from './data-grid.component.runtime-remote-refresh';
import {
  resolveUnifiedDataGridRowActionsColumnWidth,
  resolveUnifiedDataGridSelectionColumnWidth
} from '../../utils/layout';

type LooseValue = ReturnType<typeof JSON.parse>;
type HelperContext = Record<string, LooseValue>;
type T = unknown;
type DisplayRow<TData = unknown> = Record<string, LooseValue>;
type GridStyle = Record<string, string>;
type PercentAggregateStats = {
  sum: number;
  numericCount: number;
  nonEmptyCount: number;
};

const GRID_CELL_STYLE_CACHE_LIMIT = 512;
const gridCellStyleCache = new Map<string, GridStyle>();
const GROUP_TONE_CLASS_CACHE_LIMIT = 2048;
const groupToneClassCache = new Map<string, string>();
const REMOTE_SINGLE_GROUP_AUTO_EXPAND_LIMIT = 120;
const REMOTE_MULTI_GROUP_AUTO_EXPAND_LIMIT = 60;
const LOCAL_SINGLE_GROUP_AUTO_EXPAND_LIMIT = 220;
const LOCAL_MULTI_GROUP_AUTO_EXPAND_LIMIT = 100;
const COLUMN_POINTER_REORDER_THRESHOLD_PX = 6;
const COLUMN_DRAG_CARD_MIN_HEIGHT_PX = 36;
const COLUMN_DRAG_CARD_MAX_HEIGHT_PX = 44;
const COLUMN_DRAG_CARD_VERTICAL_GAP_PX = 6;
const groupingViewportRefreshQueued = new WeakSet<object>();

function getGridCellStyle(align: string, pinned?: 'left' | 'right', offset = 0): GridStyle {
  const key = pinned ? `${align}|${pinned}|${offset}` : align;
  const cached = gridCellStyleCache.get(key);
  if (cached) {
    return cached;
  }

  const style: GridStyle = {
    'text-align': align
  };

  if (pinned) {
    style.position = 'sticky';
    style.zIndex = '12';
    style[pinned] = `${offset}px`;
  }

  gridCellStyleCache.set(key, style);
  if (gridCellStyleCache.size > GRID_CELL_STYLE_CACHE_LIMIT) {
    const oldestKey = gridCellStyleCache.keys().next().value;
    if (oldestKey) {
      gridCellStyleCache.delete(oldestKey);
    }
  }
  return style;
}

function hasClassLookupField(
  lookup: LooseValue,
  field: string,
  fallback: () => LooseValue
): boolean {
  if (lookup instanceof Set) {
    return lookup.has(field);
  }
  return !!fallback();
}

function appendClassName(current: string, token: LooseValue): string {
  if (!token) {
    return current;
  }
  return current ? `${current} ${token}` : String(token);
}

function resolveDataGridHostElement(ctx: HelperContext): HTMLElement | null {
  return (
    (ctx.elementRef as { nativeElement?: HTMLElement } | undefined)?.nativeElement ??
    (ctx.hostRef as { nativeElement?: HTMLElement } | undefined)?.nativeElement ??
    (ctx.gridHost as HTMLElement | null | undefined) ??
    null
  );
}

function isAppendRowLike(row: LooseValue): boolean {
  return !!row && typeof row === 'object' && !!(row as LooseValue).__appendRow;
}

function getCurrentGroupSourceRows(ctx: HelperContext): LooseValue[] {
  const bucketRows =
    typeof ctx.filteredSortedRowBuckets === 'function'
      ? ctx.filteredSortedRowBuckets()?.dataRows
      : null;
  if (Array.isArray(bucketRows)) {
    return bucketRows;
  }

  const processedRows = typeof ctx.processedData === 'function' ? ctx.processedData() : null;
  const filteredRows =
    !Array.isArray(processedRows) && typeof ctx.getFilteredSortedData === 'function'
      ? ctx.getFilteredSortedData()
      : null;
  const rows = Array.isArray(processedRows)
    ? processedRows
    : Array.isArray(filteredRows)
      ? filteredRows
      : [];

  let hasAppendRow = false;
  for (const row of rows) {
    if (isAppendRowLike(row)) {
      hasAppendRow = true;
      break;
    }
  }
  if (!hasAppendRow) {
    return rows;
  }

  const groupableRows: LooseValue[] = [];
  for (const row of rows) {
    if (!isAppendRowLike(row)) {
      groupableRows.push(row);
    }
  }
  return groupableRows;
}

function collectGroupedIdsFromRows(
  ctx: HelperContext,
  rows: LooseValue[],
  groupFields: string[],
  fieldIndex: number,
  path: string,
  ids: string[]
): void {
  if (fieldIndex >= groupFields.length || rows.length === 0) {
    return;
  }

  const currentField = groupFields[fieldIndex];
  const groups = new Map<string, LooseValue[]>();
  for (const row of rows) {
    const rawValue = (row as LooseValue)?.[currentField];
    const groupedValue =
      typeof ctx.resolveGroupValue === 'function'
        ? ctx.resolveGroupValue(currentField, rawValue)
        : null;
    const key =
      groupedValue?.key ??
      (rawValue === null || rawValue === undefined ? '__EMPTY__' : String(rawValue));
    let groupRows = groups.get(key);
    if (!groupRows) {
      groupRows = [];
      groups.set(key, groupRows);
    }
    groupRows.push(row);
  }

  let index = 0;
  for (const [key, groupRows] of groups) {
    const id = `${path}|${currentField}:${key}-${index++}`;
    ids.push(id);
    collectGroupedIdsFromRows(ctx, groupRows, groupFields, fieldIndex + 1, id, ids);
  }
}

function getExpandedGroupIdsForCurrentMode(
  ctx: HelperContext,
  groupFields: LooseValue[]
): Set<string> {
  if (!groupFields.length) {
    return new Set<string>();
  }
  if (groupFields.length === 1) {
    const [field] = groupFields as string[];
    if (typeof ctx.groupedBlocks === 'function') {
      const blocks = ctx.groupedBlocks();
      if (Array.isArray(blocks)) {
        const blockIds = new Set<string>();
        for (const block of blocks) {
          if (typeof block?.id === 'string' && block.id.length > 0) {
            blockIds.add(block.id);
          }
        }
        return blockIds;
      }
    }

    const rows = ctx.getFilteredSortedData?.() ?? [];
    const ids = new Set<string>();
    const seenKeys = new Set<string>();

    for (const row of rows) {
      if (row && typeof row === 'object' && (row as LooseValue).__appendRow) {
        continue;
      }
      const raw = (row as LooseValue)?.[field];
      const value = raw ?? '-';
      const groupedValue =
        typeof ctx.resolveGroupValue === 'function' ? ctx.resolveGroupValue(field, raw) : null;
      const normalizedKey = groupedValue?.key ?? ctx.normalizeGroupKey?.(value) ?? String(value);
      if (seenKeys.has(normalizedKey)) {
        continue;
      }
      seenKeys.add(normalizedKey);

      ids.add(`${field}:${normalizedKey}`);
    }
    return ids;
  }

  const ids: string[] = [];
  collectGroupedIdsFromRows(
    ctx,
    getCurrentGroupSourceRows(ctx),
    groupFields as string[],
    0,
    'root',
    ids
  );
  return new Set(ids);
}

function areStringSetsEqual(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) {
    return false;
  }
  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }
  return true;
}

function applyExplicitGroupExpansion(ctx: HelperContext, next: Set<string>): boolean {
  const wasAutoExpanded =
    typeof ctx.groupExpansionAuto === 'function' ? (ctx.groupExpansionAuto() ?? true) : true;
  const current =
    typeof ctx.expandedGroups === 'function'
      ? (ctx.expandedGroups() as Set<string>)
      : new Set<string>();
  if (!wasAutoExpanded && areStringSetsEqual(current, next)) {
    return false;
  }

  ctx.groupExpansionAuto?.set?.(false);
  ctx.groupExpansionToken = (ctx.groupExpansionToken ?? 0) + 1;
  ctx.expandedGroups.set(next);
  return true;
}

function countGroupableRows(rows: LooseValue[] | null | undefined): number {
  if (!Array.isArray(rows) || rows.length === 0) {
    return 0;
  }

  let count = 0;
  for (const row of rows) {
    if (row && typeof row === 'object' && (row as LooseValue).__appendRow) {
      continue;
    }
    count += 1;
  }
  return count;
}

function getGroupableRowCount(ctx: HelperContext): number {
  if (typeof ctx.filteredSortedRowBuckets === 'function') {
    const buckets = ctx.filteredSortedRowBuckets();
    const dataRows = buckets?.dataRows;
    if (Array.isArray(dataRows)) {
      return dataRows.length;
    }
  }

  if (typeof ctx.getFilteredSortedData === 'function') {
    return countGroupableRows(ctx.getFilteredSortedData() as LooseValue[]);
  }

  if (typeof ctx.dataSignal === 'function') {
    return countGroupableRows(ctx.dataSignal() as LooseValue[]);
  }

  return 0;
}

export function shouldAutoExpandGroupsHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const groups = ctx.groupColumns?.();
  const groupCount = Array.isArray(groups) ? groups.length : 0;
  if (groupCount === 0) {
    return true;
  }

  const rowCount = getGroupableRowCount(ctx);
  if (rowCount <= 0) {
    return true;
  }

  const limit = ctx.config?.remoteData
    ? groupCount > 1
      ? REMOTE_MULTI_GROUP_AUTO_EXPAND_LIMIT
      : REMOTE_SINGLE_GROUP_AUTO_EXPAND_LIMIT
    : groupCount > 1
      ? LOCAL_MULTI_GROUP_AUTO_EXPAND_LIMIT
      : LOCAL_SINGLE_GROUP_AUTO_EXPAND_LIMIT;

  return rowCount <= limit;
}

function queueGroupingViewportRefresh(ctx: HelperContext): void {
  if (
    ctx.config?.remoteData &&
    typeof ctx.remoteDataStructureRefreshPending === 'function' &&
    ctx.remoteDataStructureRefreshPending()
  ) {
    return;
  }

  const contextKey = ctx && typeof ctx === 'object' ? (ctx as object) : null;
  if (contextKey && groupingViewportRefreshQueued.has(contextKey)) {
    return;
  }
  if (contextKey) {
    groupingViewportRefreshQueued.add(contextKey);
  }

  const refresh = () => {
    if (contextKey) {
      groupingViewportRefreshQueued.delete(contextKey);
    }
    scheduleNativeScrollBindingHelper(ctx);
    if (typeof ctx.syncHeaderBodyWidths === 'function') {
      ctx.syncHeaderBodyWidths();
    }
    // Defer overflow sync so grouped shell nodes are mounted before measuring.
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => queueDefaultGridOverflowSyncHelper(ctx));
      });
    } else {
      setTimeout(() => queueDefaultGridOverflowSyncHelper(ctx), 32);
    }
  };

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(refresh);
    return;
  }

  setTimeout(refresh, 0);
}

function appendGroupedRows(
  ctx: HelperContext,
  result: DisplayRow<T>[],
  data: LooseValue[],
  groupFields: string[],
  fieldIndex: number,
  level: number,
  path: string,
  expandedSet: Set<string>,
  autoExpand: boolean,
  showFooters: boolean,
  hasGroupFilters: boolean
): void {
  if (fieldIndex >= groupFields.length) {
    for (const row of data) {
      result.push({ kind: 'data', data: row });
    }
    return;
  }

  const currentField = groupFields[fieldIndex];
  const groups = new Map<
    string,
    {
      value: LooseValue;
      rows: T[];
    }
  >();

  for (const row of data) {
    const rawValue = (row as LooseValue)[currentField];
    const groupedValue =
      typeof ctx.resolveGroupValue === 'function'
        ? ctx.resolveGroupValue(currentField, rawValue)
        : null;
    const key =
      groupedValue?.key ??
      (rawValue === null || rawValue === undefined ? '__EMPTY__' : String(rawValue));
    let group = groups.get(key);
    if (!group) {
      group = { value: groupedValue?.value ?? rawValue ?? '—', rows: [] };
      groups.set(key, group);
    }
    group.rows.push(row);
  }

  let index = 0;
  for (const [key, group] of groups) {
    const id = `${path}|${currentField}:${key}-${index++}`;
    const expanded = autoExpand || expandedSet.has(id);
    const filterTerm = hasGroupFilters ? ctx.getGroupFilterTerm(id) : '';
    const filteredRows = filterTerm ? ctx.filterGroupRows(group.rows, filterTerm) : group.rows;
    const count =
      !filterTerm && typeof ctx.getRemoteGroupCount === 'function'
        ? ctx.getRemoteGroupCount(currentField, key, filteredRows.length)
        : filteredRows.length;
    result.push({
      kind: 'group',
      id,
      level,
      field: currentField,
      value: group.value,
      count,
      expanded,
      rows: filteredRows
    });

    if (!expanded) {
      continue;
    }

    appendGroupedRows(
      ctx,
      result,
      filteredRows,
      groupFields,
      fieldIndex + 1,
      level + 1,
      id,
      expandedSet,
      autoExpand,
      showFooters,
      hasGroupFilters
    );

    if (showFooters) {
      result.push({
        kind: 'group-footer',
        id: `${id}|footer`,
        level,
        field: currentField,
        value: group.value,
        count,
        rows: filteredRows
      });
    }
  }
}

function collectPercentAggregateStats(
  ctx: HelperContext,
  data: LooseValue[],
  field: string
): PercentAggregateStats {
  let sum = 0;
  let numericCount = 0;
  let nonEmptyCount = 0;

  for (const row of data) {
    const value = (row as LooseValue)?.[field];
    if (!ctx.isEmptyValue(value)) {
      nonEmptyCount += 1;
    }

    const numericValue = ctx.normalizeNumericValue(value);
    if (numericValue === null) {
      continue;
    }

    sum += numericValue;
    numericCount += 1;
  }

  return { sum, numericCount, nonEmptyCount };
}

function getPercentAggregateTotalStats(
  ctx: HelperContext,
  totalData: LooseValue[],
  field: string
): PercentAggregateStats {
  const token = Number(ctx.aggregateCacheToken ?? 0);
  const cacheKey = `${field}|${token}`;
  const cached = ctx.percentAggregateTotalsCache?.get?.(cacheKey);
  if (cached && cached.token === token && cached.rows === totalData) {
    return {
      sum: cached.sum,
      numericCount: cached.numericCount,
      nonEmptyCount: cached.nonEmptyCount
    };
  }

  const stats = collectPercentAggregateStats(ctx, totalData, field);
  ctx.percentAggregateTotalsCache?.set?.(cacheKey, {
    token,
    rows: totalData,
    sum: stats.sum,
    numericCount: stats.numericCount,
    nonEmptyCount: stats.nonEmptyCount
  });
  return stats;
}

export function getCellClassHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [row, column] = args;
  // Touch the alignment signal so class recomputation tracks width/alignment updates.
  ctx.alignmentChangeTimestamp();
  let classes = '';
  const field = ctx.getColumnField(column);
  // Add custom cell class
  if (typeof column.cellClass === 'function') {
    classes = appendClassName(classes, column.cellClass((row as LooseValue)[column.field], row));
  } else if (column.cellClass) {
    classes = appendClassName(classes, column.cellClass);
  }
  // Add alignment class - default to left if not specified
  const align = column.align || 'left';
  classes = appendClassName(classes, `text-${align}`);
  if (
    hasClassLookupField(ctx.sortedColumnFieldLookup?.(), field, () =>
      ctx.getSortDirection?.(column)
    )
  ) {
    classes = appendClassName(classes, 'col-is-sorted');
  }
  if (
    hasClassLookupField(ctx.activeFilterFieldLookup?.(), field, () => ctx.hasActiveFilter?.(field))
  ) {
    classes = appendClassName(classes, 'col-is-filtered');
  }
  if (column.pinned === 'left') {
    classes = appendClassName(classes, 'pinned-left');
  } else if (column.pinned === 'right') {
    classes = appendClassName(classes, 'pinned-right');
  }
  if (ctx.wrappedColumns().has(field)) {
    classes = appendClassName(classes, 'cell-wrap');
  }
  if (ctx.duplicateHighlightColumns().has(field)) {
    const value = (row as LooseValue)?.[field];
    if (!ctx.isEmptyValue(value)) {
      const key = ctx.getFilterOptionKey(value);
      if (ctx.duplicateValueKeys().get(field)?.has(key)) {
        classes = appendClassName(classes, 'cell-duplicate');
      }
    }
  }
  return classes;
}
export function getCellStyleHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [row, column] = args;
  // Access the signal to make ctx reactive
  ctx.alignmentChangeTimestamp();
  const align = column.align || 'left';
  if (column.pinned) {
    const pinned = ctx.pinnedOffsets();
    const field = ctx.getColumnField(column);
    if (column.pinned === 'left') {
      return getGridCellStyle(align, 'left', pinned.left.get(field) ?? 0);
    } else if (column.pinned === 'right') {
      return getGridCellStyle(align, 'right', pinned.right.get(field) ?? 0);
    }
  }
  return getGridCellStyle(align);
}
export function getHeaderStyleHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  // Access the signal to make ctx reactive
  ctx.alignmentChangeTimestamp();
  const align = column.align || 'left';
  if (column.pinned) {
    const pinned = ctx.pinnedOffsets();
    const field = ctx.getColumnField(column);
    if (column.pinned === 'left') {
      return getGridCellStyle(align, 'left', pinned.left.get(field) ?? 0);
    } else if (column.pinned === 'right') {
      return getGridCellStyle(align, 'right', pinned.right.get(field) ?? 0);
    }
  }
  return getGridCellStyle(align);
}
export function getHeaderClassHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  // Touch the alignment signal so class recomputation tracks width/alignment updates.
  ctx.alignmentChangeTimestamp();
  const align = column.align || 'left';
  return `text-${align}`;
}
export function isFirstVisibleColumnHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  const cachedField =
    typeof ctx.firstVisibleColumnField === 'function' ? ctx.firstVisibleColumnField() : null;
  if (typeof cachedField === 'string') {
    return cachedField === ctx.getColumnField(column);
  }

  const cols = ctx.visibleColumns();
  if (!cols.length) return false;
  return ctx.getColumnField(cols[0]) === ctx.getColumnField(column);
}
export function getMenuAggregateValueHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const column = ctx.selectedColumnForMenu();
  if (!column) return null;
  const field = ctx.getColumnField(column);
  return (
    ctx.columns.find((col: LooseValue) => ctx.getColumnField(col) === field)?.aggregate ?? null
  );
}
export function getAggregateCellClassHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  // Touch the alignment signal so class recomputation tracks width/alignment updates.
  ctx.alignmentChangeTimestamp();
  let classes = '';
  const field = ctx.getColumnField(column);
  const align = column.align || 'left';
  classes = appendClassName(classes, `text-${align}`);
  if (
    hasClassLookupField(ctx.sortedColumnFieldLookup?.(), field, () =>
      ctx.getSortDirection?.(column)
    )
  ) {
    classes = appendClassName(classes, 'col-is-sorted');
  }
  if (
    hasClassLookupField(ctx.activeFilterFieldLookup?.(), field, () => ctx.hasActiveFilter?.(field))
  ) {
    classes = appendClassName(classes, 'col-is-filtered');
  }
  if (column.pinned === 'left') {
    classes = appendClassName(classes, 'pinned-left');
  } else if (column.pinned === 'right') {
    classes = appendClassName(classes, 'pinned-right');
  }
  return classes;
}
export function shouldPinSelectionHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  return !!ctx.config.selectable && ctx.config.pinSelectionColumn !== false;
}
export function getSelectionColumnWidthHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  return resolveUnifiedDataGridSelectionColumnWidth(resolveDataGridHostElement(ctx));
}
export function getRowClassHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [row, index] = args;
  const appendRowClass =
    row && typeof row === 'object' && (row as Record<string, unknown>)['__appendRow']
      ? 'append-row'
      : '';
  const configuredClass =
    typeof ctx.config.rowClass === 'function'
      ? ctx.config.rowClass(row, index)
      : ctx.config.rowClass || '';
  return [configuredClass, appendRowClass].filter(Boolean).join(' ');
}
export function isGroupRowHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [row] = args;
  return row.kind === 'group';
}
export function getDisplayRowDataHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [row] = args;
  return row.kind === 'data' ? row.data : null;
}
export function getGroupFilterTermHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [id] = args;
  return ctx.groupFilterTerms().get(id) ?? '';
}
export function setGroupFilterTermHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [id, value] = args;
  const next = new Map(ctx.groupFilterTerms());
  const trimmed = value.trim();
  if (trimmed) {
    next.set(id, trimmed);
  } else {
    next.delete(id);
  }
  ctx.groupFilterTerms.set(next);
  ctx.bumpAggregateCache();
  ctx.cdr.markForCheck();
}
export function clearGroupFilterTermHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [id] = args;
  const next = new Map(ctx.groupFilterTerms());
  next.delete(id);
  ctx.groupFilterTerms.set(next);
  ctx.bumpAggregateCache();
  ctx.cdr.markForCheck();
}
export function filterGroupRowsHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [rows, term] = args;
  const search = term.trim().toLowerCase();
  if (!search) return rows;
  return rows.filter((row: LooseValue) => ctx.rowMatchesGroupFilter(row, search));
}
export function rowMatchesGroupFilterHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [row, search] = args;
  const columns = ctx.visibleColumns();
  for (const column of columns) {
    const field = ctx.getColumnField(column);
    const rawValue = (row as LooseValue)?.[field];
    const label = column.options?.length ? ctx.getFilterOptionLabel(column, rawValue) : rawValue;
    if (label === null || label === undefined) {
      continue;
    }
    if (String(label).toLowerCase().includes(search)) {
      return true;
    }
  }
  return false;
}
export function getGroupLabelHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [field] = args;
  const cachedLabel =
    typeof ctx.columnLabelLookup === 'function'
      ? (ctx.columnLabelLookup() as Map<string, string>).get(String(field))
      : null;
  if (cachedLabel) {
    return cachedLabel;
  }

  const column = ctx.columns.find((col: LooseValue) => col.field === field);
  const label = column?.header || field;
  const interval =
    typeof ctx.getGroupDateInterval === 'function' ? ctx.getGroupDateInterval(String(field)) : null;
  if (!interval) {
    return label;
  }
  const intervalLabel =
    interval === 'day'
      ? 'Day'
      : interval === 'week'
        ? 'Week'
        : interval === 'month'
          ? 'Month'
          : interval === 'quarter'
            ? 'Quarter'
            : 'Year';
  return `${label} by ${intervalLabel}`;
}
function normalizeGroupDisplayValue(value: LooseValue): string {
  if (value === null || value === undefined) {
    return 'Empty';
  }
  const text = String(value).trim();
  return text || 'Empty';
}
export function getGroupDisplayValueHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [group] = args;
  return normalizeGroupDisplayValue(group?.value);
}
export function getGroupToneClassHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [group] = args;
  const field = String(group?.field ?? '')
    .trim()
    .toLowerCase();
  const value = normalizeGroupDisplayValue(group?.value).toLowerCase();
  const cacheKey = `${field}|${value}`;
  const cached = groupToneClassCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const descriptor = `${field} ${value}`;
  let toneClass = 'tone-gray';

  if (/\b(in[\s-]?progress|active|ongoing|working|started|running|open)\b/.test(descriptor)) {
    toneClass = 'tone-blue';
  } else if (/\b(done|complete|completed|closed|resolved|approved|success)\b/.test(descriptor)) {
    toneClass = 'tone-green';
  } else if (/\b(blocked|cancelled|canceled|rejected|failed|lost|error)\b/.test(descriptor)) {
    toneClass = 'tone-red';
  } else if (/\b(review|qa|testing|staging|draft)\b/.test(descriptor)) {
    toneClass = 'tone-purple';
  } else if (/\b(waiting|hold|paused|deferred|later)\b/.test(descriptor)) {
    toneClass = 'tone-yellow';
  } else if (/\b(priority|severity|brand|owner|assign|country|supplier|customer)\b/.test(field)) {
    toneClass = 'tone-teal';
  }

  groupToneClassCache.set(cacheKey, toneClass);
  if (groupToneClassCache.size > GROUP_TONE_CLASS_CACHE_LIMIT) {
    const oldestKey = groupToneClassCache.keys().next().value;
    if (oldestKey) {
      groupToneClassCache.delete(oldestKey);
    }
  }
  return toneClass;
}
export function buildGroupedRowsHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [data, groupFields, level, path, expandedSet] = args;
  const autoExpandGroups =
    (ctx.groupExpansionAuto?.() ?? true) &&
    (!(expandedSet instanceof Set) || expandedSet.size === 0) &&
    (typeof ctx.shouldAutoExpandGroupsCached === 'function'
      ? Boolean(ctx.shouldAutoExpandGroupsCached())
      : typeof ctx.shouldAutoExpandGroups !== 'function' || Boolean(ctx.shouldAutoExpandGroups()));
  const result: DisplayRow<T>[] = [];
  const groupFilterTerms =
    typeof ctx.groupFilterTerms === 'function' ? ctx.groupFilterTerms() : null;
  const hasGroupFilters = groupFilterTerms instanceof Map && groupFilterTerms.size > 0;
  appendGroupedRows(
    ctx,
    result,
    data,
    Array.isArray(groupFields) ? (groupFields as string[]) : [],
    0,
    level,
    path,
    expandedSet instanceof Set ? expandedSet : new Set<string>(),
    autoExpandGroups,
    (typeof ctx.shouldShowGroupFooterAggregates === 'function' &&
      Boolean(ctx.shouldShowGroupFooterAggregates())) ||
      false,
    hasGroupFilters
  );
  return result;
}
export function getColumnFieldHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  return column.field as string;
}
export function getFilterLabelHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [field] = args;
  const cachedLabel =
    typeof ctx.columnLabelLookup === 'function'
      ? (ctx.columnLabelLookup() as Map<string, string>).get(String(field))
      : null;
  if (cachedLabel) {
    return cachedLabel;
  }

  const column = ctx.columns.find((col: LooseValue) => col.field === field);
  return column?.header || field;
}
export function removeFilterHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [field] = args;
  const current = ctx.filterStates();
  const next = current.filter((f: LooseValue) => f.field !== field);
  if (sameGridFilterStates(current, next)) {
    return;
  }
  ctx.filterStates.set(next);
  ctx.updatePaginationState(ctx.filteredDataCount());
  ctx.emitChange('filter');
}

function normalizeGridFilterState(rawFilter: LooseValue): {
  field: string;
  operator: string;
  value: unknown;
  joinWithPrev: 'and' | 'or';
} | null {
  const field = String(rawFilter?.field ?? '').trim();
  if (!field) {
    return null;
  }

  const operator =
    typeof rawFilter?.operator === 'string' && rawFilter.operator.trim()
      ? rawFilter.operator.trim()
      : 'contains';
  const joinWithPrev = rawFilter?.joinWithPrev === 'or' ? 'or' : 'and';
  const value = operator === 'isEmpty' || operator === 'notEmpty' ? '' : (rawFilter?.value ?? '');

  return {
    field,
    operator,
    value,
    joinWithPrev
  };
}

function serializeGridFilterValue(value: unknown): string {
  if (value === undefined) {
    return '__undefined__';
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function sameGridFilterStates(left: readonly LooseValue[], right: readonly LooseValue[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const a = normalizeGridFilterState(left[index]);
    const b = normalizeGridFilterState(right[index]);
    if (!a || !b) {
      if (a !== b) {
        return false;
      }
      continue;
    }
    if (
      a.field !== b.field ||
      a.operator !== b.operator ||
      a.joinWithPrev !== b.joinWithPrev ||
      serializeGridFilterValue(a.value) !== serializeGridFilterValue(b.value)
    ) {
      return false;
    }
  }

  return true;
}

export function applyExternalFiltersHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [filters] = args;
  const nextStates = Array.isArray(filters)
    ? filters
        .map(rawFilter => normalizeGridFilterState(rawFilter))
        .filter(
          (
            filter
          ): filter is {
            field: string;
            operator: string;
            value: unknown;
            joinWithPrev: 'and' | 'or';
          } => !!filter
        )
    : [];

  if (sameGridFilterStates(ctx.filterStates(), nextStates)) {
    return;
  }

  ctx.filterStates.set(nextStates);
  ctx.updatePaginationState(ctx.filteredDataCount());
  ctx.emitChange('filter');
}
export function clearAllFiltersHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const hadFilters = ctx.filterStates().length > 0;
  const hadGlobalSearch =
    typeof ctx.globalSearchTerm === 'string' && ctx.globalSearchTerm.trim().length > 0;
  const quickFilterValues = ctx.quickFilterValues?.();
  const hadQuickFilters = quickFilterValues instanceof Map && quickFilterValues.size > 0;
  if (!hadFilters && !hadGlobalSearch && !hadQuickFilters) {
    return;
  }

  ctx.filterStates.set([]);
  ctx.globalSearchTerm = '';
  if (quickFilterValues instanceof Map) {
    ctx.quickFilterValues.set(new Map());
  }
  ctx.updatePaginationState(ctx.filteredDataCount());
  ctx.emitChange('filter');
}
export function hasActiveFiltersHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  return ctx.filterStates().length > 0 || ctx.globalSearchTerm.trim().length > 0;
}
export function hasAggregatesHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const cached =
    typeof ctx.hasAggregateColumnsCached === 'function'
      ? ctx.hasAggregateColumnsCached()
      : undefined;
  if (typeof cached === 'boolean') {
    return cached;
  }

  return ctx.visibleColumns().some((col: LooseValue) => !!col.aggregate);
}
export function shouldShowGroupFooterAggregatesHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const hasAggregates = ctx.hasAggregates();
  if (!hasAggregates || ctx.groupColumns().length === 0) {
    return false;
  }
  return ctx.showGroupFooterAggregates() || ctx.shouldAutoShowAggregates();
}
export function shouldShowGrandTotalAggregatesHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const hasAggregates = ctx.hasAggregates();
  if (!hasAggregates) {
    return false;
  }
  return ctx.showGrandTotalAggregates() || ctx.shouldAutoShowAggregates();
}
export function bumpAggregateCacheHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  ctx.aggregateCacheToken += 1;
  ctx.aggregateCache.clear();
  ctx.percentAggregateTotalsCache?.clear?.();
}
export function invalidateFilteredSortedCacheHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  ctx.filteredSortedCacheKey += 1;
  ctx.filteredSortedCache = null;
}
export function getAggregateCacheKeyHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [scope, id, column] = args;
  const field = ctx.getColumnField(column);
  const aggregate = column.aggregate ?? 'none';
  return `${scope}|${id}|${field}|${aggregate}|${ctx.aggregateCacheToken}`;
}
export function getNonEmptyCountHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [data, field] = args;
  let count = 0;
  for (const row of data) {
    const value = (row as LooseValue)?.[field];
    if (!ctx.isEmptyValue(value)) {
      count += 1;
    }
  }
  return count;
}
export function getNumericValuesHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [data, field] = args;
  const values: number[] = [];
  for (const row of data) {
    const value = ctx.normalizeNumericValue((row as LooseValue)?.[field]);
    if (value !== null) {
      values.push(value);
    }
  }
  return values;
}
export function getPercentAggregateHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [data, totalData, column] = args;
  const field = ctx.getColumnField(column);
  const groupStats = collectPercentAggregateStats(ctx, data, field);
  const totalStats = getPercentAggregateTotalStats(ctx, totalData, field);

  if (groupStats.numericCount > 0 && totalStats.numericCount > 0) {
    return totalStats.sum > 0 ? (groupStats.sum / totalStats.sum) * 100 : Number.NaN;
  }

  return totalStats.nonEmptyCount > 0
    ? (groupStats.nonEmptyCount / totalStats.nonEmptyCount) * 100
    : Number.NaN;
}
export function getAggregateValueHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  try {
    if (!column.aggregate) return '';
    const data = ctx.getFilteredSortedData();
    if (data.length === 0) return '-';
    const cacheKey = ctx.getAggregateCacheKey('total', 'all', column);
    const cached = ctx.aggregateCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }
    const value =
      column.aggregate === 'percent'
        ? ctx.getPercentAggregate(data, data, column)
        : ctx.gridService.calculateAggregate(data, column.field as string, column.aggregate);
    // Check for invalid values
    if (!isFinite(value)) {
      debugGridWarn(`Invalid aggregate value for column "${column.header}":`, value);
      ctx.aggregateCache.set(cacheKey, '-');
      return '-';
    }
    // Format the aggregate value using column format if available
    if (column.format && !['count', 'distinct', 'percent'].includes(column.aggregate)) {
      try {
        const formatted = column.format(value);
        ctx.aggregateCache.set(cacheKey, formatted);
        return formatted;
      } catch (formatError) {
        reportGridError(`Error formatting aggregate for column "${column.header}":`, formatError);
        const fallback = String(value);
        ctx.aggregateCache.set(cacheKey, fallback);
        return fallback;
      }
    }
    // Default formatting based on aggregate type
    if (column.aggregate === 'count') {
      const result = Number(value).toLocaleString('en-US', {
        maximumFractionDigits: 0
      });
      ctx.aggregateCache.set(cacheKey, result);
      return result;
    }
    if (column.aggregate === 'distinct') {
      const result = Number(value).toLocaleString('en-US', {
        maximumFractionDigits: 0
      });
      ctx.aggregateCache.set(cacheKey, result);
      return result;
    }
    if (column.aggregate === 'percent') {
      const result = `${value.toFixed(2)}%`;
      ctx.aggregateCache.set(cacheKey, result);
      return result;
    }
    const result = value.toLocaleString('en-US', {
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
      maximumFractionDigits: 2
    });
    ctx.aggregateCache.set(cacheKey, result);
    return result;
  } catch (error) {
    reportGridError(`Error calculating aggregate for column "${column.header}":`, error);
    return '[Error]';
  }
}
export function onColumnResizeStartHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [event, column] = args;
  if (column.resizable === false) {
    return;
  }
  event.stopPropagation();
  event.preventDefault();
  const visibleColumns = (ctx.visibleColumns?.() as LooseValue[] | undefined) ?? [];
  visibleColumns.forEach((candidate: LooseValue) => {
    const candidateField = ctx.getColumnField(candidate);
    if (!candidateField) {
      return;
    }
    const renderedWidth = Math.round(
      Number(ctx.getRenderedColumnWidth?.(candidate) ?? ctx.getColumnPixelWidth(candidate)) || 0
    );
    if (renderedWidth > 0) {
      if (Math.round(Number(candidate.width) || 0) !== renderedWidth) {
        candidate.width = renderedWidth;
      }
      ctx.columnAutoWidthCache?.set(candidateField, renderedWidth);
    }
  });
  const headerCell = (event.target as HTMLElement).closest('th');
  const headerWidth = headerCell?.getBoundingClientRect().width ?? ctx.getColumnPixelWidth(column);
  const minWidth = ctx.getMinimumColumnWidth(column);
  const maxWidth = ctx.getMaximumColumnWidth(column);
  ctx.resizingColumnField = ctx.getColumnField(column);
  ctx.resizeStartX = event.clientX;
  ctx.resizeStartWidth = headerWidth;
  ctx.resizePendingWidth = headerWidth;
  ctx.resizeMinWidth = minWidth;
  ctx.resizeMaxWidth = maxWidth;
  ctx.isResizingColumn = true;
  // Add visual feedback
  document.body.style.cursor = 'ew-resize';
  document.body.style.userSelect = 'none';
  document.addEventListener('mousemove', ctx.handleColumnResizeMove);
  document.addEventListener('mouseup', ctx.handleColumnResizeUp);
}
export function queueColumnResizeApplyHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [field, width] = args;
  if (ctx.resizeRAF !== null) {
    return;
  }
  ctx.resizeRAF = requestAnimationFrame(() => {
    ctx.resizeRAF = null;
    if (!ctx.resizingColumnField || ctx.resizingColumnField !== field) {
      return;
    }
    const pendingWidth = ctx.resizePendingWidth || width;
    ctx.applyColumnWidth(field, pendingWidth, { preview: true, save: false });
  });
}
export function applyColumnWidthHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [field, width, options] = args;
  const column = ctx.findColumn(field);
  if (!column) return;
  const { minWidth, maxWidth } = getColumnResizeBounds(ctx, field, column);
  const clampedWidth = Math.min(Math.max(width, minWidth), maxWidth);
  const roundedWidth = Math.round(clampedWidth);
  const hasExplicitWidth = typeof column.width !== 'undefined';
  const isPreview = options?.preview === true;
  const isCommit = options?.commit === true;
  if (
    hasExplicitWidth &&
    Math.round(ctx.getColumnPixelWidth(column)) === roundedWidth &&
    !isCommit
  ) {
    return;
  }
  // Keep widths numeric so downstream math and persistence stay consistent.
  column.width = roundedWidth;
  ctx.columnAutoWidthCache?.set(field, roundedWidth);
  if (isPreview) {
    ctx.syncHeaderBodyWidths({ preview: true });
    return;
  }
  // Refresh the columns signal so computed state re-evaluates immediately.
  ctx.columnsSignal.set([...ctx.columnsSignal()]);
  // Trigger a frame-local refresh so the resize preview stays in sync.
  ctx.cdr.detectChanges();
  const shouldSync = options?.sync !== false;
  if (shouldSync) {
    // Mirror rendered widths into both tables after resize.
    ctx.syncHeaderBodyWidths();
  }
  if (options?.notify !== false) {
    ctx.emitColumnsChange?.();
  }
  // Save state after column resize
  const shouldSave = options?.save !== false;
  if (shouldSave && ctx.stateKey) {
    ctx.saveState();
  }
}

function hasExplicitColumnWidthValue(column: LooseValue): boolean {
  if (typeof column?.width === 'number') {
    return Number.isFinite(column.width);
  }
  if (typeof column?.width === 'string') {
    return column.width.trim().length > 0;
  }
  return false;
}

type SynchronizedWidthItem = {
  field: string | null;
  width: number;
  flexible: boolean;
  fillRemaining: boolean;
  kind: 'selection' | 'data' | 'actions';
};

function resolveViewportFillIndices(ctx: HelperContext, widths: SynchronizedWidthItem[]): number[] {
  return [];
}

function getColumnResizeBounds(
  ctx: HelperContext,
  field: string,
  column: LooseValue
): { minWidth: number; maxWidth: number } {
  const hasCachedResizeBounds =
    ctx.resizingColumnField === field &&
    Number.isFinite(Number(ctx.resizeMinWidth)) &&
    Number(ctx.resizeMinWidth) > 0 &&
    Number.isFinite(Number(ctx.resizeMaxWidth)) &&
    Number(ctx.resizeMaxWidth) > 0;

  if (hasCachedResizeBounds) {
    return {
      minWidth: Number(ctx.resizeMinWidth),
      maxWidth: Number(ctx.resizeMaxWidth)
    };
  }

  return {
    minWidth: ctx.getMinimumColumnWidth(column),
    maxWidth: ctx.getMaximumColumnWidth(column)
  };
}

function getSynchronizedColumnWidths(ctx: HelperContext, containerWidth = 0): number[] {
  const widths: SynchronizedWidthItem[] = [];
  if (ctx.config.selectable) {
    widths.push({
      field: null,
      width: Math.max(0, Math.round(Number(ctx.getSelectionColumnWidth?.() ?? 44))),
      flexible: false,
      fillRemaining: false,
      kind: 'selection'
    });
  }
  const visibleColumns = ctx.visibleColumns();
  for (const column of visibleColumns) {
    const field =
      typeof ctx.getColumnField === 'function'
        ? ctx.getColumnField(column)
        : typeof column?.field === 'string'
          ? column.field
          : null;
    widths.push({
      field,
      width: Math.max(0, Math.round(Number(ctx.getColumnPixelWidth(column)) || 0)),
      flexible: !hasExplicitColumnWidthValue(column),
      fillRemaining: column?.fillRemaining === true,
      kind: 'data'
    });
  }
  if (ctx.config.rowActions?.length) {
    widths.push({
      field: null,
      width: resolveUnifiedDataGridRowActionsColumnWidth(resolveDataGridHostElement(ctx)),
      flexible: false,
      fillRemaining: false,
      kind: 'actions'
    });
  }

  const synchronizedWidths: number[] = [];
  for (const item of widths) {
    synchronizedWidths.push(item.width);
  }
  return synchronizedWidths;
}

function getRenderedColumnWidths(ctx: HelperContext, containerWidth: number): number[] {
  if (!(containerWidth > 0)) {
    return [];
  }

  let visibleColumns: LooseValue[] | null = null;
  const getVisibleColumns = (): LooseValue[] => {
    if (visibleColumns === null) {
      visibleColumns = (ctx.visibleColumns?.() as LooseValue[] | undefined) ?? [];
    }
    return visibleColumns;
  };
  const cachedModelKey =
    !ctx.isResizingColumn && typeof ctx.renderedColumnWidthModelKey === 'function'
      ? String(ctx.renderedColumnWidthModelKey())
      : '';
  const modelKey =
    cachedModelKey ||
    [
      ctx.config?.selectable ? 1 : 0,
      (ctx.config?.rowActions?.length as number | undefined) ?? 0,
      ...getVisibleColumns().map(column => {
        const width = typeof column.width === 'string' ? column.width.trim() : (column.width ?? '');
        const minWidth = column.minWidth ?? '';
        const maxWidth = column.maxWidth ?? '';
        const fillRemaining = column.fillRemaining === true ? 1 : 0;
        return `${ctx.getColumnField(column)}:${width}:${minWidth}:${maxWidth}:${fillRemaining}`;
      })
    ].join('|');
  const cacheKey = `${containerWidth}|${modelKey}`;

  const cached = ctx.renderedColumnWidthCache as { key: string; widths: number[] } | undefined;

  if (cached?.key === cacheKey) {
    return cached.widths;
  }

  const widths = getSynchronizedColumnWidths(ctx, containerWidth);
  ctx.renderedColumnWidthCache = { key: cacheKey, widths };
  return widths;
}

function applyColGroupWidths(cols: HTMLElement[], widths: number[]): void {
  if (!cols.length) {
    return;
  }
  const length = Math.min(cols.length, widths.length);
  for (let index = 0; index < length; index += 1) {
    const width = `${widths[index]}px`;
    const col = cols[index];
    if (col.style.width !== width) {
      col.style.width = width;
    }
  }
}

function hasConnectedWidthSyncTargets(
  root: HTMLElement,
  targets: {
    viewport: HTMLElement | null;
    tables: HTMLElement[];
    tableCols: HTMLElement[][];
  }
): boolean {
  if (
    targets.viewport &&
    ((targets.viewport as { isConnected?: boolean }).isConnected === false ||
      !root.contains(targets.viewport))
  ) {
    return false;
  }

  for (let tableIndex = 0; tableIndex < targets.tables.length; tableIndex += 1) {
    const table = targets.tables[tableIndex];
    if ((table as { isConnected?: boolean }).isConnected === false || !root.contains(table)) {
      return false;
    }

    const cols = targets.tableCols[tableIndex] ?? [];
    for (const col of cols) {
      if ((col as { isConnected?: boolean }).isConnected === false || !table.contains(col)) {
        return false;
      }
    }
  }

  return true;
}

function resolveWidthSyncTargets(
  ctx: HelperContext,
  root: HTMLElement,
  useCache: boolean
): {
  viewport: HTMLElement | null;
  tables: HTMLElement[];
  tableCols: HTMLElement[][];
} {
  const cachedTargets =
    (ctx.headerBodyWidthSyncTargets as
      | {
          root: HTMLElement;
          viewport: HTMLElement | null;
          tables: HTMLElement[];
          tableCols: HTMLElement[][];
        }
      | null
      | undefined) ?? null;

  if (
    useCache &&
    cachedTargets?.root === root &&
    cachedTargets.tables.length > 0 &&
    hasConnectedWidthSyncTargets(root, cachedTargets)
  ) {
    return {
      viewport: cachedTargets.viewport,
      tables: cachedTargets.tables,
      tableCols: cachedTargets.tableCols
    };
  }

  const viewport =
    (ctx.gridViewport?.nativeElement as HTMLElement | undefined) ??
    (root.querySelector('.table-scroll, .virtual-scroll-viewport') as HTMLElement | null) ??
    null;
  const tables = Array.from(
    root.querySelectorAll('.header-table, .data-grid-table, .grid-calculate-footer__table')
  ) as HTMLElement[];
  const tableCols: HTMLElement[][] = [];
  for (const table of tables) {
    tableCols.push(Array.from(table.querySelectorAll('colgroup col')) as HTMLElement[]);
  }

  ctx.headerBodyWidthSyncTargets = {
    root,
    viewport,
    tables,
    tableCols
  };

  return {
    viewport,
    tables,
    tableCols
  };
}

function resolveWidthReferenceElement(ctx: HelperContext): HTMLElement | null {
  const root = (ctx.elementRef?.nativeElement as HTMLElement | undefined) ?? null;
  const viewport =
    (ctx.gridViewport?.nativeElement as HTMLElement | undefined) ??
    (root?.querySelector('.table-scroll, .virtual-scroll-viewport') as HTMLElement | null) ??
    null;
  return viewport ?? root;
}

function syncGridFillerMetrics(root: HTMLElement, viewport: HTMLElement | null): void {
  const bodyTable =
    (viewport?.querySelector(':scope > .data-grid-table') as HTMLElement | null) ??
    (root.querySelector('.grid-container .data-grid-table') as HTMLElement | null);
  if (!bodyTable) {
    root.style.setProperty('--dg-grid-filler-height', '0px');
    return;
  }

  const fillRows = Array.from(
    bodyTable.querySelectorAll('tbody:not(.grid-append-row-body) tr')
  ).filter(row => !row.classList.contains('append-row')) as HTMLElement[];
  const tableRect = bodyTable.getBoundingClientRect?.() ?? null;
  const lastFillRow = fillRows.at(-1) ?? null;
  const lastFillRowRect = lastFillRow?.getBoundingClientRect?.() ?? null;
  const measuredHeight =
    tableRect && lastFillRowRect && lastFillRowRect.bottom > tableRect.top
      ? lastFillRowRect.bottom - tableRect.top
      : (lastFillRow?.offsetTop ?? 0) + (lastFillRow?.offsetHeight ?? 0);
  const bodyHeight = Math.max(0, measuredHeight);
  const firstDataRow = fillRows.find(row => row.classList.contains('data-row')) ?? fillRows[0];
  const rowHeight = Math.max(
    0,
    firstDataRow?.getBoundingClientRect?.().height ?? firstDataRow?.offsetHeight ?? 0
  );

  root.style.setProperty('--dg-grid-filler-height', `${bodyHeight}px`);
  if (rowHeight > 0) {
    root.style.setProperty('--dg-grid-filler-row-height', `${rowHeight}px`);
  } else {
    root.style.removeProperty('--dg-grid-filler-row-height');
  }
}

function getPixelWidthFromString(ctx: HelperContext, width: string): number | null {
  const normalized = width.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const numeric = Number.parseFloat(normalized);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  if (/^\d+(\.\d+)?$/.test(normalized) || normalized.endsWith('px')) {
    return numeric;
  }

  const widthReference = resolveWidthReferenceElement(ctx);
  const referenceWidth = Math.max(0, widthReference?.clientWidth ?? 0);

  if (normalized.endsWith('%')) {
    return referenceWidth > 0 ? (referenceWidth * numeric) / 100 : null;
  }

  if (normalized.endsWith('rem')) {
    const rootFontSize = Number.parseFloat(
      getComputedStyle(document.documentElement).fontSize || '16'
    );
    return numeric * (Number.isFinite(rootFontSize) && rootFontSize > 0 ? rootFontSize : 16);
  }

  if (normalized.endsWith('em')) {
    const widthElement = widthReference ?? document.documentElement;
    const fontSize = Number.parseFloat(getComputedStyle(widthElement).fontSize || '16');
    return numeric * (Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 16);
  }

  return null;
}

function getColumnDescriptor(column: LooseValue): string {
  return `${column.field ?? ''} ${column.header ?? ''}`.trim().toLowerCase();
}

function getColumnWidthProfile(column: LooseValue): {
  min: number;
  max: number;
  padding: number;
  defaultWidth: number;
} {
  const descriptor = getColumnDescriptor(column);
  const explicitMin = Number(column.minWidth);
  const explicitMax = Number(column.maxWidth);

  let profile = { min: 72, max: 640, padding: 48, defaultWidth: 150 };

  if (
    column.type === 'date' ||
    column.cellType === 'date' ||
    /\b(date|deadline|start|end|accept)\b/.test(descriptor)
  ) {
    profile = { min: 104, max: 240, padding: 48, defaultWidth: 136 };
  } else if (
    column.type === 'number' ||
    column.cellType === 'number' ||
    /\b(price|amount|cost|total|budget|rate|qty|quantity|percent)\b/.test(descriptor)
  ) {
    profile = { min: 80, max: 320, padding: 48, defaultWidth: 128 };
  } else if (
    column.type === 'boolean' ||
    column.cellType === 'boolean' ||
    /\b(active|enabled|flag|boolean)\b/.test(descriptor)
  ) {
    profile = { min: 68, max: 160, padding: 44, defaultWidth: 96 };
  } else if (/\b(id|code|ref|number|no)\b/.test(descriptor)) {
    profile = { min: 72, max: 300, padding: 44, defaultWidth: 120 };
  } else if (/\b(email|mail|website|site|url|link)\b/.test(descriptor)) {
    profile = { min: 120, max: 560, padding: 48, defaultWidth: 220 };
  } else if (/\b(status|stage|type|brand|country|owner|assign)\b/.test(descriptor)) {
    profile = { min: 88, max: 360, padding: 48, defaultWidth: 150 };
  } else if (
    /\b(title|project|name|description|address|supplier|customer|client)\b/.test(descriptor)
  ) {
    profile = { min: 96, max: 760, padding: 52, defaultWidth: 220 };
  }

  if (Number.isFinite(explicitMin) && explicitMin > 0) {
    profile.min = Math.round(explicitMin);
  }

  if (Number.isFinite(explicitMax) && explicitMax > 0) {
    profile.max = Math.round(explicitMax);
  }

  if (profile.max < profile.min) {
    profile.max = profile.min;
  }

  profile.defaultWidth = Math.min(Math.max(profile.defaultWidth, profile.min), profile.max);

  return profile;
}

function getColumnMeasurementRows(ctx: HelperContext, mode: 'viewport' | 'filtered'): LooseValue[] {
  const rows =
    mode === 'viewport'
      ? typeof ctx.processedData === 'function'
        ? (ctx.processedData() as LooseValue[])
        : []
      : typeof ctx.getFilteredSortedData === 'function'
        ? (ctx.getFilteredSortedData() as LooseValue[])
        : ((ctx.dataSignal?.() as LooseValue[]) ?? []);

  return Array.isArray(rows) ? rows : [];
}

function normalizeMeasuredText(value: LooseValue): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).replace(/\s+/g, ' ').trim();
}

export function syncHeaderBodyWidthsHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [options] = args;
  const isPreview = options?.preview === true;
  if (
    !isPreview &&
    ctx.config?.remoteData &&
    typeof ctx.remoteDataStructureRefreshPending === 'function' &&
    ctx.remoteDataStructureRefreshPending()
  ) {
    return;
  }
  const flush = () => {
    const root = (ctx.elementRef?.nativeElement as HTMLElement | undefined) ?? null;
    if (!root) {
      return;
    }

    const { viewport, tables, tableCols } = resolveWidthSyncTargets(
      ctx,
      root,
      isPreview || !!ctx.isResizingColumn
    );
    const containerWidth = Math.max(0, viewport?.clientWidth ?? 0, root.clientWidth ?? 0);
    if (containerWidth <= 0) {
      return;
    }
    const widths = getSynchronizedColumnWidths(ctx, containerWidth);
    if (!widths.length) {
      return;
    }
    let totalWidth = 0;
    for (const width of widths) {
      totalWidth += width;
    }
    const appliedTableWidth = totalWidth;
    if (totalWidth > 0) {
      root.style.setProperty('--dg-grid-content-width', `${totalWidth}px`);
    }
    if (appliedTableWidth > 0) {
      root.style.setProperty('--dg-grid-table-width', `${appliedTableWidth}px`);
    }

    tables.forEach((table, index) => {
      const widthPx = `${appliedTableWidth}px`;
      if (table.style.width !== widthPx) {
        table.style.width = widthPx;
      }
      if (table.style.minWidth !== widthPx) {
        table.style.minWidth = widthPx;
      }
      let cols = tableCols[index] ?? [];
      if (cols.length !== widths.length) {
        cols = Array.from(table.querySelectorAll('colgroup col')) as HTMLElement[];
        tableCols[index] = cols;
      }
      applyColGroupWidths(cols, widths);
    });
    syncGridFillerMetrics(root, viewport);

    if (!isPreview) {
      ctx.queueDefaultGridOverflowSync?.();
    }
  };

  if (ctx.isResizingColumn) {
    flush();
    return;
  }

  if (ctx.headerBodyWidthSyncRAF != null) {
    return;
  }

  const schedule =
    typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (callback: FrameRequestCallback) => setTimeout(callback, 0);

  ctx.headerBodyWidthSyncRAF = schedule(() => {
    ctx.headerBodyWidthSyncRAF = null;
    flush();
  });
}
export function getRenderedColumnWidthHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [column] = args;
  const root = (ctx.elementRef?.nativeElement as HTMLElement | undefined) ?? null;
  const viewport =
    (ctx.gridViewport?.nativeElement as HTMLElement | undefined) ??
    (root?.querySelector('.table-scroll, .virtual-scroll-viewport') as HTMLElement | null) ??
    null;
  const containerWidth = Math.max(0, viewport?.clientWidth ?? 0, root?.clientWidth ?? 0);
  const widths = getRenderedColumnWidths(ctx, containerWidth);

  if (!widths.length) {
    return ctx.getColumnPixelWidth(column);
  }

  const field = ctx.getColumnField(column);
  const cachedIndex =
    typeof ctx.visibleColumnIndexLookup === 'function'
      ? (ctx.visibleColumnIndexLookup() as Map<string, number>).get(field)
      : undefined;
  const index =
    cachedIndex === undefined
      ? ((ctx.visibleColumns?.() as LooseValue[] | undefined) ?? []).findIndex(
          candidate => ctx.getColumnField(candidate) === field
        )
      : cachedIndex;
  const offset = ctx.config?.selectable ? 1 : 0;

  if (index < 0) {
    return ctx.getColumnPixelWidth(column);
  }

  return widths[index + offset] ?? ctx.getColumnPixelWidth(column);
}
export function calculateAutoWidthHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column, options] = args;
  const measureCtx = ctx.ensureMeasureContext();
  if (!measureCtx) {
    return null;
  }
  measureCtx.font = ctx.getTableFont();
  const field = ctx.getColumnField(column);
  const headerText = column.header || field;
  const profile = getColumnWidthProfile(column);
  const measurementMode = options?.mode === 'viewport' ? 'viewport' : 'filtered';
  let maxWidth = measureCtx.measureText(headerText).width;
  const rows = getColumnMeasurementRows(ctx, measurementMode);
  const sampleSize = Math.min(rows.length, measurementMode === 'viewport' ? 60 : 120);
  for (let i = 0; i < sampleSize; i++) {
    const titleText =
      typeof ctx.getCellTitle === 'function' ? ctx.getCellTitle(rows[i], column) : null;
    const value = titleText ?? ctx.getCellValue(rows[i], column);
    const text = normalizeMeasuredText(value);
    if (!text) {
      continue;
    }
    const measured = measureCtx.measureText(text).width;
    if (measured > maxWidth) {
      maxWidth = measured;
    }
  }
  const computedWidth = Math.ceil(maxWidth + profile.padding);
  const min = ctx.getMinimumColumnWidth(column);
  const max = ctx.getMaximumColumnWidth(column);
  return Math.min(Math.max(computedWidth, min), max);
}
export function ensureMeasureContextHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (typeof document === 'undefined') {
    return null;
  }
  if (!ctx.measureCanvas) {
    ctx.measureCanvas = document.createElement('canvas');
  }
  return ctx.measureCanvas.getContext('2d');
}
export function getTableFontHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (typeof window === 'undefined') {
    return '12px Inter, sans-serif';
  }
  const table = ctx.gridViewport?.nativeElement?.querySelector('table');
  if (table) {
    const style = window.getComputedStyle(table);
    return style.font || `${style.fontSize} ${style.fontFamily}`;
  }
  return '12px Inter, sans-serif';
}
export function getColumnPixelWidthHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  if (typeof column.width === 'number') {
    return column.width;
  }
  if (typeof column.width === 'string') {
    const parsed = getPixelWidthFromString(ctx, column.width);
    if (parsed !== null) {
      return parsed;
    }
  }
  const field = ctx.getColumnField(column);
  const cachedWidth = ctx.columnAutoWidthCache?.get(field);
  if (typeof cachedWidth === 'number' && Number.isFinite(cachedWidth) && cachedWidth > 0) {
    return cachedWidth;
  }
  if (!ctx.config?.autoSizeColumns) {
    return getColumnWidthProfile(column).defaultWidth;
  }
  const measuredWidth = Number(ctx.calculateAutoWidth?.(column));
  if (Number.isFinite(measuredWidth) && measuredWidth > 0) {
    ctx.columnAutoWidthCache?.set(field, measuredWidth);
    return measuredWidth;
  }
  return ctx.getMinimumColumnWidth(column);
}
export function getMinimumColumnWidthHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  const profile = getColumnWidthProfile(column);
  const headerText = column.header || String(column.field);
  const measureCtx = ctx.ensureMeasureContext();
  if (measureCtx) {
    measureCtx.font = ctx.getTableFont();
    const headerWidth = measureCtx.measureText(headerText).width;
    const calculated = Math.ceil(headerWidth + profile.padding);
    return Math.min(Math.max(calculated, profile.min), profile.max);
  }
  return profile.min;
}
export function getMaximumColumnWidthHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  return getColumnWidthProfile(column).max;
}
export function getTotalTableWidthHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const cached =
    typeof ctx.totalTableWidthCached === 'function' ? Number(ctx.totalTableWidthCached()) : NaN;
  if (Number.isFinite(cached) && cached >= 0) {
    return cached;
  }

  let total = 0;
  // Selection column
  if (ctx.config.selectable) {
    total += Number(
      ctx.getSelectionColumnWidth?.() ??
        resolveUnifiedDataGridSelectionColumnWidth(resolveDataGridHostElement(ctx))
    );
  }
  // All visible columns
  const visibleColumns = ctx.visibleColumns();
  for (const column of visibleColumns) {
    total += ctx.getColumnPixelWidth(column);
  }
  // Actions column
  if (ctx.config.rowActions?.length) {
    total += resolveUnifiedDataGridRowActionsColumnWidth(resolveDataGridHostElement(ctx));
  }
  return total;
}
export function updateResizeGuideHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  return;
}
export function clearColumnResizeStateHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  ctx.resizingColumnField = null;
  ctx.resizeStartX = 0;
  ctx.resizeStartWidth = 0;
  ctx.resizePendingWidth = 0;
  ctx.resizeMinWidth = 0;
  ctx.resizeMaxWidth = Number.POSITIVE_INFINITY;
  ctx.isResizingColumn = false;
  ctx.headerBodyWidthSyncTargets = null;
  ctx.detachResizeListeners();
}
export function detachResizeListenersHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  document.removeEventListener('mousemove', ctx.handleColumnResizeMove);
  document.removeEventListener('mouseup', ctx.handleColumnResizeUp);
}

function getColumnFieldValue(ctx: HelperContext, column: LooseValue): string {
  return String(ctx.getColumnField?.(column) ?? column?.field ?? '');
}

function getColumnDragLabel(ctx: HelperContext, field: string): string {
  const column = Array.isArray(ctx.columns)
    ? ctx.columns.find(candidate => getColumnFieldValue(ctx, candidate) === field)
    : null;
  const label = String(column?.header ?? field).trim();
  return label || field;
}

function buildColumnReorderPreview(
  ctx: HelperContext,
  sourceField: string,
  targetField: string,
  edge: 'before' | 'after' = 'before'
): LooseValue[] | null {
  if (!sourceField || !targetField || sourceField === targetField || !Array.isArray(ctx.columns)) {
    return null;
  }

  const updated = [...ctx.columns];
  const fromIndex = updated.findIndex(column => getColumnFieldValue(ctx, column) === sourceField);
  if (fromIndex === -1) {
    return null;
  }

  const [moved] = updated.splice(fromIndex, 1);
  const adjustedTargetIndex = updated.findIndex(
    column => getColumnFieldValue(ctx, column) === targetField
  );
  if (adjustedTargetIndex === -1) {
    return null;
  }

  const insertIndex = edge === 'after' ? adjustedTargetIndex + 1 : adjustedTargetIndex;
  updated.splice(insertIndex, 0, moved);
  return updated;
}

function syncColumnDragPreviewLayout(ctx: HelperContext): void {
  ctx.applyPinnedOrdering?.();
  ctx.cdr?.markForCheck?.();
  ctx.syncHeaderBodyWidths?.();
  queueDefaultGridOverflowSyncHelper(ctx);
}

function hasColumnOrderChanged(
  ctx: HelperContext,
  currentColumns: LooseValue[] | null | undefined,
  originalColumns: LooseValue[] | null | undefined
): boolean {
  if (!Array.isArray(currentColumns) || !Array.isArray(originalColumns)) {
    return false;
  }
  if (currentColumns.length !== originalColumns.length) {
    return true;
  }
  return currentColumns.some(
    (column, index) =>
      getColumnFieldValue(ctx, column) !== getColumnFieldValue(ctx, originalColumns[index])
  );
}

function detachColumnDragDocumentMove(ctx: HelperContext): void {
  const handler = ctx.columnDragDocumentMoveHandler as ((event: DragEvent) => void) | null;
  if (handler) {
    document.removeEventListener('dragover', handler, true);
    ctx.columnDragDocumentMoveHandler = null;
  }
}

function detachColumnPointerDragDocumentHandlers(ctx: HelperContext): void {
  const moveHandler = ctx.columnPointerDragMoveHandler as ((event: PointerEvent) => void) | null;
  const upHandler = ctx.columnPointerDragUpHandler as ((event: PointerEvent) => void) | null;
  const cancelHandler = ctx.columnPointerDragCancelHandler as
    | ((event: PointerEvent) => void)
    | null;

  if (moveHandler) {
    document.removeEventListener('pointermove', moveHandler, true);
  }
  if (upHandler) {
    document.removeEventListener('pointerup', upHandler, true);
  }
  if (cancelHandler) {
    document.removeEventListener('pointercancel', cancelHandler, true);
  }

  ctx.columnPointerDragMoveHandler = null;
  ctx.columnPointerDragUpHandler = null;
  ctx.columnPointerDragCancelHandler = null;
}

function resolveDataGridRootElement(ctx: HelperContext): HTMLElement | null {
  const host = resolveDataGridHostElement(ctx);
  return (host?.querySelector('.engineers-salary-reference-data-grid') as HTMLElement | null) ?? host;
}

function resolveColumnDragGroupPanel(ctx: HelperContext): HTMLElement | null {
  return resolveDataGridRootElement(ctx)?.querySelector('.group-panel') as HTMLElement | null;
}

function getHeaderCellField(cell: HTMLElement | null): string {
  return cell?.dataset?.['columnField'] || cell?.getAttribute('data-column-field') || '';
}

function getHeaderReorderCells(ctx: HelperContext): HTMLElement[] {
  const root = resolveDataGridRootElement(ctx);
  return Array.from(
    root?.querySelectorAll<HTMLElement>(
      '.header-table thead tr.header-row th[data-column-field]'
    ) ?? []
  ).filter(cell => !!getHeaderCellField(cell));
}

function getRectWidth(rect: DOMRect): number {
  return Number.isFinite(rect.width) && rect.width > 0
    ? rect.width
    : Math.max(0, rect.right - rect.left);
}

function getRectHeight(rect: DOMRect): number {
  return Number.isFinite(rect.height) && rect.height > 0
    ? rect.height
    : Math.max(0, rect.bottom - rect.top);
}

function resolveColumnDragHeaderCell(
  ctx: HelperContext,
  sourceField: string,
  fallbackCell?: HTMLElement | null
): HTMLElement | null {
  if (fallbackCell?.matches?.('th')) {
    return fallbackCell;
  }

  if (fallbackCell) {
    const headerCell = fallbackCell.closest?.('th') as HTMLElement | null;
    if (headerCell) {
      return headerCell;
    }
  }

  const cells = getHeaderReorderCells(ctx);
  return (
    cells.find(cell => getHeaderCellField(cell) === sourceField) ??
    cells.find(cell => getHeaderCellField(cell) === String(ctx.draggingColumnField ?? '')) ??
    null
  );
}

function applyColumnDragCardHeaderMetrics(
  ctx: HelperContext,
  card: HTMLElement,
  sourceField: string,
  fallbackCell?: HTMLElement | null
): boolean {
  const sourceCell = resolveColumnDragHeaderCell(ctx, sourceField, fallbackCell);
  if (!sourceCell) {
    return false;
  }

  const rect = sourceCell.getBoundingClientRect();
  const rootRect = resolveDataGridRootElement(ctx)?.getBoundingClientRect();
  const width = getRectWidth(rect);
  const height = getRectHeight(rect);
  if (!Number.isFinite(rect.top)) {
    return false;
  }

  const cardHeight = Math.max(
    COLUMN_DRAG_CARD_MIN_HEIGHT_PX,
    Math.min(COLUMN_DRAG_CARD_MAX_HEIGHT_PX, height + 10)
  );
  const rootTop = rootRect && Number.isFinite(rootRect.top) ? rootRect.top : 0;
  const cardTop = Math.max(rootTop, rect.top - cardHeight - COLUMN_DRAG_CARD_VERTICAL_GAP_PX);

  card.style.top = `${Math.round(cardTop)}px`;
  if (width > 0) {
    card.style.setProperty('--dg-column-drag-card-width', `${Math.round(width)}px`);
  }
  card.style.height = `${Math.round(cardHeight)}px`;
  return true;
}

function resolveHeaderInsertionTargetAtClientX(
  ctx: HelperContext,
  clientX: number,
  sourceField: string
): { cell: HTMLElement; field: string; edge: 'before' | 'after' } | null {
  if (!Number.isFinite(clientX)) {
    return null;
  }

  const allCells = getHeaderReorderCells(ctx);
  const cells = allCells.filter(cell => getHeaderCellField(cell) !== sourceField);
  if (!cells.length) {
    return null;
  }

  const sourceIndex = allCells.findIndex(cell => getHeaderCellField(cell) === sourceField);
  const hitCell = cells.find(cell => {
    const rect = cell.getBoundingClientRect();
    const left = Math.min(rect.left, rect.right);
    const right = Math.max(rect.left, rect.right);
    return clientX >= left && clientX <= right;
  });

  if (hitCell) {
    const targetIndex = allCells.indexOf(hitCell);
    const field = getHeaderCellField(hitCell);
    if (sourceIndex >= 0 && targetIndex >= 0 && targetIndex !== sourceIndex) {
      return { cell: hitCell, field, edge: targetIndex > sourceIndex ? 'after' : 'before' };
    }

    const rect = hitCell.getBoundingClientRect();
    const midpoint = rect.left + getRectWidth(rect) / 2;
    const placeAfter = ctx.config?.rtl ? clientX < midpoint : clientX >= midpoint;
    return { cell: hitCell, field, edge: placeAfter ? 'after' : 'before' };
  }

  const rtl = !!ctx.config?.rtl;
  for (const cell of cells) {
    const rect = cell.getBoundingClientRect();
    const midpoint = rect.left + getRectWidth(rect) / 2;
    const shouldInsertBefore = rtl ? clientX > midpoint : clientX < midpoint;
    if (shouldInsertBefore) {
      return { cell, field: getHeaderCellField(cell), edge: 'before' };
    }
  }

  const lastCell = cells[cells.length - 1];
  return { cell: lastCell, field: getHeaderCellField(lastCell), edge: 'after' };
}

function isPointInsideElement(
  element: HTMLElement | null,
  clientX: number,
  clientY: number | undefined
): boolean {
  if (
    !element ||
    !Number.isFinite(clientX) ||
    typeof clientY !== 'number' ||
    !Number.isFinite(clientY)
  ) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return (
    clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
  );
}

function ensureColumnDragOverlayCard(ctx: HelperContext): HTMLElement | null {
  const root = resolveDataGridRootElement(ctx);
  if (!root) {
    return null;
  }

  let card = ctx.columnDragOverlayCard as HTMLElement | null;
  if (!card || !card.parentElement) {
    card = document.createElement('div');
    card.className = 'dg-column-drag-card';
    card.setAttribute('aria-hidden', 'true');
    root.appendChild(card);
    ctx.columnDragOverlayCard = card;
  }

  return card;
}

function ensureColumnDropMarker(ctx: HelperContext): HTMLElement | null {
  const root = resolveDataGridRootElement(ctx);
  if (!root) {
    return null;
  }

  let marker = ctx.columnDropMarker as HTMLElement | null;
  if (!marker || !marker.parentElement) {
    marker = document.createElement('div');
    marker.className = 'dg-column-drop-marker';
    marker.setAttribute('aria-hidden', 'true');
    root.appendChild(marker);
    ctx.columnDropMarker = marker;
  }

  return marker;
}

function setColumnDragCardLabel(ctx: HelperContext, field: string, label?: string | null): void {
  const card = ensureColumnDragOverlayCard(ctx);
  if (!card) {
    return;
  }

  card.textContent = String(label || getColumnDragLabel(ctx, field));
}

function setColumnDragCardPosition(
  ctx: HelperContext,
  clientX: number,
  clientY?: number,
  fallbackCell?: HTMLElement | null
): void {
  if (!Number.isFinite(clientX)) {
    return;
  }

  const card = ensureColumnDragOverlayCard(ctx);
  if (!card) {
    return;
  }

  const sourceField = String(ctx.draggingColumnField ?? ctx.columnPointerDragSourceField ?? '');
  card.style.left = `${Math.round(clientX)}px`;
  if (!applyColumnDragCardHeaderMetrics(ctx, card, sourceField, fallbackCell)) {
    const fallbackTop = typeof clientY === 'number' && Number.isFinite(clientY) ? clientY : 0;
    card.style.top = `${Math.round(fallbackTop)}px`;
    card.style.removeProperty('height');
  }
}

function setColumnDragCardWidth(ctx: HelperContext, sourceField: string): void {
  const sourceCell = resolveColumnDragHeaderCell(ctx, sourceField);
  const rect = sourceCell?.getBoundingClientRect();
  const width = rect ? getRectWidth(rect) : 0;
  const card = ensureColumnDragOverlayCard(ctx);
  if (!card || !Number.isFinite(width) || !width) {
    return;
  }

  card.style.setProperty('--dg-column-drag-card-width', `${Math.round(width)}px`);
}

function setColumnDropGuide(
  ctx: HelperContext,
  targetCell: HTMLElement | null,
  edge: 'before' | 'after' | null
): void {
  const marker = ensureColumnDropMarker(ctx);
  if (!marker || !targetCell || !edge) {
    return;
  }

  const targetRect = targetCell.getBoundingClientRect();
  const guideX = edge === 'after' ? targetRect.right : targetRect.left;
  const guideHeight =
    Number.isFinite(targetRect.height) && targetRect.height > 0
      ? targetRect.height
      : Math.max(0, targetRect.bottom - targetRect.top);
  marker.style.left = `${Math.round(guideX)}px`;
  marker.style.top = `${Math.round(targetRect.top)}px`;
  marker.style.height = `${Math.round(guideHeight)}px`;
}

function clearColumnDropGuide(ctx: HelperContext): void {
  const marker = ctx.columnDropMarker as HTMLElement | null;
  marker?.remove();
  ctx.columnDropMarker = null;
}

function clearColumnDragCard(ctx: HelperContext): void {
  const card = ctx.columnDragOverlayCard as HTMLElement | null;
  card?.remove();
  ctx.columnDragOverlayCard = null;
}

function clearColumnDragInGridPreview(ctx: HelperContext): void {
  detachColumnDragDocumentMove(ctx);

  const root = resolveDataGridRootElement(ctx);
  root?.classList.remove('is-column-reordering');
  clearColumnDropGuide(ctx);
  clearColumnDragCard(ctx);
  document.body.style.cursor = '';
  document.body.style.userSelect = '';

  const nativeImage = ctx.columnDragNativeImage as HTMLElement | null;
  if (nativeImage?.parentNode) {
    nativeImage.parentNode.removeChild(nativeImage);
  }
  ctx.columnDragNativeImage = null;
  ctx.columnDragPointerInsideGrid = false;
}

function clearColumnDragPreview(ctx: HelperContext): void {
  ctx.columnDragPreviewOriginalColumns = null;
  clearColumnDragInGridPreview(ctx);
}

function clearColumnPointerDragState(ctx: HelperContext): void {
  detachColumnPointerDragDocumentHandlers(ctx);
  ctx.columnPointerDragSourceField = null;
  ctx.columnPointerDragPointerId = null;
  ctx.columnPointerDragLabel = null;
  ctx.columnPointerDragStarted = false;
  ctx.columnPointerDragStartX = 0;
  ctx.columnPointerDragStartY = 0;
}

function restoreColumnDragPreview(ctx: HelperContext): void {
  const originalColumns = ctx.columnDragPreviewOriginalColumns;
  if (Array.isArray(originalColumns)) {
    if (hasColumnOrderChanged(ctx, ctx.columns, originalColumns)) {
      ctx.columns = [...originalColumns];
      syncColumnDragPreviewLayout(ctx);
    }
  }
  clearColumnDragPreview(ctx);
}

function updateColumnDragInGridPreviewPosition(
  ctx: HelperContext,
  clientX: number,
  clientY?: number
): void {
  if (!ctx.draggingColumnField || !Number.isFinite(clientX)) {
    return;
  }

  ctx.columnDragPointerInsideGrid =
    typeof clientY === 'number' && Number.isFinite(clientY)
      ? isPointInsideElement(resolveDataGridRootElement(ctx), clientX, clientY)
      : true;
  setColumnDragCardPosition(ctx, clientX, clientY);
}

function resolveColumnDragDropEdge(
  ctx: HelperContext,
  event: DragEvent,
  sourceField: string,
  targetField: string
): 'before' | 'after' {
  const target = event.currentTarget as HTMLElement | null;
  if (!target) {
    return 'before';
  }

  const rect = target.getBoundingClientRect();
  const midpoint = rect.left + rect.width / 2;
  const placeAfter = ctx.config?.rtl ? event.clientX < midpoint : event.clientX >= midpoint;
  return placeAfter ? 'after' : 'before';
}

function shouldIgnoreHeaderPointerDown(ctx: HelperContext, event: PointerEvent): boolean {
  if (ctx.isResizingColumn || event.button !== 0 || event.isPrimary === false) {
    return true;
  }

  const target = event.target as HTMLElement | null;
  return !!target?.closest(
    'button,input,textarea,select,a,[contenteditable="true"],.resize-handle'
  );
}

function suppressNextDocumentClick(): void {
  const handler = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    document.removeEventListener('click', handler, true);
  };
  document.addEventListener('click', handler, true);
  setTimeout(() => document.removeEventListener('click', handler, true), 0);
}

function beginColumnPointerReorder(ctx: HelperContext, event: PointerEvent): void {
  const sourceField = String(ctx.columnPointerDragSourceField ?? '');
  if (!sourceField) {
    return;
  }

  ctx.columnPointerDragStarted = true;
  ctx.draggingColumnField = sourceField;
  ctx.dropTargetColumnField = null;
  ctx.dropTargetColumnEdge = null;
  ctx.headerDropHandled = false;
  ctx.columnDragPreviewOriginalColumns = Array.isArray(ctx.columns) ? [...ctx.columns] : [];
  ctx.columnDragPointerInsideGrid = true;

  const root = resolveDataGridRootElement(ctx);
  root?.classList.add('is-column-reordering');
  setColumnDragCardLabel(ctx, sourceField, ctx.columnPointerDragLabel as string | null);
  setColumnDragCardWidth(ctx, sourceField);
  setColumnDragCardPosition(ctx, event.clientX, event.clientY, event.target as HTMLElement | null);
  document.body.style.cursor = 'grabbing';
  document.body.style.userSelect = 'none';
  ctx.cdr?.markForCheck?.();
}

function clearColumnPointerDropTarget(ctx: HelperContext): void {
  ctx.dropTargetColumnField = null;
  ctx.dropTargetColumnEdge = null;
  clearColumnDropGuide(ctx);
}

function updateColumnPointerReorderTarget(ctx: HelperContext, event: PointerEvent): void {
  updateColumnDragInGridPreviewPosition(ctx, event.clientX, event.clientY);

  if (!ctx.columnDragPointerInsideGrid) {
    clearColumnPointerDropTarget(ctx);
    return;
  }

  const groupPanel = resolveColumnDragGroupPanel(ctx);
  if (isPointInsideElement(groupPanel, event.clientX, event.clientY)) {
    clearColumnPointerDropTarget(ctx);
    return;
  }

  const sourceField = String(ctx.draggingColumnField ?? '');
  const insertion = resolveHeaderInsertionTargetAtClientX(ctx, event.clientX, sourceField);
  if (!insertion?.field) {
    clearColumnPointerDropTarget(ctx);
    return;
  }

  ctx.dropTargetColumnField = insertion.field;
  ctx.dropTargetColumnEdge = insertion.edge;
  setColumnDropGuide(ctx, insertion.cell, insertion.edge);
  ctx.cdr?.markForCheck?.();
}

function finishColumnPointerReorder(
  ctx: HelperContext,
  event: PointerEvent,
  cancelled = false
): void {
  const started = ctx.columnPointerDragStarted === true;
  const sourceField = String(ctx.columnPointerDragSourceField ?? ctx.draggingColumnField ?? '');
  detachColumnPointerDragDocumentHandlers(ctx);

  if (!started) {
    clearColumnPointerDragState(ctx);
    return;
  }

  event.preventDefault?.();
  event.stopPropagation?.();
  suppressNextDocumentClick();

  const droppedOnGroupPanel =
    !cancelled &&
    isPointInsideElement(resolveColumnDragGroupPanel(ctx), event.clientX, event.clientY);
  if (droppedOnGroupPanel && sourceField) {
    restoreColumnDragPreview(ctx);
    ctx.addGroupColumn?.(sourceField);
  } else if (cancelled || !commitColumnDragPreviewFromLastTarget(ctx)) {
    restoreColumnDragPreview(ctx);
  }

  ctx.draggingColumnField = null;
  ctx.dropTargetColumnField = null;
  ctx.dropTargetColumnEdge = null;
  ctx.headerDropHandled = false;
  clearColumnPointerDragState(ctx);
  ctx.cdr?.markForCheck?.();
}

function beginColumnDragInGridPreview(ctx: HelperContext, event: DragEvent): void {
  clearColumnDragInGridPreview(ctx);
  const clientX = Number.isFinite(event.clientX) ? event.clientX : 0;
  const clientY = Number.isFinite(event.clientY) ? event.clientY : 0;
  const anchorCell =
    (event.currentTarget as HTMLElement | null) ?? (event.target as HTMLElement | null);
  ctx.columnDragPointerInsideGrid = true;
  resolveDataGridRootElement(ctx)?.classList.add('is-column-reordering');
  if (ctx.draggingColumnField) {
    setColumnDragCardLabel(ctx, String(ctx.draggingColumnField));
    setColumnDragCardWidth(ctx, String(ctx.draggingColumnField));
  }
  setColumnDragCardPosition(ctx, clientX, clientY, anchorCell);

  const moveHandler = (moveEvent: DragEvent) =>
    updateColumnDragInGridPreviewPosition(ctx, moveEvent.clientX, moveEvent.clientY);
  ctx.columnDragDocumentMoveHandler = moveHandler;
  document.addEventListener('dragover', moveHandler, true);
}

function commitColumnDragPreviewFromLastTarget(ctx: HelperContext): boolean {
  const sourceField = ctx.draggingColumnField;
  const targetField = ctx.dropTargetColumnField;
  if (
    !sourceField ||
    !targetField ||
    sourceField === targetField ||
    !ctx.columnDragPointerInsideGrid ||
    typeof ctx.reorderColumns !== 'function'
  ) {
    return false;
  }

  ctx.reorderColumns(sourceField, targetField, ctx.dropTargetColumnEdge ?? 'before');
  clearColumnDragPreview(ctx);
  ctx.headerDropHandled = true;
  return true;
}

function applyTransparentNativeDragImage(ctx: HelperContext, event: DragEvent): void {
  if (!event.dataTransfer) {
    return;
  }

  const host = resolveDataGridHostElement(ctx);
  const nativeImage = document.createElement('div');
  nativeImage.className = 'dg-column-drag-native-image';
  nativeImage.setAttribute('aria-hidden', 'true');
  nativeImage.style.position = 'fixed';
  nativeImage.style.width = '1px';
  nativeImage.style.height = '1px';
  nativeImage.style.opacity = '0';
  nativeImage.style.pointerEvents = 'none';
  nativeImage.style.top = '0';
  nativeImage.style.left = '0';
  (host ?? document.body).appendChild(nativeImage);
  ctx.columnDragNativeImage = nativeImage;
  event.dataTransfer.setDragImage(nativeImage, 0, 0);

  setTimeout(() => {
    if (ctx.columnDragNativeImage === nativeImage) {
      ctx.columnDragNativeImage = null;
    }
    nativeImage.remove();
  }, 0);
}

export function onHeaderPointerDownHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [event, column] = args as [PointerEvent, LooseValue];
  if (!column || shouldIgnoreHeaderPointerDown(ctx, event)) {
    return;
  }

  const sourceField = getColumnFieldValue(ctx, column);
  if (!sourceField) {
    return;
  }

  clearColumnPointerDragState(ctx);
  ctx.columnPointerDragSourceField = sourceField;
  ctx.columnPointerDragPointerId = event.pointerId;
  ctx.columnPointerDragLabel = getColumnDragLabel(ctx, sourceField);
  ctx.columnPointerDragStarted = false;
  ctx.columnPointerDragStartX = event.clientX;
  ctx.columnPointerDragStartY = event.clientY;

  const moveHandler = (moveEvent: PointerEvent) => onHeaderPointerMoveHelper(ctx, moveEvent);
  const upHandler = (upEvent: PointerEvent) => onHeaderPointerUpHelper(ctx, upEvent);
  const cancelHandler = (cancelEvent: PointerEvent) =>
    onHeaderPointerCancelHelper(ctx, cancelEvent);
  ctx.columnPointerDragMoveHandler = moveHandler;
  ctx.columnPointerDragUpHandler = upHandler;
  ctx.columnPointerDragCancelHandler = cancelHandler;
  document.addEventListener('pointermove', moveHandler, true);
  document.addEventListener('pointerup', upHandler, true);
  document.addEventListener('pointercancel', cancelHandler, true);
}

export function onHeaderPointerMoveHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [event] = args as [PointerEvent];
  if (
    ctx.columnPointerDragPointerId == null ||
    event.pointerId !== ctx.columnPointerDragPointerId ||
    !ctx.columnPointerDragSourceField
  ) {
    return;
  }

  if (!ctx.columnPointerDragStarted) {
    const deltaX = event.clientX - Number(ctx.columnPointerDragStartX ?? event.clientX);
    const deltaY = event.clientY - Number(ctx.columnPointerDragStartY ?? event.clientY);
    if (Math.hypot(deltaX, deltaY) < COLUMN_POINTER_REORDER_THRESHOLD_PX) {
      return;
    }
    beginColumnPointerReorder(ctx, event);
  }

  event.preventDefault?.();
  event.stopPropagation?.();
  updateColumnPointerReorderTarget(ctx, event);
}

export function onHeaderPointerUpHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [event] = args as [PointerEvent];
  if (
    ctx.columnPointerDragPointerId != null &&
    event.pointerId !== ctx.columnPointerDragPointerId
  ) {
    return;
  }

  finishColumnPointerReorder(ctx, event);
}

export function onHeaderPointerCancelHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [event] = args as [PointerEvent];
  if (
    ctx.columnPointerDragPointerId != null &&
    event.pointerId !== ctx.columnPointerDragPointerId
  ) {
    return;
  }

  finishColumnPointerReorder(ctx, event, true);
}

export function onHeaderDragStartHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [event, column] = args;
  if (!column) return;
  if (ctx.columnPointerDragSourceField) {
    event.preventDefault?.();
    return;
  }
  const dragOrigin = event.target as HTMLElement | null;
  if (dragOrigin?.closest('.resize-handle') || ctx.isResizingColumn) {
    event.preventDefault?.();
    event.stopPropagation?.();
    return;
  }
  ctx.draggingColumnField = getColumnFieldValue(ctx, column);
  ctx.dropTargetColumnEdge = null;
  ctx.headerDropHandled = false;
  ctx.columnDragPreviewOriginalColumns = Array.isArray(ctx.columns) ? [...ctx.columns] : [];
  event.dataTransfer?.setData('text/plain', ctx.draggingColumnField);
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
  }
  const root = (ctx.elementRef?.nativeElement as HTMLElement | undefined) ?? null;
  applyTransparentNativeDragImage(ctx, event);
  beginColumnDragInGridPreview(ctx, event);
  // Keep drag interactions scoped to this grid instance without leaving focus outlines behind.
  const target = event.target as HTMLElement;
  if (target) {
    target.style.outline = 'none';
    target.style.outlineWidth = '0';
    target.style.outlineStyle = 'none';
    target.style.outlineColor = 'transparent';
    target.blur();
  }
  // Also remove outline from parent th
  const th = target.closest('th');
  if (th) {
    (th as HTMLElement).style.outline = 'none';
    (th as HTMLElement).style.outlineWidth = '0';
    (th as HTMLElement).style.outlineStyle = 'none';
    (th as HTMLElement).style.outlineColor = 'transparent';
    (th as HTMLElement).blur();
  }
  root?.querySelectorAll('th').forEach((element: LooseValue) => {
    (element as HTMLElement).style.outline = 'none';
    (element as HTMLElement).style.outlineWidth = '0';
    (element as HTMLElement).style.outlineStyle = 'none';
    (element as HTMLElement).style.outlineColor = 'transparent';
  });
  ctx.cdr?.markForCheck?.();
}
export function onHeaderDragOverHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [event, column] = args;
  if (!ctx.draggingColumnField) {
    return;
  }
  updateColumnDragInGridPreviewPosition(ctx, event.clientX, event.clientY);
  event.preventDefault();
  const sourceField = String(ctx.draggingColumnField);
  const insertion = resolveHeaderInsertionTargetAtClientX(ctx, event.clientX, sourceField);
  if (insertion?.field) {
    ctx.dropTargetColumnField = insertion.field;
    ctx.dropTargetColumnEdge = insertion.edge;
    setColumnDropGuide(ctx, insertion.cell, insertion.edge);
  } else {
    const targetField = getColumnFieldValue(ctx, column);
    if (!targetField || targetField === sourceField) {
      clearColumnPointerDropTarget(ctx);
      return;
    }
    const targetCell = (event.currentTarget as HTMLElement | null) ?? null;
    ctx.dropTargetColumnField = targetField;
    ctx.dropTargetColumnEdge = resolveColumnDragDropEdge(ctx, event, sourceField, targetField);
    setColumnDropGuide(ctx, targetCell, ctx.dropTargetColumnEdge);
  }
  if (!ctx.dropTargetColumnField) {
    return;
  }
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
  ctx.cdr?.markForCheck?.();
}
export function onHeaderDropHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [event, column] = args;
  if (!ctx.draggingColumnField) return;
  event.preventDefault();
  ctx.columnDragPointerInsideGrid = true;
  const targetField = getColumnFieldValue(ctx, column);
  ctx.reorderColumns(ctx.draggingColumnField, targetField, ctx.dropTargetColumnEdge ?? 'before');
  clearColumnDragPreview(ctx);
  ctx.headerDropHandled = true;
  ctx.draggingColumnField = null;
  ctx.dropTargetColumnField = null;
  ctx.dropTargetColumnEdge = null;
  ctx.cdr?.markForCheck?.();
}
export function onHeaderDragEndHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (!ctx.headerDropHandled) {
    if (!commitColumnDragPreviewFromLastTarget(ctx)) {
      restoreColumnDragPreview(ctx);
    }
  } else {
    clearColumnDragPreview(ctx);
  }
  ctx.draggingColumnField = null;
  ctx.dropTargetColumnField = null;
  ctx.dropTargetColumnEdge = null;
  ctx.headerDropHandled = false;
  ctx.cdr?.markForCheck?.();
}
export function cleanupColumnDragPreviewHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  clearColumnDragPreview(ctx);
  ctx.draggingColumnField = null;
  ctx.dropTargetColumnField = null;
  ctx.dropTargetColumnEdge = null;
  ctx.headerDropHandled = false;
}
export function preventHeaderBackgroundChangeHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [event] = args;
  event.preventDefault();
  event.stopPropagation();
}
export function onGroupPanelDragOverHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [event] = args;
  event.preventDefault();
  event.stopPropagation();
}
export function onGroupPanelDropHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [event] = args;
  event.preventDefault();
  const field = ctx.draggingColumnField || event.dataTransfer?.getData('text/plain');
  restoreColumnDragPreview(ctx);
  if (field) {
    ctx.addGroupColumn(field);
    ctx.headerDropHandled = true;
  }
  ctx.draggingColumnField = null;
  ctx.dropTargetColumnEdge = null;
}
function notifyGroupingStructureChange(ctx: HelperContext): void {
  if (typeof ctx.emitChange === 'function') {
    ctx.emitChange('group');
    return;
  }
  if (ctx.stateKey) {
    ctx.saveState?.();
  }
}

function notifyGroupingExpansionChange(ctx: HelperContext): void {
  if (typeof ctx.emitChange === 'function') {
    ctx.emitChange('groupExpansion');
    return;
  }
  if (ctx.stateKey) {
    ctx.saveState?.();
  }
}

function normalizeGroupingDirection(direction: LooseValue): 'asc' | 'desc' {
  return direction === 'desc' ? 'desc' : 'asc';
}

function areGroupListsEqual(currentGroups: LooseValue[], nextGroups: LooseValue[]): boolean {
  if (currentGroups.length !== nextGroups.length) {
    return false;
  }
  for (let index = 0; index < currentGroups.length; index += 1) {
    if (String(currentGroups[index] ?? '') !== String(nextGroups[index] ?? '')) {
      return false;
    }
  }
  return true;
}

function areGroupDateIntervalsEqual(
  currentIntervals: Record<string, LooseValue>,
  nextIntervals: Record<string, LooseValue>
): boolean {
  const currentKeys = Object.keys(currentIntervals);
  const nextKeys = Object.keys(nextIntervals);
  if (currentKeys.length !== nextKeys.length) {
    return false;
  }
  return currentKeys.every(key => currentIntervals[key] === nextIntervals[key]);
}

function normalizeSortDirectionForComparison(direction: LooseValue): 'asc' | 'desc' | null {
  if (direction === 'desc' || direction === 'asc') {
    return direction;
  }
  return null;
}

function normalizeSortOrderForComparison(state: LooseValue, index: number): number {
  const order = Number(state?.order);
  return Number.isFinite(order) ? order : index;
}

function areSortStatesEqual(currentSorts: LooseValue[], nextSorts: LooseValue[]): boolean {
  if (currentSorts.length !== nextSorts.length) {
    return false;
  }
  for (let index = 0; index < currentSorts.length; index += 1) {
    const current = currentSorts[index];
    const next = nextSorts[index];
    if (String(current?.field ?? '') !== String(next?.field ?? '')) {
      return false;
    }
    if (
      normalizeSortDirectionForComparison(current?.direction) !==
      normalizeSortDirectionForComparison(next?.direction)
    ) {
      return false;
    }
    if (
      normalizeSortOrderForComparison(current, index) !==
      normalizeSortOrderForComparison(next, index)
    ) {
      return false;
    }
  }
  return true;
}

export function applyGroupingStateHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column, direction, dateInterval] = args;
  const field =
    column && typeof ctx.getColumnField === 'function'
      ? String(ctx.getColumnField(column) ?? '').trim()
      : '';
  const nextGroups = field ? [field] : [];
  const currentIntervals =
    typeof ctx.groupDateIntervals === 'function' ? { ...(ctx.groupDateIntervals() ?? {}) } : {};
  const resolvedDateInterval =
    field && typeof ctx.resolveGridDateGroupInterval === 'function'
      ? ctx.resolveGridDateGroupInterval(column, dateInterval ?? currentIntervals[field])
      : null;
  const nextIntervals = field && resolvedDateInterval ? { [field]: resolvedDateInterval } : {};
  const currentGroups = Array.isArray(ctx.groupColumns?.()) ? [...ctx.groupColumns()] : [];
  const currentSorts = Array.isArray(ctx.sortStates?.()) ? [...ctx.sortStates()] : [];
  const groupingFields = new Set(currentGroups);
  if (field) {
    groupingFields.add(field);
  }

  const retainedSorts = currentSorts.filter(
    (state: LooseValue) => !groupingFields.has(String(state?.field ?? '').trim())
  );
  const nextSorts = field
    ? [
        { field, direction: normalizeGroupingDirection(direction), order: 0 },
        ...retainedSorts.map((state: LooseValue, index: number) => ({
          ...state,
          order: index + 1
        }))
      ]
    : retainedSorts.map((state: LooseValue, index: number) => ({
        ...state,
        order: index
      }));

  const groupsUnchanged = areGroupListsEqual(currentGroups, nextGroups);
  const sortsUnchanged = areSortStatesEqual(currentSorts, nextSorts as LooseValue[]);
  const intervalsUnchanged = areGroupDateIntervalsEqual(currentIntervals, nextIntervals);
  if (groupsUnchanged && sortsUnchanged && intervalsUnchanged) {
    ctx.closeColumnContextMenu?.();
    return;
  }

  ctx.groupExpansionAuto?.set?.(true);
  ctx.resetGroupExpansion?.();
  beginRemoteDataStructureRefresh(ctx);
  ctx.groupColumns.set(nextGroups);
  ctx.groupDateIntervals?.set?.(nextIntervals);
  ctx.expandedGroups.set(new Set());
  ctx.groupFilterTerms?.set?.(new Map());
  ctx.sortStates?.set?.(nextSorts);
  ctx.bumpAggregateCache?.();
  ctx.cdr.markForCheck();
  queueGroupingViewportRefresh(ctx);
  notifyGroupingStructureChange(ctx);
  ctx.closeColumnContextMenu?.();
}

export function addGroupColumnHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [field] = args;
  const currentGroups = ctx.groupColumns();
  if (currentGroups.includes(field)) {
    return;
  }
  ctx.groupExpansionAuto?.set?.(true);
  ctx.resetGroupExpansion();
  beginRemoteDataStructureRefresh(ctx);
  const nextGroups = [...currentGroups, field];
  ctx.groupColumns.set(nextGroups);
  if (typeof ctx.resolveGridDateGroupIntervalForField === 'function') {
    const interval = ctx.resolveGridDateGroupIntervalForField(field);
    if (interval) {
      ctx.groupDateIntervals?.update?.((current: Record<string, LooseValue>) => ({
        ...(current ?? {}),
        [field]: interval
      }));
    }
  }
  ctx.cdr.markForCheck();
  queueGroupingViewportRefresh(ctx);
  notifyGroupingStructureChange(ctx);
}
export function removeGroupColumnHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [field] = args;
  ctx.groupExpansionAuto?.set?.(true);
  const updated = ctx.groupColumns().filter((col: LooseValue) => col !== field);
  ctx.resetGroupExpansion();
  beginRemoteDataStructureRefresh(ctx);
  ctx.groupColumns.set(updated);
  ctx.groupDateIntervals?.update?.((current: Record<string, LooseValue>) => {
    const next = { ...(current ?? {}) };
    delete next[field as string];
    return next;
  });
  ctx.cdr.markForCheck();
  queueGroupingViewportRefresh(ctx);
  notifyGroupingStructureChange(ctx);
}
export function isColumnGroupedHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [field] = args;
  return ctx.groupColumns().includes(field);
}
export function onGroupChipDragStartHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [event, field] = args;
  ctx.draggingGroupField = field;
  event.dataTransfer?.setData('text/plain', field);
  event.dataTransfer!.effectAllowed = 'move';
}
export function onGroupChipDropHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [event, targetField] = args;
  event.preventDefault();
  const sourceField = ctx.draggingGroupField || event.dataTransfer?.getData('text/plain');
  if (!sourceField || sourceField === targetField) {
    ctx.draggingGroupField = null;
    return;
  }
  const updated = [...ctx.groupColumns()];
  const fromIndex = updated.indexOf(sourceField);
  const toIndex = updated.indexOf(targetField);
  if (fromIndex !== -1 && toIndex !== -1) {
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    ctx.resetGroupExpansion();
    beginRemoteDataStructureRefresh(ctx);
    ctx.groupColumns.set(updated);
    ctx.cdr.markForCheck();
    queueGroupingViewportRefresh(ctx);
    notifyGroupingStructureChange(ctx);
  }
  ctx.draggingGroupField = null;
}
export function onGroupChipDragEndHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [event] = args;
  // If chip was dragged outside the group panel, remove it from grouping
  if (event.dataTransfer?.dropEffect === 'none') {
    const field = ctx.draggingGroupField;
    if (field) {
      ctx.removeGroupColumn(field);
    }
  }
  ctx.draggingGroupField = null;
}
export function autoSizeColumnHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column, event, options] = args;
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  const hasExplicitWidth =
    typeof column?.width === 'number' ||
    (typeof column?.width === 'string' && column.width.trim().length > 0);
  if (options?.automatic && hasExplicitWidth) {
    return;
  }
  const width = ctx.calculateAutoWidth(column, {
    mode: options?.mode === 'viewport' ? 'viewport' : 'filtered'
  });
  if (width) {
    ctx.applyColumnWidth(ctx.getColumnField(column), width, {
      save: options?.save,
      sync: options?.sync,
      notify: options?.notify
    });
  }
}
export function onColumnResizeHandleDoubleClickHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [event, column] = args;
  event.stopPropagation();
  event.preventDefault();
  ctx.autoSizeColumn(column, null, { mode: 'viewport' });
}
export function reorderColumnsHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [sourceField, targetField, edge] = args;
  if (sourceField === targetField) return;
  const updated = buildColumnReorderPreview(
    ctx,
    String(sourceField),
    String(targetField),
    edge === 'after' ? 'after' : 'before'
  );
  if (!updated) return;
  ctx.columns = updated;
  ctx.applyPinnedOrdering?.();
  ctx.cdr?.markForCheck?.();
  ctx.syncHeaderBodyWidths?.();
  ctx.emitColumnsChange?.();
  if (ctx.stateKey) {
    ctx.saveState?.();
  }
}
export function hideColumnForGroupingHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [field] = args;
  if (!ctx.columnHiddenSnapshot.has(field)) {
    const column = ctx.findColumn(field);
    if (column) {
      ctx.columnHiddenSnapshot.set(field, !!column.hidden);
    }
  }
  ctx.setColumnHidden(field, true);
}
export function restoreColumnVisibilityHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [field] = args;
  if (!ctx.columnHiddenSnapshot.has(field)) {
    ctx.setColumnHidden(field, false);
    return;
  }
  const originalHidden = ctx.columnHiddenSnapshot.get(field)!;
  ctx.setColumnHidden(field, originalHidden);
  ctx.columnHiddenSnapshot.delete(field);
}
export function setColumnHiddenHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [field, hidden] = args;
  const column = ctx.findColumn(field);
  if (!column || column.hidden === hidden) {
    return;
  }
  column.hidden = hidden;
  ctx.columns = [...ctx.columns];
}
export function applyPinnedOrderingHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const pinnedLeft: LooseValue[] = [];
  const pinnedRight: LooseValue[] = [];
  const normal: LooseValue[] = [];

  for (const column of ctx.columns) {
    if (column.pinned === 'left') {
      pinnedLeft.push(column);
    } else if (column.pinned === 'right') {
      pinnedRight.push(column);
    } else {
      normal.push(column);
    }
  }

  ctx.columns = [...pinnedLeft, ...normal, ...pinnedRight];
}

function resolveLayoutElement(
  ctx: HelperContext,
  refKey: string,
  selector: string
): HTMLElement | null {
  const fromRef = (ctx[refKey]?.nativeElement as HTMLElement | undefined) ?? null;
  if (fromRef && fromRef.isConnected !== false) {
    return fromRef;
  }

  const host = (ctx.elementRef?.nativeElement as HTMLElement | undefined) ?? null;
  return (host?.querySelector(selector) as HTMLElement | null) ?? null;
}

function resetElementScrollLeft(element: HTMLElement | null | undefined): void {
  if (!element) {
    return;
  }
  if (Math.abs(Number(element.scrollLeft) || 0) > 0.5) {
    element.scrollLeft = 0;
  }
}

function cancelHeaderScrollSync(ctx: HelperContext): void {
  if (ctx.headerScrollSyncRAF == null) {
    return;
  }

  if (typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(ctx.headerScrollSyncRAF as number);
  } else {
    clearTimeout(ctx.headerScrollSyncRAF as ReturnType<typeof setTimeout>);
  }

  ctx.headerScrollSyncRAF = null;
  ctx.pendingHeaderScrollLeft = null;
}

function resetColumnLayoutHorizontalScroll(ctx: HelperContext): void {
  const host = (ctx.elementRef?.nativeElement as HTMLElement | undefined) ?? null;
  const viewport = resolveLayoutElement(
    ctx,
    'gridViewport',
    '.table-scroll, .virtual-scroll-viewport'
  );
  const fixedHeader = resolveLayoutElement(ctx, 'fixedHeader', '.fixed-table-header');
  const bottomScrollbar = resolveLayoutElement(
    ctx,
    'bottomScrollbarViewport',
    '.grid-bottom-scrollbar-strip'
  );

  cancelHeaderScrollSync(ctx);
  resetElementScrollLeft(viewport);
  resetElementScrollLeft(fixedHeader);
  resetElementScrollLeft(bottomScrollbar);

  if (host) {
    host.querySelectorAll<HTMLElement>('.group-items-scroll').forEach(resetElementScrollLeft);
    host.style.setProperty('--dg-grid-scroll-left', '0px');
    host.style.setProperty('--dg-group-scroll-left', '0px');
  }

  const headerTable =
    (fixedHeader?.querySelector?.('.header-table') as HTMLElement | null | undefined) ?? null;
  if (headerTable?.style) {
    headerTable.style.transform = '';
  }
  fixedHeader?.style?.removeProperty?.('--dg-header-counter-scroll');
  if (fixedHeader?.dataset?.['dgScrollLeft']) {
    delete fixedHeader.dataset['dgScrollLeft'];
  }

  ctx.lastGridScrollCssLeft = 0;
  ctx.lastGroupScrollCssLeft = 0;
  ctx.lastDefaultGridBodyScrollLeft = 0;
}

function scheduleColumnLayoutScrollSync(ctx: HelperContext): void {
  const sync = () => {
    resetColumnLayoutHorizontalScroll(ctx);
    ctx.syncHeaderBodyWidths?.();
    queueDefaultGridOverflowSyncHelper(ctx);
  };

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(sync);
  } else {
    setTimeout(sync, 16);
  }
}

export function setColumnPinnedHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [field, pinned] = args;
  const column = ctx.findColumn(field);
  if (!column || column.pinned === pinned) {
    return;
  }
  column.pinned = pinned;
  ctx.applyPinnedOrdering();
  resetColumnLayoutHorizontalScroll(ctx);
  ctx.cdr.markForCheck?.();
  ctx.syncHeaderBodyWidths?.();
  queueDefaultGridOverflowSyncHelper(ctx);
  scheduleColumnLayoutScrollSync(ctx);
  ctx.emitColumnsChange?.();
  if (ctx.stateKey) {
    ctx.saveState?.();
  }
}
export function findColumnHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [field] = args;
  return ctx.columns.find((col: LooseValue) => ctx.getColumnField(col) === field);
}
export function removeColumnFromViewHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [field] = args;
  ctx.setColumnHidden(field, true);
}
export function resetGroupExpansionHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  ctx.groupExpansionAuto?.set?.(true);
  ctx.expandedGroups.set(new Set());
  ctx.groupFilterTerms.set(new Map());
  ctx.bumpAggregateCache();
}
export function toggleGroupHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [row] = args;
  ctx.groupExpansionAuto?.set?.(false);
  ctx.expandedGroups.update((set: LooseValue) => {
    const next = new Set(set);
    if (next.has(row.id)) {
      next.delete(row.id);
    } else {
      next.add(row.id);
    }
    return next;
  });
  queueGroupingViewportRefresh(ctx);
  notifyGroupingExpansionChange(ctx);
}
export function isGroupExpandedByIdHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [id] = args;
  const expanded = ctx.expandedGroups();
  if (!expanded.size) {
    const autoExpand = ctx.groupExpansionAuto?.() ?? true;
    if (!autoExpand) {
      return false;
    }
    if (typeof ctx.shouldAutoExpandGroupsCached === 'function') {
      return Boolean(ctx.shouldAutoExpandGroupsCached());
    }
    return typeof ctx.shouldAutoExpandGroups === 'function'
      ? Boolean(ctx.shouldAutoExpandGroups())
      : true;
  }
  return expanded.has(id);
}
export function toggleGroupByIdHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [id] = args;
  ctx.groupExpansionAuto?.set?.(false);
  ctx.expandedGroups.update((set: LooseValue) => {
    const next = new Set(set);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    return next;
  });
  queueGroupingViewportRefresh(ctx);
  notifyGroupingExpansionChange(ctx);
}
export function expandAllGroupsHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const groups = ctx.groupColumns?.() ?? [];
  const ids = getExpandedGroupIdsForCurrentMode(ctx, groups);

  const changed = applyExplicitGroupExpansion(ctx, ids);
  if (changed) {
    queueGroupingViewportRefresh(ctx);
    notifyGroupingExpansionChange(ctx);
  }

  ctx.closeGroupContextMenu();
}
export function collapseAllGroupsHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const changed = applyExplicitGroupExpansion(ctx, new Set<string>());
  if (changed) {
    queueGroupingViewportRefresh(ctx);
    notifyGroupingExpansionChange(ctx);
  }
  ctx.closeGroupContextMenu();
}
export function expandGroupsAtLevelHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [level] = args;
  const ids = ctx.getGroupIdsByLevel(level);
  const current =
    typeof ctx.expandedGroups === 'function'
      ? (ctx.expandedGroups() as Set<string>)
      : new Set<string>();
  const next = new Set(current);
  for (const id of ids) {
    next.add(id);
  }
  const changed = applyExplicitGroupExpansion(ctx, next);
  if (changed) {
    queueGroupingViewportRefresh(ctx);
    notifyGroupingExpansionChange(ctx);
  }
  ctx.closeGroupContextMenu();
}
export function collapseGroupsAtLevelHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [level] = args;
  const ids = ctx.getGroupIdsByLevel(level);
  const current =
    typeof ctx.expandedGroups === 'function'
      ? (ctx.expandedGroups() as Set<string>)
      : new Set<string>();
  const next = new Set(current);
  for (const id of ids) {
    next.delete(id);
  }
  const changed = applyExplicitGroupExpansion(ctx, next);
  if (changed) {
    queueGroupingViewportRefresh(ctx);
    notifyGroupingExpansionChange(ctx);
  }
  ctx.closeGroupContextMenu();
}
export function clearAllGroupingHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  // Clear grouping
  ctx.groupExpansionAuto?.set?.(true);
  beginRemoteDataStructureRefresh(ctx);
  ctx.groupColumns.set([]);
  ctx.groupDateIntervals?.set?.({});
  ctx.expandedGroups.set(new Set());
  ctx.groupFilterTerms.set(new Map());
  ctx.bumpAggregateCache();
  ctx.cdr.markForCheck();
  queueGroupingViewportRefresh(ctx);
  notifyGroupingStructureChange(ctx);
  ctx.closeGroupContextMenu();
}
export function setGroupDateIntervalHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [field, interval] = args;
  const normalizedField = String(field ?? '').trim();
  if (!normalizedField || !ctx.groupColumns?.().includes(normalizedField)) {
    return;
  }

  const resolved =
    typeof ctx.resolveGridDateGroupIntervalForField === 'function'
      ? ctx.resolveGridDateGroupIntervalForField(normalizedField, interval)
      : null;
  if (!resolved) {
    return;
  }

  const current = ctx.groupDateIntervals?.() ?? {};
  if (current[normalizedField] === resolved) {
    return;
  }

  ctx.groupExpansionAuto?.set?.(true);
  ctx.resetGroupExpansion?.();
  beginRemoteDataStructureRefresh(ctx);
  ctx.groupDateIntervals?.set?.({ ...current, [normalizedField]: resolved });
  ctx.cdr.markForCheck();
  queueGroupingViewportRefresh(ctx);
  notifyGroupingStructureChange(ctx);
}
export function onGroupPanelContextMenuHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [event] = args;
  event.preventDefault();
  event.stopPropagation();
  ctx.closeAllMenus();
  const { boundsW, boundsH, originX, originY, scale } = ctx.getOverlaySpace();
  const menuW = 300;
  const menuH = 520;
  const margin = 8;
  // If no grouping, show empty group menu instead
  if (ctx.groupColumns().length === 0) {
    ctx.closeEmptyGroupMenu();
    let x = (event.clientX - originX) / scale;
    let y = (event.clientY - originY) / scale;
    x = Math.max(margin, Math.min(x, boundsW - menuW - margin));
    y = Math.max(margin, Math.min(y, boundsH - menuH - margin));
    ctx.emptyGroupMenuPosition.set({ x, y });
    ctx.showEmptyGroupMenu.set(true);
    ctx.groupMenuCloseHandler = () => {
      ctx.closeEmptyGroupMenu();
    };
    setTimeout(() => {
      if (ctx.groupMenuCloseHandler) {
        document.addEventListener('click', ctx.groupMenuCloseHandler, { once: true });
      }
    }, 0);
    return;
  }
  // Close any existing menu first
  ctx.closeGroupContextMenu();
  let x = (event.clientX - originX) / scale;
  let y = (event.clientY - originY) / scale;
  x = Math.max(margin, Math.min(x, boundsW - menuW - margin));
  y = Math.max(margin, Math.min(y, boundsH - menuH - margin));
  ctx.groupContextMenuPosition.set({ x, y });
  ctx.showGroupContextMenu.set(true);
  // Close menu when clicking anywhere else
  ctx.groupMenuCloseHandler = () => {
    ctx.closeGroupContextMenu();
  };
  setTimeout(() => {
    if (ctx.groupMenuCloseHandler) {
      document.addEventListener('click', ctx.groupMenuCloseHandler, { once: true });
    }
  }, 0);
}
export function closeGroupContextMenuHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  ctx.showGroupContextMenu.set(false);
  if (ctx.groupMenuCloseHandler) {
    document.removeEventListener('click', ctx.groupMenuCloseHandler);
    ctx.groupMenuCloseHandler = null;
  }
}
export function closeEmptyGroupMenuHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  ctx.showEmptyGroupMenu.set(false);
  ctx.showColumnSelectionSubmenu.set(false);
  if (ctx.groupMenuCloseHandler) {
    document.removeEventListener('click', ctx.groupMenuCloseHandler);
    ctx.groupMenuCloseHandler = null;
  }
}
export function reverseGroupOrderHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const currentGroups = [...ctx.groupColumns()];
  beginRemoteDataStructureRefresh(ctx);
  ctx.groupColumns.set(currentGroups.reverse());
  ctx.cdr.markForCheck();
  queueGroupingViewportRefresh(ctx);
  notifyGroupingStructureChange(ctx);
  ctx.closeGroupContextMenu();
}
export function toggleColumnSelectionSubmenuHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  ctx.showColumnSelectionSubmenu.update((v: LooseValue) => !v);
}
export function groupByColumnFromSubmenuHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [column] = args;
  const field = column.field as string;
  if (!ctx.groupColumns().includes(field)) {
    ctx.addGroupColumn(field);
  }
  queueGroupingViewportRefresh(ctx);
  ctx.closeEmptyGroupMenu();
}
export function showGroupingHelpHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  ctx.showGroupingHelpDialog.update((v: LooseValue) => !v);
  if (ctx.showGroupingHelpDialog()) {
    ctx.closeEmptyGroupMenu();
  }
}
export function getOverlayBoundsHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const gridRoot = ctx.elementRef.nativeElement.querySelector(
    '.engineers-salary-reference-data-grid'
  ) as HTMLElement | null;
  const startNode = gridRoot ?? (ctx.elementRef.nativeElement as HTMLElement);
  const fixedRoot = ctx.getFixedContainingBlock(startNode);
  const rect = fixedRoot
    ? fixedRoot.getBoundingClientRect()
    : { width: window.innerWidth, height: window.innerHeight, left: 0, top: 0 };
  const scale = ctx.getOverlayScale(fixedRoot ?? startNode);
  let boundsW = rect.width;
  let boundsH = rect.height;
  const originX = rect.left;
  const originY = rect.top;
  const footer = gridRoot?.querySelector('.grid-pagination-footer') as HTMLElement | null;
  if (footer && footer.offsetParent !== null) {
    const footerRect = footer.getBoundingClientRect();
    const footerTop = footerRect.top;
    const boundsBottom = originY + boundsH;
    if (footerTop > originY && footerTop < boundsBottom) {
      boundsH = Math.max(0, footerTop - originY);
    }
  }
  return {
    boundsW,
    boundsH,
    originX,
    originY,
    scale
  };
}
export function getOverlaySpaceHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const { boundsW, boundsH, originX, originY, scale } = ctx.getOverlayBounds();
  const safeScale = scale || 1;
  return {
    boundsW: boundsW / safeScale,
    boundsH: boundsH / safeScale,
    originX,
    originY,
    scale: safeScale
  };
}
export function getFixedContainingBlockHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [startNode] = args;
  let node = startNode;
  while (node && node !== document.documentElement) {
    const style = window.getComputedStyle(node);
    if (ctx.isFixedContainingBlockStyle(style)) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}
export function getOverlayScaleHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [reference] = args;
  if (typeof window === 'undefined') {
    return 1;
  }
  const element = reference ?? ctx.elementRef.nativeElement;
  if (element) {
    const rect = element.getBoundingClientRect();
    const offsetWidth = element.offsetWidth || element.clientWidth;
    if (rect.width > 0 && offsetWidth > 0) {
      const measured = rect.width / offsetWidth;
      if (Number.isFinite(measured) && measured > 0) {
        return measured;
      }
    }
  }
  const rootScale = getComputedStyle(document.documentElement)
    .getPropertyValue('--app-scale')
    .trim();
  const parsedRoot = Number.parseFloat(rootScale);
  if (Number.isFinite(parsedRoot) && parsedRoot > 0) {
    return parsedRoot;
  }
  const bodyZoom = Number.parseFloat(getComputedStyle(document.body).zoom || '');
  return Number.isFinite(bodyZoom) && bodyZoom > 0 ? bodyZoom : 1;
}
export function isFixedContainingBlockStyleHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [style] = args;
  const willChange = style.willChange || '';
  const contain = style.contain || '';
  const backdropFilter = style.getPropertyValue('backdrop-filter');
  return (
    style.transform !== 'none' ||
    style.perspective !== 'none' ||
    style.filter !== 'none' ||
    backdropFilter !== 'none' ||
    willChange.includes('transform') ||
    contain.includes('paint') ||
    contain.includes('layout') ||
    contain.includes('strict')
  );
}
export function closeAllMenusHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  ctx.closeFilterMenu();
  ctx.closeContextMenu();
  ctx.closeColumnContextMenu();
  ctx.closeGroupContextMenu();
  ctx.closeEmptyGroupMenu();
}
export function onColumnHeaderContextMenuHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [event, column] = args;
  event.preventDefault();
  event.stopPropagation();
  ctx.closeAllMenus();
  ctx.selectedColumnForMenu.set(column);
  const { boundsW, boundsH, originX, originY, scale } = ctx.getOverlaySpace();
  const menuW = 260;
  const menuH = 320;
  const margin = 8;
  let x = (event.clientX - originX) / scale;
  let y = (event.clientY - originY) / scale;
  x = Math.max(margin, Math.min(x, boundsW - menuW - margin));
  y = Math.max(margin, Math.min(y, boundsH - menuH - margin));
  ctx.columnContextMenuPosition.set({ x, y });
  ctx.showColumnContextMenu.set(true);
}
export function closeColumnContextMenuHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  ctx.showColumnContextMenu.set(false);
  ctx.selectedColumnForMenu.set(null);
  ctx.showSortSubmenu.set(false);
  ctx.showPinSubmenu.set(false);
  ctx.showAlignSubmenu.set(false);
  ctx.showAggregateSubmenu.set(false);
  ctx.showColumnVisibilitySubmenu.set(false);
  ctx.showFilterSubmenu.set(false);
  ctx.showMoreSubmenu.set(false);
  ctx.showChooseColumnsSubmenu?.set?.(false);
  ctx.showCopySubmenu?.set?.(false);
  ctx.showStatsSubmenu?.set?.(false);
  ctx.showTypeSubmenu?.set?.(false);
  if (ctx.submenuTimeout) {
    clearTimeout(ctx.submenuTimeout);
    ctx.submenuTimeout = null;
  }
  ctx.columnSubmenuAnchorRect = null;
  ctx.columnSubmenuAnchorEl = null;
  ctx.columnCopySubmenuAnchorEl = null;
  if (ctx.submenuPositionRaf !== null) {
    cancelAnimationFrame(ctx.submenuPositionRaf);
    ctx.submenuPositionRaf = null;
  }
}
import {
  queueDefaultGridOverflowSyncHelper,
  setupDefaultGridOverflowObserverHelper,
  teardownDefaultGridOverflowObserverHelper
} from './data-grid.component.runtime-scroll';
