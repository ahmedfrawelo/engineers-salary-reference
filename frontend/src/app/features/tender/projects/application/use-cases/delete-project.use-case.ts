import type { UseCase } from '@shared-kernel/use-case';
import type { ProjectsWritePort } from '../ports/projects-write.port';

export class DeleteProjectUseCase implements UseCase<{ id: number }, void> {
  constructor(private readonly writePort: ProjectsWritePort) {}

  execute(input: { id: number }): Promise<void> {
    return this.writePort.remove(input.id);
  }
}
