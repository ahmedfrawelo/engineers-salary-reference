import { TenderRow } from './tender-project-details/project-details.component';

export function normalizeProjectApiDate(value?: string | null): string | null {
  if (!value) return null;
  const raw = String(value);
  if (raw.includes('T')) return raw;
  const match = raw.match(/\d{4}-\d{2}-\d{2}/);
  return match ? `${match[0]}T00:00:00` : null;
}

export function getProjectIdFromTenderRow(
  row: TenderRow | null | undefined,
  parseId: (value: unknown) => number | null
): number | null {
  if (!row) return null;
  const withProjectId = row as TenderRow & { projectId?: unknown };
  return parseId(withProjectId.projectId ?? row.id);
}

export function pickProjectIdFromValues(
  values: unknown[],
  parseId: (value: unknown) => number | null
): number | null {
  for (const value of values) {
    if (value == null) continue;
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const nested = parseId(record.id ?? record.ID ?? record.Id);
      if (nested) return nested;
    }
    const direct = parseId(value);
    if (direct) return direct;
  }
  return null;
}

export function pickProjectNameFromValues(
  values: unknown[],
  normalizeLabel: (value: unknown) => string | null
): string | null {
  for (const value of values) {
    if (value == null) continue;
    if (typeof value === 'string') {
      const label = normalizeLabel(value);
      if (label) return label;
      continue;
    }
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const label = normalizeLabel(
        record.name ?? record.Name ?? record.title ?? record.Title ?? record.label ?? record.Label
      );
      if (label) return label;
    }
  }
  return null;
}
