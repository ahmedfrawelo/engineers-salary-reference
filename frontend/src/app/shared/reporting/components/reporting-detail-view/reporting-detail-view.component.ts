import { Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import {
  ReportingDetailBoardItem,
  ReportingDetailExecutiveCard,
  ReportingDetailPageDefinition,
  ReportingFilterGroup,
  ReportingTone
} from '../../models/reporting.models';
import { ReportExportService } from '../../services/report-export.service';

@Component({
  selector: 'engineers-salary-reference-reporting-detail-view',
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone: false,
  templateUrl: './reporting-detail-view.component.html',
  styleUrls: ['./reporting-detail-view.component.scss']
})
export class ReportingDetailViewComponent implements OnChanges {
  private readonly reportExport = inject(ReportExportService);

  @Input({ required: true }) page!: ReportingDetailPageDefinition;

  readonly sectionLinks = [
    { id: 'detail-summary', label: 'Summary' },
    { id: 'detail-record', label: 'Record' },
    { id: 'detail-metrics', label: 'Metrics' },
    { id: 'detail-actions', label: 'Actions' },
    { id: 'detail-charts', label: 'Charts' }
  ];

  selectedFilters: Record<string, string> = {};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['page']?.currentValue) {
      this.selectedFilters = this.page.filterGroups.reduce<Record<string, string>>(
        (state, group) => {
          state[group.key] = group.defaultValue ?? group.options[0]?.value ?? '';
          return state;
        },
        {}
      );
    }
  }

  confidenceLabel(): string {
    return `${Math.round(this.page.report.confidence * 100)}%`;
  }

  varianceLabel(): string {
    const percent = Math.round(this.page.report.variance * 100);
    return `${percent > 0 ? '+' : ''}${percent}%`;
  }

  criticalActionCount(): number {
    return this.page.actionItems.filter(item => item.tone === 'danger').length;
  }

  nextDecisionDue(): string {
    return (
      this.page.actionItems
        .map(item => item.due)
        .sort((left, right) => left.localeCompare(right))[0] ?? 'No due date'
    );
  }

  statusClass(status: string): string {
    switch (status) {
      case 'Ready':
        return 'success';
      case 'Running':
        return 'info';
      case 'Scheduled':
      case 'Watch':
        return 'warning';
      case 'Draft':
      case 'Failed':
      case 'Critical':
      case 'Attention':
        return 'danger';
      case 'Archived':
        return 'warn';
      default:
        return 'neutral';
    }
  }

  toneClass(tone: ReportingTone): string {
    return tone;
  }

  primaryRisk(): { label: string; note: string } {
    const item =
      this.page.insights.find(entry => entry.tone === 'danger') ??
      this.page.insights.find(entry => entry.tone === 'warning') ??
      this.page.insights[0];

    return {
      label: item?.value ?? 'No risk flagged',
      note: item?.note ?? 'This page currently shows no escalated operating signal.'
    };
  }

  primaryOpportunity(): { label: string; note: string } {
    const item =
      this.page.insights.find(entry => entry.tone === 'success') ??
      this.page.insights.find(entry => entry.tone === 'primary') ??
      this.page.insights[0];

    return {
      label: item?.value ?? 'No opportunity captured',
      note: item?.note ?? 'No positive operating signal has been highlighted yet.'
    };
  }

  nextActionItem() {
    return (
      this.sortedActionItems()[0] ?? {
        title: 'No action registered',
        owner: 'Unassigned',
        due: 'No due date',
        status: 'Clear',
        tone: 'neutral' as ReportingTone,
        note: 'This page currently has no open follow-up action.'
      }
    );
  }

  sortedActionItems() {
    return [...this.page.actionItems].sort((left, right) => {
      const toneRank = this.actionToneRank(left.tone) - this.actionToneRank(right.tone);
      if (toneRank !== 0) {
        return toneRank;
      }
      return left.due.localeCompare(right.due);
    });
  }

  actionPreviewItems() {
    return this.sortedActionItems().slice(0, 3);
  }

  chartInventory() {
    return this.page.charts.map(chart => ({
      title: chart.title,
      kind: chart.kind,
      caption: chart.caption
    }));
  }

  dataCoverageItems() {
    return [
      {
        label: 'Filters',
        value: `${this.page.filterGroups.length}`,
        note: 'Local lens controls available on this page.'
      },
      {
        label: 'Metrics',
        value: `${this.page.metrics.length}`,
        note: 'Headline KPIs currently surfaced for this report.'
      },
      {
        label: 'Signals',
        value: `${this.page.insights.length}`,
        note: 'Operational readings and decision signals in scope.'
      },
      {
        label: 'Actions',
        value: `${this.page.actionItems.length}`,
        note: 'Tracked tasks and escalations tied to this page.'
      },
      {
        label: 'Charts',
        value: `${this.page.charts.length}`,
        note: 'Visual views available inside the evidence section.'
      },
      {
        label: 'Tags',
        value: `${this.page.report.tags.length}`,
        note: 'Register tags attached to the underlying report record.'
      }
    ];
  }

  periodLabel(): string {
    return `${this.page.report.periodStart} to ${this.page.report.periodEnd}`;
  }

  starredLabel(): string {
    return this.page.report.starred ? 'Starred' : 'Standard';
  }

  formatLabel(): string {
    return `${this.page.report.format} / ${this.page.report.priority}`;
  }

  reportTags(): string[] {
    return this.page.report.tags.length ? this.page.report.tags : ['No tags attached'];
  }

  executiveDossierItems(): ReportingDetailExecutiveCard[] {
    return [
      {
        label: 'Operating posture',
        value:
          this.page.report.health >= 80
            ? 'Controlled'
            : this.page.report.health >= 65
              ? 'Watch'
              : 'At risk',
        note: `${this.page.report.health}% health with ${this.warningSignalCount()} warning signals currently open.`,
        tone:
          this.page.report.health >= 80
            ? 'success'
            : this.page.report.health >= 65
              ? 'warning'
              : 'danger'
      },
      {
        label: 'Delivery pressure',
        value: this.page.report.nextRun || 'Unscheduled',
        note: `${this.page.actionItems.length} actions on record and next gate on ${this.nextDecisionDue()}.`,
        tone: this.page.report.nextRun ? 'primary' : 'danger'
      },
      {
        label: 'Commercial move',
        value: this.varianceLabel(),
        note: `${this.page.report.value.toLocaleString('en-US')} USD under this page with confidence ${this.confidenceLabel()}.`,
        tone:
          this.page.report.variance <= -0.05
            ? 'success'
            : this.page.report.variance >= 0.08
              ? 'danger'
              : 'warning'
      },
      {
        label: 'Decision owner',
        value: this.page.report.owner,
        note: `${this.page.report.department} owns the next movement on this report.`,
        tone: 'neutral'
      }
    ];
  }

  lifecycleItems() {
    return [
      {
        label: 'Created',
        value: this.page.report.createdAt,
        note: 'Initial register creation date for this report.'
      },
      {
        label: 'Period start',
        value: this.page.report.periodStart,
        note: 'Beginning of the reporting window covered by this page.'
      },
      {
        label: 'Last run',
        value: this.page.report.lastRun,
        note: 'Most recent execution date of the report dataset.'
      },
      {
        label: 'Updated',
        value: this.page.report.updatedAt,
        note: 'Last register update applied to the report metadata.'
      },
      {
        label: 'Next run',
        value: this.page.report.nextRun || 'Not scheduled',
        note: 'Next planned execution or current scheduling gap.'
      },
      {
        label: 'Next gate',
        value: this.nextDecisionDue(),
        note: 'Nearest action date currently attached to this page.'
      }
    ];
  }

  appliedLensItems() {
    return this.page.filterGroups.map(group => ({
      label: group.label,
      value: this.selectedFilterLabel(group),
      note: group.description
    }));
  }

  commandBoardItems(): ReportingDetailBoardItem[] {
    return [
      {
        label: 'Owner',
        value: this.page.report.owner,
        note: `${this.page.report.department} is the current accountable lane.`
      },
      {
        label: 'Priority',
        value: this.page.report.priority,
        note: `${this.page.report.format} output with ${this.starredLabel().toLowerCase()} tracking mode.`
      },
      {
        label: 'Next gate',
        value: this.nextDecisionDue(),
        note: `${this.criticalActionCount()} critical actions are still unresolved.`
      },
      {
        label: 'Decision lens',
        value: this.activeLensSummary() || 'No filters applied',
        note: 'Current local filter context driving this page readout.'
      }
    ];
  }

  signalCards(): ReportingDetailExecutiveCard[] {
    return this.page.insights.map(item => ({
      label: item.label,
      value: item.value,
      note: item.note,
      tone: item.tone
    }));
  }

  warningSignalCount(): number {
    return this.page.insights.filter(item => item.tone === 'danger' || item.tone === 'warning')
      .length;
  }

  positiveSignalCount(): number {
    return this.page.insights.filter(item => item.tone === 'success' || item.tone === 'primary')
      .length;
  }

  activeLensSummary(): string {
    return this.page.filterGroups
      .map(group => `${group.label}: ${this.selectedFilterLabel(group)}`)
      .join(' / ');
  }

  selectedFilterLabel(group: ReportingFilterGroup): string {
    return (
      group.options.find(option => option.value === this.selectedFilters[group.key])?.label ??
      group.options[0]?.label ??
      ''
    );
  }

  selectFilter(groupKey: string, value: string): void {
    this.selectedFilters = {
      ...this.selectedFilters,
      [groupKey]: value
    };
  }

  exportPageJson(): void {
    this.reportExport.exportJson({
      title: this.page.report.title,
      subtitle: this.page.description,
      generatedAt: new Date().toISOString(),
      rows: [
        {
          ...this.page.report,
          tags: this.page.report.tags.join(', '),
          activeLens: this.activeLensSummary(),
          metrics: this.page.metrics.map(metric => `${metric.label}: ${metric.value}`).join(' | '),
          actions: this.page.actionItems.map(item => `${item.title} (${item.owner})`).join(' | ')
        }
      ]
    });
  }

  printPage(): void {
    this.reportExport.printCurrentView();
  }

  private actionToneRank(tone: ReportingTone): number {
    switch (tone) {
      case 'danger':
        return 0;
      case 'warning':
        return 1;
      case 'primary':
        return 2;
      case 'success':
        return 3;
      default:
        return 4;
    }
  }
}
