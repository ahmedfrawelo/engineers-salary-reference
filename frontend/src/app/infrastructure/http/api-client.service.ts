import { Injectable, inject } from '@angular/core';
import {
  HttpClient,
  HttpContext,
  HttpErrorResponse,
  HttpHeaders,
  HttpParams
} from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthTokenStoreService } from '../../core/auth/auth.service';
import { AUTH_SESSION_FACADE, AuthSessionFacade } from '../../core/auth/auth-session.facade';
import { resolveAuthRuntimeOptions } from '../../core/auth/auth-runtime.util';
import { LoggerService } from '../../core/logger/logger.service';
import { DeleteProtectionDialogService } from '../../core/security/delete-protection-dialog.service';
import { catchError, retry, tap, timeout } from 'rxjs/operators';
import { throwError, timer } from 'rxjs';
import { runtimeConfig } from '../../core/runtime-config';
import { SUPPRESS_HTTP_ERROR_LOG } from '../../platform/angular/interceptors/http-error.interceptor';
import { SKIP_HTTP_RETRY } from '../../platform/angular/interceptors/retry.interceptor';

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthTokenStoreService);
  private readonly authFacade = inject<AuthSessionFacade>(AUTH_SESSION_FACADE);
  private readonly logger = inject(LoggerService);
  private readonly deleteProtection = inject(DeleteProtectionDialogService);

  private readonly runtime = runtimeConfig();
  private readonly baseUrl = (this.runtime.apiBaseUrl ?? environment.API_BASE_URL ?? '').replace(
    /\/+$/,
    ''
  );
  private readonly REQUEST_TIMEOUT = this.runtime.timeoutMs ?? environment.http?.timeout ?? 30000;
  private readonly MAX_RETRIES = this.runtime.retries ?? environment.http?.retries ?? 0;

  private resolveTimeoutMs(override?: number): number {
    return typeof override === 'number' && Number.isFinite(override) && override > 0
      ? Math.trunc(override)
      : this.REQUEST_TIMEOUT;
  }

  private resolveRetryCount(override?: number): number {
    return typeof override === 'number' && Number.isFinite(override) && override >= 0
      ? Math.trunc(override)
      : this.MAX_RETRIES;
  }

  private buildAuthHeaderValue(token: string): string {
    const scheme = (environment.authHeaderScheme ?? 'bearer').toLowerCase();
    return scheme === 'raw' ? token : `Bearer ${token}`;
  }

  private getWithCredentials(): boolean {
    return resolveAuthRuntimeOptions().withCredentials;
  }

  private getAuthHeaders(): HttpHeaders {
    // ✅ FIX: Don't add Authorization header here - let authInterceptor handle it
    // This ensures consistent token handling and prevents duplicate/conflicting headers
    let headers = new HttpHeaders({ Accept: 'application/json' });
    // Only skip adding token if cookie auth is enabled - authInterceptor will handle token
    return headers;
  }

  private resolveAuthToken(): string | undefined {
    const facadeSession = this.authFacade.tokens();
    const facadeToken = this.normalizeToken(facadeSession?.accessToken ?? undefined);
    const facadeExpiry = this.normalizeExpiresAt(facadeSession?.expiresAt);
    if (facadeToken && (typeof facadeExpiry !== 'number' || facadeExpiry > Date.now())) {
      this.auth.setToken(facadeToken);
      return facadeToken;
    }
    return this.normalizeToken(this.auth.getToken());
  }

  private normalizeToken(raw?: string): string | undefined {
    if (typeof raw !== 'string') {
      return undefined;
    }
    const trimmed = raw.replace(/^Bearer\s+/i, '').trim();
    return trimmed || undefined;
  }

  private normalizeExpiresAt(raw: unknown): number | undefined {
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
        return this.normalizeExpiresAt(asNumber);
      }
      const parsed = Date.parse(trimmed);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
    return undefined;
  }

  get<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
    requestOptions?: {
      authToken?: string;
      timeoutMs?: number;
      retries?: number;
      suppressErrorLog?: boolean;
    }
  ) {
    const url = this.join(path);
    const startTime = performance.now();
    const requestTimeout = this.resolveTimeoutMs(requestOptions?.timeoutMs);
    const requestRetries = this.resolveRetryCount(requestOptions?.retries);
    const suppressErrorLog = requestOptions?.suppressErrorLog === true;
    let headers = this.getAuthHeaders();
    if (requestOptions?.authToken && !this.isCookieAuthEnabled()) {
      headers = headers.set('Authorization', this.buildAuthHeaderValue(requestOptions.authToken));
    }
    const options: {
      headers: HttpHeaders;
      params: HttpParams;
      withCredentials: boolean;
      context?: HttpContext;
    } = {
      headers,
      params: this.toParams(params),
      withCredentials: this.getWithCredentials()
    };
    if (suppressErrorLog || requestRetries === 0) {
      let context = new HttpContext();
      if (suppressErrorLog) {
        context = context.set(SUPPRESS_HTTP_ERROR_LOG, true);
      }
      if (requestRetries === 0) {
        context = context.set(SKIP_HTTP_RETRY, true);
      }
      options.context = context;
    }

    this.logger.debug(`[ApiClient] GET -> ${url}`);

    return this.http.get<T>(url, options).pipe(
      timeout(requestTimeout),
      retry({
        count: requestRetries,
        delay: (error, retryCount) => {
          if (error.status === 0 || error.status >= 500) {
            const delayMs = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
            this.logger.warn(
              `[ApiClient] Retrying GET ${url} (attempt ${retryCount}) after ${delayMs}ms`
            );
            return timer(delayMs);
          }
          return throwError(() => error);
        }
      }),
      tap(() => {
        const duration = performance.now() - startTime;
        this.logger.logApiCall('GET', url, 200, duration);
      }),
      catchError(error => {
        const duration = performance.now() - startTime;
        if (!suppressErrorLog) {
          this.logger.logApiCall('GET', url, error.status, duration);
          this.logger.error(`[ApiClient] GET failed: ${url}`, error);
        }
        return throwError(() => error);
      })
    );
  }

  post<T>(
    path: string,
    body: unknown,
    requestOptions?: { authToken?: string; headers?: Record<string, string> }
  ) {
    const url = this.join(path);
    const startTime = performance.now();
    let headers = this.getAuthHeaders().set('Content-Type', 'application/json');
    if (requestOptions?.authToken && !this.isCookieAuthEnabled()) {
      headers = headers.set('Authorization', this.buildAuthHeaderValue(requestOptions.authToken));
    }
    for (const [name, value] of Object.entries(requestOptions?.headers ?? {})) {
      headers = headers.set(name, value);
    }
    const options = {
      headers,
      withCredentials: this.getWithCredentials()
    };

    this.logger.debug(`[ApiClient] POST -> ${url}`, body);

    return this.http.post<T>(url, body, options).pipe(
      timeout(this.REQUEST_TIMEOUT),
      tap(() => {
        const duration = performance.now() - startTime;
        this.logger.logApiCall('POST', url, 200, duration);
      }),
      catchError(error => {
        const duration = performance.now() - startTime;
        this.logger.logApiCall('POST', url, error.status, duration);
        this.logger.error(`[ApiClient] POST failed: ${url}`, error);
        return throwError(() => error);
      })
    );
  }

  getBlob(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
    requestOptions?: {
      authToken?: string;
      timeoutMs?: number;
      retries?: number;
      suppressErrorLog?: boolean;
    }
  ) {
    const url = this.join(path);
    const startTime = performance.now();
    const requestTimeout = this.resolveTimeoutMs(requestOptions?.timeoutMs);
    const requestRetries = this.resolveRetryCount(requestOptions?.retries);
    const suppressErrorLog = requestOptions?.suppressErrorLog === true;
    let headers = this.getAuthHeaders();
    if (requestOptions?.authToken && !this.isCookieAuthEnabled()) {
      headers = headers.set('Authorization', this.buildAuthHeaderValue(requestOptions.authToken));
    }
    const options: {
      headers: HttpHeaders;
      params: HttpParams;
      withCredentials: boolean;
      responseType: 'blob';
      context?: HttpContext;
    } = {
      headers,
      params: this.toParams(params),
      withCredentials: this.getWithCredentials(),
      responseType: 'blob'
    };
    if (suppressErrorLog || requestRetries === 0) {
      let context = new HttpContext();
      if (suppressErrorLog) {
        context = context.set(SUPPRESS_HTTP_ERROR_LOG, true);
      }
      if (requestRetries === 0) {
        context = context.set(SKIP_HTTP_RETRY, true);
      }
      options.context = context;
    }

    this.logger.debug(`[ApiClient] GET blob -> ${url}`);

    return this.http.get(url, options).pipe(
      timeout(requestTimeout),
      retry({
        count: requestRetries,
        delay: (error, retryCount) => {
          if (error.status === 0 || error.status >= 500) {
            const delayMs = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
            this.logger.warn(
              `[ApiClient] Retrying GET blob ${url} (attempt ${retryCount}) after ${delayMs}ms`
            );
            return timer(delayMs);
          }
          return throwError(() => error);
        }
      }),
      tap(() => {
        const duration = performance.now() - startTime;
        this.logger.logApiCall('GET', url, 200, duration);
      }),
      catchError(error => {
        const duration = performance.now() - startTime;
        if (!suppressErrorLog) {
          this.logger.logApiCall('GET', url, error.status, duration);
          this.logger.error(`[ApiClient] GET blob failed: ${url}`, error);
        }
        return throwError(() => error);
      })
    );
  }

  put<T>(path: string, body: unknown, requestOptions?: { authToken?: string }) {
    const url = this.join(path);
    const startTime = performance.now();
    let headers = this.getAuthHeaders().set('Content-Type', 'application/json');
    if (requestOptions?.authToken && !this.isCookieAuthEnabled()) {
      headers = headers.set('Authorization', this.buildAuthHeaderValue(requestOptions.authToken));
    }
    const options = {
      headers,
      withCredentials: this.getWithCredentials()
    };

    this.logger.debug(`[ApiClient] PUT -> ${url}`, body);

    return this.http.put<T>(url, body, options).pipe(
      timeout(this.REQUEST_TIMEOUT),
      tap(() => {
        const duration = performance.now() - startTime;
        this.logger.logApiCall('PUT', url, 200, duration);
      }),
      catchError(error => {
        const duration = performance.now() - startTime;
        this.logger.logApiCall('PUT', url, error.status, duration);
        this.logger.error(`[ApiClient] PUT failed: ${url}`, error);
        return throwError(() => error);
      })
    );
  }

  delete<T>(path: string, requestOptions?: { skipDeleteProtection?: boolean; authToken?: string }) {
    const url = this.join(path);
    const startTime = performance.now();
    let headers = this.getAuthHeaders();
    if (requestOptions?.authToken && !this.isCookieAuthEnabled()) {
      headers = headers.set('Authorization', this.buildAuthHeaderValue(requestOptions.authToken));
    }
    if (!requestOptions?.skipDeleteProtection && this.deleteProtection.isEnabled()) {
      const { headerName } = this.deleteProtection.resolveConfig();
      const authorizedCode = this.deleteProtection.consumeAuthorizedCode();
      if (authorizedCode) {
        headers = headers.set(headerName, authorizedCode);
      }
    }
    const options = {
      headers,
      withCredentials: this.getWithCredentials()
    };

    this.logger.debug(`[ApiClient] DELETE -> ${url}`);

    return this.http.delete<T>(url, options).pipe(
      timeout(this.REQUEST_TIMEOUT),
      tap(() => {
        const duration = performance.now() - startTime;
        this.logger.logApiCall('DELETE', url, 200, duration);
      }),
      catchError(error => {
        const duration = performance.now() - startTime;
        this.logger.logApiCall('DELETE', url, error.status, duration);
        this.logger.error(`[ApiClient] DELETE failed: ${url}`, error);
        return throwError(() => error);
      })
    );
  }

  patch<T>(path: string, body: unknown, requestOptions?: { authToken?: string }) {
    const url = this.join(path);
    const startTime = performance.now();
    let headers = this.getAuthHeaders().set('Content-Type', 'application/json');
    if (requestOptions?.authToken && !this.isCookieAuthEnabled()) {
      headers = headers.set('Authorization', this.buildAuthHeaderValue(requestOptions.authToken));
    }
    const options = {
      headers,
      withCredentials: this.getWithCredentials()
    };

    this.logger.debug(`[ApiClient] PATCH -> ${url}`, body);

    return this.http.patch<T>(url, body, options).pipe(
      timeout(this.REQUEST_TIMEOUT),
      tap(() => {
        const duration = performance.now() - startTime;
        this.logger.logApiCall('PATCH', url, 200, duration);
      }),
      catchError(error => {
        const duration = performance.now() - startTime;
        this.logger.logApiCall('PATCH', url, error.status, duration);
        this.logger.error(`[ApiClient] PATCH failed: ${url}`, error);
        return throwError(() => error);
      })
    );
  }

  private join(path: string) {
    if (/^https?:\/\//i.test(path)) {
      return path;
    }

    const root = this.baseUrl || '';
    let cleaned = (path || '').replace(/^\/+/, '');
    cleaned = cleaned.replace(/^api\//i, '');

    const combined = `${root}/${cleaned}`;
    return combined.replace(/\/{2,}/g, '/').replace(/^(https?:)\/+/, '$1//');
  }

  private toParams(obj?: Record<string, string | number | boolean | undefined>) {
    let params = new HttpParams();
    if (!obj) {
      return params;
    }
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null) {
        params = params.set(key, String(value));
      }
    }
    return params;
  }

  private isCookieAuthEnabled(): boolean {
    return resolveAuthRuntimeOptions().useCookieAuth;
  }
}
