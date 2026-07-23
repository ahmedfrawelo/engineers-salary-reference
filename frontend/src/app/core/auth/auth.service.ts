import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { runtimeConfig } from '../runtime-config';
import { COOKIE_AUTH_SESSION_TOKEN } from './auth-runtime.util';
import { extractTokenExpiry, isLikelyRefreshToken, normalizeExpiresAt } from './token-utils';

type LooseValue = ReturnType<typeof JSON.parse>;
const AUTH_SESSION_STORAGE_KEY = 'engineers-salary-reference.portal.session';
const REFRESH_TOKEN_KEY = 'engineers-salary-reference.portal.refresh';

@Injectable({ providedIn: 'root' })
export class AuthTokenStoreService {
  private token?: string;

  constructor() {
    // CRITICAL: Restore token IMMEDIATELY and SYNCHRONOUSLY
    // This must complete before ANY HTTP request is made
    this.restoreTokenFromStorage();

    this.debugAuth(
      this.token
        ? '[AuthTokenStoreService] Constructor completed - token restored.'
        : '[AuthTokenStoreService] Constructor completed - no token found in storage.'
    );
  }

  setToken(token: string): void {
    this.token = this.normalizeToken(token);
    this.debugAuth('[AuthTokenStoreService] Token set in memory.', { hasToken: !!this.token });
  }

  getToken(): string | undefined {
    // CRITICAL: Always try to restore if token is missing
    // This handles edge cases where constructor ran before storage was ready
    if (!this.token) {
      this.debugAuth(
        '[AuthTokenStoreService] getToken() called but token is undefined - attempting restore.'
      );
      this.restoreTokenFromStorage();

      if (!this.token) {
        this.debugAuth('[AuthTokenStoreService] Token restoration failed - no token in storage.');
        // Debug: Check what's actually in storage
        const session = this.getStorage('session');
        const local = this.getStorage('local');
        this.debugAuth('[AuthTokenStoreService] storage key presence.', {
          hasSessionKey: !!session?.getItem(AUTH_SESSION_STORAGE_KEY),
          hasLocalKey: !!local?.getItem(AUTH_SESSION_STORAGE_KEY)
        });
      }
    }
    return this.token;
  }

  clear(): void {
    this.token = undefined;
  }

  /**
   * Restore token from localStorage or sessionStorage.
   * This ensures the token is available after page refresh.
   */
  private restoreTokenFromStorage(): void {
    const storages = [this.getStorage('session'), this.getStorage('local')];

    for (const storage of storages) {
      if (!storage) continue;

      const raw = storage.getItem(AUTH_SESSION_STORAGE_KEY);
      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw);
        const session = this.unwrapSession(parsed);
        const authMode =
          parsed?.authMode === 'cookie' || session?.authMode === 'cookie' ? 'cookie' : 'bearer';
        if (authMode === 'cookie') {
          continue;
        }
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
        const accessToken = this.normalizeToken(
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
        const tokenExpiry = extractTokenExpiry(accessToken);
        const effectiveExpiry = normalizedExpiry ?? tokenExpiry;

        const refreshToken = this.normalizeToken(storage.getItem(REFRESH_TOKEN_KEY) ?? undefined);
        if (accessToken && isLikelyRefreshToken(accessToken, refreshToken)) {
          continue;
        }
        if (accessToken === COOKIE_AUTH_SESSION_TOKEN) {
          continue;
        }
        // Check if token exists and is not expired
        if (accessToken) {
          if (typeof effectiveExpiry === 'number' && effectiveExpiry <= Date.now()) {
            continue;
          }
          this.token = accessToken;
          this.debugAuth('[AuthTokenStoreService] Token restored from storage.');
          return;
        }
      } catch {
        this.debugAuth('[AuthTokenStoreService] Failed to parse token from storage.');
      }
    }

    // Fallback: try runtime-config token or common B2C/MSAL storage keys
    if (this.tryRestoreExternalToken()) {
      this.debugAuth(
        '[AuthTokenStoreService] Token restored from external provider storage/runtime config.'
      );
    }
  }

  private unwrapSession(raw: unknown): LooseValue {
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

  /**
   * Restore token from runtime config overrides or common MSAL/B2C storage entries.
   * This helps when the app relies on external identity providers that inject tokens.
   */
  private tryRestoreExternalToken(): boolean {
    const runtime = runtimeConfig();
    const runtimeToken = runtime?.bearerToken || runtime?.accessToken;
    if (
      typeof runtimeToken === 'string' &&
      runtimeToken.length > 20 &&
      runtimeToken !== COOKIE_AUTH_SESSION_TOKEN
    ) {
      this.token = this.normalizeToken(runtimeToken);
      return true;
    }

    const storages = [this.getStorage('session'), this.getStorage('local')];
    const looksLikeJwt = (val: string) =>
      /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(val);
    const trustedExternalKeyHints = ['msal', 'azure', 'b2c', 'oidc', 'auth0', 'okta'];
    const isTrustedExternalTokenKey = (key: string): boolean => {
      const lowerKey = key.toLowerCase();
      const hasAccessTokenHint =
        lowerKey.includes('accesstoken') ||
        lowerKey.includes('access.token') ||
        lowerKey.includes('access_token');
      const hasTrustedProviderHint = trustedExternalKeyHints.some(hint => lowerKey.includes(hint));
      return hasAccessTokenHint && hasTrustedProviderHint;
    };

    for (const storage of storages) {
      if (!storage) continue;
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i) || '';
        if (!isTrustedExternalTokenKey(key)) {
          continue;
        }

        const raw = storage.getItem(key);
        if (!raw) continue;

        try {
          const parsed = JSON.parse(raw);
          const secret = this.normalizeToken(
            parsed?.secret || parsed?.accessToken || parsed?.token
          );
          const expires =
            normalizeExpiresAt(
              parsed?.expiresOnMs ??
                (parsed?.expiresOn ? Date.parse(parsed.expiresOn) : undefined) ??
                parsed?.expiresAt ??
                parsed?.exp
            ) ?? extractTokenExpiry(secret);

          if (typeof secret === 'string' && secret.length > 20 && looksLikeJwt(secret)) {
            const expMs = typeof expires === 'number' ? expires : Date.now() + 30 * 60 * 1000;
            if (expMs > Date.now()) {
              this.token = secret;
              return true;
            }
          }
        } catch {
          // Ignore parse errors; continue scanning
        }
      }
    }

    return false;
  }

  private normalizeToken(raw?: string | null): string | undefined {
    if (typeof raw !== 'string') {
      return undefined;
    }
    const trimmed = raw.replace(/^Bearer\s+/i, '').trim();
    return trimmed || undefined;
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
}
export { AuthTokenStoreService as AuthService };
