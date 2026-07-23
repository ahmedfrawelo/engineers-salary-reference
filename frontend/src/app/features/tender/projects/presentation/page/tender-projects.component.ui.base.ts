import { Directive } from '@angular/core';
import type { AssigneeFilterSelection } from '@shared/ui/assignee-filter-menu.component';
import type {
  SharedAssigneeFilterConfig,
  SharedMineQuickFilterConfig
} from '@shared/ui/page-design';
import type { CalendarEvent } from '@shared/ui/calendar.component';
import type { TenderRow } from './tender-project-details/project-details.component';
import { TenderProjectsComponentControlsBase } from './tender-projects.component.controls.base';
import {
  TENDER_PROJECT_CALENDAR_STORAGE_KEY,
  TENDER_PROJECT_CALENDAR_VIEW_OPTIONS,
  buildTenderProjectsCalendarModel,
  resolveTenderProjectsCalendarInitialDate,
  resolveTenderProjectCalendarEventRow,
  type TenderProjectsCalendarGrouping,
  type TenderProjectsCalendarModel
} from './tender-projects-calendar.util';
import {
  PROJECT_FILTER_OPERATOR_LABELS,
  PROJECT_FILTER_SELECT_LIKE_FIELDS,
  applyProjectToolbarFilters,
  formatProjectFilterDateInput,
  getValidProjectToolbarFilters,
  parseProjectFilterDate
} from './tender-projects.component.models';
import type {
  ProjectFilterColumnOption,
  ProjectFilterOperator,
  ProjectFilterOperatorOption,
  ProjectToolbarFilter,
  ProjectsGroupOptionValue
} from './tender-projects.component.models';

@Directive()
export abstract class TenderProjectsComponentUiBase extends TenderProjectsComponentControlsBase {
  readonly projectCalendarViewOptions = TENDER_PROJECT_CALENDAR_VIEW_OPTIONS;
  readonly projectCalendarStorageKey = TENDER_PROJECT_CALENDAR_STORAGE_KEY;
  private readonly projectViewModeStorageKey = 'engineers-salary-reference.tender.projects.view-mode';
  projectViewMode: 'table' | 'calendar' = 'table';
  private sharedToolbarAssigneeFilterConfigCacheSource: readonly TenderRow[] | null = null;
  private sharedToolbarAssigneeFilterConfigCacheSettingsSource: readonly unknown[] | null = null;
  private sharedToolbarAssigneeFilterConfigCacheSelectionKey = '';
  private sharedToolbarAssigneeFilterConfigCacheUserKey = '';
  private sharedToolbarAssigneeFilterConfigCache: SharedAssigneeFilterConfig | null = null;
  private sharedToolbarMineQuickFilterConfigCacheKey = '';
  private sharedToolbarMineQuickFilterConfigCache: SharedMineQuickFilterConfig | null = null;
  private projectCalendarModelCacheSource: readonly TenderRow[] | null = null;
  private projectCalendarModelCacheKey = '';
  private projectCalendarModelCache: TenderProjectsCalendarModel = {
    events: [],
    resources: [],
    legend: [],
    initialDate: null
  };
  private readonly projectCalendarSearchTextCache = new WeakMap<TenderRow, string>();
  private projectCalendarInitialDateResolved = false;
  private projectCalendarInitialDateValue: string | null = null;

  override ngOnInit(): void {
    super.ngOnInit();
    this.projectViewMode = this.loadProjectViewMode();
    if (this.projectViewMode === 'calendar') {
      this.ensureProjectCalendarRows();
    }
  }

  onSharedToolbarAction(actionId: string): void {
    if (actionId === 'settings') {
      if (!this.permission.canEditPage('tender.projects')) {
        return;
      }
      this.showSettings = true;
      return;
    }
    if (actionId === 'addTender') {
      this.onAddTender();
    }
  }

  setProjectViewMode(mode: 'table' | 'calendar'): void {
    if (this.projectViewMode === mode) {
      return;
    }
    this.projectViewMode = mode;
    this.persistProjectViewMode(mode);
    this.projectMineQuickPanelOpen = false;
    this.closeProjectGroupingMenus();
    if (mode === 'calendar') {
      this.ensureProjectCalendarRows();
    }
    this.cdr.markForCheck();
  }

  projectCalendarEvents(): CalendarEvent[] {
    return this.projectCalendarModel().events;
  }

  projectCalendarResources() {
    return this.projectCalendarModel().resources;
  }

  projectCalendarResourceLabel(): string {
    return this.projectGroupBy === 'none' ? 'Assignees' : this.projectGroupLabel();
  }

  projectCalendarLegend() {
    return this.projectCalendarModel().legend;
  }

  projectCalendarInitialDate(): string | null {
    if (!this.projectCalendarInitialDateResolved) {
      const model = this.projectCalendarModel();
      this.projectCalendarInitialDateValue =
        model.initialDate ?? resolveTenderProjectsCalendarInitialDate(model);
      this.projectCalendarInitialDateResolved = true;
    }
    return this.projectCalendarInitialDateValue;
  }

  onProjectCalendarEventClick(event: CalendarEvent): void {
    const row = resolveTenderProjectCalendarEventRow(event, this.projectCalendarSourceRows());
    if (!row) {
      return;
    }
    this.openDetails(row);
  }

  protected override onProjectQueryStateChanged(): void {
    this.projectCalendarInitialDateResolved = false;
    this.projectCalendarInitialDateValue = null;
    this.invalidateProjectCalendarRows();
    super.onProjectQueryStateChanged();
    if (this.projectViewMode === 'calendar') {
      this.ensureProjectCalendarRows();
    }
  }

  private projectCalendarModel(): TenderProjectsCalendarModel {
    const source = this.projectRowsForCalendar();
    const grouping = this.projectCalendarGrouping();
    const cacheKey = [
      grouping.field ?? '',
      grouping.label,
      grouping.order,
      grouping.dateInterval ?? ''
    ].join('|');
    if (this.projectCalendarModelCacheSource === source && this.projectCalendarModelCacheKey === cacheKey) {
      return this.projectCalendarModelCache;
    }
    this.projectCalendarModelCacheSource = source;
    this.projectCalendarModelCacheKey = cacheKey;
    this.projectCalendarModelCache = buildTenderProjectsCalendarModel(source, grouping);
    return this.projectCalendarModelCache;
  }

  private projectCalendarGrouping(): TenderProjectsCalendarGrouping {
    const field = this.resolveProjectGroupField(this.projectGroupBy);
    const groupParams = this.getRemoteProjectGroupingParams();
    const activeField = groupParams.groupBy || field;
    const activeOrder = groupParams.groupDirection === 'desc' ? 'desc' : this.projectGroupOrder;
    return {
      field: this.projectGroupBy === 'none' ? null : (activeField ?? null),
      label: this.projectCalendarResourceLabel(),
      order: activeOrder,
      dateInterval: groupParams.groupDateInterval
    };
  }

  private loadProjectViewMode(): 'table' | 'calendar' {
    if (!this.isBrowser) {
      return 'table';
    }

    try {
      const raw = localStorage.getItem(this.scopedStorageKey(this.projectViewModeStorageKey));
      return raw === 'calendar' ? 'calendar' : 'table';
    } catch {
      return 'table';
    }
  }

  private persistProjectViewMode(mode: 'table' | 'calendar'): void {
    if (!this.isBrowser) {
      return;
    }

    try {
      localStorage.setItem(this.scopedStorageKey(this.projectViewModeStorageKey), mode);
    } catch {
      return;
    }
  }

  sharedToolbarAssigneeFilterConfig(): SharedAssigneeFilterConfig {
    const source = this.projectSourceRows();
    const selectionKey =
      this.projectAssigneeSelection.kind === 'owner'
        ? `owner:${this.projectAssigneeSelection.owner}`
        : this.projectAssigneeSelection.kind;
    const userKey = this.projectCurrentUserLabel();

    if (
      this.sharedToolbarAssigneeFilterConfigCache &&
      this.sharedToolbarAssigneeFilterConfigCacheSource === source &&
      this.sharedToolbarAssigneeFilterConfigCacheSettingsSource === this.assignToSettings &&
      this.sharedToolbarAssigneeFilterConfigCacheSelectionKey === selectionKey &&
      this.sharedToolbarAssigneeFilterConfigCacheUserKey === userKey
    ) {
      return this.sharedToolbarAssigneeFilterConfigCache;
    }

    const nextConfig: SharedAssigneeFilterConfig = {
      options: this.projectAssigneeMenuOptions(),
      selection: this.projectAssigneeSelection,
      showMine: !this.isSalaryReportsGrid && this.projectMineCount() > 0,
      allCount: source.length,
      mineCount: this.projectMineCount(),
      unassignedCount: this.projectUnassignedCount(),
      ...(this.isSalaryReportsGrid
        ? {
            triggerIcon: 'globe',
            triggerLabel: 'Country',
            title: 'Countries',
            sectionLabel: 'Countries',
            countLabel: 'Reports',
            allIcon: 'globe',
            searchPlaceholder: 'Search countries',
            allLabel: 'All countries',
            unassignedLabel: 'Not specified',
            emptyLabel: 'No countries found.'
          }
        : {})
    };

    this.sharedToolbarAssigneeFilterConfigCacheSource = source;
    this.sharedToolbarAssigneeFilterConfigCacheSettingsSource = this.assignToSettings;
    this.sharedToolbarAssigneeFilterConfigCacheSelectionKey = selectionKey;
    this.sharedToolbarAssigneeFilterConfigCacheUserKey = userKey;
    this.sharedToolbarAssigneeFilterConfigCache = nextConfig;
    return nextConfig;
  }

  onSharedToolbarAssigneeSelectionChange(selection: AssigneeFilterSelection): void {
    this.projectMineQuickPanelOpen = false;
    this.projectAssigneeSelection = selection;
    this.touchProjectToolbarFilters();
  }

  sharedToolbarMineQuickFilterConfig(): SharedMineQuickFilterConfig {
    const mineActive = this.projectAssigneeSelection.kind === 'mine';
    const cacheKey = [
      mineActive ? '1' : '0',
      this.projectMineQuickPanelOpen ? '1' : '0',
      this.projectCurrentUserInitials()
    ].join('|');

    if (
      this.sharedToolbarMineQuickFilterConfigCache &&
      this.sharedToolbarMineQuickFilterConfigCacheKey === cacheKey
    ) {
      return this.sharedToolbarMineQuickFilterConfigCache;
    }

    const nextConfig: SharedMineQuickFilterConfig = {
      initials: this.projectCurrentUserInitials(),
      tooltip: 'Filter projects assigned to you',
      title: 'Projects assigned to you',
      panelAriaLabel: 'Projects assigned to you',
      clearAriaLabel: 'Clear assigned-to-me filter',
      active: mineActive,
      open: this.projectMineQuickPanelOpen,
      showClear: mineActive,
      options: [
        {
          key: 'mine',
          label: 'Assigned to me',
          active: mineActive
        }
      ]
    };

    this.sharedToolbarMineQuickFilterConfigCacheKey = cacheKey;
    this.sharedToolbarMineQuickFilterConfigCache = nextConfig;
    return nextConfig;
  }

  toggleProjectMineQuickPanel(): void {
    if (this.projectAssigneeSelection.kind !== 'mine') {
      this.projectAssigneeSelection = { kind: 'mine' };
      this.projectMineQuickPanelOpen = false;
      this.touchProjectToolbarFilters();
      return;
    }

    this.toolbarSearchOpen = false;
    this.closeProjectGroupingMenus();
    this.projectMineQuickPanelOpen = !this.projectMineQuickPanelOpen;
    this.cdr.markForCheck();
  }

  clearProjectMineQuickFilter(event?: Event): void {
    event?.stopPropagation();
    this.projectMineQuickPanelOpen = false;
    if (this.projectAssigneeSelection.kind === 'all') {
      this.cdr.markForCheck();
      return;
    }
    this.projectAssigneeSelection = { kind: 'all' };
    this.touchProjectToolbarFilters();
  }

  toggleProjectMineQuickOption(key: string): void {
    if (key !== 'mine') return;
    this.projectMineQuickPanelOpen = false;
    this.projectAssigneeSelection =
      this.projectAssigneeSelection.kind === 'mine' ? { kind: 'all' } : { kind: 'mine' };
    this.touchProjectToolbarFilters();
  }

  projectGroupLabel(): string {
    return (
      this.projectGroupOptions.find(option => option.value === this.projectGroupBy)?.label ?? 'None'
    );
  }

  projectGroupIcon(): string {
    return (
      this.projectGroupOptions.find(option => option.value === this.projectGroupBy)?.icon ??
      'slash-circle'
    );
  }

  projectGroupOrderLabel(): string {
    return this.projectGroupOrder === 'desc' ? 'Descending' : 'Ascending';
  }

  setProjectGroupBy(value: ProjectsGroupOptionValue): void {
    this.projectGroupBy = value;
    this.applyProjectGrouping();
  }

  setProjectGroupOrder(value: 'asc' | 'desc'): void {
    this.projectGroupOrder = value;
    this.applyProjectGrouping();
  }

  resetProjectGroupingUi(): void {
    this.projectGroupBy = 'none';
    this.projectGroupOrder = 'asc';
    this.applyProjectGrouping();
  }

  toggleToolbarSearch(): void {
    if (this.toolbarSearchOpen) {
      this.toolbarSearchOpen = false;
      this.cdr.markForCheck();
      return;
    }
    this.toolbarSearchOpen = true;
    this.cdr.markForCheck();
    queueMicrotask(() => {
      const input = this.toolbarSearchInputRef?.nativeElement;
      if (!input) return;
      input.focus();
      input.select();
    });
  }

  onToolbarSearchInput(value: string): void {
    this.toolbarSearchTerm = value;
    this.grid?.onGlobalSearch(value);
    this.invalidateProjectRowsFilterCache();
    this.cdr.markForCheck();
  }

  clearToolbarSearch(event?: Event): void {
    event?.stopPropagation();
    this.toolbarSearchTerm = '';
    this.grid?.onGlobalSearch('');
    this.invalidateProjectRowsFilterCache();
    this.cdr.markForCheck();
    queueMicrotask(() => this.toolbarSearchInputRef?.nativeElement?.focus());
  }

  onToolbarSearchKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    this.toolbarSearchOpen = false;
    this.cdr.markForCheck();
  }

  projectRowsForGrid(): TenderRow[] {
    const source: TenderRow[] = Array.isArray(this.rows) ? this.rows : [];
    if (this.usesServerDrivenProjectRows()) {
      return source;
    }
    return this.projectRowsForCalendar();
  }

  protected projectRowsForCalendar(): TenderRow[] {
    const source: TenderRow[] = this.projectCalendarSourceRows();
    if (
      this.projectRowsFilterCacheSource === source &&
      this.projectRowsFilterCacheVersion === this.projectRowsFilterVersion
    ) {
      return this.projectRowsFilterCache;
    }
    const searchTerm = this.toolbarSearchTerm.trim().toLowerCase();
    const searchFilteredRows = searchTerm
      ? source.filter(row => this.projectCalendarSearchMatch(row, searchTerm))
      : source;
    const activeFilters = getValidProjectToolbarFilters(this.projectToolbarFilters);
    const nextRows = activeFilters.length
      ? applyProjectToolbarFilters(
          searchFilteredRows,
          activeFilters,
          field => this.getProjectFilterColumnByField(field)?.filterType ?? 'text'
        )
      : searchFilteredRows;
    const filteredRows = this.applyProjectAssigneeSelection(nextRows);
    this.projectRowsFilterCacheSource = source;
    this.projectRowsFilterCacheVersion = this.projectRowsFilterVersion;
    this.projectRowsFilterCache = filteredRows;
    return filteredRows;
  }

  private projectCalendarSearchMatch(row: TenderRow, searchTerm: string): boolean {
    const cached = this.projectCalendarSearchTextCache.get(row);
    if (cached !== undefined) {
      return cached.includes(searchTerm);
    }

    const searchableText = [
      row.title,
      row.owner,
      row.ownerType,
      row.status,
      row.top,
      row.ts,
      row.assignTo,
      row.inCharge,
      row.country,
      row.consultant,
      row.description,
      row.deadline,
      row.startDate,
      row.endDate,
      row.acceptDate,
      row.price,
      row.prb,
      row.doi,
      row.delayReasons
    ]
      .map(value => String(value ?? '').trim().toLowerCase())
      .filter(Boolean)
      .join('\n');

    this.projectCalendarSearchTextCache.set(row, searchableText);
    return searchableText.includes(searchTerm);
  }

  projectHasActiveFilters(): boolean {
    return getValidProjectToolbarFilters(this.projectToolbarFilters).length > 0;
  }

  projectHasDetailedFilters(): boolean {
    return this.projectToolbarFilters.some(filter => !!filter.field.trim());
  }

  projectActiveFilterCount(): number {
    return getValidProjectToolbarFilters(this.projectToolbarFilters).length;
  }

  projectFilterFieldLabel(field: string): string {
    const target = field.trim();
    return target
      ? (this.getProjectFilterColumnByField(target)?.label ?? 'Select filter')
      : 'Select filter';
  }

  projectFilterFieldIcon(field: string): string {
    const target = field.trim();
    return target
      ? (this.getProjectFilterColumnByField(target)?.icon ?? 'layout-three-columns')
      : 'funnel';
  }

  projectFilterFieldSearchTerm(filterId: string): string {
    return this.projectFilterFieldSearchTerms[filterId] ?? '';
  }

  projectFilterColumns(filterId: string): ProjectFilterColumnOption[] {
    const search = this.projectFilterFieldSearchTerm(filterId).trim().toLowerCase();
    const columns = this.getProjectFilterColumnOptions();
    return !search
      ? columns
      : columns.filter(
          column =>
            column.label.toLowerCase().includes(search) ||
            column.field.toLowerCase().includes(search)
        );
  }

  projectFilterOperatorOptions(filter: ProjectToolbarFilter): ProjectFilterOperatorOption[] {
    return this.getProjectFilterOperatorsForField(filter.field).map(value => ({
      value,
      label: PROJECT_FILTER_OPERATOR_LABELS[value]
    }));
  }

  projectFilterOperatorLabel(operator: ProjectFilterOperator): string {
    return PROJECT_FILTER_OPERATOR_LABELS[operator] ?? PROJECT_FILTER_OPERATOR_LABELS.contains;
  }

  override projectFilterOperatorNeedsNoValue(operator: ProjectFilterOperator): boolean {
    return super.projectFilterOperatorNeedsNoValue(operator);
  }

  projectFilterValueUsesDropdown(filter: ProjectToolbarFilter): boolean {
    const field = filter.field.trim();
    if (!field) return false;
    const filterType = this.getProjectFilterColumnByField(field)?.filterType ?? 'text';
    return (
      filterType === 'select' ||
      filterType === 'boolean' ||
      PROJECT_FILTER_SELECT_LIKE_FIELDS.has(field.toLowerCase())
    );
  }

  projectFilterValueOptions(filter: ProjectToolbarFilter): string[] {
    if (!this.projectFilterValueUsesDropdown(filter)) return [];
    const field = filter.field.trim();
    const filterType = this.getProjectFilterColumnByField(field)?.filterType ?? 'text';
    const suggestions = this.projectFilterValueSuggestions(filter);
    if (suggestions.length) return suggestions;
    return filterType === 'boolean' ? ['true', 'false'] : [];
  }

  projectFilterValueDisplay(filter: ProjectToolbarFilter): string {
    return filter.value.trim() || this.projectFilterValuePlaceholder(filter);
  }

  projectFilterValueOptionSelected(filter: ProjectToolbarFilter, option: string): boolean {
    return filter.value.trim().toLowerCase() === option.trim().toLowerCase();
  }

  projectFilterValuePlaceholder(filter: ProjectToolbarFilter): string {
    const field = filter.field.trim();
    if (!field) return 'Select option';
    const filterType = this.getProjectFilterColumnByField(field)?.filterType ?? 'text';
    if (filterType === 'date') return 'Select date';
    if (filterType === 'number') return 'Enter number';
    return filterType === 'text' ? 'Enter value' : 'Select option';
  }

  projectFilterValueInputType(filter: ProjectToolbarFilter): 'text' | 'number' | 'date' {
    const field = filter.field.trim();
    if (!field) return 'text';
    const filterType = this.getProjectFilterColumnByField(field)?.filterType ?? 'text';
    if (filterType === 'date') return 'date';
    return filterType === 'number' ? 'number' : 'text';
  }

  projectFilterValueInputValue(filter: ProjectToolbarFilter): string {
    const inputType = this.projectFilterValueInputType(filter);
    if (inputType !== 'date') return filter.value;
    const timestamp = parseProjectFilterDate(filter.value);
    return timestamp === null ? filter.value : formatProjectFilterDateInput(new Date(timestamp));
  }

  projectFilterValueListId(filter: ProjectToolbarFilter): string | null {
    return this.projectFilterValueInputType(filter) === 'date' ||
      this.projectFilterValueUsesDropdown(filter)
      ? null
      : this.projectFilterDatalistId(filter.id);
  }

  projectFilterDatalistId(filterId: string): string {
    return `proj-filter-values-${filterId}`;
  }
}
