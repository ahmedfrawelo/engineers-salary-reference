import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { EngineersSalaryBarChartComponent } from '@shared/charts/bar-chart.component';
import { EngineersSalaryBulletChartComponent } from '@shared/charts/bullet-chart.component';
import { EngineersSalaryGaugeChartComponent } from '@shared/charts/gauge-chart.component';
import { EngineersSalaryHeatmapChartComponent } from '@shared/charts/heatmap-chart.component';
import { EngineersSalarySparklineChartComponent } from '@shared/charts/sparkline-chart.component';
import { EngineersSalaryLineChartComponent } from '@shared/charts/line-chart.component';
import { EngineersSalaryPieChartComponent } from '@shared/charts/pie-chart.component';
import { EngineersSalaryRadarChartComponent } from '@shared/charts/radar-chart.component';
import { EngineersSalaryRadialBarChartComponent } from '@shared/charts/radial-bar-chart.component';
import { EngineersSalaryScatterChartComponent } from '@shared/charts/scatter-chart.component';
import { EngineersSalaryStackedBarChartComponent } from '@shared/charts/stacked-bar-chart.component';
import {
  BulletDatum,
  ChartDatum,
  GaugeDatum,
  HeatmapDatum,
  LineSeries,
  RadarSeries,
  RadialDatum,
  ScatterDatum,
  StackedSeries
} from '@shared/charts/chart-types';

type MetricTrend = 'positive' | 'neutral' | 'risk';
type PriorityTone = 'High' | 'Medium' | 'Normal';

interface EvaluationPulse {
  label: string;
  value: string;
  note: string;
  trend: MetricTrend;
}

interface CompetencyScore {
  area: string;
  score: number;
  target: number;
  delta: number;
}

interface TrendPoint {
  period: string;
  score: number;
  delivery: number;
}

interface GoalTrackItem {
  title: string;
  owner: string;
  due: string;
  progress: number;
  health: MetricTrend;
}

interface FeedbackItem {
  source: string;
  score: number;
  note: string;
}

interface ActionItem {
  title: string;
  owner: string;
  due: string;
  impact: string;
  priority: PriorityTone;
}

interface EssentialCard {
  label: string;
  value: string;
  note: string;
  tone: MetricTrend;
}

interface FocusRecommendation {
  title: string;
  reason: string;
  impact: string;
  priority: 'Priority 1' | 'Priority 2' | 'Priority 3';
}

@Component({
  standalone: true,
  selector: 'feature-account-profile-insights-tab',
  imports: [
    EngineersSalaryBarChartComponent,
    EngineersSalaryBulletChartComponent,
    EngineersSalaryGaugeChartComponent,
    EngineersSalaryHeatmapChartComponent,
    EngineersSalaryLineChartComponent,
    EngineersSalaryPieChartComponent,
    EngineersSalaryRadarChartComponent,
    EngineersSalaryRadialBarChartComponent,
    EngineersSalaryScatterChartComponent,
    EngineersSalaryStackedBarChartComponent,
    EngineersSalarySparklineChartComponent
  ],
  templateUrl: './account-profile-insights-tab.component.html',
  styleUrls: [
    '../shared/account-profile-tab-shared.scss',
    './account-profile-insights-tab.component.scss'
  ]
})
export class AccountProfileInsightsTabComponent implements OnChanges {
  @Input() evaluationPulse: EvaluationPulse[] = [];
  @Input() competencyScores: CompetencyScore[] = [];
  @Input() trendPoints: TrendPoint[] = [];
  @Input() goalTrack: GoalTrackItem[] = [];
  @Input() feedbackPulse: FeedbackItem[] = [];
  @Input() actionPlan: ActionItem[] = [];
  @Input() essentials: EssentialCard[] = [];
  @Input() focusRecommendations: FocusRecommendation[] = [];

  competencyBulletData: BulletDatum[] = [];
  competencyRadarAxes: string[] = [];
  competencyRadarSeries: RadarSeries[] = [];
  competencyDeltaData: ChartDatum[] = [];

  overallGaugeData: GaugeDatum = { label: 'Performance index', value: 0, min: 0, max: 100 };
  heroBadges: EvaluationPulse[] = [];
  trendLabels: string[] = [];
  trendSeries: LineSeries[] = [];
  feedbackSparklineValues: number[] = [];
  goalsRadialData: RadialDatum[] = [];
  goalHealthPieData: ChartDatum[] = [];
  consistencyHeatmapData: HeatmapDatum[] = [];
  impactScatterData: ScatterDatum[] = [];
  executionLabels: string[] = [];
  executionSeries: StackedSeries[] = [];

  ngOnChanges(_: SimpleChanges): void {
    this.rebuildCharts();
  }

  private rebuildCharts(): void {
    this.heroBadges = this.evaluationPulse.slice(0, 3);

    const avgTarget =
      this.competencyScores.length > 0
        ? Math.round(
            this.competencyScores.reduce((sum, item) => sum + item.target, 0) /
              this.competencyScores.length
          )
        : 0;
    const currentIndex = this.trendPoints[this.trendPoints.length - 1]?.score ?? 0;
    this.overallGaugeData = {
      label: 'Performance index',
      value: currentIndex,
      min: 0,
      max: 100,
      target: avgTarget
    };

    this.competencyBulletData = this.competencyScores.map((item, idx) => ({
      label: item.area,
      value: item.score,
      target: item.target,
      max: 100,
      color: idx % 2 === 0 ? 'rgb(16 185 129)' : 'rgb(6 182 212)'
    }));
    this.competencyRadarAxes = this.competencyScores.map(item => this.compactAxis(item.area));
    this.competencyRadarSeries = [
      {
        label: 'Current',
        values: this.competencyScores.map(item => item.score),
        color: 'rgb(16 185 129)'
      },
      {
        label: 'Target',
        values: this.competencyScores.map(item => item.target),
        color: 'rgb(59 130 246)'
      }
    ];
    this.competencyDeltaData = this.competencyScores.map(item => ({
      label: this.compactAxis(item.area),
      value: Math.abs(item.delta),
      color: item.delta >= 0 ? 'rgb(16 185 129)' : 'rgb(239 68 68)'
    }));

    this.trendLabels = this.trendPoints.map(point => point.period);
    this.trendSeries = [
      {
        label: 'Score index',
        values: this.trendPoints.map(point => point.score),
        color: 'rgb(34 197 94)',
        area: true
      },
      {
        label: 'Delivery index',
        values: this.trendPoints.map(point => point.delivery),
        color: 'rgb(6 182 212)',
        area: false
      }
    ];

    this.feedbackSparklineValues = this.feedbackPulse.map(item => item.score);

    this.goalsRadialData = this.goalTrack.map(goal => ({
      label: this.compactAxis(goal.title),
      value: goal.progress,
      max: 100,
      color:
        goal.health === 'positive'
          ? 'rgb(22 163 74)'
          : goal.health === 'risk'
            ? 'rgb(239 68 68)'
            : 'rgb(6 182 212)'
    }));

    const healthCount = { positive: 0, neutral: 0, risk: 0 };
    for (const goal of this.goalTrack) {
      healthCount[goal.health] += 1;
    }
    this.goalHealthPieData = [
      { label: 'On track', value: healthCount.positive, color: 'rgb(22 163 74)' },
      { label: 'Watch', value: healthCount.neutral, color: 'rgb(6 182 212)' },
      { label: 'Risk', value: healthCount.risk, color: 'rgb(239 68 68)' }
    ].filter(item => item.value > 0);

    this.impactScatterData = this.goalTrack.map((goal, index) => ({
      x: goal.progress,
      y:
        goal.health === 'positive'
          ? 84 + index * 2
          : goal.health === 'neutral'
            ? 72 + index * 2
            : 58 + index * 2,
      size: Math.max(5, Math.round(goal.progress / 9)),
      label: goal.title,
      color:
        goal.health === 'positive'
          ? 'rgb(22 163 74)'
          : goal.health === 'risk'
            ? 'rgb(239 68 68)'
            : 'rgb(6 182 212)'
    }));

    this.executionLabels = this.goalTrack.map(item => this.compactAxis(item.title));
    const delivered = this.goalTrack.map(item => Math.max(0, Math.round(item.progress * 0.62)));
    const inFlight = this.goalTrack.map(item => Math.max(0, Math.round(item.progress * 0.28)));
    const remaining = this.goalTrack.map((item, idx) =>
      Math.max(0, 100 - delivered[idx] - inFlight[idx] - (item.health === 'risk' ? 12 : 6))
    );
    const riskBuffer = this.goalTrack.map(item => (item.health === 'risk' ? 12 : 6));
    this.executionSeries = [
      { label: 'Delivered', values: delivered, color: 'rgb(22 163 74)' },
      { label: 'In flight', values: inFlight, color: 'rgb(6 182 212)' },
      { label: 'Risk buffer', values: riskBuffer, color: 'rgb(245 158 11)' },
      { label: 'Remaining', values: remaining, color: 'rgb(148 163 184)' }
    ];

    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const tracks = ['Delivery', 'Quality', 'Collab', 'Focus'];
    const baseline = this.trendPoints[this.trendPoints.length - 1]?.score ?? 75;
    this.consistencyHeatmapData = [];
    for (let t = 0; t < tracks.length; t += 1) {
      for (let d = 0; d < weekdays.length; d += 1) {
        const wave = ((baseline + t * 7 + d * 5) % 21) - 10;
        const value = Math.max(48, Math.min(98, baseline + wave));
        this.consistencyHeatmapData.push({
          x: weekdays[d],
          y: tracks[t],
          value
        });
      }
    }
  }

  private compactAxis(value: string): string {
    const words = value.trim().split(/\s+/);
    return words.slice(0, 2).join(' ');
  }
}
