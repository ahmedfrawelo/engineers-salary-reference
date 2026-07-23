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
import { ChartDatum, WaterfallDatum } from './chart-types';
import { bandScale, formatNumber, linearScale, niceTicks } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type WaterfallBar = {
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
  label: string;
  positive: boolean;
};

@Component({
  selector: 'engineers-salary-reference-waterfall-chart',
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
        <line
          class="waterfall-baseline"
          [attr.x1]="margin.left"
          [attr.x2]="width - margin.right"
          [attr.y1]="baselineY"
          [attr.y2]="baselineY"
        ></line>
        <g class="waterfall-bars">
          @for (bar of bars; track bar) {
            <rect
              class="waterfall-bar"
              [class.positive]="bar.positive"
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
      .waterfall-bar {
        fill: rgba(239, 68, 68, 0.8);
        cursor: pointer;
      }
      .waterfall-bar.positive {
        fill: rgba(34, 197, 94, 0.8);
      }
      .waterfall-baseline {
        stroke: rgba(var(--border), 0.45);
        stroke-width: 1.2;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryWaterfallChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data: WaterfallDatum[] = [];
  @Input() height = 260;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 420;
  margin = { top: 24, right: 16, bottom: 28, left: 52 };
  bars: WaterfallBar[] = [];
  xLabels: { x: number; label: string }[] = [];
  yTicks: { y: number; label: string }[] = [];
  baselineY = 0;

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
      this.xLabels = [];
      this.yTicks = [];
      this.cdr.markForCheck();
      return;
    }

    let cumulative = 0;
    const stacks = this.data.map(item => {
      const start = cumulative;
      cumulative += item.value;
      return { ...item, start, end: cumulative };
    });

    const min = Math.min(0, ...stacks.map(s => Math.min(s.start, s.end)));
    const max = Math.max(0, ...stacks.map(s => Math.max(s.start, s.end)));
    const innerHeight = this.height - this.margin.top - this.margin.bottom;
    const innerWidth = this.width - this.margin.left - this.margin.right;
    if (innerHeight <= 0 || innerWidth <= 0) {
      this.bars = [];
      this.cdr.markForCheck();
      return;
    }

    const y = linearScale(min, max || 1, this.margin.top + innerHeight, this.margin.top);
    const labels = stacks.map(item => item.label);
    const band = bandScale(labels, this.margin.left, this.margin.left + innerWidth, 0.3);

    this.bars = stacks.map(item => {
      const yStart = y(item.start);
      const yEnd = y(item.end);
      return {
        x: band.position(item.label),
        y: Math.min(yStart, yEnd),
        width: band.bandwidth,
        height: Math.abs(yEnd - yStart),
        value: item.value,
        label: item.label,
        positive: item.value >= 0
      };
    });

    this.baselineY = y(0);
    const ticks = niceTicks(min, max, 5);
    this.yTicks = ticks.map(v => ({ y: y(v), label: formatNumber(v, true) }));
    this.xLabels = labels.map(label => ({
      label,
      x: band.position(label) + band.bandwidth / 2
    }));
    this.cdr.markForCheck();
  }

  showTooltip(event: MouseEvent, bar: WaterfallBar): void {
    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    this.tooltip = {
      visible: true,
      x: event.clientX - rect.left + 12,
      y: event.clientY - rect.top - 24,
      label: bar.label,
      value: formatNumber(bar.value, true)
    };
  }

  hideTooltip(): void {
    this.tooltip.visible = false;
  }

  onBarClick(bar: WaterfallBar): void {
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
