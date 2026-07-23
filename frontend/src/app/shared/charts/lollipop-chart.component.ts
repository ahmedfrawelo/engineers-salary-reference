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
import { LollipopDatum } from './chart-types';
import { bandScale, formatNumber, linearScale, niceTicks } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type LollipopPoint = {
  x: number;
  y: number;
  stemY: number;
  label: string;
  value: number;
  color: string;
};

@Component({
  selector: 'engineers-salary-reference-lollipop-chart',
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
        <g class="lollipop-stems">
          @for (point of points; track point) {
            <line
              class="lollipop-stem"
              [attr.x1]="point.x"
              [attr.x2]="point.x"
              [attr.y1]="point.stemY"
              [attr.y2]="point.y"
              [attr.stroke]="point.color"
            ></line>
          }
        </g>
        <g class="lollipop-dots">
          @for (point of points; track point) {
            <circle
              class="lollipop-dot"
              [attr.cx]="point.x"
              [attr.cy]="point.y"
              [attr.r]="6"
              [attr.fill]="point.color"
              (click)="onPointClick(point)"
              (mousemove)="showTooltip($event, point)"
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
      @if (!points.length) {
        <div class="chart-empty">No data</div>
      }
    </div>
  `,
  styleUrls: ['./chart-base.css'],
  styles: [
    `
      .lollipop-stem {
        stroke-width: 2;
        opacity: 0.7;
      }
      .lollipop-dot {
        cursor: pointer;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryLollipopChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data: LollipopDatum[] = [];
  @Input() height = 240;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<LollipopDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 420;
  margin = { top: 24, right: 16, bottom: 28, left: 44 };
  points: LollipopPoint[] = [];
  yTicks: { y: number; label: string }[] = [];
  xLabels: { x: number; label: string }[] = [];

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
      this.yTicks = [];
      this.xLabels = [];
      this.cdr.markForCheck();
      return;
    }

    const values = this.data.map(d => d.value);
    const min = Math.min(0, ...values);
    const max = Math.max(...values, 1);
    const innerHeight = this.height - this.margin.top - this.margin.bottom;
    const innerWidth = this.width - this.margin.left - this.margin.right;
    if (innerHeight <= 0 || innerWidth <= 0) {
      this.points = [];
      this.cdr.markForCheck();
      return;
    }

    const y = linearScale(min, max || 1, this.margin.top + innerHeight, this.margin.top);
    const labels = this.data.map(d => d.label);
    const band = bandScale(labels, this.margin.left, this.margin.left + innerWidth, 0.3);

    this.points = this.data.map((d, idx) => {
      const color = d.color || '#22c55e';
      return {
        x: band.position(d.label) + band.bandwidth / 2,
        y: y(d.value),
        stemY: y(0),
        label: d.label,
        value: d.value,
        color
      };
    });

    const ticks = niceTicks(min, max, 5);
    this.yTicks = ticks.map(v => ({ y: y(v), label: formatNumber(v, true) }));
    this.xLabels = labels.map(label => ({
      label,
      x: band.position(label) + band.bandwidth / 2
    }));
    this.cdr.markForCheck();
  }

  showTooltip(event: MouseEvent, point: LollipopPoint): void {
    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    this.tooltip = {
      visible: true,
      x: event.clientX - rect.left + 12,
      y: event.clientY - rect.top - 24,
      label: point.label,
      value: formatNumber(point.value, true)
    };
  }

  hideTooltip(): void {
    this.tooltip.visible = false;
  }

  onPointClick(point: LollipopPoint): void {
    this.itemClick.emit({ label: point.label, value: point.value, color: point.color });
  }

  export(kind: 'png' | 'svg'): void {
    if (!this.svgRef) return;
    downloadChart(this.svgRef.nativeElement, this.exportName, kind);
  }

  exportCsv(): void {
    downloadCsvSmart(this.exportName, inferCsvPayload(this as LooseValue));
  }
}
