import type { FilterOperator, FilterState, GridLooseValue, SortState } from '../../../models';

export function buildColumnFilterState(
  field: string,
  operator: FilterOperator,
  value: GridLooseValue
): FilterState {
  return { field, operator, value };
}

export function upsertColumnFilterState(
  states: readonly FilterState[],
  next: FilterState
): FilterState[] {
  return [...states.filter(state => state.field !== next.field), next];
}

export function removeColumnFilterState(
  states: readonly FilterState[],
  field: string
): FilterState[] {
  return states.filter(state => state.field !== field);
}

export function buildSingleColumnSortState(field: string, direction: 'asc' | 'desc'): SortState[] {
  return [{ field, direction, order: 0 }];
}
