import type { AuditTrailEntity } from '../../domain/entities/project';

export interface ProjectsAuditPort {
  createAuditTrail(payload: AuditTrailEntity): Promise<AuditTrailEntity>;
  getAllAuditTrails(): Promise<AuditTrailEntity[]>;
  getAuditTrailsByEntityName(entityName: string): Promise<AuditTrailEntity[]>;
}
