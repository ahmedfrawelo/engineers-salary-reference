import type { UseCase } from '@shared-kernel/use-case';
import type { ProjectLookupsBundleEntity } from '../../domain/entities/project';
import type { ProjectsLookupsPort } from '../ports/projects-lookups.port';

export class LoadAllProjectLookupsUseCase implements UseCase<void, ProjectLookupsBundleEntity> {
  constructor(private readonly lookupsPort: ProjectsLookupsPort) {}

  execute(): Promise<ProjectLookupsBundleEntity> {
    return this.lookupsPort.loadAllLookups();
  }
}
