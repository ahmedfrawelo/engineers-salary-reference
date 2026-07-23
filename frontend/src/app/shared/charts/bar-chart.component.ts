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
import { ChartDatum } from './chart-types';
import { bandScale, formatNumber, linearScale, niceTicks } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type BarShape = {
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
  label: string;
};

type AxisTick = {
  value: number;
  y: number;
  label: string;
};

@Component({
  selector: 'engineers-salary-reference-bar-chart',
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

        <g class="chart-bars">
          @for (bar of bars; track bar) {
            <rect
              class="bar-rect"
              [attr.x]="bar.x"
              [attr.y]="bar.y"
              [attr.width]="bar.width"
              [attr.height]="bar.height"
              [attr.rx]="4"
              [attr.ry]="4"
              (click)="onBarClick(bar)"
              (mousemove)="showTooltip($event, bar)"
              (mouseleave)="hideTooltip()"
            ></rect>
          }
        </g>
        @if (showValues) {
          <g class="chart-values">
            @for (bar of bars; track bar) {
              <text
                class="bar-value"
                [attr.x]="bar.x + bar.width / 2"
                [attr.y]="bar.y - 6"
                text-anchor="middle"
              >
                {{ format(bar.value) }}
              </text>
            }
          </g>
        }

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
      @if (!bars.length) {
        <div class="chart-empty">No data</div>
      }
    </div>
  `,
  styleUrls: ['./chart-base.css'],
  styles: [
    `
      .bar-rect {
        fill: rgb(var(--primary));
        transition: fill 0.2s ease;
        cursor: pointer;
      }
      .bar-rect:hover {
        fill: color-mix(in oklab, rgb(var(--primary)) 85%, white 15%);
      }
      .bar-value {
        fill: rgb(var(--fg));
        font-size: 10px;
        font-weight: 600;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryBarChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data: ChartDatum[] = [];
  @Input() height = 320;
  @Input() compactTicks = false;
  @Input() showValues = false;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 640;
  margin = { top: 24, right: 12, bottom: 28, left: 44 };
  bars: BarShape[] = [];
  yTicks: AxisTick[] = [];
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
    const height = this.height;
    const labels = this.data.map(d => d.label);
    const values = this.data.map(d => d.value);
    const max = Math.max(...values, 0);

    const innerHeight = height - this.margin.top - this.margin.bottom;
    const innerWidth = this.width - this.margin.left - this.margin.right;
    if (innerHeight <= 0 || innerWidth <= 0) {
      this.bars = [];
      this.yTicks = [];
      this.xLabels = [];
      return;
    }

    const y = linearScale(0, max || 1, this.margin.top + innerHeight, this.margin.top);
    const band = bandScale(labels, this.margin.left, this.margin.left + innerWidth, 0.3);
    this.bars = this.data.map(d => {
      const barHeight = this.margin.top + innerHeight - y(d.value);
      return {
        x: band.position(d.label),
        y: y(d.value),
        width: band.bandwidth,
        height: Math.max(barHeight, 0),
        value: d.value,
        label: d.label
      };
    });

    const ticks = niceTicks(0, max, 5);
    this.yTicks = ticks.map(v => ({
      value: v,
      y: y(v),
      label: formatNumber(v, this.compactTicks)
    }));

    this.xLabels = labels.map(label => ({
      label,
      x: band.position(label) + band.bandwidth / 2
    }));
    this.cdr.markForCheck();
  }

  showTooltip(event: MouseEvent, bar: BarShape): void {
    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    this.tooltip = {
      visible: true,
      x: event.clientX - rect.left + 12,
      y: event.clientY - rect.top - 24,
      label: bar.label,
      value: formatNumber(bar.value, this.compactTicks)
    };
  }

  hideTooltip(): void {
    this.tooltip.visible = false;
  }

  onBarClick(bar: BarShape): void {
    this.itemClick.emit({ label: bar.label, value: bar.value });
  }

  format(value: number): string {
    return formatNumber(value, this.compactTicks);
  }

  export(kind: 'png' | 'svg'): void {
    if (!this.svgRef) return;
    downloadChart(this.svgRef.nativeElement, this.exportName, kind);
  }

  exportCsv(): void {
    downloadCsvSmart(this.exportName, inferCsvPayload(this as LooseValue));
  }
}
