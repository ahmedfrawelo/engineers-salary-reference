import type {
  CreateProjectCommentEntity,
  ProjectCommentEntity
} from '../../domain/entities/project';

export interface ProjectsCommentsPort {
  createComment(payload: CreateProjectCommentEntity): Promise<ProjectCommentEntity>;
}
