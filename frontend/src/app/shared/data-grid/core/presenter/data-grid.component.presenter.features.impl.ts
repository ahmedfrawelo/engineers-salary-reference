import { Directive } from '@angular/core';
import type { FilterState, ExportPresentationMeta } from '../../models';
import { DataGridComponentState, type ExportScope, type GridLooseValue } from '../state';
import * as DataGridHelpers from '../runtime/data-grid.component.helper';

@Directive()
export abstract class DataGridComponentPresenterFeaturesImpl<
  T = GridLooseValue
> extends DataGridComponentState<T> {
  async exportData(format: 'excel' | 'csv' | 'pdf'): Promise<void> {
    return await DataGridHelpers.exportDataHelper(this, format);
  }

  setExportScope(scope: 'all' | 'selected' | 'filtered') {
    return DataGridHelpers.setExportScopeHelper(this, scope);
  }

  setExportFormat(format: 'excel' | 'csv' | 'pdf') {
    return DataGridHelpers.setExportFormatHelper(this, format);
  }

  protected getExportFormats(): ('excel' | 'csv' | 'pdf')[] {
    return DataGridHelpers.getExportFormatsHelper(this);
  }

  protected getExportFormatLabel(format: 'excel' | 'csv' | 'pdf'): string {
    return DataGridHelpers.getExportFormatLabelHelper(this, format);
  }

  private getAvailableExportFormats(): ('excel' | 'csv' | 'pdf')[] {
    return DataGridHelpers.getAvailableExportFormatsHelper(this);
  }

  private syncExportFormat(): void {
    return DataGridHelpers.syncExportFormatHelper(this);
  }

  getFilteredVisibleData(): T[] {
    return DataGridHelpers.getFilteredVisibleDataHelper(this);
  }

  private buildExportMeta(scope: ExportScope): ExportPresentationMeta {
    return DataGridHelpers.buildExportMetaHelper(this, scope);
  }

  private getExportTitleBase(): string {
    return DataGridHelpers.getExportTitleBaseHelper(this);
  }

  private getExportFileBase(): string {
    return DataGridHelpers.getExportFileBaseHelper(this);
  }

  private getExportScopeLabel(scope: ExportScope): string {
    return DataGridHelpers.getExportScopeLabelHelper(this, scope);
  }

  private getExportScopeSlug(scope: ExportScope): string {
    return DataGridHelpers.getExportScopeSlugHelper(this, scope);
  }

  private buildExportFileName(scope: ExportScope): string {
    return DataGridHelpers.buildExportFileNameHelper(this, scope);
  }

  private sanitizeFileName(value: string): string {
    return DataGridHelpers.sanitizeFileNameHelper(this, value);
  }

  async exportDataAdvanced(): Promise<void> {
    return await DataGridHelpers.exportDataAdvancedHelper(this);
  }

  canSaveCurrentFilters(): boolean {
    return DataGridHelpers.canSaveCurrentFiltersHelper(this);
  }

  openSavePresetDialog() {
    return DataGridHelpers.openSavePresetDialogHelper(this);
  }

  closeSavePresetDialog() {
    return DataGridHelpers.closeSavePresetDialogHelper(this);
  }

  saveCurrentFiltersAsPreset() {
    return DataGridHelpers.saveCurrentFiltersAsPresetHelper(this);
  }

  applyFilterPreset(preset: { name: string; filters: FilterState[]; searchTerm: string }) {
    return DataGridHelpers.applyFilterPresetHelper(this, preset);
  }

  deleteFilterPreset(name: string) {
    return DataGridHelpers.deleteFilterPresetHelper(this, name);
  }

  private savePresetsToStorage() {
    return DataGridHelpers.savePresetsToStorageHelper(this);
  }

  private loadPresetsFromStorage() {
    return DataGridHelpers.loadPresetsFromStorageHelper(this);
  }

  togglePerformanceStats() {
    return DataGridHelpers.togglePerformanceStatsHelper(this);
  }

  getPerformanceStats() {
    return DataGridHelpers.getPerformanceStatsHelper(this);
  }

  toggleKeyboardShortcuts() {
    return DataGridHelpers.toggleKeyboardShortcutsHelper(this);
  }

  closeKeyboardShortcuts() {
    return DataGridHelpers.closeKeyboardShortcutsHelper(this);
  }

  togglePinRow(row: T) {
    return DataGridHelpers.togglePinRowHelper(this, row);
  }

  isRowPinned(row: T): boolean {
    return DataGridHelpers.isRowPinnedHelper(this, row);
  }

  unpinAllRows() {
    return DataGridHelpers.unpinAllRowsHelper(this);
  }

  showAutoSave(message: string = 'Saved successfully') {
    return DataGridHelpers.showAutoSaveHelper(this, message);
  }

  onRowMouseEnter(rowIndex: number, event?: MouseEvent) {
    return DataGridHelpers.onRowMouseEnterHelper(this, rowIndex, event);
  }

  onRowMouseLeave() {
    return DataGridHelpers.onRowMouseLeaveHelper(this);
  }

  isRowHovered(rowIndex: number): boolean {
    return DataGridHelpers.isRowHoveredHelper(this, rowIndex);
  }

  canQuickEdit(): boolean {
    return DataGridHelpers.canQuickEditHelper(this);
  }

  triggerQuickEdit(rowIndex: number) {
    return DataGridHelpers.triggerQuickEditHelper(this, rowIndex);
  }

  toggleFocusMode() {
    return DataGridHelpers.toggleFocusModeHelper(this);
  }

  isColumnHovered(field: string): boolean {
    return DataGridHelpers.isColumnHoveredHelper(this, field);
  }

  private setHoveredColumn(field: string) {
    return DataGridHelpers.setHoveredColumnHelper(this, field);
  }

  private clearHoveredColumn() {
    return DataGridHelpers.clearHoveredColumnHelper(this);
  }

  flashCell(rowIndex: number, field: string) {
    return DataGridHelpers.flashCellHelper(this, rowIndex, field);
  }

  isCellFlashing(rowIndex: number, field: string): boolean {
    return DataGridHelpers.isCellFlashingHelper(this, rowIndex, field);
  }

  getSortIndex(field: string): number {
    return DataGridHelpers.getSortIndexHelper(this, field);
  }

  hasMultiColumnSort(): boolean {
    return DataGridHelpers.hasMultiColumnSortHelper(this);
  }
}
