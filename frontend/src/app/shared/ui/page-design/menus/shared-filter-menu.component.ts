import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
  ViewEncapsulation
} from '@angular/core';
import type { FilterOperator } from '@shared/data-grid';
import { AppIconDirective } from '@shared/icons/app-icon.directive';
import { SearchSelectComponent } from '@shared/ui/search-select.component';
import type {
  SharedFilterColumnOption,
  SharedFilterGroup,
  SharedFilterJoin,
  SharedFilterRow,
  SharedSavedFilterItem,
  SharedFilterValueOption
} from '../models';

type SharedFilterJoinOption = { value: SharedFilterJoin; label: string };
type SharedFilterOperatorOption = { value: FilterOperator; label: string };

export type SharedFilterMenuHost = {
  sharedToolbarFilterGroups: SharedFilterGroup[];
  sharedHasDetailedFilters?(): boolean;
  onSharedFilterGroupJoinChange?(groupId: string, joinWithPrev: SharedFilterJoin): void;
  onSharedFilterJoinChange?(filterId: string, joinWithPrev: SharedFilterJoin): void;
  sharedFilterNestedJoin?(group: SharedFilterGroup): SharedFilterJoin;
  onSharedFilterNestedJoinChange?(groupId: string, joinWithPrev: SharedFilterJoin): void;
  sharedFilterFieldLabel?(field: string): string;
  sharedFilterFieldSearchTerm?(filterId: string): string;
  onSharedFilterFieldSearchInput?(filterId: string, value: string): void;
  clearSharedFilterFieldSearch?(filterId: string, event?: Event): void;
  sharedFilterColumns?(filterId: string): SharedFilterColumnOption[];
  onSharedFilterFieldSelect?(filterId: string, field: string, event?: Event): void;
  sharedFilterOperatorLabel?(operator: FilterOperator): string;
  sharedFilterOperatorOptions?(
    filter: SharedFilterRow
  ): Array<{ value: FilterOperator; label: string }>;
  onSharedFilterOperatorSelect?(filterId: string, operator: FilterOperator, event?: Event): void;
  sharedFilterOperatorNeedsNoValue?(operator: FilterOperator): boolean;
  sharedFilterValueUsesDropdown?(filter: SharedFilterRow): boolean;
  sharedFilterFieldIcon?(field: string): string;
  sharedFilterValueDisplay?(filter: SharedFilterRow): string;
  sharedFilterValueOptionsLoading?(filter: SharedFilterRow): boolean;
  sharedFilterValueOptions?(filter: SharedFilterRow): SharedFilterValueOption[];
  primeSharedFilterValueOptionsForFilter?(filterId: string): void;
  onSharedFilterValueSelect?(filterId: string, option: string, event?: Event): void;
  sharedFilterValueOptionSelected?(filter: SharedFilterRow, option: string): boolean;
  sharedFilterValueInputType?(filter: SharedFilterRow): 'text' | 'number' | 'date';
  sharedFilterValuePlaceholder?(filter: SharedFilterRow): string;
  sharedFilterValueInputValue?(filter: SharedFilterRow): string;
  sharedFilterValueListId?(filter: SharedFilterRow): string | null;
  onSharedFilterValueInput?(filterId: string, value: string): void;
  sharedFilterDatalistId?(filterId: string): string;
  sharedFilterValueSuggestions?(filter: SharedFilterRow): string[];
  removeSharedToolbarFilter?(filterId: string, event?: Event): void;
  onSharedFilterPanelActionPointerDown?(event?: Event): void;
  addSharedNestedFilter?(groupId: string, event?: Event): void;
  clearSharedFilterGroup?(groupId: string, event?: Event): void;
  addSharedToolbarFilter?(event?: Event): void;
  sharedHasActiveFilters?(): boolean;
  clearSharedToolbarFilters?(event?: Event): void;
  sharedSavedFiltersEnabled?(): boolean;
  sharedSavedFilters?(): SharedSavedFilterItem[];
  sharedSavedFiltersLoading?(): boolean;
  sharedSavedFiltersBusy?(): boolean;
  sharedSavedFiltersError?(): string;
  sharedCanSaveCurrentFilter?(): boolean;
  sharedCurrentSavedFilterId?(): number | null;
  loadSharedSavedFilters?(force?: boolean): void;
  saveCurrentSharedFilter?(name: string): void;
  applySharedSavedFilter?(savedFilterId: number, event?: Event): void;
  deleteSharedSavedFilter?(savedFilterId: number, event?: Event): void;
};

@Component({
  selector: 'engineers-salary-reference-shared-filter-menu',
  standalone: true,
  imports: [CommonModule, AppIconDirective, SearchSelectComponent],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './shared-filter-menu.component.html',
  styleUrls: ['./shared-filter-menu.component.scss']
})
export class SharedFilterMenuComponent implements OnDestroy {
  @Input({ required: true }) host: SharedFilterMenuHost | null = null;
  @ViewChild('savedFiltersTrigger', { read: ElementRef })
  protected savedFiltersTriggerRef?: ElementRef<HTMLElement>;
  @ViewChild('savedFiltersPanel', { read: ElementRef })
  protected savedFiltersPanelRef?: ElementRef<HTMLElement>;

  protected readonly joinOptions: SharedFilterJoinOption[] = [
    { value: 'and', label: 'AND' },
    { value: 'or', label: 'OR' }
  ];
  protected readonly selectOverlayPanelClass = ['proj-filter-select-overlay'];
  protected readonly compactSelectOverlayPanelClass = [
    'proj-filter-select-overlay',
    'proj-filter-select-overlay--compact'
  ];
  protected readonly fieldDisplay = (option: SharedFilterColumnOption | null): string =>
    option?.label ?? '';
  protected readonly operatorDisplay = (option: SharedFilterOperatorOption | null): string =>
    option?.label ?? '';
  protected readonly valueDisplay = (option: SharedFilterValueOption | null): string =>
    option?.label ?? '';
  protected readonly joinDisplay = (option: SharedFilterJoinOption | null): string =>
    option?.label ?? '';
  protected savedFiltersPanelOpen = false;
  protected savedFilterName = '';
  private readonly savedFilterTimestampCache = new Map<string, string>();
  private savedFiltersPanelListenerAttached = false;
  private readonly documentPointerDownHandler = (event: PointerEvent) =>
    this.onDocumentPointerDown(event);

  protected joinLabel(join?: SharedFilterJoin | null): string {
    return join === 'or' ? 'OR' : 'AND';
  }

  protected hasFilterGroups(): boolean {
    return (this.host?.sharedToolbarFilterGroups.length ?? 0) > 0;
  }

  protected outerGroupJoinLabel(groupIndex: number, group: SharedFilterGroup): string {
    if (groupIndex <= 1) {
      return this.joinLabel(group.joinWithPrev);
    }
    const sharedJoin = this.host?.sharedToolbarFilterGroups[1]?.joinWithPrev;
    return this.joinLabel(sharedJoin ?? group.joinWithPrev);
  }

  protected selectedJoinOption(join?: SharedFilterJoin | null): SharedFilterJoinOption {
    return this.joinOptions.find(option => option.value === join) ?? this.joinOptions[0];
  }

  protected selectedFieldOption(
    filter: SharedFilterRow,
    options?: SharedFilterColumnOption[] | null
  ): SharedFilterColumnOption | null {
    const field = filter.field.trim();
    if (!field) {
      return null;
    }
    const source = options ?? this.host?.sharedFilterColumns?.(filter.id) ?? [];
    return source.find(option => option.field === field) ?? null;
  }

  protected selectedOperatorOption(
    filter: SharedFilterRow,
    options?: SharedFilterOperatorOption[] | null
  ): SharedFilterOperatorOption | null {
    const source = options ?? this.host?.sharedFilterOperatorOptions?.(filter) ?? [];
    return source.find(option => option.value === filter.operator) ?? null;
  }

  protected selectedValueOption(
    filter: SharedFilterRow,
    options?: SharedFilterValueOption[] | null
  ): SharedFilterValueOption | null {
    const value = (filter.value ?? '').trim();
    if (!value) {
      return null;
    }
    const source = options ?? this.host?.sharedFilterValueOptions?.(filter) ?? [];
    const existing = source.find(option => option.value === value);
    return existing ?? { value, label: this.host?.sharedFilterValueDisplay?.(filter) ?? value };
  }

  protected onGroupJoinChange(groupId: string, option: SharedFilterJoinOption | null): void {
    if (!option) {
      return;
    }
    this.host?.onSharedFilterGroupJoinChange?.(groupId, option.value);
  }

  protected onNestedJoinChange(groupId: string, option: SharedFilterJoinOption | null): void {
    if (!option) {
      return;
    }
    this.host?.onSharedFilterNestedJoinChange?.(groupId, option.value);
  }

  protected onFieldChange(filterId: string, option: SharedFilterColumnOption | null): void {
    if (!option) {
      return;
    }
    this.host?.onSharedFilterFieldSelect?.(filterId, option.field);
  }

  protected onOperatorChange(filterId: string, option: SharedFilterOperatorOption | null): void {
    if (!option) {
      return;
    }
    this.host?.onSharedFilterOperatorSelect?.(filterId, option.value);
  }

  protected onValueChange(filterId: string, option: SharedFilterValueOption | null): void {
    if (!option) {
      return;
    }
    this.host?.onSharedFilterValueSelect?.(filterId, option.value);
  }

  protected onDocumentPointerDown(event: PointerEvent): void {
    if (!this.savedFiltersPanelOpen) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    const trigger = this.savedFiltersTriggerRef?.nativeElement;
    const panel = this.savedFiltersPanelRef?.nativeElement;
    if ((trigger && trigger.contains(target)) || (panel && panel.contains(target))) {
      return;
    }

    this.closeSavedFiltersPanel();
  }

  protected savedFiltersEnabled(): boolean {
    return !!this.host?.sharedSavedFiltersEnabled?.();
  }

  protected savedFilters(): SharedSavedFilterItem[] {
    return this.host?.sharedSavedFilters?.() ?? [];
  }

  protected currentSavedFilterId(): number | null {
    return this.host?.sharedCurrentSavedFilterId?.() ?? null;
  }

  protected toggleSavedFiltersPanel(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!this.savedFiltersEnabled()) {
      return;
    }

    if (this.savedFiltersPanelOpen) {
      this.closeSavedFiltersPanel();
      return;
    }

    this.savedFiltersPanelOpen = true;
    this.attachSavedFiltersPanelListener();
    this.host?.loadSharedSavedFilters?.();
  }

  protected onSavedFilterNameInput(value: string): void {
    this.savedFilterName = value ?? '';
  }

  protected saveCurrentSavedFilter(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.host?.saveCurrentSharedFilter?.(this.savedFilterName);
    this.savedFilterName = '';
  }

  protected applySavedFilter(savedFilterId: number, event?: Event): void {
    this.host?.applySharedSavedFilter?.(savedFilterId, event);
    this.closeSavedFiltersPanel();
  }

  protected deleteSavedFilter(savedFilterId: number, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.host?.deleteSharedSavedFilter?.(savedFilterId, event);
  }

  protected formatSavedFilterTimestamp(value?: string | null): string {
    const cacheKey = String(value ?? '');
    if (cacheKey) {
      const cached = this.savedFilterTimestampCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const parsed = cacheKey ? Date.parse(cacheKey) : Number.NaN;
    if (Number.isNaN(parsed)) {
      return 'Saved';
    }

    const formatted = new Date(parsed).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    this.savedFilterTimestampCache.set(cacheKey, formatted);
    return formatted;
  }

  ngOnDestroy(): void {
    this.detachSavedFiltersPanelListener();
  }

  private closeSavedFiltersPanel(): void {
    if (!this.savedFiltersPanelOpen) return;
    this.savedFiltersPanelOpen = false;
    this.detachSavedFiltersPanelListener();
  }

  private attachSavedFiltersPanelListener(): void {
    if (this.savedFiltersPanelListenerAttached || typeof document === 'undefined') return;
    this.savedFiltersPanelListenerAttached = true;
    document.addEventListener('pointerdown', this.documentPointerDownHandler, true);
  }

  private detachSavedFiltersPanelListener(): void {
    if (!this.savedFiltersPanelListenerAttached || typeof document === 'undefined') return;
    this.savedFiltersPanelListenerAttached = false;
    document.removeEventListener('pointerdown', this.documentPointerDownHandler, true);
  }
}
