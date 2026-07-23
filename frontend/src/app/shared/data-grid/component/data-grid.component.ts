import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  NgZone,
  signal,
  ViewChild
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { DataGridService, ExcelPasteService, FormulaEngineService } from '../services';
import { DataGridComponentPresenter, type GridLooseValue } from '../core';
import { ToastService } from '@shared/toast/toast.service';
import {
  inferGridFeedbackTone,
  registerGridFeedbackHandlers,
  type GridFeedbackTone
} from '../utils/feedback';
import type { GridColumn } from '../models';

const DATA_GRID_TOASTS = new WeakMap<DataGridComponent<unknown>, ToastService>();
type ColumnTypeChoice = 'text' | 'number' | 'date' | 'dropdown';
type FormulaSuggestion = {
  label: string;
  insertText: string;
  detail: string;
  kind: 'function' | 'reference';
};

/**
 * Public entry point for the ENGINEERS_SALARY_REFERENCE data grid.
 * The heavy runtime, presenter, and styling layers are composed underneath.
 */
@Component({
  selector: 'engineers-salary-reference-data-grid',
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone: false,
  providers: [DataGridService],
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['data', 'columns', 'config', 'loading', 'stateKey', 'aggregateFooter', 'remoteGroups'],
  templateUrl: './data-grid.component.html',
  styleUrls: ['./data-grid.component.scss'],
  host: {
    '[class.grouping-mode]': 'groupingMode',
    '[class.is-scrolling]': 'isScrolling',
    '[attr.data-grid-layout-preset]': 'dataGridLayoutPresetAttr',
    '[class.dg-hover-disabled]': 'hasHoverDisabled',
    '[style.--dg-grid-row-height]': 'gridRowHeightCssVar',
    '[style.--dg-pinned-left-width]': 'pinnedLeftWidthCssVar'
  },
  queries: {
    gridViewport: new ViewChild('gridViewport'),
    bottomScrollbarViewport: new ViewChild('bottomScrollbarViewport'),
    bottomScrollbarTrack: new ViewChild('bottomScrollbarTrack'),
    fixedHeader: new ViewChild('fixedHeader', { read: ElementRef }),
    selectionActionBar: new ViewChild('selectionActionBar')
  },
  // OnPush keeps the grid aligned with the surrounding app's change-detection strategy.
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DataGridComponent<T = GridLooseValue> extends DataGridComponentPresenter<T> {
  private formulaSuggestionOverlayFrame: number | null = null;
  protected suppressNextEditNavigation = false;
  private formulaBarDraft = '';
  private formulaBarDraftCellKey: string | null = null;
  private readonly spreadsheetFormulaEngine = inject(FormulaEngineService);
  private readonly componentCdr = inject(ChangeDetectorRef);
  private readonly hostElementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly editorDraftCellKey = signal<string | null>(null);
  private readonly editorDraftValue = signal('');
  private readonly editorCaretPosition = signal(0);
  private readonly formulaReferencePreviewKeys = signal<Set<string>>(new Set());
  private readonly formulaOriginCellKey = signal<string | null>(null);
  private readonly formulaLastPickedReference = signal<{ rowIndex: number; columnIndex: number } | null>(
    null
  );
  private readonly formulaSuggestions = signal<FormulaSuggestion[]>([]);
  private readonly formulaSuggestionsOpen = signal(false);
  private readonly formulaSuggestionActiveIndex = signal(0);
  private readonly formulaSuggestionReplaceRange = signal<{ start: number; end: number } | null>(null);
  private readonly formulaKeyboardReferenceRange = signal<{ start: number; end: number } | null>(null);
  private readonly formulaSuggestionOverlayStyle = signal<Record<string, string>>({});

  constructor() {
    const gridService = inject(DataGridService);
    const sanitizer = inject(DomSanitizer);
    const cdr = inject(ChangeDetectorRef);
    const elementRef = inject(ElementRef);
    const ngZone = inject(NgZone);
    const formulaEngine = inject(FormulaEngineService);
    const excelPasteService = inject(ExcelPasteService);
    const toast = inject(ToastService);
    super(gridService, sanitizer, cdr, elementRef, ngZone, formulaEngine, excelPasteService);
    DATA_GRID_TOASTS.set(this as DataGridComponent<unknown>, toast);
    registerGridFeedbackHandlers({
      action: (message, options) => {
        const tone = options.tone ?? inferGridFeedbackTone(message);
        this.gridToast.action(
          tone === 'danger' ? 'danger' : tone,
          message,
          options.actionLabel ?? 'Undo',
          options.onAction,
          options.duration ?? 7000,
          options.onExpire,
          {
            title: options.title,
            coalesce: false
          }
        );
      },
      alert: (message, options) => {
        const tone = options?.tone ?? inferGridFeedbackTone(message);
        this.presentGridToast(tone, message);
      },
      confirm: (message, options) => {
        const tone = options.tone ?? inferGridFeedbackTone(message);
        this.gridToast.action(
          tone === 'danger' ? 'danger' : tone,
          message,
          options.actionLabel ?? 'Confirm',
          options.onConfirm,
          5000,
          undefined,
          { coalesce: false }
        );
      }
    });
  }

  private get gridToast(): ToastService {
    return DATA_GRID_TOASTS.get(this as DataGridComponent<unknown>)!;
  }

  private presentGridToast(tone: GridFeedbackTone, message: string): void {
    switch (tone) {
      case 'danger':
        this.gridToast.error(message);
        break;
      case 'warning':
        this.gridToast.warning(message);
        break;
      default:
        this.gridToast.info(message);
        break;
    }
  }

  override showAutoSave(message = 'Saved successfully'): void {
    this.presentGridToast(inferGridFeedbackTone(message), message);
  }

  getDataSnapshot(): T[] {
    return this.dataSignal().map(row => this.cloneRowSnapshot(row));
  }

  getVisibleColumnsSnapshot(): GridColumn<T>[] {
    return this.visibleColumns().map(column => ({ ...column }));
  }

  getProcessedDataSnapshot(): T[] {
    return this.processedData().map(row => this.cloneRowSnapshot(row));
  }

  refreshRenderedCells(): void {
    const cacheOwner = this as unknown as {
      cellValueCache?: { clear?: () => void };
    };
    cacheOwner.cellValueCache?.clear?.();
    this.invalidateFilteredSortedCache();
    this.componentCdr.markForCheck();
  }

  getActiveCellPosition(): { rowIndex: number; columnIndex: number } | null {
    return this.activeCell();
  }

  isSearchSelectColumn(column: GridColumn<T>): boolean {
    return (
      column.cellType === 'search-select' ||
      !!column.searchSelect ||
      (column.type === 'dropdown' && Array.isArray(column.options))
    );
  }

  activateSearchSelectCell(row: T, column: GridColumn<T>): void {
    const rowIndex = this.getGlobalRowIndex(row);
    const columnIndex = this.visibleColumns().findIndex(
      candidate => this.getColumnField(candidate) === this.getColumnField(column)
    );
    if (rowIndex < 0 || columnIndex < 0) {
      return;
    }

    this.activeCell.set({ rowIndex, columnIndex });
    this.spreadsheetCurrentCell.set({ row: rowIndex, col: columnIndex });
  }

  getSearchSelectOptions(row: T, column: GridColumn<T>): readonly unknown[] {
    const source = column.searchSelect?.options;
    if (source) {
      return typeof source === 'function' ? source(row, column) : source;
    }
    return column.type === 'dropdown' && Array.isArray(column.options) ? column.options : [];
  }

  getSearchSelectValue(row: T, column: GridColumn<T>): unknown | null {
    const options = this.getSearchSelectOptions(row, column);
    const configuredValue = column.searchSelect?.value?.(row, column, options);
    if (configuredValue !== undefined) {
      return configuredValue;
    }

    const field = this.getColumnField(column);
    const rawValue = (row as Record<string, unknown>)[field];
    if (rawValue == null || rawValue === '') {
      return null;
    }

    return (
      options.find(option => {
        const label = column.searchSelect?.displayFn?.(option) ?? this.getGenericOptionLabel(option);
        const optionValue = this.getGenericOptionValue(option);
        return option === rawValue || optionValue === rawValue || label === rawValue;
      }) ?? rawValue
    );
  }

  getSearchSelectDisplayFn(column: GridColumn<T>): ((value: unknown) => string) | undefined {
    return (
      (column.searchSelect?.displayFn as ((value: unknown) => string) | undefined) ??
      (column.type === 'dropdown' ? value => this.getGenericOptionLabel(value) : undefined)
    );
  }

  getSearchSelectOptionPresentationFn(
    row: T,
    column: GridColumn<T>
  ): ((value: unknown) => ReturnType<NonNullable<NonNullable<typeof column.searchSelect>['optionPresentation']>>) | undefined {
    const presentation = column.searchSelect?.optionPresentation;
    return presentation ? value => presentation(value, row, column) : undefined;
  }

  getSearchSelectOptionHierarchyFn(
    row: T,
    column: GridColumn<T>
  ): ((value: unknown) => ReturnType<NonNullable<NonNullable<typeof column.searchSelect>['optionHierarchy']>>) | undefined {
    const hierarchy = column.searchSelect?.optionHierarchy;
    return hierarchy ? value => hierarchy(value, row, column) : undefined;
  }

  getSearchSelectPlaceholder(row: T, column: GridColumn<T>): string {
    const placeholder = column.searchSelect?.placeholder;
    if (typeof placeholder === 'function') {
      return placeholder(row, column);
    }
    return placeholder ?? (column.type === 'dropdown' ? 'Select...' : '');
  }

  getSearchSelectInlineTextValue(row: T, column: GridColumn<T>): string | null | undefined {
    return column.searchSelect?.inlineTextValue?.(row, column);
  }

  getSearchSelectInlineInputMode(column: GridColumn<T>): string {
    return column.searchSelect?.inlineTextInputMode ?? 'text';
  }

  getSearchSelectInlineSuffix(row: T, column: GridColumn<T>): string {
    const suffix = column.searchSelect?.inlineSuffix;
    const value = typeof suffix === 'function' ? suffix(row, column) : suffix;
    return String(value ?? '').trim();
  }

  getSearchSelectOverlayPanelClass(column: GridColumn<T>): string[] {
    const configured = column.searchSelect?.overlayPanelClass;
    const classes = ['grid-cell-search-select-overlay'];
    if (Array.isArray(configured)) {
      return classes.concat(configured.filter(Boolean));
    }
    if (configured) {
      classes.push(configured);
    }
    return classes;
  }

  isSearchSelectDisabled(row: T, column: GridColumn<T>): boolean {
    const disabled = column.searchSelect?.disabled;
    return typeof disabled === 'function' ? disabled(row, column) : (disabled ?? false);
  }

  onSearchSelectSearch(row: T, column: GridColumn<T>, query: string): void {
    column.searchSelect?.search?.(query, row, column);
  }

  onSearchSelectValueChange(row: T, column: GridColumn<T>, value: unknown | null): void {
    const field = this.getColumnField(column);
    const handler = column.searchSelect?.valueChange;
    if (handler) {
      handler(value, row, column);
      this.invalidateSearchSelectMutationCaches(field);
      this.componentCdr.markForCheck();
      return;
    }

    const normalizedValue = this.getGenericOptionValue(value);
    (row as Record<string, unknown>)[field] = normalizedValue;
    this.invalidateSearchSelectMutationCaches(field);
    this.onCellEdit.emit({ row, field, value: normalizedValue });
    this.componentCdr.markForCheck();
  }

  private getGenericOptionLabel(option: unknown): string {
    if (option && typeof option === 'object' && 'label' in option) {
      return String((option as { label?: unknown }).label ?? '');
    }
    return String(option ?? '');
  }

  private getGenericOptionValue(option: unknown): unknown {
    if (option && typeof option === 'object' && 'value' in option) {
      return (option as { value?: unknown }).value;
    }
    return option;
  }

  onSearchSelectInlineTextCommit(row: T, column: GridColumn<T>, value: string): void {
    const field = this.getColumnField(column);
    const handler = column.searchSelect?.inlineTextCommit;
    if (handler) {
      handler(value, row, column);
      this.invalidateSearchSelectMutationCaches(field);
      this.componentCdr.markForCheck();
      return;
    }

    (row as Record<string, unknown>)[field] = value;
    this.invalidateSearchSelectMutationCaches(field);
    this.onCellEdit.emit({ row, field, value });
    this.componentCdr.markForCheck();
  }

  private invalidateSearchSelectMutationCaches(field: string): void {
    const cacheOwner = this as unknown as {
      columnRangeCache?: { delete?: (key: string) => void };
      columnStatsCache?: { delete?: (key: string) => void };
      cellValueCache?: { clear?: () => void };
      spreadsheetFormulaCache?: { clear?: () => void };
      bumpAggregateCache?: () => void;
    };

    this.invalidateFilteredSortedCache();
    if (field) {
      cacheOwner.columnRangeCache?.delete?.(field);
      cacheOwner.columnStatsCache?.delete?.(field);
    }
    cacheOwner.cellValueCache?.clear?.();
    cacheOwner.spreadsheetFormulaCache?.clear?.();
    cacheOwner.bumpAggregateCache?.();
  }

  getColumnDataTypeDisplay(column: GridColumn<T>): string {
    const type = this.getColumnDataType(column);
    if (type === 'dropdown') {
      return column.searchSelect || column.cellType === 'search-select' ? 'Search-select' : 'Dropdown';
    }
    if (type === 'number') {
      return 'Number';
    }
    if (type === 'date') {
      return 'Date';
    }
    return 'Text';
  }

  getColumnDataTypeDescription(column: GridColumn<T>): string {
    const type = this.getColumnDataType(column);
    if (column.searchSelect || column.cellType === 'search-select') {
      return 'Uses the shared search-select cell editor with typed search and keyboard selection.';
    }
    if (type === 'dropdown') {
      return 'Stores one configured option per cell and renders it with the shared search-select editor.';
    }
    if (type === 'number') {
      return 'Numeric input, numeric sorting, numeric filtering, and aggregate-ready values.';
    }
    if (type === 'date') {
      return 'Date input, date sorting, and date-aware grouping/filtering.';
    }
    return 'Free text input with text sorting and filtering.';
  }

  isManagedColumnType(column: GridColumn<T>): boolean {
    return !!column.searchSelect || !!column.headerSelect;
  }

  isColumnTypeChoiceDisabled(column: GridColumn<T>, type: ColumnTypeChoice): boolean {
    return this.isManagedColumnType(column) && this.getColumnDataType(column) !== type;
  }

  shouldShowDropdownOptionsEditor(column: GridColumn<T>): boolean {
    return this.getColumnDataType(column) === 'dropdown' && !column.searchSelect;
  }

  getColumnTypeChoiceLabel(type: ColumnTypeChoice): string {
    switch (type) {
      case 'number':
        return 'Number';
      case 'date':
        return 'Date';
      case 'dropdown':
        return 'Dropdown';
      default:
        return 'Text';
    }
  }

  getColumnTypeChoiceHint(type: ColumnTypeChoice): string {
    switch (type) {
      case 'number':
        return 'Quantities, prices, totals, percentages';
      case 'date':
        return 'Deadlines, accept dates, schedules';
      case 'dropdown':
        return 'Fixed choices with search-select';
      default:
        return 'Names, descriptions, notes';
    }
  }

  getColumnTypeChoiceMark(type: ColumnTypeChoice): string {
    switch (type) {
      case 'number':
        return '123';
      case 'date':
        return 'CAL';
      case 'dropdown':
        return 'SEL';
      default:
        return 'TXT';
    }
  }

  supportsCellFormulaInput(column: GridColumn<T>): boolean {
    if (!this.config.spreadsheetMode || this.config.enableFormulas === false || !column.editable) {
      return false;
    }

    if (column.allowFormulas === false) {
      return false;
    }

    return column.cellType === 'formula' || column.cellType === 'number' || column.type === 'number';
  }

  getCellEditorPlaceholder(rowIndex: number, column: GridColumn<T>): string {
    if (!this.supportsCellFormulaInput(column)) {
      return '';
    }

    const sample = this.getFormulaExampleToken(rowIndex);
    return `Example: =${sample}`;
  }

  getCellEditorHint(rowIndex: number, column: GridColumn<T>): string {
    if (!this.supportsCellFormulaInput(column)) {
      return '';
    }

    if (this.isFormulaSelectionMode()) {
      return 'Formula mode: click cells to insert references, Shift+click to insert a range.';
    }

    const tokens = this.getFormulaHintTokens(rowIndex);
    if (!tokens.length) {
      return 'Start with =, then click cells or type column names with row numbers.';
    }

    return `Type = then click cells, use ${tokens.join(' or ')}, or math operators + - * / ^ %.`;
  }

  getCellEditorValue(row: T, column: GridColumn<T>, rowIndex: number): string {
    const cellKey = this.getEditorCellKey(rowIndex, column);
    if (this.editorDraftCellKey() === cellKey) {
      return this.editorDraftValue();
    }

    return String(this.getCellRawValue(row, column) ?? '');
  }

  isDateEditorColumn(column: GridColumn<T>): boolean {
    return column.cellType === 'date' || column.type === 'date';
  }

  isDatePickerCell(row: T, column: GridColumn<T>): boolean {
    return this.isDateEditorColumn(column) && !!column.editable && this.config.editMode !== 'none';
  }

  isDatePickerDisabled(row: T, column: GridColumn<T>): boolean {
    return (
      !column.editable ||
      this.config.editMode === 'none' ||
      (typeof column.canEdit === 'function' && column.canEdit(row, column) === false)
    );
  }

  activateDatePickerCell(row: T, column: GridColumn<T>): void {
    this.activateSearchSelectCell(row, column);
  }

  isMultilineCellEditor(column: GridColumn<T>): boolean {
    if (column.wrapEditor === false) {
      return false;
    }

    if (this.supportsCellFormulaInput(column)) {
      return false;
    }

    return (
      column.wrapEditor === true ||
      column.cellType === 'text' ||
      column.type === 'text' ||
      (!column.cellType && !column.type)
    );
  }

  onCellEditorInput(
    rowIndex: number,
    column: GridColumn<T>,
    input: HTMLInputElement | HTMLTextAreaElement | null
  ): void {
    this.resizeWrappedEditorOverlay(input);
    const value = input?.value ?? '';
    const caret = input?.selectionStart ?? value.length;
    this.editorDraftCellKey.set(this.getEditorCellKey(rowIndex, column));
    this.editorDraftValue.set(value);
    this.editorCaretPosition.set(caret);
    this.formulaKeyboardReferenceRange.set(null);
    this.syncFormulaSelectionState(rowIndex, column, value);
    this.scheduleFormulaSuggestionOverlayRefresh();
  }

  private resizeWrappedEditorOverlay(input: HTMLInputElement | HTMLTextAreaElement | null): void {
    if (!(input instanceof HTMLTextAreaElement)) {
      return;
    }

    const editorWrap = input.closest('.cell-editor-wrap');
    if (!(editorWrap instanceof HTMLElement) || !editorWrap.classList.contains('wrap-editor')) {
      return;
    }

    input.style.height = 'auto';
    input.style.height = `${input.scrollHeight}px`;
    editorWrap.style.minHeight = `${input.scrollHeight}px`;
  }

  onCellEditorKeydown(
    event: KeyboardEvent,
    row: T,
    column: GridColumn<T>,
    rowIndex: number
  ): void {
    const input = event.target as HTMLInputElement | HTMLTextAreaElement | null;
    const currentValue = input?.value ?? this.getCellEditorValue(row, column, rowIndex);
    this.editorCaretPosition.set(input?.selectionStart ?? currentValue.length);
    const formulaInput = input instanceof HTMLInputElement ? input : null;

    if (this.handleFormulaReferenceNavigation(event, formulaInput, row, column, rowIndex)) {
      return;
    }

    if (this.handleFormulaSuggestionKeydown(event, formulaInput, row, column, rowIndex)) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.cancelEdit();
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      this.saveEdit(row, column, currentValue);
    }
  }

  override startEdit(rowIndex: number, column: GridColumn<T>): void {
    if (this.isSearchSelectColumn(column)) {
      this.focusSearchSelectCell(rowIndex, column);
      return;
    }

    super.startEdit(rowIndex, column);
    const row = this.processedData()[rowIndex];
    const nextValue = row ? String(this.getCellRawValue(row, column) ?? '') : '';
    this.editorDraftCellKey.set(this.getEditorCellKey(rowIndex, column));
    this.editorDraftValue.set(nextValue);
    this.editorCaretPosition.set(nextValue.length);
    this.syncFormulaSelectionState(rowIndex, column, nextValue);
    this.scheduleFormulaSuggestionOverlayRefresh();
  }

  beginTypingIntoActiveCell(initialValue: string): void {
    const active = this.activeCell();
    if (!active) {
      return;
    }

    const column = this.visibleColumns()[active.columnIndex];
    if (!column?.editable || this.config.editMode === 'none') {
      return;
    }

    this.startEdit(active.rowIndex, column);

    const applyInitialValue = (attempt = 0): void => {
      const input = this.getActiveEditorInput();
      if (!input) {
        if (attempt < 6) {
          requestAnimationFrame(() => applyInitialValue(attempt + 1));
        }
        this.scheduleFormulaSuggestionOverlayRefresh();
        return;
      }

      input.value = initialValue;
      if (typeof input.setSelectionRange === 'function') {
        input.setSelectionRange(initialValue.length, initialValue.length);
      }
      this.editorDraftCellKey.set(this.getEditorCellKey(active.rowIndex, column));
      this.editorDraftValue.set(initialValue);
      this.editorCaretPosition.set(initialValue.length);
      this.syncFormulaSelectionState(active.rowIndex, column, initialValue);
      this.scheduleFormulaSuggestionOverlayRefresh();
      this.componentCdr.markForCheck();
    };

    requestAnimationFrame(() => requestAnimationFrame(() => applyInitialValue()));
  }

  onDateCellValueChange(row: T, column: GridColumn<T>, rowIndex: number, value: string): void {
    if (this.isDatePickerDisabled(row, column)) {
      return;
    }

    const normalized = this.normalizeDateCellValue(value);
    this.editorDraftCellKey.set(this.getEditorCellKey(rowIndex, column));
    this.editorDraftValue.set(normalized);
    this.saveEdit(row, column, normalized);
  }

  private focusSearchSelectCell(
    rowIndex: number,
    column: GridColumn<T>,
    initialValue?: string
  ): void {
    const field = this.getColumnField(column);
    if (!field) {
      return;
    }

    const focusInput = (attempt = 0): void => {
      const input = this.hostElementRef.nativeElement.querySelector<HTMLInputElement>(
        `td[data-grid-row-index="${rowIndex}"][data-grid-column-field="${this.escapeCssAttributeValue(field)}"] input.ss-inline-input`
      );

      if (!input) {
        if (attempt < 6) {
          requestAnimationFrame(() => focusInput(attempt + 1));
        }
        return;
      }

      input.focus();
      if (initialValue !== undefined) {
        input.value = initialValue;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        if (typeof input.setSelectionRange === 'function') {
          input.setSelectionRange(initialValue.length, initialValue.length);
        }
      } else if (typeof input.select === 'function') {
        input.select();
      }
      this.componentCdr.markForCheck();
    };

    requestAnimationFrame(() => focusInput());
  }

  private escapeCssAttributeValue(value: string): string {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(value);
    }
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  override cancelEdit(): void {
    this.clearCellEditorState();
    super.cancelEdit();
  }

  override saveEdit(row: T, column: GridColumn<T>, value: unknown): void {
    const editing = this.editingCell();
    const normalizedValue =
      editing && this.editorDraftCellKey() === this.getEditorCellKey(editing.rowIndex, column)
        ? this.editorDraftValue()
        : value;
    this.clearCellEditorState();
    super.saveEdit(row, column, this.normalizeTypedCellValue(column, normalizedValue));
  }

  private normalizeTypedCellValue(column: GridColumn<T>, value: unknown): unknown {
    if (this.isDateEditorColumn(column) && typeof value === 'string') {
      return this.normalizeDateCellValue(value);
    }

    if ((column.type !== 'number' && column.cellType !== 'number') || typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    if (trimmed.startsWith('=')) {
      return value;
    }

    const parsed = Number(trimmed.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : value;
  }

  private normalizeDateCellValue(value: unknown): string {
    if (!value) {
      return '';
    }

    const raw = String(value).trim();
    if (!raw) {
      return '';
    }

    const isoMatch = raw.match(/\d{4}-\d{2}-\d{2}/);
    if (isoMatch) {
      return isoMatch[0];
    }

    const parsed = new Date(raw);
    if (!Number.isFinite(parsed.getTime())) {
      return raw;
    }

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  onCellEditorBlur(
    row: T,
    column: GridColumn<T>,
    input: HTMLInputElement | HTMLTextAreaElement,
    rowIndex: number
  ): void {
    const editing = this.editingCell();
    if (!editing || editing.rowIndex !== rowIndex || editing.field !== this.getColumnField(column)) {
      return;
    }

    this.suppressNextEditNavigation = true;
    try {
      this.saveEdit(row, column, input.value);
    } finally {
      this.suppressNextEditNavigation = false;
    }
  }

  override handleCellClick(row: T, column: GridColumn<T>, event: MouseEvent): void {
    if (this.tryInsertFormulaReference(row, column, event)) {
      return;
    }

    super.handleCellClick(row, column, event);
  }

  hasFormulaSuggestions(): boolean {
    return this.formulaSuggestionsOpen() && this.formulaSuggestions().length > 0;
  }

  getFormulaSuggestions(): FormulaSuggestion[] {
    return this.formulaSuggestions();
  }

  getFormulaSuggestionOverlayStyle(): Record<string, string> {
    return this.formulaSuggestionOverlayStyle();
  }

  getFormulaSuggestionClass(index: number): string {
    return index === this.formulaSuggestionActiveIndex()
      ? 'formula-suggestion is-active'
      : 'formula-suggestion';
  }

  applyFormulaSuggestionFromList(index: number, event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();
    const suggestion = this.formulaSuggestions()[index];
    if (!suggestion) {
      return;
    }

    this.applyFormulaSuggestion(suggestion);
  }

  handleCellPointerDown(row: T, column: GridColumn<T>, event: MouseEvent): void {
    if (!this.shouldCaptureFormulaReferencePointer(event)) {
      return;
    }

    if (!this.canReferenceCell(row, column)) {
      return;
    }

    event.preventDefault();
  }

  override getCellClass(row: T, column: GridColumn<T>): string {
    const baseClass = super.getCellClass(row, column);
    const rowIndex = this.getGlobalRowIndex(row);
    const columnIndex = this.visibleColumns().findIndex(
      candidate => this.getColumnField(candidate) === this.getColumnField(column)
    );

    if (rowIndex < 0 || columnIndex < 0) {
      return baseClass;
    }

    const classes = new Set(
      String(baseClass || '')
        .split(/\s+/)
        .filter(Boolean)
    );
    const cellKey = this.getFormulaPreviewCellKey(rowIndex, columnIndex);

    if (this.isFormulaSelectionMode()) {
      classes.add('formula-selectable-cell');
    }

    if (this.formulaReferencePreviewKeys().has(cellKey)) {
      classes.add('formula-reference-cell');
    }

    if (this.formulaOriginCellKey() === cellKey) {
      classes.add('formula-origin-cell');
    }

    return Array.from(classes).join(' ');
  }

  hasFormulaBarSelection(): boolean {
    return !!this.activeCell();
  }

  getFormulaBarReference(): string {
    const active = this.activeCell();
    if (!active) {
      return '--';
    }

    const column = this.visibleColumns()[active.columnIndex];
    const header = column?.header?.trim() || this.getCurrentCellReference();
    return `Row ${active.rowIndex + 1} · ${header}`;
  }

  getFormulaBarValue(): string {
    const activeKey = this.getFormulaBarCellKey();
    if (activeKey && this.formulaBarDraftCellKey === activeKey) {
      return this.formulaBarDraft;
    }

    return this.hasFormulaBarSelection() ? this.getCurrentCellFormula() : '';
  }

  onFormulaBarInput(value: string): void {
    const activeKey = this.getFormulaBarCellKey();
    if (!activeKey) {
      return;
    }

    this.formulaBarDraft = value;
    this.formulaBarDraftCellKey = activeKey;
  }

  applyFormulaBarValue(): void {
    if (!this.hasFormulaBarSelection()) {
      return;
    }

    this.onFormulaBarApply(this.getFormulaBarValue());
    this.resetFormulaBarDraft();
  }

  cancelFormulaBarValue(): void {
    this.resetFormulaBarDraft();
    this.onFormulaBarCancel();
  }

  onFormulaBarKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.applyFormulaBarValue();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelFormulaBarValue();
    }
  }

  getHeaderDisplayText(column: GridColumn<T>): string {
    const selectedValue = column.headerSelect?.value;
    if (selectedValue == null) {
      return column.header;
    }

    const displayFn = column.headerSelect?.displayFn as ((value: unknown) => string) | undefined;
    const displayedValue = displayFn ? displayFn(selectedValue) : String(selectedValue);
    return displayedValue.trim() || column.header;
  }

  onHeaderSelectValueChange(column: GridColumn<T>, value: unknown): void {
    const valueChange = column.headerSelect?.valueChange as
      | ((nextValue: unknown, targetColumn: GridColumn<T>) => void)
      | undefined;
    valueChange?.(value, column);
  }

  private cloneRowSnapshot(row: T): T {
    if (!row || typeof row !== 'object') {
      return row;
    }
    return { ...(row as Record<string, unknown>) } as T;
  }

  private resetFormulaBarDraft(): void {
    this.formulaBarDraft = '';
    this.formulaBarDraftCellKey = null;
  }

  private getFormulaBarCellKey(): string | null {
    const active = this.activeCell();
    return active ? `${active.rowIndex}:${active.columnIndex}` : null;
  }

  private getFormulaExampleToken(rowIndex: number): string {
    const numericColumns = this.visibleColumns().filter(
      column =>
        column.editable &&
        column.type === 'number' &&
        String(column.field) !== 'amount'
    );

    const first = numericColumns[0];
    const second = numericColumns[1];
    const rowNumber = rowIndex + 1;

    if (first && second) {
      return `${this.getFormulaColumnToken(first)}@${rowNumber} * ${this.getFormulaColumnToken(second)}@${rowNumber}`;
    }

    if (first) {
      return `${this.getFormulaColumnToken(first)}@${rowNumber}`;
    }

    return `columnName@${rowNumber}`;
  }

  private getFormulaHintTokens(rowIndex: number): string[] {
    const rowNumber = rowIndex + 1;
    return this.visibleColumns()
      .filter(column => column.editable && String(column.field) !== 'amount')
      .slice(0, 3)
      .map(column => `${this.getFormulaColumnToken(column)}@${rowNumber}`);
  }

  private getFormulaColumnToken(column: GridColumn<T>): string {
    const value = String(column.header || column.field || 'column').trim();
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
      return value;
    }

    return `[${value}]`;
  }

  private clearCellEditorState(): void {
    this.editorDraftCellKey.set(null);
    this.editorDraftValue.set('');
    this.editorCaretPosition.set(0);
    this.formulaReferencePreviewKeys.set(new Set());
    this.formulaOriginCellKey.set(null);
    this.formulaLastPickedReference.set(null);
    this.formulaSuggestions.set([]);
    this.formulaSuggestionsOpen.set(false);
    this.formulaSuggestionActiveIndex.set(0);
    this.formulaSuggestionReplaceRange.set(null);
    this.formulaKeyboardReferenceRange.set(null);
    this.formulaSuggestionOverlayStyle.set({});
    if (this.formulaSuggestionOverlayFrame != null) {
      cancelAnimationFrame(this.formulaSuggestionOverlayFrame);
      this.formulaSuggestionOverlayFrame = null;
    }
  }

  private syncFormulaSelectionState(rowIndex: number, column: GridColumn<T>, value: string): void {
    if (!this.supportsCellFormulaInput(column) || !this.isFormulaDraft(value)) {
      this.formulaReferencePreviewKeys.set(new Set());
      this.formulaOriginCellKey.set(null);
      this.formulaLastPickedReference.set(null);
      this.formulaSuggestions.set([]);
      this.formulaSuggestionsOpen.set(false);
      this.formulaSuggestionActiveIndex.set(0);
      this.formulaSuggestionReplaceRange.set(null);
      this.formulaKeyboardReferenceRange.set(null);
      this.formulaSuggestionOverlayStyle.set({});
      return;
    }

    const references = this.collectFormulaReferenceKeys(value);
    const visibleColumns = this.visibleColumns();
    const originColumnIndex = visibleColumns.findIndex(
      candidate => this.getColumnField(candidate) === this.getColumnField(column)
    );
    this.formulaReferencePreviewKeys.set(references);
    this.formulaOriginCellKey.set(
      originColumnIndex >= 0 ? this.getFormulaPreviewCellKey(rowIndex, originColumnIndex) : null
    );
    this.refreshFormulaSuggestions(rowIndex, column, value);
  }

  private isFormulaSelectionMode(): boolean {
    const editing = this.editingCell();
    if (!editing) {
      return false;
    }

    return this.isFormulaDraft(this.editorDraftValue());
  }

  private isFormulaDraft(value: string): boolean {
    return String(value || '').trim().startsWith('=');
  }

  private shouldCaptureFormulaReferencePointer(event: MouseEvent): boolean {
    if (!this.isFormulaSelectionMode()) {
      return false;
    }

    const target = event.target as HTMLElement | null;
    if (!target) {
      return false;
    }

    return !target.closest('.cell-editor-input');
  }

  private canReferenceCell(row: T, column: GridColumn<T>): boolean {
    if (!this.isFormulaSelectionMode()) {
      return false;
    }

    const rowIndex = this.getGlobalRowIndex(row);
    const columnIndex = this.visibleColumns().findIndex(
      candidate => this.getColumnField(candidate) === this.getColumnField(column)
    );
    if (rowIndex < 0 || columnIndex < 0) {
      return false;
    }

    const processedRow = this.processedData()[rowIndex] as Record<string, unknown> | undefined;
    return !processedRow?.['__appendRow'];
  }

  private tryInsertFormulaReference(row: T, column: GridColumn<T>, event: MouseEvent): boolean {
    if (!this.isFormulaSelectionMode() || !this.canReferenceCell(row, column)) {
      return false;
    }

    const input = this.getActiveEditorInput();
    const editing = this.editingCell();
    if (!input || !editing) {
      return false;
    }

    const rowIndex = this.getGlobalRowIndex(row);
    const columnIndex = this.visibleColumns().findIndex(
      candidate => this.getColumnField(candidate) === this.getColumnField(column)
    );
    if (rowIndex < 0 || columnIndex < 0) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    this.activeCell.set({ rowIndex, columnIndex });

    const token = event.shiftKey
      ? this.buildFormulaRangeToken(rowIndex, columnIndex)
      : this.buildFormulaReferenceToken(rowIndex, columnIndex);
    const inserted = this.insertOrReplaceFormulaReferenceToken(input, token);
    const nextValue = inserted.nextValue;
    const activeColumn = this.visibleColumns().find(
      candidate => this.getColumnField(candidate) === editing.field
    );

    if (!activeColumn) {
      return false;
    }

    this.editorDraftCellKey.set(this.getEditorCellKey(editing.rowIndex, activeColumn));
    this.editorDraftValue.set(nextValue);
    this.editorCaretPosition.set(inserted.end);
    this.formulaLastPickedReference.set({ rowIndex, columnIndex });
    this.formulaKeyboardReferenceRange.set({ start: inserted.start, end: inserted.end });
    this.syncFormulaSelectionState(editing.rowIndex, activeColumn, nextValue);
    this.scheduleFormulaSuggestionOverlayRefresh();
    this.componentCdr.markForCheck();
    return true;
  }

  private buildFormulaRangeToken(rowIndex: number, columnIndex: number): string {
    const last = this.formulaLastPickedReference();
    if (!last) {
      return this.buildFormulaReferenceToken(rowIndex, columnIndex);
    }

    return `${this.buildFormulaReferenceToken(last.rowIndex, last.columnIndex)}:${this.buildFormulaReferenceToken(
      rowIndex,
      columnIndex
    )}`;
  }

  private buildFormulaReferenceToken(rowIndex: number, columnIndex: number): string {
    const column = this.visibleColumns()[columnIndex];
    const columnToken = column
      ? this.getFormulaColumnToken(column)
      : this.spreadsheetFormulaEngine.getCellReferenceString(rowIndex, columnIndex);
    return `${columnToken}@${rowIndex + 1}`;
  }

  private insertOrReplaceFormulaReferenceToken(
    input: HTMLInputElement,
    token: string
  ): { nextValue: string; start: number; end: number } {
    const selectionStart = input.selectionStart ?? input.value.length;
    const selectionEnd = input.selectionEnd ?? input.value.length;
    const previousRange = this.formulaKeyboardReferenceRange();
    const shouldReplacePreviousReference =
      selectionStart === selectionEnd &&
      !!previousRange &&
      selectionStart === previousRange.end &&
      previousRange.start >= 0 &&
      previousRange.end <= input.value.length;

    const range = shouldReplacePreviousReference
      ? previousRange
      : { start: selectionStart, end: selectionEnd };
    return this.replaceEditorRange(input, range.start, range.end, token);
  }

  private replaceEditorRange(
    input: HTMLInputElement,
    start: number,
    end: number,
    token: string
  ): { nextValue: string; start: number; end: number } {
    const nextValue = input.value.slice(0, start) + token + input.value.slice(end);
    const nextCaret = start + token.length;
    input.value = nextValue;
    input.focus();
    if (typeof input.setSelectionRange === 'function') {
      input.setSelectionRange(nextCaret, nextCaret);
    }

    return { nextValue, start, end: nextCaret };
  }

  private getActiveEditorInput(): HTMLInputElement | null {
    const editing = this.editingCell();
    if (!editing) {
      return null;
    }

    const column = this.visibleColumns().find(
      candidate => this.getColumnField(candidate) === editing.field
    );
    if (!column) {
      return null;
    }

    const selector = `input[data-edit-row="${editing.rowIndex}"][data-edit-field="${this.getColumnField(column)}"]`;
    return this.hostElementRef.nativeElement.querySelector(selector);
  }

  private collectFormulaReferenceKeys(formula: string): Set<string> {
    const keys = new Set<string>();
    const value = String(formula || '');

    const addRange = (startRow: number, startCol: number, endRow: number, endCol: number): void => {
      const minRow = Math.min(startRow, endRow);
      const maxRow = Math.max(startRow, endRow);
      const minCol = Math.min(startCol, endCol);
      const maxCol = Math.max(startCol, endCol);
      for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
          keys.add(this.getFormulaPreviewCellKey(row, col));
        }
      }
    };

    value.replace(/\[([^\]]+)\]\s*@\s*(\d+)\s*:\s*\[([^\]]+)\]\s*@\s*(\d+)/g, (_match, startColumn, startRow, endColumn, endRow) => {
      this.appendNamedRangeKeys(keys, startColumn, startRow, endColumn, endRow, addRange);
      return '';
    });
    value.replace(/\b([A-Za-z_][A-Za-z0-9_]*)\s*@\s*(\d+)\s*:\s*([A-Za-z_][A-Za-z0-9_]*)\s*@\s*(\d+)/g, (_match, startColumn, startRow, endColumn, endRow) => {
      this.appendNamedRangeKeys(keys, startColumn, startRow, endColumn, endRow, addRange);
      return '';
    });
    value.replace(/\b([A-Z]+\d+)\s*:\s*([A-Z]+\d+)\b/g, (_match, startRef, endRef) => {
      const start = this.spreadsheetFormulaEngine.parseCellReference(startRef);
      const end = this.spreadsheetFormulaEngine.parseCellReference(endRef);
      if (start && end) {
        addRange(start.row, start.col, end.row, end.col);
      }
      return '';
    });
    value.replace(/\[([^\]]+)\]\s*@\s*(\d+)/g, (_match, columnToken, rowNumber) => {
      this.appendNamedCellKey(keys, columnToken, rowNumber);
      return '';
    });
    value.replace(/\b([A-Za-z_][A-Za-z0-9_]*)\s*@\s*(\d+)\b/g, (_match, columnToken, rowNumber) => {
      this.appendNamedCellKey(keys, columnToken, rowNumber);
      return '';
    });
    value.replace(/\b([A-Z]+\d+)\b/g, (_match, ref) => {
      const parsed = this.spreadsheetFormulaEngine.parseCellReference(ref);
      if (parsed) {
        keys.add(this.getFormulaPreviewCellKey(parsed.row, parsed.col));
      }
      return '';
    });

    return keys;
  }

  private appendNamedRangeKeys(
    keys: Set<string>,
    startColumnToken: string,
    startRowNumber: string,
    endColumnToken: string,
    endRowNumber: string,
    addRange: (startRow: number, startCol: number, endRow: number, endCol: number) => void
  ): void {
    const start = this.resolveNamedFormulaCoordinate(startColumnToken, startRowNumber);
    const end = this.resolveNamedFormulaCoordinate(endColumnToken, endRowNumber);
    if (start && end) {
      addRange(start.rowIndex, start.columnIndex, end.rowIndex, end.columnIndex);
    }
  }

  private appendNamedCellKey(
    keys: Set<string>,
    columnToken: string,
    rowNumber: string
  ): void {
    const coordinate = this.resolveNamedFormulaCoordinate(columnToken, rowNumber);
    if (coordinate) {
      keys.add(this.getFormulaPreviewCellKey(coordinate.rowIndex, coordinate.columnIndex));
    }
  }

  private resolveNamedFormulaCoordinate(
    columnToken: string,
    rowNumber: string
  ): { rowIndex: number; columnIndex: number } | null {
    const normalizedRow = Number(rowNumber);
    if (!Number.isInteger(normalizedRow) || normalizedRow <= 0) {
      return null;
    }

    const normalizedToken = this.normalizeFormulaToken(columnToken);
    const columnIndex = this.visibleColumns().findIndex(candidate => {
      const fieldToken = this.normalizeFormulaToken(String(candidate.field));
      const headerToken = this.normalizeFormulaToken(String(candidate.header || candidate.field));
      return normalizedToken === fieldToken || normalizedToken === headerToken;
    });

    return columnIndex >= 0 ? { rowIndex: normalizedRow - 1, columnIndex } : null;
  }

  private normalizeFormulaToken(value: string): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/%/g, 'pct')
      .replace(/[^a-z0-9]+/g, '');
  }

  private getFormulaPreviewCellKey(rowIndex: number, columnIndex: number): string {
    return `${rowIndex}:${columnIndex}`;
  }

  private getEditorCellKey(rowIndex: number, column: GridColumn<T>): string {
    return `${rowIndex}:${this.getColumnField(column)}`;
  }

  private handleFormulaSuggestionKeydown(
    event: KeyboardEvent,
    input: HTMLInputElement | null,
    row: T,
    column: GridColumn<T>,
    rowIndex: number
  ): boolean {
    if (!this.hasFormulaSuggestions()) {
      return false;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      this.formulaSuggestionActiveIndex.update(index =>
        Math.min(index + 1, this.formulaSuggestions().length - 1)
      );
      return true;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      this.formulaSuggestionActiveIndex.update(index => Math.max(index - 1, 0));
      return true;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      const suggestion = this.formulaSuggestions()[this.formulaSuggestionActiveIndex()];
      if (suggestion) {
        this.applyFormulaSuggestion(suggestion);
      }
      return true;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      const suggestion = this.formulaSuggestions()[this.formulaSuggestionActiveIndex()];
      if (suggestion) {
        event.preventDefault();
        event.stopPropagation();
        this.applyFormulaSuggestion(suggestion);
        return true;
      }
    }

    return false;
  }

  private handleFormulaReferenceNavigation(
    event: KeyboardEvent,
    input: HTMLInputElement | null,
    row: T,
    column: GridColumn<T>,
    rowIndex: number
  ): boolean {
    if (!this.isFormulaSelectionMode() || !input) {
      return false;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) {
      return false;
    }

    const keyMap: Record<string, { rowDelta: number; colDelta: number }> = {
      ArrowUp: { rowDelta: -1, colDelta: 0 },
      ArrowDown: { rowDelta: 1, colDelta: 0 },
      ArrowLeft: { rowDelta: 0, colDelta: -1 },
      ArrowRight: { rowDelta: 0, colDelta: 1 }
    };
    const move = keyMap[event.key];
    if (!move) {
      return false;
    }

    const editing = this.editingCell();
    if (!editing) {
      return false;
    }

    const active = this.activeCell();
    const visibleColumns = this.visibleColumns();
    const columnIndex = visibleColumns.findIndex(
      candidate => this.getColumnField(candidate) === editing.field
    );
    const baseRowIndex = active?.rowIndex ?? rowIndex;
    const baseColumnIndex = active?.columnIndex ?? columnIndex;
    const nextRowIndex = Math.max(
      0,
      Math.min(baseRowIndex + move.rowDelta, this.processedData().length - 1)
    );
    const nextColumnIndex = Math.max(
      0,
      Math.min(baseColumnIndex + move.colDelta, visibleColumns.length - 1)
    );

    event.preventDefault();
    event.stopPropagation();
    this.activeCell.set({ rowIndex: nextRowIndex, columnIndex: nextColumnIndex });

    const token = event.shiftKey
      ? this.buildFormulaRangeToken(nextRowIndex, nextColumnIndex)
      : this.buildFormulaReferenceToken(nextRowIndex, nextColumnIndex);
    const range = this.formulaKeyboardReferenceRange() ?? {
      start: input.selectionStart ?? input.value.length,
      end: input.selectionEnd ?? input.value.length
    };
    const replaced = this.replaceEditorRange(input, range.start, range.end, token);
    const activeColumn = visibleColumns[columnIndex];
    if (!activeColumn) {
      return true;
    }

    this.editorDraftCellKey.set(this.getEditorCellKey(editing.rowIndex, activeColumn));
    this.editorDraftValue.set(replaced.nextValue);
    this.editorCaretPosition.set(replaced.end);
    this.formulaLastPickedReference.set({ rowIndex: nextRowIndex, columnIndex: nextColumnIndex });
    this.formulaKeyboardReferenceRange.set({ start: replaced.start, end: replaced.end });
    this.syncFormulaSelectionState(editing.rowIndex, activeColumn, replaced.nextValue);
    this.componentCdr.markForCheck();
    return true;
  }

  private refreshFormulaSuggestions(
    rowIndex: number,
    column: GridColumn<T>,
    value: string
  ): void {
    if (!this.supportsCellFormulaInput(column) || !this.isFormulaDraft(value)) {
      this.formulaSuggestions.set([]);
      this.formulaSuggestionsOpen.set(false);
      this.formulaSuggestionActiveIndex.set(0);
      this.formulaSuggestionReplaceRange.set(null);
      return;
    }

    const tokenContext = this.getFormulaTokenContext(value, this.editorCaretPosition());
    const rowNumber = rowIndex + 1;
    const normalizedQuery = this.normalizeFormulaToken(tokenContext.token);
    const suggestions: FormulaSuggestion[] = [];
    const functionTemplates: Array<{ label: string; insertText: string; detail: string }> = [
      { label: 'SUM', insertText: 'SUM()', detail: 'Add values or ranges' },
      { label: 'AVERAGE', insertText: 'AVERAGE()', detail: 'Average values or ranges' },
      { label: 'COUNT', insertText: 'COUNT()', detail: 'Count numeric values' },
      { label: 'MAX', insertText: 'MAX()', detail: 'Largest value' },
      { label: 'MIN', insertText: 'MIN()', detail: 'Smallest value' },
      { label: 'PRODUCT', insertText: 'PRODUCT()', detail: 'Multiply values or ranges' },
      { label: 'IF', insertText: 'IF(, , )', detail: 'Conditional result' },
      { label: 'ROUND', insertText: 'ROUND(, 0)', detail: 'Round to digits' },
      { label: 'ROUNDUP', insertText: 'ROUNDUP(, 0)', detail: 'Round away from zero' },
      { label: 'ROUNDDOWN', insertText: 'ROUNDDOWN(, 0)', detail: 'Round toward zero' },
      { label: 'ABS', insertText: 'ABS()', detail: 'Absolute value' },
      { label: 'SQRT', insertText: 'SQRT()', detail: 'Square root' },
      { label: 'POWER', insertText: 'POWER(, )', detail: 'Raise to a power' },
      { label: 'MOD', insertText: 'MOD(, )', detail: 'Remainder after division' },
      { label: 'CEILING', insertText: 'CEILING(, 1)', detail: 'Round up to step' },
      { label: 'FLOOR', insertText: 'FLOOR(, 1)', detail: 'Round down to step' },
      { label: 'AND', insertText: 'AND()', detail: 'All conditions are true' },
      { label: 'OR', insertText: 'OR()', detail: 'Any condition is true' },
      { label: 'NOT', insertText: 'NOT()', detail: 'Invert a condition' }
    ];

    for (const fn of functionTemplates) {
      if (!normalizedQuery || this.normalizeFormulaToken(fn.label).startsWith(normalizedQuery)) {
        suggestions.push({ ...fn, kind: 'function' });
      }
    }

    for (const candidate of this.visibleColumns()) {
      if (!candidate.editable || this.getColumnField(candidate) === 'amount') {
        continue;
      }

      const token = `${this.getFormulaColumnToken(candidate)}@${rowNumber}`;
      const label = token;
      if (
        !normalizedQuery ||
        this.normalizeFormulaToken(label).includes(normalizedQuery) ||
        this.normalizeFormulaToken(String(candidate.header || candidate.field)).includes(normalizedQuery)
      ) {
        suggestions.push({
          label,
          insertText: token,
          detail: String(candidate.header || candidate.field),
          kind: 'reference'
        });
      }
    }

    this.formulaSuggestions.set(suggestions.slice(0, 10));
    this.formulaSuggestionsOpen.set(suggestions.length > 0);
    this.formulaSuggestionActiveIndex.set(0);
    this.formulaSuggestionReplaceRange.set({ start: tokenContext.start, end: tokenContext.end });
    if (!suggestions.length) {
      this.formulaSuggestionOverlayStyle.set({});
    }
  }

  private getFormulaTokenContext(
    value: string,
    caretPosition: number
  ): { token: string; start: number; end: number } {
    const caret = Math.max(0, Math.min(caretPosition, value.length));
    const isTokenChar = (character: string): boolean => /[A-Za-z0-9_@\[\]%]/.test(character);
    let start = caret;
    let end = caret;

    while (start > 0 && isTokenChar(value[start - 1])) {
      start -= 1;
    }

    while (end < value.length && isTokenChar(value[end])) {
      end += 1;
    }

    return {
      token: value.slice(start, end),
      start,
      end
    };
  }

  private applyFormulaSuggestion(suggestion: FormulaSuggestion): void {
    const input = this.getActiveEditorInput();
    const editing = this.editingCell();
    if (!input || !editing) {
      return;
    }

    const activeColumn = this.visibleColumns().find(
      candidate => this.getColumnField(candidate) === editing.field
    );
    if (!activeColumn) {
      return;
    }

    const replaceRange = this.formulaSuggestionReplaceRange() ?? {
      start: input.selectionStart ?? input.value.length,
      end: input.selectionEnd ?? input.value.length
    };
    const replaced = this.replaceEditorRange(
      input,
      replaceRange.start,
      replaceRange.end,
      suggestion.insertText
    );
    let nextCaret = replaced.end;
    if (suggestion.kind === 'function') {
      const openParenIndex = replaced.start + suggestion.insertText.indexOf('(') + 1;
      nextCaret = Math.max(openParenIndex, 0);
      if (typeof input.setSelectionRange === 'function') {
        input.setSelectionRange(nextCaret, nextCaret);
      }
    }

    this.editorDraftCellKey.set(this.getEditorCellKey(editing.rowIndex, activeColumn));
    this.editorDraftValue.set(input.value);
    this.editorCaretPosition.set(nextCaret);
    this.formulaSuggestionsOpen.set(false);
    this.formulaSuggestionReplaceRange.set(null);
    this.formulaKeyboardReferenceRange.set(null);
    this.syncFormulaSelectionState(editing.rowIndex, activeColumn, input.value);
    this.scheduleFormulaSuggestionOverlayRefresh();
    this.componentCdr.markForCheck();
  }

  private scheduleFormulaSuggestionOverlayRefresh(attempt = 0): void {
    if (this.formulaSuggestionOverlayFrame != null) {
      cancelAnimationFrame(this.formulaSuggestionOverlayFrame);
      this.formulaSuggestionOverlayFrame = null;
    }

    if (!this.hasFormulaSuggestions()) {
      this.formulaSuggestionOverlayStyle.set({});
      return;
    }

    this.formulaSuggestionOverlayFrame = requestAnimationFrame(() => {
      this.formulaSuggestionOverlayFrame = null;
      const refreshed = this.refreshFormulaSuggestionOverlay();
      if (!refreshed && attempt < 6 && this.hasFormulaSuggestions()) {
        this.scheduleFormulaSuggestionOverlayRefresh(attempt + 1);
      }
    });
  }

  private refreshFormulaSuggestionOverlay(): boolean {
    if (!this.hasFormulaSuggestions()) {
      this.formulaSuggestionOverlayStyle.set({});
      return false;
    }

    const input = this.getActiveEditorInput();
    if (!input) {
      this.formulaSuggestionOverlayStyle.set({});
      return false;
    }

    const rect = input.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const width = Math.max(260, Math.min(340, Math.max(rect.width, 260)));
    const left = Math.max(8, Math.min(rect.left, Math.max(8, viewportWidth - width - 8)));
    const top = rect.bottom + 6;

    this.formulaSuggestionOverlayStyle.set({
      position: 'fixed',
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`
    });
    return true;
  }
}
