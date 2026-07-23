import { OverlayModule } from '@angular/cdk/overlay';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { AppIconDirective } from '@shared/icons/app-icon.directive';
import {
  SharedContextMenuComponent,
  type SharedContextMenuItem
} from '../context-menu';
import { AppTipDirective } from '../tip';

/** Menu item for icon-action combo. Prefer SharedContextMenuItem. */
export type IconActionMenuItem = SharedContextMenuItem;

/**
 * Shared icon-first action button with optional combo menu.
 * Independent of side-drawer — usable anywhere.
 * Menu opens the shared context menu.
 * Pass menuItems to show the chevron; omit/empty → plain button.
 */
@Component({
  selector: 'app-icon-action-combo',
  standalone: true,
  imports: [
    CommonModule,
    OverlayModule,
    AppIconDirective,
    SharedContextMenuComponent,
    AppTipDirective
  ],
  templateUrl: './icon-action-combo.component.html',
  styleUrl: './icon-action-combo.component.scss'
})
export class IconActionComboComponent implements OnChanges {
  @Input() icon = '';
  @Input() label = '';
  /** Optional tip override for the main action; defaults to label. */
  @Input() tip = '';
  @Input() menuTitle = '';
  @Input() wide = false;
  @Input() disabled = false;
  @Input() loading = false;
  @Input() menuItems: IconActionMenuItem[] = [];
  @Input() tone: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' = 'neutral';

  @Output() action = new EventEmitter<void>();
  @Output() menuAction = new EventEmitter<string>();

  menuOpen = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['loading']?.currentValue) {
      this.menuOpen = false;
    }
  }

  get actionTip(): string {
    return String(this.tip || this.label || '').trim();
  }

  get menuTip(): string {
    const base = String(this.label || 'Options').trim();
    return `${base} options`;
  }

  toggleMenu(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.disabled || this.loading) {
      return;
    }
    this.menuOpen = !this.menuOpen;
  }

  onMenuSelect(id: string): void {
    if (this.disabled || this.loading) {
      return;
    }
    this.menuOpen = false;
    this.menuAction.emit(id);
  }

  emitAction(): void {
    if (!this.disabled && !this.loading) {
      this.action.emit();
    }
  }
}
