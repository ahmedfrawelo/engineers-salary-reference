import { Directive, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AUTH_SESSION_FACADE, AuthSessionFacade } from '../../../../core/auth/auth-session.facade';
import { AuthTokenStoreService } from '../../../../core/auth/auth.service';
import { PermissionService } from '../../../../core/authorization/permission.service';
import { TokenRefreshService } from '../../../../core/auth/token-refresh.service';
import { ApiClient } from '@infrastructure/http/api-client.service';
import { environment } from '../../../../../environments/environment';
import type { DropdownOption } from '../../../../shared/custom-dropdown/custom-dropdown.component';
import type { PermissionGroup } from '../../../../core/authorization/permission-registry';
import { debugWarnHelper } from './helpers/user-access-control.roster.helper';
import type {
  AccessTab,
  PermissionScope,
  RestoreCandidate,
  RoleItem,
  RoleUserItem,
  UserRow
} from './user-access-control.types';

@Directive()
export abstract class UserAccessControlComponentState {
  readonly tab = signal<AccessTab>('profile');
  profile = {
    name: '',
    email: '',
    password: '',
    status: 'Invited',
    role: 'User',
    department: '',
    position: '',
    phoneNumber: ''
  };
  readonly roster = signal<UserRow[]>([]);
  readonly availableRoles = signal<string[]>([]);
  readonly roles = signal<RoleItem[]>([]);
  readonly rolesLoaded = signal(false);
  readonly selectedRole = signal<RoleItem | null>(null);
  readonly selectedUser = signal<UserRow | null>(null);
  readonly permissionScope = signal<PermissionScope>('role');
  readonly permissionTree = signal<PermissionGroup[]>([]);
  readonly permissionTreeLoaded = signal(false);
  readonly selectedRolePermissions = signal<Set<string>>(new Set());
  readonly selectedUserPermissions = signal<Set<string>>(new Set());
  readonly savedRolePermissions = signal<Set<string>>(new Set());
  readonly savedUserPermissions = signal<Set<string>>(new Set());
  readonly rolesLoading = signal(false);
  readonly rolesError = signal<string | null>(null);
  readonly permissionTreeLoading = signal(false);
  readonly permissionsLoading = signal(false);
  readonly permissionsError = signal<string | null>(null);
  readonly createStatusOptions: DropdownOption[] = [
    { value: 'Active', text: 'Active (can sign in)' },
    { value: 'Invited', text: 'Invited (pending acceptance)' },
    { value: 'Suspended', text: 'Suspended (blocked)' }
  ];
  readonly statusFilterOptions: DropdownOption[] = [
    { value: 'All', text: 'All statuses' },
    { value: 'Active', text: 'Active' },
    { value: 'Invited', text: 'Invited' },
    { value: 'Suspended', text: 'Suspended' }
  ];
  readonly rosterSortOptions: DropdownOption[] = [
    { value: 'Status', text: 'Sort: Status' },
    { value: 'NameAsc', text: 'Sort: Name (A-Z)' },
    { value: 'NameDesc', text: 'Sort: Name (Z-A)' },
    { value: 'EmailAsc', text: 'Sort: Email (A-Z)' },
    { value: 'Newest', text: 'Sort: Newest' },
    { value: 'Oldest', text: 'Sort: Oldest' },
    { value: 'LastActive', text: 'Sort: Last active' }
  ];
  readonly pageSizeOptions: DropdownOption[] = [
    { value: '8', text: '8 / page' },
    { value: '16', text: '16 / page' },
    { value: '24', text: '24 / page' },
    { value: '50', text: '50 / page' }
  ];
  readonly editStatusOptions: DropdownOption[] = [
    { value: 'Active', text: 'Active (can sign in)' },
    { value: 'Suspended', text: 'Suspended (blocked)' }
  ];
  rosterQuery = '';
  permissionUserQuery = '';
  rosterStatusFilter = 'All';
  rosterRoleFilter = 'All';
  rosterSort = 'Status';
  readonly defaultRosterPageSize = 8;
  rosterPageSize = this.defaultRosterPageSize;
  rosterVisibleCount = this.defaultRosterPageSize;
  readonly selectedKeys = signal<Set<string>>(new Set());
  readonly deleteCandidate = signal<UserRow | null>(null);
  readonly bulkDeleteKeys = signal<string[] | null>(null);
  readonly deleteRoleCandidate = signal<RoleItem | null>(null);
  readonly usersInRole = signal<RoleUserItem[]>([]);
  readonly usersInRoleLoading = signal(false);
  readonly usersInRoleError = signal<string | null>(null);
  roleAddUserQuery = '';
  deletedUserQuery = '';
  readonly deletedDrawerOpen = signal(false);
  readonly deletedRoster = signal<UserRow[]>([]);
  readonly deletedLoading = signal(false);
  readonly deletedError = signal<string | null>(null);
  readonly restoringUserId = signal<string | null>(null);
  readonly hardDeleteCandidate = signal<UserRow | null>(null);
  readonly copiedEmail = signal<string | null>(null);
  readonly lastSync = signal<string | null>(null);
  showSelectedOnly = false;
  newRoleName = '';
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly restoring = signal(false);
  readonly restoreCandidate = signal<RestoreCandidate | null>(null);
  readonly needsAuth = signal(false);
  protected readonly rolePermissionsCache = new Map<string, string[]>();
  protected readonly userPermissionsCache = new Map<string, string[]>();
  protected usersInRoleLoadedFor: string | null = null;
  protected readonly selectedRoleStorageKey = 'engineers-salary-reference.portal.access-control.selected-role';

  protected readonly router = inject(Router);
  protected readonly route = inject(ActivatedRoute);
  protected readonly authFacade: AuthSessionFacade = inject(AUTH_SESSION_FACADE);
  protected readonly tokenRefresh = inject(TokenRefreshService);
  protected readonly api = inject(ApiClient);
  protected readonly auth = inject(AuthTokenStoreService);
  protected readonly permissionAccess = inject(PermissionService);
  protected readonly debugEnabled = environment.enableDebugLogs === true;

  protected readonly dateFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  protected readonly dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

  protected debugLog(...args: unknown[]): void {
    if (this.debugEnabled) {
      console.log(...args);
    }
  }

  protected debugWarn(...args: unknown[]): void {
    return debugWarnHelper(this.helperContext(), ...args);
  }

  protected helperContext(): Parameters<typeof debugWarnHelper>[0] {
    return this as unknown as Parameters<typeof debugWarnHelper>[0];
  }

  protected canViewAccessControl(): boolean {
    return this.permissionAccess.canViewAccessControl();
  }

  protected canCreateAccessControlUser(): boolean {
    return this.permissionAccess.canCreateAccessControlUsers();
  }

  protected canEditAccessControlUser(): boolean {
    return this.permissionAccess.canEditAccessControlUsers();
  }

  protected canDeleteAccessControlUser(): boolean {
    return this.permissionAccess.canDeleteAccessControlUsers();
  }

  protected canManageAccessControlRoles(): boolean {
    return this.permissionAccess.canManageAccessControlRoles();
  }

  protected canAssignAccessControlRoles(): boolean {
    return this.permissionAccess.canAssignAccessControlRoles();
  }

  protected canManageAccessControlPermissions(): boolean {
    return this.permissionAccess.canManageAccessControlPermissions();
  }

  protected canResetAccessControlPasswords(): boolean {
    return this.permissionAccess.canResetAccessControlPasswords();
  }

  protected canReadAccessControlRoles(): boolean {
    return (
      this.canManageAccessControlRoles() ||
      this.canManageAccessControlPermissions() ||
      this.canAssignAccessControlRoles() ||
      this.canCreateAccessControlUser()
    );
  }

  protected canOpenAccessControlPermissionsWorkspace(): boolean {
    return (
      this.canManageAccessControlPermissions() ||
      this.canManageAccessControlRoles() ||
      this.canAssignAccessControlRoles()
    );
  }

  protected canManageAccessControlUserOverrides(): boolean {
    return this.canManageAccessControlPermissions() && this.canViewAccessControl();
  }

  protected asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    return value as Record<string, unknown>;
  }

  protected getErrorStatus(err: unknown): number | null {
    const direct = this.asRecord(err);
    if (typeof direct?.status === 'number') {
      return direct.status;
    }
    const originalError = this.asRecord(direct?.originalError);
    return typeof originalError?.status === 'number' ? originalError.status : null;
  }

  protected getErrorMessage(err: unknown): string | null {
    const direct = this.asRecord(err);
    const directError = this.asRecord(direct?.error);
    const originalError = this.asRecord(direct?.originalError);
    const originalErrorPayload = this.asRecord(originalError?.error);
    return (
      this.toMessage(directError?.message) ??
      this.toMessage(originalErrorPayload?.message) ??
      this.toMessage(direct?.message)
    );
  }

  protected normalizeRoles(rawRoles: unknown): string[] {
    if (!rawRoles) {
      return [];
    }
    if (Array.isArray(rawRoles)) {
      return rawRoles.map(role => this.normalizeText(role)).filter(Boolean);
    }
    if (typeof rawRoles === 'string') {
      return rawRoles
        .split(',')
        .map(role => role.trim())
        .filter(Boolean);
    }
    const normalized = this.normalizeText(rawRoles);
    return normalized ? [normalized] : [];
  }

  protected normalizeText(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return value.trim();
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const candidate =
        record.name ??
        record.Name ??
        record.label ??
        record.Label ??
        record.title ??
        record.Title ??
        record.text ??
        record.Text;
      if (typeof candidate === 'string') {
        return candidate.trim();
      }
    }
    return String(value).trim();
  }

  protected normalizeNullableText(value: unknown): string | null {
    const normalized = this.normalizeText(value);
    return normalized ? normalized : null;
  }

  protected normalizeEmail(value?: string | null): string {
    return this.normalizeText(value).toLowerCase();
  }

  protected toMessage(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  protected getUserKey(user: UserRow | null | undefined): string | null {
    if (!user) {
      return null;
    }
    const key = user.id || user.email;
    return key ? String(key) : null;
  }
}
