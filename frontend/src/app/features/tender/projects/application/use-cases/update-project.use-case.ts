import type { UseCase } from '@shared-kernel/use-case';
import type { ProjectEntity, UpdateProjectEntity } from '../../domain/entities/project';
import type { ProjectsWritePort } from '../ports/projects-write.port';

export class UpdateProjectUseCase implements UseCase<
  { id: number; payload: UpdateProjectEntity },
  ProjectEntity
> {
  constructor(private readonly writePort: ProjectsWritePort) {}

  execute(input: { id: number; payload: UpdateProjectEntity }): Promise<ProjectEntity> {
    return this.writePort.update(input.id, input.payload);
  }
}
