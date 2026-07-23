import { OverlayModule } from '@angular/cdk/overlay';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostBinding, Input, Output } from '@angular/core';
import {
  SharedContextMenuComponent,
  type SharedContextMenuItem
} from '../context-menu';
import { AppTipDirective } from '../tip';

export type SideDrawerMenuItem = SharedContextMenuItem;

/**
 * Default side-drawer dropdown / filter menu.
 * Always opens the shared context menu — use this instead of custom popovers
 * inside `app-side-drawer` (toolbar filters, header menus, etc.).
 */
@Component({
  selector: 'app-side-drawer-menu',
  standalone: true,
  imports: [CommonModule, OverlayModule, SharedContextMenuComponent, AppTipDirective],
  templateUrl: './side-drawer-menu.component.html',
  styleUrl: './side-drawer-menu.component.scss'
})
export class SideDrawerMenuComponent {
  @Input() title = '';
  @Input() items: SideDrawerMenuItem[] = [];
  @Input() footerItems: SideDrawerMenuItem[] = [];
  @Input() selectedItemId: string | null = null;
  @Input() searchable = false;
  @Input() searchPlaceholder = 'Search…';
  @Input() disabled = false;
  @Input() open = false;
  @Input() triggerAriaLabel = 'Open menu';
  @Input() triggerTitle = '';
  /** Optional tip override; defaults to triggerTitle || triggerAriaLabel. */
  @Input() tip = '';
  /** Optional host class for the trigger button (e.g. mc-tree-search-tool). */
  @Input() triggerClass = '';
  @Input() triggerActive = false;
  /** `icon` = toolbar glyph; `field` = full-width select-like trigger. */
  @Input() triggerVariant: 'icon' | 'field' = 'icon';

  @HostBinding('class.side-drawer-menu-host--field')
  get hostField(): boolean {
    return this.triggerVariant === 'field';
  }

  get triggerTip(): string {
    return String(this.tip || this.triggerTitle || this.triggerAriaLabel || '').trim();
  }

  @Output() openChange = new EventEmitter<boolean>();
  @Output() itemSelect = new EventEmitter<string>();

  toggleMenu(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.disabled) {
      return;
    }
    this.setOpen(!this.open);
  }

  setOpen(next: boolean): void {
    if (this.open === next) {
      return;
    }
    this.open = next;
    this.openChange.emit(next);
  }

  onMenuSelect(id: string): void {
    this.setOpen(false);
    this.itemSelect.emit(id);
  }
}
