import type { ExportOptions, FilterOperator, GridColumn } from '../../models';
import {
  buildColumnFilterState,
  buildSingleColumnSortState,
  removeColumnFilterState,
  upsertColumnFilterState
} from '../../internal/filtering-sorting/domain/data-grid-filter-sort.policy';
import { renderAppIconHtml } from '@shared/icons/programmatic-app-icon';
import { isDefaultGridContext } from '../../utils/layout';
import {
  getDeletedRowsFeedbackMessage,
  GRID_FEEDBACK_MESSAGES,
  showGridAction,
  showGridAlert
} from '../../utils/feedback';
import { reportGridError } from '../../utils';
import {
  deleteColumnHelper,
  insertColumnRelativeHelper,
  renameColumnFromMenuHelper
} from './data-grid.component.runtime-column-actions';
import { requestExternalFilterPanelHelper } from './data-grid.component.runtime-filter-menu';
type LooseValue = ReturnType<typeof JSON.parse>;
type HelperContext = Record<string, LooseValue>;
type T = unknown;

function commitColumnLayoutMutation(
  ctx: HelperContext,
  options: { notify?: boolean; save?: boolean; sync?: boolean } = {}
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
}

function isHoverEnabled(ctx: HelperContext): boolean {
  return ctx.config?.hover !== false;
}
function isHoverSuspended(ctx: HelperContext): boolean {
  const hoverSuspendUntil = Number(ctx.suspendHoverUntilTs) || 0;
  return hoverSuspendUntil > Date.now();
}
function shouldHandleHeaderHover(ctx: HelperContext): boolean {
  return isHoverEnabled(ctx) && !isDefaultGridContext(ctx) && !isHoverSuspended(ctx);
}
function shouldHandleCellHover(ctx: HelperContext): boolean {
  return isHoverEnabled(ctx) && !isDefaultGridContext(ctx) && !isHoverSuspended(ctx);
}
export function shouldBindCellHoverEventsHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  return isHoverEnabled(ctx) && !isDefaultGridContext(ctx);
}

export function shouldBindHeaderHoverStateHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  return isHoverEnabled(ctx) && !isDefaultGridContext(ctx);
}

export function shouldBindRowHoverStateHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  return isHoverEnabled(ctx) && !isDefaultGridContext(ctx);
}

export function getTooltipAnchorFromClientHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [clientX, clientY] = args;
  const { originX, originY } = ctx.getOverlayBounds();
  return {
    x: clientX - originX,
    y: clientY - originY
  };
}
export function getTooltipAnchorHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [event] = args;
  return ctx.getTooltipAnchorFromClient(event.clientX, event.clientY);
}
export function scheduleTooltipFollowHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [clientX, clientY] = args;
  if (!ctx.activeTooltip()) return;
  ctx.tooltipFollowClient = { x: clientX, y: clientY };
  if (ctx.tooltipFollowRequestId !== null) return;
  ctx.tooltipFollowRequestId = requestAnimationFrame(() => {
    ctx.tooltipFollowRequestId = null;
    const pending = ctx.tooltipFollowClient;
    ctx.tooltipFollowClient = null;
    if (!pending || !ctx.activeTooltip()) return;
    const { x, y } = ctx.getTooltipAnchorFromClient(pending.x, pending.y);
    ctx.activeTooltip.update((current: LooseValue) => (current ? { ...current, x, y } : null));
  });
}
export function showTooltipHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [event, column, row, rowIndex] = args;
  if (column.showTooltip === false) return;
  if (ctx.isEditing(rowIndex, column)) return;
  const value = ctx.getCellValue(row, column);
  let content = column.getTooltip ? column.getTooltip(value, row) : ctx.getCellTitle(row, column);
  content = ctx.stripHtml(String(content ?? '')).trim();
  if (!content) return;
  const { x, y } = ctx.getTooltipAnchor(event);
  ctx.activeTooltip.set({ content, x, y });
}
export function hideTooltipHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (ctx.tooltipFollowRequestId !== null) {
    cancelAnimationFrame(ctx.tooltipFollowRequestId);
    ctx.tooltipFollowRequestId = null;
  }
  ctx.tooltipFollowClient = null;
  ctx.activeTooltip.set(null);
}
export function showHeaderTooltipHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [event, column] = args;
  if (!shouldHandleHeaderHover(ctx)) return;
  if (!column.headerTooltip) return;
  const { x, y } = ctx.getTooltipAnchor(event);
  ctx.activeTooltip.set({ content: column.headerTooltip, x, y });
}
export function handleHeaderMouseEnterHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [event, column] = args;
  if (!shouldHandleHeaderHover(ctx)) return;
  ctx.setHoveredColumn(ctx.getColumnField(column));
  ctx.showHeaderTooltip(event, column);
}
export function handleHeaderMouseMoveHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [event] = args;
  if (!shouldHandleHeaderHover(ctx)) return;
  ctx.scheduleTooltipFollow(event.clientX, event.clientY);
}
export function handleHeaderMouseLeaveHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  if (isDefaultGridContext(ctx)) return;
  ctx.clearHoveredColumn();
  ctx.hideTooltip();
}
export function handleCellMouseEnterHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [event, column, row, rowIndex] = args;
  if (!shouldHandleCellHover(ctx)) return;
  ctx.setHoveredColumn(ctx.getColumnField(column));
  ctx.showTooltip(event, column, row, rowIndex);
  ctx.syncHoverLink(event);
}
export function handleCellMouseMoveHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [event] = args;
  if (!shouldHandleCellHover(ctx)) return;
  ctx.scheduleTooltipFollow(event.clientX, event.clientY);
  ctx.syncHoverLink(event);
}
export function handleCellMouseLeaveHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (isDefaultGridContext(ctx)) return;
  ctx.clearHoveredColumn();
  ctx.hideTooltip();
  ctx.clearHoveredLink();
}
export function syncHoverLinkHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [event] = args;
  const target = event.target as HTMLElement | null;
  const currentTarget = event.currentTarget as HTMLElement | null;
  const linkEl =
    target?.closest<HTMLElement>('[data-link]') ??
    currentTarget?.querySelector<HTMLElement>('[data-link]') ??
    null;
  if (linkEl === ctx.hoveredLinkEl) {
    return;
  }
  ctx.clearHoveredLink();
  if (!linkEl) {
    return;
  }
  const hoverColor = ctx.resolveHoverColor(linkEl);
  linkEl.style.setProperty('color', hoverColor, 'important');
  linkEl.style.setProperty('-webkit-text-fill-color', hoverColor, 'important');
  ctx.hoveredLinkEl = linkEl;
}
export function clearHoveredLinkHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (!ctx.hoveredLinkEl) {
    return;
  }
  ctx.hoveredLinkEl.style.removeProperty('color');
  ctx.hoveredLinkEl.style.removeProperty('-webkit-text-fill-color');
  ctx.hoveredLinkEl = null;
}
export function resolveHoverColorHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [linkEl] = args;
  const styles = getComputedStyle(linkEl);
  const rawHover =
    styles.getPropertyValue('--data-grid-link-hover-color').trim() ||
    styles.getPropertyValue('--dg-shell-link-hover-color').trim();
  const rawFg = styles.getPropertyValue('--fg').trim();
  const fg = ctx.normalizeCssColor(rawFg, 'rgb(230 230 230)');
  return ctx.normalizeCssColor(rawHover, fg);
}
export function normalizeCssColorHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [raw, fallback] = args;
  if (!raw || raw.includes('var(')) {
    return fallback;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return fallback;
  }
  if (trimmed.startsWith('rgb') || trimmed.startsWith('#')) {
    return trimmed;
  }
  return `rgb(${trimmed})`;
}
export function openContextMenuHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column, event] = args;
  event.preventDefault();
  event.stopPropagation();
  ctx.closeAllMenus();
  // Calculate menu dimensions (approximate)
  const menuWidth = 200;
  const menuHeight = 440;
  const { boundsW, boundsH, originX, originY, scale } = ctx.getOverlaySpace();
  // Calculate initial position
  let x = (event.clientX - originX) / scale;
  let y = (event.clientY - originY) / scale;
  // Adjust if menu would overflow right edge
  if (x + menuWidth > boundsW - 10) {
    x = boundsW - menuWidth - 10;
  }
  // Adjust if menu would overflow bottom edge
  if (y + menuHeight > boundsH - 10) {
    y = boundsH - menuHeight - 10;
  }
  // Ensure menu doesn't go off left or top edge
  x = Math.max(10, x);
  y = Math.max(10, y);
  ctx.contextMenuColumn = column;
  ctx.contextMenuPosition = { x, y };
}
export function openColumnMenuFromButtonHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [column, event] = args;
  event.stopPropagation();
  event.preventDefault();
  ctx.closeAllMenus();
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  // Calculate menu dimensions (updated for new menu size)
  const menuWidth = 240;
  const menuHeight = 500;
  const { boundsW, boundsH, originX, originY, scale } = ctx.getOverlaySpace();
  // Calculate initial position (below and to the left of click)
  let x = (rect.left - originX) / scale;
  let y = (rect.bottom - originY) / scale + 2;
  // Adjust if menu would overflow right edge
  if (x + menuWidth > boundsW - 10) {
    x = boundsW - menuWidth - 10;
  }
  // Adjust if menu would overflow bottom edge
  if (y + menuHeight > boundsH - 10) {
    y = (rect.top - originY) / scale - menuHeight - 2;
  }
  // Ensure menu doesn't go off edges
  x = Math.max(10, x);
  y = Math.max(10, y);
  ctx.contextMenuColumn = column;
  ctx.contextMenuPosition = { x, y };
}
export function closeContextMenuHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  ctx.contextMenuColumn = null;
  ctx.showCellContextMenu = false;
  ctx.activeCellSubmenu = null;
  ctx.cellContextMenuAnchor = null;
  if (ctx.cellSubmenuHideTimeout) {
    clearTimeout(ctx.cellSubmenuHideTimeout);
    ctx.cellSubmenuHideTimeout = null;
  }
}
export function openCellContextMenuHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [row, column, event] = args;
  event.preventDefault();
  event.stopPropagation();
  ctx.closeAllMenus();
  // Close column menu if open
  ctx.contextMenuColumn = null;
  // Calculate position with viewport awareness
  const menuWidth = 220;
  const menuHeight = 300;
  const { boundsW, boundsH, originX, originY, scale } = ctx.getOverlaySpace();
  const anchorX = event.clientX;
  const anchorY = event.clientY;
  ctx.cellContextMenuAnchor = { x: anchorX, y: anchorY };
  let x = (anchorX - originX) / scale + 2;
  let y = (anchorY - originY) / scale + 2;
  // Adjust if would overflow right edge
  if (x + menuWidth > boundsW - 10) {
    x = (anchorX - originX) / scale - menuWidth - 8;
  }
  // Adjust if would overflow bottom edge
  if (y + menuHeight > boundsH - 10) {
    y = (anchorY - originY) / scale - menuHeight - 8;
  }
  // Ensure doesn't go off left/top edges
  x = Math.max(10, Math.min(x, boundsW - menuWidth - 10));
  y = Math.max(10, Math.min(y, boundsH - menuHeight - 10));
  ctx.cellContextMenuRow = row;
  ctx.cellContextMenuColumn = column;
  ctx.cellContextMenuPosition = { x, y };
  ctx.showCellContextMenu = true;
  requestAnimationFrame(() => ctx.adjustCellContextMenuPosition());
}
export function toggleColumnVisibilityHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [column] = args;
  column.hidden = !column.hidden;
  ctx.columns = [...ctx.columns];
  ctx.cdr.markForCheck();
  if (ctx.stateKey) {
    ctx.saveState();
  }
}
export function handleContextMenuActionHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [action] = args;
  const { type, column } = action;
  const field = ctx.getColumnField(column);
  switch (type) {
    case 'sort-asc':
      ctx.sortStates.set([{ field: field, direction: 'asc', order: 0 }]);
      ctx.emitChange('sort');
      break;
    case 'sort-desc':
      ctx.sortStates.set([{ field: field, direction: 'desc', order: 0 }]);
      ctx.emitChange('sort');
      break;
    case 'clear-sort':
      ctx.sortStates.set([]);
      ctx.emitChange('sort');
      break;
    case 'filter':
      if (requestExternalFilterPanelHelper(ctx, column)) {
        break;
      }
      ctx.openFilterMenu(column, new MouseEvent('click'));
      break;
    case 'clear-filter':
      // Clear filter for specific field
      ctx.filterStates.update((states: LooseValue) =>
        states.filter((s: LooseValue) => s.field !== field)
      );
      ctx.emitChange('filter');
      break;
    case 'pin-left':
      ctx.setColumnPinned(field, 'left');
      break;
    case 'pin-right':
      ctx.setColumnPinned(field, 'right');
      break;
    case 'unpin':
      ctx.setColumnPinned(field, undefined);
      break;
    case 'autosize':
      ctx.autoSizeColumn(column);
      break;
    case 'autosize-all':
      ctx.visibleColumns().forEach((col: LooseValue) => ctx.autoSizeColumn(col));
      break;
    case 'group':
      ctx.addGroupColumn(field);
      ctx.cdr.markForCheck();
      break;
    case 'ungroup':
      ctx.removeGroupColumn(field);
      ctx.cdr.markForCheck();
      break;
    case 'hide':
      ctx.setColumnHidden(field, true);
      commitColumnLayoutMutation(ctx);
      break;
    case 'add-column-left':
      insertColumnRelativeHelper(ctx, column, 'left');
      break;
    case 'add-column-right':
      insertColumnRelativeHelper(ctx, column, 'right');
      break;
    case 'rename-column':
      renameColumnFromMenuHelper(ctx, column);
      return;
    case 'delete-column':
      deleteColumnHelper(ctx, column);
      return;
    case 'show-all':
      // Show all hidden columns
      ctx.columns.forEach((col: LooseValue) => {
        col.hidden = false;
      });
      ctx.columns = [...ctx.columns];
      commitColumnLayoutMutation(ctx);
      break;
    case 'reset':
      ctx.resetColumns();
      break;
    case 'align-left':
      column.align = 'left';
      ctx.columns = [...ctx.columns];
      commitColumnLayoutMutation(ctx, { sync: false });
      break;
    case 'align-center':
      column.align = 'center';
      ctx.columns = [...ctx.columns];
      commitColumnLayoutMutation(ctx, { sync: false });
      break;
    case 'align-right':
      column.align = 'right';
      ctx.columns = [...ctx.columns];
      commitColumnLayoutMutation(ctx, { sync: false });
      break;
    case 'copy-column':
      ctx.copyColumnData(column);
      break;
  }
  ctx.closeContextMenu();
}
export async function copyColumnDataHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): Promise<LooseValue> {
  const [column, includeHeader] = args;
  try {
    const values = ctx.dataSignal().map((row: LooseValue) => {
      const value = ctx.getCellValue(row, column);
      return value === null || value === undefined ? '' : String(value);
    });
    // Create text with header
    const text = includeHeader ? `${column.header}\n${values.join('\n')}` : values.join('\n');
    await navigator.clipboard.writeText(text);
    ctx.showCopyFeedback(`Column "${column.header}" copied! (${values.length} rows)`);
  } catch (error) {
    reportGridError('Failed to copy column:', error);
    showGridAlert(GRID_FEEDBACK_MESSAGES.failedToCopyColumnData);
  }
}
export function getContextMenuColumnLabelHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  if (!ctx.cellContextMenuColumn) {
    return 'Cell';
  }
  return ctx.cellContextMenuColumn.header || ctx.getColumnField(ctx.cellContextMenuColumn);
}
export function getContextMenuCellValueHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  if (!ctx.cellContextMenuRow || !ctx.cellContextMenuColumn) {
    return '';
  }
  const value = ctx.getCellValue(ctx.cellContextMenuRow, ctx.cellContextMenuColumn);
  if (value instanceof HTMLElement) {
    const text = (value.textContent || value.innerText || '').trim();
    return text || 'Empty';
  }
  if (value === null || value === undefined || value === '') {
    return 'Empty';
  }
  return String(value);
}
export function hasSelectedRowsHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  return typeof ctx.selectedRowCount === 'function'
    ? ctx.selectedRowCount() > 0
    : ctx.selectedRows().length > 0;
}
export function isContextColumnNumericHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  if (!ctx.cellContextMenuColumn) {
    return false;
  }
  return ctx.isNumericColumn(ctx.cellContextMenuColumn);
}
export function isContextColumnSortedHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (!ctx.cellContextMenuColumn) {
    return false;
  }
  const field = ctx.getColumnField(ctx.cellContextMenuColumn);
  return ctx.sortStates().some((state: LooseValue) => state.field === field);
}
export function isContextColumnFilteredHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  if (!ctx.cellContextMenuColumn) {
    return false;
  }
  const field = ctx.getColumnField(ctx.cellContextMenuColumn);
  return ctx.filterStates().some((state: LooseValue) => state.field === field);
}
export function isContextColumnSortableHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  if (!ctx.cellContextMenuColumn) {
    return false;
  }
  return ctx.cellContextMenuColumn.sortable !== false;
}
export function isContextColumnFilterableHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  if (!ctx.cellContextMenuColumn) {
    return false;
  }
  return ctx.cellContextMenuColumn.filterable !== false;
}
export function getContextRowActionsHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (!ctx.cellContextMenuRow || !ctx.config.rowActions?.length) {
    return [];
  }
  return ctx.config.rowActions.filter(
    (action: LooseValue) => !action.show || action.show(ctx.cellContextMenuRow!)
  );
}
export function runContextRowActionHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [action] = args;
  if (!ctx.cellContextMenuRow) {
    return;
  }
  action.action(ctx.cellContextMenuRow);
  ctx.showCellContextMenu = false;
}
export async function copyCellValueHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): Promise<LooseValue> {
  if (!ctx.cellContextMenuRow || !ctx.cellContextMenuColumn) return;
  try {
    const value = ctx.getCellValue(ctx.cellContextMenuRow, ctx.cellContextMenuColumn);
    const text = value === null || value === undefined ? '' : String(value);
    await navigator.clipboard.writeText(text);
    ctx.showCopyFeedback('Cell value copied!');
  } catch (error) {
    reportGridError('Failed to copy cell:', error);
  } finally {
    ctx.showCellContextMenu = false;
  }
}
export async function copyRowDataHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): Promise<LooseValue> {
  if (!ctx.cellContextMenuRow) return;
  try {
    const values = ctx.visibleColumns().map((col: LooseValue) => {
      const value = ctx.getCellValue(ctx.cellContextMenuRow!, col);
      return value === null || value === undefined ? '' : String(value);
    });
    const text = values.join('\t');
    await navigator.clipboard.writeText(text);
    ctx.showCopyFeedback('Row data copied!');
  } catch (error) {
    reportGridError('Failed to copy row:', error);
  } finally {
    ctx.showCellContextMenu = false;
  }
}
export async function copyCellWithHeaderHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): Promise<LooseValue> {
  if (!ctx.cellContextMenuRow || !ctx.cellContextMenuColumn) return;
  try {
    const header =
      ctx.cellContextMenuColumn.header || ctx.getColumnField(ctx.cellContextMenuColumn);
    const value = ctx.getCellTitle(ctx.cellContextMenuRow, ctx.cellContextMenuColumn);
    const text = `${header}\t${value ?? ''}`;
    await ctx.copyMenuText(text, 'Cell with header copied!');
  } finally {
    ctx.showCellContextMenu = false;
  }
}
export function editCellFromMenuHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (!ctx.cellContextMenuRow || !ctx.cellContextMenuColumn) return;
  const indexedRow =
    ctx.cellContextMenuRow && typeof ctx.cellContextMenuRow === 'object'
      ? ctx.processedDataRowIndexLookup?.()?.get(ctx.cellContextMenuRow as object)
      : undefined;
  const rowIndex =
    indexedRow ?? ctx.processedData().findIndex((row: T) => row === ctx.cellContextMenuRow);
  if (rowIndex >= 0) {
    ctx.startEdit(rowIndex, ctx.cellContextMenuColumn);
  }
  ctx.showCellContextMenu = false;
}
function applyColumnContextFilter(
  ctx: HelperContext,
  field: string,
  operator: FilterOperator,
  value: LooseValue
): void {
  const nextFilter = buildColumnFilterState(field, operator, value);
  ctx.filterStates.update((states: LooseValue) =>
    upsertColumnFilterState(states as Parameters<typeof upsertColumnFilterState>[0], nextFilter)
  );
}
export function filterByCellValueHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (!ctx.cellContextMenuRow || !ctx.cellContextMenuColumn) return;
  const field = ctx.getColumnField(ctx.cellContextMenuColumn);
  const value = ctx.getCellValue(ctx.cellContextMenuRow, ctx.cellContextMenuColumn);
  applyColumnContextFilter(ctx, field, 'equals', value);
  ctx.emitChange('filter');
  ctx.showCellContextMenu = false;
}
export function sortByColumnHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (!ctx.cellContextMenuColumn) return;
  const field = ctx.getColumnField(ctx.cellContextMenuColumn);
  ctx.sortStates.set(buildSingleColumnSortState(field, 'asc'));
  ctx.emitChange('sort');
  ctx.showCellContextMenu = false;
}
export function showCellSubmenuHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [menu, event] = args;
  clearTimeout(ctx.cellSubmenuHideTimeout);
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const { boundsW, boundsH, originX, originY, scale } = ctx.getOverlaySpace();
  const gap = 8;
  const margin = 10;
  ctx.activeCellSubmenu = menu;
  let x = (rect.right - originX) / scale + gap;
  let y = (rect.top - originY) / scale;
  ctx.cellSubmenuPosition = { x, y };
  requestAnimationFrame(() => {
    const submenu = ctx.elementRef.nativeElement.querySelector(
      '.cell-submenu'
    ) as HTMLElement | null;
    if (!submenu) return;
    const menuRect = submenu.getBoundingClientRect();
    const menuWidth = menuRect.width / scale;
    const menuHeight = menuRect.height / scale;
    let nextX = (rect.right - originX) / scale + gap;
    let nextY = (rect.top - originY) / scale;
    if (nextY + menuHeight > boundsH - margin) {
      nextY = (rect.bottom - originY) / scale - menuHeight;
    }
    if (nextY < margin) {
      nextY = margin;
    }
    if (nextX + menuWidth > boundsW - margin) {
      nextX = (rect.left - originX) / scale - menuWidth - gap;
    }
    if (nextX < margin) {
      nextX = margin;
    }
    ctx.cellSubmenuPosition = { x: nextX, y: nextY };
    ctx.cdr.markForCheck();
  });
}
export function adjustCellContextMenuPositionHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  if (!ctx.showCellContextMenu) return;
  const menu = ctx.elementRef.nativeElement.querySelector(
    '.cell-context-menu'
  ) as HTMLElement | null;
  if (!menu) return;
  const { boundsW, boundsH, originX, originY, scale } = ctx.getOverlaySpace();
  const rect = menu.getBoundingClientRect();
  const menuWidth = rect.width / scale;
  const menuHeight = rect.height / scale;
  const anchorX = ctx.cellContextMenuAnchor?.x ?? originX + ctx.cellContextMenuPosition.x * scale;
  const anchorY = ctx.cellContextMenuAnchor?.y ?? originY + ctx.cellContextMenuPosition.y * scale;
  let x = (anchorX - originX) / scale + 2;
  let y = (anchorY - originY) / scale + 2;
  if (x + menuWidth > boundsW - 10) {
    x = (anchorX - originX) / scale - menuWidth - 8;
  }
  if (y + menuHeight > boundsH - 10) {
    y = (anchorY - originY) / scale - menuHeight - 8;
  }
  x = Math.max(10, Math.min(x, boundsW - menuWidth - 10));
  y = Math.max(10, Math.min(y, boundsH - menuHeight - 10));
  ctx.cellContextMenuPosition = { x, y };
  ctx.cdr.markForCheck();
}
export function hideCellSubmenuHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  ctx.cellSubmenuHideTimeout = setTimeout(() => {
    ctx.activeCellSubmenu = null;
  }, 150);
}
export function closeCellSubmenuHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (ctx.cellSubmenuHideTimeout) {
    clearTimeout(ctx.cellSubmenuHideTimeout);
    ctx.cellSubmenuHideTimeout = null;
  }
  if (ctx.activeCellSubmenu) {
    ctx.activeCellSubmenu = null;
    ctx.cdr.markForCheck();
  }
}
export function onCellContextMenuHoverHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [event] = args;
  if (!ctx.activeCellSubmenu) return;
  const target = event.target as HTMLElement;
  if (target.closest('[data-cell-submenu-trigger]')) {
    return;
  }
  ctx.closeCellSubmenu();
}
export function keepCellSubmenuOpenHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  clearTimeout(ctx.cellSubmenuHideTimeout);
}
export async function copyColumnFromCellHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): Promise<LooseValue> {
  if (!ctx.cellContextMenuColumn) return;
  await ctx.copyColumnData(ctx.cellContextMenuColumn);
  ctx.showCellContextMenu = false;
}
export async function copyWithHeadersHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): Promise<LooseValue> {
  if (!ctx.cellContextMenuRow) return;
  try {
    const headers = ctx.visibleColumns().map((col: LooseValue) => col.header);
    const values = ctx.visibleColumns().map((col: LooseValue) => {
      const value = ctx.getCellValue(ctx.cellContextMenuRow!, col);
      return value === null || value === undefined ? '' : String(value);
    });
    const text = headers.join('\t') + '\n' + values.join('\t');
    await navigator.clipboard.writeText(text);
    ctx.showCopyFeedback('Row with headers copied!');
  } catch (error) {
    reportGridError('Failed to copy row with headers:', error);
  } finally {
    ctx.showCellContextMenu = false;
  }
}
export async function copyRowAsJsonHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): Promise<LooseValue> {
  if (!ctx.cellContextMenuRow) return;
  try {
    const rowData: Record<string, LooseValue> = {};
    ctx.visibleColumns().forEach((col: LooseValue) => {
      const field = ctx.getColumnField(col);
      rowData[field] = ctx.getCellTitle(ctx.cellContextMenuRow!, col);
    });
    const text = JSON.stringify(rowData, null, 2);
    await ctx.copyMenuText(text, 'Row copied as JSON!');
  } catch (error) {
    reportGridError('Failed to copy row as JSON:', error);
  } finally {
    ctx.showCellContextMenu = false;
  }
}
export function filterNotEqualHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (!ctx.cellContextMenuRow || !ctx.cellContextMenuColumn) return;
  const field = ctx.getColumnField(ctx.cellContextMenuColumn);
  const value = ctx.getCellValue(ctx.cellContextMenuRow, ctx.cellContextMenuColumn);
  applyColumnContextFilter(ctx, field, 'notEquals', value);
  ctx.emitChange('filter');
  ctx.showCellContextMenu = false;
}
export function filterGreaterThanHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (!ctx.cellContextMenuRow || !ctx.cellContextMenuColumn) return;
  const field = ctx.getColumnField(ctx.cellContextMenuColumn);
  const value = ctx.getCellValue(ctx.cellContextMenuRow, ctx.cellContextMenuColumn);
  applyColumnContextFilter(ctx, field, 'greaterThan', value);
  ctx.emitChange('filter');
  ctx.showCellContextMenu = false;
}
export function filterLessThanHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (!ctx.cellContextMenuRow || !ctx.cellContextMenuColumn) return;
  const field = ctx.getColumnField(ctx.cellContextMenuColumn);
  const value = ctx.getCellValue(ctx.cellContextMenuRow, ctx.cellContextMenuColumn);
  applyColumnContextFilter(ctx, field, 'lessThan', value);
  ctx.emitChange('filter');
  ctx.showCellContextMenu = false;
}
export function filterContainsHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (!ctx.cellContextMenuRow || !ctx.cellContextMenuColumn) return;
  const field = ctx.getColumnField(ctx.cellContextMenuColumn);
  const value = ctx.getCellValue(ctx.cellContextMenuRow, ctx.cellContextMenuColumn);
  applyColumnContextFilter(ctx, field, 'contains', value);
  ctx.emitChange('filter');
  ctx.showCellContextMenu = false;
}
export function filterStartsWithHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (!ctx.cellContextMenuRow || !ctx.cellContextMenuColumn) return;
  const field = ctx.getColumnField(ctx.cellContextMenuColumn);
  const value = ctx.getCellValue(ctx.cellContextMenuRow, ctx.cellContextMenuColumn);
  applyColumnContextFilter(ctx, field, 'startsWith', value);
  ctx.emitChange('filter');
  ctx.showCellContextMenu = false;
}
export function filterEndsWithHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (!ctx.cellContextMenuRow || !ctx.cellContextMenuColumn) return;
  const field = ctx.getColumnField(ctx.cellContextMenuColumn);
  const value = ctx.getCellValue(ctx.cellContextMenuRow, ctx.cellContextMenuColumn);
  applyColumnContextFilter(ctx, field, 'endsWith', value);
  ctx.emitChange('filter');
  ctx.showCellContextMenu = false;
}
export function filterIsEmptyHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (!ctx.cellContextMenuColumn) return;
  const field = ctx.getColumnField(ctx.cellContextMenuColumn);
  applyColumnContextFilter(ctx, field, 'isEmpty', null);
  ctx.emitChange('filter');
  ctx.showCellContextMenu = false;
}
export function filterNotEmptyHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (!ctx.cellContextMenuColumn) return;
  const field = ctx.getColumnField(ctx.cellContextMenuColumn);
  applyColumnContextFilter(ctx, field, 'notEmpty', null);
  ctx.emitChange('filter');
  ctx.showCellContextMenu = false;
}
export function clearColumnFilterFromMenuHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  if (!ctx.cellContextMenuColumn) return;
  const field = ctx.getColumnField(ctx.cellContextMenuColumn);
  ctx.filterStates.update((states: LooseValue) =>
    removeColumnFilterState(states as Parameters<typeof removeColumnFilterState>[0], field)
  );
  ctx.emitChange('filter');
  ctx.showCellContextMenu = false;
}
export function sortDescendingHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (!ctx.cellContextMenuColumn) return;
  const field = ctx.getColumnField(ctx.cellContextMenuColumn);
  ctx.sortStates.set(buildSingleColumnSortState(field, 'desc'));
  ctx.emitChange('sort');
  ctx.showCellContextMenu = false;
}
export function clearSortHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  ctx.sortStates.set([]);
  ctx.emitChange('sort');
  ctx.showCellContextMenu = false;
}
export function exportRowHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (!ctx.cellContextMenuRow || !ctx.config.exportable) return;
  void ctx.exportRows([ctx.cellContextMenuRow], 'row');
}
export function exportSelectionHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (!ctx.config.exportable) return;
  const selected = ctx.selectedRows();
  if (!selected.length) {
    showGridAlert(GRID_FEEDBACK_MESSAGES.selectRowsToExport);
    return;
  }
  void ctx.exportRows(selected, 'selected');
}
export function exportVisibleHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (!ctx.config.exportable) return;
  const rows = ctx.getFilteredVisibleData();
  if (!rows.length) {
    showGridAlert(GRID_FEEDBACK_MESSAGES.noVisibleDataToExport);
    return;
  }
  void ctx.exportRows(rows, 'visible');
}
export async function exportRowsHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): Promise<LooseValue> {
  const [rows, scope] = args;
  const format = ctx.exportFormat();
  const exportMeta = ctx.buildExportMeta(scope);
  const fileName = ctx.buildExportFileName(scope);
  const options: ExportOptions = {
    format,
    fileName,
    allData: false,
    selectedOnly: scope === 'selected',
    includeHeaders: true
  };
  ctx.onExport.emit(options);
  switch (format) {
    case 'excel':
      await ctx.gridService.exportToExcel(rows, ctx.visibleColumns(), fileName, exportMeta);
      break;
    case 'csv':
      ctx.gridService.exportToCSV(rows, ctx.visibleColumns(), fileName, exportMeta);
      break;
    case 'pdf':
      await ctx.gridService.exportToPDF(rows, ctx.visibleColumns(), fileName, exportMeta);
      break;
  }
  ctx.showCellContextMenu = false;
}
export function insertRowBelowHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (!ctx.cellContextMenuRow) return;
  const nextRow = ctx.buildEmptyRow();
  ctx.assignRowKey(nextRow);
  ctx.insertRowAfter(ctx.cellContextMenuRow, nextRow, 'insert');
  ctx.emitChange('edit');
  ctx.showCellContextMenu = false;
}
export function duplicateRowHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (!ctx.cellContextMenuRow) return;
  const duplicatedRow = ctx.cloneRow(ctx.cellContextMenuRow);
  ctx.assignRowKey(duplicatedRow);
  ctx.insertRowAfter(ctx.cellContextMenuRow, duplicatedRow, 'duplicate');
  ctx.emitChange('edit');
  ctx.showCellContextMenu = false;
}
export function deleteRowFromMenuHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (!ctx.cellContextMenuRow) return;
  const row = ctx.cellContextMenuRow;
  const sourceRows = Array.isArray(ctx.dataSignal?.()) ? [...ctx.dataSignal()] : [];
  const sourceIndex = sourceRows.indexOf(row);
  const selectedBefore = Array.isArray(ctx.selectedRows?.()) ? [...ctx.selectedRows()] : [];
  const pinnedBefore = Array.isArray(ctx.pinnedRows?.()) ? [...ctx.pinnedRows()] : [];
  const bookmarkedBefore = Array.isArray(ctx.bookmarkedRows?.()) ? [...ctx.bookmarkedRows()] : [];
  const wasSelected = (ctx.selectedRowLookup?.() ?? new Set(selectedBefore)).has(row);

  ctx.removeRow(row);
  ctx.onBatchDelete.emit([row]);
  ctx.emitChange('edit');
  if (wasSelected) {
    ctx.onSelectionChange.emit(ctx.selectedRows());
    ctx.emitChange('selection');
  }
  ctx.showCellContextMenu = false;

  showGridAction(getDeletedRowsFeedbackMessage(1), {
    actionLabel: 'Undo',
    duration: 7000,
    title: 'Deleted',
    tone: 'danger',
    onAction: () => {
      const currentRows = Array.isArray(ctx.dataSignal?.()) ? [...ctx.dataSignal()] : [];
      if (!currentRows.includes(row)) {
        const restoredRows = [...currentRows];
        const insertIndex = Math.max(
          0,
          Math.min(sourceIndex >= 0 ? sourceIndex : restoredRows.length, restoredRows.length)
        );
        restoredRows.splice(insertIndex, 0, row);
        ctx.setDataInternal(restoredRows);
      }
      ctx.pinnedRows?.set?.(pinnedBefore);
      ctx.bookmarkedRows?.set?.(bookmarkedBefore);
      ctx.selectedRows.set(selectedBefore);
      ctx.emitChange('edit');
      ctx.onSelectionChange.emit(ctx.selectedRows());
      ctx.emitChange('selection');
      showGridAlert(GRID_FEEDBACK_MESSAGES.deletedRowsRestored);
    }
  });
}
export function insertRowAfterHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [referenceRow, newRow, reasonArg] = args;
  const reason = typeof reasonArg === 'string' && reasonArg.trim() ? reasonArg.trim() : 'unknown';
  const context = { reason, referenceRow: referenceRow ?? null };
  const preparedRow =
    typeof ctx.config?.prepareInsertedRow === 'function'
      ? (ctx.config.prepareInsertedRow(newRow, context) ?? newRow)
      : newRow;
  const sourceData = ctx.dataSignal();
  const data = [...sourceData];
  const indexedRow =
    referenceRow && typeof referenceRow === 'object'
      ? ctx.sourceDataRowIndexLookup?.()?.get(referenceRow as object)
      : undefined;
  const index = indexedRow ?? sourceData.findIndex((row: LooseValue) => row === referenceRow);
  const insertIndex = index >= 0 ? index + 1 : data.length;
  data.splice(insertIndex, 0, preparedRow);
  ctx.setDataInternal(data);
  if (typeof ctx.config?.onRowInserted === 'function') {
    ctx.config.onRowInserted(preparedRow, context);
  }
}
export function removeRowHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [row] = args;
  const data = ctx.dataSignal().filter((item: LooseValue) => item !== row);
  ctx.selectedRows.update((rows: LooseValue) => rows.filter((item: LooseValue) => item !== row));
  ctx.pinnedRows.update((rows: LooseValue) => rows.filter((item: LooseValue) => item !== row));
  ctx.bookmarkedRows.update((rows: LooseValue) => rows.filter((item: LooseValue) => item !== row));
  ctx.setDataInternal(data);
}
