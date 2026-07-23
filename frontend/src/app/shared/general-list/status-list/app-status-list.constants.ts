import type { ConnectedPosition } from '@angular/cdk/overlay';
import type { AppStatusListColumnKey } from '../models/app-status-list.models';
import {
  APP_GROUP_ICON_CATEGORY_DEFS,
  APP_GROUP_ICON_LIBRARY,
  APP_GROUP_ICON_SEEDS
} from '@shared/icons/app-icon.tokens';

export const APP_STATUS_LIST_SUGGESTED_GROUP_NAME_SEEDS = [
  'Global Mission',
  'Client Follow-up',
  'Approvals',
  'Site Coordination',
  'Risk Watch',
  'Change Requests',
  'Supplier Actions',
  'Urgent Queue',
  'Milestones',
  'Tender Clarifications',
  'Planning',
  'Execution',
  'Validation',
  'Ready for Handover',
  'Contracts',
  'Commercial',
  'Documentation',
  'Safety',
  'Permits',
  'Engineering',
  'Design Updates',
  'Procurement',
  'Materials',
  'Equipment',
  'Logistics',
  'Factory Follow-up',
  'Site Requests',
  'Coordination',
  'Vendor Review',
  'Client Review',
  'Consultant Review',
  'Internal Review',
  'Technical Queries',
  'RFI Responses',
  'Submittals',
  'Method Statements',
  'Shop Drawings',
  'As-built Updates',
  'Punch List',
  'Commissioning',
  'Snag Clearance',
  'Dependencies',
  'Interfaces',
  'Constraints',
  'Ready to Start',
  'To Verify',
  'To Negotiate',
  'To Resolve',
  'On Hold',
  'Waiting Client',
  'Waiting Consultant',
  'Waiting Supplier',
  'Waiting Site',
  'Escalations',
  'Rework',
  'Lessons Learned',
  'Opportunities',
  'Risks',
  'Critical Path',
  'Fast Track',
  'Quick Wins',
  'Long Lead Items',
  'Cost Control',
  'Budget Check',
  'Value Engineering',
  'Scope Changes',
  'Variation Orders',
  'Claims',
  'Closeout',
  'Archive',
  'Back Office',
  'Field Team',
  'Management Review',
  'Daily Actions',
  'Weekly Targets',
  'Monthly Goals',
  'Priority A',
  'Priority B',
  'Priority C',
  'Follow-up Today',
  'Follow-up Tomorrow',
  'Blocked Externally',
  'Blocked Internally',
  'Need Decision',
  'Need Estimate',
  'Need Approval',
  'Need Signature',
  'Need Clarification',
  'Need Confirmation',
  'Ready for Client',
  'Ready for Consultant',
  'Ready for Site',
  'Ready for Procurement',
  'Delivery Tracking',
  'Inspection Queue',
  'Testing Queue',
  'NCR Actions',
  'Quality Checks',
  'Document Control',
  'Submission Pack',
  'Communication',
  'Meetings',
  'Action Items',
  'Team Tasks',
  'Owner Actions',
  'Coordinator Queue',
  'Supervisor Queue',
  'Manager Queue',
  'Director Queue',
  'Final Approval',
  'Ready to Close',
  'Closed This Week',
  'Closed This Month',
  'Carry Forward',
  'Next Sprint',
  'Upcoming',
  'This Week',
  'This Month',
  'Pipeline',
  'Initiatives',
  'Roadmap',
  'Backlog Plus',
  'Top Priority',
  'Must Do',
  'Should Do',
  'Could Do',
  'Won t Do',
  'External Dependencies',
  'Internal Dependencies',
  'Client Dependencies',
  'Consultant Dependencies',
  'Supplier Dependencies',
  'Pending Payment',
  'Pending PO',
  'Pending Delivery',
  'Pending Installation',
  'Pending Test',
  'Pending Signoff'
] as const;

export const APP_STATUS_LIST_FALLBACK_GROUP_ICON_LIBRARY = APP_GROUP_ICON_LIBRARY;

export const APP_STATUS_LIST_SUGGESTED_GROUP_ICON_SEEDS = APP_GROUP_ICON_SEEDS;

export const APP_STATUS_LIST_GROUP_ICON_CATEGORY_DEFS = APP_GROUP_ICON_CATEGORY_DEFS;

export const APP_STATUS_LIST_CUSTOM_COLOR_FORMATS = ['hex', 'rgb', 'hsl'] as const;

export const APP_STATUS_LIST_GROUP_COLOR_PRESETS = [
  '#6366f1',
  '#3b82f6',
  '#0ea5e9',
  '#14b8a6',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#a855f7',
  '#94a3b8'
] as const;

export const APP_STATUS_LIST_ROW_MENU_POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'top', overlayX: 'end', overlayY: 'top', offsetX: -8, offsetY: -6 },
  { originX: 'end', originY: 'top', overlayX: 'start', overlayY: 'top', offsetX: 8, offsetY: -6 },
  {
    originX: 'start',
    originY: 'bottom',
    overlayX: 'end',
    overlayY: 'bottom',
    offsetX: -8,
    offsetY: 6
  },
  {
    originX: 'end',
    originY: 'bottom',
    overlayX: 'start',
    overlayY: 'bottom',
    offsetX: 8,
    offsetY: 6
  }
];

export const APP_STATUS_LIST_CALC_MENU_POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 }
];

export const APP_STATUS_LIST_CELL_EDITOR_POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 }
];

export const APP_STATUS_LIST_QUICK_COMPOSE_PICKER_POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 }
];

export const APP_STATUS_LIST_CALC_OPERATION_OPTIONS = [
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
  { value: 'count', label: 'Count' }
] as const;

export const APP_STATUS_LIST_DEFAULT_COLUMNS: AppStatusListColumnKey[] = [
  'name',
  'assignee',
  'dueDate',
  'priority',
  'status',
  'taskId',
  'created',
  'updated',
  'comments',
  'dateClosed',
  'taskType'
];

export const APP_STATUS_LIST_COLUMN_HEADERS: Record<AppStatusListColumnKey, string> = {
  name: 'Name',
  assignee: 'Assignee',
  dueDate: 'Due date',
  priority: 'Priority',
  status: 'Status',
  taskId: 'Task ID',
  created: 'Date created',
  updated: 'Date updated',
  dateClosed: 'Date closed',
  comments: 'Comments',
  taskType: 'Task type',
  assignedComments: 'Assigned Comments',
  createdBy: 'Created by',
  customTaskId: 'Custom Task ID',
  dateDone: 'Date done',
  dependencies: 'Dependencies',
  latestComment: 'Latest comment',
  linkedDocs: 'Linked Docs',
  linkedTasks: 'Linked tasks',
  lists: 'Lists',
  pullRequests: 'Pull Requests',
  startDate: 'Start date',
  timeEstimate: 'Time estimate',
  timeTracked: 'Time tracked',
  project: 'Project',
  tags: 'Tags',
  progress: 'Progress',
  department: 'Department',
  position: 'Position',
  phoneNumber: 'Phone',
  loginCount: 'Logins'
};

export const APP_STATUS_LIST_DEFAULT_COLUMN_TRACK = '120px';
export const APP_STATUS_LIST_ROW_CONTROL_TRACK_WIDTH = 48;
export const APP_STATUS_LIST_ADD_COLUMN_TRACK_WIDTH = 28;
export const APP_STATUS_LIST_GRID_COLUMN_GAP_WIDTH = 9;

export const APP_STATUS_LIST_COLUMN_TEMPLATE: Partial<Record<AppStatusListColumnKey, string>> = {
  name: '280px',
  assignee: '130px',
  dueDate: '110px',
  priority: '110px',
  status: '120px',
  taskId: '100px',
  created: '100px',
  updated: '100px',
  comments: '100px',
  dateClosed: '120px',
  taskType: '120px',
  assignedComments: '180px',
  createdBy: '140px',
  customTaskId: '140px',
  dateDone: '120px',
  dependencies: '140px',
  latestComment: '180px',
  linkedDocs: '140px',
  linkedTasks: '140px',
  lists: '140px',
  pullRequests: '140px',
  startDate: '110px',
  timeEstimate: '120px',
  timeTracked: '120px',
  project: '160px',
  tags: '160px',
  progress: '120px'
};
