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
import { UserAccessControlComponentWorkspaceCore } from './user-access-control.component.workspace.core';

@Directive()
export abstract class UserAccessControlComponentWorkspacePermissions extends UserAccessControlComponentWorkspaceCore {
  private permissionSectionKey(section: PermissionSection | string): string {
    const value = typeof section === 'string' ? section : section.title;
    return value.trim().toLowerCase().replace(/\s+/g, '-');
  }

  private permissionPageKey(
    section: PermissionSection | string,
    page: PermissionPage | string
  ): string {
    const sectionKey = this.permissionSectionKey(section);
    const pageTitle = typeof page === 'string' ? page : page.title;
    return `${sectionKey}::${pageTitle.trim().toLowerCase().replace(/\s+/g, '-')}`;
  }

  private permissionGroupKey(
    section: PermissionSection | string,
    page: PermissionPage | string,
    group: PermissionGroup | string
  ): string {
    const pageKey = this.permissionPageKey(section, page);
    const groupTitle = typeof group === 'string' ? group : group.group;
    return `${pageKey}::${(groupTitle || 'general').trim().toLowerCase().replace(/\s+/g, '-')}`;
  }

  protected override resetPermissionAccordionState(sections: PermissionSection[]): void {
    if (!sections.length) {
      this.expandAllPermissionAccordions();
      return;
    }

    const collapsedSections = new Set<string>();
    const collapsedPages = new Set<string>();
    const collapsedGroups = new Set<string>();

    sections.forEach((section, sectionIndex) => {
      const sectionOpen = sectionIndex === 0;
      if (!sectionOpen) {
        collapsedSections.add(this.permissionSectionKey(section));
      }

      section.pages.forEach((page, pageIndex) => {
        const pageOpen = sectionOpen && pageIndex === 0;
        if (!pageOpen) {
          collapsedPages.add(this.permissionPageKey(section, page));
        }

        page.groups.forEach((group, groupIndex) => {
          const groupOpen = pageOpen && groupIndex === 0;
          if (!groupOpen) {
            collapsedGroups.add(this.permissionGroupKey(section, page, group));
          }
        });
      });
    });

    this.collapsedPermissionSectionKeys.set(collapsedSections);
    this.collapsedPermissionPageKeys.set(collapsedPages);
    this.collapsedPermissionGroupKeys.set(collapsedGroups);
  }

  public override expandAllPermissionAccordions(): void {
    this.collapsedPermissionSectionKeys.set(new Set());
    this.collapsedPermissionPageKeys.set(new Set());
    this.collapsedPermissionGroupKeys.set(new Set());
  }

  collapseAllPermissionAccordions(): void {
    const sections = this.permissionSections();
    const collapsedSections = new Set<string>();
    const collapsedPages = new Set<string>();
    const collapsedGroups = new Set<string>();

    sections.forEach(section => {
      collapsedSections.add(this.permissionSectionKey(section));
      section.pages.forEach(page => {
        collapsedPages.add(this.permissionPageKey(section, page));
        page.groups.forEach(group => {
          collapsedGroups.add(this.permissionGroupKey(section, page, group));
        });
      });
    });

    this.collapsedPermissionSectionKeys.set(collapsedSections);
    this.collapsedPermissionPageKeys.set(collapsedPages);
    this.collapsedPermissionGroupKeys.set(collapsedGroups);
  }

  isPermissionSectionCollapsed(section: PermissionSection): boolean {
    return this.collapsedPermissionSectionKeys().has(this.permissionSectionKey(section));
  }

  togglePermissionSection(section: PermissionSection): void {
    const key = this.permissionSectionKey(section);
    const allSectionKeys = new Set(
      this.permissionSections().map(item => this.permissionSectionKey(item))
    );

    if (this.collapsedPermissionSectionKeys().has(key)) {
      allSectionKeys.delete(key);
      this.collapsedPermissionSectionKeys.set(allSectionKeys);
    } else {
      const next = new Set(this.collapsedPermissionSectionKeys());
      next.add(key);
      this.collapsedPermissionSectionKeys.set(next);
    }
  }

  isPermissionPageCollapsed(section: PermissionSection | string, page: PermissionPage): boolean {
    return this.collapsedPermissionPageKeys().has(this.permissionPageKey(section, page));
  }

  togglePermissionPage(section: PermissionSection | string, page: PermissionPage): void {
    const key = this.permissionPageKey(section, page);
    const sectionPages =
      typeof section === 'string'
        ? (this.permissionSections().find(
            item => this.permissionSectionKey(item) === this.permissionSectionKey(section)
          )?.pages ?? [])
        : section.pages;

    if (this.collapsedPermissionPageKeys().has(key)) {
      const next = new Set(this.collapsedPermissionPageKeys());
      sectionPages.forEach(item => next.add(this.permissionPageKey(section, item)));
      next.delete(key);
      this.collapsedPermissionPageKeys.set(next);

      const nextGroups = new Set(this.collapsedPermissionGroupKeys());
      const firstGroup = page.groups[0];
      if (firstGroup) {
        nextGroups.delete(this.permissionGroupKey(section, page, firstGroup));
      }
      this.collapsedPermissionGroupKeys.set(nextGroups);
    } else {
      const next = new Set(this.collapsedPermissionPageKeys());
      next.add(key);
      this.collapsedPermissionPageKeys.set(next);
    }
  }

  isPermissionGroupCollapsed(
    section: PermissionSection | string,
    page: PermissionPage | string,
    group: PermissionGroup
  ): boolean {
    return this.collapsedPermissionGroupKeys().has(this.permissionGroupKey(section, page, group));
  }

  togglePermissionGroup(
    section: PermissionSection | string,
    page: PermissionPage | string,
    group: PermissionGroup
  ): void {
    const key = this.permissionGroupKey(section, page, group);
    const pageGroups =
      typeof page === 'string'
        ? typeof section === 'string'
          ? (this.permissionSections()
              .find(item => this.permissionSectionKey(item) === this.permissionSectionKey(section))
              ?.pages.find(item => item.title === page)?.groups ?? [])
          : (section.pages.find(item => item.title === page)?.groups ?? [])
        : page.groups;

    if (this.collapsedPermissionGroupKeys().has(key)) {
      const next = new Set(this.collapsedPermissionGroupKeys());
      pageGroups.forEach(item => next.add(this.permissionGroupKey(section, page, item)));
      next.delete(key);
      this.collapsedPermissionGroupKeys.set(next);
    } else {
      const next = new Set(this.collapsedPermissionGroupKeys());
      next.add(key);
      this.collapsedPermissionGroupKeys.set(next);
    }
  }

  totalPermissionsInGroup(group: PermissionGroup): number {
    return group.permissions?.length ?? 0;
  }

  countSelectedPermissionsInGroup(group: PermissionGroup): number {
    const selected =
      this.permissionScope() === 'role'
        ? this.selectedRolePermissions()
        : this.selectedUserPermissions();
    return (group.permissions ?? []).reduce(
      (count, permission) => count + (permission?.code && selected.has(permission.code) ? 1 : 0),
      0
    );
  }

  totalPermissionsInPage(page: PermissionPage): number {
    return page.groups.reduce((count, group) => count + this.totalPermissionsInGroup(group), 0);
  }

  countSelectedPermissionsInPage(page: PermissionPage): number {
    return page.groups.reduce(
      (count, group) => count + this.countSelectedPermissionsInGroup(group),
      0
    );
  }

  totalPermissionsInSection(section: PermissionSection): number {
    return section.pages.reduce((count, page) => count + this.totalPermissionsInPage(page), 0);
  }

  countSelectedPermissionsInSection(section: PermissionSection): number {
    return section.pages.reduce(
      (count, page) => count + this.countSelectedPermissionsInPage(page),
      0
    );
  }

  openRoleMembersDrawer(): void {
    if (
      this.permissionScope() !== 'role' ||
      !this.selectedRole() ||
      !this.canAssignAccessControlRoles()
    ) {
      if (!this.canAssignAccessControlRoles()) {
        this.permissionsError.set(
          "Access denied - You don't have permission to manage role assignments"
        );
      }
      return;
    }
    this.roleAddUserQuery = '';
    this.roleMembersDrawerOpen.set(true);
    this.ensureSelectedRoleMembersLoaded();
  }

  closeRoleMembersDrawer(): void {
    this.roleAddUserQuery = '';
    this.roleMembersDrawerOpen.set(false);
  }

  filteredUsersInRole(): RoleUserItem[] {
    const query = (this.roleAddUserQuery ?? '').trim().toLowerCase();
    const members = this.usersInRole();
    if (!query) {
      return members;
    }

    return members.filter(member => {
      const name = (member.name ?? '').toLowerCase();
      const email = (member.email ?? '').toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }

  hasRoleAddUserQuery(): boolean {
    return !!(this.roleAddUserQuery ?? '').trim();
  }

  clearRoleMembersSearch(): void {
    this.roleAddUserQuery = '';
  }

  hasPermissionSearchQuery(): boolean {
    return !!this.permissionQuery.trim();
  }

  clearPermissionSearch(): void {
    if (!this.permissionQuery) {
      return;
    }
    this.permissionQuery = '';
    this.componentCdr.markForCheck();
  }

  hasPermissionUserSearchQuery(): boolean {
    return !!(this.permissionUserQuery ?? '').trim();
  }

  clearPermissionUserSearch(): void {
    this.permissionUserQuery = '';
  }

  hasPermissionUserSearchMiss(): boolean {
    return (
      this.hasPermissionUserSearchQuery() &&
      !!this.roster().length &&
      !this.permissionUsers().length
    );
  }

  hasPermissionSelectionChanges(): boolean {
    const current = this.activePermissionSelection();
    const baseline = this.permissionSelectionBaseline();
    if (current.size !== baseline.size) {
      return true;
    }
    for (const code of current) {
      if (!baseline.has(code)) {
        return true;
      }
    }
    return false;
  }

  permissionSelectionChangeCount(): number {
    const current = this.activePermissionSelection();
    const baseline = this.permissionSelectionBaseline();
    let count = 0;

    for (const code of current) {
      if (!baseline.has(code)) {
        count += 1;
      }
    }
    for (const code of baseline) {
      if (!current.has(code)) {
        count += 1;
      }
    }

    return count;
  }

  resetPermissionSelection(): void {
    this.permissionsError.set(null);
    this.applyPermissionSelection(new Set(this.permissionSelectionBaseline()));
  }

  onPermissionListGroupToggle(groupId: string): void {
    const next = new Set(this.collapsedPermissionListGroupIds());
    if (next.has(groupId)) {
      next.delete(groupId);
    } else {
      next.add(groupId);
    }
    this.collapsedPermissionListGroupIds.set(next);
  }

  onPermissionListRowClick(event: AppStatusListRowClickEvent<PermissionListPagePayload>): void {
    if (!event.row.payload || !this.canManageAccessControlPermissions()) {
      return;
    }
    this.activePermissionPageKey.set(event.row.id);
  }

  closePermissionPageDrawer(): void {
    this.activePermissionPageKey.set(null);
  }

  isPageFullySelected(page: PermissionPage): boolean {
    const codes = this.permissionCodesForPage(page);
    if (!codes.length) {
      return false;
    }
    const selected = this.activePermissionSelection();
    return codes.every(code => selected.has(code));
  }

  isPagePartiallySelected(page: PermissionPage): boolean {
    const codes = this.permissionCodesForPage(page);
    if (!codes.length) {
      return false;
    }
    const selected = this.activePermissionSelection();
    const selectedCount = codes.filter(code => selected.has(code)).length;
    return selectedCount > 0 && selectedCount < codes.length;
  }

  togglePagePermissions(page: PermissionPage): void {
    if (!this.canManageAccessControlPermissions()) {
      return;
    }
    const codes = this.permissionCodesForPage(page);
    if (!codes.length) {
      return;
    }
    const next = new Set(this.activePermissionSelection());
    const shouldEnable = !codes.every(code => next.has(code));
    for (const code of codes) {
      if (shouldEnable) {
        next.add(code);
      } else {
        next.delete(code);
      }
    }
    this.applyPermissionSelection(next);
  }

  permissionPageSubtitle(payload: PermissionListPagePayload): string {
    const selected = this.countSelectedPermissionsInPage(payload.page);
    const total = this.totalPermissionsInPage(payload.page);
    return `${payload.sectionTitle} � ${selected} / ${total} enabled`;
  }

  permissionPageSummary(payload: PermissionListPagePayload): string {
    const selected = this.countSelectedPermissionsInPage(payload.page);
    const total = this.totalPermissionsInPage(payload.page);
    return `${payload.sectionTitle} - ${selected} / ${total} enabled`;
  }

  protected override buildPermissionListGroups(): ReadonlyArray<
    AppStatusListGroup<PermissionListPagePayload>
  > {
    const query = this.permissionQuery.trim().toLowerCase();
    return this.permissionSections()
      .map(section => {
        const rows = section.pages
          .filter(page => this.matchesPermissionPageQuery(section, page, query))
          .map(page => this.buildPermissionListRow(section, page));
        if (!rows.length) {
          return null;
        }
        const selected = rows.reduce(
          (count, row) => count + Number.parseInt(row.createdLabel || '0', 10),
          0
        );
        const total = rows.reduce(
          (count, row) => count + Number.parseInt(row.updatedLabel || '0', 10),
          0
        );
        return {
          id: this.permissionSectionKey(section),
          name: section.title,
          toneClass: this.permissionCoverageClass(selected, total),
          count: rows.length,
          rows
        } satisfies AppStatusListGroup<PermissionListPagePayload>;
      })
      .filter(Boolean) as AppStatusListGroup<PermissionListPagePayload>[];
  }

  private buildPermissionListRow(
    section: PermissionSection,
    page: PermissionPage
  ): AppStatusListRow<PermissionListPagePayload> {
    const selected = this.countSelectedPermissionsInPage(page);
    const total = this.totalPermissionsInPage(page);
    return {
      id: this.permissionPageKey(section, page),
      title: page.title,
      statusLabel: this.permissionCoverageLabel(selected, total),
      statusClass: this.permissionCoverageClass(selected, total),
      createdLabel: String(selected),
      updatedLabel: String(total),
      extras: {
        department: String(page.groups.length)
      },
      payload: {
        sectionTitle: section.title,
        page
      }
    };
  }

  private matchesPermissionPageQuery(
    section: PermissionSection,
    page: PermissionPage,
    query: string
  ): boolean {
    if (!query) {
      return true;
    }
    const haystack = [
      section.title,
      page.title,
      ...page.groups.map(group => group.group || ''),
      ...page.groups.flatMap(group =>
        (group.permissions ?? []).flatMap(permission => [
          permission?.code ?? '',
          permission?.label ?? ''
        ])
      )
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  }

  private permissionCoverageLabel(selected: number, total: number): string {
    if (!total || selected <= 0) {
      return 'Off';
    }
    if (selected >= total) {
      return 'All on';
    }
    return 'Partial';
  }

  private permissionCoverageClass(selected: number, total: number): string {
    if (!total || selected <= 0) {
      return '';
    }
    if (selected >= total) {
      return 'status-done';
    }
    return 'status-review';
  }

  private permissionCodesForPage(page: PermissionPage): string[] {
    return page.groups.flatMap(group =>
      (group.permissions ?? [])
        .map(permission => permission?.code)
        .filter((code): code is string => !!code)
    );
  }

  private activePermissionSelection(): Set<string> {
    return this.permissionScope() === 'role'
      ? this.selectedRolePermissions()
      : this.selectedUserPermissions();
  }

  private permissionSelectionBaseline(): Set<string> {
    return this.permissionScope() === 'role'
      ? this.savedRolePermissions()
      : this.savedUserPermissions();
  }

  private applyPermissionSelection(next: Set<string>): void {
    if (this.permissionScope() === 'role') {
      this.selectedRolePermissions.set(next);
    } else {
      this.selectedUserPermissions.set(next);
    }
    this.componentCdr.markForCheck();
  }

  protected override createPermissionSharedGridApi(): SharedGridApi {
    return {
      columns: this.createPermissionSharedColumns(this.defaultPermissionListColumns),
      cdr: {
        markForCheck: () => this.componentCdr.markForCheck()
      },
      getColumnField: column => this.getPermissionSharedColumnField(column),
      toggleColumnVisibility: column => this.togglePermissionSharedColumn(column),
      toggleColumnVisibilityFromMenu: column => this.togglePermissionSharedColumn(column),
      showAllColumnsFromMenu: () => this.showAllPermissionSharedColumns(),
      hideAllColumnsFromMenu: () => this.hideAllPermissionSharedColumns(),
      resetColumns: () => this.resetPermissionSharedColumns(),
      invalidateFilteredSortedCache: () => this.syncPermissionVisibleColumnsFromSharedGrid(),
      syncAggregateDisplayState: () => this.syncPermissionVisibleColumnsFromSharedGrid()
    };
  }
}
