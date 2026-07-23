import { decodeJwtPayload } from '../core/auth/token-utils';
import { environment } from '../../environments/environment';
import { PAGE_PERMISSION_GROUPS } from '../core/authorization/permission-registry';

export { normalizeApiUrl } from '../core/http/api-url.util';

export type AuthUserProfile = {
  id: string;
  name: string;
  email: string;
  roles: string[];
  permissions?: string[];
  mustChangePassword?: boolean;
};

const ORDERED_PAGE_PERMISSIONS = PAGE_PERMISSION_GROUPS.flatMap(group =>
  group.permissions.map(permission => permission.code)
).sort();

function resolveRoleList(...candidates: unknown[]): string[] {
  for (const candidate of candidates) {
    const roles = normalizeStringList(candidate);
    if (roles.length) {
      return roles;
    }
  }
  return [];
}

function resolvePermissionList(...candidates: unknown[]): string[] {
  for (const candidate of candidates) {
    const permissions = normalizeStringList(candidate);
    if (permissions.length) {
      return permissions;
    }
  }
  return [];
}

function decodePackedPagePermissions(value: unknown): string[] {
  if (typeof value !== 'string') {
    return [];
  }

  const decoded: string[] = [];
  for (const segment of value.split('.')) {
    const index = parseBase36(segment);
    if (index == null || index < 0 || index >= ORDERED_PAGE_PERMISSIONS.length) {
      continue;
    }

    decoded.push(ORDERED_PAGE_PERMISSIONS[index]);
  }

  return decoded;
}

function parseBase36(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  let parsed = 0;
  for (const character of trimmed) {
    const digit =
      character >= '0' && character <= '9'
        ? character.charCodeAt(0) - 48
        : character >= 'a' && character <= 'z'
          ? character.charCodeAt(0) - 87
          : character >= 'A' && character <= 'Z'
            ? character.charCodeAt(0) - 55
            : -1;

    if (digit < 0) {
      return null;
    }

    parsed = parsed * 36 + digit;
  }

  return parsed;
}

export function normalizeReturnUrlPath(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return null;
  }

  try {
    const parsed = new URL(trimmed, 'https://app.local');
    const normalized = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (!normalized || normalized === '/') {
      return null;
    }
    if (/^\/(login|signup)(\/|$|\?|\#)/i.test(normalized)) {
      return null;
    }

    return normalized;
  } catch {
    return null;
  }
}

export function resolveSafeReturnUrl(
  raw: string | null | undefined,
  fallback = '/dashboard'
): string {
  const normalizedFallback = normalizeReturnUrlPath(fallback) ?? '/dashboard';
  return normalizeReturnUrlPath(raw) ?? normalizedFallback;
}

export function normalizeStoredUser(
  user: Partial<AuthUserProfile> | undefined,
  token: string
): AuthUserProfile | null {
  const userRecord = user as Record<string, unknown> | undefined;
  const storedEmail = normalizeIdentityValue(user?.email);
  const storedName = normalizeIdentityValue(user?.name);
  const storedId = normalizeIdentityValue(user?.id);
  if (storedEmail || storedName || storedId) {
    const resolvedId = storedId ?? storedEmail ?? storedName ?? 'unknown';
    const resolvedName = storedName ?? storedEmail ?? resolvedId;
    const resolvedEmail = storedEmail ?? storedName ?? resolvedId;
    // Always decode JWT for roles/permissions — JWT is the authoritative source
    // and may have been refreshed with new permissions after a role/permission change.
    const claims = decodeJwtPayload(token);
    const jwtRoles = claims
      ? resolveRoleList(
          claims.role ??
            claims.roles ??
            claims['http://schemas.microsoft.com/ws/2008/06/identity/claims/role']
        )
      : [];
    const jwtPermissions = claims
      ? Array.from(
          new Set(
            [
              ...resolvePermissionList(
                claims.permissions,
                claims.permission,
                claims.scopes,
                claims.scope
              ),
              ...decodePackedPagePermissions(claims.pp)
            ].filter(Boolean)
          )
        )
      : [];
    const storedMustChangePassword = normalizeBooleanValue(
      userRecord?.mustChangePassword ?? userRecord?.must_change_password
    );
    const claimedMustChangePassword = normalizeBooleanValue(claims?.MustChangePassword);
    return {
      id: resolvedId,
      name: resolvedName,
      email: resolvedEmail,
      roles: jwtRoles.length ? jwtRoles : resolveRoleList(user?.roles, userRecord?.role),
      permissions: jwtPermissions.length
        ? jwtPermissions
        : resolvePermissionList(
            user?.permissions,
            userRecord?.permission,
            userRecord?.userPermissions
          ),
      mustChangePassword: storedMustChangePassword ?? claimedMustChangePassword ?? false
    };
  }
  const claims = decodeJwtPayload(token);
  if (!claims) {
    return null;
  }
  const email = pickFirstClaimValue(claims, [
    'email',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
    'unique_name',
    'upn',
    'preferred_username'
  ]);
  const name =
    pickFirstClaimValue(claims, [
      'name',
      'fullName',
      'given_name',
      'family_name',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'
    ]) ?? email;
  const id =
    pickFirstClaimValue(claims, [
      'sub',
      'userId',
      'uid',
      'nameid',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'
    ]) ??
    email ??
    name;
  if (!id && !email && !name) {
    return null;
  }
  const roles = resolveRoleList(
    claims.role ??
      claims.roles ??
      claims['http://schemas.microsoft.com/ws/2008/06/identity/claims/role']
  );
  const permissions = resolvePermissionList(
    claims.permissions,
    claims.permission,
    claims.scopes,
    claims.scope,
    decodePackedPagePermissions(claims.pp)
  );
  const mustChangePassword = normalizeBooleanValue(claims.MustChangePassword) ?? false;
  return {
    id: String(id),
    name: String(name ?? id),
    email: String(email ?? name ?? id),
    roles,
    permissions,
    mustChangePassword
  };
}

export function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(item => String(item)).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  }
  return [];
}

export function pickFirstValidExpiry(
  candidates: Array<number | undefined>,
  now: number
): number | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > now + 1000) {
      return candidate;
    }
  }
  return undefined;
}

type AuthErrorShape = {
  error?: unknown;
  status?: number;
  statusCode?: number;
  message?: string;
  originalError?: unknown;
};

export function normalizeAuthError(error: unknown): Error {
  const err = error as AuthErrorShape | null | undefined;
  const originalErrorRecord = toRecord(err?.originalError);
  const originalPayload = originalErrorRecord?.['error'];
  const payload = err?.error ?? originalPayload;
  const payloadRecord = toRecord(payload);
  const originalPayloadRecord = toRecord(originalPayload);

  const status =
    err?.status ??
    err?.statusCode ??
    toNumber(originalErrorRecord?.['status']) ??
    toNumber(originalErrorRecord?.['statusCode']) ??
    (typeof payloadRecord?.['statusCode'] === 'number' ? payloadRecord['statusCode'] : undefined) ??
    (typeof payloadRecord?.['StatusCode'] === 'number' ? payloadRecord['StatusCode'] : undefined) ??
    (typeof originalPayloadRecord?.['statusCode'] === 'number'
      ? originalPayloadRecord['statusCode']
      : undefined) ??
    (typeof originalPayloadRecord?.['StatusCode'] === 'number'
      ? originalPayloadRecord['StatusCode']
      : undefined);
  const statusCode = typeof status === 'number' ? status : -1;

  // Prefer backend message when available
  let backendMsg =
    getBackendMessage(payloadRecord) ||
    getBackendMessage(originalPayloadRecord) ||
    getBackendMessage(originalErrorRecord) ||
    toMeaningfulMessage(payload) ||
    toMeaningfulMessage(err?.message) ||
    toMeaningfulMessage(originalErrorRecord?.['message']);

  if (!backendMsg) {
    backendMsg =
      toRawMessage(payload) ||
      toRawMessage(err?.message) ||
      toRawMessage(originalErrorRecord?.['message']);
  }

  // Fix: Detect HTML response (proxy errors, 502, 500 w/ default IIS page)
  if (typeof backendMsg === 'string' && backendMsg.trim().startsWith('<')) {
    if (environment.enableDebugLogs) {
      console.warn(
        '[Auth] Received HTML error response instead of JSON. Replacing with generic message.'
      );
    }
    backendMsg = null;
  }

  if (statusCode === 409) {
    return new Error(
      backendMsg || 'This email is already registered. Please sign in or use another email.'
    );
  }
  if (statusCode === 429) {
    return new Error('Too many attempts. Please wait a moment and try again.');
  }
  if (statusCode === 401) {
    return new Error(backendMsg || 'Unauthorized. Please sign in.');
  }
  if (statusCode === 403) {
    return new Error(backendMsg || 'Access denied.');
  }
  if (statusCode === 0) {
    return new Error(backendMsg || 'Network error. Please check your connection.');
  }
  if (statusCode === 502) {
    return new Error('System is currently updating or upgrading. Please try again in 2 minutes.');
  }
  if (statusCode >= 500) {
    return new Error(backendMsg || 'Server error. Please try again later.');
  }
  return new Error(backendMsg || 'Request failed.');
}

function normalizeIdentityValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function normalizeBooleanValue(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }

  return undefined;
}

function pickFirstClaimValue(claims: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = claims[key];
    if (Array.isArray(value)) {
      for (const entry of value) {
        const normalized = normalizeIdentityValue(entry);
        if (normalized) {
          return normalized;
        }
      }
      continue;
    }
    const normalized = normalizeIdentityValue(value);
    if (normalized) {
      return normalized;
    }
  }
  return null;
}

function getBackendMessage(payload: Record<string, unknown> | null): string | null {
  if (!payload) {
    return null;
  }

  const errorsValue = payload['errors'] ?? payload['Errors'];
  const fromErrors = extractErrorText(errorsValue);
  if (fromErrors) {
    return fromErrors;
  }

  const nestedError = payload['error'] ?? payload['Error'];
  const fromNestedError = extractErrorText(nestedError);
  if (fromNestedError) {
    return fromNestedError;
  }

  const directCandidates = [
    payload['message'],
    payload['Message'],
    payload['title'],
    payload['Title'],
    payload['detail'],
    payload['Detail']
  ];
  for (const candidate of directCandidates) {
    const message = toMeaningfulMessage(candidate);
    if (message) {
      return message;
    }
  }

  // Last fallback: return even generic text if that's the only available signal.
  for (const candidate of directCandidates) {
    const message = toRawMessage(candidate);
    if (message) {
      return message;
    }
  }

  return null;
}

function extractErrorText(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return toMeaningfulMessage(value) || toRawMessage(value);
  }

  if (Array.isArray(value)) {
    const meaningful = value.map(toMeaningfulMessage).find((item): item is string => !!item);
    if (meaningful) {
      return meaningful;
    }
    const raw = value.map(toRawMessage).find((item): item is string => !!item);
    return raw || null;
  }

  if (typeof value === 'object') {
    for (const entry of Object.values(value)) {
      const normalized = extractErrorText(entry);
      if (normalized) {
        return normalized;
      }
    }
  }

  return null;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }
  return undefined;
}

function toRawMessage(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toMeaningfulMessage(value: unknown): string | null {
  const raw = toRawMessage(value);
  if (!raw) {
    return null;
  }
  return isGenericMessage(raw) ? null : raw;
}

function isGenericMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  if (normalized.startsWith('http failure response for ')) {
    return true;
  }
  return (
    normalized === 'request failed' ||
    normalized === 'bad request' ||
    normalized === 'an unexpected error occurred' ||
    normalized === 'unexpected error' ||
    normalized === 'unknown error'
  );
}
