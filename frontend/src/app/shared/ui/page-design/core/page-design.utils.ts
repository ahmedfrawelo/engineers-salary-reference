import type { FilterType } from '@shared/data-grid';
import type { SharedFilterRow, SharedGridApi, SharedGridColumn } from '../models';

export function getGridColumnField(grid: SharedGridApi | null, column: SharedGridColumn): string {
  if (grid && typeof grid.getColumnField === 'function') {
    const value = grid.getColumnField(column);
    return typeof value === 'string' ? value : '';
  }
  const raw = column?.field;
  return typeof raw === 'string' ? raw : '';
}

export function readSharedGridSignal<T>(grid: SharedGridApi | null, key: string, fallback: T): T {
  const signalLike = grid?.[key];
  return typeof signalLike === 'function' ? (signalLike() as T) : fallback;
}

export function buildSharedFilterRow(id: string): SharedFilterRow {
  return { id, joinWithPrev: 'and', field: '', operator: 'contains', value: '' };
}

export function resolveSharedFilterType(column: SharedGridColumn): FilterType {
  if (column.filterType) return column.filterType;
  switch (column.type) {
    case 'number':
      return 'number';
    case 'date':
      return 'date';
    case 'boolean':
      return 'boolean';
    case 'dropdown':
      return 'select';
    default:
      break;
  }

  const field = String(column?.field ?? '')
    .trim()
    .toLowerCase();
  const header = String(column?.header ?? '')
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

export function resolveSharedColumnIcon(fieldValue: string, filterType: FilterType): string {
  const field = fieldValue.toLowerCase();
  if (field.includes('date') || filterType === 'date') return 'calendar3';
  if (field.includes('price') || filterType === 'number') return '123';
  if (field.includes('owner')) return 'building';
  if (field.includes('country')) return 'geo-alt';
  if (field.includes('assign')) return 'person';
  if (field.includes('stage')) return 'diagram-3';
  if (field.includes('type')) return 'tag';
  return 'layout-three-columns';
}

export function filterSharedColumnsByVisibility(
  columns: SharedGridColumn[],
  hidden: boolean,
  searchTerm: string,
  getField: (column: SharedGridColumn) => string,
  getLabel: (column: SharedGridColumn) => string
): SharedGridColumn[] {
  const term = searchTerm.trim().toLowerCase();
  return columns.filter(column => {
    if (!column || typeof column !== 'object') return false;
    const field = getField(column);
    if (!field || field === '__selection__') return false;
    if (!!column.hidden !== hidden) return false;
    if (!term) return true;
    const label = getLabel(column).toLowerCase();
    return label.includes(term) || field.toLowerCase().includes(term);
  });
}

export function collectSharedDistinctValuesFromRows(
  data: unknown[] | undefined,
  field: string,
  limit: number
): string[] {
  const rows = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];
  const seen = new Set<string>();
  const values: string[] = [];

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const raw = row[field];
    if (raw == null || raw === '') continue;
    if (Array.isArray(raw)) {
      for (const item of raw) {
        const next = String(item ?? '').trim();
        if (!next || seen.has(next)) continue;
        seen.add(next);
        values.push(next);
        if (values.length >= limit) return values.sort((a, b) => a.localeCompare(b));
      }
      continue;
    }
    const next = String(raw).trim();
    if (!next || seen.has(next)) continue;
    seen.add(next);
    values.push(next);
    if (values.length >= limit) break;
  }

  return values.sort((a, b) => a.localeCompare(b));
}
