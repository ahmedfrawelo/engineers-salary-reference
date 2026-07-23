import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { AppIconDirective } from '@shared/icons/app-icon.directive';

export interface MineQuickFilterOption {
  key: string;
  label: string;
  active: boolean;
}

@Component({
  selector: 'app-mine-quick-filter-menu',
  standalone: true,
  imports: [CommonModule, AppIconDirective],
  templateUrl: './mine-quick-filter-menu.component.html',
  styleUrls: ['./mine-quick-filter-menu.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MineQuickFilterMenuComponent {
  @Input() initials = 'A';
  @Input() tooltip = 'Filter for your tasks';
  @Input() title = 'Tasks where I have assigned';
  @Input() panelAriaLabel = 'Tasks where I have assigned';
  @Input() clearAriaLabel = 'Clear your tasks filter';
  @Input() active = false;
  @Input() open = false;
  @Input() showClear = false;
  @Input() options: MineQuickFilterOption[] = [];

  @Output() readonly triggerClick = new EventEmitter<void>();
  @Output() readonly clearClick = new EventEmitter<Event>();
  @Output() readonly optionToggle = new EventEmitter<string>();

  private triggerPointerHandled = false;

  onTriggerPointerDown(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.triggerPointerHandled = true;
    this.triggerClick.emit();
  }

  onTriggerClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.triggerPointerHandled) {
      this.triggerPointerHandled = false;
      return;
    }
    this.triggerClick.emit();
  }

  onClearClick(event: Event): void {
    this.clearClick.emit(event);
  }

  onOptionToggle(key: string): void {
    if (!key) return;
    this.optionToggle.emit(key);
  }
}
