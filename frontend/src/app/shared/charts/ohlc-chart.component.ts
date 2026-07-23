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
import { ChartDatum, OhlcDatum } from './chart-types';
import { bandScale, formatNumber, linearScale, niceTicks } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type OhlcShape = {
  x: number;
  centerX: number;
  width: number;
  highY: number;
  lowY: number;
  openY: number;
  closeY: number;
  openX1: number;
  openX2: number;
  closeX1: number;
  closeX2: number;
  label: string;
  open: number;
  close: number;
  color: string;
};

@Component({
  selector: 'engineers-salary-reference-ohlc-chart',
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
        <g class="ohlc-series">
          @for (bar of bars; track bar) {
            <g
              (click)="onBarClick(bar)"
              (mousemove)="showTooltip($event, bar)"
              (mouseleave)="hideTooltip()"
            >
              <line
                class="ohlc-wick"
                [attr.x1]="bar.centerX"
                [attr.x2]="bar.centerX"
                [attr.y1]="bar.highY"
                [attr.y2]="bar.lowY"
                [attr.stroke]="bar.color"
              ></line>
              <line
                class="ohlc-open"
                [attr.x1]="bar.openX1"
                [attr.x2]="bar.openX2"
                [attr.y1]="bar.openY"
                [attr.y2]="bar.openY"
                [attr.stroke]="bar.color"
              ></line>
              <line
                class="ohlc-close"
                [attr.x1]="bar.closeX1"
                [attr.x2]="bar.closeX2"
                [attr.y1]="bar.closeY"
                [attr.y2]="bar.closeY"
                [attr.stroke]="bar.color"
              ></line>
            </g>
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
          <span class="value">O {{ tooltip.open }}</span>
          <span class="value">C {{ tooltip.close }}</span>
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
      .ohlc-wick,
      .ohlc-open,
      .ohlc-close {
        stroke-width: 2;
      }
      .ohlc-series g {
        cursor: pointer;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryOhlcChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data: OhlcDatum[] = [];
  @Input() height = 260;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 420;
  margin = { top: 24, right: 16, bottom: 28, left: 50 };
  bars: OhlcShape[] = [];
  yTicks: { y: number; label: string }[] = [];
  xLabels: { x: number; label: string }[] = [];

  tooltip = { visible: false, x: 0, y: 0, label: '', open: '', close: '' };

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
      this.yTicks = [];
      this.xLabels = [];
      this.cdr.markForCheck();
      return;
    }

    const lows = this.data.map(d => d.low);
    const highs = this.data.map(d => d.high);
    const min = Math.min(...lows, 0);
    const max = Math.max(...highs, 1);
    const innerHeight = this.height - this.margin.top - this.margin.bottom;
    const innerWidth = this.width - this.margin.left - this.margin.right;
    if (innerHeight <= 0 || innerWidth <= 0) {
      this.bars = [];
      this.cdr.markForCheck();
      return;
    }

    const y = linearScale(min, max || 1, this.margin.top + innerHeight, this.margin.top);
    const labels = this.data.map(d => d.label);
    const band = bandScale(labels, this.margin.left, this.margin.left + innerWidth, 0.35);

    this.bars = this.data.map((d, idx) => {
      const centerX = band.position(d.label) + band.bandwidth / 2;
      const tickWidth = Math.max(6, band.bandwidth * 0.3);
      const color = d.color || '#22c55e';
      return {
        x: band.position(d.label),
        width: band.bandwidth,
        centerX,
        highY: y(d.high),
        lowY: y(d.low),
        openY: y(d.open),
        closeY: y(d.close),
        openX1: centerX - tickWidth,
        openX2: centerX,
        closeX1: centerX,
        closeX2: centerX + tickWidth,
        label: d.label,
        open: d.open,
        close: d.close,
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

  showTooltip(event: MouseEvent, bar: OhlcShape): void {
    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    this.tooltip = {
      visible: true,
      x: event.clientX - rect.left + 12,
      y: event.clientY - rect.top - 24,
      label: bar.label,
      open: formatNumber(bar.open, true),
      close: formatNumber(bar.close, true)
    };
  }

  hideTooltip(): void {
    this.tooltip.visible = false;
  }

  onBarClick(bar: OhlcShape): void {
    this.itemClick.emit({ label: bar.label, value: bar.close });
  }

  export(kind: 'png' | 'svg'): void {
    if (!this.svgRef) return;
    downloadChart(this.svgRef.nativeElement, this.exportName, kind);
  }

  exportCsv(): void {
    downloadCsvSmart(this.exportName, inferCsvPayload(this as LooseValue));
  }
}
