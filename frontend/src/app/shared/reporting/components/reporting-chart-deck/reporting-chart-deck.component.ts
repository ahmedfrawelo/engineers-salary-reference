import { Component, Input } from '@angular/core';
import { ReportingChartCard } from '../../models/reporting.models';

@Component({
  selector: 'engineers-salary-reference-reporting-chart-deck',
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone: false,
  templateUrl: './reporting-chart-deck.component.html',
  styleUrls: ['./reporting-chart-deck.component.scss']
})
export class ReportingChartDeckComponent {
  @Input({ required: true }) charts: ReportingChartCard[] = [];
}
