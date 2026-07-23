import { concat, forkJoin, type Observable } from 'rxjs';
import type { RestoreCandidate, UserRow } from '../user-access-control.types';
import {
  asRecord,
  buildUserAccessRoleUpdateTask,
  buildUserAccessStatusTask,
  formatUserAccessUserLabel,
  normalizeUserAccessEditableStatus,
  reloadUserAccessCollections,
  toMessage
} from './user-access-control.mutations.internal';
import {
  closeUserAccessBulkDeleteModal,
  openUserAccessBulkDeleteModal,
  userAccessBulkDeleteCount
} from './user-access-control.bulk-delete-modal.internal';
import type {
  ApiLike,
  EditableProfile,
  SignalCell,
  ToastLike,
  UndoToastLike
} from './user-access-control.mutations.types';

export interface UserAccessMutationsHost {
  profile: EditableProfile;
  api: ApiLike;
  toast: ToastLike;
  undoToast: UndoToastLike;
  roster: SignalCell<UserRow[]>;
  selectedKeys: SignalCell<Set<string>>;
  bulkDeleteKeys: SignalCell<string[] | null>;
  deleteCandidate: SignalCell<UserRow | null>;
  error: SignalCell<string | null>;
  saving: SignalCell<boolean>;
  restoring: SignalCell<boolean>;
  restoreCandidate: SignalCell<RestoreCandidate | null>;
  roleOptions(): string[];
  getUserKey(user: UserRow | null | undefined): string | null;
  getUsersByKeys(keys: string[]): UserRow[];
  getSelectedUsers(): UserRow[];
  clearSelection(): void;
  pruneSelection(nextRoster: UserRow[]): void;
  requireRosterAuth(message?: string): boolean;
  loadRoster(skipRefresh?: boolean): void;
  loadDeletedRoster(): void;
  findDeletedUserByEmail(email: string): void;
  isConflictError(err: unknown): boolean;
  formatRequestError(err: unknown, fallback: string): string;
  normalizeRoles(rawRoles: unknown): string[];
  asRecord(value: unknown): Record<string, unknown> | null;
  debugLog(...args: unknown[]): void;
}

export function bulkUpdateUserAccessStatus(
  host: UserAccessMutationsHost,
  nextStatus: 'Active' | 'Suspended'
): void {
  const selectedUsers = host.getSelectedUsers().filter(user => !!user.id);
  if (!selectedUsers.length) {
    host.error.set('No users selected');
    return;
  }
  if (!host.requireRosterAuth()) {
    return;
  }
  host.saving.set(true);
  host.error.set(null);

  const statusEndpoint = nextStatus === 'Active' ? 'activate' : 'deactivate';
  const updates = selectedUsers.map(user => host.api.put(`Users/${user.id}/${statusEndpoint}`, {}));
  const rollbackableUsers = selectedUsers
    .map(user => ({
      id: user.id as string,
      label: formatUserAccessUserLabel(user),
      previousStatus: normalizeUserAccessEditableStatus(user.status, 'Suspended'),
      changed: normalizeUserAccessEditableStatus(user.status, 'Suspended') !== nextStatus
    }))
    .filter(user => user.changed);
  const canUndo = rollbackableUsers.every(user => user.previousStatus !== 'Invited');

  forkJoin(updates).subscribe({
    next: () => {
      const selectedKeys = new Set(
        selectedUsers.map(user => host.getUserKey(user)).filter(Boolean) as string[]
      );
      const updatedRoster = host.roster().map(user => {
        const key = host.getUserKey(user);
        if (key && selectedKeys.has(key)) {
          return { ...user, status: nextStatus };
        }
        return user;
      });
      host.roster.set(updatedRoster);
      host.clearSelection();
      host.saving.set(false);
      if (canUndo && rollbackableUsers.length) {
        const message =
          rollbackableUsers.length === 1
            ? `"${rollbackableUsers[0]?.label ?? 'User'}" status updated`
            : `${rollbackableUsers.length} user statuses updated`;
        host.undoToast.updated(
          message,
          () => {
            const rollbackTasks = rollbackableUsers
              .map(user =>
                buildUserAccessStatusTask(host, user.id, user.previousStatus, nextStatus)
              )
              .filter((task): task is Observable<unknown> => !!task);

            if (!rollbackTasks.length) {
              reloadUserAccessCollections(host);
              return;
            }

            forkJoin(rollbackTasks).subscribe({
              next: () => reloadUserAccessCollections(host),
              error: err => {
                host.toast.error(host.formatRequestError(err, 'Unable to revert user statuses'));
                reloadUserAccessCollections(host);
              }
            });
          },
          {
            completionMessage:
              rollbackableUsers.length === 1 ? 'User status restored.' : 'User statuses restored.'
          }
        );
        return;
      }

      host.toast.success(
        rollbackableUsers.length > 1 ? 'User statuses updated.' : 'User status updated.'
      );
    },
    error: err => {
      console.error('[UserAccess] Failed to update users', err);
      const record = asRecord(err);
      const nested = asRecord(record?.error);
      host.error.set(
        toMessage(nested?.message) || toMessage(record?.message) || 'Failed to update users'
      );
      host.saving.set(false);
    }
  });
}

export function confirmUserAccessBulkDelete(host: UserAccessMutationsHost): void {
  const keys = host.bulkDeleteKeys();
  if (!keys?.length) {
    host.bulkDeleteKeys.set(null);
    return;
  }
  const selectedUsers = host.getUsersByKeys(keys).filter(user => !!user.id);
  if (!selectedUsers.length) {
    host.error.set('No deletable users selected');
    host.bulkDeleteKeys.set(null);
    return;
  }
  if (!host.requireRosterAuth()) {
    return;
  }

  host.saving.set(true);
  const deletes = selectedUsers.map(user => host.api.delete(`Users/${user.id}`));
  const deletedUsers = selectedUsers.map(user => ({ ...user }));

  forkJoin(deletes).subscribe({
    next: () => {
      const deleteKeys = new Set(keys);
      const updatedRoster = host.roster().filter(user => {
        const key = host.getUserKey(user);
        return key ? !deleteKeys.has(key) : true;
      });
      host.roster.set(updatedRoster);
      host.bulkDeleteKeys.set(null);
      host.clearSelection();
      host.saving.set(false);
      const message =
        deletedUsers.length === 1
          ? `"${formatUserAccessUserLabel(deletedUsers[0])}" deleted`
          : `${deletedUsers.length} users deleted`;
      host.undoToast.deleted(
        message,
        () => {
          const restoreTasks = deletedUsers
            .map(user =>
              buildUserAccessRestoreTask(
                host,
                user.id ?? null,
                normalizeUserAccessEditableStatus(user.status, 'Suspended')
              )
            )
            .filter((task): task is Observable<unknown> => !!task);

          if (!restoreTasks.length) {
            reloadUserAccessCollections(host);
            return;
          }

          forkJoin(restoreTasks).subscribe({
            next: () => reloadUserAccessCollections(host),
            error: err => {
              host.toast.error(host.formatRequestError(err, 'Unable to restore deleted users'));
              reloadUserAccessCollections(host);
            }
          });
        },
        {
          completionMessage: deletedUsers.length === 1 ? 'User restored.' : 'Users restored.'
        }
      );
    },
    error: err => {
      console.error('[UserAccess] Failed to delete users', err);
      const record = asRecord(err);
      const nested = asRecord(record?.error);
      host.error.set(
        toMessage(nested?.message) || toMessage(record?.message) || 'Failed to delete users'
      );
      host.saving.set(false);
    }
  });
}

export function toggleUserAccessEdit(host: UserAccessMutationsHost, user: UserRow): void {
  const targetKey = user.id || user.email;
  const currentRoster = host.roster();
  const hasOtherEditing = currentRoster.some(u => u.isEditing && (u.id || u.email) !== targetKey);
  if (hasOtherEditing && !user.isEditing) {
    return;
  }
  const updatedRoster = currentRoster.map(u => {
    const rowKey = u.id || u.email;
    if (rowKey !== targetKey) {
      return u.isEditing || u.isQuickEditing
        ? { ...u, isEditing: false, edit: undefined, isQuickEditing: false, quickEdit: undefined }
        : u;
    }
    if (u.isEditing) {
      return {
        ...u,
        isEditing: false,
        edit: undefined,
        isQuickEditing: false,
        quickEdit: undefined
      };
    }
    return {
      ...u,
      isEditing: true,
      edit: {
        name: u.name ?? '',
        email: u.email ?? '',
        status: u.status ?? 'Suspended',
        role: u.role ?? u.roles?.[0] ?? 'User',
        department: u.department ?? '',
        position: u.position ?? '',
        phoneNumber: u.phoneNumber ?? '',
        password: ''
      },
      isQuickEditing: false,
      quickEdit: undefined
    };
  });
  host.roster.set(updatedRoster);
}

export function isUserAccessEditLocked(host: UserAccessMutationsHost, user: UserRow): boolean {
  const targetKey = user.id || user.email;
  return host.roster().some(u => u.isEditing && (u.id || u.email) !== targetKey);
}

export function toggleUserAccessQuickEdit(host: UserAccessMutationsHost, user: UserRow): void {
  const targetKey = host.getUserKey(user);
  if (!targetKey) {
    return;
  }
  const currentRoster = host.roster();
  const hasOtherEditing = currentRoster.some(
    u => u.isEditing && (host.getUserKey(u) ?? '') !== targetKey
  );
  if (hasOtherEditing) {
    return;
  }
  const updatedRoster = currentRoster.map(u => {
    const rowKey = host.getUserKey(u);
    if (!rowKey || rowKey !== targetKey) {
      return u.isQuickEditing ? { ...u, isQuickEditing: false, quickEdit: undefined } : u;
    }
    if (u.isQuickEditing) {
      return { ...u, isQuickEditing: false, quickEdit: undefined };
    }
    return {
      ...u,
      isQuickEditing: true,
      quickEdit: {
        status: u.status ?? 'Suspended',
        role: u.role ?? u.roles?.[0] ?? 'User'
      }
    };
  });
  host.roster.set(updatedRoster);
}

export function updateUserAccessQuickEdit(
  host: UserAccessMutationsHost,
  user: UserRow,
  patch: { status?: string; role?: string }
): void {
  const targetKey = host.getUserKey(user);
  if (!targetKey) {
    return;
  }
  const updatedRoster = host.roster().map(u => {
    const rowKey = host.getUserKey(u);
    if (!rowKey || rowKey !== targetKey) {
      return u;
    }
    const current = u.quickEdit ?? {
      status: u.status ?? 'Suspended',
      role: u.role ?? u.roles?.[0] ?? 'User'
    };
    return {
      ...u,
      isQuickEditing: true,
      quickEdit: {
        status: patch.status ?? current.status,
        role: patch.role ?? current.role
      }
    };
  });
  host.roster.set(updatedRoster);
}

export function saveUserAccessQuickEdit(host: UserAccessMutationsHost, user: UserRow): void {
  if (!user.id || !user.quickEdit) {
    host.error.set('User data is missing');
    return;
  }
  if (!host.requireRosterAuth()) {
    return;
  }
  const nextStatus = user.quickEdit.status === 'Active' ? 'Active' : 'Suspended';
  const nextRole = user.quickEdit.role.trim() || user.role || 'User';
  const currentRoles = host.normalizeRoles(user.roles ?? user.role);
  const previousRole = (currentRoles[0] || user.role || 'User').trim();

  if (currentRoles.length > 1 && nextRole !== previousRole) {
    host.error.set(
      'This user has multiple roles. Manage role membership from the Roles panel to preserve existing access.'
    );
    return;
  }

  const updates: Observable<unknown>[] = [];
  if (nextStatus !== user.status) {
    const statusEndpoint = nextStatus === 'Active' ? 'activate' : 'deactivate';
    updates.push(host.api.put(`Users/${user.id}/${statusEndpoint}`, {}));
  }

  const roleTask = buildUserAccessRoleUpdateTask(host, user, nextRole);
  if (roleTask) {
    updates.push(roleTask);
  }

  if (!updates.length) {
    toggleUserAccessQuickEdit(host, user);
    return;
  }

  const previousStatus = normalizeUserAccessEditableStatus(user.status, 'Suspended');
  const canUndoStatus = previousStatus === nextStatus || previousStatus !== 'Invited';

  host.saving.set(true);
  host.error.set(null);

  forkJoin(updates).subscribe({
    next: () => {
      const targetKey = host.getUserKey(user);
      const updatedRoster = host.roster().map(u => {
        const rowKey = host.getUserKey(u);
        if (!rowKey || rowKey !== targetKey) {
          return u;
        }
        const existingRoles = host.normalizeRoles(u.roles ?? u.role);
        const resolvedRoles =
          roleTask && nextRole
            ? [nextRole]
            : existingRoles.length
              ? existingRoles
              : nextRole
                ? [nextRole]
                : [];
        const resolvedRole = resolvedRoles[0] || nextRole || u.role || 'User';
        return {
          ...u,
          status: nextStatus,
          role: resolvedRole,
          roles: resolvedRoles.length ? resolvedRoles : u.roles,
          isQuickEditing: false,
          quickEdit: undefined
        };
      });
      host.roster.set(updatedRoster);
      host.pruneSelection(updatedRoster);
      host.saving.set(false);
      const rollbackTasks: Observable<unknown>[] = [];

      if (nextStatus !== previousStatus) {
        const rollbackStatusTask = buildUserAccessStatusTask(
          host,
          user.id,
          previousStatus,
          nextStatus
        );
        if (rollbackStatusTask) {
          rollbackTasks.push(rollbackStatusTask);
        }
      }

      if (nextRole !== previousRole) {
        const rollbackRoleTask = buildUserAccessRoleUpdateTask(
          host,
          { ...user, role: nextRole, roles: nextRole ? [nextRole] : user.roles },
          previousRole
        );
        if (rollbackRoleTask) {
          rollbackTasks.push(rollbackRoleTask);
        }
      }

      if (canUndoStatus && rollbackTasks.length) {
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

      host.toast.success('User updated.');
    },
    error: err => {
      console.error('[UserAccess] Failed to apply quick edit', err);
      const record = asRecord(err);
      const nested = asRecord(record?.error);
      host.error.set(
        toMessage(nested?.message) || toMessage(record?.message) || 'Failed to update user'
      );
      host.saving.set(false);
    }
  });
}

export function closeAllUserAccessQuickEdits(host: UserAccessMutationsHost): void {
  const current = host.roster();
  let changed = false;
  const updated = current.map(user => {
    if (!user.isQuickEditing) {
      return user;
    }
    changed = true;
    return { ...user, isQuickEditing: false, quickEdit: undefined };
  });
  if (changed) {
    host.roster.set(updated);
  }
}

export function buildUserAccessRestoreTask(
  host: UserAccessMutationsHost,
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

export {
  buildUserAccessRoleUpdateTask,
  buildUserAccessStatusTask,
  formatUserAccessUserLabel,
  normalizeUserAccessEditableStatus,
  reloadUserAccessCollections
} from './user-access-control.mutations.internal';

export {
  closeUserAccessBulkDeleteModal,
  openUserAccessBulkDeleteModal,
  userAccessBulkDeleteCount
} from './user-access-control.bulk-delete-modal.internal';
