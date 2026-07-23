import { DOCUMENT } from '@angular/common';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import {
  CdkOverlayOrigin,
  ConnectedOverlayPositionChange,
  ConnectedPosition
} from '@angular/cdk/overlay';
import {
  AfterViewChecked,
  AfterViewInit,
  Directive,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  inject
} from '@angular/core';
import type { AppGroupComposerCreateEvent } from '../group-composer/app-group-composer.component';
import {
  AppStatusListCellCommentEvent,
  AppStatusListCellEditEvent,
  AppStatusListCellEditorConfig,
  AppStatusListCellEditorOption,
  AppStatusListCellEditorType,
  AppStatusListGroupAction,
  AppStatusListGroupActionEvent,
  AppStatusListGroupRenameEvent,
  AppStatusListColumnKey,
  AppStatusListColumnWidths,
  AppStatusListGroup,
  AppStatusListGroupMoveEvent,
  AppStatusListRow,
  AppStatusListQuickAddEvent,
  AppStatusListRowClickEvent,
  AppStatusListRowMoveEvent
} from '../models/app-status-list.models';
import {
  APP_STATUS_LIST_ADD_COLUMN_TRACK_WIDTH,
  APP_STATUS_LIST_CALC_MENU_POSITIONS,
  APP_STATUS_LIST_CALC_OPERATION_OPTIONS,
  APP_STATUS_LIST_CELL_EDITOR_POSITIONS,
  APP_STATUS_LIST_COLUMN_HEADERS,
  APP_STATUS_LIST_COLUMN_TEMPLATE,
  APP_STATUS_LIST_CUSTOM_COLOR_FORMATS,
  APP_STATUS_LIST_DEFAULT_COLUMNS,
  APP_STATUS_LIST_DEFAULT_COLUMN_TRACK,
  APP_STATUS_LIST_FALLBACK_GROUP_ICON_LIBRARY,
  APP_STATUS_LIST_GRID_COLUMN_GAP_WIDTH,
  APP_STATUS_LIST_GROUP_COLOR_PRESETS,
  APP_STATUS_LIST_GROUP_ICON_CATEGORY_DEFS,
  APP_STATUS_LIST_QUICK_COMPOSE_PICKER_POSITIONS,
  APP_STATUS_LIST_ROW_CONTROL_TRACK_WIDTH,
  APP_STATUS_LIST_ROW_MENU_POSITIONS,
  APP_STATUS_LIST_SUGGESTED_GROUP_ICON_SEEDS,
  APP_STATUS_LIST_SUGGESTED_GROUP_NAME_SEEDS
} from './app-status-list.constants';
import type {
  ActiveCalcMenuState,
  ActiveCellEditorState,
  ActiveResizeState,
  ActiveRowMenuState,
  AppStatusListRowAction,
  ColorTextFormat,
  CustomListGroup,
  GroupPickerTab,
  QuickComposePickerState,
  QuickComposePickerTab,
  SuggestedGroupOption
} from './app-status-list.component.types';
import { AppStatusListGroupsBase } from './app-status-list.groups.base';

@Directive()
export abstract class AppStatusListLogicKernel<TPayload = unknown>
  extends AppStatusListGroupsBase<TPayload>
  implements OnInit, OnDestroy, AfterViewInit, AfterViewChecked
{
  private lastGridSyncSignature = '';
  private readonly hostRef = inject(ElementRef<HTMLElement>);
  @ViewChild('sharedScroll') private sharedScrollRef?: ElementRef<HTMLElement>;
  @ViewChild('bottomScrollRail') private bottomScrollRailRef?: ElementRef<HTMLElement>;
  private syncingSharedScroll = false;
  private syncingBottomRail = false;
  private readonly negligibleHorizontalOverflowPx = 32;
  @Input() groups: ReadonlyArray<AppStatusListGroup<TPayload>> = [];
  @Input() collapsedGroupIds: ReadonlySet<string> | null = null;
  @Input() stickyHorizontalRail = false;
  @Input() stretchToContainer = true;
  @Input() itemLabel = 'task';
  @Input() selectionEnabled = true;
  @Input() rowMenuEnabled = true;
  @Input() rowDragEnabled = true;
  @Input() openOnReadOnlyCellClick = false;
  @Input() hideReadOnlyCellAffordances = false;
  @Input() hideCellHoverAffordances = false;
  @Input() groupActionsEnabled = true;
  @Input() addRowEnabled = true;
  @Input() columnManagementEnabled = true;
  @Input() columnLabels: Partial<Record<AppStatusListColumnKey, string>> | null = null;
  @Input() set selectedRowIds(value: ReadonlySet<string> | null) {
    this.internalSelectedRowIds = value ? new Set(value) : new Set<string>();
  }
  @HostBinding('class.tsl-host-with-bottom-rail')
  get hasStickyHorizontalRailClass(): boolean {
    return this.stickyHorizontalRail;
  }
  @HostBinding('class.tsl-host-hide-readonly-affordances')
  get hasHiddenReadOnlyCellAffordancesClass(): boolean {
    return this.hideReadOnlyCellAffordances;
  }
  @HostBinding('class.tsl-host-hide-cell-hover-affordances')
  get hasHiddenCellHoverAffordancesClass(): boolean {
    return this.hideCellHoverAffordances;
  }
  @HostBinding('style.--tsl-leading-sticky-offset')
  get leadingStickyOffset(): string {
    return this.hasLeadingControlTrack() ? `${this.rowControlTrackWidth}px` : '0px';
  }
  @Input() set visibleColumns(value: ReadonlyArray<AppStatusListColumnKey> | null) {
    this.visibleColumnsInput = value;
    this.manualColumnOrder = null;
    queueMicrotask(() => this.syncGridGeometryDom());
  }
  get visibleColumns(): ReadonlyArray<AppStatusListColumnKey> | null {
    return this.visibleColumnsInput;
  }
  @Input() addRowLabel = 'Add Task';
  @Input() addListLabel = 'Add List';
  @Input() showAddListControl = true;
  @Input() customListsStorageKey = 'tasks_board_custom_groups_v1';
  @Input() customListPaletteStorageKey = 'tasks_board_custom_group_palette_v1';
  @Input() groupReorderEnabled = false;
  @Input() cellEditorConfig: Partial<
    Record<AppStatusListColumnKey, AppStatusListCellEditorConfig>
  > | null = null;
  @Input() set columnWidths(value: AppStatusListColumnWidths | null) {
    this.columnWidthOverrides = this.normalizeColumnWidths(value);
    queueMicrotask(() => this.syncGridGeometryDom());
  }

  @Output() groupToggle = new EventEmitter<string>();
  @Output() groupMenu = new EventEmitter<string>();
  @Output() groupAdd = new EventEmitter<string>();
  @Output() groupMove = new EventEmitter<AppStatusListGroupMoveEvent<TPayload>>();
  @Output() groupAction = new EventEmitter<AppStatusListGroupActionEvent>();
  @Output() groupRename = new EventEmitter<AppStatusListGroupRenameEvent>();
  @Output() addRow = new EventEmitter<string>();
  @Output() quickAddSubmit = new EventEmitter<AppStatusListQuickAddEvent>();
  @Output() rowClick = new EventEmitter<AppStatusListRowClickEvent<TPayload>>();
  @Output() rowMove = new EventEmitter<AppStatusListRowMoveEvent<TPayload>>();
  @Output() columnsReorder = new EventEmitter<AppStatusListColumnKey[]>();
  @Output() columnWidthsChange = new EventEmitter<AppStatusListColumnWidths>();
  @Output() columnsPanelRequest = new EventEmitter<void>();
  @Output() cellEdit = new EventEmitter<AppStatusListCellEditEvent<TPayload>>();
  @Output() cellComment = new EventEmitter<AppStatusListCellCommentEvent<TPayload>>();
  @Output() rowAction = new EventEmitter<{
    groupId: string;
    row: AppStatusListRow<TPayload>;
    action: AppStatusListRowAction;
  }>();
  @Output() selectedRowIdsChange = new EventEmitter<ReadonlySet<string>>();
  @Output() sortChange = new EventEmitter<{
    column: AppStatusListColumnKey | null;
    direction: 'asc' | 'desc' | null;
  }>();

  private readonly doc = inject(DOCUMENT);
  private transientDomListenersAttached = false;
  private readonly documentPointerDownHandler = (event: PointerEvent) =>
    this.onDocumentPointerDown(event);
  private readonly documentEscapeHandler = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      this.onDocumentEscape();
    }
  };
  private visibleColumnsInput: ReadonlyArray<AppStatusListColumnKey> | null = null;
  private manualColumnOrder: AppStatusListColumnKey[] | null = null;
  private columnWidthOverrides: AppStatusListColumnWidths = {};
  private internalSelectedRowIds = new Set<string>();
  protected customGroupNames = new Map<string, string>();
  protected localRowsByGroup = new Map<string, AppStatusListRow<TPayload>[]>();
  private quickAddGroupId: string | null = null;
  private quickAddTitleDraft = '';
  private quickAddStatusByGroup = new Map<string, string>();
  private quickAddTaskTypeByGroup = new Map<string, string>();
  private quickComposePicker: QuickComposePickerState | null = null;
  private activeSortColumn: AppStatusListColumnKey | null = null;
  private activeSortDirection: 'asc' | 'desc' | null = null;
  private draggingSourceGroupId: string | null = null;
  private draggingTargetGroupId: string | null = null;
  private openGroupMenuId: string | null = null;
  addingGroup = false;
  groupDraft = '';
  groupColorDraft = '#14b8a6';
  groupIconDraft = 'circle-fill';
  suggestedGroupsOpen = false;
  suggestedGroupOptions: ReadonlyArray<SuggestedGroupOption> = [];
  readonly suggestedGroupNameSeeds = APP_STATUS_LIST_SUGGESTED_GROUP_NAME_SEEDS;
  readonly fallbackGroupIconLibrary = APP_STATUS_LIST_FALLBACK_GROUP_ICON_LIBRARY;
  groupIconLibrary: ReadonlyArray<string> = [];
  readonly suggestedGroupIconSeeds = APP_STATUS_LIST_SUGGESTED_GROUP_ICON_SEEDS;
  private groupIconSet = new Set<string>(this.fallbackGroupIconLibrary);
  readonly groupIconCategoryDefs = APP_STATUS_LIST_GROUP_ICON_CATEGORY_DEFS;
  colorPickerOpen = false;
  groupPickerTab: GroupPickerTab = 'color';
  groupIconCategory = 'all';
  groupIconSearch = '';
  groupIconCategoryMenuOpen = false;
  groupIconCounts: Record<string, number> = {};
  private groupIconsByCategory: Record<string, string[]> = {};
  customColorEditorOpen = false;
  customColorDraft = '#14b8a6';
  customColorFormat: ColorTextFormat = 'hex';
  customFormatMenuOpen = false;
  readonly customColorFormats: ReadonlyArray<ColorTextFormat> =
    APP_STATUS_LIST_CUSTOM_COLOR_FORMATS;
  customHue = 171;
  customSaturation = 88;
  customValue = 72;
  customAreaDragging = false;
  readonly groupColorPresets = APP_STATUS_LIST_GROUP_COLOR_PRESETS;
  groupMyColors: ReadonlyArray<string> = [];
  customListGroups: ReadonlyArray<CustomListGroup> = [];
  protected customListTaskIds: Record<string, string[]> = {};
  private customListTaskIdsStorageSnapshot: string | null = null;
  private localCollapsedCustomGroupIds = new Set<string>();
  private renameGroupId: string | null = null;
  private renameDraft = '';
  private activeResize: ActiveResizeState | null = null;
  private removeResizeListeners: (() => void) | null = null;
  private activeCellEditor: ActiveCellEditorState<TPayload> | null = null;
  private activeRowMenu: ActiveRowMenuState<TPayload> | null = null;
  private activeCalcMenu: ActiveCalcMenuState | null = null;
  private openRowSubmenuKey: string | null = null;
  private calcMenuOptionsOpen = false;
  private calcOperationsByKey = new Map<string, string>();
  private rowMenuOpenedAt = 0;
  readonly rowMenuPositions: ConnectedPosition[] = APP_STATUS_LIST_ROW_MENU_POSITIONS;
  readonly calcMenuPositions: ConnectedPosition[] = APP_STATUS_LIST_CALC_MENU_POSITIONS;
  readonly cellEditorPositions: ConnectedPosition[] = APP_STATUS_LIST_CELL_EDITOR_POSITIONS;
  readonly quickComposePickerPositions: ConnectedPosition[] =
    APP_STATUS_LIST_QUICK_COMPOSE_PICKER_POSITIONS;
  readonly calcOperationOptions: ReadonlyArray<{ value: string; label: string }> =
    APP_STATUS_LIST_CALC_OPERATION_OPTIONS;
  readonly defaultColumns: AppStatusListColumnKey[] = APP_STATUS_LIST_DEFAULT_COLUMNS;
  readonly columnHeaders: Record<AppStatusListColumnKey, string> = APP_STATUS_LIST_COLUMN_HEADERS;
  private readonly defaultColumnTrack = APP_STATUS_LIST_DEFAULT_COLUMN_TRACK;
  private readonly rowControlTrackWidth = APP_STATUS_LIST_ROW_CONTROL_TRACK_WIDTH;
  private readonly addColumnTrackWidth = APP_STATUS_LIST_ADD_COLUMN_TRACK_WIDTH;
  private readonly gridColumnGapWidth = APP_STATUS_LIST_GRID_COLUMN_GAP_WIDTH;
  private readonly columnTemplate: Partial<Record<AppStatusListColumnKey, string>> =
    APP_STATUS_LIST_COLUMN_TEMPLATE;

  gridTemplate(columns: ReadonlyArray<AppStatusListColumnKey> = this.resolvedColumns()): string {
    const tracks = columns.map(key => {
      const width = this.columnWidthOverrides[key];
      if (typeof width === 'number' && Number.isFinite(width) && width > 0) {
        return `${Math.round(width)}px`;
      }
      if (typeof width === 'string' && width.trim()) {
        return width.trim();
      }
      return this.columnTemplate[key] ?? this.defaultColumnTrack;
    });

    if (this.hasLeadingControlTrack()) {
      tracks.unshift(`${this.rowControlTrackWidth}px`);
    }

    if (this.hasTrailingActionTrack()) {
      tracks.push(`${this.addColumnTrackWidth}px`);
    }

    return tracks.join(' ');
  }

  gridTableWidth(columns: ReadonlyArray<AppStatusListColumnKey> = this.resolvedColumns()): string {
    const columnsWidth = columns.reduce((sum, key) => sum + this.columnTrackWidthPx(key), 0);
    const leadingWidth = this.hasLeadingControlTrack() ? this.rowControlTrackWidth : 0;
    const trailingWidth = this.hasTrailingActionTrack() ? this.addColumnTrackWidth : 0;
    const trackCount =
      columns.length +
      (this.hasLeadingControlTrack() ? 1 : 0) +
      (this.hasTrailingActionTrack() ? 1 : 0);
    const gapsWidth = Math.max(trackCount - 1, 0) * this.gridColumnGapWidth;
    const totalWidth = Math.round(leadingWidth + columnsWidth + trailingWidth + gapsWidth);
    return `${totalWidth}px`;
  }

  hasLeadingControlTrack(): boolean {
    return this.selectionEnabled || this.rowDragEnabled;
  }

  hasTrailingActionTrack(): boolean {
    return this.rowMenuEnabled || this.columnManagementEnabled;
  }

  quickComposeGridColumn(): string {
    return this.hasLeadingControlTrack() ? '2 / -1' : '1 / -1';
  }

  columnHeader(column: AppStatusListColumnKey): string {
    return this.columnLabels?.[column] ?? this.columnHeaders[column];
  }

  rowValue(row: AppStatusListRow<TPayload>, column: AppStatusListColumnKey): string {
    if (column === 'taskId') return row.idLabel || '--';
    if (column === 'created') return row.createdLabel || '--';
    if (column === 'updated') return row.updatedLabel || '--';
    if (column === 'taskType') return row.typeLabel || 'Task';
    return row.extras?.[column] || '--';
  }

  rowCellClass(column: AppStatusListColumnKey): string {
    return column === 'taskId' ? 'mono' : '';
  }

  resolvedColumns(): AppStatusListColumnKey[] {
    const columnKeys = this.columnKeys();
    const incoming = this.visibleColumnsInput?.filter((key): key is AppStatusListColumnKey =>
      columnKeys.includes(key)
    );
    const mergedBase = (incoming?.length ? incoming : this.defaultColumns).filter(
      (key, index, arr) => arr.indexOf(key) === index
    );
    const merged = this.manualColumnOrder?.length
      ? [
          ...this.manualColumnOrder.filter(key => mergedBase.includes(key)),
          ...mergedBase.filter(key => !this.manualColumnOrder?.includes(key))
        ]
      : mergedBase;
    return this.ensureNameFirst(merged);
  }

  ngOnInit(): void {
    this.initGroupIconLibrary();
    this.groupMyColors = this.readMyColors();
    this.customListGroups = this.readCustomListGroups();
    this.customListTaskIdsStorageSnapshot = null;
    this.syncCustomListTaskIdsFromStorage();
  }

  ngOnDestroy(): void {
    this.finishColumnResize();
    this.closeCalcMenu();
    this.detachTransientDomListeners();
  }

  ngAfterViewInit(): void {
    this.syncGridGeometryDom();
    this.syncBottomRailPosition();
    this.syncSharedScrollOffset();
  }

  ngAfterViewChecked(): void {
    this.syncGridGeometryDomIfNeeded();
    this.syncBottomRailPosition();
  }

  onColumnsDropped(event: CdkDragDrop<AppStatusListColumnKey[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const order = [...(event.container.data ?? this.resolvedColumns())];
    moveItemInArray(order, event.previousIndex, event.currentIndex);
    const normalized = this.ensureNameFirst(order);
    this.manualColumnOrder = normalized;
    this.columnsReorder.emit(normalized);
    queueMicrotask(() => this.syncGridGeometryDom());
  }

  onGroupsDropped(event: CdkDragDrop<AppStatusListGroup<TPayload>[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    if (!this.groupReorderEnabled) return;
    const order = [...(event.container.data ?? this.displayGroups())];
    moveItemInArray(order, event.previousIndex, event.currentIndex);
    const movedGroup =
      (event.item.data as AppStatusListGroup<TPayload> | undefined) ?? order[event.currentIndex];
    if (!movedGroup) return;
    if (this.isCustomListGroupId(movedGroup.id)) {
      const nextCustomOrder = order
        .filter(group => this.isCustomListGroupId(group.id))
        .map(group => group.id);
      if (nextCustomOrder.length) {
        const customById = new Map(this.customListGroups.map(group => [group.id, group] as const));
        this.customListGroups = nextCustomOrder
          .map(id => customById.get(id))
          .filter((group): group is CustomListGroup => !!group);
        this.writeCustomListGroups();
      }
      return;
    }
    this.groupMove.emit({
      previousIndex: event.previousIndex,
      currentIndex: event.currentIndex,
      group: movedGroup
    });
  }

  onRowsDropped(groupId: string, event: CdkDragDrop<AppStatusListRow<TPayload>[]>): void {
    if (event.previousIndex === event.currentIndex && event.previousContainer === event.container)
      return;
    if (this.hasActiveSort()) {
      this.activeSortColumn = null;
      this.activeSortDirection = null;
      this.sortChange.emit({ column: null, direction: null });
    }

    const sourceGroupId = this.groupIdFromDropListId(event.previousContainer.id) ?? groupId;
    const targetGroupId = this.groupIdFromDropListId(event.container.id) ?? groupId;
    const movedRow =
      (event.item.data as AppStatusListRow<TPayload> | undefined) ??
      event.previousContainer.data[event.previousIndex] ??
      event.container.data[event.currentIndex];
    if (!movedRow) return;

    const sourceCustom = this.isCustomListGroupId(sourceGroupId);
    const targetCustom = this.isCustomListGroupId(targetGroupId);
    if (targetCustom) {
      this.insertTaskIntoCustomList(targetGroupId, movedRow.id, event.currentIndex);
      this.writeCustomListTaskIds();
      return;
    }
    if (sourceCustom) {
      this.removeTaskFromAllCustomLists(movedRow.id);
      this.writeCustomListTaskIds();
    }

    this.rowMove.emit({
      sourceGroupId,
      targetGroupId,
      previousIndex: event.previousIndex,
      currentIndex: event.currentIndex,
      row: movedRow
    });
  }

  isGroupRenaming(groupId: string): boolean {
    return this.renameGroupId === groupId;
  }

  groupRenameDraft(): string {
    return this.renameDraft;
  }

  onGroupRenameDraftChange(value: string): void {
    this.renameDraft = value;
  }

  startGroupRename(group: AppStatusListGroup<TPayload>): void {
    this.closeAddGroupEditor();
    this.closeGroupMenu();
    this.renameGroupId = group.id;
    this.renameDraft = this.groupDisplayName(group);
  }

  cancelGroupRename(): void {
    this.renameGroupId = null;
    this.renameDraft = '';
  }

  commitGroupRename(group: AppStatusListGroup<TPayload>): void {
    if (this.renameGroupId !== group.id) return;
    const nextName = this.renameDraft.trim();
    if (!nextName) {
      this.cancelGroupRename();
      return;
    }
    if (this.isCustomListGroupId(group.id)) {
      const exists = this.customListGroups.some(
        item =>
          item.id !== group.id &&
          item.name.trim().toLocaleLowerCase() === nextName.toLocaleLowerCase()
      );
      if (!exists) {
        this.customListGroups = this.customListGroups.map(item =>
          item.id === group.id ? { ...item, name: nextName } : item
        );
        this.writeCustomListGroups();
      }
      this.cancelGroupRename();
      return;
    }
    this.customGroupNames.set(group.id, nextName);
    this.groupRename.emit({ groupId: group.id, name: nextName });
    this.cancelGroupRename();
  }

  onGroupActionSelected(action: AppStatusListGroupAction, groupId: string): void {
    this.closeAddGroupEditor();
    this.closeGroupMenu();
    this.groupAction.emit({ groupId, action });
  }

  selectAllRowsInGroup(groupId: string): void {
    this.closeGroupMenu();
    const group = this.displayGroups().find(item => item.id === groupId);
    if (!group) return;
    for (const row of group.rows) this.internalSelectedRowIds.add(row.id);
    const localRows = this.localRowsByGroup.get(groupId) ?? [];
    for (const row of localRows) this.internalSelectedRowIds.add(row.id);
    this.emitSelectedRowIds();
  }

  isGroupMenuOpen(groupId: string): boolean {
    return this.openGroupMenuId === groupId;
  }

  toggleGroupMenu(event: MouseEvent, groupId: string): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.openGroupMenuId === groupId) {
      this.closeGroupMenu();
      return;
    }
    this.closeAddGroupEditor();
    this.openGroupMenuId = groupId;
    this.syncTransientDomListeners();
    this.groupMenu.emit(groupId);
  }

  closeGroupMenu(): void {
    this.openGroupMenuId = null;
    this.syncTransientDomListeners();
  }

  openAddGroup(): void {
    this.suggestedGroupsOpen = false;
    this.addingGroup = true;
    this.groupDraft = '';
    this.groupColorDraft = '#14b8a6';
    this.groupIconDraft = this.randomSuggestedIcon();
    this.groupPickerTab = 'color';
    this.groupIconCategory = 'all';
    this.groupIconSearch = '';
    this.groupIconCategoryMenuOpen = false;
    this.customColorDraft = '#14b8a6';
    this.syncCustomPickerFromHex(this.customColorDraft);
    this.customColorFormat = 'hex';
    this.customFormatMenuOpen = false;
    this.colorPickerOpen = false;
    this.customColorEditorOpen = false;
    this.closeGroupMenu();
    this.closeRowMenu();
    this.closeCellEditor();
    this.closeCalcMenu();
    this.closeQuickComposePicker();
  }

  onGroupDraftInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.groupDraft = input?.value ?? '';
  }

  toggleSuggestedGroupsMenu(event?: Event): void {
    event?.stopPropagation();
    if (this.addingGroup) return;
    this.suggestedGroupsOpen = !this.suggestedGroupsOpen;
    this.syncTransientDomListeners();
    if (this.suggestedGroupsOpen) this.rebuildSuggestedGroupOptions();
  }

  addSuggestedGroup(option: SuggestedGroupOption): void {
    this.suggestedGroupsOpen = false;
    this.syncTransientDomListeners();
    this.createCustomListGroup(option.name, option.color, option.icon);
  }

  toggleColorPicker(): void {
    this.colorPickerOpen = !this.colorPickerOpen;
    this.syncTransientDomListeners();
    if (this.colorPickerOpen) {
      this.groupPickerTab = 'color';
      this.groupIconCategoryMenuOpen = false;
      return;
    }
    this.customColorEditorOpen = false;
    this.customFormatMenuOpen = false;
    this.groupIconCategoryMenuOpen = false;
  }

  setGroupPickerTab(tab: GroupPickerTab): void {
    this.groupPickerTab = tab;
    if (tab !== 'color') {
      this.customColorEditorOpen = false;
      this.customFormatMenuOpen = false;
    }
    if (tab !== 'icon') this.groupIconCategoryMenuOpen = false;
  }

  choosePresetColor(color: string): void {
    const normalized = this.normalizeHexColor(color);
    if (!normalized) return;
    this.groupColorDraft = normalized;
    this.customColorDraft = normalized;
    this.syncCustomPickerFromHex(normalized);
  }

  chooseMyColor(color: string): void {
    const normalized = this.normalizeHexColor(color);
    if (!normalized) return;
    this.groupColorDraft = normalized;
    this.customColorDraft = normalized;
    this.syncCustomPickerFromHex(normalized);
  }

  chooseGroupIcon(icon: string): void {
    const normalized = this.normalizeGroupIcon(icon);
    if (!normalized) return;
    this.groupIconDraft = normalized;
  }

  setGroupIconCategory(category: string): void {
    if (!this.groupIconsByCategory[category]) {
      this.groupIconCategory = 'all';
      this.groupIconCategoryMenuOpen = false;
      this.syncTransientDomListeners();
      return;
    }
    this.groupIconCategory = category;
    this.groupIconCategoryMenuOpen = false;
    this.syncTransientDomListeners();
  }

  toggleGroupIconCategoryMenu(event?: Event): void {
    event?.stopPropagation();
    this.groupIconCategoryMenuOpen = !this.groupIconCategoryMenuOpen;
    this.syncTransientDomListeners();
  }

  get selectedGroupIconCategoryLabel(): string {
    const current =
      this.groupIconCategoryDefs.find(category => category.key === this.groupIconCategory) ??
      this.groupIconCategoryDefs[0];
    return `${current.label} (${this.groupIconCount(current.key)})`;
  }

  onGroupIconSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.groupIconSearch = input?.value ?? '';
  }

  get visibleGroupIcons(): ReadonlyArray<string> {
    const scoped =
      this.groupIconCategory === 'all'
        ? this.groupIconLibrary
        : (this.groupIconsByCategory[this.groupIconCategory] ?? []);
    const term = this.groupIconSearch.trim().toLocaleLowerCase();
    if (!term) return scoped;
    const normalizedTerm = term.replace(/\s+/g, '-');
    return scoped.filter(icon => icon.toLocaleLowerCase().includes(normalizedTerm));
  }

  groupIconCount(category: string): number {
    return this.groupIconCounts[category] ?? 0;
  }

  openCustomColorEditor(): void {
    this.customColorEditorOpen = true;
    this.customColorDraft = this.groupColorDraft;
    this.syncCustomPickerFromHex(this.customColorDraft);
    this.customFormatMenuOpen = false;
    this.syncTransientDomListeners();
  }

  get customColorFormatLabel(): string {
    return this.customColorFormat.toUpperCase();
  }

  toggleCustomFormatMenu(): void {
    this.customFormatMenuOpen = !this.customFormatMenuOpen;
    this.syncTransientDomListeners();
  }

  setCustomColorFormat(format: ColorTextFormat): void {
    this.customColorFormat = format;
    this.customFormatMenuOpen = false;
    this.syncTransientDomListeners();
  }

  get customRgbValues(): [number, number, number] {
    return this.hexToRgb(this.customColorDraft) ?? [0, 0, 0];
  }

  get customHslValues(): [number, number, number] {
    const [r, g, b] = this.customRgbValues;
    return this.rgbToHsl(r, g, b);
  }

  get customHueColor(): string {
    return this.hsvToHex(this.customHue, 100, 100);
  }

  get customAreaCursorLeft(): number {
    return this.customSaturation;
  }

  get customAreaCursorTop(): number {
    return 100 - this.customValue;
  }

  onCustomHueInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const value = Number(input?.value ?? '');
    if (!Number.isFinite(value)) return;
    this.customHue = this.clamp(value, 0, 360);
    this.updateColorFromCustomPicker();
  }

  onCustomAreaPointerDown(event: PointerEvent): void {
    const area = event.currentTarget as HTMLElement | null;
    if (!area) return;
    this.customAreaDragging = true;
    area.setPointerCapture(event.pointerId);
    this.updatePickerFromAreaPointer(event, area);
  }

  onCustomAreaPointerMove(event: PointerEvent): void {
    if (!this.customAreaDragging) return;
    const area = event.currentTarget as HTMLElement | null;
    if (!area) return;
    this.updatePickerFromAreaPointer(event, area);
  }

  onCustomAreaPointerUp(event: PointerEvent): void {
    if (!this.customAreaDragging) return;
    this.customAreaDragging = false;
    const area = event.currentTarget as HTMLElement | null;
    if (area?.hasPointerCapture(event.pointerId)) {
      area.releasePointerCapture(event.pointerId);
    }
  }

  onCustomHexInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const normalized = this.normalizeHexColor(input?.value ?? '');
    if (!normalized) return;
    this.customColorDraft = normalized;
    this.syncCustomPickerFromHex(normalized);
  }

  onRgbChannelInput(index: 0 | 1 | 2, event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const current = this.customRgbValues;
    const next: [number, number, number] = [current[0], current[1], current[2]];
    next[index] = this.parseChannel(input?.value ?? '', 0, 255, current[index]);
    const hex = this.rgbToHex(next[0], next[1], next[2]);
    this.customColorDraft = hex;
    this.syncCustomPickerFromHex(hex);
  }

  onHslChannelInput(index: 0 | 1 | 2, event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const current = this.customHslValues;
    const next: [number, number, number] = [current[0], current[1], current[2]];
    const max = index === 0 ? 360 : 100;
    next[index] = this.parseChannel(input?.value ?? '', 0, max, current[index]);
    const [r, g, b] = this.hslToRgb(next[0], next[1], next[2]);
    const hex = this.rgbToHex(r, g, b);
    this.customColorDraft = hex;
    this.syncCustomPickerFromHex(hex);
  }

  applyCustomColor(): void {
    const normalized = this.normalizeHexColor(this.customColorDraft);
    if (!normalized) return;
    this.groupColorDraft = normalized;
    this.customColorDraft = normalized;
    this.syncCustomPickerFromHex(normalized);
    this.pushMyColor(normalized);
    this.customFormatMenuOpen = false;
    this.customColorEditorOpen = false;
    this.syncTransientDomListeners();
  }

  submitAddGroup(): void {
    const value = this.groupDraft.trim();
    if (!value) return;
    const created = this.createCustomListGroup(value, this.groupColorDraft, this.groupIconDraft);
    if (!created) {
      this.cancelAddGroup();
      return;
    }
    this.cancelAddGroup();
  }

  cancelAddGroup(): void {
    this.addingGroup = false;
    this.groupDraft = '';
    this.groupColorDraft = '#14b8a6';
    this.groupIconDraft = 'circle-fill';
    this.groupPickerTab = 'color';
    this.groupIconCategory = 'all';
    this.groupIconSearch = '';
    this.groupIconCategoryMenuOpen = false;
    this.customColorDraft = '#14b8a6';
    this.syncCustomPickerFromHex(this.customColorDraft);
    this.customColorFormat = 'hex';
    this.customFormatMenuOpen = false;
    this.colorPickerOpen = false;
    this.customColorEditorOpen = false;
    this.syncTransientDomListeners();
  }

  closeAddGroupEditor(): void {
    this.suggestedGroupsOpen = false;
    this.cancelAddGroup();
  }

  onDocumentPointerDown(event: PointerEvent): void {
    if (this.activeRowMenu && Date.now() - this.rowMenuOpenedAt < 180) return;
    const target = event.target;
    if (!(target instanceof Element)) {
      this.closeGroupMenu();
      this.closeAddGroupEditor();
      this.closeCellEditor();
      this.closeRowMenu();
      this.closeCalcMenu();
      this.closeQuickComposePicker();
      return;
    }
    if (target.closest('.board-add-group-wrap')) return;
    if (target.closest('.board-group-color-popover')) return;
    if (target.closest('.board-group-suggest-menu')) return;
    if (target.closest('.tsl-group-actions')) return;
    if (target.closest('.tsl-row-act')) return;
    if (target.closest('.tsl-row-menu-popover')) return;
    if (target.closest('.tsl-add-calc-btn')) return;
    if (target.closest('.tsl-calc-menu-popover')) return;
    if (target.closest('.lce-popover')) return;
    if (target.closest('.quick-meta-pill')) return;
    if (target.closest('.tsl-quick-meta-popover')) return;
    if (target.closest('.tsl-cell-editable')) {
      this.closeGroupMenu();
      this.closeAddGroupEditor();
      this.closeRowMenu();
      this.closeCalcMenu();
      this.closeQuickComposePicker();
      return;
    }
    this.closeGroupMenu();
    this.closeAddGroupEditor();
    this.closeCellEditor();
    this.closeRowMenu();
    this.closeCalcMenu();
    this.closeQuickComposePicker();
  }

  onDocumentEscape(): void {
    this.closeGroupMenu();
    this.closeAddGroupEditor();
    this.closeCellEditor();
    this.closeRowMenu();
    this.closeCalcMenu();
    this.closeQuickComposePicker();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.closeAddGroupEditor();
    this.closeCellEditor();
    this.closeCalcMenu();
    this.closeQuickComposePicker();
    this.syncBottomRailPosition();
  }

  private hasOpenTransientLayer(): boolean {
    return (
      !!this.openGroupMenuId ||
      this.addingGroup ||
      this.suggestedGroupsOpen ||
      this.colorPickerOpen ||
      this.groupIconCategoryMenuOpen ||
      this.customFormatMenuOpen ||
      this.customColorEditorOpen ||
      !!this.activeCellEditor ||
      !!this.activeRowMenu ||
      !!this.activeCalcMenu ||
      !!this.quickComposePicker
    );
  }

  private syncTransientDomListeners(): void {
    if (this.hasOpenTransientLayer()) {
      this.attachTransientDomListeners();
    } else {
      this.detachTransientDomListeners();
    }
  }

  private attachTransientDomListeners(): void {
    if (this.transientDomListenersAttached) return;
    this.transientDomListenersAttached = true;
    this.doc.addEventListener('pointerdown', this.documentPointerDownHandler, true);
    this.doc.addEventListener('keydown', this.documentEscapeHandler);
  }

  private detachTransientDomListeners(): void {
    if (!this.transientDomListenersAttached) return;
    this.transientDomListenersAttached = false;
    this.doc.removeEventListener('pointerdown', this.documentPointerDownHandler, true);
    this.doc.removeEventListener('keydown', this.documentEscapeHandler);
  }

  onSharedScrollWheel(event: WheelEvent): void {
    if (event.defaultPrevented) return;

    const container = event.currentTarget as HTMLElement | null;
    if (!container || !this.canScrollHorizontally(container)) return;

    const target = event.target as HTMLElement | null;
    const shouldPanHorizontally =
      event.shiftKey ||
      this.isHorizontalWheelZone(target) ||
      !this.canContinueVerticalScroll(container, event.deltaY);
    if (!shouldPanHorizontally) return;

    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!Number.isFinite(delta) || delta === 0) return;

    container.scrollLeft += delta;
    event.preventDefault();
  }

  onSharedScrollSync(): void {
    this.syncHorizontalOverflowState();
    this.syncSharedScrollOffset();
    if (!this.stickyHorizontalRail || this.syncingBottomRail) return;

    const sharedScroll = this.sharedScrollRef?.nativeElement;
    const bottomRail = this.bottomScrollRailRef?.nativeElement;
    if (!sharedScroll || !bottomRail) return;
    if (Math.abs(bottomRail.scrollLeft - sharedScroll.scrollLeft) < 1) return;

    this.syncingSharedScroll = true;
    bottomRail.scrollLeft = sharedScroll.scrollLeft;
    this.syncingSharedScroll = false;
  }

  onBottomRailScrollSync(): void {
    if (!this.stickyHorizontalRail || this.syncingSharedScroll) return;

    const sharedScroll = this.sharedScrollRef?.nativeElement;
    const bottomRail = this.bottomScrollRailRef?.nativeElement;
    if (!sharedScroll || !bottomRail) return;
    if (Math.abs(sharedScroll.scrollLeft - bottomRail.scrollLeft) < 1) return;

    this.syncingBottomRail = true;
    sharedScroll.scrollLeft = bottomRail.scrollLeft;
    this.syncingBottomRail = false;
    this.syncSharedScrollOffset();
  }

  onRowDragStarted(groupId: string): void {
    this.draggingSourceGroupId = groupId;
    this.draggingTargetGroupId = groupId;
  }

  onRowDragEnded(): void {
    this.draggingSourceGroupId = null;
    this.draggingTargetGroupId = null;
  }

  onRowsListEntered(groupId: string): void {
    if (!this.draggingSourceGroupId) return;
    this.draggingTargetGroupId = groupId;
  }

  isDropListReceiving(groupId: string): boolean {
    return !!this.draggingSourceGroupId && this.draggingTargetGroupId === groupId;
  }

  isRowDragActive(): boolean {
    return !!this.draggingSourceGroupId;
  }

  hidePlaceholderInGroup(groupId: string): boolean {
    return (
      !!this.draggingSourceGroupId &&
      !!this.draggingTargetGroupId &&
      this.draggingSourceGroupId !== this.draggingTargetGroupId &&
      groupId === this.draggingSourceGroupId
    );
  }

  onRowSelectionToggle(event: Event, rowId: string): void {
    event.stopPropagation();
    if (this.internalSelectedRowIds.has(rowId)) this.internalSelectedRowIds.delete(rowId);
    else this.internalSelectedRowIds.add(rowId);
    this.emitSelectedRowIds();
  }

  isRowSelected(rowId: string): boolean {
    return this.internalSelectedRowIds.has(rowId);
  }

  onColumnSortToggle(event: MouseEvent, column: AppStatusListColumnKey): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.activeSortColumn !== column) {
      this.activeSortColumn = column;
      this.activeSortDirection = 'asc';
    } else if (this.activeSortDirection === 'asc') {
      this.activeSortDirection = 'desc';
    } else if (this.activeSortDirection === 'desc') {
      this.activeSortDirection = null;
      this.activeSortColumn = null;
    } else {
      this.activeSortDirection = 'asc';
    }
    this.sortChange.emit({
      column: this.activeSortColumn,
      direction: this.activeSortDirection
    });
  }

  sortIconClass(column: AppStatusListColumnKey): string {
    if (this.activeSortColumn !== column || !this.activeSortDirection) {
      return 'chevron-expand';
    }
    return this.activeSortDirection === 'asc' ? 'chevron-up' : 'chevron-down';
  }

  isColumnSorted(column: AppStatusListColumnKey): boolean {
    return this.activeSortColumn === column && !!this.activeSortDirection;
  }

  sortedRows(rows: ReadonlyArray<AppStatusListRow<TPayload>>): AppStatusListRow<TPayload>[] {
    if (!rows.length || !this.activeSortColumn || !this.activeSortDirection) {
      return rows as AppStatusListRow<TPayload>[];
    }
    const column = this.activeSortColumn;
    const direction = this.activeSortDirection;
    const sorted = [...rows];
    sorted.sort((a, b) => this.compareRows(a, b, column, direction));
    return sorted;
  }

  hasActiveSort(): boolean {
    return !!this.activeSortColumn && !!this.activeSortDirection;
  }

  startColumnResize(
    event: MouseEvent,
    column: AppStatusListColumnKey,
    columnEl: HTMLElement
  ): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    this.activeResize = {
      column,
      startX: event.clientX,
      startWidth: Math.round(columnEl.getBoundingClientRect().width)
    };
    this.bindResizeListeners();
  }

  stopColumnResizeClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  isResizingColumn(column: AppStatusListColumnKey): boolean {
    return this.activeResize?.column === column;
  }

  isCollapsed(groupId: string): boolean {
    if (this.isCustomListGroupId(groupId)) return this.localCollapsedCustomGroupIds.has(groupId);
    return this.collapsedGroupIds?.has(groupId) ?? false;
  }

  onGroupToggle(groupId: string): void {
    this.closeGroupMenu();
    this.closeAddGroupEditor();
    this.closeRowMenu();
    this.closeCalcMenu();
    if (this.isCustomListGroupId(groupId)) {
      if (this.localCollapsedCustomGroupIds.has(groupId))
        this.localCollapsedCustomGroupIds.delete(groupId);
      else this.localCollapsedCustomGroupIds.add(groupId);
      return;
    }
    this.groupToggle.emit(groupId);
  }

  onGroupMenu(groupId: string): void {
    this.closeGroupMenu();
    this.closeAddGroupEditor();
    this.closeRowMenu();
    this.closeCalcMenu();
    this.groupMenu.emit(groupId);
  }

  onGroupAdd(groupId: string): void {
    this.closeGroupMenu();
    this.closeAddGroupEditor();
    this.closeRowMenu();
    this.closeCalcMenu();
    this.startQuickAdd(groupId);
  }

  onColumnsPanelRequest(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.closeGroupMenu();
    this.closeAddGroupEditor();
    this.closeRowMenu();
    this.closeCellEditor();
    this.closeCalcMenu();
    this.columnsPanelRequest.emit();
  }

  onAddRow(groupId: string): void {
    this.closeGroupMenu();
    this.closeAddGroupEditor();
    this.closeRowMenu();
    this.closeCalcMenu();
    this.startQuickAdd(groupId);
  }

  onRowClick(groupId: string, row: AppStatusListRow<TPayload>): void {
    if (this.isLocalRow(row.id)) return;
    if (this.hasOpenCellEditor()) return;
    this.closeRowMenu();
    this.closeCalcMenu();
    this.closeGroupMenu();
    this.rowClick.emit({ groupId, row });
  }

  onNameCellActivate(event: Event, groupId: string, row: AppStatusListRow<TPayload>): void {
    event.preventDefault();
    event.stopPropagation();
    this.onRowClick(groupId, row);
  }

  onCellEditorTrigger(
    event: MouseEvent,
    groupId: string,
    row: AppStatusListRow<TPayload>,
    column: AppStatusListColumnKey,
    origin: CdkOverlayOrigin
  ): void {
    if (this.isLocalRow(row.id)) return;
    const config = this.resolveCellEditorConfig(column);
    if (!config) {
      if (this.openOnReadOnlyCellClick) {
        event.preventDefault();
        event.stopPropagation();
        this.onRowClick(groupId, row);
      }
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.closeRowMenu();
    this.closeCalcMenu();
    this.closeQuickComposePicker();

    const width = this.editorWidthForType(config.type);

    this.activeCellEditor = {
      groupId,
      row,
      column,
      type: config.type,
      title: config.title?.trim() || this.buildDefaultEditorTitle(column),
      placeholder: config.placeholder?.trim() || 'Search...',
      options: [...(config.options ?? [])],
      searchable: config.searchable !== false,
      value: this.resolveCellEditorValue(row, column, config.type),
      origin,
      width
    };
    this.syncTransientDomListeners();
  }

  onRowMenuTrigger(
    event: MouseEvent,
    groupId: string,
    row: AppStatusListRow<TPayload>,
    origin: CdkOverlayOrigin
  ): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.activeRowMenu?.row.id === row.id && this.activeRowMenu.groupId === groupId) {
      this.closeRowMenu();
      return;
    }

    this.closeGroupMenu();
    this.closeCellEditor();
    this.closeCalcMenu();
    this.closeQuickComposePicker();

    this.activeRowMenu = {
      groupId,
      row,
      origin,
      submenuSide: 'left',
      attachSide: 'right'
    };
    this.rowMenuOpenedAt = Date.now();
    this.syncTransientDomListeners();
  }

  hasOpenRowMenu(): boolean {
    return !!this.activeRowMenu;
  }

  isRowMenuOpen(rowId: string): boolean {
    return this.activeRowMenu?.row.id === rowId;
  }

  rowMenuOrigin(): CdkOverlayOrigin {
    if (!this.activeRowMenu) {
      throw new Error('Row menu origin is not available.');
    }
    return this.activeRowMenu.origin;
  }

  isRowMenuSubmenuRight(): boolean {
    return this.activeRowMenu?.submenuSide === 'right';
  }

  isRowMenuAttachedLeft(): boolean {
    return this.activeRowMenu?.attachSide === 'left';
  }

  onRowMenuOverlayPositionChange(event: ConnectedOverlayPositionChange): void {
    if (!this.activeRowMenu) return;
    const nextSubmenuSide = event.connectionPair.overlayX === 'start' ? 'right' : 'left';
    const nextAttachSide = event.connectionPair.overlayX === 'start' ? 'left' : 'right';
    if (
      this.activeRowMenu.submenuSide === nextSubmenuSide &&
      this.activeRowMenu.attachSide === nextAttachSide
    ) {
      return;
    }
    this.activeRowMenu = {
      ...this.activeRowMenu,
      submenuSide: nextSubmenuSide,
      attachSide: nextAttachSide
    };
  }

  onRowSubmenuEnter(key: string): void {
    this.openRowSubmenuKey = key;
  }

  onRowSubmenuLeave(key: string): void {
    if (this.openRowSubmenuKey !== key) return;
    this.openRowSubmenuKey = null;
  }

  toggleRowSubmenu(event: Event, key: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.openRowSubmenuKey = this.openRowSubmenuKey === key ? null : key;
  }

  isRowSubmenuOpen(key: string): boolean {
    return this.openRowSubmenuKey === key;
  }

  onCalcMenuTrigger(
    event: MouseEvent,
    groupId: string,
    column: AppStatusListColumnKey,
    origin: CdkOverlayOrigin
  ): void {
    event.preventDefault();
    event.stopPropagation();

    if (
      this.activeCalcMenu &&
      this.activeCalcMenu.groupId === groupId &&
      this.activeCalcMenu.column === column
    ) {
      this.closeCalcMenu();
      return;
    }

    this.closeGroupMenu();
    this.closeCellEditor();
    this.closeRowMenu();
    this.closeQuickComposePicker();

    this.activeCalcMenu = {
      groupId,
      column,
      origin
    };
    this.calcMenuOptionsOpen = false;
    this.syncTransientDomListeners();
  }

  hasOpenCalcMenu(): boolean {
    return !!this.activeCalcMenu;
  }

  isCalcMenuOpen(groupId: string, column: AppStatusListColumnKey): boolean {
    return this.activeCalcMenu?.groupId === groupId && this.activeCalcMenu.column === column;
  }

  calcMenuOrigin(): CdkOverlayOrigin {
    if (!this.activeCalcMenu) {
      throw new Error('Calculate menu origin is not available.');
    }
    return this.activeCalcMenu.origin;
  }

  calcMenuColumnLabel(): string {
    if (!this.activeCalcMenu) return '';
    return this.columnHeader(this.activeCalcMenu.column);
  }

  calcMenuSelectedOperation(): string {
    const active = this.activeCalcMenu;
    if (!active) return 'sum';
    return this.calcOperationsByKey.get(this.calcMenuKey(active.groupId, active.column)) ?? 'sum';
  }

  calcOperationLabel(value: string): string {
    return this.calcOperationOptions.find(operation => operation.value === value)?.label ?? 'Sum';
  }

  onCalcMenuOperationChange(value: string): void {
    const active = this.activeCalcMenu;
    if (!active) return;
    this.calcOperationsByKey.set(this.calcMenuKey(active.groupId, active.column), value || 'sum');
  }

  toggleCalcMenuOptions(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.calcMenuOptionsOpen = !this.calcMenuOptionsOpen;
  }

  isCalcMenuOptionsOpen(): boolean {
    return this.calcMenuOptionsOpen;
  }

  isCalcOperationSelected(value: string): boolean {
    return this.calcMenuSelectedOperation() === value;
  }

  selectCalcMenuOperation(event: MouseEvent, value: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.onCalcMenuOperationChange(value);
    this.calcMenuOptionsOpen = false;
  }

  onCalcMenuApply(): void {
    this.closeCalcMenu();
  }

  closeCalcMenu(): void {
    this.activeCalcMenu = null;
    this.calcMenuOptionsOpen = false;
    this.syncTransientDomListeners();
  }

  onRowMenuAction(
    action:
      | 'copyLink'
      | 'copyId'
      | 'newTab'
      | 'addColumn'
      | 'favorite'
      | 'rename'
      | 'convertTo'
      | 'convertToList'
      | 'convertToSubtask'
      | 'taskType'
      | 'duplicate'
      | 'remindInbox'
      | 'unfollowTask'
      | 'sendEmail'
      | 'addTo'
      | 'merge'
      | 'move'
      | 'startTimer'
      | 'dependencies'
      | 'templates'
      | 'archive'
      | 'delete'
      | 'sharePermissions'
  ): void {
    const active = this.activeRowMenu;
    if (!active) return;

    if (action === 'copyId') {
      this.copyText(active.row.idLabel || active.row.id);
    } else if (action === 'copyLink') {
      this.copyText(this.buildRowLink(active.row.id));
    } else if (action === 'newTab') {
      const href = this.buildRowLink(active.row.id);
      this.doc.defaultView?.open(href, '_blank', 'noopener');
    } else if (action === 'rename') {
      this.onRowClick(active.groupId, active.row);
    } else {
      this.rowAction.emit({
        groupId: active.groupId,
        row: active.row,
        action
      });
    }

    this.closeRowMenu();
  }

  closeRowMenu(): void {
    this.activeRowMenu = null;
    this.openRowSubmenuKey = null;
    this.syncTransientDomListeners();
  }

  isCellEditable(column: AppStatusListColumnKey): boolean {
    return !!this.resolveCellEditorConfig(column);
  }

  isCellEditorActive(rowId: string, column: AppStatusListColumnKey): boolean {
    return this.activeCellEditor?.row.id === rowId && this.activeCellEditor.column === column;
  }

  hasOpenCellEditor(): boolean {
    return !!this.activeCellEditor;
  }

  cellEditorOrigin(): CdkOverlayOrigin {
    if (!this.activeCellEditor) {
      throw new Error('Cell editor origin is not available.');
    }
    return this.activeCellEditor.origin;
  }

  cellEditorWidth(): number {
    return this.activeCellEditor?.width ?? 280;
  }

  cellEditorTitle(): string {
    return this.activeCellEditor?.title ?? 'Edit';
  }

  cellEditorType(): AppStatusListCellEditorType {
    return this.activeCellEditor?.type ?? 'text';
  }

  cellEditorColumn(): AppStatusListColumnKey | null {
    return this.activeCellEditor?.column ?? null;
  }

  cellEditorValue(): string {
    return this.activeCellEditor?.value ?? '';
  }

  cellEditorPlaceholder(): string {
    return this.activeCellEditor?.placeholder ?? 'Search...';
  }

  cellEditorOptions(): AppStatusListCellEditorOption[] {
    return this.activeCellEditor?.options ?? [];
  }

  cellEditorSearchable(): boolean {
    return this.activeCellEditor?.searchable ?? true;
  }

  onCellEditorPick(value: string): void {
    const active = this.activeCellEditor;
    if (!active) return;
    this.cellEdit.emit({
      groupId: active.groupId,
      row: active.row,
      column: active.column,
      value
    });
    this.closeCellEditor();
  }

  onCellEditorCommentAdd(comment: string): void {
    const active = this.activeCellEditor;
    if (!active) return;
    this.cellComment.emit({
      groupId: active.groupId,
      row: active.row,
      column: active.column,
      comment
    });
    this.closeCellEditor();
  }

  closeCellEditor(): void {
    this.activeCellEditor = null;
    this.syncTransientDomListeners();
  }

  trackGroup(_index: number, group: AppStatusListGroup<TPayload>): string {
    return group.id;
  }

  trackRow(_index: number, row: AppStatusListRow<TPayload>): string {
    return row.id;
  }

  trackColumn(_index: number, column: AppStatusListColumnKey): AppStatusListColumnKey {
    return column;
  }

  hasQuickAddDraft(groupId: string): boolean {
    return this.quickAddGroupId === groupId;
  }

  quickAddTitle(groupId: string): string {
    return this.quickAddGroupId === groupId ? this.quickAddTitleDraft : '';
  }

  quickComposeTypeLabel(groupId: string): string {
    const current = this.quickAddTaskTypeByGroup.get(groupId)?.trim();
    if (current) {
      const matched = this.quickComposeTaskTypeOptions().find(option => option.value === current);
      if (matched?.label?.trim()) return matched.label.trim();
    }
    const fallback = this.quickComposeTaskTypeOptions()[0]?.label?.trim();
    return fallback || 'Task';
  }

  toggleQuickComposePicker(event: MouseEvent, groupId: string, origin: CdkOverlayOrigin): void {
    event.preventDefault();
    event.stopPropagation();

    if (
      this.quickComposePicker &&
      this.quickComposePicker.groupId === groupId &&
      this.quickComposePicker.origin === origin
    ) {
      this.closeQuickComposePicker();
      return;
    }

    this.quickComposePicker = {
      groupId,
      origin,
      tab: 'status',
      search: ''
    };
    this.syncTransientDomListeners();
  }

  hasOpenQuickComposePicker(): boolean {
    return !!this.quickComposePicker;
  }

  quickComposePickerOrigin(): CdkOverlayOrigin {
    if (!this.quickComposePicker) {
      throw new Error('Quick compose picker origin is not available.');
    }
    return this.quickComposePicker.origin;
  }

  quickComposePickerTab(): QuickComposePickerTab {
    return this.quickComposePicker?.tab ?? 'status';
  }

  setQuickComposePickerTab(tab: QuickComposePickerTab): void {
    if (!this.quickComposePicker) return;
    this.quickComposePicker = { ...this.quickComposePicker, tab, search: '' };
  }

  quickComposePickerSearch(): string {
    return this.quickComposePicker?.search ?? '';
  }

  onQuickComposePickerSearch(value: string): void {
    if (!this.quickComposePicker) return;
    this.quickComposePicker = { ...this.quickComposePicker, search: value };
  }

  quickComposePickerSections(): Array<{ key: string; options: AppStatusListCellEditorOption[] }> {
    const source = this.quickComposePickerOptions();
    const search = this.quickComposePickerSearch().trim().toLowerCase();
    const options = search
      ? source.filter(option => {
          const haystack =
            `${option.label} ${option.section ?? ''} ${option.meta ?? ''}`.toLowerCase();
          return haystack.includes(search);
        })
      : source;

    const sections = new Map<string, AppStatusListCellEditorOption[]>();
    for (const option of options) {
      const key = option.section?.trim() ?? '';
      const bucket = sections.get(key) ?? [];
      bucket.push(option);
      sections.set(key, bucket);
    }
    return Array.from(sections.entries()).map(([key, sectionOptions]) => ({
      key,
      options: sectionOptions
    }));
  }

  quickComposePickerIsActive(value: string): boolean {
    if (!this.quickComposePicker) return false;
    if (this.quickComposePicker.tab === 'status') {
      return this.quickAddStatusByGroup.get(this.quickComposePicker.groupId) === value;
    }
    return this.quickAddTaskTypeByGroup.get(this.quickComposePicker.groupId) === value;
  }

  onQuickComposePickerSelect(value: string): void {
    const picker = this.quickComposePicker;
    if (!picker) return;
    if (picker.tab === 'status') {
      this.quickAddStatusByGroup.set(picker.groupId, value);
    } else {
      this.quickAddTaskTypeByGroup.set(picker.groupId, value);
    }
    this.closeQuickComposePicker();
  }

  closeQuickComposePicker(): void {
    this.quickComposePicker = null;
    this.syncTransientDomListeners();
  }

  onQuickAddTitleChange(groupId: string, value: string): void {
    if (this.quickAddGroupId !== groupId) this.quickAddGroupId = groupId;
    this.quickAddTitleDraft = value;
  }

  cancelQuickAdd(groupId: string): void {
    if (this.quickAddGroupId !== groupId) return;
    this.quickAddGroupId = null;
    this.quickAddTitleDraft = '';
    this.closeQuickComposePicker();
  }

  commitQuickAdd(group: AppStatusListGroup<TPayload>): void {
    if (this.quickAddGroupId !== group.id) return;
    const rawTitle = this.quickAddTitleDraft;
    const title = rawTitle.trim();
    if (!title) return;
    this.quickAddSubmit.emit({
      groupId: group.id,
      title,
      status: this.quickAddStatusByGroup.get(group.id) || undefined,
      taskType: this.quickAddTaskTypeByGroup.get(group.id) || undefined
    });
    this.quickAddGroupId = null;
    this.quickAddTitleDraft = '';
    this.closeQuickComposePicker();
  }

  isLocalRow(rowId: string): boolean {
    return rowId.startsWith('local-quick-');
  }

  private resolveCellEditorConfig(
    column: AppStatusListColumnKey
  ): AppStatusListCellEditorConfig | null {
    if (!this.cellEditorConfig) return null;
    return this.cellEditorConfig[column] ?? null;
  }

  private resolveCellEditorValue(
    row: AppStatusListRow<TPayload>,
    column: AppStatusListColumnKey,
    type: AppStatusListCellEditorType
  ): string {
    const payload =
      (row.payload as
        | {
            status?: string;
            priority?: string;
            dueDate?: string | null;
            createdAt?: string | null;
            updatedAt?: string | null;
            completedAt?: string | null;
          }
        | null
        | undefined) ?? {};

    if (type === 'status') {
      return payload.status || row.statusLabel || '';
    }
    if (type === 'priority') {
      return payload.priority || row.priorityLabel || '';
    }
    if (type === 'assignee') return row.owner || '';
    if (type === 'date') {
      if (column === 'dueDate') {
        return this.dateValueToInput(payload.dueDate ?? null);
      }
      if (column === 'created' || column === 'startDate') {
        return this.dateValueToInput(payload.createdAt ?? this.rowValue(row, column));
      }
      if (column === 'updated') {
        return this.dateValueToInput(payload.updatedAt ?? this.rowValue(row, column));
      }
      if (column === 'dateClosed' || column === 'dateDone') {
        return this.dateValueToInput(payload.completedAt ?? this.rowValue(row, column));
      }
      return this.dateValueToInput(this.rowValue(row, column));
    }
    if (column === 'name') return row.title || '';
    return this.rowValue(row, column) || '';
  }

  private dateValueToInput(value: string | null | undefined): string {
    const normalized = (value || '').trim();
    if (!normalized || normalized === '--') return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().slice(0, 10);
  }

  private buildDefaultEditorTitle(column: AppStatusListColumnKey): string {
    const label = this.columnHeader(column);
    return label ? `${label}` : 'Edit';
  }

  private buildRowLink(rowId: string): string {
    const location = this.doc.location;
    if (!location) return rowId;
    const base = `${location.origin}${location.pathname}${location.search}`;
    return `${base}#task-${encodeURIComponent(rowId)}`;
  }

  private copyText(value: string): void {
    const text = (value || '').trim();
    if (!text) return;
    const clipboard = this.doc.defaultView?.navigator?.clipboard;
    if (!clipboard) return;
    void clipboard.writeText(text);
  }

  private editorWidthForType(type: AppStatusListCellEditorType): number {
    if (type === 'comments') return 360;
    if (type === 'assignee') return 330;
    if (type === 'status') return 300;
    if (type === 'priority') return 280;
    return 260;
  }

  private calcMenuKey(groupId: string, column: AppStatusListColumnKey): string {
    return `${groupId}::${column}`;
  }

  private quickComposePickerOptions(): AppStatusListCellEditorOption[] {
    if (!this.quickComposePicker) return [];
    return this.quickComposePicker.tab === 'status'
      ? this.quickComposeStatusOptions()
      : this.quickComposeTaskTypeOptions();
  }

  private quickComposeStatusOptions(): AppStatusListCellEditorOption[] {
    const config = this.resolveCellEditorConfig('status');
    return [...(config?.options ?? [])];
  }

  private quickComposeTaskTypeOptions(): AppStatusListCellEditorOption[] {
    const config = this.resolveCellEditorConfig('taskType');
    return [...(config?.options ?? [])];
  }

  private emitSelectedRowIds(): void {
    this.selectedRowIdsChange.emit(new Set(this.internalSelectedRowIds));
  }

  private defaultQuickAddStatus(groupId: string): string {
    const options = this.quickComposeStatusOptions();
    if (!options.length) return '';
    const raw = (groupId || '').trim().toLowerCase();
    const token = raw.startsWith('status-') ? raw.slice('status-'.length) : raw;
    const matched = options.find(option => option.value.trim().toLowerCase() === token);
    return matched?.value ?? options[0].value;
  }

  private defaultQuickAddTaskTypeValue(): string {
    const options = this.quickComposeTaskTypeOptions();
    return options[0]?.value?.trim() || 'task';
  }

  private startQuickAdd(groupId: string): void {
    if (this.quickAddGroupId === groupId) return;
    this.closeQuickComposePicker();
    const localRows = this.localRowsByGroup.get(groupId);
    if (localRows?.length) {
      const [firstLocal] = localRows;
      this.quickAddGroupId = groupId;
      this.quickAddTitleDraft = firstLocal?.title ?? '';
      this.localRowsByGroup.set(groupId, []);
      if (!this.quickAddStatusByGroup.get(groupId)) {
        this.quickAddStatusByGroup.set(groupId, this.defaultQuickAddStatus(groupId));
      }
      if (!this.quickAddTaskTypeByGroup.get(groupId)) {
        this.quickAddTaskTypeByGroup.set(groupId, this.defaultQuickAddTaskTypeValue());
      }
      return;
    }
    this.quickAddGroupId = groupId;
    this.quickAddTitleDraft = '';
    if (!this.quickAddStatusByGroup.get(groupId)) {
      this.quickAddStatusByGroup.set(groupId, this.defaultQuickAddStatus(groupId));
    }
    if (!this.quickAddTaskTypeByGroup.get(groupId)) {
      this.quickAddTaskTypeByGroup.set(groupId, this.defaultQuickAddTaskTypeValue());
    }
  }

  private bindResizeListeners(): void {
    if (this.removeResizeListeners) return;
    const onMouseMove = (event: MouseEvent): void => this.onResizeMouseMove(event);
    const onMouseUp = (): void => this.finishColumnResize();
    this.doc.addEventListener('mousemove', onMouseMove);
    this.doc.addEventListener('mouseup', onMouseUp);
    this.removeResizeListeners = () => {
      this.doc.removeEventListener('mousemove', onMouseMove);
      this.doc.removeEventListener('mouseup', onMouseUp);
    };
  }

  private onResizeMouseMove(event: MouseEvent): void {
    if (!this.activeResize) return;
    const { column, startX, startWidth } = this.activeResize;
    const delta = event.clientX - startX;
    const minWidth = this.columnMinWidth(column);
    const nextWidth = Math.max(minWidth, Math.round(startWidth + delta));
    this.columnWidthOverrides = {
      ...this.columnWidthOverrides,
      [column]: nextWidth
    };
    this.columnWidthsChange.emit({ ...this.columnWidthOverrides });
    this.syncGridGeometryDom();
  }

  private finishColumnResize(): void {
    this.activeResize = null;
    if (!this.removeResizeListeners) return;
    this.removeResizeListeners();
    this.removeResizeListeners = null;
    this.syncGridGeometryDom();
  }

  private syncGridGeometryDom(): void {
    const host: HTMLElement = this.hostRef.nativeElement;
    if (!host) return;

    const columns = this.resolvedColumns();
    const template = this.gridTemplate(columns);
    const width = this.gridTableWidth(columns);
    const stretchWidth = this.stretchToContainer ? '100%' : width;
    const stretchMinWidth = this.stretchToContainer ? '100%' : width;

    const lists = host.querySelectorAll('.tsl-list');
    lists.forEach((listNode: Element) => {
      if (!(listNode instanceof HTMLElement)) return;
      listNode.style.width = stretchWidth;
      listNode.style.minWidth = stretchMinWidth;
      listNode.style.maxWidth = this.stretchToContainer ? '100%' : 'none';
    });

    const rows = host.querySelectorAll(
      '.tsl-grid-head, .tsl-grid-row, .tsl-grid-row-local, .tsl-grid-row-quick, .tsl-grid-row-add'
    );
    rows.forEach((rowNode: Element) => {
      if (!(rowNode instanceof HTMLElement)) return;
      rowNode.style.gridTemplateColumns = template;
      rowNode.style.width = stretchWidth;
      rowNode.style.minWidth = stretchMinWidth;
    });

    const tables = host.querySelectorAll(
      '.tsl-grid-scroll, .tsl-grid-table, .tsl-grid-body, .tsl-group'
    );
    tables.forEach((tableNode: Element) => {
      if (!(tableNode instanceof HTMLElement)) return;
      tableNode.style.width = stretchWidth;
      tableNode.style.minWidth = this.stretchToContainer ? stretchMinWidth : width;
      tableNode.style.maxWidth = this.stretchToContainer ? '100%' : 'none';
    });

    this.syncBottomRailPosition();
  }

  private syncBottomRailPosition(): void {
    const sharedScroll = this.sharedScrollRef?.nativeElement;
    this.syncHorizontalOverflowState();
    this.syncSharedScrollOffset(sharedScroll?.scrollLeft ?? 0);
    if (!this.stickyHorizontalRail) return;

    const bottomRail = this.bottomScrollRailRef?.nativeElement;
    if (!sharedScroll || !bottomRail) return;
    if (Math.abs(bottomRail.scrollLeft - sharedScroll.scrollLeft) < 1) return;

    bottomRail.scrollLeft = sharedScroll.scrollLeft;
  }

  private syncHorizontalOverflowState(): void {
    const sharedScroll = this.sharedScrollRef?.nativeElement;
    if (!sharedScroll) return;

    const measuredOverflowWidth = Math.max(0, sharedScroll.scrollWidth - sharedScroll.clientWidth);
    const visualOverflowWidth = this.visualHorizontalOverflowWidth(sharedScroll);
    const overflowWidth =
      visualOverflowWidth !== null
        ? Math.min(measuredOverflowWidth, visualOverflowWidth)
        : measuredOverflowWidth;
    const hasMeaningfulOverflow = overflowWidth > this.negligibleHorizontalOverflowPx;

    sharedScroll.style.overflowX = hasMeaningfulOverflow ? 'auto' : 'hidden';
    if (!hasMeaningfulOverflow && sharedScroll.scrollLeft !== 0) {
      sharedScroll.scrollLeft = 0;
    }

    const bottomRail = this.bottomScrollRailRef?.nativeElement;
    if (!bottomRail) return;
    bottomRail.style.display =
      this.stickyHorizontalRail && hasMeaningfulOverflow ? 'block' : 'none';
    if (!hasMeaningfulOverflow && bottomRail.scrollLeft !== 0) {
      bottomRail.scrollLeft = 0;
    }
  }

  private visualHorizontalOverflowWidth(sharedScroll: HTMLElement): number | null {
    const head = sharedScroll.querySelector<HTMLElement>('.tsl-grid-head');
    if (!head) return null;

    const lastVisibleTrack = Array.from(head.children)
      .reverse()
      .find(
        (node): node is HTMLElement =>
          node instanceof HTMLElement &&
          node.offsetParent !== null &&
          !node.classList.contains('tsl-head-ctrl')
      );
    if (!lastVisibleTrack) return null;

    const sharedBounds = sharedScroll.getBoundingClientRect();
    const trackBounds = lastVisibleTrack.getBoundingClientRect();
    return Math.max(0, Math.ceil(trackBounds.right - sharedBounds.right));
  }

  private syncSharedScrollOffset(scrollLeft?: number): void {
    const host = this.hostRef.nativeElement;
    if (!host) return;
    const nextScrollLeft = scrollLeft ?? this.sharedScrollRef?.nativeElement?.scrollLeft ?? 0;
    const offset = Math.max(0, nextScrollLeft);
    host.style.setProperty('--tsl-shared-scroll-left', `${offset}px`);

    const groupLeadingBlocks = host.querySelectorAll('.tsl-group-head-leading');
    groupLeadingBlocks.forEach((blockNode: Element) => {
      if (!(blockNode instanceof HTMLElement)) return;
      blockNode.style.transform = `translate3d(${offset}px, 0, 0)`;
    });

    const pinnedLeftCells = host.querySelectorAll(
      '.tsl-head-ctrl, .tsl-head-col.is-locked, .tsl-cell.row-ctrl, .tsl-cell.name'
    );
    pinnedLeftCells.forEach((cellNode: Element) => {
      if (!(cellNode instanceof HTMLElement)) return;
      cellNode.style.transform = `translate3d(${offset}px, 0, 0)`;
    });
  }

  private syncGridGeometryDomIfNeeded(): void {
    const columns = this.resolvedColumns();
    const signature = `${columns.join('|')}::${this.gridTemplate(columns)}::${this.gridTableWidth(columns)}::${this.stretchToContainer ? 'stretch' : 'content'}`;
    if (signature === this.lastGridSyncSignature) return;
    this.lastGridSyncSignature = signature;
    this.syncGridGeometryDom();
  }

  private columnMinWidth(column: AppStatusListColumnKey): number {
    if (column === 'name') return 140;
    return 64;
  }

  private columnTrackWidthPx(column: AppStatusListColumnKey): number {
    const override = this.columnWidthOverrides[column];
    if (typeof override === 'number' && Number.isFinite(override) && override > 0) {
      return Math.round(override);
    }
    const track =
      typeof override === 'string' && override.trim()
        ? override.trim()
        : (this.columnTemplate[column] ?? this.defaultColumnTrack).trim();
    const fixedMatch = /^(\d+(?:\.\d+)?)px$/i.exec(track);
    if (fixedMatch) return Number(fixedMatch[1]);

    const minMatch = /minmax\((\d+(?:\.\d+)?)px/i.exec(track);
    if (minMatch) return Number(minMatch[1]);

    return 120;
  }

  private normalizeColumnWidths(
    widths: AppStatusListColumnWidths | null | undefined
  ): AppStatusListColumnWidths {
    if (!widths) return {};
    const normalized: AppStatusListColumnWidths = {};
    for (const key of this.columnKeys()) {
      const value = widths[key];
      if (typeof value === 'string') {
        const track = value.trim();
        if (track) normalized[key] = track;
        continue;
      }
      const width = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(width)) continue;
      const minWidth = this.columnMinWidth(key);
      normalized[key] = Math.round(Math.min(Math.max(width, minWidth), 1200));
    }
    return normalized;
  }
}
