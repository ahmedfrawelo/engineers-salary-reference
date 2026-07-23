import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  QueryList,
  SimpleChanges,
  ViewChild,
  ViewChildren,
  inject
} from '@angular/core';
import { AppIconDirective } from '@shared/icons/app-icon.directive';
import type { GridDateGroupInterval } from '@shared/data-grid';

type SharedGroupMenuOption = {
  value: string | null;
  label: string;
  icon: string;
  dateIntervals?: GridDateGroupInterval[];
};

type SharedGroupOrderOption = {
  value: string;
  label: string;
};

type SharedGroupSelection = {
  value: string | null;
  order: string;
  dateInterval?: GridDateGroupInterval | null;
};

@Component({
  selector: 'engineers-salary-reference-shared-group-menu',
  standalone: true,
  imports: [CommonModule, AppIconDirective],
  templateUrl: './shared-group-menu.component.html',
  styleUrls: ['./shared-group-menu.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SharedGroupMenuComponent implements OnChanges, OnDestroy {
  @Input() label = 'None';
  @Input() icon = 'layers';
  @Input() orderLabel = 'Ascending';
  @Input() options: SharedGroupMenuOption[] = [];
  @Input() orderOptions: SharedGroupOrderOption[] = [];
  @Input() enableMultiGrouping = false;
  @Input() groupSelections: SharedGroupSelection[] = [];
  @Input() selectedValue: string | null = null;
  @Input() enableSubGrouping = false;
  @Input() subLabel = 'None';
  @Input() subIcon = 'layers';
  @Input() subOptions: SharedGroupMenuOption[] = [];
  @Input() selectedSubValue: string | null = null;
  @Input() subOrderLabel = 'Ascending';
  @Input() subOrderOptions: SharedGroupOrderOption[] = [];
  @Input() selectedSubOrder = 'asc';
  @Input() selectedOrder = 'asc';

  @Output() readonly groupChange = new EventEmitter<string | null>();
  @Output() readonly groupSelectionsChange = new EventEmitter<SharedGroupSelection[]>();
  @Output() readonly subgroupChange = new EventEmitter<string | null>();
  @Output() readonly subgroupOrderChange = new EventEmitter<string>();
  @Output() readonly orderChange = new EventEmitter<string>();
  @Output() readonly reset = new EventEmitter<void>();
  @Output() readonly menuOpened = new EventEmitter<void>();

  @ViewChild('groupMenu', { read: ElementRef })
  private groupMenuRef?: ElementRef<HTMLDetailsElement>;
  @ViewChildren('multiGroupFieldMenu', { read: ElementRef })
  private multiGroupFieldMenuRefs?: QueryList<ElementRef<HTMLDetailsElement>>;
  @ViewChildren('multiGroupOrderMenu', { read: ElementRef })
  private multiGroupOrderMenuRefs?: QueryList<ElementRef<HTMLDetailsElement>>;
  @ViewChildren('multiGroupDateIntervalMenu', { read: ElementRef })
  private multiGroupDateIntervalMenuRefs?: QueryList<ElementRef<HTMLDetailsElement>>;
  @ViewChild('groupByMenu', { read: ElementRef })
  private groupByMenuRef?: ElementRef<HTMLDetailsElement>;
  @ViewChild('subGroupByMenu', { read: ElementRef })
  private subGroupByMenuRef?: ElementRef<HTMLDetailsElement>;
  @ViewChild('subGroupOrderMenu', { read: ElementRef })
  private subGroupOrderMenuRef?: ElementRef<HTMLDetailsElement>;
  @ViewChild('groupOrderMenu', { read: ElementRef })
  private groupOrderMenuRef?: ElementRef<HTMLDetailsElement>;
  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private simpleMode = true;
  private subGroupSectionOpen = false;
  private summaryPointerHandled = false;
  private documentPointerListenerAttached = false;
  private groupOpenEventEmitted = false;
  private readonly documentPointerDownHandler = (event: PointerEvent) =>
    this.handleDocumentPointerDown(event);
  private readonly emptyGroupRows: SharedGroupSelection[] = [{ value: null, order: 'asc' }];
  private simpleGroupRowsCacheValue: string | null = null;
  private simpleGroupRowsCacheOrder = '';
  private simpleGroupRowsCache: SharedGroupSelection[] = this.emptyGroupRows;
  private groupOptionsWithoutNoneCacheSource: SharedGroupMenuOption[] | null = null;
  private groupOptionsWithoutNoneCache: SharedGroupMenuOption[] = [];
  private optionByValueCacheSource: SharedGroupMenuOption[] | null = null;
  private optionByValueCache = new Map<string, SharedGroupMenuOption>();
  private availableOptionsCacheRows: SharedGroupSelection[] | null = null;
  private availableOptionsCacheOptions: SharedGroupMenuOption[] | null = null;
  private readonly availableOptionsCache = new Map<number, SharedGroupMenuOption[]>();
  private activeIndexesCacheRows: SharedGroupSelection[] | null = null;
  private activeIndexesCache: number[] = [];
  readonly dateIntervalOptions: Array<{ value: GridDateGroupInterval; label: string }> = [
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'quarter', label: 'Quarter' },
    { value: 'year', label: 'Year' }
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedValue']) {
      this.simpleMode = this.isNoneLikeValue(this.selectedValue);
    }
    if (this.simpleMode) {
      this.subGroupSectionOpen = false;
    } else if (!this.isNoneLikeValue(this.selectedSubValue)) {
      this.subGroupSectionOpen = true;
    }
  }

  openMenu(): void {
    const menu = this.groupMenuRef?.nativeElement;
    if (!menu) return;
    menu.open = true;
    this.syncGroupMenuOpenState();
  }

  closeMenu(): void {
    this.closeAllMenus();
  }

  onSummaryPointerDown(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.summaryPointerHandled = true;
    this.toggleMenuOpen();
  }

  onSummaryClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.summaryPointerHandled) {
      this.summaryPointerHandled = false;
      return;
    }
    this.toggleMenuOpen();
  }

  onSummaryKeydown(event: Event): void {
    if (!(event instanceof KeyboardEvent)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.toggleMenuOpen();
  }

  isMultiModeEnabled(): boolean {
    return this.enableMultiGrouping;
  }

  groupRows(): SharedGroupSelection[] {
    if (this.enableMultiGrouping) {
      return this.groupSelections.length ? this.groupSelections : this.emptyGroupRows;
    }
    if (
      this.simpleGroupRowsCacheValue === this.selectedValue &&
      this.simpleGroupRowsCacheOrder === this.selectedOrder
    ) {
      return this.simpleGroupRowsCache;
    }

    this.simpleGroupRowsCacheValue = this.selectedValue;
    this.simpleGroupRowsCacheOrder = this.selectedOrder;
    this.simpleGroupRowsCache = [{ value: this.selectedValue, order: this.selectedOrder }];
    return this.simpleGroupRowsCache;
  }

  hasActiveGroupRows(): boolean {
    return this.activeGroupRowIndexes().length > 0;
  }

  canShowAddGroupButton(): boolean {
    return (
      this.enableMultiGrouping &&
      this.hasActiveGroupRows() &&
      !this.hasPendingEmptyGroupRow() &&
      this.hasUnusedGroupOptions()
    );
  }

  addGroupRow(): void {
    if (!this.enableMultiGrouping) return;
    if (this.hasPendingEmptyGroupRow()) return;
    if (!this.hasUnusedGroupOptions()) return;
    const next = [...this.groupRows(), { value: null, order: 'asc' }];
    this.groupSelectionsChange.emit(next);
  }

  removeGroupRow(index: number): void {
    if (!this.enableMultiGrouping) return;
    const current = this.groupRows();
    if (index < 0 || index >= current.length) return;
    const next = current.filter((_, i) => i !== index);
    this.groupSelectionsChange.emit(next.length ? next : [{ value: null, order: 'asc' }]);
  }

  canMoveGroupUp(index: number): boolean {
    if (!this.enableMultiGrouping) return false;
    if (!this.showMoveControls(index)) return false;
    const active = this.activeGroupRowIndexes();
    const position = active.indexOf(index);
    return position > 0;
  }

  canMoveGroupDown(index: number): boolean {
    if (!this.enableMultiGrouping) return false;
    if (!this.showMoveControls(index)) return false;
    const active = this.activeGroupRowIndexes();
    const position = active.indexOf(index);
    return position >= 0 && position < active.length - 1;
  }

  showMoveControls(index: number): boolean {
    if (!this.enableMultiGrouping) return false;
    const row = this.groupRows()[index];
    if (!row || this.isNoneLikeValue(row.value)) return false;
    return this.activeGroupRowIndexes().length > 1;
  }

  moveGroupRow(index: number, direction: 'up' | 'down'): void {
    if (!this.enableMultiGrouping) return;
    const active = this.activeGroupRowIndexes();
    const position = active.indexOf(index);
    if (position < 0) return;

    const targetPosition = direction === 'up' ? position - 1 : position + 1;
    if (targetPosition < 0 || targetPosition >= active.length) return;

    const targetIndex = active[targetPosition];
    const next = [...this.groupRows()];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    this.groupSelectionsChange.emit(next);
  }

  groupRowLabel(row: SharedGroupSelection): string {
    if (this.isNoneLikeValue(row.value)) return 'Select group';
    return this.getOptionByValue(row.value)?.label ?? 'Select group';
  }

  groupRowIcon(row: SharedGroupSelection): string {
    if (this.isNoneLikeValue(row.value)) return 'layers';
    return this.getOptionByValue(row.value)?.icon ?? 'layers';
  }

  groupRowOrderLabel(row: SharedGroupSelection): string {
    const order = row.order === 'desc' ? 'desc' : 'asc';
    return this.orderOptions.find(option => option.value === order)?.label ?? 'Ascending';
  }

  groupRowDateIntervalOptions(row: SharedGroupSelection): Array<{
    value: GridDateGroupInterval;
    label: string;
  }> {
    if (this.isNoneLikeValue(row.value)) {
      return [];
    }
    const intervals = this.getOptionByValue(row.value)?.dateIntervals ?? [];
    return this.dateIntervalOptions.filter(option => intervals.includes(option.value));
  }

  groupRowDateIntervalLabel(row: SharedGroupSelection): string {
    const options = this.groupRowDateIntervalOptions(row);
    if (!options.length) {
      return '';
    }
    const selected =
      row.dateInterval && options.some(option => option.value === row.dateInterval)
        ? row.dateInterval
        : options[0].value;
    return options.find(option => option.value === selected)?.label ?? 'Day';
  }

  isGroupRowEmpty(row: SharedGroupSelection): boolean {
    return this.isNoneLikeValue(row.value);
  }

  availableOptionsForRow(index: number): SharedGroupMenuOption[] {
    const rows = this.groupRows();
    const options = this.groupOptionsWithoutNone();
    if (this.availableOptionsCacheRows !== rows || this.availableOptionsCacheOptions !== options) {
      this.availableOptionsCacheRows = rows;
      this.availableOptionsCacheOptions = options;
      this.availableOptionsCache.clear();
    }

    const cached = this.availableOptionsCache.get(index);
    if (cached) {
      return cached;
    }

    const usedFields = new Set(
      rows
        .map((row, i) => (i === index ? null : row.value))
        .filter((value): value is string => !!value)
    );
    const result = options.filter(option => !usedFields.has(option.value as string));
    this.availableOptionsCache.set(index, result);
    return result;
  }

  onMultiGroupFieldSelect(index: number, value: string | null): void {
    if (!this.enableMultiGrouping) return;
    const next = this.groupRows().map((row, i) =>
      i === index
        ? {
            ...row,
            value: this.isNoneLikeValue(value) ? null : value,
            dateInterval: this.resolveDateIntervalForValue(value, row.dateInterval)
          }
        : row
    );
    this.groupSelectionsChange.emit(next);
    this.closeNestedMenus();
  }

  onMultiGroupDateIntervalSelect(index: number, value: GridDateGroupInterval): void {
    if (!this.enableMultiGrouping) return;
    const row = this.groupRows()[index];
    if (!row || this.isNoneLikeValue(row.value)) return;
    const resolved = this.resolveDateIntervalForValue(row.value, value);
    if (!resolved) return;
    const next = this.groupRows().map((row, i) =>
      i === index ? { ...row, dateInterval: resolved } : row
    );
    this.groupSelectionsChange.emit(next);
    this.closeNestedMenus();
  }

  onMultiGroupOrderSelect(index: number, value: string): void {
    if (!this.enableMultiGrouping) return;
    const row = this.groupRows()[index];
    if (!row || this.isNoneLikeValue(row.value)) return;
    const next = this.groupRows().map((row, i) =>
      i === index ? { ...row, order: value === 'desc' ? 'desc' : 'asc' } : row
    );
    this.groupSelectionsChange.emit(next);
    this.closeNestedMenus();
  }

  onMultiGroupFieldToggle(index: number): void {
    const currentFieldMenus = this.multiGroupFieldMenuRefs?.toArray() ?? [];
    const currentOrderMenus = this.multiGroupOrderMenuRefs?.toArray() ?? [];
    const currentDateIntervalMenus = this.multiGroupDateIntervalMenuRefs?.toArray() ?? [];
    const current = currentFieldMenus[index]?.nativeElement;
    if (!current?.open) return;
    currentFieldMenus.forEach((menu, i) => {
      if (i !== index) menu.nativeElement.open = false;
    });
    currentOrderMenus.forEach(menu => (menu.nativeElement.open = false));
    currentDateIntervalMenus.forEach(menu => (menu.nativeElement.open = false));
  }

  onMultiGroupOrderToggle(index: number): void {
    const currentFieldMenus = this.multiGroupFieldMenuRefs?.toArray() ?? [];
    const currentOrderMenus = this.multiGroupOrderMenuRefs?.toArray() ?? [];
    const currentDateIntervalMenus = this.multiGroupDateIntervalMenuRefs?.toArray() ?? [];
    const current = currentOrderMenus[index]?.nativeElement;
    const row = this.groupRows()[index];
    if (!row || this.isNoneLikeValue(row.value)) {
      if (current) current.open = false;
      return;
    }
    if (!current?.open) return;
    currentOrderMenus.forEach((menu, i) => {
      if (i !== index) menu.nativeElement.open = false;
    });
    currentFieldMenus.forEach(menu => (menu.nativeElement.open = false));
    currentDateIntervalMenus.forEach(menu => (menu.nativeElement.open = false));
  }

  onMultiGroupDateIntervalToggle(index: number): void {
    const currentFieldMenus = this.multiGroupFieldMenuRefs?.toArray() ?? [];
    const currentOrderMenus = this.multiGroupOrderMenuRefs?.toArray() ?? [];
    const currentDateIntervalMenus = this.multiGroupDateIntervalMenuRefs?.toArray() ?? [];
    const row = this.groupRows()[index];
    if (!row || this.groupRowDateIntervalOptions(row).length === 0) {
      return;
    }
    const current = currentDateIntervalMenus.find(menu => menu.nativeElement.open)?.nativeElement;
    if (!current) return;
    currentDateIntervalMenus.forEach(menu => {
      if (menu.nativeElement !== current) menu.nativeElement.open = false;
    });
    currentFieldMenus.forEach(menu => (menu.nativeElement.open = false));
    currentOrderMenus.forEach(menu => (menu.nativeElement.open = false));
  }

  onGroupMenuToggle(): void {
    this.syncGroupMenuOpenState();
  }

  onGroupByToggle(): void {
    const groupByMenu = this.groupByMenuRef?.nativeElement;
    const subGroupByMenu = this.subGroupByMenuRef?.nativeElement;
    const groupOrderMenu = this.groupOrderMenuRef?.nativeElement;
    if (groupByMenu?.open && groupOrderMenu) {
      groupOrderMenu.open = false;
    }
    if (groupByMenu?.open && subGroupByMenu) {
      subGroupByMenu.open = false;
    }
  }

  onSubGroupByToggle(): void {
    const groupByMenu = this.groupByMenuRef?.nativeElement;
    const subGroupByMenu = this.subGroupByMenuRef?.nativeElement;
    const subGroupOrderMenu = this.subGroupOrderMenuRef?.nativeElement;
    const groupOrderMenu = this.groupOrderMenuRef?.nativeElement;
    if (subGroupByMenu?.open && groupByMenu) {
      groupByMenu.open = false;
    }
    if (subGroupByMenu?.open && groupOrderMenu) {
      groupOrderMenu.open = false;
    }
    if (subGroupByMenu?.open && subGroupOrderMenu) {
      subGroupOrderMenu.open = false;
    }
  }

  onSubGroupOrderToggle(): void {
    const groupByMenu = this.groupByMenuRef?.nativeElement;
    const subGroupByMenu = this.subGroupByMenuRef?.nativeElement;
    const subGroupOrderMenu = this.subGroupOrderMenuRef?.nativeElement;
    const groupOrderMenu = this.groupOrderMenuRef?.nativeElement;
    if (subGroupOrderMenu?.open && groupByMenu) {
      groupByMenu.open = false;
    }
    if (subGroupOrderMenu?.open && groupOrderMenu) {
      groupOrderMenu.open = false;
    }
    if (subGroupOrderMenu?.open && subGroupByMenu) {
      subGroupByMenu.open = false;
    }
  }

  onGroupOrderToggle(): void {
    const groupByMenu = this.groupByMenuRef?.nativeElement;
    const subGroupByMenu = this.subGroupByMenuRef?.nativeElement;
    const subGroupOrderMenu = this.subGroupOrderMenuRef?.nativeElement;
    const groupOrderMenu = this.groupOrderMenuRef?.nativeElement;
    if (groupOrderMenu?.open && groupByMenu) {
      groupByMenu.open = false;
    }
    if (groupOrderMenu?.open && subGroupByMenu) {
      subGroupByMenu.open = false;
    }
    if (groupOrderMenu?.open && subGroupOrderMenu) {
      subGroupOrderMenu.open = false;
    }
  }

  isSimpleMode(): boolean {
    if (this.enableMultiGrouping) {
      return !this.hasActiveGroupRows();
    }
    return this.simpleMode;
  }

  groupOptionsWithoutNone(): SharedGroupMenuOption[] {
    if (this.groupOptionsWithoutNoneCacheSource === this.options) {
      return this.groupOptionsWithoutNoneCache;
    }

    this.groupOptionsWithoutNoneCacheSource = this.options;
    this.groupOptionsWithoutNoneCache = this.options.filter(option => !this.isNoneOption(option));
    return this.groupOptionsWithoutNoneCache;
  }

  hasPrimaryGrouping(): boolean {
    return !this.isNoneLikeValue(this.selectedValue);
  }

  canShowAddSubGroupButton(): boolean {
    return this.enableSubGrouping && this.hasPrimaryGrouping() && !this.subGroupSectionOpen;
  }

  isSubGroupSectionOpen(): boolean {
    return this.enableSubGrouping && this.hasPrimaryGrouping() && this.subGroupSectionOpen;
  }

  openSubGroupSection(): void {
    this.subGroupSectionOpen = true;
  }

  private closeNestedMenus(): void {
    const multiGroupFieldMenus = this.multiGroupFieldMenuRefs?.toArray() ?? [];
    const multiGroupOrderMenus = this.multiGroupOrderMenuRefs?.toArray() ?? [];
    const multiGroupDateIntervalMenus = this.multiGroupDateIntervalMenuRefs?.toArray() ?? [];
    multiGroupFieldMenus.forEach(menu => (menu.nativeElement.open = false));
    multiGroupOrderMenus.forEach(menu => (menu.nativeElement.open = false));
    multiGroupDateIntervalMenus.forEach(menu => (menu.nativeElement.open = false));

    const groupByMenu = this.groupByMenuRef?.nativeElement;
    const subGroupByMenu = this.subGroupByMenuRef?.nativeElement;
    const subGroupOrderMenu = this.subGroupOrderMenuRef?.nativeElement;
    const groupOrderMenu = this.groupOrderMenuRef?.nativeElement;
    if (groupByMenu) groupByMenu.open = false;
    if (subGroupByMenu) subGroupByMenu.open = false;
    if (subGroupOrderMenu) subGroupOrderMenu.open = false;
    if (groupOrderMenu) groupOrderMenu.open = false;
  }

  private closeAllMenus(): void {
    this.closeNestedMenus();
    const groupMenu = this.groupMenuRef?.nativeElement;
    if (groupMenu) groupMenu.open = false;
    this.groupOpenEventEmitted = false;
    this.detachDocumentPointerListener();
  }

  private toggleMenuOpen(): void {
    const groupMenu = this.groupMenuRef?.nativeElement;
    if (!groupMenu) {
      return;
    }
    if (groupMenu.open) {
      this.closeAllMenus();
      return;
    }
    this.closeNestedMenus();
    groupMenu.open = true;
    this.syncGroupMenuOpenState();
  }

  ngOnDestroy(): void {
    this.detachDocumentPointerListener();
  }

  private handleDocumentPointerDown(event: Event): void {
    const target = event.target as Node | null;
    const host = this.hostRef.nativeElement;
    if (!target || host.contains(target)) return;
    this.closeAllMenus();
  }

  private syncGroupMenuOpenState(): void {
    const groupMenu = this.groupMenuRef?.nativeElement;
    if (!groupMenu?.open) {
      this.closeNestedMenus();
      this.groupOpenEventEmitted = false;
      this.detachDocumentPointerListener();
      return;
    }
    this.attachDocumentPointerListener();
    if (!this.groupOpenEventEmitted) {
      this.groupOpenEventEmitted = true;
      this.menuOpened.emit();
    }
  }

  private attachDocumentPointerListener(): void {
    if (this.documentPointerListenerAttached || typeof document === 'undefined') return;
    this.documentPointerListenerAttached = true;
    document.addEventListener('pointerdown', this.documentPointerDownHandler, true);
  }

  private detachDocumentPointerListener(): void {
    if (!this.documentPointerListenerAttached || typeof document === 'undefined') return;
    this.documentPointerListenerAttached = false;
    document.removeEventListener('pointerdown', this.documentPointerDownHandler, true);
  }

  private isNoneLikeValue(value: string | null): boolean {
    if (value == null || value === '') return true;
    const selectedOption = this.getOptionByValue(value);
    if (selectedOption) {
      return selectedOption.label.trim().toLowerCase() === 'none';
    }
    return value.trim().toLowerCase() === 'none';
  }

  private resolveDateIntervalForValue(
    value: string | null,
    requested: GridDateGroupInterval | null | undefined
  ): GridDateGroupInterval | null {
    if (this.isNoneLikeValue(value)) {
      return null;
    }
    const intervals = this.getOptionByValue(value)?.dateIntervals ?? [];
    if (!intervals.length) {
      return null;
    }
    return requested && intervals.includes(requested) ? requested : intervals[0];
  }

  onGroupSelect(value: string | null): void {
    if (this.enableMultiGrouping) {
      const nextValue = this.isNoneLikeValue(value) ? null : value;
      const nextOrder = this.groupRows()[0]?.order === 'desc' ? 'desc' : 'asc';
      this.groupSelectionsChange.emit([
        {
          value: nextValue,
          order: nextOrder,
          dateInterval: this.resolveDateIntervalForValue(
            nextValue,
            this.groupRows()[0]?.dateInterval
          )
        }
      ]);
      this.simpleMode = this.isNoneLikeValue(nextValue);
      if (this.simpleMode) {
        this.subGroupSectionOpen = false;
      }
      this.closeNestedMenus();
      return;
    }

    this.groupChange.emit(value);
    this.simpleMode = this.isNoneLikeValue(value);
    if (this.simpleMode) {
      this.subGroupSectionOpen = false;
    }
    this.closeNestedMenus();
  }

  onOrderSelect(value: string): void {
    this.orderChange.emit(value);
    this.closeNestedMenus();
  }

  onSubGroupSelect(value: string | null): void {
    this.subgroupChange.emit(value);
    if (this.isNoneLikeValue(value)) {
      this.subGroupSectionOpen = false;
    }
    this.closeNestedMenus();
  }

  onSubGroupOrderSelect(value: string): void {
    this.subgroupOrderChange.emit(value);
    this.closeNestedMenus();
  }

  onReset(): void {
    if (this.enableMultiGrouping) {
      const current = this.groupRows();
      const hasRemainingActiveGroups = current
        .slice(1)
        .some(row => !this.isNoneLikeValue(row.value));
      if (hasRemainingActiveGroups) {
        this.groupSelectionsChange.emit(current.slice(1));
      } else {
        this.groupSelectionsChange.emit([{ value: null, order: 'asc' }]);
      }
      this.closeNestedMenus();
      return;
    }
    this.reset.emit();
    this.simpleMode = true;
    this.subGroupSectionOpen = false;
    this.closeNestedMenus();
  }

  private activeGroupRowIndexes(): number[] {
    const rows = this.groupRows();
    if (this.activeIndexesCacheRows === rows) {
      return this.activeIndexesCache;
    }

    this.activeIndexesCacheRows = rows;
    this.activeIndexesCache = rows
      .map((row, index) => (this.isNoneLikeValue(row.value) ? -1 : index))
      .filter((index): index is number => index >= 0);
    return this.activeIndexesCache;
  }

  private hasPendingEmptyGroupRow(): boolean {
    return this.groupRows().some(row => this.isNoneLikeValue(row.value));
  }

  private hasUnusedGroupOptions(): boolean {
    const usedFields = new Set(
      this.groupRows()
        .map(row => row.value)
        .filter((value): value is string => !this.isNoneLikeValue(value))
    );
    return this.groupOptionsWithoutNone().some(option => !usedFields.has(option.value as string));
  }

  private getOptionByValue(value: string | null): SharedGroupMenuOption | null {
    if (!value) {
      return null;
    }

    if (this.optionByValueCacheSource !== this.options) {
      this.optionByValueCacheSource = this.options;
      this.optionByValueCache = new Map(
        this.options
          .filter(option => typeof option.value === 'string' && option.value.length > 0)
          .map(option => [option.value as string, option] as const)
      );
    }
    return this.optionByValueCache.get(value) ?? null;
  }

  private isNoneOption(option: SharedGroupMenuOption): boolean {
    const value = String(option?.value ?? '')
      .trim()
      .toLowerCase();
    const label = String(option?.label ?? '')
      .trim()
      .toLowerCase();
    return !value || value === 'none' || label === 'none';
  }
}
