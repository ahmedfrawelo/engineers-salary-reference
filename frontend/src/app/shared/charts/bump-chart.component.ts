import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { ChartDatum, LineSeries } from './chart-types';
import { CHART_PALETTE } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type BumpLine = {
  path: string;
  color: string;
  label: string;
  values: number[];
};

@Component({
  selector: 'engineers-salary-reference-bump-chart',
  standalone: true,
  imports: [],
  template: `
    <div class="chart-shell" #host [style.height.px]="height">
      @if (exportable) {
        <div class="chart-actions">
          <button class="chart-action" type="button" (click)="export('png')">PNG</button>
          <button class="chart-action" type="button" (click)="export('svg')">SVG</button>
          <button class="chart-action" type="button" (click)="exportCsv()">CSV</button>
        </div>
      }
      <svg class="chart-svg" #svgRef [attr.viewBox]="'0 0 ' + width + ' ' + height">
        <g class="bump-lines">
          @for (line of lines; track line) {
            <path
              class="bump-line"
              [attr.d]="line.path"
              [attr.stroke]="line.color"
              (click)="onLineClick(line)"
            ></path>
          }
        </g>
        <g class="bump-axis">
          @for (label of xLabels; track label) {
            <text class="bump-label" [attr.x]="label.x" [attr.y]="height - 8" text-anchor="middle">
              {{ label.label }}
            </text>
          }
        </g>
      </svg>
      @if (!lines.length) {
        <div class="chart-empty">No data</div>
      }
      @if (series.length) {
        <div class="chart-legend">
          @for (line of series; track line) {
            <div class="legend-item" [class.off]="isHidden(line)" (click)="toggleSeries(line)">
              <span class="legend-dot" [style.background]="line.color || defaultColor(line)"></span>
              {{ line.label }}
            </div>
          }
        </div>
      }
    </div>
  `,
  styleUrls: ['./chart-base.css'],
  styles: [
    `
      .bump-line {
        fill: none;
        stroke-width: 2.4;
        opacity: 0.9;
        cursor: pointer;
      }
      .bump-label {
        font-size: 10px;
        fill: rgb(var(--muted));
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryBumpChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() labels: string[] = [];
  @Input() series: LineSeries[] = [];
  @Input() height = 240;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 420;
  lines: BumpLine[] = [];
  xLabels: { x: number; label: string }[] = [];

  private ro?: ResizeObserver;
  private hidden = new Set<string>();
  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.observe();
    this.reflow();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['labels'] || changes['series'] || changes['height']) {
      this.reflow();
    }
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
  }

  private observe(): void {
    this.ro?.disconnect();
    this.ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const nextWidth = Math.max(entry.contentRect.width, 280);
        if (nextWidth !== this.width) {
          this.width = nextWidth;
          this.reflow();
        }
      }
    });
    this.ro.observe(this.hostRef.nativeElement);
  }

  private reflow(): void {
    const host = this.hostRef?.nativeElement;
    if (host) {
      this.width = Math.max(host.clientWidth || 0, 280);
    }
    if (!this.labels.length || !this.series.length) {
      this.lines = [];
      this.xLabels = [];
      this.cdr.markForCheck();
      return;
    }

    const visibleSeries = this.series
      .map((s, sIdx) => ({ series: s, index: sIdx }))
      .filter(entry => !this.hidden.has(entry.series.label));
    const ranks = this.labels.map((_, idx) => {
      const pairs = visibleSeries.map(entry => ({
        idx: entry.index,
        value: entry.series.values[idx] ?? 0
      }));
      pairs.sort((a, b) => b.value - a.value);
      const rankMap = new Map<number, number>();
      pairs.forEach((p, rankIdx) => {
        rankMap.set(p.idx, rankIdx + 1);
      });
      return rankMap;
    });

    const margin = { top: 16, right: 16, bottom: 24, left: 16 };
    const innerHeight = this.height - margin.top - margin.bottom;
    const innerWidth = this.width - margin.left - margin.right;
    const stepX = this.labels.length > 1 ? innerWidth / (this.labels.length - 1) : 0;
    const rankCount = Math.max(visibleSeries.length, 1);
    const rankToY = (rank: number) =>
      margin.top + ((rank - 1) / Math.max(rankCount - 1, 1)) * innerHeight;

    this.lines = visibleSeries.map(entry => {
      const series = entry.series;
      const sIdx = entry.index;
      const points = this.labels.map((_, idx) => {
        const rank = ranks[idx].get(sIdx) ?? 1;
        return { x: margin.left + idx * stepX, y: rankToY(rank) };
      });
      const path = [
        `M ${points[0].x} ${points[0].y}`,
        ...points.slice(1).map(p => `L ${p.x} ${p.y}`)
      ].join(' ');
      return {
        path,
        color: series.color || CHART_PALETTE[sIdx % CHART_PALETTE.length],
        label: series.label,
        values: [...series.values]
      };
    });

    this.xLabels = this.labels.map((label, idx) => ({
      label,
      x: margin.left + idx * stepX
    }));
    this.cdr.markForCheck();
  }

  onLineClick(line: BumpLine): void {
    const last = line.values.length ? line.values[line.values.length - 1] : 0;
    this.itemClick.emit({
      label: line.label,
      value: last,
      color: line.color,
      meta: { values: line.values }
    });
  }

  export(kind: 'png' | 'svg'): void {
    if (!this.svgRef) return;
    downloadChart(this.svgRef.nativeElement, this.exportName, kind);
  }

  exportCsv(): void {
    downloadCsvSmart(this.exportName, inferCsvPayload(this as LooseValue));
  }

  defaultColor(line: LineSeries): string {
    const index = this.series.findIndex(s => s.label === line.label);
    return CHART_PALETTE[index >= 0 ? index % CHART_PALETTE.length : 0];
  }

  isHidden(line: LineSeries): boolean {
    return this.hidden.has(line.label);
  }

  toggleSeries(line: LineSeries): void {
    if (this.hidden.has(line.label)) {
      this.hidden.delete(line.label);
    } else {
      this.hidden.add(line.label);
    }
    this.reflow();
  }
}
