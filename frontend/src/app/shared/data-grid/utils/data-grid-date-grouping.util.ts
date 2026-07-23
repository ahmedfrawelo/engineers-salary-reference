import type { ColumnType, GridDateGroupInterval } from '../models';

export type GridDateGroupValue = {
  key: string;
  value: string;
};

type GridDateGroupColumnLike = {
  field?: unknown;
  header?: unknown;
  type?: ColumnType;
  filterType?: string;
  cellType?: string;
  groupDateIntervals?: readonly unknown[];
};

const DEFAULT_DATE_GROUP_INTERVALS: GridDateGroupInterval[] = [
  'day',
  'week',
  'month',
  'quarter',
  'year'
];

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

export function normalizeGridDateGroupInterval(interval: unknown): GridDateGroupInterval | null {
  return interval === 'day' ||
    interval === 'week' ||
    interval === 'month' ||
    interval === 'quarter' ||
    interval === 'year'
    ? interval
    : null;
}

export function getGridDateGroupIntervals(
  column: GridDateGroupColumnLike | null | undefined
): GridDateGroupInterval[] {
  if (!isGridDateGroupColumn(column)) {
    return [];
  }

  const configured = Array.isArray(column?.groupDateIntervals)
    ? column.groupDateIntervals
        .map(normalizeGridDateGroupInterval)
        .filter((value): value is GridDateGroupInterval => !!value)
    : [];

  return configured.length ? [...new Set(configured)] : DEFAULT_DATE_GROUP_INTERVALS;
}

export function resolveGridDateGroupInterval(
  column: GridDateGroupColumnLike | null | undefined,
  requested: unknown
): GridDateGroupInterval | null {
  const intervals = getGridDateGroupIntervals(column);
  if (!intervals.length) {
    return null;
  }
  const normalized = normalizeGridDateGroupInterval(requested);
  return normalized && intervals.includes(normalized) ? normalized : intervals[0];
}

export function isGridDateGroupColumn(column: GridDateGroupColumnLike | null | undefined): boolean {
  if (!column) {
    return false;
  }
  if (column.type === 'date' || column.filterType === 'date' || column.cellType === 'date') {
    return true;
  }

  const field = String(column.field ?? '').toLowerCase();
  const header = String(column.header ?? '').toLowerCase();
  return (
    field.includes('date') ||
    field.includes('deadline') ||
    field.includes('due') ||
    header.includes('date') ||
    header.includes('deadline') ||
    header.includes('due')
  );
}

export function buildGridDateGroupValue(
  rawValue: unknown,
  interval: GridDateGroupInterval
): GridDateGroupValue | null {
  const date = parseGridDate(rawValue);
  if (!date) {
    return null;
  }

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  switch (interval) {
    case 'day':
      return {
        key: `${year}-${pad2(month)}-${pad2(day)}`,
        value: `${MONTH_NAMES[month - 1]} ${day}, ${year}`
      };
    case 'week': {
      const week = getIsoWeek(date);
      return {
        key: `${week.year}-W${pad2(week.week)}`,
        value: `Week ${week.week}, ${week.year}`
      };
    }
    case 'month':
      return {
        key: `${year}-${pad2(month)}`,
        value: `${MONTH_NAMES[month - 1]} ${year}`
      };
    case 'quarter': {
      const quarter = Math.floor((month - 1) / 3) + 1;
      return {
        key: `${year}-Q${quarter}`,
        value: `Q${quarter} ${year}`
      };
    }
    case 'year':
      return {
        key: String(year),
        value: String(year)
      };
    default:
      return null;
  }
}

function parseGridDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnly) {
    const date = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getIsoWeek(date: Date): { year: number; week: number } {
  const normalized = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = normalized.getUTCDay() || 7;
  normalized.setUTCDate(normalized.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(normalized.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((normalized.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: normalized.getUTCFullYear(), week };
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}
