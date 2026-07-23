import type {
  AuditTrailEntity,
  CreateProjectCommentEntity,
  CreateProjectEntity,
  ProjectEntity,
  ProjectLookupEntity,
  UpdateProjectEntity
} from '../../domain/entities/project';

export type IdName = ProjectLookupEntity;
export type TenderProject = ProjectEntity;
export type CreateProjectDto = CreateProjectEntity;
export type UpdateProjectDto = UpdateProjectEntity;
export type AuditTrail = AuditTrailEntity;
export type CreateProjectCommentPayload = CreateProjectCommentEntity;
export type DirectoryUser = {
  id?: string;
  name: string;
  email?: string;
  handle?: string;
};
export type CheckList = {
  id: number;
  name: string;
  isCompleted: boolean;
  notes: string | null;
  assignedTo: string | null;
  projectId: number;
  tone?: string | null;
  customLabel?: string | null;
  createdAt?: string;
  updatedAt?: string;
};
export type CreateCheckListDto = {
  name: string;
  isCompleted: boolean;
  notes?: string | null;
  assignedTo?: string | null;
  projectId: number;
  tone?: string | null;
  customLabel?: string | null;
};
export type UpdateCheckListDto = {
  id: number;
  name?: string | null;
  isCompleted?: boolean | null;
  notes?: string | null;
  assignedTo?: string | null;
};
