import { Directive, HostListener, Input, Output, EventEmitter, ElementRef } from '@angular/core';

type LooseValue = ReturnType<typeof JSON.parse>;
/**
 * Keyboard Navigation Directive
 *
 * Adds keyboard navigation support to any component
 * Supports: Arrow keys, Enter, Escape, Tab, Home, End, Page Up/Down
 *
 * @example
 * ```html
 * <div appKeyboardNav
 *      [rowCount]="items.length"
 *      [selectedRow]="selectedIndex"
 *      (navigate)="onNavigate($event)"
 *      (activate)="onActivate($event)">
 * </div>
 * ```
 */
@Directive({
  selector: '[appKeyboardNav]',
  standalone: true
})
export class KeyboardNavDirective {
  @Input() rowCount = 0;
  @Input() selectedRow = 0;
  @Input() enableNavigation = true;
  @Input() pageSize = 10;

  @Output() navigate = new EventEmitter<number>();
  @Output() activate = new EventEmitter<number>();
  @Output() escape = new EventEmitter<void>();

  constructor(private el: ElementRef) {}

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (!this.enableNavigation) return;

    let newRow = this.selectedRow;
    let handled = false;

    switch (event.key) {
      case 'ArrowUp':
        newRow = Math.max(0, this.selectedRow - 1);
        handled = true;
        break;

      case 'ArrowDown':
        newRow = Math.min(this.rowCount - 1, this.selectedRow + 1);
        handled = true;
        break;

      case 'ArrowLeft':
        // Can be used for column navigation
        handled = true;
        break;

      case 'ArrowRight':
        // Can be used for column navigation
        handled = true;
        break;

      case 'Home':
        newRow = 0;
        handled = true;
        break;

      case 'End':
        newRow = this.rowCount - 1;
        handled = true;
        break;

      case 'PageUp':
        newRow = Math.max(0, this.selectedRow - this.pageSize);
        handled = true;
        break;

      case 'PageDown':
        newRow = Math.min(this.rowCount - 1, this.selectedRow + this.pageSize);
        handled = true;
        break;

      case 'Enter':
      case ' ':
        this.activate.emit(this.selectedRow);
        handled = true;
        break;

      case 'Escape':
        this.escape.emit();
        handled = true;
        break;
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();

      if (newRow !== this.selectedRow) {
        this.navigate.emit(newRow);
      }
    }
  }

  @HostListener('focus')
  onFocus(): void {
    // Add focus indicator
    this.el.nativeElement.classList.add('keyboard-focus');
  }

  @HostListener('blur')
  onBlur(): void {
    // Remove focus indicator
    this.el.nativeElement.classList.remove('keyboard-focus');
  }
}

/**
 * DataGrid Keyboard Navigation
 *
 * Specialized keyboard navigation for data grids
 */
@Directive({
  selector: '[appGridKeyboardNav]',
  standalone: true
})
export class GridKeyboardNavDirective {
  @Input() rows: LooseValue[] = [];
  @Input() columns: LooseValue[] = [];
  @Input() selectedRowIndex = 0;
  @Input() selectedColumnIndex = 0;

  @Output() cellSelect = new EventEmitter<{ row: number; col: number }>();
  @Output() cellActivate = new EventEmitter<{ row: number; col: number }>();

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    let newRow = this.selectedRowIndex;
    let newCol = this.selectedColumnIndex;
    let handled = false;

    switch (event.key) {
      case 'ArrowUp':
        newRow = Math.max(0, newRow - 1);
        handled = true;
        break;

      case 'ArrowDown':
        newRow = Math.min(this.rows.length - 1, newRow + 1);
        handled = true;
        break;

      case 'ArrowLeft':
        newCol = Math.max(0, newCol - 1);
        handled = true;
        break;

      case 'ArrowRight':
        newCol = Math.min(this.columns.length - 1, newCol + 1);
        handled = true;
        break;

      case 'Home':
        if (event.ctrlKey) {
          newRow = 0;
          newCol = 0;
        } else {
          newCol = 0;
        }
        handled = true;
        break;

      case 'End':
        if (event.ctrlKey) {
          newRow = this.rows.length - 1;
          newCol = this.columns.length - 1;
        } else {
          newCol = this.columns.length - 1;
        }
        handled = true;
        break;

      case 'Enter':
        this.cellActivate.emit({ row: newRow, col: newCol });
        handled = true;
        break;

      case 'Tab':
        // Move to next cell
        newCol++;
        if (newCol >= this.columns.length) {
          newCol = 0;
          newRow++;
        }
        if (newRow >= this.rows.length) {
          newRow = 0;
        }
        handled = true;
        break;
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();

      if (newRow !== this.selectedRowIndex || newCol !== this.selectedColumnIndex) {
        this.cellSelect.emit({ row: newRow, col: newCol });
      }
    }
  }
}
