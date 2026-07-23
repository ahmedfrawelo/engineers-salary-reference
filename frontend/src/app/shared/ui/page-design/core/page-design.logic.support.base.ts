import {
  ChangeDetectorRef,
  ContentChild,
  Directive,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  inject
} from '@angular/core';
import { DataGridComponent } from '@shared/data-grid';
import type { FilterOperator, FilterType, GridDateGroupInterval } from '@shared/data-grid';
import {
  SHARED_FILTER_OPERATORS_BY_TYPE,
  SHARED_FILTER_OPERATOR_LABELS,
  SHARED_OPERATORS_WITHOUT_VALUE,
  type SharedAssigneeFilterConfig,
  type SharedMineQuickFilterConfig,
  type SharedToolbarAction,
  type SharedToolbarActionVariant,
  type SharedFilterColumnOption,
  type SharedFilterGroup,
  type SharedFilterJoin,
  type SharedFilterRow,
  type SharedGridApi,
  type SharedGridColumn,
  type SharedGroupSelection,
  type SharedGroupOrder,
  type SharedPaginationState,
  type SharedSavedFilterDefinition,
  type SharedSavedFilterItem
} from '../models';
import type { AssigneeFilterSelection } from '@shared/ui/assignee-filter-menu.component';
import {
  buildSharedFilterRow,
  collectSharedDistinctValuesFromRows,
  filterSharedColumnsByVisibility,
  getGridColumnField,
  readSharedGridSignal,
  resolveSharedColumnIcon,
  resolveSharedFilterType
} from './page-design.utils';
import { PageDesignSavedFiltersApi } from './page-design.saved-filters.api';
import {
  buildSharedSavedFilterComparableKey,
  restoreSharedSavedFilterGroups,
  serializeSharedSavedFilterDefinition
} from './page-design.saved-filters';
import { SharedGroupMenuComponent } from '../menus';

type SharedGroupOption = {
  value: string | null;
  label: string;
  icon: string;
  dateIntervals?: GridDateGroupInterval[];
};

@Directive()
export abstract class PageDesignLogicSupportBase {
  @Input() title = 'Page';
  @Input() sub?: string;
  @Input() icon?: string;
  @Input() hideHeader = false;
  @Input() toolbarAriaLabel = 'Page toolbar';
  @Input() sharedTenderGridToolbar = false;
  @Input() sharedTenderGridToolbarShowViews = true;
  @Input() sharedTenderGridToolbarShowClosed = true;
  @Input() sharedTenderGridToolbarShowAssignee = true;
  @Input() sharedTenderGridToolbarShowGrouping = true;
  @Input() sharedTenderGridToolbarShowColumns = true;
  @Input() sharedTenderGridToolbarShowGroupExpansion = true;
  @Input() sharedToolbarSelectionActions = false;
  @Input() sharedToolbarSelectionCount = 0;
  @Input() sharedToolbarSelectionShowDelete = true;
  @Input() sharedToolbarAvatarSearch = false;
  @Input() sharedToolbarSearchOnly = false;
  @Input() sharedToolbarAvatarText = 'A';
  @Input() sharedToolbarShowCustomize = false;
  @Input() sharedToolbarCustomizeLabel = 'Customize';
  @Input() sharedToolbarCustomizeActive = false;
  @Input() sharedToolbarCustomizeTreatOpenAsActive = true;
  @Input() sharedCustomizePanelTitle = 'Customize view';
  @Input() sharedCustomizePanelShowDefaultContent = true;
  @Input() sharedCustomizePanelActionIcon = '';
  @Input() sharedCustomizePanelActionLabel = '';
  @Input() sharedCustomizePanelActionDisabled = false;
  @Input() sharedCustomizePanelActionMenuItems: Array<{ id: string; label: string; icon?: string }> = [];
  @Input() set sharedCustomizeOpenRequest(value: number | null | undefined) {
    const request = Number(value ?? 0);
    if (!Number.isFinite(request) || request <= 0 || request === this.sharedCustomizeOpenRequestValue) {
      return;
    }
    this.sharedCustomizeOpenRequestValue = request;
    this.openSharedCustomizePanelFromInput();
  }
  @Input() set sharedCustomizeCloseRequest(value: number | null | undefined) {
    const request = Number(value ?? 0);
    if (!Number.isFinite(request) || request <= 0 || request === this.sharedCustomizeCloseRequestValue) {
      return;
    }
    this.sharedCustomizeCloseRequestValue = request;
    this.closeSharedCustomizePanelFromInput();
  }
  @Input() sharedToolbarSearchPlaceholder = 'Search...';
  @Input() sharedToolbarSearchVariant: SharedToolbarActionVariant = 'default';
  @Input() sharedToolbarAssigneeFilter: SharedAssigneeFilterConfig | null = null;
  @Input() sharedToolbarMineQuickFilter: SharedMineQuickFilterConfig | null = null;
  @Input() set sharedToolbarSearchValue(value: string) {
    this.sharedToolbarSearchTerm = value ?? '';
  }
  @Input() sharedToolbarActionsBeforeSearch: SharedToolbarAction[] = [];
  @Input() sharedToolbarActions: SharedToolbarAction[] = [];
  @Input() sharedGridApi: SharedGridApi | null = null;

  @Output() sharedViewsRequested = new EventEmitter<HTMLElement>();
  @Output() sharedToolbarSelectionEditRequested = new EventEmitter<void>();
  @Output() sharedToolbarSelectionDeleteRequested = new EventEmitter<void>();
  @Output() sharedToolbarCustomizeRequested = new EventEmitter<void>();
  @Output() sharedToolbarSearchChanged = new EventEmitter<string>();
  @Output() sharedToolbarAssigneeSelectionChanged = new EventEmitter<AssigneeFilterSelection>();
  @Output() sharedToolbarMineQuickToggleRequested = new EventEmitter<void>();
  @Output() sharedToolbarMineQuickClearRequested = new EventEmitter<Event>();
  @Output() sharedToolbarMineQuickOptionToggled = new EventEmitter<string>();
  @Output() sharedToolbarActionTriggered = new EventEmitter<string>();
  @Output() sharedToolbarSurfaceOpened = new EventEmitter<string>();
  @Output() sharedCustomizePanelClosed = new EventEmitter<void>();
  @Output() sharedCustomizePanelActionTriggered = new EventEmitter<void>();
  @Output() sharedCustomizePanelActionMenuTriggered = new EventEmitter<string>();

  @ContentChild(DataGridComponent, { descendants: true })
  protected dataGrid?: DataGridComponent<unknown>;
  @ViewChild('sharedToolbarSearchInput', { read: ElementRef })
  protected sharedToolbarSearchInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('sharedGroupMenuCmp')
  protected sharedGroupMenuRef?: SharedGroupMenuComponent;
  @ViewChild('sharedFiltersMenu', { read: ElementRef })
  protected sharedFiltersMenuRef?: ElementRef<HTMLElement>;
  @ViewChild('pageHeader', { read: ElementRef })
  protected pageHeaderRef?: ElementRef<HTMLElement>;
  @ViewChild('pageToolbar', { read: ElementRef })
  protected pageToolbarRef?: ElementRef<HTMLElement>;

  protected readonly cdr = inject(ChangeDetectorRef);
  private readonly pageDesignSavedFiltersApi = inject(PageDesignSavedFiltersApi);
  protected sharedColumnsSearchTerm = '';
  protected sharedGroupOrder: SharedGroupOrder = 'asc';
  protected sharedSubGroupOrder: SharedGroupOrder = 'asc';
  protected sharedGroupSelectionsDraft: SharedGroupSelection[] = [{ value: null, order: 'asc' }];
  protected sharedToolbarFilterGroups: SharedFilterGroup[] = [];
  protected sharedFilterPanelOpen = false;
  protected sharedToolbarSearchOpen = false;
  protected sharedToolbarSearchTerm = '';
  protected sharedColumnsPanelOpen = false;
  protected sharedColumnsFromCustomize = false;
  protected sharedCustomizePanelOpen = false;
  protected sharedColumnsPanelTopInset = 0;
  protected sharedColumnsShownExpanded = true;
  protected sharedColumnsHiddenExpanded = true;
  protected sharedFilterFieldSearchTerms: Record<string, string> = {};
  protected readonly sharedGroupOrderOptions: Array<{ value: SharedGroupOrder; label: string }> = [
    { value: 'asc', label: 'Ascending' },
    { value: 'desc', label: 'Descending' }
  ];
  protected sharedFilterIdCounter = 0;
  protected sharedFilterGroupIdCounter = 0;
  protected sharedLastAppliedGroupSortField: string | null = null;
  protected sharedSavedFilterItems: SharedSavedFilterItem[] = [];
  protected sharedSavedFiltersLoadingState = false;
  protected sharedSavedFiltersMutatingState = false;
  protected sharedSavedFiltersErrorMessage = '';
  private sharedFilterPanelPositionFrameId: number | null = null;
  private sharedSavedFiltersLoadedPageKey: string | null = null;
  private sharedGroupableColumnsCacheColumns: SharedGridColumn[] | null = null;
  private sharedGroupableColumnsCacheKey = '';
  private sharedGroupableColumnsCache: SharedGridColumn[] = [];
  private sharedGroupOptionsCacheColumns: SharedGridColumn[] | null = null;
  private sharedGroupOptionsCache: SharedGroupOption[] = [];
  private sharedActiveGroupSelectionsCacheSource: SharedGroupSelection[] | null = null;
  private sharedActiveGroupSelectionsCache: Array<
    SharedGroupSelection & { value: string; order: SharedGroupOrder }
  > = [];
  private sharedGroupingExpandedCacheMode: 'single' | 'multi' | '' = '';
  private sharedGroupingExpandedCacheSource: unknown = null;
  private sharedGroupingExpandedCacheExpandedKey = '';
  private sharedGroupingExpandedCacheValue = false;
  private sharedColumnsVisibilityCacheColumns: SharedGridColumn[] | null = null;
  private sharedColumnsVisibilityCacheKey = '';
  private sharedColumnsVisibilityShownCache: SharedGridColumn[] = [];
  private sharedColumnsVisibilityHiddenCache: SharedGridColumn[] = [];
  private sharedToolbarFiltersCacheGroups: SharedFilterGroup[] | null = null;
  private sharedToolbarFiltersCache: SharedFilterRow[] = [];
  private sharedActiveFilterCountCacheGroups: SharedFilterGroup[] | null = null;
  private sharedActiveFilterCountCache = 0;
  private sharedSavedFilterDefinitionCacheGroups: SharedFilterGroup[] | null = null;
  private sharedSavedFilterDefinitionCache: SharedSavedFilterDefinition | null = null;
  private sharedCurrentSavedFilterIdCacheItems: SharedSavedFilterItem[] | null = null;
  private sharedCurrentSavedFilterIdCacheKey = '';
  private sharedCurrentSavedFilterIdCacheValue: number | null = null;
  private sharedToolbarFiltersApplyTimer: ReturnType<typeof setTimeout> | null = null;
  private sharedCustomizeOpenRequestValue = 0;
  private sharedCustomizeCloseRequestValue = 0;

  private openSharedCustomizePanelFromInput(): void {
    this.sharedFilterPanelOpen = false;
    this.sharedColumnsPanelOpen = false;
    this.sharedColumnsFromCustomize = false;
    this.sharedToolbarSearchOpen = false;
    this.sharedCustomizePanelOpen = true;
    this.sharedColumnsPanelTopInset = this.readSharedColumnsPanelTopInset();
    this.cdr.markForCheck();
  }

  private closeSharedCustomizePanelFromInput(): void {
    if (!this.sharedCustomizePanelOpen) {
      return;
    }
    this.sharedCustomizePanelOpen = false;
    this.sharedCustomizePanelClosed.emit();
    this.cdr.markForCheck();
  }

  protected get sharedToolbarFilters(): SharedFilterRow[] {
    const groups = this.sharedToolbarFilterGroups;
    if (this.sharedToolbarFiltersCacheGroups === groups) {
      return this.sharedToolbarFiltersCache;
    }

    const flattened: SharedFilterRow[] = [];
    groups.forEach((group, groupIndex) => {
      group.rows.forEach((row, rowIndex) => {
        if (groupIndex > 0 && rowIndex === 0) {
          flattened.push({ ...row, joinWithPrev: group.joinWithPrev });
          return;
        }
        flattened.push(row);
      });
    });
    this.sharedToolbarFiltersCacheGroups = groups;
    this.sharedToolbarFiltersCache = flattened;
    return flattened;
  }

  protected sharedGroupSelectionsUi(): SharedGroupSelection[] {
    const fromGrid = this.readSharedGroupSelectionsFromGrid();
    if (
      !this.sharedGroupSelectionsDraft.length ||
      !this.isSameActiveGroupSelections(this.sharedGroupSelectionsDraft, fromGrid)
    ) {
      this.sharedGroupSelectionsDraft = fromGrid;
    }
    return this.sharedGroupSelectionsDraft;
  }

  protected sharedGroupByField(): string | null {
    return this.sharedActiveGroupSelections()[0]?.value ?? null;
  }

  protected sharedSubGroupByField(): string | null {
    return this.sharedActiveGroupSelections()[1]?.value ?? null;
  }

  protected sharedGroupOptions(): SharedGroupOption[] {
    const columns = this.sharedGroupableColumns();
    if (this.sharedGroupOptionsCacheColumns === columns) {
      return this.sharedGroupOptionsCache;
    }

    const next = [
      { value: null, label: 'None', icon: 'x-circle' },
      ...columns.map(column => ({
        value: this.getGridColumnField(column),
        label: this.sharedColumnLabel(column),
        icon: this.sharedColumnMenuIcon(column),
        dateIntervals: this.sharedColumnDateGroupIntervals(column)
      }))
    ];
    this.sharedGroupOptionsCacheColumns = columns;
    this.sharedGroupOptionsCache = next;
    return next;
  }

  private sharedColumnDateGroupIntervals(
    column: SharedGridColumn
  ): GridDateGroupInterval[] | undefined {
    if (this.resolveSharedFilterType(column) !== 'date') {
      return undefined;
    }
    const configured = Array.isArray(column.groupDateIntervals)
      ? column.groupDateIntervals.filter(
          (interval): interval is GridDateGroupInterval =>
            interval === 'day' ||
            interval === 'week' ||
            interval === 'month' ||
            interval === 'quarter' ||
            interval === 'year'
        )
      : [];
    return configured.length
      ? [...new Set(configured)]
      : ['day', 'week', 'month', 'quarter', 'year'];
  }

  protected sharedSubGroupOptions(): Array<{ value: string | null; label: string; icon: string }> {
    const primary = this.sharedGroupByField();
    return [
      { value: null, label: 'None', icon: 'x-circle' },
      ...this.sharedGroupableColumns()
        .filter(column => this.getGridColumnField(column) !== primary)
        .map(column => ({
          value: this.getGridColumnField(column),
          label: this.sharedColumnLabel(column),
          icon: this.sharedColumnMenuIcon(column)
        }))
    ];
  }

  protected sharedGroupIcon(): string {
    const activeField = this.sharedGroupByField();
    if (!activeField) {
      return 'layers';
    }
    return this.sharedGroupOptions().find(option => option.value === activeField)?.icon ?? 'layers';
  }

  protected sharedSubGroupLabel(): string {
    const activeField = this.sharedSubGroupByField();
    if (!activeField) {
      return 'None';
    }
    return this.sharedGroupOptions().find(option => option.value === activeField)?.label ?? 'None';
  }

  protected sharedSubGroupIcon(): string {
    const activeField = this.sharedSubGroupByField();
    if (!activeField) {
      return 'layers';
    }
    return this.sharedGroupOptions().find(option => option.value === activeField)?.icon ?? 'layers';
  }

  protected sharedGroupableColumns(): SharedGridColumn[] {
    const columns = this.getSharedGridColumns();
    const groupedColumns = this.readSignal<string[]>('groupColumns');
    const cacheKey = this.buildSharedGroupableColumnsCacheKey(columns, groupedColumns);
    if (
      this.sharedGroupableColumnsCacheColumns === columns &&
      this.sharedGroupableColumnsCacheKey === cacheKey
    ) {
      return this.sharedGroupableColumnsCache;
    }

    const groupedFields = new Set(groupedColumns);
    const next = columns.filter(column => {
      if (!column || typeof column !== 'object') return false;
      const field = this.getGridColumnField(column);
      if (!field) return false;
      if (field === '__selection__') return false;
      // Keep grouped columns eligible even when grid hides them automatically.
      if (column.hidden && !groupedFields.has(field)) return false;
      if (column.groupable === false) return false;
      return true;
    });
    this.sharedGroupableColumnsCacheColumns = columns;
    this.sharedGroupableColumnsCacheKey = cacheKey;
    this.sharedGroupableColumnsCache = next;
    return next;
  }

  protected sharedColumnLabel(column: SharedGridColumn): string {
    return !column
      ? ''
      : (typeof column.header === 'string' && column.header) || this.getGridColumnField(column);
  }

  protected sharedColumnField(column: SharedGridColumn): string {
    return this.getGridColumnField(column);
  }

  protected sharedColumnMenuIcon(column: SharedGridColumn): string {
    return this.sharedColumnIcon(column, this.resolveSharedFilterType(column));
  }

  protected sharedActiveFilterCount(): number {
    if (!this.sharedFilterPanelOpen) {
      (
        this as unknown as { syncSharedToolbarFiltersFromGrid?: () => void }
      ).syncSharedToolbarFiltersFromGrid?.();
    }
    const groups = this.sharedToolbarFilterGroups;
    if (this.sharedActiveFilterCountCacheGroups === groups) {
      return this.sharedActiveFilterCountCache;
    }

    let count = 0;
    for (const group of groups) {
      for (const filter of group.rows) {
        if (this.isSharedFilterComplete(filter)) {
          count += 1;
        }
      }
    }
    this.sharedActiveFilterCountCacheGroups = groups;
    this.sharedActiveFilterCountCache = count;
    return count;
  }

  protected sharedFilterOperatorNeedsNoValue(operator: FilterOperator): boolean {
    return SHARED_OPERATORS_WITHOUT_VALUE.has(operator);
  }

  protected sharedActiveGroupSelections(): Array<
    SharedGroupSelection & { value: string; order: SharedGroupOrder }
  > {
    const rows = this.sharedGroupSelectionsUi();
    if (this.sharedActiveGroupSelectionsCacheSource === rows) {
      return this.sharedActiveGroupSelectionsCache;
    }

    this.sharedActiveGroupSelectionsCacheSource = rows;
    this.sharedActiveGroupSelectionsCache = rows.filter(
      (row): row is SharedGroupSelection & { value: string; order: SharedGroupOrder } => !!row.value
    );
    return this.sharedActiveGroupSelectionsCache;
  }

  protected sharedGroupingActive(): boolean {
    return this.readSignal<string[]>('groupColumns').length > 0;
  }

  protected sharedGroupingExpandedAll(): boolean {
    const groupColumns = this.readSignal<string[]>('groupColumns');
    if (!groupColumns.length) {
      return false;
    }

    const grid = this.getSharedGrid();
    if (!grid || typeof grid.isGroupExpandedById !== 'function') {
      return false;
    }

    const expandedGroups = this.readSignal<Set<string> | null>('expandedGroups');
    const expandedKey =
      expandedGroups instanceof Set ? this.buildSharedExpandedGroupsCacheKey(expandedGroups) : null;

    if (groupColumns.length === 1) {
      const blocks = this.readSignal<Array<{ id: string }>>('groupedBlocks');
      if (
        expandedKey != null &&
        this.sharedGroupingExpandedCacheMode === 'single' &&
        this.sharedGroupingExpandedCacheSource === blocks &&
        this.sharedGroupingExpandedCacheExpandedKey === expandedKey
      ) {
        return this.sharedGroupingExpandedCacheValue;
      }
      if (!blocks.length) {
        this.cacheSharedGroupingExpandedState('single', blocks, expandedKey, false);
        return false;
      }
      const expanded = blocks.every(block => grid.isGroupExpandedById?.(block.id));
      this.cacheSharedGroupingExpandedState('single', blocks, expandedKey, expanded);
      return expanded;
    }

    const rows = this.readSignal<Array<{ kind: string; id: string }>>('displayRows');
    if (
      expandedKey != null &&
      this.sharedGroupingExpandedCacheMode === 'multi' &&
      this.sharedGroupingExpandedCacheSource === rows &&
      this.sharedGroupingExpandedCacheExpandedKey === expandedKey
    ) {
      return this.sharedGroupingExpandedCacheValue;
    }

    let groupRowsCount = 0;
    for (const row of rows) {
      if (row?.kind !== 'group') {
        continue;
      }
      groupRowsCount += 1;
      if (!grid.isGroupExpandedById?.(row.id)) {
        this.cacheSharedGroupingExpandedState('multi', rows, expandedKey, false);
        return false;
      }
    }
    if (!groupRowsCount) {
      this.cacheSharedGroupingExpandedState('multi', rows, expandedKey, false);
      return false;
    }
    this.cacheSharedGroupingExpandedState('multi', rows, expandedKey, true);
    return true;
  }

  protected toggleSharedGroupExpansion(): void {
    const grid = this.getSharedGrid();
    if (!grid || !this.sharedGroupingActive()) {
      return;
    }
    if (this.sharedGroupingExpandedAll()) {
      grid.collapseAllGroups?.();
    } else {
      grid.expandAllGroups?.();
    }
    this.cdr.markForCheck();
  }

  protected readSharedGroupSelectionsFromGrid(): SharedGroupSelection[] {
    const groupedFields = this.readSignal<string[]>('groupColumns');
    if (!groupedFields.length) {
      return [{ value: null, order: this.sharedGroupOrder }];
    }

    const sortStates =
      this.readSignal<Array<{ field: string; direction: 'asc' | 'desc'; order: number }>>(
        'sortStates'
      );
    const dateIntervals =
      this.readSignal<Record<string, GridDateGroupInterval>>('groupDateIntervals');
    const directionByField = new Map(
      sortStates.map(state => [
        state.field,
        state.direction === 'desc' ? 'desc' : ('asc' as SharedGroupOrder)
      ])
    );

    return this.normalizeSharedGroupSelections(
      groupedFields.map((field, index) => ({
        value: field,
        order: directionByField.get(field) ?? (index === 0 ? this.sharedGroupOrder : 'asc'),
        dateInterval: dateIntervals[field] ?? null
      }))
    );
  }

  protected isSameActiveGroupSelections(
    a: SharedGroupSelection[],
    b: SharedGroupSelection[]
  ): boolean {
    const activeA = a.filter(
      (row): row is SharedGroupSelection & { value: string; order: SharedGroupOrder } => !!row.value
    );
    const activeB = b.filter(
      (row): row is SharedGroupSelection & { value: string; order: SharedGroupOrder } => !!row.value
    );

    if (activeA.length !== activeB.length) {
      return false;
    }

    return activeA.every((row, index) => {
      const other = activeB[index];
      return (
        other &&
        row.value === other.value &&
        row.order === other.order &&
        (row.dateInterval ?? null) === (other.dateInterval ?? null)
      );
    });
  }

  protected normalizeSharedGroupSelections(rows: SharedGroupSelection[]): SharedGroupSelection[] {
    const validFields = new Set(
      this.sharedGroupableColumns().map(column => this.getGridColumnField(column))
    );
    const uniqueFields = new Set<string>();
    const normalized: SharedGroupSelection[] = [];
    let hasBlankRow = false;

    for (const row of rows ?? []) {
      const rawValue = typeof row?.value === 'string' ? row.value.trim() : '';
      const normalizedOrder: SharedGroupOrder = row?.order === 'desc' ? 'desc' : 'asc';
      const normalizedDateInterval = this.normalizeSharedDateGroupInterval(
        rawValue,
        row?.dateInterval
      );
      if (!rawValue || !validFields.has(rawValue) || uniqueFields.has(rawValue)) {
        normalized.push({ value: null, order: normalizedOrder, dateInterval: null });
        hasBlankRow = true;
        continue;
      }
      uniqueFields.add(rawValue);
      normalized.push({
        value: rawValue,
        order: normalizedOrder,
        dateInterval: normalizedDateInterval
      });
    }

    const activeRows = normalized.filter(
      (row): row is SharedGroupSelection & { value: string; order: SharedGroupOrder } => !!row.value
    );

    if (!activeRows.length) {
      const firstOrder = normalized[0]?.order === 'desc' ? 'desc' : 'asc';
      return [{ value: null, order: firstOrder }];
    }

    if (hasBlankRow) {
      return [...activeRows, { value: null, order: 'asc' }];
    }

    return activeRows;
  }

  protected normalizeSharedDateGroupInterval(
    field: string,
    interval: GridDateGroupInterval | null | undefined
  ): GridDateGroupInterval | null {
    if (!field) {
      return null;
    }
    const option = this.sharedGroupOptions().find(option => option.value === field);
    const intervals = option?.dateIntervals ?? [];
    if (!intervals.length) {
      return null;
    }
    return interval && intervals.includes(interval) ? interval : intervals[0];
  }

  protected getGridColumnField(column: SharedGridColumn): string {
    return getGridColumnField(this.getSharedGrid(), column);
  }

  protected readSignal<T>(key: string): T {
    return readSharedGridSignal(this.getSharedGrid(), key, [] as T);
  }

  protected applySharedGrouping(selections: SharedGroupSelection[]): void {
    const grid = this.getSharedGrid();
    if (!grid) {
      return;
    }

    const groupedFields = this.readSignal<string[]>('groupColumns');
    for (const groupedField of groupedFields) {
      if (typeof grid.removeGroupColumn === 'function') {
        grid.removeGroupColumn(groupedField);
      }
    }

    const activeSelections = this.normalizeSharedGroupSelections(selections).filter(
      (row): row is SharedGroupSelection & { value: string; order: SharedGroupOrder } => !!row.value
    );

    if (!activeSelections.length) {
      if (typeof grid.clearAllGrouping === 'function') {
        grid.clearAllGrouping();
      }
      if (grid.sortStates && typeof grid.sortStates.set === 'function') {
        grid.sortStates.set([]);
      }
      if (this.sharedLastAppliedGroupSortField && typeof grid.clearSortForColumn === 'function') {
        const prev = this.sharedGroupableColumns().find(
          column => this.getGridColumnField(column) === this.sharedLastAppliedGroupSortField
        );
        if (prev) {
          grid.clearSortForColumn(prev);
        }
      }
      this.sharedLastAppliedGroupSortField = null;
      return;
    }

    const groupableColumns = this.sharedGroupableColumns();
    const appliedRows: Array<{
      field: string;
      order: SharedGroupOrder;
      dateInterval: GridDateGroupInterval | null;
      column: SharedGridColumn;
    }> = [];

    if (typeof grid.clearAllGrouping === 'function') {
      grid.clearAllGrouping();
    }

    const useSingleGroupingState =
      activeSelections.length === 1 && typeof grid.applyGroupingState === 'function';

    for (const selection of activeSelections) {
      const column = groupableColumns.find(col => this.getGridColumnField(col) === selection.value);
      if (!column) {
        continue;
      }
      if (useSingleGroupingState) {
        grid.applyGroupingState?.(
          column,
          selection.order,
          this.normalizeSharedDateGroupInterval(selection.value, selection.dateInterval)
        );
      } else if (typeof grid.groupByColumn === 'function') {
        grid.groupByColumn(column);
      }
      appliedRows.push({
        field: this.getGridColumnField(column),
        order: selection.order,
        dateInterval: selection.dateInterval ?? null,
        column
      });
    }

    if (!appliedRows.length) {
      if (typeof grid.clearAllGrouping === 'function') {
        grid.clearAllGrouping();
      }
      if (grid.sortStates && typeof grid.sortStates.set === 'function') {
        grid.sortStates.set([]);
      }
      this.sharedLastAppliedGroupSortField = null;
      return;
    }

    if (grid.sortStates && typeof grid.sortStates.set === 'function') {
      grid.sortStates.set(
        appliedRows.map((row, index) => ({
          field: row.field,
          direction: row.order === 'desc' ? 'desc' : 'asc',
          order: index
        }))
      );
    } else {
      const first = appliedRows[0];
      if (first.order === 'desc' && typeof grid.sortColumnDesc === 'function') {
        grid.sortColumnDesc(first.column);
      } else if (typeof grid.sortColumnAsc === 'function') {
        grid.sortColumnAsc(first.column);
      }
    }

    for (const row of appliedRows) {
      grid.setGroupDateInterval?.(row.field, row.dateInterval);
    }

    this.sharedLastAppliedGroupSortField = appliedRows[0]?.field ?? null;
  }

  protected readonly applySharedColumnOrder = (fieldOrder: string[]): void => {
    const grid = this.getSharedGrid();
    if (!grid) {
      return;
    }

    const current = this.getSharedGridColumns();
    const anchored = current.filter(column => {
      const field = this.getGridColumnField(column);
      return !field || field === '__selection__';
    });
    const reorderable = current.filter(column => {
      const field = this.getGridColumnField(column);
      return !!field && field !== '__selection__';
    });
    const orderedByField = new Map(
      reorderable.map(column => [this.getGridColumnField(column), column] as const)
    );
    const ordered: SharedGridColumn[] = [];

    for (const field of fieldOrder) {
      const column = orderedByField.get(field);
      if (!column) {
        continue;
      }
      ordered.push(column);
      orderedByField.delete(field);
    }

    const remaining = reorderable.filter(column =>
      orderedByField.has(this.getGridColumnField(column))
    );
    grid.columns = [...anchored, ...ordered, ...remaining];

    if (typeof grid.invalidateFilteredSortedCache === 'function') {
      grid.invalidateFilteredSortedCache();
    }
    if (typeof grid.syncAggregateDisplayState === 'function') {
      grid.syncAggregateDisplayState();
    }
    if (grid.cdr && typeof grid.cdr.markForCheck === 'function') {
      grid.cdr.markForCheck();
    }
    this.cdr.markForCheck();
  };

  protected createSharedFilterRow(): SharedFilterRow {
    this.sharedFilterIdCounter += 1;
    return buildSharedFilterRow(`page-design-filter-${this.sharedFilterIdCounter}`);
  }

  protected createSharedFilterGroup(rows?: SharedFilterRow[]): SharedFilterGroup {
    this.sharedFilterGroupIdCounter += 1;
    return {
      id: `page-design-filter-group-${this.sharedFilterGroupIdCounter}`,
      joinWithPrev: 'and',
      rows: this.normalizeSharedFilterGroupRows(
        rows?.length ? rows : [this.createSharedFilterRow()]
      )
    };
  }

  protected isSharedFilterComplete(filter: SharedFilterRow): boolean {
    if (!filter.field.trim()) return false;
    return this.sharedFilterOperatorNeedsNoValue(filter.operator) || filter.value.trim().length > 0;
  }

  protected normalizeSharedFilterGroupRows(rows: SharedFilterRow[]): SharedFilterRow[] {
    if (!rows.length || rows.length < 2) {
      return rows;
    }

    const sharedJoin: SharedFilterJoin = rows[1]?.joinWithPrev === 'or' ? 'or' : 'and';
    return rows.map((row, index) => (index === 0 ? row : { ...row, joinWithPrev: sharedJoin }));
  }

  protected applySharedToolbarFilters(): void {
    this.cancelSharedToolbarFiltersApply();

    const grid = this.getSharedGrid();
    if (!grid?.filterStates) {
      return;
    }

    const nextStates = this.sharedToolbarFilters
      .filter(filter => this.isSharedFilterComplete(filter))
      .map(filter => {
        const joinWithPrev: 'and' | 'or' = filter.joinWithPrev === 'or' ? 'or' : 'and';
        return {
          field: filter.field.trim(),
          operator: filter.operator,
          value: this.sharedFilterOperatorNeedsNoValue(filter.operator) ? '' : filter.value,
          joinWithPrev
        };
      });

    if (typeof grid.applyExternalFilters === 'function') {
      grid.applyExternalFilters(nextStates);
      this.cdr.markForCheck();
      return;
    }

    if (typeof grid.filterStates.set === 'function') {
      grid.filterStates.set(nextStates);
    }

    if (typeof grid.invalidateFilteredSortedCache === 'function') {
      grid.invalidateFilteredSortedCache();
    }
    if (typeof grid.syncAggregateDisplayState === 'function') {
      grid.syncAggregateDisplayState();
    }
    if (grid.paginationState && typeof grid.paginationState.update === 'function') {
      grid.paginationState.update((state: SharedPaginationState) => ({ ...state, currentPage: 1 }));
    }
    if (grid.cdr && typeof grid.cdr.markForCheck === 'function') {
      grid.cdr.markForCheck();
    }
    this.cdr.markForCheck();
  }

  protected scheduleSharedToolbarFiltersApply(): void {
    this.cancelSharedToolbarFiltersApply();
    const delay = this.resolveSharedToolbarFiltersApplyDelay();
    if (delay <= 0) {
      this.applySharedToolbarFilters();
      return;
    }

    this.sharedToolbarFiltersApplyTimer = setTimeout(() => {
      this.sharedToolbarFiltersApplyTimer = null;
      this.applySharedToolbarFilters();
    }, delay);
  }

  protected cancelSharedToolbarFiltersApply(): void {
    if (this.sharedToolbarFiltersApplyTimer != null) {
      clearTimeout(this.sharedToolbarFiltersApplyTimer);
    }
    this.sharedToolbarFiltersApplyTimer = null;
  }

  private resolveSharedToolbarFiltersApplyDelay(): number {
    const grid = this.getSharedGrid() as
      | {
          config?: {
            debounceTime?: unknown;
            filterDelay?: unknown;
          };
        }
      | null
      | undefined;
    const configured = Number(grid?.config?.debounceTime ?? grid?.config?.filterDelay);
    if (Number.isFinite(configured) && configured >= 0) {
      return Math.floor(configured);
    }
    return 150;
  }

  protected scheduleSharedFilterPanelPositionUpdate(): void {
    if (!this.sharedFilterPanelOpen) {
      return;
    }

    if (this.sharedFilterPanelPositionFrameId != null) {
      cancelAnimationFrame(this.sharedFilterPanelPositionFrameId);
      this.sharedFilterPanelPositionFrameId = null;
    }

    queueMicrotask(() => {
      if (!this.sharedFilterPanelOpen) {
        return;
      }
      if (this.updateSharedFilterPanelPosition()) {
        return;
      }
      this.sharedFilterPanelPositionFrameId = requestAnimationFrame(() => {
        this.sharedFilterPanelPositionFrameId = null;
        if (this.updateSharedFilterPanelPosition()) {
          return;
        }
        this.sharedFilterPanelPositionFrameId = requestAnimationFrame(() => {
          this.sharedFilterPanelPositionFrameId = null;
          this.updateSharedFilterPanelPosition();
        });
      });
    });
  }

  protected requestSharedFilterPanelPositionUpdate(): void {
    if (!this.sharedFilterPanelOpen) {
      return;
    }

    if (this.sharedFilterPanelPositionFrameId != null) {
      return;
    }

    if (typeof requestAnimationFrame === 'undefined') {
      this.updateSharedFilterPanelPosition();
      return;
    }

    this.sharedFilterPanelPositionFrameId = requestAnimationFrame(() => {
      this.sharedFilterPanelPositionFrameId = null;
      this.updateSharedFilterPanelPosition();
    });
  }

  protected updateSharedFilterPanelPosition(): boolean {
    const host = this.sharedFiltersMenuRef?.nativeElement;
    if (!host) {
      return false;
    }

    const panel = host.querySelector<HTMLElement>('.proj-filter-menu-list');
    if (!panel) {
      return false;
    }

    host.style.setProperty('--proj-filter-offset-x', '0px');
    panel.style.left = '';
    panel.style.right = '';

    const viewportWidth = Math.max(window.innerWidth || 0, document.documentElement.clientWidth);
    const viewportPadding = 12;
    const hostRect = host.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const panelWidth = Math.ceil(panelRect.width);
    const maxLeft = Math.max(viewportPadding, viewportWidth - viewportPadding - panelWidth);
    const desiredLeft = Math.min(
      Math.max(viewportPadding, Math.round(hostRect.right - panelWidth)),
      maxLeft
    );
    const relativeLeft = desiredLeft - Math.round(hostRect.left);

    panel.style.left = `${relativeLeft}px`;
    panel.style.right = 'auto';
    return true;
  }

  protected resetSharedFilterPanelPosition(): void {
    if (this.sharedFilterPanelPositionFrameId != null) {
      cancelAnimationFrame(this.sharedFilterPanelPositionFrameId);
      this.sharedFilterPanelPositionFrameId = null;
    }

    const host = this.sharedFiltersMenuRef?.nativeElement;
    const panel = host?.querySelector<HTMLElement>('.proj-filter-menu-list');

    host?.style.setProperty('--proj-filter-offset-x', '0px');
    if (panel) {
      panel.style.left = '';
      panel.style.right = '';
    }
  }

  protected readSharedColumnsPanelTopInset(): number {
    const total =
      (this.pageHeaderRef?.nativeElement?.offsetHeight ?? 0) +
      (this.pageToolbarRef?.nativeElement?.offsetHeight ?? 0);
    return total > 0 ? total : 0;
  }

  protected resolveSharedFilterType(column: SharedGridColumn): FilterType {
    return resolveSharedFilterType(column);
  }

  protected sharedColumnIcon(column: SharedGridColumn, filterType: FilterType): string {
    const explicitIcon = typeof column?.icon === 'string' ? column.icon.trim() : '';
    if (explicitIcon) {
      return explicitIcon;
    }
    return resolveSharedColumnIcon(this.getGridColumnField(column), filterType);
  }

  protected sharedColumnsByVisibility(hidden: boolean): SharedGridColumn[] {
    const grid = this.getSharedGrid();
    const columns = this.getSharedGridColumns();
    const cacheKey = this.buildSharedColumnsVisibilityCacheKey(
      columns,
      this.sharedColumnsSearchTerm
    );
    if (
      this.sharedColumnsVisibilityCacheColumns === columns &&
      this.sharedColumnsVisibilityCacheKey === cacheKey
    ) {
      return hidden
        ? this.sharedColumnsVisibilityHiddenCache
        : this.sharedColumnsVisibilityShownCache;
    }

    this.sharedColumnsVisibilityCacheColumns = columns;
    this.sharedColumnsVisibilityCacheKey = cacheKey;
    this.sharedColumnsVisibilityShownCache = filterSharedColumnsByVisibility(
      columns,
      false,
      this.sharedColumnsSearchTerm,
      column => getGridColumnField(grid, column),
      column => this.sharedColumnLabel(column)
    );
    this.sharedColumnsVisibilityHiddenCache = filterSharedColumnsByVisibility(
      columns,
      true,
      this.sharedColumnsSearchTerm,
      column => getGridColumnField(grid, column),
      column => this.sharedColumnLabel(column)
    );
    return hidden
      ? this.sharedColumnsVisibilityHiddenCache
      : this.sharedColumnsVisibilityShownCache;
  }

  protected getSharedGrid(): SharedGridApi | null {
    return (
      this.sharedGridApi ?? (this.dataGrid ? (this.dataGrid as unknown as SharedGridApi) : null)
    );
  }

  protected sharedSavedFiltersEnabled(): boolean {
    return !!this.resolveSharedSavedFiltersPageKey();
  }

  protected sharedSavedFilters(): SharedSavedFilterItem[] {
    return this.sharedSavedFilterItems;
  }

  protected sharedSavedFiltersLoading(): boolean {
    return this.sharedSavedFiltersLoadingState;
  }

  protected sharedSavedFiltersBusy(): boolean {
    return this.sharedSavedFiltersMutatingState;
  }

  protected sharedSavedFiltersError(): string {
    return this.sharedSavedFiltersErrorMessage;
  }

  protected sharedCanSaveCurrentFilter(): boolean {
    return !!this.buildSharedSavedFilterDefinition();
  }

  protected sharedCurrentSavedFilterId(): number | null {
    const definition = this.buildSharedSavedFilterDefinition();
    const currentKey = buildSharedSavedFilterComparableKey(definition);
    if (!currentKey) {
      return null;
    }

    const items = this.sharedSavedFilterItems;
    if (
      this.sharedCurrentSavedFilterIdCacheItems === items &&
      this.sharedCurrentSavedFilterIdCacheKey === currentKey
    ) {
      return this.sharedCurrentSavedFilterIdCacheValue;
    }

    const currentId =
      items.find(item => buildSharedSavedFilterComparableKey(item.definition) === currentKey)?.id ??
      null;
    this.sharedCurrentSavedFilterIdCacheItems = items;
    this.sharedCurrentSavedFilterIdCacheKey = currentKey;
    this.sharedCurrentSavedFilterIdCacheValue = currentId;
    return currentId;
  }

  protected loadSharedSavedFilters(force = false): void {
    const pageKey = this.resolveSharedSavedFiltersPageKey();
    if (!pageKey) {
      this.sharedSavedFilterItems = [];
      this.sharedSavedFiltersLoadingState = false;
      this.sharedSavedFiltersErrorMessage = '';
      this.sharedSavedFiltersLoadedPageKey = null;
      this.cdr.markForCheck();
      return;
    }

    if (
      !force &&
      this.sharedSavedFiltersLoadedPageKey === pageKey &&
      (this.sharedSavedFilterItems.length > 0 || !this.sharedSavedFiltersErrorMessage)
    ) {
      return;
    }

    this.sharedSavedFiltersLoadingState = true;
    this.sharedSavedFiltersErrorMessage = '';
    this.cdr.markForCheck();

    this.pageDesignSavedFiltersApi.list(pageKey).subscribe({
      next: items => {
        this.sharedSavedFilterItems = items;
        this.sharedSavedFiltersLoadingState = false;
        this.sharedSavedFiltersErrorMessage = '';
        this.sharedSavedFiltersLoadedPageKey = pageKey;
        this.cdr.markForCheck();
      },
      error: error => {
        this.sharedSavedFiltersLoadingState = false;
        this.sharedSavedFiltersErrorMessage = this.extractSharedSavedFiltersErrorMessage(
          error,
          'Failed to load saved filters.'
        );
        this.sharedSavedFiltersLoadedPageKey = null;
        this.cdr.markForCheck();
      }
    });
  }

  protected saveCurrentSharedFilter(name: string): void {
    const pageKey = this.resolveSharedSavedFiltersPageKey();
    const definition = this.buildSharedSavedFilterDefinition();
    if (!pageKey || !definition) {
      this.sharedSavedFiltersErrorMessage = 'Add at least one complete filter before saving.';
      this.cdr.markForCheck();
      return;
    }

    this.sharedSavedFiltersMutatingState = true;
    this.sharedSavedFiltersErrorMessage = '';
    this.cdr.markForCheck();

    this.pageDesignSavedFiltersApi
      .save({
        pageKey,
        name: this.resolveSharedSavedFilterName(name),
        definition
      })
      .subscribe({
        next: item => {
          this.sharedSavedFilterItems = [
            item,
            ...this.sharedSavedFilterItems.filter(entry => entry.id !== item.id)
          ];
          this.sharedSavedFiltersMutatingState = false;
          this.sharedSavedFiltersErrorMessage = '';
          this.sharedSavedFiltersLoadedPageKey = pageKey;
          this.cdr.markForCheck();
        },
        error: error => {
          this.sharedSavedFiltersMutatingState = false;
          this.sharedSavedFiltersErrorMessage = this.extractSharedSavedFiltersErrorMessage(
            error,
            'Failed to save filters.'
          );
          this.cdr.markForCheck();
        }
      });
  }

  protected applySharedSavedFilter(savedFilterId: number, event?: Event): void {
    event?.stopPropagation();
    const entry = this.sharedSavedFilterItems.find(item => item.id === savedFilterId);
    if (!entry) {
      return;
    }

    this.sharedToolbarFilterGroups = restoreSharedSavedFilterGroups(entry.definition, {
      createFilterRow: () => this.createSharedFilterRow(),
      createFilterGroup: rows => this.createSharedFilterGroup(rows)
    });
    this.sharedFilterFieldSearchTerms = {};
    this.sharedSavedFiltersErrorMessage = '';
    (
      this as unknown as { invalidateSharedFilterStateSync?: () => void }
    ).invalidateSharedFilterStateSync?.();
    this.applySharedToolbarFilters();
    this.scheduleSharedFilterPanelPositionUpdate();
    this.cdr.markForCheck();
  }

  protected deleteSharedSavedFilter(savedFilterId: number, event?: Event): void {
    event?.stopPropagation();
    this.sharedSavedFiltersMutatingState = true;
    this.sharedSavedFiltersErrorMessage = '';
    this.cdr.markForCheck();

    this.pageDesignSavedFiltersApi.remove(savedFilterId).subscribe({
      next: () => {
        this.sharedSavedFilterItems = this.sharedSavedFilterItems.filter(
          item => item.id !== savedFilterId
        );
        this.sharedSavedFiltersMutatingState = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.sharedSavedFiltersMutatingState = false;
        this.sharedSavedFiltersErrorMessage = this.extractSharedSavedFiltersErrorMessage(
          error,
          'Failed to delete saved filter.'
        );
        this.cdr.markForCheck();
      }
    });
  }

  protected getSharedGridColumns(): SharedGridColumn[] {
    const grid = this.getSharedGrid();
    return Array.isArray(grid?.columns) ? grid.columns : [];
  }

  protected collectSharedDistinctValues(field: string, limit: number): string[] {
    return collectSharedDistinctValuesFromRows(this.getSharedGrid()?.data, field, limit);
  }

  private buildSharedSavedFilterDefinition(): SharedSavedFilterDefinition | null {
    const groups = this.sharedToolbarFilterGroups;
    if (this.sharedSavedFilterDefinitionCacheGroups === groups) {
      return this.sharedSavedFilterDefinitionCache;
    }

    const definition = serializeSharedSavedFilterDefinition(groups, {
      isFilterComplete: filter => this.isSharedFilterComplete(filter),
      operatorNeedsNoValue: operator => this.sharedFilterOperatorNeedsNoValue(operator)
    });
    this.sharedSavedFilterDefinitionCacheGroups = groups;
    this.sharedSavedFilterDefinitionCache = definition;
    return definition;
  }

  private resolveSharedSavedFiltersPageKey(): string | null {
    const pageKey = String(this.getSharedGrid()?.stateKey ?? '').trim();
    return pageKey || null;
  }

  private resolveSharedSavedFilterName(rawName: string): string {
    const trimmed = String(rawName ?? '').trim();
    if (trimmed) {
      return trimmed;
    }

    const stamp = new Date();
    const hours = String(stamp.getHours()).padStart(2, '0');
    const minutes = String(stamp.getMinutes()).padStart(2, '0');
    const seconds = String(stamp.getSeconds()).padStart(2, '0');
    return `Filter ${hours}:${minutes}:${seconds}`;
  }

  private extractSharedSavedFiltersErrorMessage(error: unknown, fallback: string): string {
    const response = (error ?? {}) as {
      error?: { message?: unknown; Message?: unknown };
      message?: unknown;
    };

    const nestedMessage =
      typeof response.error?.message === 'string'
        ? response.error.message.trim()
        : typeof response.error?.Message === 'string'
          ? response.error.Message.trim()
          : '';
    if (nestedMessage) {
      return nestedMessage;
    }

    const message = typeof response.message === 'string' ? response.message.trim() : '';
    return message || fallback;
  }

  private buildSharedGroupableColumnsCacheKey(
    columns: SharedGridColumn[],
    groupedColumns: string[]
  ): string {
    const groupedKey = groupedColumns.join(',');
    const columnKey = columns
      .map((column, index) => {
        if (!column || typeof column !== 'object') {
          return [index, '', 0, 0].join('\u001f');
        }
        const field = this.getGridColumnField(column);
        const hidden = column?.hidden ? 1 : 0;
        const groupable = column?.groupable === false ? 0 : 1;
        return [index, field, hidden, groupable].join('\u001f');
      })
      .join('\u001e');
    return `${groupedKey}\u001d${columnKey}`;
  }

  private buildSharedColumnsVisibilityCacheKey(
    columns: SharedGridColumn[],
    searchTerm: string
  ): string {
    const searchKey = searchTerm.trim().toLowerCase();
    const columnKey = columns
      .map((column, index) => {
        if (!column || typeof column !== 'object') {
          return [index, '', '', 0].join('\u001f');
        }
        const field = this.getGridColumnField(column);
        const header = typeof column?.header === 'string' ? column.header : '';
        const hidden = column?.hidden ? 1 : 0;
        return [index, field, header, hidden].join('\u001f');
      })
      .join('\u001e');
    return `${searchKey}\u001d${columnKey}`;
  }

  private buildSharedExpandedGroupsCacheKey(expandedGroups: Set<string>): string {
    return Array.from(expandedGroups).sort().join('\u001f');
  }

  private cacheSharedGroupingExpandedState(
    mode: 'single' | 'multi',
    source: unknown,
    expandedKey: string | null,
    value: boolean
  ): void {
    if (expandedKey == null) {
      this.sharedGroupingExpandedCacheMode = '';
      this.sharedGroupingExpandedCacheSource = null;
      this.sharedGroupingExpandedCacheExpandedKey = '';
      this.sharedGroupingExpandedCacheValue = false;
      return;
    }

    this.sharedGroupingExpandedCacheMode = mode;
    this.sharedGroupingExpandedCacheSource = source;
    this.sharedGroupingExpandedCacheExpandedKey = expandedKey;
    this.sharedGroupingExpandedCacheValue = value;
  }
}
