import type { UseCase } from '@shared-kernel/use-case';
import type { ProjectLookupKind } from '../../domain/entities/project';
import type { ProjectsLookupsPort } from '../ports/projects-lookups.port';

export class DeleteProjectLookupUseCase implements UseCase<
  { kind: ProjectLookupKind; id: number },
  void
> {
  constructor(private readonly lookupsPort: ProjectsLookupsPort) {}

  execute(input: { kind: ProjectLookupKind; id: number }): Promise<void> {
    return this.lookupsPort.deleteLookup(input.kind, input.id);
  }
}
