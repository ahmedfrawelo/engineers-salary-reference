import type { UseCase } from '@shared-kernel/use-case';
import type { ProjectEntity } from '../../domain/entities/project';
import type { ProjectsReadPort } from '../ports/projects-read.port';

export class GetProjectUseCase implements UseCase<{ id: number }, ProjectEntity> {
  constructor(private readonly readPort: ProjectsReadPort) {}

  execute(input: { id: number }): Promise<ProjectEntity> {
    return this.readPort.get(input.id);
  }
}
