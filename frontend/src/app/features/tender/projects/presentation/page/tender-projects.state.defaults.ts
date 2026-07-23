import type { GridConfig } from '@shared/data-grid';
import type { LookupIdMaps, LookupNameMaps, ToneName } from './tender-projects.types';

export const TENDER_PROJECTS_STORAGE_KEYS = {
  tones: 'tender_settings_tones',
  customizations: 'tender_settings_customizations',
  projectsCache: 'tender_projects_cache_v2',
  lookupsCache: 'tender_projects_lookups_cache_v2'
} as const;

export const TENDER_PROJECTS_CACHE_LIMITS = {
  projectsCacheTtlMs: 5 * 60 * 1000,
  lookupsCacheTtlMs: 6 * 60 * 60 * 1000,
  lookupsMemoryTtlMs: 5 * 60 * 1000,
  projectsCacheMaxRows: 200,
  pageFetchConcurrency: 4
} as const;

export const TENDER_PROJECTS_TONE_NAMES = new Set<ToneName>([
  'green',
  'yellow',
  'red',
  'blue',
  'purple',
  'gray',
  'teal',
  'orange'
]);

export const TENDER_PROJECTS_TONE_HEX_MAP: Record<ToneName, string> = {
  green: '#10b981',
  yellow: '#eab308',
  red: '#ef4444',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  gray: '#94a3b8',
  teal: '#14b8a6',
  orange: '#f59e0b'
};

export function createTenderProjectLookupIdMaps(): LookupIdMaps {
  return {
    statuses: new Map(),
    top: new Map(),
    stages: new Map(),
    doi: new Map(),
    owners: new Map(),
    ownerTypes: new Map(),
    countries: new Map(),
    assignToSettings: new Map(),
    inChargeSettings: new Map()
  };
}

export function createTenderProjectLookupNameMaps(): LookupNameMaps {
  return {
    statuses: new Map(),
    top: new Map(),
    stages: new Map(),
    doi: new Map(),
    owners: new Map(),
    ownerTypes: new Map(),
    countries: new Map(),
    assignToSettings: new Map(),
    inChargeSettings: new Map()
  };
}

export function createTenderProjectsAuditTimeFormatter(): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

export function buildTenderProjectsGridConfig(
  currentPageSize: number,
  tablePageSizeOptions: readonly number[]
): GridConfig {
  return {
    simpleMode: false,
    selectable: true,
    selectMode: 'checkbox',
    pagination: true,
    pageSize: currentPageSize,
    pageSizeOptions: [...tablePageSizeOptions],
    hover: true,
    showFilter: true,
    filterDelay: 150,
    dense: false,
    striped: false,
    enableCache: true,
    cacheSize: 100,
    virtualScrollBuffer: 10,
    rowHeight: 42,
    debounceTime: 150,
    autoSizeColumns: true
  };
}

export function buildTenderProjectsProjectGridConfig(gridConfig: GridConfig): GridConfig {
  return {
    ...gridConfig,
    simpleMode: false,
    pagination: true,
    virtualScroll: false,
    rowHeight: 28,
    pinSelectionColumn: true,
    autoSizeColumns: false
  };
}
