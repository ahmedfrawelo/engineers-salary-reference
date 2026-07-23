import type { IconSvgObject } from '@hugeicons/angular';
import type {
  FilterOperator,
  FilterType,
  GridColumn,
  GridDateGroupInterval
} from '@shared/data-grid';
import type {
  AssigneeFilterOption,
  AssigneeFilterSelection
} from '@shared/ui/assignee-filter-menu.component';
import type { MineQuickFilterOption } from '@shared/ui/mine-quick-filter-menu.component';

export type SharedGroupOrder = 'asc' | 'desc';
export type SharedFilterJoin = 'and' | 'or';
export type SharedGroupSelection = {
  value: string | null;
  order: SharedGroupOrder;
  dateInterval?: GridDateGroupInterval | null;
};

export type SharedFilterRow = {
  id: string;
  joinWithPrev: SharedFilterJoin;
  field: string;
  operator: FilterOperator;
  value: string;
};

export type SharedFilterGroup = {
  id: string;
  joinWithPrev: SharedFilterJoin;
  rows: SharedFilterRow[];
};

export type SharedGridColumn = GridColumn<unknown> & {
  groupable?: boolean;
  icon?: string;
  hugeIcon?: IconSvgObject;
  hugeIconSize?: string | number;
  hugeIconStrokeWidth?: number;
};

export type SharedFilterColumnOption = {
  field: string;
  label: string;
  icon: string;
  filterType: FilterType;
  column: SharedGridColumn;
};

export type SharedFilterState = {
  field: string;
  operator: FilterOperator;
  value: string;
  joinWithPrev?: SharedFilterJoin;
};

export type SharedFilterValueOption = {
  label: string;
  value: string;
};

export type SharedSavedFilterRowState = {
  field: string;
  operator: FilterOperator;
  value: string;
  joinWithPrev: SharedFilterJoin;
};

export type SharedSavedFilterGroupState = {
  joinWithPrev: SharedFilterJoin;
  rows: SharedSavedFilterRowState[];
};

export type SharedSavedFilterDefinition = {
  groups: SharedSavedFilterGroupState[];
};

export type SharedSavedFilterItem = {
  id: number;
  pageKey: string;
  name: string;
  definition: SharedSavedFilterDefinition;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type SharedPaginationState = Record<string, unknown> & {
  currentPage: number;
};

export type SharedToolbarActionTone = 'default' | 'primary' | 'accent' | 'danger';
export type SharedToolbarActionVariant = 'default' | 'pagePill' | 'softRect';

export type SharedToolbarAction = {
  id: string;
  label: string;
  icon?: string;
  hugeIcon?: IconSvgObject;
  hugeIconSize?: string | number;
  hugeIconStrokeWidth?: number;
  tone?: SharedToolbarActionTone;
  variant?: SharedToolbarActionVariant;
  className?: string;
  active?: boolean;
  disabled?: boolean;
  keepSurfacesOpen?: boolean;
  ariaLabel?: string;
};

export type SharedAssigneeFilterConfig = {
  triggerLabel?: string;
  title?: string;
  searchPlaceholder?: string;
  allLabel?: string;
  mineLabel?: string;
  unassignedLabel?: string;
  emptyLabel?: string;
  showMine?: boolean;
  allCount?: number;
  mineCount?: number;
  unassignedCount?: number;
  options: AssigneeFilterOption[];
  selection: AssigneeFilterSelection;
};

export type SharedMineQuickFilterConfig = {
  initials: string;
  tooltip?: string;
  title?: string;
  panelAriaLabel?: string;
  clearAriaLabel?: string;
  active: boolean;
  open: boolean;
  showClear: boolean;
  options: MineQuickFilterOption[];
};

export type SharedSignalState<T> = {
  (): T;
  set?: (value: T) => void;
  update?: (updater: (value: T) => T) => void;
};

export type SharedGridApi = {
  [key: string]: unknown;
  columns: SharedGridColumn[];
  data?: unknown[];
  cdr?: { markForCheck(): void };
  stateKey?: string;
  filterStates?: SharedSignalState<SharedFilterState[]>;
  paginationState?: SharedSignalState<SharedPaginationState>;
  groupColumns?: SharedSignalState<string[]>;
  groupDateIntervals?: SharedSignalState<Record<string, GridDateGroupInterval>>;
  expandedGroups?: SharedSignalState<Set<string>>;
  groupedBlocks?: SharedSignalState<Array<{ id: string }>>;
  displayRows?: SharedSignalState<Array<{ kind: string; id: string }>>;
  sortStates?: SharedSignalState<
    Array<{ field: string; direction: 'asc' | 'desc'; order: number }>
  >;
  toggleSnapshotManager?(): void;
  toggleColumnVisibility?(column: SharedGridColumn): void;
  toggleColumnVisibilityFromMenu?(column: SharedGridColumn): void;
  showAllColumnsFromMenu?(): void;
  hideAllColumnsFromMenu?(): void;
  resetColumns?(): void;
  clearAllFilters?(): void;
  applyExternalFilters?(filters: SharedFilterState[]): void;
  getColumnField?(column: SharedGridColumn): string;
  removeGroupColumn?(field: string): void;
  clearAllGrouping?(): void;
  clearSortForColumn?(column: SharedGridColumn): void;
  applyGroupingState?(
    column: SharedGridColumn | null,
    direction?: SharedGroupOrder,
    dateInterval?: GridDateGroupInterval | null
  ): void;
  groupByColumn?(column: SharedGridColumn): void;
  setGroupDateInterval?(field: string, interval: GridDateGroupInterval | null): void;
  sortColumnDesc?(column: SharedGridColumn): void;
  sortColumnAsc?(column: SharedGridColumn): void;
  isGroupExpandedById?(id: string): boolean;
  expandAllGroups?(): void;
  collapseAllGroups?(): void;
  invalidateFilteredSortedCache?(): void;
  syncAggregateDisplayState?(): void;
};

export const SHARED_FILTER_OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: 'is',
  notEquals: 'is not',
  contains: 'contains',
  notContains: 'does not contain',
  startsWith: 'starts with',
  endsWith: 'ends with',
  greaterThan: 'is greater than',
  lessThan: 'is less than',
  greaterThanOrEqual: 'is greater or equal',
  lessThanOrEqual: 'is less or equal',
  between: 'between',
  in: 'is one of',
  notIn: 'is not one of',
  isEmpty: 'is empty',
  notEmpty: 'is not empty',
  menuSearch: 'menu search',
  globalSearch: 'search'
};

export const SHARED_FILTER_OPERATORS_BY_TYPE: Record<FilterType, FilterOperator[]> = {
  text: [
    'contains',
    'notContains',
    'equals',
    'notEquals',
    'startsWith',
    'endsWith',
    'isEmpty',
    'notEmpty'
  ],
  number: [
    'equals',
    'notEquals',
    'greaterThan',
    'greaterThanOrEqual',
    'lessThan',
    'lessThanOrEqual',
    'isEmpty',
    'notEmpty'
  ],
  date: [
    'equals',
    'notEquals',
    'greaterThan',
    'greaterThanOrEqual',
    'lessThan',
    'lessThanOrEqual',
    'isEmpty',
    'notEmpty'
  ],
  select: ['equals', 'notEquals', 'isEmpty', 'notEmpty'],
  multiSelect: ['contains', 'notContains', 'isEmpty', 'notEmpty'],
  boolean: ['equals', 'notEquals', 'isEmpty', 'notEmpty']
};

export const SHARED_OPERATORS_WITHOUT_VALUE = new Set<FilterOperator>(['isEmpty', 'notEmpty']);
