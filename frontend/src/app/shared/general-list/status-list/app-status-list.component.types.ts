import type { CdkOverlayOrigin } from '@angular/cdk/overlay';
import type {
  AppStatusListCellEditorOption,
  AppStatusListCellEditorType,
  AppStatusListColumnKey,
  AppStatusListRow
} from '../models/app-status-list.models';

export type QuickComposePickerTab = 'status' | 'taskType';
export type ColorTextFormat = 'hex' | 'rgb' | 'hsl';
export type GroupPickerTab = 'color' | 'icon';

export type SuggestedGroupOption = {
  name: string;
  color: string;
  icon: string;
};

export type CustomListGroup = {
  id: string;
  name: string;
  color: string;
  icon: string;
};

export type AppStatusListRowAction =
  | 'copyLink'
  | 'copyId'
  | 'newTab'
  | 'addColumn'
  | 'favorite'
  | 'rename'
  | 'convertTo'
  | 'convertToList'
  | 'convertToSubtask'
  | 'taskType'
  | 'duplicate'
  | 'remindInbox'
  | 'unfollowTask'
  | 'sendEmail'
  | 'addTo'
  | 'merge'
  | 'move'
  | 'startTimer'
  | 'dependencies'
  | 'templates'
  | 'archive'
  | 'delete'
  | 'sharePermissions';

export type QuickComposePickerState = {
  groupId: string;
  origin: CdkOverlayOrigin;
  tab: QuickComposePickerTab;
  search: string;
};

export type ActiveResizeState = {
  column: AppStatusListColumnKey;
  startX: number;
  startWidth: number;
};

export type ActiveCellEditorState<TPayload> = {
  groupId: string;
  row: AppStatusListRow<TPayload>;
  column: AppStatusListColumnKey;
  type: AppStatusListCellEditorType;
  title: string;
  placeholder: string;
  options: AppStatusListCellEditorOption[];
  searchable: boolean;
  value: string;
  origin: CdkOverlayOrigin;
  width: number;
};

export type ActiveRowMenuState<TPayload> = {
  groupId: string;
  row: AppStatusListRow<TPayload>;
  origin: CdkOverlayOrigin;
  submenuSide: 'left' | 'right';
  attachSide: 'left' | 'right';
};

export type ActiveCalcMenuState = {
  groupId: string;
  column: AppStatusListColumnKey;
  origin: CdkOverlayOrigin;
};
