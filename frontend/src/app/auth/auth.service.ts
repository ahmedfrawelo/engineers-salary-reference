import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Injector } from '@angular/core';
import { computed } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthTokenStoreService } from '../core/auth/auth.service';
import { TokenRefreshService, TokenResponse } from '../core/auth/token-refresh.service';
import {
  COOKIE_AUTH_SESSION_TOKEN,
  resolveAuthRuntimeOptions,
  setCookieAuthEnabled as setCookieAuthStorageFlag
} from '../core/auth/auth-runtime.util';
import { ToastService } from '../shared/toast/toast.service';
import { runtimeConfig } from '../core/runtime-config';
import { PermissionService } from '../core/authorization/permission.service';
import { QueryCacheService } from '../core/cache/query-cache.service';
import { ApiService } from '../infrastructure/http/api.service';
import { clearHttpResponseCache } from '../infrastructure/http/http-response-cache';
import {
  isIdentityRealtimeEvent,
  WebSocketService
} from '@infrastructure/realtime/websocket.service';
import {
  AuthUserProfile,
  normalizeApiUrl,
  normalizeAuthError,
  normalizeReturnUrlPath,
  normalizeStoredUser,
  normalizeStringList,
  pickFirstValidExpiry
} from './auth-helpers';
import {
  decodeJwtPayload,
  extractTokenExpiry,
  isLikelyRefreshToken,
  normalizeExpiresAt
} from '../core/auth/token-utils';

type LooseValue = ReturnType<typeof JSON.parse>;
type User = AuthUserProfile;
type AuthMode = 'bearer' | 'cookie';
type Tokens = { accessToken: string; refreshToken?: string; expiresAt: number };
type LoginResponse = { accessToken: string; refreshToken?: string; expiresIn: number; user: User };
type StoredSession = { tokens: Tokens; user: User; authMode?: AuthMode };
type SessionResult = { authMode: AuthMode; tokens?: Tokens; user: User };
type SignupPayload = { fullName: string; email: string; password: string; company?: string | null };

const AUTH_SESSION_STORAGE_KEY = 'engineers-salary-reference.portal.session';
const AUTH_BROADCAST_KEY = 'engineers-salary-reference.broadcast';
const COOKIE_AUTH_SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class AuthFacadeService {
  private readonly router = inject(Router);
  private readonly tokenStore = inject(AuthTokenStoreService);
  private readonly tokenRefreshService = inject(TokenRefreshService);
  private readonly toast = inject(ToastService);
  private readonly permissionService = inject(PermissionService);
  private readonly queryCache = inject(QueryCacheService);
  private readonly injector = inject(Injector);

  readonly user = signal<User | null>(null);
  readonly tokens = signal<Tokens | null>(null);
  readonly mustChangePassword = computed(() => this.user()?.mustChangePassword === true);
  private sessionExpiryTimer?: ReturnType<typeof setTimeout>;
  private logoutInProgress = false;
  private automaticSessionTerminationHandled = false;
  private expiryRecoveryInProgress = false;
  private sessionRehydrateInProgress = false;
  private initializationPromise: Promise<void> | null = null;
  private sessionInitializationCompleted = false;
  private readonly debugEnabled = environment.enableDebugLogs;
  private readonly sessionRecoveryRetryMs = 30_000;
  private permissionsSyncInProgress = false;

  private get http(): HttpClient {
    return this.injector.get(HttpClient);
  }

  private debugLog(message: string, ...args: unknown[]): void {
    if (!this.debugEnabled) {
      return;
    }
    console.log(message, ...args);
  }

  private hasValidAccessToken(candidate?: Tokens | null): boolean {
    const accessToken = candidate?.accessToken;
    if (!accessToken) {
      return false;
    }

    const tokenExpiry = extractTokenExpiry(accessToken);
    if (typeof tokenExpiry === 'number') {
      return tokenExpiry > Date.now();
    }

    return Number.isFinite(candidate?.expiresAt) && (candidate?.expiresAt ?? 0) > Date.now();
  }

  constructor() {
    this.debugLog('[Auth] Initializing authentication service...');
    this.debugLog('[Auth] Backend mode:', environment.useMockAuth ? 'MOCK' : 'REAL');

    this.enforceCookieAuthMigration();
    this.restoreSession();
    if (this.isCookieAuthEnabled()) {
      this.syncCookieSessionFromStorage();
    } else {
      this.clearCookieAuthIfBearerSession();
    }

    this.cleanupOldSessionsWithoutRefreshToken();
    this.watchTokenRefresh();
    this.watchRealtimePermissionChanges();

    if (this.shouldAutoLoginMockUser()) {
      this.debugLog('[Auth] Auto-login enabled - creating demo session...');
      this.bootstrapMockSession();
      this.debugLog('[Auth] Demo session created.');
    } else if (this.tokens()) {
      this.debugLog('[Auth] Session restored from storage.');
    } else {
      this.debugLog('[Auth] No active session - user must log in.');
    }
  }

  initializeSession(): Promise<void> {
    if (this.sessionInitializationCompleted) {
      return Promise.resolve();
    }
    if (!this.initializationPromise) {
      this.initializationPromise = this.initializeSessionInternal().finally(() => {
        this.sessionInitializationCompleted = true;
        this.initializationPromise = null;
      });
    }
    return this.initializationPromise;
  }

  async ensureAuthenticated(): Promise<boolean> {
    if (this.isAuthenticated()) {
      return true;
    }

    if (environment.useMockAuth || this.isCookieAuthEnabled()) {
      return this.isAuthenticated();
    }

    if (!this.tokens()) {
      this.restoreSession();
    }

    const currentTokens = this.tokens();
    const restored = this.readStoredSession();
    const availableTokens = currentTokens ?? restored?.session?.tokens ?? null;
    const refreshToken =
      this.resolveStoredRefreshToken(currentTokens) ??
      this.resolveStoredRefreshToken(restored?.session);
    const hasRecoverableBearerSession =
      !!availableTokens?.accessToken && !!(this.user() ?? restored?.session?.user);

    if (!hasRecoverableBearerSession) {
      return false;
    }

    if (!refreshToken) {
      if (this.hasValidAccessToken(availableTokens)) {
        this.tryRehydrateSessionWithoutRefresh(availableTokens);
        return true;
      }
      return false;
    }

    try {
      const refreshedTokens = await firstValueFrom(this.tokenRefreshService.refreshToken());
      this.applyRefreshedTokens(refreshedTokens);
      return true;
    } catch (error) {
      if (this.isTransientSessionFailure(error)) {
        this.debugLog(
          '[Auth] Guard/session check refresh failed transiently; preserving recoverable session.',
          error
        );

        if (this.hasValidAccessToken(availableTokens)) {
          this.tryRehydrateSessionWithoutRefresh(availableTokens);
          this.scheduleSessionExpiry(Date.now() + this.sessionRecoveryRetryMs);
          return true;
        }

        return false;
      }

      this.debugLog(
        '[Auth] Guard/session check refresh failed definitively; clearing invalid session.',
        error
      );
      this.clearStaleBearerSession('guard/session check failed');
      return false;
    }
  }

  async login(email: string, password: string, remember: boolean): Promise<void> {
    const trimmedEmail = email?.trim() ?? '';
    const trimmedPassword = password?.trim() ?? '';

    if (!trimmedEmail) {
      throw new Error('Please enter your email address');
    }
    if (!trimmedPassword) {
      throw new Error('Please enter your password');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      throw new Error('Invalid email format');
    }

    this.debugLog('[Auth] Attempting login.');
    this.debugLog('[Auth] Backend mode:', environment.useMockAuth ? 'MOCK' : 'REAL');

    try {
      const session = await this.requestSession(trimmedEmail, trimmedPassword, remember);
      if (session.authMode === 'cookie') {
        this.applyCookieSession(session.user);
        this.persistCookieSession(session.user, remember);
        void this.enrichCookieSessionUser(session.user, remember);
      } else {
        const normalizedTokens = this.normalizeTokens(session.tokens!);
        this.applySession(normalizedTokens, session.user, remember);
        this.persistSession(normalizedTokens, session.user, remember);
      }

      this.debugLog('[Auth] Login successful.');
      if (session.tokens?.expiresAt) {
        this.debugLog('[Auth] Token expires at:', new Date(session.tokens.expiresAt).toISOString());
      }

      // Save flag to show welcome message after redirect
      try {
        localStorage.setItem(
          'engineers-salary-reference.showWelcome',
          JSON.stringify({
            userName: session.user.name,
            timestamp: Date.now()
          })
        );
        this.debugLog('[Auth] Welcome flag saved to localStorage.');
      } catch (e) {
        console.error('[Auth] Failed to save welcome flag:', e);
      }
    } catch (error: LooseValue) {
      console.error('[Auth] Login failed:', error.message || error);

      const authError = normalizeAuthError(error);
      // Show error message to user
      this.debugLog('[Auth] Calling toast.error with message:', authError.message);
      this.toast.error(authError.message, 10000);

      throw authError;
    }
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    const trimmedOldPassword = oldPassword?.trim() ?? '';
    const trimmedNewPassword = newPassword?.trim() ?? '';

    if (!trimmedOldPassword) {
      throw new Error('Please enter your current password');
    }
    this.assertStrongPassword(trimmedNewPassword, 'Please enter a new password');

    const runtime = runtimeConfig();
    const apiBase = (runtime.apiBaseUrl ?? environment.API_BASE_URL ?? '').replace(/\/+$/, '');
    const apiUrl = normalizeApiUrl(apiBase, 'Password/change');
    const authRuntime = resolveAuthRuntimeOptions();

    try {
      await firstValueFrom(
        this.http.post<LooseValue>(
          apiUrl,
          { oldPassword: trimmedOldPassword, newPassword: trimmedNewPassword },
          {
            withCredentials: authRuntime.withCredentials
          }
        )
      );
    } catch (error) {
      throw normalizeAuthError(error);
    }
  }

  async requestPasswordReset(email: string): Promise<string> {
    const trimmedEmail = email?.trim() ?? '';

    if (!trimmedEmail) {
      throw new Error('Please enter your email address');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      throw new Error('Invalid email format');
    }

    const runtime = runtimeConfig();
    const apiBase = (runtime.apiBaseUrl ?? environment.API_BASE_URL ?? '').replace(/\/+$/, '');
    const apiUrl = normalizeApiUrl(apiBase, 'Password/forgot');
    const authRuntime = resolveAuthRuntimeOptions();

    try {
      const response = await firstValueFrom(
        this.http.post<LooseValue>(
          apiUrl,
          { email: trimmedEmail },
          {
            withCredentials: authRuntime.withCredentials
          }
        )
      );

      return (
        response?.message || 'If the account exists, password reset instructions have been sent.'
      );
    } catch (error) {
      throw normalizeAuthError(error);
    }
  }

  async resetPasswordWithToken(
    email: string,
    token: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<string> {
    const trimmedEmail = email?.trim() ?? '';
    const trimmedToken = token?.trim() ?? '';
    const trimmedNewPassword = newPassword?.trim() ?? '';
    const trimmedConfirmPassword = confirmPassword?.trim() ?? '';

    if (!trimmedEmail) {
      throw new Error('Missing reset email address');
    }
    if (!trimmedToken) {
      throw new Error('Missing reset token');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      throw new Error('Invalid email format');
    }

    this.assertStrongPassword(trimmedNewPassword, 'Please enter a new password');

    if (!trimmedConfirmPassword) {
      throw new Error('Please confirm your new password');
    }
    if (trimmedNewPassword !== trimmedConfirmPassword) {
      throw new Error('Passwords must match');
    }

    const runtime = runtimeConfig();
    const apiBase = (runtime.apiBaseUrl ?? environment.API_BASE_URL ?? '').replace(/\/+$/, '');
    const apiUrl = normalizeApiUrl(apiBase, 'Password/reset-by-token');
    const authRuntime = resolveAuthRuntimeOptions();

    try {
      const response = await firstValueFrom(
        this.http.post<LooseValue>(
          apiUrl,
          {
            email: trimmedEmail,
            token: trimmedToken,
            newPassword: trimmedNewPassword,
            confirmPassword: trimmedConfirmPassword
          },
          {
            withCredentials: authRuntime.withCredentials
          }
        )
      );

      return response?.message || 'Password reset successfully. Please sign in again.';
    } catch (error) {
      throw normalizeAuthError(error);
    }
  }

  async signup(payload: SignupPayload, remember: boolean): Promise<string | void> {
    const fullName = payload.fullName?.trim() ?? '';
    const email = payload.email?.trim() ?? '';
    const password = payload.password?.trim() ?? '';
    const company = payload.company?.trim();

    if (!fullName) {
      throw new Error('Please enter your full name');
    }
    if (!email) {
      throw new Error('Please enter your email address');
    }
    if (!password) {
      throw new Error('Please enter a password');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }
    this.assertStrongPassword(password, 'Please enter a password');

    try {
      const message = await this.requestSignup({
        fullName,
        email,
        password,
        company: company || undefined
      });
      this.debugLog('[Auth] Signup request submitted.');
      return message;
    } catch (error: LooseValue) {
      console.error('[AuthFacadeService] Signup error:', error);
      throw normalizeAuthError(error);
    }
  }

  logout(
    broadcast = true,
    reason: 'manual' | 'expired' | 'refresh-failed' | 'revoked' = 'manual'
  ): void {
    const automaticSessionTermination = reason !== 'manual';
    if (automaticSessionTermination && this.automaticSessionTerminationHandled) {
      return;
    }
    if (this.logoutInProgress) {
      return;
    }
    this.logoutInProgress = true;
    if (automaticSessionTermination) {
      this.automaticSessionTerminationHandled = true;
    }
    void this.notifyBackendLogoutIfNeeded();

    this.debugLog('[Auth] Logging out...');

    const userName = this.user()?.name;

    this.resetLocalAuthState();

    if (broadcast && reason === 'manual') {
      this.broadcastLogout();
    }

    this.debugLog('[Auth] Logout successful - redirecting to login page.');

    const message =
      reason === 'manual'
        ? `Signed out${userName ? `, ${userName}` : ''}.`
        : reason === 'revoked'
          ? 'Your session was ended. Please sign in again.'
          : 'Session expired. Please sign in again.';

    this.toast.info(message, 6000);
    const returnUrl = reason === 'manual' ? null : this.resolveLogoutReturnUrl();
    if (returnUrl) {
      void this.router.navigate(['/login'], { queryParams: { returnUrl } });
    } else {
      void this.router.navigateByUrl('/login');
    }
    this.logoutInProgress = false;
  }

  forceLogoutFromAnotherTab(): void {
    this.logout(false, 'manual');
  }

  completeForcedPasswordChange(returnUrl?: string | null): void {
    this.resetLocalAuthState();
    const normalizedReturnUrl = normalizeReturnUrlPath(returnUrl);
    if (normalizedReturnUrl) {
      void this.router.navigate(['/login'], {
        queryParams: { returnUrl: normalizedReturnUrl },
        replaceUrl: true
      });
      return;
    }

    void this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  private createCookieSessionTokens(): Tokens {
    return {
      accessToken: COOKIE_AUTH_SESSION_TOKEN,
      expiresAt: Date.now() + COOKIE_AUTH_SESSION_EXPIRY_MS
    };
  }

  private applyCookieSession(user: User): void {
    this.automaticSessionTerminationHandled = false;
    this.debugLog('[Auth] Applying cookie-auth session.');
    this.clearSessionExpiryTimer();
    this.tokens.set(null);
    this.user.set(user);
    this.permissionService.loadUserPermissions({
      roles: user.roles ?? [],
      permissions: user.permissions ?? []
    });
    this.tokenStore.clear();
    this.tokenRefreshService.clearTokens();
    this.setCookieAuthEnabled(true);
  }

  private persistCookieSession(user: User, remember: boolean): void {
    this.debugLog('[Auth] Persisting cookie-auth session metadata to sessionStorage.');

    const primary = this.getStorage('session');
    const secondary = this.getStorage('local');
    const payload: StoredSession = {
      authMode: 'cookie',
      tokens: this.createCookieSessionTokens(),
      user
    };

    secondary?.removeItem(AUTH_SESSION_STORAGE_KEY);

    try {
      primary?.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(payload));
      if (remember) {
        this.debugLog(
          '[Auth] Cookie-auth persistence is controlled by backend cookies, not browser token storage.'
        );
      }
    } catch (e) {
      console.error('[Auth] Failed to persist cookie-auth session metadata:', e);
    }
  }

  private async fetchCookieSessionUser(apiBase: string, fallback: User): Promise<User | null> {
    const authMeUrl = normalizeApiUrl(apiBase, 'Auth/me');
    const ctrl = typeof AbortController === 'function' ? new AbortController() : undefined;
    const timeoutId = ctrl ? setTimeout(() => ctrl.abort(), 5000) : undefined;
    try {
      const response = await fetch(authMeUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'include',
        signal: ctrl?.signal
      });
      if (!response.ok) {
        return fallback;
      }

      const body = (await response.json().catch(() => null)) as LooseValue;
      const payload = body?.data ?? body?.payload ?? body?.result ?? body;
      const userCandidate = payload?.user ?? payload;
      const normalized = normalizeStoredUser(userCandidate, fallback.email || fallback.id);
      if (!normalized) {
        return fallback;
      }
      return {
        ...normalized,
        roles:
          normalized.roles.length > 0
            ? normalized.roles
            : normalizeStringList(
                userCandidate?.roles ??
                  userCandidate?.role ??
                  payload?.roles ??
                  payload?.role ??
                  fallback.roles
              ),
        permissions:
          normalized.permissions && normalized.permissions.length > 0
            ? normalized.permissions
            : normalizeStringList(
                userCandidate?.permissions ??
                  userCandidate?.permission ??
                  userCandidate?.userPermissions ??
                  payload?.permissions ??
                  payload?.permission ??
                  payload?.userPermissions ??
                  fallback.permissions
              ),
        mustChangePassword:
          normalized.mustChangePassword ??
          (userCandidate?.mustChangePassword as boolean | undefined) ??
          (payload?.mustChangePassword as boolean | undefined) ??
          fallback.mustChangePassword ??
          false
      };
    } catch {
      return fallback;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  private async enrichCookieSessionUser(fallback: User, remember: boolean): Promise<void> {
    const runtime = runtimeConfig();
    const apiBase = (runtime.apiBaseUrl ?? environment.API_BASE_URL ?? '').replace(/\/+$/, '');
    const resolvedUser = await this.fetchCookieSessionUser(apiBase, fallback);
    if (!resolvedUser || this.logoutInProgress || !this.isCookieAuthEnabled()) {
      return;
    }

    this.user.set(resolvedUser);
    this.permissionService.loadUserPermissions({
      roles: resolvedUser.roles ?? [],
      permissions: resolvedUser.permissions ?? []
    });
    this.persistCookieSession(resolvedUser, remember);
  }

  private syncCookieSessionFromStorage(): void {
    if (!this.isCookieAuthEnabled()) {
      return;
    }

    const stored = this.readStoredSession();
    if (!stored?.session?.user) {
      return;
    }

    this.user.set(stored.session.user);
    this.permissionService.loadUserPermissions({
      roles: stored.session.user.roles ?? [],
      permissions: stored.session.user.permissions ?? []
    });
    this.tokens.set(null);
    this.tokenStore.clear();
  }

  private async notifyBackendLogoutIfNeeded(): Promise<void> {
    if (!this.isCookieAuthEnabled()) {
      return;
    }

    const runtime = runtimeConfig();
    const apiBase = (runtime.apiBaseUrl ?? environment.API_BASE_URL ?? '').replace(/\/+$/, '');
    const logoutUrl = normalizeApiUrl(apiBase, 'Auth/logout');
    try {
      await fetch(logoutUrl, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        credentials: 'include',
        keepalive: true
      });
    } catch {
      // Best effort only; local logout still proceeds.
    }
  }

  isAuthenticated(): boolean {
    if (!this.tokens()) {
      this.restoreSession();
    }

    // Check cookie auth
    if (this.isCookieAuthEnabled() && this.user()) {
      return true;
    }

    const current = this.tokens();
    const currentRefreshToken = this.resolveStoredRefreshToken(current);
    if (!current?.accessToken) {
      const restored = this.readStoredSession();
      if (restored?.session?.tokens?.accessToken) {
        const restoredRefreshToken = this.resolveStoredRefreshToken(restored.session);
        if (!restoredRefreshToken) {
          if (this.hasValidAccessToken(restored.session.tokens)) {
            this.debugLog(
              '[Auth] Restored bearer session in auth check has no refresh token, but access token is still valid. Preserving restored session until expiry.'
            );
            const normalizedTokens = this.normalizeTokens(restored.session.tokens);
            this.tokens.set(normalizedTokens);
            this.user.set(restored.session.user);
            this.tokenStore.setToken(normalizedTokens.accessToken);
            this.scheduleSessionExpiry(normalizedTokens.expiresAt);
            this.tryRehydrateSessionWithoutRefresh(normalizedTokens);
            return true;
          }

          this.clearStaleBearerSession('restored bearer session has no refresh token');
          return false;
        }
        const normalizedTokens = this.normalizeTokens({
          ...restored.session.tokens,
          refreshToken: restoredRefreshToken
        });
        if (normalizedTokens.accessToken) {
          this.tokens.set(normalizedTokens);
          this.user.set(restored.session.user);
          this.tokenStore.setToken(normalizedTokens.accessToken);
          return true;
        }
      }
      return false;
    }

    if (!this.isCookieAuthEnabled() && !currentRefreshToken) {
      if (this.hasValidAccessToken(current)) {
        this.debugLog(
          '[Auth] Active bearer session has no refresh token, but the access token is still valid. Preserving session until expiry.'
        );
        this.tryRehydrateSessionWithoutRefresh(current);
        return true;
      }

      this.clearStaleBearerSession('active bearer session has no refresh token');
      return false;
    }

    if (currentRefreshToken && current.refreshToken !== currentRefreshToken) {
      this.tokens.set({
        ...current,
        refreshToken: currentRefreshToken
      });
    }

    // Check token expiry from JWT claims first (more accurate)
    const tokenExpiry = extractTokenExpiry(current.accessToken);
    if (typeof tokenExpiry === 'number') {
      if (tokenExpiry > Date.now()) {
        return true;
      }
      if (currentRefreshToken) {
        this.debugLog(
          '[Auth] Access token is expired, but a refresh token is present. Treating the session as recoverable.'
        );
        return true;
      }
      return false;
    }

    // Fallback to stored expiresAt
    if (!Number.isFinite(current.expiresAt)) {
      // If expiry metadata is missing, let the backend validate on the next guarded request.
      return true;
    }

    if (current.expiresAt > Date.now()) {
      return true;
    }

    if (currentRefreshToken) {
      this.debugLog(
        '[Auth] Stored access-token expiry elapsed, but a refresh token is present. Treating the session as recoverable.'
      );
      return true;
    }

    return false;
  }

  private watchTokenRefresh(): void {
    this.tokenRefreshService.tokens$.subscribe(tokens => {
      if (!tokens) {
        this.handleSessionExpired('refresh-failed');
        return;
      }
      this.applyRefreshedTokens(tokens);
    });
  }

  private watchRealtimePermissionChanges(): void {
    queueMicrotask(() => {
      this.injector
        .get(WebSocketService)
        .events()
        .subscribe({
          next: event => {
            if (!isIdentityRealtimeEvent(event)) {
              return;
            }

            const action = event.action.trim().toLowerCase();
            const currentUserId = this.user()?.id?.trim();
            const targetUserId = event.entityId?.trim() ?? '';
            if (!currentUserId || !targetUserId || currentUserId !== targetUserId) {
              return;
            }

            if (action === 'permissions_changed') {
              this.syncPermissionsFromRealtime();
              return;
            }

            if (action === 'session_revoked') {
              this.handleRealtimeSessionRevocation();
            }
          },
          error: error => {
            this.debugLog('[Auth] Realtime permission sync subscription failed.', error);
          }
        });
    });
  }

  private syncPermissionsFromRealtime(): void {
    if (this.permissionsSyncInProgress || this.logoutInProgress || !this.user()) {
      return;
    }

    const canRefreshSession =
      this.isCookieAuthEnabled() || !!this.tokenRefreshService.getRefreshToken();
    if (!canRefreshSession) {
      this.debugLog(
        '[Auth] Permissions changed event received, but no refresh path is available for the current session.'
      );
      return;
    }

    this.permissionsSyncInProgress = true;
    this.debugLog('[Auth] Realtime permission change detected for the current user.');

    void firstValueFrom(this.tokenRefreshService.refreshToken())
      .then(refreshedTokens => {
        this.applyRefreshedTokens(refreshedTokens);
        this.clearRuntimeCaches();
      })
      .catch(error => {
        if (this.isTransientSessionFailure(error)) {
          this.debugLog(
            '[Auth] Realtime permission sync failed transiently; keeping the current session until the next refresh.',
            error
          );
          return;
        }

        this.debugLog('[Auth] Realtime permission sync failed; ending the stale session.', error);
        this.logout(true, 'refresh-failed');
      })
      .finally(() => {
        this.permissionsSyncInProgress = false;
      });
  }

  private handleRealtimeSessionRevocation(): void {
    if (this.logoutInProgress || !this.user()) {
      return;
    }

    this.debugLog('[Auth] Realtime session revocation detected for the current user.');
    this.logout(false, 'revoked');
  }

  private applyRefreshedTokens(tokens: TokenResponse): void {
    if (this.logoutInProgress || this.automaticSessionTerminationHandled) {
      return;
    }

    const refreshedUser =
      tokens.user ?? this.user() ?? this.readStoredSession()?.session?.user ?? null;

    if (tokens.authMode === 'cookie') {
      this.clearSessionExpiryTimer();
      this.tokens.set(null);
      this.tokenStore.clear();
      if (refreshedUser) {
        this.user.set(refreshedUser);
        this.permissionService.loadUserPermissions({
          roles: refreshedUser.roles ?? [],
          permissions: refreshedUser.permissions ?? []
        });
      }
      this.setCookieAuthEnabled(true);
      return;
    }

    const current = this.tokens() ?? this.readStoredSession()?.session?.tokens ?? null;
    if (!current) {
      return;
    }
    const nextTokens: Tokens = {
      accessToken: tokens.accessToken,
      expiresAt: tokens.expiresAt,
      refreshToken: tokens.refreshToken ?? current?.refreshToken
    };
    const normalizedTokens = this.normalizeTokens(nextTokens);

    this.tokenStore.setToken(normalizedTokens.accessToken);
    this.tokens.set(normalizedTokens);
    if (refreshedUser) {
      this.user.set(refreshedUser);
      this.permissionService.loadUserPermissions({
        roles: refreshedUser.roles ?? [],
        permissions: refreshedUser.permissions ?? []
      });
    }
    this.scheduleSessionExpiry(normalizedTokens.expiresAt);

    if (this.debugEnabled) {
      this.debugLog('[Auth] Token refreshed and applied.');
    }
  }

  private scheduleSessionExpiry(expiresAt?: number): void {
    this.clearSessionExpiryTimer();
    if (this.isCookieAuthEnabled()) {
      return;
    }
    if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) {
      return;
    }
    const ms = expiresAt - Date.now();
    if (ms <= 0) {
      this.handleSessionExpired('expired');
      return;
    }
    this.sessionExpiryTimer = setTimeout(() => {
      this.handleSessionExpired('expired');
    }, ms);
  }

  private clearSessionExpiryTimer(): void {
    if (this.sessionExpiryTimer) {
      clearTimeout(this.sessionExpiryTimer);
      this.sessionExpiryTimer = undefined;
    }
  }

  private handleSessionExpired(reason: 'expired' | 'refresh-failed'): void {
    if (this.logoutInProgress || !this.tokens()) {
      return;
    }
    const currentAccessToken = this.tokens()?.accessToken;
    const currentAccessExpiry = extractTokenExpiry(currentAccessToken);
    if (typeof currentAccessExpiry === 'number' && currentAccessExpiry > Date.now()) {
      this.debugLog(
        '[Auth] Session-expiry handler was invoked, but the current access token is still valid. Preserving session.'
      );
      this.scheduleSessionExpiry(currentAccessExpiry);
      return;
    }
    if (
      reason === 'expired' &&
      !this.isCookieAuthEnabled() &&
      !this.expiryRecoveryInProgress &&
      this.tokenRefreshService.getRefreshToken()
    ) {
      this.expiryRecoveryInProgress = true;
      this.tokenRefreshService.refreshToken().subscribe({
        next: () => {
          this.expiryRecoveryInProgress = false;
        },
        error: error => {
          this.expiryRecoveryInProgress = false;
          const currentTokenExpiry = extractTokenExpiry(this.tokens()?.accessToken);
          if (typeof currentTokenExpiry === 'number' && currentTokenExpiry > Date.now()) {
            this.debugLog(
              '[Auth] Refresh failed from expiry timer, but the current access token is still valid. Preserving session.',
              error
            );
            this.scheduleSessionExpiry(currentTokenExpiry);
            return;
          }
          if (this.isTransientSessionFailure(error)) {
            this.debugLog(
              '[Auth] Access token expired but refresh failed transiently; retrying shortly.',
              error
            );
            this.scheduleSessionExpiry(Date.now() + this.sessionRecoveryRetryMs);
            return;
          }
          this.logout(true, reason);
        }
      });
      return;
    }
    this.logout(true, reason);
  }

  private tryRehydrateSessionWithoutRefresh(tokens?: Tokens | null): void {
    if (
      this.isCookieAuthEnabled() ||
      this.sessionRehydrateInProgress ||
      !tokens?.accessToken ||
      !!tokens.refreshToken ||
      !this.hasValidAccessToken(tokens)
    ) {
      return;
    }

    this.sessionRehydrateInProgress = true;

    void firstValueFrom(this.tokenRefreshService.rehydrateSession())
      .then(restoredTokens => {
        this.applyRefreshedTokens(restoredTokens);
      })
      .catch(error => {
        if (error?.status === 401 || error?.status === 403) {
          this.debugLog(
            '[Auth] Session rehydrate without refresh token was rejected by the server. Expiring session immediately.',
            error
          );
          this.logout(true, 'expired');
          return;
        }
        this.debugLog(
          '[Auth] Session rehydrate without refresh token failed; preserving the current valid access token until expiry.',
          error
        );
      })
      .finally(() => {
        this.sessionRehydrateInProgress = false;
      });
  }

  private async requestSession(
    email: string,
    password: string,
    remember: boolean
  ): Promise<SessionResult> {
    this.debugLog('[Auth] Auth mode:', environment.useMockAuth ? 'MOCK' : 'REAL');
    const authRuntime = resolveAuthRuntimeOptions();
    const cookieAuthRequested = authRuntime.useCookieAuth;
    if (!cookieAuthRequested) {
      this.setCookieAuthEnabled(false);
    }

    if (environment.useMockAuth) {
      this.debugLog('[Auth] Using mock authentication (demo mode).');
      await new Promise(resolve => setTimeout(resolve, 500));
      return {
        authMode: 'bearer',
        tokens: {
          accessToken: 'DEMO_TOKEN_' + Math.random().toString(36).slice(2),
          expiresAt: Date.now() + 60 * 60 * 1000
        },
        user: {
          id: 'u1',
          name: 'Admin',
          email,
          roles: ['User', 'Admin'],
          mustChangePassword: false
        }
      };
    }

    const runtime = runtimeConfig();
    const apiBase = (runtime.apiBaseUrl ?? environment.API_BASE_URL ?? '').replace(/\/+$/, '');
    // Backend expects capitalized Auth segment: /api/Auth/login
    const apiUrl = normalizeApiUrl(apiBase, 'Auth/login');
    this.debugLog('[Auth] Sending login request to:', apiUrl);

    const httpStart = performance.now();
    const requestHeaders = cookieAuthRequested
      ? new HttpHeaders({
          'X-Auth-Mode': 'cookie'
        })
      : undefined;
    const response = await firstValueFrom(
      this.http.post<LoginResponse | LooseValue>(
        apiUrl,
        { email, password, rememberMe: remember },
        {
          headers: requestHeaders,
          observe: 'response',
          withCredentials: authRuntime.withCredentials
        }
      )
    );
    const httpEnd = performance.now();

    this.debugLog('[Auth] HTTP request took', `${(httpEnd - httpStart).toFixed(0)}ms`);
    this.debugLog('[Auth] Response received from backend.');

    const responseBody = response?.body ?? response;
    const responseHeaders = response?.headers;

    const looksLikeJwt = (value: string): boolean =>
      /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(value);

    const normalizeTokenCandidate = (value: unknown): string | undefined => {
      if (typeof value !== 'string') {
        return undefined;
      }
      const trimmed = value.replace(/^Bearer\s+/i, '').trim();
      return trimmed || undefined;
    };

    const normalizeJwtCandidate = (value: unknown): string | undefined => {
      const token = normalizeTokenCandidate(value);
      if (!token) {
        return undefined;
      }
      return looksLikeJwt(token) ? token : undefined;
    };

    const extractHeaderToken = (): string | undefined => {
      if (!responseHeaders?.get) {
        return undefined;
      }
      const headerValue =
        responseHeaders.get('Authorization') ??
        responseHeaders.get('authorization') ??
        responseHeaders.get('X-Access-Token') ??
        responseHeaders.get('x-access-token') ??
        responseHeaders.get('Access-Token') ??
        responseHeaders.get('access-token');
      return normalizeTokenCandidate(headerValue);
    };

    const extractTokenValue = (value: unknown): string | undefined => {
      if (typeof value === 'string') {
        return normalizeTokenCandidate(value);
      }
      if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        const nested =
          record.accessToken ??
          record.access_token ??
          record.token ??
          record.value ??
          record.jwt ??
          record.idToken ??
          record.id_token ??
          record.bearerToken ??
          record.authorization ??
          record.authToken ??
          record.auth_token ??
          record.sessionToken ??
          record.session_token;
        return normalizeTokenCandidate(nested);
      }
      return undefined;
    };

    const payload =
      responseBody?.data?.data ??
      responseBody?.data?.result ??
      responseBody?.data?.payload ??
      responseBody?.data ??
      responseBody?.result ??
      responseBody?.payload ??
      responseBody;

    const collectByKeys = (
      source: unknown,
      keys: string[],
      coerce: (value: unknown) => string | undefined,
      maxDepth = 5
    ): string | undefined => {
      if (!source || maxDepth < 0) {
        return undefined;
      }
      const keySet = new Set(keys.map(k => k.toLowerCase()));
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

    const findJwtString = (source: unknown, maxDepth = 4): string | undefined => {
      if (!source || maxDepth < 0) {
        return undefined;
      }
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
          if (typeof entry === 'string') {
            const extracted = normalizeJwtCandidate(entry);
            if (extracted) {
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

    const collectTokenishStrings = (source: unknown, maxDepth = 4, maxCount = 6): string[] => {
      if (!source || maxDepth < 0) {
        return [];
      }
      const isTokenish = (value: string): boolean => {
        const trimmed = value.trim();
        if (trimmed.length < 20 || trimmed.length > 2048) {
          return false;
        }
        if (/\s/.test(trimmed)) {
          return false;
        }
        if (trimmed.includes('@')) {
          return false;
        }
        if (/^https?:/i.test(trimmed)) {
          return false;
        }
        return true;
      };
      const found: string[] = [];
      const seen = new Set<unknown>();
      const stack: Array<{ value: unknown; depth: number }> = [{ value: source, depth: 0 }];
      while (stack.length) {
        const { value, depth } = stack.pop()!;
        if (!value) {
          continue;
        }
        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (isTokenish(trimmed) && !found.includes(trimmed)) {
            found.push(trimmed);
            if (found.length >= maxCount) {
              break;
            }
          }
          continue;
        }
        if (typeof value !== 'object') {
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
        for (const entry of Object.values(record)) {
          if (depth < maxDepth) {
            stack.push({ value: entry, depth: depth + 1 });
          } else if (typeof entry === 'string') {
            const trimmed = entry.trim();
            if (isTokenish(trimmed) && !found.includes(trimmed)) {
              found.push(trimmed);
              if (found.length >= maxCount) {
                break;
              }
            }
          }
        }
      }
      return found;
    };

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
    const explicitAccessToken =
      extractHeaderToken() ??
      collectByOrderedKeys(responseBody, primaryAccessTokenKeys, extractTokenValue) ??
      collectByOrderedKeys(payload, primaryAccessTokenKeys, extractTokenValue) ??
      collectByOrderedKeys(responseBody, secondaryAccessTokenKeys, extractTokenValue) ??
      collectByOrderedKeys(payload, secondaryAccessTokenKeys, extractTokenValue) ??
      collectByOrderedKeys(responseBody, primaryAccessTokenKeys, normalizeJwtCandidate) ??
      collectByOrderedKeys(payload, primaryAccessTokenKeys, normalizeJwtCandidate) ??
      collectByOrderedKeys(responseBody, secondaryAccessTokenKeys, normalizeJwtCandidate) ??
      collectByOrderedKeys(payload, secondaryAccessTokenKeys, normalizeJwtCandidate);

    const refreshToken =
      collectByOrderedKeys(responseBody, refreshTokenKeys, extractTokenValue) ??
      collectByOrderedKeys(payload, refreshTokenKeys, extractTokenValue);

    if (refreshToken) {
      this.debugLog('[Auth] Refresh token found in backend response.');
    } else {
      this.debugLog('[Auth] No refresh token in response - token refresh is disabled.');
    }

    let normalizedRefreshToken =
      typeof refreshToken === 'string' && refreshToken.trim()
        ? refreshToken.replace(/^Bearer\s+/i, '').trim()
        : undefined;

    const scoreTokenCandidate = (token: string): number => {
      if (!token) {
        return -1;
      }
      let score = 0;
      if (looksLikeJwt(token)) {
        score += 2;
      }
      const claims = decodeJwtPayload(token);
      if (!claims) {
        if (normalizedRefreshToken && token === normalizedRefreshToken) {
          score -= 5;
        }
        return score;
      }
      const expiry = extractTokenExpiry(token);
      if (typeof expiry === 'number') {
        if (expiry > Date.now() + 60 * 1000) {
          score += 2;
        } else {
          score -= 4;
        }
      }
      const tokenType = String(
        claims.typ ?? claims.token_use ?? claims['token_type'] ?? ''
      ).toLowerCase();
      if (tokenType.includes('refresh')) {
        score -= 8;
      }
      const roles = normalizeStringList(
        claims.role ??
          claims.roles ??
          claims['http://schemas.microsoft.com/ws/2008/06/identity/claims/role']
      );
      const permissions = normalizeStringList(
        claims.permissions ?? claims.permission ?? claims.scopes ?? claims.scope
      );
      if (roles.length) {
        score += 3;
      }
      if (permissions.length) {
        score += 3;
      }
      if (normalizedRefreshToken && token === normalizedRefreshToken) {
        score -= 10;
      }
      return score;
    };

    const accessCandidates: string[] = [];
    const pushCandidate = (value?: string) => {
      if (!value) {
        return;
      }
      if (!accessCandidates.includes(value)) {
        accessCandidates.push(value);
      }
    };

    pushCandidate(explicitAccessToken);
    if (!explicitAccessToken) {
      pushCandidate(
        collectByOrderedKeys(responseBody, fallbackAccessTokenKeys, normalizeJwtCandidate)
      );
      pushCandidate(collectByOrderedKeys(payload, fallbackAccessTokenKeys, normalizeJwtCandidate));
      pushCandidate(findJwtString(payload));
      pushCandidate(findJwtString(responseBody));
      for (const candidate of collectTokenishStrings(payload)) {
        pushCandidate(candidate);
      }
      for (const candidate of collectTokenishStrings(responseBody)) {
        pushCandidate(candidate);
      }
    }

    let candidatesToVerify = [...accessCandidates];
    if (normalizedRefreshToken) {
      candidatesToVerify = candidatesToVerify.filter(
        candidate => candidate !== normalizedRefreshToken
      );
      if (!candidatesToVerify.includes(normalizedRefreshToken)) {
        candidatesToVerify.push(normalizedRefreshToken);
      }
    }
    const scoredCandidates = candidatesToVerify
      .map(token => ({ token, score: scoreTokenCandidate(token) }))
      .sort((a, b) => b.score - a.score);
    candidatesToVerify = scoredCandidates.map(candidate => candidate.token);
    let normalizedToken = candidatesToVerify[0];
    if (
      normalizedRefreshToken &&
      normalizedToken === normalizedRefreshToken &&
      candidatesToVerify.length > 1
    ) {
      normalizedToken = candidatesToVerify[1];
    }
    const fallbackCookieUser: User = {
      id: email,
      name: email.split('@')[0] || email,
      email,
      roles: [],
      permissions: []
    };

    if (!normalizedToken) {
      if (cookieAuthRequested) {
        this.setCookieAuthEnabled(true);
        return {
          authMode: 'cookie',
          user: fallbackCookieUser
        };
      }
      console.error('[Auth] Login response missing access token.');
      this.debugLog('[Auth] Response keys:', Object.keys(responseBody || {}));
      throw new Error('Invalid login response - no access token');
    }

    this.debugLog('[Auth] Access token extracted.');

    // Parse expiresAt from backend (ISO string) or use expiresIn
    let expiresAtTimestamp: number;

    const rawExpiresAt =
      payload?.expiresAt ??
      payload?.expires_at ??
      payload?.tokens?.expiresAt ??
      payload?.tokens?.expires_at ??
      payload?.token?.expiresAt ??
      payload?.token?.expires_at ??
      responseBody?.data?.expiresAt ??
      responseBody?.data?.expires_at ??
      responseBody?.data?.tokens?.expiresAt ??
      responseBody?.data?.tokens?.expires_at ??
      responseBody?.data?.token?.expiresAt ??
      responseBody?.data?.token?.expires_at ??
      responseBody?.expiresAt ??
      responseBody?.expires_at ??
      responseBody?.token?.expiresAt ??
      responseBody?.token?.expires_at;
    const normalizedExpiresAt = normalizeExpiresAt(rawExpiresAt);

    if (normalizedExpiresAt) {
      expiresAtTimestamp = normalizedExpiresAt;
      this.debugLog(
        '[Auth] Using expiresAt from backend:',
        new Date(expiresAtTimestamp).toISOString()
      );
    } else {
      // Fallback to expiresIn seconds
      const expiresInSeconds = responseBody?.expiresIn ?? responseBody?.data?.expiresIn ?? 3600;
      expiresAtTimestamp = Date.now() + expiresInSeconds * 1000;
      this.debugLog('[Auth] Calculated expiration from expiresIn (seconds):', expiresInSeconds);
    }

    // Extract user info from data object
    const userId =
      payload?.user?.id ||
      payload?.userId ||
      responseBody?.data?.user?.id ||
      responseBody?.data?.userId ||
      responseBody?.user?.id ||
      responseBody?.userId ||
      payload?.id ||
      responseBody?.id ||
      'unknown';
    const fullName =
      payload?.user?.fullName ||
      payload?.user?.name ||
      payload?.fullName ||
      payload?.name ||
      responseBody?.data?.user?.fullName ||
      responseBody?.data?.user?.name ||
      responseBody?.data?.fullName ||
      responseBody?.fullName ||
      responseBody?.name ||
      email;
    const userEmail =
      payload?.user?.email ||
      payload?.email ||
      responseBody?.data?.user?.email ||
      responseBody?.data?.email ||
      responseBody?.email ||
      email;
    const rawRoles =
      payload?.user?.roles ||
      payload?.user?.role ||
      payload?.roles ||
      payload?.role ||
      responseBody?.data?.user?.roles ||
      responseBody?.data?.user?.role ||
      responseBody?.data?.roles ||
      responseBody?.data?.role ||
      responseBody?.user?.roles ||
      responseBody?.user?.role ||
      responseBody?.roles ||
      responseBody?.role ||
      [];
    const rawPermissions =
      payload?.user?.permissions ||
      payload?.user?.permission ||
      payload?.user?.userPermissions ||
      payload?.permissions ||
      payload?.permission ||
      payload?.userPermissions ||
      responseBody?.data?.user?.permissions ||
      responseBody?.data?.user?.permission ||
      responseBody?.data?.permissions ||
      responseBody?.data?.permission ||
      responseBody?.permissions ||
      responseBody?.permission ||
      responseBody?.data?.userPermissions ||
      responseBody?.userPermissions ||
      [];
    const roles =
      Array.isArray(rawRoles) || typeof rawRoles === 'string'
        ? rawRoles
            .toString()
            .split(',')
            .map(item => item.trim())
            .filter(Boolean)
        : [];
    const permissions = Array.isArray(rawPermissions)
      ? rawPermissions
      : typeof rawPermissions === 'string'
        ? rawPermissions
            .split(',')
            .map(item => item.trim())
            .filter(Boolean)
        : [];
    const rawMustChangePassword =
      payload?.user?.mustChangePassword ??
      payload?.user?.must_change_password ??
      payload?.mustChangePassword ??
      payload?.must_change_password ??
      responseBody?.data?.user?.mustChangePassword ??
      responseBody?.data?.user?.must_change_password ??
      responseBody?.data?.mustChangePassword ??
      responseBody?.data?.must_change_password ??
      responseBody?.user?.mustChangePassword ??
      responseBody?.user?.must_change_password ??
      responseBody?.mustChangePassword ??
      responseBody?.must_change_password;
    const mustChangePassword =
      rawMustChangePassword === true ||
      String(rawMustChangePassword ?? '')
        .trim()
        .toLowerCase() === 'true';

    const safeUser: User = {
      id: userId,
      name: fullName || userEmail.split('@')[0], // Fallback to email username if no name
      email: userEmail,
      roles,
      permissions,
      mustChangePassword
    };

    this.debugLog('[Auth] User profile extracted.');

    // Token probes are useful in production to validate/diagnose tokens, but in local dev
    // they often generate noisy 401s (e.g., /Auth/me permissions differ per environment).
    const shouldProbeTokens =
      !environment.useMockAuth &&
      !explicitAccessToken &&
      (!!normalizedRefreshToken || accessCandidates.length > 1);
    const tokenProbePaths = shouldProbeTokens ? ['Auth/me'] : [];
    const attemptRefreshForAccessToken = async (
      token: string,
      accessTokenCandidate?: string
    ): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: number } | null> => {
      const runtimeNow = runtimeConfig();
      const base = (runtimeNow.apiBaseUrl ?? environment.API_BASE_URL ?? '').replace(/\/+$/, '');
      const url = normalizeApiUrl(base, 'Auth/refresh');
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      };
      if (accessTokenCandidate) {
        headers.Authorization = `Bearer ${accessTokenCandidate}`;
      }
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ refreshToken: token, refresh_token: token })
        });
        if (!res.ok) {
          return null;
        }
        const body = await res.json().catch(() => null);
        if (!body) {
          return null;
        }
        const access =
          collectByOrderedKeys(body, primaryAccessTokenKeys, extractTokenValue) ??
          collectByOrderedKeys(body, secondaryAccessTokenKeys, extractTokenValue) ??
          collectByOrderedKeys(body, fallbackAccessTokenKeys, normalizeJwtCandidate) ??
          findJwtString(body);
        if (!access) {
          return null;
        }
        const nextRefresh = collectByOrderedKeys(body, refreshTokenKeys, extractTokenValue);
        const expiresAt =
          normalizeExpiresAt(
            body?.expiresAt ??
              body?.expires_at ??
              body?.expiresIn ??
              body?.data?.expiresAt ??
              body?.data?.expires_at ??
              body?.data?.expiresIn
          ) ?? extractTokenExpiry(access);
        return {
          accessToken: access,
          refreshToken: nextRefresh,
          expiresAt
        };
      } catch {
        return null;
      }
    };
    const verifyToken = async (token: string): Promise<boolean | null> => {
      if (!tokenProbePaths.length) {
        return null;
      }
      const runtimeNow = runtimeConfig();
      const base = (runtimeNow.apiBaseUrl ?? environment.API_BASE_URL ?? '').replace(/\/+$/, '');
      let hasUnknown = false;
      let hasFalse = false;
      for (const path of tokenProbePaths) {
        const url = normalizeApiUrl(base, path);
        const ctrl = typeof AbortController === 'function' ? new AbortController() : undefined;
        const timeoutId = ctrl ? setTimeout(() => ctrl.abort(), 8000) : undefined;
        try {
          const res = await fetch(url, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`
            },
            signal: ctrl?.signal
          });
          if (res.status === 401) {
            hasFalse = true;
            continue;
          }
          if (res.status === 403) {
            return true;
          }
          if (res.ok) {
            return true;
          }
          hasUnknown = true;
        } catch {
          hasUnknown = true;
        } finally {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        }
      }
      if (hasUnknown) {
        return null;
      }
      return hasFalse ? false : null;
    };

    let resolvedToken = normalizedToken;
    let verificationSkipped = false;
    let verifiedToken: string | null = null;
    for (const candidate of candidatesToVerify) {
      const verdict = await verifyToken(candidate);
      if (verdict === true) {
        verifiedToken = candidate;
        break;
      }
      if (verdict === null) {
        verificationSkipped = true;
        break;
      }
    }
    if (verifiedToken) {
      resolvedToken = verifiedToken;
    } else if (normalizedRefreshToken) {
      const refreshed = await attemptRefreshForAccessToken(normalizedRefreshToken, normalizedToken);
      if (refreshed?.accessToken) {
        resolvedToken = refreshed.accessToken;
        if (refreshed.refreshToken) {
          normalizedRefreshToken = refreshed.refreshToken;
        }
        const derivedExpiry = pickFirstValidExpiry(
          [refreshed.expiresAt, extractTokenExpiry(refreshed.accessToken), expiresAtTimestamp],
          Date.now()
        );
        if (derivedExpiry) {
          expiresAtTimestamp = derivedExpiry;
        }
      } else if (!verificationSkipped) {
        /**
         * IMPORTANT:
         * Do NOT auto-switch to cookie-based auth just because token verification probes returned 401.
         * This flag (`engineers-salary-reference.portal.cookieAuth`) disables auth/token interceptors, which makes the app
         * stop sending the `Authorization` header and looks like "token is not sent to backend".
         *
         * Cookie auth should be an explicit runtime/server decision (e.g., backend sets auth cookies),
         * not an automatic fallback based on a couple of probe endpoints that may be protected,
         * renamed, environment-dependent, or permission-gated.
         */
        this.setCookieAuthEnabled(false);
        this.debugLog(
          '[Auth] Token verification probes failed; continuing with bearer token auth (no cookie-auth fallback).'
        );
      } else if (candidatesToVerify.length > 1) {
        this.debugLog('[Auth] Unable to verify access token. Falling back to first candidate.');
      }
    }

    if (cookieAuthRequested) {
      this.setCookieAuthEnabled(true);
      return {
        authMode: 'cookie',
        user: safeUser
      };
    }

    return {
      authMode: 'bearer',
      tokens: {
        accessToken: resolvedToken,
        refreshToken: normalizedRefreshToken, // Include refresh token from backend
        expiresAt: expiresAtTimestamp
      },
      user: safeUser
    };
  }

  completeExternalLogin(payload: LooseValue, remember: boolean = true): void {
    const accessToken =
      typeof payload?.accessToken === 'string'
        ? payload.accessToken
        : typeof payload?.token === 'string'
          ? payload.token
          : '';
    if (!accessToken) {
      throw new Error('Google did not return a valid session.');
    }

    const user = normalizeStoredUser(payload?.user, accessToken);
    if (!user) {
      throw new Error('Google session is missing user details.');
    }

    const tokens = this.normalizeTokens({
      accessToken,
      refreshToken: typeof payload?.refreshToken === 'string' ? payload.refreshToken : undefined,
      expiresAt:
        normalizeExpiresAt(payload?.expiresAt) ??
        extractTokenExpiry(accessToken) ??
        Date.now() + (environment.security?.tokenExpirationHours ?? 1) * 60 * 60 * 1000
    });

    this.applySession(tokens, user, remember);
    this.persistSession(tokens, user, remember);
  }

  private async requestSignup(payload: SignupPayload): Promise<string | void> {
    if (environment.useMockAuth) {
      await new Promise(resolve => setTimeout(resolve, 650));
      return 'Signup submitted (mock)';
    }

    const runtime = runtimeConfig();
    const apiBase = (runtime.apiBaseUrl ?? environment.API_BASE_URL ?? '').replace(/\/+$/, '');
    // Backend expects capitalized Auth segment: /api/Auth/register
    const apiUrl = normalizeApiUrl(apiBase, 'Auth/register');
    const authRuntime = resolveAuthRuntimeOptions();
    const body: Record<string, unknown> = {
      email: payload.email,
      password: payload.password,
      confirmPassword: payload.password,
      fullName: payload.fullName
    };
    if (payload.company) {
      body.company = payload.company;
    }

    const response = await firstValueFrom(
      this.http.post<LooseValue>(apiUrl, body, {
        withCredentials: authRuntime.withCredentials
      })
    );

    return response?.message || 'Signup request submitted';
  }

  private applySession(tokens: Tokens, user: User, remember: boolean = false): void {
    this.automaticSessionTerminationHandled = false;
    const normalizedTokens = this.normalizeTokens(tokens);
    this.debugLog('[Auth] Applying session - setting tokens and user.');
    this.tokens.set(normalizedTokens);
    this.user.set(user);
    this.permissionService.loadUserPermissions({
      roles: user.roles ?? [],
      permissions: user.permissions ?? []
    });
    this.debugLog('[Auth] Calling tokenStore.setToken().');
    this.tokenStore.setToken(normalizedTokens.accessToken);

    if (normalizedTokens.refreshToken) {
      this.debugLog('[Auth] Storing refresh token via TokenRefreshService.');
      this.tokenRefreshService.setTokens(
        {
          accessToken: normalizedTokens.accessToken,
          refreshToken: normalizedTokens.refreshToken,
          expiresAt: normalizedTokens.expiresAt
        },
        remember
      );
    } else {
      this.debugLog('[Auth] No refresh token to store - token refresh is disabled.');
    }

    this.scheduleSessionExpiry(normalizedTokens.expiresAt);

    this.debugLog('[Auth] Session applied successfully.');
  }

  private persistSession(tokens: Tokens, user: User, remember: boolean): void {
    const primary = this.getStorage(remember ? 'local' : 'session');
    const secondary = this.getStorage(remember ? 'session' : 'local');
    const payload: StoredSession = {
      authMode: 'bearer',
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt
      },
      user
    };

    secondary?.removeItem(AUTH_SESSION_STORAGE_KEY);

    try {
      primary?.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(payload));
      this.debugLog(
        `[Auth] Session persisted successfully in ${remember ? 'localStorage' : 'sessionStorage'}.`
      );
      this.debugLog('[Auth] Session persisted successfully.');
    } catch (e) {
      console.error('[Auth] Failed to persist session:', e);
    }
  }

  private restoreSession(): void {
    const result = this.readStoredSession();
    if (!result) {
      return;
    }

    const { session, fromLocalStorage } = result;
    const storedAccessToken = session.tokens?.accessToken?.trim();
    const hasStoredBearerToken =
      !!storedAccessToken && storedAccessToken !== COOKIE_AUTH_SESSION_TOKEN;

    if (session.authMode === 'cookie') {
      if (!this.isCookieAuthEnabled()) {
        this.setCookieAuthEnabled(false);
        return;
      }
      this.applyCookieSession(session.user);
      this.persistCookieSession(session.user, fromLocalStorage);
      return;
    }

    if (hasStoredBearerToken) {
      // A stale cookie-auth flag must never hijack a valid bearer session after reload.
      this.setCookieAuthEnabled(false);
    } else if (this.isCookieAuthEnabled()) {
      this.applyCookieSession(session.user);
      this.persistCookieSession(session.user, fromLocalStorage);
      return;
    }

    const refreshToken = this.resolveStoredRefreshToken(session);
    if (!refreshToken) {
      if (this.hasValidAccessToken(session.tokens)) {
        this.debugLog(
          '[Auth] Restored bearer session has no refresh token, but access token is still valid. Preserving restored session until expiry.'
        );
        const normalizedTokens = this.normalizeTokens(session.tokens);
        this.applySession(normalizedTokens, session.user, fromLocalStorage);
        this.persistSession(normalizedTokens, session.user, fromLocalStorage);
        this.tryRehydrateSessionWithoutRefresh(normalizedTokens);
        return;
      }

      this.clearStaleBearerSession('stored bearer session has no refresh token');
      return;
    }

    const normalizedTokens = this.normalizeTokens({
      ...session.tokens,
      refreshToken
    });
    this.applySession(normalizedTokens, session.user, fromLocalStorage);
    this.persistSession(normalizedTokens, session.user, fromLocalStorage);
  }

  private clearCookieAuthIfBearerSession(): void {
    const liveToken = this.tokens()?.accessToken;
    const storedToken = this.readStoredSession()?.session?.tokens?.accessToken;
    const serviceToken = this.tokenStore.getToken();
    if (!liveToken && !storedToken && !serviceToken) {
      return;
    }
    // Clear stale cookie-auth flag so bearer tokens are sent.
    this.setCookieAuthEnabled(false);
  }

  private enforceCookieAuthMigration(): void {
    const environmentCookieAuth =
      (environment.security as { useCookieAuth?: boolean } | undefined)?.useCookieAuth === true;
    if (!environmentCookieAuth) {
      return;
    }

    const storedSession = this.readStoredSession()?.session;
    const storedAccessToken = storedSession?.tokens?.accessToken?.trim();
    const hasLegacyBearerSession =
      !!storedAccessToken &&
      storedAccessToken !== COOKIE_AUTH_SESSION_TOKEN &&
      storedSession?.authMode !== 'cookie';

    if (!hasLegacyBearerSession) {
      return;
    }

    this.debugLog('[Auth] Clearing legacy bearer session storage to enforce cookie-auth.');
    this.clearStoredSession();
    this.tokens.set(null);
    this.user.set(null);
    this.tokenStore.clear();
    this.permissionService.clear();
  }

  private shouldAutoLoginMockUser(): boolean {
    return environment.useMockAuth && !!environment.autoLoginMockUser && !this.tokens();
  }

  private bootstrapMockSession(): void {
    const mock = environment.mockAuthUser || {};
    const expiresInHours = environment.security?.tokenExpirationHours ?? 1;
    const tokens: Tokens = {
      accessToken: `AUTO_DEMO_${Math.random().toString(36).slice(2)}`,
      expiresAt: Date.now() + expiresInHours * 60 * 60 * 1000
    };
    const user: User = {
      id: mock.id ?? 'auto-mock',
      name: mock.name ?? 'ENGINEERS_SALARY_REFERENCE Demo',
      email: mock.email ?? 'demo@engineers-salary-reference.app',
      roles: Array.isArray(mock.roles) && mock.roles.length ? mock.roles : ['User'],
      permissions: Array.isArray(mock.permissions) ? mock.permissions : []
    };
    this.applySession(tokens, user);
    this.persistSession(tokens, user, !!mock.remember);
  }

  private clearStoredSession(): void {
    this.getStorage('session')?.removeItem(AUTH_SESSION_STORAGE_KEY);
    this.getStorage('local')?.removeItem(AUTH_SESSION_STORAGE_KEY);
    this.setCookieAuthEnabled(false);

    // Also clear refresh tokens via TokenRefreshService
    this.tokenRefreshService.clearTokens();
  }

  private clearRuntimeCaches(): void {
    clearHttpResponseCache();
    this.queryCache.clear();
    this.injector.get(ApiService).clear();
  }

  private resetLocalAuthState(): void {
    this.clearSessionExpiryTimer();
    this.tokens.set(null);
    this.user.set(null);
    this.tokenStore.clear();
    this.permissionService.clear();
    this.clearStoredSession();
    this.clearRuntimeCaches();
  }

  private resolveLogoutReturnUrl(): string | null {
    return normalizeReturnUrlPath(this.router.url);
  }

  /**
   * Detect and remove old sessions that do not have a refresh token.
   */
  private cleanupOldSessionsWithoutRefreshToken(): void {
    if (this.isCookieAuthEnabled()) {
      return;
    }

    // Check if we have a session but no refresh token
    const hasSession = !!this.tokens();
    const hasRefreshToken = !!this.tokenRefreshService.getRefreshToken();

    if (hasSession && !hasRefreshToken) {
      const currentTokens = this.tokens();
      if (this.hasValidAccessToken(currentTokens)) {
        this.debugLog(
          '[Auth] Session cleanup detected missing refresh token, but the access token is still valid. Preserving session until expiry.'
        );
        if (typeof currentTokens?.expiresAt === 'number') {
          this.scheduleSessionExpiry(currentTokens.expiresAt);
        }
        this.tryRehydrateSessionWithoutRefresh(currentTokens);
        return;
      }

      this.clearStaleBearerSession('session cleanup detected missing refresh token');
    } else if (hasSession && hasRefreshToken) {
      this.debugLog('[Auth] Session has refresh token.');
    }
  }

  private resolveStoredRefreshToken(session?: StoredSession | Tokens | null): string | undefined {
    const sessionRefreshToken =
      session && 'tokens' in session
        ? session.tokens?.refreshToken?.trim()
        : session?.refreshToken?.trim();
    if (sessionRefreshToken) {
      return sessionRefreshToken;
    }

    const storedRefreshToken = this.tokenRefreshService.getRefreshToken()?.trim();
    return storedRefreshToken || undefined;
  }

  private clearStaleBearerSession(reason: string): void {
    this.debugLog(`[Auth] Clearing stale bearer session: ${reason}`);
    this.resetLocalAuthState();
  }

  /**
   * Notify other tabs/windows to logout using a shared localStorage key.
   */
  private broadcastLogout(): void {
    const storage = this.getStorage('local');
    if (!storage) {
      return;
    }
    try {
      storage.setItem(
        AUTH_BROADCAST_KEY,
        `logout:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
      );
    } catch {
      // Ignore storage write errors (disabled storage, quota issues, etc.)
    }
  }

  private readStoredSession(): { session: StoredSession; fromLocalStorage: boolean } | null {
    const storages: Array<{ storage: Storage | null; isLocal: boolean }> = [
      { storage: this.getStorage('session'), isLocal: false },
      { storage: this.getStorage('local'), isLocal: true }
    ];

    for (const { storage, isLocal } of storages) {
      if (!storage) continue;
      const raw = storage.getItem(AUTH_SESSION_STORAGE_KEY);
      if (!raw) continue;

      const parsed = this.safeParse(raw);
      if (!parsed) {
        storage.removeItem(AUTH_SESSION_STORAGE_KEY);
        continue;
      }

      const expiry = normalizeExpiresAt(parsed.tokens.expiresAt);
      if (typeof expiry === 'number' && Number.isFinite(expiry) && expiry <= Date.now()) {
        storage.removeItem(AUTH_SESSION_STORAGE_KEY);
        continue;
      }

      return { session: parsed, fromLocalStorage: isLocal };
    }

    return null;
  }

  private safeParse(raw: string): StoredSession | null {
    try {
      const parsed = JSON.parse(raw) as LooseValue;
      const session = this.unwrapStoredSession(parsed);
      const tokenRecord = session?.tokens ?? session?.token ?? parsed?.tokens ?? parsed?.token;
      const token =
        (typeof tokenRecord === 'string' ? tokenRecord : undefined) ??
        (tokenRecord && typeof tokenRecord === 'object'
          ? (((tokenRecord as Record<string, unknown>)?.accessToken as string | undefined) ??
            ((tokenRecord as Record<string, unknown>)?.access_token as string | undefined) ??
            ((tokenRecord as Record<string, unknown>)?.token as string | undefined))
          : undefined);
      const tokenFallback =
        (typeof session?.accessToken === 'string' ? session.accessToken : undefined) ??
        (typeof session?.access_token === 'string' ? session.access_token : undefined);
      if (typeof token !== 'string' || !token.trim()) {
        if (!tokenFallback || !tokenFallback.trim()) {
          return null;
        }
      }
      const resolvedToken = tokenFallback?.trim() || token;
      const user = normalizeStoredUser(session?.user ?? parsed?.user, resolvedToken);
      if (!user) {
        return null;
      }
      const recordObject =
        tokenRecord && typeof tokenRecord === 'object'
          ? (tokenRecord as Record<string, unknown>)
          : undefined;
      const expiresAt =
        normalizeExpiresAt(
          recordObject?.expiresAt ??
            recordObject?.expires_at ??
            session?.expiresAt ??
            session?.expires_at
        ) ?? Date.now() + (environment.security?.tokenExpirationHours ?? 1) * 60 * 60 * 1000;
      const normalizedTokens: Tokens = {
        accessToken: resolvedToken,
        refreshToken:
          (recordObject?.refreshToken as string | undefined) ??
          (recordObject?.refresh_token as string | undefined) ??
          (session?.refreshToken as string | undefined) ??
          (session?.refresh_token as string | undefined),
        expiresAt
      };
      if (isLikelyRefreshToken(normalizedTokens.accessToken, normalizedTokens.refreshToken)) {
        return null;
      }
      const authMode =
        parsed?.authMode === 'cookie' || session?.authMode === 'cookie' ? 'cookie' : 'bearer';
      return { tokens: normalizedTokens, user, authMode };
    } catch {
      return null;
    }
  }

  private unwrapStoredSession(raw: LooseValue): LooseValue {
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

  private normalizeTokens(tokens: Tokens): Tokens {
    const now = Date.now();
    const normalizedExpiry = normalizeExpiresAt(tokens.expiresAt);
    const tokenExpiry = extractTokenExpiry(tokens.accessToken);
    const preferredExpiry = tokenExpiry ?? normalizedExpiry;
    if (preferredExpiry != null) {
      return { ...tokens, expiresAt: preferredExpiry };
    }
    const fallbackHours = environment.security?.tokenExpirationHours ?? 1;
    return {
      ...tokens,
      expiresAt: now + fallbackHours * 60 * 60 * 1000
    };
  }

  private assertStrongPassword(password: string, emptyMessage: string): void {
    if (!password) {
      throw new Error(emptyMessage);
    }
    if (password.length < 10) {
      throw new Error('Password must be at least 10 characters');
    }
    if (!/[a-z]/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter');
    }
    if (!/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }
    if (!/[0-9]/.test(password)) {
      throw new Error('Password must contain at least one number');
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      throw new Error('Password must contain at least one special character');
    }
  }

  private setCookieAuthEnabled(enabled: boolean): void {
    setCookieAuthStorageFlag(enabled);
  }

  private isCookieAuthEnabled(): boolean {
    return resolveAuthRuntimeOptions().useCookieAuth;
  }

  private async initializeSessionInternal(): Promise<void> {
    if (environment.useMockAuth) {
      return;
    }

    if (this.isCookieAuthEnabled()) {
      return;
    }

    const currentTokens = this.tokens();
    const refreshToken = this.tokenRefreshService.getRefreshToken();
    if (!currentTokens?.accessToken) {
      return;
    }

    if (!refreshToken) {
      if (this.hasValidAccessToken(currentTokens)) {
        this.tryRehydrateSessionWithoutRefresh(currentTokens);
      }
      return;
    }

    try {
      // Revalidate restored bearer sessions before feature pages fire parallel bootstrap requests.
      const refreshedTokens = await firstValueFrom(this.tokenRefreshService.refreshToken());
      this.applyRefreshedTokens(refreshedTokens);
    } catch (error) {
      const currentAccessExpiry = extractTokenExpiry(currentTokens.accessToken);
      if (typeof currentAccessExpiry === 'number' && currentAccessExpiry > Date.now()) {
        this.debugLog(
          '[Auth] Startup refresh failed, but the restored access token is still valid. Preserving session.',
          error
        );
        this.scheduleSessionExpiry(currentAccessExpiry);
        return;
      }
      if (this.isTransientSessionFailure(error)) {
        this.debugLog(
          '[Auth] Startup token revalidation failed transiently; keeping restored session.',
          error
        );
        return;
      }
      this.debugLog('[Auth] Startup token revalidation failed; clearing stale session.', error);
      this.logout(true, 'refresh-failed');
    }
  }

  private isTransientSessionFailure(error: LooseValue): boolean {
    if (error?.isRefreshTokenExpired) {
      return false;
    }

    const status = Number(
      error?.status ?? error?.originalError?.status ?? error?.error?.status ?? Number.NaN
    );

    if (!Number.isFinite(status)) {
      return true;
    }

    return status === 0 || status === 408 || status === 429 || status >= 500;
  }
}
