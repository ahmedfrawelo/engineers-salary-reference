import { decodeJwtPayload } from '@core/auth/token-utils';

const LEGACY_NOTIFICATION_STORAGE_KEY = 'app-notifications';
const NOTIFICATION_STORAGE_PREFIX = 'app-notifications:';
const OWNER_CLAIM_KEYS = [
  'sub',
  'nameid',
  'nameidentifier',
  'uid',
  'userId',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn'
] as const;

export function getLegacyNotificationStorageKey(): string {
  return LEGACY_NOTIFICATION_STORAGE_KEY;
}

export function buildNotificationStorageKey(ownerKey: string): string {
  return `${NOTIFICATION_STORAGE_PREFIX}${encodeURIComponent(ownerKey)}`;
}

export function resolveNotificationStorageOwner(accessToken?: string | null): string | null {
  const token = accessToken?.trim();
  if (!token) {
    return null;
  }

  const claims = decodeJwtPayload(token);
  if (!claims) {
    return token.slice(0, 24);
  }

  for (const claimKey of OWNER_CLAIM_KEYS) {
    const claimValue = claims[claimKey];
    if (typeof claimValue === 'string') {
      const normalized = claimValue.trim();
      if (normalized) {
        return normalized;
      }
    }
  }

  return token.slice(0, 24);
}
