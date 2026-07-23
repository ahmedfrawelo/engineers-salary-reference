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
import { UserAccessControlComponentWorkspace } from './user-access-control.component.workspace';

@Directive()
export abstract class UserAccessControlComponentGridColumns extends UserAccessControlComponentWorkspace {
  protected abstract override openUserDrawer(user: UserRow): void;
  protected abstract resetCreateUserDraft(): void;

  protected override createRosterSharedGridApi(): SharedGridApi {
    return {
      columns: this.createRosterSharedColumns(this.defaultRosterListColumns),
      cdr: {
        markForCheck: () => this.componentCdr.markForCheck()
      },
      getColumnField: column => this.getRosterSharedColumnField(column),
      toggleColumnVisibility: column => this.toggleRosterSharedColumn(column),
      toggleColumnVisibilityFromMenu: column => this.toggleRosterSharedColumn(column),
      showAllColumnsFromMenu: () => this.showAllRosterSharedColumns(),
      hideAllColumnsFromMenu: () => this.hideAllRosterSharedColumns(),
      resetColumns: () => this.resetRosterSharedColumns(),
      invalidateFilteredSortedCache: () => this.syncRosterVisibleColumnsFromSharedGrid(),
      syncAggregateDisplayState: () => this.syncRosterVisibleColumnsFromSharedGrid()
    };
  }

  protected override createPermissionSharedColumns(
    visibleColumns: ReadonlyArray<AppStatusListColumnKey>,
    orderedColumns: ReadonlyArray<AppStatusListColumnKey> = this.defaultPermissionListColumns
  ): SharedGridColumn[] {
    const visibleSet = new Set(this.normalizePermissionVisibleColumns(visibleColumns));
    const orderedKeys = this.normalizePermissionColumnOrder(orderedColumns);
    return orderedKeys.map(column => ({
      field: column,
      header: this.permissionSharedColumnLabel(column),
      hidden: !visibleSet.has(column),
      filterable: true,
      groupable: true,
      hugeIcon: this.permissionSharedColumnHugeIcon(column),
      hugeIconSize: 15,
      hugeIconStrokeWidth: 1.9,
      pinned: column === 'name' ? 'left' : undefined,
      type: this.permissionSharedColumnType(column)
    }));
  }

  private createRosterSharedColumns(
    visibleColumns: ReadonlyArray<AppStatusListColumnKey>,
    orderedColumns: ReadonlyArray<AppStatusListColumnKey> = this.defaultRosterListColumns
  ): SharedGridColumn[] {
    const visibleSet = new Set(this.normalizeRosterVisibleColumns(visibleColumns));
    const orderedKeys = this.normalizeRosterColumnOrder(orderedColumns);
    return orderedKeys.map(column => ({
      field: column,
      header: this.rosterSharedColumnLabel(column),
      hidden: !visibleSet.has(column),
      filterable: true,
      groupable: true,
      hugeIcon: this.rosterSharedColumnHugeIcon(column),
      hugeIconSize: 15,
      hugeIconStrokeWidth: 1.9,
      pinned: column === 'name' ? 'left' : undefined,
      type: this.rosterSharedColumnType(column)
    }));
  }

  private normalizeRosterColumnOrder(
    columns: ReadonlyArray<AppStatusListColumnKey>
  ): AppStatusListColumnKey[] {
    const normalized = columns.filter(
      (column, index, items) => this.isRosterColumnKey(column) && items.indexOf(column) === index
    );
    const remaining = this.defaultRosterListColumns.filter(column => !normalized.includes(column));
    return [...normalized, ...remaining];
  }

  private normalizePermissionColumnOrder(
    columns: ReadonlyArray<AppStatusListColumnKey>
  ): AppStatusListColumnKey[] {
    const normalized = columns.filter(
      (column, index, items) =>
        this.isPermissionColumnKey(column) && items.indexOf(column) === index
    );
    const remaining = this.defaultPermissionListColumns.filter(
      column => !normalized.includes(column)
    );
    return [...normalized, ...remaining];
  }

  private normalizeRosterVisibleColumns(
    columns: ReadonlyArray<AppStatusListColumnKey>
  ): AppStatusListColumnKey[] {
    const normalized = columns.filter(
      (column, index, items) => this.isRosterColumnKey(column) && items.indexOf(column) === index
    );
    const visible = normalized.filter(column => column !== 'name');
    return ['name', ...visible];
  }

  private normalizePermissionVisibleColumns(
    columns: ReadonlyArray<AppStatusListColumnKey>
  ): AppStatusListColumnKey[] {
    const normalized = columns.filter(
      (column, index, items) =>
        this.isPermissionColumnKey(column) && items.indexOf(column) === index
    );
    const visible = normalized.filter(column => column !== 'name');
    return ['name', ...visible];
  }

  private rosterSharedColumnLabel(column: AppStatusListColumnKey): string {
    if (column === 'name') {
      return 'Name';
    }
    return this.rosterListColumnLabels[column] ?? column;
  }

  private permissionSharedColumnLabel(column: AppStatusListColumnKey): string {
    if (column === 'name') {
      return 'Page';
    }
    return this.permissionListColumnLabels[column] ?? column;
  }

  private rosterSharedColumnHugeIcon(column: AppStatusListColumnKey): SharedGridColumn['hugeIcon'] {
    switch (column) {
      case 'name':
        return UserCircleIcon;
      case 'taskId':
        return Mail01Icon;
      case 'assignee':
        return UserAccountIcon;
      case 'status':
        return CheckmarkCircle02Icon;
      case 'department':
        return Building03Icon;
      case 'position':
        return Briefcase02Icon;
      case 'phoneNumber':
        return SmartPhone01Icon;
      case 'loginCount':
        return Login01Icon;
      case 'created':
        return Calendar01Icon;
      case 'updated':
        return Activity01Icon;
      default:
        return undefined;
    }
  }

  private permissionSharedColumnHugeIcon(
    column: AppStatusListColumnKey
  ): SharedGridColumn['hugeIcon'] {
    switch (column) {
      case 'name':
        return ClipboardIcon;
      case 'department':
        return Building03Icon;
      case 'created':
        return CheckmarkCircle02Icon;
      case 'updated':
        return Activity01Icon;
      case 'status':
        return SecurityCheckIcon;
      default:
        return undefined;
    }
  }

  private rosterSharedColumnType(column: AppStatusListColumnKey): SharedGridColumn['type'] {
    if (column === 'loginCount') {
      return 'number';
    }
    if (column === 'created' || column === 'updated') {
      return 'date';
    }
    if (column === 'status' || column === 'assignee') {
      return 'dropdown';
    }
    return 'text';
  }

  private permissionSharedColumnType(column: AppStatusListColumnKey): SharedGridColumn['type'] {
    if (column === 'created' || column === 'updated') {
      return 'number';
    }
    if (column === 'status') {
      return 'dropdown';
    }
    return 'text';
  }

  private getRosterSharedColumnField(column: SharedGridColumn): string {
    return typeof column?.field === 'string' ? column.field : '';
  }

  protected override getPermissionSharedColumnField(column: SharedGridColumn): string {
    return typeof column?.field === 'string' ? column.field : '';
  }

  private isRosterColumnKey(
    value: string | AppStatusListColumnKey
  ): value is AppStatusListColumnKey {
    return this.defaultRosterListColumns.includes(value as AppStatusListColumnKey);
  }

  private isPermissionColumnKey(
    value: string | AppStatusListColumnKey
  ): value is AppStatusListColumnKey {
    return this.defaultPermissionListColumns.includes(value as AppStatusListColumnKey);
  }

  private toggleRosterSharedColumn(column: SharedGridColumn): void {
    const field = this.getRosterSharedColumnField(column);
    if (!this.isRosterColumnKey(field) || field === 'name') {
      return;
    }

    const target = this.rosterSharedGridApi.columns.find(
      item => this.getRosterSharedColumnField(item) === field
    );
    if (!target) {
      return;
    }

    target.hidden = !target.hidden;
    this.syncRosterVisibleColumnsFromSharedGrid();
  }

  protected override togglePermissionSharedColumn(column: SharedGridColumn): void {
    const field = this.getPermissionSharedColumnField(column);
    if (!this.isPermissionColumnKey(field) || field === 'name') {
      return;
    }

    const target = this.permissionSharedGridApi.columns.find(
      item => this.getPermissionSharedColumnField(item) === field
    );
    if (!target) {
      return;
    }

    target.hidden = !target.hidden;
    this.syncPermissionVisibleColumnsFromSharedGrid();
  }

  private showAllRosterSharedColumns(): void {
    this.rosterSharedGridApi.columns.forEach(column => {
      column.hidden = false;
    });
    this.syncRosterVisibleColumnsFromSharedGrid();
  }

  protected override showAllPermissionSharedColumns(): void {
    this.permissionSharedGridApi.columns.forEach(column => {
      column.hidden = false;
    });
    this.syncPermissionVisibleColumnsFromSharedGrid();
  }

  private hideAllRosterSharedColumns(): void {
    this.rosterSharedGridApi.columns.forEach(column => {
      column.hidden = this.getRosterSharedColumnField(column) !== 'name';
    });
    this.syncRosterVisibleColumnsFromSharedGrid();
  }

  protected override hideAllPermissionSharedColumns(): void {
    this.permissionSharedGridApi.columns.forEach(column => {
      column.hidden = this.getPermissionSharedColumnField(column) !== 'name';
    });
    this.syncPermissionVisibleColumnsFromSharedGrid();
  }

  private resetRosterSharedColumns(): void {
    this.rosterManualColumnWidths.set({});
    this.rosterSharedGridApi.columns = this.createRosterSharedColumns(
      this.defaultRosterListColumns,
      this.defaultRosterListColumns
    );
    this.syncRosterVisibleColumnsFromSharedGrid();
  }

  protected override resetPermissionSharedColumns(): void {
    this.permissionManualColumnWidths.set({});
    this.permissionSharedGridApi.columns = this.createPermissionSharedColumns(
      this.defaultPermissionListColumns,
      this.defaultPermissionListColumns
    );
    this.syncPermissionVisibleColumnsFromSharedGrid();
  }

  private syncRosterVisibleColumnsFromSharedGrid(): void {
    const orderedColumns = this.normalizeRosterColumnOrder(
      this.rosterSharedGridApi.columns
        .map(column => this.getRosterSharedColumnField(column))
        .filter((column): column is AppStatusListColumnKey => this.isRosterColumnKey(column))
    );
    const visibleColumns = this.normalizeRosterVisibleColumns(
      orderedColumns.filter(column => {
        const target = this.rosterSharedGridApi.columns.find(
          item => this.getRosterSharedColumnField(item) === column
        );
        return !target?.hidden;
      })
    );

    this.rosterSharedGridApi.columns = this.createRosterSharedColumns(
      visibleColumns,
      orderedColumns
    );
    this.rosterListColumns.set(visibleColumns);
    this.componentCdr.markForCheck();
  }

  protected override syncPermissionVisibleColumnsFromSharedGrid(): void {
    const orderedColumns = this.normalizePermissionColumnOrder(
      this.permissionSharedGridApi.columns
        .map(column => this.getPermissionSharedColumnField(column))
        .filter((column): column is AppStatusListColumnKey => this.isPermissionColumnKey(column))
    );
    const visibleColumns = this.normalizePermissionVisibleColumns(
      orderedColumns.filter(column => {
        const target = this.permissionSharedGridApi.columns.find(
          item => this.getPermissionSharedColumnField(item) === column
        );
        return !target?.hidden;
      })
    );

    this.permissionSharedGridApi.columns = this.createPermissionSharedColumns(
      visibleColumns,
      orderedColumns
    );
    this.permissionListColumns.set(visibleColumns);
    this.componentCdr.markForCheck();
  }
}
