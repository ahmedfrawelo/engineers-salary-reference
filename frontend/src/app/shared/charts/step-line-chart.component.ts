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
import { CHART_PALETTE, formatNumber, linearScale, niceTicks } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type StepPath = { path: string; color: string; label: string; values: number[] };

@Component({
  selector: 'engineers-salary-reference-step-line-chart',
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
        <g class="chart-grid">
          @for (tick of yTicks; track tick) {
            <line
              [attr.x1]="margin.left"
              [attr.x2]="width - margin.right"
              [attr.y1]="tick.y"
              [attr.y2]="tick.y"
            ></line>
          }
        </g>
        <g class="step-lines">
          @for (line of lines; track line) {
            <path
              class="step-line"
              [attr.d]="line.path"
              [attr.stroke]="line.color"
              (click)="onLineClick(line)"
            ></path>
          }
        </g>
        <g class="chart-axis axis-y">
          @for (tick of yTicks; track tick) {
            <text [attr.x]="margin.left - 8" [attr.y]="tick.y + 4" text-anchor="end">
              {{ tick.label }}
            </text>
          }
        </g>
        <g class="chart-axis axis-x">
          @for (label of xLabels; track label) {
            <text [attr.x]="label.x" [attr.y]="height - 8" text-anchor="middle">
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
      .step-line {
        fill: none;
        stroke-width: 2.2;
        cursor: pointer;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryStepLineChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() labels: string[] = [];
  @Input() series: LineSeries[] = [];
  @Input() height = 220;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 420;
  margin = { top: 24, right: 16, bottom: 28, left: 44 };
  lines: StepPath[] = [];
  yTicks: { y: number; label: string }[] = [];
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
      this.yTicks = [];
      this.xLabels = [];
      this.cdr.markForCheck();
      return;
    }

    const visibleSeries = this.series.filter(series => !this.hidden.has(series.label));
    const values = visibleSeries.flatMap(s => s.values);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);
    const innerHeight = this.height - this.margin.top - this.margin.bottom;
    const innerWidth = this.width - this.margin.left - this.margin.right;
    const y = linearScale(min, max || 1, this.margin.top + innerHeight, this.margin.top);
    const stepX = this.labels.length > 1 ? innerWidth / (this.labels.length - 1) : 0;
    const xs = this.labels.map((_, idx) => this.margin.left + idx * stepX);

    this.lines = visibleSeries.map(series => {
      const sIdx = this.series.findIndex(s => s.label === series.label);
      const points = series.values.map((v, idx) => ({ x: xs[idx], y: y(v ?? 0) }));
      const segments: string[] = [];
      points.forEach((point, idx) => {
        if (idx === 0) {
          segments.push(`M ${point.x} ${point.y}`);
        } else {
          const prev = points[idx - 1];
          segments.push(`L ${point.x} ${prev.y}`);
          segments.push(`L ${point.x} ${point.y}`);
        }
      });
      return {
        path: segments.join(' '),
        color: series.color || CHART_PALETTE[sIdx % CHART_PALETTE.length],
        label: series.label,
        values: [...series.values]
      };
    });

    const ticks = niceTicks(min, max, 5);
    this.yTicks = ticks.map(v => ({ y: y(v), label: formatNumber(v, true) }));
    this.xLabels = this.labels.map((label, idx) => ({ label, x: xs[idx] }));
    this.cdr.markForCheck();
  }

  onLineClick(line: StepPath): void {
    const last = line.values.length ? line.values[line.values.length - 1] : 0;
    this.itemClick.emit({
      label: line.label,
      value: last,
      color: line.color,
      meta: { values: line.values }
    });
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

  export(kind: 'png' | 'svg'): void {
    if (!this.svgRef) return;
    downloadChart(this.svgRef.nativeElement, this.exportName, kind);
  }

  exportCsv(): void {
    downloadCsvSmart(this.exportName, inferCsvPayload(this as LooseValue));
  }
}
