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
import { ChartDatum, LineSeries } from './chart-types';
import { bandScale, formatNumber, niceTicks, linearScale, CHART_PALETTE } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type LinePoint = { x: number; y: number; value: number; label: string };
type LinePath = { path: string; areaPath: string; color: string; label: string };

@Component({
  selector: 'engineers-salary-reference-line-chart',
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

        <g class="line-areas">
          @for (line of lines; track line) {
            <ng-container>
              @if (line.areaPath) {
                <path
                  class="line-area"
                  [attr.d]="line.areaPath"
                  [attr.fill]="line.color"
                  [attr.fill-opacity]="0.16"
                ></path>
              }
            </ng-container>
          }
        </g>

        <g class="line-series">
          @for (line of lines; track line) {
            <path class="line-path" [attr.d]="line.path" [attr.stroke]="line.color"></path>
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

        <g class="hover-zones">
          @for (zone of hoverZones; track zone) {
            <rect
              class="hover-zone"
              [attr.x]="zone.x"
              [attr.y]="margin.top"
              [attr.width]="zone.width"
              [attr.height]="height - margin.top - margin.bottom"
              (click)="onZoneClick(zone.index)"
              (mousemove)="showTooltip($event, zone.index)"
              (mouseleave)="hideTooltip()"
            ></rect>
          }
        </g>
        @if (hoverIndex !== null) {
          <line
            class="hover-line"
            [attr.x1]="hoverX"
            [attr.x2]="hoverX"
            [attr.y1]="margin.top"
            [attr.y2]="height - margin.bottom"
          ></line>
        }
      </svg>

      @if (tooltip.visible) {
        <div class="chart-tooltip" [style.left.px]="tooltip.x" [style.top.px]="tooltip.y">
          <span class="label">{{ tooltip.label }}</span>
          @for (row of tooltip.rows; track row) {
            <div class="value">
              <span class="dot" [style.background]="row.color"></span>
              {{ row.label }}: {{ row.value }}
            </div>
          }
        </div>
      }
      @if (!lines.length) {
        <div class="chart-empty">No data</div>
      }
      @if (showLegend && series.length) {
        <div class="chart-legend">
          @for (item of series; track item) {
            <div class="legend-item" [class.off]="isHidden(item)" (click)="toggleSeries(item)">
              <span class="legend-dot" [style.background]="item.color || defaultColor(item)"></span>
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
      .line-path {
        fill: none;
        stroke-width: 2.2;
      }
      .hover-zone {
        fill: transparent;
        cursor: crosshair;
      }
      .hover-line {
        stroke: rgba(var(--primary), 0.45);
        stroke-dasharray: 4 6;
      }
      .chart-tooltip .dot {
        display: inline-block;
        width: 6px;
        height: 6px;
        border-radius: 999px;
        margin-right: 6px;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryLineChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() labels: string[] = [];
  @Input() series: LineSeries[] = [];
  @Input() height = 220;
  @Input() compactTicks = false;
  @Input() showLegend = true;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 640;
  margin = { top: 24, right: 16, bottom: 28, left: 44 };
  lines: LinePath[] = [];
  yTicks: { y: number; label: string }[] = [];
  xLabels: { x: number; label: string }[] = [];
  hoverZones: { x: number; width: number; index: number }[] = [];
  hoverIndex: number | null = null;
  hoverX = 0;

  tooltip = {
    visible: false,
    x: 0,
    y: 0,
    label: '',
    rows: [] as Array<{ label: string; value: string; color: string }>
  };

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
    const height = this.height;
    const labels = this.labels;
    const visibleSeries = this.series.filter(series => !this.hidden.has(series.label));
    const values = visibleSeries.flatMap(s => s.values);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);

    const innerHeight = height - this.margin.top - this.margin.bottom;
    const innerWidth = this.width - this.margin.left - this.margin.right;
    if (innerHeight <= 0 || innerWidth <= 0 || !labels.length) {
      this.lines = [];
      this.yTicks = [];
      this.xLabels = [];
      this.hoverZones = [];
      this.cdr.markForCheck();
      return;
    }

    const y = linearScale(min, max || 1, this.margin.top + innerHeight, this.margin.top);
    const band = bandScale(labels, this.margin.left, this.margin.left + innerWidth, 0.3);

    this.lines = visibleSeries.map(series => {
      const baseIndex = this.series.findIndex(s => s.label === series.label);
      const paletteIndex = baseIndex >= 0 ? baseIndex % CHART_PALETTE.length : 0;
      const color = series.color || CHART_PALETTE[paletteIndex];
      const points: LinePoint[] = labels.map((label, i) => ({
        label,
        value: series.values[i] ?? 0,
        x: band.position(label) + band.bandwidth / 2,
        y: y(series.values[i] ?? 0)
      }));
      const path = points.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x},${pt.y}`).join(' ');
      const baseY = this.margin.top + innerHeight;
      const areaPath = series.area
        ? `${path} L${points[points.length - 1]?.x ?? this.margin.left},${baseY} L${points[0]?.x ?? this.margin.left},${baseY} Z`
        : '';
      return { path, areaPath, color, label: series.label };
    });

    const ticks = niceTicks(min, max, 5);
    this.yTicks = ticks.map(v => ({
      y: y(v),
      label: formatNumber(v, this.compactTicks)
    }));

    this.xLabels = labels.map(label => ({
      label,
      x: band.position(label) + band.bandwidth / 2
    }));

    this.hoverZones = labels.map((_, idx) => ({
      x: band.position(labels[idx]) - band.step * 0.15,
      width: band.step * 1.3,
      index: idx
    }));
    if (this.hoverIndex != null) {
      this.hoverX = band.position(labels[this.hoverIndex] ?? labels[0]) + band.bandwidth / 2;
    }
    this.cdr.markForCheck();
  }

  showTooltip(event: MouseEvent, index: number): void {
    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    const label = this.labels[index] ?? '';
    const rows = this.series
      .filter(series => !this.hidden.has(series.label))
      .map(series => {
        const baseIndex = this.series.findIndex(s => s.label === series.label);
        const paletteIndex = baseIndex >= 0 ? baseIndex % CHART_PALETTE.length : 0;
        return {
          label: series.label,
          value: formatNumber(series.values[index] ?? 0),
          color: series.color || CHART_PALETTE[paletteIndex]
        };
      });
    this.tooltip = {
      visible: true,
      x: event.clientX - rect.left + 12,
      y: event.clientY - rect.top - 24,
      label,
      rows
    };
    this.hoverIndex = index;
    if (this.hoverZones[index]) {
      this.hoverX = this.hoverZones[index].x + this.hoverZones[index].width / 2;
    }
  }

  hideTooltip(): void {
    this.tooltip.visible = false;
    this.hoverIndex = null;
  }

  onZoneClick(index: number): void {
    const label = this.labels[index] ?? '';
    const rows = this.series
      .filter(series => !this.hidden.has(series.label))
      .map(series => {
        const baseIndex = this.series.findIndex(s => s.label === series.label);
        const paletteIndex = baseIndex >= 0 ? baseIndex % CHART_PALETTE.length : 0;
        const value = series.values[index] ?? 0;
        return {
          label: series.label,
          value,
          color: series.color || CHART_PALETTE[paletteIndex]
        };
      });
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    this.itemClick.emit({
      label,
      value: total,
      meta: { series: rows }
    });
  }

  toggleSeries(item: LineSeries): void {
    if (this.hidden.has(item.label)) {
      this.hidden.delete(item.label);
    } else {
      this.hidden.add(item.label);
    }
    this.reflow();
  }

  isHidden(item: LineSeries): boolean {
    return this.hidden.has(item.label);
  }

  defaultColor(item: LineSeries): string {
    const index = this.series.findIndex(series => series.label === item.label);
    return CHART_PALETTE[(index < 0 ? 0 : index) % CHART_PALETTE.length];
  }

  export(kind: 'png' | 'svg'): void {
    if (!this.svgRef) return;
    downloadChart(this.svgRef.nativeElement, this.exportName, kind);
  }

  exportCsv(): void {
    downloadCsvSmart(this.exportName, inferCsvPayload(this as LooseValue));
  }
}
