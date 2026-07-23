import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { AUTH_SESSION_FACADE, AuthSessionFacade } from './auth-session.facade';
import { resolveAuthRuntimeOptions } from './auth-runtime.util';
import { runtimeConfig } from '../runtime-config';
import {
  isExplicitPermissionLikeUnauthorizedError,
  isInvalidTokenUnauthorizedError,
  isSessionProbablyStillActive,
  isPermissionLikeUnauthorizedRequest,
  isTransientRefreshFailure,
  normalizeAuthExpiry
} from './token-refresh.interceptor.util';
import { TokenDebugService } from './token-debug.service';
import { TokenRefreshService } from './token-refresh.service';
import { extractTokenExpiry } from './token-utils';

type LooseValue = ReturnType<typeof JSON.parse>;
const COOKIE_AUTH_MODE_HEADER = 'X-Auth-Mode';
const COOKIE_AUTH_MODE_VALUE = 'cookie';
const COOKIE_AUTH_REFRESH_PLACEHOLDER = '__COOKIE_AUTH__';
let cookieRefreshInFlight: Promise<void> | null = null;

const refreshCookieSession = async (): Promise<void> => {
  if (!cookieRefreshInFlight) {
    const runtime = runtimeConfig();
    const base = (runtime.apiBaseUrl ?? environment.API_BASE_URL ?? '').replace(/\/+$/, '');
    const refreshUrl = `${base}/Auth/refresh`;

    cookieRefreshInFlight = fetch(refreshUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        [COOKIE_AUTH_MODE_HEADER]: COOKIE_AUTH_MODE_VALUE
      },
      body: JSON.stringify({ refreshToken: COOKIE_AUTH_REFRESH_PLACEHOLDER }),
      credentials: 'include'
    })
      .then(async response => {
        if (response.ok) {
          return;
        }

        const errorBody = (await response.json().catch(() => null)) as { message?: string } | null;
        const refreshError = new Error(
          errorBody?.message || `Cookie session refresh failed with status ${response.status}.`
        ) as Error & { status?: number };
        refreshError.status = response.status;
        throw refreshError;
      })
      .finally(() => {
        cookieRefreshInFlight = null;
      });
  }

  return cookieRefreshInFlight;
};
/**
 * HTTP interceptor for automatic token refresh.
 */
export const tokenRefreshInterceptor: HttpInterceptorFn = (req, next) => {
  const authRuntime = resolveAuthRuntimeOptions();
  const authFacade = inject<AuthSessionFacade>(AUTH_SESSION_FACADE);
  const isPermissionLikeUnauthorized = (error: HttpErrorResponse): boolean =>
    isPermissionLikeUnauthorizedRequest(
      { method: req.method, url: req.url },
      error,
      Date.now(),
      authFacade.tokens()?.expiresAt
    );
  if (authRuntime.useCookieAuth) {
    return next(req).pipe(
      catchError((error: HttpErrorResponse) => {
        const isAuthRequest = /\/auth\/(login|register|refresh)/i.test(req.url);
        if (error.status === 401 && !isAuthRequest && !isPermissionLikeUnauthorized(error)) {
          return from(refreshCookieSession()).pipe(
            switchMap(() =>
              next(
                req.clone({
                  withCredentials: true,
                  headers: req.headers.has('Authorization')
                    ? req.headers.delete('Authorization')
                    : req.headers
                })
              )
            ),
            catchError(() => {
              const facadeWithLogout = authFacade as AuthSessionFacade & {
                logout?: (
                  broadcast?: boolean,
                  reason?: 'manual' | 'expired' | 'refresh-failed'
                ) => void;
              };
              facadeWithLogout.logout?.(true, 'expired');
              return throwError(() => error);
            })
          );
        }
        return throwError(() => error);
      })
    );
  }

  const tokenRefreshService = inject(TokenRefreshService);
  const auth = inject(AuthService);
  const tokenDebug = inject(TokenDebugService);

  const scheme = (environment.authHeaderScheme ?? 'bearer').toLowerCase();
  const debugEnabled = environment.enableDebugLogs === true;

  const debugLog = (...args: unknown[]): void => {
    if (debugEnabled) {
      console.debug(...args);
    }
  };

  const debugWarn = (...args: unknown[]): void => {
    if (debugEnabled) {
      console.debug(...args);
    }
  };

  const debugError = (...args: unknown[]): void => {
    if (debugEnabled) {
      console.debug(...args);
    }
  };

  const expireSession = (source: string): void => {
    const hasFacadeToken = !!authFacade.tokens()?.accessToken;
    const hasStoreToken = !!auth.getToken();
    if (!hasFacadeToken && !hasStoreToken) {
      return;
    }
    debugWarn(`[TokenRefreshInterceptor] ${source} - clearing session.`);
    const facadeWithLogout = authFacade as AuthSessionFacade & {
      logout?: (broadcast?: boolean, reason?: 'manual' | 'expired' | 'refresh-failed') => void;
    };
    if (typeof facadeWithLogout.logout === 'function') {
      facadeWithLogout.logout(true, 'refresh-failed');
      return;
    }
    tokenRefreshService.clearTokens();
  };

  const normalizeToken = (raw?: string | null): string | undefined => {
    if (typeof raw !== 'string') {
      return undefined;
    }
    const trimmed = raw.replace(/^Bearer\s+/i, '').trim();
    return trimmed || undefined;
  };

  const resolveAccessToken = (): string | undefined => {
    const refreshToken = tokenRefreshService.getRefreshToken();
    const facadeSession = authFacade.tokens();
    const facadeToken = normalizeToken(facadeSession?.accessToken ?? null);
    const facadeExpiry = normalizeAuthExpiry(facadeSession?.expiresAt);
    const facadeTokenExpiry = extractTokenExpiry(facadeToken);
    const effectiveFacadeExpiry = facadeTokenExpiry ?? facadeExpiry;

    if (
      facadeToken &&
      (typeof effectiveFacadeExpiry !== 'number' || effectiveFacadeExpiry > Date.now())
    ) {
      auth.setToken(facadeToken);
      return facadeToken;
    }

    const serviceToken = normalizeToken(auth.getToken());
    const serviceTokenExpiry = extractTokenExpiry(serviceToken);
    const serviceTokenExpired =
      typeof serviceTokenExpiry === 'number' && serviceTokenExpiry <= Date.now();
    if (serviceToken && !serviceTokenExpired && (!refreshToken || serviceToken !== refreshToken)) {
      return serviceToken;
    }

    return undefined;
  };

  const sessionLooksAlive = (): boolean => {
    const facadeSession = authFacade.tokens();
    const currentToken = resolveAccessToken();
    return isSessionProbablyStillActive(
      facadeSession?.expiresAt,
      extractTokenExpiry(currentToken),
      Date.now()
    );
  };

  const looksLikeJwt = (value: string): boolean =>
    /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(value);

  const shouldOverrideAuth = (existing: string | null): boolean => {
    if (!existing) {
      return true;
    }
    const lowered = existing.toLowerCase();
    if (lowered.startsWith('bearer ')) {
      return true;
    }
    if (scheme === 'raw' && looksLikeJwt(existing.trim())) {
      return true;
    }
    return false;
  };

  const withRefreshedAuth = (
    request: HttpRequest<unknown>,
    specificToken?: string,
    forceBearer?: boolean
  ): HttpRequest<unknown> => {
    const token = specificToken || resolveAccessToken();
    if (!token) {
      debugWarn('[TokenRefreshInterceptor] withRefreshedAuth: no token available.');
      return request;
    }

    let authHeaderValue: string;
    if (forceBearer) {
      const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
      authHeaderValue = `Bearer ${cleanToken}`;
      debugLog('[TokenRefreshInterceptor] forcing Bearer prefix for retry request.');
    } else {
      authHeaderValue = scheme === 'raw' ? token : `Bearer ${token}`;
    }

    const existingAuth = request.headers.get('Authorization');
    if (!shouldOverrideAuth(existingAuth) && !forceBearer) {
      debugLog('[TokenRefreshInterceptor] keeping existing Authorization header.');
      return request;
    }

    return request.clone({
      setHeaders: { Authorization: authHeaderValue }
    });
  };

  if (/\/auth\/login/i.test(req.url) || /\/auth\/refresh/i.test(req.url)) {
    return next(req);
  }

  if (
    tokenRefreshService.isTokenExpiringSoon() &&
    !tokenRefreshService.isRefreshInProgress() &&
    tokenRefreshService.canDoProactiveRefresh()
  ) {
    const hasRefreshToken = !!tokenRefreshService.getRefreshToken();
    if (!hasRefreshToken) {
      debugWarn(
        '[TokenRefreshInterceptor] token expiring soon but no refresh token is available. Skipping proactive refresh.'
      );
      return next(req);
    }

    tokenRefreshService.markProactiveRefresh();

    return tokenRefreshService.refreshToken().pipe(
      switchMap(refreshedTokens => {
        auth.setToken(refreshedTokens.accessToken);
        debugLog('[TokenRefreshInterceptor] proactive refresh completed.');
        return next(withRefreshedAuth(req, refreshedTokens.accessToken));
      }),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          if (sessionLooksAlive()) {
            debugWarn(
              '[TokenRefreshInterceptor] proactive refresh failed with 401, but current session still looks active. Continuing with existing token.'
            );
            return next(withRefreshedAuth(req));
          }
          debugWarn('[TokenRefreshInterceptor] proactive refresh failed with 401.');
          expireSession('proactive refresh failed');
          return throwError(() => error);
        }

        if (isTransientRefreshFailure(error)) {
          debugWarn(
            '[TokenRefreshInterceptor] proactive refresh failed transiently. Preserving session and continuing with the current token.'
          );
          return next(withRefreshedAuth(req));
        }
        return throwError(() => error);
      })
    );
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const status = error.status;
      const method = (req.method || '').toUpperCase();
      const isSessionRestoreRequest = /\/auth\/restore-session/i.test(req.url);
      const canRetryForbiddenWrite =
        status === 403 && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

      if (status !== 401 && !canRetryForbiddenWrite) {
        return throwError(() => error);
      }

      const authHeader = req.headers.get('Authorization');
      if (debugEnabled) {
        const currentToken = auth.getToken();
        const facadeToken = authFacade.tokens()?.accessToken;
        debugLog(`[TokenRefreshInterceptor] ${status} auth error`, {
          url: req.url,
          method: req.method,
          hasAuthorizationHeader: !!authHeader,
          message: error.message,
          hasAuthServiceToken: !!currentToken,
          hasAuthFacadeToken: !!facadeToken
        });

        if (authHeader) {
          const token = authHeader.replace(/^Bearer\s+/i, '').trim();
          tokenDebug.debugToken(token, `Token that caused ${status}`);
        } else {
          debugError(
            `[TokenRefreshInterceptor] Authorization header is missing on ${status} request.`
          );
        }

        if (authHeader && currentToken) {
          const sentToken = authHeader.replace(/^Bearer\s+/i, '').trim();
          tokenDebug.compareTokens(sentToken, currentToken, 'Sent Token', 'Stored Token');
        }
      }

      const hasRefreshToken = !!tokenRefreshService.getRefreshToken();
      const isExplicitPermissionError = isExplicitPermissionLikeUnauthorizedError(error);
      const isInvalidTokenError = isInvalidTokenUnauthorizedError(error);
      const isPermissionLikeReadError = isPermissionLikeUnauthorized(error);
      const sessionLooksAliveNow = sessionLooksAlive();
      const shouldBypassRefresh =
        status === 401 &&
        !isInvalidTokenError &&
        (isExplicitPermissionError || (isPermissionLikeReadError && sessionLooksAliveNow));

      if (shouldBypassRefresh) {
        debugWarn(
          '[TokenRefreshInterceptor] permission-like 401 detected. Skipping token refresh.'
        );
        return throwError(() => error);
      }

      if (!hasRefreshToken) {
        if (status === 401) {
          if (isSessionRestoreRequest) {
            debugWarn(
              '[TokenRefreshInterceptor] restore-session was rejected and no refresh token exists. Expiring session immediately.'
            );
            expireSession('restore-session rejected without refresh token');
            return throwError(() => error);
          }
          if (!isInvalidTokenError && (isPermissionLikeReadError || sessionLooksAliveNow)) {
            debugWarn(
              '[TokenRefreshInterceptor] 401 received without refresh token, but session still looks active. Preserving session.'
            );
          } else {
            const currentToken = resolveAccessToken();
            const currentTokenExpiry = extractTokenExpiry(currentToken);
            const accessTokenStillValid =
              typeof currentTokenExpiry === 'number' ? currentTokenExpiry > Date.now() : false;

            if (isInvalidTokenError || !accessTokenStillValid) {
              debugWarn(
                '[TokenRefreshInterceptor] 401 received without refresh token and the current access token no longer looks valid. Expiring session.'
              );
              expireSession('401 without refresh token and invalid/expired access token');
            } else {
              debugWarn(
                '[TokenRefreshInterceptor] 401 received without refresh token, but the current access token is still valid. Preserving session and surfacing the original resource error.'
              );
            }
          }
        } else {
          debugWarn(
            '[TokenRefreshInterceptor] auth error received but no refresh token is available. Passing error through.'
          );
        }
        return throwError(() => error);
      }

      if (status === 403) {
        debugWarn(
          '[TokenRefreshInterceptor] write request failed with 403. Trying one token refresh retry.'
        );
      } else {
        debugLog('[TokenRefreshInterceptor] attempting token refresh after 401.');
      }

      return tokenRefreshService.refreshToken().pipe(
        switchMap(refreshedTokens => {
          if (!refreshedTokens.accessToken) {
            debugError('[TokenRefreshInterceptor] refresh response has no access token.');
            return throwError(() => new Error('No access token in refresh response'));
          }

          if (debugEnabled) {
            debugLog('[TokenRefreshInterceptor] processing refreshed token', {
              hasRefreshToken: !!refreshedTokens.refreshToken,
              expiresAt: refreshedTokens.expiresAt
                ? new Date(refreshedTokens.expiresAt).toISOString()
                : 'not provided'
            });
            tokenDebug.debugToken(refreshedTokens.accessToken, 'New token from refresh');
          }

          auth.setToken(refreshedTokens.accessToken);
          const retryReq = withRefreshedAuth(req, refreshedTokens.accessToken);

          return next(retryReq).pipe(
            catchError((retryError: HttpErrorResponse) => {
              if (retryError.status !== 401) {
                return throwError(() => retryError);
              }

              debugWarn(
                '[TokenRefreshInterceptor] retry failed with 401. Retrying once with forced Bearer prefix.'
              );
              const fallbackReq = withRefreshedAuth(req, refreshedTokens.accessToken, true);
              return next(fallbackReq);
            })
          );
        }),
        catchError(refreshError => {
          if (debugEnabled) {
            debugError('[TokenRefreshInterceptor] refresh token request failed.', {
              status: refreshError?.status,
              message: refreshError?.error?.message || refreshError?.message
            });
          }

          // If the refresh token itself was rejected by the server (401 on /auth/refresh),
          // the refresh token is definitively invalid — always expire the session immediately.
          if ((refreshError as LooseValue)?.isRefreshTokenExpired) {
            expireSession('refresh token rejected by server');
            const sessionExpiredError = new Error('Your session has expired. Please login again.');
            (sessionExpiredError as LooseValue).status = 401;
            (sessionExpiredError as LooseValue).isRefreshTokenExpired = true;
            return throwError(() => sessionExpiredError);
          }

          if (status === 403) {
            debugWarn(
              '[TokenRefreshInterceptor] refresh failed while handling 403 write request. Preserving original 403 response.'
            );
            return throwError(() => error);
          }

          if (
            status === 401 &&
            !isInvalidTokenError &&
            (isPermissionLikeReadError || sessionLooksAlive())
          ) {
            debugWarn(
              '[TokenRefreshInterceptor] refresh failed after a read 401, but the current session still looks active. Preserving session and surfacing the original resource error.'
            );
            return throwError(() => error);
          }

          if (isTransientRefreshFailure(refreshError)) {
            debugWarn(
              '[TokenRefreshInterceptor] refresh failed transiently or indeterminately. Preserving session and surfacing the original resource error.'
            );
            return throwError(() => error);
          }

          expireSession('refresh failed');
          const userError = new Error('Your session has expired. Please login again.');
          (userError as LooseValue).status = 401;
          (userError as LooseValue).isRefreshTokenExpired = true;
          return throwError(() => userError);
        })
      );
    })
  );
};
