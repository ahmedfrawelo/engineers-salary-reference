import { Component, EventEmitter, Input, Output } from '@angular/core';
import type {
  ReportingActiveFilterChip,
  ReportingChipFilterGroup,
  ReportingDateFilter,
  ReportingRangeFilter,
  ReportingSelectFilter,
  ReportingToggleFilter
} from '../../models/reporting.models';

@Component({
  selector: 'engineers-salary-reference-reporting-filter-panel',
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone: false,
  templateUrl: './reporting-filter-panel.component.html',
  styleUrls: ['./reporting-filter-panel.component.scss']
})
export class ReportingFilterPanelComponent {
  @Input() eyebrow = 'Filters';
  @Input() title = 'Filter report';
  @Input() description = '';
  @Input() searchValue = '';
  @Input() searchPlaceholder = 'Search';
  @Input() totalCount = 0;
  @Input() filteredCount = 0;
  @Input() selects: ReportingSelectFilter[] = [];
  @Input() dates: ReportingDateFilter[] = [];
  @Input() chipGroups: ReportingChipFilterGroup[] = [];
  @Input() toggles: ReportingToggleFilter[] = [];
  @Input() ranges: ReportingRangeFilter[] = [];
  @Input() activeChips: ReportingActiveFilterChip[] = [];

  @Output() searchChange = new EventEmitter<string>();
  @Output() selectChange = new EventEmitter<{ key: string; value: string }>();
  @Output() dateChange = new EventEmitter<{ key: string; value: string }>();
  @Output() chipToggle = new EventEmitter<{ key: string; value: string }>();
  @Output() toggleChange = new EventEmitter<{ key: string; value: boolean }>();
  @Output() rangeChange = new EventEmitter<{ key: string; value: number }>();
  @Output() chipRemove = new EventEmitter<ReportingActiveFilterChip>();
  @Output() resetFilters = new EventEmitter<void>();

  toNumber(value: string | number): number {
    return typeof value === 'number' ? value : Number(value);
  }
}
