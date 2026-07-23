import {
  DEFAULT_APP_ICON_TOKEN,
  collectAppIconTokensFromSelector,
  detectAppGroupIconCategory
} from '@shared/icons/app-icon.tokens';
import type { CustomListGroup, SuggestedGroupOption } from './app-status-list.component.types';

type StatusListGroupIconCategory = { key: string; label: string };

export interface AppStatusListCustomGroupHost {
  customListsStorageKey: string;
  customListPaletteStorageKey: string;
  groupReorderEnabled: boolean;
  customListGroups: ReadonlyArray<CustomListGroup>;
  customListTaskIds: Record<string, string[]>;
  customListTaskIdsStorageSnapshot: string | null;
  groupMyColors: ReadonlyArray<string>;
  suggestedGroupOptions: ReadonlyArray<SuggestedGroupOption>;
  readonly suggestedGroupNameSeeds: ReadonlyArray<string>;
  readonly groupColorPresets: ReadonlyArray<string>;
  readonly suggestedGroupIconSeeds: ReadonlyArray<string>;
  readonly fallbackGroupIconLibrary: ReadonlyArray<string>;
  groupIconLibrary: ReadonlyArray<string>;
  groupIconSet: Set<string>;
  readonly groupIconCategoryDefs: ReadonlyArray<StatusListGroupIconCategory>;
  groupIconCategory: string;
  groupIconCounts: Record<string, number>;
  groupIconsByCategory: Record<string, string[]>;
  normalizeHexColor(value: string): string | null;
  normalizeGroupIcon(value: string | null | undefined): string | null;
}

export function buildStatusListCustomListTaskStorageKey(
  host: AppStatusListCustomGroupHost
): string {
  return `${host.customListsStorageKey}_task_ids_v1`;
}

export function readStatusListCustomListGroups(
  host: AppStatusListCustomGroupHost
): CustomListGroup[] {
  try {
    const raw = localStorage.getItem(host.customListsStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(item => !!item && typeof item === 'object')
      .map(item => {
        const value = item as Partial<CustomListGroup>;
        const id = String(value.id ?? '').trim();
        const name = String(value.name ?? '').trim();
        const color = host.normalizeHexColor(String(value.color ?? '')) ?? '#a855f7';
        const icon = host.normalizeGroupIcon(value.icon) ?? DEFAULT_APP_ICON_TOKEN;
        if (!id || !name) return null;
        return { id, name, color, icon } satisfies CustomListGroup;
      })
      .filter((item): item is CustomListGroup => !!item);
  } catch {
    return [];
  }
}

export function writeStatusListCustomListGroups(host: AppStatusListCustomGroupHost): void {
  try {
    localStorage.setItem(host.customListsStorageKey, JSON.stringify(host.customListGroups));
  } catch {
    // ignore storage failures
  }
}

export function syncStatusListCustomListTaskIdsFromStorage(
  host: AppStatusListCustomGroupHost
): void {
  if (!host.groupReorderEnabled) return;
  try {
    const raw = localStorage.getItem(buildStatusListCustomListTaskStorageKey(host));
    if (raw === host.customListTaskIdsStorageSnapshot) return;
    host.customListTaskIdsStorageSnapshot = raw;
    host.customListTaskIds = parseStatusListTaskIdMap(raw);
  } catch {
    // ignore storage failures
  }
}

export function readStatusListCustomListTaskIds(
  host: AppStatusListCustomGroupHost
): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(buildStatusListCustomListTaskStorageKey(host));
    return parseStatusListTaskIdMap(raw);
  } catch {
    return {};
  }
}

export function writeStatusListCustomListTaskIds(host: AppStatusListCustomGroupHost): void {
  try {
    const serialized = JSON.stringify(host.customListTaskIds);
    localStorage.setItem(buildStatusListCustomListTaskStorageKey(host), serialized);
    host.customListTaskIdsStorageSnapshot = serialized;
  } catch {
    // ignore storage failures
  }
}

export function readStatusListMyColors(host: AppStatusListCustomGroupHost): string[] {
  try {
    const raw = localStorage.getItem(host.customListPaletteStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(value => host.normalizeHexColor(String(value ?? '')))
      .filter((value): value is string => !!value)
      .slice(0, 10);
  } catch {
    return [];
  }
}

export function writeStatusListMyColors(host: AppStatusListCustomGroupHost): void {
  try {
    localStorage.setItem(host.customListPaletteStorageKey, JSON.stringify(host.groupMyColors));
  } catch {
    // ignore storage failures
  }
}

export function pushStatusListMyColor(host: AppStatusListCustomGroupHost, color: string): void {
  const normalized = host.normalizeHexColor(color);
  if (!normalized) return;
  const next = [normalized, ...host.groupMyColors.filter(item => item !== normalized)].slice(0, 10);
  host.groupMyColors = next;
  writeStatusListMyColors(host);
}

export function removeStatusListTaskFromAllCustomLists(
  host: AppStatusListCustomGroupHost,
  taskId: string
): void {
  let changed = false;
  const next: Record<string, string[]> = {};
  for (const [groupId, ids] of Object.entries(host.customListTaskIds)) {
    const filtered = ids.filter(id => id !== taskId);
    if (filtered.length !== ids.length) changed = true;
    next[groupId] = filtered;
  }
  if (!changed) return;
  host.customListTaskIds = next;
}

export function insertStatusListTaskIntoCustomList(
  host: AppStatusListCustomGroupHost,
  groupId: string,
  taskId: string,
  index: number
): void {
  removeStatusListTaskFromAllCustomLists(host, taskId);
  const current = [...(host.customListTaskIds[groupId] ?? [])];
  const at = Math.max(0, Math.min(index, current.length));
  current.splice(at, 0, taskId);
  host.customListTaskIds = { ...host.customListTaskIds, [groupId]: current };
}

export function createStatusListCustomListGroup(
  host: AppStatusListCustomGroupHost,
  name: string,
  color: string,
  icon?: string
): boolean {
  const value = name.trim();
  if (!value) return false;
  const exists = host.customListGroups.some(
    group => group.name.toLocaleLowerCase() === value.toLocaleLowerCase()
  );
  if (exists) return false;

  const normalizedColor = host.normalizeHexColor(color) ?? pickRandomStatusListSuggestedColor(host);
  const normalizedIcon = host.normalizeGroupIcon(icon) ?? pickRandomStatusListSuggestedIcon(host);
  const group: CustomListGroup = {
    id: `cg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: value,
    color: normalizedColor,
    icon: normalizedIcon
  };

  host.customListGroups = [...host.customListGroups, group];
  host.customListTaskIds = { ...host.customListTaskIds, [group.id]: [] };
  writeStatusListCustomListGroups(host);
  writeStatusListCustomListTaskIds(host);
  return true;
}

export function rebuildStatusListSuggestedGroupOptions(host: AppStatusListCustomGroupHost): void {
  const existing = new Set(host.customListGroups.map(group => group.name.toLocaleLowerCase()));
  const pool = [...host.suggestedGroupNameSeeds];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  host.suggestedGroupOptions = pool
    .filter(name => !existing.has(name.toLocaleLowerCase()))
    .slice(0, 40)
    .map(name => ({
      name,
      color: pickRandomStatusListSuggestedColor(host),
      icon: pickRandomStatusListSuggestedIcon(host)
    }));
}

export function pickRandomStatusListSuggestedColor(host: AppStatusListCustomGroupHost): string {
  const my = host.groupMyColors.filter(color => !!host.normalizeHexColor(color));
  const palette = [...host.groupColorPresets, ...my];
  const source = palette.length ? palette : [...host.groupColorPresets];
  const pick = source[Math.floor(Math.random() * source.length)] ?? '#14b8a6';
  return host.normalizeHexColor(pick) ?? '#14b8a6';
}

export function pickRandomStatusListSuggestedIcon(host: AppStatusListCustomGroupHost): string {
  const source = host.suggestedGroupIconSeeds;
  return source[Math.floor(Math.random() * source.length)] ?? DEFAULT_APP_ICON_TOKEN;
}

export function initStatusListGroupIconLibrary(host: AppStatusListCustomGroupHost): void {
  const pool = new Set<string>(host.fallbackGroupIconLibrary);
  if (typeof document !== 'undefined') {
    for (const sheet of Array.from(document.styleSheets)) {
      collectStatusListIconsFromStyleSheet(sheet as CSSStyleSheet, pool);
    }
  }
  const list = Array.from(pool).sort((a, b) => a.localeCompare(b));
  host.groupIconLibrary = list;
  host.groupIconSet = new Set(list);
  rebuildStatusListGroupIconCategories(host);
}

function parseStatusListTaskIdMap(raw: string | null): Record<string, string[]> {
  if (!raw) return {};
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object') return {};
  const result: Record<string, string[]> = {};
  for (const [groupId, ids] of Object.entries(parsed as Record<string, unknown>)) {
    if (!Array.isArray(ids)) continue;
    const clean = ids.map(value => String(value ?? '').trim()).filter(Boolean);
    if (!clean.length) continue;
    result[groupId] = Array.from(new Set(clean));
  }
  return result;
}

function collectStatusListIconsFromStyleSheet(sheet: CSSStyleSheet, sink: Set<string>): void {
  let rules: CSSRuleList;
  try {
    rules = sheet.cssRules;
  } catch {
    return;
  }
  collectStatusListIconsFromRules(rules, sink);
}

function collectStatusListIconsFromRules(rules: CSSRuleList, sink: Set<string>): void {
  for (const rule of Array.from(rules)) {
    const styleLike = rule as CSSStyleRule;
    if (typeof styleLike.selectorText === 'string') {
      collectStatusListIconsFromSelector(styleLike.selectorText, sink);
    }

    const nested = (rule as CSSMediaRule).cssRules;
    if (nested && nested.length) {
      collectStatusListIconsFromRules(nested, sink);
    }
  }
}

function collectStatusListIconsFromSelector(selector: string, sink: Set<string>): void {
  collectAppIconTokensFromSelector(selector, sink);
}

function rebuildStatusListGroupIconCategories(host: AppStatusListCustomGroupHost): void {
  const buckets: Record<string, string[]> = {};
  for (const category of host.groupIconCategoryDefs) buckets[category.key] = [];
  buckets.all = [...host.groupIconLibrary];

  for (const icon of host.groupIconLibrary) {
    const category = detectStatusListGroupIconCategory(icon);
    if (!buckets[category]) buckets[category] = [];
    buckets[category].push(icon);
  }

  const counts: Record<string, number> = {};
  for (const category of host.groupIconCategoryDefs) {
    counts[category.key] = buckets[category.key]?.length ?? 0;
  }
  host.groupIconsByCategory = buckets;
  host.groupIconCounts = counts;

  if (!host.groupIconsByCategory[host.groupIconCategory]) {
    host.groupIconCategory = 'all';
  }
}

function detectStatusListGroupIconCategory(iconClass: string): string {
  return detectAppGroupIconCategory(iconClass);
}
