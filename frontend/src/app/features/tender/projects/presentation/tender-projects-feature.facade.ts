import { Injectable, inject } from '@angular/core';
import { from, Observable } from 'rxjs';
import { CreateProjectCommentUseCase } from '../application/use-cases/create-project-comment.use-case';
import { CreateProjectAuditTrailUseCase } from '../application/use-cases/create-project-audit-trail.use-case';
import { CreateProjectLookupUseCase } from '../application/use-cases/create-project-lookup.use-case';
import { CreateProjectUseCase } from '../application/use-cases/create-project.use-case';
import { DeleteProjectLookupUseCase } from '../application/use-cases/delete-project-lookup.use-case';
import { DeleteProjectUseCase } from '../application/use-cases/delete-project.use-case';
import { GetProjectUseCase } from '../application/use-cases/get-project.use-case';
import { ListProjectAuditTrailsUseCase } from '../application/use-cases/list-project-audit-trails.use-case';
import { ListProjectLookupsUseCase } from '../application/use-cases/list-project-lookups.use-case';
import { ListProjectsWithMetaUseCase } from '../application/use-cases/list-projects-with-meta.use-case';
import { LoadAllProjectLookupsUseCase } from '../application/use-cases/load-all-project-lookups.use-case';
import { UpdateProjectLookupUseCase } from '../application/use-cases/update-project-lookup.use-case';
import { UpdateProjectUseCase } from '../application/use-cases/update-project.use-case';
import { WatchProjectRealtimeUseCase } from '../application/use-cases/watch-project-realtime.use-case';
import type {
  AuditTrailEntity,
  CreateProjectCommentEntity,
  CreateProjectEntity,
  ProjectCommentEntity,
  ProjectEntity,
  ProjectListQueryEntity,
  ProjectListResultEntity,
  ProjectLookupEntity,
  ProjectLookupPayloadEntity,
  ProjectLookupsBundleEntity,
  UpdateProjectEntity
} from '../domain/entities/project';
import { LegacyTenderProjectsAdapter } from '../infrastructure/adapters/tender-projects.adapter';
import { TenderProjectsRealtimeAdapter } from '../infrastructure/adapters/tender-projects-realtime.adapter';
import {
  TenderProjectsApi,
  type ActivityFeedRequestOptions,
  type FilterOptionsParams,
  type GetProjectAggregatesRequest,
  type ProjectActivityFeedItem,
  type ProjectAggregatesResponse,
  type ProjectBootstrapResponse,
  type ProjectDetailsRequestOptions,
  type ProjectDetailsResponse
} from '../infrastructure/services/projects.api';

export type LookupPayloadInput = {
  name: string;
  customLabel?: string | null;
  tone?: string | null;
  customHex?: string | null;
  order?: number | null;
  countryId?: number | null;
};

@Injectable({ providedIn: 'root' })
export class TenderProjectsFeatureFacade {
  private readonly adapter = inject(LegacyTenderProjectsAdapter);
  private readonly realtimeAdapter = inject(TenderProjectsRealtimeAdapter);
  private readonly projectsApi = inject(TenderProjectsApi);

  private readonly listProjectsWithMetaUseCase = new ListProjectsWithMetaUseCase(this.adapter);
  private readonly getProjectUseCase = new GetProjectUseCase(this.adapter);
  private readonly createProjectUseCase = new CreateProjectUseCase(this.adapter);
  private readonly updateProjectUseCase = new UpdateProjectUseCase(this.adapter);
  private readonly deleteProjectUseCase = new DeleteProjectUseCase(this.adapter);

  private readonly loadAllProjectLookupsUseCase = new LoadAllProjectLookupsUseCase(this.adapter);
  private readonly listProjectLookupsUseCase = new ListProjectLookupsUseCase(this.adapter);
  private readonly createProjectLookupUseCase = new CreateProjectLookupUseCase(this.adapter);
  private readonly updateProjectLookupUseCase = new UpdateProjectLookupUseCase(this.adapter);
  private readonly deleteProjectLookupUseCase = new DeleteProjectLookupUseCase(this.adapter);

  private readonly listProjectAuditTrailsUseCase = new ListProjectAuditTrailsUseCase(this.adapter);
  private readonly createProjectAuditTrailUseCase = new CreateProjectAuditTrailUseCase(
    this.adapter
  );
  private readonly createProjectCommentUseCase = new CreateProjectCommentUseCase(this.adapter);
  private readonly watchProjectRealtimeUseCase = new WatchProjectRealtimeUseCase(
    this.realtimeAdapter
  );

  readonly api = {
    listWithMeta: (query?: ProjectListQueryEntity): Observable<ProjectListResultEntity> =>
      from(this.listProjectsWithMetaUseCase.execute(query)),

    get: (id: number): Observable<ProjectEntity> => from(this.getProjectUseCase.execute({ id })),

    bootstrap: (query?: ProjectListQueryEntity): Observable<ProjectBootstrapResponse> =>
      this.projectsApi.getBootstrap(query),

    getActivityFeed: (
      projectId: number,
      options?: ActivityFeedRequestOptions
    ): Observable<ProjectActivityFeedItem[]> =>
      this.projectsApi.getActivityFeed(projectId, options),

    getDetails: (
      id: number,
      options?: ProjectDetailsRequestOptions
    ): Observable<ProjectDetailsResponse> => this.projectsApi.getDetails(id, options),

    getFilterOptions: (params: FilterOptionsParams): Observable<string[]> =>
      this.projectsApi.getFilterOptions(params),

    getAggregates: (request: GetProjectAggregatesRequest): Observable<ProjectAggregatesResponse> =>
      this.projectsApi.getAggregates(request),

    create: (payload: CreateProjectEntity): Observable<ProjectEntity> =>
      from(this.createProjectUseCase.execute(payload)),

    update: (id: number, payload: UpdateProjectEntity): Observable<ProjectEntity> =>
      from(this.updateProjectUseCase.execute({ id, payload })),

    remove: (id: number): Observable<void> => from(this.deleteProjectUseCase.execute({ id })),

    loadAllLookups: (): Observable<ProjectLookupsBundleEntity> => this.projectsApi.loadAllLookups(),

    statuses: (): Observable<ProjectLookupEntity[]> =>
      from(this.listProjectLookupsUseCase.execute({ kind: 'status' })),

    tenderStages: (): Observable<ProjectLookupEntity[]> =>
      from(this.listProjectLookupsUseCase.execute({ kind: 'stage' })),

    typesOfProjects: (): Observable<ProjectLookupEntity[]> =>
      from(this.listProjectLookupsUseCase.execute({ kind: 'type' })),

    degreesOfImportances: (): Observable<ProjectLookupEntity[]> =>
      from(this.listProjectLookupsUseCase.execute({ kind: 'importance' })),

    countries: (): Observable<ProjectLookupEntity[]> =>
      from(this.listProjectLookupsUseCase.execute({ kind: 'country' })),

    owners: (): Observable<ProjectLookupEntity[]> =>
      from(this.listProjectLookupsUseCase.execute({ kind: 'owner' })),

    ownerTypes: (): Observable<ProjectLookupEntity[]> =>
      from(this.listProjectLookupsUseCase.execute({ kind: 'ownerType' })),

    assignToSettings: (): Observable<ProjectLookupEntity[]> => this.projectsApi.assignToSettings(),

    inChargeSettings: (): Observable<ProjectLookupEntity[]> => this.projectsApi.inChargeSettings(),

    createStatus: (payload: string | LookupPayloadInput): Observable<ProjectLookupEntity> =>
      from(
        this.createProjectLookupUseCase.execute({
          kind: 'status',
          payload: this.coerceLookupPayload(payload)
        })
      ),

    updateStatus: (
      id: number,
      payload: string | LookupPayloadInput
    ): Observable<ProjectLookupEntity> =>
      from(
        this.updateProjectLookupUseCase.execute({
          kind: 'status',
          id,
          payload: this.coerceLookupPayload(payload)
        })
      ),

    deleteStatus: (id: number): Observable<void> =>
      from(this.deleteProjectLookupUseCase.execute({ kind: 'status', id })),

    createTenderStage: (payload: string | LookupPayloadInput): Observable<ProjectLookupEntity> =>
      from(
        this.createProjectLookupUseCase.execute({
          kind: 'stage',
          payload: this.coerceLookupPayload(payload)
        })
      ),

    updateTenderStage: (
      id: number,
      payload: string | LookupPayloadInput
    ): Observable<ProjectLookupEntity> =>
      from(
        this.updateProjectLookupUseCase.execute({
          kind: 'stage',
          id,
          payload: this.coerceLookupPayload(payload)
        })
      ),

    deleteTenderStage: (id: number): Observable<void> =>
      from(this.deleteProjectLookupUseCase.execute({ kind: 'stage', id })),

    createTypeOfProject: (payload: string | LookupPayloadInput): Observable<ProjectLookupEntity> =>
      from(
        this.createProjectLookupUseCase.execute({
          kind: 'type',
          payload: this.coerceLookupPayload(payload)
        })
      ),

    updateTypeOfProject: (
      id: number,
      payload: string | LookupPayloadInput
    ): Observable<ProjectLookupEntity> =>
      from(
        this.updateProjectLookupUseCase.execute({
          kind: 'type',
          id,
          payload: this.coerceLookupPayload(payload)
        })
      ),

    deleteTypeOfProject: (id: number): Observable<void> =>
      from(this.deleteProjectLookupUseCase.execute({ kind: 'type', id })),

    createDegreeOfImportance: (
      payload: string | LookupPayloadInput
    ): Observable<ProjectLookupEntity> =>
      from(
        this.createProjectLookupUseCase.execute({
          kind: 'importance',
          payload: this.coerceLookupPayload(payload)
        })
      ),

    updateDegreeOfImportance: (
      id: number,
      payload: string | LookupPayloadInput
    ): Observable<ProjectLookupEntity> =>
      from(
        this.updateProjectLookupUseCase.execute({
          kind: 'importance',
          id,
          payload: this.coerceLookupPayload(payload)
        })
      ),

    deleteDegreeOfImportance: (id: number): Observable<void> =>
      from(this.deleteProjectLookupUseCase.execute({ kind: 'importance', id })),

    createCountry: (payload: string | LookupPayloadInput): Observable<ProjectLookupEntity> =>
      from(
        this.createProjectLookupUseCase.execute({
          kind: 'country',
          payload: this.coerceLookupPayload(payload)
        })
      ),

    updateCountry: (
      id: number,
      payload: string | LookupPayloadInput
    ): Observable<ProjectLookupEntity> =>
      from(
        this.updateProjectLookupUseCase.execute({
          kind: 'country',
          id,
          payload: this.coerceLookupPayload(payload)
        })
      ),

    deleteCountry: (id: number): Observable<void> =>
      from(this.deleteProjectLookupUseCase.execute({ kind: 'country', id })),

    createOwner: (
      payload: string | LookupPayloadInput,
      countryId?: number | null
    ): Observable<ProjectLookupEntity> =>
      from(
        this.createProjectLookupUseCase.execute({
          kind: 'owner',
          payload:
            typeof payload === 'string'
              ? this.coerceLookupPayload({ name: payload, countryId })
              : this.coerceLookupPayload(payload)
        })
      ),

    updateOwner: (
      id: number,
      payload: string | LookupPayloadInput
    ): Observable<ProjectLookupEntity> =>
      typeof payload === 'string'
        ? this.projectsApi.updateOwner(id, payload)
        : from(
            this.updateProjectLookupUseCase.execute({
              kind: 'owner',
              id,
              payload: this.coerceLookupPayload(payload)
            })
          ),

    deleteOwner: (id: number): Observable<void> =>
      from(this.deleteProjectLookupUseCase.execute({ kind: 'owner', id })),

    createOwnerType: (payload: string | LookupPayloadInput): Observable<ProjectLookupEntity> =>
      from(
        this.createProjectLookupUseCase.execute({
          kind: 'ownerType',
          payload: this.coerceLookupPayload(payload)
        })
      ),

    updateOwnerType: (
      id: number,
      payload: string | LookupPayloadInput
    ): Observable<ProjectLookupEntity> =>
      from(
        this.updateProjectLookupUseCase.execute({
          kind: 'ownerType',
          id,
          payload: this.coerceLookupPayload(payload)
        })
      ),

    deleteOwnerType: (id: number): Observable<void> =>
      from(this.deleteProjectLookupUseCase.execute({ kind: 'ownerType', id })),

    createAssignToSetting: (
      payload: string | LookupPayloadInput
    ): Observable<ProjectLookupEntity> => this.projectsApi.createAssignToSetting(payload),

    updateAssignToSetting: (
      id: number,
      payload: string | LookupPayloadInput
    ): Observable<ProjectLookupEntity> => this.projectsApi.updateAssignToSetting(id, payload),

    deleteAssignToSetting: (id: number): Observable<void> =>
      this.projectsApi.deleteAssignToSetting(id),

    createInChargeSetting: (
      payload: string | LookupPayloadInput
    ): Observable<ProjectLookupEntity> => this.projectsApi.createInChargeSetting(payload),

    updateInChargeSetting: (
      id: number,
      payload: string | LookupPayloadInput
    ): Observable<ProjectLookupEntity> => this.projectsApi.updateInChargeSetting(id, payload),

    deleteInChargeSetting: (id: number): Observable<void> =>
      this.projectsApi.deleteInChargeSetting(id)
  };

  readonly audit = {
    create: (payload: AuditTrailEntity): Observable<AuditTrailEntity> =>
      from(this.createProjectAuditTrailUseCase.execute(payload)),

    getAll: (): Observable<AuditTrailEntity[]> =>
      from(this.listProjectAuditTrailsUseCase.execute({})),

    getByEntityName: (entityName: string): Observable<AuditTrailEntity[]> =>
      from(this.listProjectAuditTrailsUseCase.execute({ entityName }))
  };

  readonly comments = {
    create: (payload: CreateProjectCommentEntity): Observable<ProjectCommentEntity> =>
      from(this.createProjectCommentUseCase.execute(payload))
  };

  readonly realtime = {
    messages: (): Observable<unknown> => this.watchProjectRealtimeUseCase.execute()
  };

  private coerceLookupPayload(payload: string | LookupPayloadInput): ProjectLookupPayloadEntity {
    if (typeof payload === 'string') {
      return { name: payload };
    }

    return {
      name: payload.name,
      customLabel: payload.customLabel ?? null,
      tone: payload.tone ?? null,
      customHex: payload.customHex ?? null,
      order: payload.order ?? null,
      countryId: payload.countryId ?? undefined
    };
  }
}
