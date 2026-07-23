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
import { ChartDatum, ParetoDatum } from './chart-types';
import { bandScale, formatNumber, formatPercent, linearScale, niceTicks } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type BarShape = {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  value: number;
};
type Point = { x: number; y: number; value: number; label: string };

@Component({
  selector: 'engineers-salary-reference-pareto-chart',
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
          @for (tick of leftTicks; track tick) {
            <line
              [attr.x1]="margin.left"
              [attr.x2]="width - margin.right"
              [attr.y1]="tick.y"
              [attr.y2]="tick.y"
            ></line>
          }
        </g>

        <g class="chart-bars">
          @for (bar of bars; track bar) {
            <rect
              class="pareto-bar"
              [attr.x]="bar.x"
              [attr.y]="bar.y"
              [attr.width]="bar.width"
              [attr.height]="bar.height"
              [attr.rx]="4"
              [attr.ry]="4"
              (click)="onBarClick(bar)"
              (mousemove)="showBarTooltip($event, bar)"
              (mouseleave)="hideTooltip()"
            ></rect>
          }
        </g>

        <path class="pareto-area" [attr.d]="areaPath"></path>
        <path class="pareto-line" [attr.d]="linePath"></path>

        <g class="chart-axis axis-y">
          @for (tick of leftTicks; track tick) {
            <text [attr.x]="margin.left - 8" [attr.y]="tick.y + 4" text-anchor="end">
              {{ tick.label }}
            </text>
          }
        </g>
        <g class="chart-axis axis-y">
          @for (tick of rightTicks; track tick) {
            <text [attr.x]="width - margin.right + 8" [attr.y]="tick.y + 4" text-anchor="start">
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

      @if (tooltip.visible) {
        <div class="chart-tooltip" [style.left.px]="tooltip.x" [style.top.px]="tooltip.y">
          <span class="label">{{ tooltip.label }}</span>
          <span class="value">{{ tooltip.value }}</span>
        </div>
      }
      @if (!bars.length) {
        <div class="chart-empty">No data</div>
      }
    </div>
  `,
  styleUrls: ['./chart-base.css'],
  styles: [
    `
      .pareto-bar {
        fill: rgba(var(--primary), 0.65);
      }
      .pareto-bar:hover {
        fill: rgba(var(--primary), 0.85);
      }
      .pareto-line {
        fill: none;
        stroke: #60a5fa;
        stroke-width: 2.2;
      }
      .pareto-area {
        fill: rgba(96, 165, 250, 0.18);
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryParetoChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data: ParetoDatum[] = [];
  @Input() height = 320;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 640;
  margin = { top: 24, right: 44, bottom: 28, left: 44 };
  bars: BarShape[] = [];
  points: Point[] = [];
  linePath = '';
  areaPath = '';
  xLabels: { x: number; label: string }[] = [];
  leftTicks: { y: number; label: string }[] = [];
  rightTicks: { y: number; label: string }[] = [];

  tooltip = { visible: false, x: 0, y: 0, label: '', value: '' };

  private ro?: ResizeObserver;
  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.observe();
    this.reflow();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] || changes['height']) {
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
    const height = this.height;
    const labels = this.data.map(d => d.label);
    const values = this.data.map(d => d.value);
    const max = Math.max(...values, 0);
    const total = values.reduce((sum, v) => sum + v, 0);
    const cumulative = values.reduce((acc, v, idx) => {
      const next = (acc[idx - 1] ?? 0) + v;
      acc.push(total ? (next / total) * 100 : 0);
      return acc;
    }, [] as number[]);

    const innerHeight = height - this.margin.top - this.margin.bottom;
    const innerWidth = this.width - this.margin.left - this.margin.right;
    if (innerHeight <= 0 || innerWidth <= 0) {
      this.bars = [];
      this.points = [];
      this.linePath = '';
      this.areaPath = '';
      return;
    }

    const yLeft = linearScale(0, max || 1, this.margin.top + innerHeight, this.margin.top);
    const yRight = linearScale(0, 100, this.margin.top + innerHeight, this.margin.top);
    const band = bandScale(labels, this.margin.left, this.margin.left + innerWidth, 0.3);

    this.bars = this.data.map(d => {
      const barHeight = this.margin.top + innerHeight - yLeft(d.value);
      return {
        x: band.position(d.label),
        y: yLeft(d.value),
        width: band.bandwidth,
        height: Math.max(barHeight, 0),
        value: d.value,
        label: d.label
      };
    });

    this.points = labels.map((label, idx) => ({
      x: band.position(label) + band.bandwidth / 2,
      y: yRight(cumulative[idx] ?? 0),
      value: cumulative[idx] ?? 0,
      label
    }));

    if (!this.points.length) {
      this.linePath = '';
      this.areaPath = '';
    } else {
      this.linePath = this.points.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x},${pt.y}`).join(' ');
      const baseY = this.margin.top + innerHeight;
      const areaPath = this.points
        .map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x},${pt.y}`)
        .join(' ');
      this.areaPath = `${areaPath} L${this.points[this.points.length - 1]?.x ?? this.margin.left},${baseY} L${this.points[0]?.x ?? this.margin.left},${baseY} Z`;
    }

    const leftTicks = niceTicks(0, max, 5);
    this.leftTicks = leftTicks.map(v => ({ y: yLeft(v), label: formatNumber(v) }));
    const rightTicks = [0, 25, 50, 75, 100];
    this.rightTicks = rightTicks.map(v => ({ y: yRight(v), label: formatPercent(v) }));

    this.xLabels = labels.map(label => ({
      label,
      x: band.position(label) + band.bandwidth / 2
    }));
    this.cdr.markForCheck();
  }

  showBarTooltip(event: MouseEvent, bar: BarShape): void {
    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    this.tooltip = {
      visible: true,
      x: event.clientX - rect.left + 12,
      y: event.clientY - rect.top - 24,
      label: bar.label,
      value: formatNumber(bar.value)
    };
  }

  hideTooltip(): void {
    this.tooltip.visible = false;
  }

  onBarClick(bar: BarShape): void {
    this.itemClick.emit({ label: bar.label, value: bar.value });
  }

  export(kind: 'png' | 'svg'): void {
    if (!this.svgRef) return;
    downloadChart(this.svgRef.nativeElement, this.exportName, kind);
  }

  exportCsv(): void {
    downloadCsvSmart(this.exportName, inferCsvPayload(this as LooseValue));
  }
}
