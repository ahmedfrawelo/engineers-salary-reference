import { Injectable, inject } from '@angular/core';
import { forkJoin, map, Observable, of, throwError } from 'rxjs';
import { catchError, finalize, shareReplay, switchMap, tap } from 'rxjs/operators';
import { ApiClient } from '@infrastructure/http/api-client.service';
import {
  LookupsApi,
  LookupCustomization,
  type IdName,
  type Owner,
  type OwnerType
} from '@shared/services/lookups.api';
import { environment } from '@env/environment';
import { runtimeConfig } from '@core/runtime-config';
import { mockLookupStore, mockProjectStore, mockProjectIdSeed } from './projects.mock-data';
import type { CheckList } from './checklists.api';
import {
  ApiResponse,
  ApiResponseLike,
  PaginatedData,
  PaginationMeta,
  PagedGroupSummary,
  PagedGroupingMeta,
  extractItemsAndPaginationMeta,
  unwrapApiResponse
} from '@infrastructure/http/api-response.util';
import { TENDER_PROJECTS_ENDPOINTS } from './tender-projects-endpoints';

type LooseValue = ReturnType<typeof JSON.parse>;
/* ====== Read types (aligned with backend DTOs) ====== */
export type TenderProject = {
  id: number;
  name: string;
  description: string | null;

  ownerId: number;
  ownerName: string;
  ownerTypeId: number | null;
  ownerTypeName: string | null;

  statusId: number;
  statusName: string;
  tenderStageId: number;
  tenderStageName: string;

  typeOfProjectId: number;
  typeOfProjectName: string;
  degreeOfImportanceId: number;
  degreeOfImportanceName: string;

  countryId: number;
  countryName: string;

  assignTo: string | null;
  inCharge: string | null;
  consultant: string | null;

  startDate: string | null;
  acceptDate: string | null;
  deadline: string | null;
  endDate: string | null;

  price: number | null;
  prb: number | null;
  delayReasons: string | null;
  tone: string | null;
  customLabel: string | null;
  createdAt: string | null;
};

type SalaryReportTableDto = {
  id: string;
  discipline: string;
  companyType: string;
  city: string;
  country: string;
  monthlyNetSalary: number;
  currency: string;
  yearsOfExperience: number;
  workMode: string;
  housingProvided?: string | null;
  transportationProvided?: string | null;
  annualBonus?: string | null;
  salaryFairness?: string | null;
  recommendField?: string | null;
  negotiationAdvice?: string | null;
  professionalCertificate?: string | null;
  benefits?: string | null;
  highestEducation?: string | null;
  dailyWorkHours?: number | null;
  extraDayOff?: string | null;
};

type SalaryReportPageDto = {
  items: SalaryReportTableDto[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
};

export type ListParams = {
  page?: number;
  pageNumber?: number;
  pageSize?: number;
  size?: number;
  search?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  groupBy?: string;
  groupDirection?: 'asc' | 'desc';
  groupDateInterval?: 'day' | 'week' | 'month' | 'quarter' | 'year';
  filters?: string;
};
export type FilterOptionsParams = {
  field: string;
  search?: string;
  filters?: string;
  optionSearch?: string;
  take?: number;
};
export type ProjectListFilter = {
  field: string;
  operator: string;
  value?: unknown;
  joinWithPrev?: 'and' | 'or';
};
export type ProjectAggregateScope = 'page' | 'filtered' | 'all';
export type ProjectAggregateOperation =
  | 'sum'
  | 'avg'
  | 'count'
  | 'min'
  | 'max'
  | 'distinct'
  | 'median'
  | 'percent';
export type ProjectAggregateRequest = {
  field: string;
  operation: ProjectAggregateOperation;
};
export type GetProjectAggregatesRequest = ListParams & {
  scope: ProjectAggregateScope;
  aggregates: ProjectAggregateRequest[];
};
export type ProjectAggregateResult = {
  field: string;
  operation: ProjectAggregateOperation;
  value: unknown;
};
export type ProjectAggregatesResponse = {
  scope: ProjectAggregateScope;
  totalRows: number;
  aggregates: ProjectAggregateResult[];
};
export type ProjectListGroupSummary = PagedGroupSummary;
export type ProjectListGroupingMeta = PagedGroupingMeta & {
  dateInterval?: 'day' | 'week' | 'month' | 'quarter' | 'year' | null;
};
type LookupPayload = { name: string } & LookupCustomization;
type UpdateLookupPayload = { id: number; name: string } & LookupCustomization;
type OwnerLookupPayload = {
  name: string;
  email?: string;
  address?: string;
  phoneFax?: string;
  mobile?: string;
  notes?: string;
  countryId?: number | null;
} & LookupCustomization;
type OwnerLookupUpdatePayload = OwnerLookupPayload & { id?: number };
export type ProjectPersonSettingScope = 'assignTo' | 'inCharge';
type ProjectPersonSetting = IdName;

const sanitizeLookupPayload = <TPayload extends Record<string, unknown>>(
  payload: TPayload
): TPayload =>
  Object.fromEntries(
    Object.entries(payload).filter(([key, value]) => {
      if (key === 'id' || key === 'name') {
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
  ) as TPayload;

const normalizeListParams = (params?: ListParams): ListParams | undefined => {
  if (!params) return params;
  const normalized: ListParams = { ...params };
  if (normalized.pageNumber == null && normalized.page != null) {
    normalized.pageNumber = normalized.page;
  }
  if (normalized.page == null && normalized.pageNumber != null) {
    normalized.page = normalized.pageNumber;
  }
  if (normalized.pageSize == null && normalized.size != null) {
    normalized.pageSize = normalized.size;
  }
  if (normalized.size == null && normalized.pageSize != null) {
    normalized.size = normalized.pageSize;
  }
  return normalized;
};

const stableNumericId = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) || 1;
};

const mapSalaryReportToProject = (report: SalaryReportTableDto): TenderProject => ({
  id: stableNumericId(report.id),
  name: report.discipline,
  description: report.negotiationAdvice ?? null,
  ownerId: stableNumericId(report.country),
  ownerName: report.country,
  ownerTypeId: null,
  ownerTypeName: report.city,
  statusId: stableNumericId(report.annualBonus ?? 'Not specified'),
  statusName: report.annualBonus ?? 'Not specified',
  tenderStageId: stableNumericId(report.companyType),
  tenderStageName: report.companyType,
  typeOfProjectId: stableNumericId(report.currency),
  typeOfProjectName: report.currency,
  degreeOfImportanceId: stableNumericId(report.recommendField ?? 'Not specified'),
  degreeOfImportanceName: report.recommendField ?? 'Not specified',
  countryId: stableNumericId(report.professionalCertificate ?? 'Not specified'),
  countryName: report.professionalCertificate ?? 'Not specified',
  assignTo: report.housingProvided ?? null,
  inCharge: report.benefits ?? null,
  consultant: report.salaryFairness ?? null,
  startDate: report.companyType,
  acceptDate: report.transportationProvided ?? null,
  deadline: String(report.yearsOfExperience),
  endDate: report.workMode,
  price: report.monthlyNetSalary,
  prb: report.dailyWorkHours ?? null,
  delayReasons: report.highestEducation ?? null,
  tone: null,
  customLabel: report.currency,
  createdAt: report.extraDayOff ?? null
});

const toSalaryReportLookup = (values: string[]): IdName[] =>
  [...new Set(values.filter(Boolean))].map((name, index) => ({ id: index + 1, name }));

const toSalaryBootstrap = (
  reports: SalaryReportTableDto[],
  meta?: PaginationMeta | null
): ProjectBootstrapResponse => {
  const items = reports.map(mapSalaryReportToProject);
  return {
    projects: {
      items,
      meta: meta ?? { totalCount: items.length, pageNumber: 1, pageSize: items.length, totalPages: 1 }
    },
    lookups: {
      countries: toSalaryReportLookup(reports.map(report => report.country)),
      owners: toSalaryReportLookup(reports.map(report => report.country)),
      ownerTypes: toSalaryReportLookup(reports.map(report => report.city)),
      statuses: toSalaryReportLookup(reports.map(report => report.annualBonus ?? 'Not specified')),
      stages: toSalaryReportLookup(reports.map(report => report.companyType)),
      types: toSalaryReportLookup(reports.map(report => report.currency)),
      degreesOfImportance: toSalaryReportLookup(reports.map(report => report.workMode)),
      assignToSettings: toSalaryReportLookup(reports.map(report => report.city)),
      inChargeSettings: toSalaryReportLookup(reports.map(report => report.currency))
    },
    loadedAt: new Date().toISOString()
  };
};

const toSalaryListParams = (params?: ListParams): Record<string, string | number | undefined> => {
  const normalized = normalizeListParams(params) ?? {};
  const sortBy = String(normalized.sortBy ?? '').trim().toLowerCase();
  const salarySortBy = ({
    title: 'discipline', name: 'discipline', owner: 'country', ownername: 'country',
    ownertype: 'city', deadline: 'yearsOfExperience', startdate: 'companyType',
    enddate: 'workMode', price: 'monthlyNetSalary', assignto: 'housingProvided',
    acceptdate: 'transportationProvided', status: 'annualBonus', consultant: 'salaryFairness',
    prb: 'dailyWorkHours', doi: 'recommendField', country: 'professionalCertificate',
    delayreasons: 'highestEducation', createdat: 'extraDayOff'
  } as Record<string, string>)[sortBy] ?? (sortBy || undefined);

  const payload: Record<string, string | number | undefined> = {
    pageNumber: normalized.pageNumber ?? normalized.page ?? 1,
    pageSize: normalized.pageSize ?? normalized.size ?? 100,
    search: normalized.search,
    sortBy: salarySortBy,
    sortDirection: normalized.sortDirection
  };

  if (normalized.filters) {
    try {
      const filters = JSON.parse(normalized.filters) as ProjectListFilter[];
      for (const filter of filters) {
        const field = String(filter.field ?? '').trim().replace(/_/g, '').toLowerCase();
        const operator = String(filter.operator ?? '').trim().toLowerCase();
        const value = String(filter.value ?? '').trim();
        if (!value) continue;
        const target = ({
          title: 'discipline', owner: 'country', ownertype: 'city', deadline: 'yearsOfExperience',
          startdate: 'companyType', enddate: 'workMode', assignto: 'housingProvided',
          acceptdate: 'transportationProvided', status: 'annualBonus', consultant: 'salaryFairness',
          doi: 'recommendField', country: 'professionalCertificate', incharge: 'benefits', delayreasons: 'highestEducation',
          createdat: 'extraDayOff'
        } as Record<string, string>)[field];
        if (target && (operator === 'equals' || operator === 'eq' || operator === 'is')) payload[target] = value;
        const numericValue = Number(value);
        if (field === 'price' && Number.isFinite(numericValue) && (operator === 'gte' || operator === 'greaterthanorequal')) payload.minSalary = numericValue;
        if (field === 'price' && Number.isFinite(numericValue) && (operator === 'lte' || operator === 'lessthanorequal')) payload.maxSalary = numericValue;
        if (field === 'deadline' && Number.isFinite(numericValue) && (operator === 'gte' || operator === 'greaterthanorequal')) payload.minExperience = numericValue;
        if (field === 'deadline' && Number.isFinite(numericValue) && (operator === 'lte' || operator === 'lessthanorequal')) payload.maxExperience = numericValue;
        if (field === 'prb' && Number.isFinite(numericValue) && (operator === 'gte' || operator === 'greaterthanorequal')) payload.minDailyWorkHours = numericValue;
        if (field === 'prb' && Number.isFinite(numericValue) && (operator === 'lte' || operator === 'lessthanorequal')) payload.maxDailyWorkHours = numericValue;
      }
    } catch {
      // Ignore malformed local filter state and keep the server query valid.
    }
  }

  return payload;
};

const salaryAggregateField = (field: string): string =>
  ({
    title: 'discipline',
    owner: 'country',
    ownername: 'country',
    ownertype: 'city',
    deadline: 'yearsOfExperience',
    startdate: 'companyType',
    enddate: 'workMode',
    top: 'currency',
    price: 'monthlyNetSalary',
    assignto: 'housingProvided',
    acceptdate: 'transportationProvided',
    status: 'annualBonus',
    consultant: 'salaryFairness',
    prb: 'dailyWorkHours',
    doi: 'recommendField',
    country: 'professionalCertificate',
    incharge: 'benefits',
    delayreasons: 'highestEducation',
    createdat: 'extraDayOff',
    description: 'negotiationAdvice'
  } as Record<string, string>)[normalizeProjectAggregateField(field)] ?? field;

const toApiListParams = (
  params?: ListParams
): Record<string, string | number | boolean | undefined> | undefined => {
  const normalized = normalizeListParams(params);
  if (!normalized) return normalized;
  const { page, pageNumber, pageSize, size, ...rest } = normalized;
  const resolvedPageNumber = pageNumber ?? page;
  const resolvedPageSize = pageSize ?? size;
  const payload: Record<string, string | number | boolean | undefined> = { ...rest };
  if (resolvedPageNumber != null) {
    payload.pageNumber = resolvedPageNumber;
  }
  if (resolvedPageSize != null) {
    payload.pageSize = resolvedPageSize;
  }
  return payload;
};

const FILTER_OPTIONS_CACHE_TTL_MS = 30_000;

const buildFilterOptionsCacheKey = (
  payload: Record<string, string | number | boolean | undefined>
): string =>
  Object.entries(payload)
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('&');

/* ====== Write types (Create / Update DTOs) ====== */
export type CreateProjectDto = {
  name?: string | null;
  description?: string | null;
  delayReasons?: string | null;
  assignTo?: string | null;
  inCharge?: string | null;
  consultant?: string | null;

  startDate?: string | null; // ISO date-time
  acceptDate?: string | null;
  deadline?: string | null;
  endDate?: string | null;

  prb?: number | null;
  price: number | null;
  tone?: string | null;
  customLabel?: string | null;

  ownerId: number | null;
  ownerTypeId: number | null;
  statusId: number | null;
  typeOfProjectId: number | null;
  degreeOfImportanceId: number | null;
  tenderStageId: number | null;
  countryId: number | null;
};

export type UpdateProjectDto = Partial<CreateProjectDto> & { id: number };

export type ActivityFeedChange = {
  field: string;
  oldValue?: string | null;
  newValue?: string | null;
};

export type ProjectActivityFeedItem = {
  type: 0 | 1 | 'System' | 'Comment'; // 0=System, 1=Comment
  id: number;
  entityType: string;
  entityId: number;
  createdByUserName: string;
  createdAt: string;
  transactionId?: string | null;
  // System log fields
  actionType?: string | null;
  fieldName?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  changes?: ActivityFeedChange[] | null; // multiple field changes grouped by TransactionId
  // Comment fields
  body?: string | null;
  hasMentions?: boolean;
  mentionedUserNames?: string[];
};

export type ActivityFeedRequestOptions = {
  includeSupplemental?: boolean;
};

export type ProjectDetailsRequestOptions = {
  includeActivity?: boolean;
  includeSupplementalActivity?: boolean;
};

export type ProjectDetailsResponse = {
  project: TenderProject;
  checklists: CheckList[];
  activity: ProjectActivityFeedItem[];
  includesActivity: boolean;
  includesSupplementalActivity: boolean;
  loadedAt: string;
};

export type ProjectBootstrapResponse = {
  projects: { items: TenderProject[]; meta: PaginationMeta | null };
  lookups: {
    countries: IdName[];
    owners: IdName[];
    ownerTypes: IdName[];
    statuses: IdName[];
    stages: IdName[];
    types: IdName[];
    degreesOfImportance: IdName[];
    assignToSettings: IdName[];
    inChargeSettings: IdName[];
  };
  loadedAt?: string | null;
};

/* ====== Re-export shared types from LookupsApi ====== */
export type { IdName } from '@shared/services/lookups.api';

/**
 * Main API service for Tender Projects.
 *
 * Responsibilities:
 * - Server-driven list (pagination, search, sort, filters)
 * - Project CRUD (create, update, delete)
 * - Bootstrap endpoint (projects + all lookup data in one call)
 * - Activity feed and checklists delegation
 * - Lookups (Status, Stage, Type, Degree, Owner, Country) via LookupsApi
 * - Person settings (AssignTo, InCharge) via dedicated endpoints
 */
@Injectable({ providedIn: 'root' })
export class TenderProjectsApi {
  private api = inject(ApiClient);
  private lookupsApi = inject(LookupsApi);
  private readonly initialRuntime = runtimeConfig();
  private readonly filterOptionsCache = new Map<string, { expiresAt: number; values: string[] }>();
  private readonly filterOptionsInflight = new Map<string, Observable<string[]>>();

  private get mockMode(): boolean {
    const current = runtimeConfig();
    const runtimeFlag = current.useMock ?? this.initialRuntime.useMock;
    const resolved = Boolean(runtimeFlag ?? environment.useMock);
    // Prevent runtime mock override from hijacking project CRUD when the build is configured
    // for real backend mode; otherwise users can get local-only "saved" rows.
    if (!environment.useMock && resolved) {
      return false;
    }
    return resolved;
  }

  private toCreatePayload(input: string | LookupPayload): LookupPayload {
    return typeof input === 'string' ? { name: input } : input;
  }

  private toUpdatePayload(
    id: number,
    input: string | LookupPayload,
    meta?: LookupCustomization
  ): UpdateLookupPayload {
    if (typeof input === 'string') {
      return { id, name: input, ...(meta ?? {}) };
    }
    return { id, ...input };
  }

  private listProjectPersonSettings(
    scope: ProjectPersonSettingScope
  ): Observable<ProjectPersonSetting[]> {
    if (this.mockMode) {
      return of(listMockProjectPersonSettings(scope));
    }

    return this.api
      .get<
        ApiResponseLike<ProjectPersonSetting[]>
      >(TENDER_PROJECTS_ENDPOINTS.projectPeopleSettings(scope))
      .pipe(map(res => unwrapApiResponse(res) ?? []));
  }

  private createProjectPersonSetting(
    scope: ProjectPersonSettingScope,
    payload: LookupPayload
  ): Observable<ProjectPersonSetting> {
    if (this.mockMode) {
      const created = createMockProjectPersonSetting(scope, payload);
      this.clearFilterOptionsCache();
      return of(created);
    }

    const sanitizedPayload = sanitizeLookupPayload(payload);
    return this.api
      .post<
        ApiResponseLike<ProjectPersonSetting>
      >(TENDER_PROJECTS_ENDPOINTS.projectPeopleSettings(scope), sanitizedPayload)
      .pipe(
        map(res => unwrapApiResponse(res)),
        tap(() => this.clearFilterOptionsCache())
      );
  }

  private updateProjectPersonSetting(
    scope: ProjectPersonSettingScope,
    id: number,
    payload: UpdateLookupPayload
  ): Observable<ProjectPersonSetting> {
    if (this.mockMode) {
      const updated = updateMockProjectPersonSetting(scope, id, payload);
      if (!updated) {
        return throwError(() => new Error(`Mock ${scope} setting with id ${id} not found`));
      }
      this.clearFilterOptionsCache();
      return of(updated);
    }

    const sanitizedPayload = sanitizeLookupPayload(payload);
    return this.api
      .put<
        ApiResponseLike<ProjectPersonSetting>
      >(TENDER_PROJECTS_ENDPOINTS.projectPeopleSettingById(scope, id), sanitizedPayload)
      .pipe(
        map(res => unwrapApiResponse(res)),
        tap(() => this.clearFilterOptionsCache())
      );
  }

  private deleteProjectPersonSetting(
    scope: ProjectPersonSettingScope,
    id: number
  ): Observable<void> {
    if (this.mockMode) {
      deleteMockProjectPersonSetting(scope, id);
      this.clearFilterOptionsCache();
      return of(void 0);
    }

    return this.api
      .delete<ApiResponseLike<null>>(TENDER_PROJECTS_ENDPOINTS.projectPeopleSettingById(scope, id))
      .pipe(
        tap(() => this.clearFilterOptionsCache()),
        map(() => void 0)
      );
  }

  /* ---------- Projects CRUD ---------- */

  // GET /api/Projects (with pagination & filtering)
  list(params?: ListParams): Observable<TenderProject[]> {
    return this.listWithMeta(params).pipe(map(res => res.items ?? []));
  }

  listWithMeta(
    params?: ListParams
  ): Observable<{ items: TenderProject[]; meta: PaginationMeta | null }> {
    if (this.mockMode) {
      return of(listFromStoreWithMeta(params));
    }

    return this.api
      .get<SalaryReportPageDto>('salary-reports/read-rows', toSalaryListParams(params))
      .pipe(
        map(response => {
          const items = response.items.map(mapSalaryReportToProject);
          return {
            items,
            meta: {
              totalCount: response.totalCount,
              pageNumber: response.pageNumber,
              pageSize: response.pageSize,
              totalPages: response.totalPages,
              hasNextPage: response.pageNumber < response.totalPages,
              hasPreviousPage: response.pageNumber > 1
            } as PaginationMeta
          };
        })
      );
  }

  getBootstrap(params?: ListParams): Observable<ProjectBootstrapResponse> {
    if (this.mockMode) {
      return forkJoin({
        lookups: this.lookupsApi.loadAllLookups(),
        projects: of(listFromStoreWithMeta(params)),
        assignToSettings: this.listProjectPersonSettings('assignTo'),
        inChargeSettings: this.listProjectPersonSettings('inCharge')
      }).pipe(
        map(({ lookups, projects, assignToSettings, inChargeSettings }) => ({
          projects,
          lookups: {
            ...lookups,
            assignToSettings,
            inChargeSettings
          },
          loadedAt: new Date().toISOString()
        }))
      );
    }

    return this.api
      .get<SalaryReportPageDto>('salary-reports/read-rows', toSalaryListParams(params))
      .pipe(
        map(response =>
          toSalaryBootstrap(response.items, {
            totalCount: response.totalCount,
            pageNumber: response.pageNumber,
            pageSize: response.pageSize,
            totalPages: response.totalPages,
            hasNextPage: response.pageNumber < response.totalPages,
            hasPreviousPage: response.pageNumber > 1
          })
        )
      );
  }

  getFilterOptions(params: FilterOptionsParams): Observable<string[]> {
    if (this.mockMode) {
      const items = applyListParams({ search: params.search });
      const normalizedField = String(params.field ?? '')
        .trim()
        .replace(/_/g, '')
        .toLowerCase();

      const values = items
        .map(project => {
          switch (normalizedField) {
            case 'title':
              return project.name ?? '';
            case 'owner':
              return project.ownerName ?? '';
            case 'ownertype':
              return project.ownerTypeName ?? '';
            case 'deadline':
              return project.deadline ?? '';
            case 'startdate':
              return project.startDate ?? '';
            case 'enddate':
              return project.endDate ?? '';
            case 'top':
              return project.typeOfProjectName ?? '';
            case 'assignto':
              return project.assignTo ?? '';
            case 'acceptdate':
              return project.acceptDate ?? '';
            case 'status':
              return project.statusName ?? '';
            case 'consultant':
              return project.consultant ?? '';
            case 'doi':
              return project.degreeOfImportanceName ?? '';
            case 'country':
              return project.countryName ?? '';
            case 'incharge':
              return project.inCharge ?? '';
            case 'delayreasons':
              return project.delayReasons ?? '';
            default:
              return '';
          }
        })
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

      const filtered = params.optionSearch
        ? values.filter(value =>
            value.toLowerCase().includes(
              String(params.optionSearch ?? '')
                .trim()
                .toLowerCase()
            )
          )
        : values;

      return of(
        Array.from(new Set(filtered.map(value => value.trim()))).slice(
          0,
          Math.max(1, params.take ?? 2000)
        )
      );
    }

    const payload: Record<string, string | number | boolean | undefined> = {
      ...toSalaryListParams({ search: params.search, filters: params.filters }),
      field: salaryAggregateField(params.field),
      optionSearch: params.optionSearch,
      take: params.take
    };

    const cacheKey = buildFilterOptionsCacheKey(payload);
    const cached = this.filterOptionsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return of([...cached.values]);
    }

    const inflight = this.filterOptionsInflight.get(cacheKey);
    if (inflight) {
      return inflight;
    }

    const request$ = this.api
      .get<string[]>('salary-reports/read-rows/filter-options', payload)
      .pipe(
        tap(values =>
          this.filterOptionsCache.set(cacheKey, {
            expiresAt: Date.now() + FILTER_OPTIONS_CACHE_TTL_MS,
            values: [...values]
          })
        ),
        finalize(() => this.filterOptionsInflight.delete(cacheKey)),
        shareReplay({ bufferSize: 1, refCount: false })
      );

    this.filterOptionsInflight.set(cacheKey, request$);
    return request$;
  }

  getAggregates(request: GetProjectAggregatesRequest): Observable<ProjectAggregatesResponse> {
    if (this.mockMode) {
      return of(calculateMockProjectAggregates(request));
    }

    const filters = toSalaryListParams(request);
    const payload = {
      filters,
      scope: request.scope,
      aggregates: request.aggregates.map(aggregate => ({
        field: salaryAggregateField(aggregate.field),
        operation: aggregate.operation,
        resultKey: aggregate.field
      }))
    };

    return this.api
      .post<ProjectAggregatesResponse>('salary-reports/read-rows/aggregates', payload)
      .pipe(map(response => normalizeProjectAggregatesResponse(response)));
  }

  // GET /api/Projects/{id}
  get(id: number): Observable<TenderProject> {
    if (this.mockMode) {
      const found = findProject(id);
      if (!found) {
        return throwError(() => new Error(`Mock project with id ${id} not found`));
      }
      return of(found);
    }

    return this.api
      .get<
        ApiResponse<TenderProject | ProjectDetailsResponse> | TenderProject | ProjectDetailsResponse
      >(TENDER_PROJECTS_ENDPOINTS.projectById(id))
      .pipe(
        map(res => {
          const unwrapped = unwrapApiResponse(res);
          if (unwrapped && typeof unwrapped === 'object' && 'project' in (unwrapped as object)) {
            return (unwrapped as ProjectDetailsResponse).project;
          }
          return unwrapped as TenderProject;
        }),
        catchError(err => {
          if (!environment.production && this.mockMode) {
            const fallback = findProject(id);
            if (fallback) {
              if (environment.enableDebugLogs)
                console.warn('[TenderProjectsApi] Falling back to mock project for GET.', err);
              return of(fallback);
            }
          }
          return throwError(() => err);
        })
      );
  }

  // GET /api/Projects/{id}
  getDetails(
    id: number,
    options?: ProjectDetailsRequestOptions
  ): Observable<ProjectDetailsResponse> {
    if (this.mockMode) {
      const found = findProject(id);
      if (!found) {
        return throwError(() => new Error(`Mock project with id ${id} not found`));
      }
      return of({
        project: found,
        checklists: [],
        activity: [],
        includesActivity: options?.includeActivity !== false,
        includesSupplementalActivity: options?.includeSupplementalActivity === true,
        loadedAt: new Date().toISOString()
      });
    }

    const params: Record<string, boolean> = {};
    if (options?.includeActivity != null) {
      params.includeActivity = options.includeActivity;
    }
    if (options?.includeSupplementalActivity != null) {
      params.includeSupplementalActivity = options.includeSupplementalActivity;
    }

    return this.api
      .get<
        ApiResponse<ProjectDetailsResponse> | ProjectDetailsResponse
      >(TENDER_PROJECTS_ENDPOINTS.projectById(id), Object.keys(params).length ? params : undefined)
      .pipe(
        map(res => unwrapApiResponse(res)),
        catchError(err => {
          if (!environment.production && this.mockMode) {
            const fallback = findProject(id);
            if (fallback) {
              if (environment.enableDebugLogs)
                console.warn('[TenderProjectsApi] Falling back to mock project details.', err);
              return of({
                project: fallback,
                checklists: [],
                activity: [],
                includesActivity: options?.includeActivity !== false,
                includesSupplementalActivity: options?.includeSupplementalActivity === true,
                loadedAt: new Date().toISOString()
              });
            }
          }
          return throwError(() => err);
        })
      );
  }

  // POST /api/Projects
  create(payload: CreateProjectDto): Observable<TenderProject> {
    if (this.mockMode) {
      const created = createMockProject(payload);
      this.clearFilterOptionsCache();
      return of(created);
    }

    return this.api
      .post<ApiResponse<TenderProject> | TenderProject>(TENDER_PROJECTS_ENDPOINTS.projects, payload)
      .pipe(
        map(res => unwrapApiResponse(res)),
        tap(() => this.clearFilterOptionsCache()),
        catchError(err => {
          if (!environment.production && this.mockMode) {
            const created = createMockProject(payload);
            this.clearFilterOptionsCache();
            if (environment.enableDebugLogs) {
              console.warn(
                '[TenderProjectsApi] Backend create failed, using mock project instead.',
                err
              );
            }
            return of(created);
          }
          return throwError(() => err);
        })
      );
  }

  // PUT /api/Projects/{id}
  update(id: number, payload: UpdateProjectDto): Observable<TenderProject> {
    if (this.mockMode) {
      const updated = updateMockProject(id, payload);
      if (!updated) {
        return throwError(() => new Error(`Mock project with id ${id} not found`));
      }
      this.clearFilterOptionsCache();
      return of(updated);
    }

    return this.api
      .put<
        ApiResponse<TenderProject> | TenderProject
      >(TENDER_PROJECTS_ENDPOINTS.projectById(id), payload)
      .pipe(
        map(res => unwrapApiResponse(res)),
        tap(() => this.clearFilterOptionsCache()),
        catchError(err => {
          if (!environment.production && this.mockMode) {
            const updated = updateMockProject(id, payload);
            if (updated) {
              this.clearFilterOptionsCache();
              if (environment.enableDebugLogs) {
                console.warn(
                  '[TenderProjectsApi] Backend update failed, using mock project instead.',
                  err
                );
              }
              return of(updated);
            }
          }
          return throwError(() => err);
        })
      );
  }

  updateAssignTo(id: number, assignTo: string | null): Observable<TenderProject> {
    if (this.mockMode) {
      const updated = updateMockProject(id, { id, assignTo });
      if (!updated) {
        return throwError(() => new Error(`Mock project with id ${id} not found`));
      }
      this.clearFilterOptionsCache();
      return of(updated);
    }

    return this.api
      .patch<ApiResponse<TenderProject> | TenderProject>(
        TENDER_PROJECTS_ENDPOINTS.projectAssignment(id),
        { assignTo }
      )
      .pipe(
        map(res => unwrapApiResponse(res)),
        tap(() => this.clearFilterOptionsCache()),
        catchError(err => {
          if (err?.status !== 404 && err?.status !== 405) {
            return throwError(() => err);
          }
          return this.get(id).pipe(
            switchMap(project =>
              this.update(id, {
                id,
                name: project.name,
                description: project.description,
                delayReasons: project.delayReasons,
                assignTo,
                inCharge: project.inCharge,
                consultant: project.consultant,
                startDate: project.startDate,
                acceptDate: project.acceptDate,
                deadline: project.deadline,
                endDate: project.endDate,
                prb: project.prb,
                price: project.price,
                tone: project.tone,
                customLabel: project.customLabel,
                ownerId: project.ownerId,
                ownerTypeId: project.ownerTypeId,
                statusId: project.statusId,
                typeOfProjectId: project.typeOfProjectId,
                degreeOfImportanceId: project.degreeOfImportanceId,
                tenderStageId: project.tenderStageId,
                countryId: project.countryId
              })
            )
          );
        })
      );
  }

  // GET /api/Projects/{projectId}/activity  (combined activity feed: system logs + comments)
  getActivityFeed(
    projectId: number,
    options?: ActivityFeedRequestOptions
  ): Observable<ProjectActivityFeedItem[]> {
    const params =
      options?.includeSupplemental == null
        ? undefined
        : { includeSupplemental: options.includeSupplemental };

    return this.api
      .get<
        ApiResponseLike<ProjectActivityFeedItem[]>
      >(TENDER_PROJECTS_ENDPOINTS.projectActivity(projectId), params)
      .pipe(map(res => unwrapApiResponse(res) ?? []));
  }

  // DELETE /api/Projects/{id}
  remove(id: number): Observable<void> {
    if (this.mockMode) {
      deleteMockProject(id);
      this.clearFilterOptionsCache();
      return of(void 0);
    }

    return this.api.delete<ApiResponse<null>>(TENDER_PROJECTS_ENDPOINTS.projectById(id)).pipe(
      tap(() => this.clearFilterOptionsCache()),
      map(() => void 0),
      catchError(err => {
        if (!environment.production && this.mockMode) {
          deleteMockProject(id);
          this.clearFilterOptionsCache();
          if (environment.enableDebugLogs) {
            console.warn(
              '[TenderProjectsApi] Backend delete failed, removing from mock store instead.',
              err
            );
          }
          return of(void 0);
        }
        return throwError(() => err);
      })
    );
  }

  /* ---------- Lookups Delegation ---------- */

  /**
   * Loads all lookup lists needed by the project page in one parallel call.
   * Delegates to LookupsApi for each lookup type.
   */
  loadAllLookups() {
    return forkJoin({
      countries: this.lookupsApi.getCountries(),
      owners: this.lookupsApi.getOwners(),
      ownerTypes: this.lookupsApi.getOwnerTypes(),
      statuses: this.lookupsApi.getStatuses(),
      stages: this.lookupsApi.getTenderStages(),
      types: this.lookupsApi.getTypesOfProjects(),
      degreesOfImportance: this.lookupsApi.getDegreesOfImportances(),
      assignToSettings: this.listProjectPersonSettings('assignTo'),
      inChargeSettings: this.listProjectPersonSettings('inCharge')
    });
  }

  // Quick access methods (delegates to LookupsApi)
  countries() {
    return this.lookupsApi.getCountries();
  }
  owners() {
    return this.lookupsApi.getOwners();
  }
  ownerTypes() {
    return this.lookupsApi.getOwnerTypes();
  }
  statuses() {
    return this.lookupsApi.getStatuses();
  }
  typesOfProjects() {
    return this.lookupsApi.getTypesOfProjects();
  }
  degreesOfImportances() {
    return this.lookupsApi.getDegreesOfImportances();
  }
  tenderStages() {
    return this.lookupsApi.getTenderStages();
  }
  assignToSettings() {
    return this.listProjectPersonSettings('assignTo');
  }
  inChargeSettings() {
    return this.listProjectPersonSettings('inCharge');
  }

  // Quick CRUD methods for Lookups (delegates to LookupsApi)
  createStatus(payload: string | LookupPayload) {
    return this.lookupsApi.createStatus(this.toCreatePayload(payload));
  }
  updateStatus(id: number, payload: string | LookupPayload, meta?: LookupCustomization) {
    return this.lookupsApi.updateStatus(id, this.toUpdatePayload(id, payload, meta));
  }
  deleteStatus(id: number) {
    return this.lookupsApi.deleteStatus(id);
  }

  createTenderStage(payload: string | LookupPayload) {
    return this.lookupsApi.createTenderStage(this.toCreatePayload(payload));
  }
  updateTenderStage(id: number, payload: string | LookupPayload, meta?: LookupCustomization) {
    return this.lookupsApi.updateTenderStage(id, this.toUpdatePayload(id, payload, meta));
  }
  deleteTenderStage(id: number) {
    return this.lookupsApi.deleteTenderStage(id);
  }

  createTypeOfProject(payload: string | LookupPayload) {
    return this.lookupsApi.createTypeOfProject(this.toCreatePayload(payload));
  }
  updateTypeOfProject(id: number, payload: string | LookupPayload, meta?: LookupCustomization) {
    return this.lookupsApi.updateTypeOfProject(id, this.toUpdatePayload(id, payload, meta));
  }
  deleteTypeOfProject(id: number) {
    return this.lookupsApi.deleteTypeOfProject(id);
  }

  createDegreeOfImportance(payload: string | LookupPayload) {
    return this.lookupsApi.createDegreeOfImportance(this.toCreatePayload(payload));
  }
  updateDegreeOfImportance(
    id: number,
    payload: string | LookupPayload,
    meta?: LookupCustomization
  ) {
    return this.lookupsApi.updateDegreeOfImportance(id, this.toUpdatePayload(id, payload, meta));
  }
  deleteDegreeOfImportance(id: number) {
    return this.lookupsApi.deleteDegreeOfImportance(id);
  }

  createOwner(
    name: string,
    countryId?: number | null,
    meta?: LookupCustomization
  ): Observable<Owner>;
  createOwner(payload: OwnerLookupPayload): Observable<Owner>;
  createOwner(
    nameOrPayload: string | OwnerLookupPayload,
    countryId?: number | null,
    meta?: LookupCustomization
  ): Observable<Owner> {
    const payload: OwnerLookupPayload =
      typeof nameOrPayload === 'string'
        ? { name: nameOrPayload, countryId: countryId ?? undefined, ...(meta ?? {}) }
        : { ...nameOrPayload, countryId: nameOrPayload.countryId ?? undefined };
    const normalizedPayload = {
      name: payload.name,
      email: payload.email,
      address: payload.address,
      phoneFax: payload.phoneFax,
      mobile: payload.mobile,
      notes: payload.notes,
      countryId: payload.countryId ?? undefined,
      customLabel: payload.customLabel ?? null,
      tone: payload.tone ?? null,
      customHex: payload.customHex ?? null,
      order: payload.order ?? null
    };
    return this.lookupsApi.createOwner(normalizedPayload);
  }
  updateOwner(id: number, name: string, meta?: LookupCustomization): Observable<Owner>;
  updateOwner(id: number, payload: OwnerLookupUpdatePayload): Observable<Owner>;
  updateOwner(
    id: number,
    nameOrPayload: string | OwnerLookupUpdatePayload,
    meta?: LookupCustomization
  ): Observable<Owner> {
    if (typeof nameOrPayload === 'string') {
      return this.lookupsApi.renameOwner(id, { id, name: nameOrPayload });
    }

    const payload: OwnerLookupUpdatePayload = { id, ...nameOrPayload };
    const normalizedPayload = {
      id,
      name: payload.name,
      email: payload.email,
      address: payload.address,
      phoneFax: payload.phoneFax,
      mobile: payload.mobile,
      notes: payload.notes,
      countryId: payload.countryId ?? undefined,
      customLabel: payload.customLabel ?? null,
      tone: payload.tone ?? null,
      customHex: payload.customHex ?? null,
      order: payload.order ?? null
    };
    return this.lookupsApi.updateOwner(id, normalizedPayload);
  }
  deleteOwner(id: number) {
    return this.lookupsApi.deleteOwner(id);
  }

  createOwnerType(payload: string | LookupPayload) {
    return this.lookupsApi.createOwnerType(this.toCreatePayload(payload));
  }
  updateOwnerType(id: number, payload: string | LookupPayload, meta?: LookupCustomization) {
    return this.lookupsApi.updateOwnerType(id, this.toUpdatePayload(id, payload, meta));
  }
  deleteOwnerType(id: number) {
    return this.lookupsApi.deleteOwnerType(id);
  }

  createCountry(payload: string | LookupPayload) {
    return this.lookupsApi.createCountry(this.toCreatePayload(payload));
  }
  updateCountry(id: number, payload: string | LookupPayload, meta?: LookupCustomization) {
    return this.lookupsApi.updateCountry(id, this.toUpdatePayload(id, payload, meta));
  }
  deleteCountry(id: number) {
    return this.lookupsApi.deleteCountry(id);
  }

  createAssignToSetting(payload: string | LookupPayload) {
    return this.createProjectPersonSetting('assignTo', this.toCreatePayload(payload));
  }
  updateAssignToSetting(id: number, payload: string | LookupPayload, meta?: LookupCustomization) {
    return this.updateProjectPersonSetting('assignTo', id, this.toUpdatePayload(id, payload, meta));
  }
  deleteAssignToSetting(id: number) {
    return this.deleteProjectPersonSetting('assignTo', id);
  }

  createInChargeSetting(payload: string | LookupPayload) {
    return this.createProjectPersonSetting('inCharge', this.toCreatePayload(payload));
  }
  updateInChargeSetting(id: number, payload: string | LookupPayload, meta?: LookupCustomization) {
    return this.updateProjectPersonSetting('inCharge', id, this.toUpdatePayload(id, payload, meta));
  }
  deleteInChargeSetting(id: number) {
    return this.deleteProjectPersonSetting('inCharge', id);
  }

  private clearFilterOptionsCache(): void {
    this.filterOptionsCache.clear();
    this.filterOptionsInflight.clear();
  }
}

/* ========= Utility: map name ? id ========= */
export function resolveId(
  list: Array<{ id: number; name: string }>,
  name: string | null | undefined
): number | null {
  if (!name) return null;
  const k = name.toLowerCase().trim();
  const found = list.find(x => (x.name ?? '').toLowerCase().trim() === k);
  return found ? found.id : null;
}

// ===== Mock helpers =====

const projectStore = mockProjectStore;
let nextProjectId = mockProjectIdSeed;

const lookupStore = mockLookupStore;

function applyListParams(params?: ListParams): TenderProject[] {
  let result = projectStore.map(cloneProject);

  if (!params) {
    return result;
  }

  const {
    search,
    sortBy,
    sortDirection = 'asc',
    pageNumber,
    size,
    page: rawPage,
    pageSize: rawPageSize
  } = params;
  const page = rawPage ?? pageNumber ?? 1;
  const pageSize = rawPageSize ?? size ?? (result.length || 10);

  if (search) {
    const term = search.toLowerCase();
    result = result.filter(
      p =>
        (p.name ?? '').toLowerCase().includes(term) ||
        (p.ownerName ?? '').toLowerCase().includes(term) ||
        (p.ownerTypeName ?? '').toLowerCase().includes(term) ||
        (p.consultant ?? '').toLowerCase().includes(term)
    );
  }

  if (sortBy) {
    result = [...result].sort((a, b) => {
      const av = (a as LooseValue)[sortBy];
      const bv = (b as LooseValue)[sortBy];
      if (av == null && bv == null) return 0;
      if (av == null) return sortDirection === 'asc' ? -1 : 1;
      if (bv == null) return sortDirection === 'asc' ? 1 : -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDirection === 'asc' ? av - bv : bv - av;
      }
      return String(av).localeCompare(String(bv)) * (sortDirection === 'asc' ? 1 : -1);
    });
  }

  return result;
}

function calculateMockProjectAggregates(
  request: GetProjectAggregatesRequest
): ProjectAggregatesResponse {
  const scope = normalizeProjectAggregateScope(request.scope);
  const rows =
    scope === 'all'
      ? projectStore.map(cloneProject)
      : scope === 'page'
        ? listFromStoreWithMeta(request).items
        : applyListParams(request);

  return {
    scope,
    totalRows: rows.length,
    aggregates: (request.aggregates ?? []).map(aggregate => {
      const field = normalizeProjectAggregateField(aggregate.field);
      const operation = normalizeProjectAggregateOperation(aggregate.operation);
      return {
        field,
        operation,
        value: calculateMockProjectAggregateValue(rows, field, operation)
      } satisfies ProjectAggregateResult;
    })
  };
}

function calculateMockProjectAggregateValue(
  rows: TenderProject[],
  field: string,
  operation: ProjectAggregateOperation
): unknown {
  if (operation === 'count') {
    return rows.length;
  }

  if (rows.length === 0) {
    return null;
  }

  const values = rows
    .map(row => getProjectAggregateFieldValue(row, field))
    .filter(value => value !== null && value !== undefined && value !== '');

  if (operation === 'distinct') {
    return new Set(values.map(value => String(value).trim().toLowerCase())).size;
  }

  if (operation === 'percent') {
    return 100;
  }

  const numericValues = values
    .map(value => (typeof value === 'number' ? value : Number(value)))
    .filter((value): value is number => Number.isFinite(value));

  if (operation === 'sum') {
    return numericValues.length ? numericValues.reduce((sum, value) => sum + value, 0) : null;
  }

  if (operation === 'avg') {
    return numericValues.length
      ? numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length
      : null;
  }

  if (operation === 'median') {
    if (!numericValues.length) {
      return null;
    }
    const ordered = [...numericValues].sort((left, right) => left - right);
    const middle = Math.floor(ordered.length / 2);
    return ordered.length % 2 === 0 ? (ordered[middle - 1] + ordered[middle]) / 2 : ordered[middle];
  }

  if (isProjectAggregateDateField(field)) {
    const dateValues = values
      .map(value => new Date(String(value)))
      .filter(value => !Number.isNaN(value.getTime()));
    if (!dateValues.length) {
      return null;
    }
    const ordered = [...dateValues].sort((left, right) => left.getTime() - right.getTime());
    return (operation === 'min' ? ordered[0] : ordered[ordered.length - 1]).toISOString();
  }

  if (numericValues.length) {
    return operation === 'min' ? Math.min(...numericValues) : Math.max(...numericValues);
  }

  const textValues = values.map(value => String(value).trim()).filter(Boolean);
  if (!textValues.length) {
    return null;
  }

  const ordered = [...textValues].sort((left, right) =>
    left.localeCompare(right, 'en', { sensitivity: 'base', numeric: true })
  );
  return operation === 'min' ? ordered[0] : ordered[ordered.length - 1];
}

function getProjectAggregateFieldValue(row: TenderProject, field: string): unknown {
  switch (normalizeProjectAggregateField(field)) {
    case 'title':
      return row.name ?? null;
    case 'owner':
      return row.ownerName ?? null;
    case 'ownertype':
      return row.ownerTypeName ?? null;
    case 'deadline':
      return row.deadline ?? null;
    case 'startdate':
      return row.startDate ?? null;
    case 'enddate':
      return row.endDate ?? null;
    case 'top':
      return row.typeOfProjectName ?? null;
    case 'ts':
      return row.tenderStageName ?? null;
    case 'price':
      return row.price ?? null;
    case 'assignto':
      return row.assignTo ?? null;
    case 'acceptdate':
      return row.acceptDate ?? null;
    case 'status':
      return row.statusName ?? null;
    case 'consultant':
      return row.consultant ?? null;
    case 'prb':
      return row.prb ?? null;
    case 'doi':
      return row.degreeOfImportanceName ?? null;
    case 'country':
      return row.countryName ?? null;
    case 'incharge':
      return row.inCharge ?? null;
    case 'delayreasons':
      return row.delayReasons ?? null;
    default:
      return null;
  }
}

function normalizeProjectAggregateField(field: unknown): string {
  return String(field ?? '')
    .trim()
    .replace(/_/g, '')
    .toLowerCase();
}

function normalizeProjectAggregateScope(scope: unknown): ProjectAggregateScope {
  return scope === 'page' || scope === 'all' || scope === 'filtered' ? scope : 'filtered';
}

function normalizeProjectAggregateOperation(operation: unknown): ProjectAggregateOperation {
  switch (normalizeProjectAggregateField(operation)) {
    case 'sum':
      return 'sum';
    case 'avg':
    case 'average':
      return 'avg';
    case 'count':
      return 'count';
    case 'min':
      return 'min';
    case 'max':
      return 'max';
    case 'distinct':
    case 'distinctcount':
    case 'countdistinct':
      return 'distinct';
    case 'median':
      return 'median';
    case 'percent':
      return 'percent';
    default:
      return 'count';
  }
}

function isProjectAggregateDateField(field: string): boolean {
  const normalized = normalizeProjectAggregateField(field);
  return (
    normalized === 'deadline' ||
    normalized === 'startdate' ||
    normalized === 'enddate' ||
    normalized === 'acceptdate'
  );
}

function listFromStoreWithMeta(params?: ListParams): {
  items: TenderProject[];
  meta: PaginationMeta;
} {
  const result = applyListParams(params);
  const normalized = normalizeListParams(params) ?? {};
  const page = normalized.pageNumber ?? normalized.page ?? 1;
  const pageSize = normalized.pageSize ?? normalized.size ?? (result.length || 10);
  const totalCount = result.length;
  const totalPages = pageSize > 0 ? Math.ceil(totalCount / pageSize) : totalCount > 0 ? 1 : 0;
  const start = Math.max((page - 1) * pageSize, 0);
  const end = start + pageSize;
  const items = result.slice(start, end);

  return {
    items,
    meta: {
      totalCount,
      pageNumber: page,
      pageSize,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1
    }
  };
}

function extractItemsAndMeta<T>(res: ApiResponseLike<T[] | PaginatedData<T>>): {
  items: T[];
  meta: PaginationMeta | null;
} {
  const result = extractItemsAndPaginationMeta<T>(res);
  const grouping = result.meta?.grouping;
  const interval = String(grouping?.dateInterval ?? '').toLowerCase();
  return {
    items: result.items,
    meta: result.meta
      ? {
          ...result.meta,
          grouping: grouping
            ? {
                ...grouping,
                dateInterval:
                  interval === 'day' ||
                  interval === 'week' ||
                  interval === 'month' ||
                  interval === 'quarter' ||
                  interval === 'year'
                    ? interval
                    : null
              }
            : null
        }
      : null
  };
}

function normalizeBootstrapResponse(payload: unknown): ProjectBootstrapResponse {
  const record = (payload ?? {}) as Record<string, unknown>;
  const projectsPayload = (record.projects ?? record.Projects ?? []) as
    | ApiResponseLike<TenderProject[] | PaginatedData<TenderProject>>
    | undefined;

  return {
    projects: extractItemsAndMeta<TenderProject>(projectsPayload ?? []),
    lookups: {
      countries: normalizeLookupList(record.countries ?? record.Countries),
      owners: normalizeLookupList(record.owners ?? record.Owners),
      ownerTypes: normalizeLookupList(record.ownerTypes ?? record.OwnerTypes),
      statuses: normalizeLookupList(record.statuses ?? record.Statuses),
      stages: normalizeLookupList(record.stages ?? record.Stages),
      types: normalizeLookupList(record.types ?? record.Types),
      degreesOfImportance: normalizeLookupList(
        record.degreesOfImportance ?? record.DegreesOfImportance
      ),
      assignToSettings: normalizeLookupList(record.assignToSettings ?? record.AssignToSettings),
      inChargeSettings: normalizeLookupList(record.inChargeSettings ?? record.InChargeSettings)
    },
    loadedAt:
      typeof record.loadedAt === 'string'
        ? record.loadedAt
        : typeof record.LoadedAt === 'string'
          ? record.LoadedAt
          : null
  };
}

function normalizeLookupList(payload: unknown): IdName[] {
  return Array.isArray(payload) ? (payload as IdName[]) : [];
}

function normalizeProjectAggregatesResponse(payload: unknown): ProjectAggregatesResponse {
  const record = (payload ?? {}) as Record<string, unknown>;
  const rawScope = record.scope ?? record.Scope;
  const rawAggregates = Array.isArray(record.aggregates)
    ? record.aggregates
    : Array.isArray(record.Aggregates)
      ? record.Aggregates
      : [];
  const totalRowsRaw = record.totalRows ?? record.TotalRows;

  return {
    scope: normalizeProjectAggregateScope(rawScope),
    totalRows:
      typeof totalRowsRaw === 'number' && Number.isFinite(totalRowsRaw)
        ? Math.max(0, totalRowsRaw)
        : 0,
    aggregates: rawAggregates.map(item => {
      const aggregateRecord = (item ?? {}) as Record<string, unknown>;
      return {
        field: String(aggregateRecord.field ?? aggregateRecord.Field ?? '').trim(),
        operation: normalizeProjectAggregateOperation(
          aggregateRecord.operation ?? aggregateRecord.Operation
        ),
        value: aggregateRecord.value ?? aggregateRecord.Value ?? null
      } satisfies ProjectAggregateResult;
    })
  };
}

const mockProjectPersonSettingStore: Record<ProjectPersonSettingScope, ProjectPersonSetting[]> = {
  assignTo: [],
  inCharge: []
};

const mockProjectPersonSettingSequences: Record<ProjectPersonSettingScope, number> = {
  assignTo: 1,
  inCharge: 1
};

function listMockProjectPersonSettings(scope: ProjectPersonSettingScope): ProjectPersonSetting[] {
  ensureMockProjectPersonSettings(scope);
  return mockProjectPersonSettingStore[scope].map(item => ({ ...item }));
}

function createMockProjectPersonSetting(
  scope: ProjectPersonSettingScope,
  payload: LookupPayload
): ProjectPersonSetting {
  ensureMockProjectPersonSettings(scope);
  const item: ProjectPersonSetting = {
    id: mockProjectPersonSettingSequences[scope]++,
    name: payload.name,
    customLabel: payload.customLabel ?? null,
    tone: payload.tone ?? null,
    customHex: payload.customHex ?? null,
    order: payload.order ?? mockProjectPersonSettingStore[scope].length
  };
  mockProjectPersonSettingStore[scope].push(item);
  return { ...item };
}

function updateMockProjectPersonSetting(
  scope: ProjectPersonSettingScope,
  id: number,
  payload: UpdateLookupPayload
): ProjectPersonSetting | null {
  ensureMockProjectPersonSettings(scope);
  const index = mockProjectPersonSettingStore[scope].findIndex(item => item.id === id);
  if (index === -1) {
    return null;
  }
  const updated: ProjectPersonSetting = {
    ...mockProjectPersonSettingStore[scope][index],
    ...payload,
    id
  };
  mockProjectPersonSettingStore[scope][index] = updated;
  return { ...updated };
}

function deleteMockProjectPersonSetting(scope: ProjectPersonSettingScope, id: number): void {
  ensureMockProjectPersonSettings(scope);
  const index = mockProjectPersonSettingStore[scope].findIndex(item => item.id === id);
  if (index !== -1) {
    mockProjectPersonSettingStore[scope].splice(index, 1);
  }
}

function ensureMockProjectPersonSettings(scope: ProjectPersonSettingScope): void {
  const seeded = projectStore
    .map(project => (scope === 'assignTo' ? project.assignTo : project.inCharge))
    .map(value => String(value ?? '').trim())
    .filter(Boolean)
    .filter(
      (value, index, values) =>
        values.findIndex(item => item.toLowerCase() === value.toLowerCase()) === index
    )
    .sort((left, right) => left.localeCompare(right));

  const existing = mockProjectPersonSettingStore[scope];
  const existingKeys = new Set(existing.map(item => item.name.trim().toLowerCase()));
  for (const name of seeded) {
    if (existingKeys.has(name.toLowerCase())) {
      continue;
    }
    existing.push({
      id: mockProjectPersonSettingSequences[scope]++,
      name,
      order: existing.length
    });
    existingKeys.add(name.toLowerCase());
  }
}

function findProject(id: number): TenderProject | null {
  const found = projectStore.find(p => p.id === id);
  return found ? cloneProject(found) : null;
}

function createMockProject(payload: CreateProjectDto): TenderProject {
  const id = nextProjectId++;
  const owner =
    payload.ownerId != null ? lookupStore.owners.find(o => o.id === payload.ownerId) : null;
  const ownerType =
    payload.ownerTypeId != null
      ? lookupStore.ownerTypes.find(o => o.id === payload.ownerTypeId)
      : null;
  const status =
    payload.statusId != null ? lookupStore.statuses.find(s => s.id === payload.statusId) : null;
  const type =
    payload.typeOfProjectId != null
      ? lookupStore.types.find(t => t.id === payload.typeOfProjectId)
      : null;
  const stage =
    payload.tenderStageId != null
      ? lookupStore.stages.find(s => s.id === payload.tenderStageId)
      : null;
  const degree =
    payload.degreeOfImportanceId != null
      ? lookupStore.degrees.find(d => d.id === payload.degreeOfImportanceId)
      : null;
  const country =
    payload.countryId != null ? lookupStore.countries.find(c => c.id === payload.countryId) : null;

  const project: TenderProject = {
    id,
    name: payload.name ?? `Tender #${id}`,
    description: payload.description ?? null,
    ownerId: payload.ownerId ?? 0,
    ownerName: owner?.name ?? 'Unknown Owner',
    ownerTypeId: payload.ownerTypeId ?? null,
    ownerTypeName: ownerType?.name ?? null,
    statusId: payload.statusId ?? 0,
    statusName: status?.name ?? 'Unknown',
    tenderStageId: payload.tenderStageId ?? 0,
    tenderStageName: stage?.name ?? 'Stage',
    typeOfProjectId: payload.typeOfProjectId ?? 0,
    typeOfProjectName: type?.name ?? 'Project',
    degreeOfImportanceId: payload.degreeOfImportanceId ?? 0,
    degreeOfImportanceName: degree?.name ?? 'Medium',
    countryId: payload.countryId ?? 0,
    countryName: country?.name ?? 'Unknown',
    assignTo: payload.assignTo ?? null,
    inCharge: payload.inCharge ?? null,
    consultant: payload.consultant ?? null,
    startDate: payload.startDate ?? null,
    acceptDate: payload.acceptDate ?? null,
    deadline: payload.deadline ?? null,
    endDate: payload.endDate ?? null,
    price: payload.price ?? null,
    prb: payload.prb ?? null,
    delayReasons: payload.delayReasons ?? null,
    tone: payload.tone ?? null,
    customLabel: payload.customLabel ?? null,
    createdAt: new Date().toISOString()
  };

  projectStore.push(project);
  return cloneProject(project);
}

function updateMockProject(id: number, payload: UpdateProjectDto): TenderProject | null {
  const index = projectStore.findIndex(p => p.id === id);
  if (index === -1) {
    return null;
  }

  const existing = projectStore[index];
  const merged = {
    ...existing,
    ...payload
  } as TenderProject;

  merged.name = payload.name ?? existing.name;

  if (payload.ownerId != null) {
    const owner = lookupStore.owners.find(o => o.id === payload.ownerId);
    merged.ownerName = owner?.name ?? merged.ownerName;
  }
  if (payload.ownerTypeId !== undefined) {
    const ownerType =
      payload.ownerTypeId != null
        ? lookupStore.ownerTypes.find(o => o.id === payload.ownerTypeId)
        : null;
    merged.ownerTypeId = payload.ownerTypeId ?? null;
    merged.ownerTypeName = ownerType?.name ?? null;
  }
  if (payload.statusId != null) {
    const status = lookupStore.statuses.find(s => s.id === payload.statusId);
    merged.statusName = status?.name ?? merged.statusName;
  }
  if (payload.typeOfProjectId != null) {
    const type = lookupStore.types.find(t => t.id === payload.typeOfProjectId);
    merged.typeOfProjectName = type?.name ?? merged.typeOfProjectName;
  }
  if (payload.tenderStageId != null) {
    const stage = lookupStore.stages.find(s => s.id === payload.tenderStageId);
    merged.tenderStageName = stage?.name ?? merged.tenderStageName;
  }
  if (payload.degreeOfImportanceId != null) {
    const degree = lookupStore.degrees.find(d => d.id === payload.degreeOfImportanceId);
    merged.degreeOfImportanceName = degree?.name ?? merged.degreeOfImportanceName;
  }
  if (payload.countryId != null) {
    const country = lookupStore.countries.find(c => c.id === payload.countryId);
    merged.countryName = country?.name ?? merged.countryName;
  }

  projectStore[index] = merged;
  return cloneProject(merged);
}

function deleteMockProject(id: number): void {
  const index = projectStore.findIndex(p => p.id === id);
  if (index !== -1) {
    projectStore.splice(index, 1);
  }
}

function cloneProject(project: TenderProject): TenderProject {
  return JSON.parse(JSON.stringify(project));
}
