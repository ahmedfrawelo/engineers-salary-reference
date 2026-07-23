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

export abstract class UserAccessControlComponentPermissionsCore extends UserAccessControlComponentState {
  protected abstract resolveAuthToken(): string | null;
  protected abstract loadRoster(skipRefresh?: boolean): void;
  protected abstract loadRoles(
    authToken: string,
    updateSelection?: boolean,
    preferredRoleName?: string,
    force?: boolean
  ): void;
  protected abstract normalizePermissionCodes(items: unknown[]): string[];
  protected abstract extractPermissions(response: unknown): string[];
  protected abstract loadUsersInRole(roleName: string, authToken: string): void;

  protected loadPermissionsView(): void {
    if (!this.canOpenAccessControlPermissionsWorkspace()) {
      this.permissionsError.set(
        "Access denied - You don't have permission to manage access-control rules"
      );
      return;
    }
    const authToken = this.resolveAuthToken();
    if (!authToken) {
      this.permissionsError.set('You need to sign in to manage permissions');
      this.needsAuth.set(true);
      return;
    }

    if (this.permissionScope() === 'user' && !this.canManageAccessControlUserOverrides()) {
      this.permissionScope.set('role');
    }

    this.needsAuth.set(false);
    this.permissionsError.set(null);
    const preferredRoleName = this.readStoredRolePreference();
    if (
      this.canManageAccessControlPermissions() &&
      !this.permissionTreeLoaded() &&
      !this.permissionTree().length
    ) {
      this.loadPermissionTree(authToken);
    }
    if (this.canReadAccessControlRoles()) {
      if (!this.rolesLoaded()) {
        this.loadRoles(authToken, this.permissionScope() === 'role', preferredRoleName || undefined);
      } else if (this.permissionScope() === 'role' && !this.selectedRole() && this.roles().length) {
        const nextRole = this.resolvePreferredRole(this.roles(), preferredRoleName);
        this.selectRole(nextRole ?? this.roles()[0], authToken);
      }
    }
    if (
      this.permissionScope() === 'user' &&
      this.canManageAccessControlUserOverrides() &&
      !this.loading() &&
      !this.roster().length
    ) {
      this.loadRoster();
    }
  }

  private loadPermissionTree(authToken: string): void {
    return loadPermissionTreeHelper(this.helperContext(), authToken);
  }

  selectRole(role: RoleItem, authTokenOverride?: string): void {
    const current = this.selectedRole();
    const isSameRole = !!current && current.id === role.id && current.name === role.name;
    const cachedPermissions = this.rolePermissionsCache.get(this.rolePermissionCacheKey(role));
    this.selectedRole.set(role);
    this.writeStoredRolePreference(role.name);
    if (!isSameRole) {
      this.usersInRole.set([]);
      this.usersInRoleError.set(null);
      this.usersInRoleLoadedFor = null;
      this.roleAddUserQuery = '';
      if (!cachedPermissions) {
        this.selectedRolePermissions.set(new Set());
        this.savedRolePermissions.set(new Set());
      }
    }
    const authToken = authTokenOverride || this.resolveAuthToken();
    if (!authToken) {
      this.permissionsError.set('You need to sign in to manage roles');
      return;
    }
    if (this.canManageAccessControlPermissions()) {
      if (cachedPermissions) {
        const nextSet = new Set(cachedPermissions);
        this.selectedRolePermissions.set(new Set(nextSet));
        this.savedRolePermissions.set(new Set(nextSet));
        this.permissionsLoading.set(false);
      } else if (!isSameRole || !this.savedRolePermissions().size) {
        this.loadRolePermissions(role, authToken);
      } else {
        this.permissionsLoading.set(false);
      }
    } else {
      this.permissionsLoading.set(false);
    }
  }

  selectUser(user: UserRow, authTokenOverride?: string): void {
    if (!this.canManageAccessControlUserOverrides()) {
      this.permissionsError.set(
        "Access denied - You don't have permission to manage user overrides"
      );
      return;
    }
    this.selectedUser.set(user);
    const basePermissions = Array.isArray(user.permissions) ? user.permissions : [];
    const nextSet = new Set(this.normalizePermissionCodes(basePermissions));
    this.selectedUserPermissions.set(new Set(nextSet));
    this.savedUserPermissions.set(new Set(nextSet));
    const authToken = authTokenOverride || this.resolveAuthToken();
    if (!authToken) {
      this.permissionsError.set('You need to sign in to manage user overrides');
      return;
    }
    const userId = user.id ?? user.email;
    if (!userId) {
      this.permissionsError.set('User ID is missing');
      return;
    }
    const cacheKey = String(userId);
    const cachedPermissions = this.userPermissionsCache.get(cacheKey);
    if (cachedPermissions) {
      const nextPermissions = new Set(cachedPermissions);
      this.selectedUserPermissions.set(new Set(nextPermissions));
      this.savedUserPermissions.set(new Set(nextPermissions));
      this.permissionsLoading.set(false);
      return;
    }
    this.loadUserPermissions(cacheKey, authToken);
  }

  private loadRolePermissions(role: RoleItem, authToken: string): void {
    this.permissionsLoading.set(true);
    this.permissionsError.set(null);
    this.tryLoadRolePermissions(
      this.rolePermissionIdentifiers(role),
      this.rolePermissionCacheKey(role),
      authToken
    );
  }

  private tryLoadRolePermissions(
    identifiers: string[],
    cacheKey: string,
    authToken: string,
    index = 0
  ): void {
    const identifier = identifiers[index];
    if (!identifier) {
      this.permissionsLoading.set(false);
      this.permissionsError.set('Failed to load role permissions');
      return;
    }

    this.api
      .get(`Roles/${encodeURIComponent(identifier)}/permissions`, undefined, { authToken })
      .subscribe({
        next: response => {
          const permissions = this.extractPermissions(response);
          this.rolePermissionsCache.set(cacheKey, [...permissions]);
          const nextSet = new Set(permissions);
          this.selectedRolePermissions.set(new Set(nextSet));
          this.savedRolePermissions.set(new Set(nextSet));
          this.permissionsLoading.set(false);
        },
        error: err => {
          if (err?.status === 404 && index + 1 < identifiers.length) {
            this.tryLoadRolePermissions(identifiers, cacheKey, authToken, index + 1);
            return;
          }
          this.permissionsLoading.set(false);
          this.permissionsError.set('Failed to load role permissions');
          this.debugWarn('[UserAccess] Failed to load role permissions', err);
        }
      });
  }

  private rolePermissionIdentifiers(role: RoleItem): string[] {
    const variants = new Set<string>();
    const inputs = [role.name, role.normalizedName, role.id];

    for (const input of inputs) {
      const trimmed = (input || '').trim();
      if (!trimmed) {
        continue;
      }

      variants.add(trimmed);
      variants.add(trimmed.toUpperCase());
      variants.add(trimmed.replace(/\s+/g, ''));
      variants.add(trimmed.replace(/\s+/g, '').toUpperCase());
    }

    return Array.from(variants);
  }

  private rolePermissionCacheKey(role: RoleItem): string {
    return role.normalizedName?.trim() || role.id?.trim() || role.name.trim().toUpperCase();
  }

  private resolvePreferredRole(roles: RoleItem[], preferredRoleName: string | null): RoleItem | null {
    const preferred = (preferredRoleName || '').trim().toLowerCase();
    if (!preferred) {
      return roles[0] || null;
    }

    return roles.find(role => role.name.trim().toLowerCase() === preferred) || roles[0] || null;
  }

  private readStoredRolePreference(): string | null {
    if (typeof sessionStorage === 'undefined') {
      return null;
    }

    try {
      const value = sessionStorage.getItem(this.selectedRoleStorageKey);
      const trimmed = value?.trim();
      return trimmed || null;
    } catch {
      return null;
    }
  }

  private writeStoredRolePreference(roleName: string): void {
    if (typeof sessionStorage === 'undefined') {
      return;
    }

    const trimmed = roleName.trim();
    if (!trimmed) {
      return;
    }

    try {
      sessionStorage.setItem(this.selectedRoleStorageKey, trimmed);
    } catch {
      // Ignore storage failures.
    }
  }

  private loadUserPermissions(userId: string, authToken: string): void {
    this.permissionsLoading.set(true);
    this.permissionsError.set(null);
    this.api
      .get(`Users/${encodeURIComponent(userId)}/permissions`, undefined, { authToken })
      .subscribe({
        next: response => {
          const permissions = this.extractPermissions(response);
          this.userPermissionsCache.set(userId, [...permissions]);
          const nextSet = new Set(permissions);
          this.selectedUserPermissions.set(new Set(nextSet));
          this.savedUserPermissions.set(new Set(nextSet));
          this.permissionsLoading.set(false);
        },
        error: err => {
          this.permissionsLoading.set(false);
          this.permissionsError.set('Failed to load user permissions');
          this.debugWarn('[UserAccess] Failed to load user permissions', err);
        }
      });
  }

  private allPermissionCodes(): string[] {
    const codes = new Set<string>();
    for (const group of this.permissionTree()) {
      for (const perm of group?.permissions || []) {
        if (perm?.code) {
          codes.add(perm.code);
        }
      }
    }
    return Array.from(codes);
  }

  private groupPermissionCodes(group: PermissionGroup): string[] {
    if (!group?.permissions?.length) {
      return [];
    }
    return group.permissions.map(perm => perm?.code).filter((code): code is string => !!code);
  }

  permissionSections(): PermissionSection[] {
    return permissionSectionsHelper(this.helperContext());
  }

  private addPermissionGroup(
    sections: Map<string, Map<string, PermissionGroup[]>>,
    moduleTitle: string,
    pageTitle: string,
    group: PermissionGroup
  ): void {
    const moduleKey = moduleTitle.trim() || 'Other';
    const pageKey = pageTitle.trim() || 'General';
    if (!sections.has(moduleKey)) {
      sections.set(moduleKey, new Map());
    }
    const pages = sections.get(moduleKey) as Map<string, PermissionGroup[]>;
    if (!pages.has(pageKey)) {
      pages.set(pageKey, []);
    }
    pages.get(pageKey)?.push(group);
  }

  private isModuleGroup(group: PermissionGroup): boolean {
    const name = (group.group || '').trim();
    const moduleNames = new Set(['Tender', 'Settings', 'Account', 'Operations', 'CRM', 'HR']);
    return moduleNames.has(name);
  }

  private splitGroupByBase(permissions: PermissionItem[]): Map<string, PermissionItem[]> {
    const buckets = new Map<string, PermissionItem[]>();
    for (const perm of permissions) {
      const info = this.parsePermissionRow(perm);
      const key = info.base || 'General';
      if (!buckets.has(key)) {
        buckets.set(key, []);
      }
      buckets.get(key)?.push(perm);
    }
    return buckets;
  }

  private resolveGroupPath(group: PermissionGroup): {
    module: string;
    page: string;
    subgroup?: string;
  } {
    return resolveGroupPathHelper(this.helperContext(), group);
  }

  permissionRows(group: PermissionGroup): PermissionRow[] {
    return permissionRowsHelper(this.helperContext(), group);
  }

  trackByPermissionRow(index: number, row: PermissionRow): string {
    return (
      row.view?.code ||
      row.edit?.code ||
      row.create?.code ||
      row.delete?.code ||
      row.actions[0]?.key ||
      `${row.label}-${index}`
    );
  }

  trackByPermissionAction(index: number, action: PermissionAction): string {
    return action.key || `${action.label}-${index}`;
  }

  private parsePermissionRow(perm: PermissionItem): {
    kind: 'view' | 'edit' | 'create' | 'delete' | 'action';
    base: string;
    actionLabel?: string;
  } {
    return parsePermissionRowHelper(this.helperContext(), perm);
  }

  private humanizePermissionBase(code: string): string {
    const trimmed = code.replace(/\.(view|edit|create|delete)$/i, '');
    const lastSegment = trimmed.split('.').pop() || trimmed;
    return lastSegment.replace(/[_-]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
  }

  private normalizeActionLabel(action: string): string {
    const normalized = action.trim().toLowerCase();
    switch (normalized) {
      case 'create':
        return 'Create';
      case 'delete':
        return 'Delete';
      case 'manage':
        return 'Manage';
      case 'assign':
        return 'Assign';
      case 'approve':
        return 'Approve';
      case 'reset':
        return 'Reset';
      case 'change':
        return 'Change';
      case 'export':
        return 'Export';
      case 'import':
        return 'Import';
      case 'archive':
        return 'Archive';
      case 'restore':
        return 'Restore';
      default:
        return action.charAt(0).toUpperCase() + action.slice(1);
    }
  }

  private extractActionFromCode(code: string): { base: string; action: string } | null {
    if (!code) {
      return null;
    }
    const parts = code.split('.').filter(Boolean);
    if (parts.length < 2) {
      return null;
    }
    const action = parts.pop() as string;
    const baseCode = parts.join('.');
    return {
      base: this.humanizePermissionBase(baseCode),
      action: this.normalizeActionLabel(this.humanizePermissionBase(action))
    };
  }

  private activePermissions(): Set<string> {
    return this.permissionScope() === 'role'
      ? this.selectedRolePermissions()
      : this.selectedUserPermissions();
  }

  private setActivePermissions(next: Set<string>): void {
    if (this.permissionScope() === 'role') {
      this.selectedRolePermissions.set(next);
    } else {
      this.selectedUserPermissions.set(next);
    }
  }

  hasPermissionTarget(): boolean {
    return this.permissionScope() === 'role' ? !!this.selectedRole() : !!this.selectedUser();
  }

  areAllPermissionsSelected(): boolean {
    const codes = this.allPermissionCodes();
    if (!codes.length) {
      return false;
    }
    const selected = this.activePermissions();
    return codes.every(code => selected.has(code));
  }

  areSomePermissionsSelected(): boolean {
    const codes = this.allPermissionCodes();
    if (!codes.length) {
      return false;
    }
    const selected = this.activePermissions();
    const selectedCount = codes.filter(code => selected.has(code)).length;
    return selectedCount > 0 && selectedCount < codes.length;
  }

  isGroupFullySelected(group: PermissionGroup): boolean {
    const codes = this.groupPermissionCodes(group);
    if (!codes.length) {
      return false;
    }
    const selected = this.activePermissions();
    return codes.every(code => selected.has(code));
  }

  isGroupPartiallySelected(group: PermissionGroup): boolean {
    const codes = this.groupPermissionCodes(group);
    if (!codes.length) {
      return false;
    }
    const selected = this.activePermissions();
    const selectedCount = codes.filter(code => selected.has(code)).length;
    return selectedCount > 0 && selectedCount < codes.length;
  }

  toggleAllPermissions(): void {
    if (!this.canManageAccessControlPermissions()) {
      return;
    }
    const codes = this.allPermissionCodes();
    if (!codes.length) {
      return;
    }
    const selected = new Set(this.activePermissions());
    const allSelected = codes.every(code => selected.has(code));
    if (allSelected) {
      codes.forEach(code => selected.delete(code));
    } else {
      codes.forEach(code => selected.add(code));
    }
    this.setActivePermissions(selected);
  }

  toggleGroupPermissions(group: PermissionGroup): void {
    if (!this.canManageAccessControlPermissions()) {
      return;
    }
    const codes = this.groupPermissionCodes(group);
    if (!codes.length) {
      return;
    }
    const selected = new Set(this.activePermissions());
    const allSelected = codes.every(code => selected.has(code));
    if (allSelected) {
      codes.forEach(code => selected.delete(code));
    } else {
      codes.forEach(code => selected.add(code));
    }
    this.setActivePermissions(selected);
  }

  isPermissionSelected(code: string): boolean {
    return this.activePermissions().has(code);
  }

  togglePermission(code: string): void {
    if (!this.canManageAccessControlPermissions()) {
      return;
    }
    const next = new Set(this.activePermissions());
    if (next.has(code)) {
      next.delete(code);
    } else {
      next.add(code);
    }
    this.setActivePermissions(next);
  }

  saveRolePermissions(): void {
    if (!this.canManageAccessControlPermissions()) {
      this.permissionsError.set(
        "Access denied - You don't have permission to update role permissions"
      );
      return;
    }
    const role = this.selectedRole();
    if (!role) {
      this.permissionsError.set('Select a role first');
      return;
    }
    const authToken = this.resolveAuthToken();
    if (!authToken) {
      this.permissionsError.set('You need to sign in to manage roles');
      return;
    }

    const nextPermissions = Array.from(this.selectedRolePermissions());
    const payload = { permissions: nextPermissions };
    this.permissionsLoading.set(true);
    this.permissionsError.set(null);
    this.trySaveRolePermissions(
      this.rolePermissionIdentifiers(role),
      this.rolePermissionCacheKey(role),
      authToken,
      payload,
      nextPermissions
    );
  }

  private trySaveRolePermissions(
    identifiers: string[],
    cacheKey: string,
    authToken: string,
    payload: { permissions: string[] },
    nextPermissions: string[],
    index = 0
  ): void {
    const identifier = identifiers[index];
    if (!identifier) {
      this.permissionsLoading.set(false);
      this.permissionsError.set('Failed to update permissions');
      return;
    }

    this.api
      .put(`Roles/${encodeURIComponent(identifier)}/permissions`, payload, { authToken })
      .subscribe({
        next: () => {
          this.rolePermissionsCache.set(cacheKey, [...nextPermissions]);
          this.savedRolePermissions.set(new Set(nextPermissions));
          this.permissionsLoading.set(false);
        },
        error: err => {
          if (err?.status === 404 && index + 1 < identifiers.length) {
            this.trySaveRolePermissions(
              identifiers,
              cacheKey,
              authToken,
              payload,
              nextPermissions,
              index + 1
            );
            return;
          }
          this.permissionsLoading.set(false);
          // Check if the error is related to access permissions.
          const errorMessage = String(err?.message || err?.error?.message || '');
          const isPermissionError = /permission|access denied|forbidden|not authorized/i.test(
            errorMessage
          );

          if ((err?.status === 401 && isPermissionError) || err?.status === 403) {
            this.permissionsError.set(
              "Access denied - You don't have permission to update role permissions"
            );
          } else {
            this.permissionsError.set(
              err?.error?.message || err?.message || 'Failed to update permissions'
            );
          }
        }
      });
  }

  saveUserPermissions(): void {
    if (!this.canManageAccessControlPermissions()) {
      this.permissionsError.set(
        "Access denied - You don't have permission to update user permissions"
      );
      return;
    }
    const user = this.selectedUser();
    const userId = user?.id ?? user?.email;
    if (!userId) {
      this.permissionsError.set('Select a user first');
      return;
    }
    const authToken = this.resolveAuthToken();
    if (!authToken) {
      this.permissionsError.set('You need to sign in to manage user overrides');
      return;
    }

    this.permissionsLoading.set(true);
    this.permissionsError.set(null);
    const nextPermissions = Array.from(this.selectedUserPermissions());
    const payload = { permissions: nextPermissions };
    this.api
      .put(`Users/${encodeURIComponent(String(userId))}/permissions`, payload, { authToken })
      .subscribe({
        next: () => {
          this.userPermissionsCache.set(String(userId), [...nextPermissions]);
          this.savedUserPermissions.set(new Set(nextPermissions));
          const current = this.selectedUser();
          const currentKey = this.getUserKey(current);
          if (currentKey) {
            const updated = { ...current!, permissions: nextPermissions };
            this.selectedUser.set(updated);
            this.roster.set(
              this.roster().map(user =>
                this.getUserKey(user) === currentKey
                  ? { ...user, permissions: nextPermissions }
                  : user
              )
            );
          }
          this.permissionsLoading.set(false);
        },
        error: err => {
          this.permissionsLoading.set(false);
          // Check if the error is related to access permissions.
          const errorMessage = String(err?.message || err?.error?.message || '');
          const isPermissionError = /permission|access denied|forbidden|not authorized/i.test(
            errorMessage
          );

          if ((err?.status === 401 && isPermissionError) || err?.status === 403) {
            this.permissionsError.set(
              "Access denied - You don't have permission to update user permissions"
            );
          } else {
            this.permissionsError.set(
              err?.error?.message || err?.message || 'Failed to update user permissions'
            );
          }
        }
      });
  }
}
