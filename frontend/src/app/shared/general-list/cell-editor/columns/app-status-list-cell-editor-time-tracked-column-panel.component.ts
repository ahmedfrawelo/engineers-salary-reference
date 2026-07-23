import { Component, EventEmitter, Input, Output } from '@angular/core';

import { AppStatusListCellEditorTextPanelComponent } from '../panels/app-status-list-cell-editor-text-panel.component';

@Component({
  selector: 'app-status-list-cell-editor-time-tracked-column-panel',
  standalone: true,
  imports: [AppStatusListCellEditorTextPanelComponent],
  template: `
    <app-status-list-cell-editor-text-panel
      [open]="open"
      [value]="value"
      [placeholder]="placeholder"
      (pick)="pick.emit($event)"
    ></app-status-list-cell-editor-text-panel>
  `
})
export class AppStatusListCellEditorTimeTrackedColumnPanelComponent {
  @Input() open = false;
  @Input() value = '';
  @Input() placeholder = 'Type value...';

  @Output() pick = new EventEmitter<string>();
}
