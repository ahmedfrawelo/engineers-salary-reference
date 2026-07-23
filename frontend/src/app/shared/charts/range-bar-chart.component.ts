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
import { ChartDatum, RangeBarDatum } from './chart-types';
import { bandScale, formatNumber, linearScale, niceTicks } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type RangeBar = {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  min: number;
  max: number;
  color: string;
};

@Component({
  selector: 'engineers-salary-reference-range-bar-chart',
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
          @for (tick of xTicks; track tick) {
            <line
              [attr.x1]="tick.x"
              [attr.x2]="tick.x"
              [attr.y1]="margin.top"
              [attr.y2]="height - margin.bottom"
            ></line>
          }
        </g>
        <g class="range-bars">
          @for (bar of bars; track bar) {
            <rect
              class="range-bar"
              [attr.x]="bar.x"
              [attr.y]="bar.y"
              [attr.width]="bar.width"
              [attr.height]="bar.height"
              [attr.fill]="bar.color"
              [attr.rx]="4"
              [attr.ry]="4"
              (click)="onBarClick(bar)"
              (mousemove)="showTooltip($event, bar)"
              (mouseleave)="hideTooltip()"
            ></rect>
          }
        </g>
        <g class="chart-axis axis-x">
          @for (tick of xTicks; track tick) {
            <text [attr.x]="tick.x" [attr.y]="height - 8" text-anchor="middle">
              {{ tick.label }}
            </text>
          }
        </g>
        <g class="chart-axis axis-y">
          @for (label of yLabels; track label) {
            <text [attr.x]="margin.left - 8" [attr.y]="label.y" text-anchor="end">
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
      .range-bar {
        opacity: 0.85;
        cursor: pointer;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryRangeBarChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data: RangeBarDatum[] = [];
  @Input() height = 240;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 420;
  margin = { top: 16, right: 16, bottom: 28, left: 90 };
  bars: RangeBar[] = [];
  xTicks: { x: number; label: string }[] = [];
  yLabels: { y: number; label: string }[] = [];

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
      this.bars = [];
      this.xTicks = [];
      this.yLabels = [];
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
      this.bars = [];
      this.cdr.markForCheck();
      return;
    }

    const x = linearScale(min, max || 1, this.margin.left, this.margin.left + innerWidth);
    const labels = this.data.map(d => d.label);
    const band = bandScale(labels, this.margin.top, this.margin.top + innerHeight, 0.3);

    this.bars = this.data.map((d, idx) => {
      const x0 = x(d.min);
      const x1 = x(d.max);
      return {
        x: Math.min(x0, x1),
        y: band.position(d.label),
        width: Math.abs(x1 - x0),
        height: band.bandwidth,
        label: d.label,
        min: d.min,
        max: d.max,
        color: d.color || '#38bdf8'
      };
    });

    const ticks = niceTicks(min, max, 5);
    this.xTicks = ticks.map(v => ({ x: x(v), label: formatNumber(v, true) }));
    this.yLabels = labels.map(label => ({
      label,
      y: band.position(label) + band.bandwidth / 2 + 4
    }));
    this.cdr.markForCheck();
  }

  showTooltip(event: MouseEvent, bar: RangeBar): void {
    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    this.tooltip = {
      visible: true,
      x: event.clientX - rect.left + 12,
      y: event.clientY - rect.top - 24,
      label: bar.label,
      value: `${formatNumber(bar.min, true)} - ${formatNumber(bar.max, true)}`
    };
  }

  hideTooltip(): void {
    this.tooltip.visible = false;
  }

  onBarClick(bar: RangeBar): void {
    this.itemClick.emit({ label: bar.label, value: bar.max });
  }

  export(kind: 'png' | 'svg'): void {
    if (!this.svgRef) return;
    downloadChart(this.svgRef.nativeElement, this.exportName, kind);
  }

  exportCsv(): void {
    downloadCsvSmart(this.exportName, inferCsvPayload(this as LooseValue));
  }
}
