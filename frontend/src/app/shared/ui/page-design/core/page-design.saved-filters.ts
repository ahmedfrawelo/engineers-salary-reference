import type { FilterOperator } from '@shared/data-grid';
import type {
  SharedFilterGroup,
  SharedFilterJoin,
  SharedFilterRow,
  SharedSavedFilterDefinition,
  SharedSavedFilterGroupState,
  SharedSavedFilterRowState
} from '../models';

type SerializeOptions = {
  isFilterComplete(filter: SharedFilterRow): boolean;
  operatorNeedsNoValue(operator: FilterOperator): boolean;
};

type RestoreOptions = {
  createFilterRow(): SharedFilterRow;
  createFilterGroup(rows: SharedFilterRow[]): SharedFilterGroup;
};

const normalizeJoin = (value?: SharedFilterJoin | string | null): SharedFilterJoin =>
  value === 'or' ? 'or' : 'and';

const normalizeText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : String(value ?? '').trim();

const normalizeOperator = (value: unknown): FilterOperator =>
  (normalizeText(value) || 'contains') as FilterOperator;

function normalizeDefinitionGroups(
  groups: SharedSavedFilterGroupState[] | null | undefined
): SharedSavedFilterGroupState[] {
  const normalizedGroups: SharedSavedFilterGroupState[] = [];

  for (const rawGroup of groups ?? []) {
    const normalizedRows: SharedSavedFilterRowState[] = [];

    for (const rawRow of rawGroup?.rows ?? []) {
      const field = normalizeText(rawRow?.field);
      const operator = normalizeOperator(rawRow?.operator);
      if (!field || !operator) {
        continue;
      }

      normalizedRows.push({
        field,
        operator,
        value: normalizeText(rawRow?.value),
        joinWithPrev: normalizeJoin(rawRow?.joinWithPrev)
      });
    }

    if (!normalizedRows.length) {
      continue;
    }

    normalizedGroups.push({
      joinWithPrev: normalizeJoin(rawGroup?.joinWithPrev),
      rows: normalizedRows.map((row, index) => ({
        ...row,
        joinWithPrev: normalizeJoin(index === 0 ? 'and' : row.joinWithPrev)
      }))
    });
  }

  return normalizedGroups.map((group, index) => ({
    ...group,
    joinWithPrev: normalizeJoin(index === 0 ? 'and' : group.joinWithPrev)
  }));
}

export function normalizeSharedSavedFilterDefinition(
  definition: SharedSavedFilterDefinition | null | undefined
): SharedSavedFilterDefinition | null {
  const groups = normalizeDefinitionGroups(definition?.groups);
  return groups.length ? { groups } : null;
}

export function serializeSharedSavedFilterDefinition(
  groups: SharedFilterGroup[],
  options: SerializeOptions
): SharedSavedFilterDefinition | null {
  const serializedGroups: SharedSavedFilterGroupState[] = [];

  groups.forEach((group, groupIndex) => {
    const rows = (group?.rows ?? [])
      .filter(filter => options.isFilterComplete(filter))
      .map((filter, rowIndex) => ({
        field: normalizeText(filter.field),
        operator: normalizeOperator(filter.operator),
        value: options.operatorNeedsNoValue(filter.operator) ? '' : normalizeText(filter.value),
        joinWithPrev: normalizeJoin(rowIndex === 0 ? 'and' : filter.joinWithPrev)
      }))
      .filter(row => !!row.field);

    if (!rows.length) {
      return;
    }

    serializedGroups.push({
      joinWithPrev: normalizeJoin(groupIndex === 0 ? 'and' : group?.joinWithPrev),
      rows
    });
  });

  return normalizeSharedSavedFilterDefinition({ groups: serializedGroups });
}

export function restoreSharedSavedFilterGroups(
  definition: SharedSavedFilterDefinition | null | undefined,
  options: RestoreOptions
): SharedFilterGroup[] {
  const normalized = normalizeSharedSavedFilterDefinition(definition);
  if (!normalized) {
    return [];
  }

  return normalized.groups.map((groupState, groupIndex) => {
    const rows = groupState.rows.map((rowState, rowIndex) => {
      const row = options.createFilterRow();
      row.field = rowState.field;
      row.operator = normalizeOperator(rowState.operator);
      row.value = rowState.value;
      row.joinWithPrev = normalizeJoin(rowIndex === 0 ? 'and' : rowState.joinWithPrev);
      return row;
    });

    const group = options.createFilterGroup(rows);
    group.joinWithPrev = normalizeJoin(groupIndex === 0 ? 'and' : groupState.joinWithPrev);
    group.rows = rows;
    return group;
  });
}

export function buildSharedSavedFilterComparableKey(
  definition: SharedSavedFilterDefinition | null | undefined
): string {
  const normalized = normalizeSharedSavedFilterDefinition(definition);
  return normalized ? JSON.stringify(normalized) : '';
}
