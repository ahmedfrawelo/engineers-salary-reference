export type AppStatusListBulletTone = 'default' | 'pending' | 'error';

export type AppStatusListColumnKey =
  | 'name'
  | 'assignee'
  | 'dueDate'
  | 'priority'
  | 'status'
  | 'taskId'
  | 'created'
  | 'updated'
  | 'dateClosed'
  | 'comments'
  | 'taskType'
  | 'assignedComments'
  | 'createdBy'
  | 'customTaskId'
  | 'dateDone'
  | 'dependencies'
  | 'latestComment'
  | 'linkedDocs'
  | 'linkedTasks'
  | 'lists'
  | 'pullRequests'
  | 'startDate'
  | 'timeEstimate'
  | 'timeTracked'
  | 'project'
  | 'tags'
  | 'progress'
  // User management columns
  | 'department'
  | 'position'
  | 'phoneNumber'
  | 'loginCount';

export type AppStatusListColumnWidths = Partial<Record<AppStatusListColumnKey, number | string>>;

export type AppStatusListCellEditorType =
  | 'status'
  | 'priority'
  | 'assignee'
  | 'comments'
  | 'date'
  | 'text';

export interface AppStatusListCellEditorOption {
  value: string;
  label: string;
  icon?: string;
  toneClass?: string;
  section?: string;
  meta?: string;
}

export interface AppStatusListCellEditorConfig {
  type: AppStatusListCellEditorType;
  title?: string;
  placeholder?: string;
  options?: ReadonlyArray<AppStatusListCellEditorOption>;
  searchable?: boolean;
}

export interface AppStatusListRow<TPayload = unknown> {
  id: string;
  title: string;
  code?: string;
  owner?: string;
  ownerInitials?: string;
  dueLabel?: string;
  dueOverdue?: boolean;
  priorityLabel?: string;
  priorityClass?: string;
  statusLabel?: string;
  statusClass?: string;
  idLabel?: string;
  createdLabel?: string;
  updatedLabel?: string;
  commentsCount?: number;
  typeLabel?: string;
  extras?: Partial<Record<AppStatusListColumnKey, string>>;
  bulletTone?: AppStatusListBulletTone;
  payload?: TPayload;
}

export interface AppStatusListGroup<TPayload = unknown> {
  id: string;
  name: string;
  toneClass?: string;
  count: number;
  rows: AppStatusListRow<TPayload>[];
}

export interface AppStatusListRowClickEvent<TPayload = unknown> {
  groupId: string;
  row: AppStatusListRow<TPayload>;
}

export interface AppStatusListCellEditEvent<TPayload = unknown> {
  groupId: string;
  row: AppStatusListRow<TPayload>;
  column: AppStatusListColumnKey;
  value: string;
}

export interface AppStatusListCellCommentEvent<TPayload = unknown> {
  groupId: string;
  row: AppStatusListRow<TPayload>;
  column: AppStatusListColumnKey;
  comment: string;
}

export interface AppStatusListRowMoveEvent<TPayload = unknown> {
  sourceGroupId: string;
  targetGroupId: string;
  previousIndex: number;
  currentIndex: number;
  row: AppStatusListRow<TPayload>;
}

export interface AppStatusListGroupMoveEvent<TPayload = unknown> {
  previousIndex: number;
  currentIndex: number;
  group: AppStatusListGroup<TPayload>;
}

export type AppStatusListGroupAction =
  | 'newStatus'
  | 'editStatuses'
  | 'hideStatus'
  | 'collapseAllGroups'
  | 'automateStatus';

export interface AppStatusListGroupActionEvent {
  groupId: string;
  action: AppStatusListGroupAction;
}

export interface AppStatusListGroupRenameEvent {
  groupId: string;
  name: string;
}

export interface AppStatusListQuickAddEvent {
  groupId: string;
  title: string;
  status?: string;
  taskType?: string;
}
