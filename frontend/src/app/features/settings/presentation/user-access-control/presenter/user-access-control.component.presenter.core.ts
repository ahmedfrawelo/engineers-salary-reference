import { Directive, OnDestroy, OnInit, effect, inject } from '@angular/core';
import { forkJoin, Subscription } from 'rxjs';
import {
  isIdentityRealtimeEvent,
  WebSocketService
} from '@infrastructure/realtime/websocket.service';
import type { DropdownOption } from '../../../../../shared/custom-dropdown/custom-dropdown.component';
import type {
  PermissionGroup,
  PermissionItem
} from '../../../../../core/authorization/permission-registry';
import {
  applyRosterResponseHelper,
  collectUserObjectsHelper,
  compareUsersHelper,
  displayedRosterHelper,
  ensureUserArrayHelper,
  exportRosterCsvHelper,
  extractBackendMessageHelper,
  extractObjectMapValuesHelper,
  extractUserListFromHelper,
  extractUsersHelper,
  findDeletedUserByEmailHelper,
  findUserArrayDeepHelper,
  hasUserIdentityFieldsHelper,
  isConflictErrorHelper,
  mapUserHelper,
  normalizePermissionCodesHelper,
  normalizeRoleFilterHelper,
  normalizeStatusLabelHelper,
  pruneSelectionHelper,
  resolveRosterVisibleCountHelper,
  resolveUserNameHelper,
  unwrapUserHelper
} from '../helpers/user-access-control.roster.helper';
import {
  bulkUpdateUserAccessStatus,
  closeAllUserAccessQuickEdits,
  closeUserAccessBulkDeleteModal,
  confirmUserAccessBulkDelete,
  isUserAccessEditLocked,
  openUserAccessBulkDeleteModal,
  saveUserAccessQuickEdit,
  toggleUserAccessEdit,
  toggleUserAccessQuickEdit,
  updateUserAccessQuickEdit,
  userAccessBulkDeleteCount,
  type UserAccessMutationsHost
} from '../helpers/user-access-control.mutations.helper';
import {
  closeUserAccessDeleteModal,
  confirmUserAccessDeleteUser,
  createUserAccessUser,
  deleteUserAccessUser,
  resetUserAccessProfile,
  restoreUserAccessDeletedUser,
  saveUserAccessUserEdits
} from '../helpers/user-access-control.profile-crud.helper';
import {
  normalizeUserAccessExpiresAt,
  normalizeUserAccessToken,
  resolveUserAccessAuthToken,
  type UserAccessAuthHost
} from '../helpers/user-access-control.auth.helper';
import { UserAccessControlComponentPermissions } from '../user-access-control.component.permissions';
import type { AccessTab, PermissionScope, RoleItem, UserRow } from '../user-access-control.types';

@Directive()
export abstract class UserAccessControlComponentPresenterCore
  extends UserAccessControlComponentPermissions
  implements OnInit, OnDestroy
{
  protected readonly websocket = inject(WebSocketService);
  protected copyTimer: ReturnType<typeof setTimeout> | null = null;
  protected readonly realtimeSubscription = new Subscription();
  private rosterRefreshAttempted = false;
  private rosterFallbackAttempted = false;
  private authCheckInProgress = false;
  private routeSelectionUserKey: string | null = null;
  private routeSelectionAppliedFor: string | null = null;
  // This effect triggers roster reload after the user re-authenticates.
  private readonly authReload = effect(() => {
    const session = this.authFacade.tokens();
    const token = this.normalizeToken(session?.accessToken ?? null);
    if (!token || !this.needsAuth() || this.loading()) {
      return;
    }
    if (this.lastAuthToken && this.normalizeToken(this.lastAuthToken) === token) {
      return;
    }
    const expiresAt = this.normalizeExpiresAt(session?.expiresAt);
    if (typeof expiresAt === 'number' && expiresAt <= Date.now()) {
      return;
    }
    this.loadRoster();
  });
  private lastAuthToken: string | null = null;

  ngOnInit(): void {
    this.debugLog('[UserAccess] Component initialized');
    this.bindRouteSelection();
    this.loadRoster();
    this.subscribeToRealtimeUpdates();
  }

  ngOnDestroy(): void {
    this.debugLog('[UserAccess] Component destroyed');
    this.realtimeSubscription.unsubscribe();
    if (this.copyTimer) {
      clearTimeout(this.copyTimer);
      this.copyTimer = null;
    }
  }

  setTab(next: AccessTab): void {
    if (this.tab() === next) {
      return;
    }
    if (next === 'permissions' && !this.canOpenAccessControlPermissionsWorkspace()) {
      this.permissionsError.set(
        "Access denied - You don't have permission to manage access-control rules"
      );
      return;
    }
    this.tab.set(next);
    if (next === 'permissions') {
      this.loadPermissionsView();
    }
  }

  protected abstract openUserDrawer(user: UserRow): void;

  setPermissionScope(scope: PermissionScope): void {
    if (scope === 'user' && !this.canManageAccessControlUserOverrides()) {
      this.permissionsError.set(
        "Access denied - You don't have permission to manage user overrides"
      );
      return;
    }
    if (scope === 'role' && !this.canOpenAccessControlPermissionsWorkspace()) {
      this.permissionsError.set("Access denied - You don't have permission to manage role access");
      return;
    }
    if (this.permissionScope() === scope) {
      return;
    }
    this.permissionScope.set(scope);
    this.permissionsError.set(null);
    if (scope === 'role' && !this.selectedRole() && this.roles().length) {
      this.selectRole(this.roles()[0]);
    }
    if (scope === 'user' && !this.loading() && !this.roster().length) {
      this.loadRoster();
    }
  }

  loadRoster(skipRefresh = false): void {
    this.loading.set(true);
    this.error.set(null);

    // Debug: inspect storage contents when debug logs are enabled.
    this.debugLog('[UserAccess] Checking storage...');
    const sessionData = sessionStorage.getItem('engineers-salary-reference.portal.session');
    const localData = localStorage.getItem('engineers-salary-reference.portal.session');
    this.debugLog('[UserAccess] sessionStorage:', sessionData ? 'EXISTS' : 'EMPTY');
    this.debugLog('[UserAccess] localStorage:', localData ? 'EXISTS' : 'EMPTY');

    if (sessionData) {
      try {
        const parsed = JSON.parse(sessionData);
        this.debugLog('[UserAccess] Session data:', {
          hasTokens: !!parsed.tokens,
          hasAccessToken: !!parsed.tokens?.accessToken,
          expiresAt: parsed.tokens?.expiresAt,
          isExpired: parsed.tokens?.expiresAt < Date.now(),
          timeUntilExpiry: parsed.tokens?.expiresAt
            ? Math.floor((parsed.tokens.expiresAt - Date.now()) / 1000) + 's'
            : 'N/A'
        });
      } catch (e) {
        console.error('[UserAccess] Failed to parse session data:', e);
      }
    }

    const authToken = this.resolveAuthToken();
    this.debugLog(
      '[UserAccess] Resolved auth token:',
      authToken ? 'EXISTS (' + authToken.substring(0, 20) + '...)' : 'NULL'
    );

    if (!authToken) {
      console.error('[UserAccess] No auth token found - user must login first');
      this.error.set('You need to sign in to view and manage users');
      this.needsAuth.set(true);
      this.loading.set(false);
      return;
    }

    this.needsAuth.set(false);
    this.lastAuthToken = authToken;
    if (!this.rolesLoaded()) {
      this.loadRoles(authToken);
    }

    // NOTE:
    // Older builds used /Users/active + /Users/inactive, but many backends expose a single /Users endpoint.
    // Using /Users also avoids false "session expired" when the split endpoints are missing (404) or permission-gated (403).
    this.debugLog('[UserAccess] Loading users from real API: GET /api/Users');

    this.api.get('Users', undefined, { authToken }).subscribe({
      next: (usersResponse: unknown) => this.applyRosterResponse(usersResponse),
      error: (err: unknown) => {
        console.error('[UserAccess] Failed to load users from backend:', err);
        const originalError = this.asRecord(err)?.originalError;
        if (originalError) {
          console.error('[UserAccess] Original error details:', originalError);
        }

        // Check if error is "No refresh token available" (from TokenRefreshService)
        const errorMessage = this.getErrorMessage(err) ?? '';
        // IMPORTANT: Don't match generic "refresh token" text (too broad and causes false "session expired").
        const isNoRefreshToken = /no\s+refresh\s+token\s+available/i.test(errorMessage);
        const hasRefreshToken = !!this.tokenRefresh.getRefreshToken();
        const status = this.getErrorStatus(err);

        // Real error handling
        if (status === 401) {
          // Try to refresh token if available
          if (!skipRefresh && hasRefreshToken && !this.rosterRefreshAttempted) {
            this.rosterRefreshAttempted = true;
            this.tokenRefresh.refreshToken().subscribe({
              next: () => {
                this.rosterRefreshAttempted = false;
                this.loadRoster(true);
              },
              error: refreshErr => {
                console.error('[UserAccess] Token refresh failed while loading users:', refreshErr);
                this.rosterRefreshAttempted = false;
                this.loading.set(false);
                this.handleRosterUnauthorized();
              }
            });
            return;
          }
          if (this.tryRosterFallback(authToken, '401 Unauthorized')) {
            return;
          }
          this.loading.set(false);
          this.handleRosterUnauthorized();
          return;
        }

        if (
          (status === 403 || status === 404) &&
          this.tryRosterFallback(authToken, String(status))
        ) {
          return;
        }

        this.loading.set(false);

        if (isNoRefreshToken) {
          // This usually means the backend requires refresh-token flow but the client doesn't have one stored.
          this.error.set('Session expired. Please sign in again to view users');
          this.needsAuth.set(true);
        } else if (status === 403) {
          this.error.set("Access denied - You don't have permission to view users");
          this.needsAuth.set(false);
        } else if (status === 404) {
          this.error.set('Users API endpoint not found (/Users). Contact support');
          this.needsAuth.set(false);
        } else if (status === 0) {
          this.error.set('Cannot connect to backend server - Check your connection');
          this.needsAuth.set(false);
        } else if (status !== null && status >= 500) {
          this.error.set('Server error - Please try again later');
          this.needsAuth.set(false);
        } else {
          this.error.set(this.getErrorMessage(err) || 'Failed to load users');
          this.needsAuth.set(false);
        }
      }
    });
  }

  private applyRosterResponse(usersResponse: unknown): void {
    applyRosterResponseHelper(this.helperContext(), usersResponse);
    this.openPendingRouteUser();
  }

  private bindRouteSelection(): void {
    this.realtimeSubscription.add(
      this.route.queryParamMap.subscribe(params => {
        const userKey =
          params.get('userId') ?? params.get('user') ?? params.get('id') ?? params.get('email');
        this.routeSelectionUserKey = this.normalizeRouteUserKey(userKey);

        if (!this.routeSelectionUserKey) {
          this.routeSelectionAppliedFor = null;
          return;
        }

        if (params.get('tab') === 'permissions') {
          this.setTab('permissions');
        } else {
          this.setTab('profile');
        }

        this.openPendingRouteUser();
      })
    );
  }

  private openPendingRouteUser(): void {
    const targetKey = this.routeSelectionUserKey;
    if (!targetKey || this.routeSelectionAppliedFor === targetKey) {
      return;
    }

    const target = this.roster().find(user => this.matchesRouteUserKey(user, targetKey));
    if (!target) {
      return;
    }

    this.routeSelectionAppliedFor = targetKey;
    this.openUserDrawer(target);
  }

  private matchesRouteUserKey(user: UserRow, targetKey: string): boolean {
    return [user.id, user.email]
      .map(value => this.normalizeRouteUserKey(value))
      .some(value => value === targetKey);
  }

  private normalizeRouteUserKey(value: string | null | undefined): string | null {
    const normalized = this.normalizeText(value).toLowerCase();
    return normalized || null;
  }

  private tryRosterFallback(authToken: string | null, reason: string): boolean {
    if (!authToken || this.rosterFallbackAttempted) {
      return false;
    }
    this.rosterFallbackAttempted = true;
    this.debugWarn(`[UserAccess] Users endpoint failed (${reason}); trying fallback endpoints.`);

    const pageSize = Math.max(this.defaultRosterPageSize * 25, 200);
    this.api.get('Users/paged', { page: 1, pageSize }, { authToken }).subscribe({
      next: response => {
        this.debugWarn('[UserAccess] Loaded users via /Users/paged fallback');
        this.applyRosterResponse(response);
      },
      error: pagedErr => {
        forkJoin([
          this.api.get('Users/active', undefined, { authToken }),
          this.api.get('Users/inactive', undefined, { authToken })
        ]).subscribe({
          next: ([activeResponse, inactiveResponse]) => {
            this.debugWarn(
              '[UserAccess] Loaded users via /Users/active + /Users/inactive fallback'
            );
            const merged = [
              ...this.extractUsers(activeResponse),
              ...this.extractUsers(inactiveResponse)
            ];
            this.applyRosterResponse(merged);
          },
          error: splitErr => {
            console.error('[UserAccess] Fallback endpoints failed:', splitErr);
            if (pagedErr?.originalError) {
              console.error(
                '[UserAccess] Original fallback error details:',
                pagedErr.originalError
              );
            }
            this.loading.set(false);
            this.rosterFallbackAttempted = false;
            this.finalizeRosterError(splitErr);
          }
        });
      }
    });

    return true;
  }

  private finalizeRosterError(err: unknown): void {
    // Check if error is "No refresh token available" (from TokenRefreshService)
    const errorMessage = this.getErrorMessage(err) ?? '';
    // IMPORTANT: Don't match generic "refresh token" text (too broad and causes false "session expired").
    const isNoRefreshToken = /no\s+refresh\s+token\s+available/i.test(errorMessage);
    const status = this.getErrorStatus(err);

    if (status === 401) {
      this.handleRosterUnauthorized();
      return;
    }
    if (isNoRefreshToken) {
      // This usually means the backend requires refresh-token flow but the client doesn't have one stored.
      this.error.set('Session expired. Please sign in again to view users');
      this.needsAuth.set(true);
    } else if (status === 403) {
      this.error.set("Access denied - You don't have permission to view users");
      this.needsAuth.set(false);
    } else if (status === 404) {
      this.error.set('Users API endpoint not found (/Users). Contact support');
      this.needsAuth.set(false);
    } else if (status === 0) {
      this.error.set('Cannot connect to backend server - Check your connection');
      this.needsAuth.set(false);
    } else if (status !== null && status >= 500) {
      this.error.set('Server error - Please try again later');
      this.needsAuth.set(false);
    } else {
      this.error.set(this.getErrorMessage(err) || 'Failed to load users');
      this.needsAuth.set(false);
    }
  }

  protected extractUsers(response: unknown): unknown[] {
    return extractUsersHelper(this.helperContext(), response);
  }

  private extractUserListFrom(candidate: unknown): unknown[] | null {
    return extractUserListFromHelper(this.helperContext(), candidate);
  }

  private extractObjectMapValues(candidate: unknown): unknown[] | null {
    return extractObjectMapValuesHelper(this.helperContext(), candidate);
  }

  private findUserArrayDeep(root: unknown, maxDepth = 5): unknown[] | null {
    return findUserArrayDeepHelper(this.helperContext(), root, maxDepth);
  }

  private collectUserObjects(root: unknown, maxDepth = 6): unknown[] {
    return collectUserObjectsHelper(this.helperContext(), root, maxDepth);
  }

  private isUserArray(value: unknown[]): boolean {
    return value.some(item => this.isUserLike(item));
  }

  private isObjectArray(value: unknown[]): boolean {
    if (!value.length) {
      return false;
    }
    return value.every(item => item && typeof item === 'object' && !Array.isArray(item));
  }

  private isUserLike(value: unknown): boolean {
    if (!value || typeof value !== 'object') {
      return false;
    }
    if (this.hasUserIdentityFields(value)) {
      return true;
    }
    const nested = this.unwrapUser(value);
    if (nested && nested !== value) {
      return this.hasUserIdentityFields(nested);
    }
    return false;
  }

  private hasUserIdentityFields(value: unknown): boolean {
    return hasUserIdentityFieldsHelper(this.helperContext(), value);
  }

  private extractRoleItems(response: unknown): RoleItem[] {
    const list = this.extractUsers(response);
    return list
      .map(item => {
        const record = this.asRecord(item);
        const name = record?.name || record?.Name || record?.roleName || record?.RoleName || '';
        const id = record?.id || record?.Id || record?.roleId || record?.RoleId || name;
        const normalizedName =
          record?.normalizedName ||
          record?.NormalizedName ||
          record?.normalized ||
          record?.Normalized ||
          null;
        return {
          id: typeof id === 'string' ? id : String(id ?? ''),
          name: typeof name === 'string' ? name.trim() : '',
          normalizedName:
            typeof normalizedName === 'string' && normalizedName.trim()
              ? normalizedName.trim()
              : null
        };
      })
      .filter(role => !!role.name);
  }

  protected extractPermissions(response: unknown): string[] {
    const direct = this.extractPermissionList(response);
    if (direct) {
      return direct;
    }

    const source = this.asRecord(response);
    const nested =
      source?.permissions ??
      source?.Permissions ??
      source?.permissionCodes ??
      source?.PermissionCodes ??
      source?.permissionIds ??
      source?.PermissionIds ??
      source?.data ??
      source?.Data ??
      source?.result ??
      source?.Result ??
      source?.payload ??
      source?.Payload ??
      source?.value ??
      source?.Value;
    const nestedList = this.extractPermissionList(nested);
    if (nestedList) {
      return nestedList;
    }

    const list = this.extractUsers(response);
    return this.normalizePermissionCodes(list);
  }

  private extractPermissionList(payload: unknown): string[] | null {
    if (!payload) {
      return null;
    }
    if (Array.isArray(payload)) {
      const normalized = this.normalizePermissionCodes(payload);
      return normalized.length ? normalized : [];
    }
    if (typeof payload !== 'object') {
      return null;
    }
    const record = payload as Record<string, unknown>;
    const direct =
      record.permissions ??
      record.Permissions ??
      record.permissionCodes ??
      record.PermissionCodes ??
      record.permissionIds ??
      record.PermissionIds ??
      record.values ??
      record.Values;
    if (Array.isArray(direct)) {
      const normalized = this.normalizePermissionCodes(direct);
      return normalized.length ? normalized : [];
    }
    return null;
  }

  protected normalizePermissionCodes(items: unknown[]): string[] {
    return normalizePermissionCodesHelper(this.helperContext(), items);
  }

  private extractPermissionTree(response: unknown): PermissionGroup[] {
    const list = this.extractUsers(response);
    return list
      .map(group => {
        const groupRecord = this.asRecord(group);
        const groupName = groupRecord?.group || groupRecord?.Group || '';
        const rawPermissions = groupRecord?.permissions || groupRecord?.Permissions;
        const permissions = Array.isArray(rawPermissions)
          ? rawPermissions.map((perm: unknown) => {
              const permRecord = this.asRecord(perm);
              return {
                code:
                  typeof permRecord?.code === 'string'
                    ? permRecord.code
                    : typeof permRecord?.Code === 'string'
                      ? permRecord.Code
                      : '',
                label:
                  typeof permRecord?.label === 'string'
                    ? permRecord.label
                    : typeof permRecord?.Label === 'string'
                      ? permRecord.Label
                      : ''
              };
            })
          : [];
        return {
          group: typeof groupName === 'string' ? groupName : '',
          permissions: permissions.filter((perm: PermissionItem) => !!perm.code)
        };
      })
      .filter(group => !!group.group);
  }

  private collectRoles(users: UserRow[]): string[] {
    const roles = new Set<string>();
    for (const user of users) {
      this.normalizeRoles(user.roles ?? user.role).forEach(role => roles.add(role));
    }
    return Array.from(roles);
  }

  private setAvailableRoles(roles: string[]): void {
    const unique = Array.from(new Set(roles.filter(Boolean)));
    unique.sort((a, b) => a.localeCompare(b));
    this.availableRoles.set(unique);
    if (unique.length && !unique.includes(this.profile.role)) {
      this.profile.role = unique[0];
    }
  }

  protected loadRoles(
    authToken: string,
    updateSelection = false,
    preferredRoleName?: string,
    force = false
  ): void {
    if (!this.canReadAccessControlRoles()) {
      this.rolesLoading.set(false);
      this.rolesError.set(null);
      this.roles.set([]);
      this.rolesLoaded.set(false);
      return;
    }
    if (this.rolesLoaded() && !force) {
      this.rolesLoading.set(false);
      this.rolesError.set(null);
      if (updateSelection) {
        const roles = this.roles();
        const preferred = preferredRoleName || this.selectedRole()?.name;
        const nextRole = roles.find(role => role.name === preferred) || roles[0] || null;
        if (nextRole) {
          this.selectRole(nextRole, authToken);
        } else {
          this.selectedRole.set(null);
          this.selectedRolePermissions.set(new Set());
        }
      }
      return;
    }
    this.rolesLoading.set(true);
    this.rolesError.set(null);
    this.api.get('Roles', undefined, { authToken }).subscribe({
      next: response => {
        const roles = this.extractRoleItems(response);
        this.roles.set(roles);
        this.setAvailableRoles(roles.map(role => role.name));
        this.rolesLoading.set(false);
        this.rolesLoaded.set(true);

        if (updateSelection) {
          const preferred = preferredRoleName || this.selectedRole()?.name;
          const nextRole = roles.find(role => role.name === preferred) || roles[0] || null;
          if (nextRole) {
            this.selectRole(nextRole, authToken);
          } else {
            this.selectedRole.set(null);
            this.selectedRolePermissions.set(new Set());
          }
        }
      },
      error: err => {
        console.error('[UserAccess] Failed to load roles:', err);
        this.roles.set([]);
        this.setAvailableRoles([]);
        this.rolesLoading.set(false);
        this.rolesError.set('Could not load roles from server.');
        this.rolesLoaded.set(false);
      }
    });
  }

  private authHost(): UserAccessAuthHost {
    return this as unknown as UserAccessAuthHost;
  }

  protected mutationsHost(): UserAccessMutationsHost {
    return this as unknown as UserAccessMutationsHost;
  }

  private normalizeToken(raw?: string | null): string | null {
    return normalizeUserAccessToken(raw);
  }

  private normalizeExpiresAt(raw: unknown): number | undefined {
    return normalizeUserAccessExpiresAt(raw);
  }

  protected resolveAuthToken(): string | null {
    return resolveUserAccessAuthToken(this.authHost());
  }

  private verifyAuthToken(authToken: string, onValid: () => void, onInvalid: () => void): void {
    if (this.authCheckInProgress) {
      return;
    }
    this.authCheckInProgress = true;
    this.api.get('Auth/me', undefined, { authToken }).subscribe({
      next: () => {
        this.authCheckInProgress = false;
        onValid();
      },
      error: authErr => {
        this.authCheckInProgress = false;
        // IMPORTANT:
        // - 401 => token/session is invalid/expired
        // - 403 => token is valid but user lacks permission to access this endpoint
        // Treating 403 as "invalid session" causes unintended sign-out on pages that
        // probe protected endpoints (like /Auth/me) with different permission rules.
        if (authErr?.status === 401) {
          onInvalid();
          return;
        }
        if (authErr?.status === 403) {
          onValid();
          return;
        }
        this.error.set(authErr?.message || 'Failed to verify session');
        this.needsAuth.set(false);
      }
    });
  }

  private handleRosterUnauthorized(): void {
    const authProbeToken = this.lastAuthToken ?? this.resolveAuthToken();
    if (authProbeToken) {
      this.verifyAuthToken(
        authProbeToken,
        () => {
          this.error.set("Access denied - You don't have permission to view users");
          this.needsAuth.set(false);
        },
        () => {
          this.error.set('Session expired. Please sign in again to view users');
          this.needsAuth.set(true);
          // Do NOT force global logout from this page.
          // Let the rest of the app decide (and avoid kicking users out due to a single failing endpoint).
        }
      );
      return;
    }
    this.error.set('You need to sign in to view and manage users');
    this.needsAuth.set(true);
  }

  private requireRosterAuth(message = 'You need to sign in to manage users'): boolean {
    const token = this.resolveAuthToken();
    if (!token) {
      this.error.set(message);
      this.needsAuth.set(true);
      return false;
    }
    this.needsAuth.set(false);
    this.lastAuthToken = token;
    return true;
  }

  private resolveUserName(user: unknown): string {
    return resolveUserNameHelper(this.helperContext(), user);
  }

  private resolveUserId(user: unknown): string | null {
    const record = this.asRecord(user);
    const id =
      record?.id ??
      record?.Id ??
      record?.userId ??
      record?.UserId ??
      record?.user_id ??
      record?.User_Id ??
      record?.uid ??
      record?.UID;
    if (id === null || id === undefined) {
      return null;
    }
    return typeof id === 'string' ? id : String(id);
  }

  private unwrapUser(payload: unknown): unknown {
    return unwrapUserHelper(this.helperContext(), payload);
  }

  private extractBackendMessage(payload: unknown): string | null {
    return extractBackendMessageHelper(this.helperContext(), payload);
  }

  protected formatRequestError(err: unknown, fallback: string): string {
    const record = this.asRecord(err);
    const originalError = this.asRecord(record?.originalError);
    const status =
      typeof record?.status === 'number'
        ? record.status
        : typeof originalError?.status === 'number'
          ? originalError.status
          : null;
    const rawMessage =
      this.extractBackendMessage(originalError?.error) ||
      this.extractBackendMessage(record?.error) ||
      this.toMessage(record?.message);
    const message = this.sanitizeRequestErrorMessage(rawMessage, status);
    if (message) {
      return message;
    }
    return status ? `${fallback} (status ${status})` : fallback;
  }

  private sanitizeRequestErrorMessage(
    value: string | null | undefined,
    status: number | null
  ): string | null {
    const message = this.toMessage(value);
    if (!message) {
      return this.resolveHttpErrorFallback(status);
    }

    if (this.looksLikeHtmlErrorDocument(message)) {
      return this.resolveHttpErrorFallback(status) ?? 'Server error. Please try again later.';
    }

    return message;
  }

  private looksLikeHtmlErrorDocument(value: string): boolean {
    return /<!doctype html|<html\b|<head\b|<body\b|<\/html>|<\/body>|nginx|bad gateway/i.test(
      value
    );
  }

  private resolveHttpErrorFallback(status: number | null): string | null {
    if (status === 0) {
      return 'Cannot connect to the server. Check your connection and try again.';
    }
    if (status === 502) {
      return 'Server gateway error. Please try again in a moment.';
    }
    if (status === 503) {
      return 'Service is temporarily unavailable. Please try again shortly.';
    }
    if (status === 504) {
      return 'Server timeout. Please try again.';
    }
    if (status !== null && status >= 500) {
      return 'Server error. Please try again later.';
    }
    return null;
  }

  private isConflictError(err: unknown): boolean {
    return isConflictErrorHelper(this.helperContext(), err);
  }

  formatRoles(user?: UserRow | null): string {
    if (!user) {
      return 'Role pending';
    }
    const roles = this.normalizeRoles(user.roles ?? user.role);
    if (roles.length) {
      return roles.join(', ');
    }
    const fallback = this.normalizeText(user.role);
    return fallback || 'Role pending';
  }

  getInitials(value: string): string {
    const cleaned = String(value ?? '').trim();
    if (!cleaned) {
      return '?';
    }
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  totalUsers(): number {
    return this.roster().length;
  }

  activeUsers(): number {
    return this.roster().filter(user => (user.status || '').toLowerCase() === 'active').length;
  }

  suspendedUsers(): number {
    return this.roster().filter(user => {
      const status = (user.status || '').toLowerCase();
      return status === 'suspended' || status === 'inactive' || status === 'blocked';
    }).length;
  }

  invitedUsers(): number {
    return this.roster().filter(user => (user.status || '').toLowerCase() === 'invited').length;
  }

  roleOptions(): string[] {
    const roles = this.availableRoles();
    return roles.length ? roles : ['User'];
  }

  roleDropdownOptions(): DropdownOption[] {
    return this.roleOptions().map(role => ({ value: role, text: role }));
  }

  roleFilterOptions(): DropdownOption[] {
    const roles = this.roleOptions();
    return [
      { value: 'All', text: 'All roles' },
      ...roles.map(role => ({ value: role, text: role }))
    ];
  }

  protected subscribeToRealtimeUpdates(): void {
    // Overridden by the access-control user flows layer.
  }
}
