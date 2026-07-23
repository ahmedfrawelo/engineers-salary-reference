import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  ViewEncapsulation
} from '@angular/core';
import { AppIconDirective } from '@shared/icons/app-icon.directive';
import { SideDrawerComponent, type SideDrawerMode } from '@shared/ui/side-drawer';

export type SharedCustomizePanelActionMenuItem = {
  id: string;
  label: string;
  icon?: string;
};

@Component({
  selector: 'engineers-salary-reference-shared-customize-panel',
  standalone: true,
  imports: [CommonModule, AppIconDirective, SideDrawerComponent],
  encapsulation: ViewEncapsulation.None,
  host: {
    style: 'display: contents;'
  },
  templateUrl: './shared-customize-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SharedCustomizePanelComponent {
  @Input() open = false;
  /** Matches the compact reference drawer while keeping the shared shell responsive. */
  @Input() width = 300;
  @Input() zIndex: number | null = null;
  @Input() topInset: number | null = null;
  @Input() ignoreOutsideSelectors = '';
  @Input() panelClass = 'customize-drawer customize-drawer--tasks page-design-customize-drawer';
  @Input() title = 'Customize view';
  @Input() showDefaultContent = true;
  @Input() actionIcon = '';
  @Input() actionLabel = '';
  @Input() actionDisabled = false;
  @Input() actionMenuItems: SharedCustomizePanelActionMenuItem[] = [];
  drawerMode: SideDrawerMode = 'sidebar';

  @Input() viewLabel = 'List';
  @Input() viewIcon = 'list-task';
  @Input() fieldsSummary = '0 shown';
  @Input() filterSummary = 'None';
  @Input() groupSummary = 'None';

  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly action = new EventEmitter<void>();
  @Output() readonly actionMenu = new EventEmitter<string>();
  @Output() readonly openFields = new EventEmitter<void>();
  @Output() readonly openFilters = new EventEmitter<void>();
  @Output() readonly openGroup = new EventEmitter<void>();

  onDrawerModeChange(mode: SideDrawerMode): void {
    this.drawerMode = mode;
  }
}
