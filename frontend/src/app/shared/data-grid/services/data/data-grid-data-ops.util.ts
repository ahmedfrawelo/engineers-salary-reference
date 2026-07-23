import { FilterOperator, FilterState, GridColumn, SortState } from '../../models';

export const getNestedValue = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((current, prop) => {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    return (current as Record<string, unknown>)[prop];
  }, obj);

export const compareValues = (a: unknown, b: unknown): number => {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;

  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() - b.getTime();
  }

  const aStr = String(a).toLowerCase();
  const bStr = String(b).toLowerCase();
  return aStr.localeCompare(bStr, 'ar');
};

export const matchesFilter = (
  value: unknown,
  filterValue: unknown,
  operator: FilterOperator,
  filterType: string
): boolean => {
  const isEmpty = value === null || value === undefined || value === '';

  if (operator === 'isEmpty') {
    return isEmpty;
  }

  if (operator === 'notEmpty') {
    return !isEmpty;
  }

  if (filterValue === null || filterValue === undefined || filterValue === '') {
    return true;
  }

  if (isEmpty) {
    return false;
  }

  const valueStr = String(value).toLowerCase();
  const filterStr = String(filterValue).toLowerCase();

  switch (operator) {
    case 'equals':
      return filterType === 'number'
        ? Number(value) === Number(filterValue)
        : valueStr === filterStr;
    case 'notEquals':
      return filterType === 'number'
        ? Number(value) !== Number(filterValue)
        : valueStr !== filterStr;
    case 'contains':
      return valueStr.includes(filterStr);
    case 'notContains':
      return !valueStr.includes(filterStr);
    case 'startsWith':
      return valueStr.startsWith(filterStr);
    case 'endsWith':
      return valueStr.endsWith(filterStr);
    case 'greaterThan':
      return Number(value) > Number(filterValue);
    case 'lessThan':
      return Number(value) < Number(filterValue);
    case 'greaterThanOrEqual':
      return Number(value) >= Number(filterValue);
    case 'lessThanOrEqual':
      return Number(value) <= Number(filterValue);
    case 'in':
      if (!Array.isArray(filterValue)) return false;
      if (filterType === 'number') {
        const numeric = Number(value);
        return Number.isFinite(numeric) && filterValue.some(item => Number(item) === numeric);
      }
      return filterValue.includes(value);
    case 'notIn':
      if (!Array.isArray(filterValue)) return false;
      if (filterType === 'number') {
        const numeric = Number(value);
        return !Number.isFinite(numeric) || filterValue.every(item => Number(item) !== numeric);
      }
      return !filterValue.includes(value);
    case 'menuSearch':
      return true;
    default:
      return true;
  }
};

export const matchesFieldFilters = (
  value: unknown,
  fieldFilters: FilterState[],
  filterType: string
): boolean => {
  if (fieldFilters.length === 0) {
    return true;
  }
  return fieldFilters.every(filter =>
    matchesFilter(value, filter.value, filter.operator || 'contains', filterType)
  );
};

export const normalizeNumericValue = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const sanitized = value.replace(/,/g, '').trim();
    if (!sanitized) {
      return null;
    }
    const parsed = Number(sanitized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const getVisibleRange = (
  scrollTop: number,
  containerHeight: number,
  rowHeight: number,
  totalRows: number
): { start: number; end: number } => {
  const start = Math.floor(scrollTop / rowHeight);
  const visibleRows = Math.ceil(containerHeight / rowHeight);
  const end = Math.min(start + visibleRows + 5, totalRows);

  return { start: Math.max(0, start - 5), end };
};

export const calculateColumnWidth = (
  headerText: string,
  data: unknown[],
  field: string,
  minWidth = 100,
  maxWidth = 500
): number => {
  const headerWidth = headerText.length * 10 + 40;
  const sampleSize = Math.min(data.length, 100);
  const contentWidths = data.slice(0, sampleSize).map(row => {
    const value = getNestedValue(row, field);
    return String(value || '').length * 8 + 20;
  });

  const maxContentWidth = Math.max(...contentWidths, 0);
  return Math.max(minWidth, Math.min(Math.max(headerWidth, maxContentWidth), maxWidth));
};

export const validateCellValue = (value: unknown, column: GridColumn): boolean | string => {
  if (column.validator) {
    return column.validator(value, {} as Record<string, unknown>);
  }

  switch (column.type) {
    case 'number':
      if (isNaN(Number(value))) {
        return 'Invalid number';
      }
      break;
    case 'date':
      if (isNaN(Date.parse(String(value ?? '')))) {
        return 'Invalid date';
      }
      break;
    case 'boolean':
      if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
        return 'Invalid boolean value';
      }
      break;
  }

  return true;
};

export const serializeCacheValue = (value: unknown): string => {
  if (value === undefined) {
    return '__undefined__';
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export const getDataFingerprint = <T>(data: T[]): string => {
  if (data.length === 0) {
    return '0';
  }

  const first = serializeCacheValue(data[0]).slice(0, 120);
  const last = serializeCacheValue(data[data.length - 1]).slice(0, 120);
  return `${data.length}-${first}-${last}`;
};

export const getSortCacheKey = <T>(data: T[], sorts: SortState[]): string => {
  const dataHash = getDataFingerprint(data);
  const sortHash = sorts.map(s => `${s.field}-${s.direction}`).join('|');
  return `sort:${dataHash}:${sortHash}`;
};

export const getFilterCacheKey = <T>(data: T[], filters: FilterState[]): string => {
  const dataHash = getDataFingerprint(data);
  const filterHash = filters
    .map(f => `${f.field}-${f.operator}-${serializeCacheValue(f.value)}`)
    .join('|');
  return `filter:${dataHash}:${filterHash}`;
};

export const setCacheItem = <T>(
  cache: Map<string, unknown[]>,
  key: string,
  value: T[],
  cacheSizeLimit: number
): void => {
  if (cache.size >= cacheSizeLimit) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) {
      cache.delete(firstKey);
    }
  }
  cache.set(key, value);
};
