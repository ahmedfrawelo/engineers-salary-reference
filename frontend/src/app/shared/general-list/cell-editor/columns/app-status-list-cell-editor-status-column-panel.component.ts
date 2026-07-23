import { Component, EventEmitter, Input, Output } from '@angular/core';

import { AppStatusListCellEditorOption } from '../../models/app-status-list.models';
import { AppStatusListCellEditorOptionsPanelComponent } from '../panels/app-status-list-cell-editor-options-panel.component';

@Component({
  selector: 'app-status-list-cell-editor-status-column-panel',
  standalone: true,
  imports: [AppStatusListCellEditorOptionsPanelComponent],
  template: `
    <app-status-list-cell-editor-options-panel
      [open]="open"
      [value]="value"
      [placeholder]="placeholder"
      [searchable]="searchable"
      [options]="options"
      (pick)="pick.emit($event)"
    ></app-status-list-cell-editor-options-panel>
  `
})
export class AppStatusListCellEditorStatusColumnPanelComponent {
  @Input() open = false;
  @Input() value = '';
  @Input() placeholder = 'Search...';
  @Input() searchable = true;
  @Input() options: ReadonlyArray<AppStatusListCellEditorOption> = [];

  @Output() pick = new EventEmitter<string>();
}
