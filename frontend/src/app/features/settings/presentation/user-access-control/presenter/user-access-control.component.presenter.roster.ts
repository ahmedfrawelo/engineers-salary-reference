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
import { UserAccessControlComponentPresenterCore } from './user-access-control.component.presenter.core';

@Directive()
export abstract class UserAccessControlComponentPresenterRoster extends UserAccessControlComponentPresenterCore {
  onRosterFilterChange(): void {
    this.resetRosterPagination();
    this.clearSelection();
    this.closeAllQuickEdits();
  }

  setRosterSort(value: string): void {
    this.rosterSort = value;
    this.resetRosterPagination();
    this.closeAllQuickEdits();
  }

  setRosterPageSize(value: string): void {
    const next = Number.parseInt(value, 10);
    const safe = Number.isFinite(next) && next > 0 ? next : this.defaultRosterPageSize;
    this.rosterPageSize = safe;
    this.rosterVisibleCount = safe;
  }

  private resolveRosterPageSize(): number {
    const configured = Number(this.rosterPageSize);
    if (Number.isFinite(configured) && configured > 0) {
      return configured;
    }
    return this.defaultRosterPageSize;
  }

  setRosterStatusFilter(value: string): void {
    this.rosterStatusFilter = value;
    this.onRosterFilterChange();
  }

  setRosterRoleFilter(value: string): void {
    this.rosterRoleFilter = value;
    this.onRosterFilterChange();
  }

  hasRosterFilters(): boolean {
    return (
      this.rosterQuery.trim().length > 0 ||
      this.rosterStatusFilter !== 'All' ||
      this.rosterRoleFilter !== 'All'
    );
  }

  resetRosterFilters(): void {
    this.rosterQuery = '';
    this.rosterStatusFilter = 'All';
    this.rosterRoleFilter = 'All';
    this.resetRosterPagination();
    this.clearSelection();
    this.closeAllQuickEdits();
  }

  resetRosterView(): void {
    this.rosterQuery = '';
    this.rosterStatusFilter = 'All';
    this.rosterRoleFilter = 'All';
    this.rosterSort = 'Status';
    this.rosterPageSize = this.defaultRosterPageSize;
    this.rosterVisibleCount = this.defaultRosterPageSize;
    this.showSelectedOnly = false;
    this.clearSelection();
    this.closeAllQuickEdits();
  }

  private normalizeRosterFilters(): void {
    const statusValues = this.statusFilterOptions.map(option => option.value);
    this.rosterStatusFilter = this.normalizeSelectValue(
      this.rosterStatusFilter,
      statusValues,
      this.statusFilterOptions,
      'All'
    );

    const roleOptions = this.roleFilterOptions();
    const roleValues = roleOptions.map(option => option.value);
    this.rosterRoleFilter = this.normalizeSelectValue(
      this.rosterRoleFilter,
      roleValues,
      roleOptions,
      'All'
    );

    const sortValues = this.rosterSortOptions.map(option => option.value);
    this.rosterSort = this.normalizeSelectValue(
      this.rosterSort,
      sortValues,
      this.rosterSortOptions,
      'Status'
    );

    const pageValues = this.pageSizeOptions
      .map(option => Number.parseInt(option.value, 10))
      .filter(value => Number.isFinite(value));
    if (!Number.isFinite(this.rosterPageSize) || !pageValues.includes(this.rosterPageSize)) {
      this.rosterPageSize = this.defaultRosterPageSize;
    }
    if (!Number.isFinite(this.rosterVisibleCount) || this.rosterVisibleCount <= 0) {
      this.rosterVisibleCount = this.rosterPageSize;
    }
  }

  private normalizeSelectValue(
    current: string,
    values: string[],
    options: DropdownOption[],
    fallback: string
  ): string {
    if (values.includes(current)) {
      return current;
    }
    const match = options.find(option => option.text === current);
    if (match) {
      return match.value;
    }
    return values.includes(fallback) ? fallback : (values[0] ?? current);
  }

  private ensureRosterVisible(): void {
    if (!this.roster().length) {
      return;
    }
    const filtered = this.filteredRosterCount();
    if (filtered === 0) {
      this.resetRosterView();
    }
  }

  clearRosterQuery(): void {
    this.rosterQuery = '';
    this.onRosterFilterChange();
  }

  resetRosterPagination(): void {
    this.rosterVisibleCount = this.resolveRosterPageSize();
  }

  private isDefaultRosterView(): boolean {
    return (
      !this.rosterQuery.trim() &&
      this.rosterStatusFilter === 'All' &&
      this.rosterRoleFilter === 'All' &&
      this.rosterSort === 'Status' &&
      this.rosterPageSize === this.defaultRosterPageSize &&
      !this.showSelectedOnly &&
      this.selectedKeys().size === 0
    );
  }

  private resolveRosterVisibleCount(): number {
    return resolveRosterVisibleCountHelper(this.helperContext());
  }

  filteredRosterCount(): number {
    const displayed = this.displayedRoster();
    if (!displayed.length) {
      const rosterFallback = this.ensureUserArray(this.roster());
      if (rosterFallback.length && !this.hasRosterFilters() && !this.showSelectedOnly) {
        return rosterFallback.length;
      }
    }
    return displayed.length;
  }

  pagedRoster(): UserRow[] {
    const list = this.displayedRoster();
    const limit = this.resolveRosterVisibleCount();
    const page = list.slice(0, limit);
    if (!page.length) {
      const rosterFallback = this.ensureUserArray(this.roster());
      if (rosterFallback.length && !this.hasRosterFilters() && !this.showSelectedOnly) {
        const fallbackLimit = limit > 0 ? limit : this.resolveRosterPageSize();
        return rosterFallback.slice(0, fallbackLimit);
      }
    }
    return page;
  }

  resolvedRosterForView(): UserRow[] {
    const page = this.pagedRoster();
    if (Array.isArray(page) && page.length) {
      return page;
    }
    const displayed = this.displayedRoster();
    if (Array.isArray(displayed) && displayed.length) {
      return displayed;
    }
    return this.ensureUserArray(this.roster());
  }

  hasMoreRoster(): boolean {
    const limit = this.resolveRosterVisibleCount();
    return this.displayedRoster().length > limit;
  }

  loadMoreRoster(): void {
    const list = this.displayedRoster();
    const limit = this.resolveRosterVisibleCount();
    const pageSize = this.resolveRosterPageSize();
    this.rosterVisibleCount = Math.min(limit + pageSize, list.length);
  }

  hasVisibleRoster(): boolean {
    return this.pagedRoster().length > 0;
  }

  selectedCount(): number {
    return this.selectedKeys().size;
  }

  isUserSelected(user: UserRow): boolean {
    const key = this.getUserKey(user);
    if (!key) {
      return false;
    }
    return this.selectedKeys().has(key);
  }

  onUserSelectionChange(user: UserRow, event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.toggleUserSelection(user, !!target?.checked);
  }

  toggleUserSelection(user: UserRow, selected: boolean): void {
    const key = this.getUserKey(user);
    if (!key) {
      return;
    }
    const next = new Set(this.selectedKeys());
    if (selected) {
      next.add(key);
    } else {
      next.delete(key);
    }
    this.selectedKeys.set(next);
    if (!next.size && this.showSelectedOnly) {
      this.showSelectedOnly = false;
    }
  }

  allVisibleSelected(): boolean {
    const visible = this.pagedRoster();
    if (!visible.length) {
      return false;
    }
    return visible.every(user => {
      const key = this.getUserKey(user);
      return key ? this.selectedKeys().has(key) : false;
    });
  }

  isPartialSelection(): boolean {
    const visible = this.pagedRoster();
    if (!visible.length) {
      return false;
    }
    const selected = visible.filter(user => {
      const key = this.getUserKey(user);
      return key ? this.selectedKeys().has(key) : false;
    }).length;
    return selected > 0 && selected < visible.length;
  }

  onSelectAllChange(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.toggleSelectAllVisible(!!target?.checked);
  }

  toggleSelectAllVisible(selected: boolean): void {
    const visible = this.pagedRoster();
    const next = new Set(this.selectedKeys());
    for (const user of visible) {
      const key = this.getUserKey(user);
      if (!key) {
        continue;
      }
      if (selected) {
        next.add(key);
      } else {
        next.delete(key);
      }
    }
    this.selectedKeys.set(next);
    if (!next.size && this.showSelectedOnly) {
      this.showSelectedOnly = false;
    }
  }

  clearSelection(): void {
    this.selectedKeys.set(new Set());
    this.bulkDeleteKeys.set(null);
    this.showSelectedOnly = false;
  }

  toggleShowSelectedOnly(next: boolean): void {
    this.showSelectedOnly = next;
    this.resetRosterPagination();
    this.closeAllQuickEdits();
  }

  selectAllFiltered(): void {
    const list = this.displayedRoster();
    const next = new Set(this.selectedKeys());
    for (const user of list) {
      const key = this.getUserKey(user);
      if (key) {
        next.add(key);
      }
    }
    this.selectedKeys.set(next);
  }

  allFilteredSelected(): boolean {
    const list = this.displayedRoster();
    if (!list.length) {
      return false;
    }
    return list.every(user => {
      const key = this.getUserKey(user);
      return key ? this.selectedKeys().has(key) : false;
    });
  }

  hasActiveChips(): boolean {
    return (
      !!this.rosterQuery.trim() ||
      this.rosterStatusFilter !== 'All' ||
      this.rosterRoleFilter !== 'All' ||
      this.rosterSort !== 'Status' ||
      this.showSelectedOnly ||
      this.rosterPageSize !== this.defaultRosterPageSize
    );
  }

  rosterSortLabel(): string {
    const option = this.rosterSortOptions.find(item => item.value === this.rosterSort);
    return option?.text ?? 'Sort';
  }

  pageSizeLabel(value: number): string {
    return `${value}`;
  }

  private normalizeStatusFilter(): string {
    const raw = this.rosterStatusFilter.trim().toLowerCase();
    if (!raw) {
      return 'all';
    }
    if (raw.includes('all')) {
      return 'all';
    }
    if (raw.includes('active')) {
      return 'active';
    }
    if (raw.includes('invite') || raw.includes('pending')) {
      return 'invited';
    }
    if (raw.includes('suspend') || raw.includes('inactive') || raw.includes('block')) {
      return 'suspended';
    }
    return raw;
  }

  private normalizeRoleFilter(): string {
    return normalizeRoleFilterHelper(this.helperContext());
  }

  readonly trackByUser = (index: number, user: UserRow | null | undefined): string => {
    if (!user || typeof user !== 'object') {
      return `row-${index}`;
    }
    const key = this.getUserKey(user);
    return key ? `${key}-${index}` : `row-${index}`;
  };

  permissionUsers(): UserRow[] {
    const query = this.safeLower(this.permissionUserQuery);
    let list = [...this.ensureUserArray(this.roster())];
    if (query) {
      list = list.filter(user => this.userMatchesQuery(user, query));
    }
    return list.sort((a, b) => this.compareUsers(a, b));
  }

  isSelectedUser(user: UserRow): boolean {
    const selected = this.selectedUser();
    if (!selected) {
      return false;
    }
    return this.getUserKey(user) === this.getUserKey(selected);
  }

  displayedRoster(): UserRow[] {
    return displayedRosterHelper(this.helperContext());
  }

  formatDate(value?: string | null): string {
    if (!value) {
      return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return this.dateFormatter.format(date);
  }

  formatDateTime(value?: string | null): string {
    if (!value) {
      return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return this.dateTimeFormatter.format(date);
  }

  exportRosterCsv(): void {
    return exportRosterCsvHelper(this.helperContext());
  }

  private escapeCsv(value: unknown): string {
    const text = value == null ? '' : String(value);
    if (/[",\n\r]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  copyEmail(user: UserRow): void {
    const email = (user.email || '').trim();
    if (!email) {
      return;
    }
    const write = () => {
      if (this.copyTimer) {
        clearTimeout(this.copyTimer);
      }
      this.copiedEmail.set(email);
      this.copyTimer = setTimeout(() => this.copiedEmail.set(null), 1500);
    };
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(email)
        .then(write)
        .catch(() => this.copyEmailFallback(email, write));
      return;
    }
    this.copyEmailFallback(email, write);
  }

  private copyEmailFallback(email: string, onSuccess: () => void): void {
    if (typeof document === 'undefined') {
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = email;
    textarea.style.position = 'fixed';
    textarea.style.top = '-1000px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      onSuccess();
    } catch {
      // no-op
    } finally {
      document.body.removeChild(textarea);
    }
  }

  bulkUpdateStatus(nextStatus: 'Active' | 'Suspended'): void {
    return bulkUpdateUserAccessStatus(this.mutationsHost(), nextStatus);
  }

  openBulkDeleteModal(): void {
    return openUserAccessBulkDeleteModal(this.mutationsHost());
  }

  closeBulkDeleteModal(): void {
    return closeUserAccessBulkDeleteModal(this.mutationsHost());
  }

  bulkDeleteCount(): number {
    return userAccessBulkDeleteCount(this.mutationsHost());
  }

  confirmBulkDelete(): void {
    return confirmUserAccessBulkDelete(this.mutationsHost());
  }

  private normalizeStatusLabel(value: string | null): string | null {
    return normalizeStatusLabelHelper(this.helperContext(), value);
  }

  protected mapUser(user: unknown, status: 'Active' | 'Suspended' | 'Invited'): UserRow | null {
    return mapUserHelper(this.helperContext(), user, status);
  }

  private resolveDateField(user: unknown, keys: string[]): string | null {
    const record = this.asRecord(user);
    if (!record) {
      return null;
    }
    for (const key of keys) {
      const value = record[key];
      if (!value) {
        continue;
      }
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (typeof value === 'number') {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) {
          return date.toISOString();
        }
      }
      if (typeof value === 'string') {
        return value;
      }
    }
    return null;
  }

  private getStatusRank(status?: string): number {
    const normalized = (status || '').toLowerCase();
    if (normalized === 'active') {
      return 0;
    }
    if (normalized === 'invited') {
      return 1;
    }
    if (normalized === 'suspended' || normalized === 'inactive' || normalized === 'blocked') {
      return 2;
    }
    return 3;
  }

  protected userMatchesQuery(user: UserRow, query: string): boolean {
    const haystack = [
      user.name,
      user.email,
      user.role,
      user.status,
      ...(user.roles ?? []),
      user.department,
      user.position
    ]
      .map(item => this.normalizeText(item))
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  }

  protected compareUsers(a: UserRow, b: UserRow): number {
    return compareUsersHelper(this.helperContext(), a, b);
  }

  protected safeLower(value: unknown): string {
    return this.normalizeText(value).toLowerCase();
  }

  private safeCompare(a: unknown, b: unknown): number {
    return this.normalizeText(a).localeCompare(this.normalizeText(b));
  }

  private compareWithFallback(primary: number, a: UserRow, b: UserRow): number {
    if (primary !== 0) {
      return primary;
    }
    const emailCompare = (a.email || '').localeCompare(b.email || '');
    if (emailCompare !== 0) {
      return emailCompare;
    }
    const idA = String(a.id ?? '');
    const idB = String(b.id ?? '');
    return idA.localeCompare(idB);
  }

  private getDateValue(value?: string | null): number {
    if (!value) {
      return 0;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  private ensureUserArray(value: unknown): UserRow[] {
    return ensureUserArrayHelper(this.helperContext(), value);
  }

  private getUsersByKeys(keys: string[]): UserRow[] {
    if (!keys.length) {
      return [];
    }
    const keySet = new Set(keys);
    return this.roster().filter(user => {
      const key = this.getUserKey(user);
      return key ? keySet.has(key) : false;
    });
  }

  private getSelectedUsers(): UserRow[] {
    const keys = Array.from(this.selectedKeys());
    return this.getUsersByKeys(keys);
  }

  private pruneSelection(nextRoster: UserRow[]): void {
    return pruneSelectionHelper(this.helperContext(), nextRoster);
  }

  toggleEditUser(user: UserRow): void {
    return toggleUserAccessEdit(this.mutationsHost(), user);
  }

  isEditLocked(user: UserRow): boolean {
    return isUserAccessEditLocked(this.mutationsHost(), user);
  }

  toggleQuickEdit(user: UserRow): void {
    return toggleUserAccessQuickEdit(this.mutationsHost(), user);
  }

  updateQuickEditStatus(user: UserRow, status: string): void {
    this.updateQuickEdit(user, { status });
  }

  updateQuickEditRole(user: UserRow, role: string): void {
    this.updateQuickEdit(user, { role });
  }

  saveQuickEdit(user: UserRow): void {
    return saveUserAccessQuickEdit(this.mutationsHost(), user);
  }

  private updateQuickEdit(user: UserRow, patch: { status?: string; role?: string }): void {
    return updateUserAccessQuickEdit(this.mutationsHost(), user, patch);
  }

  closeAllQuickEdits(): void {
    return closeAllUserAccessQuickEdits(this.mutationsHost());
  }

  resetProfile(): void {
    return resetUserAccessProfile(this.mutationsHost());
  }
}
