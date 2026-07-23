import { Directive, ElementRef } from '@angular/core';
import {
  DataGridComponent,
  GridChangeEvent,
  GridColumn,
  GridState,
  SortState
} from '@shared/data-grid';
import type {
  AssigneeFilterOption,
  AssigneeFilterSelection
} from '@shared/ui/assignee-filter-menu.component';
import type { ProjectListFilter } from '@features/tender/projects';
import type { TenderRow } from './tender-project-details/project-details.component';
import { TenderProjectsComponentPresenter } from './tender-projects.component.presenter';
import {
  PROJECT_COLUMN_ICON_MAP,
  PROJECTS_GROUP_OPTIONS,
  PROJECT_GROUP_ORDER_OPTIONS,
  PROJECT_FILTER_OPERATORS_WITHOUT_VALUE,
  getProjectFilterOperatorsForType,
  getValidProjectToolbarFilters,
  isProjectFilterValueEmpty,
  normalizeProjectToolbarFilters,
  resolveProjectFilterType
} from './tender-projects.component.models';
import {
  findTenderProjectLookupByName,
  resolveTenderProjectLookupDisplayLabel
} from './tender-projects.lookup.util';
import type {
  ProjectFilterColumnOption,
  ProjectFilterJoin,
  ProjectFilterOperator,
  ProjectToolbarFilter,
  ProjectsGroupOrder,
  ProjectsGroupOptionValue
} from './tender-projects.component.models';

@Directive()
export abstract class TenderProjectsComponentControlsBase extends TenderProjectsComponentPresenter {
  protected abstract hostElementRef: ElementRef<HTMLElement>;
  protected abstract projectGroupMenuRef?: ElementRef<HTMLDetailsElement>;
  protected abstract projectGroupByMenuRef?: ElementRef<HTMLDetailsElement>;
  protected abstract projectGroupOrderMenuRef?: ElementRef<HTMLDetailsElement>;
  protected abstract projectColumnsMenuRef?: ElementRef<HTMLDetailsElement>;
  protected abstract projectFiltersMenuRef?: ElementRef<HTMLDetailsElement>;
  protected abstract projectFiltersPanelRef?: ElementRef<HTMLDivElement>;
  protected abstract projectColumnsSearchInputRef?: ElementRef<HTMLInputElement>;
  protected abstract toolbarSearchInputRef?: ElementRef<HTMLInputElement>;

  protected readonly projectAssigneePalette = [
    'var(--app-color-grid-pill-tone-gray)',
    'var(--app-color-grid-pill-tone-blue)',
    'var(--app-color-grid-pill-tone-purple)',
    'var(--app-color-grid-pill-tone-red)',
    'var(--app-color-grid-pill-tone-yellow)',
    'var(--app-color-grid-pill-tone-teal)',
    'var(--app-color-grid-pill-tone-green)',
    'var(--app-color-grid-pill-tone-orange)'
  ];

  readonly projectGroupOptions = PROJECTS_GROUP_OPTIONS;
  readonly projectGroupOrderOptions = PROJECT_GROUP_ORDER_OPTIONS;

  projectGroupBy: ProjectsGroupOptionValue = 'none';
  projectGroupOrder: ProjectsGroupOrder = 'asc';
  projectColumnsSearchTerm = '';
  toolbarSearchOpen = false;
  toolbarSearchTerm = '';
  projectToolbarFilters: ProjectToolbarFilter[] = [this.createProjectToolbarFilter('and')];
  projectFilterFieldSearchTerms: Record<string, string> = {};
  projectAssigneeSelection: AssigneeFilterSelection = { kind: 'all' };
  projectMineQuickPanelOpen = false;
  private projectFilterIdCounter = 0;
  protected projectRowsFilterVersion = 0;
  protected projectRowsFilterCacheVersion = -1;
  protected projectRowsFilterCacheSource: readonly TenderRow[] | null = null;
  protected projectRowsFilterCache: TenderRow[] = [];
  protected lastAppliedGroupSortField: string | null = null;
  private readonly projectAssigneeOptionCache = new Map<string, { value: string; label: string }>();
  private readonly projectGroupFieldMap: Partial<Record<ProjectsGroupOptionValue, string>> = {
    title: 'title',
    owner: 'owner',
    ownerType: 'ownerType',
    deadline: 'deadline',
    startDate: 'startDate',
    endDate: 'endDate',
    type: 'top',
    stage: 'ts',
    price: 'price',
    assignTo: 'assignTo',
    acceptDate: 'acceptDate',
    status: 'status',
    consultant: 'consultant',
    prb: 'prb',
    importance: 'doi',
    country: 'country',
    inCharge: 'inCharge',
    delayReasons: 'delayReasons'
  };

  override ngOnInit(): void {
    super.ngOnInit();
    this.syncProjectGroupingUiFromPersistedState();
  }

  override handleGridChange(event: GridChangeEvent): void {
    super.handleGridChange(event);

    if (event.type !== 'selection' && event.type !== 'edit') {
      this.syncProjectGroupingUiFromGridChange(event);
      this.cdr.markForCheck();
    }
  }

  protected override usesServerDrivenProjectRows(): boolean {
    return true;
  }

  protected override buildProjectListApiFilters(): ProjectListFilter[] {
    const filters: ProjectListFilter[] = getValidProjectToolbarFilters(
      this.projectToolbarFilters
    ).map(filter => ({
      field: filter.field.trim(),
      operator: filter.operator,
      value: filter.value.trim(),
      joinWithPrev: filter.joinWithPrev
    }));

    if (this.projectAssigneeSelection.kind === 'unassigned') {
      filters.push({
        field: this.isSalaryReportsGrid ? 'owner' : 'assignTo',
        operator: 'isEmpty',
        joinWithPrev: 'and'
      });
    } else if (this.projectAssigneeSelection.kind === 'mine') {
      const currentUser = this.projectCurrentUserLabel().trim();
      if (currentUser) {
        filters.push({
          field: this.isSalaryReportsGrid ? 'owner' : 'assignTo',
          operator: 'equals',
          value: currentUser,
          joinWithPrev: 'and'
        });
      }
    } else if (this.projectAssigneeSelection.kind === 'owner') {
      const owner = this.projectAssigneeFilterValue(this.projectAssigneeSelection.owner);
      if (owner) {
        filters.push({
          field: this.isSalaryReportsGrid ? 'owner' : 'assignTo',
          operator: 'equals',
          value: owner,
          joinWithPrev: 'and'
        });
      }
    }

    return filters;
  }

  protected projectFilterValueSuggestions(filter: ProjectToolbarFilter): string[] {
    if (!filter.field.trim() || this.projectFilterOperatorNeedsNoValue(filter.operator)) return [];
    const field = filter.field.trim();
    const uniqueValues = new Set<string>();
    for (const rawRow of this.rows ?? []) {
      const row = rawRow as Record<string, unknown>;
      const value = row?.[field];
      if (isProjectFilterValueEmpty(value)) continue;
      const text = String(value).trim();
      if (!text) continue;
      uniqueValues.add(text);
      if (uniqueValues.size >= 120) break;
    }
    return Array.from(uniqueValues)
      .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base', numeric: true }))
      .slice(0, 100);
  }

  addProjectToolbarFilter(event?: Event): void {
    event?.stopPropagation();
    this.projectToolbarFilters = normalizeProjectToolbarFilters([
      ...this.projectToolbarFilters,
      this.createProjectToolbarFilter('and')
    ]);
    this.touchProjectToolbarFilters();
  }

  removeProjectToolbarFilter(filterId: string, event?: Event): void {
    event?.stopPropagation();
    const remaining = this.projectToolbarFilters.filter(filter => filter.id !== filterId);
    this.projectToolbarFilters = remaining.length
      ? normalizeProjectToolbarFilters(remaining)
      : [this.createProjectToolbarFilter('and')];
    delete this.projectFilterFieldSearchTerms[filterId];
    this.touchProjectToolbarFilters();
  }

  clearProjectToolbarFilters(event?: Event): void {
    event?.stopPropagation();
    this.projectToolbarFilters = [this.createProjectToolbarFilter('and')];
    this.projectFilterFieldSearchTerms = {};
    this.touchProjectToolbarFilters();
  }

  onProjectFilterFieldSearchInput(filterId: string, value: string): void {
    this.projectFilterFieldSearchTerms = {
      ...this.projectFilterFieldSearchTerms,
      [filterId]: value
    };
    this.cdr.markForCheck();
  }

  clearProjectFilterFieldSearch(filterId: string, event?: Event): void {
    event?.stopPropagation();
    this.projectFilterFieldSearchTerms = { ...this.projectFilterFieldSearchTerms, [filterId]: '' };
    this.cdr.markForCheck();
  }

  onProjectFilterFieldSelect(filterId: string, field: string): void {
    const normalizedField = field.trim();
    if (!normalizedField) return;
    this.projectToolbarFilters = normalizeProjectToolbarFilters(
      this.projectToolbarFilters.map(filter => {
        if (filter.id !== filterId) return filter;
        const allowedOperators = this.getProjectFilterOperatorsForField(normalizedField);
        const nextOperator = allowedOperators.includes(filter.operator)
          ? filter.operator
          : (allowedOperators[0] ?? 'contains');
        return {
          ...filter,
          field: normalizedField,
          operator: nextOperator,
          value: PROJECT_FILTER_OPERATORS_WITHOUT_VALUE.has(nextOperator) ? '' : filter.value
        };
      })
    );
    this.projectFilterFieldSearchTerms = { ...this.projectFilterFieldSearchTerms, [filterId]: '' };
    this.touchProjectToolbarFilters();
  }

  onProjectFilterJoinChange(filterId: string, joinValue: string): void {
    if (!this.isProjectFilterJoin(joinValue)) return;
    this.projectToolbarFilters = normalizeProjectToolbarFilters(
      this.projectToolbarFilters.map((filter, index) => {
        if (filter.id !== filterId || index === 0) return filter;
        return { ...filter, joinWithPrev: joinValue };
      })
    );
    this.touchProjectToolbarFilters();
  }

  onProjectFilterOperatorChange(filterId: string, operatorValue: string): void {
    if (!this.isProjectFilterOperator(operatorValue)) return;
    this.projectToolbarFilters = normalizeProjectToolbarFilters(
      this.projectToolbarFilters.map(filter => {
        if (filter.id !== filterId) return filter;
        return {
          ...filter,
          operator: operatorValue,
          value: PROJECT_FILTER_OPERATORS_WITHOUT_VALUE.has(operatorValue) ? '' : filter.value
        };
      })
    );
    this.touchProjectToolbarFilters();
  }

  onProjectFilterOperatorSelect(
    filterId: string,
    operatorValue: ProjectFilterOperator,
    event?: Event
  ): void {
    event?.stopPropagation();
    this.onProjectFilterOperatorChange(filterId, operatorValue);
  }

  onProjectFilterValueInput(filterId: string, value: string): void {
    this.projectToolbarFilters = normalizeProjectToolbarFilters(
      this.projectToolbarFilters.map(filter =>
        filter.id === filterId ? { ...filter, value } : filter
      )
    );
    this.touchProjectToolbarFilters();
  }

  onProjectFilterValueSelect(filterId: string, value: string, event?: Event): void {
    event?.stopPropagation();
    this.onProjectFilterValueInput(filterId, value);
  }

  onProjectMenuToggle(kind: 'group' | 'groupBy' | 'groupOrder' | 'columns' | 'filters'): void {
    const groupMenu = this.projectGroupMenuRef?.nativeElement;
    const groupByMenu = this.projectGroupByMenuRef?.nativeElement;
    const groupOrderMenu = this.projectGroupOrderMenuRef?.nativeElement;
    const columnsMenu = this.projectColumnsMenuRef?.nativeElement;
    const filtersMenu = this.projectFiltersMenuRef?.nativeElement;

    if (kind === 'group') {
      if (!groupMenu?.open) {
        if (groupByMenu) groupByMenu.open = false;
        if (groupOrderMenu) groupOrderMenu.open = false;
      } else {
        if (columnsMenu) columnsMenu.open = false;
        if (filtersMenu) filtersMenu.open = false;
      }
      return;
    }

    if (kind === 'columns') {
      if (columnsMenu?.open) {
        if (groupByMenu) groupByMenu.open = false;
        if (groupOrderMenu) groupOrderMenu.open = false;
        if (groupMenu) groupMenu.open = false;
        if (filtersMenu) filtersMenu.open = false;
        queueMicrotask(() => this.projectColumnsSearchInputRef?.nativeElement?.focus());
      }
      return;
    }

    if (kind === 'filters') {
      if (filtersMenu?.open) {
        if (groupByMenu) groupByMenu.open = false;
        if (groupOrderMenu) groupOrderMenu.open = false;
        if (groupMenu) groupMenu.open = false;
        if (columnsMenu) columnsMenu.open = false;
        this.scheduleProjectFiltersMenuPositionSync();
      } else {
        this.resetProjectFiltersMenuPosition();
      }
      return;
    }

    if (kind === 'groupBy' && groupByMenu?.open && groupOrderMenu) {
      groupOrderMenu.open = false;
    }
    if (kind === 'groupOrder' && groupOrderMenu?.open && groupByMenu) {
      groupByMenu.open = false;
    }
  }

  closeProjectGroupingMenus(): void {
    const groupByMenu = this.projectGroupByMenuRef?.nativeElement;
    const groupOrderMenu = this.projectGroupOrderMenuRef?.nativeElement;
    const groupMenu = this.projectGroupMenuRef?.nativeElement;
    const columnsMenu = this.projectColumnsMenuRef?.nativeElement;
    const filtersMenu = this.projectFiltersMenuRef?.nativeElement;

    if (groupByMenu) groupByMenu.open = false;
    if (groupOrderMenu) groupOrderMenu.open = false;
    if (groupMenu) groupMenu.open = false;
    if (columnsMenu) columnsMenu.open = false;
    if (filtersMenu) filtersMenu.open = false;
    this.resetProjectFiltersMenuPosition();
  }

  protected handleProjectDocumentPointerDown(event: PointerEvent): void {
    // Do not interfere with DataGrid right-click header context menu.
    if (event.button === 2) return;

    const target = event.target;
    if (!(target instanceof Node)) return;

    const host = this.hostElementRef.nativeElement;
    if (!host.contains(target)) {
      this.closeProjectGroupingMenus();
      return;
    }

    const element = target instanceof Element ? target : target.parentElement;
    const clickedInsideMineQuick = !!element?.closest(
      'app-mine-quick-filter-menu, .mine-quick-filter'
    );
    if (this.projectMineQuickPanelOpen && !clickedInsideMineQuick) {
      this.projectMineQuickPanelOpen = false;
    }
    if (element?.closest('.proj-menu')) return;
    if (element?.closest('.proj-toolbar-search')) return;

    if (this.toolbarSearchOpen) {
      this.toolbarSearchOpen = false;
    }
    this.closeProjectGroupingMenus();
    this.cdr.markForCheck();
  }

  protected handleProjectDocumentEscape(): void {
    this.projectMineQuickPanelOpen = false;
    if (this.toolbarSearchOpen) {
      this.toolbarSearchOpen = false;
    }
    this.closeProjectGroupingMenus();
    this.cdr.markForCheck();
  }

  protected handleProjectWindowResize(): void {
    if (!this.projectFiltersMenuRef?.nativeElement?.open) {
      return;
    }
    this.scheduleProjectFiltersMenuPositionSync();
  }

  onProjectColumnsSearchInput(value: string): void {
    this.projectColumnsSearchTerm = value;
    this.cdr.markForCheck();
  }

  clearProjectColumnsSearch(event?: Event): void {
    event?.stopPropagation();
    this.projectColumnsSearchTerm = '';
    this.cdr.markForCheck();
    queueMicrotask(() => this.projectColumnsSearchInputRef?.nativeElement?.focus());
  }

  closeProjectColumnsMenu(event?: Event): void {
    event?.stopPropagation();
    const menu = this.projectColumnsMenuRef?.nativeElement;
    if (menu) {
      menu.open = false;
    }
    this.cdr.markForCheck();
  }

  showAllProjectColumns(event?: Event): void {
    event?.stopPropagation();
    this.setProjectColumnsHiddenState(() => false);
  }

  hideProjectColumnsExceptTitle(event?: Event): void {
    event?.stopPropagation();
    this.setProjectColumnsHiddenState(column => this.projectColumnField(column) !== 'title');
  }

  resetProjectColumns(event?: Event): void {
    event?.stopPropagation();
    const grid = this.grid as DataGridComponent<TenderRow> | undefined;
    if (grid) {
      grid.clearState();
      grid.columns = [...grid.columns];
      this.gridColumns = [...grid.columns];
    } else {
      this.gridColumns = this.gridColumns.map(col => ({ ...col, hidden: false }));
    }
    this.cdr.markForCheck();
  }

  projectColumnsShown(): GridColumn<TenderRow>[] {
    return this.getProjectColumnsForPanel().filter(col => !col.hidden);
  }

  projectColumnsHidden(): GridColumn<TenderRow>[] {
    return this.getProjectColumnsForPanel().filter(col => !!col.hidden);
  }

  projectColumnIcon(column: GridColumn<TenderRow>): string {
    const explicitIcon = typeof column?.icon === 'string' ? column.icon.trim() : '';
    return (
      explicitIcon ||
      PROJECT_COLUMN_ICON_MAP[this.projectColumnField(column)] ||
      'layout-three-columns'
    );
  }

  projectColumnField(column: GridColumn<TenderRow>): string {
    return String(column?.field ?? '').trim();
  }

  canToggleProjectColumn(column: GridColumn<TenderRow>): boolean {
    if (column.hidden) return true;
    return this.projectColumnsShown().length > 1;
  }

  toggleProjectColumn(column: GridColumn<TenderRow>, event?: Event): void {
    event?.stopPropagation();

    if (!this.canToggleProjectColumn(column)) {
      return;
    }

    const field = this.projectColumnField(column);
    const grid = this.grid as DataGridComponent<TenderRow> | undefined;
    const gridColumn =
      grid?.columns?.find((c: GridColumn<TenderRow>) => String(c.field ?? '') === field) ?? null;

    if (grid && gridColumn) {
      grid.toggleColumnVisibility(gridColumn);
      grid.saveState();
    } else {
      const localColumn = this.gridColumns.find(c => String(c.field ?? '') === field);
      if (!localColumn) return;
      localColumn.hidden = !localColumn.hidden;
      this.gridColumns = [...this.gridColumns];
    }

    this.cdr.markForCheck();
  }

  protected applyProjectGrouping(): void {
    const grid = this.grid;
    if (!grid) {
      return;
    }

    const column = this.resolveProjectGroupingColumn(this.projectGroupBy);
    grid.applyGroupingState(column, this.projectGroupOrder);
    this.lastAppliedGroupSortField = column ? (column.field as string) : null;
    this.invalidateProjectRowsFilterCache();
    this.cdr.markForCheck();
  }

  protected resolveProjectGroupingColumn(value: ProjectsGroupOptionValue) {
    const field = this.resolveProjectGroupField(value);
    if (!field) {
      return null;
    }

    return this.gridColumns.find(col => (col.field as string) === field) ?? null;
  }

  protected resolveProjectGroupField(value: ProjectsGroupOptionValue): string | null {
    return this.projectGroupFieldMap[value] ?? null;
  }

  private resolveProjectGroupingOptionValue(
    field: string | null | undefined
  ): ProjectsGroupOptionValue {
    const normalizedField = String(field ?? '').trim();
    if (!normalizedField) {
      return 'none';
    }

    const matchedEntry = Object.entries(this.projectGroupFieldMap).find(
      ([, candidateField]) => candidateField === normalizedField
    );

    return (matchedEntry?.[0] as ProjectsGroupOptionValue | undefined) ?? 'none';
  }

  private syncProjectGroupingUiFromPersistedState(): void {
    if (!this.isBrowser || !this.projectGridStateKey) {
      return;
    }

    try {
      const rawState = localStorage.getItem(`grid-state-${this.projectGridStateKey}`);
      if (!rawState) {
        return;
      }

      const parsedState = JSON.parse(rawState) as Partial<GridState>;
      this.applyProjectGroupingUiState(parsedState.groupColumns, parsedState.sorts);
    } catch (error) {
      this.debugWarn(
        '[TenderProjects] Failed to sync grouping UI from persisted grid state.',
        error
      );
    }
  }

  private syncProjectGroupingUiFromGridChange(event: GridChangeEvent): void {
    this.applyProjectGroupingUiState(event.groupColumns, event.sorts);
  }

  private applyProjectGroupingUiState(
    groupColumns: readonly string[] | null | undefined,
    sorts: readonly SortState[] | null | undefined
  ): void {
    const primaryGroupField =
      Array.isArray(groupColumns) && typeof groupColumns[0] === 'string'
        ? groupColumns[0].trim()
        : '';
    const nextGroupBy = this.resolveProjectGroupingOptionValue(primaryGroupField);
    const groupedSort = primaryGroupField
      ? (sorts ?? []).find(
          sort =>
            String(sort?.field ?? '').trim() === primaryGroupField &&
            (sort.direction === 'asc' || sort.direction === 'desc')
        )
      : undefined;
    const nextGroupOrder = groupedSort?.direction === 'desc' ? 'desc' : 'asc';
    const nextAppliedSortField = groupedSort ? primaryGroupField : null;

    if (
      this.projectGroupBy === nextGroupBy &&
      this.projectGroupOrder === nextGroupOrder &&
      this.lastAppliedGroupSortField === nextAppliedSortField
    ) {
      return;
    }

    this.projectGroupBy = nextGroupBy;
    this.projectGroupOrder = nextGroupOrder;
    this.lastAppliedGroupSortField = nextAppliedSortField;
    this.invalidateProjectRowsFilterCache();
  }

  protected createProjectToolbarFilter(joinWithPrev: ProjectFilterJoin): ProjectToolbarFilter {
    this.projectFilterIdCounter += 1;
    return {
      id: `project-filter-${this.projectFilterIdCounter}`,
      joinWithPrev,
      field: '',
      operator: 'contains',
      value: ''
    };
  }

  protected touchProjectToolbarFilters(): void {
    this.invalidateProjectRowsFilterCache();
    if (this.selectedRows.length) {
      this.selectedRows = [];
      this.grid?.clearSelection();
    }
    this.onProjectQueryStateChanged();
    this.cdr.markForCheck();
  }

  protected invalidateProjectRowsFilterCache(): void {
    this.projectRowsFilterVersion += 1;
    this.projectRowsFilterCacheVersion = -1;
  }

  protected projectSourceRows(): TenderRow[] {
    return Array.isArray(this.rows) ? this.rows : [];
  }

  protected projectAssigneeMenuOptions(): AssigneeFilterOption[] {
    const options = new Map<string, { value: string; label: string; count: number }>();
    const upsert = (rawValue: unknown, increment = 0, rawLabel?: unknown) => {
      const value = this.projectAssigneeFilterValue(rawValue);
      if (!value || value === 'Unassigned') return;
      const label = String(rawLabel ?? this.projectAssigneeDisplayLabel(value)).trim() || value;
      const key = value.toLowerCase();
      const current = options.get(key);
      if (current) {
        if (label && current.label === current.value) {
          current.label = label;
        }
        current.count += increment;
        this.projectAssigneeOptionCache.set(key, { value: current.value, label: current.label });
        return;
      }
      options.set(key, { value, label, count: increment });
      this.projectAssigneeOptionCache.set(key, { value, label });
    };

    if (!this.isSalaryReportsGrid) {
      for (const setting of this.assignToSettings ?? []) {
        upsert(setting.name, 0, resolveTenderProjectLookupDisplayLabel(setting) ?? setting.name);
      }
    }

    for (const row of this.projectSourceRows()) {
      upsert(this.projectNormalizedAssignee(this.isSalaryReportsGrid ? row.owner : row.assignTo), 1);
    }

    if (this.projectAssigneeSelection.kind === 'owner') {
      upsert(this.projectAssigneeSelection.owner, 0);
    }

    for (const cached of this.projectAssigneeOptionCache.values()) {
      const key = cached.value.toLowerCase();
      if (!options.has(key)) {
        options.set(key, { value: cached.value, label: cached.label, count: 0 });
      }
    }

    return Array.from(options.values())
      .sort((a, b) => a.label.localeCompare(b.label, 'en', { sensitivity: 'base' }))
      .map(option => ({
        value: option.value,
        label: option.label,
        count: option.count,
        color: this.projectAssigneeColor(option.label),
        initials: this.projectAssigneeInitials(option.label)
      }));
  }

  protected projectUnassignedCount(): number {
    return this.projectSourceRows().filter(
      row =>
        this.projectNormalizedAssignee(this.isSalaryReportsGrid ? row.owner : row.assignTo) ===
        'Unassigned'
    ).length;
  }

  protected projectMineCount(): number {
    const currentUser = this.projectCurrentUserName();
    if (!currentUser) return 0;
    return this.projectSourceRows().filter(
      row => this.projectAssigneeFilterValue(row.assignTo).toLowerCase() === currentUser
    ).length;
  }

  protected projectCurrentUserName(): string {
    return this.projectCurrentUserLabel().toLowerCase();
  }

  protected projectCurrentUserInitials(): string {
    return this.projectAssigneeInitials(this.projectCurrentUserLabel());
  }

  protected projectCurrentUserLabel(): string {
    const user = this.authUserFacade.user();
    const name = String(user?.name ?? '').trim();
    if (name) return name;
    const email = String(user?.email ?? '').trim();
    if (!email) return 'A';
    return email.split('@')[0]?.trim() || 'A';
  }

  protected applyProjectAssigneeSelection(rows: readonly TenderRow[]): TenderRow[] {
    const selection = this.projectAssigneeSelection;
    if (!selection || selection.kind === 'all') {
      return [...rows];
    }

    if (selection.kind === 'unassigned') {
      return rows.filter(
        row =>
          this.projectNormalizedAssignee(this.isSalaryReportsGrid ? row.owner : row.assignTo) ===
          'Unassigned'
      );
    }

    if (selection.kind === 'mine') {
      const currentUser = this.projectCurrentUserName();
      if (!currentUser) return [...rows];
      return rows.filter(
        row => this.projectAssigneeFilterValue(row.assignTo).toLowerCase() === currentUser
      );
    }

    const owner = this.projectAssigneeFilterValue(selection.owner).toLowerCase();
    if (!owner) return [...rows];
    return rows.filter(
      row =>
        this.projectAssigneeFilterValue(this.isSalaryReportsGrid ? row.owner : row.assignTo).toLowerCase() ===
        owner
    );
  }

  private projectNormalizedAssignee(value: unknown): string {
    const text = String(value ?? '').trim();
    return text || 'Unassigned';
  }

  private projectAssigneeFilterValue(value: unknown): string {
    const rawValue = this.projectNormalizedAssignee(value);
    if (rawValue === 'Unassigned') {
      return '';
    }

    const matchedName = findTenderProjectLookupByName(this.assignToSettings ?? [], rawValue)?.name;
    return matchedName?.trim() || rawValue;
  }

  private projectAssigneeDisplayLabel(value: unknown): string {
    const rawValue = this.projectNormalizedAssignee(value);
    if (rawValue === 'Unassigned') {
      return rawValue;
    }

    const lookup = findTenderProjectLookupByName(this.assignToSettings ?? [], rawValue);
    return resolveTenderProjectLookupDisplayLabel(lookup) ?? rawValue;
  }

  private projectAssigneeInitials(name: string): string {
    const parts = name
      .split(/\s+/)
      .map(part => part.trim())
      .filter(Boolean)
      .slice(0, 2);

    if (!parts.length) return '?';
    return parts
      .map(part => part[0])
      .join('')
      .toUpperCase();
  }

  private projectAssigneeColor(name: string): string {
    let hash = 0;
    for (const char of name) {
      hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    }
    return this.projectAssigneePalette[hash % this.projectAssigneePalette.length];
  }

  protected getProjectFilterColumnOptions(): ProjectFilterColumnOption[] {
    return this.getProjectColumnsSource()
      .filter(column => column.filterable !== false)
      .map(column => {
        const field = this.projectColumnField(column);
        if (!field) return null;
        return {
          field,
          label: String(column.header ?? field),
          icon: this.projectColumnIcon(column),
          filterType: resolveProjectFilterType(column)
        } satisfies ProjectFilterColumnOption;
      })
      .filter((column): column is ProjectFilterColumnOption => !!column)
      .sort((a, b) => a.label.localeCompare(b.label, 'en', { sensitivity: 'base' }));
  }

  protected getProjectFilterColumnByField(field: string): ProjectFilterColumnOption | null {
    const target = field.trim();
    if (!target) {
      return null;
    }
    return this.getProjectFilterColumnOptions().find(column => column.field === target) ?? null;
  }

  protected getProjectFilterOperatorsForField(field: string): ProjectFilterOperator[] {
    const column = this.getProjectFilterColumnByField(field);
    const filterType = column?.filterType ?? 'text';
    return getProjectFilterOperatorsForType(filterType);
  }

  protected getProjectColumnsForPanel(): GridColumn<TenderRow>[] {
    const search = this.projectColumnsSearchTerm.trim().toLowerCase();
    const source = this.getProjectColumnsSource();
    return source.filter(column => {
      const field = this.projectColumnField(column);
      if (!field) return false;
      const label = String(column.header ?? field);
      if (!search) return true;
      return label.toLowerCase().includes(search) || field.toLowerCase().includes(search);
    });
  }

  protected getProjectColumnsSource(): GridColumn<TenderRow>[] {
    const grid = this.grid as DataGridComponent<TenderRow> | undefined;
    const source =
      Array.isArray(grid?.columns) && grid.columns.length ? grid.columns : this.gridColumns;
    return source.filter(column => !String(column?.field ?? '').startsWith('__'));
  }

  protected setProjectColumnsHiddenState(
    predicate: (column: GridColumn<TenderRow>) => boolean
  ): void {
    const grid = this.grid as DataGridComponent<TenderRow> | undefined;
    const source = this.getProjectColumnsSource();
    for (const column of source) {
      column.hidden = predicate(column);
    }

    if (grid) {
      grid.columns = [...grid.columns];
      grid.saveState();
      this.gridColumns = [...grid.columns];
    } else {
      this.gridColumns = [...this.gridColumns];
    }

    this.cdr.markForCheck();
  }

  protected isProjectFilterJoin(value: string): value is ProjectFilterJoin {
    return value === 'and' || value === 'or';
  }

  protected isProjectFilterOperator(value: string): value is ProjectFilterOperator {
    return (
      value === 'contains' ||
      value === 'notContains' ||
      value === 'equals' ||
      value === 'notEquals' ||
      value === 'startsWith' ||
      value === 'endsWith' ||
      value === 'greaterThan' ||
      value === 'greaterThanOrEqual' ||
      value === 'lessThan' ||
      value === 'lessThanOrEqual' ||
      value === 'isEmpty' ||
      value === 'notEmpty'
    );
  }

  protected projectFilterOperatorNeedsNoValue(operator: ProjectFilterOperator): boolean {
    return PROJECT_FILTER_OPERATORS_WITHOUT_VALUE.has(operator);
  }

  private scheduleProjectFiltersMenuPositionSync(): void {
    queueMicrotask(() => this.syncProjectFiltersMenuPosition());
  }

  private resetProjectFiltersMenuPosition(): void {
    this.projectFiltersPanelRef?.nativeElement.style.removeProperty('--proj-filter-offset-x');
  }

  private syncProjectFiltersMenuPosition(): void {
    const menu = this.projectFiltersMenuRef?.nativeElement;
    const panel = this.projectFiltersPanelRef?.nativeElement;
    if (!menu?.open || !panel) {
      return;
    }

    panel.style.removeProperty('--proj-filter-offset-x');

    const margin = 12;
    const rect = panel.getBoundingClientRect();
    const maxRight = window.innerWidth - margin;
    let offsetX = 0;

    if (rect.right > maxRight) {
      offsetX -= rect.right - maxRight;
    }

    if (rect.left + offsetX < margin) {
      offsetX += margin - (rect.left + offsetX);
    }

    if (offsetX !== 0) {
      panel.style.setProperty('--proj-filter-offset-x', `${Math.round(offsetX)}px`);
    }
  }
}
