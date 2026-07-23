import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TokenRefreshService, TokenResponse } from './token-refresh.service';
import { environment } from '../../../environments/environment';

const toBase64Url = (value: string): string =>
  btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

const createJwt = (expiresAtMs: number): string => {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = toBase64Url(JSON.stringify({ exp: Math.floor(expiresAtMs / 1000) }));
  return `${header}.${payload}.signature`;
};

describe('TokenRefreshService', () => {
  let service: TokenRefreshService;
  let httpMock: HttpTestingController;

  const baseTokenResponse: TokenResponse = {
    accessToken: createJwt(Date.now() + 3600000),
    refreshToken: 'new-refresh-token-67890',
    expiresAt: Date.now() + 3600000,
    expiresIn: 3600
  };

  const refreshUrl = `${environment.API_BASE_URL.replace(/\/+$/, '')}/Auth/refresh`;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [TokenRefreshService]
    });

    service = TestBed.inject(TokenRefreshService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should persist refresh token alongside the active session in sessionStorage', () => {
    service.setTokens(baseTokenResponse, false);

    const storedSession = JSON.parse(sessionStorage.getItem('engineers-salary-reference.portal.session') ?? '{}');
    expect(storedSession.tokens?.refreshToken).toBe(baseTokenResponse.refreshToken);
    expect(sessionStorage.getItem('engineers-salary-reference.portal.refresh')).toBe(baseTokenResponse.refreshToken);
    expect(service.getRefreshToken()).toBe(baseTokenResponse.refreshToken);
  });

  it('should store remember-me bearer session in localStorage', () => {
    service.setTokens(baseTokenResponse, true);

    expect(sessionStorage.getItem('engineers-salary-reference.portal.session')).toBeNull();
    expect(sessionStorage.getItem('engineers-salary-reference.portal.refresh')).toBeNull();
    const storedSession = JSON.parse(localStorage.getItem('engineers-salary-reference.portal.session') ?? '{}');
    expect(storedSession.tokens?.refreshToken).toBe(baseTokenResponse.refreshToken);
    expect(localStorage.getItem('engineers-salary-reference.portal.refresh')).toBe(baseTokenResponse.refreshToken);
    expect(service.getRefreshToken()).toBe(baseTokenResponse.refreshToken);
  });

  it('should restore refresh token from the stored session after reload', () => {
    sessionStorage.setItem(
      'engineers-salary-reference.portal.session',
      JSON.stringify({
        tokens: {
          accessToken: baseTokenResponse.accessToken,
          refreshToken: 'stored-refresh-token',
          expiresAt: baseTokenResponse.expiresAt
        }
      })
    );
    const restored = TestBed.runInInjectionContext(() => new TokenRefreshService());
    expect(restored.getRefreshToken()).toBe('stored-refresh-token');
  });

  it('should still restore a legacy dedicated refresh token key on startup when a bearer session exists', () => {
    sessionStorage.setItem(
      'engineers-salary-reference.portal.session',
      JSON.stringify({
        tokens: {
          accessToken: baseTokenResponse.accessToken,
          expiresAt: baseTokenResponse.expiresAt
        }
      })
    );
    sessionStorage.setItem('engineers-salary-reference.portal.refresh', 'stored-refresh-token');
    const restored = TestBed.runInInjectionContext(() => new TokenRefreshService());
    expect(restored.getRefreshToken()).toBe('stored-refresh-token');
  });

  it('should drop an orphaned refresh token on startup when no bearer session exists', () => {
    sessionStorage.setItem('engineers-salary-reference.portal.refresh', 'stored-refresh-token');
    const restored = TestBed.runInInjectionContext(() => new TokenRefreshService());
    expect(restored.getRefreshToken()).toBeNull();
    expect(sessionStorage.getItem('engineers-salary-reference.portal.refresh')).toBeNull();
  });

  it('should sync the latest refresh token from shared browser storage before refreshing', async () => {
    service.setTokens(baseTokenResponse, true);

    const syncedRefreshToken = 'synced-refresh-token-from-another-tab';
    localStorage.setItem(
      'engineers-salary-reference.portal.session',
      JSON.stringify({
        tokens: {
          accessToken: baseTokenResponse.accessToken,
          refreshToken: syncedRefreshToken,
          expiresAt: baseTokenResponse.expiresAt
        }
      })
    );
    localStorage.setItem('engineers-salary-reference.portal.refresh', syncedRefreshToken);

    const refreshPromise = firstValueFrom(service.refreshToken());

    const req = httpMock.expectOne(refreshUrl);
    expect(req.request.body).toEqual({
      refreshToken: syncedRefreshToken,
      refresh_token: syncedRefreshToken
    });
    req.flush(baseTokenResponse);

    await expect(refreshPromise).resolves.toMatchObject({
      accessToken: baseTokenResponse.accessToken
    });
    expect(service.getRefreshToken()).toBe(baseTokenResponse.refreshToken);
  });

  it('should call refresh endpoint and update stored tokens', async () => {
    service.setTokens(baseTokenResponse, false);

    const newTokens: TokenResponse = {
      accessToken: createJwt(Date.now() + 7200000),
      refreshToken: 'refreshed-refresh-token',
      expiresAt: Date.now() + 7200000,
      expiresIn: 7200
    };

    const refreshPromise = firstValueFrom(service.refreshToken());

    const req = httpMock.expectOne(refreshUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      refreshToken: baseTokenResponse.refreshToken,
      refresh_token: baseTokenResponse.refreshToken
    });
    req.flush(newTokens);

    await expect(refreshPromise).resolves.toMatchObject(newTokens);
    expect(service.getRefreshToken()).toBe(newTokens.refreshToken);
  });

  it('should persist refreshed user metadata returned by bearer refresh responses', async () => {
    sessionStorage.setItem(
      'engineers-salary-reference.portal.session',
      JSON.stringify({
        authMode: 'bearer',
        user: {
          id: 'u1',
          name: 'Old User',
          email: 'old@example.com',
          roles: ['User'],
          permissions: ['account.profile.view']
        },
        tokens: {
          accessToken: baseTokenResponse.accessToken,
          refreshToken: baseTokenResponse.refreshToken,
          expiresAt: baseTokenResponse.expiresAt
        }
      })
    );
    sessionStorage.setItem('engineers-salary-reference.portal.refresh', baseTokenResponse.refreshToken ?? '');

    const refreshPromise = firstValueFrom(service.refreshToken());

    const req = httpMock.expectOne(refreshUrl);
    req.flush({
      data: {
        token: createJwt(Date.now() + 5400000),
        refreshToken: 'rotated-refresh-token',
        expiresAt: new Date(Date.now() + 5400000).toISOString(),
        userId: 'u1',
        email: 'new@example.com',
        fullName: 'New User',
        roles: ['Administrator'],
        permissions: ['settings.access_control.view']
      }
    });

    await expect(refreshPromise).resolves.toMatchObject({
      user: {
        email: 'new@example.com',
        roles: ['Administrator'],
        permissions: ['settings.access_control.view']
      }
    });

    const storedSession = JSON.parse(sessionStorage.getItem('engineers-salary-reference.portal.session') ?? '{}');
    expect(storedSession.user).toMatchObject({
      email: 'new@example.com',
      roles: ['Administrator'],
      permissions: ['settings.access_control.view']
    });
  });

  it('should return error when no refresh token is available', async () => {
    await expect(firstValueFrom(service.refreshToken())).rejects.toThrow(
      'No refresh token available'
    );
    httpMock.expectNone(refreshUrl);
  });

  it('should share a single refresh cycle across concurrent callers', async () => {
    service.setTokens(baseTokenResponse, false);

    const first = firstValueFrom(service.refreshToken());
    const second = firstValueFrom(service.refreshToken());

    const req = httpMock.expectOne(refreshUrl);
    req.flush(baseTokenResponse);
    httpMock.expectNone(refreshUrl);

    await expect(first).resolves.toMatchObject({
      accessToken: baseTokenResponse.accessToken
    });
    await expect(second).resolves.toMatchObject({
      accessToken: baseTokenResponse.accessToken
    });
  });

  it('should keep stored tokens on refresh failure', async () => {
    service.setTokens(baseTokenResponse, false);

    const refreshPromise = firstValueFrom(service.refreshToken());
    const firstReq = httpMock.expectOne(refreshUrl);
    firstReq.flush('Refresh failed', { status: 401, statusText: 'Unauthorized' });
    const retryReq = httpMock.expectOne(refreshUrl);
    retryReq.flush('Refresh failed', { status: 401, statusText: 'Unauthorized' });

    await expect(refreshPromise).rejects.toBeTruthy();
    expect(service.getRefreshToken()).toBe(baseTokenResponse.refreshToken);
    expect(sessionStorage.getItem('engineers-salary-reference.portal.session')).toBeTruthy();
  });

  it('should clear an in-memory refresh token after browser storage removal', () => {
    service.setTokens(baseTokenResponse, true);

    localStorage.removeItem('engineers-salary-reference.portal.refresh');
    localStorage.removeItem('engineers-salary-reference.portal.session');

    expect(service.getRefreshToken()).toBeNull();
  });

  it('should restore a full bearer session from a valid access token when refresh token is missing', async () => {
    localStorage.setItem(
      'engineers-salary-reference.portal.session',
      JSON.stringify({
        user: { id: 'u1', email: 'admin@engineers-salary-reference-sa.com', name: 'Admin' },
        tokens: {
          accessToken: baseTokenResponse.accessToken,
          expiresAt: baseTokenResponse.expiresAt
        }
      })
    );

    const restorePromise = firstValueFrom(service.rehydrateSession());

    const req = httpMock.expectOne(
      `${environment.API_BASE_URL.replace(/\/+$/, '')}/Auth/restore-session`
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Authorization')).toMatch(/^Bearer /);
    req.flush(baseTokenResponse);

    await expect(restorePromise).resolves.toMatchObject({
      accessToken: baseTokenResponse.accessToken,
      refreshToken: baseTokenResponse.refreshToken
    });

    const storedSession = JSON.parse(localStorage.getItem('engineers-salary-reference.portal.session') ?? '{}');
    expect(storedSession.tokens?.refreshToken).toBe(baseTokenResponse.refreshToken);
    expect(localStorage.getItem('engineers-salary-reference.portal.refresh')).toBe(baseTokenResponse.refreshToken);
  });

  it('should refresh cookie-auth sessions without a browser-stored refresh token', async () => {
    sessionStorage.setItem(
      'engineers-salary-reference.portal.session',
      JSON.stringify({
        authMode: 'cookie',
        user: {
          id: 'u1',
          name: 'Cookie User',
          email: 'cookie@example.com',
          roles: ['User'],
          permissions: ['account.profile.view']
        },
        tokens: {
          accessToken: '__COOKIE_AUTH__',
          expiresAt: Date.now() + 3600000
        }
      })
    );

    const refreshPromise = firstValueFrom(service.refreshToken());

    const req = httpMock.expectOne(refreshUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    expect(req.request.headers.get('X-Auth-Mode')).toBe('cookie');
    req.flush({
      data: {
        authMode: 'cookie',
        userId: 'u1',
        email: 'cookie@example.com',
        fullName: 'Cookie User',
        roles: ['User'],
        permissions: ['settings.access_control.view'],
        expiresAt: new Date(Date.now() + 5400000).toISOString()
      }
    });

    await expect(refreshPromise).resolves.toMatchObject({
      authMode: 'cookie',
      user: {
        permissions: ['settings.access_control.view']
      }
    });

    const storedSession = JSON.parse(sessionStorage.getItem('engineers-salary-reference.portal.session') ?? '{}');
    expect(storedSession.authMode).toBe('cookie');
    expect(storedSession.user.permissions).toEqual(['settings.access_control.view']);
    expect(sessionStorage.getItem('engineers-salary-reference.portal.refresh')).toBeNull();
  });
});
