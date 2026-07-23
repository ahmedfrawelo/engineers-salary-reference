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
import { CandlestickDatum, ChartDatum } from './chart-types';
import { bandScale, formatNumber, linearScale, niceTicks } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type CandleShape = {
  x: number;
  width: number;
  highY: number;
  lowY: number;
  openY: number;
  closeY: number;
  bodyY: number;
  bodyHeight: number;
  label: string;
  open: number;
  close: number;
  color: string;
  positive: boolean;
};

@Component({
  selector: 'engineers-salary-reference-candlestick-chart',
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
        <g class="candles">
          @for (candle of candles; track candle) {
            <g
              (click)="onCandleClick(candle)"
              (mousemove)="showTooltip($event, candle)"
              (mouseleave)="hideTooltip()"
            >
              <line
                class="candle-wick"
                [attr.x1]="candle.x + candle.width / 2"
                [attr.x2]="candle.x + candle.width / 2"
                [attr.y1]="candle.highY"
                [attr.y2]="candle.lowY"
                [attr.stroke]="candle.color"
              ></line>
              <rect
                class="candle-body"
                [class.positive]="candle.positive"
                [attr.x]="candle.x"
                [attr.y]="candle.bodyY"
                [attr.width]="candle.width"
                [attr.height]="candle.bodyHeight"
                [attr.fill]="candle.color"
              ></rect>
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
      @if (!candles.length) {
        <div class="chart-empty">No data</div>
      }
    </div>
  `,
  styleUrls: ['./chart-base.css'],
  styles: [
    `
      .candle-wick {
        stroke-width: 2;
        opacity: 0.9;
      }
      .candle-body {
        opacity: 0.85;
        cursor: pointer;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryCandlestickChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data: CandlestickDatum[] = [];
  @Input() height = 260;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 420;
  margin = { top: 24, right: 16, bottom: 28, left: 50 };
  candles: CandleShape[] = [];
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
      this.candles = [];
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
      this.candles = [];
      this.cdr.markForCheck();
      return;
    }

    const y = linearScale(min, max || 1, this.margin.top + innerHeight, this.margin.top);
    const labels = this.data.map(d => d.label);
    const band = bandScale(labels, this.margin.left, this.margin.left + innerWidth, 0.3);

    this.candles = this.data.map((d, idx) => {
      const positive = d.close >= d.open;
      const color = d.color || (positive ? '#22c55e' : '#ef4444');
      const openY = y(d.open);
      const closeY = y(d.close);
      const bodyY = Math.min(openY, closeY);
      const bodyHeight = Math.max(2, Math.abs(closeY - openY));
      return {
        x: band.position(d.label),
        width: band.bandwidth,
        highY: y(d.high),
        lowY: y(d.low),
        openY,
        closeY,
        bodyY,
        bodyHeight,
        label: d.label,
        open: d.open,
        close: d.close,
        color,
        positive
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

  showTooltip(event: MouseEvent, candle: CandleShape): void {
    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    this.tooltip = {
      visible: true,
      x: event.clientX - rect.left + 12,
      y: event.clientY - rect.top - 24,
      label: candle.label,
      open: formatNumber(candle.open, true),
      close: formatNumber(candle.close, true)
    };
  }

  hideTooltip(): void {
    this.tooltip.visible = false;
  }

  onCandleClick(candle: CandleShape): void {
    this.itemClick.emit({ label: candle.label, value: candle.close });
  }

  export(kind: 'png' | 'svg'): void {
    if (!this.svgRef) return;
    downloadChart(this.svgRef.nativeElement, this.exportName, kind);
  }

  exportCsv(): void {
    downloadCsvSmart(this.exportName, inferCsvPayload(this as LooseValue));
  }
}
