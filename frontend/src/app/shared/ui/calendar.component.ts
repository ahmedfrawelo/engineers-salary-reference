import { DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppIconDirective } from '@shared/icons/app-icon.directive';
import { DataGridModule } from '../data-grid';
import { CalendarComponentPresenter } from './calendar.component.presenter';
import { OverlayPanelComponent } from './overlay-panel.component';

export type {
  CalendarEvent,
  CalendarEventChange,
  CalendarEventRecurrence,
  CalendarFilterPreset,
  CalendarHoliday,
  CalendarLegendItem,
  CalendarPolicyConfig,
  CalendarResource,
  CalendarSidePanelId,
  CalendarSidePanelPosition,
  CalendarTemplate,
  CalendarView
} from './calendar.models';

@Component({
  selector: 'engineers-salary-reference-calendar',
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    DataGridModule,
    OverlayPanelComponent,
    AppIconDirective
  ],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent extends CalendarComponentPresenter {}
