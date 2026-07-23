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
import { ChartDatum, DumbbellDatum } from './chart-types';
import { formatNumber, linearScale } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type DumbbellPoint = {
  x1: number;
  x2: number;
  y: number;
  label: string;
  start: number;
  end: number;
  color: string;
};

@Component({
  selector: 'engineers-salary-reference-dumbbell-chart',
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
        <g class="dumbbell-lines">
          @for (point of points; track point) {
            <line
              class="dumbbell-line"
              [attr.x1]="point.x1"
              [attr.x2]="point.x2"
              [attr.y1]="point.y"
              [attr.y2]="point.y"
              [attr.stroke]="point.color"
            ></line>
          }
        </g>
        <g class="dumbbell-dots">
          @for (point of points; track point) {
            <circle
              class="dumbbell-dot"
              [attr.cx]="point.x1"
              [attr.cy]="point.y"
              [attr.r]="5"
              [attr.fill]="point.color"
              (click)="onPointClick(point)"
              (mousemove)="showTooltip($event, point, 'start')"
              (mouseleave)="hideTooltip()"
            ></circle>
          }
          @for (point of points; track point) {
            <circle
              class="dumbbell-dot end"
              [attr.cx]="point.x2"
              [attr.cy]="point.y"
              [attr.r]="5"
              [attr.fill]="point.color"
              (click)="onPointClick(point)"
              (mousemove)="showTooltip($event, point, 'end')"
              (mouseleave)="hideTooltip()"
            ></circle>
          }
        </g>
        <g class="dumbbell-labels">
          @for (point of points; track point) {
            <text
              class="dumbbell-label"
              [attr.x]="margin.left - 8"
              [attr.y]="point.y + 4"
              text-anchor="end"
            >
              {{ point.label }}
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
      @if (!points.length) {
        <div class="chart-empty">No data</div>
      }
    </div>
  `,
  styleUrls: ['./chart-base.css'],
  styles: [
    `
      .dumbbell-line {
        stroke-width: 2;
        opacity: 0.6;
      }
      .dumbbell-dot {
        stroke: rgba(0, 0, 0, 0.2);
        stroke-width: 1;
        cursor: pointer;
      }
      .dumbbell-dot.end {
        opacity: 0.9;
      }
      .dumbbell-label {
        font-size: 10px;
        fill: rgb(var(--muted));
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryDumbbellChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data: DumbbellDatum[] = [];
  @Input() height = 240;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 420;
  margin = { top: 16, right: 16, bottom: 16, left: 120 };
  points: DumbbellPoint[] = [];
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
      this.points = [];
      this.cdr.markForCheck();
      return;
    }

    const values = this.data.flatMap(item => [item.start, item.end]);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);
    const innerHeight = this.height - this.margin.top - this.margin.bottom;
    const step = innerHeight / Math.max(this.data.length, 1);
    const y = (idx: number) => this.margin.top + idx * step + step / 2;
    const xScale = linearScale(min, max || 1, this.margin.left, this.width - this.margin.right);

    this.points = this.data.map((item, idx) => ({
      x1: xScale(item.start),
      x2: xScale(item.end),
      y: y(idx),
      label: item.label,
      start: item.start,
      end: item.end,
      color: item.color || '#60a5fa'
    }));
    this.cdr.markForCheck();
  }

  showTooltip(event: MouseEvent, point: DumbbellPoint, mode: 'start' | 'end'): void {
    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    const value = mode === 'start' ? point.start : point.end;
    this.tooltip = {
      visible: true,
      x: event.clientX - rect.left + 12,
      y: event.clientY - rect.top - 24,
      label: point.label,
      value: formatNumber(value, true)
    };
  }

  hideTooltip(): void {
    this.tooltip.visible = false;
  }

  onPointClick(point: DumbbellPoint): void {
    this.itemClick.emit({ label: point.label, value: point.end });
  }

  export(kind: 'png' | 'svg'): void {
    if (!this.svgRef) return;
    downloadChart(this.svgRef.nativeElement, this.exportName, kind);
  }

  exportCsv(): void {
    downloadCsvSmart(this.exportName, inferCsvPayload(this as LooseValue));
  }
}
