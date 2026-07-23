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
import { ChartDatum, PyramidDatum } from './chart-types';
import { formatNumber, linearScale } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type PyramidBar = {
  y: number;
  height: number;
  label: string;
  leftWidth: number;
  rightWidth: number;
  leftValue: number;
  rightValue: number;
  color: string;
};

@Component({
  selector: 'engineers-salary-reference-pyramid-chart',
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
        <line
          class="pyramid-axis"
          [attr.x1]="centerX"
          [attr.x2]="centerX"
          [attr.y1]="margin.top"
          [attr.y2]="height - margin.bottom"
        ></line>
        <g class="pyramid-bars">
          @for (bar of bars; track bar) {
            <g
              (click)="onBarClick(bar)"
              (mousemove)="showTooltip($event, bar)"
              (mouseleave)="hideTooltip()"
            >
              <rect
                class="pyramid-bar left"
                [attr.x]="centerX - bar.leftWidth"
                [attr.y]="bar.y"
                [attr.width]="bar.leftWidth"
                [attr.height]="bar.height"
                [attr.fill]="bar.color"
              ></rect>
              <rect
                class="pyramid-bar right"
                [attr.x]="centerX"
                [attr.y]="bar.y"
                [attr.width]="bar.rightWidth"
                [attr.height]="bar.height"
                [attr.fill]="bar.color"
              ></rect>
              <text
                class="pyramid-label"
                [attr.x]="centerX - bar.leftWidth - 6"
                [attr.y]="bar.y + bar.height / 2 + 4"
                text-anchor="end"
              >
                {{ bar.label }}
              </text>
            </g>
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
      .pyramid-axis {
        stroke: rgba(var(--border), 0.5);
        stroke-width: 1;
      }
      .pyramid-bar {
        opacity: 0.85;
      }
      .pyramid-bars g {
        cursor: pointer;
      }
      .pyramid-label {
        font-size: 10px;
        fill: rgb(var(--muted));
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryPyramidChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data: PyramidDatum[] = [];
  @Input() height = 240;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 420;
  margin = { top: 16, right: 16, bottom: 16, left: 60 };
  centerX = 0;
  bars: PyramidBar[] = [];
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
      this.bars = [];
      this.cdr.markForCheck();
      return;
    }

    const max = Math.max(...this.data.flatMap(item => [item.left, item.right]), 1);
    const innerHeight = this.height - this.margin.top - this.margin.bottom;
    const rowHeight = innerHeight / Math.max(this.data.length, 1);
    const halfWidth = (this.width - this.margin.left - this.margin.right) / 2;
    const scale = linearScale(0, max || 1, 0, halfWidth);
    this.centerX = this.margin.left + halfWidth;

    this.bars = this.data.map((item, idx) => ({
      y: this.margin.top + idx * rowHeight + 2,
      height: Math.max(8, rowHeight - 4),
      label: item.label,
      leftWidth: scale(item.left),
      rightWidth: scale(item.right),
      leftValue: item.left,
      rightValue: item.right,
      color: item.color || '#60a5fa'
    }));
    this.cdr.markForCheck();
  }

  showTooltip(event: MouseEvent, bar: PyramidBar): void {
    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    this.tooltip = {
      visible: true,
      x: event.clientX - rect.left + 12,
      y: event.clientY - rect.top - 24,
      label: bar.label,
      value: `${formatNumber(bar.leftValue, true)} | ${formatNumber(bar.rightValue, true)}`
    };
  }

  hideTooltip(): void {
    this.tooltip.visible = false;
  }

  onBarClick(bar: PyramidBar): void {
    this.itemClick.emit({ label: bar.label, value: bar.leftValue + bar.rightValue });
  }

  export(kind: 'png' | 'svg'): void {
    if (!this.svgRef) return;
    downloadChart(this.svgRef.nativeElement, this.exportName, kind);
  }

  exportCsv(): void {
    downloadCsvSmart(this.exportName, inferCsvPayload(this as LooseValue));
  }
}
