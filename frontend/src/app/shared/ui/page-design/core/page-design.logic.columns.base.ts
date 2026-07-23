import { Directive } from '@angular/core';
import { firstValueFrom, isObservable } from 'rxjs';
import type { FilterOperator, FilterType, GridFilterOptionValue } from '@shared/data-grid';
import {
  SHARED_FILTER_OPERATORS_BY_TYPE,
  SHARED_FILTER_OPERATOR_LABELS,
  SHARED_OPERATORS_WITHOUT_VALUE,
  type SharedFilterColumnOption,
  type SharedFilterGroup,
  type SharedFilterJoin,
  type SharedFilterRow,
  type SharedGridColumn,
  type SharedGroupSelection,
  type SharedGroupOrder,
  type SharedFilterValueOption
} from '../models';
import { getGridColumnField, resolveSharedFilterType } from './page-design.utils';
import { PageDesignLogicSupportBase } from './page-design.logic.support.base';

type SharedColumnsPanelOption = {
  key: string;
  label: string;
  icon: string;
  hugeIcon?: SharedGridColumn['hugeIcon'];
  hugeIconSize?: SharedGridColumn['hugeIconSize'];
  hugeIconStrokeWidth?: SharedGridColumn['hugeIconStrokeWidth'];
  pinned?: boolean;
};

@Directive()
export abstract class PageDesignLogicColumnsBase extends PageDesignLogicSupportBase {
  protected readonly sharedFilterValueOptionsCache = new Map<string, SharedFilterValueOption[]>();
  protected readonly sharedFilterValueOptionsInFlight = new Map<string, Promise<void>>();
  protected readonly sharedFilterValueOptionsLoadingFields = new Set<string>();
  private sharedFilterStateSyncKey = '';
  private sharedFilterStateSyncSource: unknown = null;
  private sharedFilterValueOptionsVersion = 0;
  private sharedShownColumnsPanelOptionsColumns: SharedGridColumn[] | null = null;
  private sharedShownColumnsPanelOptionsCache: SharedColumnsPanelOption[] = [];
  private sharedHiddenColumnsPanelOptionsColumns: SharedGridColumn[] | null = null;
  private sharedHiddenColumnsPanelOptionsCache: SharedColumnsPanelOption[] = [];
  private sharedFilterableColumnsCacheColumns: SharedGridColumn[] | null = null;
  private sharedFilterableColumnsCacheKey = '';
  private sharedFilterableColumnsCache: SharedFilterColumnOption[] = [];
  private readonly sharedFilterColumnsCache = new Map<
    string,
    {
      search: string;
      source: SharedFilterColumnOption[];
      result: SharedFilterColumnOption[];
    }
  >();
  private readonly sharedFilterOperatorOptionsCache = new Map<
    FilterType,
    Array<{ value: FilterOperator; label: string }>
  >();

  protected sharedColumnsShown(): SharedGridColumn[] {
    return this.sharedColumnsByVisibility(false);
  }

  protected sharedColumnsHidden(): SharedGridColumn[] {
    return this.sharedColumnsByVisibility(true);
  }

  protected sharedShownColumnsPanelOptions(): SharedColumnsPanelOption[] {
    const columns = this.sharedColumnsShown();
    if (this.sharedShownColumnsPanelOptionsColumns === columns) {
      return this.sharedShownColumnsPanelOptionsCache;
    }

    const next = columns.map(column => ({
      key: this.sharedColumnField(column),
      label: this.sharedColumnLabel(column),
      icon: this.sharedColumnMenuIcon(column),
      hugeIcon: column.hugeIcon,
      hugeIconSize: column.hugeIconSize,
      hugeIconStrokeWidth: column.hugeIconStrokeWidth,
      pinned: !this.canToggleSharedColumn(column)
    }));
    this.sharedShownColumnsPanelOptionsColumns = columns;
    this.sharedShownColumnsPanelOptionsCache = next;
    return next;
  }

  protected sharedHiddenColumnsPanelOptions(): SharedColumnsPanelOption[] {
    const columns = this.sharedColumnsHidden();
    if (this.sharedHiddenColumnsPanelOptionsColumns === columns) {
      return this.sharedHiddenColumnsPanelOptionsCache;
    }

    const next = columns.map(column => ({
      key: this.sharedColumnField(column),
      label: this.sharedColumnLabel(column),
      icon: this.sharedColumnMenuIcon(column),
      hugeIcon: column.hugeIcon,
      hugeIconSize: column.hugeIconSize,
      hugeIconStrokeWidth: column.hugeIconStrokeWidth
    }));
    this.sharedHiddenColumnsPanelOptionsColumns = columns;
    this.sharedHiddenColumnsPanelOptionsCache = next;
    return next;
  }

  protected toggleSharedColumnByField(field: string): void {
    const column = this.getSharedGridColumns().find(
      item => this.getGridColumnField(item) === field
    );
    if (!column) {
      return;
    }
    this.toggleSharedColumn(column);
  }

  protected applySharedShownColumnsOrder(shown: string[]): void {
    const hidden = this.sharedHiddenColumnsPanelOptions().map(column => column.key);
    this.applySharedColumnOrder([...shown, ...hidden]);
  }

  protected applySharedHiddenColumnsOrder(hidden: string[]): void {
    const shown = this.sharedShownColumnsPanelOptions().map(column => column.key);
    this.applySharedColumnOrder([...shown, ...hidden]);
  }

  protected toggleSharedColumn(column: SharedGridColumn, event?: Event): void {
    event?.stopPropagation();
    const grid = this.getSharedGrid();
    if (!grid || !column || !this.canToggleSharedColumn(column)) {
      return;
    }
    if (typeof grid.toggleColumnVisibility === 'function') {
      grid.toggleColumnVisibility(column);
      return;
    }
    if (typeof grid.toggleColumnVisibilityFromMenu === 'function') {
      grid.toggleColumnVisibilityFromMenu(column);
    }
  }

  protected showAllSharedColumns(event?: Event): void {
    event?.stopPropagation();
    const grid = this.getSharedGrid();
    if (grid && typeof grid.showAllColumnsFromMenu === 'function') {
      grid.showAllColumnsFromMenu();
    }
  }

  protected hideAllSharedColumns(event?: Event): void {
    event?.stopPropagation();
    const grid = this.getSharedGrid();
    if (grid && typeof grid.hideAllColumnsFromMenu === 'function') {
      grid.hideAllColumnsFromMenu();
    }
  }

  protected resetSharedColumns(event?: Event): void {
    event?.stopPropagation();
    const grid = this.getSharedGrid();
    if (grid && typeof grid.resetColumns === 'function') {
      grid.resetColumns();
      return;
    }
    if (grid && typeof grid.showAllColumnsFromMenu === 'function') {
      grid.showAllColumnsFromMenu();
    }
  }

  protected toggleSharedFilter(): void {
    // Kept for backward compatibility with earlier template wiring.
  }

  protected sharedFilterEnabled(): boolean {
    return this.sharedHasActiveFilters();
  }

  protected syncSharedToolbarFiltersFromGrid(): void {
    if (this.sharedFilterPanelOpen) {
      return;
    }

    const grid = this.getSharedGrid();
    const rawFiltersSource = grid?.filterStates ? grid.filterStates() : null;
    if (this.sharedFilterStateSyncSource === rawFiltersSource && this.sharedFilterStateSyncKey) {
      return;
    }

    const rawFilters = Array.isArray(rawFiltersSource) ? rawFiltersSource : [];
    const normalized = Array.isArray(rawFilters)
      ? rawFilters
          .filter(filter => {
            const field = String(filter?.field ?? '').trim();
            const operator = String(filter?.operator ?? '').trim();
            if (!field || !operator || operator === 'globalSearch' || operator === 'menuSearch') {
              return false;
            }
            return !Array.isArray(filter?.value);
          })
          .map(filter => ({
            field: String(filter.field ?? '').trim(),
            operator: String(filter.operator ?? 'contains').trim() as FilterOperator,
            value: String(filter.value ?? ''),
            joinWithPrev: filter.joinWithPrev === 'or' ? 'or' : ('and' as SharedFilterJoin)
          }))
      : [];

    const nextKey = JSON.stringify(normalized);
    this.sharedFilterStateSyncSource = rawFiltersSource;
    if (nextKey === this.sharedFilterStateSyncKey) {
      return;
    }

    if (!normalized.length) {
      this.sharedToolbarFilterGroups = [];
      this.sharedFilterStateSyncKey = nextKey;
      return;
    }

    const nextGroups: SharedFilterGroup[] = [];
    let currentGroup: SharedFilterGroup | null = null;
    let currentNestedJoin: SharedFilterJoin | null = null;

    for (const filter of normalized) {
      const nextRow = {
        ...this.createSharedFilterRow(),
        field: filter.field,
        operator: filter.operator,
        value: filter.value,
        joinWithPrev: filter.joinWithPrev
      };

      if (!currentGroup) {
        currentGroup = this.createSharedFilterGroup([nextRow]);
        nextGroups.push(currentGroup);
        continue;
      }

      const join = filter.joinWithPrev;
      if (currentGroup.rows.length === 1) {
        currentNestedJoin = join;
        currentGroup.rows = this.normalizeSharedFilterGroupRows([
          ...currentGroup.rows,
          { ...nextRow, joinWithPrev: join }
        ]);
        continue;
      }

      if (currentNestedJoin === join) {
        currentGroup.rows = this.normalizeSharedFilterGroupRows([
          ...currentGroup.rows,
          { ...nextRow, joinWithPrev: join }
        ]);
        continue;
      }

      currentGroup = this.createSharedFilterGroup([nextRow]);
      currentGroup.joinWithPrev = join;
      currentNestedJoin = null;
      nextGroups.push(currentGroup);
    }

    this.sharedToolbarFilterGroups = nextGroups.map((group, index) => ({
      ...group,
      joinWithPrev: index === 0 ? 'and' : group.joinWithPrev
    }));
    this.sharedFilterStateSyncKey = nextKey;
  }

  protected invalidateSharedFilterStateSync(): void {
    this.sharedFilterStateSyncKey = '';
    this.sharedFilterStateSyncSource = null;
    this.invalidateSharedFilterValueOptionsCache();
    if (this.sharedFilterPanelOpen) {
      queueMicrotask(() => this.primeSharedFilterValueOptions());
    }
  }

  protected invalidateSharedFilterValueOptionsCache(field?: string): void {
    this.sharedFilterValueOptionsVersion += 1;
    const normalizedField = String(field ?? '').trim();
    if (normalizedField) {
      this.sharedFilterValueOptionsCache.delete(normalizedField);
      this.sharedFilterValueOptionsInFlight.delete(normalizedField);
      this.sharedFilterValueOptionsLoadingFields.delete(normalizedField);
      return;
    }
    this.sharedFilterValueOptionsCache.clear();
    this.sharedFilterValueOptionsInFlight.clear();
    this.sharedFilterValueOptionsLoadingFields.clear();
  }

  protected sharedGroupLabel(): string {
    const activeField = this.sharedGroupByField();
    if (!activeField) {
      return 'None';
    }
    return (
      this.sharedGroupOptions().find(option => option.value === activeField)?.label ?? activeField
    );
  }

  protected sharedGroupOrderLabel(): string {
    const first = this.sharedActiveGroupSelections()[0];
    return (first?.order ?? 'asc') === 'desc' ? 'Descending' : 'Ascending';
  }

  protected sharedSubGroupOrderLabel(): string {
    const second = this.sharedActiveGroupSelections()[1];
    return (second?.order ?? 'asc') === 'desc' ? 'Descending' : 'Ascending';
  }

  protected canToggleSharedColumn(column: SharedGridColumn): boolean {
    if (column?.pinned === 'left' || column?.pinned === 'right') {
      return false;
    }
    return !column || column.hidden ? true : this.sharedColumnsShown().length > 1;
  }

  protected sharedGroupIsActive(field: string): boolean {
    return this.readSignal<string[]>('groupColumns').includes(field);
  }

  protected setSharedGroupSelections(
    rows: SharedGroupSelection[],
    groupMenu?: HTMLDetailsElement
  ): void {
    const normalized = this.normalizeSharedGroupSelections(rows);
    this.sharedGroupSelectionsDraft = normalized;

    const active = normalized.filter(
      (row): row is { value: string; order: SharedGroupOrder } => !!row.value
    );
    this.sharedGroupOrder = active[0]?.order ?? normalized[0]?.order ?? 'asc';
    this.sharedSubGroupOrder = active[1]?.order ?? 'asc';

    this.applySharedGrouping(normalized);
    if (groupMenu) groupMenu.open = false;
  }

  protected setSharedGrouping(field: string | null, groupMenu?: HTMLDetailsElement): void {
    const active = this.sharedActiveGroupSelections();
    if (!field) {
      this.setSharedGroupSelections([{ value: null, order: 'asc' }], groupMenu);
      return;
    }

    const next: SharedGroupSelection[] = [
      {
        value: field,
        order: active[0]?.order ?? this.sharedGroupOrder ?? 'asc',
        dateInterval: this.normalizeSharedDateGroupInterval(field, active[0]?.dateInterval)
      }
    ];
    const secondary = active[1];
    if (secondary && secondary.value !== field) {
      next.push({
        value: secondary.value,
        order: secondary.order,
        dateInterval: this.normalizeSharedDateGroupInterval(secondary.value, secondary.dateInterval)
      });
    }
    this.setSharedGroupSelections(next, groupMenu);
  }

  protected setSharedSubGrouping(field: string | null, groupMenu?: HTMLDetailsElement): void {
    const active = this.sharedActiveGroupSelections();
    const primary = active[0];
    if (!primary?.value) {
      return;
    }

    const next: SharedGroupSelection[] = [
      {
        value: primary.value,
        order: primary.order,
        dateInterval: this.normalizeSharedDateGroupInterval(primary.value, primary.dateInterval)
      }
    ];
    if (field && field !== primary.value) {
      next.push({
        value: field,
        order: active[1]?.order ?? this.sharedSubGroupOrder ?? 'asc',
        dateInterval: this.normalizeSharedDateGroupInterval(field, active[1]?.dateInterval)
      });
    }
    this.setSharedGroupSelections(next, groupMenu);
  }

  protected setSharedSubGroupOrder(order: SharedGroupOrder, groupMenu?: HTMLDetailsElement): void {
    const active = this.sharedActiveGroupSelections();
    if (active.length < 2) {
      this.sharedSubGroupOrder = order;
      if (groupMenu) groupMenu.open = false;
      return;
    }

    const next: SharedGroupSelection[] = [
      {
        value: active[0].value,
        order: active[0].order,
        dateInterval: this.normalizeSharedDateGroupInterval(active[0].value, active[0].dateInterval)
      },
      {
        value: active[1].value,
        order,
        dateInterval: this.normalizeSharedDateGroupInterval(active[1].value, active[1].dateInterval)
      }
    ];
    this.setSharedGroupSelections(next, groupMenu);
  }

  protected setSharedGroupOrder(order: SharedGroupOrder, groupMenu?: HTMLDetailsElement): void {
    const active = this.sharedActiveGroupSelections();
    if (!active.length) {
      this.sharedGroupOrder = order;
      this.sharedGroupSelectionsDraft = [{ value: null, order }];
      if (groupMenu) {
        groupMenu.open = false;
      }
      return;
    }

    const next = [
      {
        value: active[0].value,
        order,
        dateInterval: this.normalizeSharedDateGroupInterval(active[0].value, active[0].dateInterval)
      },
      ...active.slice(1)
    ];
    this.setSharedGroupSelections(next, groupMenu);
  }

  protected resetSharedGroupingUi(groupMenu?: HTMLDetailsElement): void {
    this.sharedGroupOrder = 'asc';
    this.sharedSubGroupOrder = 'asc';
    this.sharedGroupSelectionsDraft = [{ value: null, order: 'asc' }];
    this.applySharedGrouping(this.sharedGroupSelectionsDraft);
    if (groupMenu) groupMenu.open = false;
  }

  protected sharedHasDetailedFilters(): boolean {
    this.syncSharedToolbarFiltersFromGrid();
    return this.sharedToolbarFilterGroups.length > 0;
  }

  protected sharedHasActiveFilters(): boolean {
    this.syncSharedToolbarFiltersFromGrid();
    return this.sharedActiveFilterCount() > 0;
  }

  protected addSharedToolbarFilter(event?: Event): void {
    event?.stopPropagation();
    const nextGroup = this.createSharedFilterGroup();
    if (this.sharedToolbarFilterGroups.length > 0) {
      nextGroup.joinWithPrev =
        this.sharedToolbarFilterGroups[1]?.joinWithPrev === 'or' ? 'or' : 'and';
    }
    this.sharedToolbarFilterGroups = [...this.sharedToolbarFilterGroups, nextGroup];
    this.invalidateSharedFilterStateSync();
    this.cdr.markForCheck();
    this.scheduleSharedFilterPanelPositionUpdate();
  }

  openSharedFilterForColumn(field: string): void {
    const normalizedField = String(field ?? '').trim();
    if (!normalizedField) {
      return;
    }

    const column = this.sharedFilterableColumns().find(option => option.field === normalizedField);
    if (!column) {
      return;
    }

    const existingFilter = this.sharedToolbarFilters.find(
      filter => filter.field.trim() === normalizedField
    );
    if (existingFilter) {
      this.primeSharedFilterValueOptionsForFilter(existingFilter.id);
      this.cdr.markForCheck();
      this.scheduleSharedFilterPanelPositionUpdate();
      return;
    }

    let targetFilterId: string | null = null;
    this.sharedToolbarFilterGroups = this.sharedToolbarFilterGroups.map(group => ({
      ...group,
      rows: group.rows.map(filter => {
        if (targetFilterId || filter.field.trim()) {
          return filter;
        }
        targetFilterId = filter.id;
        const next = { ...filter, field: normalizedField, value: '' };
        next.operator = this.sharedFilterOperatorOptions(next)[0]?.value ?? 'contains';
        return next;
      })
    }));

    if (!targetFilterId) {
      const nextFilter = this.createSharedFilterRow();
      nextFilter.field = normalizedField;
      nextFilter.operator = this.sharedFilterOperatorOptions(nextFilter)[0]?.value ?? 'contains';
      targetFilterId = nextFilter.id;
      this.sharedToolbarFilterGroups = [
        ...this.sharedToolbarFilterGroups,
        this.createSharedFilterGroup([nextFilter])
      ];
    }

    this.sharedFilterFieldSearchTerms = {
      ...this.sharedFilterFieldSearchTerms,
      [targetFilterId]: ''
    };
    this.invalidateSharedFilterStateSync();
    this.primeSharedFilterValueOptionsForFilter(targetFilterId);
    this.cdr.markForCheck();
    this.scheduleSharedFilterPanelPositionUpdate();
  }

  protected addSharedNestedFilter(targetId: string, event?: Event): void {
    event?.stopPropagation();
    const groupIndex = this.sharedToolbarFilterGroups.findIndex(
      group => group.id === targetId || group.rows.some(row => row.id === targetId)
    );

    const nextRow = this.createSharedFilterRow();

    if (groupIndex < 0) {
      this.sharedToolbarFilterGroups = [
        ...this.sharedToolbarFilterGroups,
        this.createSharedFilterGroup([nextRow])
      ];
      this.invalidateSharedFilterStateSync();
      this.cdr.markForCheck();
      this.scheduleSharedFilterPanelPositionUpdate();
      return;
    }

    const targetGroup = this.sharedToolbarFilterGroups[groupIndex];
    if (targetGroup.rows.length > 1) {
      nextRow.joinWithPrev = this.sharedFilterNestedJoin(targetGroup);
    }
    const rowIndex = targetGroup.rows.findIndex(row => row.id === targetId);
    const insertIndex = rowIndex >= 0 ? rowIndex + 1 : targetGroup.rows.length;
    const nextRows = [...targetGroup.rows];
    nextRows.splice(insertIndex, 0, nextRow);

    this.sharedToolbarFilterGroups = this.sharedToolbarFilterGroups.map((group, index) =>
      index === groupIndex
        ? { ...group, rows: this.normalizeSharedFilterGroupRows(nextRows) }
        : group
    );
    this.invalidateSharedFilterStateSync();
    this.cdr.markForCheck();
    this.scheduleSharedFilterPanelPositionUpdate();
  }

  protected onSharedFilterGroupJoinChange(groupId: string, joinWithPrev: string): void {
    const normalized: SharedFilterJoin = joinWithPrev === 'or' ? 'or' : 'and';
    this.sharedToolbarFilterGroups = this.sharedToolbarFilterGroups.map((group, index) =>
      index === 0 ? group : { ...group, joinWithPrev: normalized }
    );
    this.invalidateSharedFilterStateSync();
    this.cdr.markForCheck();
  }

  protected onSharedFilterJoinChange(filterId: string, joinWithPrev: string): void {
    const normalized: SharedFilterJoin = joinWithPrev === 'or' ? 'or' : 'and';
    this.sharedToolbarFilterGroups = this.sharedToolbarFilterGroups.map((group, groupIndex) => {
      const rowIndex = group.rows.findIndex(filter => filter.id === filterId);
      if (rowIndex < 0) {
        return group;
      }

      if (groupIndex > 0 && rowIndex === 0) {
        return { ...group, joinWithPrev: normalized };
      }

      if (rowIndex > 0) {
        return {
          ...group,
          rows: this.normalizeSharedFilterGroupRows(
            group.rows.map((filter, index) =>
              index === 0 ? filter : { ...filter, joinWithPrev: normalized }
            )
          )
        };
      }

      return {
        ...group,
        rows: group.rows.map(filter =>
          filter.id === filterId ? { ...filter, joinWithPrev: normalized } : filter
        )
      };
    });
    this.invalidateSharedFilterStateSync();
    this.cdr.markForCheck();
  }

  protected sharedFilterNestedJoin(group: SharedFilterGroup): SharedFilterJoin {
    if (!group?.rows?.length || group.rows.length < 2) {
      return 'and';
    }
    return group.rows[1]?.joinWithPrev === 'or' ? 'or' : 'and';
  }

  protected onSharedFilterNestedJoinChange(groupId: string, joinWithPrev: string): void {
    const normalized: SharedFilterJoin = joinWithPrev === 'or' ? 'or' : 'and';
    this.sharedToolbarFilterGroups = this.sharedToolbarFilterGroups.map(group =>
      group.id === groupId
        ? {
            ...group,
            rows: this.normalizeSharedFilterGroupRows(
              group.rows.map((row, index) =>
                index === 0 ? row : { ...row, joinWithPrev: normalized }
              )
            )
          }
        : group
    );
    this.invalidateSharedFilterStateSync();
    this.cdr.markForCheck();
  }

  protected removeSharedToolbarFilter(filterId: string, event?: Event): void {
    event?.stopPropagation();
    const nextGroups = this.sharedToolbarFilterGroups
      .map(group => ({
        ...group,
        rows: this.normalizeSharedFilterGroupRows(
          group.rows.filter(filter => filter.id !== filterId)
        )
      }))
      .filter(group => group.rows.length > 0);

    this.sharedToolbarFilterGroups = nextGroups;
    delete this.sharedFilterFieldSearchTerms[filterId];
    this.sharedFilterColumnsCache.delete(filterId);
    this.invalidateSharedFilterStateSync();
    this.applySharedToolbarFilters();
    this.scheduleSharedFilterPanelPositionUpdate();
  }

  protected clearSharedToolbarFilters(event?: Event): void {
    event?.stopPropagation();
    this.sharedToolbarFilterGroups = [];
    this.sharedFilterFieldSearchTerms = {};
    this.sharedFilterColumnsCache.clear();
    this.invalidateSharedFilterStateSync();
    const grid = this.getSharedGrid();
    if (grid && typeof grid.clearAllFilters === 'function') {
      grid.clearAllFilters();
    } else {
      this.applySharedToolbarFilters();
    }
    this.scheduleSharedFilterPanelPositionUpdate();
  }

  protected clearSharedFilterGroup(groupId: string, event?: Event): void {
    event?.stopPropagation();
    const target = this.sharedToolbarFilterGroups.find(group => group.id === groupId);
    if (!target) {
      return;
    }

    const nextGroups = this.sharedToolbarFilterGroups.filter(group => group.id !== groupId);
    this.sharedToolbarFilterGroups = nextGroups;

    for (const row of target.rows) {
      delete this.sharedFilterFieldSearchTerms[row.id];
      this.sharedFilterColumnsCache.delete(row.id);
    }

    this.invalidateSharedFilterStateSync();
    this.applySharedToolbarFilters();
    this.cdr.markForCheck();
    this.scheduleSharedFilterPanelPositionUpdate();
  }

  protected onSharedFilterPanelActionPointerDown(event?: Event): void {
    event?.stopPropagation();
  }

  protected sharedFilterFieldLabel(field: string): string {
    const target = field.trim();
    if (!target) {
      return 'Select filter';
    }
    return (
      this.sharedFilterableColumns().find(column => column.field === target)?.label ??
      'Select filter'
    );
  }

  protected sharedFilterFieldIcon(field: string): string {
    const target = field.trim();
    if (!target) {
      return 'funnel';
    }
    return (
      this.sharedFilterableColumns().find(column => column.field === target)?.icon ??
      'layout-three-columns'
    );
  }

  protected sharedFilterFieldSearchTerm(filterId: string): string {
    return this.sharedFilterFieldSearchTerms[filterId] ?? '';
  }

  protected onSharedFilterFieldSearchInput(filterId: string, value: string): void {
    this.sharedFilterFieldSearchTerms = {
      ...this.sharedFilterFieldSearchTerms,
      [filterId]: value ?? ''
    };
    this.sharedFilterColumnsCache.delete(filterId);
    this.cdr.markForCheck();
  }

  protected clearSharedFilterFieldSearch(filterId: string, event?: Event): void {
    event?.stopPropagation();
    this.sharedFilterFieldSearchTerms = {
      ...this.sharedFilterFieldSearchTerms,
      [filterId]: ''
    };
    this.sharedFilterColumnsCache.delete(filterId);
    this.cdr.markForCheck();
  }

  protected sharedFilterColumns(filterId: string): SharedFilterColumnOption[] {
    const search = this.sharedFilterFieldSearchTerm(filterId).trim().toLowerCase();
    const source = this.sharedFilterableColumns();
    if (!search) {
      return source;
    }
    const cached = this.sharedFilterColumnsCache.get(filterId);
    if (cached && cached.search === search && cached.source === source) {
      return cached.result;
    }

    const result = source.filter(option => {
      const field = option.field.toLowerCase();
      const label = option.label.toLowerCase();
      return field.includes(search) || label.includes(search);
    });
    this.sharedFilterColumnsCache.set(filterId, { search, source, result });
    return result;
  }

  protected sharedFilterableColumns(): SharedFilterColumnOption[] {
    const columns = this.getSharedGridColumns();
    const cacheKey = this.buildSharedFilterableColumnsCacheKey(columns);
    if (
      this.sharedFilterableColumnsCacheColumns === columns &&
      this.sharedFilterableColumnsCacheKey === cacheKey
    ) {
      return this.sharedFilterableColumnsCache;
    }

    const next = columns
      .filter(column => {
        const field = this.getGridColumnField(column);
        if (!field || field === '__selection__') return false;
        if (column.filterable === false) return false;
        return true;
      })
      .map(column => {
        const filterType = this.resolveSharedFilterType(column);
        return {
          field: this.getGridColumnField(column),
          label:
            typeof column.header === 'string' ? column.header : this.getGridColumnField(column),
          icon: this.sharedColumnIcon(column, filterType),
          filterType,
          column
        } satisfies SharedFilterColumnOption;
      });
    this.sharedFilterableColumnsCacheColumns = columns;
    this.sharedFilterableColumnsCacheKey = cacheKey;
    this.sharedFilterableColumnsCache = next;
    return next;
  }

  protected sharedFilterOperatorOptions(
    filter: SharedFilterRow
  ): Array<{ value: FilterOperator; label: string }> {
    const option = this.sharedFilterableColumns().find(
      column => column.field === filter.field.trim()
    );
    const filterType = option?.filterType ?? 'text';
    const cached = this.sharedFilterOperatorOptionsCache.get(filterType);
    if (cached) {
      return cached;
    }
    const next = (
      SHARED_FILTER_OPERATORS_BY_TYPE[filterType] ?? SHARED_FILTER_OPERATORS_BY_TYPE.text
    ).map(value => ({
      value,
      label: SHARED_FILTER_OPERATOR_LABELS[value]
    }));
    this.sharedFilterOperatorOptionsCache.set(filterType, next);
    return next;
  }

  protected sharedFilterOperatorLabel(operator: FilterOperator): string {
    return SHARED_FILTER_OPERATOR_LABELS[operator] ?? SHARED_FILTER_OPERATOR_LABELS.contains;
  }

  protected onSharedFilterFieldSelect(filterId: string, field: string, event?: Event): void {
    event?.stopPropagation();
    this.sharedToolbarFilterGroups = this.sharedToolbarFilterGroups.map(group => ({
      ...group,
      rows: group.rows.map(filter => {
        if (filter.id !== filterId) return filter;
        const next = { ...filter, field: field.trim(), value: '' };
        const validOps = this.sharedFilterOperatorOptions(next).map(item => item.value);
        if (!validOps.includes(next.operator)) {
          next.operator = validOps[0] ?? 'contains';
        }
        return next;
      })
    }));
    this.sharedFilterFieldSearchTerms = {
      ...this.sharedFilterFieldSearchTerms,
      [filterId]: ''
    };
    this.invalidateSharedFilterStateSync();
    this.primeSharedFilterValueOptionsForFilter(filterId);
    this.applySharedToolbarFilters();
    this.cdr.markForCheck();
  }

  protected onSharedFilterOperatorSelect(
    filterId: string,
    operator: FilterOperator,
    event?: Event
  ): void {
    event?.stopPropagation();
    this.sharedToolbarFilterGroups = this.sharedToolbarFilterGroups.map(group => ({
      ...group,
      rows: group.rows.map(filter => (filter.id === filterId ? { ...filter, operator } : filter))
    }));
    this.invalidateSharedFilterStateSync();
    this.primeSharedFilterValueOptionsForFilter(filterId);
    this.applySharedToolbarFilters();
    this.cdr.markForCheck();
  }

  protected onSharedFilterValueInput(filterId: string, value: string): void {
    this.sharedToolbarFilterGroups = this.sharedToolbarFilterGroups.map(group => ({
      ...group,
      rows: group.rows.map(filter =>
        filter.id === filterId ? { ...filter, value: value ?? '' } : filter
      )
    }));
    this.invalidateSharedFilterStateSync();
    this.scheduleSharedToolbarFiltersApply();
    this.cdr.markForCheck();
  }

  protected onSharedFilterValueSelect(filterId: string, option: string, event?: Event): void {
    event?.stopPropagation();
    this.sharedToolbarFilterGroups = this.sharedToolbarFilterGroups.map(group => ({
      ...group,
      rows: group.rows.map(filter =>
        filter.id === filterId ? { ...filter, value: option } : filter
      )
    }));
    this.invalidateSharedFilterStateSync();
    this.applySharedToolbarFilters();
    this.cdr.markForCheck();
  }

  protected sharedFilterValueInputType(filter: SharedFilterRow): 'text' | 'number' | 'date' {
    const option = this.sharedFilterableColumns().find(
      column => column.field === filter.field.trim()
    );
    switch (option?.filterType) {
      case 'number':
        return 'number';
      case 'date':
        return 'date';
      default:
        return 'text';
    }
  }

  protected sharedFilterValuePlaceholder(filter: SharedFilterRow): string {
    if (!filter.field.trim()) return 'Value';
    if (this.sharedFilterOperatorNeedsNoValue(filter.operator)) return 'No value needed';
    const option = this.sharedFilterableColumns().find(
      column => column.field === filter.field.trim()
    );
    if (option?.filterType === 'date') return 'Select date';
    if (option?.filterType === 'number') return 'Enter number';
    return 'Enter value';
  }

  protected sharedFilterValueDisplay(filter: SharedFilterRow): string {
    const value = (filter.value ?? '').trim();
    if (!value) {
      return 'Select option';
    }
    return (
      this.sharedFilterValueOptions(filter).find(option => option.value === value)?.label ?? value
    );
  }

  protected sharedFilterValueUsesDropdown(filter: SharedFilterRow): boolean {
    const option = this.sharedFilterableColumns().find(
      column => column.field === filter.field.trim()
    );
    if (!option) {
      return false;
    }
    return (
      !!option.column?.options?.length ||
      typeof option.column?.filterOptionsLoader === 'function' ||
      option.filterType === 'boolean' ||
      option.filterType === 'select' ||
      option.filterType === 'multiSelect'
    );
  }

  protected sharedFilterValueOptionsLoading(filter: SharedFilterRow): boolean {
    const field = filter.field.trim();
    return (
      !!field &&
      this.sharedFilterValueOptionsLoadingFields.has(field) &&
      !this.sharedFilterValueOptionsCache.has(field)
    );
  }

  protected sharedFilterValueOptions(filter: SharedFilterRow): SharedFilterValueOption[] {
    if (!filter.field.trim() || this.sharedFilterOperatorNeedsNoValue(filter.operator)) {
      return [];
    }
    const option = this.sharedFilterableColumns().find(
      column => column.field === filter.field.trim()
    );
    if (!option) {
      return [];
    }

    const field = option.field;
    const cached = this.sharedFilterValueOptionsCache.get(field);
    if (cached) {
      return cached;
    }

    if (typeof option.column?.filterOptionsLoader === 'function') {
      return this.sharedFilterValueOptionsCache.get(field) ?? [];
    }

    return this.buildSharedFallbackFilterValueOptions(option.field, option.column);
  }

  protected sharedFilterValueOptionSelected(filter: SharedFilterRow, option: string): boolean {
    return (filter.value ?? '').trim() === option.trim();
  }

  protected sharedFilterValueInputValue(filter: SharedFilterRow): string {
    return filter.value ?? '';
  }

  protected sharedFilterValueListId(filter: SharedFilterRow): string | null {
    if (
      this.sharedFilterValueUsesDropdown(filter) ||
      this.sharedFilterValueInputType(filter) === 'date'
    )
      return null;
    return this.sharedFilterDatalistId(filter.id);
  }

  protected sharedFilterDatalistId(filterId: string): string {
    return `page-design-filter-datalist-${filterId}`;
  }

  protected sharedFilterValueSuggestions(filter: SharedFilterRow): string[] {
    if (!filter.field.trim() || this.sharedFilterOperatorNeedsNoValue(filter.operator)) return [];
    return this.collectSharedDistinctValues(filter.field, 80);
  }

  protected primeSharedFilterValueOptions(): void {
    for (const group of this.sharedToolbarFilterGroups) {
      for (const filter of group.rows) {
        this.primeSharedFilterValueOptionsForRow(filter);
      }
    }
  }

  protected primeSharedFilterValueOptionsForFilter(filterId: string): void {
    for (const group of this.sharedToolbarFilterGroups) {
      const filter = group.rows.find(row => row.id === filterId);
      if (filter) {
        this.primeSharedFilterValueOptionsForRow(filter);
        return;
      }
    }
  }

  private primeSharedFilterValueOptionsForRow(filter: SharedFilterRow): void {
    const field = filter.field.trim();
    if (!field || this.sharedFilterOperatorNeedsNoValue(filter.operator)) {
      return;
    }

    const option = this.sharedFilterableColumns().find(column => column.field === field);
    if (!option || typeof option.column?.filterOptionsLoader !== 'function') {
      return;
    }

    this.ensureSharedFilterValueOptionsLoaded(field, option.column);
  }

  private ensureSharedFilterValueOptionsLoaded(field: string, column: SharedGridColumn): void {
    const normalizedField = field.trim();
    if (
      !normalizedField ||
      typeof column?.filterOptionsLoader !== 'function' ||
      this.sharedFilterValueOptionsCache.has(normalizedField) ||
      this.sharedFilterValueOptionsInFlight.has(normalizedField)
    ) {
      return;
    }

    this.sharedFilterValueOptionsLoadingFields.add(normalizedField);
    this.cdr.markForCheck();
    const cacheVersion = this.sharedFilterValueOptionsVersion;
    const request = this.resolveSharedFilterValueOptionsSource(column.filterOptionsLoader())
      .then(values => {
        if (cacheVersion !== this.sharedFilterValueOptionsVersion) {
          return;
        }
        this.sharedFilterValueOptionsCache.set(
          normalizedField,
          this.normalizeSharedFilterValueOptions(values)
        );
      })
      .catch(() => {
        if (cacheVersion !== this.sharedFilterValueOptionsVersion) {
          return;
        }
        this.sharedFilterValueOptionsCache.set(normalizedField, []);
      })
      .finally(() => {
        this.sharedFilterValueOptionsInFlight.delete(normalizedField);
        this.sharedFilterValueOptionsLoadingFields.delete(normalizedField);
        this.cdr.markForCheck();
      });

    this.sharedFilterValueOptionsInFlight.set(normalizedField, request);
  }

  private buildSharedFallbackFilterValueOptions(
    field: string,
    column: SharedGridColumn
  ): SharedFilterValueOption[] {
    if (column?.options?.length) {
      return this.normalizeSharedFilterValueOptions(column.options);
    }

    const filterType = this.resolveSharedFilterType(column);
    if (filterType === 'boolean') {
      return [
        { label: 'true', value: 'true' },
        { label: 'false', value: 'false' }
      ];
    }

    return this.collectSharedDistinctValues(field, 100).map(value => ({
      label: value,
      value
    }));
  }

  private normalizeSharedFilterValueOptions(
    values: GridFilterOptionValue[] | null | undefined
  ): SharedFilterValueOption[] {
    const optionMap = new Map<string, SharedFilterValueOption>();

    for (const item of values ?? []) {
      const value = item?.value == null ? '' : String(item.value).trim();
      const label = String(item?.label ?? value).trim();
      if (!value || !label || optionMap.has(value)) {
        continue;
      }
      optionMap.set(value, { label, value });
    }

    return Array.from(optionMap.values()).sort((a, b) =>
      a.label.localeCompare(b.label, 'en', { sensitivity: 'base', numeric: true })
    );
  }

  private buildSharedFilterableColumnsCacheKey(columns: SharedGridColumn[]): string {
    return columns
      .map((column, index) => {
        if (!column || typeof column !== 'object') {
          return [index, '', '', '', '', 0, 0, 0].join('\u001f');
        }
        const field = this.getGridColumnField(column);
        const header = typeof column?.header === 'string' ? column.header : '';
        const filterType = this.resolveSharedFilterType(column);
        const icon = typeof column?.icon === 'string' ? column.icon : '';
        const optionsLength = Array.isArray(column?.options) ? column.options.length : 0;
        const hasLoader = typeof column?.filterOptionsLoader === 'function' ? 1 : 0;
        const filterable = column?.filterable === false ? 0 : 1;
        return [index, field, header, filterType, icon, optionsLength, hasLoader, filterable].join(
          '\u001f'
        );
      })
      .join('\u001e');
  }

  private async resolveSharedFilterValueOptionsSource(
    values:
      | GridFilterOptionValue[]
      | Promise<GridFilterOptionValue[]>
      | { subscribe?: unknown }
      | null
      | undefined
  ): Promise<GridFilterOptionValue[]> {
    if (!values) {
      return [];
    }

    if (Array.isArray(values)) {
      return values;
    }

    if (isObservable(values)) {
      return (
        (await firstValueFrom(values as import('rxjs').Observable<GridFilterOptionValue[]>)) ?? []
      );
    }

    return await Promise.resolve(values as Promise<GridFilterOptionValue[]>);
  }
}
