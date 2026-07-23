import type { IdName } from './tender-projects.contracts';
import type { TenderRow } from './tender-project-details/project-details.component';
import type { LookupsCache } from './tender-projects.types';

type ChangeDetectorLike = { markForCheck(): void };

export interface TenderProjectsCacheHost {
  LS_KEY_PROJECTS_CACHE: string;
  LS_KEY_LOOKUPS_CACHE: string;
  PROJECTS_CACHE_TTL_MS: number;
  LOOKUPS_CACHE_TTL_MS: number;
  PROJECTS_CACHE_MAX_ROWS: number;
  rows: TenderRow[];
  statuses: IdName[];
  top: IdName[];
  stages: IdName[];
  doi: IdName[];
  owners: IdName[];
  ownerTypes: IdName[];
  countries: IdName[];
  assignToSettings: IdName[];
  inChargeSettings: IdName[];
  lookupsLoaded: boolean;
  hadCachedLookups: boolean;
  lookupsLoadedAt: number;
  cdr: ChangeDetectorLike;
  scopedStorageKey(key: string): string;
  resetRowKeySet(rows: TenderRow[]): void;
  rehydrateRowsFromLookups(): void;
  rebuildLookupMaps(): void;
}

export function readTenderProjectsCache(
  host: TenderProjectsCacheHost
): { rows: TenderRow[]; storedAt: number } | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(host.scopedStorageKey(host.LS_KEY_PROJECTS_CACHE));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const storedAt = Number(parsed.storedAt);
    if (!storedAt || Number.isNaN(storedAt)) return null;
    if (Date.now() - storedAt > host.PROJECTS_CACHE_TTL_MS) return null;
    const rows = Array.isArray(parsed.rows) ? (parsed.rows as TenderRow[]) : [];
    return { rows, storedAt };
  } catch {
    return null;
  }
}

export function writeTenderProjectsCache(host: TenderProjectsCacheHost, rows: TenderRow[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const payload = {
      storedAt: Date.now(),
      rows: (rows ?? []).slice(0, host.PROJECTS_CACHE_MAX_ROWS)
    };
    localStorage.setItem(
      host.scopedStorageKey(host.LS_KEY_PROJECTS_CACHE),
      JSON.stringify(payload)
    );
  } catch {
    // ignore cache write errors
  }
}

export function hydrateTenderProjectsFromCache(host: TenderProjectsCacheHost): boolean {
  const cached = readTenderProjectsCache(host);
  if (!cached) return false;
  host.rows = cached.rows;
  host.resetRowKeySet(host.rows);
  if (host.lookupsLoaded) {
    host.rehydrateRowsFromLookups();
  }
  host.cdr.markForCheck();
  return true;
}

export function readTenderProjectLookupsCache(host: TenderProjectsCacheHost): LookupsCache | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(host.scopedStorageKey(host.LS_KEY_LOOKUPS_CACHE));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const storedAt = Number(parsed.storedAt);
    if (!storedAt || Number.isNaN(storedAt)) return null;
    if (Date.now() - storedAt > host.LOOKUPS_CACHE_TTL_MS) return null;

    const statuses = Array.isArray(parsed.statuses) ? (parsed.statuses as IdName[]) : [];
    const top = Array.isArray(parsed.top) ? (parsed.top as IdName[]) : [];
    const stages = Array.isArray(parsed.stages) ? (parsed.stages as IdName[]) : [];
    const doi = Array.isArray(parsed.doi) ? (parsed.doi as IdName[]) : [];
    const owners = Array.isArray(parsed.owners) ? (parsed.owners as IdName[]) : [];
    const ownerTypes = Array.isArray(parsed.ownerTypes) ? (parsed.ownerTypes as IdName[]) : [];
    const countries = Array.isArray(parsed.countries) ? (parsed.countries as IdName[]) : [];

    const assignToSettings = Array.isArray(parsed.assignToSettings)
      ? (parsed.assignToSettings as IdName[])
      : [];
    const inChargeSettings = Array.isArray(parsed.inChargeSettings)
      ? (parsed.inChargeSettings as IdName[])
      : [];

    const hasAny = [
      statuses,
      top,
      stages,
      doi,
      owners,
      ownerTypes,
      countries,
      assignToSettings,
      inChargeSettings
    ].some(list => list.length);
    if (!hasAny) return null;

    return {
      storedAt,
      statuses,
      top,
      stages,
      doi,
      owners,
      ownerTypes,
      countries,
      assignToSettings,
      inChargeSettings
    };
  } catch {
    return null;
  }
}

export function writeTenderProjectLookupsCache(host: TenderProjectsCacheHost): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const payload: LookupsCache = {
      storedAt: Date.now(),
      statuses: host.statuses ?? [],
      top: host.top ?? [],
      stages: host.stages ?? [],
      doi: host.doi ?? [],
      owners: host.owners ?? [],
      ownerTypes: host.ownerTypes ?? [],
      countries: host.countries ?? [],
      assignToSettings: host.assignToSettings ?? [],
      inChargeSettings: host.inChargeSettings ?? []
    };
    localStorage.setItem(host.scopedStorageKey(host.LS_KEY_LOOKUPS_CACHE), JSON.stringify(payload));
  } catch {
    // ignore cache write errors
  }
}

export function hydrateTenderProjectLookupsFromCache(host: TenderProjectsCacheHost): boolean {
  if (host.lookupsLoaded) return false;
  const cached = readTenderProjectLookupsCache(host);
  if (!cached) return false;

  host.statuses = cached.statuses ?? [];
  host.top = cached.top ?? [];
  host.stages = cached.stages ?? [];
  host.doi = cached.doi ?? [];
  host.owners = cached.owners ?? [];
  host.ownerTypes = cached.ownerTypes ?? [];
  host.countries = cached.countries ?? [];
  host.assignToSettings = cached.assignToSettings ?? [];
  host.inChargeSettings = cached.inChargeSettings ?? [];
  host.lookupsLoaded = true;
  host.hadCachedLookups = true;
  host.lookupsLoadedAt = Date.now();
  host.rebuildLookupMaps();
  host.rehydrateRowsFromLookups();
  host.cdr.markForCheck();
  return true;
}
