import type { AppGroupComposerCreateEvent } from '../group-composer/app-group-composer.component';
import type {
  AppStatusListColumnKey,
  AppStatusListGroup,
  AppStatusListRow
} from '../models/app-status-list.models';
import type { CustomListGroup } from './app-status-list.component.types';
import { AppStatusListUtilityBase } from './app-status-list.utility.base';

export abstract class AppStatusListGroupsBase<
  TPayload = unknown
> extends AppStatusListUtilityBase<TPayload> {
  protected abstract groups: ReadonlyArray<AppStatusListGroup<TPayload>>;
  protected abstract groupReorderEnabled: boolean;
  protected abstract customListGroups: ReadonlyArray<CustomListGroup>;
  protected abstract customListTaskIds: Record<string, string[]>;
  protected abstract customGroupNames: Map<string, string>;
  protected abstract localRowsByGroup: Map<string, AppStatusListRow<TPayload>[]>;

  protected abstract sortedRows(
    rows: ReadonlyArray<AppStatusListRow<TPayload>>
  ): AppStatusListRow<TPayload>[];

  displayGroups(): AppStatusListGroup<TPayload>[] {
    this.syncCustomListTaskIdsFromStorage();
    if (!this.groupReorderEnabled || !this.customListGroups.length) {
      return [...this.groups];
    }

    const rowById = new Map<string, AppStatusListRow<TPayload>>();
    for (const group of this.groups) {
      for (const row of group.rows) rowById.set(row.id, row);
    }

    const assignedTaskIds = new Set<string>();
    const normalizedAssignments: Record<string, string[]> = {};
    let changedAssignments = false;

    for (const custom of this.customListGroups) {
      const source = this.customListTaskIds[custom.id] ?? [];
      const next: string[] = [];
      for (const id of source) {
        if (!rowById.has(id) || assignedTaskIds.has(id)) {
          changedAssignments = true;
          continue;
        }
        assignedTaskIds.add(id);
        next.push(id);
      }
      normalizedAssignments[custom.id] = next;
      if (next.length !== source.length || next.some((id, idx) => id !== source[idx])) {
        changedAssignments = true;
      }
    }

    if (changedAssignments) {
      this.customListTaskIds = normalizedAssignments;
      this.writeCustomListTaskIds();
    }

    const baseGroups = this.groups.map(group => ({
      ...group,
      rows: group.rows.filter(row => !assignedTaskIds.has(row.id)),
      count: group.rows.filter(row => !assignedTaskIds.has(row.id)).length
    }));

    const customGroups = this.customListGroups.map(custom => {
      const taskIds = this.customListTaskIds[custom.id] ?? [];
      const rows = taskIds
        .map(id => rowById.get(id))
        .filter((row): row is AppStatusListRow<TPayload> => !!row);

      return {
        id: custom.id,
        name: custom.name,
        toneClass: 'status-custom',
        count: rows.length,
        rows
      } as AppStatusListGroup<TPayload>;
    });

    return [...baseGroups, ...customGroups];
  }

  get customListGroupNames(): ReadonlyArray<string> {
    return this.customListGroups.map(group => group.name);
  }

  onListComposerCreate(event: AppGroupComposerCreateEvent): void {
    this.createCustomListGroup(event.name, event.color, event.icon);
  }

  isCustomListGroupId(groupId: string): boolean {
    if (!this.groupReorderEnabled) return false;
    const id = (groupId || '').trim();
    return !!id && this.customListGroups.some(group => group.id === id);
  }

  rowsForGroup(group: AppStatusListGroup<TPayload>): AppStatusListRow<TPayload>[] {
    return this.sortedRows(group.rows);
  }

  dropListId(groupId: string): string {
    return `tsl-drop-${groupId}`;
  }

  connectedDropListIds(): string[] {
    return this.displayGroups().map(group => this.dropListId(group.id));
  }

  groupDisplayName(group: AppStatusListGroup<TPayload>): string {
    if (this.isCustomListGroupId(group.id)) {
      const custom = this.customListGroups.find(item => item.id === group.id);
      if (custom?.name?.trim()) return custom.name.trim();
    }
    const override = this.customGroupNames.get(group.id)?.trim();
    return override || group.name;
  }

  groupStatusIcon(group: AppStatusListGroup<TPayload>): string | null {
    if (this.isCustomListGroupId(group.id)) {
      const custom = this.customListGroups.find(item => item.id === group.id);
      return custom?.icon || 'circle-fill';
    }

    const id = (group.id || '').toLowerCase();
    const tone = (group.toneClass || '').toLowerCase();
    const isStatusGroup = id.startsWith('status-') || tone.startsWith('status-');
    if (!isStatusGroup) return null;

    if (id.includes('backlog') || tone.includes('backlog')) return 'circle';
    if (id.includes('in_progress') || tone.includes('progress')) return 'record-circle';
    if (id.includes('review') || tone.includes('review')) return 'search';
    if (id.includes('blocked') || tone.includes('blocked')) return 'exclamation-octagon';
    if (id.includes('done') || tone.includes('done')) return 'check-circle-fill';

    return 'circle-fill';
  }

  groupPillStyle(group: AppStatusListGroup<TPayload>): Record<string, string> | null {
    if (!this.isCustomListGroupId(group.id)) return null;
    const custom = this.customListGroups.find(item => item.id === group.id);
    const color = this.normalizeHexColor(custom?.color ?? '');
    if (!color) return null;
    return { '--tsl-custom-pill': color };
  }

  groupCount(group: AppStatusListGroup<TPayload>): number {
    return group.count + (this.localRowsByGroup.get(group.id)?.length ?? 0);
  }

  localRows(groupId: string): AppStatusListRow<TPayload>[] {
    return this.localRowsByGroup.get(groupId) ?? [];
  }
}
