type StoredTokenResult = { token: string | null; expiresAt?: number } | null;

export interface UserAccessAuthHost {
  authFacade: {
    tokens(): unknown;
  };
  auth: {
    setToken(token: string): void;
    getToken(): string | null;
  };
  lastAuthToken: string | null;
  asRecord(value: unknown): Record<string, unknown> | null;
}

export function normalizeUserAccessToken(raw?: string | null): string | null {
  if (typeof raw !== 'string' || !raw) {
    return null;
  }
  return raw.replace(/^Bearer\s+/i, '').trim() || null;
}

export function unwrapUserAccessStoredSession(raw: unknown): unknown {
  let current: unknown = raw;
  for (let i = 0; i < 4; i++) {
    if (!current || typeof current !== 'object') {
      break;
    }
    const record = current as Record<string, unknown>;
    const next = record.data ?? record.payload ?? record.result ?? record.session;
    if (!next || next === current) {
      break;
    }
    current = next;
  }
  return current;
}

export function extractUserAccessTokenValue(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const nested = record.accessToken ?? record.access_token ?? record.token;
    return typeof nested === 'string' ? nested : null;
  }
  return null;
}

export function normalizeUserAccessExpiresAt(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw < 1_000_000_000) {
      return Date.now() + raw * 1000;
    }
    if (raw < 1_000_000_000_000) {
      return raw * 1000;
    }
    return raw;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed) {
      const asNumber = Number(trimmed);
      if (Number.isFinite(asNumber)) {
        return normalizeUserAccessExpiresAt(asNumber);
      }
      const parsed = Date.parse(trimmed);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}

export function decodeUserAccessJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }
  const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = payload.padEnd(payload.length + (4 - (payload.length % 4 || 4)), '=');
  try {
    if (typeof atob !== 'function') {
      return null;
    }
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export function extractUserAccessTokenExpiry(token?: string | null): number | undefined {
  if (!token) {
    return undefined;
  }
  const claims = decodeUserAccessJwtPayload(token);
  if (!claims) {
    return undefined;
  }
  const expValue =
    claims.exp ??
    claims.expires_at ??
    claims.expiration ??
    claims['http://schemas.microsoft.com/ws/2008/06/identity/claims/expiration'];
  return normalizeUserAccessExpiresAt(expValue);
}

export function isLikelyUserAccessRefreshToken(
  token: string,
  refreshToken?: string | null
): boolean {
  if (refreshToken && token === refreshToken) {
    return true;
  }
  const claims = decodeUserAccessJwtPayload(token);
  if (!claims) {
    return false;
  }
  const tokenType = String(
    claims.typ ?? claims.token_use ?? claims['token_type'] ?? ''
  ).toLowerCase();
  return tokenType.includes('refresh');
}

export function readUserAccessStoredToken(host: UserAccessAuthHost): StoredTokenResult {
  if (typeof sessionStorage === 'undefined' || typeof localStorage === 'undefined') {
    return null;
  }
  const sessionData = sessionStorage.getItem('engineers-salary-reference.portal.session');
  const localData = localStorage.getItem('engineers-salary-reference.portal.session');
  const raw = sessionData || localData;
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    const session = unwrapUserAccessStoredSession(parsed);
    const parsedRecord = host.asRecord(parsed);
    const parsedTokens = host.asRecord(parsedRecord?.tokens);
    const parsedTokenObj = host.asRecord(parsedRecord?.token);
    const sessionRecord = host.asRecord(session);
    const sessionTokens = host.asRecord(sessionRecord?.tokens);
    const sessionTokenObj = host.asRecord(sessionRecord?.token);
    const token = normalizeUserAccessToken(
      extractUserAccessTokenValue(sessionTokens?.accessToken) ??
        extractUserAccessTokenValue(sessionTokens?.access_token) ??
        extractUserAccessTokenValue(sessionTokens?.token) ??
        extractUserAccessTokenValue(sessionTokenObj?.accessToken) ??
        extractUserAccessTokenValue(sessionTokenObj?.access_token) ??
        extractUserAccessTokenValue(sessionRecord?.token) ??
        extractUserAccessTokenValue(sessionRecord?.accessToken) ??
        extractUserAccessTokenValue(sessionRecord?.access_token) ??
        extractUserAccessTokenValue(parsedTokens?.accessToken) ??
        extractUserAccessTokenValue(parsedTokens?.access_token) ??
        extractUserAccessTokenValue(parsedTokens?.token) ??
        extractUserAccessTokenValue(parsedTokenObj?.accessToken) ??
        extractUserAccessTokenValue(parsedTokenObj?.access_token) ??
        extractUserAccessTokenValue(parsedRecord?.accessToken) ??
        extractUserAccessTokenValue(parsedRecord?.access_token) ??
        extractUserAccessTokenValue(parsedRecord?.token)
    );
    const refreshToken = normalizeUserAccessToken(
      extractUserAccessTokenValue(sessionTokens?.refreshToken) ??
        extractUserAccessTokenValue(sessionTokens?.refresh_token) ??
        extractUserAccessTokenValue(sessionRecord?.refreshToken) ??
        extractUserAccessTokenValue(sessionRecord?.refresh_token) ??
        extractUserAccessTokenValue(parsedTokens?.refreshToken) ??
        extractUserAccessTokenValue(parsedTokens?.refresh_token) ??
        extractUserAccessTokenValue(parsedRecord?.refreshToken) ??
        extractUserAccessTokenValue(parsedRecord?.refresh_token) ??
        sessionStorage.getItem('engineers-salary-reference.portal.refresh') ??
        localStorage.getItem('engineers-salary-reference.portal.refresh')
    );
    if (token && isLikelyUserAccessRefreshToken(token, refreshToken)) {
      return null;
    }
    const expiresAt = normalizeUserAccessExpiresAt(
      sessionTokens?.expiresAt ??
        sessionTokens?.expires_at ??
        sessionRecord?.expiresAt ??
        sessionRecord?.expires_at ??
        parsedTokens?.expiresAt ??
        parsedTokens?.expires_at ??
        parsedRecord?.expiresAt ??
        parsedRecord?.expires_at
    );
    const tokenExpiry = extractUserAccessTokenExpiry(token);
    return { token, expiresAt: expiresAt ?? tokenExpiry };
  } catch {
    return null;
  }
}

export function resolveUserAccessAuthToken(host: UserAccessAuthHost): string | null {
  const facadeSession = host.asRecord(host.authFacade.tokens());
  const facadeToken = normalizeUserAccessToken(
    typeof facadeSession?.accessToken === 'string' ? facadeSession.accessToken : null
  );
  if (facadeToken) {
    const expiresAt = normalizeUserAccessExpiresAt(facadeSession?.expiresAt);
    if (typeof expiresAt !== 'number' || expiresAt > Date.now()) {
      host.auth.setToken(facadeToken);
      return facadeToken;
    }
  }

  const fromStorage = readUserAccessStoredToken(host);
  if (fromStorage?.token) {
    if (typeof fromStorage.expiresAt !== 'number' || fromStorage.expiresAt > Date.now()) {
      host.auth.setToken(fromStorage.token);
      return fromStorage.token;
    }
  }

  const fromService = normalizeUserAccessToken(host.auth.getToken());
  if (fromService) {
    return fromService;
  }

  const cached = normalizeUserAccessToken(host.lastAuthToken);
  if (cached) {
    host.auth.setToken(cached);
    return cached;
  }
  return null;
}
