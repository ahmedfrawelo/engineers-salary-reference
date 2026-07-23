import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { timeout, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { AUTH_SESSION_FACADE, AuthSessionFacade } from './auth-session.facade';
import { resolveAuthRuntimeOptions } from './auth-runtime.util';
import { TokenRefreshService } from './token-refresh.service';

type LooseValue = ReturnType<typeof JSON.parse>;
const AUTH_SESSION_STORAGE_KEY = 'engineers-salary-reference.portal.session';

const debugAuth = (message: string, details?: unknown): void => {
  if (!environment.enableDebugLogs) {
    return;
  }

  if (typeof details === 'undefined') {
    console.debug(message);
    return;
  }

  console.debug(message, details);
};

const normalizeToken = (raw?: unknown): string | undefined => {
  if (typeof raw !== 'string') {
    return undefined;
  }
  const trimmed = raw.replace(/^Bearer\s+/i, '').trim();
  return trimmed || undefined;
};

const looksLikeJwt = (value: string): boolean =>
  /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(value);

const normalizeExpiresAt = (raw: unknown): number | undefined => {
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
      return normalizeExpiresAt(asNumber);
    }
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
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
};

const isLikelyRefreshToken = (token?: string, refreshToken?: string | null): boolean => {
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
};

const extractTokenExpiry = (token?: string): number | undefined => {
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
};

const unwrapSession = (raw: unknown): LooseValue => {
  let current: LooseValue = raw;
  for (let i = 0; i < 4; i++) {
    if (!current || typeof current !== 'object') {
      break;
    }
    const next = current.data ?? current.payload ?? current.result ?? current.session;
    if (!next || next === current) {
      break;
    }
    current = next;
  }
  return current;
};

const extractTokenValue = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const nested = record.accessToken ?? record.access_token ?? record.token;
    return typeof nested === 'string' ? nested : undefined;
  }
  return undefined;
};

const readTokenFromStorage = (refreshToken?: string | null): string | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const storages = [window.sessionStorage, window.localStorage];
  for (const storage of storages) {
    try {
      const raw = storage.getItem(AUTH_SESSION_STORAGE_KEY);
      if (!raw) {
        continue;
      }
      let parsed: LooseValue;
      try {
        parsed = JSON.parse(raw);
      } catch {
        const fallback = normalizeToken(raw);
        if (fallback && looksLikeJwt(fallback)) {
          return fallback;
        }
        continue;
      }
      const session = unwrapSession(parsed);
      const token = normalizeToken(
        extractTokenValue(session?.tokens?.accessToken) ??
          extractTokenValue(session?.tokens?.access_token) ??
          extractTokenValue(session?.tokens?.token) ??
          extractTokenValue(session?.token?.accessToken) ??
          extractTokenValue(session?.token?.access_token) ??
          extractTokenValue(session?.token) ??
          extractTokenValue(session?.accessToken) ??
          extractTokenValue(session?.access_token) ??
          extractTokenValue(parsed?.tokens?.accessToken) ??
          extractTokenValue(parsed?.tokens?.access_token) ??
          extractTokenValue(parsed?.tokens?.token) ??
          extractTokenValue(parsed?.token?.accessToken) ??
          extractTokenValue(parsed?.token?.access_token) ??
          extractTokenValue(parsed?.accessToken) ??
          extractTokenValue(parsed?.access_token) ??
          extractTokenValue(parsed?.token)
      );
      if (!token) {
        continue;
      }
      const refreshFromSession =
        session?.tokens?.refreshToken ??
        session?.tokens?.refresh_token ??
        session?.refreshToken ??
        session?.refresh_token ??
        parsed?.tokens?.refreshToken ??
        parsed?.tokens?.refresh_token ??
        parsed?.refreshToken ??
        parsed?.refresh_token;
      if (refreshFromSession && token === refreshFromSession) {
        continue;
      }
      if (refreshToken && token === refreshToken) {
        continue;
      }
      if (isLikelyRefreshToken(token, refreshToken)) {
        continue;
      }
      const normalizedExpiry = normalizeExpiresAt(
        session?.tokens?.expiresAt ??
          session?.tokens?.expires_at ??
          session?.expiresAt ??
          session?.expires_at ??
          parsed?.tokens?.expiresAt ??
          parsed?.tokens?.expires_at ??
          parsed?.expiresAt ??
          parsed?.expires_at
      );
      const tokenExpiry = extractTokenExpiry(token);
      if (typeof normalizedExpiry === 'number') {
        if (normalizedExpiry > Date.now()) {
          return token;
        }
        continue;
      }
      if (typeof tokenExpiry === 'number') {
        if (tokenExpiry > Date.now()) {
          return token;
        }
        continue;
      }
      if (parsed?.tokens?.expiresAt == null && parsed?.tokens?.expires_at == null) {
        return token;
      }
    } catch {
      continue;
    }
  }
  return undefined;
};

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Skip auth handling/logging for static assets (translations, images, etc.)
  // This avoids noisy logs like "No token available for request: ./assets/i18n/ar.json"
  const isAssetRequest =
    /\/assets\//i.test(req.url) ||
    /^\.\/*assets\//i.test(req.url) ||
    /\/i18n\/.*\.json(\?|$)/i.test(req.url);
  if (isAssetRequest) {
    return next(req);
  }

  const authFacade = inject<AuthSessionFacade>(AUTH_SESSION_FACADE);
  const auth = inject(AuthService);
  const tokenRefreshService = inject(TokenRefreshService);
  const authRuntime = resolveAuthRuntimeOptions();
  const isAuthEndpoint = /\/auth\/(login|refresh|register)/i.test(req.url);
  const timeoutMs = environment.http?.timeout;
  const forward = (request = req) => {
    const request$ = next(request);
    const requestWithTimeout$ =
      typeof timeoutMs === 'number' && timeoutMs > 0
        ? request$.pipe(timeout({ each: timeoutMs }))
        : request$;

    return requestWithTimeout$.pipe(
      catchError(error => {
        const status = error?.status;
        const isAuthRequest = /\/auth\//i.test(req.url);

        if (status === 401 && !isAuthRequest) {
          debugAuth('[Interceptor] 401 Unauthorized', { url: req.url, status });
        }

        return throwError(() => error);
      })
    );
  };
  if (isAuthEndpoint) {
    const authRequest = authRuntime.withCredentials ? req.clone({ withCredentials: true }) : req;
    return forward(authRequest);
  }

  if (authRuntime.useCookieAuth) {
    const cookieRequest = req.clone({
      withCredentials: authRuntime.withCredentials,
      headers: req.headers.has('Authorization') ? req.headers.delete('Authorization') : req.headers
    });
    return forward(cookieRequest);
  }
  // Critical: try multiple sources to get token to improve recovery.
  const refreshToken = tokenRefreshService.getRefreshToken();
  let token: string | undefined;

  // Priority 1: Get token from AuthFacadeService (most reliable source)
  let facadeSession = authFacade.tokens();

  // Critical: if tokens() is null, try to restore session.
  if (!facadeSession || !facadeSession.accessToken) {
    debugAuth('[Interceptor] No tokens in AuthFacade, attempting restore...');
    // Force authentication check to trigger session restore
    authFacade.isAuthenticated();
    facadeSession = authFacade.tokens(); // Re-read after restore attempt
  }
  const facadeToken = normalizeToken(facadeSession?.accessToken);
  const facadeExpiry = normalizeExpiresAt(facadeSession?.expiresAt);
  const facadeTokenExpiry = extractTokenExpiry(facadeToken);
  const effectiveFacadeExpiry = facadeTokenExpiry ?? facadeExpiry;

  if (facadeToken && !isLikelyRefreshToken(facadeToken, refreshToken)) {
    // Check if token is expired
    const isExpired =
      typeof effectiveFacadeExpiry === 'number' && effectiveFacadeExpiry <= Date.now();
    if (!isExpired) {
      token = facadeToken;
      auth.setToken(token);
      debugAuth('[Interceptor] Token found in AuthFacade');
    }
  }

  // Priority 2: Get token from AuthService (fallback)
  if (!token) {
    const serviceToken = normalizeToken(auth.getToken());
    const serviceTokenExpiry = extractTokenExpiry(serviceToken);
    const serviceTokenExpired =
      typeof serviceTokenExpiry === 'number' && serviceTokenExpiry <= Date.now();
    if (serviceToken && !serviceTokenExpired && !isLikelyRefreshToken(serviceToken, refreshToken)) {
      token = serviceToken;
      debugAuth('[Interceptor] Token found in AuthService');
    }
  }

  // Priority 3: Read token directly from storage (last resort)
  if (!token) {
    const storageToken = readTokenFromStorage(refreshToken);
    if (storageToken) {
      token = storageToken;
      auth.setToken(token);
      // Also update AuthFacade to keep it in sync
      const currentSession = authFacade.tokens();
      if (currentSession && currentSession.accessToken !== token) {
        authFacade.tokens.set({ ...currentSession, accessToken: token });
      }
      debugAuth('[Interceptor] Token found in storage');
    }
  }
  const scheme = (environment.authHeaderScheme ?? 'bearer').toLowerCase();

  debugAuth(`[Interceptor] ${req.method} ${req.url}`, { hasToken: !!token });

  let authReq = authRuntime.withCredentials ? req.clone({ withCredentials: true }) : req;
  const existingAuth = req.headers.get('Authorization');

  // Critical: if request already has Authorization header, do not override it.
  // It may have been set by tokenRefreshInterceptor with a fresh token.
  if (existingAuth && existingAuth.trim()) {
    debugAuth('[AuthInterceptor] Request already has Authorization header; keeping it.');
    return forward(authReq);
  }

  const existingToken = existingAuth ? normalizeToken(existingAuth) : undefined;
  const existingIsJwt = !!existingToken && looksLikeJwt(existingToken);
  const existingIsRefresh = existingIsJwt && isLikelyRefreshToken(existingToken, refreshToken);
  const existingExpiry = existingIsJwt ? extractTokenExpiry(existingToken) : undefined;
  const existingExpired = typeof existingExpiry === 'number' && existingExpiry <= Date.now();
  const canUseExisting = existingIsJwt && !existingIsRefresh && !existingExpired;

  const resolvedToken = token && !isLikelyRefreshToken(token, refreshToken) ? token : undefined;
  const resolvedExpiry = resolvedToken ? extractTokenExpiry(resolvedToken) : undefined;
  const resolvedExpired = typeof resolvedExpiry === 'number' && resolvedExpiry <= Date.now();

  if (resolvedToken && !resolvedExpired && !canUseExisting) {
    const authHeaderValue = scheme === 'raw' ? resolvedToken : `Bearer ${resolvedToken}`;
    authReq = authReq.clone({
      setHeaders: {
        Authorization: authHeaderValue
      }
    });

    debugAuth('[AuthInterceptor] Authorization header set from resolved access token.');
    if (existingAuth) {
      debugAuth('[AuthInterceptor] Existing Authorization header was replaced.');
    }
  } else if (!resolvedToken && existingIsRefresh) {
    authReq = authReq.clone({ headers: authReq.headers.delete('Authorization') });
    debugAuth('[AuthInterceptor] Removed refresh-token Authorization header.', { url: req.url });
  } else if (canUseExisting) {
    debugAuth('[AuthInterceptor] Using existing valid Authorization header.');
  } else if (environment.enableDebugLogs) {
    if (existingAuth) {
      debugAuth('[AuthInterceptor] Request has Authorization header but no valid access token:', {
        url: req.url,
        hasAuthorizationHeader: true,
        hasResolvedToken: !!resolvedToken,
        resolvedExpired
      });
    } else {
      debugAuth('[AuthInterceptor] No token available for request.', { url: req.url });
    }
  }
  return forward(authReq);
};
