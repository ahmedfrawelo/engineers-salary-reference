import type { UseCase } from '@shared-kernel/use-case';
import type { ProjectLookupEntity, ProjectLookupKind } from '../../domain/entities/project';
import type { ProjectsLookupsPort } from '../ports/projects-lookups.port';

export class ListProjectLookupsUseCase implements UseCase<
  { kind: ProjectLookupKind },
  ProjectLookupEntity[]
> {
  constructor(private readonly lookupsPort: ProjectsLookupsPort) {}

  execute(input: { kind: ProjectLookupKind }): Promise<ProjectLookupEntity[]> {
    return this.lookupsPort.listLookups(input.kind);
  }
}
