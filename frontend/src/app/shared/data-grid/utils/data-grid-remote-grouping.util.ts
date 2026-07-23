import type { GridDateGroupInterval, GridState, SortState } from '../models';

export type RemoteGroupingParams = {
  groupBy?: string;
  groupDirection?: 'asc' | 'desc';
  groupDateInterval?: GridDateGroupInterval;
};

function normalizeGroupedField(
  groupColumns: readonly string[] | null | undefined
): string | undefined {
  if (!Array.isArray(groupColumns) || groupColumns.length === 0) {
    return undefined;
  }

  const field = groupColumns.find(
    (value): value is string => typeof value === 'string' && value.trim().length > 0
  );
  const normalized = field?.trim();
  return normalized || undefined;
}

function resolveGroupedDirection(
  field: string,
  sorts: readonly SortState[] | null | undefined
): 'asc' | 'desc' {
  if (!Array.isArray(sorts) || sorts.length === 0) {
    return 'asc';
  }

  const matchingSort = sorts.find(
    sort =>
      typeof sort?.field === 'string' &&
      sort.field.trim() === field &&
      (sort.direction === 'asc' || sort.direction === 'desc')
  );

  return matchingSort?.direction === 'desc' ? 'desc' : 'asc';
}

export function resolvePersistedGridRemoteGrouping(
  storage: Pick<Storage, 'getItem'> | null | undefined,
  stateKey: string | null | undefined
): RemoteGroupingParams {
  const normalizedStateKey = String(stateKey ?? '').trim();
  if (!storage || !normalizedStateKey) {
    return {};
  }

  try {
    const rawState = storage.getItem(`grid-state-${normalizedStateKey}`);
    if (!rawState) {
      return {};
    }

    const parsedState = JSON.parse(rawState) as Partial<GridState>;
    const groupBy = normalizeGroupedField(parsedState.groupColumns);
    if (!groupBy) {
      return {};
    }

    return {
      groupBy,
      groupDirection: resolveGroupedDirection(groupBy, parsedState.sorts),
      ...(parsedState.groupDateIntervals?.[groupBy]
        ? { groupDateInterval: parsedState.groupDateIntervals[groupBy] }
        : {})
    };
  } catch {
    return {};
  }
}
