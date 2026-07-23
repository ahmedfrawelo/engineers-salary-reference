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
import { ChartDatum, HeatmapDatum } from './chart-types';
import { bandScale, colorRamp, formatNumber } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type HeatCell = {
  xKey: string;
  yKey: string;
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
  label: string;
  fill: string;
};

@Component({
  selector: 'engineers-salary-reference-heatmap-chart',
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
        <g class="heatmap-cells">
          @for (cell of cells; track cell) {
            <rect
              class="heatmap-cell"
              [attr.x]="cell.x"
              [attr.y]="cell.y"
              [attr.width]="cell.width"
              [attr.height]="cell.height"
              [attr.rx]="4"
              [attr.ry]="4"
              [attr.fill]="cell.fill"
              (click)="onCellClick(cell)"
              (mousemove)="showTooltip($event, cell)"
              (mouseleave)="hideTooltip()"
            ></rect>
          }
        </g>
        <g class="chart-axis axis-x">
          @for (label of xLabels; track label) {
            <text [attr.x]="label.x" [attr.y]="height - 8" text-anchor="middle">
              {{ label.label }}
            </text>
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
      @if (!cells.length) {
        <div class="chart-empty">No data</div>
      }
    </div>
  `,
  styleUrls: ['./chart-base.css'],
  styles: [
    `
      .heatmap-cell {
        stroke: rgba(0, 0, 0, 0.12);
        stroke-width: 1;
        transition: opacity 0.2s ease;
        cursor: pointer;
      }
      .heatmap-cell:hover {
        opacity: 0.9;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryHeatmapChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data: HeatmapDatum[] = [];
  @Input() height = 260;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 420;
  margin = { top: 16, right: 16, bottom: 28, left: 70 };
  cells: HeatCell[] = [];
  xLabels: { x: number; label: string }[] = [];
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
    if (!this.data.length) {
      this.cells = [];
      this.xLabels = [];
      this.yLabels = [];
      this.cdr.markForCheck();
      return;
    }

    const xKeys = Array.from(new Set(this.data.map(d => d.x)));
    const yKeys = Array.from(new Set(this.data.map(d => d.y)));
    const values = this.data.map(d => d.value);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);

    const innerHeight = this.height - this.margin.top - this.margin.bottom;
    const innerWidth = this.width - this.margin.left - this.margin.right;
    if (innerHeight <= 0 || innerWidth <= 0) {
      this.cells = [];
      this.xLabels = [];
      this.yLabels = [];
      this.cdr.markForCheck();
      return;
    }

    const xScale = bandScale(xKeys, this.margin.left, this.margin.left + innerWidth, 0.2);
    const yScale = bandScale(yKeys, this.margin.top, this.margin.top + innerHeight, 0.2);

    this.cells = this.data.map(d => ({
      xKey: d.x,
      yKey: d.y,
      x: xScale.position(d.x),
      y: yScale.position(d.y),
      width: xScale.bandwidth,
      height: yScale.bandwidth,
      value: d.value,
      label: `${d.y} / ${d.x}`,
      fill: d.color || colorRamp(d.value, min, max, '#0f172a', '#22c55e')
    }));

    this.xLabels = xKeys.map(label => ({
      label,
      x: xScale.position(label) + xScale.bandwidth / 2
    }));
    this.yLabels = yKeys.map(label => ({
      label,
      y: yScale.position(label) + yScale.bandwidth / 2 + 4
    }));
    this.cdr.markForCheck();
  }

  showTooltip(event: MouseEvent, cell: HeatCell): void {
    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    this.tooltip = {
      visible: true,
      x: event.clientX - rect.left + 12,
      y: event.clientY - rect.top - 24,
      label: cell.label,
      value: formatNumber(cell.value)
    };
  }

  hideTooltip(): void {
    this.tooltip.visible = false;
  }

  onCellClick(cell: HeatCell): void {
    this.itemClick.emit({
      label: cell.label,
      value: cell.value,
      meta: { x: cell.xKey, y: cell.yKey }
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
