import { Injectable, inject } from '@angular/core';
import { HttpBackend, HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, ReplaySubject, throwError, timer } from 'rxjs';
import {
  catchError,
  switchMap,
  tap,
  filter,
  take,
  shareReplay,
  finalize,
  map
} from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { runtimeConfig } from '../runtime-config';
import { AuthService } from './auth.service';
import { COOKIE_AUTH_SESSION_TOKEN, resolveAuthRuntimeOptions } from './auth-runtime.util';

type LooseValue = ReturnType<typeof JSON.parse>;
type AuthMode = 'bearer' | 'cookie';
type SessionUser = {
  id: string;
  name: string;
  email: string;
  roles: string[];
  permissions?: string[];
  mustChangePassword?: boolean;
};

export interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  expiresIn?: number;
  authMode?: AuthMode;
  user?: SessionUser;
}

const AUTH_SESSION_STORAGE_KEY = 'engineers-salary-reference.portal.session';
const REFRESH_TOKEN_KEY = 'engineers-salary-reference.portal.refresh';
const TOKEN_REFRESH_BUFFER_MS = 2 * 60 * 1000; // Refresh 2 minutes before expiry (was 5 min)
const DEFAULT_EXPIRY_MS = (environment.security?.tokenExpirationHours ?? 1) * 60 * 60 * 1000;

const normalizeToken = (raw?: unknown): string | undefined => {
  if (typeof raw !== 'string') {
    return undefined;
  }
  const trimmed = raw.replace(/^Bearer\s+/i, '').trim();
  return trimmed || undefined;
};

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

const resolveTokenExpiry = (token: string | undefined, rawExpiry: unknown): number | undefined => {
  return normalizeExpiresAt(rawExpiry) ?? extractTokenExpiry(token);
};

const collectByKeys = (
  source: unknown,
  keys: string[],
  coerce: (value: unknown) => string | undefined,
  maxDepth = 5
): string | undefined => {
  if (!source || maxDepth < 0) {
    return undefined;
  }
  const keySet = new Set(keys.map(key => key.toLowerCase()));
  const seen = new Set<unknown>();
  const stack: Array<{ value: unknown; depth: number }> = [{ value: source, depth: 0 }];

  while (stack.length) {
    const { value, depth } = stack.pop()!;
    if (!value || typeof value !== 'object') {
      continue;
    }
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);

    if (Array.isArray(value)) {
      if (depth < maxDepth) {
        for (const entry of value) {
          stack.push({ value: entry, depth: depth + 1 });
        }
      }
      continue;
    }

    const record = value as Record<string, unknown>;
    for (const [key, entry] of Object.entries(record)) {
      if (keySet.has(key.toLowerCase())) {
        const extracted = coerce(entry);
        if (typeof extracted === 'string' && extracted.trim()) {
          return extracted;
        }
      }
      if (depth < maxDepth && entry && typeof entry === 'object') {
        stack.push({ value: entry, depth: depth + 1 });
      }
    }
  }
  return undefined;
};

const collectByOrderedKeys = (
  source: unknown,
  keys: string[],
  coerce: (value: unknown) => string | undefined,
  maxDepth = 5
): string | undefined => {
  for (const key of keys) {
    const found = collectByKeys(source, [key], coerce, maxDepth);
    if (typeof found === 'string' && found.trim()) {
      return found;
    }
  }
  return undefined;
};

const extractHeaderToken = (raw: LooseValue): string | undefined => {
  const headers = raw?.headers;
  if (!headers || typeof headers.get !== 'function') {
    return undefined;
  }
  const headerValue =
    headers.get('Authorization') ??
    headers.get('authorization') ??
    headers.get('X-Access-Token') ??
    headers.get('x-access-token') ??
    headers.get('Access-Token') ??
    headers.get('access-token');
  return normalizeToken(headerValue);
};

const normalizeTokenResponse = (raw: LooseValue): TokenResponse => {
  const body = raw?.body ?? raw;

  // Critical fix: backend returns wrapped response with { success, statusCode, message, data }.
  // Extract the actual data from the wrapper
  const data = body?.data ?? body?.payload ?? body?.result ?? body;
  const authMode = resolveResponseAuthMode(raw);

  const primaryAccessTokenKeys = ['accessToken', 'access_token'];
  const secondaryAccessTokenKeys = [
    'jwt',
    'idToken',
    'id_token',
    'bearerToken',
    'authToken',
    'auth_token',
    'sessionToken',
    'session_token'
  ];
  const fallbackAccessTokenKeys = ['token', 'authorization', 'bearer'];
  const refreshTokenKeys = ['refreshToken', 'refresh_token'];
  const headerToken = extractHeaderToken(raw);
  const explicitAccessToken =
    headerToken ??
    collectByOrderedKeys(data, primaryAccessTokenKeys, normalizeToken) ??
    collectByOrderedKeys(body, primaryAccessTokenKeys, normalizeToken) ??
    collectByOrderedKeys(data, secondaryAccessTokenKeys, normalizeToken) ??
    collectByOrderedKeys(body, secondaryAccessTokenKeys, normalizeToken);
  const refreshToken =
    collectByOrderedKeys(data, refreshTokenKeys, normalizeToken) ??
    collectByOrderedKeys(body, refreshTokenKeys, normalizeToken);
  const accessToken =
    authMode === 'cookie'
      ? COOKIE_AUTH_SESSION_TOKEN
      : explicitAccessToken ??
        collectByOrderedKeys(data, fallbackAccessTokenKeys, normalizeToken) ??
        collectByOrderedKeys(body, fallbackAccessTokenKeys, normalizeToken);
  const expiresAt = resolveTokenExpiry(
    accessToken,
    data?.expiresAt ??
      data?.expiresIn ??
      data?.expires_at ??
      data?.expires_in ??
      body?.expiresAt ??
      body?.expiresIn ??
      body?.expires_at ??
      body?.expires_in
  );

  return {
    accessToken: accessToken ?? '',
    refreshToken: authMode === 'cookie' ? undefined : refreshToken,
    expiresAt: expiresAt ?? Date.now() + DEFAULT_EXPIRY_MS,
    expiresIn: data?.expiresIn ?? body?.expiresIn,
    authMode,
    user: normalizeTokenResponseUser(raw)
  };
};

const isLikelyRefreshToken = (token?: string, refreshToken?: string): boolean => {
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

function unwrapStoredSession(raw: LooseValue): LooseValue {
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
}

function resolveResponseAuthMode(raw: LooseValue): AuthMode {
  const body = raw?.body ?? raw;
  const payload = unwrapStoredSession(body);
  const modeCandidate = payload?.authMode ?? body?.authMode;
  return String(modeCandidate ?? '').trim().toLowerCase() === 'cookie' ? 'cookie' : 'bearer';
}

function normalizeTokenResponseUser(raw: LooseValue): SessionUser | undefined {
  const body = raw?.body ?? raw;
  const payload = unwrapStoredSession(body);
  const userRecord =
    payload?.user && typeof payload.user === 'object'
      ? (payload.user as Record<string, unknown>)
      : payload && typeof payload === 'object'
        ? (payload as Record<string, unknown>)
        : null;

  if (!userRecord) {
    return undefined;
  }

  const id = normalizeIdentityValue(userRecord.id ?? userRecord.userId ?? payload?.userId);
  const email = normalizeIdentityValue(userRecord.email ?? payload?.email);
  const name =
    normalizeIdentityValue(userRecord.fullName ?? userRecord.name ?? payload?.fullName ?? payload?.name) ??
    email ??
    id;

  if (!id && !email && !name) {
    return undefined;
  }

  const roles = normalizeStringList(
    userRecord.roles ?? userRecord.role ?? payload?.roles ?? payload?.role
  );
  const permissions = normalizeStringList(
    userRecord.permissions ??
      userRecord.permission ??
      userRecord.userPermissions ??
      payload?.permissions ??
      payload?.permission ??
      payload?.userPermissions
  );
  const mustChangePassword = normalizeBooleanValue(
    userRecord.mustChangePassword ??
      userRecord.must_change_password ??
      payload?.mustChangePassword ??
      payload?.must_change_password
  );

  return {
    id: id ?? email ?? name ?? 'unknown',
    name: name ?? email ?? id ?? 'unknown',
    email: email ?? name ?? id ?? 'unknown',
    roles,
    permissions,
    mustChangePassword: mustChangePassword ?? false
  };
}

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(item => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeIdentityValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
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

/**
 * Service for managing token refresh operations
 *
 * Features:
 * - Automatic token refresh before expiry
 * - Prevents multiple simultaneous refresh requests
 * - Persists refresh token securely
 * - Handles refresh failures gracefully
 */
@Injectable({ providedIn: 'root' })
export class TokenRefreshService {
  // Use a raw HttpClient without app interceptors to avoid auth bootstrap DI cycles.
  private readonly http = new HttpClient(inject(HttpBackend));
  private readonly auth = inject(AuthService);

  private refreshInProgress$ = new BehaviorSubject<boolean>(false);
  private refreshTokenSubject$ = new BehaviorSubject<string | null>(null);
  private tokenUpdates$ = new ReplaySubject<TokenResponse | null>(1);
  private autoRefreshTimer?: ReturnType<typeof setTimeout>;
  private sessionRehydrateRequest$?: Observable<TokenResponse>;

  // Cancellation token to prevent race conditions.
  private refreshToken$ = 0;

  // Last proactive refresh time to prevent rapid repeat refresh attempts.
  private lastProactiveRefreshTime = 0;
  private readonly PROACTIVE_REFRESH_COOLDOWN_MS = 10000; // 10 seconds

  readonly tokens$ = this.tokenUpdates$.asObservable();

  constructor() {
    this.restoreRefreshToken();
    this.reconcileRestoredRefreshToken();
    this.registerStorageSync();
    this.scheduleAutoRefresh();
  }

  /**
   * Store tokens after successful login
   */
  setTokens(tokens: TokenResponse, remember: boolean = false): void {
    const primaryStorage = this.getStorage(remember ? 'local' : 'session');
    const secondaryStorage = this.getStorage(remember ? 'session' : 'local');

    const existingSession =
      this.readSessionFromStorage(primaryStorage) ?? this.readSessionFromStorage(secondaryStorage);
    const authMode: AuthMode =
      tokens.authMode ??
      (existingSession?.authMode === 'cookie' ? 'cookie' : 'bearer');
    const isCookieAuth = authMode === 'cookie';

    const existingAccessToken = normalizeToken(
      existingSession?.tokens?.accessToken ??
        existingSession?.tokens?.access_token ??
        existingSession?.accessToken ??
        existingSession?.access_token ??
        existingSession?.token
    );
    const accessToken =
      normalizeToken(tokens.accessToken) ||
      existingAccessToken ||
      (isCookieAuth ? COOKIE_AUTH_SESSION_TOKEN : undefined);
    if (!accessToken) {
      this.debugAuth('[TokenRefresh] Skipping token store update - missing access token.');
      return;
    }
    if (isCookieAuth) {
      this.auth.clear();
    } else {
      this.auth.setToken(accessToken);
    }

    const existingExpiresAt =
      existingSession?.tokens?.expiresAt ??
        existingSession?.tokens?.expires_at ??
        existingSession?.expiresAt ??
      existingSession?.expires_at;
    const derivedExpiry = resolveTokenExpiry(
      accessToken,
      tokens.expiresAt ?? tokens.expiresIn ?? existingExpiresAt
    );
    const existingRefreshToken =
      existingSession?.tokens?.refreshToken ??
      existingSession?.tokens?.refresh_token ??
      existingSession?.refreshToken ??
      existingSession?.refresh_token;
    const mergedTokens = {
      accessToken: isCookieAuth ? COOKIE_AUTH_SESSION_TOKEN : accessToken,
      expiresAt:
        derivedExpiry ?? tokens.expiresAt ?? existingExpiresAt ?? Date.now() + DEFAULT_EXPIRY_MS,
      refreshToken: isCookieAuth ? undefined : tokens.refreshToken ?? existingRefreshToken
    };
    const mergedUser = tokens.user ?? existingSession?.user;

    // Store access token with expiry
    const sessionData = mergedUser
      ? {
          authMode,
          user: mergedUser,
          tokens: {
            accessToken: mergedTokens.accessToken,
            refreshToken: mergedTokens.refreshToken,
            expiresAt: mergedTokens.expiresAt
          }
        }
      : {
          authMode,
          tokens: {
            accessToken: mergedTokens.accessToken,
            refreshToken: mergedTokens.refreshToken,
            expiresAt: mergedTokens.expiresAt
          }
        };
    primaryStorage?.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(sessionData));
    secondaryStorage?.removeItem(AUTH_SESSION_STORAGE_KEY);

    if (!isCookieAuth && mergedTokens.refreshToken) {
      this.refreshTokenSubject$.next(mergedTokens.refreshToken);
      primaryStorage?.setItem(REFRESH_TOKEN_KEY, mergedTokens.refreshToken);
    } else {
      this.refreshTokenSubject$.next(null);
      primaryStorage?.removeItem(REFRESH_TOKEN_KEY);
    }
    secondaryStorage?.removeItem(REFRESH_TOKEN_KEY);

    // Schedule auto-refresh
    this.scheduleAutoRefresh(mergedTokens.expiresAt);
    this.tokenUpdates$.next({
      ...mergedTokens,
      authMode,
      user: mergedUser
    });

    this.debugAuth('[TokenRefresh] Tokens stored, auto-refresh scheduled.');
  }

  /**
   * Get current refresh token
   */
  getRefreshToken(): string | null {
    this.syncRefreshTokenFromStorage();
    return this.refreshTokenSubject$.value;
  }

  /**
   * Check if token is about to expire
   */
  isTokenExpiringSoon(): boolean {
    const session = this.getStoredSession();
    const expiresAt = resolveTokenExpiry(
      session?.tokens?.accessToken,
      session?.tokens?.expiresAt ?? session?.tokens?.expiresIn
    );
    if (!expiresAt) return false;

    const timeUntilExpiry = expiresAt - Date.now();
    return timeUntilExpiry < TOKEN_REFRESH_BUFFER_MS;
  }

  /**
   * Check if refresh is currently in progress
   */
  isRefreshInProgress(): boolean {
    return this.refreshInProgress$.value;
  }

  /**
   * Check if we can do proactive refresh (not too soon after last one)
   */
  canDoProactiveRefresh(): boolean {
    const now = Date.now();
    const timeSinceLastRefresh = now - this.lastProactiveRefreshTime;
    return timeSinceLastRefresh >= this.PROACTIVE_REFRESH_COOLDOWN_MS;
  }

  /**
   * Mark that we just did a proactive refresh
   */
  markProactiveRefresh(): void {
    this.lastProactiveRefreshTime = Date.now();
  }

  rehydrateSession(): Observable<TokenResponse> {
    if (this.sessionRehydrateRequest$) {
      this.debugAuth(
        '[TokenRefresh] Session rehydrate already in progress, waiting for existing cycle.'
      );
      return this.sessionRehydrateRequest$;
    }

    const accessToken =
      normalizeToken(this.auth.getToken()) ??
      normalizeToken(
        this.getStoredSession()?.tokens?.accessToken ??
          this.getStoredSession()?.tokens?.access_token ??
          this.getStoredSession()?.accessToken ??
          this.getStoredSession()?.access_token ??
          this.getStoredSession()?.token
      );

    if (!accessToken) {
      return throwError(() => new Error('No active access token available for session restore'));
    }

    const runtime = runtimeConfig();
    const base = (runtime.apiBaseUrl ?? environment.API_BASE_URL ?? '').replace(/\/+$/, '');
    const restoreUrl = `${base}/Auth/restore-session`;
    const headers = new HttpHeaders({
      Authorization: this.buildAuthHeaderValue(accessToken)
    });

    this.sessionRehydrateRequest$ = this.http
      .post<LooseValue>(
        restoreUrl,
        {},
        {
          headers,
          observe: 'response',
          withCredentials: resolveAuthRuntimeOptions().withCredentials
        }
      )
      .pipe(
        map(response => normalizeTokenResponse(response)),
        tap(tokens => {
          if (!tokens.accessToken) {
            throw new Error('Session restore response missing access token');
          }
          if (!tokens.refreshToken) {
            throw new Error('Session restore response missing refresh token');
          }
          const remember =
            !!this.getStorage('local')?.getItem(AUTH_SESSION_STORAGE_KEY) ||
            !!this.getStorage('local')?.getItem(REFRESH_TOKEN_KEY);
          this.setTokens(tokens, remember);
          this.debugAuth('[TokenRefresh] Session rehydrated successfully.');
        }),
        finalize(() => {
          this.sessionRehydrateRequest$ = undefined;
        }),
        shareReplay(1)
      );

    return this.sessionRehydrateRequest$;
  }

  /**
   * Refresh the access token using refresh token
   * Prevents multiple simultaneous refresh requests
   */
  refreshToken(): Observable<TokenResponse> {
    this.syncRefreshTokenFromStorage();

    // If refresh is already in progress, wait for it
    if (this.refreshInProgress$.value) {
      this.debugAuth('[TokenRefresh] Refresh already in progress, waiting for existing cycle.');
      return this.refreshInProgress$.pipe(
        filter(inProgress => !inProgress),
        take(1),
        switchMap(() => {
          // Return the updated token
          const session = this.getStoredSession();
          if (session?.tokens?.accessToken) {
            return [session.tokens as TokenResponse];
          }
          return throwError(() => new Error('Token refresh completed but no token found'));
        })
      );
    }

    // Increment cancellation token only when starting a brand-new refresh cycle.
    const token = ++this.refreshToken$;

    const authRuntime = resolveAuthRuntimeOptions();
    const cookieAuthRequested = authRuntime.useCookieAuth;
    const activeSession = this.getStoredSession();
    const hasCookieSession =
      activeSession?.authMode === 'cookie' ||
      activeSession?.tokens?.accessToken === COOKIE_AUTH_SESSION_TOKEN ||
      activeSession?.accessToken === COOKIE_AUTH_SESSION_TOKEN;
    const canUseCookieRefresh = cookieAuthRequested || hasCookieSession;
    const refreshToken = this.getRefreshToken();
    if (!refreshToken && !canUseCookieRefresh) {
      return throwError(() => new Error('No refresh token available'));
    }

    this.refreshInProgress$.next(true);

    this.debugAuth('[TokenRefresh] Starting refresh cycle.', { cycle: token });
    this.debugAuth('[TokenRefresh] Refresh token is available for the refresh request.');

    const runtime = runtimeConfig();
    const base = (runtime.apiBaseUrl ?? environment.API_BASE_URL ?? '').replace(/\/+$/, '');
    const refreshUrl = `${base}/Auth/refresh`;

    const oldAccessToken = this.auth.getToken();
    this.debugAuth('[TokenRefresh] Current access token availability.', {
      hasAccessToken: !!oldAccessToken
    });

    const body =
      refreshToken != null ? { refreshToken, refresh_token: refreshToken } : {};
    const postRefresh = (includeAuth: boolean) => {
      const observeResponse = {
        observe: 'response' as const,
        withCredentials: authRuntime.withCredentials || canUseCookieRefresh
      };
      let headers = new HttpHeaders();
      if (canUseCookieRefresh) {
        headers = headers.set('X-Auth-Mode', 'cookie');
      }
      if (
        includeAuth &&
        oldAccessToken &&
        oldAccessToken !== COOKIE_AUTH_SESSION_TOKEN
      ) {
        headers = headers.set('Authorization', this.buildAuthHeaderValue(oldAccessToken));
        this.debugAuth('[TokenRefresh] Sending refresh request with Authorization header.');
        return this.http.post<LooseValue>(refreshUrl, body, { headers, ...observeResponse });
      }
      this.debugAuth('[TokenRefresh] Sending refresh request without Authorization header.');
      return headers.keys().length > 0
        ? this.http.post<LooseValue>(refreshUrl, body, { headers, ...observeResponse })
        : this.http.post<LooseValue>(refreshUrl, body, observeResponse);
    };

    const request$ = postRefresh(!!oldAccessToken).pipe(
      catchError(error => {
        if (error?.status === 401 && oldAccessToken) {
          this.debugAuth(
            '[TokenRefresh] Refresh with Authorization failed; retrying without header.'
          );
          return postRefresh(false);
        }
        return throwError(() => error);
      })
    );

    return request$.pipe(
      map(response => {
        // Check if this refresh request is still valid.
        if (token !== this.refreshToken$) {
          this.debugAuth('[TokenRefresh] Ignoring stale refresh response.', {
            cycle: token,
            currentCycle: this.refreshToken$
          });
          throw new Error('Stale refresh request - newer refresh in progress');
        }

        const normalized = normalizeTokenResponse(response);
        if (normalized.authMode === 'cookie') {
          return {
            ...normalized,
            accessToken: COOKIE_AUTH_SESSION_TOKEN,
            refreshToken: undefined,
            authMode: 'cookie'
          } satisfies TokenResponse;
        }

        const refreshedTokenClaims = decodeJwtPayload(normalized.accessToken);
        const refreshedTokenExpiry = extractTokenExpiry(normalized.accessToken);
        const refreshedTokenExpired =
          typeof refreshedTokenExpiry === 'number' && refreshedTokenExpiry <= Date.now();
        this.debugAuth('[TokenRefresh] Token refreshed.', {
          cycle: token,
          hasAccessToken: !!normalized.accessToken,
          hasRefreshToken: !!normalized.refreshToken,
          expiresAt: normalized.expiresAt ? new Date(normalized.expiresAt).toISOString() : 'none',
          isExpired: refreshedTokenExpired,
          hasValidJwtShape: !!refreshedTokenClaims
        });

        if (refreshedTokenExpired) {
          this.debugAuth('[TokenRefresh] Backend returned an expired token.');
        }

        if (!refreshedTokenClaims) {
          this.debugAuth('[TokenRefresh] Backend returned an invalid token format.');
        }

        const session = this.getStoredSession();
        const existingAccess = normalizeToken(
          session?.tokens?.accessToken ??
            session?.tokens?.access_token ??
            session?.accessToken ??
            session?.access_token ??
            session?.token
        );

        // Check if backend returned refresh token instead of access token.
        if (isLikelyRefreshToken(normalized.accessToken, normalized.refreshToken)) {
          this.debugAuth(
            '[TokenRefresh] Backend returned refresh token as access token. Using existing access token as fallback.'
          );
          if (existingAccess) {
            return {
              ...normalized,
              accessToken: existingAccess,
              expiresAt:
                resolveTokenExpiry(existingAccess, normalized.expiresAt ?? normalized.expiresIn) ??
                normalized.expiresAt
            };
          } else {
            this.debugAuth('[TokenRefresh] No existing access token to fall back to.');
          }
        }

        // Check if backend returned the same token (not refreshed).
        if (oldAccessToken && normalized.accessToken === oldAccessToken) {
          this.debugAuth('[TokenRefresh] Backend returned the same access token.');
        }

        // Critical: validate the new token before using it.
        const tokenExpiry = extractTokenExpiry(normalized.accessToken);
        if (typeof tokenExpiry === 'number' && tokenExpiry <= Date.now()) {
          const error = new Error('Backend returned an EXPIRED token from refresh!');
          this.debugAuth('[TokenRefresh] Fatal error.', {
            message: error.message,
            tokenExpiry: new Date(tokenExpiry).toISOString(),
            now: new Date().toISOString()
          });
          throw error;
        }

        const tokenClaims = decodeJwtPayload(normalized.accessToken);
        if (!tokenClaims) {
          const error = new Error('Backend returned an INVALID token format from refresh!');
          this.debugAuth('[TokenRefresh] Fatal error.', { message: error.message });
          throw error;
        }

        return normalized;
      }),
      tap(tokens => {
        // Calculate expiry if not provided
        if (!tokens.expiresAt && tokens.expiresIn) {
          tokens.expiresAt = Date.now() + tokens.expiresIn * 1000;
        }

        this.debugAuth('[TokenRefresh] Storing tokens.', {
          hasAccessToken: !!tokens.accessToken,
          expiresAt: new Date(tokens.expiresAt).toISOString()
        });

        // Preserve the original storage mode so "remember me" survives refresh cycles too.
        const remember =
          !!this.getStorage('local')?.getItem(AUTH_SESSION_STORAGE_KEY) ||
          !!this.getStorage('local')?.getItem(REFRESH_TOKEN_KEY);
        this.setTokens(tokens, remember);

        this.debugAuth('[TokenRefresh] Token refreshed successfully.');
      }),
      catchError(error => {
        // Check if this refresh request is still valid.
        if (token !== this.refreshToken$) {
          this.debugAuth('[TokenRefresh] Ignoring stale refresh error.', {
            cycle: token,
            currentCycle: this.refreshToken$
          });
          return throwError(() => new Error('Stale refresh request - newer refresh in progress'));
        }

        this.debugAuth('[TokenRefresh] Token refresh failed.', {
          cycle: token,
          status: error?.status,
          statusText: error?.statusText,
          message: error?.message
        });
        // Keep existing session; backend might not support refresh.
        return throwError(() => error);
      }),
      finalize(() => {
        this.refreshInProgress$.next(false);
      }),
      shareReplay(1)
    );
  }

  private buildAuthHeaderValue(token: string): string {
    const scheme = (environment.authHeaderScheme ?? 'bearer').toLowerCase();
    return scheme === 'raw' ? token : `Bearer ${token}`;
  }

  /**
   * Schedule automatic token refresh before expiry
   */
  private scheduleAutoRefresh(expiresAt?: number): void {
    // Clear existing timer
    if (this.autoRefreshTimer) {
      clearTimeout(this.autoRefreshTimer);
    }

    if (!this.getRefreshToken()) {
      this.debugAuth('[TokenRefresh] No refresh token; skipping auto-refresh schedule.');
      return;
    }

    const session = this.getStoredSession();
    const expiry = resolveTokenExpiry(
      session?.tokens?.accessToken,
      expiresAt ?? session?.tokens?.expiresAt ?? session?.tokens?.expiresIn
    );

    if (!expiry) {
      this.debugAuth('[TokenRefresh] No expiry time, skipping auto-refresh schedule.');
      return;
    }

    const timeUntilExpiry = expiry - Date.now();
    // Use at most 20% of the remaining token lifetime as the refresh buffer
    // to avoid an infinite refresh loop when the token lifetime is shorter than the buffer.
    const effectiveBuffer = Math.min(TOKEN_REFRESH_BUFFER_MS, timeUntilExpiry * 0.2);
    const timeUntilRefresh = timeUntilExpiry - effectiveBuffer;

    if (timeUntilRefresh <= 0) {
      // Token already expired or about to expire, refresh immediately
      this.debugAuth('[TokenRefresh] Token expiring soon, refreshing immediately.');
      this.refreshToken().subscribe({
        error: err => {
          this.debugAuth('[TokenRefresh] Immediate auto-refresh failed.', {
            status: err?.status,
            message: err?.message
          });
        }
      });
      return;
    }

    this.debugAuth('[TokenRefresh] Auto-refresh scheduled.', {
      minutes: Math.floor(timeUntilRefresh / 60000)
    });

    this.autoRefreshTimer = setTimeout(() => {
      this.refreshToken().subscribe({
        error: err => {
          this.debugAuth('[TokenRefresh] Auto-refresh failed.', {
            status: err?.status,
            message: err?.message
          });
        }
      });
    }, timeUntilRefresh);
  }

  /**
   * Clear all tokens
   */
  clearTokens(): void {
    sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);

    this.refreshTokenSubject$.next(null);
    this.tokenUpdates$.next(null);

    if (this.autoRefreshTimer) {
      clearTimeout(this.autoRefreshTimer);
    }

    this.debugAuth('[TokenRefresh] All tokens cleared.');
  }

  /**
   * Restore refresh token from storage
   */
  private restoreRefreshToken(): void {
    const restoredRefreshToken = this.resolveRefreshTokenFromStorage();
    if (!restoredRefreshToken) {
      return;
    }
    this.refreshTokenSubject$.next(restoredRefreshToken);
    this.debugAuth('[TokenRefresh] Refresh token restored from browser storage.');
  }

  private registerStorageSync(): void {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
      return;
    }

    window.addEventListener('storage', event => {
      if (event.storageArea !== localStorage) {
        return;
      }
      if (event.key && event.key !== REFRESH_TOKEN_KEY && event.key !== AUTH_SESSION_STORAGE_KEY) {
        return;
      }
      this.syncRefreshTokenFromStorage();
    });
  }

  private syncRefreshTokenFromStorage(): void {
    const storedRefreshToken = this.resolveRefreshTokenFromStorage();
    if (!storedRefreshToken) {
      if (this.refreshTokenSubject$.value) {
        this.refreshTokenSubject$.next(null);
        if (this.autoRefreshTimer) {
          clearTimeout(this.autoRefreshTimer);
          this.autoRefreshTimer = undefined;
        }
        this.debugAuth(
          '[TokenRefresh] Cleared stale in-memory refresh token after storage removal.'
        );
      }
      return;
    }

    if (storedRefreshToken === this.refreshTokenSubject$.value) {
      return;
    }

    this.refreshTokenSubject$.next(storedRefreshToken);

    this.debugAuth('[TokenRefresh] Synced refresh token from browser storage.');
  }

  private resolveRefreshTokenFromStorage(): string | null {
    const storages = [this.getStorage('session'), this.getStorage('local')];

    for (const storage of storages) {
      if (!storage) {
        continue;
      }
      const directToken = normalizeToken(storage.getItem(REFRESH_TOKEN_KEY));
      const sessionToken = this.extractRefreshTokenFromSession(
        this.readSessionFromStorage(storage)
      );
      const restoredRefreshToken = directToken ?? sessionToken;
      if (restoredRefreshToken) {
        return restoredRefreshToken;
      }
    }

    return null;
  }

  private reconcileRestoredRefreshToken(): void {
    const refreshToken = this.refreshTokenSubject$.value;
    if (!refreshToken) {
      return;
    }

    const session = this.getStoredSession();
    const accessToken = normalizeToken(
      session?.tokens?.accessToken ??
        session?.tokens?.access_token ??
        session?.accessToken ??
        session?.access_token ??
        session?.token
    );

    if (accessToken && !isLikelyRefreshToken(accessToken, refreshToken)) {
      return;
    }

    this.clearRefreshTokenOnly();

    this.debugAuth(
      '[TokenRefresh] Removed orphaned refresh token without a matching bearer session.'
    );
  }

  /**
   * Get stored session data
   */
  private getStoredSession(): LooseValue {
    const storages = [sessionStorage, localStorage];

    for (const storage of storages) {
      const raw = storage.getItem(AUTH_SESSION_STORAGE_KEY);
      if (raw) {
        try {
          return unwrapStoredSession(JSON.parse(raw));
        } catch {
          continue;
        }
      }
    }

    return null;
  }

  private readSessionFromStorage(storage: Storage | null): LooseValue | null {
    if (!storage) return null;
    const raw = storage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;
    try {
      return unwrapStoredSession(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  private extractRefreshTokenFromSession(session: LooseValue | null): string | undefined {
    return normalizeToken(
      session?.tokens?.refreshToken ??
        session?.tokens?.refresh_token ??
        session?.refreshToken ??
        session?.refresh_token
    );
  }

  private clearRefreshTokenOnly(): void {
    this.getStorage('session')?.removeItem(REFRESH_TOKEN_KEY);
    this.getStorage('local')?.removeItem(REFRESH_TOKEN_KEY);
    this.refreshTokenSubject$.next(null);

    if (this.autoRefreshTimer) {
      clearTimeout(this.autoRefreshTimer);
      this.autoRefreshTimer = undefined;
    }
  }

  private debugAuth(message: string, details?: unknown): void {
    if (!environment.enableDebugLogs) {
      return;
    }

    if (typeof details === 'undefined') {
      console.debug(message);
      return;
    }

    console.debug(message, details);
  }

  private getStorage(type: 'local' | 'session'): Storage | null {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      return type === 'local' ? window.localStorage : window.sessionStorage;
    } catch {
      return null;
    }
  }
}
