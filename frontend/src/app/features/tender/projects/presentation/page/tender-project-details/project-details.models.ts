import type { AuditTrail, IdName } from '../tender-projects.contracts';

export type Status = 'New' | 'Under Study' | 'Pricing' | 'Submitted' | 'Won' | 'Lost' | 'On Hold';

export type Country = string;

export type ChecklistSubItem = {
  id: string;
  text: string;
  done: boolean;
};

export type ChecklistItem = {
  id?: number;
  text: string;
  done: boolean;
  subItems?: ChecklistSubItem[];
  noteText?: string | null;
  order?: number | null;
  notesEnvelope?: Record<string, unknown> | null;
};

export type LookupCreateKind = 'owner' | 'ownerType' | 'country' | 'stage' | 'type';
export type LookupKind = LookupCreateKind | 'status' | 'importance';

export type RenamePayload = {
  from: string | null;
  to: string;
};

export type ChecklistTogglePayload = {
  item: ChecklistItem;
  previous: boolean;
};

export type TenderRow = {
  id?: number;
  ownerId?: number;
  ownerTypeId?: number;
  statusId?: number;
  tenderStageId?: number;
  typeOfProjectId?: number;
  degreeOfImportanceId?: number;
  countryId?: number;
  title: string;
  description?: string | null;
  owner: string;
  ownerType: string;
  deadline: string;
  startDate?: string;
  endDate?: string;
  top: string;
  ts: string;
  price?: number;
  assignTo: string;
  acceptDate?: string;
  status: Status;
  prb?: number | string | null;
  consultant?: string | null;
  delayReasons?: string | null;
  doi?: string;
  country: Country;
  inCharge: string;
  tone?: string | null;
  customLabel?: string | null;
  createdAt?: string | null;
  checklists?: ChecklistItem[];
  checklistsLoaded?: boolean;
};

export type ProjectDetailsLookupCreatedEvent = {
  type: LookupCreateKind;
  item: IdName;
};

export type ProjectDetailsLookupCreateFailedEvent = {
  type: LookupCreateKind;
  name: string;
  message: string;
};

export type ProjectDetailsLookupUpdatedEvent = {
  type: LookupKind;
  item: IdName;
};

export type ProjectDetailsLookupUpdateFailedEvent = {
  type: LookupKind;
  name: string;
  message: string;
};

export type ProjectDetailsChecklistActionFailedEvent = {
  action: 'load' | 'create' | 'update' | 'delete';
  message: string;
};

export type ProjectDetailsAuditEmitter = {
  emit(value: AuditTrail): void;
};
