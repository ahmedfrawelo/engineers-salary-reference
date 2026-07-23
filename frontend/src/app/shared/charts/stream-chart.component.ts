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
import { CHART_PALETTE, formatNumber, linearScale, niceTicks } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type StreamArea = {
  areaPath: string;
  linePath: string;
  color: string;
  label: string;
  values: number[];
  total: number;
};

@Component({
  selector: 'engineers-salary-reference-stream-chart',
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
        <g class="stream-areas">
          @for (area of areas; track area) {
            <path
              class="stream-area"
              [attr.d]="area.areaPath"
              [attr.fill]="area.color"
              (click)="onAreaClick(area)"
            ></path>
          }
          @for (area of areas; track area) {
            <path class="stream-line" [attr.d]="area.linePath" [attr.stroke]="area.color"></path>
          }
        </g>
        <g class="chart-axis axis-y">
          @for (tick of yTicks; track tick) {
            <text [attr.x]="margin.left - 8" [attr.y]="tick.y + 4" text-anchor="end">
              {{ tick.label }}
            </text>
          }
        </g>
      </svg>

      @if (!areas.length) {
        <div class="chart-empty">No data</div>
      }
      @if (legend.length) {
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
      .stream-area {
        fill-opacity: 0.22;
        cursor: pointer;
      }
      .stream-line {
        fill: none;
        stroke-width: 2;
        opacity: 0.9;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryStreamChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() labels: string[] = [];
  @Input() series: StackedSeries[] = [];
  @Input() height = 240;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 420;
  margin = { top: 24, right: 16, bottom: 20, left: 44 };
  areas: StreamArea[] = [];
  yTicks: { y: number; label: string }[] = [];
  legend: { label: string; color: string }[] = [];

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
      this.areas = [];
      this.yTicks = [];
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
    if (innerHeight <= 0 || innerWidth <= 0) {
      this.areas = [];
      this.cdr.markForCheck();
      return;
    }

    const y = linearScale(0, max, this.margin.top + innerHeight, this.margin.top);
    const step = this.labels.length > 1 ? innerWidth / (this.labels.length - 1) : 0;
    const xPositions = this.labels.map((_, idx) => this.margin.left + idx * step);

    const stacks = this.labels.map((_, idx) => {
      let acc = 0;
      return visibleSeries.map(s => {
        const v = s.values[idx] ?? 0;
        const start = acc;
        acc += v;
        return { start, end: acc };
      });
    });

    this.areas = visibleSeries.map(series => {
      const sIdx = this.series.findIndex(s => s.label === series.label);
      const values = series.values.map(value => value ?? 0);
      const total = values.reduce((sum, value) => sum + value, 0);
      const top = stacks.map((row, idx) => ({
        x: xPositions[idx],
        y: y(row[sIdx].end)
      }));
      const bottom = stacks
        .map((row, idx) => ({
          x: xPositions[idx],
          y: y(row[sIdx].start)
        }))
        .reverse();
      const areaPath = [
        `M ${top[0].x} ${top[0].y}`,
        ...top.slice(1).map(pt => `L ${pt.x} ${pt.y}`),
        ...bottom.map(pt => `L ${pt.x} ${pt.y}`),
        'Z'
      ].join(' ');
      const linePath = [
        `M ${top[0].x} ${top[0].y}`,
        ...top.slice(1).map(pt => `L ${pt.x} ${pt.y}`)
      ].join(' ');
      return {
        areaPath,
        linePath,
        color: series.color || CHART_PALETTE[sIdx % CHART_PALETTE.length],
        label: series.label,
        values,
        total
      };
    });

    const ticks = niceTicks(0, max, 4);
    this.yTicks = ticks.map(v => ({ y: y(v), label: formatNumber(v, true) }));
    this.legend = this.series.map((s, idx) => ({
      label: s.label,
      color: s.color || CHART_PALETTE[idx % CHART_PALETTE.length]
    }));
    this.cdr.markForCheck();
  }

  onAreaClick(area: StreamArea): void {
    this.itemClick.emit({
      label: area.label,
      value: area.total,
      color: area.color,
      meta: { values: area.values }
    });
  }

  export(kind: 'png' | 'svg'): void {
    if (!this.svgRef) return;
    downloadChart(this.svgRef.nativeElement, this.exportName, kind);
  }

  exportCsv(): void {
    downloadCsvSmart(this.exportName, inferCsvPayload(this as LooseValue));
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
}
