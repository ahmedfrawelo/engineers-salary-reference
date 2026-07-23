type SettingIdentity = {
  id?: unknown;
  name?: string | null;
  customLabel?: string | null;
};

export type TenderSettingsConflict = {
  field: 'name' | 'customLabel';
  message: string;
};

function normalizeLookupText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function comparableId(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `n:${value}`;
  }
  const text = String(value).trim();
  if (!text) return '';
  const parsed = Number(text);
  if (Number.isFinite(parsed)) {
    return `n:${parsed}`;
  }
  return `s:${text}`;
}

function sameItem(left: unknown, right: unknown): boolean {
  const a = comparableId(left);
  const b = comparableId(right);
  return !!a && a === b;
}

export function findTenderSettingsConflict(
  items: SettingIdentity[],
  draft: SettingIdentity
): TenderSettingsConflict | null {
  const draftName = normalizeLookupText(draft.name);
  const draftCustomLabel = normalizeLookupText(draft.customLabel);

  for (const item of items ?? []) {
    if (sameItem(item?.id, draft.id)) continue;

    const otherName = normalizeLookupText(item?.name);
    const otherCustomLabel = normalizeLookupText(item?.customLabel);

    if (draftName && otherName && draftName === otherName) {
      return { field: 'name', message: 'Name already exists' };
    }
    if (draftName && otherCustomLabel && draftName === otherCustomLabel) {
      return { field: 'name', message: 'Name conflicts with an existing custom label' };
    }
    if (!draftCustomLabel) continue;
    if (otherName && draftCustomLabel === otherName) {
      return { field: 'customLabel', message: 'Custom label conflicts with an existing name' };
    }
    if (otherCustomLabel && draftCustomLabel === otherCustomLabel) {
      return { field: 'customLabel', message: 'Custom label already exists' };
    }
  }

  return null;
}
