type LooseValue = ReturnType<typeof JSON.parse>;

export interface RealtimeEventPayload {
  eventId?: string;
  module: string;
  entityName: string;
  action: string;
  entityId?: string | null;
  occurredAt?: string;
  initiatedByUserId?: string | null;
  initiatedByUserName?: string | null;
  changedFields: string[];
  channels: string[];
  data?: Record<string, unknown> | null;
}

export interface RealtimeConnectedPayload {
  connectionId?: string;
  userId?: string | null;
  defaultChannels: string[];
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const normalizeString = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
};

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(item => normalizeString(item)).filter(Boolean);
};

export function extractRealtimeEvent(value: unknown): RealtimeEventPayload | null {
  const message = asRecord(value);
  const candidate =
    normalizeString(message?.type).toLowerCase() === 'event' ? message?.payload : value;
  const record = asRecord(candidate);

  if (!record) {
    return null;
  }

  const module = normalizeString(record.module);
  const entityName = normalizeString(record.entityName);
  const action = normalizeString(record.action);
  const changedFields = normalizeStringArray(record.changedFields);
  const channels = normalizeStringArray(record.channels);
  const data = asRecord(record.data);

  if (!module && !entityName && !action && channels.length === 0) {
    return null;
  }

  return {
    eventId: normalizeString(record.eventId) || undefined,
    module,
    entityName,
    action,
    entityId: normalizeString(record.entityId) || null,
    occurredAt: normalizeString(record.occurredAt) || undefined,
    initiatedByUserId: normalizeString(record.initiatedByUserId) || null,
    initiatedByUserName: normalizeString(record.initiatedByUserName) || null,
    changedFields,
    channels,
    data
  };
}

export function extractRealtimeConnectedPayload(value: unknown): RealtimeConnectedPayload | null {
  const message = asRecord(value);
  const candidate =
    normalizeString(message?.type).toLowerCase() === 'connected' ? message?.payload : value;
  const record = asRecord(candidate);

  if (!record) {
    return null;
  }

  const connectionId = normalizeString(record.connectionId);
  const userId = normalizeString(record.userId);
  const defaultChannels = normalizeStringArray(record.defaultChannels);

  if (!connectionId && !userId && defaultChannels.length === 0) {
    return null;
  }

  return {
    connectionId: connectionId || undefined,
    userId: userId || null,
    defaultChannels
  };
}

export function hasRealtimeChannelPrefix(
  event: RealtimeEventPayload | null | undefined,
  prefix: string
): boolean {
  if (!event) {
    return false;
  }

  const normalizedPrefix = normalizeString(prefix).toLowerCase();
  if (!normalizedPrefix) {
    return false;
  }

  return event.channels.some(channel => channel.toLowerCase().startsWith(normalizedPrefix));
}

export function matchesRealtimeModule(
  event: RealtimeEventPayload | null | undefined,
  moduleName: string
): boolean {
  if (!event) {
    return false;
  }

  const normalizedModule = normalizeString(moduleName).toLowerCase();
  return (
    event.module.toLowerCase() === normalizedModule ||
    hasRealtimeChannelPrefix(event, `module:${normalizedModule}`)
  );
}

export function isNotificationRealtimeEvent(
  event: RealtimeEventPayload | null | undefined
): boolean {
  if (!event) {
    return false;
  }

  const entityName = event.entityName.toLowerCase();
  return entityName === 'notification' || entityName === 'mention';
}

export function isTenderProjectsRealtimeEvent(
  event: RealtimeEventPayload | null | undefined
): boolean {
  if (!event) {
    return false;
  }

  return (
    event.module === 'tendering' ||
    event.module === 'tender-activity' ||
    event.entityName.toLowerCase() === 'project' ||
    hasRealtimeChannelPrefix(event, 'project:')
  );
}

export function isTasksRealtimeEvent(event: RealtimeEventPayload | null | undefined): boolean {
  return matchesRealtimeModule(event, 'tasks');
}

export function isSuppliersRealtimeEvent(event: RealtimeEventPayload | null | undefined): boolean {
  return matchesRealtimeModule(event, 'suppliers');
}

export function isMaterialsRealtimeEvent(event: RealtimeEventPayload | null | undefined): boolean {
  return matchesRealtimeModule(event, 'materials');
}

export function isIdentityRealtimeEvent(event: RealtimeEventPayload | null | undefined): boolean {
  return matchesRealtimeModule(event, 'identity');
}
