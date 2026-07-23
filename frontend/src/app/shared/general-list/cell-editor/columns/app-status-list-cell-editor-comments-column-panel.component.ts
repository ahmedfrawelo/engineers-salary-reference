import { Component, EventEmitter, Input, Output } from '@angular/core';

import { AppStatusListCellEditorCommentsPanelComponent } from '../panels/app-status-list-cell-editor-comments-panel.component';

@Component({
  selector: 'app-status-list-cell-editor-comments-column-panel',
  standalone: true,
  imports: [AppStatusListCellEditorCommentsPanelComponent],
  template: `
    <app-status-list-cell-editor-comments-panel
      [open]="open"
      [placeholder]="placeholder"
      (commentAdd)="commentAdd.emit($event)"
    ></app-status-list-cell-editor-comments-panel>
  `
})
export class AppStatusListCellEditorCommentsColumnPanelComponent {
  @Input() open = false;
  @Input() placeholder = "Comment or type '/' for commands and actions";

  @Output() commentAdd = new EventEmitter<string>();
}
