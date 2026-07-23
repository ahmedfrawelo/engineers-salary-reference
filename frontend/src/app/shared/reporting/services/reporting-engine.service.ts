import { Injectable } from '@angular/core';
import type {
  ReportingDataRow,
  ReportingQuery,
  ReportingQueryFilter,
  ReportingQueryResult,
  ReportingQuerySort,
  ReportingSummaryRequest,
  ReportingSummaryResult
} from '../models/reporting.models';

@Injectable({ providedIn: 'root' })
export class ReportingEngineService {
  query<T extends object>(rows: readonly T[], query: ReportingQuery): ReportingQueryResult<T> {
    return runReportingQuery(rows, query);
  }

  summarize<T extends object>(
    rows: readonly T[],
    request: ReportingSummaryRequest
  ): ReportingSummaryResult {
    return summarizeReportingRows(rows, request);
  }
}

export function runReportingQuery<T extends object>(
  rows: readonly T[],
  query: ReportingQuery
): ReportingQueryResult<T> {
  const activeFilters = (query.filters ?? []).filter(isActiveFilter);
  const search = query.search?.term.trim().toLowerCase() ?? '';

  const filtered = rows.filter(row => {
    if (search && !matchesSearch(row, query.search?.fields ?? [], search)) {
      return false;
    }
    return activeFilters.every(filter => matchesFilter(row, filter));
  });

  const sorted = query.sort ? sortReportingRows(filtered, query.sort) : [...filtered];

  return {
    rows: sorted,
    totalRows: rows.length,
    filteredRows: sorted.length,
    activeFilterCount: activeFilters.length + (search ? 1 : 0)
  };
}

export function summarizeReportingRows<T extends object>(
  rows: readonly T[],
  request: ReportingSummaryRequest
): ReportingSummaryResult {
  const counts: Record<string, Record<string, number>> = {};
  const sums: Record<string, number> = {};
  const averages: Record<string, number> = {};

  for (const field of request.countFields ?? []) {
    counts[field] = {};
  }
  for (const field of request.sumFields ?? []) {
    sums[field] = 0;
  }
  for (const field of request.averageFields ?? []) {
    sums[field] ??= 0;
    averages[field] = 0;
  }

  rows.forEach(row => {
    Object.keys(counts).forEach(field => {
      const key = String(readReportingValue(row, field) ?? 'Empty');
      counts[field][key] = (counts[field][key] ?? 0) + 1;
    });

    Object.keys(sums).forEach(field => {
      sums[field] += toNumber(readReportingValue(row, field));
    });
  });

  Object.keys(averages).forEach(field => {
    averages[field] = rows.length ? sums[field] / rows.length : 0;
  });

  return {
    totalRows: rows.length,
    counts,
    sums,
    averages
  };
}

export function readReportingValue(row: object, field: string): unknown {
  return field.split('.').reduce<unknown>((value, key) => {
    if (value == null || typeof value !== 'object') {
      return undefined;
    }
    return (value as ReportingDataRow)[key];
  }, row);
}

function matchesSearch(row: object, fields: string[], term: string): boolean {
  return fields.some(field =>
    String(readReportingValue(row, field) ?? '')
      .toLowerCase()
      .includes(term)
  );
}

function matchesFilter(row: object, filter: ReportingQueryFilter): boolean {
  const rawValue = readReportingValue(row, filter.field);

  switch (filter.operator) {
    case 'equals':
      return rawValue === filter.value;
    case 'in':
      return Array.isArray(filter.value) && filter.value.includes(rawValue);
    case 'contains':
      return String(rawValue ?? '')
        .toLowerCase()
        .includes(String(filter.value ?? '').toLowerCase());
    case 'gte':
      return compareFilterValues(rawValue, filter.value) >= 0;
    case 'lte':
      return compareFilterValues(rawValue, filter.value) <= 0;
    case 'between':
      return matchesBetween(rawValue, filter.value);
    case 'truthy':
      return Boolean(rawValue);
    case 'falsy':
      return !rawValue;
    default:
      return true;
  }
}

function sortReportingRows<T extends object>(
  rows: readonly T[],
  sort: ReportingQuerySort
): T[] {
  const factor = sort.direction === 'asc' ? 1 : -1;
  const rank = new Map((sort.rankOrder ?? []).map((value, index) => [value, index]));

  return [...rows].sort((left, right) => {
    const leftValue = normalizeSortValue(readReportingValue(left, sort.field), sort, rank);
    const rightValue = normalizeSortValue(readReportingValue(right, sort.field), sort, rank);

    if (leftValue === rightValue) {
      return 0;
    }

    return leftValue > rightValue ? factor : -factor;
  });
}

function normalizeSortValue(
  value: unknown,
  sort: ReportingQuerySort,
  rank: Map<string, number>
): number | string {
  switch (sort.valueType) {
    case 'number':
      return toNumber(value);
    case 'date':
      return toDateValue(value);
    case 'rank':
      return rank.get(String(value)) ?? Number.MAX_SAFE_INTEGER;
    default:
      return String(value ?? '').toLowerCase();
  }
}

function compareFilterValues(left: unknown, right: unknown): number {
  const leftDate = toDateValue(left);
  const rightDate = toDateValue(right);
  if (leftDate || rightDate) {
    return leftDate - rightDate;
  }
  return toNumber(left) - toNumber(right);
}

function matchesBetween(value: unknown, range: unknown): boolean {
  if (!Array.isArray(range) || range.length !== 2) {
    return true;
  }
  return compareFilterValues(value, range[0]) >= 0 && compareFilterValues(value, range[1]) <= 0;
}

function isActiveFilter(filter: ReportingQueryFilter): boolean {
  if (filter.operator === 'truthy' || filter.operator === 'falsy') {
    return true;
  }
  if (Array.isArray(filter.value)) {
    return filter.value.length > 0;
  }
  return filter.value !== undefined && filter.value !== null && filter.value !== '';
}

function toNumber(value: unknown): number {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
}

function toDateValue(value: unknown): number {
  if (!value) {
    return 0;
  }
  const parsed = new Date(String(value)).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}
