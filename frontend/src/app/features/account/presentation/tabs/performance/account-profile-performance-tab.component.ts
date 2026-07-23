import { Component, Input } from '@angular/core';

type MetricTrend = 'positive' | 'neutral' | 'risk';

interface QuickSignal {
  label: string;
  value: string;
  caption: string;
}

interface InitiativeItem {
  name: string;
  summary: string;
  owner: string;
  due: string;
  progress: number;
  health: MetricTrend;
}

interface KeyMetric {
  label: string;
  value: string;
  caption: string;
  trend: MetricTrend;
  score: number;
}

@Component({
  standalone: true,
  selector: 'feature-account-profile-performance-tab',
  imports: [],
  templateUrl: './account-profile-performance-tab.component.html',
  styleUrls: ['../shared/account-profile-tab-shared.scss']
})
export class AccountProfilePerformanceTabComponent {
  @Input() quickSignals: QuickSignal[] = [];
  @Input() initiatives: InitiativeItem[] = [];
  @Input() keyMetrics: KeyMetric[] = [];
}
