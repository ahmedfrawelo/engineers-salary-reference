export function formatRelativeNotificationTime(timestamp: number): string {
  if (!timestamp) {
    return '';
  }
  const diff = Math.max(0, Date.now() - timestamp);
  if (diff < 60 * 1000) {
    return 'just now';
  }
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.max(1, Math.floor(diff / 60000));
    return `${minutes} min ago`;
  }
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.max(1, Math.floor(diff / 3600000));
    return `${hours} hr ago`;
  }
  if (diff < 48 * 60 * 60 * 1000) {
    return 'Yesterday';
  }

  const targetDate = new Date(timestamp);
  const nowDate = new Date();
  const sameYear = targetDate.getFullYear() === nowDate.getFullYear();

  return targetDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' })
  });
}

export function formatAbsoluteNotificationTime(timestamp: number): string {
  if (!timestamp) {
    return '';
  }

  return new Date(timestamp).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

export function formatNotificationDateTimeAttribute(timestamp: number): string | null {
  if (!timestamp) {
    return null;
  }

  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
