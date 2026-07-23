import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AppIconDirective } from '@shared/icons/app-icon.directive';

import {
  AppStatusListCellEditorOption,
  AppStatusListCellEditorType,
  AppStatusListColumnKey
} from '../models/app-status-list.models';
import { AppStatusListCellEditorAssignedCommentsColumnPanelComponent } from './columns/app-status-list-cell-editor-assigned-comments-column-panel.component';
import { AppStatusListCellEditorAssigneeColumnPanelComponent } from './columns/app-status-list-cell-editor-assignee-column-panel.component';
import { AppStatusListCellEditorCommentsColumnPanelComponent } from './columns/app-status-list-cell-editor-comments-column-panel.component';
import { AppStatusListCellEditorDependenciesColumnPanelComponent } from './columns/app-status-list-cell-editor-dependencies-column-panel.component';
import { AppStatusListCellEditorDueDateColumnPanelComponent } from './columns/app-status-list-cell-editor-due-date-column-panel.component';
import { AppStatusListCellEditorLinkedDocsColumnPanelComponent } from './columns/app-status-list-cell-editor-linked-docs-column-panel.component';
import { AppStatusListCellEditorLinkedTasksColumnPanelComponent } from './columns/app-status-list-cell-editor-linked-tasks-column-panel.component';
import { AppStatusListCellEditorListsColumnPanelComponent } from './columns/app-status-list-cell-editor-lists-column-panel.component';
import { AppStatusListCellEditorPriorityColumnPanelComponent } from './columns/app-status-list-cell-editor-priority-column-panel.component';
import { AppStatusListCellEditorStartDateColumnPanelComponent } from './columns/app-status-list-cell-editor-start-date-column-panel.component';
import { AppStatusListCellEditorStatusColumnPanelComponent } from './columns/app-status-list-cell-editor-status-column-panel.component';
import { AppStatusListCellEditorTaskTypeColumnPanelComponent } from './columns/app-status-list-cell-editor-task-type-column-panel.component';
import { AppStatusListCellEditorTimeEstimateColumnPanelComponent } from './columns/app-status-list-cell-editor-time-estimate-column-panel.component';
import { AppStatusListCellEditorTimeTrackedColumnPanelComponent } from './columns/app-status-list-cell-editor-time-tracked-column-panel.component';
import { AppStatusListCellEditorCommentsPanelComponent } from './panels/app-status-list-cell-editor-comments-panel.component';
import { AppStatusListCellEditorDatePanelComponent } from './panels/app-status-list-cell-editor-date-panel.component';
import { AppStatusListCellEditorOptionsPanelComponent } from './panels/app-status-list-cell-editor-options-panel.component';
import { AppStatusListCellEditorTextPanelComponent } from './panels/app-status-list-cell-editor-text-panel.component';

@Component({
  selector: 'app-status-list-cell-editor-popover',
  standalone: true,
  imports: [
    CommonModule,
    AppStatusListCellEditorStatusColumnPanelComponent,
    AppStatusListCellEditorPriorityColumnPanelComponent,
    AppStatusListCellEditorAssigneeColumnPanelComponent,
    AppStatusListCellEditorDueDateColumnPanelComponent,
    AppStatusListCellEditorCommentsColumnPanelComponent,
    AppStatusListCellEditorAssignedCommentsColumnPanelComponent,
    AppStatusListCellEditorListsColumnPanelComponent,
    AppStatusListCellEditorTaskTypeColumnPanelComponent,
    AppStatusListCellEditorStartDateColumnPanelComponent,
    AppStatusListCellEditorLinkedTasksColumnPanelComponent,
    AppStatusListCellEditorDependenciesColumnPanelComponent,
    AppStatusListCellEditorLinkedDocsColumnPanelComponent,
    AppStatusListCellEditorTimeEstimateColumnPanelComponent,
    AppStatusListCellEditorTimeTrackedColumnPanelComponent,
    AppStatusListCellEditorOptionsPanelComponent,
    AppStatusListCellEditorDatePanelComponent,
    AppStatusListCellEditorTextPanelComponent,
    AppStatusListCellEditorCommentsPanelComponent,
    AppIconDirective
  ],
  templateUrl: './app-status-list-cell-editor-popover.component.html',
  styleUrls: ['./app-status-list-cell-editor-popover.component.scss']
})
export class AppStatusListCellEditorPopoverComponent {
  @Input() open = false;
  @Input() top = 0;
  @Input() left = 0;
  @Input() width = 280;
  @Input() title = 'Edit';
  @Input() column: AppStatusListColumnKey | null = null;
  @Input() type: AppStatusListCellEditorType = 'text';
  @Input() value = '';
  @Input() placeholder = 'Search...';
  @Input() options: ReadonlyArray<AppStatusListCellEditorOption> = [];
  @Input() searchable = true;

  @Output() pick = new EventEmitter<string>();
  @Output() commentAdd = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();

  close(): void {
    this.closed.emit();
  }
}
