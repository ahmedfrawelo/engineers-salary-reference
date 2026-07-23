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
import { BoxplotDatum, ChartDatum } from './chart-types';
import { bandScale, formatNumber, linearScale, niceTicks } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type BoxShape = {
  x: number;
  width: number;
  minY: number;
  maxY: number;
  q1Y: number;
  q3Y: number;
  medianY: number;
  label: string;
  stats: BoxplotDatum;
};

@Component({
  selector: 'engineers-salary-reference-boxplot-chart',
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

        <g class="boxplot-series">
          @for (box of boxes; track box) {
            <g
              (click)="onBoxClick(box)"
              (mousemove)="showTooltip($event, box)"
              (mouseleave)="hideTooltip()"
            >
              <line
                class="box-whisker"
                [attr.x1]="box.x + box.width / 2"
                [attr.x2]="box.x + box.width / 2"
                [attr.y1]="box.minY"
                [attr.y2]="box.maxY"
              ></line>
              <rect
                class="box-rect"
                [attr.x]="box.x"
                [attr.y]="box.q3Y"
                [attr.width]="box.width"
                [attr.height]="box.q1Y - box.q3Y"
                [attr.rx]="4"
                [attr.ry]="4"
              ></rect>
              <line
                class="box-median"
                [attr.x1]="box.x"
                [attr.x2]="box.x + box.width"
                [attr.y1]="box.medianY"
                [attr.y2]="box.medianY"
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
          <div class="value">min: {{ tooltip.min }}</div>
          <div class="value">Q1: {{ tooltip.q1 }}</div>
          <div class="value">median: {{ tooltip.median }}</div>
          <div class="value">Q3: {{ tooltip.q3 }}</div>
          <div class="value">max: {{ tooltip.max }}</div>
        </div>
      }
      @if (!boxes.length) {
        <div class="chart-empty">No data</div>
      }
    </div>
  `,
  styleUrls: ['./chart-base.css'],
  styles: [
    `
      .box-whisker {
        stroke: rgba(var(--primary), 0.7);
        stroke-width: 2;
      }
      .box-rect {
        fill: rgba(var(--primary), 0.2);
        stroke: rgba(var(--primary), 0.9);
        stroke-width: 1.5;
      }
      .boxplot-series g {
        cursor: pointer;
      }
      .box-median {
        stroke: rgba(var(--primary), 0.95);
        stroke-width: 2;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryBoxplotChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data: BoxplotDatum[] = [];
  @Input() height = 340;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 640;
  margin = { top: 24, right: 12, bottom: 28, left: 44 };
  boxes: BoxShape[] = [];
  yTicks: { y: number; label: string }[] = [];
  xLabels: { x: number; label: string }[] = [];

  tooltip = { visible: false, x: 0, y: 0, label: '', min: '', q1: '', median: '', q3: '', max: '' };

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
    const height = this.height;
    const labels = this.data.map(d => d.label);
    const values = this.data.flatMap(d => [d.min, d.max]);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);

    const innerHeight = height - this.margin.top - this.margin.bottom;
    const innerWidth = this.width - this.margin.left - this.margin.right;
    if (innerHeight <= 0 || innerWidth <= 0) {
      this.boxes = [];
      this.yTicks = [];
      this.xLabels = [];
      return;
    }

    const y = linearScale(min, max || 1, this.margin.top + innerHeight, this.margin.top);
    const band = bandScale(labels, this.margin.left, this.margin.left + innerWidth, 0.35);

    this.boxes = this.data.map(d => ({
      x: band.position(d.label),
      width: band.bandwidth,
      minY: y(d.min),
      maxY: y(d.max),
      q1Y: y(d.q1),
      q3Y: y(d.q3),
      medianY: y(d.median),
      label: d.label,
      stats: d
    }));

    const ticks = niceTicks(min, max, 5);
    this.yTicks = ticks.map(v => ({ y: y(v), label: formatNumber(v) }));
    this.xLabels = labels.map(label => ({
      label,
      x: band.position(label) + band.bandwidth / 2
    }));
    this.cdr.markForCheck();
  }

  showTooltip(event: MouseEvent, box: BoxShape): void {
    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    const stats = box.stats;
    this.tooltip = {
      visible: true,
      x: event.clientX - rect.left + 12,
      y: event.clientY - rect.top - 24,
      label: box.label,
      min: formatNumber(stats.min),
      q1: formatNumber(stats.q1),
      median: formatNumber(stats.median),
      q3: formatNumber(stats.q3),
      max: formatNumber(stats.max)
    };
  }

  hideTooltip(): void {
    this.tooltip.visible = false;
  }

  onBoxClick(box: BoxShape): void {
    this.itemClick.emit({ label: box.label, value: box.stats.median });
  }

  export(kind: 'png' | 'svg'): void {
    if (!this.svgRef) return;
    downloadChart(this.svgRef.nativeElement, this.exportName, kind);
  }

  exportCsv(): void {
    downloadCsvSmart(this.exportName, inferCsvPayload(this as LooseValue));
  }
}
