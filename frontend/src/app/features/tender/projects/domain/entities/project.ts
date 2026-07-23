export type LookupCustomizationEntity = {
  customLabel?: string | null;
  tone?: string | null;
  customHex?: string | null;
  order?: number | null;
};

export type ProjectLookupEntity = {
  id: number;
  name: string;
  countryId?: number;
} & LookupCustomizationEntity;

export type ProjectLookupPayloadEntity = {
  name: string;
  countryId?: number;
} & LookupCustomizationEntity;

export type ProjectLookupKind =
  | 'status'
  | 'stage'
  | 'type'
  | 'importance'
  | 'ownerType'
  | 'country'
  | 'owner'
  | 'assignTo'
  | 'inCharge';

export type ProjectEntity = {
  id: number;
  name: string;
  description: string | null;
  ownerId: number;
  ownerName: string;
  ownerTypeId: number | null;
  ownerTypeName: string | null;
  statusId: number;
  statusName: string;
  tenderStageId: number;
  tenderStageName: string;
  typeOfProjectId: number;
  typeOfProjectName: string;
  degreeOfImportanceId: number;
  degreeOfImportanceName: string;
  countryId: number;
  countryName: string;
  assignTo: string | null;
  inCharge: string | null;
  consultant: string | null;
  startDate: string | null;
  acceptDate: string | null;
  deadline: string | null;
  endDate: string | null;
  price: number | null;
  prb: number | null;
  delayReasons: string | null;
  tone: string | null;
  customLabel: string | null;
  createdAt: string | null;
};

export type ProjectListQueryEntity = {
  page?: number;
  pageNumber?: number;
  pageSize?: number;
  size?: number;
  search?: string;
  statusId?: number;
  stageId?: number;
  ownerId?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  groupBy?: string;
  groupDirection?: 'asc' | 'desc';
  groupDateInterval?: 'day' | 'week' | 'month' | 'quarter' | 'year';
};

export type ProjectListMetaEntity = {
  totalCount?: number;
  pageNumber?: number;
  pageSize?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  grouping?: {
    field: string;
    direction: 'asc' | 'desc';
    dateInterval?: 'day' | 'week' | 'month' | 'quarter' | 'year' | null;
    totalGroups: number;
    groups: Array<{
      field: string;
      key: string;
      value: string;
      count: number;
    }>;
  } | null;
};

export type ProjectListResultEntity = {
  items: ProjectEntity[];
  meta: ProjectListMetaEntity | null;
};

export type CreateProjectEntity = {
  name?: string | null;
  description?: string | null;
  delayReasons?: string | null;
  assignTo?: string | null;
  inCharge?: string | null;
  consultant?: string | null;
  startDate?: string | null;
  acceptDate?: string | null;
  deadline?: string | null;
  endDate?: string | null;
  prb?: number | null;
  price: number | null;
  tone?: string | null;
  customLabel?: string | null;
  ownerId: number | null;
  ownerTypeId: number | null;
  statusId: number | null;
  typeOfProjectId: number | null;
  degreeOfImportanceId: number | null;
  tenderStageId: number | null;
  countryId: number | null;
};

export type UpdateProjectEntity = Partial<CreateProjectEntity> & { id: number };

export type ProjectLookupsBundleEntity = {
  countries: ProjectLookupEntity[];
  owners: ProjectLookupEntity[];
  ownerTypes: ProjectLookupEntity[];
  statuses: ProjectLookupEntity[];
  stages: ProjectLookupEntity[];
  types: ProjectLookupEntity[];
  degreesOfImportance: ProjectLookupEntity[];
  assignToSettings: ProjectLookupEntity[];
  inChargeSettings: ProjectLookupEntity[];
};

export type AuditTrailEntity = {
  id?: number;
  entityName?: string | null;
  entityId?: number | string | null;
  actionType?: string | null;
  action?: string | null;
  message?: string | null;
  description?: string | null;
  details?: string | null;
  createdAt?: string | null;
  createdOn?: string | null;
  timestamp?: string | null;
  userName?: string | null;
  user?: string | null;
  performedBy?: string | null;
  createdBy?: string | null;
  [key: string]: unknown;
};

export type ProjectCommentMentionEntity = {
  id?: string;
  name?: string;
  email?: string;
  handle?: string;
};

export type CreateProjectCommentEntity = {
  projectId: number;
  message: string;
  mentions?: ProjectCommentMentionEntity[];
  entityName?: string;
  entityId?: number | string;
  projectTitle?: string | null;
};

export type ProjectCommentEntity = {
  id?: number | string;
  message?: string;
  createdAt?: string;
  userName?: string;
  raw?: unknown;
};
