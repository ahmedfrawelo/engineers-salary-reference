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
import { BulletDatum, ChartDatum } from './chart-types';
import { formatNumber, linearScale } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type BulletBar = {
  y: number;
  width: number;
  label: string;
  value: number;
  target?: number;
  color: string;
};

@Component({
  selector: 'engineers-salary-reference-bullet-chart',
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
        <g class="bullet-bars">
          @for (bar of bars; track bar) {
            <g
              (click)="onBarClick(bar)"
              (mousemove)="showTooltip($event, bar)"
              (mouseleave)="hideTooltip()"
            >
              <rect
                class="bullet-track"
                [attr.x]="margin.left"
                [attr.y]="bar.y"
                [attr.width]="innerWidth"
                [attr.height]="rowHeight"
              ></rect>
              <rect
                class="bullet-value"
                [attr.x]="margin.left"
                [attr.y]="bar.y + 2"
                [attr.width]="bar.width"
                [attr.height]="rowHeight - 4"
                [attr.fill]="bar.color"
              ></rect>
              @if (bar.target != null) {
                <line
                  class="bullet-target"
                  [attr.x1]="margin.left + targetX(bar)"
                  [attr.x2]="margin.left + targetX(bar)"
                  [attr.y1]="bar.y + 1"
                  [attr.y2]="bar.y + rowHeight - 1"
                ></line>
              }
              <text
                class="bullet-label"
                [attr.x]="margin.left - 8"
                [attr.y]="bar.y + rowHeight / 2 + 4"
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
      .bullet-track {
        fill: rgba(var(--border), 0.25);
        rx: 6;
      }
      .bullet-value {
        rx: 6;
      }
      .bullet-target {
        stroke: #f8fafc;
        stroke-width: 2;
      }
      .bullet-label {
        font-size: 10px;
        fill: rgb(var(--muted));
      }
      .bullet-bars g {
        cursor: pointer;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryBulletChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data: BulletDatum[] = [];
  @Input() height = 220;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 420;
  margin = { top: 12, right: 12, bottom: 12, left: 110 };
  bars: BulletBar[] = [];
  rowHeight = 24;
  innerWidth = 0;

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

    const max = Math.max(...this.data.map(d => d.max ?? d.value), 1);
    this.innerWidth = this.width - this.margin.left - this.margin.right;
    const scale = linearScale(0, max || 1, 0, this.innerWidth);
    this.rowHeight = Math.max(
      20,
      Math.floor((this.height - this.margin.top - this.margin.bottom) / this.data.length)
    );

    this.bars = this.data.map((d, idx) => ({
      y: this.margin.top + idx * this.rowHeight,
      width: scale(d.value),
      label: d.label,
      value: d.value,
      target: d.target,
      color: d.color || 'rgb(var(--primary))'
    }));
    this.cdr.markForCheck();
  }

  targetX(bar: BulletBar): number {
    const max = Math.max(...this.data.map(d => d.max ?? d.value), 1);
    const scale = linearScale(0, max || 1, 0, this.innerWidth);
    return scale(bar.target ?? 0);
  }

  showTooltip(event: MouseEvent, bar: BulletBar): void {
    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    const target = bar.target != null ? ` / Target ${formatNumber(bar.target, true)}` : '';
    this.tooltip = {
      visible: true,
      x: event.clientX - rect.left + 12,
      y: event.clientY - rect.top - 24,
      label: bar.label,
      value: `${formatNumber(bar.value, true)}${target}`
    };
  }

  hideTooltip(): void {
    this.tooltip.visible = false;
  }

  onBarClick(bar: BulletBar): void {
    this.itemClick.emit({ label: bar.label, value: bar.value });
  }

  export(kind: 'png' | 'svg'): void {
    if (!this.svgRef) return;
    downloadChart(this.svgRef.nativeElement, this.exportName, kind);
  }

  exportCsv(): void {
    downloadCsvSmart(this.exportName, inferCsvPayload(this as LooseValue));
  }
}
