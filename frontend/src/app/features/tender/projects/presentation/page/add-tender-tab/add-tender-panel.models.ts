export type Status = 'New' | 'Under Study' | 'Pricing' | 'Submitted' | 'Won' | 'Lost' | 'On Hold';

export type TenderImportance = '' | 'Low' | 'Normal' | 'High' | 'Critical';

export type FormModel = {
  title: string;
  description: string;
  owner: string;
  ownerType: string;
  deadline: string;
  startDate: string;
  endDate: string;
  top: string;
  ts: string;
  price: number | null;
  assignTo: string;
  acceptDate: string;
  status: Status | '';
  prb: number | null;
  consultant: string;
  delayReasons: string;
  doi: string;
  country: string;
  inCharge: string;
};

export type LookupKind =
  | 'owner'
  | 'ownerType'
  | 'country'
  | 'stage'
  | 'type'
  | 'status'
  | 'importance';
export type RenamePayload = { from: string | null; to: string };
