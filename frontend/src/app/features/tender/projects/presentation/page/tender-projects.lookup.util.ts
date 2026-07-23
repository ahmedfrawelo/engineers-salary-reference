import type { IdName } from './tender-projects.contracts';
import { parseProjectPositiveId } from './tender-projects.value.util';

function normalizeLookupKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function lookupLabelCandidates(item: Partial<IdName> | null | undefined): string[] {
  if (!item) return [];
  const raw = item as Partial<IdName> & Record<string, unknown>;
  return [raw.customLabel, raw['CustomLabel'], raw.label, raw['Label'], item.name]
    .map(value => String(value ?? '').trim())
    .filter((value, index, values) => value && values.indexOf(value) === index);
}

export function resolveTenderProjectLookupDisplayLabel(
  item: Partial<IdName> | null | undefined
): string | null {
  return lookupLabelCandidates(item)[0] ?? null;
}

export function resolveTenderProjectLookupNameById(
  list: IdName[],
  id?: number | string | null
): string | null {
  const parsed = parseProjectPositiveId(id);
  if (!parsed) return null;
  const found = list.find(item => item.id === parsed);
  return found?.name ?? null;
}

export function resolveTenderProjectLookupDisplayLabelById(
  list: IdName[],
  id?: number | string | null
): string | null {
  const parsed = parseProjectPositiveId(id);
  if (!parsed) return null;
  const found = list.find(item => item.id === parsed);
  return resolveTenderProjectLookupDisplayLabel(found);
}

export function tenderProjectLookupMatchesLabel(
  item: Partial<IdName> | null | undefined,
  label?: string | null
): boolean {
  const key = normalizeLookupKey(label);
  if (!key) return false;
  return lookupLabelCandidates(item).some(candidate => normalizeLookupKey(candidate) === key);
}

export function findTenderProjectLookupByName(list: IdName[], name?: string | null): IdName | null {
  const key = normalizeLookupKey(name);
  if (!key) return null;
  return list.find(item => tenderProjectLookupMatchesLabel(item, key)) ?? null;
}

export function upsertTenderProjectLookup(list: IdName[], item: IdName): IdName[] {
  if (!item) return list;
  const nameKey = normalizeLookupKey(item.name);
  const displayKey = normalizeLookupKey(resolveTenderProjectLookupDisplayLabel(item));
  const index = list.findIndex(
    entry =>
      entry.id === item.id ||
      (nameKey && normalizeLookupKey(entry.name) === nameKey) ||
      (displayKey && tenderProjectLookupMatchesLabel(entry, displayKey))
  );
  if (index === -1) {
    return [...list, item];
  }
  const next = [...list];
  next[index] = { ...next[index], ...item };
  return next;
}
