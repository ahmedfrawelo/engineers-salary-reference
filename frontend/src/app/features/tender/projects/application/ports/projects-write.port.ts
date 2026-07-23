import type {
  CreateProjectEntity,
  ProjectEntity,
  UpdateProjectEntity
} from '../../domain/entities/project';

export interface ProjectsWritePort {
  create(payload: CreateProjectEntity): Promise<ProjectEntity>;
  update(id: number, payload: UpdateProjectEntity): Promise<ProjectEntity>;
  remove(id: number): Promise<void>;
}
