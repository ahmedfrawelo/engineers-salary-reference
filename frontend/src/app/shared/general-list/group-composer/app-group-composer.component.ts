import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostBinding, Input, OnInit, Output } from '@angular/core';
import { AppIconDirective } from '@shared/icons/app-icon.directive';

type SuggestedGroupOption = {
  name: string;
  color: string;
  icon: string;
};

export interface AppGroupComposerCreateEvent {
  name: string;
  color: string;
  icon: string;
}

const DEFAULT_SWATCHES = [
  '#14b8a6',
  '#0ea5e9',
  '#8b5cf6',
  '#f97316',
  '#ef4444',
  '#22c55e',
  '#eab308',
  '#64748b'
] as const;

const DEFAULT_ICONS = [
  'circle-fill',
  'record-circle',
  'check-circle-fill',
  'flag-fill',
  'lightning-fill',
  'kanban-fill',
  'calendar-check-fill',
  'pin-angle-fill'
] as const;

const DEFAULT_SUGGESTIONS = [
  'Planning',
  'Execution',
  'Follow-up',
  'Approvals',
  'Urgent',
  'Blocked',
  'Ready',
  'Pending',
  'Review',
  'Closeout'
] as const;

@Component({
  selector: 'app-group-composer',
  standalone: true,
  imports: [CommonModule, AppIconDirective],
  templateUrl: './app-group-composer.component.html',
  styleUrls: ['./app-group-composer.component.scss']
})
export class AppGroupComposerComponent implements OnInit {
  @Input() addLabel = 'Add group';
  @Input() namePlaceholder = 'GROUP NAME';
  @Input() suggestedTriggerAriaLabel = 'Suggested groups';
  @Input() colorTriggerAriaLabel = 'Pick group color';
  @Input() submitAriaLabel = 'Create group';
  @Input() cancelAriaLabel = 'Cancel group';
  @Input() selectedIconLabel = 'Selected icon';
  @Input() paletteStorageKey = 'engineers-salary-reference.group-composer.palette';
  @Input() existingNames: ReadonlyArray<string> = [];
  @Input() revealOnHover = false;

  @Output() createGroup = new EventEmitter<AppGroupComposerCreateEvent>();

  @HostBinding('class.reveal-on-hover')
  get revealOnHoverClass(): boolean {
    return this.revealOnHover;
  }

  addingGroup = false;
  suggestedGroupsOpen = false;
  groupDraft = '';
  groupColorDraft: string = DEFAULT_SWATCHES[0];
  groupIconDraft: string = DEFAULT_ICONS[0];
  customPalette: string[] = [];
  readonly iconOptions = DEFAULT_ICONS;

  ngOnInit(): void {
    this.customPalette = this.readStoredPalette();
  }

  get suggestedGroups(): SuggestedGroupOption[] {
    const taken = new Set(
      this.existingNames.map(name => name.trim().toLowerCase()).filter(Boolean)
    );
    return DEFAULT_SUGGESTIONS.filter(name => !taken.has(name.toLowerCase()))
      .slice(0, 6)
      .map((name, index) => ({
        name,
        color: this.colorOptions[index % this.colorOptions.length],
        icon: this.iconOptions[index % this.iconOptions.length]
      }));
  }

  get colorOptions(): string[] {
    return [
      ...DEFAULT_SWATCHES,
      ...this.customPalette.filter(
        color => !DEFAULT_SWATCHES.some(defaultColor => defaultColor === color)
      )
    ];
  }

  startAdding(): void {
    this.addingGroup = true;
    this.suggestedGroupsOpen = false;
    if (!this.groupDraft.trim()) {
      const nextSuggestion = this.suggestedGroups[0];
      if (nextSuggestion) {
        this.groupDraft = nextSuggestion.name;
        this.groupColorDraft = nextSuggestion.color;
        this.groupIconDraft = nextSuggestion.icon;
      }
    }
  }

  cancel(): void {
    this.addingGroup = false;
    this.suggestedGroupsOpen = false;
    this.groupDraft = '';
    this.groupColorDraft = DEFAULT_SWATCHES[0];
    this.groupIconDraft = DEFAULT_ICONS[0];
  }

  toggleSuggestedGroups(): void {
    this.suggestedGroupsOpen = !this.suggestedGroupsOpen;
  }

  selectSuggestedGroup(option: SuggestedGroupOption): void {
    this.groupDraft = option.name;
    this.groupColorDraft = option.color;
    this.groupIconDraft = option.icon;
    this.suggestedGroupsOpen = false;
  }

  updateGroupDraft(value: string): void {
    this.groupDraft = value ?? '';
  }

  updateGroupColor(value: string): void {
    const normalized = this.normalizeHexColor(value);
    if (!normalized) {
      return;
    }
    this.groupColorDraft = normalized;
    this.persistColor(normalized);
  }

  selectColor(color: string): void {
    this.groupColorDraft = color;
    this.persistColor(color);
  }

  selectIcon(icon: string): void {
    this.groupIconDraft = icon;
  }

  submit(): void {
    const name = this.groupDraft.trim();
    if (!name) {
      return;
    }

    const normalizedName = name.toLowerCase();
    const exists = this.existingNames.some(item => item.trim().toLowerCase() === normalizedName);
    if (exists) {
      return;
    }

    const color = this.normalizeHexColor(this.groupColorDraft) ?? DEFAULT_SWATCHES[0];
    const icon = this.groupIconDraft || DEFAULT_ICONS[0];
    this.createGroup.emit({ name, color, icon });
    this.cancel();
  }

  trackByValue = (_index: number, value: string): string => value;
  trackBySuggestion = (_index: number, option: SuggestedGroupOption): string => option.name;

  private persistColor(color: string): void {
    if (
      this.customPalette.includes(color) ||
      DEFAULT_SWATCHES.some(defaultColor => defaultColor === color)
    ) {
      return;
    }

    this.customPalette = [color, ...this.customPalette].slice(0, 8);
    try {
      localStorage.setItem(this.paletteStorageKey, JSON.stringify(this.customPalette));
    } catch {
      // Ignore storage failures and keep runtime state only.
    }
  }

  private readStoredPalette(): string[] {
    try {
      const raw = localStorage.getItem(this.paletteStorageKey);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed
        .map(value => this.normalizeHexColor(String(value ?? '')))
        .filter((value): value is string => !!value);
    } catch {
      return [];
    }
  }

  private normalizeHexColor(value: string): string | null {
    const raw = String(value ?? '').trim();
    if (!/^#?[0-9a-fA-F]{6}$/.test(raw)) {
      return null;
    }
    return raw.startsWith('#') ? raw.toLowerCase() : `#${raw.toLowerCase()}`;
  }
}
