import {
  CdkConnectedOverlay,
  CdkOverlayOrigin,
  OverlayModule,
  type ConnectedPosition,
  type FlexibleConnectedPositionStrategyOrigin
} from '@angular/cdk/overlay';
import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  TemplateRef,
  ViewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppIconDirective } from '@shared/icons/app-icon.directive';
import type {
  SharedContextMenuItem,
  SharedContextMenuPlacement
} from './models/context-menu.models';

function filterSharedContextMenuItems(
  items: SharedContextMenuItem[],
  queryRaw: string
): SharedContextMenuItem[] {
  const query = queryRaw.trim().toLowerCase();
  if (!query) {
    return items;
  }
  return items.filter(item => {
    if (item.separator) {
      return false;
    }
    const haystack = [item.label, item.badge, item.hint].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(query);
  });
}

export type SharedContextMenuOrigin =
  | CdkOverlayOrigin
  | FlexibleConnectedPositionStrategyOrigin
  | ElementRef<HTMLElement>
  | HTMLElement;

/**
 * Shared context / action menu.
 * Open from a pointer position (right-click / click) or anchored to a trigger (combo dropdown).
 */
@Component({
  selector: 'app-shared-context-menu',
  standalone: true,
  imports: [CommonModule, FormsModule, OverlayModule, AppIconDirective],
  templateUrl: './shared-context-menu.component.html',
  styleUrl: './shared-context-menu.component.scss'
})
export class SharedContextMenuComponent implements OnChanges {
  @Input() open = false;
  @Input() placement: SharedContextMenuPlacement = 'pointer';
  @Input() x = 0;
  @Input() y = 0;
  @Input() origin: SharedContextMenuOrigin | null = null;
  @Input() items: SharedContextMenuItem[] = [];
  /** Optional second list rendered after middle content (e.g. Delete). */
  @Input() footerItems: SharedContextMenuItem[] = [];
  @Input() title = '';
  @Input() subtitle = '';
  /** Marks the currently chosen option (radio/filter style) with a trailing check. */
  @Input() selectedItemId: string | null = null;
  /** Show trailing check on the selected row. Off for search-select dropdowns. */
  @Input() showSelectedCheck = true;
  /** Wider panel for rich middle content (tags / forms). */
  @Input() rich = false;
  /** Root-level search field (select-style menus, e.g. Compare version). */
  @Input() searchable = false;
  @Input() searchPlaceholder = 'Search…';
  /**
   * Full-screen blocker for action menus. Keep false for select dropdowns so
   * the rest of the app (e.g. sidebar) stays clickable.
   */
  @Input() hasBackdrop = true;
  /** Stretch panel to this width (px), e.g. search-select trigger width. */
  @Input() panelWidth: number | null = null;
  /** Extra classes on the panel (and CDK pane when anchored). */
  @Input() panelClass: string | string[] | null = null;
  /** Prefer left-aligned under the trigger (select dropdowns). */
  @Input() preferStart = false;
  /** Optional block between main items and footer (e.g. Service Items tags). */
  @Input() middleTemplate: TemplateRef<unknown> | null = null;
  @Input() footerTemplate: TemplateRef<unknown> | null = null;

  @Output() openChange = new EventEmitter<boolean>();
  @Output() closed = new EventEmitter<void>();
  @Output() itemSelect = new EventEmitter<string>();

  @ViewChild('panel') private panelRef?: ElementRef<HTMLElement>;
  @ViewChild(CdkConnectedOverlay) private rootOverlay?: CdkConnectedOverlay;
  @ViewChild('rootSearchInput') private rootSearchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('submenuSearchInput') private submenuSearchInput?: ElementRef<HTMLInputElement>;

  openSubmenuId: string | null = null;
  submenuOrigin: HTMLElement | null = null;
  submenuQuery = '';
  rootQuery = '';
  activeItemId: string | null = null;
  pointerPosition = { x: 0, y: 0 };

  readonly anchorPositions: ConnectedPosition[] = [
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 },
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 }
  ];

  readonly startAnchorPositions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 }
  ];

  /** Point origins must not use logical start/end: RTL would mirror the menu away from the cursor. */
  readonly pointAnchorPositions: ConnectedPosition[] = [
    // A context menu must start just below/right of the actual pointer.  Using
    // center/center makes the panel appear displaced from the row that was
    // clicked, especially when the panel is tall.
    {
      originX: 'start',
      originY: 'top',
      overlayX: 'start',
      overlayY: 'top',
      offsetX: 4,
      offsetY: 4
    },
    {
      originX: 'end',
      originY: 'bottom',
      overlayX: 'end',
      overlayY: 'bottom',
      offsetX: -4,
      offsetY: -4
    }
  ];

  /** The child surface is a sibling overlay, never a descendant of the root menu. */
  readonly submenuPositions: ConnectedPosition[] = [
    { originX: 'end', originY: 'top', overlayX: 'start', overlayY: 'top', offsetX: 6 },
    { originX: 'start', originY: 'top', overlayX: 'end', overlayY: 'top', offsetX: -6 },
    { originX: 'end', originY: 'bottom', overlayX: 'start', overlayY: 'bottom', offsetX: 6 },
    { originX: 'start', originY: 'bottom', overlayX: 'end', overlayY: 'bottom', offsetX: -6 }
  ];

  get resolvedAnchorPositions(): ConnectedPosition[] {
    if (this.placement === 'pointer') {
      return this.pointAnchorPositions;
    }
    const origin = this.origin;
    if (origin && !(origin instanceof CdkOverlayOrigin) && 'x' in origin && 'y' in origin) {
      return this.pointAnchorPositions;
    }
    return this.preferStart ? this.startAnchorPositions : this.anchorPositions;
  }

  get resolvedPanelWidth(): number | null {
    const width = Number(this.panelWidth);
    return Number.isFinite(width) && width > 0 ? Math.round(width) : null;
  }

  /** CDK overlay width inputs reject `undefined` under strict templates. */
  get overlayPanelSize(): number | string {
    return this.resolvedPanelWidth ?? '';
  }

  get overlayPanelClasses(): string[] {
    const classes = ['scm-overlay-pane'];
    const extra = this.panelClass;
    if (!extra) {
      return classes;
    }
    if (Array.isArray(extra)) {
      for (const item of extra) {
        const value = String(item || '').trim();
        if (value) {
          classes.push(value);
        }
      }
      return classes;
    }
    const value = String(extra).trim();
    if (value) {
      classes.push(value);
    }
    return classes;
  }

  get panelHostClasses(): Record<string, boolean> {
    const classes: Record<string, boolean> = {
      'scm-panel--rich': this.rich,
      'scm-panel--anchored': true,
      'scm-panel--sized': this.resolvedPanelWidth != null
    };
    for (const name of this.overlayPanelClasses) {
      if (name !== 'scm-overlay-pane') {
        classes[name] = true;
      }
    }
    return classes;
  }

  get connectedOrigin(): CdkOverlayOrigin | FlexibleConnectedPositionStrategyOrigin | null {
    if (this.placement === 'pointer') {
      return this.pointerPosition;
    }
    const origin = this.origin;
    if (!origin) {
      return null;
    }
    if (origin instanceof CdkOverlayOrigin) {
      return origin;
    }
    return origin as FlexibleConnectedPositionStrategyOrigin;
  }

  get openSubmenuParent(): SharedContextMenuItem | null {
    if (!this.openSubmenuId) {
      return null;
    }
    return (
      this.items.find(item => item.id === this.openSubmenuId && !!item.children?.length) || null
    );
  }

  get filteredItems(): SharedContextMenuItem[] {
    return filterSharedContextMenuItems(this.items, this.rootQuery);
  }

  get filteredSubmenuChildren(): SharedContextMenuItem[] {
    const parent = this.openSubmenuParent;
    const children = parent?.children ?? [];
    return filterSharedContextMenuItems(children, this.submenuQuery);
  }

  private get actionableFlatIds(): string[] {
    const ids: string[] = [];
    for (const item of this.filteredItems) {
      if (item.separator || item.disabled) {
        continue;
      }
      ids.push(item.id);
    }
    if (this.openSubmenuParent) {
      for (const child of this.filteredSubmenuChildren) {
        if (!child.disabled) {
          ids.push(child.id);
        }
      }
    }
    for (const item of this.footerItems) {
      if (item.separator || item.disabled) {
        continue;
      }
      ids.push(item.id);
    }
    return ids;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.placement === 'pointer' && (changes['open'] || changes['x'] || changes['y'])) {
      // CDK calculates fallbacks and viewport push before its first paint.
      // Do not correct the point after render: that creates a visible jump.
      const retargeted = !!changes['x'] || !!changes['y'];
      this.pointerPosition.x = this.x;
      this.pointerPosition.y = this.y;
      if (retargeted && this.open) {
        this.closeSubmenu();
        this.activeItemId = null;
        queueMicrotask(() => this.rootOverlay?.overlayRef?.updatePosition());
      }
    }
    if (changes['open'] && this.open) {
      // Don't pre-highlight an item — hover/keyboard sets activeItemId.
      this.activeItemId = null;
      queueMicrotask(() => {
        if (this.searchable) {
          this.rootSearchInput?.nativeElement?.focus({ preventScroll: true });
          return;
        }
        this.panelRef?.nativeElement?.focus({ preventScroll: true });
      });
    }
    if (changes['open'] && !this.open) {
      this.resetTransientState();
    }
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.open) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (target?.closest?.('.scm-search')) {
      // Search inputs handle Escape / arrows / Enter via onSearchKeydown.
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      if (this.openSubmenuId) {
        this.closeSubmenu();
        return;
      }
      this.close();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.moveActive(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }

    if (event.key === 'ArrowRight') {
      const item = this.filteredItems.find(row => row.id === this.activeItemId);
      if (item?.children?.length && !item.disabled) {
        event.preventDefault();
        this.openSubmenu(item.id);
        const firstChild = this.filteredSubmenuChildren.find(child => !child.disabled);
        this.activeItemId = firstChild?.id ?? item.id;
      }
      return;
    }

    if (event.key === 'ArrowLeft') {
      if (this.openSubmenuId) {
        event.preventDefault();
        const parentId = this.openSubmenuId;
        this.closeSubmenu();
        this.activeItemId = parentId;
      }
      return;
    }

    if (event.key === 'Enter') {
      const activeId = this.activeItemId;
      if (!activeId) {
        return;
      }
      event.preventDefault();
      const parent = this.filteredItems.find(item => item.id === activeId);
      if (parent?.children?.length) {
        this.openSubmenu(parent.id);
        const firstChild = this.filteredSubmenuChildren.find(child => !child.disabled);
        this.activeItemId = firstChild?.id ?? parent.id;
        return;
      }
      const child = this.openSubmenuParent?.children?.find(item => item.id === activeId);
      const footer = this.footerItems.find(item => item.id === activeId);
      const targetItem = parent || child || footer;
      if (targetItem) {
        this.select(targetItem);
      }
    }
  }

  openSubmenu(id: string, anchorEl?: HTMLElement | null): void {
    const parent =
      this.filteredItems.find(item => item.id === id) || this.items.find(item => item.id === id);
    if (!parent?.children?.length || parent.disabled) {
      return;
    }
    this.openSubmenuId = id;
    this.submenuOrigin = anchorEl ?? null;
    this.submenuQuery = '';
    if (parent.searchable) {
      queueMicrotask(() => this.submenuSearchInput?.nativeElement?.focus({ preventScroll: true }));
    }
  }

  closeSubmenu(): void {
    this.openSubmenuId = null;
    this.submenuOrigin = null;
    this.submenuQuery = '';
  }

  onSubmenuParentClick(id: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement | null;
    if (this.openSubmenuId === id) {
      this.closeSubmenu();
      return;
    }
    this.openSubmenu(id, target);
    this.activeItemId = id;
  }

  onItemMouseEnter(item: SharedContextMenuItem, event: Event): void {
    if (item.separator || item.disabled) {
      return;
    }
    this.activeItemId = item.id;
    if (item.children?.length) {
      this.openSubmenu(item.id, event.currentTarget as HTMLElement | null);
      return;
    }
    this.closeSubmenu();
  }

  onSubmenuChildMouseEnter(child: SharedContextMenuItem): void {
    if (!child.disabled) {
      this.activeItemId = child.id;
    }
  }

  onPanelMouseLeave(): void {
    if (!this.openSubmenuId) {
      this.activeItemId = null;
    }
  }

  onSubmenuQueryChange(value: string): void {
    this.submenuQuery = value;
    const first = this.filteredSubmenuChildren.find(child => !child.disabled);
    this.activeItemId = first?.id ?? this.openSubmenuId;
  }

  onRootQueryChange(value: string): void {
    this.rootQuery = value;
    this.closeSubmenu();
    // Prepare keyboard target only; do not visually hover until mouse/arrows.
    const first = this.filteredItems.find(item => !item.separator && !item.disabled);
    this.activeItemId = first?.id ?? null;
  }

  onSearchKeydown(event: KeyboardEvent): void {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      if (this.openSubmenuId) {
        this.closeSubmenu();
        return;
      }
      this.close();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.moveActive(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Enter') {
      const activeId = this.activeItemId;
      if (!activeId) {
        return;
      }
      event.preventDefault();
      const parent = this.filteredItems.find(item => item.id === activeId);
      const child = this.filteredSubmenuChildren.find(item => item.id === activeId);
      const footer = this.footerItems.find(item => item.id === activeId);
      const targetItem = parent || child || footer;
      if (targetItem && !targetItem.children?.length) {
        this.select(targetItem);
      }
    }
  }

  select(item: SharedContextMenuItem): void {
    if (item.disabled || item.separator || item.children?.length) {
      return;
    }
    this.itemSelect.emit(item.id);
    this.close();
  }

  close(): void {
    if (!this.open) {
      return;
    }
    this.resetTransientState();
    this.openChange.emit(false);
    this.closed.emit();
  }

  trackItem(_index: number, item: SharedContextMenuItem): string {
    return item.id;
  }

  /** Exposed for callers that need to measure / focus the open panel. */
  get panelElement(): HTMLElement | null {
    return this.panelRef?.nativeElement ?? null;
  }

  focusPanel(): void {
    this.panelRef?.nativeElement?.focus({ preventScroll: true });
  }

  private moveActive(delta: number): void {
    const ids = this.actionableFlatIds;
    if (!ids.length) {
      return;
    }
    const current = this.activeItemId ? ids.indexOf(this.activeItemId) : -1;
    const next = current < 0 ? 0 : (current + delta + ids.length) % ids.length;
    this.activeItemId = ids[next] ?? null;
  }

  private resetTransientState(): void {
    this.closeSubmenu();
    this.rootQuery = '';
    this.activeItemId = null;
  }
}
