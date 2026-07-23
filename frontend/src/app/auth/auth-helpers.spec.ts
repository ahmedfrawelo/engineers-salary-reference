import { describe, expect, it } from 'vitest';
import { normalizeReturnUrlPath, normalizeStoredUser, resolveSafeReturnUrl } from './auth-helpers';
import { PAGE_PERMISSION_GROUPS } from '../core/authorization/permission-registry';

const toBase64Url = (value: string): string =>
  btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

function createJwt(claims: Record<string, unknown>): string {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = toBase64Url(JSON.stringify(claims));
  return `${header}.${payload}.signature`;
}

const orderedPagePermissions = PAGE_PERMISSION_GROUPS.flatMap(group =>
  group.permissions.map(permission => permission.code)
).sort();

function encodePackedPagePermissions(permissions: string[]): string {
  return permissions
    .map(permission => orderedPagePermissions.indexOf(permission).toString(36))
    .join('.');
}

describe('normalizeStoredUser', () => {
  it('falls back to singular role and permission fields when array fields are absent', () => {
    const user = normalizeStoredUser(
      {
        id: '1',
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'Administrator',
        permission: 'Permissions.Identity.ManagePermissions'
      } as never,
      'not-a-jwt-token'
    );

    expect(user?.roles).toEqual(['Administrator']);
    expect(user?.permissions).toEqual(['Permissions.Identity.ManagePermissions']);
  });

  it('prefers jwt role and permission claims when available', () => {
    const token = createJwt({
      role: 'Admin',
      permission: 'Permissions.Identity.ManageRoles'
    });

    const user = normalizeStoredUser(
      {
        id: '1',
        name: 'Fallback User',
        email: 'fallback@example.com',
        role: 'User'
      } as never,
      token
    );

    expect(user?.roles).toEqual(['Admin']);
    expect(user?.permissions).toEqual(['Permissions.Identity.ManageRoles']);
  });

  it('decodes packed page-permission claims from refreshed jwt tokens', () => {
    const token = createJwt({
      pp: encodePackedPagePermissions(['salary.reports.edit', 'settings.access_control.view'])
    });

    const user = normalizeStoredUser(
      {
        id: '1',
        name: 'Fallback User',
        email: 'fallback@example.com',
        permissions: ['account.profile.view']
      },
      token
    );

    expect(user?.permissions).toEqual(['salary.reports.edit', 'settings.access_control.view']);
  });
});

describe('normalizeReturnUrlPath', () => {
  it('rejects auth routes even when they carry nested query params', () => {
    expect(normalizeReturnUrlPath('/login?returnUrl=%2Fdashboard')).toBeNull();
    expect(normalizeReturnUrlPath('/signup?returnUrl=%2Fdashboard')).toBeNull();
  });

  it('keeps non-auth application routes with query strings intact', () => {
    expect(normalizeReturnUrlPath('/tender/projects?tab=overview')).toBe(
      '/tender/projects?tab=overview'
    );
  });
});

describe('resolveSafeReturnUrl', () => {
  it('falls back to the dashboard when the return url points back to login', () => {
    expect(resolveSafeReturnUrl('/login?returnUrl=%2Flogin')).toBe('/dashboard');
  });
});
