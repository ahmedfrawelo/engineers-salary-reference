export type TenderProjectsRealtimeCandidate = {
  module?: string | null;
  entityName?: string | null;
  entityId?: string | null;
  channels?: string[] | null;
};

const normalizeString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const normalizeChannels = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(channel => normalizeString(channel)).filter(Boolean) : [];

export function isTenderProjectsRealtimeCandidate(
  event: TenderProjectsRealtimeCandidate | null | undefined
): boolean {
  if (!event) {
    return false;
  }

  const moduleName = normalizeString(event.module).toLowerCase();
  const entityName = normalizeString(event.entityName).toLowerCase();
  const channels = normalizeChannels(event.channels);

  return (
    moduleName === 'tendering' ||
    moduleName === 'tender-activity' ||
    entityName === 'project' ||
    channels.some(channel => channel.toLowerCase().startsWith('project:'))
  );
}

export function extractTenderProjectsRealtimeProjectIdFromCandidate(
  event: TenderProjectsRealtimeCandidate | null | undefined
): number | null {
  if (!isTenderProjectsRealtimeCandidate(event)) {
    return null;
  }

  const channels = normalizeChannels(event?.channels);
  const projectChannel = channels.find(channel => channel.toLowerCase().startsWith('project:'));
  if (projectChannel) {
    const parsedChannelId = Number.parseInt(projectChannel.split(':')[1] ?? '', 10);
    if (Number.isInteger(parsedChannelId) && parsedChannelId > 0) {
      return parsedChannelId;
    }
  }

  if (normalizeString(event?.entityName).toLowerCase() === 'project') {
    const parsedEntityId = Number.parseInt(
      normalizeString(event?.entityId).split('|')[0] ?? '',
      10
    );
    if (Number.isInteger(parsedEntityId) && parsedEntityId > 0) {
      return parsedEntityId;
    }
  }

  return null;
}
