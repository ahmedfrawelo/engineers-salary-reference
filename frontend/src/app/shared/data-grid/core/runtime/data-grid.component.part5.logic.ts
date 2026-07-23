import type { GridColumn } from '../../models';
import {
  GRID_FEEDBACK_MESSAGES,
  showGridAlert
} from '../../utils/feedback';
import { debugGridLog, reportGridError } from '../../utils';

type LooseValue = ReturnType<typeof JSON.parse>;
type HelperContext = Record<string, LooseValue>;
type T = unknown;
export function setDataInternalHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [rows] = args;
  ctx._data = rows;
  ctx.dataSignal.set(rows);
  ctx.gridService?.clearCache?.();
  ctx.invalidateFilteredSortedCache?.();
  ctx.columnAutoWidthCache?.clear();
  const totalRecords =
    ctx.config?.remoteData && typeof ctx.config.remoteTotalRecords === 'number'
      ? Math.max(0, ctx.config.remoteTotalRecords)
      : Array.isArray(rows)
        ? rows.length
        : 0;
  ctx.updatePaginationState?.(totalRecords);
  ctx.columnRangeCache.clear();
  ctx.columnStatsCache.clear();
  ctx.cellValueCache.clear();
  ctx.spreadsheetFormulaCache?.clear?.();
  ctx.selectionUndoSnapshot?.set?.(null);
  ctx.selectionUndoLabel?.set?.('');
  ctx.bumpAggregateCache?.();
  ctx.syncAggregateDisplayState?.();
  ctx.cdr.markForCheck();
}
export function buildEmptyRowHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const row: Record<string, LooseValue> = {};
  ctx.columns.forEach((column: LooseValue) => {
    const field = ctx.getColumnField(column);
    row[field] = ctx.getDefaultCellValue(column);
  });
  return row as T;
}
export function getDefaultCellValueHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  if (column.type === 'number' || column.cellType === 'number') {
    return null;
  }
  if (column.cellType === 'date') {
    return null;
  }
  return '';
}
export function cloneRowHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [row] = args;
  try {
    if (typeof structuredClone === 'function') {
      return structuredClone(row);
    }
  } catch {
    // fallback below
  }
  return JSON.parse(JSON.stringify(row));
}
export function assignRowKeyHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [row] = args;
  const key = `row-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  (row as LooseValue).__gridRowKey = key;
}
export function resetColumnsHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  // Clear all sorts
  ctx.sortStates.set([]);
  // Clear all filters
  ctx.filterStates.set([]);
  // Clear quick filters + global search
  ctx.quickFilterValues.set(new Map());
  ctx.globalSearchTerm = '';
  // Clear all groups
  ctx.groupColumns.set([]);
  ctx.groupDateIntervals?.set?.({});
  ctx.expandedGroups.set(new Set());
  ctx.groupFilterTerms.set(new Map());
  ctx.showGroupHeaderAggregates.set(false);
  ctx.showGroupFooterAggregates.set(false);
  ctx.showGrandTotalAggregates.set(false);
  ctx.columnHiddenSnapshot.clear();
  ctx.columnWidthLocks.clear();
  ctx.wrappedColumns.set(new Set());
  ctx.duplicateHighlightColumns.set(new Set());
  const initialOrder = ctx.initialColumnOrder.length
    ? [...ctx.initialColumnOrder]
    : ctx.columns.map((col: LooseValue) => ctx.getColumnField(col));
  if (initialOrder.length) {
    const ordered = initialOrder
      .map((field: LooseValue) =>
        ctx.columns.find((col: LooseValue) => ctx.getColumnField(col) === field)
      )
      .filter((col: LooseValue) => col !== undefined) as GridColumn<T>[];
    const remaining = ctx.columns.filter(
      (col: LooseValue) => !initialOrder.includes(ctx.getColumnField(col))
    );
    ctx.columns = [...ordered, ...remaining];
  }
  // Reset column state to initial config
  ctx.columns.forEach((col: LooseValue) => {
    const field = ctx.getColumnField(col);
    const state = ctx.initialColumnState.get(field);
    col.width = state?.width;
    col.hidden = state?.hidden ?? false;
    col.pinned = state?.pinned;
    col.align = state?.align;
    col.aggregate = state?.aggregate;
  });
  ctx.applyPinnedOrdering();
  ctx.columns = [...ctx.columns];
  ctx.alignmentChangeTimestamp.set(Date.now());
  ctx.automaticAutoSizeApplied = false;
  ctx.columnAutoWidthCache?.clear();
  ctx.columnRangeCache.clear();
  ctx.columnStatsCache.clear();
  ctx.paginationState.update((state: LooseValue) => ({ ...state, currentPage: 1 }));
  // Clear state
  if (ctx.stateKey) {
    ctx.clearState();
  }
  ctx.cdr.markForCheck();
  ctx.syncHeaderBodyWidths?.();
  ctx.emitColumnsChange?.();
  // Emit changes - emit multiple events
  ctx.emitChange('sort');
  ctx.emitChange('filter');
}
export function getFirstEditableColumnHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  return ctx.visibleColumns().find((column: LooseValue) => column.editable) ?? null;
}
export function copyTextFallbackHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [text] = args;
  if (typeof document === 'undefined') {
    throw new Error('Clipboard not available');
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}
export function isEmptyValueHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [value] = args;
  return value === null || value === undefined || value === '';
}
export function normalizeNumericValueHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [value] = args;
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const sanitized = value.replace(/,/g, '').trim();
    if (!sanitized) {
      return null;
    }
    const parsed = Number(sanitized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
export function isNumericColumnHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  const field = ctx.getColumnField(column);
  const numericFieldLookup = ctx.numericColumnFieldLookup?.();
  if (numericFieldLookup instanceof Set) {
    return numericFieldLookup.has(field);
  }

  if (
    column.type === 'number' ||
    ['sum', 'avg', 'min', 'max', 'median'].includes(column.aggregate as LooseValue)
  ) {
    return true;
  }
  return ctx
    .dataSignal()
    .some((row: LooseValue) => ctx.normalizeNumericValue((row as LooseValue)?.[field]) !== null);
}
export function toggleColumnInsightsHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  ctx.showColumnInsights.update((val: LooseValue) => !val);
  if (ctx.showColumnInsights() && !ctx.insightColumnField()) {
    const visibleColumns = ctx.visibleColumns();
    const firstNumeric = visibleColumns.find((column: LooseValue) => ctx.isNumericColumn(column));
    if (firstNumeric) {
      ctx.insightColumnField.set(ctx.getColumnField(firstNumeric));
    } else if (visibleColumns.length) {
      ctx.insightColumnField.set(ctx.getColumnField(visibleColumns[0]));
    }
  }
}
export function setInsightColumnHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [field] = args;
  ctx.insightColumnField.set(field);
}
export function getInsightColumnsHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  return ctx.visibleColumns();
}
export function toggleColorScaleHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  ctx.colorScaleEnabled.update((val: LooseValue) => !val);
  ctx.logAuditEvent('visual', `Color scale ${ctx.colorScaleEnabled() ? 'enabled' : 'disabled'}`);
}
export function getColorScaleIntensityHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [row, column] = args;
  if (!ctx.colorScaleEnabled() || !ctx.isNumericColumn(column)) {
    return null;
  }
  const field = ctx.getColumnField(column);
  const value = ctx.normalizeNumericValue((row as LooseValue)?.[field]);
  if (value === null) {
    return 0;
  }
  const range = ctx.getColumnRange(field);
  if (!range) {
    return 0;
  }
  if (range.max === range.min) {
    return 0.5;
  }
  const normalized = (value - range.min) / (range.max - range.min);
  return Math.min(Math.max(normalized, 0), 1);
}
export function getColumnRangeHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [field] = args;
  if (ctx.columnRangeCache.has(field)) {
    return ctx.columnRangeCache.get(field)!;
  }

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let count = 0;
  const rows = ctx.processedData();
  for (const row of rows) {
    const value = ctx.normalizeNumericValue((row as LooseValue)?.[field]);
    if (value === null) {
      continue;
    }
    count += 1;
    if (value < min) {
      min = value;
    }
    if (value > max) {
      max = value;
    }
  }

  if (!count) {
    return null;
  }
  const range = { min, max };
  ctx.columnRangeCache.set(field, range);
  return range;
}
export function normalizeGroupKeyHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [value] = args;
  if (value === null || value === undefined) {
    return 'null';
  }
  const str = String(value).trim();
  return str || 'empty';
}
export function toggleAnomalyAlertsHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  ctx.showAnomalyAlerts.update((val: LooseValue) => !val);
  ctx.logAuditEvent('analytics', `Anomaly monitor ${ctx.showAnomalyAlerts() ? 'on' : 'off'}`);
}
export function isCellAnomalyHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [row, column] = args;
  if (!ctx.showAnomalyAlerts()) {
    return false;
  }
  if (!ctx.isNumericColumn(column)) {
    return false;
  }
  const field = ctx.getColumnField(column);
  const value = ctx.normalizeNumericValue((row as LooseValue)?.[field]);
  const stats = ctx.getColumnStats(field);
  return ctx.isValueAnomaly(value, stats);
}
export function getColumnStatsHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [field] = args;
  if (ctx.columnStatsCache.has(field)) {
    return ctx.columnStatsCache.get(field)!;
  }

  let count = 0;
  let mean = 0;
  let m2 = 0;

  const rows = ctx.processedData();
  for (const row of rows) {
    const value = ctx.normalizeNumericValue((row as LooseValue)?.[field]);
    if (value === null) {
      continue;
    }
    count += 1;
    const delta = value - mean;
    mean += delta / count;
    m2 += delta * (value - mean);
  }

  if (!count) {
    return null;
  }
  const variance = m2 / count;
  const std = Math.sqrt(variance);
  const stats = { mean, std };
  ctx.columnStatsCache.set(field, stats);
  return stats;
}
export function isValueAnomalyHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [value, stats] = args;
  if (value === null || !stats || stats.std === 0) {
    return false;
  }
  const zScore = Math.abs((value - stats.mean) / stats.std);
  return zScore >= ctx.anomalyZThreshold;
}
export function refreshDataTimestampHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  ctx.refreshingTicker.set(true);
  ctx.lastRefreshTime.set(new Date());
  setTimeout(() => {
    ctx.refreshingTicker.set(false);
  }, 1200);
}
export function getLastRefreshLabelHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const timestamp = ctx.lastRefreshTime();
  if (!timestamp) {
    return 'Not synced yet';
  }
  const diffMs = Date.now() - timestamp.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 10) return 'just now';
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
export function toggleQualityPanelHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  ctx.showQualityPanel.update((v: LooseValue) => !v);
  ctx.logAuditEvent('quality', `Quality dashboard ${ctx.showQualityPanel() ? 'shown' : 'hidden'}`);
}
export function toggleBookmarkRowHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [row] = args;
  if (!ctx.config.enableBookmarks) {
    return;
  }
  const current = ctx.bookmarkedRows();
  const exists = (ctx.bookmarkedRowLookup?.() ?? new Set(current)).has(row);
  if (exists) {
    ctx.bookmarkedRows.set(current.filter((r: LooseValue) => r !== row));
    ctx.logAuditEvent('bookmark', 'Row removed from bookmarks');
  } else {
    ctx.bookmarkedRows.set([row, ...current].slice(0, 20));
    ctx.logAuditEvent('bookmark', 'Row bookmarked');
  }
}
export function bookmarkSelectedRowsHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (!ctx.config.enableBookmarks) {
    return;
  }

  const selected = Array.isArray(ctx.selectedRows?.()) ? ctx.selectedRows() : [];
  if (!selected.length) {
    return;
  }

  const current = ctx.bookmarkedRows();
  const currentLookup = ctx.bookmarkedRowLookup?.() ?? new Set(current);
  const additions = selected.filter((row: LooseValue) => !currentLookup.has(row));
  if (!additions.length) {
    return;
  }

  ctx.bookmarkedRows.set([...additions, ...current].slice(0, 20));
  ctx.logAuditEvent(
    'bookmark',
    `${additions.length} row${additions.length > 1 ? 's' : ''} bookmarked from selection`
  );
}
export function isRowBookmarkedHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [row] = args;
  if (!ctx.config.enableBookmarks) {
    return false;
  }
  return (ctx.bookmarkedRowLookup?.() ?? new Set(ctx.bookmarkedRows())).has(row);
}
export function clearBookmarksHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (!ctx.config.enableBookmarks) {
    return;
  }
  ctx.bookmarkedRows.set([]);
}
export function getBookmarkLabelHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [row] = args;
  const visibleColumns = ctx.visibleColumns();
  const firstColumn = visibleColumns[0];
  if (!firstColumn) {
    return 'Row';
  }
  const value = (row as LooseValue)?.[ctx.getColumnField(firstColumn)];
  if (value === null || value === undefined || value === '') {
    return firstColumn.header;
  }
  return String(value);
}
export function toggleAuditTrailHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  ctx.showAuditTrail.update((v: LooseValue) => !v);
  ctx.logAuditEvent('audit', `Audit panel ${ctx.showAuditTrail() ? 'opened' : 'closed'}`);
}
export function logAuditEventHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [type, label] = args;
  const event = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    label,
    timestamp: Date.now()
  };
  ctx.auditEvents.update((events: LooseValue) => [event, ...events].slice(0, 50));
}
export function copyAuditEventHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [eventId] = args;
  const event = ctx.auditEvents().find((e: LooseValue) => e.id === eventId);
  if (!event) return;
  const text = `[${new Date(event.timestamp).toLocaleString()}] ${event.type.toUpperCase()} - ${event.label}`;
  try {
    navigator.clipboard?.writeText(text);
    ctx.showAutoSave('Audit entry copied');
  } catch {
    showGridAlert(GRID_FEEDBACK_MESSAGES.unableToCopyAuditEntry);
  }
}
export function toggleHighContrastHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  ctx.highContrastMode.update((v: LooseValue) => !v);
  ctx.logAuditEvent(
    'accessibility',
    `High contrast ${ctx.highContrastMode() ? 'enabled' : 'disabled'}`
  );
}
export function generateRecommendationsHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const recs: Array<{
    title: string;
    description: string;
  }> = [];
  const summary = ctx.dataQualitySummary();
  if (summary.emptyPercent > 20) {
    recs.push({
      title: 'High Missing Rate',
      description: 'Consider filtering out rows with critical null values.'
    });
  }
  if (summary.duplicateRows > 0) {
    recs.push({
      title: 'Duplicate Rows',
      description: 'Group by unique identifiers to inspect duplicates quickly.'
    });
  }
  const anomalies = ctx.anomalySummary();
  if (anomalies.rows > 0) {
    recs.push({
      title: 'Anomaly Detected',
      description: `Review ${anomalies.rows} rows flagged as outliers.`
    });
  }
  ctx.recommendations.set(recs.slice(0, 3));
}
export function toggleForecastSparklinesHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  ctx.showForecastSparklines.update((v: LooseValue) => !v);
  ctx.logAuditEvent(
    'analytics',
    `Forecast sparklines ${ctx.showForecastSparklines() ? 'shown' : 'hidden'}`
  );
}
export function getSparklinePathHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  if (!ctx.showForecastSparklines()) {
    return null;
  }
  if (!ctx.isNumericColumn(column)) {
    return null;
  }
  const field = ctx.getColumnField(column);
  const values: number[] = [];
  const rows = ctx.processedData();
  for (const row of rows) {
    const value = ctx.normalizeNumericValue((row as LooseValue)?.[field]);
    if (value === null) {
      continue;
    }
    values.push(value);
    if (values.length > 20) {
      values.shift();
    }
  }
  if (values.length === 0) {
    return null;
  }
  const width = 80;
  const height = 20;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (value < min) {
      min = value;
    }
    if (value > max) {
      max = value;
    }
  }
  const range = max - min || 1;
  const path: string[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const x = values.length === 1 ? width : (index / (values.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    path.push(`${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return path.join(' ');
}
export function openColumnNoteHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  const field = ctx.getColumnField(column);
  ctx.activeNoteColumn.set(field);
  ctx.noteDraft = ctx.columnNotes()[field] ?? '';
}
export function saveColumnNoteHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const column = ctx.activeNoteColumn();
  if (!column) return;
  const notes = { ...ctx.columnNotes() };
  const trimmed = ctx.noteDraft.trim();
  const hadNote = !!notes[column];
  if (trimmed) {
    notes[column] = trimmed;
  } else {
    delete notes[column];
  }
  ctx.columnNotes.set(notes);
  ctx.activeNoteColumn.set(null);
  ctx.noteDraft = '';
  ctx.logAuditEvent(
    'annotation',
    `${trimmed ? 'Saved' : hadNote ? 'Cleared' : 'No'} note for ${column}`
  );
}
export function closeNoteEditorHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  ctx.activeNoteColumn.set(null);
  ctx.noteDraft = '';
}
export function hasColumnNoteHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  return !!ctx.columnNotes()[ctx.getColumnField(column)];
}
export function generateShareableLinkHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  try {
    const payload = {
      state: ctx.buildGridState(),
      timestamp: Date.now()
    };
    const encoded = btoa(JSON.stringify(payload));
    const base =
      typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
    const link = `${base}?gridState=${encodeURIComponent(encoded)}`;
    navigator.clipboard?.writeText(link);
    ctx.showAutoSave('Shareable link copied');
    ctx.logAuditEvent('share', 'Permalink generated');
  } catch (error) {
    reportGridError('Failed to generate link', error);
    showGridAlert(GRID_FEEDBACK_MESSAGES.unableToGenerateShareableLink);
  }
}
export function toggleActionLauncherHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [event] = args;
  event?.stopPropagation();
  const next = !ctx.showActionLauncher();
  ctx.showActionLauncher.set(next);
  if (!next) {
    ctx.closeColumnVisibilityPanel();
  }
}
export function closeActionLauncherHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [event] = args;
  event?.stopPropagation();
  if (ctx.showActionLauncher()) {
    ctx.showActionLauncher.set(false);
    ctx.closeColumnVisibilityPanel();
  }
}
export function toggleHeadlinePanelHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  ctx.showHeadlinePanel.update((v: LooseValue) => !v);
  ctx.logAuditEvent('insight', `Headline metrics ${ctx.showHeadlinePanel() ? 'shown' : 'hidden'}`);
}
export function onHeaderFilterClickHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column, event] = args;
  if (column.filterable === false) {
    return;
  }
  ctx.openFilterMenu(column, event);
  event.stopPropagation();
}
export function onQuickFilterChangeHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column, value] = args;
  const field = ctx.getColumnField(column);
  const debounceDelay = ctx.config.debounceTime || ctx.config.filterDelay || 150;
  // Clear the existing timer for this field.
  if (ctx.quickFilterDebounceTimers.has(field)) {
    clearTimeout(ctx.quickFilterDebounceTimers.get(field));
  }
  // Set new timer
  const timer = setTimeout(() => {
    const normalizedValue = value.trim();
    const currentValue = ctx.quickFilterValues().get(field) || '';
    if (currentValue === normalizedValue) {
      ctx.quickFilterDebounceTimers.delete(field);
      return;
    }
    const newValues = new Map(ctx.quickFilterValues());
    if (normalizedValue) {
      newValues.set(field, normalizedValue);
    } else {
      newValues.delete(field);
    }
    ctx.quickFilterValues.set(newValues);
    ctx.emitChange('filter');
    ctx.quickFilterDebounceTimers.delete(field);
  }, debounceDelay);
  ctx.quickFilterDebounceTimers.set(field, timer);
}
export function getQuickFilterValueHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  const field = ctx.getColumnField(column);
  return ctx.quickFilterValues().get(field) || '';
}
export function clearQuickFilterHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  const field = ctx.getColumnField(column);
  if (!ctx.quickFilterValues().has(field)) {
    return;
  }
  const newValues = new Map(ctx.quickFilterValues());
  newValues.delete(field);
  ctx.quickFilterValues.set(newValues);
  ctx.emitChange('filter');
}
export function clearAllQuickFiltersHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (ctx.quickFilterValues().size === 0) {
    return;
  }
  ctx.quickFilterValues.set(new Map());
  ctx.emitChange('filter');
}
export function hasQuickFilterHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column] = args;
  const field = ctx.getColumnField(column);
  return ctx.quickFilterValues().has(field);
}
export function isSpreadsheetModeHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  return ctx.config?.spreadsheetMode === true;
}
export function getSpreadsheetCellValueHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [row, col] = args;
  if (!ctx.isSpreadsheetMode()) {
    return ctx.getCellValueAt(row, col);
  }
  const cacheKey = `${row}:${col}`;
  // Check cache first
  if (ctx.spreadsheetFormulaCache.has(cacheKey)) {
    return ctx.spreadsheetFormulaCache.get(cacheKey);
  }
  const rawValue = ctx.getCellValueAt(row, col);
  // If it's not a formula, return raw value
  if (!ctx.formulaEngine.isFormula(rawValue)) {
    ctx.spreadsheetFormulaCache.set(cacheKey, rawValue);
    return rawValue;
  }
  // Evaluate formula
  try {
    const normalizedFormula = normalizeSpreadsheetFormulaForGrid(ctx, String(rawValue));
    const result = ctx.formulaEngine.evaluate(
      normalizedFormula,
      (r: number, c: number) => ctx.getSpreadsheetCellValue(r, c), // Recursive for dependencies
      row,
      col
    );
    ctx.spreadsheetFormulaCache.set(cacheKey, result);
    return result;
  } catch (error) {
    reportGridError('[DataGrid] Formula evaluation error:', error);
    return '#ERROR!';
  }
}

function normalizeSpreadsheetFormulaForGrid(ctx: HelperContext, formula: string): string {
  let normalized = String(formula || '');

  normalized = normalized.replace(/\[([^\]]+)\]\s*@\s*(\d+)/g, (_match, rawColumn, rawRow) =>
    resolveNamedSpreadsheetReference(ctx, String(rawColumn), String(rawRow))
  );

  normalized = normalized.replace(
    /\b([A-Za-z_][A-Za-z0-9_]*)\s*@\s*(\d+)\b/g,
    (match, rawColumn, rawRow) => {
      const reference = resolveNamedSpreadsheetReference(ctx, String(rawColumn), String(rawRow));
      return reference === `${rawColumn}@${rawRow}` ? match : reference;
    }
  );

  return normalized;
}

function resolveNamedSpreadsheetReference(
  ctx: HelperContext,
  rawColumn: string,
  rawRow: string
): string {
  const rowNumber = Number(rawRow);
  if (!Number.isInteger(rowNumber) || rowNumber <= 0) {
    return `${rawColumn}@${rawRow}`;
  }

  const columns = Array.isArray(ctx.visibleColumns?.()) ? ctx.visibleColumns() : [];
  const normalizedToken = normalizeSpreadsheetFormulaToken(rawColumn);
  const columnIndex = columns.findIndex((column: LooseValue) => {
    const field = normalizeSpreadsheetFormulaToken(String(ctx.getColumnField(column)));
    const header = normalizeSpreadsheetFormulaToken(String(column.header || ctx.getColumnField(column)));
    return normalizedToken === field || normalizedToken === header;
  });

  if (columnIndex < 0) {
    return `${rawColumn}@${rawRow}`;
  }

  return ctx.formulaEngine.getCellReferenceString(rowNumber - 1, columnIndex);
}

function normalizeSpreadsheetFormulaToken(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/%/g, 'pct')
    .replace(/[^a-z0-9]+/g, '');
}
export function getCellValueAtHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [row, col] = args;
  const data = ctx.getFilteredSortedData();
  const columns = ctx.visibleColumns();
  if (row < 0 || row >= data.length || col < 0 || col >= columns.length) {
    return null;
  }
  const rowData = data[row];
  const column = columns[col];
  const field = ctx.getColumnField(column);
  return (rowData as LooseValue)?.[field];
}
export function setSpreadsheetCellValueHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [row, col, value] = args;
  if (!ctx.isSpreadsheetMode()) {
    return;
  }
  const data = ctx.getFilteredSortedData();
  const columns = ctx.visibleColumns();
  if (row < 0 || row >= data.length || col < 0 || col >= columns.length) {
    return;
  }
  const rowData = data[row];
  const column = columns[col];
  const field = ctx.getColumnField(column);
  // Set the value
  (rowData as LooseValue)[field] = value;
  ctx.invalidateFilteredSortedCache();
  ctx.columnRangeCache?.delete?.(field);
  ctx.columnStatsCache?.delete?.(field);
  ctx.cellValueCache?.clear?.();
  ctx.bumpAggregateCache?.();
  // Any edited cell can be a dependency of formulas in other cells.
  ctx.spreadsheetFormulaCache?.clear?.();
  // If autoCalculate is enabled, recalculate dependent cells
  if (ctx.config?.autoCalculate !== false) {
    ctx.recalculateDependentCells(row, col);
  }
  // Emit change event
  ctx.onCellEdit.emit({ row: rowData, field, value });
  ctx.emitChange('edit');
}
export function recalculateDependentCellsHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [changedRow, changedCol] = args;
  // Clear all cached formulas (simple approach)
  // In production, you'd track dependencies and only clear affected cells
  ctx.spreadsheetFormulaCache.clear();
  // Force re-render
  ctx.cdr.markForCheck();
}
export function onPasteSpreadsheetHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [event] = args;
  if (!ctx.isSpreadsheetMode() || !ctx.config?.enableExcelPaste) {
    return;
  }

  if (!isSpreadsheetPasteEventRelevant(ctx, event)) {
    return;
  }

  const active =
    getSpreadsheetPasteStartCell(ctx, event) ??
    getSpreadsheetActiveCell(ctx) ??
    getDefaultSpreadsheetPasteCell(ctx);
  if (!active) {
    return;
  }
  event.preventDefault();

  const clipboardData = event.clipboardData?.getData('text');
  if (!clipboardData) {
    return;
  }

  try {
    const parsedData = ctx.excelPasteService.parseExcelData(clipboardData);
    if (parsedData.length === 0) {
      return;
    }

    const pasteRows = stripHeaderRowIfPresent(ctx, parsedData, active.col);
    if (pasteRows.length === 0) {
      return;
    }

    const result = applySpreadsheetPasteData(ctx, pasteRows, active.row, active.col);
    if (!result.cellsAffected) {
      showGridAlert('No editable cells were available for pasted data.', { tone: 'warning' });
      return;
    }

    ctx.spreadsheetFormulaCache.clear();
    ctx.columnRangeCache?.clear?.();
    ctx.columnStatsCache?.clear?.();
    ctx.cellValueCache?.clear?.();
    ctx.bumpAggregateCache?.();
    ctx.cdr.markForCheck();

    debugGridLog(
      `[DataGrid] Pasted ${result.rowsAffected} rows - ${result.colsAffected} columns`
    );
  } catch (error) {
    reportGridError('[DataGrid] Paste error:', error);
    showGridAlert(GRID_FEEDBACK_MESSAGES.failedToPasteData);
  }
}

function isSpreadsheetPasteEventRelevant(ctx: HelperContext, event: ClipboardEvent): boolean {
  const host = ctx.elementRef?.nativeElement as HTMLElement | undefined;
  const target = event.target;
  if (host && target instanceof Node && host.contains(target)) {
    return true;
  }

  const activeElement = typeof document !== 'undefined' ? document.activeElement : null;
  const bodyHasFocus =
    !activeElement ||
    activeElement === document.body ||
    activeElement === document.documentElement;
  if (!bodyHasFocus) {
    return false;
  }

  if (ctx.activeCell?.()) {
    return true;
  }

  const rows = getProcessedRows(ctx);
  if (!rows.some(row => row && isGridAppendRow(row))) {
    return false;
  }

  return !host || isPrimaryVisibleGridHost(host);
}

function isPrimaryVisibleGridHost(host: HTMLElement): boolean {
  if (typeof document === 'undefined') {
    return true;
  }

  const visibleHosts = Array.from(document.querySelectorAll('engineers-salary-reference-data-grid')).filter(element => {
    if (!(element instanceof HTMLElement)) {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });

  return visibleHosts.length === 0 || visibleHosts[0] === host;
}

function getSpreadsheetPasteStartCell(
  ctx: HelperContext,
  event: ClipboardEvent
): { row: number; col: number } | null {
  const target = event.target;
  if (!(target instanceof Element)) {
    return null;
  }

  const cell = target.closest('td');
  const row = cell?.closest('tr') as HTMLTableRowElement | null;
  if (!cell || !row || row.sectionRowIndex < 0) {
    return null;
  }

  const selectionOffset = ctx.config?.selectable ? 1 : 0;
  const columnIndex = cell.cellIndex - selectionOffset;
  if (columnIndex < 0) {
    return null;
  }

  return {
    row: row.sectionRowIndex,
    col: columnIndex
  };
}

function getDefaultSpreadsheetPasteCell(ctx: HelperContext): { row: number; col: number } | null {
  const rows = getProcessedRows(ctx);
  const appendRowIndex = rows.findIndex(row => row && isGridAppendRow(row));
  if (appendRowIndex < 0) {
    return null;
  }

  const columns = Array.isArray(ctx.visibleColumns?.()) ? ctx.visibleColumns() : [];
  const columnIndex = columns.findIndex((column: LooseValue) =>
    isPasteEditableColumn(ctx, rows[appendRowIndex], column)
  );
  if (columnIndex < 0) {
    return null;
  }

  ctx.activeCell?.set?.({ rowIndex: appendRowIndex, columnIndex });
  ctx.spreadsheetCurrentCell?.set?.({ row: appendRowIndex, col: columnIndex });
  return { row: appendRowIndex, col: columnIndex };
}

function stripHeaderRowIfPresent(
  ctx: HelperContext,
  pastedRows: string[][],
  startColumnIndex: number
): string[][] {
  if (pastedRows.length < 2) {
    return pastedRows;
  }

  const firstRow = pastedRows[0] ?? [];
  if (!firstRow.length) {
    return pastedRows;
  }

  const columns = getPasteTargetColumns(ctx, startColumnIndex);
  const comparableCount = Math.min(firstRow.length, columns.length);
  if (comparableCount < 2) {
    return pastedRows;
  }

  let matchedHeaders = 0;
  for (let index = 0; index < comparableCount; index++) {
    const cell = normalizePasteLookupValue(firstRow[index]);
    const column = columns[index];
    const header = normalizePasteLookupValue(column?.header);
    const field = normalizePasteLookupValue(ctx.getColumnField?.(column));
    if (cell && (cell === header || cell === field)) {
      matchedHeaders++;
    }
  }

  return matchedHeaders >= Math.max(2, Math.ceil(comparableCount * 0.6))
    ? pastedRows.slice(1)
    : pastedRows;
}

function applySpreadsheetPasteData(
  ctx: HelperContext,
  pastedRows: string[][],
  startRowIndex: number,
  startColumnIndex: number
): { rowsAffected: number; colsAffected: number; cellsAffected: number } {
  let rowsAffected = 0;
  let colsAffected = 0;
  let cellsAffected = 0;
  let lastRealRow: LooseValue | null = null;

  for (let rowOffset = 0; rowOffset < pastedRows.length; rowOffset++) {
    const targetRowIndex = startRowIndex + rowOffset;
    const targetRow = ensurePasteTargetRow(ctx, targetRowIndex, lastRealRow);
    if (!targetRow) {
      continue;
    }

    lastRealRow = targetRow;
    rowsAffected++;

    const pastedCells = pastedRows[rowOffset] ?? [];
    const pasteColumns = getPasteTargetColumns(ctx, startColumnIndex);
    for (let colOffset = 0; colOffset < pastedCells.length; colOffset++) {
      const column = pasteColumns[colOffset];
      if (!column) {
        break;
      }

      if (!isPasteEditableColumn(ctx, targetRow, column)) {
        continue;
      }

      const applied = applySpreadsheetPastedCell(
        ctx,
        targetRow,
        column,
        pastedCells[colOffset] ?? ''
      );
      if (applied) {
        colsAffected = Math.max(colsAffected, colOffset + 1);
        cellsAffected++;
      }
    }
  }

  return { rowsAffected, colsAffected, cellsAffected };
}

function ensurePasteTargetRow(
  ctx: HelperContext,
  rowIndex: number,
  fallbackReferenceRow: LooseValue | null
): LooseValue | null {
  const rows = getProcessedRows(ctx);
  const existing = rows[rowIndex];
  if (existing && !isGridAppendRow(existing)) {
    return existing;
  }

  if (!ctx.config?.appendRow || typeof ctx.buildEmptyRow !== 'function') {
    return null;
  }

  const nextRow = ctx.buildEmptyRow();
  ctx.assignRowKey?.(nextRow);

  const previousRealRow =
    fallbackReferenceRow ??
    findPreviousRealRow(rows, rowIndex) ??
    findLastRealRow(Array.isArray(ctx.dataSignal?.()) ? ctx.dataSignal() : []);

  if (typeof ctx.insertRowAfter === 'function') {
    ctx.insertRowAfter(previousRealRow, nextRow, 'paste');
  } else {
    const sourceRows = Array.isArray(ctx.dataSignal?.()) ? [...ctx.dataSignal()] : [];
    sourceRows.push(nextRow);
    ctx.setDataInternal?.(sourceRows);
  }

  return nextRow;
}

function getProcessedRows(ctx: HelperContext): LooseValue[] {
  const rows =
    typeof ctx.processedData === 'function'
      ? ctx.processedData()
      : typeof ctx.getFilteredSortedData === 'function'
        ? ctx.getFilteredSortedData()
        : [];
  return Array.isArray(rows) ? rows : [];
}

function findPreviousRealRow(rows: LooseValue[], beforeIndex: number): LooseValue | null {
  for (let index = Math.min(beforeIndex - 1, rows.length - 1); index >= 0; index--) {
    const row = rows[index];
    if (row && !isGridAppendRow(row)) {
      return row;
    }
  }
  return null;
}

function findLastRealRow(rows: LooseValue[]): LooseValue | null {
  for (let index = rows.length - 1; index >= 0; index--) {
    const row = rows[index];
    if (row && !isGridAppendRow(row)) {
      return row;
    }
  }
  return null;
}

function isGridAppendRow(row: LooseValue): boolean {
  return !!row && typeof row === 'object' && !!(row as Record<string, unknown>).__appendRow;
}

function getPasteTargetColumns(
  ctx: HelperContext,
  startColumnIndex: number
): LooseValue[] {
  const columns = Array.isArray(ctx.visibleColumns?.()) ? ctx.visibleColumns() : [];
  return columns.slice(Math.max(0, startColumnIndex));
}

function isPasteEditableColumn(ctx: HelperContext, row: LooseValue, column: LooseValue): boolean {
  if (!column || column.editable === false || ctx.config?.editMode === 'none') {
    return false;
  }

  if (isSearchSelectColumn(column)) {
    return !isSearchSelectDisabled(ctx, row, column);
  }

  return typeof column.canEdit === 'function' ? column.canEdit(row, column) !== false : true;
}

function applySpreadsheetPastedCell(
  ctx: HelperContext,
  row: LooseValue,
  column: LooseValue,
  rawValue: string
): boolean {
  if (isSearchSelectColumn(column)) {
    const resolution = resolveSearchSelectPasteOption(ctx, row, column, rawValue);
    if (!resolution.matched) {
      const fallbackValue = String(rawValue ?? '').trim();
      if (!fallbackValue) {
        return false;
      }
      applySearchSelectRawPastedText(ctx, row, column, fallbackValue);
      return true;
    }
    applySearchSelectPasteValue(ctx, row, column, resolution.option);
    return true;
  }

  const value = convertPastedCellValue(rawValue, column);
  applyRawPastedCell(ctx, row, column, value);
  return true;
}

function applySearchSelectRawPastedText(
  ctx: HelperContext,
  row: LooseValue,
  column: LooseValue,
  value: string
): void {
  const field =
    typeof ctx.getColumnField === 'function'
      ? ctx.getColumnField(column)
      : String(column?.field ?? '');
  if (!field) {
    applyRawPastedCell(ctx, row, column, value);
    return;
  }
  (row as Record<string, unknown>)[field] = value;
  if (ctx.onCellEdit?.emit) {
    ctx.onCellEdit.emit({ row, field, value });
    ctx.emitChange?.('edit');
    return;
  }
  applyRawPastedCell(ctx, row, column, value);
}

function applyRawPastedCell(
  ctx: HelperContext,
  row: LooseValue,
  column: LooseValue,
  value: LooseValue
): void {
  if (typeof ctx.saveEdit === 'function') {
    ctx.saveEdit(row, column, value);
  } else {
    const field = ctx.getColumnField(column);
    (row as Record<string, unknown>)[field] = value;
    ctx.onCellEdit?.emit?.({ row, field, value });
    ctx.emitChange?.('edit');
  }
}

function isSearchSelectColumn(column: LooseValue): boolean {
  return column?.cellType === 'search-select' || !!column?.searchSelect;
}

function isSearchSelectDisabled(ctx: HelperContext, row: LooseValue, column: LooseValue): boolean {
  const disabled = column.searchSelect?.disabled;
  return typeof disabled === 'function' ? disabled(row, column) : (disabled ?? false);
}

function applySearchSelectPasteValue(
  ctx: HelperContext,
  row: LooseValue,
  column: LooseValue,
  option: LooseValue | null
): void {
  if (typeof ctx.onSearchSelectValueChange === 'function') {
    ctx.onSearchSelectValueChange(row, column, option);
    return;
  }

  const handler = column.searchSelect?.valueChange;
  if (typeof handler === 'function') {
    handler(option, row, column);
    return;
  }

  const field = ctx.getColumnField(column);
  (row as Record<string, unknown>)[field] = option;
  ctx.onCellEdit?.emit?.({ row, field, value: option });
  ctx.emitChange?.('edit');
}

function resolveSearchSelectPasteOption(
  ctx: HelperContext,
  row: LooseValue,
  column: LooseValue,
  rawValue: string
): { matched: boolean; option: LooseValue | null } {
  const normalized = normalizePasteLookupValue(rawValue);
  if (!normalized) {
    return { matched: true, option: null };
  }

  const options =
    typeof ctx.getSearchSelectOptions === 'function'
      ? ctx.getSearchSelectOptions(row, column)
      : typeof column.searchSelect?.options === 'function'
        ? column.searchSelect.options(row, column)
        : column.searchSelect?.options;
  const optionList = Array.isArray(options) ? options : [];
  const displayFn =
    typeof ctx.getSearchSelectDisplayFn === 'function'
      ? ctx.getSearchSelectDisplayFn(column)
      : column.searchSelect?.displayFn;

  const option =
    optionList.find(option =>
      getSearchSelectOptionCandidates(option, displayFn).some(
        candidate => normalizePasteLookupValue(candidate) === normalized
      )
    ) ?? null;

  return option ? { matched: true, option } : { matched: false, option: null };
}

function getSearchSelectOptionCandidates(
  option: LooseValue,
  displayFn?: ((option: LooseValue) => string) | null
): string[] {
  const candidates: string[] = [];
  if (displayFn) {
    candidates.push(displayFn(option));
  }

  if (typeof option === 'string' || typeof option === 'number' || typeof option === 'boolean') {
    candidates.push(String(option));
    return candidates;
  }

  if (option && typeof option === 'object') {
    const record = option as Record<string, unknown>;
    for (const key of ['label', 'value', 'name', 'title', 'id', 'code']) {
      const value = record[key];
      if (value !== null && value !== undefined) {
        candidates.push(String(value));
      }
    }
  }

  return candidates;
}

function normalizePasteLookupValue(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function convertPastedCellValue(value: string, column: LooseValue): LooseValue {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    return '';
  }

  const cellType = column.cellType || column.type;
  if (cellType === 'number') {
    const numeric = Number(trimmed.replace(/,/g, ''));
    return Number.isFinite(numeric) ? numeric : trimmed;
  }

  if (cellType === 'boolean') {
    const normalized = trimmed.toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'n'].includes(normalized)) {
      return false;
    }
  }

  return trimmed;
}
export function getCurrentCellReferenceHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const active = getSpreadsheetActiveCell(ctx);
  if (!active) {
    return 'A1';
  }
  return ctx.formulaEngine.getCellReferenceString(active.row, active.col);
}
export function getCurrentCellFormulaHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const active = getSpreadsheetActiveCell(ctx);
  if (!active) {
    return '';
  }
  const rawValue = ctx.getCellValueAt(active.row, active.col);
  return rawValue ? String(rawValue) : '';
}
export function onFormulaBarApplyHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [formula] = args;
  const active = getSpreadsheetActiveCell(ctx);
  if (!active) {
    return;
  }
  ctx.setSpreadsheetCellValue(active.row, active.col, formula);
  ctx.spreadsheetEditingCell.set(null);
}
export function onFormulaBarCancelHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  ctx.spreadsheetEditingCell.set(null);
}
export function handleSpreadsheetKeydownHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [event] = args;
  if (!ctx.isSpreadsheetMode()) {
    return;
  }
  const active = getSpreadsheetActiveCell(ctx);
  if (!active) {
    return;
  }
  // F2 to start editing
  if (event.key === 'F2') {
    event.preventDefault();
    ctx.spreadsheetEditingCell.set(active);
    ctx.cdr.markForCheck();
    return;
  }
  // Delete to clear cell
  if (event.key === 'Delete') {
    event.preventDefault();
    ctx.setSpreadsheetCellValue(active.row, active.col, '');
    return;
  }
}

function getSpreadsheetActiveCell(
  ctx: HelperContext
): { row: number; col: number } | null {
  const activeCell = ctx.activeCell?.();
  if (activeCell) {
    return {
      row: activeCell.rowIndex,
      col: activeCell.columnIndex
    };
  }

  return ctx.spreadsheetCurrentCell();
}
export function cancelLoadingHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  ctx.loadingCancelled = true;
  ctx.loadingProgress = 0;
  ctx.canCancelLoading = false;
  ctx.cdr.markForCheck();
}
export function updateLoadingProgressHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [progress, cancellable] = args;
  ctx.loadingProgress = Math.max(0, Math.min(100, progress));
  ctx.canCancelLoading = cancellable;
  ctx.cdr.markForCheck();
}
