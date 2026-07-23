import { Component, Input } from '@angular/core';
import type { ReportingMetricCard } from '../../models/reporting.models';

@Component({
  selector: 'engineers-salary-reference-reporting-kpi-panel',
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone: false,
  templateUrl: './reporting-kpi-panel.component.html',
  styleUrls: ['./reporting-kpi-panel.component.scss']
})
export class ReportingKpiPanelComponent {
  @Input() kpis: ReportingMetricCard[] = [];
}
