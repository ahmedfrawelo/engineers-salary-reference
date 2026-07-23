import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import {
  Activity01Icon,
  Add01Icon,
  Alert01Icon,
  ArrowDown01Icon,
  ArrowReloadHorizontalIcon,
  Briefcase02Icon,
  Building03Icon,
  Calendar01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  ClipboardCopyIcon,
  ClipboardIcon,
  Clock01Icon,
  Delete02Icon,
  Login01Icon,
  Mail01Icon,
  PencilEdit01Icon,
  Search01Icon,
  SecurityCheckIcon,
  SecurityLockIcon,
  SmartPhone01Icon,
  UserAccountIcon,
  UserCircleIcon,
  UserLock01Icon,
  UserMultipleIcon,
  UserStatusIcon
} from '@shared/icons/app-icon.registry';
import type { PermissionGroup } from '../../../../core/authorization/permission-registry';
import type {
  AppStatusListColumnKey,
  AppStatusListColumnWidths,
  AppStatusListGroup,
  AppStatusListRow,
  AppStatusListRowClickEvent
} from '../../../../shared/general-list';
import {
  APP_STATUS_LIST_GRID_COLUMN_GAP_WIDTH,
  APP_STATUS_LIST_ROW_CONTROL_TRACK_WIDTH
} from '../../../../shared/general-list/status-list/app-status-list.constants';
import type { DropdownOption } from '../../../../shared/custom-dropdown/custom-dropdown.component';
import type { SharedGridApi, SharedGridColumn, SharedToolbarAction } from '@shared/ui/page-design';
import { ToastService } from '../../../../shared/toast/toast.service';
import { UserAccessControlComponentPresenter } from './presenter/user-access-control.component.presenter';
import type {
  AccessTab,
  PermissionListPagePayload,
  PermissionPage,
  PermissionSection,
  RoleUserItem,
  UserRow
} from './user-access-control.types';
import { Directive } from '@angular/core';
import { UserAccessControlComponentGrid } from './user-access-control.component.grid';

@Directive()
export abstract class UserAccessControlComponentDrawer extends UserAccessControlComponentGrid {
  public override resetCreateUserDraft(): void {
    const defaultRole = this.roleOptions()[0] ?? 'User';
    this.profile = {
      name: '',
      email: '',
      password: '',
      status: 'Invited',
      role: defaultRole,
      department: '',
      position: '',
      phoneNumber: ''
    };
    this.error.set(null);
    this.restoreCandidate.set(null);
  }

  submitCreateUserFromPanel(): void {
    this.awaitingCreateFlowCompletion = true;
    this.createFlowStarted = false;
    this.createUser();
  }

  submitRestoreDeletedUserFromPanel(): void {
    this.awaitingCreateFlowCompletion = true;
    this.createFlowStarted = false;
    this.restoreDeletedUser();
  }

  drawerStatusOptions(user: UserRow): DropdownOption[] {
    const savedStatus = this.normalizeDrawerStatus(user.status);
    const draftStatus = this.normalizeDrawerStatus(user.edit?.status, savedStatus);
    return savedStatus === 'Invited' || draftStatus === 'Invited'
      ? [...this.createStatusOptions]
      : [...this.editStatusOptions];
  }

  drawerDisplayName(user: UserRow): string {
    return user.edit?.name?.trim() || user.name || 'Unnamed user';
  }

  drawerDisplayEmail(user: UserRow): string {
    return user.edit?.email?.trim() || user.email || 'No email available';
  }

  drawerCopyEmailValue(user: UserRow): string {
    return user.edit?.email?.trim() || user.email || '';
  }

  drawerDisplayRole(user: UserRow): string {
    const roles = this.normalizeRoles(user.roles ?? user.role);
    if (roles.length > 1) {
      return roles.join(', ');
    }
    return user.edit?.role?.trim() || roles[0] || 'Role pending';
  }

  isDrawerRoleSelectionLocked(user: UserRow): boolean {
    return this.normalizeRoles(user.roles ?? user.role).length > 1;
  }

  drawerDisplayStatus(user: UserRow): string {
    return this.normalizeDrawerStatus(user.edit?.status || user.status);
  }

  drawerStatusSwitchState(user: UserRow): 'Active' | 'Suspended' | 'Invited' {
    return this.normalizeDrawerStatus(user.edit?.status, this.normalizeDrawerStatus(user.status));
  }

  drawerStatusSwitchChecked(user: UserRow): boolean {
    return this.drawerStatusSwitchState(user) === 'Active';
  }

  drawerStatusSwitchLabel(user: UserRow): string {
    const state = this.drawerStatusSwitchState(user);
    if (state === 'Active') {
      return 'Active';
    }
    if (state === 'Invited') {
      return 'Invited';
    }
    return 'Suspended';
  }

  drawerStatusSwitchHint(user: UserRow): string {
    const state = this.drawerStatusSwitchState(user);
    if (state === 'Active') {
      return 'Can sign in';
    }
    if (state === 'Invited') {
      return 'Pending acceptance';
    }
    return 'Blocked from workspace';
  }

  toggleDrawerStatus(user: UserRow): void {
    if (this.saving() || !user.edit) {
      return;
    }

    const current = this.drawerStatusSwitchState(user);
    user.edit.status = current === 'Active' ? 'Suspended' : 'Active';
    this.onDrawerDraftChange();
  }

  copyDrawerEmail(user: UserRow): void {
    const email = this.drawerCopyEmailValue(user);
    if (!email) {
      return;
    }
    this.copyEmail({ ...user, email });
  }

  public override openUserDrawer(user: UserRow): void {
    const key = this.getUserKey(user);
    if (!key) {
      return;
    }
    this.requestDrawerTransition(key);
  }

  public override closeUserDrawer(): void {
    this.requestDrawerTransition(null);
  }

  onDrawerDraftChange(): void {
    const active = this.activeDrawerUser();
    if (!active?.edit) {
      return;
    }

    this.error.set(null);

    if (!this.hasDrawerDraftChanges(active)) {
      this.clearDrawerAutoSaveTimer();
      this.pendingDrawerUserKey = null;
      this.closeDrawerAfterAutoSave = false;
      this.setDrawerAutoSaveStatus('idle');
      return;
    }

    const validationError = this.getDrawerDraftValidationError(active);
    if (validationError) {
      this.clearDrawerAutoSaveTimer();
      this.setDrawerAutoSaveStatus('invalid', validationError);
      return;
    }

    this.setDrawerAutoSaveStatus('pending');
    this.scheduleDrawerAutoSave();
  }

  protected override buildRosterListGroups(): AppStatusListGroup<UserRow>[] {
    const users = this.displayedRoster();
    const buckets = new Map<string, AppStatusListRow<UserRow>[]>();
    const definitions = [
      { id: 'status-active', name: 'Active', toneClass: 'status-done' },
      { id: 'status-invited', name: 'Invited', toneClass: 'status-review' },
      { id: 'status-suspended', name: 'Suspended', toneClass: 'status-blocked' },
      { id: 'status-other', name: 'Other', toneClass: 'status-backlog' }
    ] as const;

    for (const definition of definitions) {
      buckets.set(definition.id, []);
    }

    for (const user of users) {
      const bucketId = this.resolveRosterGroupId(user);
      buckets.get(bucketId)?.push(this.toRosterListRow(user));
    }

    return definitions
      .map(definition => ({
        id: definition.id,
        name: definition.name,
        toneClass: definition.toneClass,
        count: buckets.get(definition.id)?.length ?? 0,
        rows: buckets.get(definition.id) ?? []
      }))
      .filter(group => group.rows.length > 0);
  }

  private toRosterListRow(user: UserRow): AppStatusListRow<UserRow> {
    const statusLabel = this.normalizeRosterStatus(user.status);
    return {
      id: this.getUserKey(user) ?? `${user.email}-${user.name}`,
      title: user.name || user.email || 'Unknown user',
      owner: this.formatRoles(user),
      ownerInitials: this.getInitials(this.formatRoles(user)),
      statusLabel,
      statusClass: this.resolveRosterStatusClass(statusLabel),
      idLabel: user.email || '--',
      createdLabel: user.createdAt ? this.formatDate(user.createdAt) : '--',
      updatedLabel: user.lastActive ? this.formatDate(user.lastActive) : '--',
      bulletTone: this.resolveRosterBulletTone(statusLabel),
      extras: {
        department: user.department || '--',
        position: user.position || '--',
        phoneNumber: user.phoneNumber || '--',
        loginCount: user.loginCount != null ? String(user.loginCount) : '--'
      },
      payload: user
    };
  }

  private resolveRosterGroupId(user: UserRow): string {
    const status = this.normalizeRosterStatus(user.status).toLowerCase();
    if (status === 'active') {
      return 'status-active';
    }
    if (status === 'invited') {
      return 'status-invited';
    }
    if (status === 'suspended') {
      return 'status-suspended';
    }
    return 'status-other';
  }

  private normalizeRosterStatus(value?: string | null): string {
    const status = (value || '').trim().toLowerCase();
    if (status === 'active') {
      return 'Active';
    }
    if (status === 'invited' || status === 'pending') {
      return 'Invited';
    }
    if (status === 'suspended' || status === 'inactive' || status === 'blocked') {
      return 'Suspended';
    }
    return value?.trim() || 'Unknown';
  }

  private resolveRosterStatusClass(status: string): string {
    if (status === 'Active') {
      return 'status-done';
    }
    if (status === 'Invited') {
      return 'status-review';
    }
    if (status === 'Suspended') {
      return 'status-blocked';
    }
    return 'status-backlog';
  }

  private resolveRosterBulletTone(status: string): AppStatusListRow<UserRow>['bulletTone'] {
    if (status === 'Invited') {
      return 'pending';
    }
    if (status === 'Suspended') {
      return 'error';
    }
    return 'default';
  }

  private requestDrawerTransition(nextKey: string | null): void {
    const active = this.getDrawerUserByKey();
    const currentKey = this.getUserKey(active) ?? this.drawerUserKey();

    if (currentKey === nextKey) {
      if (nextKey) {
        this.ensureDrawerEditState(nextKey);
      }
      return;
    }

    if (active?.edit && this.hasDrawerDraftChanges(active)) {
      const validationError = this.getDrawerDraftValidationError(active);
      if (validationError) {
        this.setDrawerAutoSaveStatus('invalid', validationError);
        return;
      }

      this.pendingDrawerUserKey = nextKey;
      this.closeDrawerAfterAutoSave = nextKey === null;
      this.flushDrawerAutoSave();
      return;
    }

    this.finalizeDrawerTransition(nextKey);
  }

  protected override finalizeDrawerTransition(nextKey: string | null): void {
    this.clearDrawerAutoSaveTimer();
    this.pendingDrawerUserKey = null;
    this.closeDrawerAfterAutoSave = false;

    const active = this.getDrawerUserByKey();
    if (active?.isEditing) {
      this.toggleEditUser(active);
    }

    this.drawerUserKey.set(nextKey);
    this.error.set(null);

    if (!nextKey) {
      this.setDrawerAutoSaveStatus('idle');
      return;
    }

    this.ensureDrawerEditState(nextKey);
    this.setDrawerAutoSaveStatus('idle');
  }

  private ensureDrawerEditState(key: string): void {
    const active = this.getDrawerUserByKey(key);
    if (!active || active.isEditing) {
      return;
    }
    this.toggleEditUser(active);
  }

  private getDrawerUserByKey(key: string | null = this.drawerUserKey()): UserRow | null {
    if (!key) {
      return null;
    }
    return this.roster().find(user => this.getUserKey(user) === key) ?? null;
  }

  private scheduleDrawerAutoSave(delayMs = 650): void {
    this.clearDrawerAutoSaveTimer();
    this.drawerAutoSaveTimer = setTimeout(() => this.flushDrawerAutoSave(), delayMs);
  }

  private flushDrawerAutoSave(): void {
    this.clearDrawerAutoSaveTimer();

    const active = this.activeDrawerUser();
    if (!active?.edit) {
      this.pendingDrawerUserKey = null;
      this.closeDrawerAfterAutoSave = false;
      this.setDrawerAutoSaveStatus('idle');
      return;
    }

    if (!this.hasDrawerDraftChanges(active)) {
      if (this.pendingDrawerUserKey !== null || this.closeDrawerAfterAutoSave) {
        this.finalizeDrawerTransition(this.pendingDrawerUserKey);
        return;
      }
      this.setDrawerAutoSaveStatus('saved');
      return;
    }

    const validationError = this.getDrawerDraftValidationError(active);
    if (validationError) {
      this.setDrawerAutoSaveStatus('invalid', validationError);
      return;
    }

    if (this.saving()) {
      this.setDrawerAutoSaveStatus('pending');
      this.scheduleDrawerAutoSave(240);
      return;
    }

    this.setDrawerAutoSaveStatus('saving');
    this.saveUserEdits(active);
  }

  protected override clearDrawerAutoSaveTimer(): void {
    if (!this.drawerAutoSaveTimer) {
      return;
    }
    clearTimeout(this.drawerAutoSaveTimer);
    this.drawerAutoSaveTimer = null;
  }

  protected override setDrawerAutoSaveStatus(
    state: 'idle' | 'pending' | 'saving' | 'saved' | 'invalid' | 'error',
    message?: string
  ): void {
    const defaults: Record<'idle' | 'pending' | 'saving' | 'saved' | 'invalid' | 'error', string> =
      {
        idle: 'Auto-save on',
        pending: 'Changes pending',
        saving: 'Saving...',
        saved: 'Saved',
        invalid: 'Required fields',
        error: 'Save failed'
      };
    const nextMessage = message ?? defaults[state];
    const previousState = this.drawerAutoSaveState();
    const previousMessage = this.drawerAutoSaveMessage();

    this.drawerAutoSaveState.set(state);
    this.drawerAutoSaveMessage.set(nextMessage);
    this.notifyDrawerAutoSaveState(state, nextMessage, previousState, previousMessage);
  }

  private notifyDrawerAutoSaveState(
    state: 'idle' | 'pending' | 'saving' | 'saved' | 'invalid' | 'error',
    message: string,
    previousState: 'idle' | 'pending' | 'saving' | 'saved' | 'invalid' | 'error',
    previousMessage: string
  ): void {
    if (!this.userDrawerOpen()) {
      this.lastDrawerToastSignature = null;
      return;
    }

    if (state === 'idle' || state === 'pending' || state === 'saving') {
      if (state !== previousState) {
        this.lastDrawerToastSignature = null;
      }
      return;
    }

    if (state === 'saved' && previousState !== 'saving') {
      return;
    }

    if (state === previousState && message === previousMessage) {
      return;
    }

    const signature = `${state}:${message}`;
    if (this.lastDrawerToastSignature === signature) {
      return;
    }

    this.lastDrawerToastSignature = signature;

    if (state === 'saved') {
      this.toast.success('User changes saved', 2200);
      return;
    }

    if (state === 'invalid') {
      this.toast.warning(message, 3200);
      return;
    }

    if (state === 'error') {
      this.toast.error(message, 4200);
    }
  }

  private hasDrawerDraftChanges(user: UserRow): boolean {
    const draft = user.edit;
    if (!draft) {
      return false;
    }

    const currentStatus = this.normalizeDrawerStatus(user.status);
    const nextStatus = this.normalizeDrawerStatus(draft.status, currentStatus);
    const currentRoles = this.normalizeRoles(user.roles ?? user.role);
    const currentRole = (currentRoles[0] || user.role || 'User').trim();

    return (
      draft.name.trim() !== (user.name ?? '').trim() ||
      draft.email.trim() !== (user.email ?? '').trim() ||
      nextStatus !== currentStatus ||
      draft.role.trim() !== currentRole ||
      this.normalizeDrawerText(draft.department) !== this.normalizeDrawerText(user.department) ||
      this.normalizeDrawerText(draft.position) !== this.normalizeDrawerText(user.position) ||
      this.normalizeDrawerText(draft.phoneNumber) !== this.normalizeDrawerText(user.phoneNumber) ||
      !!draft.password.trim()
    );
  }

  private getDrawerDraftValidationError(user: UserRow): string | null {
    const draft = user.edit;
    if (!draft) {
      return null;
    }

    const trimmedName = draft.name.trim();
    const trimmedEmail = draft.email.trim();
    const trimmedRole = draft.role.trim();
    const trimmedPassword = draft.password.trim();
    const currentRoles = this.normalizeRoles(user.roles ?? user.role);
    const currentRole = (currentRoles[0] || user.role || 'User').trim();

    if (!trimmedName) {
      return 'Name is required';
    }
    if (!trimmedEmail) {
      return 'Email is required';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return 'Enter a valid email address';
    }
    if (currentRoles.length > 1 && trimmedRole !== currentRole) {
      return 'This user has multiple roles. Manage role membership from the Roles panel.';
    }

    if (!trimmedPassword) {
      return null;
    }
    if (trimmedPassword.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/[A-Z]/.test(trimmedPassword)) {
      return 'Password must include an uppercase letter';
    }
    if (!/[a-z]/.test(trimmedPassword)) {
      return 'Password must include a lowercase letter';
    }
    if (!/[0-9]/.test(trimmedPassword)) {
      return 'Password must include a number';
    }

    return null;
  }

  private normalizeDrawerText(value: string | null | undefined): string {
    return (value ?? '').trim();
  }

  private normalizeDrawerStatus(
    value: string | null | undefined,
    fallback: string = 'Suspended'
  ): 'Active' | 'Suspended' | 'Invited' {
    const normalized = (value ?? '').trim().toLowerCase();
    if (normalized === 'active') {
      return 'Active';
    }
    if (
      normalized === 'invited' ||
      normalized === 'pending' ||
      normalized === 'pending acceptance'
    ) {
      return 'Invited';
    }
    if (normalized === 'suspended' || normalized === 'inactive' || normalized === 'blocked') {
      return 'Suspended';
    }
    if (fallback === value) {
      return 'Suspended';
    }
    return this.normalizeDrawerStatus(fallback, fallback);
  }
}
