import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { AppIconDirective } from '@shared/icons/app-icon.directive';
import { DateInputComponent } from '@shared/ui/date-input.component';
import { SearchSelectComponent } from '@shared/ui/search-select.component';
import { DataGridComponent } from '../component';
import {
  ColumnMenuComponent,
  ColumnVisibilityPanelComponent,
  FilterMenuComponent,
  GridCalculateFooterComponent,
  GridSelectionActionBarComponent,
  GridSkeletonLoaderComponent
} from '../components';
import { RenderCellDirective } from '../renderers';

@NgModule({
  declarations: [
    DataGridComponent,
    FilterMenuComponent,
    ColumnMenuComponent,
    ColumnVisibilityPanelComponent,
    GridSkeletonLoaderComponent,
    GridCalculateFooterComponent,
    GridSelectionActionBarComponent,
    RenderCellDirective
  ],
  imports: [
    CommonModule,
    FormsModule,
    ScrollingModule,
    AppIconDirective,
    HugeiconsIconComponent,
    DateInputComponent,
    SearchSelectComponent
  ],
  exports: [
    DataGridComponent,
    FilterMenuComponent,
    ColumnMenuComponent,
    ColumnVisibilityPanelComponent,
    GridSkeletonLoaderComponent,
    GridCalculateFooterComponent,
    GridSelectionActionBarComponent,
    RenderCellDirective
  ]
})
export class DataGridModule {}
