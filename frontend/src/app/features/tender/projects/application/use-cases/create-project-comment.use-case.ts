import type { UseCase } from '@shared-kernel/use-case';
import type {
  CreateProjectCommentEntity,
  ProjectCommentEntity
} from '../../domain/entities/project';
import type { ProjectsCommentsPort } from '../ports/projects-comments.port';

export class CreateProjectCommentUseCase implements UseCase<
  CreateProjectCommentEntity,
  ProjectCommentEntity
> {
  constructor(private readonly commentsPort: ProjectsCommentsPort) {}

  execute(input: CreateProjectCommentEntity): Promise<ProjectCommentEntity> {
    const message = (input.message ?? '').trim();
    if (!message) {
      return Promise.reject(new Error('Comment message is required'));
    }

    return this.commentsPort.createComment({
      ...input,
      message
    });
  }
}
