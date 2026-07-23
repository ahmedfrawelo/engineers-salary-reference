import { Directive, HostListener } from '@angular/core';

import type { GridColumn } from '../../models';
import type { GridLooseValue } from '../state';
import * as DataGridHelpers from '../runtime/data-grid.component.helper';
import { DataGridComponentPresenterFeaturesImpl } from './data-grid.component.presenter.features.impl';

@Directive()
export abstract class DataGridComponentPresenterIntelligenceBase<
  T = GridLooseValue
> extends DataGridComponentPresenterFeaturesImpl<T> {
  private globalDismissListenerAttached = false;
  private readonly globalDismissClickHandler = (event: MouseEvent) => this.onDocumentClick(event);

  private copyTextFallback(text: string) {
    return DataGridHelpers.copyTextFallbackHelper(this, text);
  }

  protected isEmptyValue(value: unknown): boolean {
    return DataGridHelpers.isEmptyValueHelper(this, value);
  }

  protected normalizeNumericValue(value: unknown): number | null {
    return DataGridHelpers.normalizeNumericValueHelper(this, value);
  }

  protected isNumericColumn(column: GridColumn<T>): boolean {
    return DataGridHelpers.isNumericColumnHelper(this, column);
  }

  protected toggleColumnInsights() {
    return DataGridHelpers.toggleColumnInsightsHelper(this);
  }

  protected setInsightColumn(field: string) {
    return DataGridHelpers.setInsightColumnHelper(this, field);
  }

  protected getInsightColumns(): GridColumn<T>[] {
    return DataGridHelpers.getInsightColumnsHelper(this);
  }

  protected toggleColorScale() {
    return DataGridHelpers.toggleColorScaleHelper(this);
  }

  protected getColorScaleIntensity(row: T, column: GridColumn<T>): number | null {
    return DataGridHelpers.getColorScaleIntensityHelper(this, row, column);
  }

  private getColumnRange(field: string): { min: number; max: number } | null {
    return DataGridHelpers.getColumnRangeHelper(this, field);
  }

  protected normalizeGroupKey(value: unknown): string {
    return DataGridHelpers.normalizeGroupKeyHelper(this, value);
  }

  protected toggleAnomalyAlerts() {
    return DataGridHelpers.toggleAnomalyAlertsHelper(this);
  }

  protected isCellAnomaly(row: T, column: GridColumn<T>): boolean {
    return DataGridHelpers.isCellAnomalyHelper(this, row, column);
  }

  protected getColumnStats(field: string): { mean: number; std: number } | null {
    return DataGridHelpers.getColumnStatsHelper(this, field);
  }

  protected isValueAnomaly(
    value: number | null,
    stats: { mean: number; std: number } | null
  ): boolean {
    return DataGridHelpers.isValueAnomalyHelper(this, value, stats);
  }

  protected refreshDataTimestamp() {
    return DataGridHelpers.refreshDataTimestampHelper(this);
  }

  protected getLastRefreshLabel(): string {
    return DataGridHelpers.getLastRefreshLabelHelper(this);
  }

  protected toggleQualityPanel() {
    return DataGridHelpers.toggleQualityPanelHelper(this);
  }

  protected toggleBookmarkRow(row: T) {
    return DataGridHelpers.toggleBookmarkRowHelper(this, row);
  }

  protected isRowBookmarked(row: T): boolean {
    return DataGridHelpers.isRowBookmarkedHelper(this, row);
  }

  protected clearBookmarks() {
    return DataGridHelpers.clearBookmarksHelper(this);
  }

  protected getBookmarkLabel(row: T): string {
    return DataGridHelpers.getBookmarkLabelHelper(this, row);
  }

  protected toggleAuditTrail() {
    return DataGridHelpers.toggleAuditTrailHelper(this);
  }

  protected logAuditEvent(type: string, label: string) {
    return DataGridHelpers.logAuditEventHelper(this, type, label);
  }

  protected copyAuditEvent(eventId: string) {
    return DataGridHelpers.copyAuditEventHelper(this, eventId);
  }

  protected toggleHighContrast() {
    return DataGridHelpers.toggleHighContrastHelper(this);
  }

  protected generateRecommendations() {
    return DataGridHelpers.generateRecommendationsHelper(this);
  }

  protected toggleForecastSparklines() {
    return DataGridHelpers.toggleForecastSparklinesHelper(this);
  }

  protected getSparklinePath(column: GridColumn<T>): string | null {
    return DataGridHelpers.getSparklinePathHelper(this, column);
  }

  protected openColumnNote(column: GridColumn<T>) {
    return DataGridHelpers.openColumnNoteHelper(this, column);
  }

  protected saveColumnNote() {
    return DataGridHelpers.saveColumnNoteHelper(this);
  }

  protected closeNoteEditor() {
    return DataGridHelpers.closeNoteEditorHelper(this);
  }

  protected hasColumnNote(column: GridColumn<T>): boolean {
    return DataGridHelpers.hasColumnNoteHelper(this, column);
  }

  protected generateShareableLink() {
    return DataGridHelpers.generateShareableLinkHelper(this);
  }

  protected toggleActionLauncher(event?: MouseEvent) {
    const result = DataGridHelpers.toggleActionLauncherHelper(this, event);
    this.syncGlobalDismissListener();
    return result;
  }

  protected closeActionLauncher(event?: MouseEvent) {
    const result = DataGridHelpers.closeActionLauncherHelper(this, event);
    this.syncGlobalDismissListener();
    return result;
  }

  protected onDocumentClick(event: MouseEvent): void {
    DataGridHelpers.onDocumentClickHelper(this, event);
    this.syncGlobalDismissListener();
  }

  protected syncGlobalDismissListener(): void {
    if (this.hasOpenDismissibleLayer()) {
      this.attachGlobalDismissListener();
    } else {
      this.detachGlobalDismissListener();
    }
  }

  protected detachGlobalDismissListener(): void {
    if (!this.globalDismissListenerAttached || typeof document === 'undefined') {
      return;
    }
    this.globalDismissListenerAttached = false;
    document.removeEventListener('click', this.globalDismissClickHandler);
  }

  private attachGlobalDismissListener(): void {
    if (this.globalDismissListenerAttached || typeof document === 'undefined') {
      return;
    }
    this.globalDismissListenerAttached = true;
    document.addEventListener('click', this.globalDismissClickHandler);
  }

  private hasOpenDismissibleLayer(): boolean {
    return (
      !!this.activeFilterColumn ||
      !!this.contextMenuColumn ||
      this.showCellContextMenu ||
      this.showColumnContextMenu() ||
      this.showGroupContextMenu() ||
      this.showEmptyGroupMenu() ||
      this.showActionLauncher()
    );
  }

  protected toggleHeadlinePanel() {
    return DataGridHelpers.toggleHeadlinePanelHelper(this);
  }

  protected onHeaderFilterClick(column: GridColumn<T>, event: MouseEvent) {
    return DataGridHelpers.onHeaderFilterClickHelper(this, column, event);
  }

  onQuickFilterChange(column: GridColumn<T>, value: string) {
    return DataGridHelpers.onQuickFilterChangeHelper(this, column, value);
  }

  getQuickFilterValue(column: GridColumn<T>): string {
    return DataGridHelpers.getQuickFilterValueHelper(this, column);
  }

  clearQuickFilter(column: GridColumn<T>) {
    return DataGridHelpers.clearQuickFilterHelper(this, column);
  }

  clearAllQuickFilters() {
    return DataGridHelpers.clearAllQuickFiltersHelper(this);
  }

  hasQuickFilter(column: GridColumn<T>): boolean {
    return DataGridHelpers.hasQuickFilterHelper(this, column);
  }

  protected isSpreadsheetMode(): boolean {
    return DataGridHelpers.isSpreadsheetModeHelper(this);
  }

  protected getSpreadsheetCellValue(row: number, col: number): unknown {
    return DataGridHelpers.getSpreadsheetCellValueHelper(this, row, col);
  }

  private getCellValueAt(row: number, col: number): unknown {
    return DataGridHelpers.getCellValueAtHelper(this, row, col);
  }

  protected setSpreadsheetCellValue(row: number, col: number, value: unknown): void {
    return DataGridHelpers.setSpreadsheetCellValueHelper(this, row, col, value);
  }

  private recalculateDependentCells(changedRow: number, changedCol: number): void {
    return DataGridHelpers.recalculateDependentCellsHelper(this, changedRow, changedCol);
  }

  @HostListener('document:paste', ['$event'])
  onPasteSpreadsheet(event: ClipboardEvent): void {
    return DataGridHelpers.onPasteSpreadsheetHelper(this, event);
  }

  protected getCurrentCellReference(): string {
    return DataGridHelpers.getCurrentCellReferenceHelper(this);
  }

  protected getCurrentCellFormula(): string {
    return DataGridHelpers.getCurrentCellFormulaHelper(this);
  }

  protected onFormulaBarApply(formula: string): void {
    return DataGridHelpers.onFormulaBarApplyHelper(this, formula);
  }

  protected onFormulaBarCancel(): void {
    return DataGridHelpers.onFormulaBarCancelHelper(this);
  }

  private handleSpreadsheetKeydown(event: KeyboardEvent): void {
    return DataGridHelpers.handleSpreadsheetKeydownHelper(this, event);
  }

  protected cancelLoading(): void {
    return DataGridHelpers.cancelLoadingHelper(this);
  }

  public updateLoadingProgress(progress: number, cancellable: boolean = false): void {
    return DataGridHelpers.updateLoadingProgressHelper(this, progress, cancellable);
  }
}
