export function normalizeExpiresAt(raw: unknown): number | undefined {
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
        return normalizeExpiresAt(asNumber);
      }
      const parsed = Date.parse(trimmed);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
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

export function extractTokenExpiry(token?: string): number | undefined {
  if (!token) {
    return undefined;
  }
  const claims = decodeJwtPayload(token);
  if (!claims) {
    return undefined;
  }
  const expValue =
    claims.exp ??
    claims.expires_at ??
    claims.expiration ??
    claims['http://schemas.microsoft.com/ws/2008/06/identity/claims/expiration'];
  return normalizeExpiresAt(expValue);
}

export function isLikelyRefreshToken(token?: string, refreshToken?: string): boolean {
  if (!token) {
    return false;
  }
  if (refreshToken && token === refreshToken) {
    return true;
  }
  const claims = decodeJwtPayload(token);
  if (!claims) {
    return false;
  }
  const tokenType = String(
    claims.typ ?? claims.token_use ?? claims['token_type'] ?? ''
  ).toLowerCase();
  return tokenType.includes('refresh');
}
