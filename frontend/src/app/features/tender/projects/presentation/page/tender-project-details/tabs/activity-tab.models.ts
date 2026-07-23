export type ActivityKind =
  | 'updated'
  | 'created'
  | 'deleted'
  | 'assigned'
  | 'checklist'
  | 'status'
  | 'approved'
  | 'rejected'
  | 'submitted'
  | 'uploaded'
  | 'downloaded'
  | 'imported'
  | 'exported'
  | 'shared'
  | 'archived'
  | 'restored'
  | 'login'
  | 'logout'
  | 'system'
  | 'note'
  | 'other';

export type Activity = {
  id?: number | string | null;
  entityId?: number | string | null;
  when: string;
  text?: string;
  title?: string;
  meta?: string;
  actor?: string;
  detail?: string;
  detailShort?: string;
  detailLong?: string;
  badge?: string;
  count?: number;
  icon?: string;
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'muted';
  kind?: ActivityKind;
  at?: number;
  signature?: string;
  fullTime?: string;
  key?: string;
};

export type MentionUser = {
  id?: string;
  name: string;
  email?: string;
  handle?: string;
};

export type ActivityNotePayload = {
  text: string;
  mentions: MentionUser[];
  handles: string[];
};

export const ACTIVITY_TAB_FILTERS: Array<{ id: 'all' | ActivityKind; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'updated', label: 'Updates' },
  { id: 'created', label: 'Created' },
  { id: 'deleted', label: 'Deleted' },
  { id: 'assigned', label: 'Assigned' },
  { id: 'status', label: 'Status' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'checklist', label: 'Checklist' },
  { id: 'note', label: 'Notes' },
  { id: 'uploaded', label: 'Uploaded' },
  { id: 'downloaded', label: 'Downloaded' },
  { id: 'imported', label: 'Imported' },
  { id: 'exported', label: 'Exported' },
  { id: 'shared', label: 'Shared' },
  { id: 'archived', label: 'Archived' },
  { id: 'restored', label: 'Restored' },
  { id: 'login', label: 'Login' },
  { id: 'logout', label: 'Logout' },
  { id: 'system', label: 'System' },
  { id: 'other', label: 'Other' }
];
