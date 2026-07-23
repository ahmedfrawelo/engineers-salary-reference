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
import { ChartDatum, RadarSeries } from './chart-types';
import { CHART_PALETTE } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type RadarPath = { path: string; color: string; label: string; values: number[] };

@Component({
  selector: 'engineers-salary-reference-radar-chart',
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
        <g class="radar-grid">
          @for (ring of rings; track ring) {
            <path class="radar-ring" [attr.d]="ring"></path>
          }
          @for (axis of axesLines; track axis) {
            <line
              class="radar-axis"
              [attr.x1]="axis.x1"
              [attr.y1]="axis.y1"
              [attr.x2]="axis.x2"
              [attr.y2]="axis.y2"
            ></line>
          }
        </g>
        <g class="radar-areas">
          @for (radar of polygons; track radar) {
            <path
              class="radar-area"
              [attr.d]="radar.path"
              [attr.fill]="radar.color"
              [attr.stroke]="radar.color"
              (click)="onPolygonClick(radar)"
            ></path>
          }
        </g>
        <g class="radar-labels">
          @for (label of axisLabels; track label) {
            <text class="radar-label" [attr.x]="label.x" [attr.y]="label.y">{{ label.label }}</text>
          }
        </g>
      </svg>

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
      @if (!polygons.length) {
        <div class="chart-empty">No data</div>
      }
    </div>
  `,
  styleUrls: ['./chart-base.css'],
  styles: [
    `
      .radar-ring {
        fill: none;
        stroke: rgba(var(--border), 0.35);
        stroke-width: 1;
      }
      .radar-axis {
        stroke: rgba(var(--border), 0.35);
        stroke-width: 1;
      }
      .radar-area {
        fill-opacity: 0.15;
        stroke-width: 2;
        cursor: pointer;
      }
      .radar-label {
        font-size: 10px;
        fill: rgb(var(--muted));
        text-anchor: middle;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryRadarChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() axes: string[] = [];
  @Input() series: RadarSeries[] = [];
  @Input() height = 260;
  @Input() max = 0;
  @Input() levels = 4;
  @Input() showLegend = true;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 320;
  rings: string[] = [];
  polygons: RadarPath[] = [];
  axesLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  axisLabels: { x: number; y: number; label: string }[] = [];

  private ro?: ResizeObserver;
  private hidden = new Set<string>();
  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.observe();
    this.reflow();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['axes'] || changes['series'] || changes['height'] || changes['max']) {
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
        const nextWidth = Math.max(entry.contentRect.width, 240);
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
      this.width = Math.max(host.clientWidth || 0, 240);
    }
    if (!this.axes.length || !this.series.length) {
      this.rings = [];
      this.polygons = [];
      this.axesLines = [];
      this.axisLabels = [];
      this.cdr.markForCheck();
      return;
    }

    const count = this.axes.length;
    const center = { x: this.width / 2, y: this.height / 2 };
    const radius = Math.min(this.width, this.height) / 2 - 20;
    const visibleSeries = this.series.filter(series => !this.hidden.has(series.label));
    const maxValue = this.max || Math.max(...visibleSeries.flatMap(s => s.values), 1);
    const levels = Math.max(2, this.levels);

    this.rings = [];
    for (let i = 1; i <= levels; i += 1) {
      const r = (radius * i) / levels;
      const ringPath =
        this.axes
          .map((_, idx) => {
            const angle = (Math.PI * 2 * idx) / count - Math.PI / 2;
            const x = center.x + Math.cos(angle) * r;
            const y = center.y + Math.sin(angle) * r;
            return `${idx === 0 ? 'M' : 'L'}${x} ${y}`;
          })
          .join(' ') + ' Z';
      this.rings.push(ringPath);
    }

    this.axesLines = this.axes.map((_, idx) => {
      const angle = (Math.PI * 2 * idx) / count - Math.PI / 2;
      return {
        x1: center.x,
        y1: center.y,
        x2: center.x + Math.cos(angle) * radius,
        y2: center.y + Math.sin(angle) * radius
      };
    });

    this.axisLabels = this.axes.map((label, idx) => {
      const angle = (Math.PI * 2 * idx) / count - Math.PI / 2;
      const x = center.x + Math.cos(angle) * (radius + 12);
      const y = center.y + Math.sin(angle) * (radius + 12);
      return { x, y, label };
    });

    this.polygons = visibleSeries.map(series => {
      const idx = this.series.findIndex(s => s.label === series.label);
      const path =
        this.axes
          .map((_, i) => {
            const value = series.values[i] ?? 0;
            const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
            const r = radius * (value / (maxValue || 1));
            const x = center.x + Math.cos(angle) * r;
            const y = center.y + Math.sin(angle) * r;
            return `${i === 0 ? 'M' : 'L'}${x} ${y}`;
          })
          .join(' ') + ' Z';
      return {
        path,
        color: series.color || CHART_PALETTE[idx % CHART_PALETTE.length],
        label: series.label,
        values: [...series.values]
      };
    });
    this.cdr.markForCheck();
  }

  onPolygonClick(radar: RadarPath): void {
    const avg = radar.values.length
      ? radar.values.reduce((sum, value) => sum + value, 0) / radar.values.length
      : 0;
    this.itemClick.emit({
      label: radar.label,
      value: avg,
      color: radar.color,
      meta: { values: radar.values }
    });
  }

  export(kind: 'png' | 'svg'): void {
    if (!this.svgRef) return;
    downloadChart(this.svgRef.nativeElement, this.exportName, kind);
  }

  exportCsv(): void {
    downloadCsvSmart(this.exportName, inferCsvPayload(this as LooseValue));
  }

  defaultColor(item: RadarSeries): string {
    const index = this.series.findIndex(s => s.label === item.label);
    return CHART_PALETTE[index >= 0 ? index % CHART_PALETTE.length : 0];
  }

  isHidden(item: RadarSeries): boolean {
    return this.hidden.has(item.label);
  }

  toggleSeries(item: RadarSeries): void {
    if (this.hidden.has(item.label)) {
      this.hidden.delete(item.label);
    } else {
      this.hidden.add(item.label);
    }
    this.reflow();
  }
}
