import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AuditTrailsApi,
  ProjectCommentsApi,
  TenderProjectsApi
} from '@features/tender/infrastructure/services';
import type { ProjectsAuditPort } from '../../application/ports/projects-audit.port';
import type { ProjectsCommentsPort } from '../../application/ports/projects-comments.port';
import type { ProjectsLookupsPort } from '../../application/ports/projects-lookups.port';
import type { ProjectsReadPort } from '../../application/ports/projects-read.port';
import type { ProjectsWritePort } from '../../application/ports/projects-write.port';
import type {
  AuditTrailEntity,
  CreateProjectCommentEntity,
  CreateProjectEntity,
  ProjectCommentEntity,
  ProjectEntity,
  ProjectListQueryEntity,
  ProjectListResultEntity,
  ProjectLookupEntity,
  ProjectLookupKind,
  ProjectLookupPayloadEntity,
  ProjectLookupsBundleEntity,
  UpdateProjectEntity
} from '../../domain/entities/project';

type LookupPayload = {
  name: string;
  customLabel?: string | null;
  tone?: string | null;
  customHex?: string | null;
  order?: number | null;
};

@Injectable({ providedIn: 'root' })
export class LegacyTenderProjectsAdapter
  implements
    ProjectsReadPort,
    ProjectsWritePort,
    ProjectsLookupsPort,
    ProjectsAuditPort,
    ProjectsCommentsPort
{
  private readonly projectsApi = inject(TenderProjectsApi);
  private readonly auditApi = inject(AuditTrailsApi);
  private readonly commentsApi = inject(ProjectCommentsApi);

  async createAuditTrail(payload: AuditTrailEntity): Promise<AuditTrailEntity> {
    const trail = await firstValueFrom(this.auditApi.create(payload));
    return trail as AuditTrailEntity;
  }

  async listWithMeta(query?: ProjectListQueryEntity): Promise<ProjectListResultEntity> {
    const response = await firstValueFrom(this.projectsApi.listWithMeta(query));
    return response as ProjectListResultEntity;
  }

  async get(id: number): Promise<ProjectEntity> {
    const project = await firstValueFrom(this.projectsApi.get(id));
    return project as ProjectEntity;
  }

  async create(payload: CreateProjectEntity): Promise<ProjectEntity> {
    const project = await firstValueFrom(this.projectsApi.create(payload));
    return project as ProjectEntity;
  }

  async update(id: number, payload: UpdateProjectEntity): Promise<ProjectEntity> {
    const project = await firstValueFrom(this.projectsApi.update(id, payload));
    return project as ProjectEntity;
  }

  async remove(id: number): Promise<void> {
    await firstValueFrom(this.projectsApi.remove(id));
  }

  async loadAllLookups(): Promise<ProjectLookupsBundleEntity> {
    const lookups = await firstValueFrom(this.projectsApi.loadAllLookups());
    return lookups as ProjectLookupsBundleEntity;
  }

  async listLookups(kind: ProjectLookupKind): Promise<ProjectLookupEntity[]> {
    switch (kind) {
      case 'status':
        return (await firstValueFrom(this.projectsApi.statuses())) as ProjectLookupEntity[];
      case 'stage':
        return (await firstValueFrom(this.projectsApi.tenderStages())) as ProjectLookupEntity[];
      case 'type':
        return (await firstValueFrom(this.projectsApi.typesOfProjects())) as ProjectLookupEntity[];
      case 'importance':
        return (await firstValueFrom(
          this.projectsApi.degreesOfImportances()
        )) as ProjectLookupEntity[];
      case 'country':
        return (await firstValueFrom(this.projectsApi.countries())) as ProjectLookupEntity[];
      case 'owner':
        return (await firstValueFrom(this.projectsApi.owners())) as ProjectLookupEntity[];
      case 'ownerType':
        return (await firstValueFrom(this.projectsApi.ownerTypes())) as ProjectLookupEntity[];
      default:
        return [];
    }
  }

  async createLookup(
    kind: ProjectLookupKind,
    payload: ProjectLookupPayloadEntity
  ): Promise<ProjectLookupEntity> {
    if (kind === 'owner') {
      const owner = await firstValueFrom(
        this.projectsApi.createOwner({
          name: payload.name,
          countryId: payload.countryId ?? null,
          customLabel: payload.customLabel ?? null,
          tone: payload.tone ?? null,
          customHex: payload.customHex ?? null,
          order: payload.order ?? null
        })
      );
      return owner as ProjectLookupEntity;
    }

    const lookupPayload = this.toLookupPayload(payload);
    switch (kind) {
      case 'status':
        return (await firstValueFrom(
          this.projectsApi.createStatus(lookupPayload)
        )) as ProjectLookupEntity;
      case 'stage':
        return (await firstValueFrom(
          this.projectsApi.createTenderStage(lookupPayload)
        )) as ProjectLookupEntity;
      case 'type':
        return (await firstValueFrom(
          this.projectsApi.createTypeOfProject(lookupPayload)
        )) as ProjectLookupEntity;
      case 'importance':
        return (await firstValueFrom(
          this.projectsApi.createDegreeOfImportance(lookupPayload)
        )) as ProjectLookupEntity;
      case 'country':
        return (await firstValueFrom(
          this.projectsApi.createCountry(lookupPayload)
        )) as ProjectLookupEntity;
      case 'ownerType':
        return (await firstValueFrom(
          this.projectsApi.createOwnerType(lookupPayload)
        )) as ProjectLookupEntity;
      default:
        throw new Error(`Unsupported lookup create kind: ${kind}`);
    }
  }

  async updateLookup(
    kind: ProjectLookupKind,
    id: number,
    payload: ProjectLookupPayloadEntity
  ): Promise<ProjectLookupEntity> {
    if (kind === 'owner') {
      const owner = await firstValueFrom(
        this.projectsApi.updateOwner(id, {
          id,
          name: payload.name,
          countryId: payload.countryId ?? null,
          customLabel: payload.customLabel ?? null,
          tone: payload.tone ?? null,
          customHex: payload.customHex ?? null,
          order: payload.order ?? null
        })
      );
      return owner as ProjectLookupEntity;
    }

    const lookupPayload = this.toLookupPayload(payload);
    switch (kind) {
      case 'status':
        return (await firstValueFrom(
          this.projectsApi.updateStatus(id, lookupPayload)
        )) as ProjectLookupEntity;
      case 'stage':
        return (await firstValueFrom(
          this.projectsApi.updateTenderStage(id, lookupPayload)
        )) as ProjectLookupEntity;
      case 'type':
        return (await firstValueFrom(
          this.projectsApi.updateTypeOfProject(id, lookupPayload)
        )) as ProjectLookupEntity;
      case 'importance':
        return (await firstValueFrom(
          this.projectsApi.updateDegreeOfImportance(id, lookupPayload)
        )) as ProjectLookupEntity;
      case 'country':
        return (await firstValueFrom(
          this.projectsApi.updateCountry(id, lookupPayload)
        )) as ProjectLookupEntity;
      case 'ownerType':
        return (await firstValueFrom(
          this.projectsApi.updateOwnerType(id, lookupPayload)
        )) as ProjectLookupEntity;
      default:
        throw new Error(`Unsupported lookup update kind: ${kind}`);
    }
  }

  async deleteLookup(kind: ProjectLookupKind, id: number): Promise<void> {
    switch (kind) {
      case 'status':
        await firstValueFrom(this.projectsApi.deleteStatus(id));
        return;
      case 'stage':
        await firstValueFrom(this.projectsApi.deleteTenderStage(id));
        return;
      case 'type':
        await firstValueFrom(this.projectsApi.deleteTypeOfProject(id));
        return;
      case 'importance':
        await firstValueFrom(this.projectsApi.deleteDegreeOfImportance(id));
        return;
      case 'country':
        await firstValueFrom(this.projectsApi.deleteCountry(id));
        return;
      case 'owner':
        await firstValueFrom(this.projectsApi.deleteOwner(id));
        return;
      case 'ownerType':
        await firstValueFrom(this.projectsApi.deleteOwnerType(id));
        return;
      default:
        throw new Error(`Unsupported lookup delete kind: ${kind}`);
    }
  }

  async getAllAuditTrails(): Promise<AuditTrailEntity[]> {
    const trails = await firstValueFrom(this.auditApi.getAll());
    return trails as AuditTrailEntity[];
  }

  async getAuditTrailsByEntityName(entityName: string): Promise<AuditTrailEntity[]> {
    const trails = await firstValueFrom(this.auditApi.getByEntityName(entityName));
    return trails as AuditTrailEntity[];
  }

  async createComment(payload: CreateProjectCommentEntity): Promise<ProjectCommentEntity> {
    const comment = await firstValueFrom(this.commentsApi.create(payload));
    return comment as ProjectCommentEntity;
  }

  private toLookupPayload(payload: ProjectLookupPayloadEntity): LookupPayload {
    return {
      name: payload.name,
      customLabel: payload.customLabel ?? null,
      tone: payload.tone ?? null,
      customHex: payload.customHex ?? null,
      order: payload.order ?? null
    };
  }
}
