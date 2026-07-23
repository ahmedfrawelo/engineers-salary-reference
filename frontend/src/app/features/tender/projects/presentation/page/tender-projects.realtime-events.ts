type LooseValue = ReturnType<typeof JSON.parse>;

export interface TenderProjectsRealtimeEventPayload {
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

export function extractRealtimeEvent(value: unknown): TenderProjectsRealtimeEventPayload | null {
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
    channels
  };
}

export function isTenderProjectsRealtimeEvent(
  event: TenderProjectsRealtimeEventPayload | null | undefined
): boolean {
  if (!event) {
    return false;
  }

  return (
    event.module === 'tendering' ||
    event.module === 'tender-activity' ||
    event.module === 'salary-reference' ||
    event.entityName.toLowerCase() === 'project' ||
    event.entityName.toLowerCase() === 'salaryreport' ||
    event.channels.some(channel => channel.toLowerCase() === 'salary-reports') ||
    event.channels.some(channel => channel.toLowerCase().startsWith('project:'))
  );
}
