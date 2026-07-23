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
  formatUserAccessUserLabel,
  isUserAccessEditLocked,
  openUserAccessBulkDeleteModal,
  reloadUserAccessCollections,
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
import { UserAccessControlComponentPresenterRoster } from './user-access-control.component.presenter.roster';

@Directive()
export abstract class UserAccessControlComponentPresenterUsers extends UserAccessControlComponentPresenterRoster {
  private identityRefreshTimer: ReturnType<typeof setTimeout> | null = null;

  override ngOnDestroy(): void {
    if (this.identityRefreshTimer) {
      clearTimeout(this.identityRefreshTimer);
      this.identityRefreshTimer = null;
    }

    super.ngOnDestroy();
  }

  createUser(): void {
    if (!this.canCreateAccessControlUser()) {
      this.error.set("Access denied - You don't have permission to create users");
      return;
    }
    return createUserAccessUser(this.mutationsHost());
  }

  private findDeletedUserByEmail(email: string): void {
    return findDeletedUserByEmailHelper(this.helperContext(), email);
  }

  restoreDeletedUser(): void {
    if (!this.canEditAccessControlUser()) {
      this.error.set("Access denied - You don't have permission to restore users");
      return;
    }
    return restoreUserAccessDeletedUser(this.mutationsHost());
  }

  openDeletedDrawer(): void {
    if (!this.canViewAccessControl()) {
      this.deletedError.set("Access denied - You don't have permission to view users");
      return;
    }
    this.deletedUserQuery = '';
    this.deletedDrawerOpen.set(true);
    this.loadDeletedRoster();
  }

  closeDeletedDrawer(): void {
    this.deletedUserQuery = '';
    this.deletedDrawerOpen.set(false);
    this.deletedError.set(null);
  }

  filteredDeletedRoster(): UserRow[] {
    const query = this.safeLower(this.deletedUserQuery);
    let list = [...this.deletedRoster()];
    if (query) {
      list = list.filter(user => this.userMatchesQuery(user, query));
    }
    return list.sort((a, b) => this.compareUsers(a, b));
  }

  hasDeletedSearchQuery(): boolean {
    return !!(this.deletedUserQuery ?? '').trim();
  }

  clearDeletedSearch(): void {
    this.deletedUserQuery = '';
  }

  hasDeletedSearchMiss(): boolean {
    return (
      this.hasDeletedSearchQuery() &&
      !!this.deletedRoster().length &&
      !this.filteredDeletedRoster().length
    );
  }

  loadDeletedRoster(): void {
    const authToken = this.resolveAuthToken();
    if (!authToken) {
      this.deletedError.set('You need to sign in');
      return;
    }
    this.deletedLoading.set(true);
    this.deletedError.set(null);
    this.api.get('Users/deleted', undefined, { authToken }).subscribe({
      next: (response: unknown) => {
        const users = this.extractUsers(response);
        const mapped = users
          .map(u => this.mapUser(u, 'Suspended'))
          .filter((u): u is UserRow => !!u);
        this.deletedRoster.set(mapped);
        this.deletedLoading.set(false);
      },
      error: (err: unknown) => {
        this.deletedLoading.set(false);
        this.deletedError.set(this.formatRequestError(err, 'Failed to load deleted users'));
      }
    });
  }

  restoreFromDeletedDrawer(user: UserRow): void {
    if (!this.canEditAccessControlUser()) {
      this.deletedError.set("Access denied - You don't have permission to restore users");
      return;
    }
    if (!user.id || this.restoringUserId()) {
      return;
    }
    const authToken = this.resolveAuthToken();
    if (!authToken) {
      this.deletedError.set('You need to sign in');
      return;
    }
    this.restoringUserId.set(user.id);
    this.deletedError.set(null);
    this.api.put(`Users/${user.id}/restore`, {}).subscribe({
      next: () => {
        this.restoringUserId.set(null);
        this.deletedRoster.set(this.deletedRoster().filter(u => u.id !== user.id));
        this.loadRoster();
        const host = this.mutationsHost();
        host.undoToast.updated(
          `"${formatUserAccessUserLabel(user)}" restored`,
          () => {
            host.api.delete(`Users/${user.id}`).subscribe({
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
      error: (err: unknown) => {
        this.restoringUserId.set(null);
        this.deletedError.set(this.formatRequestError(err, 'Failed to restore user'));
      }
    });
  }

  openHardDeleteModal(user: UserRow): void {
    if (!this.canDeleteAccessControlUser()) {
      this.deletedError.set("Access denied - You don't have permission to delete users");
      return;
    }
    this.hardDeleteCandidate.set(user);
  }

  closeHardDeleteModal(): void {
    if (this.saving()) {
      return;
    }
    this.hardDeleteCandidate.set(null);
  }

  confirmHardDelete(): void {
    if (!this.canDeleteAccessControlUser()) {
      this.deletedError.set("Access denied - You don't have permission to delete users");
      this.hardDeleteCandidate.set(null);
      return;
    }
    const user = this.hardDeleteCandidate();
    if (!user?.id) {
      this.hardDeleteCandidate.set(null);
      return;
    }
    const authToken = this.resolveAuthToken();
    if (!authToken) {
      this.deletedError.set('You need to sign in');
      this.hardDeleteCandidate.set(null);
      return;
    }
    this.saving.set(true);
    this.deletedError.set(null);
    this.api.delete(`Users/${user.id}/hard`).subscribe({
      next: () => {
        this.saving.set(false);
        this.hardDeleteCandidate.set(null);
        this.deletedRoster.set(this.deletedRoster().filter(u => u.id !== user.id));
        this.mutationsHost().toast.success('User permanently deleted.');
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.hardDeleteCandidate.set(null);
        this.deletedError.set(this.formatRequestError(err, 'Failed to permanently delete user'));
      }
    });
  }

  saveUserEdits(user: UserRow): void {
    const draft = user.edit;
    if (!draft) {
      this.error.set('User data is missing');
      return;
    }

    const currentRole = (user.role || user.roles?.[0] || 'User').trim();
    const currentStatus = (user.status || 'Suspended').trim().toLowerCase();
    const nextStatus = (draft.status || currentStatus).trim().toLowerCase();
    const hasPasswordChange = !!draft.password.trim();
    const hasProfileChange =
      draft.name.trim() !== (user.name ?? '').trim() ||
      draft.email.trim() !== (user.email ?? '').trim() ||
      nextStatus !== currentStatus ||
      draft.role.trim() !== currentRole ||
      (draft.department ?? '').trim() !== (user.department ?? '').trim() ||
      (draft.position ?? '').trim() !== (user.position ?? '').trim() ||
      (draft.phoneNumber ?? '').trim() !== (user.phoneNumber ?? '').trim();

    if (hasProfileChange && !this.canEditAccessControlUser()) {
      this.error.set("Access denied - You don't have permission to edit users");
      return;
    }

    if (hasPasswordChange && !this.canResetAccessControlPasswords()) {
      this.error.set("Access denied - You don't have permission to reset passwords");
      return;
    }

    return saveUserAccessUserEdits(this.mutationsHost(), user);
  }

  deleteUser(user: UserRow): void {
    if (!this.canDeleteAccessControlUser()) {
      this.error.set("Access denied - You don't have permission to delete users");
      return;
    }
    return deleteUserAccessUser(this.mutationsHost(), user);
  }

  closeDeleteModal(): void {
    return closeUserAccessDeleteModal(this.mutationsHost());
  }

  confirmDeleteUser(): void {
    if (!this.canDeleteAccessControlUser()) {
      this.error.set("Access denied - You don't have permission to delete users");
      return;
    }
    return confirmUserAccessDeleteUser(this.mutationsHost());
  }

  goToLogin(): void {
    this.debugLog('[UserAccess] Redirecting to login page...');
    this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
  }

  forceLogoutUser(user: UserRow): void {
    if (!this.canEditAccessControlUser()) {
      this.error.set("Access denied - You don't have permission to manage user sessions");
      return;
    }
    if (!user.id || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.api.post(`Users/${user.id}/logout`, {}).subscribe({
      next: () => {
        this.saving.set(false);
        this.mutationsHost().toast.success(`"${formatUserAccessUserLabel(user)}" was signed out.`);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(this.formatRequestError(err, 'Failed to force logout user'));
      }
    });
  }

  unlockUserAccount(user: UserRow): void {
    if (!this.canEditAccessControlUser()) {
      this.error.set("Access denied - You don't have permission to edit users");
      return;
    }
    if (!user.id || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.api.put(`Users/${user.id}/unlock`, {}).subscribe({
      next: () => {
        this.saving.set(false);
        const updatedRoster = this.roster().map(u =>
          (u.id || u.email) === (user.id || user.email)
            ? { ...u, failedAttempts: 0, lockedUntil: null }
            : u
        );
        this.roster.set(updatedRoster);
        this.mutationsHost().toast.success(
          `"${formatUserAccessUserLabel(user)}" account unlocked.`
        );
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(this.formatRequestError(err, 'Failed to unlock account'));
      }
    });
  }

  protected override subscribeToRealtimeUpdates(): void {
    this.realtimeSubscription.add(
      this.websocket.events().subscribe({
        next: event => {
          if (!isIdentityRealtimeEvent(event) || this.loading()) {
            return;
          }

          this.scheduleIdentityRefresh();
        },
        error: error => {
          console.error('[UserAccess] Realtime subscription error:', error);
        }
      })
    );
  }

  private scheduleIdentityRefresh(): void {
    if (this.identityRefreshTimer) {
      clearTimeout(this.identityRefreshTimer);
    }

    // Coalesce bursts of identity events so role/permission batches do not trigger reload storms.
    this.identityRefreshTimer = setTimeout(() => {
      this.identityRefreshTimer = null;
      this.loadRoster();
      if (this.tab() === 'permissions') {
        this.loadPermissionsView();
      }
    }, 120);
  }
}
