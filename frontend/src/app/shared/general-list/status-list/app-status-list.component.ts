import { CommonModule } from '@angular/common';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { OverlayModule } from '@angular/cdk/overlay';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { Component } from '@angular/core';
import { AppIconDirective } from '@shared/icons/app-icon.directive';

import { AppStatusListCellEditorPopoverComponent } from '../cell-editor/app-status-list-cell-editor-popover.component';
import { AppGroupComposerComponent } from '../group-composer/app-group-composer.component';
import { AppStatusListLogicBase } from './app-status-list.logic';

@Component({
  selector: 'app-status-list',
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule,
    OverlayModule,
    ScrollingModule,
    AppIconDirective,
    AppStatusListCellEditorPopoverComponent,
    AppGroupComposerComponent
  ],
  templateUrl: './app-status-list.component.html',
  styleUrls: ['./app-status-list.component.scss']
})
export class AppStatusListComponent<TPayload = unknown> extends AppStatusListLogicBase<TPayload> {}
