import { reportGridError } from '../../utils';

type LooseValue = ReturnType<typeof JSON.parse>;
type HelperContext = Record<string, LooseValue>;
type T = unknown;

function commitColumnLayoutMutation(
  ctx: HelperContext,
  options: { close?: boolean; notify?: boolean; save?: boolean; sync?: boolean } = {}
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

function isAppendRowLike(row: LooseValue): boolean {
  return !!row && typeof row === 'object' && !!(row as LooseValue).__appendRow;
}

function getCurrentGroupSourceRows(ctx: HelperContext): LooseValue[] {
  const processedRows = typeof ctx.processedData === 'function' ? ctx.processedData() : null;
  const bucketRows =
    !Array.isArray(processedRows) && typeof ctx.filteredSortedRowBuckets === 'function'
      ? ctx.filteredSortedRowBuckets()?.dataRows
      : null;
  const filteredRows =
    !Array.isArray(processedRows) &&
    !Array.isArray(bucketRows) &&
    typeof ctx.getFilteredSortedData === 'function'
      ? ctx.getFilteredSortedData()
      : null;
  const rows = Array.isArray(processedRows)
    ? processedRows
    : Array.isArray(bucketRows)
      ? bucketRows
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

function collectVisibleGroupIdsAtLevel(
  ctx: HelperContext,
  rows: LooseValue[],
  groupFields: string[],
  fieldIndex: number,
  path: string,
  targetLevel: number,
  expandedSet: Set<string>,
  autoExpand: boolean,
  hasGroupFilters: boolean,
  ids: string[]
): void {
  if (fieldIndex >= groupFields.length || rows.length === 0) {
    return;
  }

  const currentField = groupFields[fieldIndex];
  const groups = new Map<string, { value: LooseValue; rows: LooseValue[] }>();
  for (const row of rows) {
    const rawValue = (row as LooseValue)?.[currentField];
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
    const filterTerm = hasGroupFilters ? ctx.getGroupFilterTerm?.(id) : '';
    const filteredRows = filterTerm ? ctx.filterGroupRows(group.rows, filterTerm) : group.rows;
    if (fieldIndex === targetLevel) {
      ids.push(id);
    }
    if ((autoExpand || expandedSet.has(id)) && fieldIndex < targetLevel) {
      collectVisibleGroupIdsAtLevel(
        ctx,
        filteredRows,
        groupFields,
        fieldIndex + 1,
        id,
        targetLevel,
        expandedSet,
        autoExpand,
        hasGroupFilters,
        ids
      );
    }
  }
}

export function setColumnAggregateHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column, aggregate] = args;
  const field = ctx.getColumnField(column);
  const index = ctx.columns.findIndex((col: LooseValue) => ctx.getColumnField(col) === field);
  if (index === -1) {
    return;
  }
  const updated = { ...ctx.columns[index] };
  if (aggregate) {
    updated.aggregate = aggregate;
    ctx.enableAggregateDisplays();
  } else {
    delete updated.aggregate;
  }
  ctx.columns[index] = updated;
  ctx.columns = [...ctx.columns];
  ctx.bumpAggregateCache();
  ctx.cdr.markForCheck();
  if (ctx.stateKey) {
    ctx.saveState();
  }
  ctx.emitChange('aggregate');
  ctx.closeColumnContextMenu();
}
export function enableAggregateDisplaysHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  if (ctx.aggregateFooter?.enabled) {
    ctx.aggregateDisplayMode = 'manual';
    return;
  }
  // Auto-enable aggregate display toggles when an aggregate is selected.
  ctx.aggregateDisplayMode = 'auto';
  if (!ctx.showGroupHeaderAggregates()) {
    ctx.showGroupHeaderAggregates.set(true);
  }
  if (!ctx.showGroupFooterAggregates()) {
    ctx.showGroupFooterAggregates.set(true);
  }
  if (!ctx.showGrandTotalAggregates()) {
    ctx.showGrandTotalAggregates.set(true);
  }
}
export function shouldAutoShowAggregatesHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  return ctx.aggregateDisplayMode === 'auto' && ctx.hasAggregates();
}
export function syncAggregateDisplayStateHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const hasAggregates = ctx.columns.some((col: LooseValue) => !!col.aggregate);
  if (hasAggregates && !ctx.hasAggregatesOnce) {
    ctx.enableAggregateDisplays();
  }
  ctx.hasAggregatesOnce = hasAggregates;
}
export function applyAggregateToAllNumericColumnsFromMenuHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const aggregate = ctx.getMenuAggregateValue();
  const updated = ctx.columns.map((col: LooseValue) => {
    if (!ctx.isNumericColumn(col)) {
      return col;
    }
    const next = { ...col };
    if (aggregate) {
      next.aggregate = aggregate;
    } else {
      delete next.aggregate;
    }
    return next;
  });
  if (aggregate) {
    ctx.enableAggregateDisplays();
  }
  ctx.columns = updated;
  ctx.bumpAggregateCache();
  ctx.cdr.markForCheck();
  if (ctx.stateKey) {
    ctx.saveState();
  }
  ctx.emitChange('aggregate');
  ctx.closeColumnContextMenu();
}
export function clearAllColumnAggregatesFromMenuHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const updated = ctx.columns.map((col: LooseValue) => {
    const next = { ...col };
    delete next.aggregate;
    return next;
  });
  ctx.columns = updated;
  ctx.bumpAggregateCache();
  ctx.cdr.markForCheck();
  if (ctx.stateKey) {
    ctx.saveState();
  }
  ctx.emitChange('aggregate');
  ctx.closeColumnContextMenu();
}
export function toggleGroupFooterAggregatesFromMenuHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  ctx.aggregateDisplayMode = 'manual';
  ctx.showGroupFooterAggregates.update((value: LooseValue) => !value);
  if (ctx.stateKey) {
    ctx.saveState();
  }
  ctx.closeColumnContextMenu();
  ctx.cdr.markForCheck();
}
export function toggleGroupHeaderAggregatesFromMenuHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  ctx.aggregateDisplayMode = 'manual';
  ctx.showGroupHeaderAggregates.update((value: LooseValue) => !value);
  if (ctx.stateKey) {
    ctx.saveState();
  }
  ctx.closeColumnContextMenu();
  ctx.cdr.markForCheck();
}
export function toggleGrandTotalAggregatesFromMenuHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  ctx.aggregateDisplayMode = 'manual';
  ctx.showGrandTotalAggregates.update((value: LooseValue) => !value);
  if (ctx.stateKey) {
    ctx.saveState();
  }
  ctx.closeColumnContextMenu();
  ctx.cdr.markForCheck();
}
export function getColumnStatsSummaryHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  const field = ctx.getColumnField(column);
  const rows = ctx.getFilteredSortedData();
  const unique = new Set<string>();
  let nonEmpty = 0;
  let empty = 0;
  const numericValues: number[] = [];
  rows.forEach((row: LooseValue) => {
    const value = (row as LooseValue)?.[field];
    const isEmpty = value === null || value === undefined || value === '';
    if (isEmpty) {
      empty += 1;
      return;
    }
    nonEmpty += 1;
    unique.add(ctx.getFilterOptionKey(value));
    const numeric = ctx.normalizeNumericValue(value);
    if (numeric !== null) {
      numericValues.push(numeric);
    }
  });
  let min: number | null = null;
  let max: number | null = null;
  let avg: number | null = null;
  if (numericValues.length) {
    min = Math.min(...numericValues);
    max = Math.max(...numericValues);
    avg =
      numericValues.reduce((acc: LooseValue, val: LooseValue) => acc + val, 0) /
      numericValues.length;
  }
  return {
    total: rows.length,
    nonEmpty,
    empty,
    unique: unique.size,
    min,
    max,
    avg,
    isNumeric: numericValues.length > 0 || ctx.isNumericColumn(column)
  };
}
export function formatStatValueHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [value, decimals] = args;
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }
  if (decimals > 0) {
    return value.toFixed(decimals);
  }
  return String(Math.round(value));
}
export function toggleColumnVisibilityFromMenuHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [column] = args;
  const field = ctx.getColumnField(column);
  const visibleColumns = Array.isArray(ctx.visibleColumns?.()) ? ctx.visibleColumns() : [];
  if (!column.hidden && visibleColumns.length <= 1) {
    return;
  }
  ctx.setColumnHidden(field, !column.hidden);
  commitColumnLayoutMutation(ctx, { close: false });
}
export function resetColumnFromMenuHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  ctx.resetColumns();
  ctx.closeColumnContextMenu();
}
export function setColumnAlignmentHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column, align] = args;
  const columnIndex = ctx.columns.findIndex((c: LooseValue) => c.field === column.field);
  if (columnIndex !== -1) {
    ctx.columns[columnIndex] = { ...ctx.columns[columnIndex], align };
  }
  ctx.columns = [...ctx.columns];
  ctx.alignmentChangeTimestamp?.set?.(Date.now());
  commitColumnLayoutMutation(ctx, { sync: false });
}
export function autoSizeColumnFromMenuHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [column] = args;
  // Use the existing autoSizeColumn logic
  const width = ctx.calculateAutoWidth(column);
  if (width) {
    ctx.applyColumnWidth(ctx.getColumnField(column), width);
  }
  ctx.closeColumnContextMenu();
}
export function pinColumnLeftHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  ctx.setColumnPinned(ctx.getColumnField(column), 'left');
  ctx.closeColumnContextMenu();
}
export function pinColumnRightHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  ctx.setColumnPinned(ctx.getColumnField(column), 'right');
  ctx.closeColumnContextMenu();
}
export function unpinColumnHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  ctx.setColumnPinned(ctx.getColumnField(column), undefined);
  ctx.closeColumnContextMenu();
}
export function getAllGroupIdsHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [rows] = args;
  const ids: string[] = [];
  for (const row of rows) {
    if (row.kind === 'group') {
      ids.push(row.id);
    }
  }
  return ids;
}
export function getGroupIdsByLevelHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [level] = args;
  const ids: string[] = [];
  const groupFields = Array.isArray(ctx.groupColumns?.()) ? (ctx.groupColumns() as string[]) : [];

  if (level === 0 && groupFields.length === 1 && typeof ctx.groupedBlocks === 'function') {
    for (const block of ctx.groupedBlocks()) {
      if (typeof block?.id === 'string' && block.id.length > 0) {
        ids.push(block.id);
      }
    }
    return ids;
  }

  if (groupFields.length > 0 && Number.isInteger(level) && level >= 0) {
    const expandedSet =
      typeof ctx.expandedGroups === 'function'
        ? (ctx.expandedGroups() as Set<string>)
        : new Set<string>();
    const shouldAutoExpand =
      typeof ctx.shouldAutoExpandGroupsCached === 'function'
        ? Boolean(ctx.shouldAutoExpandGroupsCached())
        : typeof ctx.shouldAutoExpandGroups !== 'function' || Boolean(ctx.shouldAutoExpandGroups());
    const autoExpand =
      (ctx.groupExpansionAuto?.() ?? true) && expandedSet.size === 0 && shouldAutoExpand;
    const groupFilterTerms =
      typeof ctx.groupFilterTerms === 'function' ? ctx.groupFilterTerms() : null;
    const hasGroupFilters = groupFilterTerms instanceof Map && groupFilterTerms.size > 0;
    collectVisibleGroupIdsAtLevel(
      ctx,
      getCurrentGroupSourceRows(ctx),
      groupFields,
      0,
      'root',
      Number(level),
      expandedSet,
      autoExpand,
      hasGroupFilters,
      ids
    );
    return ids;
  }

  for (const row of ctx.displayRows()) {
    if (row.kind === 'group' && row.level === level) {
      ids.push(row.id);
    }
  }
  return ids;
}
export function hasAnyExpandedGroupsHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const shouldAutoExpand =
    typeof ctx.shouldAutoExpandGroupsCached === 'function'
      ? Boolean(ctx.shouldAutoExpandGroupsCached())
      : typeof ctx.shouldAutoExpandGroups !== 'function' || Boolean(ctx.shouldAutoExpandGroups());
  return (
    (ctx.groupColumns?.().length ?? 0) > 0 &&
    (((ctx.groupExpansionAuto?.() ?? true) && shouldAutoExpand) || ctx.expandedGroups().size > 0)
  );
}
export function getGroupBlockAggregateHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [block, column] = args;
  if (!column.aggregate) return '';
  try {
    const cacheKey = ctx.getAggregateCacheKey('block', block.id, column);
    const cached = ctx.aggregateCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }
    const groupData = block.rows ?? [];
    if (groupData.length === 0) return '-';
    const value =
      column.aggregate === 'percent'
        ? ctx.getPercentAggregate(groupData, ctx.getFilteredSortedData(), column)
        : ctx.gridService.calculateAggregate(
            groupData,
            ctx.getColumnField(column),
            column.aggregate
          );
    if (!isFinite(value)) return '-';
    if (column.format && !['count', 'distinct', 'percent'].includes(column.aggregate)) {
      const formatted = column.format(value);
      ctx.aggregateCache.set(cacheKey, formatted);
      return formatted;
    }
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
    reportGridError('Error calculating group aggregate:', error);
    return '-';
  }
}
export function getGroupAggregateHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [groupRow, column] = args;
  if (!column.aggregate) return '';
  try {
    const groupKey = (groupRow as LooseValue).id ?? `${groupRow.field}:${groupRow.value}`;
    const cacheKey = ctx.getAggregateCacheKey('group', groupKey, column);
    const cached = ctx.aggregateCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }
    const groupData = ctx.getGroupData(groupRow);
    if (groupData.length === 0) return '-';
    const value =
      column.aggregate === 'percent'
        ? ctx.getPercentAggregate(groupData, ctx.getFilteredSortedData(), column)
        : ctx.gridService.calculateAggregate(
            groupData,
            ctx.getColumnField(column),
            column.aggregate
          );
    if (!isFinite(value)) return '-';
    // Format using column formatter
    if (column.format && !['count', 'distinct', 'percent'].includes(column.aggregate)) {
      const formatted = column.format(value);
      ctx.aggregateCache.set(cacheKey, formatted);
      return formatted;
    }
    // Default formatting
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
    reportGridError('Error calculating group aggregate:', error);
    return '-';
  }
}
export function getGroupDataHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [groupRow] = args;
  if (groupRow.rows) {
    return groupRow.rows;
  }
  // Extract the data from buildGroupedRows by filtering original data
  const field = groupRow.field;
  const value = groupRow.value;
  const dataset = ctx.getFilteredSortedData();
  return dataset.filter((row: LooseValue) => {
    const rowValue = (row as LooseValue)[field];
    if (typeof ctx.resolveGroupValue === 'function') {
      const groupedValue = ctx.resolveGroupValue(field, rowValue);
      if (
        groupedValue &&
        (Object.is(groupedValue.value, value) ||
          (typeof groupedValue.value !== 'object' && String(groupedValue.value) === String(value)))
      ) {
        return true;
      }
    }
    return rowValue === value || (rowValue === null && value === '-');
  }) as T[];
}

const ROW_IDENTITY_KEYS = ['__gridRowKey', 'id', 'connectionId', 'key', 'rowKey'] as const;

function getRowIdentityTokens(row: LooseValue): string[] {
  if (!row || typeof row !== 'object') {
    return [];
  }

  const record = row as Record<string, unknown>;
  const tokens: string[] = [];

  for (const key of ROW_IDENTITY_KEYS) {
    const value = record[key];
    if (typeof value === 'string' || typeof value === 'number') {
      tokens.push(`${key}:${String(value)}`);
    }
  }

  return tokens;
}

function buildIdentityIndexMap(rows: LooseValue[]): Map<string, number> {
  const identityIndexMap = new Map<string, number>();

  rows.forEach((row, index) => {
    if (!row || typeof row !== 'object') {
      return;
    }

    const record = row as Record<string, unknown>;
    for (const key of ROW_IDENTITY_KEYS) {
      const value = record[key];
      if (typeof value !== 'string' && typeof value !== 'number') {
        continue;
      }
      const token = `${key}:${String(value)}`;
      if (!identityIndexMap.has(token)) {
        identityIndexMap.set(token, index);
      }
    }
  });

  return identityIndexMap;
}

function resolveRowIndexByIdentity(
  row: LooseValue,
  identityIndexMap?: Map<string, number> | null
): number {
  if (!identityIndexMap) {
    return -1;
  }

  for (const token of getRowIdentityTokens(row)) {
    const index = identityIndexMap.get(token);
    if (index !== undefined) {
      return index;
    }
  }

  return -1;
}

export function getGlobalRowIndexHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [row] = args;
  if (row && typeof row === 'object' && ctx.filteredSortedCache?.indexMap) {
    const cachedIndex = ctx.filteredSortedCache.indexMap.get(row as object);
    if (cachedIndex !== undefined) {
      return cachedIndex;
    }
  }

  const identityTokens = getRowIdentityTokens(row);
  if (identityTokens.length > 0) {
    if (
      ctx.filteredSortedCache &&
      !ctx.filteredSortedCache.identityIndexMap &&
      Array.isArray(ctx.filteredSortedCache.rows)
    ) {
      ctx.filteredSortedCache.identityIndexMap = buildIdentityIndexMap(
        ctx.filteredSortedCache.rows
      );
    }

    const identityIndex = resolveRowIndexByIdentity(row, ctx.filteredSortedCache?.identityIndexMap);
    if (identityIndex >= 0) {
      return identityIndex;
    }
  }

  if (row && typeof row === 'object' && typeof ctx.processedDataRowIndexLookup === 'function') {
    const processedIndex = ctx.processedDataRowIndexLookup()?.get(row as object);
    if (processedIndex !== undefined) {
      return processedIndex;
    }
  }

  const rows = ctx.getFilteredSortedData();
  return rows.indexOf(row);
}
export function startEditFromGroupHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [row, column] = args;
  const idx = ctx.getGlobalRowIndex(row);
  if (idx >= 0) {
    ctx.startEdit(idx, column);
  }
}
export function getFilteredSortedDataHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (ctx.filteredSortedCache && ctx.filteredSortedCache.key === ctx.filteredSortedCacheKey) {
    return ctx.filteredSortedCache.rows;
  }
  const sourceRows = ctx.dataSignal();

  if (ctx.config.remoteData) {
    const indexMap = new WeakMap<object, number>();
    let remoteRows = sourceRows;
    let appendRows: LooseValue[] | null = null;

    for (let index = 0; index < sourceRows.length; index += 1) {
      const row = sourceRows[index];
      const appendRow = row && typeof row === 'object' && (row as LooseValue).__appendRow;
      if (appendRow) {
        if (!appendRows) {
          appendRows = [];
          remoteRows = sourceRows.slice(0, index);
        }
        appendRows.push(row);
        continue;
      }

      if (appendRows) {
        if (row && typeof row === 'object') {
          indexMap.set(row as object, remoteRows.length);
        }
        remoteRows.push(row);
        continue;
      }

      if (row && typeof row === 'object') {
        indexMap.set(row as object, index);
      }
    }

    if (appendRows?.length) {
      for (const row of appendRows) {
        if (row && typeof row === 'object') {
          indexMap.set(row as object, remoteRows.length);
        }
        remoteRows.push(row);
      }
    }

    ctx.filteredSortedCache = {
      key: ctx.filteredSortedCacheKey,
      rows: remoteRows,
      indexMap,
      identityIndexMap: null
    };
    return remoteRows;
  }

  let result = sourceRows;
  let appendRows: LooseValue[] | null = null;

  for (let index = 0; index < sourceRows.length; index += 1) {
    const row = sourceRows[index];
    const appendRow = row && typeof row === 'object' && (row as LooseValue).__appendRow;
    if (appendRow) {
      if (!appendRows) {
        appendRows = [];
        result = sourceRows.slice(0, index);
      }
      appendRows.push(row);
      continue;
    }

    if (appendRows) {
      result.push(row);
    }
  }

  if (!appendRows?.length) {
    // Keep local filter/sort operations isolated from the caller-owned data array.
    result = sourceRows.slice();
  }
  // ? Apply Quick Filters first
  const quickFilters = ctx.quickFilterValues();
  if (quickFilters.size > 0) {
    const normalizedQuickFilters: Array<[string, string]> = [];
    for (const [field, searchTerm] of quickFilters.entries()) {
      const normalized = String(searchTerm ?? '').toLowerCase();
      if (normalized) {
        normalizedQuickFilters.push([field, normalized]);
      }
    }

    if (normalizedQuickFilters.length > 0) {
      result = result.filter((row: LooseValue) => {
        for (const [field, searchLower] of normalizedQuickFilters) {
          const value = (row as LooseValue)[field];
          const strValue = value != null ? String(value).toLowerCase() : '';
          if (!strValue.includes(searchLower)) {
            return false;
          }
        }
        return true;
      });
    }
  }
  // Apply advanced filters
  const filters = ctx.filterStates();
  if (filters.length > 0) {
    const columns = ctx.columnsSignal();
    result = ctx.gridService.applyFilters(result, filters, columns);
  }
  // Apply sorts
  const sorts = ctx.sortStates();
  if (sorts.length > 0) {
    result = ctx.gridService.applySorts(result, sorts);
  }
  if (appendRows?.length) {
    result = [...result, ...appendRows];
  }
  const indexMap = new WeakMap<object, number>();
  result.forEach((row: LooseValue, index: LooseValue) => {
    if (row && typeof row === 'object') {
      indexMap.set(row as object, index);
    }
  });
  ctx.filteredSortedCache = {
    key: ctx.filteredSortedCacheKey,
    rows: result,
    indexMap,
    identityIndexMap: null
  };
  return result;
}
export function hasGroupAggregatesHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const hasAggregates = ctx.hasAggregates();
  if (!hasAggregates || ctx.groupColumns().length === 0) {
    return false;
  }
  return ctx.showGroupHeaderAggregates() || ctx.shouldAutoShowAggregates();
}
