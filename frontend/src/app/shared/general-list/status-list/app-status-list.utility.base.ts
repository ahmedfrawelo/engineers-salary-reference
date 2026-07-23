import type { AppStatusListColumnKey, AppStatusListRow } from '../models/app-status-list.models';
import type { CustomListGroup } from './app-status-list.component.types';
import {
  createStatusListCustomListGroup,
  initStatusListGroupIconLibrary,
  insertStatusListTaskIntoCustomList,
  pickRandomStatusListSuggestedIcon,
  pushStatusListMyColor,
  readStatusListCustomListGroups,
  readStatusListMyColors,
  rebuildStatusListSuggestedGroupOptions,
  removeStatusListTaskFromAllCustomLists,
  syncStatusListCustomListTaskIdsFromStorage,
  writeStatusListCustomListGroups,
  writeStatusListCustomListTaskIds,
  type AppStatusListCustomGroupHost
} from './app-status-list.custom-groups.utils';
import {
  clampStatusListValue,
  compareStatusListRows,
  hsvStatusListToHex,
  normalizeStatusListGroupIcon,
  normalizeStatusListHexColor,
  parseStatusListChannel,
  sortStatusListValueForColumn,
  statusListHexToRgb,
  statusListHslToRgb,
  statusListRgbToHex,
  statusListRgbToHsl,
  statusListRgbToHsv,
  statusListHsvToRgb,
  syncStatusListCustomPickerFromHex,
  updateStatusListColorFromCustomPicker,
  updateStatusListPickerFromAreaPointer,
  type AppStatusListColorHost
} from './app-status-list.color-sort.utils';

export abstract class AppStatusListUtilityBase<TPayload = unknown> {
  protected abstract readonly columnHeaders: Record<AppStatusListColumnKey, string>;

  protected columnKeys(): AppStatusListColumnKey[] {
    return Object.keys(this.columnHeaders) as AppStatusListColumnKey[];
  }

  protected ensureNameFirst(
    columns: ReadonlyArray<AppStatusListColumnKey>
  ): AppStatusListColumnKey[] {
    const normalized = columns.filter((key, index, arr) => arr.indexOf(key) === index);
    const withoutName = normalized.filter(key => key !== 'name');
    return ['name', ...withoutName];
  }

  protected groupIdFromDropListId(dropListId: string | undefined): string | null {
    const id = (dropListId || '').trim();
    const prefix = 'tsl-drop-';
    if (!id.startsWith(prefix)) return null;
    return id.slice(prefix.length) || null;
  }

  protected customGroupHost(): AppStatusListCustomGroupHost {
    return this as unknown as AppStatusListCustomGroupHost;
  }

  protected readCustomListGroups(): CustomListGroup[] {
    return readStatusListCustomListGroups(this.customGroupHost());
  }

  protected writeCustomListGroups(): void {
    return writeStatusListCustomListGroups(this.customGroupHost());
  }

  protected syncCustomListTaskIdsFromStorage(): void {
    return syncStatusListCustomListTaskIdsFromStorage(this.customGroupHost());
  }

  protected writeCustomListTaskIds(): void {
    return writeStatusListCustomListTaskIds(this.customGroupHost());
  }

  protected readMyColors(): string[] {
    return readStatusListMyColors(this.customGroupHost());
  }

  protected pushMyColor(color: string): void {
    return pushStatusListMyColor(this.customGroupHost(), color);
  }

  protected removeTaskFromAllCustomLists(taskId: string): void {
    return removeStatusListTaskFromAllCustomLists(this.customGroupHost(), taskId);
  }

  protected insertTaskIntoCustomList(groupId: string, taskId: string, index: number): void {
    return insertStatusListTaskIntoCustomList(this.customGroupHost(), groupId, taskId, index);
  }

  protected createCustomListGroup(name: string, color: string, icon?: string): boolean {
    return createStatusListCustomListGroup(this.customGroupHost(), name, color, icon);
  }

  protected rebuildSuggestedGroupOptions(): void {
    return rebuildStatusListSuggestedGroupOptions(this.customGroupHost());
  }

  protected randomSuggestedIcon(): string {
    return pickRandomStatusListSuggestedIcon(this.customGroupHost());
  }

  protected initGroupIconLibrary(): void {
    return initStatusListGroupIconLibrary(this.customGroupHost());
  }

  protected canContinueVerticalScroll(container: HTMLElement, deltaY: number): boolean {
    if (!Number.isFinite(deltaY) || deltaY === 0) return false;
    if (container.scrollHeight <= container.clientHeight + 1) return false;

    const atTop = container.scrollTop <= 0;
    const atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 1;
    const scrollingDown = deltaY > 0;

    return !(atTop && !scrollingDown) && !(atBottom && scrollingDown);
  }

  protected isHorizontalWheelZone(target: HTMLElement | null): boolean {
    if (!target) return false;
    return !!target.closest(
      '.tsl-group-head, .tsl-grid-head, .tsl-grid-row-add, .tsl-add-list-row'
    );
  }

  protected canScrollHorizontally(element: HTMLElement): boolean {
    if (element.scrollWidth <= element.clientWidth + 1) return false;
    const overflowX = getComputedStyle(element).overflowX;
    return overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'overlay';
  }

  protected colorHost(): AppStatusListColorHost<TPayload> {
    return this as unknown as AppStatusListColorHost<TPayload>;
  }

  protected updateColorFromCustomPicker(): void {
    return updateStatusListColorFromCustomPicker(this.colorHost());
  }

  protected updatePickerFromAreaPointer(event: PointerEvent, area: HTMLElement): void {
    return updateStatusListPickerFromAreaPointer(this.colorHost(), event, area);
  }

  protected normalizeHexColor(value: string): string | null {
    return normalizeStatusListHexColor(value);
  }

  protected normalizeGroupIcon(value: string | null | undefined): string | null {
    return normalizeStatusListGroupIcon(this.colorHost(), value);
  }

  protected hexToRgb(hex: string): [number, number, number] | null {
    return statusListHexToRgb(hex);
  }

  protected rgbToHex(r: number, g: number, b: number): string {
    return statusListRgbToHex(r, g, b);
  }

  protected parseChannel(value: string, min: number, max: number, fallback: number): number {
    return parseStatusListChannel(value, min, max, fallback);
  }

  protected syncCustomPickerFromHex(hex: string): void {
    return syncStatusListCustomPickerFromHex(this.colorHost(), hex);
  }

  protected rgbToHsv(r: number, g: number, b: number): [number, number, number] {
    return statusListRgbToHsv(r, g, b);
  }

  protected rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    return statusListRgbToHsl(r, g, b);
  }

  protected hsvToHex(h: number, s: number, v: number): string {
    return hsvStatusListToHex(h, s, v);
  }

  protected hsvToRgb(h: number, s: number, v: number): [number, number, number] {
    return statusListHsvToRgb(h, s, v);
  }

  protected hslToRgb(h: number, s: number, l: number): [number, number, number] {
    return statusListHslToRgb(h, s, l);
  }

  protected clamp(value: number, min: number, max: number): number {
    return clampStatusListValue(value, min, max);
  }

  protected compareRows(
    a: AppStatusListRow<TPayload>,
    b: AppStatusListRow<TPayload>,
    column: AppStatusListColumnKey,
    direction: 'asc' | 'desc'
  ): number {
    return compareStatusListRows(this.colorHost(), a, b, column, direction);
  }

  protected sortValueForColumn(
    row: AppStatusListRow<TPayload>,
    column: AppStatusListColumnKey
  ): number | string {
    return sortStatusListValueForColumn(this.colorHost(), row, column);
  }
}
