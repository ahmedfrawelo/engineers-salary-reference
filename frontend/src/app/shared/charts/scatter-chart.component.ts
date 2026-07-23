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
import { ChartDatum, ScatterDatum } from './chart-types';
import { CHART_PALETTE, clamp, formatNumber, linearScale, niceTicks } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type ScatterPoint = {
  x: number;
  y: number;
  r: number;
  label: string;
  valueX: number;
  valueY: number;
  color: string;
};

@Component({
  selector: 'engineers-salary-reference-scatter-chart',
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
        <g class="chart-grid chart-grid-x">
          @for (tick of xTicks; track tick) {
            <line
              [attr.y1]="margin.top"
              [attr.y2]="height - margin.bottom"
              [attr.x1]="tick.x"
              [attr.x2]="tick.x"
            ></line>
          }
        </g>

        <g class="scatter-points">
          @for (pt of points; track pt) {
            <circle
              class="scatter-point"
              [attr.cx]="pt.x"
              [attr.cy]="pt.y"
              [attr.r]="pt.r"
              [attr.fill]="pt.color"
              (click)="onPointClick(pt)"
              (mousemove)="showTooltip($event, pt)"
              (mouseleave)="hideTooltip()"
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
          @for (tick of xTicks; track tick) {
            <text [attr.x]="tick.x" [attr.y]="height - 8" text-anchor="middle">
              {{ tick.label }}
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
      @if (!points.length) {
        <div class="chart-empty">No data</div>
      }
    </div>
  `,
  styleUrls: ['./chart-base.css'],
  styles: [
    `
      .scatter-point {
        opacity: 0.85;
        transition:
          opacity 0.2s ease,
          transform 0.2s ease;
        cursor: pointer;
      }
      .scatter-point:hover {
        opacity: 1;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryScatterChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data: ScatterDatum[] = [];
  @Input() height = 260;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 420;
  margin = { top: 24, right: 18, bottom: 28, left: 44 };
  points: ScatterPoint[] = [];
  xTicks: { x: number; label: string }[] = [];
  yTicks: { y: number; label: string }[] = [];

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
    if (!this.data.length) {
      this.points = [];
      this.xTicks = [];
      this.yTicks = [];
      this.cdr.markForCheck();
      return;
    }

    const xs = this.data.map(d => d.x);
    const ys = this.data.map(d => d.y);
    const sizes = this.data.map(d => d.size ?? 1);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const minS = Math.min(...sizes);
    const maxS = Math.max(...sizes);

    const innerHeight = this.height - this.margin.top - this.margin.bottom;
    const innerWidth = this.width - this.margin.left - this.margin.right;
    if (innerHeight <= 0 || innerWidth <= 0) {
      this.points = [];
      this.xTicks = [];
      this.yTicks = [];
      this.cdr.markForCheck();
      return;
    }

    const x = linearScale(minX, maxX, this.margin.left, this.margin.left + innerWidth);
    const y = linearScale(minY, maxY, this.margin.top + innerHeight, this.margin.top);
    const r = linearScale(minS, maxS || minS + 1, 4, 12);

    this.points = this.data.map((d, idx) => ({
      x: x(d.x),
      y: y(d.y),
      r: clamp(r(d.size ?? 1), 3, 14),
      label: d.label || `Point ${idx + 1}`,
      valueX: d.x,
      valueY: d.y,
      color: d.color || CHART_PALETTE[idx % CHART_PALETTE.length]
    }));

    const xTicks = niceTicks(minX, maxX, 5);
    const yTicks = niceTicks(minY, maxY, 5);
    this.xTicks = xTicks.map(v => ({ x: x(v), label: formatNumber(v, true) }));
    this.yTicks = yTicks.map(v => ({ y: y(v), label: formatNumber(v, true) }));
    this.cdr.markForCheck();
  }

  showTooltip(event: MouseEvent, pt: ScatterPoint): void {
    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    this.tooltip = {
      visible: true,
      x: event.clientX - rect.left + 12,
      y: event.clientY - rect.top - 24,
      label: pt.label,
      value: `${formatNumber(pt.valueX)} / ${formatNumber(pt.valueY)}`
    };
  }

  hideTooltip(): void {
    this.tooltip.visible = false;
  }

  onPointClick(pt: ScatterPoint): void {
    this.itemClick.emit({
      label: pt.label,
      value: pt.valueY,
      meta: { x: pt.valueX, y: pt.valueY }
    });
  }

  export(kind: 'png' | 'svg'): void {
    if (!this.svgRef) return;
    downloadChart(this.svgRef.nativeElement, this.exportName, kind);
  }

  exportCsv(): void {
    downloadCsvSmart(this.exportName, inferCsvPayload(this as LooseValue));
  }
}
