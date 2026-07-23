import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-status-list-cell-editor-date-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app-status-list-cell-editor-date-panel.component.html',
  styleUrls: ['./app-status-list-cell-editor-date-panel.component.scss']
})
export class AppStatusListCellEditorDatePanelComponent implements OnChanges {
  @Input() open = false;
  @Input() value = '';

  @Output() pick = new EventEmitter<string>();

  draftValue = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] || changes['open']?.currentValue) {
      this.draftValue = this.value || '';
    }
  }

  applyDraft(): void {
    this.pick.emit(this.draftValue);
  }

  clearDraft(): void {
    this.pick.emit('');
  }
}
