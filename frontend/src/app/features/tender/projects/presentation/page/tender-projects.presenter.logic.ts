import { firstValueFrom, type Observable } from 'rxjs';
import type { GridConfig } from '@shared/data-grid';
import type { CreateProjectDto, IdName, UpdateProjectDto } from './tender-projects.contracts';
import type { TenderRow } from './tender-project-details/project-details.component';
import { resolveTenderProjectLookupDisplayLabel } from './tender-projects.lookup.util';
import { environment } from '../../../../../../environments/environment';

type LookupCollections = {
  statuses: IdName[];
  top: IdName[];
  stages: IdName[];
  doi: IdName[];
  owners: IdName[];
  ownerTypes: IdName[];
  countries: IdName[];
  assignToSettings: IdName[];
  inChargeSettings: IdName[];
};

type LookupsApi = {
  statuses(): Observable<IdName[]>;
  typesOfProjects(): Observable<IdName[]>;
  tenderStages(): Observable<IdName[]>;
  degreesOfImportances(): Observable<IdName[]>;
  owners(): Observable<IdName[]>;
  ownerTypes(): Observable<IdName[]>;
  countries(): Observable<IdName[]>;
  assignToSettings(): Observable<IdName[]>;
  inChargeSettings(): Observable<IdName[]>;
};

type LookupsLoadDependencies = {
  getLookupsLoadInFlight(): Promise<void> | null;
  setLookupsLoadInFlight(task: Promise<void> | null): void;
  isLookupsFresh(now: number): boolean;
  debugLog(message: string, payload?: unknown): void;
  api: LookupsApi;
  setLookups(lookups: LookupCollections): void;
  setLookupsLoaded(value: boolean): void;
  setLookupsLoadedAt(value: number): void;
  hadCachedLookups: boolean;
  rebuildLookupMaps(): void;
  rehydrateRowsFromLookups(): void;
  markForCheck(): void;
  writeLookupsCache(): void;
  toastError(message: string): void;
};

type SyncBroadcastDependencies = {
  isBrowser: boolean;
  channel: BroadcastChannel | null;
  scope: string;
  sourceId: string;
  storageKey: string;
};

type PageSizeDependencies = {
  newSize: number;
  gridConfig: GridConfig;
  tablePageSizeOptions: number[];
};

type SharedDtoDependencies = {
  row: TenderRow;
  lookups: LookupCollections;
  debugLog(message: string, payload?: unknown): void;
  resolveId(list: IdName[], name: string | undefined | null): number | null;
  parseNumberOrNull(value: unknown): number | null;
  normalizeApiDate(value: string | null | undefined): string | null;
  normalizeLabel(value: string | null | undefined): string | null;
};

type UpdateDtoDependencies = SharedDtoDependencies & {
  parseId(value: unknown): number | null;
  toastError(message: string): void;
};

function resolveLookupIdForSave(
  list: IdName[],
  name: string | undefined | null,
  fallbackId: number | null | undefined,
  deps: Pick<SharedDtoDependencies, 'resolveId' | 'normalizeLabel'>
): number | null {
  const normalizedName = deps.normalizeLabel(name);
  if (!normalizedName) {
    return null;
  }

  const resolvedId = deps.resolveId(list, normalizedName);
  if (resolvedId != null) {
    return resolvedId;
  }

  if (fallbackId == null || !Number.isFinite(fallbackId) || fallbackId <= 0) {
    return null;
  }

  const fallbackItem = list.find(item => item.id === fallbackId);
  if (!fallbackItem) {
    return list.length === 0 ? fallbackId : null;
  }

  const fallbackLabel = deps.normalizeLabel(
    resolveTenderProjectLookupDisplayLabel(fallbackItem) ?? fallbackItem.name ?? null
  );
  return fallbackLabel?.toLowerCase() === normalizedName.toLowerCase() ? fallbackId : null;
}

export function createTenderProjectsSyncClientId(isBrowser: boolean): string {
  if (!isBrowser) {
    return 'server';
  }
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // Ignore crypto access errors and fall back to a timestamp-based id.
  }
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function broadcastTenderProjectsSync(
  kind: 'projects' | 'lookups',
  reason: string,
  deps: SyncBroadcastDependencies
): void {
  if (!deps.isBrowser) {
    return;
  }

  const at = Date.now();
  try {
    deps.channel?.postMessage({
      kind,
      reason,
      at,
      scope: deps.scope,
      sourceId: deps.sourceId
    });
  } catch {
    // Ignore channel transport failures and keep storage fallback.
  }

  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(deps.storageKey, JSON.stringify({ reason, at }));
  } catch {
    // Ignore local storage fallback failures.
  }
}

export function buildTenderProjectsPageSizeState(deps: PageSizeDependencies): {
  currentPageSize: number;
  gridConfig: GridConfig;
  projectGridConfig: GridConfig;
} {
  const currentPageSize = deps.newSize;
  const gridConfig: GridConfig = {
    ...deps.gridConfig,
    pageSize: currentPageSize,
    pageSizeOptions: deps.tablePageSizeOptions
  };
  const projectGridConfig: GridConfig = {
    ...gridConfig,
    simpleMode: false,
    pagination: true,
    virtualScroll: false,
    rowHeight: 28,
    pinSelectionColumn: true
  };

  return {
    currentPageSize,
    gridConfig,
    projectGridConfig
  };
}

export async function loadTenderProjectLookups(deps: LookupsLoadDependencies): Promise<void> {
  const now = Date.now();
  const inFlight = deps.getLookupsLoadInFlight();
  if (inFlight) {
    await inFlight;
    return;
  }

  if (deps.isLookupsFresh(now)) {
    deps.debugLog('[loadLookups] Skipping - in-memory cache fresh');
    return;
  }

  const task = (async () => {
    deps.debugLog('[loadLookups] Starting lookup load...');

    try {
      const [
        statuses,
        top,
        stages,
        doi,
        owners,
        ownerTypes,
        countries,
        assignToSettings,
        inChargeSettings
      ] = await Promise.all([
        firstValueFrom(deps.api.statuses()),
        firstValueFrom(deps.api.typesOfProjects()),
        firstValueFrom(deps.api.tenderStages()),
        firstValueFrom(deps.api.degreesOfImportances()),
        firstValueFrom(deps.api.owners()),
        firstValueFrom(deps.api.ownerTypes()),
        firstValueFrom(deps.api.countries()),
        firstValueFrom(deps.api.assignToSettings()),
        firstValueFrom(deps.api.inChargeSettings())
      ]);

      deps.setLookups({
        statuses: statuses ?? [],
        top: top ?? [],
        stages: stages ?? [],
        doi: doi ?? [],
        owners: owners ?? [],
        ownerTypes: ownerTypes ?? [],
        countries: countries ?? [],
        assignToSettings: assignToSettings ?? [],
        inChargeSettings: inChargeSettings ?? []
      });
      deps.setLookupsLoaded(true);
      deps.setLookupsLoadedAt(Date.now());
      deps.rebuildLookupMaps();
      deps.rehydrateRowsFromLookups();
      deps.markForCheck();
      deps.writeLookupsCache();

      deps.debugLog('[loadLookups] Lookups loaded successfully:', {
        statuses: statuses?.length ?? 0,
        top: top?.length ?? 0,
        stages: stages?.length ?? 0,
        doi: doi?.length ?? 0,
        owners: owners?.length ?? 0,
        ownerTypes: ownerTypes?.length ?? 0,
        countries: countries?.length ?? 0,
        assignToSettings: assignToSettings?.length ?? 0,
        inChargeSettings: inChargeSettings?.length ?? 0
      });
    } catch (error) {
      if (environment.enableDebugLogs)
        console.error('[loadLookups] Failed to load lookups:', error);
      if (!deps.hadCachedLookups) {
        deps.setLookupsLoaded(false);
        deps.toastError('Failed to load dropdown options from backend');
      } else {
        deps.setLookupsLoaded(true);
      }
      deps.markForCheck();
    }
  })();

  deps.setLookupsLoadInFlight(task);
  try {
    await task;
  } finally {
    if (deps.getLookupsLoadInFlight() === task) {
      deps.setLookupsLoadInFlight(null);
    }
  }
}

export function buildTenderProjectCreateDto(deps: SharedDtoDependencies): CreateProjectDto {
  deps.debugLog('[buildCreateDto] Input row:', deps.row);
  deps.debugLog('[buildCreateDto] Available lookups:', deps.lookups);

  const statusId = resolveLookupIdForSave(
    deps.lookups.statuses,
    deps.row.status,
    deps.row.statusId,
    deps
  );
  const typeOfProjectId = resolveLookupIdForSave(
    deps.lookups.top,
    deps.row.top,
    deps.row.typeOfProjectId,
    deps
  );
  const tenderStageId = resolveLookupIdForSave(
    deps.lookups.stages,
    deps.row.ts,
    deps.row.tenderStageId,
    deps
  );
  const degreeOfImportanceId = resolveLookupIdForSave(
    deps.lookups.doi,
    deps.row.doi,
    deps.row.degreeOfImportanceId,
    deps
  );
  const ownerId = resolveLookupIdForSave(
    deps.lookups.owners,
    deps.row.owner,
    deps.row.ownerId,
    deps
  );
  const ownerTypeId = resolveLookupIdForSave(
    deps.lookups.ownerTypes,
    deps.row.ownerType,
    deps.row.ownerTypeId,
    deps
  );
  const countryId = resolveLookupIdForSave(
    deps.lookups.countries,
    deps.row.country,
    deps.row.countryId,
    deps
  );

  deps.debugLog('[buildCreateDto] Resolved IDs:', {
    statusId,
    typeOfProjectId,
    tenderStageId,
    degreeOfImportanceId,
    ownerId,
    ownerTypeId,
    countryId
  });

  const dto: CreateProjectDto = {
    name: deps.row.title?.trim() || null,
    description: deps.normalizeLabel(deps.row.description),
    price: deps.parseNumberOrNull(deps.row.price),
    statusId,
    typeOfProjectId,
    degreeOfImportanceId,
    tenderStageId,
    ownerId,
    ownerTypeId,
    countryId,
    assignTo: deps.normalizeLabel(deps.row.assignTo),
    inCharge: deps.normalizeLabel(deps.row.inCharge),
    consultant: deps.normalizeLabel(deps.row.consultant),
    startDate: deps.normalizeApiDate(deps.row.startDate),
    acceptDate: deps.normalizeApiDate(deps.row.acceptDate),
    deadline: deps.normalizeApiDate(deps.row.deadline),
    endDate: deps.normalizeApiDate(deps.row.endDate),
    prb: deps.parseNumberOrNull(deps.row.prb),
    delayReasons: deps.normalizeLabel(deps.row.delayReasons)
  };

  deps.debugLog('[buildCreateDto] Final DTO:', dto);
  return dto;
}

export function buildTenderProjectUpdateDto(deps: UpdateDtoDependencies): UpdateProjectDto | null {
  deps.debugLog('[buildUpdateDto] Input row:', deps.row);
  const rowId = deps.parseId(deps.row.id);
  if (!rowId) {
    deps.toastError('Cannot update project: missing ID');
    return null;
  }

  const statusId = resolveLookupIdForSave(
    deps.lookups.statuses,
    deps.row.status,
    deps.row.statusId,
    deps
  );
  const typeOfProjectId = resolveLookupIdForSave(
    deps.lookups.top,
    deps.row.top,
    deps.row.typeOfProjectId,
    deps
  );
  const tenderStageId = resolveLookupIdForSave(
    deps.lookups.stages,
    deps.row.ts,
    deps.row.tenderStageId,
    deps
  );
  const degreeOfImportanceId = resolveLookupIdForSave(
    deps.lookups.doi,
    deps.row.doi,
    deps.row.degreeOfImportanceId,
    deps
  );
  const ownerId = resolveLookupIdForSave(
    deps.lookups.owners,
    deps.row.owner,
    deps.row.ownerId,
    deps
  );
  const ownerTypeId = resolveLookupIdForSave(
    deps.lookups.ownerTypes,
    deps.row.ownerType,
    deps.row.ownerTypeId,
    deps
  );
  const countryId = resolveLookupIdForSave(
    deps.lookups.countries,
    deps.row.country,
    deps.row.countryId,
    deps
  );

  deps.debugLog('[buildUpdateDto] Resolved IDs:', {
    statusId,
    typeOfProjectId,
    tenderStageId,
    degreeOfImportanceId,
    ownerId,
    ownerTypeId,
    countryId
  });

  const dto: UpdateProjectDto = {
    id: rowId,
    name: deps.row.title?.trim() || null,
    description: deps.normalizeLabel(deps.row.description),
    price: deps.parseNumberOrNull(deps.row.price),
    ownerId,
    ownerTypeId,
    statusId,
    typeOfProjectId,
    degreeOfImportanceId,
    tenderStageId,
    countryId,
    assignTo: deps.normalizeLabel(deps.row.assignTo),
    inCharge: deps.normalizeLabel(deps.row.inCharge),
    consultant: deps.normalizeLabel(deps.row.consultant),
    startDate: deps.normalizeApiDate(deps.row.startDate),
    acceptDate: deps.normalizeApiDate(deps.row.acceptDate),
    deadline: deps.normalizeApiDate(deps.row.deadline),
    endDate: deps.normalizeApiDate(deps.row.endDate),
    prb: deps.parseNumberOrNull(deps.row.prb),
    delayReasons: deps.normalizeLabel(deps.row.delayReasons)
  };

  deps.debugLog('[buildUpdateDto] Final DTO:', dto);
  return dto;
}
