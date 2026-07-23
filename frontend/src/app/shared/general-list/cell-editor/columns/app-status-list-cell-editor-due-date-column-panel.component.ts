import { Component, EventEmitter, Input, Output } from '@angular/core';

import { AppStatusListCellEditorDatePanelComponent } from '../panels/app-status-list-cell-editor-date-panel.component';

@Component({
  selector: 'app-status-list-cell-editor-due-date-column-panel',
  standalone: true,
  imports: [AppStatusListCellEditorDatePanelComponent],
  template: `
    <app-status-list-cell-editor-date-panel
      [open]="open"
      [value]="value"
      (pick)="pick.emit($event)"
    ></app-status-list-cell-editor-date-panel>
  `
})
export class AppStatusListCellEditorDueDateColumnPanelComponent {
  @Input() open = false;
  @Input() value = '';

  @Output() pick = new EventEmitter<string>();
}
