export type TabKey =
  | 'status'
  | 'stage'
  | 'type'
  | 'importance'
  | 'country'
  | 'owner'
  | 'ownerType'
  | 'assignTo'
  | 'inCharge';

export type Tone = 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'gray' | 'teal' | 'orange';

export type LookupPayload = {
  name: string;
  customLabel?: string | null;
  tone?: Tone | null;
  customHex?: string | null;
  order?: number | null;
};

export interface SettingItem {
  id: number | string;
  name: string;
  customLabel?: string;
  order?: number;
  tone?: Tone;
  customHex?: string;
}

export const TENDER_SETTINGS_TONES: Tone[] = [
  'green',
  'yellow',
  'red',
  'blue',
  'purple',
  'teal',
  'orange',
  'gray'
];

export const TENDER_SETTINGS_PRESET_CUSTOMS = [
  '#84c718',
  '#10b981',
  '#22c55e',
  '#84cc16',
  '#eab308',
  '#f59e0b',
  '#ef4444',
  '#3b82f6',
  '#8b5cf6',
  '#14b8a6',
  '#94a3b8',
  '#d946ef',
  '#f97316',
  '#0ea5e9'
];

export function getTenderSettingsAddButtonLabel(tab: TabKey): string {
  switch (tab) {
    case 'status':
      return 'Create New Status';
    case 'stage':
      return 'Create New Stage';
    case 'type':
      return 'Create New Type';
    case 'importance':
      return 'Create New Degree';
    case 'country':
      return 'Create New Country';
    case 'owner':
      return 'Create New Owner';
    case 'ownerType':
      return 'Create New Owner Type';
    case 'assignTo':
      return 'Create New Assign To';
    case 'inCharge':
      return 'Create New In Charge';
  }
}

export function getTenderSettingsFirstColumnLabel(tab: TabKey): string {
  switch (tab) {
    case 'status':
      return 'Status';
    case 'stage':
      return 'Stage';
    case 'type':
      return 'Type';
    case 'importance':
      return 'Degree';
    case 'country':
      return 'Country';
    case 'owner':
      return 'Owner';
    case 'ownerType':
      return 'Owner Type';
    case 'assignTo':
      return 'Assign To';
    case 'inCharge':
      return 'In Charge';
  }
}
