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
import { AreaRangeDatum, ChartDatum } from './chart-types';
import { formatNumber, linearScale, niceTicks } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type RangePoint = {
  x: number;
  minY: number;
  maxY: number;
  label: string;
  min: number;
  max: number;
};

@Component({
  selector: 'engineers-salary-reference-area-range-chart',
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
        <path class="area-range" [attr.d]="areaPath"></path>
        <path class="area-line min" [attr.d]="minPath"></path>
        <path class="area-line max" [attr.d]="maxPath"></path>
        <g class="area-points">
          @for (point of points; track point) {
            <circle
              class="area-point"
              [attr.cx]="point.x"
              [attr.cy]="point.maxY"
              r="5"
              (click)="onPointClick(point)"
            ></circle>
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

      @if (!points.length) {
        <div class="chart-empty">No data</div>
      }
    </div>
  `,
  styleUrls: ['./chart-base.css'],
  styles: [
    `
      .area-range {
        fill: rgba(var(--primary), 0.18);
        stroke: none;
      }
      .area-line {
        fill: none;
        stroke-width: 2;
        stroke: rgba(var(--primary), 0.8);
      }
      .area-line.min {
        stroke: rgba(148, 163, 184, 0.7);
      }
      .area-point {
        fill: rgba(var(--primary), 0.6);
        cursor: pointer;
        opacity: 0.85;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryAreaRangeChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data: AreaRangeDatum[] = [];
  @Input() height = 240;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 420;
  margin = { top: 24, right: 16, bottom: 28, left: 50 };
  points: RangePoint[] = [];
  xLabels: { x: number; label: string }[] = [];
  yTicks: { y: number; label: string }[] = [];
  areaPath = '';
  minPath = '';
  maxPath = '';

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
    if (!this.data.length) {
      this.points = [];
      this.areaPath = '';
      this.minPath = '';
      this.maxPath = '';
      this.cdr.markForCheck();
      return;
    }

    const mins = this.data.map(d => d.min);
    const maxs = this.data.map(d => d.max);
    const min = Math.min(...mins, 0);
    const max = Math.max(...maxs, 1);
    const innerHeight = this.height - this.margin.top - this.margin.bottom;
    const innerWidth = this.width - this.margin.left - this.margin.right;
    if (innerHeight <= 0 || innerWidth <= 0) {
      this.points = [];
      this.cdr.markForCheck();
      return;
    }

    const y = linearScale(min, max || 1, this.margin.top + innerHeight, this.margin.top);
    const step = this.data.length > 1 ? innerWidth / (this.data.length - 1) : 0;
    const points = this.data.map((item, idx) => ({
      x: this.margin.left + idx * step,
      minY: y(item.min),
      maxY: y(item.max),
      label: item.label,
      min: item.min,
      max: item.max
    }));
    this.points = points;

    const top = points.map(p => `${p.x} ${p.maxY}`);
    const bottom = points
      .slice()
      .reverse()
      .map(p => `${p.x} ${p.minY}`);
    this.areaPath = `M ${top[0]} L ${top.slice(1).join(' L ')} L ${bottom.join(' L ')} Z`;
    this.maxPath = `M ${top[0]} L ${top.slice(1).join(' L ')}`;
    this.minPath = `M ${bottom[0]} L ${bottom.slice(1).join(' L ')}`;

    const ticks = niceTicks(min, max, 5);
    this.yTicks = ticks.map(v => ({ y: y(v), label: formatNumber(v, true) }));
    this.xLabels = this.data.map((item, idx) => ({
      label: item.label,
      x: this.margin.left + idx * step
    }));
    this.cdr.markForCheck();
  }

  export(kind: 'png' | 'svg'): void {
    if (!this.svgRef) return;
    downloadChart(this.svgRef.nativeElement, this.exportName, kind);
  }

  exportCsv(): void {
    downloadCsvSmart(this.exportName, inferCsvPayload(this as LooseValue));
  }

  onPointClick(point: RangePoint): void {
    this.itemClick.emit({ label: point.label, value: point.max });
  }
}
