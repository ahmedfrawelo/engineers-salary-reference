import { Directive, HostListener } from '@angular/core';

import { inject } from '@angular/core';
import { ToastService } from '@shared/toast/toast.service';
import type { ColumnMenuAction } from '../../components/menus/column-menu.component';
import { FilterOperator, FilterState, GridColumn, GridState, RowAction } from '../../models';
import {
  type GridLooseValue,
  type GroupAggregateRow,
  type GroupBlock,
  type TimeoutHandle
} from '../state';
import * as DataGridHelpers from '../runtime/data-grid.component.helper';
import { DataGridComponentPresenterColumnsBase } from './data-grid.component.presenter.columns.base';

@Directive()
export abstract class DataGridComponentPresenterOverlayBase<
  T = GridLooseValue
> extends DataGridComponentPresenterColumnsBase<T> {
  private readonly toast = inject(ToastService);

  // ===== Group Aggregates =====

  getGroupBlockAggregate(block: GroupBlock<T>, column: GridColumn<T>): string {
    return DataGridHelpers.getGroupBlockAggregateHelper(this, block, column);
  }

  getGroupAggregate(groupRow: GroupAggregateRow<T>, column: GridColumn<T>): string {
    return DataGridHelpers.getGroupAggregateHelper(this, groupRow, column);
  }

  private getGroupData(groupRow: GroupAggregateRow<T>): T[] {
    return DataGridHelpers.getGroupDataHelper(this, groupRow);
  }

  getGlobalRowIndex(row: T): number {
    return DataGridHelpers.getGlobalRowIndexHelper(this, row);
  }

  startEditFromGroup(row: T, column: GridColumn<T>): void {
    return DataGridHelpers.startEditFromGroupHelper(this, row, column);
  }

  /**
   * Returns data after filters and sorts, but before pagination.
   * Shared by grouping and aggregate calculations to avoid paginated subsets.
   */
  protected getFilteredSortedData(): T[] {
    return DataGridHelpers.getFilteredSortedDataHelper(this);
  }

  hasGroupAggregates(): boolean {
    return DataGridHelpers.hasGroupAggregatesHelper(this);
  }

  // ===== Filter Menu =====
  private handleGlobalDismiss(event: Event) {
    return DataGridHelpers.handleGlobalDismissHelper(this, event);
  }

  openFilterMenu(column: GridColumn<T>, event: MouseEvent) {
    const result = DataGridHelpers.openFilterMenuHelper(this, column, event);
    this.syncGlobalDismissListener();
    return result;
  }

  openFilterMenuFromColumnContextMenu(column: GridColumn<T>) {
    const result = DataGridHelpers.openFilterMenuFromColumnContextMenuHelper(this, column);
    this.syncGlobalDismissListener();
    return result;
  }

  private buildFilterMenuOptions(column: GridColumn<T>) {
    return DataGridHelpers.buildFilterMenuOptionsHelper(this, column);
  }

  reloadActiveFilterMenuOptions() {
    if (!this.activeFilterColumn) {
      return;
    }

    return this.buildFilterMenuOptions(this.activeFilterColumn);
  }

  closeFilterMenu() {
    const result = DataGridHelpers.closeFilterMenuHelper(this);
    this.syncGlobalDismissListener();
    return result;
  }

  applyFilterMenu(column: GridColumn<T>, selectedValues: unknown[]) {
    return DataGridHelpers.applyFilterMenuHelper(this, column, selectedValues);
  }

  applyFilterMenuSearch(column: GridColumn<T>, searchTerm: string) {
    return DataGridHelpers.applyFilterMenuSearchHelper(this, column, searchTerm);
  }

  reconcileFiltersForRowUpdate(previousRow: T | null | undefined, nextRow: T | null | undefined) {
    if (!previousRow || !nextRow) {
      return;
    }

    const matchesExactValue = (left: unknown, right: unknown): boolean => {
      if (this.getFilterOptionKey(left) === this.getFilterOptionKey(right)) {
        return true;
      }
      return (
        String(left ?? '')
          .trim()
          .toLowerCase() ===
        String(right ?? '')
          .trim()
          .toLowerCase()
      );
    };

    const canFollowScalarFilter = (operator?: FilterOperator): boolean =>
      operator === 'equals' ||
      operator === 'contains' ||
      operator === 'startsWith' ||
      operator === 'endsWith';

    let changed = false;
    const nextStates = this.filterStates()
      .map(state => {
        const field = String(state.field ?? '').trim();
        if (!field || state.operator === 'globalSearch' || state.operator === 'menuSearch') {
          return state;
        }

        const previousValue = (previousRow as GridLooseValue)?.[field];
        const updatedValue = (nextRow as GridLooseValue)?.[field];
        if (
          previousValue === updatedValue ||
          this.getFilterOptionKey(previousValue) === this.getFilterOptionKey(updatedValue)
        ) {
          return state;
        }

        if ((state.operator === 'in' || state.operator === 'notIn') && Array.isArray(state.value)) {
          const previousKey = this.getFilterOptionKey(previousValue);
          const updatedKey = this.getFilterOptionKey(updatedValue);
          if (
            !state.value.some((value: unknown) => this.getFilterOptionKey(value) === previousKey)
          ) {
            return state;
          }
          if (updatedValue === null || updatedValue === undefined || updatedValue === '') {
            const trimmed = state.value.filter(
              (value: unknown) => this.getFilterOptionKey(value) !== previousKey
            );
            if (trimmed.length === state.value.length) {
              return state;
            }
            changed = true;
            return trimmed.length ? { ...state, value: trimmed } : null;
          }

          const replaced: unknown[] = [];
          let hasUpdatedValue = false;
          state.value.forEach((value: unknown) => {
            const valueKey = this.getFilterOptionKey(value);
            if (valueKey === previousKey) {
              if (!hasUpdatedValue) {
                replaced.push(updatedValue);
                hasUpdatedValue = true;
              }
              return;
            }
            if (valueKey === updatedKey) {
              hasUpdatedValue = true;
            }
            replaced.push(value);
          });
          changed = true;
          return { ...state, value: replaced };
        }

        if (
          canFollowScalarFilter(state.operator) &&
          state.value !== null &&
          state.value !== undefined &&
          state.value !== '' &&
          updatedValue !== null &&
          updatedValue !== undefined &&
          updatedValue !== '' &&
          matchesExactValue(state.value, previousValue)
        ) {
          changed = true;
          return {
            ...state,
            value: typeof state.value === 'string' ? String(updatedValue) : updatedValue
          };
        }

        return state;
      })
      .filter((state): state is FilterState => !!state);

    if (!changed) {
      return;
    }

    this.filterStates.set(nextStates);
    this.invalidateFilteredSortedCache();
    this.paginationState.update(state => ({ ...state, currentPage: 1 }));
    if (this.activeFilterColumn) {
      this.buildFilterMenuOptions(this.activeFilterColumn);
    }
    this.emitChange('filter');
  }

  private getFilterOptionLabel(column: GridColumn<T>, value: unknown): string {
    return DataGridHelpers.getFilterOptionLabelHelper(this, column, value);
  }

  protected getFilterOptionKey(value: unknown): string {
    return DataGridHelpers.getFilterOptionKeyHelper(this, value);
  }

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    const result = DataGridHelpers.onKeyDownHelper(this, event);
    this.syncGlobalDismissListener();
    return result;
  }

  // ===== Keyboard Navigation Methods =====

  private navigateCell(direction: 'up' | 'down' | 'left' | 'right') {
    return DataGridHelpers.navigateCellHelper(this, direction);
  }

  private navigateToEdge(edge: 'start' | 'end') {
    return DataGridHelpers.navigateToEdgeHelper(this, edge);
  }

  private startEditFromKeyboard() {
    return DataGridHelpers.startEditFromKeyboardHelper(this);
  }

  private toggleRowSelectionFromKeyboard() {
    return DataGridHelpers.toggleRowSelectionFromKeyboardHelper(this);
  }

  private scrollToActiveCell() {
    return DataGridHelpers.scrollToActiveCellHelper(this);
  }

  private async copySelectedCells() {
    return await DataGridHelpers.copySelectedCellsHelper(this);
  }

  private async copyRows(rows: T[]) {
    return await DataGridHelpers.copyRowsHelper(this, rows);
  }

  private generateTextFormat(rows: T[], columns: GridColumn<T>[]): string {
    return DataGridHelpers.generateTextFormatHelper(this, rows, columns);
  }

  private generateTSVFormat(rows: T[], columns: GridColumn<T>[]): string {
    return DataGridHelpers.generateTSVFormatHelper(this, rows, columns);
  }

  private generateJSONFormat(rows: T[], columns: GridColumn<T>[]): string {
    return DataGridHelpers.generateJSONFormatHelper(this, rows, columns);
  }

  private copyFeedbackTimeout: TimeoutHandle | null = null;
  private showCopyFeedback(message: string) {
    if (this.copyFeedbackTimeout) {
      clearTimeout(this.copyFeedbackTimeout);
    }
    this.toast.info(message, 2200);
    this.copyFeedbackTimeout = setTimeout(() => {
      this.copyFeedbackTimeout = null;
    }, 2200);
  }

  onCellClick(rowIndex: number, columnIndex: number) {
    return DataGridHelpers.onCellClickHelper(this, rowIndex, columnIndex);
  }

  isActiveCell(rowIndex: number, columnIndex: number): boolean {
    return DataGridHelpers.isActiveCellHelper(this, rowIndex, columnIndex);
  }

  // ===== State Persistence =====

  saveState(): void {
    return DataGridHelpers.saveStateHelper(this);
  }

  private scheduleStateSave(delayMs = 0): void {
    return DataGridHelpers.scheduleStateSaveHelper(this, delayMs);
  }

  loadState(): void {
    return DataGridHelpers.loadStateHelper(this);
  }

  clearState(): void {
    return DataGridHelpers.clearStateHelper(this);
  }

  private buildGridState(): GridState {
    return DataGridHelpers.buildGridStateHelper(this);
  }

  private restoreState(state: GridState) {
    return DataGridHelpers.restoreStateHelper(this, state);
  }

  toggleSnapshotManager() {
    return DataGridHelpers.toggleSnapshotManagerHelper(this);
  }

  closeSnapshotManager() {
    return DataGridHelpers.closeSnapshotManagerHelper(this);
  }

  protected saveSnapshotFromUI() {
    return DataGridHelpers.saveSnapshotFromUIHelper(this);
  }

  protected applySnapshot(id: string) {
    return DataGridHelpers.applySnapshotHelper(this, id);
  }

  protected deleteSnapshot(id: string, event?: MouseEvent) {
    return DataGridHelpers.deleteSnapshotHelper(this, id, event);
  }

  private loadSnapshotsFromStorage() {
    return DataGridHelpers.loadSnapshotsFromStorageHelper(this);
  }

  private persistSnapshots() {
    return DataGridHelpers.persistSnapshotsHelper(this);
  }

  private getSnapshotStorageKey(): string | null {
    return DataGridHelpers.getSnapshotStorageKeyHelper(this);
  }

  // ===== Column Visibility Panel =====

  toggleColumnVisibilityPanel(event: MouseEvent) {
    return DataGridHelpers.toggleColumnVisibilityPanelHelper(this, event);
  }

  closeColumnVisibilityPanel() {
    return DataGridHelpers.closeColumnVisibilityPanelHelper(this);
  }

  handleColumnToggle(event: { column: GridColumn<T>; hidden: boolean }) {
    return DataGridHelpers.handleColumnToggleHelper(this, event);
  }

  // ===== UI Controls =====

  changeDensity(density: 'compact' | 'comfortable' | 'spacious'): void {
    return DataGridHelpers.changeDensityHelper(this, density);
  }

  toggleFullScreen(): void {
    return DataGridHelpers.toggleFullScreenHelper(this);
  }

  // ===== Tooltips =====

  private tooltipFollowRequestId: number | null = null;
  private tooltipFollowClient: { x: number; y: number } | null = null;

  private getTooltipAnchorFromClient(clientX: number, clientY: number): { x: number; y: number } {
    return DataGridHelpers.getTooltipAnchorFromClientHelper(this, clientX, clientY);
  }

  private getTooltipAnchor(event: MouseEvent): { x: number; y: number } {
    return DataGridHelpers.getTooltipAnchorHelper(this, event);
  }

  private scheduleTooltipFollow(clientX: number, clientY: number): void {
    return DataGridHelpers.scheduleTooltipFollowHelper(this, clientX, clientY);
  }

  showTooltip(event: MouseEvent, column: GridColumn<T>, row: T, rowIndex: number): void {
    return DataGridHelpers.showTooltipHelper(this, event, column, row, rowIndex);
  }

  hideTooltip(): void {
    return DataGridHelpers.hideTooltipHelper(this);
  }

  showHeaderTooltip(event: MouseEvent, column: GridColumn<T>): void {
    return DataGridHelpers.showHeaderTooltipHelper(this, event, column);
  }

  handleHeaderMouseEnter(event: MouseEvent, column: GridColumn<T>): void {
    return DataGridHelpers.handleHeaderMouseEnterHelper(this, event, column);
  }

  handleHeaderMouseMove(event: MouseEvent): void {
    return DataGridHelpers.handleHeaderMouseMoveHelper(this, event);
  }

  handleHeaderMouseLeave(): void {
    return DataGridHelpers.handleHeaderMouseLeaveHelper(this);
  }

  handleCellMouseEnter(event: MouseEvent, column: GridColumn<T>, row: T, rowIndex: number): void {
    return DataGridHelpers.handleCellMouseEnterHelper(this, event, column, row, rowIndex);
  }

  shouldBindCellHoverEvents(): boolean {
    return !!DataGridHelpers.shouldBindCellHoverEventsHelper(this);
  }

  shouldBindHeaderHoverState(): boolean {
    return !!DataGridHelpers.shouldBindHeaderHoverStateHelper(this);
  }

  shouldBindRowHoverState(): boolean {
    return !!DataGridHelpers.shouldBindRowHoverStateHelper(this);
  }

  handleCellMouseMove(event: MouseEvent): void {
    return DataGridHelpers.handleCellMouseMoveHelper(this, event);
  }

  handleCellMouseLeave(): void {
    return DataGridHelpers.handleCellMouseLeaveHelper(this);
  }

  private syncHoverLink(event: MouseEvent): void {
    return DataGridHelpers.syncHoverLinkHelper(this, event);
  }

  private clearHoveredLink(): void {
    return DataGridHelpers.clearHoveredLinkHelper(this);
  }

  private resolveHoverColor(linkEl: HTMLElement): string {
    return DataGridHelpers.resolveHoverColorHelper(this, linkEl);
  }

  private normalizeCssColor(raw: string, fallback: string): string {
    return DataGridHelpers.normalizeCssColorHelper(this, raw, fallback);
  }

  // ===== Context Menu =====

  openContextMenu(column: GridColumn<T>, event: MouseEvent) {
    const result = DataGridHelpers.openContextMenuHelper(this, column, event);
    this.syncGlobalDismissListener();
    return result;
  }

  openColumnMenuFromButton(column: GridColumn<T>, event: MouseEvent) {
    const result = DataGridHelpers.openColumnMenuFromButtonHelper(this, column, event);
    this.syncGlobalDismissListener();
    return result;
  }

  closeContextMenu() {
    const result = DataGridHelpers.closeContextMenuHelper(this);
    this.syncGlobalDismissListener();
    return result;
  }

  openCellContextMenu(row: T, column: GridColumn<T>, event: MouseEvent) {
    const result = DataGridHelpers.openCellContextMenuHelper(this, row, column, event);
    this.syncGlobalDismissListener();
    return result;
  }

  toggleColumnVisibility(column: GridColumn<T>) {
    return DataGridHelpers.toggleColumnVisibilityHelper(this, column);
  }

  handleContextMenuAction(action: ColumnMenuAction) {
    const result = DataGridHelpers.handleContextMenuActionHelper(this, action);
    this.syncGlobalDismissListener();
    return result;
  }

  private async copyColumnData(column: GridColumn<T>, includeHeader = true) {
    return await DataGridHelpers.copyColumnDataHelper(this, column, includeHeader);
  }

  protected getContextMenuColumnLabel(): string {
    return DataGridHelpers.getContextMenuColumnLabelHelper(this);
  }

  protected getContextMenuCellValue(): string {
    return DataGridHelpers.getContextMenuCellValueHelper(this);
  }

  protected hasSelectedRows(): boolean {
    return DataGridHelpers.hasSelectedRowsHelper(this);
  }

  protected isContextColumnNumeric(): boolean {
    return DataGridHelpers.isContextColumnNumericHelper(this);
  }

  protected isContextColumnSorted(): boolean {
    return DataGridHelpers.isContextColumnSortedHelper(this);
  }

  protected isContextColumnFiltered(): boolean {
    return DataGridHelpers.isContextColumnFilteredHelper(this);
  }

  protected isContextColumnSortable(): boolean {
    return DataGridHelpers.isContextColumnSortableHelper(this);
  }

  protected isContextColumnFilterable(): boolean {
    return DataGridHelpers.isContextColumnFilterableHelper(this);
  }

  protected getContextRowActions(): RowAction[] {
    return DataGridHelpers.getContextRowActionsHelper(this);
  }

  protected runContextRowAction(action: RowAction): void {
    return DataGridHelpers.runContextRowActionHelper(this, action);
  }

  // Cell context menu actions
  async copyCellValue() {
    return await DataGridHelpers.copyCellValueHelper(this);
  }

  async copyRowData() {
    return await DataGridHelpers.copyRowDataHelper(this);
  }

  async copyCellWithHeader() {
    return await DataGridHelpers.copyCellWithHeaderHelper(this);
  }

  editCellFromMenu() {
    return DataGridHelpers.editCellFromMenuHelper(this);
  }

  filterByCellValue() {
    return DataGridHelpers.filterByCellValueHelper(this);
  }

  sortByColumn() {
    return DataGridHelpers.sortByColumnHelper(this);
  }

  // Cell submenu management
  showCellSubmenu(menu: string, event: MouseEvent) {
    return DataGridHelpers.showCellSubmenuHelper(this, menu, event);
  }

  private adjustCellContextMenuPosition() {
    return DataGridHelpers.adjustCellContextMenuPositionHelper(this);
  }

  hideCellSubmenu() {
    return DataGridHelpers.hideCellSubmenuHelper(this);
  }

  closeCellSubmenu() {
    return DataGridHelpers.closeCellSubmenuHelper(this);
  }

  onCellContextMenuHover(event: MouseEvent) {
    return DataGridHelpers.onCellContextMenuHoverHelper(this, event);
  }

  keepCellSubmenuOpen() {
    return DataGridHelpers.keepCellSubmenuOpenHelper(this);
  }

  // Additional Copy actions
  async copyColumnFromCell() {
    return await DataGridHelpers.copyColumnFromCellHelper(this);
  }

  async copyWithHeaders() {
    return await DataGridHelpers.copyWithHeadersHelper(this);
  }

  async copyRowAsJson() {
    return await DataGridHelpers.copyRowAsJsonHelper(this);
  }

  // Additional Filter actions
  filterNotEqual() {
    return DataGridHelpers.filterNotEqualHelper(this);
  }

  filterGreaterThan() {
    return DataGridHelpers.filterGreaterThanHelper(this);
  }

  filterLessThan() {
    return DataGridHelpers.filterLessThanHelper(this);
  }

  filterContains() {
    return DataGridHelpers.filterContainsHelper(this);
  }

  filterStartsWith() {
    return DataGridHelpers.filterStartsWithHelper(this);
  }

  filterEndsWith() {
    return DataGridHelpers.filterEndsWithHelper(this);
  }

  filterIsEmpty() {
    return DataGridHelpers.filterIsEmptyHelper(this);
  }

  filterNotEmpty() {
    return DataGridHelpers.filterNotEmptyHelper(this);
  }

  clearColumnFilterFromMenu() {
    return DataGridHelpers.clearColumnFilterFromMenuHelper(this);
  }

  // Additional Sort actions
  sortDescending() {
    return DataGridHelpers.sortDescendingHelper(this);
  }

  clearSort() {
    return DataGridHelpers.clearSortHelper(this);
  }

  // Export actions
  exportRow() {
    return DataGridHelpers.exportRowHelper(this);
  }

  exportSelection() {
    return DataGridHelpers.exportSelectionHelper(this);
  }

  exportVisible() {
    return DataGridHelpers.exportVisibleHelper(this);
  }

  private async exportRows(rows: T[], scope: 'row' | 'selected' | 'visible') {
    return await DataGridHelpers.exportRowsHelper(this, rows, scope);
  }

  // Row manipulation
  insertRowBelow() {
    return DataGridHelpers.insertRowBelowHelper(this);
  }

  duplicateRow() {
    return DataGridHelpers.duplicateRowHelper(this);
  }

  deleteRowFromMenu() {
    return DataGridHelpers.deleteRowFromMenuHelper(this);
  }

  private insertRowAfter(referenceRow: T, newRow: T, reason?: string) {
    return DataGridHelpers.insertRowAfterHelper(this, referenceRow, newRow, reason);
  }

  private removeRow(row: T) {
    return DataGridHelpers.removeRowHelper(this, row);
  }

  private setDataInternal(rows: T[]) {
    return DataGridHelpers.setDataInternalHelper(this, rows);
  }

  private buildEmptyRow(): T {
    return DataGridHelpers.buildEmptyRowHelper(this);
  }

  private getDefaultCellValue(column: GridColumn<T>): unknown {
    return DataGridHelpers.getDefaultCellValueHelper(this, column);
  }

  private cloneRow(row: T): T {
    return DataGridHelpers.cloneRowHelper(this, row);
  }

  private assignRowKey(row: T) {
    return DataGridHelpers.assignRowKeyHelper(this, row);
  }

  private resetColumns() {
    return DataGridHelpers.resetColumnsHelper(this);
  }

  private getFirstEditableColumn(): GridColumn<T> | null {
    return DataGridHelpers.getFirstEditableColumnHelper(this);
  }
}
