type RequestLike = {
  method?: string | null;
  url?: string | null;
};

type ErrorLike = {
  status?: number | null;
  message?: string | null;
  statusText?: string | null;
  error?: unknown;
  headers?: {
    get?(name: string): string | null | undefined;
  } | null;
};

export function normalizeAuthExpiry(raw: unknown): number | undefined {
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
    if (!trimmed) {
      return undefined;
    }
    const asNumber = Number(trimmed);
    if (Number.isFinite(asNumber)) {
      return normalizeAuthExpiry(asNumber);
    }
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

export function isSessionProbablyStillActive(
  sessionExpiresAt?: unknown,
  tokenExpiresAt?: unknown,
  now = Date.now()
): boolean {
  const normalizedTokenExpiry = normalizeAuthExpiry(tokenExpiresAt);
  if (typeof normalizedTokenExpiry === 'number') {
    return normalizedTokenExpiry > now;
  }

  const normalizedSessionExpiry = normalizeAuthExpiry(sessionExpiresAt);
  if (typeof normalizedSessionExpiry === 'number') {
    return normalizedSessionExpiry > now;
  }

  // When we cannot prove the session is expired, avoid forcing a logout from
  // a single failing resource request.
  return true;
}

function extractErrorText(error: ErrorLike): string {
  const errorBody = error?.error as { message?: unknown } | string | null | undefined;
  const headerText =
    error?.headers?.get?.('www-authenticate') ?? error?.headers?.get?.('WWW-Authenticate') ?? '';
  return String(
    error?.message ||
      (typeof errorBody === 'object' ? errorBody?.message : '') ||
      (typeof errorBody === 'string' ? errorBody : '') ||
      headerText ||
      error?.statusText ||
      ''
  ).toLowerCase();
}

export function isInvalidTokenUnauthorizedError(error: ErrorLike): boolean {
  if (error?.status !== 401) {
    return false;
  }

  const errorText = extractErrorText(error);
  return (
    errorText.includes('invalid_token') ||
    errorText.includes('token expired') ||
    errorText.includes('expired token') ||
    errorText.includes('invalid signature') ||
    errorText.includes('signature validation failed')
  );
}

export function isExplicitPermissionLikeUnauthorizedError(error: ErrorLike): boolean {
  const errorText = extractErrorText(error);
  return (
    errorText.includes('permission') ||
    errorText.includes('forbidden') ||
    errorText.includes('access denied')
  );
}

export function isTransientRefreshFailure(error: ErrorLike): boolean {
  if ((error as { isRefreshTokenExpired?: unknown } | null | undefined)?.isRefreshTokenExpired) {
    return false;
  }

  const status = Number(
    error?.status ?? (error?.error as { status?: unknown } | null | undefined)?.status ?? Number.NaN
  );

  if (!Number.isFinite(status)) {
    return true;
  }

  return status === 0 || status === 408 || status === 429 || status >= 500;
}

export function isPermissionLikeUnauthorizedRequest(
  request: RequestLike,
  error: ErrorLike,
  now = Date.now(),
  sessionExpiresAt?: unknown
): boolean {
  void request;
  void now;
  void sessionExpiresAt;

  if (error?.status !== 401) {
    return false;
  }

  if (isInvalidTokenUnauthorizedError(error)) {
    return false;
  }

  if (isExplicitPermissionLikeUnauthorizedError(error)) {
    return true;
  }
  return false;
}
