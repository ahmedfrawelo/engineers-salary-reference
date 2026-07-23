import {
  COOKIE_AUTH_STORAGE_KEY,
  isCookieAuthEnabled,
  resolveAuthRuntimeOptions,
  setCookieAuthEnabled
} from './auth-runtime.util';

describe('auth-runtime.util', () => {
  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    delete (window as typeof window & { __ENGINEERS_SALARY_REFERENCE_RUNTIME_CONFIG__?: unknown })
      .__ENGINEERS_SALARY_REFERENCE_RUNTIME_CONFIG__;
  });

  it('defaults to bearer auth without credentials', () => {
    expect(isCookieAuthEnabled()).toBe(false);
    expect(resolveAuthRuntimeOptions()).toEqual({
      useCookieAuth: false,
      withCredentials: false
    });
  });

  it('enables cookie auth from storage and forces credentials', () => {
    sessionStorage.setItem(COOKIE_AUTH_STORAGE_KEY, '1');

    expect(isCookieAuthEnabled()).toBe(true);
    expect(resolveAuthRuntimeOptions()).toEqual({
      useCookieAuth: true,
      withCredentials: true
    });
  });

  it('writes and removes the cookie auth storage flag', () => {
    setCookieAuthEnabled(true);
    expect(sessionStorage.getItem(COOKIE_AUTH_STORAGE_KEY)).toBe('1');
    expect(localStorage.getItem(COOKIE_AUTH_STORAGE_KEY)).toBe('1');

    setCookieAuthEnabled(false);
    expect(sessionStorage.getItem(COOKIE_AUTH_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(COOKIE_AUTH_STORAGE_KEY)).toBeNull();
  });

  it('honors runtime credentials override even without cookie auth', () => {
    (window as typeof window & { __ENGINEERS_SALARY_REFERENCE_RUNTIME_CONFIG__?: unknown }).__ENGINEERS_SALARY_REFERENCE_RUNTIME_CONFIG__ = {
      withCredentials: true
    };

    expect(resolveAuthRuntimeOptions()).toEqual({
      useCookieAuth: false,
      withCredentials: true
    });
  });
});
