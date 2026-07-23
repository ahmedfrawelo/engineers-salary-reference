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
import { ChartDatum, GanttDatum } from './chart-types';
import { bandScale } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type GanttBar = {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  start: Date;
  end: Date;
  color: string;
};

@Component({
  selector: 'engineers-salary-reference-gantt-chart',
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
        <g class="gantt-bars">
          @for (bar of bars; track bar) {
            <rect
              class="gantt-bar"
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
      .gantt-bar {
        opacity: 0.85;
        cursor: pointer;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryGanttChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data: GanttDatum[] = [];
  @Input() height = 240;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 420;
  margin = { top: 12, right: 12, bottom: 12, left: 130 };
  bars: GanttBar[] = [];
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
    const parsed = this.data
      .map(item => ({
        label: item.label,
        start: toDate(item.start),
        end: toDate(item.end),
        color: item.color || '#22c55e'
      }))
      .filter(item => !Number.isNaN(item.start.getTime()) && !Number.isNaN(item.end.getTime()));
    if (!parsed.length) {
      this.bars = [];
      this.yLabels = [];
      this.cdr.markForCheck();
      return;
    }

    const minDate = new Date(Math.min(...parsed.map(p => p.start.getTime())));
    const maxDate = new Date(Math.max(...parsed.map(p => p.end.getTime())));
    const innerWidth = this.width - this.margin.left - this.margin.right;
    const innerHeight = this.height - this.margin.top - this.margin.bottom;
    if (innerWidth <= 0 || innerHeight <= 0) {
      this.bars = [];
      this.cdr.markForCheck();
      return;
    }

    const labels = parsed.map(p => p.label);
    const band = bandScale(labels, this.margin.top, this.margin.top + innerHeight, 0.3);
    const span = maxDate.getTime() - minDate.getTime() || 1;

    this.bars = parsed.map(item => {
      const x0 =
        this.margin.left + ((item.start.getTime() - minDate.getTime()) / span) * innerWidth;
      const x1 = this.margin.left + ((item.end.getTime() - minDate.getTime()) / span) * innerWidth;
      return {
        x: Math.min(x0, x1),
        y: band.position(item.label),
        width: Math.max(6, Math.abs(x1 - x0)),
        height: band.bandwidth,
        label: item.label,
        start: item.start,
        end: item.end,
        color: item.color
      };
    });

    this.yLabels = labels.map(label => ({
      label,
      y: band.position(label) + band.bandwidth / 2 + 4
    }));
    this.cdr.markForCheck();
  }

  showTooltip(event: MouseEvent, bar: GanttBar): void {
    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    this.tooltip = {
      visible: true,
      x: event.clientX - rect.left + 12,
      y: event.clientY - rect.top - 24,
      label: bar.label,
      value: `${bar.start.toLocaleDateString()} -> ${bar.end.toLocaleDateString()}`
    };
  }

  hideTooltip(): void {
    this.tooltip.visible = false;
  }

  onBarClick(bar: GanttBar): void {
    this.itemClick.emit({
      label: bar.label,
      value: bar.end.getTime(),
      meta: { start: bar.start, end: bar.end }
    });
  }

  export(kind: 'png' | 'svg'): void {
    if (!this.svgRef) return;
    downloadChart(this.svgRef.nativeElement, this.exportName, kind);
  }

  exportCsv(): void {
    downloadCsvSmart(this.exportName, inferCsvPayload(this as LooseValue));
  }
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}
