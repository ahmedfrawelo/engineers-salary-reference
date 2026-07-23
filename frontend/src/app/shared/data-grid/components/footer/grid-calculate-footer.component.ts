import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject
} from '@angular/core';
import type {
  GridAggregateFooterChangeEvent,
  GridAggregateFooterConfig,
  GridAggregateFooterResult,
  GridAggregateOperation,
  GridAggregateScope,
  GridAggregateScopeOption,
  GridColumn,
  GridRowRecord
} from '../../models';
import { resolveDataGridMainScrollHost } from '../../utils/dom';
import {
  resolveUnifiedDataGridRowActionsColumnWidth,
  resolveUnifiedDataGridSelectionColumnWidth
} from '../../utils/layout';

type CalculateFooterOperationOption = {
  value: GridAggregateOperation;
  label: string;
  description: string;
};

type CalculateFooterPendingOperation = GridAggregateOperation | '__clear__';

export type CalculateFooterLayout = {
  selectionWidth: number;
  actionWidth: number;
  columnWidths: number[];
  totalWidth: number;
  tableWidth: number;
};

type CalculateFooterPanelRect = Pick<DOMRect, 'bottom' | 'left' | 'top'>;

type CalculateFooterPanelPositionOptions = {
  panelWidth: number;
  panelHeight: number;
  margin?: number;
  gap?: number;
};

const DEFAULT_SCOPE_OPTIONS: readonly GridAggregateScopeOption[] = [
  { value: 'filtered', label: 'Filtered', shortLabel: 'Fx', description: 'After current filters' },
  { value: 'page', label: 'Page', shortLabel: 'Pg', description: 'Current page only' },
  { value: 'all', label: 'All Data', shortLabel: 'All', description: 'Entire dataset' }
];

const DEFAULT_OPERATION_OPTIONS: readonly CalculateFooterOperationOption[] = [
  { value: 'sum', label: 'Sum', description: 'Total value' },
  { value: 'avg', label: 'Average', description: 'Average value' },
  { value: 'count', label: 'Count', description: 'Count rows' },
  { value: 'min', label: 'Min', description: 'Minimum value' },
  { value: 'max', label: 'Max', description: 'Maximum value' },
  { value: 'distinct', label: 'Distinct', description: 'Distinct values' },
  { value: 'median', label: 'Median', description: 'Median value' },
  { value: 'percent', label: 'Percent', description: 'Percent coverage' }
];

type CalculateFooterLayoutOptions = {
  hasSelection: boolean;
  hasActions: boolean;
  columnCount: number;
  selectionFallback?: number;
  actionFallback?: number;
  columnFallback?: number;
};

function normalizeMeasuredWidth(width: number | undefined, fallback: number): number {
  const measured = Number(width) || 0;
  if (measured <= 0) {
    return fallback;
  }
  return Math.round(measured * 1000) / 1000;
}

export function resolveGridCalculateFooterMeasuredWidth(
  element: Element | null | undefined,
  fallback: number
): number {
  const inlineWidth = Number.parseFloat(
    (element as HTMLElement | null | undefined)?.style?.width || ''
  );
  if (Number.isFinite(inlineWidth) && inlineWidth > 0) {
    return inlineWidth;
  }

  if (typeof window !== 'undefined' && element instanceof Element) {
    const computedWidth = Number.parseFloat(window.getComputedStyle(element).width || '');
    if (Number.isFinite(computedWidth) && computedWidth > 0) {
      return computedWidth;
    }
  }

  const rectWidth =
    (element as HTMLElement | null | undefined)?.getBoundingClientRect?.().width ?? 0;
  return rectWidth > 0 ? rectWidth : fallback;
}

export function resolveGridCalculateFooterRenderedWidth(
  element: Element | null | undefined,
  fallback: number
): number {
  const rectWidth =
    (element as HTMLElement | null | undefined)?.getBoundingClientRect?.().width ?? 0;
  if (rectWidth > 0) {
    return Math.round(rectWidth * 1000) / 1000;
  }

  if (typeof window !== 'undefined' && element instanceof Element) {
    const computedWidth = Number.parseFloat(window.getComputedStyle(element).width || '');
    if (Number.isFinite(computedWidth) && computedWidth > 0) {
      return Math.round(computedWidth * 1000) / 1000;
    }
  }

  const inlineWidth = Number.parseFloat(
    (element as HTMLElement | null | undefined)?.style?.width || ''
  );
  if (Number.isFinite(inlineWidth) && inlineWidth > 0) {
    return inlineWidth;
  }

  return fallback;
}

export function resolveGridCalculateFooterLayout(
  referenceWidths: readonly number[],
  options: CalculateFooterLayoutOptions
): CalculateFooterLayout {
  const selectionFallback =
    options.selectionFallback ?? resolveUnifiedDataGridSelectionColumnWidth();
  const actionFallback = options.actionFallback ?? resolveUnifiedDataGridRowActionsColumnWidth();
  const columnFallback = options.columnFallback ?? 140;

  let cursor = 0;
  const selectionWidth = options.hasSelection
    ? normalizeMeasuredWidth(referenceWidths[cursor], selectionFallback)
    : 0;
  if (options.hasSelection) {
    cursor += 1;
  }

  const actionOffset = options.hasActions ? 1 : 0;
  const dataEnd = Math.max(cursor, referenceWidths.length - actionOffset);
  const dataWidths = referenceWidths.slice(cursor, dataEnd);
  const columnWidths = Array.from({ length: options.columnCount }, (_, index) =>
    normalizeMeasuredWidth(dataWidths[index], columnFallback)
  );
  const actionWidth = options.hasActions
    ? normalizeMeasuredWidth(referenceWidths[dataEnd], actionFallback)
    : 0;

  const totalWidth =
    selectionWidth + actionWidth + columnWidths.reduce((sum, width) => sum + width, 0);

  return {
    selectionWidth,
    actionWidth,
    columnWidths,
    totalWidth,
    tableWidth: totalWidth
  };
}

function hasExplicitGridCalculateFooterColumnWidth(
  column: Pick<GridColumn, 'width'> | null | undefined
): boolean {
  if (typeof column?.width === 'number') {
    return Number.isFinite(column.width);
  }
  if (typeof column?.width === 'string') {
    return column.width.trim().length > 0;
  }
  return false;
}

function resolveGridCalculateFooterColumnFallbackWidth(
  column: Pick<GridColumn, 'width' | 'minWidth'> | null | undefined,
  fallback: number
): number {
  const width = column?.width;
  if (typeof width === 'number' && Number.isFinite(width) && width > 0) {
    return Math.round(width * 1000) / 1000;
  }

  if (typeof width === 'string') {
    const trimmed = width.trim();
    if (trimmed.endsWith('px')) {
      const parsed = Number.parseFloat(trimmed);
      if (Number.isFinite(parsed) && parsed > 0) {
        return Math.round(parsed * 1000) / 1000;
      }
    }
  }

  const minWidth = column?.minWidth;
  if (typeof minWidth === 'number' && Number.isFinite(minWidth) && minWidth > 0) {
    return Math.round(minWidth * 1000) / 1000;
  }

  return fallback;
}

export function resolveGridCalculateFooterStretchedLayout<T = GridRowRecord>(
  layout: CalculateFooterLayout,
  columns: readonly GridColumn<T>[],
  containerWidth: number
): CalculateFooterLayout {
  const normalizedContainerWidth = Math.max(0, Math.round(Number(containerWidth) || 0));
  const extraWidth = Math.max(0, normalizedContainerWidth - layout.totalWidth);

  if (extraWidth <= 0) {
    return {
      ...layout,
      tableWidth: resolveGridCalculateFooterTableWidth(layout.totalWidth, normalizedContainerWidth)
    };
  }

  const columnWidths = [...layout.columnWidths];
  const flexibleIndices = columns
    .map((column, index) => (!hasExplicitGridCalculateFooterColumnWidth(column) ? index : -1))
    .filter(index => index >= 0);

  if (flexibleIndices.length > 0) {
    const flexibleBaseTotal =
      flexibleIndices.reduce((sum, index) => sum + (columnWidths[index] ?? 0), 0) ||
      flexibleIndices.length;
    let remaining = extraWidth;

    flexibleIndices.forEach((index, position) => {
      const currentWidth = columnWidths[index] ?? 0;
      const isLast = position === flexibleIndices.length - 1;
      const share = isLast
        ? remaining
        : Math.round((extraWidth * currentWidth) / flexibleBaseTotal);
      columnWidths[index] = currentWidth + share;
      remaining -= share;
    });
  }

  const totalWidth =
    layout.selectionWidth +
    layout.actionWidth +
    columnWidths.reduce((sum, width) => sum + width, 0);

  return {
    ...layout,
    columnWidths,
    totalWidth,
    tableWidth: resolveGridCalculateFooterTableWidth(totalWidth, normalizedContainerWidth)
  };
}

export function resolveGridCalculateFooterTableWidth(
  totalWidth: number,
  referenceTableWidth: number | null | undefined
): number {
  const normalizedReferenceWidth = Number(referenceTableWidth) || 0;
  return Math.max(totalWidth, normalizedReferenceWidth > 0 ? normalizedReferenceWidth : totalWidth);
}

export function resolveGridCalculateFooterHostTableWidth(
  host: HTMLElement | null | undefined,
  fallback: number
): number {
  const variableWidth = Number.parseFloat(
    host?.style?.getPropertyValue('--dg-grid-table-width')?.trim() || ''
  );
  if (Number.isFinite(variableWidth) && variableWidth > 0) {
    return variableWidth;
  }

  if (typeof window !== 'undefined' && host instanceof HTMLElement) {
    const computedWidth = Number.parseFloat(
      window.getComputedStyle(host).getPropertyValue('--dg-grid-table-width') || ''
    );
    if (Number.isFinite(computedWidth) && computedWidth > 0) {
      return computedWidth;
    }
  }

  return fallback;
}

export function resolveGridCalculateFooterPanelPosition(
  anchorRect: CalculateFooterPanelRect,
  viewportWidth: number,
  viewportHeight: number,
  options: CalculateFooterPanelPositionOptions
): { left: number; top: number } {
  const margin = options.margin ?? 12;
  const gap = options.gap ?? 8;
  const maxLeft = Math.max(margin, viewportWidth - options.panelWidth - margin);
  const left = Math.min(Math.max(margin, anchorRect.left), maxLeft);

  const spaceAbove = Math.max(0, anchorRect.top - margin);
  const spaceBelow = Math.max(0, viewportHeight - anchorRect.bottom - margin);
  const preferAbove = spaceAbove >= options.panelHeight || spaceAbove >= spaceBelow;
  const unclampedTop = preferAbove
    ? anchorRect.top - options.panelHeight - gap
    : anchorRect.bottom + gap;
  const maxTop = Math.max(margin, viewportHeight - options.panelHeight - margin);
  const top = Math.min(Math.max(margin, unclampedTop), maxTop);

  return { left, top };
}

export function resolveGridCalculateFooterCurrentOperation<T = GridRowRecord>(
  column: GridColumn<T>,
  config: GridAggregateFooterConfig<T> | null | undefined
): GridAggregateOperation | null {
  const configuredOperation = config?.currentOperation?.(column);
  if (configuredOperation !== undefined) {
    return configuredOperation;
  }
  return (column.aggregate as GridAggregateOperation | null | undefined) ?? null;
}

export function isGridCalculateFooterActionsCell(element: Element | null | undefined): boolean {
  if (!(element instanceof Element)) {
    return false;
  }

  return (
    element.classList.contains('actions-cell') || element.classList.contains('row-actions-cell')
  );
}

export function normalizeGridCalculateFooterFieldKey(field: unknown): string {
  return String(field ?? '')
    .trim()
    .replace(/_/g, '')
    .toLowerCase();
}

export function isGridCalculateFooterColumnMenuStale<T = GridRowRecord>(
  activeColumnField: string | null | undefined,
  columns: readonly GridColumn<T>[] | null | undefined
): boolean {
  if (!activeColumnField) {
    return false;
  }

  return !(columns ?? []).some(
    column => normalizeGridCalculateFooterFieldKey(column.field) === activeColumnField
  );
}

@Component({
  selector: 'grid-calculate-footer',
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone: false,
  templateUrl: './grid-calculate-footer.component.html',
  styleUrls: ['./grid-calculate-footer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GridCalculateFooterComponent<T = GridRowRecord>
  implements AfterViewInit, OnChanges, OnDestroy
{
  protected readonly clearOperationValue = '__clear__';
  private _columns: readonly GridColumn<T>[] = [];
  @Input()
  set columns(value: readonly GridColumn<T>[] | null | undefined) {
    this._columns = value ?? [];
    this.applyFallbackLayout();
  }
  get columns(): readonly GridColumn<T>[] {
    return this._columns;
  }

  private _config: GridAggregateFooterConfig<T> | null = null;
  @Input()
  set config(value: GridAggregateFooterConfig<T> | null | undefined) {
    this._config = value ?? null;
  }
  get config(): GridAggregateFooterConfig<T> | null {
    return this._config;
  }

  private readonly _footerChange = new EventEmitter<GridAggregateFooterChangeEvent<T>>();
  @Output()
  get footerChange(): EventEmitter<GridAggregateFooterChangeEvent<T>> {
    return this._footerChange;
  }
  private readonly hostRef = inject(ElementRef<HTMLElement>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);
  protected hasMeasuredLayout = false;
  protected layout: CalculateFooterLayout = {
    selectionWidth: resolveUnifiedDataGridSelectionColumnWidth(),
    actionWidth: 0,
    columnWidths: [],
    totalWidth: 0,
    tableWidth: 0
  };

  protected scopeMenuOpen = false;
  protected scopeMenuPosition = { left: 12, top: 12 };
  protected activeColumnField: string | null = null;
  protected menuPosition = { left: 12, top: 12 };
  protected pendingOperation: CalculateFooterPendingOperation | null = null;

  private gridHost: HTMLElement | null = null;
  private scrollSource: HTMLElement | null = null;
  private referenceTable: HTMLTableElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private headerMutationObserver: MutationObserver | null = null;
  private scrollListener: ((event: Event) => void) | null = null;
  private pendingBindRaf: number | null = null;
  private pendingMeasureRaf: number | null = null;
  private menuDomListenersAttached = false;
  private readonly documentPointerDownHandler = (event: PointerEvent) =>
    this.onDocumentPointerDown(event);
  private readonly documentKeydownHandler = (event: KeyboardEvent) => this.onDocumentKeydown(event);

  ngAfterViewInit(): void {
    this.scheduleBind();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.isEnabled()) {
      this.closeMenus();
      this.hasMeasuredLayout = false;
      this.cleanupBindings();
      return;
    }

    this.closeStaleColumnMenu();
    this.applyFallbackLayout();
    if (this.shouldRebind(changes)) {
      this.scheduleBind();
    }
  }

  ngOnDestroy(): void {
    this.cleanupBindings();
    this.detachMenuDomListeners();
    if (this.pendingBindRaf != null) {
      cancelAnimationFrame(this.pendingBindRaf);
      this.pendingBindRaf = null;
    }
    if (this.pendingMeasureRaf != null) {
      cancelAnimationFrame(this.pendingMeasureRaf);
      this.pendingMeasureRaf = null;
    }
  }

  private onDocumentPointerDown(event: PointerEvent): void {
    if (!this.scopeMenuOpen && !this.activeColumnField) {
      return;
    }
    const target = event.target as Node | null;
    if (target && this.hostRef.nativeElement.contains(target)) {
      return;
    }
    this.closeMenus();
  }

  private onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') {
      return;
    }
    this.closeMenus();
  }

  protected trackByField(index: number, column: GridColumn<T>): string {
    return `${index}:${this.getFieldKey(column)}`;
  }

  protected isEnabled(): boolean {
    return !!this.config?.enabled;
  }

  protected hasStandaloneScopeCell(): boolean {
    return this.layout.selectionWidth > 0;
  }

  protected hasActionsCell(): boolean {
    return this.layout.actionWidth > 0;
  }

  protected columnWidth(index: number): number {
    return this.layout.columnWidths[index] ?? 140;
  }

  protected scopeCellStyle(): Record<string, string> | null {
    if (!this.hasStandaloneScopeCell()) {
      return null;
    }
    return {
      left: '0px'
    };
  }

  protected cellStyle(
    index: number,
    column: GridColumn<T>
  ): Record<string, string> | null | undefined {
    if (column.pinned === 'left') {
      return {
        left: `${this.getPinnedLeftOffset(index)}px`
      };
    }

    if (column.pinned === 'right') {
      return {
        right: `${this.getPinnedRightOffset(index)}px`
      };
    }

    return null;
  }

  protected scopeOptions(): readonly GridAggregateScopeOption[] {
    return this.config?.scopeOptions?.length ? this.config.scopeOptions : DEFAULT_SCOPE_OPTIONS;
  }

  protected scopeBadgeLabel(): string {
    const activeScope = this.config?.scope ?? 'filtered';
    const option = this.scopeOptions().find(candidate => candidate.value === activeScope);
    return option?.shortLabel?.trim() || option?.label || 'Fx';
  }

  protected scopeTitle(): string {
    const option = this.scopeOptions().find(
      candidate => candidate.value === (this.config?.scope ?? 'filtered')
    );
    const label = option?.label ?? 'Filtered';
    const summary = String(this.config?.summaryText ?? '').trim();
    return summary ? `${label} - ${summary}` : label;
  }

  protected currentOperation(column: GridColumn<T>): GridAggregateOperation | null {
    return resolveGridCalculateFooterCurrentOperation(column, this.config);
  }

  protected primaryText(column: GridColumn<T>): string {
    const operation = this.currentOperation(column);
    if (this.config?.loading) {
      const existingResult = operation ? this.resultFor(column) : null;
      if (existingResult) {
        const formatter = this.config?.formatValue;
        const formatted = formatter
          ? formatter(column, existingResult)
          : this.defaultFormatValue(existingResult);
        return String(formatted ?? '-').trim() || '-';
      }
      return this.config?.loadingPrimaryText?.trim() || '...';
    }
    if (!operation) {
      return this.config?.emptyPrimaryText?.trim() || 'Calculate';
    }
    const result = this.resultFor(column);
    if (!result) {
      return '-';
    }
    const formatter = this.config?.formatValue;
    const formatted = formatter ? formatter(column, result) : this.defaultFormatValue(result);
    return String(formatted ?? '-').trim() || '-';
  }

  protected operationBadge(column: GridColumn<T>): string {
    const operation = this.currentOperation(column);
    if (!operation) {
      return '';
    }
    switch (operation) {
      case 'avg':
        return 'AVG';
      case 'count':
        return 'COUNT';
      case 'distinct':
        return 'DISTINCT';
      case 'median':
        return 'MEDIAN';
      case 'percent':
        return 'PCT';
      default:
        return operation.toUpperCase();
    }
  }

  protected isPlaceholder(column: GridColumn<T>): boolean {
    return !this.currentOperation(column);
  }

  protected isActive(column: GridColumn<T>): boolean {
    return !!this.currentOperation(column);
  }

  protected toggleScopeMenu(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const nextState = !this.scopeMenuOpen;
    this.activeColumnField = null;
    this.pendingOperation = null;
    this.scopeMenuOpen = nextState;
    if (nextState) {
      this.attachMenuDomListeners();
      this.scopeMenuPosition = this.resolvePanelPosition(
        event.currentTarget as HTMLElement,
        220,
        190
      );
    } else {
      this.detachMenuDomListeners();
    }
    this.cdr.markForCheck();
  }

  protected toggleColumnMenu(column: GridColumn<T>, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const field = this.getFieldKey(column);
    const nextField = this.activeColumnField === field ? null : field;
    this.scopeMenuOpen = false;
    this.activeColumnField = nextField;
    if (nextField) {
      this.attachMenuDomListeners();
      this.pendingOperation = this.currentOperation(column);
      this.menuPosition = this.resolvePanelPosition(event.currentTarget as HTMLElement, 220, 156);
    } else {
      this.pendingOperation = null;
      this.detachMenuDomListeners();
    }
    this.cdr.markForCheck();
  }

  protected selectScope(scope: GridAggregateScope, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.scopeMenuOpen = false;
    if (scope !== (this.config?.scope ?? 'filtered')) {
      this.footerChange.emit({ type: 'scope', scope });
    }
    this.detachMenuDomListeners();
    this.cdr.markForCheck();
  }

  protected selectOperation(
    column: GridColumn<T>,
    operation: GridAggregateOperation | null,
    event: MouseEvent
  ): void {
    event.preventDefault();
    event.stopPropagation();
    this.activeColumnField = null;
    this.pendingOperation = null;
    this.detachMenuDomListeners();
    this.footerChange.emit({ type: 'operation', column, operation });
    this.cdr.markForCheck();
  }

  protected operationSelectValue(column: GridColumn<T>): string {
    const pending = this.pendingOperation;
    if (pending) {
      return pending;
    }

    return this.currentOperation(column) ?? '';
  }

  protected updatePendingOperation(value: string): void {
    const normalized = value.trim();
    if (!normalized) {
      this.pendingOperation = null;
      return;
    }

    this.pendingOperation =
      normalized === this.clearOperationValue
        ? this.clearOperationValue
        : (normalized as GridAggregateOperation);
  }

  protected canApplyPendingOperation(column: GridColumn<T>): boolean {
    return this.resolvePendingOperation(column) !== this.currentOperation(column);
  }

  protected applyPendingOperation(column: GridColumn<T>, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const nextOperation = this.resolvePendingOperation(column);
    if (nextOperation === this.currentOperation(column)) {
      this.activeColumnField = null;
      this.pendingOperation = null;
      this.cdr.markForCheck();
      return;
    }

    this.selectOperation(column, nextOperation, event);
  }

  protected isColumnMenuOpen(column: GridColumn<T>): boolean {
    return this.activeColumnField === this.getFieldKey(column);
  }

  protected activeColumn(): GridColumn<T> | null {
    if (!this.activeColumnField) {
      return null;
    }
    return this.columns.find(column => this.getFieldKey(column) === this.activeColumnField) ?? null;
  }

  protected operationOptionsFor(column: GridColumn<T>): readonly CalculateFooterOperationOption[] {
    return DEFAULT_OPERATION_OPTIONS.filter(option => this.supportsOperation(column, option.value));
  }

  protected operationLabel(operation: GridAggregateOperation): string {
    return this.config?.operationLabel?.(operation) || this.defaultOperationLabel(operation);
  }

  protected hasResult(column: GridColumn<T>): boolean {
    return !!this.resultFor(column);
  }

  private supportsOperation(column: GridColumn<T>, operation: GridAggregateOperation): boolean {
    return this.config?.supportsOperation ? this.config.supportsOperation(column, operation) : true;
  }

  private resolvePendingOperation(column: GridColumn<T>): GridAggregateOperation | null {
    if (this.pendingOperation === this.clearOperationValue) {
      return null;
    }

    return this.pendingOperation ?? this.currentOperation(column);
  }

  private resultFor(column: GridColumn<T>): GridAggregateFooterResult | null {
    const results = this.config?.results;
    if (!results) {
      return null;
    }
    const fieldKey = this.getFieldKey(column);
    const direct = results[fieldKey] ?? results[String(column.field ?? '')];
    const operation = this.currentOperation(column);
    if (!direct || !operation || direct.operation !== operation) {
      return null;
    }
    return direct;
  }

  private defaultFormatValue(result: GridAggregateFooterResult): string {
    if (result.value === null || result.value === undefined || result.value === '') {
      return '-';
    }
    if (typeof result.value === 'number') {
      return result.value.toLocaleString('en-US', {
        minimumFractionDigits: Number.isInteger(result.value) ? 0 : 2,
        maximumFractionDigits: 2
      });
    }
    return String(result.value);
  }

  private defaultOperationLabel(operation: GridAggregateOperation): string {
    const option = DEFAULT_OPERATION_OPTIONS.find(candidate => candidate.value === operation);
    return option?.label ?? operation.toUpperCase();
  }

  private getFieldKey(column: GridColumn<T>): string {
    return normalizeGridCalculateFooterFieldKey(column.field);
  }

  private getPinnedLeftOffset(index: number): number {
    let offset = this.hasStandaloneScopeCell() ? this.layout.selectionWidth : 0;
    for (let i = 0; i < index; i += 1) {
      if (this.columns[i]?.pinned === 'left') {
        offset += this.columnWidth(i);
      }
    }
    return offset;
  }

  private getPinnedRightOffset(index: number): number {
    let offset = 0;
    const hasPinnedRight = this.columns.some(column => column.pinned === 'right');
    if (hasPinnedRight && this.hasActionsCell()) {
      offset += this.layout.actionWidth;
    }
    for (let i = this.columns.length - 1; i > index; i -= 1) {
      if (this.columns[i]?.pinned === 'right') {
        offset += this.columnWidth(i);
      }
    }
    return offset;
  }

  private shouldRebind(changes: SimpleChanges): boolean {
    if (!this.gridHost || !this.scrollSource || !this.referenceTable) {
      return true;
    }

    const configChange = changes['config'];
    const previousEnabled = !!configChange?.previousValue?.enabled;
    const currentEnabled = !!configChange?.currentValue?.enabled;
    if (configChange && previousEnabled !== currentEnabled) {
      return currentEnabled;
    }

    const columnsChange = changes['columns'];
    if (!columnsChange) {
      return false;
    }

    return (
      this.resolveColumnLayoutKey(columnsChange.previousValue) !==
      this.resolveColumnLayoutKey(columnsChange.currentValue)
    );
  }

  private resolveColumnLayoutKey(columns: readonly GridColumn<T>[] | null | undefined): string {
    if (!Array.isArray(columns) || !columns.length) {
      return '';
    }

    return columns
      .map((column, index) => {
        const field = this.getFieldKey(column);
        const pinned = column?.pinned ?? '';
        return `${index}:${field}:${pinned}`;
      })
      .join('|');
  }

  private scheduleBind(): void {
    if (!this.isEnabled()) {
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }
    if (this.pendingBindRaf != null) {
      cancelAnimationFrame(this.pendingBindRaf);
    }
    this.pendingBindRaf = this.zone.runOutsideAngular(() =>
      requestAnimationFrame(() => {
        this.pendingBindRaf = null;
        this.bindToGrid();
      })
    );
  }

  private bindToGrid(): void {
    const host = this.hostRef.nativeElement.closest('engineers-salary-reference-data-grid');
    if (!host) {
      return;
    }

    const referenceTable =
      (host.querySelector('.header-table') as HTMLTableElement | null) ??
      (host.querySelector('.data-grid-table') as HTMLTableElement | null);
    const scrollSource =
      (host.querySelector('[data-grid-scroll-host="bottom"]') as HTMLElement | null) ??
      resolveDataGridMainScrollHost(host);
    if (!referenceTable || !scrollSource) {
      return;
    }

    const bindingsChanged =
      this.gridHost !== host ||
      this.scrollSource !== scrollSource ||
      this.referenceTable !== referenceTable;

    if (!bindingsChanged) {
      this.measureLayout();
      return;
    }

    this.cleanupBindings();
    this.gridHost = host;
    this.scrollSource = scrollSource;
    this.referenceTable = referenceTable;

    if (this.scrollSource) {
      this.scrollListener = () => {
        this.closeMenus(false);
      };
      this.scrollSource.addEventListener('scroll', this.scrollListener, { passive: true });
    }

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.scheduleMeasure());
      if (this.scrollSource) {
        this.resizeObserver.observe(this.scrollSource);
      }
      this.resizeObserver.observe(host);
      this.resizeObserver.observe(this.referenceTable);
      Array.from(this.referenceTable.querySelectorAll('thead tr:first-child > th')).forEach(cell =>
        this.resizeObserver?.observe(cell as Element)
      );
      Array.from(this.referenceTable.querySelectorAll('colgroup > col')).forEach(child =>
        this.resizeObserver?.observe(child as Element)
      );
    }

    if (typeof MutationObserver !== 'undefined') {
      this.headerMutationObserver = new MutationObserver(() => this.scheduleBind());
      this.headerMutationObserver.observe(this.referenceTable, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
      });
    }

    this.measureLayout();
  }

  private scheduleMeasure(): void {
    if (typeof window === 'undefined') {
      return;
    }
    if (this.pendingMeasureRaf != null) {
      cancelAnimationFrame(this.pendingMeasureRaf);
    }
    const measureWhenShellStable = () => {
      const shellIsResizing =
        !!this.gridHost?.closest('.bg-app.sidebar-transitioning');
      if (shellIsResizing) {
        this.pendingMeasureRaf = requestAnimationFrame(measureWhenShellStable);
        return;
      }

      this.pendingMeasureRaf = null;
      this.measureLayout();
    };

    this.pendingMeasureRaf = this.zone.runOutsideAngular(() =>
      requestAnimationFrame(() => {
        this.pendingMeasureRaf = null;
        measureWhenShellStable();
      })
    );
  }

  private measureLayout(): void {
    if (!this.referenceTable) {
      return;
    }

    const referenceCells = Array.from(
      this.referenceTable.querySelectorAll('thead tr:first-child > th')
    ) as HTMLElement[];
    const referenceWidths = this.readReferenceWidths(referenceCells);
    if (!referenceWidths.length) {
      return;
    }
    const hasSelection = referenceCells[0]?.classList.contains('selection-cell') ?? false;
    const hasActions = isGridCalculateFooterActionsCell(referenceCells[referenceCells.length - 1]);

    const layout = resolveGridCalculateFooterLayout(referenceWidths, {
      hasSelection,
      hasActions,
      columnCount: this.columns.length,
      selectionFallback: resolveUnifiedDataGridSelectionColumnWidth(this.gridHost),
      actionFallback: resolveUnifiedDataGridRowActionsColumnWidth(this.gridHost),
      columnFallback: 140
    });
    const containerWidth = Math.max(
      0,
      this.scrollSource?.clientWidth ?? 0,
      this.gridHost?.clientWidth ?? 0
    );
    const stretchedLayout = resolveGridCalculateFooterStretchedLayout(
      layout,
      this.columns,
      containerWidth
    );
    const measuredTableWidth = resolveGridCalculateFooterMeasuredWidth(
      this.referenceTable,
      stretchedLayout.totalWidth
    );
    const referenceTableWidth = resolveGridCalculateFooterHostTableWidth(
      this.gridHost,
      Math.max(measuredTableWidth, containerWidth)
    );

    this.zone.run(() => {
      this.layout = {
        ...stretchedLayout,
        tableWidth: resolveGridCalculateFooterTableWidth(
          stretchedLayout.totalWidth,
          referenceTableWidth
        )
      };
      this.hasMeasuredLayout = true;
      this.cdr.markForCheck();
    });

    this.zone.runOutsideAngular(() => {
      requestAnimationFrame(() => undefined);
    });
  }

  private applyFallbackLayout(): void {
    if (this.hasMeasuredLayout || !this._columns.length) {
      return;
    }

    const selectionWidth = resolveUnifiedDataGridSelectionColumnWidth(this.gridHost);
    const columnWidths = this._columns.map(column =>
      resolveGridCalculateFooterColumnFallbackWidth(column, 140)
    );
    const totalWidth = selectionWidth + columnWidths.reduce((sum, width) => sum + width, 0);
    this.layout = {
      selectionWidth,
      actionWidth: 0,
      columnWidths,
      totalWidth,
      tableWidth: totalWidth
    };
    this.hasMeasuredLayout = true;
  }

  private readReferenceWidths(referenceCells: readonly HTMLElement[] = []): number[] {
    if (!this.referenceTable) {
      return [];
    }

    const colWidths = Array.from(this.referenceTable.querySelectorAll('colgroup > col'))
      .map(col => resolveGridCalculateFooterMeasuredWidth(col, 0))
      .filter(width => width > 0);
    if (colWidths.length) {
      return colWidths;
    }

    const renderedHeaderWidths = referenceCells
      .map(cell => resolveGridCalculateFooterRenderedWidth(cell, 0))
      .filter(width => width > 0);
    if (renderedHeaderWidths.length) {
      return renderedHeaderWidths;
    }

    return Array.from(this.referenceTable.querySelectorAll('thead tr:first-child > th'))
      .map(cell => resolveGridCalculateFooterRenderedWidth(cell, 0))
      .filter(width => width > 0);
  }

  private resolvePanelPosition(
    anchor: HTMLElement,
    panelWidth: number,
    panelHeight: number
  ): { left: number; top: number } {
    const rect = anchor.getBoundingClientRect();
    return resolveGridCalculateFooterPanelPosition(rect, window.innerWidth, window.innerHeight, {
      panelWidth,
      panelHeight
    });
  }

  private closeMenus(markForCheck = true): void {
    if (!this.scopeMenuOpen && !this.activeColumnField) {
      return;
    }
    this.scopeMenuOpen = false;
    this.activeColumnField = null;
    this.pendingOperation = null;
    this.detachMenuDomListeners();
    if (markForCheck) {
      this.cdr.markForCheck();
    }
  }

  private closeStaleColumnMenu(): void {
    if (!this.activeColumnField) {
      return;
    }

    if (isGridCalculateFooterColumnMenuStale(this.activeColumnField, this.columns)) {
      this.closeMenus();
    }
  }

  private attachMenuDomListeners(): void {
    if (this.menuDomListenersAttached || typeof document === 'undefined') {
      return;
    }
    document.addEventListener('pointerdown', this.documentPointerDownHandler, true);
    document.addEventListener('keydown', this.documentKeydownHandler);
    this.menuDomListenersAttached = true;
  }

  private detachMenuDomListeners(): void {
    if (!this.menuDomListenersAttached || typeof document === 'undefined') {
      return;
    }
    document.removeEventListener('pointerdown', this.documentPointerDownHandler, true);
    document.removeEventListener('keydown', this.documentKeydownHandler);
    this.menuDomListenersAttached = false;
  }

  private cleanupBindings(): void {
    if (this.scrollSource && this.scrollListener) {
      this.scrollSource.removeEventListener('scroll', this.scrollListener);
    }
    this.scrollListener = null;

    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    this.headerMutationObserver?.disconnect();
    this.headerMutationObserver = null;

    this.gridHost = null;
    this.scrollSource = null;
    this.referenceTable = null;
  }
}
