import type { UseCase } from '@shared-kernel/use-case';
import type {
  ProjectListQueryEntity,
  ProjectListResultEntity
} from '../../domain/entities/project';
import type { ProjectsReadPort } from '../ports/projects-read.port';

export class ListProjectsWithMetaUseCase implements UseCase<
  ProjectListQueryEntity | undefined,
  ProjectListResultEntity
> {
  constructor(private readonly readPort: ProjectsReadPort) {}

  execute(input?: ProjectListQueryEntity): Promise<ProjectListResultEntity> {
    return this.readPort.listWithMeta(input);
  }
}
