import { concat, type Observable } from 'rxjs';

import type { RestoreCandidate, UserRow } from '../user-access-control.types';

type ApiLike = {
  put(path: string, body: unknown): Observable<unknown>;
  post(path: string, body: unknown): Observable<unknown>;
};

type RoleTaskHost = {
  api: ApiLike;
  normalizeRoles(rawRoles: unknown): string[];
};

type ReloadCollectionsHost = {
  loadRoster(): void;
  loadDeletedRoster(): void;
};

export function buildUserAccessRoleUpdateTask(
  host: RoleTaskHost,
  user: UserRow,
  nextRole: string
): Observable<unknown> | null {
  const targetRole = nextRole.trim();
  if (!user.id || !targetRole) {
    return null;
  }

  const currentRoles = host.normalizeRoles(user.roles ?? user.role);
  // The single-role editors cannot safely represent multi-role memberships.
  // Refuse to mutate roles from that surface rather than risk stripping access.
  if (currentRoles.length > 1) {
    return null;
  }
  const rolesToRemove = currentRoles.filter(role => role && role !== targetRole);
  const needsAssign = !currentRoles.includes(targetRole);

  if (!rolesToRemove.length && !needsAssign) {
    return null;
  }

  return host.api.put('Roles/membership', {
    userId: user.id,
    roleNames: [targetRole]
  });
}

export function normalizeUserAccessEditableStatus(
  value: string | null | undefined,
  fallback: 'Active' | 'Suspended' | 'Invited'
): 'Active' | 'Suspended' | 'Invited' {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized === 'active') {
    return 'Active';
  }
  if (
    normalized === 'invited' ||
    normalized === 'pending' ||
    normalized === 'pending acceptance' ||
    normalized === 'invite_pending' ||
    normalized === 'invitation_pending'
  ) {
    return 'Invited';
  }
  if (normalized === 'suspended' || normalized === 'inactive' || normalized === 'blocked') {
    return 'Suspended';
  }
  return fallback;
}

export function formatUserAccessUserLabel(
  user: Pick<UserRow, 'name' | 'email'> | RestoreCandidate | null | undefined
): string {
  const name = user?.name?.trim();
  if (name) {
    return name;
  }
  const email = user?.email?.trim();
  if (email) {
    return email;
  }
  return 'User';
}

export function reloadUserAccessCollections(host: ReloadCollectionsHost): void {
  host.loadRoster();
  host.loadDeletedRoster();
}

export function buildUserAccessStatusTask(
  host: Pick<RoleTaskHost, 'api'>,
  userId: string | null | undefined,
  nextStatus: 'Active' | 'Suspended' | 'Invited',
  currentStatus?: 'Active' | 'Suspended' | 'Invited'
): Observable<unknown> | null {
  if (!userId) {
    return null;
  }

  if (currentStatus && currentStatus === nextStatus) {
    return null;
  }

  if (nextStatus === 'Invited') {
    return null;
  }

  const statusEndpoint = nextStatus === 'Active' ? 'activate' : 'deactivate';
  return host.api.put(`Users/${userId}/${statusEndpoint}`, {});
}

export function buildUserAccessRestoreTask(
  host: Pick<RoleTaskHost, 'api'>,
  userId: string | null | undefined,
  desiredStatus: 'Active' | 'Suspended' | 'Invited'
): Observable<unknown> | null {
  if (!userId) {
    return null;
  }

  const restoreTask = host.api.put(`Users/${userId}/restore`, {});
  const statusTask = buildUserAccessStatusTask(host, userId, desiredStatus, 'Invited');
  return statusTask ? concat(restoreTask, statusTask) : restoreTask;
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

export function toMessage(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}
