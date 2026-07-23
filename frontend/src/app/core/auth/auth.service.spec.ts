import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [AuthService]
    });
    service = TestBed.inject(AuthService);
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should set and get token from memory', () => {
    service.setToken('test-token-123');
    expect(service.getToken()).toBe('test-token-123');
  });

  it('should clear token from memory', () => {
    service.setToken('test-token');
    service.clear();
    expect(service.getToken()).toBeUndefined();
  });

  it('should restore a valid token from sessionStorage', () => {
    sessionStorage.setItem(
      'engineers-salary-reference.portal.session',
      JSON.stringify({
        tokens: {
          accessToken: 'restored-token-123',
          expiresAt: Date.now() + 60_000
        }
      })
    );

    const restored = new AuthService();
    expect(restored.getToken()).toBe('restored-token-123');
  });

  it('should ignore expired tokens', () => {
    sessionStorage.setItem(
      'engineers-salary-reference.portal.session',
      JSON.stringify({
        tokens: {
          accessToken: 'expired-token-123',
          expiresAt: Date.now() - 60_000
        }
      })
    );

    const restored = new AuthService();
    expect(restored.getToken()).toBeUndefined();
  });

  it('should fallback to localStorage when sessionStorage is empty', () => {
    localStorage.setItem(
      'engineers-salary-reference.portal.session',
      JSON.stringify({
        tokens: {
          accessToken: 'local-token-123',
          expiresAt: Date.now() + 60_000
        }
      })
    );

    const restored = new AuthService();
    expect(restored.getToken()).toBe('local-token-123');
  });

  it('should handle invalid JSON in storage', () => {
    sessionStorage.setItem('engineers-salary-reference.portal.session', 'invalid-json{');
    const restored = new AuthService();
    expect(restored.getToken()).toBeUndefined();
  });

  it('should try reading storage when in-memory token is missing', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    service.clear();
    service.getToken();
    expect(getItemSpy).toHaveBeenCalled();
  });
});
