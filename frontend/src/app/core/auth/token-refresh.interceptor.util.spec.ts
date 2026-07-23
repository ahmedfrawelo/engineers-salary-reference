import { describe, expect, it } from 'vitest';

import {
  isExplicitPermissionLikeUnauthorizedError,
  isInvalidTokenUnauthorizedError,
  isSessionProbablyStillActive,
  isPermissionLikeUnauthorizedRequest,
  isTransientRefreshFailure,
  normalizeAuthExpiry
} from './token-refresh.interceptor.util';

describe('token-refresh interceptor permission guard', () => {
  it('detects explicit permission-like 401 messages', () => {
    expect(
      isExplicitPermissionLikeUnauthorizedError({
        status: 401,
        message: 'Access denied to this resource'
      })
    ).toBe(true);
  });

  it('treats permission-worded 401 responses as permission-like', () => {
    expect(
      isPermissionLikeUnauthorizedRequest(
        { method: 'GET', url: '/api/Projects' },
        { status: 401, message: 'Access denied to this resource' },
        Date.now(),
        Date.now() + 60_000
      )
    ).toBe(true);
  });

  it('does not suppress generic 401 reads for protected resources', () => {
    expect(
      isPermissionLikeUnauthorizedRequest(
        { method: 'GET', url: '/api/Owners' },
        { status: 401, statusText: 'Unauthorized' },
        Date.now(),
        Date.now() + 60_000
      )
    ).toBe(false);
  });

  it('treats invalid_token responses as real auth failures, not permission-like reads', () => {
    const error = {
      status: 401,
      headers: {
        get: (name: string) =>
          /www-authenticate/i.test(name) ? 'Bearer error="invalid_token"' : null
      }
    };
    expect(isInvalidTokenUnauthorizedError(error)).toBe(true);
    expect(
      isPermissionLikeUnauthorizedRequest(
        { method: 'GET', url: '/api/Projects' },
        error,
        Date.now(),
        Date.now() + 60_000
      )
    ).toBe(false);
  });

  it('does not suppress non-read 401 requests without a permission message', () => {
    expect(
      isPermissionLikeUnauthorizedRequest(
        { method: 'POST', url: '/api/Projects' },
        { status: 401, statusText: 'Unauthorized' },
        Date.now(),
        Date.now() + 60_000
      )
    ).toBe(false);
  });

  it('normalizes unix-second expiries', () => {
    const now = Date.now();
    const normalized = normalizeAuthExpiry(Math.floor(now / 1000) + 60);
    expect(typeof normalized).toBe('number');
    expect((normalized ?? 0) > now).toBe(true);
  });

  it('preserves session when only stored expiry is future', () => {
    expect(isSessionProbablyStillActive(Date.now() + 60_000, undefined, Date.now())).toBe(true);
  });

  it('treats explicitly expired access tokens as expired even if stored expiry is stale', () => {
    expect(isSessionProbablyStillActive(Date.now() + 60_000, Date.now() - 60_000, Date.now())).toBe(
      false
    );
  });

  it('avoids forced logout when expiry cannot be determined', () => {
    expect(isSessionProbablyStillActive(undefined, undefined, Date.now())).toBe(true);
  });

  it('treats network refresh failures as transient', () => {
    expect(isTransientRefreshFailure({ status: 0, message: 'Network error' })).toBe(true);
  });

  it('treats indeterminate refresh failures without a status as transient', () => {
    expect(isTransientRefreshFailure({ message: 'Stale refresh request' })).toBe(true);
  });

  it('does not treat explicitly expired refresh tokens as transient', () => {
    expect(
      isTransientRefreshFailure({
        status: 401,
        message: 'Refresh token expired',
        isRefreshTokenExpired: true
      } as unknown as { status: number; message: string; isRefreshTokenExpired: boolean })
    ).toBe(false);
  });
});
