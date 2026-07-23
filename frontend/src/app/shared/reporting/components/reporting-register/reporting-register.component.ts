import { Component, EventEmitter, Input, Output } from '@angular/core';
import type {
  ReportingRegisterAction,
  ReportingRegisterColumn,
  ReportingRegisterRow,
  ReportingRegisterSortState,
  ReportingRegisterSummaryChip,
  ReportingRegisterViewMode
} from '../../models/reporting.models';

@Component({
  selector: 'engineers-salary-reference-reporting-register',
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone: false,
  templateUrl: './reporting-register.component.html',
  styleUrls: ['./reporting-register.component.scss']
})
export class ReportingRegisterComponent {
  @Input() eyebrow = 'Register';
  @Input() title = 'Reporting register';
  @Input() description = '';
  @Input() emptyTitle = 'No reports found';
  @Input() emptyDescription = 'Change the filters or clear the search to bring rows back.';
  @Input() loading = false;
  @Input() loadingLabel = 'Loading reports';
  @Input() errorMessage = '';
  @Input() rows: ReportingRegisterRow[] = [];
  @Input() columns: ReportingRegisterColumn[] = [];
  @Input() summary: ReportingRegisterSummaryChip[] = [];
  @Input() actions: ReportingRegisterAction[] = [];
  @Input() sortState: ReportingRegisterSortState | null = null;
  @Input() viewMode: ReportingRegisterViewMode = 'table';

  @Output() sortChange = new EventEmitter<string>();
  @Output() viewModeChange = new EventEmitter<ReportingRegisterViewMode>();
  @Output() action = new EventEmitter<{ action: string; row: ReportingRegisterRow }>();

  sortIcon(column: ReportingRegisterColumn): string {
    if (!this.sortState || this.sortState.key !== column.key) return 'arrow-down-up';
    return this.sortState.direction === 'asc' ? 'arrow-up' : 'arrow-down';
  }

  cellValue(row: ReportingRegisterRow, column: ReportingRegisterColumn): string | number {
    return row.cells[column.key] ?? '';
  }

  skeletonColumns(): unknown[] {
    return Array.from({ length: Math.max(4, Math.min(this.columns.length + 1, 8)) });
  }

  skeletonRows(): unknown[] {
    return Array.from({ length: 5 });
  }

  actionIcon(action: ReportingRegisterAction, row: ReportingRegisterRow): string {
    return action.key === 'star' && row.starred ? 'star-fill' : action.icon;
  }

  actionLabel(action: ReportingRegisterAction, row: ReportingRegisterRow): string {
    if (action.key === 'star') {
      return row.starred ? 'Unstar' : 'Star';
    }

    return action.label;
  }
}
