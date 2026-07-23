import type { UseCase } from '@shared-kernel/use-case';
import type { AuditTrailEntity } from '../../domain/entities/project';
import type { ProjectsAuditPort } from '../ports/projects-audit.port';

export class CreateProjectAuditTrailUseCase implements UseCase<AuditTrailEntity, AuditTrailEntity> {
  constructor(private readonly auditPort: ProjectsAuditPort) {}

  execute(input: AuditTrailEntity): Promise<AuditTrailEntity> {
    const entityName = (input.entityName ?? '').trim();
    if (!entityName) {
      return Promise.reject(new Error('Audit entity name is required'));
    }

    return this.auditPort.createAuditTrail({
      ...input,
      entityName
    });
  }
}
