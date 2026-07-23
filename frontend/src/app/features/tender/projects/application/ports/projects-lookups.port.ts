import type {
  ProjectLookupEntity,
  ProjectLookupKind,
  ProjectLookupPayloadEntity,
  ProjectLookupsBundleEntity
} from '../../domain/entities/project';

export interface ProjectsLookupsPort {
  loadAllLookups(): Promise<ProjectLookupsBundleEntity>;
  listLookups(kind: ProjectLookupKind): Promise<ProjectLookupEntity[]>;
  createLookup(
    kind: ProjectLookupKind,
    payload: ProjectLookupPayloadEntity
  ): Promise<ProjectLookupEntity>;
  updateLookup(
    kind: ProjectLookupKind,
    id: number,
    payload: ProjectLookupPayloadEntity
  ): Promise<ProjectLookupEntity>;
  deleteLookup(kind: ProjectLookupKind, id: number): Promise<void>;
}
