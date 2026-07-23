import type { UseCase } from '@shared-kernel/use-case';
import type { AuditTrailEntity } from '../../domain/entities/project';
import type { ProjectsAuditPort } from '../ports/projects-audit.port';

export class ListProjectAuditTrailsUseCase implements UseCase<
  { entityName?: string },
  AuditTrailEntity[]
> {
  constructor(private readonly auditPort: ProjectsAuditPort) {}

  execute(input: { entityName?: string }): Promise<AuditTrailEntity[]> {
    const entityName = (input.entityName ?? '').trim();
    if (entityName) {
      return this.auditPort.getAuditTrailsByEntityName(entityName);
    }
    return this.auditPort.getAllAuditTrails();
  }
}
