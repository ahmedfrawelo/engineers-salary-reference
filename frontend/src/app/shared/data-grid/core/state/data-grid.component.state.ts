import {
  Directive,
  Input,
  Output,
  EventEmitter,
  computed,
  signal,
  effect,
  untracked,
  ChangeDetectorRef,
  ElementRef,
  NgZone,
  ViewChild,
  HostBinding
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import {
  GridColumn,
  GridConfig,
  SortState,
  FilterState,
  PaginationState,
  GridChangeEvent,
  GridAggregateFooterChangeEvent,
  GridAggregateFooterConfig,
  ExportOptions,
  GridState,
  GridDateGroupInterval,
  GridRemoteGroupSummary,
  GridSelectionBulkEditField,
  GridSelectionBulkEditOption
} from '../../models';
import { DataGridService } from '../../services';
import type { FilterOption } from '../../components/menus/filter-menu.component';
import type { GridSelectionActionBarComponent } from '../../components/selection/grid-selection-action-bar.component';
// ===== Spreadsheet Mode Imports =====
import { FormulaEngineService } from '../../services';
import { ExcelPasteService } from '../../services';
import * as DataGridHelpers from '../runtime/data-grid.component.helper';
import * as DataGridAnalyticsHelpers from '../../utils/analytics';
import { clearRemoteDataStructureRefreshPending } from '../runtime/data-grid.component.runtime-remote-refresh';
import {
  resolveUnifiedDataGridRowActionsColumnWidth,
  resolveUnifiedDataGridSelectionColumnWidth
} from '../../utils/layout';
import {
  buildGridDateGroupValue,
  resolveGridDateGroupInterval
} from '../../utils/data-grid-date-grouping.util';

export type GridRowRecord = Record<string, unknown>;
export type GridLooseValue = ReturnType<typeof JSON.parse>;
export type TimeoutHandle = ReturnType<typeof setTimeout>;

export type DataDisplayRow<T> = { kind: 'data'; data: T };
export type GroupDisplayRow<T = GridRowRecord> = {
  kind: 'group';
  id: string;
  level: number;
  field: string;
  value: unknown;
  count: number;
  expanded: boolean;
  rows?: T[];
  data?: T;
};
export type GroupFooterDisplayRow<T = GridRowRecord> = {
  kind: 'group-footer';
  id: string;
  level: number;
  field: string;
  value: unknown;
  count: number;
  rows?: T[];
};
export type GroupAggregateRow<T = GridRowRecord> = { field: string; value: unknown; rows?: T[] };
export type DisplayRow<T> = DataDisplayRow<T> | GroupDisplayRow<T> | GroupFooterDisplayRow<T>;
export type GroupBlock<T = GridRowRecord> = {
  id: string;
  value: unknown;
  rows: T[];
  count: number;
  field: string;
};
export type ExportScope = 'all' | 'selected' | 'filtered' | 'visible' | 'row';

export interface GridSnapshot {
  id: string;
  name: string;
  createdAt: number;
  state: GridState;
}
/**
 * Shared reactive state layer for the standalone DataGrid component.
 * Runtime, presenter, and styling helpers compose on top of this base.
 */
@Directive()
export abstract class DataGridComponentState<T = GridLooseValue> {
  protected abstract updatePaginationState(totalRecords: number): void;
  protected abstract invalidateFilteredSortedCache(): void;
  protected abstract syncAggregateDisplayState(): void;
  protected abstract getColumnField(column: GridColumn<T>): string;
  protected abstract getFilteredSortedData(): T[];
  protected abstract getRowFieldValue(row: T, field: string): unknown;
  protected abstract isEmptyValue(value: unknown): boolean;
  protected abstract getFilterOptionKey(value: unknown): string;
  protected abstract getColumnPixelWidth(column: GridColumn<T>): number;
  protected abstract normalizeGroupKey(value: unknown): string;
  protected abstract filterGroupRows(rows: T[], term: string): T[];
  protected abstract isNumericColumn(column: GridColumn<T>): boolean;
  protected abstract normalizeNumericValue(value: unknown): number | null;
  protected abstract shouldAutoExpandGroups(): boolean;
  protected abstract getColumnStats(field: string): { mean: number; std: number } | null;
  protected abstract isValueAnomaly(
    value: number | null,
    stats: { mean: number; std: number } | null
  ): boolean;
  protected abstract getCellValue(row: T, column: GridColumn<T>): unknown;
  protected abstract buildGroupedRows(
    data: T[],
    groupFields: string[],
    level: number,
    path: string,
    expandedSet: Set<string>
  ): DisplayRow<T>[];

  // ===== Inputs =====

  private _data: T[] = [];
  protected readonly dataSignal = signal<T[]>([]);

  @Input({ required: true })
  set data(value: T[]) {
    this._data = value ?? [];
    this.dataSignal.set(this._data);
    this.cellValueCache.clear();
    this.spreadsheetFormulaCache.clear();
    if (this.remoteDataStructureRefreshPending()) {
      clearRemoteDataStructureRefreshPending(this);
    }
    this.gridService.clearCache();
    this.invalidateFilteredSortedCache();
  }
  get data(): T[] {
    return this._data;
  }

  // Internal signal used to react to column reference changes.
  private _columns: GridColumn<T>[] = [];
  protected readonly columnsSignal = signal<GridColumn<T>[]>([]);

  @Input({ required: true })
  set columns(value: GridColumn<T>[]) {
    this._columns = value ?? [];
    this.appendRowTemplate = null;
    this.cellValueCache.clear();
    this.spreadsheetFormulaCache.clear();
    this.columnAutoWidthCache.clear();
    this.automaticAutoSizeApplied = false;
    this.columnsSignal.set(this._columns);
    this.invalidateFilteredSortedCache();
    this.syncAggregateDisplayState();
  }
  get columns(): GridColumn<T>[] {
    return this._columns;
  }

  private _config: GridConfig = {};
  private _inputConfig: GridConfig = {};
  protected configVersion = signal(0);

  @Input()
  set config(value: GridConfig) {
    this._inputConfig = value ?? {};
    this._config = this._inputConfig;
    this.configVersion.update(version => version + 1);
    this.appendRowTemplate = null;
    this.syncDefaultGridRowHeightPreference(this._inputConfig);
    if (!this._inputConfig.remoteData && this.remoteDataStructureRefreshPending()) {
      clearRemoteDataStructureRefreshPending(this);
    }
    if (this._inputConfig.hover === false) {
      this.clearHoverVisualState();
    }
  }
  get config(): GridConfig {
    return this._config;
  }

  private clearHoverVisualState(): void {
    this.hoveredRowIndex.set(null);
    this.hoveredColumnField.set(null);
    this.activeTooltip.set(null);
    if (this.hoveredLinkEl) {
      this.hoveredLinkEl.style.removeProperty('color');
      this.hoveredLinkEl.style.removeProperty('-webkit-text-fill-color');
      this.hoveredLinkEl = null;
    }
  }

  private readonly loadingState = signal(false);
  @Input()
  set loading(value: boolean) {
    this.loadingState.set(!!value);
  }
  get loading(): boolean {
    return this.loadingState();
  }

  private _stateKey?: string;
  @Input()
  set stateKey(value: string | undefined) {
    this._stateKey = value;
  }
  get stateKey(): string | undefined {
    return this._stateKey;
  }

  private _aggregateFooter?: GridAggregateFooterConfig<T>;
  @Input()
  set aggregateFooter(value: GridAggregateFooterConfig<T> | undefined) {
    this._aggregateFooter = value;
  }
  get aggregateFooter(): GridAggregateFooterConfig<T> | undefined {
    return this._aggregateFooter;
  }

  private _remoteGroups: GridRemoteGroupSummary[] = [];
  protected readonly remoteGroupsSignal = signal<GridRemoteGroupSummary[]>([]);
  protected readonly remoteGroupCountLookup = computed(() => {
    const lookup = new Map<string, Map<string, number>>();
    for (const group of this.remoteGroupsSignal()) {
      const field = String(group?.field ?? '').trim();
      const key = String(group?.key ?? '');
      const count = Number(group?.count);
      if (!field || !key || !Number.isFinite(count)) {
        continue;
      }
      let fieldLookup = lookup.get(field);
      if (!fieldLookup) {
        fieldLookup = new Map<string, number>();
        lookup.set(field, fieldLookup);
      }
      fieldLookup.set(key, Math.max(0, count));
    }
    return lookup;
  });

  @Input()
  set remoteGroups(value: GridRemoteGroupSummary[] | null | undefined) {
    this._remoteGroups = Array.isArray(value) ? value : [];
    this.remoteGroupsSignal.set(this._remoteGroups);
  }
  get remoteGroups(): GridRemoteGroupSummary[] {
    return this._remoteGroups;
  }

  private _selectionBarShowEditAction?: boolean;
  @Input()
  set selectionBarShowEditAction(value: boolean | undefined) {
    this._selectionBarShowEditAction = value == null ? undefined : !!value;
  }
  get selectionBarShowEditAction(): boolean | undefined {
    return this._selectionBarShowEditAction;
  }

  private _selectionBarShowDeleteAction?: boolean;
  @Input()
  set selectionBarShowDeleteAction(value: boolean | undefined) {
    this._selectionBarShowDeleteAction = value;
  }
  get selectionBarShowDeleteAction(): boolean | undefined {
    return this._selectionBarShowDeleteAction;
  }

  // ===== Outputs =====

  private readonly _onChange = new EventEmitter<GridChangeEvent>();
  @Output()
  get onChange(): EventEmitter<GridChangeEvent> {
    return this._onChange;
  }

  private readonly _onExport = new EventEmitter<ExportOptions>();
  @Output()
  get onExport(): EventEmitter<ExportOptions> {
    return this._onExport;
  }

  private readonly _onRowClick = new EventEmitter<T>();
  @Output()
  get onRowClick(): EventEmitter<T> {
    return this._onRowClick;
  }

  private readonly _onRowDoubleClick = new EventEmitter<T>();
  @Output()
  get onRowDoubleClick(): EventEmitter<T> {
    return this._onRowDoubleClick;
  }

  private readonly _onCellAction = new EventEmitter<{
    row: T;
    column: GridColumn<T>;
    event: MouseEvent;
  }>();
  @Output()
  get onCellAction(): EventEmitter<{ row: T; column: GridColumn<T>; event: MouseEvent }> {
    return this._onCellAction;
  }

  private readonly _onSelectionChange = new EventEmitter<T[]>();
  @Output()
  get onSelectionChange(): EventEmitter<T[]> {
    return this._onSelectionChange;
  }

  private readonly _onCellEdit = new EventEmitter<{ row: T; field: string; value: unknown }>();
  @Output()
  get onCellEdit(): EventEmitter<{ row: T; field: string; value: unknown }> {
    return this._onCellEdit;
  }

  private readonly _onBatchDelete = new EventEmitter<T[]>();
  @Output()
  get onBatchDelete(): EventEmitter<T[]> {
    return this._onBatchDelete;
  }

  private readonly _onBatchEdit = new EventEmitter<{ rows: T[]; field: string; value: unknown }>();
  @Output()
  get onBatchEdit(): EventEmitter<{ rows: T[]; field: string; value: unknown }> {
    return this._onBatchEdit;
  }

  private readonly _selectionBarEditRequested = new EventEmitter<T[]>();
  @Output()
  get selectionBarEditRequested(): EventEmitter<T[]> {
    return this._selectionBarEditRequested;
  }

  private readonly _selectionBarDeleteRequested = new EventEmitter<T[]>();
  @Output()
  get selectionBarDeleteRequested(): EventEmitter<T[]> {
    return this._selectionBarDeleteRequested;
  }

  private readonly _onColumnsChange = new EventEmitter<GridColumn<T>[]>();
  @Output()
  get onColumnsChange(): EventEmitter<GridColumn<T>[]> {
    return this._onColumnsChange;
  }

  private readonly _aggregateFooterChange = new EventEmitter<GridAggregateFooterChangeEvent<T>>();
  @Output()
  get aggregateFooterChange(): EventEmitter<GridAggregateFooterChangeEvent<T>> {
    return this._aggregateFooterChange;
  }

  // ===== Signals for Reactive State =====

  protected sortStates = signal<SortState[]>([]);
  protected filterStates = signal<FilterState[]>([]);
  protected sortStateLookup = computed(() => {
    const lookup = new Map<string, SortState>();
    for (const state of this.sortStates()) {
      const field = String(state.field ?? '').trim();
      if (field) {
        lookup.set(field, state);
      }
    }
    return lookup;
  });
  protected sortedColumnFieldLookup = computed(() => new Set(this.sortStateLookup().keys()));
  protected activeFilterFieldLookup = computed(() => {
    const lookup = new Set<string>();
    for (const state of this.filterStates()) {
      if (state.operator === 'globalSearch' || state.operator === 'menuSearch') {
        continue;
      }
      const field = String(state.field ?? '').trim();
      if (field) {
        lookup.add(field);
      }
    }
    return lookup;
  });
  // Quick filter state stored per column field.
  protected quickFilterValues = signal<Map<string, string>>(new Map());
  private quickFilterDebounceTimers = new Map<string, TimeoutHandle>();
  protected paginationState = signal<PaginationState>({
    currentPage: 1,
    pageSize: 10,
    totalRecords: 0,
    totalPages: 0
  });
  protected selectedRows = signal<T[]>([]);
  protected selectedRowCount = computed(() => this.selectedRows().length);
  protected selectedRowLookup = computed(() => new Set(this.selectedRows()));
  protected selectionUndoSnapshot = signal<T[] | null>(null);
  protected selectionUndoLabel = signal('');
  protected editingCell = signal<{ rowIndex: number; field: string } | null>(null);
  protected editingHeaderField = signal<string | null>(null);
  protected editingHeaderValue = signal('');
  protected displayRowsEffectsSuspended = signal(false);
  protected globalSearchTerm = '';
  protected groupColumns = signal<string[]>([]);
  protected groupDateIntervals = signal<Record<string, GridDateGroupInterval>>({});
  protected groupDateIntervalLookup = computed(() => {
    const configured = this.groupDateIntervals();
    const lookup = new Map<string, GridDateGroupInterval>();
    for (const column of this.columnsSignal()) {
      const field = this.getColumnField(column);
      const interval = resolveGridDateGroupInterval(column, configured[field]);
      if (interval) {
        lookup.set(field, interval);
      }
    }
    return lookup;
  });
  protected expandedGroups = signal<Set<string>>(new Set());
  protected groupExpansionAuto = signal(true);
  protected shouldAutoExpandGroupsCached = computed(() => this.shouldAutoExpandGroups());
  protected remoteDataStructureRefreshPending = signal(false);
  protected remoteDataStructureRefreshToken = 0;
  protected remoteDataStructureRefreshSawLoading = false;
  protected remoteDataStructureRefreshFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  protected expandedGroupsSnapshot = computed(() => {
    if (this.groupExpansionAuto()) {
      return [] as string[];
    }

    const ids: string[] = [];
    for (const id of this.expandedGroups()) {
      if (typeof id === 'string' && id.trim().length > 0) {
        ids.push(id);
      }
    }
    return ids;
  });
  protected groupExpansionToken = 0;
  protected groupFilterTerms = signal<Map<string, string>>(new Map());
  readonly groupBodyMaxHeight = 380;
  private _groupingMode = false;
  @HostBinding('class.grouping-mode')
  get groupingMode(): boolean {
    return this._groupingMode;
  }
  set groupingMode(value: boolean) {
    this._groupingMode = !!value;
  }

  private _isScrolling = false;
  @HostBinding('class.is-scrolling')
  get isScrolling(): boolean {
    return this._isScrolling;
  }
  set isScrolling(value: boolean) {
    this._isScrolling = !!value;
  }

  @HostBinding('attr.data-grid-layout-preset')
  get dataGridLayoutPresetAttr(): string {
    return 'default';
  }
  @HostBinding('class.dg-hover-disabled')
  get hasHoverDisabled(): boolean {
    return !this.isHoverEnabled();
  }
  @HostBinding('class.has-row-selection')
  get hasRowSelection(): boolean {
    return this.selectedRowCount() > 0;
  }
  @HostBinding('style.--dg-grid-row-height')
  get gridRowHeightCssVar(): string | null {
    return `${this.getDefaultGridBodyRowHeight()}px`;
  }
  @HostBinding('style.--dg-pinned-left-width')
  get pinnedLeftWidthCssVar(): string {
    return `${this.getPinnedLeftViewportWidth()}px`;
  }
  private columnHiddenSnapshot = new Map<string, boolean>();
  private initialColumnOrder: string[] = [];
  private hasExplicitDefaultGridRowHeight = false;
  private initialColumnState = new Map<
    string,
    {
      width?: number | string;
      hidden?: boolean;
      pinned?: 'left' | 'right';
      align?: 'left' | 'center' | 'right';
      aggregate?: GridColumn<T>['aggregate'];
    }
  >();
  private headerDropHandled = false;
  protected resizingColumnField: string | null = null;
  protected resizeStartX = 0;
  protected resizeStartWidth = 0;
  protected resizePendingWidth = 0;
  protected resizeMinWidth = 0;
  protected resizeMaxWidth = Number.POSITIVE_INFINITY;
  protected isResizingColumn = false;
  protected resizeGuideX = 0;
  private measureCanvas?: HTMLCanvasElement;
  private columnMinWidthCache = new Map<string, number>();
  private columnAutoWidthCache = new Map<string, number>();
  protected automaticAutoSizeApplied = false;
  protected resizeRAF: number | null = null;
  protected headerBodyWidthSyncRAF: number | ReturnType<typeof setTimeout> | null = null;
  protected stateSaveTimer: ReturnType<typeof setTimeout> | null = null;
  protected headerBodyWidthSyncTargets: {
    root: HTMLElement;
    viewport: HTMLElement | null;
    tables: HTMLElement[];
    tableCols: HTMLElement[][];
  } | null = null;
  private hoveredLinkEl: HTMLElement | null = null;

  // Filter menu state
  public activeFilterColumn: GridColumn<T> | null = null;
  protected filterMenuPosition = { x: 0, y: 0 };
  protected filterOptions: FilterOption[] = [];
  protected filterOptionsLoading = false;
  protected filterOptionsRequestToken = 0;
  protected filterPlaceholder = 'Search values...';
  protected filterMenuSearchTerm = '';

  // Context menu state
  protected contextMenuColumn: GridColumn<T> | null = null;
  protected contextMenuPosition = { x: 0, y: 0 };

  // Cell context menu state
  protected showCellContextMenu = false;
  protected cellContextMenuPosition = { x: 0, y: 0 };
  protected cellContextMenuRow: T | null = null;
  protected cellContextMenuColumn: GridColumn<T> | null = null;
  private cellContextMenuAnchor: { x: number; y: number } | null = null;
  protected activeCellSubmenu: string | null = null;
  protected cellSubmenuPosition = { x: 0, y: 0 };
  private cellSubmenuHideTimeout: TimeoutHandle | null = null;
  private draggingColumnField: string | null = null;
  private draggingGroupField: string | null = null;
  private columnDragPreviewOriginalColumns: GridColumn<T>[] | null = null;
  private columnDragNativeImage: HTMLElement | null = null;
  private columnDragOverlayCard: HTMLElement | null = null;
  private columnDropMarker: HTMLElement | null = null;
  private columnDragPointerInsideGrid = false;
  private columnDragDocumentMoveHandler: ((event: DragEvent) => void) | null = null;
  private columnPointerDragSourceField: string | null = null;
  private columnPointerDragPointerId: number | null = null;
  private columnPointerDragLabel: string | null = null;
  private columnPointerDragStarted = false;
  private columnPointerDragStartX = 0;
  private columnPointerDragStartY = 0;
  private columnPointerDragMoveHandler: ((event: PointerEvent) => void) | null = null;
  private columnPointerDragUpHandler: ((event: PointerEvent) => void) | null = null;
  private columnPointerDragCancelHandler: ((event: PointerEvent) => void) | null = null;
  protected dropTargetColumnField: string | null = null; // For column reorder animations
  protected dropTargetColumnEdge: 'before' | 'after' | null = null;
  private columnRangeCache = new Map<string, { min: number; max: number }>();
  private columnStatsCache = new Map<string, { mean: number; std: number }>();
  private aggregateCache = new Map<string, string>();
  private percentAggregateTotalsCache = new Map<
    string,
    {
      token: number;
      rows: T[];
      sum: number;
      numericCount: number;
      nonEmptyCount: number;
    }
  >();
  private aggregateCacheToken = 0;
  private filteredSortedCacheKey = 0;
  private filteredSortedCache: {
    key: number;
    rows: T[];
    indexMap: WeakMap<object, number>;
    identityIndexMap: Map<string, number>;
  } | null = null;
  private readonly anomalyZThreshold = 2;
  private readonly fallbackViewRefs = new Map<string, ElementRef<HTMLElement>>();
  private readonly groupedSelectionCoverageExactLimit = 300;
  private readonly groupedAutoVirtualizationRowLimit = 180;

  private _gridViewport?: ElementRef<HTMLElement>;
  @ViewChild('gridViewport')
  set gridViewport(value: ElementRef<HTMLElement> | undefined) {
    this._gridViewport = value;
    this.fallbackViewRefs.delete('[data-grid-scroll-host="main"]');
  }
  get gridViewport(): ElementRef<HTMLElement> | undefined {
    return this._gridViewport ?? this.resolveViewElementRef('[data-grid-scroll-host="main"]');
  }

  private _bottomScrollbarViewport?: ElementRef<HTMLElement>;
  @ViewChild('bottomScrollbarViewport')
  set bottomScrollbarViewport(value: ElementRef<HTMLElement> | undefined) {
    this._bottomScrollbarViewport = value;
    this.fallbackViewRefs.delete('[data-grid-scroll-host="bottom"]');
  }
  get bottomScrollbarViewport(): ElementRef<HTMLElement> | undefined {
    return (
      this._bottomScrollbarViewport ??
      this.resolveViewElementRef('[data-grid-scroll-host="bottom"]')
    );
  }

  private _bottomScrollbarTrack?: ElementRef<HTMLElement>;
  @ViewChild('bottomScrollbarTrack')
  set bottomScrollbarTrack(value: ElementRef<HTMLElement> | undefined) {
    this._bottomScrollbarTrack = value;
    this.fallbackViewRefs.delete('.grid-bottom-scrollbar-track');
  }
  get bottomScrollbarTrack(): ElementRef<HTMLElement> | undefined {
    return this._bottomScrollbarTrack ?? this.resolveViewElementRef('.grid-bottom-scrollbar-track');
  }

  private _fixedHeader?: ElementRef<HTMLElement>;
  @ViewChild('fixedHeader', { read: ElementRef })
  set fixedHeader(value: ElementRef<HTMLElement> | undefined) {
    this._fixedHeader = value;
    this.fallbackViewRefs.delete('.fixed-table-header');
  }
  get fixedHeader(): ElementRef<HTMLElement> | undefined {
    return this._fixedHeader ?? this.resolveViewElementRef('.fixed-table-header');
  }

  private _selectionActionBar?: GridSelectionActionBarComponent;
  @ViewChild('selectionActionBar')
  set selectionActionBar(value: GridSelectionActionBarComponent | undefined) {
    this._selectionActionBar = value;
  }
  get selectionActionBar(): GridSelectionActionBarComponent | undefined {
    return this._selectionActionBar;
  }

  private resolveViewElementRef(selector: string): ElementRef<HTMLElement> | undefined {
    const cached = this.fallbackViewRefs.get(selector);
    if (cached && this.elementRef.nativeElement.contains(cached.nativeElement)) {
      return cached;
    }

    const element = this.elementRef.nativeElement.querySelector(selector);
    if (!(element instanceof HTMLElement)) {
      this.fallbackViewRefs.delete(selector);
      return undefined;
    }

    const ref = new ElementRef(element);
    this.fallbackViewRefs.set(selector, ref);
    return ref;
  }

  protected defaultGridOverflowObserver: ResizeObserver | null = null;
  protected defaultGridOverflowRaf: number | null = null;

  // Column visibility panel state
  protected showColumnVisibilityPanel = false;

  // Keyboard navigation state
  protected activeCell = signal<{ rowIndex: number; columnIndex: number } | null>(null);
  protected keyboardNavigationEnabled = true;

  // Performance optimization - memoized computed values
  private cellValueCache = new Map<string, unknown>();

  // UI State
  protected currentDensity = signal<'compact' | 'comfortable' | 'spacious'>('comfortable');
  protected isFullScreen = signal(false);
  protected activeTooltip = signal<{ content: string; x: number; y: number } | null>(null);

  // Advanced selection
  private lastSelectedIndex: number = -1;

  // Export preferences
  protected exportScope = signal<'all' | 'selected' | 'filtered'>('all');
  protected exportFormat = signal<'excel' | 'csv' | 'pdf'>('excel');

  // Quick Filters state
  protected savedFilterPresets = signal<
    Array<{ name: string; filters: FilterState[]; searchTerm: string }>
  >([]);
  protected showSavePresetDialog = signal(false);
  protected newPresetName = '';
  private appendRowTemplate: T | null = null;

  // Performance stats
  protected showPerformanceStats = signal(false);
  protected renderTime = signal(0);

  // Keyboard shortcuts panel
  protected showKeyboardShortcuts = signal(false);

  // Row pinning
  protected pinnedRows = signal<T[]>([]);
  protected pinnedRowLookup = computed(() => new Set(this.pinnedRows()));

  // Auto-save indicator
  protected showAutoSaveIndicator = signal(false);
  protected autoSaveMessage = signal('');

  // Row hover actions
  protected hoveredRowIndex = signal<number | null>(null);

  // Cell edit flash animation
  protected flashingCells = signal<Set<string>>(new Set());

  // Column resize visual guide
  protected resizePreviewWidth = signal(0);
  protected resizeDelta = signal(0);
  protected resizingColumnLabel = signal('');

  // Focus mode state
  protected focusModeEnabled = signal(false);

  // Column hover highlighting
  protected hoveredColumnField = signal<string | null>(null);

  // Column insights panel
  protected showColumnInsights = signal(false);
  protected insightColumnField = signal<string | null>(null);

  // ===== Spreadsheet Mode State =====
  protected spreadsheetCurrentCell = signal<{ row: number; col: number } | null>(null);
  protected spreadsheetEditingCell = signal<{ row: number; col: number } | null>(null);
  protected spreadsheetFormulaCache = new Map<string, unknown>(); // Cache formula results
  protected spreadsheetFormulaDeps = new Map<string, Set<string>>(); // Track dependencies

  // Column color scale
  protected colorScaleEnabled = signal(false);

  // Data freshness ticker
  protected lastRefreshTime = signal<Date | null>(null);
  protected refreshingTicker = signal(false);

  // Snapshot manager
  protected snapshotManagerOpen = signal(false);
  protected savedSnapshots = signal<GridSnapshot[]>([]);
  protected newSnapshotName = '';

  // Anomaly alerts
  protected showAnomalyAlerts = signal(false);

  // Data quality & bookmarks
  protected showQualityPanel = signal(false);
  protected bookmarkedRows = signal<T[]>([]);
  protected bookmarkedRowLookup = computed(() => new Set(this.bookmarkedRows()));
  protected showAuditTrail = signal(false);
  protected auditEvents = signal<
    Array<{ id: string; type: string; label: string; timestamp: number }>
  >([]);
  protected recommendations = signal<
    Array<{ title: string; description: string; action?: () => void }>
  >([]);
  protected highContrastMode = signal(false);
  protected showForecastSparklines = signal(false);
  protected columnNotes = signal<Record<string, string>>({});
  protected activeNoteColumn = signal<string | null>(null);
  protected noteDraft = '';
  protected showActionLauncher = signal(false);
  protected showHeadlinePanel = signal(true);
  protected showGroupContextMenu = signal(false);
  protected groupContextMenuPosition = signal({ x: 0, y: 0 });
  protected showColumnContextMenu = signal(false);
  protected columnContextMenuPosition = signal({ x: 0, y: 0 });
  protected selectedColumnForMenu = signal<GridColumn<T> | null>(null);
  protected showSortSubmenu = signal(false);
  protected showPinSubmenu = signal(false);
  protected showAlignSubmenu = signal(false);
  protected showAggregateSubmenu = signal(false);
  protected showGroupHeaderAggregates = signal(false);
  protected showGroupFooterAggregates = signal(false);
  protected showGrandTotalAggregates = signal(false);
  private aggregateDisplayMode: 'auto' | 'manual' = 'auto';
  private hasAggregatesOnce = false;
  protected showColumnVisibilitySubmenu = signal(false);
  protected showFilterSubmenu = signal(false);
  protected showMoreSubmenu = signal(false);
  protected showChooseColumnsSubmenu = signal(false);
  protected showCopySubmenu = signal(false);
  protected showStatsSubmenu = signal(false);
  protected showTypeSubmenu = signal(false);
  protected columnDropdownOptionsDraft = '';
  protected columnSubmenuPosition = signal({ x: 0, y: 0 });
  protected columnSubmenuOpenUp = signal(false);
  protected columnSubmenuOpenLeft = signal(false);
  protected columnChooseSubmenuOpenUp = signal(false);
  protected columnChooseSubmenuOpenLeft = signal(false);
  protected columnCopySubmenuOpenUp = signal(false);
  protected columnCopySubmenuOpenLeft = signal(false);
  protected columnVisibilitySearch = signal('');
  protected readonly filteredColumnsForMenu = computed(() => {
    const term = this.columnVisibilitySearch().trim().toLowerCase();
    const cols = this.columnsSignal();
    if (!term) {
      return cols;
    }
    return cols.filter(col => {
      const label = String(col.header ?? this.getColumnField(col)).toLowerCase();
      return label.includes(term);
    });
  });
  private columnSubmenuAnchorRect: DOMRect | null = null;
  private columnSubmenuAnchorEl: HTMLElement | null = null;
  private columnCopySubmenuAnchorEl: HTMLElement | null = null;
  private columnSubmenuSizeCache = new Map<string, { width: number; height: number }>();
  private submenuTimeout: TimeoutHandle | null = null;
  private submenuPositionRaf: number | null = null;
  protected showEmptyGroupMenu = signal(false);
  protected alignmentChangeTimestamp = signal(0); // Force re-render on alignment change
  protected emptyGroupMenuPosition = signal({ x: 0, y: 0 });
  protected showColumnSelectionSubmenu = signal(false);
  protected showGroupingHelpDialog = signal(false);
  private columnWidthLocks = new Map<
    string,
    { resizable?: boolean; minWidth?: number; maxWidth?: number }
  >();
  protected wrappedColumns = signal<Set<string>>(new Set());
  protected duplicateHighlightColumns = signal<Set<string>>(new Set());
  protected duplicateValueKeys = computed(() => {
    const fields = this.duplicateHighlightColumns();
    const duplicates = new Map<string, Set<string>>();
    if (!fields.size) {
      return duplicates;
    }

    const rows = this.getFilteredSortedData();
    fields.forEach(field => {
      const counts = new Map<string, number>();
      rows.forEach(row => {
        const value = this.getRowFieldValue(row, field);
        if (this.isEmptyValue(value)) {
          return;
        }
        const key = this.getFilterOptionKey(value);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });
      const keys = new Set<string>();
      counts.forEach((count, key) => {
        if (count > 1) {
          keys.add(key);
        }
      });
      duplicates.set(field, keys);
    });

    return duplicates;
  });

  // ===== Loading State Enhancements =====
  protected loadingProgress = 0; // Progress percentage (0-100)
  protected canCancelLoading = false; // Whether loading can be cancelled
  private loadingCancelled = false; // Flag to track if loading was cancelled

  // ===== Computed Signals =====

  protected visibleColumns = computed(() => {
    // ? Access signals to make this reactive
    this.alignmentChangeTimestamp();
    const cols = this.columnsSignal(); // ? Use signal for reactive tracking
    const visible = cols.filter(col => !col.hidden);
    return this.config?.rtl ? [...visible].reverse() : visible;
  });

  protected aggregateColumns = computed(() => {
    return this.visibleColumns().filter(column => !!column.aggregate);
  });

  protected columnLabelLookup = computed(() => {
    const lookup = new Map<string, string>();
    for (const column of this.columnsSignal()) {
      const field = this.getColumnField(column);
      lookup.set(field, String(column.header || field));
    }
    return lookup;
  });

  protected visibleColumnIndexLookup = computed(() => {
    const lookup = new Map<string, number>();
    const columns = this.visibleColumns();
    for (let index = 0; index < columns.length; index += 1) {
      lookup.set(this.getColumnField(columns[index]), index);
    }
    return lookup;
  });

  protected firstVisibleColumnField = computed(() => {
    const [firstColumn] = this.visibleColumns();
    return firstColumn ? this.getColumnField(firstColumn) : '';
  });

  protected hasAggregateColumnsCached = computed(() => this.aggregateColumns().length > 0);

  protected renderedColumnWidthModelKey = computed(() => {
    this.configVersion();
    const parts: string[] = [
      this.config.selectable ? '1' : '0',
      String(this.config.rowActions?.length ?? 0)
    ];

    for (const column of this.visibleColumns()) {
      const width = typeof column.width === 'string' ? column.width.trim() : (column.width ?? '');
      const minWidth = column.minWidth ?? '';
      const maxWidth = column.maxWidth ?? '';
      const fillRemaining = column.fillRemaining === true ? 1 : 0;
      parts.push(
        `${this.getColumnField(column)}:${width}:${minWidth}:${maxWidth}:${fillRemaining}`
      );
    }

    return parts.join('|');
  });

  protected totalTableWidthCached = computed(() => {
    this.configVersion();
    let total = 0;

    if (this.config.selectable) {
      total += resolveUnifiedDataGridSelectionColumnWidth(this.elementRef.nativeElement);
    }

    for (const column of this.visibleColumns()) {
      total += this.getColumnPixelWidth(column);
    }

    if (this.config.rowActions?.length) {
      total += resolveUnifiedDataGridRowActionsColumnWidth(this.elementRef.nativeElement);
    }

    return total;
  });

  protected gridColumnSpan = computed(() => {
    this.configVersion();
    return (
      this.visibleColumns().length +
      (this.config.selectable ? 1 : 0) +
      (this.config.rowActions?.length ? 1 : 0)
    );
  });

  protected numericColumnFieldLookup = computed(() => {
    const numericFields = new Set<string>();
    const candidates: Array<{ field: string }> = [];

    for (const column of this.visibleColumns()) {
      const field = this.getColumnField(column);
      if (
        column.type === 'number' ||
        ['sum', 'avg', 'min', 'max', 'median'].includes(column.aggregate ?? 'none')
      ) {
        numericFields.add(field);
        continue;
      }
      candidates.push({ field });
    }

    if (!candidates.length) {
      return numericFields;
    }

    const pending = new Set(candidates.map(candidate => candidate.field));
    for (const row of this.dataSignal()) {
      if (this.isAppendRowData(row)) {
        continue;
      }

      for (const field of pending) {
        const value = this.getRowFieldValue(row, field);
        if (this.normalizeNumericValue(value) !== null) {
          numericFields.add(field);
          pending.delete(field);
        }
      }

      if (!pending.size) {
        break;
      }
    }

    return numericFields;
  });

  protected pinnedOffsets = computed(() => {
    const cols = this.visibleColumns();
    const left = new Map<string, number>();
    const right = new Map<string, number>();
    const hasPinnedRight = cols.some(col => col.pinned === 'right');
    const shouldPinSelection = !!this.config.selectable && this.config.pinSelectionColumn !== false;
    const selectionColumnWidth = shouldPinSelection
      ? resolveUnifiedDataGridSelectionColumnWidth(this.elementRef.nativeElement)
      : 0;
    const rowActionsColumnWidth =
      this.config.rowActions?.length && hasPinnedRight
        ? resolveUnifiedDataGridRowActionsColumnWidth(this.elementRef.nativeElement)
        : 0;

    let leftOffset = selectionColumnWidth;
    for (const col of cols) {
      if (col.pinned === 'left') {
        const field = this.getColumnField(col);
        left.set(field, leftOffset);
        leftOffset += this.getColumnPixelWidth(col);
      }
    }

    let rightOffset = rowActionsColumnWidth;
    for (let i = cols.length - 1; i >= 0; i -= 1) {
      const col = cols[i];
      if (col.pinned === 'right') {
        const field = this.getColumnField(col);
        right.set(field, rightOffset);
        rightOffset += this.getColumnPixelWidth(col);
      }
    }

    return { left, right };
  });

  protected hasPinnedDataColumnsCached = computed(() =>
    this.visibleColumns().some(column => column.pinned === 'left' || column.pinned === 'right')
  );

  protected hasPinnedDataColumns(): boolean {
    return this.hasPinnedDataColumnsCached();
  }

  protected getPinnedLeftViewportWidth(): number {
    const shouldPinSelection = !!this.config.selectable && this.config.pinSelectionColumn !== false;
    let width = shouldPinSelection
      ? resolveUnifiedDataGridSelectionColumnWidth(this.elementRef.nativeElement)
      : 0;
    for (const column of this.visibleColumns()) {
      if (column.pinned === 'left') {
        width += this.getColumnPixelWidth(column);
      }
    }
    return width;
  }

  // Computed for filtered/sorted data count (without pagination)
  protected filteredDataCount = computed(() => {
    if (this.config.remoteData) {
      const totalRecords = this.config.remoteTotalRecords;
      return typeof totalRecords === 'number' && Number.isFinite(totalRecords)
        ? Math.max(0, totalRecords)
        : this.dataSignal().length;
    }
    return this.filteredSortedRowBuckets().dataRows.length;
  });

  protected filteredSortedRowBuckets = computed(() => {
    const sourceRows = this.getFilteredSortedData();

    let appendStart = sourceRows.length;
    while (appendStart > 0 && this.isAppendRowData(sourceRows[appendStart - 1])) {
      appendStart -= 1;
    }

    if (appendStart === sourceRows.length) {
      return {
        dataRows: sourceRows,
        appendRows: [] as T[]
      };
    }

    return {
      dataRows: sourceRows.slice(0, appendStart),
      appendRows: sourceRows.slice(appendStart)
    };
  });

  protected getLocallyPaginatedRows(rows: T[]): T[] {
    if (this.config.remoteData || !this.config.pagination) {
      return rows;
    }

    const { currentPage, pageSize } = this.paginationState();
    const safePageSize = pageSize || 10;
    const totalPages = Math.max(1, Math.ceil(rows.length / safePageSize));
    const safePage = Math.min(Math.max(currentPage || 1, 1), totalPages);
    const startIndex = (safePage - 1) * safePageSize;
    const endIndex = startIndex + safePageSize;

    return rows.slice(startIndex, endIndex);
  }

  protected processedData = computed(() => {
    const grouped = this.groupColumns().length > 0;
    this.groupingMode = grouped;
    const { dataRows, appendRows } = this.filteredSortedRowBuckets();
    const trailingAppendRows = appendRows.length ? [...appendRows] : [];
    let result = dataRows;

    if (!grouped) {
      result = this.getLocallyPaginatedRows(result);
    }

    if (!this.loading && !grouped && trailingAppendRows.length === 0) {
      const nativeAppendRow = this.getOrCreateAppendRow();
      if (nativeAppendRow) {
        trailingAppendRows.push(nativeAppendRow);
      }
    }

    return trailingAppendRows.length ? [...result, ...trailingAppendRows] : result;
  });

  protected shouldUseVirtualScrollCached = computed(() => {
    if (this.config?.virtualScroll) {
      return true;
    }

    if (this.groupColumns().length !== 1) {
      return false;
    }

    return this.filteredSortedRowBuckets().dataRows.length > this.groupedAutoVirtualizationRowLimit;
  });

  protected processedDataRowIndexLookup = computed(() => {
    const lookup = new WeakMap<object, number>();
    const rows = this.processedData();
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (row && typeof row === 'object') {
        lookup.set(row as object, index);
      }
    }
    return lookup;
  });

  protected sourceDataRowIndexLookup = computed(() => {
    const lookup = new WeakMap<object, number>();
    const rows = this.dataSignal();
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (row && typeof row === 'object') {
        lookup.set(row as object, index);
      }
    }
    return lookup;
  });

  protected resolveGroupValue(field: string, raw: unknown): { key: string; value: unknown } {
    return this.resolveGroupValueForInterval(raw, this.groupDateIntervalLookup().get(field) ?? null);
  }

  protected resolveGroupValueForInterval(
    raw: unknown,
    interval: GridDateGroupInterval | null
  ): { key: string; value: unknown } {
    const value = raw ?? '-';
    if (!interval) {
      return { key: this.normalizeGroupKey(value), value };
    }

    const groupedDate = buildGridDateGroupValue(raw, interval);
    if (!groupedDate) {
      return { key: this.normalizeGroupKey(value), value };
    }

    return groupedDate;
  }

  protected getRemoteGroupCount(field: string, key: string, fallback: number): number {
    if (!this.config.remoteData) {
      return fallback;
    }
    const count = this.remoteGroupCountLookup().get(field)?.get(key);
    return typeof count === 'number' ? count : fallback;
  }

  protected getGroupDateInterval(field: string): GridDateGroupInterval | null {
    return this.groupDateIntervalLookup().get(field) ?? null;
  }

  protected resolveGridDateGroupInterval(
    column: GridColumn<T> | null,
    requested?: unknown
  ): GridDateGroupInterval | null {
    return resolveGridDateGroupInterval(column, requested);
  }

  protected resolveGridDateGroupIntervalForField(
    field: string,
    requested?: unknown
  ): GridDateGroupInterval | null {
    const column = this.columnsSignal().find(col => this.getColumnField(col) === field) ?? null;
    return resolveGridDateGroupInterval(column, requested ?? this.groupDateIntervals()[field]);
  }

  protected groupedBlocks = computed(() => {
    if (this.config.remoteData && this.remoteDataStructureRefreshPending()) {
      return [] as GroupBlock<T>[];
    }

    const fields = this.groupColumns();
    if (!fields.length) {
      return [] as GroupBlock<T>[];
    }
    const field = fields[0];
    const dataset = this.getLocallyPaginatedRows(this.filteredSortedRowBuckets().dataRows);
    const filterTerms = this.groupFilterTerms();
    const map = new Map<
      string,
      { id: string; key: string; value: unknown; rows: T[]; field: string }
    >();

    for (const row of dataset) {
      const raw = this.getRowFieldValue(row, field);
      const { key, value } = this.resolveGroupValue(field, raw);
      const id = `${field}:${key}`;
      let block = map.get(id);
      if (!block) {
        block = { id, key, value, rows: [], field };
        map.set(id, block);
      }
      block.rows.push(row);
    }

    if (this.config.remoteData) {
      for (const group of this.remoteGroupsSignal()) {
        const remoteField = String(group?.field ?? '').trim();
        if (remoteField !== field) {
          continue;
        }

        const key = String(group?.key ?? '');
        if (!key) {
          continue;
        }

        const id = `${field}:${key}`;
        if (!map.has(id)) {
          map.set(id, {
            id,
            key,
            value: group.value ?? key,
            rows: [],
            field
          });
        }
      }
    }

    const blocks: GroupBlock<T>[] = [];
    for (const item of map.values()) {
      const term = filterTerms.get(item.id) ?? '';
      const rows = term ? this.filterGroupRows(item.rows, term) : item.rows;
      const count = term
        ? rows.length
        : this.getRemoteGroupCount(item.field, item.key, rows.length);
      blocks.push({
        id: item.id,
        value: item.value,
        rows,
        field: item.field,
        count
      });
    }

    return blocks;
  });

  protected selectionInsights = computed(() => {
    return DataGridAnalyticsHelpers.getSelectionInsightsHelper(this);
  });

  protected editableSelectionBarBulkEditFields = computed<GridSelectionBulkEditField[]>(() => {
    const fields: GridSelectionBulkEditField[] = [];
    for (const column of this.visibleColumns()) {
      if (!column.editable) {
        continue;
      }
      const field = this.getColumnField(column);
      fields.push({
        field,
        label: String(column.header ?? field).trim() || field,
        kind: this.resolveSelectionBarBulkEditKind(column),
        options: this.mapSelectionBarBulkEditOptions(column)
      });
    }
    return fields;
  });

  protected selectionBarBulkEditFields = computed<GridSelectionBulkEditField[]>(() => {
    if (this.selectedRowCount() === 0) {
      return [];
    }

    return this.editableSelectionBarBulkEditFields();
  });

  protected columnInsights = computed(() => {
    return DataGridAnalyticsHelpers.getColumnInsightsHelper(this);
  });

  protected anomalySummary = computed(() => {
    return DataGridAnalyticsHelpers.getAnomalySummaryHelper(this);
  });

  protected headlineMetrics = computed(() => {
    return DataGridAnalyticsHelpers.getHeadlineMetricsHelper(this);
  });

  protected dataQualitySummary = computed(() => {
    return DataGridAnalyticsHelpers.getDataQualitySummaryHelper(this);
  });

  protected kpiTicker = computed(() => {
    return DataGridAnalyticsHelpers.getKpiTickerHelper(this);
  });

  protected displayRows = computed<DisplayRow<T>[]>(() => {
    if (this.config.remoteData && this.remoteDataStructureRefreshPending()) {
      return [];
    }

    const baseRows = this.processedData();
    const groups = this.groupColumns();
    if (!groups.length) {
      const rows: DisplayRow<T>[] = [];
      for (const row of baseRows) {
        rows.push({ kind: 'data', data: row });
      }
      return rows;
    }
    return this.buildGroupedRows(baseRows, groups, 0, 'root', this.expandedGroups());
  });

  protected selectableRowsSnapshot = computed(() => {
    if (this.config.remoteData && this.remoteDataStructureRefreshPending()) {
      return [] as T[];
    }

    const groupCount = this.groupColumns().length;
    const grouped = groupCount > 0;
    const uniqueRows = new Set<T>();
    const rows: T[] = [];
    const appendRowKey = '__appendRow';
    const pushRow = (row: T | null | undefined) => {
      if (!row) {
        return;
      }
      if (typeof row === 'object' && (row as Record<string, unknown>)[appendRowKey]) {
        return;
      }
      if (uniqueRows.has(row)) {
        return;
      }
      uniqueRows.add(row);
      rows.push(row);
    };

    if (grouped) {
      if (!this.groupFilterTerms().size) {
        for (const row of this.getLocallyPaginatedRows(this.filteredSortedRowBuckets().dataRows)) {
          pushRow(row);
        }
      } else if (groupCount === 1 || this.shouldUseVirtualScroll()) {
        for (const block of this.groupedBlocks()) {
          for (const row of block.rows ?? []) {
            pushRow(row);
          }
        }
      } else {
        for (const row of this.displayRows()) {
          if (row.kind === 'data') {
            pushRow(row.data);
          }
        }
      }
      return rows;
    }

    for (const row of this.processedData()) {
      pushRow(row);
    }
    return rows;
  });

  protected selectionCoverage = computed(() => {
    const selectedCount = this.selectedRowCount();
    if (selectedCount === 0) {
      return { all: false, some: false };
    }

    const visible = this.selectableRowsSnapshot();
    if (!visible.length) {
      return { all: false, some: false };
    }

    if (
      this.groupColumns().length > 0 &&
      visible.length > this.groupedSelectionCoverageExactLimit
    ) {
      return {
        all: selectedCount >= visible.length,
        some: selectedCount > 0 && selectedCount < visible.length
      };
    }

    const selected = this.selectedRowLookup();
    let matched = 0;
    for (const row of visible) {
      if (selected.has(row)) {
        matched += 1;
      }
    }

    return {
      all: matched === visible.length,
      some: matched > 0 && matched < visible.length
    };
  });

  protected isAppendRowData(row: T | null | undefined): boolean {
    return !!row && typeof row === 'object' && !!(row as Record<string, unknown>)['__appendRow'];
  }

  protected getOrCreateAppendRow(): T | null {
    if (!this.shouldRenderAppendRow()) {
      return null;
    }

    if (!this.appendRowTemplate) {
      const row: GridRowRecord = {
        __appendRow: true,
        __gridRowKey: '__append-row__'
      };

      this.columnsSignal().forEach(column => {
        row[this.getColumnField(column)] = this.getAppendRowDefaultCellValue(column);
      });

      this.appendRowTemplate = row as T;
    }

    return this.appendRowTemplate;
  }

  private shouldRenderAppendRow(): boolean {
    return (
      !!this.config.appendRow &&
      !this.config.remoteData &&
      this.groupColumns().length === 0 &&
      this.visibleColumns().some(column => column.editable)
    );
  }

  private getAppendRowDefaultCellValue(column: GridColumn<T>): unknown {
    if (column.type === 'number' || column.cellType === 'number' || column.cellType === 'date') {
      return null;
    }

    return '';
  }

  protected allSelected = computed(() => {
    return this.selectionCoverage().all;
  });

  protected someSelected = computed(() => {
    return this.selectionCoverage().some;
  });

  // ===== Virtual scroll helpers =====

  protected get virtualRowHeight(): number {
    return this.getDefaultGridBodyRowHeight();
  }

  protected get virtualViewportHeight(): number {
    if (!this.shouldUseVirtualScroll()) {
      return 0;
    }
    // Limit viewport height to max 20 rows to avoid rendering too many DOM elements.
    // Virtual Scrolling will handle the rest!
    const baseRows = Math.min(this.config.pageSize ?? 20, 20);
    return Math.max(baseRows * this.virtualRowHeight, 320);
  }

  protected shouldUseVirtualScroll(): boolean {
    return this.shouldUseVirtualScrollCached();
  }

  protected getGroupViewportHeight(block: GroupBlock<T>): number {
    return DataGridHelpers.getGroupViewportHeightHelper(this, block);
  }

  protected usesDefaultGridLayout(): boolean {
    return true;
  }

  protected isHoverEnabled(): boolean {
    return this.config.hover !== false;
  }

  protected getDefaultGridBodyRowHeight(): number {
    if (!this.hasExplicitDefaultGridRowHeight) {
      return 28;
    }
    const configuredRowHeight = Number(this.config?.rowHeight);
    if (Number.isFinite(configuredRowHeight) && configuredRowHeight > 0) {
      return Math.round(configuredRowHeight);
    }
    return 28;
  }

  protected syncDefaultGridRowHeightPreference(inputConfig: GridConfig | null | undefined): void {
    this.hasExplicitDefaultGridRowHeight =
      !!inputConfig && Object.prototype.hasOwnProperty.call(inputConfig, 'rowHeight');
  }

  protected setResolvedConfig(nextConfig: GridConfig | null | undefined): void {
    this._config = nextConfig ?? {};
    this.configVersion.update(version => version + 1);
  }

  protected getScrollableHeaderMode(): 'body' {
    return 'body';
  }

  protected shouldRenderHeaderEndInScrollableHeader(): boolean {
    return false;
  }

  // ===== Default Configuration =====

  protected defaultConfig: GridConfig = {
    selectable: true,
    selectMode: 'checkbox',
    pinSelectionColumn: true,
    pagination: true,
    pageSize: 10,
    pageSizeOptions: [5, 10, 25, 50, 100],
    multiSort: true,
    showFilter: true,
    filterDelay: 300,
    virtualScroll: false,
    rowHeight: 38,
    editMode: 'cell',
    exportable: true,
    exportFormats: ['excel', 'csv', 'pdf'],
    enableBookmarks: false,
    striped: true,
    bordered: true,
    hover: true,
    dense: false,
    rtl: false,
    emptyMessage: 'No data to display',
    loadingMessage: 'Loading...'
  };

  constructor(
    protected gridService: DataGridService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private elementRef: ElementRef,
    private ngZone: NgZone,
    private formulaEngine: FormulaEngineService,
    private excelPasteService: ExcelPasteService
  ) {
    // Effect to update pagination when filtered data count changes
    effect(() => {
      const totalRecords = this.filteredDataCount();
      this.updatePaginationState(totalRecords);
    });

    effect(() => {
      this.dataSignal();
      this.filterStates();
      this.sortStates();
      this.quickFilterValues();
      this.columnsSignal();
      this.invalidateFilteredSortedCache();
    });

    effect(() => {
      if (this.displayRowsEffectsSuspended()) {
        return;
      }

      this.configVersion();
      this.dataSignal();
      this.filterStates();
      this.sortStates();
      this.quickFilterValues();
      this.columnsSignal();
      this.paginationState();
      this.groupColumns();
      this.groupDateIntervals();
      this.remoteGroupsSignal();
      this.expandedGroups();
      this.groupExpansionAuto();
      this.groupFilterTerms();
      this.showGroupFooterAggregates();

      if (this.config.remoteData && this.remoteDataStructureRefreshPending()) {
        untracked(() => {
          if (this.hoveredRowIndex() !== null) {
            this.hoveredRowIndex.set(null);
          }
        });
        return;
      }

      // Track lightweight invalidation sources instead of materializing grouped rows just
      // to clear hover-only state.
      untracked(() => {
        if (this.hoveredRowIndex() !== null) {
          this.hoveredRowIndex.set(null);
        }
      });
    });

    effect(() => {
      const groups = this.groupColumns();
      const autoExpand = this.groupExpansionAuto();

      if (!groups.length) {
        if (!autoExpand) {
          this.groupExpansionAuto.set(true);
        }
      }
    });
  }

  protected isHeaderEditing(column: GridColumn<T>): boolean {
    return this.editingHeaderField() === this.getColumnField(column);
  }

  protected startHeaderEdit(column: GridColumn<T>, event?: Event): void {
    if (!column?.headerEditable) {
      return;
    }

    event?.preventDefault();
    event?.stopPropagation();
    this.editingHeaderField.set(this.getColumnField(column));
    this.editingHeaderValue.set(String(column.header ?? '').trim());
  }

  protected onHeaderEditInput(value: string): void {
    this.editingHeaderValue.set(String(value ?? ''));
  }

  protected commitHeaderEdit(column: GridColumn<T>, event?: Event): void {
    if (!this.isHeaderEditing(column)) {
      return;
    }

    event?.preventDefault();
    event?.stopPropagation();

    const field = this.getColumnField(column);
    column.header = this.editingHeaderValue().trim() || field;
    this.columns = [...this.columns];
    this.emitColumnsChange();
    this.cancelHeaderEdit();
  }

  protected cancelHeaderEdit(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.editingHeaderField.set(null);
    this.editingHeaderValue.set('');
  }

  protected onHeaderEditKeydown(event: KeyboardEvent, column: GridColumn<T>): void {
    if (event.key === 'Enter') {
      this.commitHeaderEdit(column, event);
      return;
    }

    if (event.key === 'Escape') {
      this.cancelHeaderEdit(event);
    }
  }

  protected emitColumnsChange(): void {
    this.onColumnsChange.emit(this.columns.map(column => ({ ...column })));
  }

  private resolveSelectionBarBulkEditKind(
    column: GridColumn<T>
  ): GridSelectionBulkEditField['kind'] {
    if (
      column.cellType === 'select' ||
      column.filterType === 'select' ||
      column.type === 'dropdown'
    ) {
      return 'select';
    }
    if (column.cellType === 'number' || column.type === 'number') {
      return 'number';
    }
    if (column.cellType === 'date' || column.type === 'date') {
      return 'date';
    }
    return 'text';
  }

  private mapSelectionBarBulkEditOptions(
    column: GridColumn<T>
  ): GridSelectionBulkEditOption[] | undefined {
    if (!Array.isArray(column.options) || !column.options.length) {
      return undefined;
    }

    return column.options.map((option, index) => ({
      key: String(index),
      label: String(option.label ?? option.value ?? '').trim() || `Option ${index + 1}`,
      value: option.value
    }));
  }
}
