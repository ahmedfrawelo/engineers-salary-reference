import { Directive } from '@angular/core';

import { FilterOperator, GridColumn, GridDateGroupInterval, SortDirection } from '../../models';
import { type DisplayRow, type GridLooseValue, type GroupDisplayRow } from '../state';
import * as DataGridHelpers from '../runtime/data-grid.component.helper';
import { DataGridComponentPresenterGridBase } from './data-grid.component.presenter.grid.base';

@Directive()
export abstract class DataGridComponentPresenterColumnsBase<
  T = GridLooseValue
> extends DataGridComponentPresenterGridBase<T> {
  // ===== Column Resize =====

  onColumnResizeStart(event: MouseEvent, column: GridColumn<T>) {
    return DataGridHelpers.onColumnResizeStartHelper(this, event, column);
  }

  private handleColumnResizeMove = (event: MouseEvent) => {
    if (!this.resizingColumnField) return;
    const column = this.findColumn(this.resizingColumnField);
    if (!column) return;

    const delta = event.clientX - this.resizeStartX;
    const minWidth =
      this.resizeMinWidth > 0 ? this.resizeMinWidth : this.getMinimumColumnWidth(column);
    const maxWidth =
      Number.isFinite(this.resizeMaxWidth) && this.resizeMaxWidth > 0
        ? this.resizeMaxWidth
        : this.getMaximumColumnWidth(column);
    const nextWidth = Math.min(Math.max(this.resizeStartWidth + delta, minWidth), maxWidth);

    const roundedWidth = Math.round(nextWidth);
    if (roundedWidth === Math.round(this.resizePendingWidth)) {
      return;
    }

    this.resizePendingWidth = roundedWidth;
    // Apply preview widths once per frame without forcing Angular re-render on every mousemove.
    this.queueColumnResizeApply(this.resizingColumnField, roundedWidth);
  };

  private handleColumnResizeUp = () => {
    // Cancel any pending RAF
    if (this.resizeRAF !== null) {
      cancelAnimationFrame(this.resizeRAF);
      this.resizeRAF = null;
    }

    // Restore cursor
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    if (this.resizingColumnField) {
      const finalWidth = this.resizePendingWidth || this.resizeStartWidth;
      this.applyColumnWidth(this.resizingColumnField, finalWidth, { commit: true });
    }
    this.clearColumnResizeState();
  };

  private queueColumnResizeApply(field: string, width: number) {
    return DataGridHelpers.queueColumnResizeApplyHelper(this, field, width);
  }

  private applyColumnWidth(
    field: string,
    width: number,
    options?: { sync?: boolean; save?: boolean; preview?: boolean; commit?: boolean; notify?: boolean }
  ) {
    return DataGridHelpers.applyColumnWidthHelper(this, field, width, options);
  }

  /**
   * Synchronizes rendered widths between the header and body tables so they
   * remain visually locked during resize.
   */
  private syncHeaderBodyWidths(options?: { preview?: boolean }) {
    return DataGridHelpers.syncHeaderBodyWidthsHelper(this, options);
  }

  private calculateAutoWidth(
    column: GridColumn<T>,
    options?: { mode?: 'viewport' | 'filtered' }
  ): number | null {
    return DataGridHelpers.calculateAutoWidthHelper(this, column, options);
  }

  private ensureMeasureContext(): CanvasRenderingContext2D | null {
    return DataGridHelpers.ensureMeasureContextHelper(this);
  }

  private getTableFont(): string {
    return DataGridHelpers.getTableFontHelper(this);
  }

  getColumnPixelWidth(column: GridColumn<T>): number {
    return DataGridHelpers.getColumnPixelWidthHelper(this, column);
  }

  getRenderedColumnWidth(column: GridColumn<T>): number {
    return DataGridHelpers.getRenderedColumnWidthHelper(this, column);
  }

  private getMinimumColumnWidth(column: GridColumn<T>): number {
    return DataGridHelpers.getMinimumColumnWidthHelper(this, column);
  }

  private getMaximumColumnWidth(column: GridColumn<T>): number {
    return DataGridHelpers.getMaximumColumnWidthHelper(this, column);
  }

  // Keep total width calculation centralized in the runtime helpers.
  getTotalTableWidth(): number {
    return DataGridHelpers.getTotalTableWidthHelper(this);
  }

  protected getBottomHorizontalScrollbarSpacerWidth(): number {
    return 0;
  }

  protected getBottomHorizontalScrollbarTrackWidth(): number {
    return Math.max(0, this.getTotalTableWidth());
  }

  private updateResizeGuide(clientX: number) {
    return DataGridHelpers.updateResizeGuideHelper(this, clientX);
  }

  private clearColumnResizeState() {
    return DataGridHelpers.clearColumnResizeStateHelper(this);
  }

  private detachResizeListeners() {
    return DataGridHelpers.detachResizeListenersHelper(this);
  }

  // ===== Column Drag & Grouping =====

  onHeaderDragStart(event: DragEvent, column: GridColumn<T>) {
    return DataGridHelpers.onHeaderDragStartHelper(this, event, column);
  }

  onHeaderDragOver(event: DragEvent, column: GridColumn<T>) {
    return DataGridHelpers.onHeaderDragOverHelper(this, event, column);
  }

  onHeaderDrop(event: DragEvent, column: GridColumn<T>) {
    return DataGridHelpers.onHeaderDropHelper(this, event, column);
  }

  onHeaderDragEnd() {
    return DataGridHelpers.onHeaderDragEndHelper(this);
  }

  preventHeaderBackgroundChange(event: DragEvent) {
    return DataGridHelpers.preventHeaderBackgroundChangeHelper(this, event);
  }

  private isScrollSyncing = false;
  private scrollActiveTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private markScrollbarActive(): void {
    return DataGridHelpers.markScrollbarActiveHelper(this);
  }

  onFixedHeaderScroll(event: Event) {
    return DataGridHelpers.onFixedHeaderScrollHelper(this, event);
  }

  onGridContainerScroll(event: Event) {
    return DataGridHelpers.onGridContainerScrollHelper(this, event);
  }

  onGroupPanelDragOver(event: DragEvent) {
    return DataGridHelpers.onGroupPanelDragOverHelper(this, event);
  }

  onGroupPanelDrop(event: DragEvent) {
    return DataGridHelpers.onGroupPanelDropHelper(this, event);
  }

  addGroupColumn(field: string) {
    return DataGridHelpers.addGroupColumnHelper(this, field);
  }

  removeGroupColumn(field: string) {
    return DataGridHelpers.removeGroupColumnHelper(this, field);
  }

  isColumnGrouped(field: string): boolean {
    return DataGridHelpers.isColumnGroupedHelper(this, field);
  }

  onGroupChipDragStart(event: DragEvent, field: string) {
    return DataGridHelpers.onGroupChipDragStartHelper(this, event, field);
  }

  onGroupChipDrop(event: DragEvent, targetField: string) {
    return DataGridHelpers.onGroupChipDropHelper(this, event, targetField);
  }

  onGroupChipDragEnd(event: DragEvent) {
    return DataGridHelpers.onGroupChipDragEndHelper(this, event);
  }

  autoSizeColumn(
    column: GridColumn<T>,
    event?: MouseEvent | null,
    options?: {
      automatic?: boolean;
      save?: boolean;
      sync?: boolean;
      mode?: 'viewport' | 'filtered';
    }
  ) {
    return DataGridHelpers.autoSizeColumnHelper(this, column, event, options);
  }

  onColumnResizeHandleDoubleClick(event: MouseEvent, column: GridColumn<T>) {
    return DataGridHelpers.onColumnResizeHandleDoubleClickHelper(this, event, column);
  }

  private reorderColumns(sourceField: string, targetField: string, edge?: 'before' | 'after') {
    return DataGridHelpers.reorderColumnsHelper(this, sourceField, targetField, edge);
  }

  protected onHeaderPointerDown(event: PointerEvent, column: GridColumn<T>) {
    return DataGridHelpers.onHeaderPointerDownHelper(this, event, column);
  }

  private hideColumnForGrouping(field: string) {
    return DataGridHelpers.hideColumnForGroupingHelper(this, field);
  }

  private restoreColumnVisibility(field: string) {
    return DataGridHelpers.restoreColumnVisibilityHelper(this, field);
  }

  private setColumnHidden(field: string, hidden: boolean) {
    return DataGridHelpers.setColumnHiddenHelper(this, field, hidden);
  }

  private applyPinnedOrdering() {
    return DataGridHelpers.applyPinnedOrderingHelper(this);
  }

  private setColumnPinned(field: string, pinned?: 'left' | 'right') {
    return DataGridHelpers.setColumnPinnedHelper(this, field, pinned);
  }

  private findColumn(field: string): GridColumn<T> | undefined {
    return DataGridHelpers.findColumnHelper(this, field);
  }

  private removeColumnFromView(field: string) {
    return DataGridHelpers.removeColumnFromViewHelper(this, field);
  }

  private resetGroupExpansion() {
    return DataGridHelpers.resetGroupExpansionHelper(this);
  }

  toggleGroup(row: GroupDisplayRow<T>) {
    return DataGridHelpers.toggleGroupHelper(this, row);
  }

  isGroupExpandedById(id: string): boolean {
    return DataGridHelpers.isGroupExpandedByIdHelper(this, id);
  }

  toggleGroupById(id: string): void {
    return DataGridHelpers.toggleGroupByIdHelper(this, id);
  }

  // ===== Expand/Collapse All Groups =====

  expandAllGroups() {
    return DataGridHelpers.expandAllGroupsHelper(this);
  }

  collapseAllGroups() {
    return DataGridHelpers.collapseAllGroupsHelper(this);
  }

  expandGroupsAtLevel(level: number) {
    return DataGridHelpers.expandGroupsAtLevelHelper(this, level);
  }

  collapseGroupsAtLevel(level: number) {
    return DataGridHelpers.collapseGroupsAtLevelHelper(this, level);
  }

  clearAllGrouping() {
    return DataGridHelpers.clearAllGroupingHelper(this);
  }

  private groupMenuCloseHandler: (() => void) | null = null;

  onGroupPanelContextMenu(event: MouseEvent) {
    const result = DataGridHelpers.onGroupPanelContextMenuHelper(this, event);
    this.syncGlobalDismissListener();
    return result;
  }

  closeGroupContextMenu() {
    const result = DataGridHelpers.closeGroupContextMenuHelper(this);
    this.syncGlobalDismissListener();
    return result;
  }

  closeEmptyGroupMenu() {
    const result = DataGridHelpers.closeEmptyGroupMenuHelper(this);
    this.syncGlobalDismissListener();
    return result;
  }

  reverseGroupOrder() {
    return DataGridHelpers.reverseGroupOrderHelper(this);
  }

  // Empty Group Menu Actions
  toggleColumnSelectionSubmenu() {
    return DataGridHelpers.toggleColumnSelectionSubmenuHelper(this);
  }

  groupByColumnFromSubmenu(column: GridColumn<T>) {
    return DataGridHelpers.groupByColumnFromSubmenuHelper(this, column);
  }

  showGroupingHelp() {
    return DataGridHelpers.showGroupingHelpHelper(this);
  }

  private getOverlayBounds() {
    return DataGridHelpers.getOverlayBoundsHelper(this);
  }

  private getOverlaySpace() {
    return DataGridHelpers.getOverlaySpaceHelper(this);
  }

  private getFixedContainingBlock(startNode: HTMLElement | null) {
    return DataGridHelpers.getFixedContainingBlockHelper(this, startNode);
  }

  private getOverlayScale(reference?: HTMLElement | null): number {
    return DataGridHelpers.getOverlayScaleHelper(this, reference);
  }

  private isFixedContainingBlockStyle(style: CSSStyleDeclaration) {
    return DataGridHelpers.isFixedContainingBlockStyleHelper(this, style);
  }

  private closeAllMenus() {
    const result = DataGridHelpers.closeAllMenusHelper(this);
    this.syncGlobalDismissListener();
    return result;
  }

  // ===== Column Context Menu =====

  onColumnHeaderContextMenu(event: MouseEvent, column: GridColumn<T>) {
    const result = DataGridHelpers.onColumnHeaderContextMenuHelper(this, event, column);
    this.syncGlobalDismissListener();
    return result;
  }

  closeColumnContextMenu() {
    const result = DataGridHelpers.closeColumnContextMenuHelper(this);
    this.syncGlobalDismissListener();
    return result;
  }

  showSubmenu(
    type:
      | 'sort'
      | 'pin'
      | 'align'
      | 'aggregate'
      | 'visibility'
      | 'filter'
      | 'more'
      | 'choose'
      | 'copy'
      | 'stats'
      | 'type',
    event?: MouseEvent
  ) {
    return DataGridHelpers.showSubmenuHelper(this, type, event);
  }

  hideSubmenu(
    type:
      | 'sort'
      | 'pin'
      | 'align'
      | 'aggregate'
      | 'visibility'
      | 'filter'
      | 'more'
      | 'choose'
      | 'copy'
      | 'stats'
      | 'type'
  ) {
    return DataGridHelpers.hideSubmenuHelper(this, type);
  }

  private scheduleColumnSubmenuPosition(
    type:
      | 'sort'
      | 'pin'
      | 'align'
      | 'aggregate'
      | 'visibility'
      | 'filter'
      | 'more'
      | 'choose'
      | 'copy'
      | 'stats'
      | 'type'
  ) {
    return DataGridHelpers.scheduleColumnSubmenuPositionHelper(this, type);
  }

  private getColumnSubmenuMetrics(
    type:
      | 'sort'
      | 'pin'
      | 'align'
      | 'aggregate'
      | 'visibility'
      | 'filter'
      | 'more'
      | 'choose'
      | 'copy'
      | 'stats'
  ) {
    return DataGridHelpers.getColumnSubmenuMetricsHelper(this, type);
  }

  private updateColumnSubmenuPosition(
    type:
      | 'sort'
      | 'pin'
      | 'align'
      | 'aggregate'
      | 'visibility'
      | 'filter'
      | 'more'
      | 'choose'
      | 'copy'
      | 'stats'
      | 'type',
    size?: { width: number; height: number }
  ) {
    return DataGridHelpers.updateColumnSubmenuPositionHelper(this, type, size);
  }

  groupByColumn(column: GridColumn<T>) {
    return DataGridHelpers.groupByColumnHelper(this, column);
  }

  applyGroupingState(
    column: GridColumn<T> | null,
    direction: 'asc' | 'desc' = 'asc',
    dateInterval?: GridDateGroupInterval | null
  ) {
    return DataGridHelpers.applyGroupingStateHelper(this, column, direction, dateInterval);
  }

  setGroupDateInterval(field: string, interval: GridDateGroupInterval | null) {
    return DataGridHelpers.setGroupDateIntervalHelper(this, field, interval);
  }

  isMenuColumnSortable(): boolean {
    return DataGridHelpers.isMenuColumnSortableHelper(this);
  }

  isMenuColumnFilterable(): boolean {
    return DataGridHelpers.isMenuColumnFilterableHelper(this);
  }

  sortColumnAsc(column: GridColumn<T>) {
    return DataGridHelpers.sortColumnAscHelper(this, column);
  }

  sortColumnDesc(column: GridColumn<T>) {
    return DataGridHelpers.sortColumnDescHelper(this, column);
  }

  private setExplicitSort(column: GridColumn<T>, direction: SortDirection) {
    return DataGridHelpers.setExplicitSortHelper(this, column, direction);
  }

  hideColumn(column: GridColumn<T>) {
    return DataGridHelpers.hideColumnHelper(this, column);
  }

  clearSortForColumn(column: GridColumn<T>) {
    return DataGridHelpers.clearSortForColumnHelper(this, column);
  }

  clearColumnFilter(column: GridColumn<T>) {
    return DataGridHelpers.clearColumnFilterHelper(this, column);
  }

  autoSizeAllColumnsFromMenu() {
    return DataGridHelpers.autoSizeAllColumnsFromMenuHelper(this);
  }

  /**
   * Auto-sizes all visible columns based on their content.
   * Internal method that doesn't close menus or handle events.
   */
  private autoSizeAllColumnsInternal() {
    return DataGridHelpers.autoSizeAllColumnsInternalHelper(this);
  }

  showAllColumnsFromMenu() {
    return DataGridHelpers.showAllColumnsFromMenuHelper(this);
  }

  hideAllColumnsFromMenu() {
    return DataGridHelpers.hideAllColumnsFromMenuHelper(this);
  }

  copyColumnValuesFromMenu(column: GridColumn<T>, includeHeader: boolean) {
    return DataGridHelpers.copyColumnValuesFromMenuHelper(this, column, includeHeader);
  }

  insertColumnLeft(column: GridColumn<T>) {
    const result = DataGridHelpers.insertColumnRelativeHelper(this, column, 'left');
    this.closeColumnContextMenu();
    return result;
  }

  insertColumnRight(column: GridColumn<T>) {
    const result = DataGridHelpers.insertColumnRelativeHelper(this, column, 'right');
    this.closeColumnContextMenu();
    return result;
  }

  renameColumnFromMenu(column: GridColumn<T>) {
    return DataGridHelpers.renameColumnFromMenuHelper(this, column);
  }

  deleteColumn(column: GridColumn<T>) {
    return DataGridHelpers.deleteColumnHelper(this, column);
  }

  moveColumnLeft(column: GridColumn<T>) {
    return DataGridHelpers.moveColumnLeftHelper(this, column);
  }

  moveColumnRight(column: GridColumn<T>) {
    return DataGridHelpers.moveColumnRightHelper(this, column);
  }

  showOnlyColumn(column: GridColumn<T>) {
    return DataGridHelpers.showOnlyColumnHelper(this, column);
  }

  isColumnWidthLocked(column: GridColumn<T>): boolean {
    return DataGridHelpers.isColumnWidthLockedHelper(this, column);
  }

  lockColumnWidth(column: GridColumn<T>) {
    return DataGridHelpers.lockColumnWidthHelper(this, column);
  }

  unlockColumnWidth(column: GridColumn<T>) {
    return DataGridHelpers.unlockColumnWidthHelper(this, column);
  }

  isWrapEnabled(column: GridColumn<T>): boolean {
    return DataGridHelpers.isWrapEnabledHelper(this, column);
  }

  enableWrap(column: GridColumn<T>) {
    return DataGridHelpers.enableWrapHelper(this, column);
  }

  disableWrap(column: GridColumn<T>) {
    return DataGridHelpers.disableWrapHelper(this, column);
  }

  private setColumnWrap(column: GridColumn<T>, enabled: boolean) {
    return DataGridHelpers.setColumnWrapHelper(this, column, enabled);
  }

  isDuplicateHighlightEnabled(column: GridColumn<T>): boolean {
    return DataGridHelpers.isDuplicateHighlightEnabledHelper(this, column);
  }

  toggleDuplicateHighlight(column: GridColumn<T>) {
    return DataGridHelpers.toggleDuplicateHighlightHelper(this, column);
  }

  getColumnDataType(column: GridColumn<T>) {
    return DataGridHelpers.getColumnDataTypeHelper(this, column);
  }

  setColumnDataType(column: GridColumn<T>, type: 'text' | 'number' | 'date' | 'dropdown') {
    return DataGridHelpers.setColumnDataTypeHelper(this, column, type);
  }

  saveColumnDropdownOptions(column: GridColumn<T>) {
    return DataGridHelpers.saveColumnDropdownOptionsHelper(this, column);
  }

  applyIsEmptyFilter(column: GridColumn<T>) {
    return DataGridHelpers.applyIsEmptyFilterHelper(this, column);
  }

  applyNotEmptyFilter(column: GridColumn<T>) {
    return DataGridHelpers.applyNotEmptyFilterHelper(this, column);
  }

  applyTopBottomFilter(column: GridColumn<T>, direction: 'top' | 'bottom') {
    return DataGridHelpers.applyTopBottomFilterHelper(this, column, direction);
  }

  private applyColumnFilterState(field: string, operator: FilterOperator, value: unknown) {
    return DataGridHelpers.applyColumnFilterStateHelper(this, field, operator, value);
  }

  private getFilteredDataExcludingField(field: string): T[] {
    return DataGridHelpers.getFilteredDataExcludingFieldHelper(this, field);
  }

  async copyColumnNameFromMenu(column: GridColumn<T>) {
    return await DataGridHelpers.copyColumnNameFromMenuHelper(this, column);
  }

  async copyColumnFieldFromMenu(column: GridColumn<T>) {
    return await DataGridHelpers.copyColumnFieldFromMenuHelper(this, column);
  }

  private async copyMenuText(text: string, message: string) {
    return await DataGridHelpers.copyMenuTextHelper(this, text, message);
  }

  setColumnAggregate(column: GridColumn<T>, aggregate: GridColumn<T>['aggregate'] | null) {
    return DataGridHelpers.setColumnAggregateHelper(this, column, aggregate);
  }

  private enableAggregateDisplays(): void {
    return DataGridHelpers.enableAggregateDisplaysHelper(this);
  }

  private shouldAutoShowAggregates(): boolean {
    return DataGridHelpers.shouldAutoShowAggregatesHelper(this);
  }

  protected syncAggregateDisplayState(): void {
    return DataGridHelpers.syncAggregateDisplayStateHelper(this);
  }

  applyAggregateToAllNumericColumnsFromMenu(): void {
    return DataGridHelpers.applyAggregateToAllNumericColumnsFromMenuHelper(this);
  }

  clearAllColumnAggregatesFromMenu(): void {
    return DataGridHelpers.clearAllColumnAggregatesFromMenuHelper(this);
  }

  toggleGroupFooterAggregatesFromMenu(): void {
    return DataGridHelpers.toggleGroupFooterAggregatesFromMenuHelper(this);
  }

  toggleGroupHeaderAggregatesFromMenu(): void {
    return DataGridHelpers.toggleGroupHeaderAggregatesFromMenuHelper(this);
  }

  toggleGrandTotalAggregatesFromMenu(): void {
    return DataGridHelpers.toggleGrandTotalAggregatesFromMenuHelper(this);
  }

  getColumnStatsSummary(column: GridColumn<T>): {
    total: number;
    nonEmpty: number;
    empty: number;
    unique: number;
    min: number | null;
    max: number | null;
    avg: number | null;
    isNumeric: boolean;
  } {
    return DataGridHelpers.getColumnStatsSummaryHelper(this, column);
  }

  formatStatValue(value: number | null, decimals = 0): string {
    return DataGridHelpers.formatStatValueHelper(this, value, decimals);
  }

  toggleColumnVisibilityFromMenu(column: GridColumn<T>) {
    return DataGridHelpers.toggleColumnVisibilityFromMenuHelper(this, column);
  }

  resetColumnFromMenu(column: GridColumn<T>) {
    return DataGridHelpers.resetColumnFromMenuHelper(this, column);
  }

  setColumnAlignment(column: GridColumn<T>, align: 'left' | 'center' | 'right') {
    return DataGridHelpers.setColumnAlignmentHelper(this, column, align);
  }

  autoSizeColumnFromMenu(column: GridColumn<T>) {
    return DataGridHelpers.autoSizeColumnFromMenuHelper(this, column);
  }

  pinColumnLeft(column: GridColumn<T>) {
    return DataGridHelpers.pinColumnLeftHelper(this, column);
  }

  pinColumnRight(column: GridColumn<T>) {
    return DataGridHelpers.pinColumnRightHelper(this, column);
  }

  unpinColumn(column: GridColumn<T>) {
    return DataGridHelpers.unpinColumnHelper(this, column);
  }

  private getAllGroupIds(rows: DisplayRow<T>[]): string[] {
    return DataGridHelpers.getAllGroupIdsHelper(this, rows);
  }

  private getGroupIdsByLevel(level: number): string[] {
    return DataGridHelpers.getGroupIdsByLevelHelper(this, level);
  }

  hasAnyExpandedGroups(): boolean {
    return DataGridHelpers.hasAnyExpandedGroupsHelper(this);
  }
}
