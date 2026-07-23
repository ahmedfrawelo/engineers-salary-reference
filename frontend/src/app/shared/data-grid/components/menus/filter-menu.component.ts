import {
  Component,
  ChangeDetectionStrategy,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  OnDestroy,
  SimpleChanges
} from '@angular/core';
import { Search01Icon } from '@shared/icons/app-icon.registry';

type LooseValue = ReturnType<typeof JSON.parse>;
export interface FilterOption {
  label: string;
  value: LooseValue;
  checked: boolean;
}

const FILTER_MENU_REMOTE_SEARCH_DEBOUNCE_MS = 180;

@Component({
  selector: 'engineers-salary-reference-filter-menu',
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="filter-menu"
      [style.left.px]="position.x"
      [style.top.px]="position.y"
      (click)="$event.stopPropagation()"
    >
      <div class="filter-header">
        <div class="filter-search">
          <div class="search-box">
            <hugeicons-icon
              class="search-icon"
              [icon]="searchIcon"
              [size]="14"
              [strokeWidth]="2"
              aria-hidden="true"
            ></hugeicons-icon>
            <input
              type="text"
              class="filter-search-input"
              [placeholder]="placeholder || 'Search values...'"
              [(ngModel)]="searchTerm"
              (input)="onSearchChange()"
            />
            @if (searchTerm) {
              <button class="clear-search" (click)="clearSearch()">x</button>
            }
          </div>
        </div>
        <div class="filter-info">
          <span class="selected-count">{{ selectedCount }} / {{ options.length }}</span>
        </div>
      </div>

      <div class="select-all-bar">
        <label class="filter-option select-all-option">
          <input
            #selectAllCheckbox
            type="checkbox"
            [disabled]="selectAllDisabled"
            [checked]="selectAllChecked"
            [indeterminate]="selectAllIndeterminate"
            (change)="onSelectAllChange($event)"
          />
          <span class="option-label">(Select All)</span>
        </label>
      </div>

      <div class="filter-options">
        @if (loading && filteredOptions.length === 0) {
          <div class="no-results">
            <hugeicons-icon
              [icon]="searchIcon"
              [size]="48"
              [strokeWidth]="1.7"
              class="no-results-icon"
              aria-hidden="true"
            ></hugeicons-icon>
            <p>Loading values...</p>
          </div>
        }
        @for (option of filteredOptions; track trackByValue($index, option)) {
          <label class="filter-option" [class.checked]="option.checked">
            <input
              type="checkbox"
              [disabled]="loading"
              [(ngModel)]="option.checked"
              (ngModelChange)="onOptionChange(option, $event)"
            />
            <span class="option-label">{{ option.label }}</span>
          </label>
        }

        @if (!loading && filteredOptions.length === 0) {
          <div class="no-results">
            <hugeicons-icon
              [icon]="searchIcon"
              [size]="48"
              [strokeWidth]="1.7"
              class="no-results-icon"
              aria-hidden="true"
            ></hugeicons-icon>
            <p>No matching values</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .filter-menu {
        position: fixed;
        background: linear-gradient(
          160deg,
          rgb(var(--surface, 32 32 32)) 0%,
          rgb(var(--bg1, 25 25 25)) 100%
        );
        color: rgb(var(--fg, 232 234 238));
        border: 1px solid rgba(var(--primary, 132 199 24), 0.55);
        outline: 2px solid rgba(var(--primary, 132 199 24), 0.65);
        outline-offset: 2px;
        border-radius: 10px;
        box-shadow:
          0 14px 36px rgba(0, 0, 0, 0.28),
          0 8px 26px rgba(var(--primary, 132 199 24), 0.18),
          inset 0 0 0 1px rgba(var(--primary, 132 199 24), 0.18),
          0 0 0 1px rgba(var(--primary, 132 199 24), 0.35);
        width: clamp(220px, 38vw, 280px);
        min-width: 210px;
        max-width: 280px;
        max-height: 380px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        z-index: 10001;
        margin-top: 6px;
        font-family:
          -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        font-size: 12px;
        line-height: 1.5;
        backdrop-filter: blur(10px);
        animation: pop 0.18s ease-out;
        transform-origin: top left;
      }

      @keyframes filterMenuSlideIn {
        from {
          opacity: 0;
          transform: scale(0.96) translateY(-4px);
        }
        to {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }

      @keyframes optionFadeIn {
        from {
          opacity: 0;
          transform: translateX(-4px);
          color: rgba(var(--fg, 232 234 238), 0.6);
        }
        to {
          opacity: 1;
          transform: translateX(0);
          color: inherit;
        }
      }

      @keyframes labelFade {
        from {
          opacity: 0;
          transform: translateY(3px);
          color: rgba(var(--primary, 132 199 24), 0.65);
        }
        to {
          opacity: 1;
          transform: translateY(0);
          color: inherit;
        }
      }

      .filter-header {
        display: flex;
        align-items: center;
        gap: 8px;
        justify-content: space-between;
        background: rgb(var(--surface, 32 32 32));
        border-bottom: 1px solid rgba(var(--primary, 132 199 24), 0.6);
        box-shadow: inset 0 -1px 0 rgba(var(--bg0, 18 18 18), 0.6);
        padding: 0 10px 0;
        position: sticky;
        top: 0;
        backdrop-filter: blur(6px);
        z-index: 1;
      }

      .filter-search {
        position: relative;
        display: flex;
        align-items: center;
        gap: 4px;
        margin-bottom: 0;
        flex: 1 1 auto;
        min-width: 0;
      }

      .search-box {
        position: relative;
        display: flex;
        align-items: center;
        flex: 1;
        padding: 4px 10px;
        background: transparent;
        border: 1px solid rgba(var(--primary, 132 199 24), 0.4);
        border-radius: 10px;
        box-shadow: 0 0 0 1px rgba(var(--primary, 132 199 24), 0.08);
        min-height: 32px;
      }

      .search-icon {
        position: absolute;
        left: 10px;
        color: rgba(var(--fg, 232 234 238), 0.6);
        pointer-events: none;
        transition:
          transform 0.18s ease,
          color 0.18s ease;
      }

      @keyframes searchPulse {
        0% {
          transform: translateY(0) scale(1);
          opacity: 0.75;
        }
        40% {
          transform: translateY(-1px) scale(1.12);
          opacity: 1;
        }
        100% {
          transform: translateY(0) scale(1);
          opacity: 0.75;
        }
      }

      .search-box:focus-within .search-icon {
        color: rgb(var(--primary, 132 199 24));
        animation: searchPulse 1s ease infinite;
      }

      .filter-search-input {
        flex: 1;
        padding: 3px 24px 3px 24px;
        font-size: 12px;
        border: 1px solid rgba(var(--border, 74 78 86), 0.5);
        border-radius: 8px;
        background: transparent;
        color: inherit;
        outline: none;
        height: 26px;
        transition:
          border-color 0.15s ease,
          box-shadow 0.18s ease;

        &:focus {
          border-color: rgba(var(--primary, 132 199 24), 0.85);
          box-shadow: 0 0 0 3px rgba(var(--primary, 132 199 24), 0.16);
        }

        &::placeholder {
          color: rgba(var(--fg, 232 234 238), 0.45);
        }
      }

      .clear-search {
        position: absolute;
        right: 8px;
        background: transparent;
        border: none;
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: rgba(var(--fg, 232 234 238), 0.55);
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        padding: 0;
        transition:
          color 0.15s ease,
          transform 0.12s ease;

        &:hover {
          color: rgba(var(--fg, 232 234 238), 0.8);
          transform: scale(1.08);
        }
      }

      .filter-info {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        color: rgba(var(--fg, 232 234 238), 0.9);
        margin-left: 6px;
        white-space: nowrap;
        flex: 0 0 auto;
      }

      .selected-count {
        font-weight: 600;
        padding: 4px 8px;
        border-radius: 8px;
        background: rgba(var(--primary, 132 199 24), 0.18);
        border: 1px solid rgba(var(--primary, 132 199 24), 0.3);
        color: rgb(var(--primary, 132 199 24));
      }

      .select-all-bar {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 0 10px 2px;
        background: rgb(var(--surface, 32 32 32));
        border-top: 1px solid rgba(var(--primary, 132 199 24), 0.6);
        border-bottom: 1px solid rgba(var(--border, 74 78 86), 0.95);
        box-shadow:
          inset 0 1px 0 rgba(var(--fg, 232 234 238), 0.08),
          inset 0 -1px 0 rgba(var(--bg0, 18 18 18), 0.55);
      }

      .select-all-bar .filter-option {
        flex: 1;
        margin-bottom: 0;
      }

      .filter-options {
        flex: 1;
        overflow-y: auto;
        padding: 8px 12px 12px;
        max-height: 260px;

        /* Custom scrollbar */
        &::-webkit-scrollbar {
          width: 6px;
        }

        &::-webkit-scrollbar-track {
          background: transparent;
        }

        &::-webkit-scrollbar-thumb {
          background: rgba(var(--primary, 132 199 24), 0.35);
          border-radius: 3px;

          &:hover {
            background: rgba(var(--primary, 132 199 24), 0.5);
          }
        }
      }

      .filter-option {
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 7px 9px;
        font-size: 12px;
        color: inherit;
        cursor: pointer;
        border-radius: 8px;
        border: 1px solid transparent;
        transition:
          background-color 0.12s ease,
          box-shadow 0.12s ease,
          transform 0.12s ease,
          color 0.12s ease,
          border-color 0.12s ease;
        margin-bottom: 4px;
        animation: none;

        &:hover {
          background-color: rgba(var(--primary, 132 199 24), 0.08);
          box-shadow: 0 6px 16px rgba(var(--primary, 132 199 24), 0.12);
          transform: translateX(2px);
          color: rgb(var(--primary, 132 199 24));
        }

        &.checked {
          background-color: rgba(var(--primary, 132 199 24), 0.18);
          box-shadow:
            inset 0 1px 0 rgba(var(--fg, 232 234 238), 0.06),
            0 10px 26px rgba(var(--primary, 132 199 24), 0.16);
          border-color: transparent;
          color: rgb(var(--primary, 132 199 24));
        }

        &.select-all-option {
          font-weight: 600;
          border-bottom: 1px solid rgba(var(--border, 74 78 86), 0.6);
          padding: 10px 9px;
          margin-bottom: 8px;
          border-radius: 10px;
        }

        input[type='checkbox'] {
          cursor: pointer;
          width: 12px;
          height: 12px;
          margin: 0;
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
          border: 1.5px solid rgba(var(--fg, 232 234 238), 0.3);
          border-radius: 50%;
          background: transparent;
          position: relative;
          transition: all 0.18s ease;

          &:hover {
            border-color: rgba(94, 234, 212, 0.6);
            background: rgba(94, 234, 212, 0.1);
          }

          &:checked {
            background: #5eeadc;
            border-color: #5eeadc;

            &::after {
              content: '';
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: 3px;
              height: 3px;
              background: rgb(var(--bg0, 18 18 18));
              border-radius: 50%;
            }
          }
        }

        .option-label {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          animation: none;
        }

        .option-badge {
          display: none;
        }
      }

      .no-results {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 32px 16px;
        color: rgba(var(--fg, 232 234 238), 0.5);
        text-align: center;

        svg {
          margin-bottom: 8px;
          opacity: 0.3;
        }

        p {
          margin: 0;
          font-size: 12px;
        }
      }
    `
  ]
})
export class FilterMenuComponent implements OnInit, OnChanges, OnDestroy {
  readonly searchIcon = Search01Icon;
  private _options: FilterOption[] = [];
  @Input()
  set options(value: FilterOption[] | null | undefined) {
    this._options = value ?? [];
  }
  get options(): FilterOption[] {
    return this._options;
  }

  private _loading = false;
  @Input()
  set loading(value: boolean | null | undefined) {
    this._loading = value ?? false;
  }
  get loading(): boolean {
    return this._loading;
  }

  private _position = { x: 0, y: 0 };
  @Input()
  set position(value: { x: number; y: number } | null | undefined) {
    this._position = value ?? { x: 0, y: 0 };
  }
  get position(): { x: number; y: number } {
    return this._position;
  }

  private _placeholder = 'Search values...';
  @Input()
  set placeholder(value: string | null | undefined) {
    this._placeholder = value ?? 'Search values...';
  }
  get placeholder(): string {
    return this._placeholder;
  }

  private _initialSearchTerm = '';
  @Input()
  set initialSearchTerm(value: string | null | undefined) {
    this._initialSearchTerm = value ?? '';
  }
  get initialSearchTerm(): string {
    return this._initialSearchTerm;
  }

  private readonly _onFilter = new EventEmitter<LooseValue[]>();
  @Output()
  get onFilter(): EventEmitter<LooseValue[]> {
    return this._onFilter;
  }

  private readonly _onSearchTermChange = new EventEmitter<string>();
  @Output()
  get onSearchTermChange(): EventEmitter<string> {
    return this._onSearchTermChange;
  }

  searchTerm = '';
  filteredOptions: FilterOption[] = [];
  private searchEmitTimer: ReturnType<typeof setTimeout> | null = null;

  get allSelected(): boolean {
    return this.options.length > 0 && this.options.every(opt => opt.checked);
  }

  get someSelected(): boolean {
    return this.options.some(opt => opt.checked) && !this.allSelected;
  }

  get hasActiveSearch(): boolean {
    return this.getSearchTerms(this.searchTerm).length > 0;
  }

  get selectAllChecked(): boolean {
    if (!this.hasActiveSearch) {
      return this.allSelected;
    }
    const scope = this.filteredOptions;
    if (!scope.length) {
      return false;
    }
    const visibleSet = new Set(scope);
    const hasCheckedOutsideVisible = this.options.some(opt => !visibleSet.has(opt) && opt.checked);
    return scope.every(opt => opt.checked) && !hasCheckedOutsideVisible;
  }

  get selectAllDisabled(): boolean {
    return this.hasActiveSearch ? this.filteredOptions.length === 0 : this.options.length === 0;
  }

  get selectAllIndeterminate(): boolean {
    if (!this.hasActiveSearch) {
      return this.someSelected;
    }
    const scope = this.filteredOptions;
    if (!scope.length) {
      return false;
    }
    const visibleSet = new Set(scope);
    const checkedVisibleCount = scope.filter(opt => opt.checked).length;
    const hasCheckedOutsideVisible = this.options.some(opt => !visibleSet.has(opt) && opt.checked);
    if (this.selectAllChecked) {
      return false;
    }
    return checkedVisibleCount > 0 || hasCheckedOutsideVisible;
  }

  get selectedCount(): number {
    return this.options.filter(opt => opt.checked).length;
  }

  ngOnInit(): void {
    this.searchTerm = this.initialSearchTerm || '';
    this.refreshFilteredOptions();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialSearchTerm']) {
      const next = this.initialSearchTerm || '';
      if (next !== this.searchTerm) {
        this.searchTerm = next;
      }
    }
    if (changes['options'] || changes['initialSearchTerm']) {
      this.refreshFilteredOptions();
    }
  }

  ngOnDestroy(): void {
    this.clearSearchEmitTimer();
  }

  onSearchChange(): void {
    this.refreshFilteredOptions();
    this.queueSearchTermChange();
  }

  clearSearch(): void {
    if (!this.searchTerm) {
      return;
    }
    this.searchTerm = '';
    this.refreshFilteredOptions();
    this.clearSearchEmitTimer();
    this.onSearchTermChange.emit(this.searchTerm);
  }

  onSelectAllChange(event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    if (this.hasActiveSearch) {
      const visible = new Set(this.filteredOptions);
      if (!visible.size) {
        return;
      }
      if (checkbox.checked) {
        // Search mode: selecting all means keep only search results selected.
        this.options.forEach(opt => (opt.checked = visible.has(opt)));
      } else {
        // Search mode: uncheck visible results only, keep hidden selections.
        this.options.forEach(opt => {
          if (visible.has(opt)) {
            opt.checked = false;
          }
        });
      }
      this.emitSelection();
      return;
    }

    const scope = this.options;
    for (const option of scope) {
      option.checked = checkbox.checked;
    }
    this.emitSelection();
  }

  onOptionChange(option: FilterOption, checked: boolean): void {
    if (
      this.hasActiveSearch &&
      checked === false &&
      this.filteredOptions.length > 0 &&
      this.options.filter(opt => opt.checked).length === this.options.length - 1
    ) {
      // If user starts from "all selected" and unchecks one visible item while searching,
      // treat it as "isolate current search results" for immediate table feedback.
      const visible = new Set(this.filteredOptions);
      this.options.forEach(opt => (opt.checked = visible.has(opt)));
    }
    this.emitSelection();
  }

  private emitSelection(): void {
    const selectedValues = this.options.filter(opt => opt.checked).map(opt => opt.value);
    this.onFilter.emit(selectedValues);
  }

  private queueSearchTermChange(): void {
    this.clearSearchEmitTimer();
    this.searchEmitTimer = setTimeout(() => {
      this.searchEmitTimer = null;
      this.onSearchTermChange.emit(this.searchTerm);
    }, FILTER_MENU_REMOTE_SEARCH_DEBOUNCE_MS);
  }

  private clearSearchEmitTimer(): void {
    if (this.searchEmitTimer == null) {
      return;
    }
    clearTimeout(this.searchEmitTimer);
    this.searchEmitTimer = null;
  }

  private refreshFilteredOptions(): void {
    const terms = this.getSearchTerms(this.searchTerm);
    if (!terms.length) {
      this.filteredOptions = [...this.options];
      return;
    }

    this.filteredOptions = this.options.filter(opt => this.matchesAllSearchTerms(opt.label, terms));
  }

  private getSearchTerms(rawTerm: string): string[] {
    return rawTerm
      .split(/[,;|\u060C]+/g)
      .map(term => term.trim().toLowerCase())
      .filter(Boolean);
  }

  private matchesAllSearchTerms(label: string, terms: string[]): boolean {
    const normalized = label.toLowerCase();
    return terms.every(term => normalized.includes(term));
  }

  trackByValue(index: number, option: FilterOption): LooseValue {
    return option.value;
  }
}
