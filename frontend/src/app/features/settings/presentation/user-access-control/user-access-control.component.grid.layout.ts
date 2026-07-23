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
import { UserAccessControlComponentGridColumns } from './user-access-control.component.grid.columns';

@Directive()
export abstract class UserAccessControlComponentGridLayout extends UserAccessControlComponentGridColumns {
  protected override buildAdaptiveColumnWidths<TPayload>(
    columns: ReadonlyArray<AppStatusListColumnKey>,
    groups: ReadonlyArray<AppStatusListGroup<TPayload>>,
    labels: Partial<Record<AppStatusListColumnKey, string>>,
    surface: 'roster' | 'permission',
    availableWidth = 0
  ): AppStatusListColumnWidths {
    const widths: AppStatusListColumnWidths = {};
    const rows = groups.flatMap(group => group.rows).slice(0, 80);
    const measurements = columns.map(column => {
      const bounds = this.columnWidthBounds(column, surface);
      const headerWidth =
        this.measureColumnText(this.resolveColumnLabel(column, labels), 'header') +
        this.columnChromeWidth(column, surface);
      const contentWidth = rows.reduce((maxWidth, row) => {
        const valueWidth =
          this.measureColumnText(this.resolveColumnValue(row, column), 'body') +
          this.columnChromeWidth(column, surface);
        return Math.max(maxWidth, valueWidth);
      }, headerWidth);
      const idealWidth = Math.min(Math.max(Math.ceil(contentWidth), bounds.min), bounds.max);

      return {
        column,
        idealWidth,
        responsiveMin: this.columnResponsiveMinWidth(column, surface, idealWidth),
        hardFloor: this.columnHardFloorWidth(column, surface),
        grow: this.columnGrowWeight(column, surface, idealWidth)
      };
    });
    const fittedMinimums = this.fitAdaptiveColumnMinimums(measurements, surface, availableWidth);

    for (let index = 0; index < measurements.length; index += 1) {
      const measurement = measurements[index];
      widths[measurement.column] = `minmax(${fittedMinimums[index]}px, ${measurement.grow}fr)`;
    }

    return widths;
  }

  private columnResponsiveMinWidth(
    column: AppStatusListColumnKey,
    surface: 'roster' | 'permission',
    idealWidth: number
  ): number {
    const target =
      surface === 'permission'
        ? {
            name: 220,
            department: 104,
            status: 122,
            created: 104,
            updated: 104
          }
        : {
            name: 170,
            taskId: 185,
            assignee: 112,
            status: 108,
            department: 90,
            position: 90,
            phoneNumber: 100,
            loginCount: 64,
            created: 92,
            updated: 92
          };
    const minWidth = (target as Partial<Record<AppStatusListColumnKey, number>>)[column] ?? 108;
    return Math.min(idealWidth, minWidth);
  }

  private columnHardFloorWidth(
    column: AppStatusListColumnKey,
    surface: 'roster' | 'permission'
  ): number {
    const floor =
      surface === 'permission'
        ? {
            name: 180,
            department: 88,
            status: 110,
            created: 96,
            updated: 96
          }
        : {
            name: 140,
            taskId: 160,
            assignee: 100,
            status: 96,
            department: 78,
            position: 78,
            phoneNumber: 90,
            loginCount: 60,
            created: 84,
            updated: 84
          };
    return (floor as Partial<Record<AppStatusListColumnKey, number>>)[column] ?? 88;
  }

  private fitAdaptiveColumnMinimums(
    measurements: ReadonlyArray<{
      column: AppStatusListColumnKey;
      idealWidth: number;
      responsiveMin: number;
      hardFloor: number;
      grow: string;
    }>,
    surface: 'roster' | 'permission',
    availableWidth: number
  ): number[] {
    const widths = measurements.map(measurement => measurement.responsiveMin);
    if (availableWidth <= 0 || !measurements.length) {
      return widths.map(width => Math.round(width));
    }

    const leadingTracks = surface === 'roster' ? 1 : 0;
    const totalTrackCount = measurements.length + leadingTracks;
    const gapBudget = Math.max(totalTrackCount - 1, 0) * this.listGridColumnGapWidth;
    const controlBudget = leadingTracks ? this.listRowControlTrackWidth : 0;
    const columnsBudget = Math.max(0, Math.floor(availableWidth - gapBudget - controlBudget - 6));
    let currentTotal = widths.reduce((sum, width) => sum + width, 0);
    if (currentTotal <= columnsBudget) {
      return widths.map(width => Math.round(width));
    }

    const floors = measurements.map(measurement => measurement.hardFloor);
    const shrinkCaps = widths.map((width, index) => Math.max(width - floors[index], 0));
    const totalShrinkCapacity = shrinkCaps.reduce((sum, width) => sum + width, 0);
    if (totalShrinkCapacity <= 0) {
      return widths.map(width => Math.round(width));
    }

    const deficit = Math.min(currentTotal - columnsBudget, totalShrinkCapacity);
    let remainingDeficit = deficit;
    const active = new Set(
      shrinkCaps.map((cap, index) => (cap > 0 ? index : -1)).filter(index => index >= 0)
    );

    while (remainingDeficit > 0.5 && active.size) {
      const currentCapacity = [...active].reduce(
        (sum, index) => sum + Math.max(widths[index] - floors[index], 0),
        0
      );
      if (currentCapacity <= 0) {
        break;
      }

      let consumedInPass = 0;
      active.forEach(index => {
        const cap = Math.max(widths[index] - floors[index], 0);
        if (cap <= 0) {
          active.delete(index);
          return;
        }
        const portion = remainingDeficit * (cap / currentCapacity);
        const shrink = Math.min(cap, portion);
        widths[index] -= shrink;
        consumedInPass += shrink;
        if (widths[index] - floors[index] <= 0.5) {
          widths[index] = floors[index];
          active.delete(index);
        }
      });

      if (consumedInPass <= 0.01) {
        break;
      }
      remainingDeficit -= consumedInPass;
    }

    currentTotal = widths.reduce((sum, width) => sum + width, 0);
    if (currentTotal > columnsBudget) {
      for (let index = 0; index < widths.length && currentTotal > columnsBudget; index += 1) {
        const cap = Math.max(widths[index] - floors[index], 0);
        if (cap <= 0) continue;
        const shrink = Math.min(cap, currentTotal - columnsBudget);
        widths[index] -= shrink;
        currentTotal -= shrink;
      }
    }

    return widths.map(width => Math.round(width));
  }

  private resolveColumnLabel(
    column: AppStatusListColumnKey,
    labels: Partial<Record<AppStatusListColumnKey, string>>
  ): string {
    const fallbackLabels: Partial<Record<AppStatusListColumnKey, string>> = {
      name: 'Name',
      taskId: 'Email',
      assignee: 'Role',
      status: 'Status',
      department: 'Department',
      position: 'Position',
      phoneNumber: 'Phone',
      loginCount: 'Logins',
      created: 'Joined',
      updated: 'Last active'
    };
    return labels[column] ?? fallbackLabels[column] ?? 'Column';
  }

  private resolveColumnValue<TPayload>(
    row: AppStatusListRow<TPayload>,
    column: AppStatusListColumnKey
  ): string {
    if (column === 'name') return row.title || '--';
    if (column === 'assignee') return row.owner || 'Unassigned';
    if (column === 'status') return row.statusLabel || '--';
    if (column === 'taskId') return row.idLabel || '--';
    if (column === 'created') return row.createdLabel || '--';
    if (column === 'updated') return row.updatedLabel || '--';
    return row.extras?.[column] || '--';
  }

  private columnChromeWidth(
    column: AppStatusListColumnKey,
    surface: 'roster' | 'permission'
  ): number {
    switch (column) {
      case 'name':
        return 44;
      case 'assignee':
        return 68;
      case 'status':
        return surface === 'permission' ? 42 : 48;
      case 'created':
      case 'updated':
        return 34;
      case 'loginCount':
        return 28;
      case 'taskId':
        return 34;
      default:
        return 30;
    }
  }

  private columnWidthBounds(
    column: AppStatusListColumnKey,
    surface: 'roster' | 'permission'
  ): { min: number; max: number } {
    if (surface === 'permission') {
      switch (column) {
        case 'name':
          return { min: 240, max: 420 };
        case 'department':
          return { min: 108, max: 140 };
        case 'created':
        case 'updated':
          return { min: 108, max: 132 };
        case 'status':
          return { min: 132, max: 168 };
        default:
          return { min: 120, max: 220 };
      }
    }

    switch (column) {
      case 'name':
        return { min: 220, max: 420 };
      case 'taskId':
        return { min: 240, max: 420 };
      case 'assignee':
        return { min: 140, max: 260 };
      case 'status':
        return { min: 124, max: 180 };
      case 'department':
      case 'position':
        return { min: 140, max: 240 };
      case 'phoneNumber':
        return { min: 148, max: 240 };
      case 'loginCount':
        return { min: 90, max: 120 };
      case 'created':
      case 'updated':
        return { min: 130, max: 170 };
      default:
        return { min: 120, max: 240 };
    }
  }

  private columnGrowWeight(
    column: AppStatusListColumnKey,
    surface: 'roster' | 'permission',
    width: number
  ): string {
    const base: Partial<Record<AppStatusListColumnKey, number>> =
      surface === 'permission'
        ? {
            name: 1.6,
            department: 0.62,
            created: 0.62,
            updated: 0.62,
            status: 0.78
          }
        : {
            name: 1.2,
            taskId: 1.45,
            assignee: 0.88,
            status: 0.84,
            department: 0.92,
            position: 0.92,
            phoneNumber: 0.92,
            loginCount: 0.55,
            created: 0.82,
            updated: 0.82
          };
    const ratio = Math.max(0.5, Math.min(2.2, width / 180));
    const weight = (base[column] ?? 0.8) * ratio;
    return weight.toFixed(2).replace(/\.00$/, '');
  }

  private measureColumnText(value: string, variant: 'header' | 'body'): number {
    const normalized = (value || '--').trim() || '--';
    const wideAware = normalized.replace(/[^\u0000-\u00ff]/g, 'aa');
    const perChar = variant === 'header' ? 7.6 : 7.15;
    return Math.ceil(wideAware.length * perChar);
  }

  protected override bindListResizeObserver(): void {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => this.scheduleListWidthSync());

    const rosterShell = this.rosterListShellRef?.nativeElement;
    if (rosterShell) {
      this.resizeObserver.observe(rosterShell);
      const rosterSharedScroll = rosterShell.querySelector<HTMLElement>('.tsl-shared-scroll');
      if (rosterSharedScroll) {
        this.resizeObserver.observe(rosterSharedScroll);
      }
    }

    const permissionShell = this.permissionListShellRef?.nativeElement;
    if (permissionShell) {
      this.resizeObserver.observe(permissionShell);
      const permissionSharedScroll =
        permissionShell.querySelector<HTMLElement>('.tsl-shared-scroll');
      if (permissionSharedScroll) {
        this.resizeObserver.observe(permissionSharedScroll);
      }
    }
  }

  protected override scheduleListWidthSync(): void {
    if (typeof window === 'undefined') {
      this.syncListShellWidths();
      return;
    }
    if (this.resizeSyncFrame !== null) {
      window.cancelAnimationFrame(this.resizeSyncFrame);
    }
    this.resizeSyncFrame = window.requestAnimationFrame(() => {
      this.resizeSyncFrame = null;
      this.bindListResizeObserver();
      this.syncListShellWidths();
    });
  }

  private syncListShellWidths(): void {
    const rosterWidth = this.measureListShellWidth(this.rosterListShellRef?.nativeElement);
    if (rosterWidth > 0 && rosterWidth !== this.rosterAvailableWidth()) {
      this.rosterAvailableWidth.set(rosterWidth);
    }

    const permissionWidth = this.measureListShellWidth(this.permissionListShellRef?.nativeElement);
    if (permissionWidth > 0 && permissionWidth !== this.permissionAvailableWidth()) {
      this.permissionAvailableWidth.set(permissionWidth);
    }
  }

  private measureListShellWidth(element?: HTMLElement): number {
    if (!element) return 0;
    const sharedScroll = element.querySelector<HTMLElement>('.tsl-shared-scroll');
    const sharedScrollClientWidth = Math.floor(sharedScroll?.clientWidth || 0);
    if (sharedScrollClientWidth > 0) {
      return sharedScrollClientWidth;
    }
    const rectWidth = Math.floor(element.getBoundingClientRect().width);
    if (rectWidth > 0) {
      return rectWidth;
    }
    return Math.max(0, Math.floor(element.clientWidth || 0));
  }

  onSharedPageSearchChanged(value: string): void {
    if (this.tab() === 'profile') {
      this.rosterQuery = value ?? '';
      this.onRosterFilterChange();
      return;
    }

    if (this.tab() === 'permissions') {
      this.permissionQuery = value ?? '';
      this.componentCdr.markForCheck();
    }
  }

  onRosterColumnWidthsChange(widths: AppStatusListColumnWidths): void {
    this.rosterManualColumnWidths.set({ ...widths });
  }

  onPermissionColumnWidthsChange(widths: AppStatusListColumnWidths): void {
    this.permissionManualColumnWidths.set({ ...widths });
  }

  onRosterRowClick(event: AppStatusListRowClickEvent<UserRow>): void {
    const user = event.row.payload;
    if (!user) {
      return;
    }
    this.openUserDrawer(user);
  }

  public override openCreateUserPanel(): void {
    if (this.tab() !== 'profile' || !this.canCreateAccessControlUser()) {
      return;
    }
    this.awaitingCreateFlowCompletion = false;
    this.createFlowStarted = false;
    this.resetCreateUserDraft();
    this.createUserPanelOpen.set(true);
  }

  closeCreateUserPanel(): void {
    if (this.saving() || this.restoring()) {
      return;
    }
    this.awaitingCreateFlowCompletion = false;
    this.createFlowStarted = false;
    this.createUserPanelOpen.set(false);
    this.resetCreateUserDraft();
  }
}
