import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ReplaySubject, Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthTokenStoreService } from '../core/auth/auth.service';
import { PermissionService } from '../core/authorization/permission.service';
import { QueryCacheService } from '../core/cache/query-cache.service';
import { TokenRefreshService, TokenResponse } from '../core/auth/token-refresh.service';
import { ApiService } from '../infrastructure/http/api.service';
import { WebSocketService } from '@infrastructure/realtime/websocket.service';
import { ToastService } from '../shared/toast/toast.service';
import { AuthFacadeService } from './auth.service';
import { environment } from '../../environments/environment';

const originalSecurity = { ...environment.security };

const toBase64Url = (value: string): string =>
  btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

const createJwt = (expiresAtMs: number): string => {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = toBase64Url(JSON.stringify({ exp: Math.floor(expiresAtMs / 1000) }));
  return `${header}.${payload}.signature`;
};

describe('AuthFacadeService startup revalidation', () => {
  let tokenRefreshStub: {
    tokens$: ReplaySubject<TokenResponse | null>;
    getRefreshToken: ReturnType<typeof vi.fn>;
    refreshToken: ReturnType<typeof vi.fn>;
    rehydrateSession: ReturnType<typeof vi.fn>;
    clearTokens: ReturnType<typeof vi.fn>;
    setTokens: ReturnType<typeof vi.fn>;
  };
  let tokenStoreStub: {
    setToken: ReturnType<typeof vi.fn>;
    getToken: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };
  let routerStub: {
    url: string;
    navigate: ReturnType<typeof vi.fn>;
    navigateByUrl: ReturnType<typeof vi.fn>;
  };
  let toastStub: {
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  let websocketStub: {
    events: ReturnType<typeof vi.fn>;
  };
  let permissionServiceStub: {
    loadUserPermissions: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };
  let queryCacheStub: {
    clear: ReturnType<typeof vi.fn>;
  };
  let apiServiceStub: {
    clear: ReturnType<typeof vi.fn>;
  };
  let realtimeEvents$: Subject<unknown>;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    environment.security = {
      ...originalSecurity,
      useCookieAuth: false
    };
    realtimeEvents$ = new Subject();

    tokenRefreshStub = {
      tokens$: new ReplaySubject<TokenResponse | null>(1),
      getRefreshToken: vi.fn(() => 'stored-refresh-token'),
      refreshToken: vi.fn(() => throwError(() => new Error('refresh failed'))),
      rehydrateSession: vi.fn(() => throwError(() => new Error('rehydrate failed'))),
      clearTokens: vi.fn(),
      setTokens: vi.fn()
    };
    tokenStoreStub = {
      setToken: vi.fn(),
      getToken: vi.fn(() => undefined),
      clear: vi.fn()
    };
    routerStub = {
      url: '/tender/projects',
      navigate: vi.fn(() => Promise.resolve(true)),
      navigateByUrl: vi.fn(() => Promise.resolve(true))
    };
    toastStub = {
      info: vi.fn(),
      error: vi.fn()
    };
    websocketStub = {
      events: vi.fn(() => realtimeEvents$)
    };
    permissionServiceStub = {
      loadUserPermissions: vi.fn(),
      clear: vi.fn()
    };
    queryCacheStub = {
      clear: vi.fn()
    };
    apiServiceStub = {
      clear: vi.fn()
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthFacadeService,
        { provide: Router, useValue: routerStub },
        { provide: AuthTokenStoreService, useValue: tokenStoreStub },
        { provide: TokenRefreshService, useValue: tokenRefreshStub },
        { provide: ToastService, useValue: toastStub },
        { provide: PermissionService, useValue: permissionServiceStub },
        { provide: WebSocketService, useValue: websocketStub },
        { provide: QueryCacheService, useValue: queryCacheStub },
        { provide: ApiService, useValue: apiServiceStub }
      ]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    sessionStorage.clear();
    localStorage.clear();
    environment.security = { ...originalSecurity };
    realtimeEvents$.complete();
    vi.clearAllMocks();
  });

  it('keeps the restored bearer session when startup refresh is definitively rejected but access token is still valid', async () => {
    const accessToken = createJwt(Date.now() + 60 * 60 * 1000);
    sessionStorage.setItem(
      'engineers-salary-reference.portal.session',
      JSON.stringify({
        authMode: 'bearer',
        tokens: {
          accessToken,
          refreshToken: 'stored-refresh-token',
          expiresAt: Date.now() + 60 * 60 * 1000
        },
        user: {
          id: 'user-1',
          name: 'Test User',
          email: 'user@example.com',
          roles: ['User'],
          permissions: []
        }
      })
    );
    sessionStorage.setItem('engineers-salary-reference.portal.refresh', 'stored-refresh-token');

    tokenRefreshStub.refreshToken.mockReturnValue(
      throwError(() => ({ status: 401, isRefreshTokenExpired: true, message: 'refresh expired' }))
    );

    const service = TestBed.inject(AuthFacadeService);

    await service.initializeSession();

    expect(service.user()?.email).toBe('user@example.com');
    expect(service.tokens()?.accessToken).toBe(accessToken);
    expect(tokenStoreStub.clear).not.toHaveBeenCalled();
    expect(tokenRefreshStub.clearTokens).not.toHaveBeenCalled();
    expect(routerStub.navigate).not.toHaveBeenCalled();
  });

  it('keeps the restored bearer session when startup refresh succeeds', async () => {
    const accessToken = createJwt(Date.now() + 60 * 60 * 1000);
    const refreshedToken = createJwt(Date.now() + 2 * 60 * 60 * 1000);
    sessionStorage.setItem(
      'engineers-salary-reference.portal.session',
      JSON.stringify({
        authMode: 'bearer',
        tokens: {
          accessToken,
          refreshToken: 'stored-refresh-token',
          expiresAt: Date.now() + 60 * 60 * 1000
        },
        user: {
          id: 'user-1',
          name: 'Test User',
          email: 'user@example.com',
          roles: ['User'],
          permissions: []
        }
      })
    );
    sessionStorage.setItem('engineers-salary-reference.portal.refresh', 'stored-refresh-token');
    tokenRefreshStub.refreshToken.mockReturnValue(
      of({
        accessToken: refreshedToken,
        refreshToken: 'new-refresh-token',
        expiresAt: Date.now() + 2 * 60 * 60 * 1000
      })
    );

    const service = TestBed.inject(AuthFacadeService);

    await service.initializeSession();

    expect(service.user()?.email).toBe('user@example.com');
    expect(service.tokens()?.accessToken).toBe(refreshedToken);
    expect(tokenStoreStub.clear).not.toHaveBeenCalled();
    expect(tokenRefreshStub.clearTokens).not.toHaveBeenCalled();
    expect(routerStub.navigate).not.toHaveBeenCalled();
  });

  it('updates the in-memory user permissions when startup refresh returns a changed session payload', async () => {
    const accessToken = createJwt(Date.now() + 60 * 60 * 1000);
    const refreshedToken = createJwt(Date.now() + 2 * 60 * 60 * 1000);
    sessionStorage.setItem(
      'engineers-salary-reference.portal.session',
      JSON.stringify({
        authMode: 'bearer',
        tokens: {
          accessToken,
          refreshToken: 'stored-refresh-token',
          expiresAt: Date.now() + 60 * 60 * 1000
        },
        user: {
          id: 'user-1',
          name: 'Test User',
          email: 'user@example.com',
          roles: ['User'],
          permissions: ['account.profile.view']
        }
      })
    );
    sessionStorage.setItem('engineers-salary-reference.portal.refresh', 'stored-refresh-token');
    tokenRefreshStub.refreshToken.mockReturnValue(
      of({
        accessToken: refreshedToken,
        refreshToken: 'new-refresh-token',
        expiresAt: Date.now() + 2 * 60 * 60 * 1000,
        user: {
          id: 'user-1',
          name: 'Test User',
          email: 'user@example.com',
          roles: ['User'],
          permissions: ['settings.access_control.view', 'Permissions.Identity.ViewUsers']
        }
      })
    );

    const service = TestBed.inject(AuthFacadeService);

    await service.initializeSession();

    expect(service.user()?.permissions).toEqual([
      'settings.access_control.view',
      'Permissions.Identity.ViewUsers'
    ]);
    expect(permissionServiceStub.loadUserPermissions).toHaveBeenLastCalledWith({
      roles: ['User'],
      permissions: ['settings.access_control.view', 'Permissions.Identity.ViewUsers']
    });
  });

  it('refreshes the current session when a realtime permissions_changed event targets the signed-in user', async () => {
    const accessToken = createJwt(Date.now() + 60 * 60 * 1000);
    const refreshedToken = createJwt(Date.now() + 2 * 60 * 60 * 1000);
    sessionStorage.setItem(
      'engineers-salary-reference.portal.session',
      JSON.stringify({
        authMode: 'bearer',
        tokens: {
          accessToken,
          refreshToken: 'stored-refresh-token',
          expiresAt: Date.now() + 60 * 60 * 1000
        },
        user: {
          id: 'user-1',
          name: 'Test User',
          email: 'user@example.com',
          roles: ['User'],
          permissions: ['account.profile.view']
        }
      })
    );
    sessionStorage.setItem('engineers-salary-reference.portal.refresh', 'stored-refresh-token');
    tokenRefreshStub.refreshToken.mockReturnValue(
      of({
        accessToken: refreshedToken,
        refreshToken: 'new-refresh-token',
        expiresAt: Date.now() + 2 * 60 * 60 * 1000,
        user: {
          id: 'user-1',
          name: 'Test User',
          email: 'user@example.com',
          roles: ['User'],
          permissions: ['settings.access_control.view', 'Permissions.Identity.ViewUsers']
        }
      })
    );

    const service = TestBed.inject(AuthFacadeService);

    await new Promise(resolve => setTimeout(resolve, 0));
    realtimeEvents$.next({
      module: 'identity',
      entityName: 'user',
      action: 'permissions_changed',
      entityId: 'user-1',
      changedFields: [],
      channels: ['user:user-1']
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(tokenRefreshStub.refreshToken).toHaveBeenCalledTimes(1);
    expect(service.user()?.permissions).toEqual([
      'settings.access_control.view',
      'Permissions.Identity.ViewUsers'
    ]);
    expect(permissionServiceStub.loadUserPermissions).toHaveBeenLastCalledWith({
      roles: ['User'],
      permissions: ['settings.access_control.view', 'Permissions.Identity.ViewUsers']
    });
    expect(queryCacheStub.clear).toHaveBeenCalled();
    expect(apiServiceStub.clear).toHaveBeenCalled();
  });

  it('signs out the current user when a realtime session_revoked event targets the signed-in user', async () => {
    const accessToken = createJwt(Date.now() + 60 * 60 * 1000);
    sessionStorage.setItem(
      'engineers-salary-reference.portal.session',
      JSON.stringify({
        authMode: 'bearer',
        tokens: {
          accessToken,
          refreshToken: 'stored-refresh-token',
          expiresAt: Date.now() + 60 * 60 * 1000
        },
        user: {
          id: 'user-1',
          name: 'Test User',
          email: 'user@example.com',
          roles: ['User'],
          permissions: ['account.profile.view']
        }
      })
    );
    sessionStorage.setItem('engineers-salary-reference.portal.refresh', 'stored-refresh-token');

    const service = TestBed.inject(AuthFacadeService);

    await new Promise(resolve => setTimeout(resolve, 0));
    realtimeEvents$.next({
      module: 'identity',
      entityName: 'user',
      action: 'session_revoked',
      entityId: 'user-1',
      changedFields: ['sessions'],
      channels: ['user:user-1']
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(tokenRefreshStub.refreshToken).not.toHaveBeenCalled();
    expect(service.user()).toBeNull();
    expect(service.tokens()).toBeNull();
    expect(routerStub.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/tender/projects' }
    });
    expect(toastStub.info).toHaveBeenCalledWith('Your session was ended. Please sign in again.', 6000);
  });

  it('keeps the restored bearer session when startup refresh fails transiently', async () => {
    const accessToken = createJwt(Date.now() + 60 * 60 * 1000);
    sessionStorage.setItem(
      'engineers-salary-reference.portal.session',
      JSON.stringify({
        authMode: 'bearer',
        tokens: {
          accessToken,
          refreshToken: 'stored-refresh-token',
          expiresAt: Date.now() + 60 * 60 * 1000
        },
        user: {
          id: 'user-1',
          name: 'Test User',
          email: 'user@example.com',
          roles: ['User'],
          permissions: []
        }
      })
    );
    sessionStorage.setItem('engineers-salary-reference.portal.refresh', 'stored-refresh-token');
    tokenRefreshStub.refreshToken.mockReturnValue(
      throwError(() => ({ status: 0, message: 'Network error' }))
    );

    const service = TestBed.inject(AuthFacadeService);

    await service.initializeSession();

    expect(service.user()?.email).toBe('user@example.com');
    expect(service.tokens()?.accessToken).toBe(accessToken);
    expect(tokenStoreStub.clear).not.toHaveBeenCalled();
    expect(tokenRefreshStub.clearTokens).not.toHaveBeenCalled();
    expect(routerStub.navigate).not.toHaveBeenCalled();
  });

  it('does not nest login return urls when logging out from an auth route with query params', () => {
    routerStub.url = '/login?returnUrl=%2Fdashboard';

    const service = TestBed.inject(AuthFacadeService);

    service.logout(false, 'expired');

    expect(routerStub.navigate).not.toHaveBeenCalled();
    expect(routerStub.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('treats a bearer session with a refresh token as recoverable during guard checks', async () => {
    const accessToken = createJwt(Date.now() + 60 * 60 * 1000);
    sessionStorage.setItem(
      'engineers-salary-reference.portal.session',
      JSON.stringify({
        authMode: 'bearer',
        tokens: {
          accessToken,
          refreshToken: 'stored-refresh-token',
          expiresAt: Date.now() + 60 * 60 * 1000
        },
        user: {
          id: 'user-1',
          name: 'Test User',
          email: 'user@example.com',
          roles: ['User'],
          permissions: []
        }
      })
    );
    sessionStorage.setItem('engineers-salary-reference.portal.refresh', 'stored-refresh-token');

    const service = TestBed.inject(AuthFacadeService);

    await expect(service.ensureAuthenticated()).resolves.toBe(true);
    expect(routerStub.navigate).not.toHaveBeenCalled();
  });

  it('keeps restored bearer sessions that have no refresh token while the access token is still valid', () => {
    tokenRefreshStub.getRefreshToken.mockReturnValue(null);
    const accessToken = createJwt(Date.now() + 60 * 60 * 1000);
    sessionStorage.setItem(
      'engineers-salary-reference.portal.session',
      JSON.stringify({
        authMode: 'bearer',
        tokens: {
          accessToken,
          expiresAt: Date.now() + 60 * 60 * 1000
        },
        user: {
          id: 'user-1',
          name: 'Test User',
          email: 'user@example.com',
          roles: ['User'],
          permissions: []
        }
      })
    );

    const service = TestBed.inject(AuthFacadeService);

    expect(service.isAuthenticated()).toBe(true);
    expect(service.tokens()?.accessToken).toBe(accessToken);
    expect(service.user()?.email).toBe('user@example.com');
    expect(sessionStorage.getItem('engineers-salary-reference.portal.session')).not.toBeNull();
    expect(tokenStoreStub.clear).not.toHaveBeenCalled();
    expect(tokenRefreshStub.clearTokens).not.toHaveBeenCalled();
  });

  it('re-hydrates a stored bearer session without a refresh token when in-memory auth state was lost but the access token is still valid', () => {
    tokenRefreshStub.getRefreshToken.mockReturnValue(null);
    const accessToken = createJwt(Date.now() + 60 * 60 * 1000);
    sessionStorage.setItem(
      'engineers-salary-reference.portal.session',
      JSON.stringify({
        authMode: 'bearer',
        tokens: {
          accessToken,
          expiresAt: Date.now() + 60 * 60 * 1000
        },
        user: {
          id: 'user-1',
          name: 'Test User',
          email: 'user@example.com',
          roles: ['User'],
          permissions: []
        }
      })
    );

    const service = TestBed.inject(AuthFacadeService);

    service.tokens.set(null);
    service.user.set(null);

    expect(service.isAuthenticated()).toBe(true);
    expect(service.tokens()?.accessToken).toBe(accessToken);
    expect(service.user()?.email).toBe('user@example.com');
    expect(tokenStoreStub.setToken).toHaveBeenCalledWith(accessToken);
    expect(tokenStoreStub.clear).not.toHaveBeenCalled();
    expect(tokenRefreshStub.clearTokens).not.toHaveBeenCalled();
  });

  it('does not broadcast logout to other tabs when the session expires automatically', () => {
    const service = TestBed.inject(AuthFacadeService);
    const localStorageSpy = vi.spyOn(window.localStorage, 'setItem');

    service.logout(true, 'refresh-failed');

    expect(localStorageSpy).not.toHaveBeenCalledWith(
      'engineers-salary-reference.broadcast',
      expect.stringContaining('logout:')
    );
  });

  it('shows the automatic session-expired logout notification only once', () => {
    const service = TestBed.inject(AuthFacadeService);

    service.logout(false, 'expired');
    service.logout(false, 'refresh-failed');

    expect(toastStub.info).toHaveBeenCalledTimes(1);
    expect(toastStub.info).toHaveBeenCalledWith('Session expired. Please sign in again.', 6000);
    expect(routerStub.navigate).toHaveBeenCalledTimes(1);
  });

  it('does not revive a terminated session from a stale refresh response', () => {
    const service = TestBed.inject(AuthFacadeService);
    const refreshedToken = createJwt(Date.now() + 60 * 60 * 1000);

    service.logout(false, 'refresh-failed');
    tokenRefreshStub.tokens$.next({
      accessToken: refreshedToken,
      refreshToken: 'late-refresh-token',
      expiresAt: Date.now() + 60 * 60 * 1000,
      user: {
        id: 'user-1',
        name: 'Test User',
        email: 'user@example.com',
        roles: ['User'],
        permissions: []
      }
    });

    expect(service.user()).toBeNull();
    expect(service.tokens()).toBeNull();
    expect(tokenStoreStub.setToken).not.toHaveBeenCalledWith(refreshedToken);
  });
});
