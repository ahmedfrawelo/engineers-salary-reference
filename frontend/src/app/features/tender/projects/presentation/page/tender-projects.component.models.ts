import { GridColumn } from '@shared/data-grid';
import { TenderRow } from './tender-project-details/project-details.component';

export type ProjectsGroupOptionValue =
  | 'none'
  | 'title'
  | 'owner'
  | 'ownerType'
  | 'deadline'
  | 'startDate'
  | 'endDate'
  | 'type'
  | 'stage'
  | 'price'
  | 'assignTo'
  | 'acceptDate'
  | 'status'
  | 'consultant'
  | 'prb'
  | 'importance'
  | 'country'
  | 'inCharge'
  | 'delayReasons';

export type ProjectsGroupOrder = 'asc' | 'desc';

export type ProjectFilterJoin = 'and' | 'or';
export type ProjectFilterType = 'text' | 'number' | 'date' | 'select' | 'boolean';
export type ProjectFilterOperator =
  | 'contains'
  | 'notContains'
  | 'equals'
  | 'notEquals'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'isEmpty'
  | 'notEmpty';

export type ProjectFilterOperatorOption = { value: ProjectFilterOperator; label: string };
export type ProjectFilterColumnOption = {
  field: string;
  label: string;
  icon: string;
  filterType: ProjectFilterType;
};
export type ProjectToolbarFilter = {
  id: string;
  joinWithPrev: ProjectFilterJoin;
  field: string;
  operator: ProjectFilterOperator;
  value: string;
};

type ProjectsGroupOption = {
  value: ProjectsGroupOptionValue;
  label: string;
  icon: string;
};

export const PROJECTS_GROUP_OPTIONS: ProjectsGroupOption[] = [
  { value: 'none', label: 'None', icon: 'slash-circle' },
  { value: 'title', label: 'Project Title', icon: 'file-earmark-text' },
  { value: 'owner', label: 'Owner', icon: 'building' },
  { value: 'ownerType', label: 'Owner Type', icon: 'briefcase' },
  { value: 'deadline', label: 'Due date', icon: 'calendar3' },
  { value: 'startDate', label: 'Start Date', icon: 'calendar-event' },
  { value: 'endDate', label: 'End Date', icon: 'calendar2-check' },
  { value: 'type', label: 'Type', icon: 'tag' },
  { value: 'stage', label: 'Stage', icon: 'diagram-3' },
  { value: 'price', label: 'Price', icon: 'cash-stack' },
  { value: 'assignTo', label: 'Assign To', icon: 'person' },
  { value: 'acceptDate', label: 'AcceptDate', icon: 'calendar-check' },
  { value: 'status', label: 'Status', icon: 'record-circle' },
  { value: 'consultant', label: 'Consultant', icon: 'people' },
  { value: 'prb', label: 'Project Repeatability Percent', icon: '123' },
  { value: 'importance', label: 'Importance', icon: 'exclamation-circle' },
  { value: 'country', label: 'Country', icon: 'geo-alt' },
  { value: 'inCharge', label: 'In Charge', icon: 'person-badge' },
  { value: 'delayReasons', label: 'Delay Reason', icon: 'card-text' }
];

export const PROJECT_GROUP_ORDER_OPTIONS: ReadonlyArray<{
  value: ProjectsGroupOrder;
  label: string;
}> = [
  { value: 'asc', label: 'Ascending' },
  { value: 'desc', label: 'Descending' }
];

export const PROJECT_FILTER_OPERATOR_LABELS: Record<ProjectFilterOperator, string> = {
  contains: 'contains',
  notContains: 'does not contain',
  equals: 'is',
  notEquals: 'is not',
  startsWith: 'starts with',
  endsWith: 'ends with',
  greaterThan: 'is greater than',
  greaterThanOrEqual: 'is greater or equal',
  lessThan: 'is less than',
  lessThanOrEqual: 'is less or equal',
  isEmpty: 'is empty',
  notEmpty: 'is not empty'
};

export const PROJECT_FILTER_OPERATORS_BY_TYPE: Record<ProjectFilterType, ProjectFilterOperator[]> =
  {
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
    boolean: ['equals', 'notEquals', 'isEmpty', 'notEmpty']
  };

export const PROJECT_FILTER_OPERATORS_WITHOUT_VALUE = new Set<ProjectFilterOperator>([
  'isEmpty',
  'notEmpty'
]);

export const PROJECT_FILTER_SELECT_LIKE_FIELDS = new Set([
  'owner',
  'ownertype',
  'top',
  'ts',
  'assignto',
  'status',
  'prb',
  'doi',
  'country',
  'incharge'
]);

export const PROJECT_COLUMN_ICON_MAP: Record<string, string> = {
  title: 'file-earmark-text',
  owner: 'building',
  ownerType: 'briefcase',
  deadline: 'calendar3',
  startDate: 'calendar-event',
  endDate: 'calendar2-check',
  top: 'tag',
  ts: 'diagram-3',
  price: 'cash-stack',
  assignTo: 'person',
  acceptDate: 'calendar-check',
  status: 'record-circle',
  consultant: 'people',
  prb: '123',
  doi: 'exclamation-circle',
  country: 'geo-alt',
  inCharge: 'person-badge',
  delayReasons: 'card-text'
};

export function normalizeProjectToolbarFilters(
  filters: readonly ProjectToolbarFilter[]
): ProjectToolbarFilter[] {
  return filters.map((filter, index) => ({
    ...filter,
    joinWithPrev: index === 0 ? 'and' : filter.joinWithPrev
  }));
}

export function getValidProjectToolbarFilters(
  filters: readonly ProjectToolbarFilter[]
): ProjectToolbarFilter[] {
  return filters.filter(filter => {
    const field = filter.field.trim();
    if (!field) {
      return false;
    }
    if (PROJECT_FILTER_OPERATORS_WITHOUT_VALUE.has(filter.operator)) {
      return true;
    }
    return filter.value.trim().length > 0;
  });
}

export function resolveProjectFilterType(column: GridColumn<TenderRow>): ProjectFilterType {
  const filterType = String(column.filterType ?? '').toLowerCase();
  if (filterType === 'number') return 'number';
  if (filterType === 'date') return 'date';
  if (filterType === 'select' || filterType === 'multiselect') return 'select';
  if (filterType === 'boolean') return 'boolean';

  const columnType = String(column.type ?? '').toLowerCase();
  if (columnType === 'number') return 'number';
  if (columnType === 'date') return 'date';
  if (columnType === 'dropdown') return 'select';
  if (columnType === 'boolean') return 'boolean';

  const field = String(column.field ?? '')
    .trim()
    .toLowerCase();
  const header = String(column.header ?? '')
    .trim()
    .toLowerCase();
  if (
    field.includes('date') ||
    field.includes('deadline') ||
    field.includes('due') ||
    header.includes('date') ||
    header.includes('deadline') ||
    header.includes('due')
  ) {
    return 'date';
  }

  return 'text';
}

export function getProjectFilterOperatorsForType(
  filterType: ProjectFilterType
): ProjectFilterOperator[] {
  return PROJECT_FILTER_OPERATORS_BY_TYPE[filterType] ?? PROJECT_FILTER_OPERATORS_BY_TYPE.text;
}

export function isProjectFilterJoin(value: string): value is ProjectFilterJoin {
  return value === 'and' || value === 'or';
}

export function isProjectFilterOperator(value: string): value is ProjectFilterOperator {
  return Object.prototype.hasOwnProperty.call(PROJECT_FILTER_OPERATOR_LABELS, value);
}

export function applyProjectToolbarFilters(
  source: readonly TenderRow[],
  filters: readonly ProjectToolbarFilter[],
  resolveFieldType: (field: string) => ProjectFilterType
): TenderRow[] {
  if (!filters.length) {
    return [...source];
  }

  return source.filter(rawRow =>
    rowMatchesProjectToolbarFilters(rawRow as Record<string, unknown>, filters, resolveFieldType)
  );
}

export function isProjectFilterValueEmpty(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim().length === 0;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return false;
}

export function parseProjectFilterDate(value: unknown): number | null {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) return null;
    return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  }

  const raw = String(value ?? '').trim();
  if (!raw) {
    return null;
  }

  const dmy = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const yearRaw = Number(dmy[3]);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
      return date.setHours(0, 0, 0, 0);
    }
  }

  const ymd = raw.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})$/);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
      return date.setHours(0, 0, 0, 0);
    }
  }

  const timestamp = Date.parse(raw);
  if (!Number.isFinite(timestamp)) {
    return null;
  }
  const parsed = new Date(timestamp);
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
}

export function formatProjectFilterDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function rowMatchesProjectToolbarFilters(
  row: Record<string, unknown>,
  filters: readonly ProjectToolbarFilter[],
  resolveFieldType: (field: string) => ProjectFilterType
): boolean {
  if (!filters.length) {
    return true;
  }

  let result = rowMatchesProjectToolbarFilter(row, filters[0], resolveFieldType);
  for (let i = 1; i < filters.length; i += 1) {
    const filter = filters[i];
    const currentMatch = rowMatchesProjectToolbarFilter(row, filter, resolveFieldType);
    result = filter.joinWithPrev === 'or' ? result || currentMatch : result && currentMatch;
  }
  return result;
}

function rowMatchesProjectToolbarFilter(
  row: Record<string, unknown>,
  filter: ProjectToolbarFilter,
  resolveFieldType: (field: string) => ProjectFilterType
): boolean {
  const field = filter.field.trim();
  if (!field) {
    return true;
  }

  const rawValue = row?.[field];
  const operator = filter.operator;
  const isEmpty = isProjectFilterValueEmpty(rawValue);

  if (operator === 'isEmpty') return isEmpty;
  if (operator === 'notEmpty') return !isEmpty;
  if (isEmpty) return false;

  const filterValue = filter.value.trim();
  if (!filterValue) {
    return true;
  }

  return evaluateProjectToolbarFilterValue(
    rawValue,
    filterValue,
    operator,
    resolveFieldType(field)
  );
}

function evaluateProjectToolbarFilterValue(
  rawValue: unknown,
  filterValue: string,
  operator: ProjectFilterOperator,
  filterType: ProjectFilterType
): boolean {
  const valueText = normalizeProjectFilterTextValue(rawValue);
  const filterText = normalizeProjectFilterTextValue(filterValue);

  if (filterType === 'number') {
    const left = parseProjectFilterNumber(rawValue);
    const right = parseProjectFilterNumber(filterValue);
    if (left !== null && right !== null) {
      switch (operator) {
        case 'equals':
          return left === right;
        case 'notEquals':
          return left !== right;
        case 'greaterThan':
          return left > right;
        case 'greaterThanOrEqual':
          return left >= right;
        case 'lessThan':
          return left < right;
        case 'lessThanOrEqual':
          return left <= right;
        default:
          break;
      }
    }
  }

  if (filterType === 'date') {
    const left = parseProjectFilterDate(rawValue);
    const right = parseProjectFilterDate(filterValue);
    if (left !== null && right !== null) {
      switch (operator) {
        case 'equals':
          return left === right;
        case 'notEquals':
          return left !== right;
        case 'greaterThan':
          return left > right;
        case 'greaterThanOrEqual':
          return left >= right;
        case 'lessThan':
          return left < right;
        case 'lessThanOrEqual':
          return left <= right;
        default:
          break;
      }
    }
  }

  switch (operator) {
    case 'equals':
      return valueText === filterText;
    case 'notEquals':
      return valueText !== filterText;
    case 'contains':
      return valueText.includes(filterText);
    case 'notContains':
      return !valueText.includes(filterText);
    case 'startsWith':
      return valueText.startsWith(filterText);
    case 'endsWith':
      return valueText.endsWith(filterText);
    case 'greaterThan':
      return valueText.localeCompare(filterText, 'en', { sensitivity: 'base' }) > 0;
    case 'greaterThanOrEqual':
      return valueText.localeCompare(filterText, 'en', { sensitivity: 'base' }) >= 0;
    case 'lessThan':
      return valueText.localeCompare(filterText, 'en', { sensitivity: 'base' }) < 0;
    case 'lessThanOrEqual':
      return valueText.localeCompare(filterText, 'en', { sensitivity: 'base' }) <= 0;
    case 'isEmpty':
      return isProjectFilterValueEmpty(rawValue);
    case 'notEmpty':
      return !isProjectFilterValueEmpty(rawValue);
    default:
      return true;
  }
}

function normalizeProjectFilterTextValue(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function parseProjectFilterNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const normalized = String(value ?? '')
    .trim()
    .replace(/,/g, '');
  if (!normalized) {
    return null;
  }
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}
