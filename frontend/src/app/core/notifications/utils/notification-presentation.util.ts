import type {
  Notification,
  NotificationPriority,
  NotificationType
} from '../models/notification.models';

const DISPLAY_LABEL_OVERRIDES: Record<string, string> = {
  accountlifecycle: 'Account lifecycle',
  accountnotifications: 'Notifications',
  accesscontroluser: 'Access control',
  accountprofile: 'Profile',
  accountsettings: 'Account settings',
  boq: 'BOQ',
  boqitem: 'BOQ item',
  boqitemversion: 'BOQ item version',
  boqversion: 'BOQ version',
  brand: 'Brand',
  building: 'Building',
  crm: 'CRM',
  crmcompany: 'Company',
  crmcompanynote: 'Company note',
  crmcompanynotecomment: 'Company note comment',
  crmcontact: 'Contact',
  crmcontactnote: 'Contact note',
  crmcontactnotecomment: 'Contact note comment',
  crmdeal: 'Deal',
  crmdealnote: 'Deal note',
  crmdealnotecomment: 'Deal note comment',
  family: 'Family',
  materialclassification: 'Material classification',
  material: 'Material',
  passwordsecurity: 'Security',
  permissionchange: 'Permissions',
  rolemembership: 'Role membership',
  sessionsecurity: 'Session security',
  projectassignment: 'Project assignment',
  projectchecklist: 'Project checklist',
  taskassignment: 'Task assignment',
  taskstatus: 'Task status',
  taskchecklist: 'Task checklist',
  taskchecklistitem: 'Task checklist item',
  taskactivity: 'Task activity',
  tasklink: 'Task link',
  message: 'Message',
  messaging: 'Messages',
  materialcategory: 'Material category',
  materialitem: 'Material item',
  materiallevelmap: 'Material level map',
  materialleveltype: 'Material level type',
  materialtag: 'Material tag',
  suppliermaterialcategoryconnection: 'Supplier material category',
  tag: 'Tag',
  unit: 'Unit',
  unitcategory: 'Unit category',
  valueconversion: 'Value conversion',
  project: 'Project',
  supplier: 'Suppliers',
  system: 'System'
};

const CONTEXT_LABEL_OVERRIDES: Record<string, string> = {
  supplier: 'Supplier'
};

const SIGNATURE_STOP_WORDS = new Set(['a', 'an', 'the', 'you', 'your', 'to', 'for', 'by']);
const SUBJECT_REJECTION_LABELS = new Set([
  'notification',
  'notifications',
  'supplier',
  'suppliers',
  'project',
  'projects',
  'task',
  'tasks',
  'official',
  'officials',
  'comment',
  'comments',
  'mention',
  'mentions',
  'security',
  'access'
]);
const GENERIC_ACTION_TOKENS = new Set([
  'open',
  'view',
  'detail',
  'details',
  'item',
  'items',
  'record',
  'records',
  'notification',
  'notifications',
  'supplier',
  'suppliers',
  'project',
  'projects',
  'task',
  'tasks',
  'official',
  'officials'
]);
const PROJECT_LOOKUP_TARGET_KEYS = new Set([
  'country',
  'degreeofimportance',
  'owner',
  'ownertype',
  'status',
  'tenderstage',
  'typeofproject'
]);
const ACTION_LABEL_OVERRIDES: Record<string, string> = {
  accountnotifications: 'Open notifications inbox',
  accesscontroluser: 'Open access control',
  accountprofile: 'Open profile',
  accountsettings: 'Open account settings',
  boq: 'Open BOQ workspace',
  brand: 'Open suppliers workspace',
  crmcompanies: 'Open companies',
  crmcompany: 'Open company record',
  crmcontacts: 'Open contacts',
  crmcontact: 'Open contact record',
  crmdeals: 'Open deals',
  crmdeal: 'Open deal record',
  materialclassification: 'Open material classification',
  messaging: 'Open messages',
  projectchecklist: 'Open project checklist',
  supplier: 'Open supplier details',
  official: 'Open official details',
  suppliermaterialcategoryconnection: 'Open supplier item',
  project: 'Open project details',
  priority: 'Open tasks workspace',
  task: 'Open task details',
  taskactivity: 'Open task activity',
  taskchecklist: 'Open task checklist',
  taskchecklistitem: 'Open checklist item',
  taskitem: 'Open task item',
  tasklink: 'Open task link',
  taskstatustype: 'Open tasks workspace',
  tasktype: 'Open tasks workspace',
  message: 'Open conversation',
  comment: 'Open related project',
  mention: 'Open mention context',
  passwordsecurity: 'Open security settings',
  permissionchange: 'Review security settings',
  rolemembership: 'Review role access',
  sessionsecurity: 'Review session security'
};
const TARGET_LABEL_OVERRIDES: Record<string, string> = {
  accountnotifications: 'Notifications inbox',
  accesscontroluser: 'Access control user',
  accountprofile: 'Profile',
  accountsettings: 'Account settings',
  boq: 'BOQ workspace',
  brand: 'Suppliers workspace',
  crmcompanies: 'Companies',
  crmcompany: 'Company record',
  crmcontacts: 'Contacts',
  crmcontact: 'Contact record',
  crmdeals: 'Deals',
  crmdeal: 'Deal record',
  materialclassification: 'Material classification',
  message: 'Conversation',
  messaging: 'Messages',
  official: 'Official details',
  passwordsecurity: 'Security settings',
  permissionchange: 'Access control',
  project: 'Project details',
  priority: 'Tasks workspace',
  projectchecklist: 'Project checklist',
  rolemembership: 'Role access',
  sessionsecurity: 'Session security',
  supplier: 'Supplier details',
  suppliermaterialcategoryconnection: 'Supplier item',
  task: 'Task details',
  taskactivity: 'Task activity',
  taskchecklist: 'Task checklist',
  taskchecklistitem: 'Task checklist item',
  taskitem: 'Task item',
  tasklink: 'Task link',
  taskstatustype: 'Tasks workspace',
  tasktype: 'Tasks workspace'
};
const SUBJECT_EVENT_PATTERNS = [
  /^(.+?)\s+(?:was|were|is|are)\s+(?:created|updated|deleted|archived|restored|assigned|added|removed|completed|reopened|linked|unlinked|changed|mentioned)\b/iu,
  /^(.+?)\s+has been\s+(?:created|updated|deleted|archived|restored|assigned|added|removed|completed|reopened|linked|unlinked|changed)\b/iu,
  /^(.+?)\s+(?:created|updated|deleted|archived|restored|assigned|added|removed|completed|reopened|linked|unlinked|changed)\b/iu
];
const REDUNDANT_SUBJECT_TAIL_PATTERN =
  /^(?:created|updated|deleted|archived|restored|assigned|added|removed|completed|reopened|linked|unlinked|changed|mentioned)[.?!]?$/iu;
const GENERIC_POSSESSIVE_SUBJECT_PATTERN =
  /^your\s+(?:account|access|password|permission|permissions|profile|role|roles|security|session|settings)\b/iu;

function normalizeWhitespace(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function capitalizeFirst(value: string): string {
  if (!value) {
    return '';
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function humanizeToken(value: string): string {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return '';
  }

  const compactKey = toCompactKey(normalized);
  const overridden = DISPLAY_LABEL_OVERRIDES[compactKey];
  if (overridden) {
    return overridden;
  }

  const humanized = normalized
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  return capitalizeFirst(humanized);
}

function toCompactKey(value: string | null | undefined): string {
  return normalizeWhitespace(value)
    .replace(/[\s_-]+/g, '')
    .toLowerCase();
}

function buildSignature(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter(token => !SIGNATURE_STOP_WORDS.has(token))
    .sort()
    .join(' ');
}

function stripActorPrefix(message: string, actor: string): string {
  const normalizedMessage = normalizeWhitespace(message);
  const normalizedActor = normalizeWhitespace(actor);

  if (!normalizedMessage || !normalizedActor) {
    return normalizedMessage;
  }

  if (!normalizedMessage.toLowerCase().startsWith(normalizedActor.toLowerCase())) {
    return normalizedMessage;
  }

  return normalizeWhitespace(
    normalizedMessage.slice(normalizedActor.length).replace(/^[-:,\s]+/, '')
  );
}

function stripSubjectPrefix(message: string, subject: string): string {
  const normalizedMessage = normalizeWhitespace(message);
  const normalizedSubject = normalizeWhitespace(subject);

  if (!normalizedMessage || !normalizedSubject) {
    return normalizedMessage;
  }

  if (!normalizedMessage.toLowerCase().startsWith(normalizedSubject.toLowerCase())) {
    return normalizedMessage;
  }

  return normalizeWhitespace(
    normalizedMessage
      .slice(normalizedSubject.length)
      .replace(/^[-:,\s]+/, '')
      .replace(/^(?:was|were|is|are|has been|have been)\s+/i, '')
  );
}

function pickMetadataString(
  notification: Pick<Notification, 'metadata'>,
  key: string
): string | null {
  const value = notification.metadata?.[key];
  return typeof value === 'string' ? normalizeWhitespace(value) || null : null;
}

function pickStructuredString(
  notification: Pick<Notification, 'metadata' | 'subject' | 'summary'>,
  key: 'subject' | 'summary'
): string | null {
  const directValue = key === 'subject' ? notification.subject : notification.summary;
  const normalizedDirect =
    typeof directValue === 'string' ? normalizeWhitespace(directValue) || null : null;
  return normalizedDirect ?? pickMetadataString(notification, key);
}

function cleanSubjectCandidate(
  value: string | null | undefined,
  notification: Pick<Notification, 'entityType' | 'createdByUserName' | 'title'>,
  options?: { allowActorMatch?: boolean }
): string | null {
  const candidate = normalizeWhitespace(value)
    .replace(/[.?!,:;]+$/g, '')
    .trim();
  if (!candidate) {
    return null;
  }

  const compact = toCompactKey(candidate);
  if (!compact || SUBJECT_REJECTION_LABELS.has(compact)) {
    return null;
  }

  if (GENERIC_POSSESSIVE_SUBJECT_PATTERN.test(candidate)) {
    return null;
  }

  const actor = formatNotificationActorLabel(notification.createdByUserName);
  if (!options?.allowActorMatch && actor && buildSignature(candidate) === buildSignature(actor)) {
    return null;
  }

  const entityLabel = humanizeToken(notification.entityType || '');
  if (entityLabel && buildSignature(candidate) === buildSignature(entityLabel)) {
    return null;
  }

  const title = normalizeWhitespace(notification.title);
  if (title && buildSignature(candidate) === buildSignature(title)) {
    return null;
  }

  return candidate;
}

function extractSubjectFromText(
  value: string | null | undefined,
  notification: Pick<Notification, 'entityType' | 'createdByUserName' | 'title'>
): string | null {
  const normalizedValue = normalizeWhitespace(value);
  if (!normalizedValue) {
    return null;
  }

  for (const pattern of SUBJECT_EVENT_PATTERNS) {
    const match = pattern.exec(normalizedValue);
    const subject = cleanSubjectCandidate(match?.[1], notification);
    if (subject) {
      return subject;
    }
  }

  return null;
}

function resolveActionTargetKey(
  notification: Pick<Notification, 'entityType' | 'actionUrl'>
): string | null {
  const actionUrl = normalizeWhitespace(notification.actionUrl);
  const actionPath = normalizeActionPath(actionUrl);
  if (actionUrl) {
    if (actionPath === '/crm/companies') {
      return 'crmcompanies';
    }
    if (/^\/crm\/companies\/\d+$/i.test(actionPath)) {
      return 'crmcompany';
    }
    if (actionPath === '/crm/contacts') {
      return 'crmcontacts';
    }
    if (/^\/crm\/contacts\/\d+$/i.test(actionPath)) {
      return 'crmcontact';
    }
    if (actionPath === '/crm/deals') {
      return 'crmdeals';
    }
    if (/^\/crm\/deals\/\d+$/i.test(actionPath)) {
      return 'crmdeal';
    }
    if (actionPath === '/messages') {
      return hasActionUrlQueryValue(actionUrl, 'conversationId') ? 'message' : 'messaging';
    }
    if (actionPath === '/account/notifications') {
      return 'accountnotifications';
    }
    if (actionPath === '/settings/access-control') {
      return hasActionUrlQueryValue(actionUrl, 'userId') ? 'accesscontroluser' : 'permissionchange';
    }
    if (
      actionPath === '/settings/material-classification' ||
      actionPath === '/tender/material-classification'
    ) {
      return 'materialclassification';
    }
    if (actionPath.startsWith('/tender/boq')) {
      return 'boq';
    }
    if (/officialId=/i.test(actionUrl)) {
      return 'official';
    }
    if (/supplierId=/i.test(actionUrl)) {
      return 'supplier';
    }
    if (/connectionId=/i.test(actionUrl)) {
      return 'suppliermaterialcategoryconnection';
    }
    if (
      /taskActivityId=/i.test(actionUrl) ||
      (actionPath === '/tasks' && /commentId=/i.test(actionUrl))
    ) {
      return 'taskactivity';
    }
    if (/taskChecklistItemId=/i.test(actionUrl)) {
      return 'taskchecklistitem';
    }
    if (/taskLinkId=/i.test(actionUrl)) {
      return 'tasklink';
    }
    if (/taskChecklistId=/i.test(actionUrl)) {
      return 'taskchecklist';
    }
    if (/taskItemId=/i.test(actionUrl)) {
      return 'taskitem';
    }
    if (/checklistId=/i.test(actionUrl)) {
      return 'projectchecklist';
    }
    if (/projectId=/i.test(actionUrl)) {
      return 'project';
    }
    if (/taskId=/i.test(actionUrl)) {
      return 'task';
    }
  }

  const entityKey = toCompactKey(notification.entityType);
  return entityKey || null;
}

function readActionUrlQueryParam(actionUrl: string | null | undefined, key: string): string | null {
  const normalized = normalizeWhitespace(actionUrl);
  const query = normalized.split('?', 2)[1]?.split('#', 1)[0] ?? '';
  if (!query) {
    return null;
  }

  return new URLSearchParams(query).get(key);
}

function normalizeActionPath(actionUrl: string | null | undefined): string {
  const normalized = normalizeWhitespace(actionUrl);
  if (!normalized) {
    return '';
  }

  const rawPath = normalized.split('?', 2)[0]?.split('#', 1)[0] ?? '';
  const prefixed = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  if (prefixed.length > 1) {
    return prefixed.replace(/\/+$/, '').toLowerCase();
  }

  return prefixed.toLowerCase();
}

function hasActionUrlQueryValue(actionUrl: string | null | undefined, key: string): boolean {
  return normalizeWhitespace(readActionUrlQueryParam(actionUrl, key)) !== '';
}

function readPositiveNumber(value: unknown): number | null {
  const parsed = Number(String(value ?? '').trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatReference(label: string, id: number | null): string | null {
  return id ? `${label} #${id}` : null;
}

function formatTextReference(label: string, value: string | null | undefined): string | null {
  const normalized = normalizeWhitespace(value);
  return normalized ? `${label} ${normalized}` : null;
}

function formatAccessControlUserReference(actionUrl: string | null | undefined): string | null {
  const email =
    normalizeWhitespace(readActionUrlQueryParam(actionUrl, 'email')) ||
    normalizeWhitespace(readActionUrlQueryParam(actionUrl, 'userEmail'));
  if (email) {
    return formatTextReference('User', email);
  }

  const userId =
    normalizeWhitespace(readActionUrlQueryParam(actionUrl, 'userId')) ||
    normalizeWhitespace(readActionUrlQueryParam(actionUrl, 'user')) ||
    normalizeWhitespace(readActionUrlQueryParam(actionUrl, 'id'));
  if (!userId) {
    return null;
  }

  return formatTextReference('User', userId);
}

function isGenericActionLabel(value: string): boolean {
  const signature = buildSignature(value);
  if (!signature) {
    return true;
  }

  const tokens = signature.split(' ').filter(Boolean);
  return tokens.length > 0 && tokens.every(token => GENERIC_ACTION_TOKENS.has(token));
}

function isMessagingNotification(
  notification: Pick<Notification, 'entityType' | 'sourceModule'>
): boolean {
  return (
    toCompactKey(notification.entityType) === 'message' ||
    toCompactKey(notification.sourceModule) === 'messaging'
  );
}

function isProjectLookupWorkspaceNotification(
  notification: Pick<Notification, 'actionUrl' | 'entityType'>
): boolean {
  return (
    normalizeActionPath(notification.actionUrl) === '/tender/projects' &&
    PROJECT_LOOKUP_TARGET_KEYS.has(toCompactKey(notification.entityType))
  );
}

export function formatNotificationTitle(title: string | null | undefined): string {
  return capitalizeFirst(normalizeWhitespace(title));
}

export function formatNotificationSourceLabel(
  sourceModule: string | null | undefined,
  entityType: string | null | undefined
): string {
  const candidate = sourceModule || entityType || 'system';
  return humanizeToken(candidate);
}

export function formatNotificationContextLabel(
  sourceModule: string | null | undefined,
  entityType: string | null | undefined
): string | null {
  const sourceKey = toCompactKey(sourceModule);
  const entityKey = toCompactKey(entityType);
  const sourceLabel = humanizeToken(sourceModule || '');
  const entityLabel = CONTEXT_LABEL_OVERRIDES[entityKey] ?? humanizeToken(entityType || '');

  if (sourceKey === 'messaging' || entityKey === 'message') {
    return null;
  }

  if (!entityLabel) {
    return null;
  }

  if (!sourceLabel) {
    return entityLabel;
  }

  return sourceKey === entityKey || sourceLabel.toLowerCase() === entityLabel.toLowerCase()
    ? null
    : entityLabel;
}

export function formatNotificationActionLabel(
  actionLabel: string | null | undefined,
  notification?: Pick<Notification, 'actionLabel' | 'actionUrl' | 'entityType' | 'sourceModule'>
): string {
  const resolvedLabel = normalizeWhitespace(actionLabel || notification?.actionLabel);
  if (!notification) {
    return capitalizeFirst(resolvedLabel || 'Open');
  }

  const targetKey = resolveActionTargetKey(notification);
  if (targetKey === 'messaging') {
    return ACTION_LABEL_OVERRIDES.messaging;
  }

  if (isMessagingNotification(notification) || targetKey === 'message') {
    return ACTION_LABEL_OVERRIDES.message;
  }

  if (isProjectLookupWorkspaceNotification(notification)) {
    return resolvedLabel && !isGenericActionLabel(resolvedLabel)
      ? capitalizeFirst(resolvedLabel)
      : 'Open projects workspace';
  }

  if (resolvedLabel && !isGenericActionLabel(resolvedLabel)) {
    return capitalizeFirst(resolvedLabel);
  }

  const derived = targetKey && targetKey !== 'messaging' ? ACTION_LABEL_OVERRIDES[targetKey] : null;
  return derived || capitalizeFirst(resolvedLabel || 'Open details');
}

export function formatNotificationTargetLabel(
  notification: Pick<Notification, 'actionUrl' | 'entityType' | 'entityId' | 'sourceModule'>
): string | null {
  const targetKey = resolveActionTargetKey(notification);
  if (targetKey && TARGET_LABEL_OVERRIDES[targetKey]) {
    return TARGET_LABEL_OVERRIDES[targetKey];
  }

  if (isProjectLookupWorkspaceNotification(notification)) {
    return 'Projects workspace';
  }

  const actionPath = normalizeActionPath(notification.actionUrl);
  if (actionPath === '/account/settings') {
    return 'Account settings';
  }
  if (actionPath === '/account/profile') {
    return 'Profile';
  }
  if (actionPath === '/account/notifications') {
    return 'Notifications inbox';
  }
  if (actionPath === '/settings/access-control') {
    return 'Access control';
  }
  if (
    actionPath === '/settings/material-classification' ||
    actionPath === '/tender/material-classification'
  ) {
    return 'Material classification';
  }
  if (actionPath.startsWith('/tender/boq')) {
    return 'BOQ workspace';
  }
  if (actionPath === '/messages') {
    return 'Messages';
  }

  const entityKey = toCompactKey(notification.entityType);
  const entityLabel = humanizeToken(notification.entityType || '');
  if (!entityLabel) {
    return null;
  }

  if (
    entityKey === 'supplier' ||
    entityKey === 'official' ||
    entityKey === 'project' ||
    entityKey === 'task' ||
    entityKey === 'message'
  ) {
    return `${entityLabel} details`;
  }

  return entityLabel;
}

export function formatNotificationReferenceLabel(
  notification: Pick<Notification, 'actionUrl' | 'entityType' | 'entityId' | 'sourceModule'>
): string | null {
  const actionUrl = normalizeWhitespace(notification.actionUrl);
  const queryCandidates: Array<[string, string]> = [
    ['taskChecklistItemId', 'Checklist item'],
    ['taskLinkId', 'Task link'],
    ['taskActivityId', 'Activity'],
    ['taskChecklistId', 'Task checklist'],
    ['taskItemId', 'Task item'],
    ['commentId', 'Comment'],
    ['conversationId', 'Conversation'],
    ['connectionId', 'Item'],
    ['checklistId', 'Project checklist'],
    ['supplierId', 'Supplier'],
    ['officialId', 'Official'],
    ['projectId', 'Project'],
    ['taskId', 'Task']
  ];

  for (const [key, label] of queryCandidates) {
    const id = readPositiveNumber(readActionUrlQueryParam(actionUrl, key));
    if (id) {
      return formatReference(label, id);
    }
  }

  if (
    normalizeActionPath(actionUrl) === '/account/profile' ||
    normalizeActionPath(actionUrl) === '/account/settings' ||
    normalizeActionPath(actionUrl) === '/account/notifications'
  ) {
    return null;
  }

  if (normalizeActionPath(actionUrl) === '/settings/access-control') {
    return formatAccessControlUserReference(actionUrl);
  }

  const entityId = readPositiveNumber(notification.entityId);
  if (!entityId) {
    return null;
  }

  const entityLabel = humanizeToken(notification.entityType || '') || 'Record';
  return formatReference(entityLabel, entityId);
}

export function formatNotificationPriorityLabel(priority: NotificationPriority): string {
  return humanizeToken(priority);
}

export function formatNotificationActorLabel(
  createdByUserName: string | null | undefined
): string | null {
  const actor = normalizeWhitespace(createdByUserName);
  if (!actor || actor.toLowerCase() === 'system') {
    return null;
  }

  return actor;
}

export function formatNotificationSubject(
  notification: Pick<
    Notification,
    'metadata' | 'subject' | 'summary' | 'message' | 'title' | 'entityType' | 'createdByUserName'
  >
): string | null {
  const metadataSubject = cleanSubjectCandidate(
    pickStructuredString(notification, 'subject'),
    notification,
    { allowActorMatch: true }
  );
  if (metadataSubject) {
    return metadataSubject;
  }

  const actor = formatNotificationActorLabel(notification.createdByUserName);
  const actorStrippedMessage = actor
    ? stripActorPrefix(notification.message ?? '', actor)
    : normalizeWhitespace(notification.message);
  const messageSubject = extractSubjectFromText(actorStrippedMessage, notification);
  if (messageSubject) {
    return messageSubject;
  }

  return extractSubjectFromText(notification.title, notification);
}

export function formatNotificationHeadline(
  notification: Pick<
    Notification,
    'metadata' | 'subject' | 'summary' | 'message' | 'title' | 'entityType' | 'createdByUserName'
  >
): string {
  return formatNotificationSubject(notification) || formatNotificationTitle(notification.title);
}

export function formatNotificationDisplayTitle(
  notification: Pick<
    Notification,
    | 'metadata'
    | 'subject'
    | 'summary'
    | 'message'
    | 'title'
    | 'entityType'
    | 'createdByUserName'
    | 'sourceModule'
  >
): string {
  if (isMessagingNotification(notification)) {
    const subject = formatNotificationSubject(notification);
    if (subject) {
      return subject;
    }
    const actor = formatNotificationActorLabel(notification.createdByUserName);
    return actor ? `${actor} to you` : 'New message';
  }

  return (
    formatNotificationHeadline(notification) ||
    formatNotificationTitle(notification.title) ||
    'Notification'
  );
}

export function formatNotificationDisplaySubject(
  notification: Pick<
    Notification,
    | 'metadata'
    | 'subject'
    | 'summary'
    | 'message'
    | 'title'
    | 'entityType'
    | 'createdByUserName'
    | 'sourceModule'
  >
): string | null {
  if (isMessagingNotification(notification)) {
    return formatNotificationSummary(notification);
  }

  const summary = formatNotificationSummary(notification);
  const displayTitle = formatNotificationDisplayTitle(notification);
  if (summary && buildSignature(summary) !== buildSignature(displayTitle)) {
    return summary;
  }

  const subject = formatNotificationSubject(notification);
  if (!subject) {
    return null;
  }

  return buildSignature(subject) === buildSignature(displayTitle) ? null : subject;
}

export function formatNotificationSummary(
  notification: Pick<
    Notification,
    | 'metadata'
    | 'subject'
    | 'summary'
    | 'message'
    | 'title'
    | 'entityType'
    | 'createdByUserName'
    | 'sourceModule'
  >
): string | null {
  const metadataSummary = pickStructuredString(notification, 'summary');
  if (metadataSummary) {
    return capitalizeFirst(metadataSummary);
  }

  if (isMessagingNotification(notification)) {
    return 'Direct message';
  }

  const title = formatNotificationTitle(notification.title);
  const subject = formatNotificationSubject(notification);
  if (!subject || !title) {
    return null;
  }

  return buildSignature(subject) === buildSignature(title) ? null : title;
}

export function formatNotificationMessage(
  notification: Pick<
    Notification,
    | 'metadata'
    | 'subject'
    | 'summary'
    | 'message'
    | 'title'
    | 'createdByUserName'
    | 'entityType'
    | 'sourceModule'
  >
): string | null {
  const message = normalizeWhitespace(notification.message);
  if (!message) {
    return null;
  }

  if (isMessagingNotification(notification)) {
    return capitalizeFirst(message);
  }

  const title = normalizeWhitespace(notification.title);
  const actor = formatNotificationActorLabel(notification.createdByUserName);
  const subject = formatNotificationSubject(notification);
  const summary = formatNotificationSummary(notification) || title;
  const titleSignature = buildSignature(title);
  const summarySignature = buildSignature(summary);

  if (titleSignature && buildSignature(message) === titleSignature) {
    return null;
  }

  const withoutActor = actor ? stripActorPrefix(message, actor) : message;
  if (titleSignature && buildSignature(withoutActor) === titleSignature) {
    return null;
  }

  if (subject) {
    const withoutSubject = stripSubjectPrefix(withoutActor, subject);
    if (summarySignature && buildSignature(withoutSubject) === summarySignature) {
      return null;
    }

    if (REDUNDANT_SUBJECT_TAIL_PATTERN.test(withoutSubject)) {
      return null;
    }

    if (withoutSubject && buildSignature(withoutSubject) !== buildSignature(message)) {
      return capitalizeFirst(withoutSubject);
    }
  }

  return capitalizeFirst(withoutActor || message);
}

export function shouldEmphasizeNotificationPriority(priority: NotificationPriority): boolean {
  return priority === 'high' || priority === 'urgent';
}

export function notificationTypeSymbol(type: NotificationType): string {
  switch (type) {
    case 'success':
      return '\u2713';
    case 'warning':
      return '\u26A0';
    case 'error':
      return '\u2715';
    case 'system':
      return '\u25C8';
    case 'info':
    default:
      return '\u2139';
  }
}
