import { Injectable, inject } from '@angular/core';
import { forkJoin, map, Observable, of, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiClient } from '@infrastructure/http/api-client.service';
import { environment } from '@env/environment';
import { runtimeConfig } from '@core/runtime-config';

type LooseValue = ReturnType<typeof JSON.parse>;
export type LookupCustomization = {
  customLabel?: string | null;
  tone?: string | null;
  customHex?: string | null;
  order?: number | null;
};

export type IdName = { id: number; name: string } & LookupCustomization;

export type Country = IdName;
export type Owner = IdName & {
  email?: string;
  address?: string;
  phoneFax?: string;
  mobile?: string;
  notes?: string;
  countryId?: number;
};
export type Status = IdName;
export type TenderStage = IdName;
export type TypeOfProject = IdName;
export type DegreeOfImportance = IdName;
export type OwnerType = IdName;

type ApiResponse<T> = {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  errors: LooseValue[];
};

type ApiResponseLike<T> = ApiResponse<T> | T;

const unwrapResponse = <T>(payload: ApiResponseLike<T>): T => {
  if (payload && typeof payload === 'object' && 'data' in (payload as Record<string, unknown>)) {
    return (payload as ApiResponse<T>).data;
  }
  return payload as T;
};

const sanitizeLookupPayload = (payload: unknown): unknown => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }

  const requiredKeys = new Set(['id', 'name']);
  return Object.fromEntries(
    Object.entries(payload as Record<string, unknown>).filter(([key, value]) => {
      if (requiredKeys.has(key)) {
        return true;
      }

      if (value == null) {
        return false;
      }

      if (typeof value === 'string' && !value.trim()) {
        return false;
      }

      return true;
    })
  );
};

export type CreateCountryDto = { name: string } & LookupCustomization;
export type UpdateCountryDto = { id: number; name: string } & LookupCustomization;

export type CreateOwnerDto = {
  name: string;
  email?: string;
  address?: string;
  phoneFax?: string;
  mobile?: string;
  notes?: string;
  countryId?: number;
} & LookupCustomization;
export type UpdateOwnerDto = CreateOwnerDto & { id: number };
export type RenameOwnerDto = { id: number; name: string };

export type CreateStatusDto = { name: string } & LookupCustomization;
export type UpdateStatusDto = { id: number; name: string } & LookupCustomization;

export type CreateTenderStageDto = { name: string } & LookupCustomization;
export type UpdateTenderStageDto = { id: number; name: string } & LookupCustomization;

export type CreateTypeOfProjectDto = { name: string } & LookupCustomization;
export type UpdateTypeOfProjectDto = { id: number; name: string } & LookupCustomization;

export type CreateDegreeOfImportanceDto = { name: string } & LookupCustomization;
export type UpdateDegreeOfImportanceDto = { id: number; name: string } & LookupCustomization;

export type CreateOwnerTypeDto = { name: string } & LookupCustomization;
export type UpdateOwnerTypeDto = { id: number; name: string } & LookupCustomization;

@Injectable({ providedIn: 'root' })
export class LookupsApi {
  private api = inject(ApiClient);
  private readonly initialRuntime = runtimeConfig();

  private get mockMode(): boolean {
    const current = runtimeConfig();
    const runtimeFlag = current.useMock ?? this.initialRuntime.useMock;
    const resolved = Boolean(runtimeFlag ?? environment.useMock);
    // Ignore runtime forcing mock mode in real-backend builds to avoid fake lookup IDs
    // that break project create/update against the actual database.
    if (!environment.useMock && resolved) {
      return false;
    }
    return resolved;
  }

  private listLookupFromApi<T>(endpoint: string, key: LookupKey): Observable<T[]> {
    if (this.mockMode) {
      return of(listLookup(key) as T[]);
    }

    return this.api.get<ApiResponseLike<T[]>>(endpoint).pipe(
      map(res => {
        const data = unwrapResponse(res);
        return Array.isArray(data) ? data : [];
      }),
      catchError(err => this.fallbackList<T>(key, err))
    );
  }

  private singleLookupFromApi<T>(endpoint: string, key: LookupKey, id: number): Observable<T> {
    if (this.mockMode) {
      const value = getLookup(key, id);
      if (!value) {
        return throwError(() => new Error(`Mock ${key} item with id ${id} not found`));
      }
      return of(value as T);
    }

    return this.api.get<ApiResponseLike<T>>(endpoint).pipe(
      map(res => unwrapResponse(res)),
      catchError(err => this.fallbackSingle<T>(key, err, id))
    );
  }

  private createLookupViaApi<T>(endpoint: string, key: LookupKey, payload: unknown): Observable<T> {
    if (this.mockMode) {
      return of(createLookup(key, payload) as T);
    }

    const sanitizedPayload = sanitizeLookupPayload(payload);
    return this.api.post<ApiResponseLike<T>>(endpoint, sanitizedPayload).pipe(
      map(res => unwrapResponse(res)),
      catchError(err => this.fallbackCreate<T>(key, err, sanitizedPayload))
    );
  }

  private updateLookupViaApi<T>(
    endpoint: string,
    key: LookupKey,
    id: number,
    payload: unknown
  ): Observable<T> {
    if (this.mockMode) {
      const updated = updateLookup(key, id, payload);
      if (!updated) {
        return throwError(() => new Error(`Mock ${key} item with id ${id} not found`));
      }
      return of(updated as T);
    }

    const sanitizedPayload = sanitizeLookupPayload(payload);
    return this.api.put<ApiResponseLike<T>>(endpoint, sanitizedPayload).pipe(
      map(res => unwrapResponse(res)),
      catchError(err => this.fallbackUpdate<T>(key, err, id, sanitizedPayload))
    );
  }

  private deleteLookupViaApi(endpoint: string, key: LookupKey, id: number): Observable<void> {
    if (this.mockMode) {
      deleteLookup(key, id);
      return of(void 0);
    }

    return this.api.delete<ApiResponse<null>>(endpoint).pipe(
      map(() => void 0),
      catchError(err => this.fallbackDelete(key, err, id))
    );
  }

  private fallbackList<T>(key: LookupKey, err: unknown): Observable<T[]> {
    if (this.mockMode) {
      if (environment.enableDebugLogs)
        console.warn(`[LookupsApi] Falling back to mock list for ${key}`, err);
      return of(listLookup(key) as T[]);
    }
    return throwError(() => err);
  }

  private fallbackSingle<T>(key: LookupKey, err: unknown, id: number): Observable<T> {
    if (this.mockMode) {
      const value = getLookup(key, id);
      if (value) {
        if (environment.enableDebugLogs)
          console.warn(`[LookupsApi] Falling back to mock ${key} item`, err);
        return of(value as T);
      }
    }
    return throwError(() => err);
  }

  private fallbackCreate<T>(key: LookupKey, err: unknown, payload: unknown): Observable<T> {
    if (this.mockMode) {
      if (environment.enableDebugLogs)
        console.warn(`[LookupsApi] Falling back to mock create for ${key}`, err);
      return of(createLookup(key, payload) as T);
    }
    return throwError(() => err);
  }

  private fallbackUpdate<T>(
    key: LookupKey,
    err: unknown,
    id: number,
    payload: unknown
  ): Observable<T> {
    if (this.mockMode) {
      if (environment.enableDebugLogs)
        console.warn(`[LookupsApi] Falling back to mock update for ${key}`, err);
      const updated = updateLookup(key, id, payload);
      if (updated) {
        return of(updated as T);
      }
    }
    return throwError(() => err);
  }

  private fallbackDelete(key: LookupKey, err: unknown, id: number): Observable<void> {
    if (this.mockMode) {
      if (environment.enableDebugLogs)
        console.warn(`[LookupsApi] Falling back to mock delete for ${key}`, err);
      deleteLookup(key, id);
      return of(void 0);
    }
    return throwError(() => err);
  }

  /* Countries */

  getCountries(): Observable<Country[]> {
    return this.listLookupFromApi<Country>('Countries', 'countries');
  }

  getCountry(id: number): Observable<Country> {
    return this.singleLookupFromApi<Country>(`Countries/${id}`, 'countries', id);
  }

  createCountry(payload: CreateCountryDto): Observable<Country> {
    return this.createLookupViaApi<Country>('Countries', 'countries', payload);
  }

  updateCountry(id: number, payload: UpdateCountryDto): Observable<Country> {
    return this.updateLookupViaApi<Country>(`Countries/${id}`, 'countries', id, payload);
  }

  deleteCountry(id: number): Observable<void> {
    return this.deleteLookupViaApi(`Countries/${id}`, 'countries', id);
  }

  /* Owners */

  getOwners(): Observable<Owner[]> {
    return this.listLookupFromApi<Owner>('Owners', 'owners');
  }

  getOwner(id: number): Observable<Owner> {
    return this.singleLookupFromApi<Owner>(`Owners/${id}`, 'owners', id);
  }

  createOwner(payload: CreateOwnerDto): Observable<Owner> {
    return this.createLookupViaApi<Owner>('Owners', 'owners', payload);
  }

  renameOwner(id: number, payload: RenameOwnerDto): Observable<Owner> {
    return this.api.patch<ApiResponseLike<Owner>>(`Owners/${id}/name`, payload).pipe(
      map(res => unwrapResponse(res)),
      catchError(err => this.fallbackUpdate<Owner>('owners', err, id, payload))
    );
  }

  updateOwner(id: number, payload: UpdateOwnerDto): Observable<Owner> {
    return this.updateLookupViaApi<Owner>(`Owners/${id}`, 'owners', id, payload);
  }

  deleteOwner(id: number): Observable<void> {
    return this.deleteLookupViaApi(`Owners/${id}`, 'owners', id);
  }

  /* Statuses */

  getStatuses(): Observable<Status[]> {
    return this.listLookupFromApi<Status>('Statuses', 'statuses');
  }

  getStatus(id: number): Observable<Status> {
    return this.singleLookupFromApi<Status>(`Statuses/${id}`, 'statuses', id);
  }

  createStatus(payload: CreateStatusDto): Observable<Status> {
    return this.createLookupViaApi<Status>('Statuses', 'statuses', payload);
  }

  updateStatus(id: number, payload: UpdateStatusDto): Observable<Status> {
    return this.updateLookupViaApi<Status>(`Statuses/${id}`, 'statuses', id, payload);
  }

  deleteStatus(id: number): Observable<void> {
    return this.deleteLookupViaApi(`Statuses/${id}`, 'statuses', id);
  }

  /* Tender stages */

  getTenderStages(): Observable<TenderStage[]> {
    return this.listLookupFromApi<TenderStage>('tender-stages', 'stages');
  }

  getTenderStage(id: number): Observable<TenderStage> {
    return this.singleLookupFromApi<TenderStage>(`tender-stages/${id}`, 'stages', id);
  }

  createTenderStage(payload: CreateTenderStageDto): Observable<TenderStage> {
    return this.createLookupViaApi<TenderStage>('tender-stages', 'stages', payload);
  }

  updateTenderStage(id: number, payload: UpdateTenderStageDto): Observable<TenderStage> {
    return this.updateLookupViaApi<TenderStage>(`tender-stages/${id}`, 'stages', id, payload);
  }

  deleteTenderStage(id: number): Observable<void> {
    return this.deleteLookupViaApi(`tender-stages/${id}`, 'stages', id);
  }

  /* Types of projects */

  getTypesOfProjects(): Observable<TypeOfProject[]> {
    return this.listLookupFromApi<TypeOfProject>('project-types', 'types');
  }

  getTypeOfProject(id: number): Observable<TypeOfProject> {
    return this.singleLookupFromApi<TypeOfProject>(`project-types/${id}`, 'types', id);
  }

  createTypeOfProject(payload: CreateTypeOfProjectDto): Observable<TypeOfProject> {
    return this.createLookupViaApi<TypeOfProject>('project-types', 'types', payload);
  }

  updateTypeOfProject(id: number, payload: UpdateTypeOfProjectDto): Observable<TypeOfProject> {
    return this.updateLookupViaApi<TypeOfProject>(`project-types/${id}`, 'types', id, payload);
  }

  deleteTypeOfProject(id: number): Observable<void> {
    return this.deleteLookupViaApi(`project-types/${id}`, 'types', id);
  }

  /* Owner types */

  getOwnerTypes(): Observable<OwnerType[]> {
    return this.listLookupFromApi<OwnerType>('owner-types', 'ownerTypes');
  }

  getOwnerType(id: number): Observable<OwnerType> {
    return this.singleLookupFromApi<OwnerType>(`owner-types/${id}`, 'ownerTypes', id);
  }

  createOwnerType(payload: CreateOwnerTypeDto): Observable<OwnerType> {
    return this.createLookupViaApi<OwnerType>('owner-types', 'ownerTypes', payload);
  }

  updateOwnerType(id: number, payload: UpdateOwnerTypeDto): Observable<OwnerType> {
    return this.updateLookupViaApi<OwnerType>(`owner-types/${id}`, 'ownerTypes', id, payload);
  }

  deleteOwnerType(id: number): Observable<void> {
    return this.deleteLookupViaApi(`owner-types/${id}`, 'ownerTypes', id);
  }

  /* Degrees of importance */

  getDegreesOfImportances(): Observable<DegreeOfImportance[]> {
    return this.listLookupFromApi<DegreeOfImportance>('importance-levels', 'degrees');
  }

  getDegreeOfImportance(id: number): Observable<DegreeOfImportance> {
    return this.singleLookupFromApi<DegreeOfImportance>(`importance-levels/${id}`, 'degrees', id);
  }

  createDegreeOfImportance(payload: CreateDegreeOfImportanceDto): Observable<DegreeOfImportance> {
    return this.createLookupViaApi<DegreeOfImportance>('importance-levels', 'degrees', payload);
  }

  updateDegreeOfImportance(
    id: number,
    payload: UpdateDegreeOfImportanceDto
  ): Observable<DegreeOfImportance> {
    return this.updateLookupViaApi<DegreeOfImportance>(
      `importance-levels/${id}`,
      'degrees',
      id,
      payload
    );
  }

  deleteDegreeOfImportance(id: number): Observable<void> {
    return this.deleteLookupViaApi(`importance-levels/${id}`, 'degrees', id);
  }

  /* Aggregated load */

  loadAllLookups() {
    if (this.mockMode) {
      return of({
        countries: listLookup('countries'),
        owners: listLookup('owners'),
        ownerTypes: listLookup('ownerTypes'),
        statuses: listLookup('statuses'),
        stages: listLookup('stages'),
        types: listLookup('types'),
        degreesOfImportance: listLookup('degrees')
      });
    }

    return forkJoin({
      countries: this.getCountries(),
      owners: this.getOwners(),
      ownerTypes: this.getOwnerTypes(),
      statuses: this.getStatuses(),
      stages: this.getTenderStages(),
      types: this.getTypesOfProjects(),
      degreesOfImportance: this.getDegreesOfImportances()
    });
  }
}

type LookupKey = keyof typeof mockLookupStore;

const mockLookupStore = {
  statuses: [
    { id: 1, name: 'New' },
    { id: 2, name: 'Under Study' },
    { id: 3, name: 'Pricing' },
    { id: 4, name: 'Submitted' },
    { id: 5, name: 'Won' },
    { id: 6, name: 'Lost' },
    { id: 7, name: 'On Hold' }
  ],
  stages: [
    { id: 1, name: 'Prequalification' },
    { id: 2, name: 'Technical Submission' },
    { id: 3, name: 'Commercial Submission' },
    { id: 4, name: 'Negotiation' },
    { id: 5, name: 'Award' }
  ],
  types: [
    { id: 1, name: 'Infrastructure' },
    { id: 2, name: 'Residential' },
    { id: 3, name: 'Healthcare' },
    { id: 4, name: 'Hospitality' }
  ],
  degrees: [
    { id: 1, name: 'Critical' },
    { id: 2, name: 'High' },
    { id: 3, name: 'Medium' },
    { id: 4, name: 'Low' }
  ],
  owners: [
    { id: 1, name: 'Aurora Developers', email: 'aurora@engineers-salary-reference.sa', countryId: 1 },
    { id: 2, name: 'Helios Construction', email: 'contact@helios.sa', countryId: 1 },
    { id: 3, name: 'Delta Housing', email: 'info@deltahousing.eg', countryId: 2 },
    { id: 4, name: 'Palm Resorts', email: 'projects@palmresorts.ae', countryId: 3 }
  ],
  ownerTypes: [
    { id: 1, name: 'Government' },
    { id: 2, name: 'Private' },
    { id: 3, name: 'Developer' },
    { id: 4, name: 'Joint Venture' }
  ],
  countries: [
    { id: 1, name: 'Saudi Arabia' },
    { id: 2, name: 'Egypt' },
    { id: 3, name: 'UAE' }
  ]
};

const lookupStore = mockLookupStore;

const lookupSequences: Record<LookupKey, number> = {
  countries: nextId(lookupStore.countries),
  owners: nextId(lookupStore.owners),
  ownerTypes: nextId(lookupStore.ownerTypes),
  statuses: nextId(lookupStore.statuses),
  stages: nextId(lookupStore.stages),
  types: nextId(lookupStore.types),
  degrees: nextId(lookupStore.degrees)
};

function listLookup(key: LookupKey) {
  return lookupStore[key].map(item => ({ ...item }));
}

function getLookup(key: LookupKey, id: number) {
  const found = lookupStore[key].find(item => item.id === id);
  return found ? { ...found } : null;
}

function createLookup(key: LookupKey, payload: LooseValue) {
  const item = { id: lookupSequences[key]++, ...payload };
  lookupStore[key].push(item);
  return { ...item };
}

function updateLookup(key: LookupKey, id: number, payload: LooseValue) {
  const index = lookupStore[key].findIndex(item => item.id === id);
  if (index === -1) {
    return null;
  }

  const updated = { ...lookupStore[key][index], ...payload, id };
  lookupStore[key][index] = updated;
  return { ...updated };
}

function deleteLookup(key: LookupKey, id: number) {
  const index = lookupStore[key].findIndex(item => item.id === id);
  if (index !== -1) {
    lookupStore[key].splice(index, 1);
  }
}

function nextId(items: Array<{ id: number }>): number {
  return items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}
