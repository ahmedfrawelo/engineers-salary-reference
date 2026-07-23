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
import { UndoActionToastService } from '@core/notifications/undo-action-toast.service';
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

@Directive()
export abstract class UserAccessControlComponentWorkspaceCore
  extends UserAccessControlComponentPresenter
  implements AfterViewInit
{
  protected readonly componentCdr = inject(ChangeDetectorRef);
  protected readonly toast = inject(ToastService);
  protected readonly undoToast = inject(UndoActionToastService);
  protected rosterListShellRef?: ElementRef<HTMLElement>;
  protected permissionListShellRef?: ElementRef<HTMLElement>;
  protected resizeObserver: ResizeObserver | null = null;
  protected resizeSyncFrame: number | null = null;
  protected readonly listGridColumnGapWidth = APP_STATUS_LIST_GRID_COLUMN_GAP_WIDTH;
  protected readonly listRowControlTrackWidth = APP_STATUS_LIST_ROW_CONTROL_TRACK_WIDTH;
  protected abstract bindListResizeObserver(): void;
  protected abstract scheduleListWidthSync(): void;
  protected abstract buildAdaptiveColumnWidths<TPayload>(
    visibleColumns: ReadonlyArray<AppStatusListColumnKey>,
    groups: ReadonlyArray<AppStatusListGroup<TPayload>>,
    labels: Partial<Record<AppStatusListColumnKey, string>>,
    surface: 'roster' | 'permission',
    availableWidth: number
  ): AppStatusListColumnWidths;
  protected abstract createRosterSharedGridApi(): SharedGridApi;
  protected abstract buildRosterListGroups(): AppStatusListGroup<UserRow>[];
  protected abstract finalizeDrawerTransition(nextKey: string | null): void;
  protected abstract setDrawerAutoSaveStatus(
    state: 'idle' | 'pending' | 'saving' | 'saved' | 'invalid' | 'error',
    message?: string
  ): void;
  protected abstract clearDrawerAutoSaveTimer(): void;
  protected abstract closeUserDrawer(): void;
  protected abstract openCreateUserPanel(): void;
  protected abstract createPermissionSharedGridApi(): SharedGridApi;
  protected abstract buildPermissionListGroups(): ReadonlyArray<
    AppStatusListGroup<PermissionListPagePayload>
  >;
  protected abstract resetPermissionAccordionState(sections: PermissionSection[]): void;
  protected abstract expandAllPermissionAccordions(): void;
  protected abstract createPermissionSharedColumns(
    visibleColumns: ReadonlyArray<AppStatusListColumnKey>,
    orderedColumns?: ReadonlyArray<AppStatusListColumnKey>
  ): SharedGridColumn[];
  protected abstract getPermissionSharedColumnField(column: SharedGridColumn): string;
  protected abstract togglePermissionSharedColumn(column: SharedGridColumn): void;
  protected abstract showAllPermissionSharedColumns(): void;
  protected abstract hideAllPermissionSharedColumns(): void;
  protected abstract resetPermissionSharedColumns(): void;
  protected abstract syncPermissionVisibleColumnsFromSharedGrid(): void;
  @ViewChild('rosterListShell', { read: ElementRef })
  set rosterListShellElement(ref: ElementRef<HTMLElement> | undefined) {
    this.rosterListShellRef = ref;
    this.bindListResizeObserver();
    this.scheduleListWidthSync();
  }
  @ViewChild('permissionListShell', { read: ElementRef })
  set permissionListShellElement(ref: ElementRef<HTMLElement> | undefined) {
    this.permissionListShellRef = ref;
    this.bindListResizeObserver();
    this.scheduleListWidthSync();
  }
  readonly hugeIcons = {
    add: Add01Icon,
    alert: Alert01Icon,
    audit: ClipboardIcon,
    chevron: ArrowDown01Icon,
    close: Cancel01Icon,
    copy: ClipboardCopyIcon,
    delete: Delete02Icon,
    edit: PencilEdit01Icon,
    login: Login01Icon,
    permissions: SecurityLockIcon,
    profile: UserStatusIcon,
    refresh: ArrowReloadHorizontalIcon,
    search: Search01Icon,
    role: UserAccountIcon,
    scopeRole: UserMultipleIcon,
    scopeUser: UserLock01Icon,
    status: SecurityCheckIcon,
    time: Clock01Icon
  } as const;
  readonly collapsedRosterGroupIds = signal<Set<string>>(new Set());
  readonly collapsedPermissionSectionKeys = signal<Set<string>>(new Set());
  readonly collapsedPermissionPageKeys = signal<Set<string>>(new Set());
  readonly collapsedPermissionGroupKeys = signal<Set<string>>(new Set());
  readonly collapsedPermissionListGroupIds = signal<Set<string>>(new Set());
  readonly createUserPanelOpen = signal(false);
  readonly drawerUserKey = signal<string | null>(null);
  readonly activePermissionPageKey = signal<string | null>(null);
  readonly rosterAvailableWidth = signal(0);
  readonly permissionAvailableWidth = signal(0);
  readonly rosterManualColumnWidths = signal<AppStatusListColumnWidths>({});
  readonly permissionManualColumnWidths = signal<AppStatusListColumnWidths>({});
  readonly drawerAutoSaveState = signal<
    'idle' | 'pending' | 'saving' | 'saved' | 'invalid' | 'error'
  >('idle');
  readonly drawerAutoSaveMessage = signal('Auto-save on');
  readonly defaultRosterListColumns: ReadonlyArray<AppStatusListColumnKey> = [
    'name',
    'taskId',
    'assignee',
    'status',
    'department',
    'position',
    'phoneNumber',
    'loginCount',
    'created',
    'updated'
  ];
  readonly rosterListColumns = signal<AppStatusListColumnKey[]>([...this.defaultRosterListColumns]);
  readonly rosterListColumnLabels: Partial<Record<AppStatusListColumnKey, string>> = {
    taskId: 'Email',
    assignee: 'Role',
    department: 'Department',
    position: 'Position',
    phoneNumber: 'Phone',
    loginCount: 'Logins',
    created: 'Joined',
    updated: 'Last active'
  };
  readonly rosterListColumnWidths = computed<AppStatusListColumnWidths>(() => ({
    ...this.buildAdaptiveColumnWidths(
      this.rosterListColumns(),
      this.rosterListGroups(),
      this.rosterListColumnLabels,
      'roster',
      this.rosterAvailableWidth()
    ),
    ...this.rosterManualColumnWidths()
  }));
  readonly rosterSharedGridApi: SharedGridApi = this.createRosterSharedGridApi();
  readonly defaultPermissionListColumns: ReadonlyArray<AppStatusListColumnKey> = [
    'name',
    'department',
    'created',
    'updated',
    'status'
  ];
  readonly permissionListColumns = signal<AppStatusListColumnKey[]>([
    ...this.defaultPermissionListColumns
  ]);
  readonly permissionListColumnLabels: Partial<Record<AppStatusListColumnKey, string>> = {
    department: 'Groups',
    created: 'Enabled',
    updated: 'Total',
    status: 'Coverage'
  };
  readonly permissionListColumnWidths = computed<AppStatusListColumnWidths>(() => ({
    ...this.buildAdaptiveColumnWidths(
      this.permissionListColumns(),
      this.permissionListGroups(),
      this.permissionListColumnLabels,
      'permission',
      this.permissionAvailableWidth()
    ),
    ...this.permissionManualColumnWidths()
  }));
  readonly permissionSharedGridApi: SharedGridApi = this.createPermissionSharedGridApi();
  readonly pageToolbarActions = computed<SharedToolbarAction[]>(() =>
    this.tab() === 'profile'
      ? (() => {
          const actions: SharedToolbarAction[] = [];

          if (this.canViewAccessControl()) {
            actions.push({
              id: 'deletedUsers',
              label: 'Deleted',
              hugeIcon: this.hugeIcons.delete,
              hugeIconSize: 18,
              hugeIconStrokeWidth: 1.9,
              tone: 'default',
              variant: 'softRect'
            });
          }

          if (this.canCreateAccessControlUser()) {
            actions.push({
              id: 'createUser',
              label: 'Create user',
              hugeIcon: this.hugeIcons.add,
              hugeIconSize: 18,
              hugeIconStrokeWidth: 1.9,
              tone: 'primary',
              variant: 'softRect'
            });
          }

          return actions;
        })()
      : []
  );
  readonly activeDrawerUser = computed<UserRow | null>(() => {
    const key = this.drawerUserKey();
    if (!key || this.tab() !== 'profile') {
      return null;
    }
    return this.roster().find(user => this.getUserKey(user) === key) ?? null;
  });
  readonly userDrawerOpen = computed<boolean>(() => !!this.activeDrawerUser());
  readonly roleMembersDrawerOpen = signal(false);
  readonly rosterListGroups = computed<ReadonlyArray<AppStatusListGroup<UserRow>>>(() =>
    this.buildRosterListGroups()
  );
  readonly permissionListGroups = computed<
    ReadonlyArray<AppStatusListGroup<PermissionListPagePayload>>
  >(() => this.buildPermissionListGroups());
  readonly activePermissionPage = computed<PermissionListPagePayload | null>(() => {
    if (this.tab() !== 'permissions' || !this.hasPermissionTarget()) {
      return null;
    }
    const key = this.activePermissionPageKey();
    if (!key) {
      return null;
    }
    for (const group of this.permissionListGroups()) {
      const row = group.rows.find(item => item.id === key);
      if (row?.payload) {
        return row.payload;
      }
    }
    return null;
  });
  protected awaitingCreateFlowCompletion = false;
  protected createFlowStarted = false;
  protected drawerAutoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  protected pendingDrawerUserKey: string | null = null;
  protected closeDrawerAfterAutoSave = false;
  protected lastDrawerToastSignature: string | null = null;
  private lastPermissionAccordionSignature: string | null = null;
  permissionQuery = '';
  private readonly drawerVisibilityEffect = effect(() => {
    if (this.tab() === 'profile') {
      return;
    }
    if (!this.drawerUserKey()) {
      return;
    }
    this.finalizeDrawerTransition(null);
  });
  private readonly createFlowEffect = effect(() => {
    const panelOpen = this.createUserPanelOpen();
    const saving = this.saving();
    const restoring = this.restoring();
    const error = this.error();
    const restoreCandidate = this.restoreCandidate();

    if (!panelOpen || !this.awaitingCreateFlowCompletion) {
      return;
    }

    if (saving || restoring) {
      this.createFlowStarted = true;
      return;
    }

    if (error || restoreCandidate) {
      this.awaitingCreateFlowCompletion = false;
      this.createFlowStarted = false;
      return;
    }

    if (!this.createFlowStarted) {
      return;
    }

    this.awaitingCreateFlowCompletion = false;
    this.createFlowStarted = false;
    this.createUserPanelOpen.set(false);
  });
  private readonly drawerAutoSaveEffect = effect(() => {
    if (this.drawerAutoSaveState() !== 'saving') {
      return;
    }

    if (this.saving()) {
      return;
    }

    const error = this.error();
    if (error) {
      this.pendingDrawerUserKey = null;
      this.closeDrawerAfterAutoSave = false;
      this.setDrawerAutoSaveStatus('error', error);
      return;
    }

    this.setDrawerAutoSaveStatus('saved');

    if (this.pendingDrawerUserKey !== null || this.closeDrawerAfterAutoSave) {
      this.finalizeDrawerTransition(this.pendingDrawerUserKey);
    }
  });
  private readonly permissionAccordionEffect = effect(() => {
    if (this.tab() !== 'permissions') {
      return;
    }

    const scope = this.permissionScope();
    const targetKey =
      scope === 'role'
        ? this.selectedRole()?.id || this.selectedRole()?.name || ''
        : this.selectedUser()?.id || this.selectedUser()?.email || '';
    const sections = this.permissionSections();
    const signature = `${scope}|${targetKey}|${sections
      .map(
        section =>
          `${section.title}:${section.pages
            .map(page => `${page.title}:${page.groups.map(group => group.group).join(',')}`)
            .join('|')}`
      )
      .join('||')}`;

    if (!targetKey || !sections.length) {
      this.lastPermissionAccordionSignature = null;
      this.expandAllPermissionAccordions();
      return;
    }

    if (signature === this.lastPermissionAccordionSignature) {
      return;
    }

    this.lastPermissionAccordionSignature = signature;
    this.resetPermissionAccordionState(sections);
  });
  private readonly roleMembersDrawerEffect = effect(() => {
    if (this.tab() !== 'permissions' || this.permissionScope() !== 'role' || !this.selectedRole()) {
      if (this.roleMembersDrawerOpen()) {
        this.roleAddUserQuery = '';
        this.roleMembersDrawerOpen.set(false);
      }
    }
  });
  private readonly permissionPageDrawerEffect = effect(() => {
    if (this.tab() !== 'permissions' || !this.hasPermissionTarget()) {
      if (this.activePermissionPageKey()) {
        this.activePermissionPageKey.set(null);
      }
      return;
    }

    const activeKey = this.activePermissionPageKey();
    if (!activeKey) {
      return;
    }

    const exists = this.permissionListGroups().some(group =>
      group.rows.some(row => row.id === activeKey)
    );
    if (!exists) {
      this.activePermissionPageKey.set(null);
    }
  });
  private readonly listWidthSyncEffect = effect(() => {
    const rosterSignature = this.rosterListGroups()
      .map(group => `${group.id}:${group.rows.length}`)
      .join('|');
    const permissionSignature = this.permissionListGroups()
      .map(group => `${group.id}:${group.rows.length}`)
      .join('|');
    void rosterSignature;
    void permissionSignature;
    this.scheduleListWidthSync();
  });

  ngAfterViewInit(): void {
    this.bindListResizeObserver();
    this.scheduleListWidthSync();
  }

  override ngOnDestroy(): void {
    if (this.resizeSyncFrame !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.resizeSyncFrame);
      this.resizeSyncFrame = null;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.clearDrawerAutoSaveTimer();
    super.ngOnDestroy();
  }

  override setTab(next: AccessTab): void {
    super.setTab(next);
    this.scheduleListWidthSync();
  }

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    this.closeHardDeleteModal();
    this.closeDeletedDrawer();
    this.closeUserDrawer();
    this.closeDeleteModal();
    this.closeBulkDeleteModal();
    this.closeDeleteRoleModal();
    this.closeAllQuickEdits();
  }

  @HostListener('window:resize')
  handleWindowResize(): void {
    this.scheduleListWidthSync();
  }

  onRosterGroupToggle(groupId: string): void {
    const next = new Set(this.collapsedRosterGroupIds());
    if (next.has(groupId)) {
      next.delete(groupId);
    } else {
      next.add(groupId);
    }
    this.collapsedRosterGroupIds.set(next);
  }

  onRosterSelectionChange(keys: ReadonlySet<string>): void {
    this.selectedKeys.set(new Set(keys));
    if (!keys.size && this.showSelectedOnly) {
      this.showSelectedOnly = false;
    }
  }

  onSharedPageToolbarAction(actionId: string): void {
    if (actionId === 'createUser') {
      this.openCreateUserPanel();
    } else if (actionId === 'deletedUsers') {
      this.openDeletedDrawer();
    }
  }
}
