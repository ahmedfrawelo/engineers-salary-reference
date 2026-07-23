import { forkJoin, type Observable } from 'rxjs';
import type { UserRow } from '../user-access-control.types';
import {
  buildUserAccessRestoreTask,
  buildUserAccessRoleUpdateTask,
  buildUserAccessStatusTask,
  formatUserAccessUserLabel,
  normalizeUserAccessEditableStatus,
  reloadUserAccessCollections,
  type UserAccessMutationsHost
} from './user-access-control.mutations.helper';

export function resetUserAccessProfile(host: UserAccessMutationsHost): void {
  const defaultRole = host.roleOptions()[0] ?? 'User';
  host.profile = {
    name: '',
    email: '',
    password: '',
    status: 'Invited',
    role: defaultRole,
    department: '',
    position: '',
    phoneNumber: ''
  };
  host.error.set(null);
  host.restoreCandidate.set(null);
}

export function createUserAccessUser(host: UserAccessMutationsHost): void {
  const trimmedName = host.profile.name.trim();
  const trimmedEmail = host.profile.email.trim();
  const trimmedPassword = host.profile.password.trim();
  const trimmedRole = host.profile.role.trim() || host.roleOptions()[0] || 'User';
  const desiredStatus = normalizeEditableStatus(host.profile.status, 'Invited');
  host.restoreCandidate.set(null);

  if (!trimmedName) {
    host.error.set('Name is required');
    return;
  }
  if (!trimmedEmail) {
    host.error.set('Email is required');
    return;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    host.error.set('Invalid email format');
    return;
  }
  const normalizedEmail = trimmedEmail.toLowerCase();
  const emailExists = host
    .roster()
    .some(user => (user.email || '').trim().toLowerCase() === normalizedEmail);
  if (emailExists) {
    host.error.set('Email already exists');
    return;
  }
  if (!trimmedPassword) {
    host.error.set('Password is required');
    return;
  }
  if (trimmedPassword.length < 8) {
    host.error.set('Password must be at least 8 characters');
    return;
  }
  if (!/[A-Z]/.test(trimmedPassword)) {
    host.error.set('Password must include an uppercase letter');
    return;
  }
  if (!/[a-z]/.test(trimmedPassword)) {
    host.error.set('Password must include a lowercase letter');
    return;
  }
  if (!/[0-9]/.test(trimmedPassword)) {
    host.error.set('Password must include a number');
    return;
  }
  if (!host.requireRosterAuth()) {
    return;
  }

  host.saving.set(true);
  host.error.set(null);

  const trimmedPhone = (host.profile as { phoneNumber?: string }).phoneNumber?.trim() || null;
  const payload = {
    email: trimmedEmail,
    fullName: trimmedName,
    password: trimmedPassword,
    role: trimmedRole,
    phoneNumber: trimmedPhone || undefined
  };

  host.api.post('Users', payload).subscribe({
    next: (response: unknown) => {
      const record = host.asRecord(response);
      const data = host.asRecord(record?.data);
      const createdId = data?.userId || data?.id || record?.userId || record?.id;
      const createdLabel = trimmedName || trimmedEmail;

      const finalizeCreate = (): void => {
        resetUserAccessProfile(host);
        host.saving.set(false);
        reloadUserAccessCollections(host);

        if (createdId) {
          host.undoToast.created(
            `"${createdLabel}" created`,
            () => {
              host.api.delete(`Users/${createdId}`).subscribe({
                next: () => reloadUserAccessCollections(host),
                error: err => {
                  host.toast.error(host.formatRequestError(err, 'Unable to undo user creation'));
                  reloadUserAccessCollections(host);
                }
              });
            },
            {
              completionMessage: 'User removed.'
            }
          );
          return;
        }

        host.toast.success('User created.');
      };

      if (desiredStatus === 'Suspended' && createdId) {
        host.api.put(`Users/${createdId}/deactivate`, {}).subscribe({
          next: () => {
            finalizeCreate();
          },
          error: err => {
            console.error('[UserAccess] Failed to update new user status', err);
            host.error.set(host.formatRequestError(err, 'Failed to update user status'));
            host.saving.set(false);
          }
        });
        return;
      }

      finalizeCreate();
    },
    error: err => {
      console.error('[UserAccess] Failed to create user', err);
      if (host.isConflictError(err)) {
        host.findDeletedUserByEmail(trimmedEmail);
      } else {
        host.error.set(host.formatRequestError(err, 'Failed to create user'));
      }
      host.saving.set(false);
    }
  });
}

export function restoreUserAccessDeletedUser(host: UserAccessMutationsHost): void {
  const candidate = host.restoreCandidate();
  if (!candidate || host.restoring()) {
    return;
  }
  if (!host.requireRosterAuth('You need to sign in to restore users')) {
    return;
  }

  host.restoring.set(true);
  host.error.set(null);
  const desiredStatus = normalizeUserAccessEditableStatus(host.profile.status, 'Invited');
  const restoreTask = buildUserAccessRestoreTask(host, candidate.id, desiredStatus);
  if (!restoreTask) {
    host.restoring.set(false);
    host.error.set('User data is missing');
    return;
  }

  restoreTask.subscribe({
    complete: () => {
      host.restoring.set(false);
      host.restoreCandidate.set(null);
      resetUserAccessProfile(host);
      reloadUserAccessCollections(host);
      host.undoToast.updated(
        `"${formatUserAccessUserLabel(candidate)}" restored`,
        () => {
          host.api.delete(`Users/${candidate.id}`).subscribe({
            next: () => reloadUserAccessCollections(host),
            error: err => {
              host.toast.error(
                host.formatRequestError(err, 'Unable to move this user back to deleted')
              );
              reloadUserAccessCollections(host);
            }
          });
        },
        {
          completionMessage: 'User moved back to deleted.'
        }
      );
    },
    error: err => {
      host.restoring.set(false);
      host.error.set(host.formatRequestError(err, 'Failed to restore user'));
    }
  });
}

export function saveUserAccessUserEdits(host: UserAccessMutationsHost, user: UserRow): void {
  if (!user.id || !user.edit) {
    host.error.set('User data is missing');
    return;
  }

  const draft = user.edit;
  const trimmedName = draft.name.trim();
  const trimmedEmail = draft.email.trim();
  const trimmedRole = draft.role.trim();
  const trimmedPassword = draft.password.trim();
  const nextDepartment = draft.department.trim() || null;
  const nextPosition = draft.position.trim() || null;
  const nextPhone = draft.phoneNumber?.trim() || null;
  const currentStatus = normalizeEditableStatus(user.status, 'Suspended');
  const nextStatus = normalizeEditableStatus(draft.status, currentStatus);
  const currentRoles = host.normalizeRoles(user.roles ?? user.role);
  const currentRole = (currentRoles[0] || user.role || 'User').trim();
  const isMultiRoleUser = currentRoles.length > 1;

  if (!trimmedName) {
    host.error.set('Name is required');
    return;
  }
  if (!trimmedEmail) {
    host.error.set('Email is required');
    return;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    host.error.set('Invalid email format');
    return;
  }
  const normalizedEditEmail = trimmedEmail.toLowerCase();
  const emailTakenByAnother = host
    .roster()
    .some(
      u =>
        (u.id || u.email) !== (user.id || user.email) &&
        (u.email || '').trim().toLowerCase() === normalizedEditEmail
    );
  if (emailTakenByAnother) {
    host.error.set('This email is already used by another user');
    return;
  }
  if (isMultiRoleUser && trimmedRole !== currentRole) {
    host.error.set(
      'This user has multiple roles. Manage role membership from the Roles panel to preserve existing access.'
    );
    return;
  }
  if (!host.requireRosterAuth()) {
    return;
  }
  if (trimmedPassword && trimmedPassword.length < 8) {
    host.error.set('Password must be at least 8 characters');
    return;
  }
  if (trimmedPassword && !/[A-Z]/.test(trimmedPassword)) {
    host.error.set('Password must include an uppercase letter');
    return;
  }
  if (trimmedPassword && !/[a-z]/.test(trimmedPassword)) {
    host.error.set('Password must include a lowercase letter');
    return;
  }
  if (trimmedPassword && !/[0-9]/.test(trimmedPassword)) {
    host.error.set('Password must include a number');
    return;
  }

  host.saving.set(true);
  host.error.set(null);
  host.debugLog(`[UserAccess] Saving edits for ${user.email}`);

  const updates: Observable<unknown>[] = [];
  const rollbackTasks: Observable<unknown>[] = [];

  const emailChanged = trimmedEmail !== user.email;
  const profileChanged =
    trimmedName !== user.name ||
    (user.department ?? null) !== nextDepartment ||
    (user.position ?? null) !== nextPosition ||
    (user.phoneNumber ?? null) !== nextPhone ||
    emailChanged;

  if (profileChanged) {
    const payload: Record<string, unknown> = {
      userId: user.id,
      fullName: trimmedName,
      department: nextDepartment,
      position: nextPosition,
      phoneNumber: nextPhone
    };
    if (emailChanged) {
      payload.email = trimmedEmail;
    }
    updates.push(host.api.put(`Users/${user.id}`, payload));

    const rollbackPayload: Record<string, unknown> = {
      userId: user.id,
      fullName: user.name,
      department: user.department ?? null,
      position: user.position ?? null,
      phoneNumber: user.phoneNumber ?? null
    };
    if (emailChanged) {
      rollbackPayload.email = user.email;
    }
    rollbackTasks.push(host.api.put(`Users/${user.id}`, rollbackPayload));
  }

  if (nextStatus !== currentStatus && nextStatus !== 'Invited') {
    const statusEndpoint = nextStatus === 'Active' ? 'activate' : 'deactivate';
    updates.push(host.api.put(`Users/${user.id}/${statusEndpoint}`, {}));
    const rollbackStatusTask = buildUserAccessStatusTask(host, user.id, currentStatus, nextStatus);
    if (rollbackStatusTask) {
      rollbackTasks.push(rollbackStatusTask);
    }
  }

  const roleTask = buildUserAccessRoleUpdateTask(host, user, trimmedRole);
  if (roleTask) {
    updates.push(roleTask);
    const rollbackRoleTask = buildUserAccessRoleUpdateTask(
      host,
      { ...user, role: trimmedRole, roles: trimmedRole ? [trimmedRole] : user.roles },
      currentRole
    );
    if (rollbackRoleTask) {
      rollbackTasks.push(rollbackRoleTask);
    }
  }

  if (trimmedPassword) {
    updates.push(
      host.api.post('Password/reset', { userId: user.id, newPassword: trimmedPassword })
    );
  }

  if (!updates.length) {
    host.saving.set(false);
    return;
  }

  forkJoin(updates).subscribe({
    next: () => {
      const targetKey = user.id || user.email;
      const updatedRoster = host.roster().map(u => {
        const rowKey = u.id || u.email;
        if (rowKey !== targetKey) {
          return u;
        }
        const existingRoles = host.normalizeRoles(u.roles ?? u.role);
        const resolvedRoles =
          roleTask && trimmedRole
            ? [trimmedRole]
            : existingRoles.length
              ? existingRoles
              : trimmedRole
                ? [trimmedRole]
                : [];
        const resolvedRole = resolvedRoles[0] || trimmedRole || u.role || 'User';
        return {
          ...u,
          name: trimmedName,
          email: trimmedEmail,
          status: nextStatus,
          role: resolvedRole,
          roles: resolvedRoles.length ? resolvedRoles : u.roles,
          department: nextDepartment,
          position: nextPosition,
          phoneNumber: nextPhone,
          isEditing: true,
          edit: {
            name: trimmedName,
            email: trimmedEmail,
            status: nextStatus,
            role: resolvedRole,
            department: nextDepartment ?? '',
            position: nextPosition ?? '',
            phoneNumber: nextPhone ?? '',
            password: ''
          },
          isQuickEditing: false,
          quickEdit: undefined
        };
      });
      host.roster.set(updatedRoster);
      host.pruneSelection(updatedRoster);
      host.saving.set(false);

      const canUndoStatus = currentStatus === nextStatus || currentStatus !== 'Invited';
      if (!trimmedPassword && canUndoStatus && rollbackTasks.length) {
        host.undoToast.updated(
          `"${formatUserAccessUserLabel(user)}" updated`,
          () => {
            forkJoin(rollbackTasks).subscribe({
              next: () => reloadUserAccessCollections(host),
              error: err => {
                host.toast.error(host.formatRequestError(err, 'Unable to revert this user'));
                reloadUserAccessCollections(host);
              }
            });
          },
          {
            completionMessage: 'User changes reverted.'
          }
        );
        return;
      }

      host.toast.success(trimmedPassword ? 'User and password updated.' : 'User updated.');
    },
    error: err => {
      console.error('[UserAccess] Failed to update user', err);
      host.error.set(host.formatRequestError(err, 'Failed to update user'));
      host.saving.set(false);
    }
  });
}

export function deleteUserAccessUser(host: UserAccessMutationsHost, user: UserRow): void {
  if (!user.id) {
    host.error.set('User ID is missing');
    return;
  }
  host.deleteCandidate.set(user);
}

export function closeUserAccessDeleteModal(host: UserAccessMutationsHost): void {
  if (host.saving()) {
    return;
  }
  host.deleteCandidate.set(null);
}

export function confirmUserAccessDeleteUser(host: UserAccessMutationsHost): void {
  const user = host.deleteCandidate();
  if (!user?.id) {
    host.deleteCandidate.set(null);
    return;
  }
  if (!host.requireRosterAuth('You need to sign in to delete users')) {
    return;
  }

  host.saving.set(true);
  host.error.set(null);
  host.debugLog(`[UserAccess] Deleting user ${user.email}`);

  host.api.delete(`Users/${user.id}`).subscribe({
    next: () => {
      host.debugLog(`[UserAccess] User ${user.email} deleted successfully`);
      const targetKey = user.id || user.email;
      const updatedRoster = host.roster().filter(u => (u.id || u.email) !== targetKey);
      host.roster.set(updatedRoster);
      host.pruneSelection(updatedRoster);
      host.saving.set(false);
      host.deleteCandidate.set(null);
      const originalStatus = normalizeUserAccessEditableStatus(user.status, 'Suspended');
      host.undoToast.deleted(
        `"${formatUserAccessUserLabel(user)}" deleted`,
        () => {
          const restoreTask = buildUserAccessRestoreTask(host, user.id, originalStatus);
          if (!restoreTask) {
            reloadUserAccessCollections(host);
            return;
          }

          restoreTask.subscribe({
            complete: () => reloadUserAccessCollections(host),
            error: err => {
              host.toast.error(host.formatRequestError(err, 'Unable to restore this user'));
              reloadUserAccessCollections(host);
            }
          });
        },
        {
          completionMessage: 'User restored.'
        }
      );
    },
    error: err => {
      console.error('[UserAccess] Failed to delete user', err);
      host.error.set(host.formatRequestError(err, 'Failed to delete user'));
      host.saving.set(false);
    }
  });
}

function normalizeEditableStatus(
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
