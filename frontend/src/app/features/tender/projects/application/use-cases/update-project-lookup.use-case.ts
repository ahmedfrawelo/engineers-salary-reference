import type { UseCase } from '@shared-kernel/use-case';
import type {
  ProjectLookupEntity,
  ProjectLookupKind,
  ProjectLookupPayloadEntity
} from '../../domain/entities/project';
import { normalizeLookupName } from '../../domain/policies/lookup-name.policy';
import type { ProjectsLookupsPort } from '../ports/projects-lookups.port';

export class UpdateProjectLookupUseCase implements UseCase<
  { kind: ProjectLookupKind; id: number; payload: ProjectLookupPayloadEntity },
  ProjectLookupEntity
> {
  constructor(private readonly lookupsPort: ProjectsLookupsPort) {}

  execute(input: {
    kind: ProjectLookupKind;
    id: number;
    payload: ProjectLookupPayloadEntity;
  }): Promise<ProjectLookupEntity> {
    const payload: ProjectLookupPayloadEntity = {
      ...input.payload,
      name: normalizeLookupName(input.payload.name)
    };

    return this.lookupsPort.updateLookup(input.kind, input.id, payload);
  }
}
