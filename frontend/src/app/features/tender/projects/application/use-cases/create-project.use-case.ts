import type { UseCase } from '@shared-kernel/use-case';
import type { CreateProjectEntity, ProjectEntity } from '../../domain/entities/project';
import type { ProjectsWritePort } from '../ports/projects-write.port';

export class CreateProjectUseCase implements UseCase<CreateProjectEntity, ProjectEntity> {
  constructor(private readonly writePort: ProjectsWritePort) {}

  execute(input: CreateProjectEntity): Promise<ProjectEntity> {
    return this.writePort.create(input);
  }
}
