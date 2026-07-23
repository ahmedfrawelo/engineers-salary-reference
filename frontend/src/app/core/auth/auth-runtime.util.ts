import { environment } from '../../../environments/environment';
import { runtimeConfig } from '../runtime-config';

export const COOKIE_AUTH_STORAGE_KEY = 'engineers-salary-reference.portal.cookieAuth';
export const COOKIE_AUTH_SESSION_TOKEN = '__COOKIE_AUTH__';
const AUTH_SESSION_STORAGE_KEY = 'engineers-salary-reference.portal.session';

type LooseValue = ReturnType<typeof JSON.parse>;

export type AuthRuntimeOptions = Readonly<{
  useCookieAuth: boolean;
  withCredentials: boolean;
}>;

const getStorage = (type: 'local' | 'session'): Storage | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return type === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
};

const hasStoredBearerSession = (): boolean => {
  const storages = [getStorage('session'), getStorage('local')];

  for (const storage of storages) {
    if (!storage) {
      continue;
    }

    try {
      const raw = storage.getItem(AUTH_SESSION_STORAGE_KEY);
      if (!raw) {
        continue;
      }
      const parsed = JSON.parse(raw) as LooseValue;
      const session =
        parsed?.data?.session ??
        parsed?.data ??
        parsed?.payload?.session ??
        parsed?.payload ??
        parsed?.result?.session ??
        parsed?.result ??
        parsed?.session ??
        parsed;
      const authMode =
        session?.authMode === 'cookie' || parsed?.authMode === 'cookie' ? 'cookie' : 'bearer';
      const accessToken =
        session?.tokens?.accessToken ??
        session?.tokens?.access_token ??
        session?.accessToken ??
        session?.access_token ??
        parsed?.tokens?.accessToken ??
        parsed?.tokens?.access_token ??
        parsed?.accessToken ??
        parsed?.access_token;
      if (
        authMode === 'bearer' &&
        typeof accessToken === 'string' &&
        accessToken.trim() &&
        accessToken !== COOKIE_AUTH_SESSION_TOKEN
      ) {
        return true;
      }
    } catch {
      // Ignore malformed storage payloads and keep checking.
    }
  }

  return false;
};

const hasCookieAuthFlag = (): boolean => {
  const storages = [getStorage('session'), getStorage('local')];

  for (const storage of storages) {
    try {
      if (storage?.getItem(COOKIE_AUTH_STORAGE_KEY) === '1') {
        return true;
      }
    } catch {
      // Ignore storage failures and keep checking other auth signals.
    }
  }

  return false;
};

export const isCookieAuthEnabled = (): boolean => {
  const runtime = runtimeConfig();
  const environmentCookieAuth =
    (environment.security as { useCookieAuth?: boolean } | undefined)?.useCookieAuth === true;
  if (hasStoredBearerSession()) {
    return false;
  }
  return runtime.useCookieAuth === true || environmentCookieAuth || hasCookieAuthFlag();
};

export const setCookieAuthEnabled = (enabled: boolean): void => {
  const session = getStorage('session');
  const local = getStorage('local');
  const value = enabled ? '1' : '';

  try {
    if (enabled) {
      session?.setItem(COOKIE_AUTH_STORAGE_KEY, value);
      local?.setItem(COOKIE_AUTH_STORAGE_KEY, value);
      return;
    }

    session?.removeItem(COOKIE_AUTH_STORAGE_KEY);
    local?.removeItem(COOKIE_AUTH_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
};

export const resolveAuthRuntimeOptions = (): AuthRuntimeOptions => {
  const runtime = runtimeConfig();
  const runtimeWithCredentials = runtime.withCredentials;
  const cookieAuth = isCookieAuthEnabled();
  const withCredentials =
    (typeof runtimeWithCredentials === 'boolean'
      ? runtimeWithCredentials
      : environment.http?.withCredentials) === true;

  return {
    useCookieAuth: cookieAuth,
    withCredentials: withCredentials || cookieAuth
  };
};

export const mergeRuntimeFeatureFlags = (
  flags: Record<string, boolean> | undefined,
  runtimeFlags: LooseValue
): Record<string, boolean> | undefined => {
  if (!runtimeFlags || typeof runtimeFlags !== 'object' || Array.isArray(runtimeFlags)) {
    return flags;
  }

  return {
    ...(flags ?? {}),
    ...(runtimeFlags as Record<string, boolean>)
  };
};
