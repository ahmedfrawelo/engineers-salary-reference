const DEFAULT_NOTIFICATION_TARGET = '/account/notifications';

export function normalizeNotificationTarget(
  target: string | null | undefined,
  fallback = DEFAULT_NOTIFICATION_TARGET
): string {
  const normalized = String(target || fallback).trim();
  if (!normalized || isExternalNotificationTarget(normalized)) {
    return normalized || fallback;
  }

  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

export function isExternalNotificationTarget(target: string | null | undefined): boolean {
  return /^https?:\/\//i.test(String(target ?? '').trim());
}

export function shouldOpenNotificationInNewContext(
  event: Event,
  isBrowser = typeof window !== 'undefined'
): event is MouseEvent {
  return (
    isBrowser &&
    typeof MouseEvent !== 'undefined' &&
    event instanceof MouseEvent &&
    (event.button === 1 || event.ctrlKey || event.metaKey)
  );
}
