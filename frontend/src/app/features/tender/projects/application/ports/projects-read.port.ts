import type {
  ProjectEntity,
  ProjectListQueryEntity,
  ProjectListResultEntity
} from '../../domain/entities/project';

export interface ProjectsReadPort {
  listWithMeta(query?: ProjectListQueryEntity): Promise<ProjectListResultEntity>;
  get(id: number): Promise<ProjectEntity>;
}
