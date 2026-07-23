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
import { ChartDatum, StackedSeries } from './chart-types';
import { CHART_PALETTE, formatNumber, linearScale, niceTicks, bandScale } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type StackBar = {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  label: string;
  value: number;
};

@Component({
  selector: 'engineers-salary-reference-stacked-bar-chart',
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
        <g class="stack-bars">
          @for (bar of bars; track bar) {
            <rect
              class="stack-bar"
              [attr.x]="bar.x"
              [attr.y]="bar.y"
              [attr.width]="bar.width"
              [attr.height]="bar.height"
              [attr.rx]="3"
              [attr.ry]="3"
              [attr.fill]="bar.color"
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
      @if (series.length) {
        <div class="chart-legend">
          @for (item of legend; track item) {
            <div class="legend-item" [class.off]="isHidden(item)" (click)="toggleSeries(item)">
              <span class="legend-dot" [style.background]="item.color"></span>
              {{ item.label }}
            </div>
          }
        </div>
      }
    </div>
  `,
  styleUrls: ['./chart-base.css'],
  styles: [
    `
      .stack-bar {
        opacity: 0.9;
        transition: opacity 0.2s ease;
        cursor: pointer;
      }
      .stack-bar:hover {
        opacity: 1;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryStackedBarChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() labels: string[] = [];
  @Input() series: StackedSeries[] = [];
  @Input() height = 260;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 420;
  margin = { top: 24, right: 16, bottom: 28, left: 44 };
  bars: StackBar[] = [];
  xLabels: { x: number; label: string }[] = [];
  yTicks: { y: number; label: string }[] = [];
  legend: { label: string; color: string }[] = [];

  tooltip = { visible: false, x: 0, y: 0, label: '', value: '' };

  private ro?: ResizeObserver;
  private hidden = new Set<string>();
  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.observe();
    this.reflow();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['labels'] || changes['series'] || changes['height']) {
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
    if (!this.labels.length || !this.series.length) {
      this.bars = [];
      this.xLabels = [];
      this.yTicks = [];
      this.legend = [];
      this.cdr.markForCheck();
      return;
    }

    const visibleSeries = this.series.filter(series => !this.hidden.has(series.label));
    const totals = this.labels.map((_, idx) =>
      visibleSeries.reduce((sum, s) => sum + (s.values[idx] ?? 0), 0)
    );
    const max = Math.max(...totals, 1);
    const innerHeight = this.height - this.margin.top - this.margin.bottom;
    const innerWidth = this.width - this.margin.left - this.margin.right;
    const y = linearScale(0, max, this.margin.top + innerHeight, this.margin.top);
    const band = bandScale(this.labels, this.margin.left, this.margin.left + innerWidth, 0.25);

    const bars: StackBar[] = [];
    this.labels.forEach((label, idx) => {
      let acc = 0;
      visibleSeries.forEach((series, sIdx) => {
        const value = series.values[idx] ?? 0;
        const y0 = y(acc);
        acc += value;
        const y1 = y(acc);
        bars.push({
          x: band.position(label),
          y: Math.min(y0, y1),
          width: band.bandwidth,
          height: Math.abs(y1 - y0),
          color: series.color || CHART_PALETTE[sIdx % CHART_PALETTE.length],
          label: `${series.label} / ${label}`,
          value
        });
      });
    });
    this.bars = bars;

    const ticks = niceTicks(0, max, 5);
    this.yTicks = ticks.map(v => ({ y: y(v), label: formatNumber(v, true) }));
    this.xLabels = this.labels.map(label => ({
      label,
      x: band.position(label) + band.bandwidth / 2
    }));
    this.legend = this.series.map((s, idx) => ({
      label: s.label,
      color: s.color || CHART_PALETTE[idx % CHART_PALETTE.length]
    }));
    this.cdr.markForCheck();
  }

  showTooltip(event: MouseEvent, bar: StackBar): void {
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

  onBarClick(bar: StackBar): void {
    this.itemClick.emit({ label: bar.label, value: bar.value });
  }

  isHidden(item: { label: string }): boolean {
    return this.hidden.has(item.label);
  }

  toggleSeries(item: { label: string }): void {
    if (this.hidden.has(item.label)) {
      this.hidden.delete(item.label);
    } else {
      this.hidden.add(item.label);
    }
    this.reflow();
  }

  export(kind: 'png' | 'svg'): void {
    if (!this.svgRef) return;
    downloadChart(this.svgRef.nativeElement, this.exportName, kind);
  }

  exportCsv(): void {
    downloadCsvSmart(this.exportName, inferCsvPayload(this as LooseValue));
  }
}
