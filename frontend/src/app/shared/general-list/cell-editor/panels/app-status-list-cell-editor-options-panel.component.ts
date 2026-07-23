import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppIconDirective } from '@shared/icons/app-icon.directive';

import { AppStatusListCellEditorOption } from '../../models/app-status-list.models';

type CellEditorOptionSection = {
  key: string;
  options: AppStatusListCellEditorOption[];
};

@Component({
  selector: 'app-status-list-cell-editor-options-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, AppIconDirective],
  templateUrl: './app-status-list-cell-editor-options-panel.component.html',
  styleUrls: ['./app-status-list-cell-editor-options-panel.component.scss']
})
export class AppStatusListCellEditorOptionsPanelComponent implements OnChanges {
  @Input() open = false;
  @Input() value = '';
  @Input() placeholder = 'Search...';
  @Input() searchable = true;
  @Input() options: ReadonlyArray<AppStatusListCellEditorOption> = [];

  @Output() pick = new EventEmitter<string>();

  searchTerm = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue) {
      this.searchTerm = '';
    }
  }

  visibleOptions(): AppStatusListCellEditorOption[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return [...this.options];
    return this.options.filter(option => {
      const haystack = `${option.label} ${option.meta ?? ''} ${option.section ?? ''}`.toLowerCase();
      return haystack.includes(term);
    });
  }

  optionSections(): CellEditorOptionSection[] {
    const sections = new Map<string, AppStatusListCellEditorOption[]>();
    for (const option of this.visibleOptions()) {
      const key = option.section?.trim() ?? '';
      const bucket = sections.get(key) ?? [];
      bucket.push(option);
      sections.set(key, bucket);
    }
    return Array.from(sections.entries()).map(([key, options]) => ({ key, options }));
  }

  isOptionActive(option: AppStatusListCellEditorOption): boolean {
    return option.value === this.value;
  }

  onPick(value: string): void {
    this.pick.emit(value);
  }

  trackOption(_index: number, option: AppStatusListCellEditorOption): string {
    return `${option.value}-${option.label}`;
  }

  trackSection(_index: number, section: CellEditorOptionSection): string {
    return section.key || 'default';
  }
}
