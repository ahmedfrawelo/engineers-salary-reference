import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  AUTH_SESSION_FACADE,
  type AuthSessionFacade
} from '../../../core/auth/auth-session.facade';
import { AUTH_USER_FACADE, type AuthUserFacade } from '../../../core/auth/auth-user.facade';

type LooseValue = ReturnType<typeof JSON.parse>;

export const SUPPRESS_HTTP_ERROR_LOG = new HttpContextToken<boolean>(() => false);

const toMessage = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const extractBackendMessage = (payload: unknown): string | null => {
  if (!payload) {
    return null;
  }

  if (typeof payload === 'string') {
    return toMessage(payload);
  }

  if (Array.isArray(payload)) {
    const collected = payload.map(toMessage).filter((msg): msg is string => !!msg);
    return collected.length ? collected.join(' ') : null;
  }

  if (typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const errors = record.errors ?? record.Errors;
  if (errors) {
    if (Array.isArray(errors)) {
      const collected = errors.map(toMessage).filter((msg): msg is string => !!msg);
      if (collected.length) {
        return collected.join(' ');
      }
    }

    if (typeof errors === 'object') {
      const messages: string[] = [];
      for (const value of Object.values(errors as Record<string, unknown>)) {
        if (Array.isArray(value)) {
          for (const entry of value) {
            const msg = toMessage(entry);
            if (msg) {
              messages.push(msg);
            }
          }
          continue;
        }
        const msg = toMessage(value);
        if (msg) {
          messages.push(msg);
        }
      }
      if (messages.length) {
        return messages.join(' ');
      }
    }
  }

  const direct =
    toMessage(record.message) ||
    toMessage(record.Message) ||
    toMessage(record.error) ||
    toMessage(record.Error) ||
    toMessage(record.detail) ||
    toMessage(record.Detail);

  if (direct) {
    return direct;
  }

  const title = toMessage(record.title) || toMessage(record.Title);
  if (title && title !== 'One or more validation errors occurred.') {
    return title;
  }

  return null;
};

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const authSession = inject<AuthSessionFacade>(AUTH_SESSION_FACADE);
  const authUser = inject<AuthUserFacade>(AUTH_USER_FACADE);
  const suppressErrorLog = req.context.get(SUPPRESS_HTTP_ERROR_LOG);

  return next(req).pipe(
    catchError((error: LooseValue) => {
      let errorMessage = 'An unexpected error occurred';

      if (error?.isRefreshTokenExpired) {
        console.error('❌❌❌ [HttpErrorInterceptor] REFRESH TOKEN EXPIRED - Redirecting to login');
        errorMessage = 'Your session has expired. Please login again.';
        const hasActiveSession = !!authSession.tokens() || !!authUser.user();
        const sessionWithLogout = authSession as AuthSessionFacade & {
          logout?: (broadcast?: boolean, reason?: 'manual' | 'expired' | 'refresh-failed') => void;
        };

        if (!environment.useMockAuth && hasActiveSession) {
          sessionWithLogout.logout?.(true, 'refresh-failed');
        } else if (!environment.useMockAuth) {
          const currentUrl = router.url?.trim();
          const returnUrl =
            currentUrl && !/^\/?(login|signup)(\/|$)/i.test(currentUrl)
              ? currentUrl.startsWith('/')
                ? currentUrl
                : `/${currentUrl}`
              : null;
          void router.navigate(['/login'], {
            queryParams: returnUrl ? { returnUrl } : undefined
          });
        }

        return throwError(() => ({
          status: 401,
          message: errorMessage,
          url: req.urlWithParams,
          path: req.urlWithParams,
          statusText: 'Unauthorized',
          error: null,
          isRefreshTokenExpired: true,
          originalError: error
        }));
      }

      if (error.error instanceof ErrorEvent) {
        errorMessage = `Error: ${error.error.message}`;
        console.error('Client Error:', error.error.message);
      } else if (error instanceof HttpErrorResponse) {
        const backendMessage = extractBackendMessage(error.error);
        switch (error.status) {
          case 0:
            errorMessage =
              backendMessage ||
              'Unable to connect to server. Please check your internet connection.';
            break;
          case 400:
            errorMessage = backendMessage || 'Bad request';
            break;
          case 401: {
            errorMessage = backendMessage || 'Unauthorized. Please login again.';
            const isRefreshEndpoint = /\/auth\/refresh/i.test(req.url);
            if (isRefreshEndpoint) {
              console.error(
                '❌❌❌ [HttpErrorInterceptor] REFRESH ENDPOINT FAILED - Refresh token is invalid/expired'
              );
              return throwError(() => ({
                status: 401,
                message: errorMessage,
                url: req.urlWithParams,
                path: req.urlWithParams,
                statusText: 'Unauthorized',
                error: error.error ?? null,
                isRefreshTokenExpired: true,
                originalError: error
              }));
            }

            const isAuthEndpoint = /\/auth\//i.test(req.url);
            const isAuthProbeEndpoint = /\/auth\/me\b/i.test(req.url);
            if (
              !environment.useMockAuth &&
              isAuthEndpoint &&
              !isRefreshEndpoint &&
              !isAuthProbeEndpoint
            ) {
              if (environment.enableDebugLogs) {
                console.warn('[HTTP Interceptor] 401 on auth endpoint - preserving current route');
              }
            } else if (!isAuthEndpoint) {
              if (environment.enableDebugLogs) {
                console.warn(
                  '[HTTP Interceptor] 401 on protected resource - attempting token refresh'
                );
              }
            }
            break;
          }
          case 403:
            errorMessage = backendMessage || 'You do not have permission to access this resource';
            break;
          case 404:
            errorMessage = 'The requested resource was not found';
            break;
          case 409:
            errorMessage = backendMessage || 'Conflict. The record already exists.';
            break;
          case 500:
            errorMessage = 'Server error. Please try again later';
            break;
          case 503:
            errorMessage = 'Service is currently unavailable';
            break;
          default:
            errorMessage = error.error?.message || `Server error: ${error.status}`;
        }

        if (!suppressErrorLog) {
          console.error(
            `Backend Error: ${error.status}\n` +
              `URL: ${error.url}\n` +
              `Message: ${error.message}`
          );
        }
      }

      return throwError(() => ({
        status: error.status,
        message: errorMessage,
        url:
          (error as { url?: string | null })?.url ??
          (error as { originalError?: { url?: string | null } })?.originalError?.url ??
          req.urlWithParams,
        path:
          (error as { url?: string | null })?.url ??
          (error as { originalError?: { url?: string | null } })?.originalError?.url ??
          req.urlWithParams,
        statusText: (error as { statusText?: string | null })?.statusText ?? '',
        error: (error as { error?: unknown })?.error ?? null,
        originalError: error
      }));
    })
  );
};
