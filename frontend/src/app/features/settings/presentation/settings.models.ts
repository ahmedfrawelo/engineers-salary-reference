export type SettingsPresentationMode = 'overlay' | 'page';

export type SettingsCardTone = 'materials' | 'supplier' | 'commercial' | 'access' | 'appearance';

export type SettingsAction = {
  label: string;
  routerLink?: string | string[];
  primary?: boolean;
};

export type SettingsPlannedAction = {
  label: string;
};

export type SettingsCategory = {
  id: string;
  eyebrow: string;
  title: string;
  focus: string;
  description: string;
  scope: string[];
  icon: string;
  tone: SettingsCardTone;
  availableActions: SettingsAction[];
  plannedActions: SettingsPlannedAction[];
};
