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
import { ChartDatum, ParallelSeries } from './chart-types';
import { CHART_PALETTE, linearScale } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type ParallelLine = {
  path: string;
  color: string;
  label: string;
  values: number[];
};

@Component({
  selector: 'engineers-salary-reference-parallel-coordinates',
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
        <g class="parallel-axes">
          @for (axis of axisLines; track axis) {
            <line
              class="parallel-axis"
              [attr.x1]="axis.x"
              [attr.y1]="margin.top"
              [attr.x2]="axis.x"
              [attr.y2]="height - margin.bottom"
            ></line>
          }
          @for (axis of axisLines; track axis) {
            <text
              class="parallel-label"
              [attr.x]="axis.x"
              [attr.y]="height - 6"
              text-anchor="middle"
            >
              {{ axis.label }}
            </text>
          }
        </g>
        <g class="parallel-lines">
          @for (line of lines; track line) {
            <path
              class="parallel-line"
              [attr.d]="line.path"
              [attr.stroke]="line.color"
              (click)="onLineClick(line)"
            ></path>
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
      .parallel-axis {
        stroke: rgba(var(--border), 0.5);
        stroke-width: 1;
      }
      .parallel-label {
        font-size: 10px;
        fill: rgb(var(--muted));
      }
      .parallel-line {
        fill: none;
        stroke-width: 2;
        opacity: 0.7;
        cursor: pointer;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryParallelCoordinatesChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() axes: string[] = [];
  @Input() series: ParallelSeries[] = [];
  @Input() height = 240;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 420;
  margin = { top: 18, right: 18, bottom: 24, left: 18 };
  axisLines: { x: number; label: string; scale: (v: number) => number }[] = [];
  lines: ParallelLine[] = [];

  private ro?: ResizeObserver;
  private hidden = new Set<string>();
  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.observe();
    this.reflow();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['axes'] || changes['series'] || changes['height']) {
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
    if (!this.axes.length || !this.series.length) {
      this.axisLines = [];
      this.lines = [];
      this.cdr.markForCheck();
      return;
    }

    const innerWidth = this.width - this.margin.left - this.margin.right;
    const innerHeight = this.height - this.margin.top - this.margin.bottom;
    const step = this.axes.length > 1 ? innerWidth / (this.axes.length - 1) : 0;

    const visibleSeries = this.series.filter(series => !this.hidden.has(series.label));
    this.axisLines = this.axes.map((label, idx) => {
      const values = visibleSeries.map(s => s.values[idx] ?? 0);
      const min = Math.min(...values, 0);
      const max = Math.max(...values, 1);
      const scale = linearScale(min, max || 1, this.margin.top + innerHeight, this.margin.top);
      return {
        x: this.margin.left + idx * step,
        label,
        scale
      };
    });

    this.lines = visibleSeries.map(series => {
      const sIdx = this.series.findIndex(s => s.label === series.label);
      const values = this.axisLines.map((_, idx) => series.values[idx] ?? 0);
      const points = this.axisLines.map((axis, idx) => ({
        x: axis.x,
        y: axis.scale(values[idx])
      }));
      const path = [
        `M ${points[0].x} ${points[0].y}`,
        ...points.slice(1).map(p => `L ${p.x} ${p.y}`)
      ].join(' ');
      return {
        path,
        color: series.color || CHART_PALETTE[sIdx % CHART_PALETTE.length],
        label: series.label,
        values
      };
    });
    this.cdr.markForCheck();
  }

  onLineClick(line: ParallelLine): void {
    const avg = line.values.length
      ? line.values.reduce((sum, value) => sum + value, 0) / line.values.length
      : 0;
    this.itemClick.emit({
      label: line.label,
      value: avg,
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

  defaultColor(line: ParallelSeries): string {
    const index = this.series.findIndex(s => s.label === line.label);
    return CHART_PALETTE[index >= 0 ? index % CHART_PALETTE.length : 0];
  }

  isHidden(line: ParallelSeries): boolean {
    return this.hidden.has(line.label);
  }

  toggleSeries(line: ParallelSeries): void {
    if (this.hidden.has(line.label)) {
      this.hidden.delete(line.label);
    } else {
      this.hidden.add(line.label);
    }
    this.reflow();
  }
}
