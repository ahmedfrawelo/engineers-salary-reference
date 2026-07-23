import type {
  PermissionGroup,
  PermissionItem
} from '../../../../core/authorization/permission-registry';
import {
  loadPermissionTreeHelper,
  parsePermissionRowHelper,
  permissionRowsHelper,
  permissionSectionsHelper,
  resolveGroupPathHelper
} from './helpers/user-access-control.roster.helper';
import type {
  PermissionAction,
  PermissionRow,
  PermissionSection,
  RoleItem,
  RoleUserItem,
  UserRow
} from './user-access-control.types';
import { UserAccessControlComponentState } from './user-access-control.component.state';

import { UserAccessControlComponentPermissionsCore } from './user-access-control.component.permissions.core';

export abstract class UserAccessControlComponentPermissionsRoles extends UserAccessControlComponentPermissionsCore {
  protected override loadUsersInRole(roleName: string, authToken: string): void {
    this.usersInRoleLoading.set(true);
    this.usersInRoleError.set(null);
    const encoded = encodeURIComponent(roleName);
    this.api.get(`Users/${encoded}/users`, undefined, { authToken }).subscribe({
      next: (response: unknown) => {
        this.usersInRole.set(this.extractUsersInRoleResponse(response));
        this.usersInRoleLoadedFor = roleName;
        this.usersInRoleLoading.set(false);
      },
      error: (err: unknown) => {
        this.usersInRoleLoadedFor = null;
        this.usersInRoleLoading.set(false);
        this.usersInRoleError.set('Failed to load role members');
        this.debugWarn('[UserAccess] Failed to load users in role', err);
      }
    });
  }

  protected ensureSelectedRoleMembersLoaded(force = false): void {
    const role = this.selectedRole();
    if (!role?.name || !this.canAssignAccessControlRoles()) {
      return;
    }

    if (!force && this.usersInRoleLoadedFor === role.name && !this.usersInRoleError()) {
      return;
    }

    const authToken = this.resolveAuthToken();
    if (!authToken) {
      this.usersInRoleError.set('You need to sign in');
      return;
    }

    this.loadUsersInRole(role.name, authToken);
  }

  private extractUsersInRoleResponse(response: unknown): RoleUserItem[] {
    let list: unknown[] = [];
    if (Array.isArray(response)) {
      list = response;
    } else {
      const r = this.asRecord(response);
      const nested =
        r?.data ??
        r?.Data ??
        r?.result ??
        r?.Result ??
        r?.value ??
        r?.Value ??
        r?.items ??
        r?.Items;
      if (Array.isArray(nested)) {
        list = nested;
      }
    }
    return list
      .map((item): RoleUserItem | null => {
        const r = this.asRecord(item);
        if (!r) return null;
        const id = this.normalizeText(r.id ?? r.Id);
        if (!id) return null;
        return {
          id,
          email: this.normalizeNullableText(r.email ?? r.Email),
          name: this.normalizeNullableText(r.fullName ?? r.FullName ?? r.name ?? r.Name),
          isActive: !!(r.isActive ?? r.IsActive)
        };
      })
      .filter((u): u is RoleUserItem => !!u && !!u.id);
  }

  assignUserToSelectedRole(userId: string): void {
    const role = this.selectedRole();
    if (!role?.name || !userId || this.usersInRoleLoading()) return;
    if (!this.canAssignAccessControlRoles()) {
      this.usersInRoleError.set("Access denied - You don't have permission to assign roles");
      return;
    }
    const authToken = this.resolveAuthToken();
    if (!authToken) {
      this.usersInRoleError.set('You need to sign in');
      return;
    }
    this.usersInRoleLoading.set(true);
    this.usersInRoleError.set(null);
    this.roleAddUserQuery = '';
    this.api.post('Roles/assign', { userId, roleName: role.name }).subscribe({
      next: () => {
        this.loadUsersInRole(role.name, authToken);
      },
      error: (err: unknown) => {
        this.usersInRoleLoading.set(false);
        this.usersInRoleError.set(this.getErrorMessage(err) ?? 'Failed to assign user to role');
      }
    });
  }

  removeUserFromSelectedRole(userId: string): void {
    const role = this.selectedRole();
    if (!role?.name || !userId || this.usersInRoleLoading()) return;
    if (!this.canAssignAccessControlRoles()) {
      this.usersInRoleError.set("Access denied - You don't have permission to assign roles");
      return;
    }
    const authToken = this.resolveAuthToken();
    if (!authToken) {
      this.usersInRoleError.set('You need to sign in');
      return;
    }
    this.usersInRoleLoading.set(true);
    this.usersInRoleError.set(null);
    this.api.post('Roles/remove', { userId, roleName: role.name }).subscribe({
      next: () => {
        this.usersInRole.set(this.usersInRole().filter(u => u.id !== userId));
        this.usersInRoleLoadedFor = role.name;
        this.usersInRoleLoading.set(false);
      },
      error: (err: unknown) => {
        this.usersInRoleLoading.set(false);
        this.usersInRoleError.set(this.getErrorMessage(err) ?? 'Failed to remove user from role');
      }
    });
  }

  usersNotInRole(): UserRow[] {
    const memberIds = new Set(
      this.usersInRole()
        .map(u => u.id)
        .filter(Boolean)
    );
    const query = (this.roleAddUserQuery ?? '').trim().toLowerCase();
    if (!query) return [];
    return this.roster()
      .filter(u => !(u.id && memberIds.has(u.id)))
      .filter(u => {
        const name = (u.name ?? '').toLowerCase();
        const email = (u.email ?? '').toLowerCase();
        return name.includes(query) || email.includes(query);
      })
      .slice(0, 6);
  }

  createRole(): void {
    if (!this.canManageAccessControlRoles()) {
      this.rolesError.set("Access denied - You don't have permission to manage roles");
      return;
    }
    const name = this.newRoleName.trim();
    if (!name) {
      this.rolesError.set('Role name is required');
      return;
    }
    const authToken = this.resolveAuthToken();
    if (!authToken) {
      this.rolesError.set('You need to sign in to manage roles');
      return;
    }

    this.rolesLoading.set(true);
    this.rolesError.set(null);
    this.api.post('Roles', { name }).subscribe({
      next: (response: unknown) => {
        const record = this.asRecord(response);
        const data = this.asRecord(record?.data);
        const createdName =
          (typeof data?.name === 'string' ? data.name : null) ||
          (typeof data?.Name === 'string' ? data.Name : null) ||
          name;
        this.newRoleName = '';
        this.loadRoles(authToken, true, createdName, true);
      },
      error: err => {
        this.rolesLoading.set(false);
        this.rolesError.set(err?.error?.message || err?.message || 'Failed to create role');
      }
    });
  }

  startEditRole(role: RoleItem): void {
    const updated = this.roles().map(item =>
      item.id === role.id ? { ...item, isEditing: true, editName: item.name } : item
    );
    this.roles.set(updated);
  }

  cancelRoleEdit(role: RoleItem): void {
    const updated = this.roles().map(item =>
      item.id === role.id ? { ...item, isEditing: false, editName: item.name } : item
    );
    this.roles.set(updated);
  }

  saveRoleName(role: RoleItem): void {
    if (!this.canManageAccessControlRoles()) {
      this.rolesError.set("Access denied - You don't have permission to manage roles");
      return;
    }
    const nextName = (role.editName || '').trim();
    if (!nextName) {
      this.rolesError.set('Role name is required');
      return;
    }
    const authToken = this.resolveAuthToken();
    if (!authToken) {
      this.rolesError.set('You need to sign in to manage roles');
      return;
    }

    this.rolesLoading.set(true);
    this.rolesError.set(null);
    this.api.put(`Roles/${role.id}`, { name: nextName }).subscribe({
      next: () => {
        this.loadRoles(authToken, true, nextName, true);
      },
      error: err => {
        this.rolesLoading.set(false);
        this.rolesError.set(err?.error?.message || err?.message || 'Failed to update role');
      }
    });
  }

  deleteRole(role: RoleItem): void {
    if (!this.canManageAccessControlRoles()) {
      this.rolesError.set("Access denied - You don't have permission to manage roles");
      return;
    }
    this.deleteRoleCandidate.set(role);
  }

  closeDeleteRoleModal(): void {
    if (this.rolesLoading()) {
      return;
    }
    this.deleteRoleCandidate.set(null);
  }

  confirmDeleteRole(): void {
    if (!this.canManageAccessControlRoles()) {
      this.rolesError.set("Access denied - You don't have permission to manage roles");
      this.deleteRoleCandidate.set(null);
      return;
    }
    const role = this.deleteRoleCandidate();
    if (!role) {
      return;
    }
    const authToken = this.resolveAuthToken();
    if (!authToken) {
      this.rolesError.set('You need to sign in to manage roles');
      this.deleteRoleCandidate.set(null);
      return;
    }

    this.rolesLoading.set(true);
    this.rolesError.set(null);
    this.api.delete(`Roles/${role.id}`).subscribe({
      next: () => {
        this.deleteRoleCandidate.set(null);
        this.loadRoles(authToken, true, undefined, true);
      },
      error: err => {
        this.rolesLoading.set(false);
        this.deleteRoleCandidate.set(null);
        this.rolesError.set(err?.error?.message || err?.message || 'Failed to delete role');
      }
    });
  }
}
