import {
  AfterViewInit,
  computed,
  Directive,
  HostListener,
  OnChanges,
  OnDestroy,
  OnInit,
  signal,
  SimpleChanges
} from '@angular/core';
import type { SafeHtml } from '@angular/platform-browser';
import {
  FilterState,
  GridChangeEvent,
  GridColumn,
  GridSelectionBulkEditRequest,
  RowAction,
  SortDirection
} from '../../models';
import { GRID_FEEDBACK_MESSAGES, showGridAlert } from '../../utils/feedback';
import type {
  GridAggregateFooterChangeEvent,
  GridAggregateFooterConfig,
  GridAggregateFooterResult,
  GridAggregateOperation,
  GridAggregateScope
} from '../../models';
import {
  type DataDisplayRow,
  type DisplayRow,
  type GridLooseValue,
  type GridRowRecord,
  type GroupBlock,
  type GroupDisplayRow
} from '../state';
import * as DataGridHelpers from '../runtime/data-grid.component.helper';
import { DataGridComponentPresenterIntelligenceBase } from './data-grid.component.presenter.intelligence.base';

@Directive()
export abstract class DataGridComponentPresenterGridBase<T = GridLooseValue>
  extends DataGridComponentPresenterIntelligenceBase<T>
  implements OnInit, OnChanges, OnDestroy, AfterViewInit
{
  private readonly internalAggregateFooterScope = signal<GridAggregateScope>('filtered');
  private readonly internalAggregateFooterConfig = computed<GridAggregateFooterConfig<T>>(() => ({
    enabled: true,
    scope: this.internalAggregateFooterScope(),
    results: this.buildInternalAggregateFooterResults(this.internalAggregateFooterScope()),
    loading: this.loading,
    loadingPrimaryText: '...',
    formatValue: (column, result) => this.formatInternalAggregateFooterValue(column, result),
    supportsOperation: (column, operation) =>
      this.supportsInternalAggregateFooterOperation(column, operation)
  }));

  ngAfterViewInit(): void {
    return DataGridHelpers.ngAfterViewInitHelper(this);
  }

  ngOnDestroy(): void {
    return DataGridHelpers.ngOnDestroyHelper(this);
  }

  ngOnInit(): void {
    return DataGridHelpers.ngOnInitHelper(this);
  }

  ngOnChanges(changes: SimpleChanges): void {
    return DataGridHelpers.ngOnChangesHelper(this, changes);
  }

  private captureInitialColumns(columns: GridColumn<T>[]) {
    return DataGridHelpers.captureInitialColumnsHelper(this, columns);
  }

  // ===== Sorting =====

  onSort(column: GridColumn<T>, event: MouseEvent): void {
    return DataGridHelpers.onSortHelper(this, column, event);
  }

  getSortDirection(column: GridColumn<T>): SortDirection {
    return DataGridHelpers.getSortDirectionHelper(this, column);
  }

  getSortOrder(column: GridColumn<T>): number | null {
    return DataGridHelpers.getSortOrderHelper(this, column);
  }

  // ===== Filtering =====

  onFilter(column: GridColumn<T>, value: unknown): void {
    return DataGridHelpers.onFilterHelper(this, column, value);
  }

  getFilterValue(column: GridColumn<T>): unknown {
    return DataGridHelpers.getFilterValueHelper(this, column);
  }

  clearFilters(): void {
    return DataGridHelpers.clearFiltersHelper(this);
  }

  applyExternalFilters(filters: FilterState[]): void {
    return DataGridHelpers.applyExternalFiltersHelper(this, filters);
  }

  hasActiveFilter(field: string | number | symbol | GridColumn<T>): boolean {
    return DataGridHelpers.hasActiveFilterHelper(this, field);
  }

  onGlobalSearch(searchTerm: string): void {
    return DataGridHelpers.onGlobalSearchHelper(this, searchTerm);
  }

  // ===== Pagination =====

  protected updatePaginationState(totalRecords: number): void {
    return DataGridHelpers.updatePaginationStateHelper(this, totalRecords);
  }

  onPageChange(page: number): void {
    return DataGridHelpers.onPageChangeHelper(this, page);
  }

  getStartRecordIndex(): number {
    return DataGridHelpers.getStartRecordIndexHelper(this);
  }

  getEndRecordIndex(): number {
    return DataGridHelpers.getEndRecordIndexHelper(this);
  }

  // ===== Selection =====

  toggleSelectAll(): void {
    return DataGridHelpers.toggleSelectAllHelper(this);
  }

  toggleRowSelection(row: T, event?: MouseEvent, rowIndex?: number | null): void {
    return DataGridHelpers.toggleRowSelectionHelper(this, row, event, rowIndex);
  }

  isRowSelected(row: T): boolean {
    return DataGridHelpers.isRowSelectedHelper(this, row);
  }

  getRowSelectionNumber(row: T, rowIndex?: number | null): number | null {
    return DataGridHelpers.getRowSelectionNumberHelper(this, row, rowIndex) as number | null;
  }

  protected toggleGroupSelection(group: GroupBlock<T> | GroupDisplayRow<T>, event?: Event): void {
    return DataGridHelpers.toggleGroupSelectionHelper(this, group, event);
  }

  protected isGroupSelected(group: GroupBlock<T> | GroupDisplayRow<T>): boolean {
    return DataGridHelpers.isGroupSelectedHelper(this, group);
  }

  protected isGroupPartiallySelected(group: GroupBlock<T> | GroupDisplayRow<T>): boolean {
    return DataGridHelpers.isGroupPartiallySelectedHelper(this, group);
  }

  protected getGroupSelectionViewState(group: GroupBlock<T> | GroupDisplayRow<T>): {
    checked: boolean;
    partial: boolean;
    title: string;
  } {
    return DataGridHelpers.getGroupSelectionViewStateHelper(this, group) as {
      checked: boolean;
      partial: boolean;
      title: string;
    };
  }

  protected getGroupSelectionSummary(group: GroupBlock<T> | GroupDisplayRow<T>): string {
    return DataGridHelpers.getGroupSelectionSummaryHelper(this, group);
  }

  async copySelectionInsights(): Promise<void> {
    return await DataGridHelpers.copySelectionInsightsHelper(this);
  }

  async copySelectionToClipboard(): Promise<void> {
    return await DataGridHelpers.copySelectedCellsHelper(this);
  }

  async copySelectionAsJson(): Promise<void> {
    return await DataGridHelpers.copySelectedRowsAsJsonHelper(this);
  }

  bookmarkSelection(): void {
    return DataGridHelpers.bookmarkSelectedRowsHelper(this);
  }

  toggleQualityPanelFromSelectionBar(): void {
    return DataGridHelpers.toggleQualityPanelHelper(this);
  }

  toggleAuditTrailFromSelectionBar(): void {
    return DataGridHelpers.toggleAuditTrailHelper(this);
  }

  toggleHeadlinePanelFromSelectionBar(): void {
    return DataGridHelpers.toggleHeadlinePanelHelper(this);
  }

  toggleColorScaleFromSelectionBar(): void {
    return DataGridHelpers.toggleColorScaleHelper(this);
  }

  toggleAnomalyAlertsFromSelectionBar(): void {
    return DataGridHelpers.toggleAnomalyAlertsHelper(this);
  }

  toggleHighContrastFromSelectionBar(): void {
    return DataGridHelpers.toggleHighContrastHelper(this);
  }

  toggleForecastSparklinesFromSelectionBar(): void {
    return DataGridHelpers.toggleForecastSparklinesHelper(this);
  }

  generateShareableLinkFromSelectionBar(): void {
    return DataGridHelpers.generateShareableLinkHelper(this);
  }

  toggleSnapshotManagerFromSelectionBar(): void {
    return DataGridHelpers.toggleSnapshotManagerHelper(this);
  }

  applySelectionBarBulkEdit(request: GridSelectionBulkEditRequest): void {
    const column = this.visibleColumns().find(
      candidate => this.getColumnField(candidate) === request.field
    );
    if (!column) {
      return;
    }

    const changedCount = this.batchEditField(request.field, request.value);
    if (!changedCount) {
      this.showAutoSave('No changes needed');
      return;
    }

    this.showAutoSave(`${changedCount} row${changedCount === 1 ? '' : 's'} updated`);
    this.logAuditEvent('edit', `Selection updated for ${column.header}`);
  }

  hasSelectionUndo(): boolean {
    const snapshot = this.selectionUndoSnapshot();
    return Array.isArray(snapshot) && !!this.selectionUndoLabel().trim();
  }

  getSelectionUndoLabel(): string {
    return this.selectionUndoLabel();
  }

  undoSelectionBarChange(): void {
    return DataGridHelpers.undoSelectionChangeHelper(this);
  }

  clearSelectionBarUndo(): void {
    return DataGridHelpers.clearSelectionUndoHelper(this);
  }

  // ===== Editing =====

  startEdit(rowIndex: number, column: GridColumn<T>): void {
    return DataGridHelpers.startEditHelper(this, rowIndex, column);
  }

  cancelEdit(): void {
    return DataGridHelpers.cancelEditHelper(this);
  }

  saveEdit(row: T, column: GridColumn<T>, value: unknown): void {
    return DataGridHelpers.saveEditHelper(this, row, column, value);
  }

  isEditing(rowIndex: number, column: GridColumn<T>): boolean {
    return DataGridHelpers.isEditingHelper(this, rowIndex, column);
  }

  // ===== Batch Operations =====

  batchDeleteSelected(): void {
    return DataGridHelpers.batchDeleteSelectedHelper(this);
  }

  batchExportSelected(format: 'excel' | 'csv' | 'pdf'): void {
    return DataGridHelpers.batchExportSelectedHelper(this, format);
  }

  batchEditField(field: string, value: unknown): number {
    return Number(DataGridHelpers.batchEditFieldHelper(this, field, value) ?? 0);
  }

  shouldShowSelectionBarEditAction(): boolean {
    if (typeof this.selectionBarShowEditAction === 'boolean') {
      return this.selectionBarShowEditAction;
    }
    return !!(this.config.selectable ?? true);
  }

  shouldShowSelectionBarDeleteAction(): boolean {
    if (typeof this.selectionBarShowDeleteAction === 'boolean') {
      return this.selectionBarShowDeleteAction;
    }
    return !!(this.config.selectable ?? true);
  }

  requestSelectionBarEditAction(): void {
    const selected = this.selectedRows();
    if (!selected.length) {
      return;
    }
    if (this.selectionBarEditRequested.observers.length > 0) {
      this.selectionBarEditRequested.emit([...selected]);
      return;
    }

    const rowAction = this.resolveSelectionBarRowAction('edit');
    if (rowAction) {
      rowAction.action(selected[0] as GridLooseValue);
      return;
    }

    if (this.selectionActionBar?.openBulkEditEditor()) {
      return;
    }

    showGridAlert(GRID_FEEDBACK_MESSAGES.selectionEditUnavailable, { tone: 'warning' });
  }

  requestSelectionBarDeleteAction(): void {
    const selected = this.selectedRows();
    if (!selected.length) {
      return;
    }
    if (this.selectionBarDeleteRequested.observers.length > 0) {
      this.selectionBarDeleteRequested.emit([...selected]);
      return;
    }
    const rowAction = this.resolveSelectionBarRowAction('delete');
    if (rowAction) {
      rowAction.action(selected[0] as GridLooseValue);
      return;
    }
    if (this.config.remoteData && this.onBatchDelete.observers.length === 0) {
      showGridAlert(GRID_FEEDBACK_MESSAGES.selectionDeleteUnavailable, { tone: 'warning' });
      return;
    }
    this.batchDeleteSelected();
  }

  private resolveSelectionBarRowAction(kind: 'edit' | 'delete'): RowAction | null {
    const selected = this.selectedRows();
    if (selected.length !== 1 || !this.config.rowActions?.length) {
      return null;
    }

    const row = selected[0] as GridLooseValue;
    return (
      this.config.rowActions.find(action => {
        if (!this.matchesSelectionBarRowAction(action, kind)) {
          return false;
        }
        try {
          return !action.show || action.show(row);
        } catch {
          return false;
        }
      }) ?? null
    );
  }

  private matchesSelectionBarRowAction(action: RowAction, kind: 'edit' | 'delete'): boolean {
    const haystack = `${action.label ?? ''} ${action.icon ?? ''}`.toLowerCase();
    const terms = kind === 'edit' ? ['edit', 'update', 'pencil'] : ['delete', 'remove', 'trash'];
    return terms.some(term => haystack.includes(term));
  }

  clearSelection(): void {
    return DataGridHelpers.clearSelectionHelper(this);
  }

  replaceSelection(rows: T[], options?: { emitChange?: boolean; preserveUndo?: boolean }): void {
    return DataGridHelpers.replaceSelectionHelper(this, rows, options);
  }

  selectAll(): void {
    return DataGridHelpers.selectAllHelper(this);
  }

  invertSelection(): void {
    return DataGridHelpers.invertVisibleSelectionHelper(this);
  }

  // ===== Events =====

  onRowClickHandler(row: T): void {
    return DataGridHelpers.onRowClickHandlerHelper(this, row);
  }

  onRowDoubleClickHandler(row: T): void {
    return DataGridHelpers.onRowDoubleClickHandlerHelper(this, row);
  }

  onDisplayRowClick(row: DisplayRow<T>): void {
    return DataGridHelpers.onDisplayRowClickHelper(this, row);
  }

  onDisplayRowDoubleClick(row: DisplayRow<T>): void {
    return DataGridHelpers.onDisplayRowDoubleClickHelper(this, row);
  }

  private getEventTargetElement(event: Event): Element | null {
    return DataGridHelpers.getEventTargetElementHelper(this, event);
  }

  handleCellClick(row: T, column: GridColumn<T>, event: MouseEvent): void {
    return DataGridHelpers.handleCellClickHelper(this, row, column, event);
  }

  handleCellDoubleClick(
    row: T,
    column: GridColumn<T>,
    event: MouseEvent,
    useGroupedEditing = false
  ): void {
    return DataGridHelpers.handleCellDoubleClickHelper(
      this,
      row,
      column,
      event,
      useGroupedEditing
    );
  }
  /**
   * Global click delegation for data-grid-link elements rendered via innerHTML.
   * Ensures cell actions fire even if the TD click handler does not capture the event.
   */
  @HostListener('click', ['$event'])
  handleDataGridLinkDelegation(event: MouseEvent): void {
    return DataGridHelpers.handleDataGridLinkDelegationHelper(this, event);
  }

  private findRowByKey(
    key: string,
    fallbackText: string,
    rowId?: string,
    connId?: string
  ): T | null {
    return DataGridHelpers.findRowByKeyHelper(this, key, fallbackText, rowId, connId);
  }

  private findRowByTextOnly(text: string): T | null {
    return DataGridHelpers.findRowByTextOnlyHelper(this, text);
  }

  private findColumnForKind(kind: string): GridColumn<T> | null {
    return DataGridHelpers.findColumnForKindHelper(this, kind);
  }

  protected emitChange(type: GridChangeEvent['type']): void {
    return DataGridHelpers.emitChangeHelper(this, type);
  }

  private asRecord(value: unknown): GridRowRecord | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    return value as GridRowRecord;
  }

  private readonly rowObjectIdentity = new WeakMap<object, number>();
  private readonly resolvedRowIdentity = new WeakMap<object, string | number>();
  private nextRowObjectIdentity = 0;

  private getStableObjectIdentity(value: object): number {
    const existing = this.rowObjectIdentity.get(value);
    if (existing !== undefined) {
      return existing;
    }
    this.nextRowObjectIdentity += 1;
    this.rowObjectIdentity.set(value, this.nextRowObjectIdentity);
    return this.nextRowObjectIdentity;
  }

  protected getRowFieldValue(row: T, field: string): unknown {
    return this.asRecord(row)?.[field];
  }

  private resolveRowIdentity(row: unknown): string | number | undefined {
    const record = this.asRecord(row);
    if (!record) {
      return undefined;
    }

    const cached = this.resolvedRowIdentity.get(record);
    if (cached !== undefined) {
      return cached;
    }

    const objectId = this.getStableObjectIdentity(record);

    const keys = ['__gridRowKey', 'id', 'connectionId', 'key', 'rowKey'] as const;
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' || typeof value === 'number') {
        if (this.config.trackRowsByBusinessId) {
          const identity = `${key}:${value}`;
          this.resolvedRowIdentity.set(record, identity);
          return identity;
        }
        // Include object identity to prevent duplicate trackBy keys when business IDs repeat.
        const identity = `${key}:${value}#${objectId}`;
        this.resolvedRowIdentity.set(record, identity);
        return identity;
      }
    }

    const identity = `row:${objectId}`;
    this.resolvedRowIdentity.set(record, identity);
    return identity;
  }

  // ===== Utilities =====

  getCellValue(row: T, column: GridColumn<T>): unknown {
    return DataGridHelpers.getCellValueHelper(this, row, column);
  }

  getCellRawValue(row: T, column: GridColumn<T>): unknown {
    return DataGridHelpers.getCellRawValueHelper(this, row, column);
  }

  /**
   * Compute a plain-text value for the native title attribute.
   * This strips HTML returned by renderAsHtml renderers and handles HTMLElements.
   */
  getCellTitle(row: T, column: GridColumn<T>): string {
    return DataGridHelpers.getCellTitleHelper(this, row, column);
  }

  private stripHtml(html: string): string {
    return DataGridHelpers.stripHtmlHelper(this, html);
  }

  private normalizeDisplayValue(
    value: unknown,
    column?: GridColumn<T>
  ): string | number | boolean | object {
    return DataGridHelpers.normalizeDisplayValueHelper(this, value, column);
  }

  getCellHtml(row: T, column: GridColumn<T>): SafeHtml {
    return DataGridHelpers.getCellHtmlHelper(this, row, column);
  }

  // Highlight search term in cell value
  getCellValueWithHighlight(row: T, column: GridColumn<T>): string | SafeHtml | HTMLElement {
    return DataGridHelpers.getCellValueWithHighlightHelper(this, row, column);
  }

  private escapeRegExp(text: string): string {
    return DataGridHelpers.escapeRegExpHelper(this, text);
  }

  hasSearchHighlight(): boolean {
    return DataGridHelpers.hasSearchHighlightHelper(this);
  }

  // Check if column is being dragged
  isDraggingColumn(column: GridColumn<T>): boolean {
    return DataGridHelpers.isDraggingColumnHelper(this, column);
  }

  // Check if column is drop target
  isDropTarget(column: GridColumn<T>): boolean {
    return DataGridHelpers.isDropTargetHelper(this, column);
  }

  getDropTargetEdge(column: GridColumn<T>): 'before' | 'after' | null {
    return DataGridHelpers.getDropTargetEdgeHelper(this, column);
  }

  isDropTargetBefore(column: GridColumn<T>): boolean {
    return DataGridHelpers.isDropTargetBeforeHelper(this, column);
  }

  isDropTargetAfter(column: GridColumn<T>): boolean {
    return DataGridHelpers.isDropTargetAfterHelper(this, column);
  }

  getCellClass(row: T, column: GridColumn<T>): string {
    return DataGridHelpers.getCellClassHelper(this, row, column);
  }

  getCellStyle(row: T, column: GridColumn<T>): Record<string, string> | null | undefined {
    return DataGridHelpers.getCellStyleHelper(this, row, column);
  }

  getHeaderStyle(column: GridColumn<T>): Record<string, string> | null | undefined {
    return DataGridHelpers.getHeaderStyleHelper(this, column);
  }

  getHeaderClass(column: GridColumn<T>): string {
    return DataGridHelpers.getHeaderClassHelper(this, column);
  }

  protected isFirstVisibleColumn(column: GridColumn<T>): boolean {
    return DataGridHelpers.isFirstVisibleColumnHelper(this, column);
  }

  protected getMenuAggregateValue(): GridColumn<T>['aggregate'] | null {
    return DataGridHelpers.getMenuAggregateValueHelper(this);
  }

  protected getAggregateCellClass(column: GridColumn<T>): string {
    return DataGridHelpers.getAggregateCellClassHelper(this, column);
  }

  protected getAggregateCellStyle(
    column: GridColumn<T>
  ): Record<string, string> | null | undefined {
    return this.getHeaderStyle(column);
  }

  protected getMainFooterAggregateCellClass(column: GridColumn<T>): string {
    const classes: string[] = [];
    const align = column.align || 'left';
    classes.push(`text-${align}`);
    if (column.pinned === 'left') {
      classes.push('pinned-left');
    } else if (column.pinned === 'right') {
      classes.push('pinned-right');
    }
    return classes.join(' ');
  }

  protected shouldPinSelection(): boolean {
    return DataGridHelpers.shouldPinSelectionHelper(this);
  }

  protected getSelectionColumnWidth(): number {
    return DataGridHelpers.getSelectionColumnWidthHelper(this);
  }

  getRowClass(row: T, index: number): string {
    return DataGridHelpers.getRowClassHelper(this, row, index);
  }

  isAppendRow(row: T | null | undefined): boolean {
    return !!DataGridHelpers.isAppendRowHelper(this, row);
  }

  getAppendRowHint(column: GridColumn<T>): string {
    if (this.config.selectable) {
      return '';
    }

    if (!this.config.appendRow) {
      return '';
    }

    const columns = this.visibleColumns();
    const canAppend = columns.some(candidate => candidate.editable);
    if (!canAppend) {
      return '';
    }

    const firstVisible = columns[0];
    if (!firstVisible || this.getColumnField(firstVisible) !== this.getColumnField(column)) {
      return '';
    }

    return this.config.appendRowHint?.trim() || 'Click any cell to add a new row';
  }

  getAppendRowSelectionHint(): string {
    if (!this.config.selectable || !this.config.appendRow) {
      return '';
    }

    const canAppend = this.visibleColumns().some(candidate => candidate.editable);
    if (!canAppend) {
      return '';
    }

    return this.config.appendRowHint?.trim() || 'Click any cell to add a new row';
  }

  protected isGroupRow(row: DisplayRow<T>): row is GroupDisplayRow<T> {
    return DataGridHelpers.isGroupRowHelper(this, row);
  }

  protected getDisplayRowData(row: DisplayRow<T>): T | null {
    return DataGridHelpers.getDisplayRowDataHelper(this, row);
  }

  protected getGroupFilterTerm(id: string): string {
    return DataGridHelpers.getGroupFilterTermHelper(this, id);
  }

  protected setGroupFilterTerm(id: string, value: string): void {
    return DataGridHelpers.setGroupFilterTermHelper(this, id, value);
  }

  protected clearGroupFilterTerm(id: string): void {
    return DataGridHelpers.clearGroupFilterTermHelper(this, id);
  }

  protected filterGroupRows(rows: T[], term: string): T[] {
    return DataGridHelpers.filterGroupRowsHelper(this, rows, term);
  }

  private rowMatchesGroupFilter(row: T, search: string): boolean {
    return DataGridHelpers.rowMatchesGroupFilterHelper(this, row, search);
  }

  protected getGroupLabel(field: string): string {
    return DataGridHelpers.getGroupLabelHelper(this, field);
  }

  protected getGroupDisplayValue(group: GroupBlock<T> | GroupDisplayRow<T>): string {
    return DataGridHelpers.getGroupDisplayValueHelper(this, group);
  }

  protected getGroupToneClass(group: GroupBlock<T> | GroupDisplayRow<T>): string {
    return DataGridHelpers.getGroupToneClassHelper(this, group);
  }

  protected buildGroupedRows(
    data: T[],
    groupFields: string[],
    level: number,
    path: string,
    expandedSet: Set<string>
  ): DisplayRow<T>[] {
    return DataGridHelpers.buildGroupedRowsHelper(
      this,
      data,
      groupFields,
      level,
      path,
      expandedSet
    );
  }

  trackByIndex = (index: number): number => index;

  trackByDataRow = (index: number, row: T): string | number => {
    const key = this.resolveRowIdentity(row);
    return key ?? index;
  };

  trackByDisplayRow = (index: number, row: DisplayRow<T>): string | number => {
    if (row.kind === 'group' || row.kind === 'group-footer') return row.id;
    const dataRow = (row as DataDisplayRow<T>).data;
    const key = this.resolveRowIdentity(dataRow);
    return key ?? index;
  };

  trackByField = (_index: number, column: GridColumn<T>): string => this.getColumnField(column);

  trackByFieldName = (_index: number, field: string): string => field;

  trackByGroupBlock = (_index: number, block: GroupBlock<T>): string => block.id;

  trackByFilterField = (_index: number, filter: FilterState): string => filter.field;

  getColumnField(column: GridColumn<T>): string {
    return DataGridHelpers.getColumnFieldHelper(this, column);
  }

  getFilterLabel(field: string): string {
    return DataGridHelpers.getFilterLabelHelper(this, field);
  }

  removeFilter(field: string): void {
    return DataGridHelpers.removeFilterHelper(this, field);
  }

  clearAllFilters(): void {
    return DataGridHelpers.clearAllFiltersHelper(this);
  }

  hasActiveFilters(): boolean {
    return DataGridHelpers.hasActiveFiltersHelper(this);
  }

  hasAggregates(): boolean {
    return DataGridHelpers.hasAggregatesHelper(this);
  }

  protected shouldShowGroupFooterAggregates(): boolean {
    return DataGridHelpers.shouldShowGroupFooterAggregatesHelper(this);
  }

  protected shouldShowGrandTotalAggregates(): boolean {
    return DataGridHelpers.shouldShowGrandTotalAggregatesHelper(this);
  }

  protected shouldAutoExpandGroups(): boolean {
    return DataGridHelpers.shouldAutoExpandGroupsHelper(this);
  }

  protected shouldShowCalculateFooter(): boolean {
    if (this.config.simpleMode) {
      return false;
    }

    if (this.aggregateFooter) {
      return this.aggregateFooter.enabled !== false;
    }

    return this.hasAggregates();
  }

  protected effectiveAggregateFooter(): GridAggregateFooterConfig<T> | null {
    if (!this.shouldShowCalculateFooter()) {
      return null;
    }
    return this.aggregateFooter ?? this.internalAggregateFooterConfig();
  }

  protected hasAggregateFooter(): boolean {
    return !!this.aggregateFooter?.enabled;
  }

  protected shouldRenderFooterStack(): boolean {
    return !this.config.simpleMode && (this.config.pagination || this.shouldReserveCalculateFooterBand());
  }

  protected shouldReserveCalculateFooterBand(): boolean {
    if (this.config.simpleMode) {
      return false;
    }

    return this.config.reserveAggregateFooterBand === true || this.shouldShowCalculateFooter();
  }

  protected isRemotePaginationPending(): boolean {
    return (
      !!this.config.remoteData &&
      !!this.loading &&
      (this.config.remoteTotalRecords ?? 0) === 0 &&
      this.dataSignal().length === 0
    );
  }

  protected shouldRenderAggregateFooter(): boolean {
    return this.shouldShowCalculateFooter() || this.shouldShowGrandTotalAggregates();
  }

  protected shouldRenderGrandTotalFooter(): boolean {
    return !this.shouldShowCalculateFooter() && this.shouldShowGrandTotalAggregates();
  }

  protected shouldRenderBottomScrollbarBand(): boolean {
    return this.config.showBottomScrollbarBand !== false;
  }

  protected handleAggregateFooterChange(event: GridAggregateFooterChangeEvent<T>): void {
    if (!this.aggregateFooter) {
      if (event.type === 'scope') {
        this.internalAggregateFooterScope.set(event.scope);
      } else {
        DataGridHelpers.setColumnAggregateHelper(this, event.column, event.operation);
      }
    }

    this.aggregateFooterChange.emit(event);
  }

  private buildInternalAggregateFooterResults(
    scope: GridAggregateScope
  ): Record<string, GridAggregateFooterResult> {
    const dataset = this.getInternalAggregateFooterRows(scope);
    if (!dataset.length) {
      return {};
    }

    const results: Record<string, GridAggregateFooterResult> = {};
    for (const column of this.visibleColumns()) {
      const operation = (column.aggregate as GridAggregateOperation | null | undefined) ?? null;
      if (!operation) {
        continue;
      }

      const result = this.resolveInternalAggregateFooterResult(column, operation, dataset);
      if (!result) {
        continue;
      }

      const fieldKey = this.getColumnField(column);
      results[fieldKey] = result;
      results[String(column.field ?? '')] = result;
    }

    return results;
  }

  private getInternalAggregateFooterRows(scope: GridAggregateScope): T[] {
    if (scope === 'page') {
      return this.processedData();
    }

    if (scope === 'all' && !this.config.remoteData) {
      return this.dataSignal();
    }

    return this.getFilteredSortedData();
  }

  private resolveInternalAggregateFooterResult(
    column: GridColumn<T>,
    operation: GridAggregateOperation,
    rows: T[]
  ): GridAggregateFooterResult | null {
    const field = this.getColumnField(column);

    try {
      const value =
        operation === 'percent'
          ? this.getPercentAggregate(rows, rows, column)
          : this.gridService.calculateAggregate(rows, field, operation);

      return {
        field,
        operation,
        value
      };
    } catch {
      return null;
    }
  }

  private supportsInternalAggregateFooterOperation(
    column: GridColumn<T>,
    operation: GridAggregateOperation
  ): boolean {
    if (operation === 'count' || operation === 'distinct') {
      return true;
    }

    return this.isNumericColumn(column);
  }

  private formatInternalAggregateFooterValue(
    column: GridColumn<T>,
    result: GridAggregateFooterResult
  ): string {
    const value = result.value;
    if (value === null || value === undefined || value === '') {
      return '-';
    }

    if (
      typeof value === 'number' &&
      column.format &&
      !['count', 'distinct', 'percent'].includes(result.operation)
    ) {
      try {
        return String(column.format(value as GridLooseValue) ?? '-').trim() || '-';
      } catch {}
    }

    if (typeof value === 'number') {
      if (result.operation === 'count' || result.operation === 'distinct') {
        return value.toLocaleString('en-US', {
          maximumFractionDigits: 0
        });
      }

      if (result.operation === 'percent') {
        return `${value.toFixed(2)}%`;
      }

      return value.toLocaleString('en-US', {
        minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
        maximumFractionDigits: 2
      });
    }

    return String(value);
  }

  private bumpAggregateCache(): void {
    return DataGridHelpers.bumpAggregateCacheHelper(this);
  }

  protected invalidateFilteredSortedCache(): void {
    return DataGridHelpers.invalidateFilteredSortedCacheHelper(this);
  }

  private getAggregateCacheKey(
    scope: 'total' | 'group' | 'block',
    id: string,
    column: GridColumn<T>
  ): string {
    return DataGridHelpers.getAggregateCacheKeyHelper(this, scope, id, column);
  }

  private getNonEmptyCount(data: T[], field: string): number {
    return DataGridHelpers.getNonEmptyCountHelper(this, data, field);
  }

  private getNumericValues(data: T[], field: string): number[] {
    return DataGridHelpers.getNumericValuesHelper(this, data, field);
  }

  private getPercentAggregate(data: T[], totalData: T[], column: GridColumn<T>): number {
    return DataGridHelpers.getPercentAggregateHelper(this, data, totalData, column);
  }

  getAggregateValue(column: GridColumn<T>): string {
    return DataGridHelpers.getAggregateValueHelper(this, column);
  }
}
