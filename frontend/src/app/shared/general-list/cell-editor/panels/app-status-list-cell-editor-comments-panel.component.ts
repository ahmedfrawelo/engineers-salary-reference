import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppIconDirective } from '@shared/icons/app-icon.directive';

@Component({
  selector: 'app-status-list-cell-editor-comments-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, AppIconDirective],
  templateUrl: './app-status-list-cell-editor-comments-panel.component.html',
  styleUrls: ['./app-status-list-cell-editor-comments-panel.component.scss']
})
export class AppStatusListCellEditorCommentsPanelComponent implements OnChanges {
  @Input() open = false;
  @Input() placeholder = 'Comment or type / for commands and actions';

  @Output() commentAdd = new EventEmitter<string>();

  commentDraft = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue) {
      this.commentDraft = '';
    }
  }

  submitComment(): void {
    const comment = this.commentDraft.trim();
    if (!comment) return;
    this.commentAdd.emit(comment);
    this.commentDraft = '';
  }
}
