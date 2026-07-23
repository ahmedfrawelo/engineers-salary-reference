import type { AuditTrail, CreateProjectCommentPayload, IdName } from './tender-projects.contracts';

export type Status = 'New' | 'Under Study' | 'Pricing' | 'Submitted' | 'Won' | 'Lost' | 'On Hold';
export type ToastKind = 'success' | 'error' | 'info';
export type LookupKind =
  | 'owner'
  | 'ownerType'
  | 'country'
  | 'stage'
  | 'type'
  | 'status'
  | 'importance'
  | 'assignTo'
  | 'inCharge';
export type ToneName = 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'gray' | 'teal' | 'orange';
export type LookupToneKey =
  | 'status'
  | 'stage'
  | 'type'
  | 'importance'
  | 'country'
  | 'owner'
  | 'ownerType'
  | 'assignTo'
  | 'inCharge';

export type LookupToneItem = IdName & {
  tone?: string | null;
  customHex?: string | null;
  customLabel?: string | null;
  label?: string | null;
  color?: string | null;
  colorHex?: string | null;
  toneHex?: string | null;
};

export type PendingProjectComment = {
  id: string;
  payload: CreateProjectCommentPayload;
  createdAt: string;
};

export type PendingProjectAudit = {
  id: string;
  payload: AuditTrail;
  createdAt: string;
};

export type ToneInfo = { tone?: ToneName; customHex?: string };

export type LookupsCache = {
  storedAt: number;
  statuses: IdName[];
  top: IdName[];
  stages: IdName[];
  doi: IdName[];
  owners: IdName[];
  ownerTypes: IdName[];
  countries: IdName[];
  assignToSettings: IdName[];
  inChargeSettings: IdName[];
};

export type LookupIdMaps = {
  statuses: Map<number, string>;
  top: Map<number, string>;
  stages: Map<number, string>;
  doi: Map<number, string>;
  owners: Map<number, string>;
  ownerTypes: Map<number, string>;
  countries: Map<number, string>;
  assignToSettings: Map<number, string>;
  inChargeSettings: Map<number, string>;
};

export type LookupNameMaps = {
  statuses: Map<string, IdName>;
  top: Map<string, IdName>;
  stages: Map<string, IdName>;
  doi: Map<string, IdName>;
  owners: Map<string, IdName>;
  ownerTypes: Map<string, IdName>;
  countries: Map<string, IdName>;
  assignToSettings: Map<string, IdName>;
  inChargeSettings: Map<string, IdName>;
};
