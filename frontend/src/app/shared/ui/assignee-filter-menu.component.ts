import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  computed,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppIconDirective } from '@shared/icons/app-icon.directive';
import { SideDrawerComponent, type SideDrawerMode } from '@shared/ui/side-drawer';

export interface AssigneeFilterOption {
  value: string;
  label: string;
  count: number;
  color?: string;
  initials?: string;
}

export type AssigneeFilterSelection =
  | { kind: 'all' }
  | { kind: 'mine' }
  | { kind: 'unassigned' }
  | { kind: 'owner'; owner: string };

@Component({
  selector: 'app-assignee-filter-menu',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AppIconDirective,
    SideDrawerComponent
  ],
  templateUrl: './assignee-filter-menu.component.html',
  styleUrls: ['./assignee-filter-menu.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssigneeFilterMenuComponent implements OnDestroy {
  @Input() triggerIcon = 'people';
  @Input() triggerLabel = 'Assignee';
  @Input() title = 'Assignees';
  @Input() sectionLabel = 'People';
  @Input() countLabel = '';
  @Input() allIcon = 'people';
  @Input() searchPlaceholder = 'Search by user or team';
  @Input() allLabel = 'All assignees';
  @Input() mineLabel = 'Assigned to me';
  @Input() unassignedLabel = 'Unassigned';
  @Input() emptyLabel = 'No assignees found.';
  @Input() showMine = false;
  @Input() allCount = 0;
  @Input() mineCount = 0;
  @Input() unassignedCount = 0;
  @Input() drawerWidth = 304;
  @Input() drawerZIndex: number | null = 140;
  @Input() drawerTopInset: number | null = null;
  @Input() drawerPanelClass = 'customize-drawer customize-drawer--tasks page-design-customize-drawer';
  drawerMode: SideDrawerMode = 'sidebar';

  @Input() set options(value: AssigneeFilterOption[] | null | undefined) {
    this.optionsState.set(value ?? []);
  }

  @Input() set selection(value: AssigneeFilterSelection | null | undefined) {
    if (!value) {
      this.selectionState.set({ kind: 'all' });
      return;
    }
    if (value.kind === 'owner' && !value.owner?.trim()) {
      this.selectionState.set({ kind: 'all' });
      return;
    }
    this.selectionState.set(value);
  }

  @Output() readonly selectionChange = new EventEmitter<AssigneeFilterSelection>();
  @Output() readonly panelOpened = new EventEmitter<void>();

  readonly searchQuery = signal('');
  readonly drawerOpen = signal(false);
  readonly drawerTop = signal(0);
  private readonly optionsState = signal<AssigneeFilterOption[]>([]);
  private readonly selectionState = signal<AssigneeFilterSelection>({ kind: 'all' });
  private triggerPointerHandled = false;
  private triggerClearPointerHandled = false;
  private windowListenersAttached = false;
  private readonly windowResizeHandler = () => this.updateDrawerMetrics();
  private readonly windowScrollHandler = () => this.updateDrawerMetrics();
  readonly filteredOptions = computed(() => {
    const query = this.searchQuery().trim().toLocaleLowerCase();
    const options = this.optionsState();
    if (!query) return options;
    return options.filter(option => option.label.toLocaleLowerCase().includes(query));
  });
  readonly peopleOptions = computed(() => this.filteredOptions());
  readonly selectionActive = computed(() => this.selectionState().kind !== 'all');
  readonly chipActive = computed(() => {
    const selection = this.selectionState();
    return selection.kind !== 'all';
  });
  readonly effectiveTriggerLabel = computed(() => {
    const selection = this.selectionState();
    if (selection.kind === 'mine') {
      return this.mineLabel;
    }
    if (selection.kind === 'unassigned') {
      return this.unassignedLabel;
    }
    if (selection.kind === 'owner') {
      return this.selectedOwnerLabel(selection.owner) || this.triggerLabel;
    }
    return this.triggerLabel;
  });
  readonly showMineRow = computed(() => this.showMine || this.isMineSelected());
  readonly showUnassignedRow = computed(
    () =>
      this.unassignedCount > 0 ||
      this.isUnassignedSelected() ||
      this.searchQuery().trim().length === 0
  );
  readonly peopleCount = computed(() => this.peopleOptions().length);

  constructor(private readonly hostRef: ElementRef<HTMLElement>) {}

  onTriggerPointerDown(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.triggerPointerHandled = true;
    this.togglePanel();
  }

  onTriggerClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.triggerPointerHandled) {
      this.triggerPointerHandled = false;
      return;
    }
    this.togglePanel();
  }

  onTriggerClearPointerDown(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.triggerClearPointerHandled = true;
    this.clearSelection();
  }

  onTriggerClearClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.triggerClearPointerHandled) {
      this.triggerClearPointerHandled = false;
      return;
    }
    this.clearSelection();
  }

  togglePanel(): void {
    if (this.drawerOpen()) {
      this.closePanel();
      return;
    }
    this.openPanel();
  }

  openPanel(): void {
    this.panelOpened.emit();
    if (this.drawerTopInset == null) {
      this.updateDrawerMetrics();
    }
    this.drawerOpen.set(true);
    if (this.drawerTopInset == null) {
      this.attachWindowListeners();
    }
  }

  closePanel(): void {
    if (!this.drawerOpen()) return;
    this.drawerOpen.set(false);
    this.searchQuery.set('');
    this.detachWindowListeners();
  }

  onDrawerModeChange(mode: SideDrawerMode): void {
    this.drawerMode = mode;
  }

  isAllSelected(): boolean {
    return this.selectionState().kind === 'all';
  }

  isMineSelected(): boolean {
    return this.selectionState().kind === 'mine';
  }

  isUnassignedSelected(): boolean {
    return this.selectionState().kind === 'unassigned';
  }

  isOwnerSelected(owner: string): boolean {
    const selection = this.selectionState();
    if (selection.kind !== 'owner') {
      return false;
    }

    const selectionKey = this.normalizeOwnerKey(selection.owner);
    const ownerKey = this.normalizeOwnerKey(owner);
    if (!selectionKey || !ownerKey) {
      return false;
    }

    if (selectionKey === ownerKey) {
      return true;
    }

    const option = this.optionsState().find(item => this.normalizeOwnerKey(item.value) === ownerKey);
    return (
      !!option &&
      (this.normalizeOwnerKey(option.label) === selectionKey ||
        this.normalizeOwnerKey(option.value) === selectionKey)
    );
  }

  selectAll(): void {
    const selection: AssigneeFilterSelection = { kind: 'all' };
    this.selectionState.set(selection);
    this.selectionChange.emit(selection);
    this.closePanel();
  }

  selectMine(): void {
    const selection: AssigneeFilterSelection = this.isMineSelected()
      ? { kind: 'all' }
      : { kind: 'mine' };
    this.selectionState.set(selection);
    this.selectionChange.emit(selection);
    this.closePanel();
  }

  selectUnassigned(): void {
    const selection: AssigneeFilterSelection = this.isUnassignedSelected()
      ? { kind: 'all' }
      : { kind: 'unassigned' };
    this.selectionState.set(selection);
    this.selectionChange.emit(selection);
    this.closePanel();
  }

  selectOwner(owner: string): void {
    const nextOwner = owner.trim();
    if (!nextOwner) {
      this.selectAll();
      return;
    }
    const selection: AssigneeFilterSelection = this.isOwnerSelected(owner)
      ? { kind: 'all' }
      : { kind: 'owner', owner: nextOwner };
    this.selectionState.set(selection);
    this.selectionChange.emit(selection);
    this.closePanel();
  }

  private clearSelection(): void {
    if (!this.selectionActive()) {
      return;
    }
    this.selectAll();
  }

  optionInitials(option: AssigneeFilterOption): string {
    if (option.initials?.trim()) return option.initials.trim();
    const parts = option.label
      .split(' ')
      .map(part => part.trim())
      .filter(Boolean)
      .slice(0, 2);
    if (!parts.length) return '?';
    return parts
      .map(part => part[0])
      .join('')
      .toUpperCase();
  }

  ngOnDestroy(): void {
    this.detachWindowListeners();
  }

  private updateDrawerMetrics(): void {
    if (this.drawerTopInset != null) {
      this.drawerTop.set(this.drawerTopInset);
      return;
    }
    const toolbar = this.hostRef.nativeElement.closest('.wsh__toolbar') as HTMLElement | null;
    const anchor = toolbar ?? this.hostRef.nativeElement;
    this.drawerTop.set(Math.max(0, Math.round(anchor.getBoundingClientRect().bottom)));
  }

  private attachWindowListeners(): void {
    if (this.windowListenersAttached || typeof window === 'undefined') return;
    this.windowListenersAttached = true;
    window.addEventListener('resize', this.windowResizeHandler, { passive: true });
    window.addEventListener('scroll', this.windowScrollHandler, { passive: true });
  }

  private detachWindowListeners(): void {
    if (!this.windowListenersAttached || typeof window === 'undefined') return;
    this.windowListenersAttached = false;
    window.removeEventListener('resize', this.windowResizeHandler);
    window.removeEventListener('scroll', this.windowScrollHandler);
  }

  private normalizeOwnerKey(value: unknown): string {
    return String(value ?? '')
      .trim()
      .toLocaleLowerCase();
  }

  private selectedOwnerLabel(owner: string): string {
    const ownerKey = this.normalizeOwnerKey(owner);
    if (!ownerKey) {
      return '';
    }

    const option = this.optionsState().find(
      item =>
        this.normalizeOwnerKey(item.value) === ownerKey ||
        this.normalizeOwnerKey(item.label) === ownerKey
    );
    return option?.label?.trim() || owner.trim();
  }
}
