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
import { ChartDatum, ViolinDatum } from './chart-types';
import { bandScale, formatNumber, linearScale } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type ViolinShape = {
  path: string;
  label: string;
  color: string;
  medianY: number;
  median: number;
};

@Component({
  selector: 'engineers-salary-reference-violin-chart',
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
        <g class="violin-shapes">
          @for (violin of violins; track violin) {
            <path
              class="violin-shape"
              [attr.d]="violin.path"
              [attr.fill]="violin.color"
              (click)="onViolinClick(violin)"
              (mousemove)="showTooltip($event, violin)"
              (mouseleave)="hideTooltip()"
            ></path>
          }
          @for (violin of violins; track violin) {
            <line
              class="violin-median"
              [attr.x1]="violinMedianX(violin) - 10"
              [attr.x2]="violinMedianX(violin) + 10"
              [attr.y1]="violin.medianY"
              [attr.y2]="violin.medianY"
            ></line>
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
      @if (!violins.length) {
        <div class="chart-empty">No data</div>
      }
    </div>
  `,
  styleUrls: ['./chart-base.css'],
  styles: [
    `
      .violin-shape {
        fill-opacity: 0.28;
        stroke: rgba(var(--border), 0.4);
        stroke-width: 1;
        cursor: pointer;
      }
      .violin-median {
        stroke: rgba(248, 250, 252, 0.9);
        stroke-width: 2;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryViolinChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data: ViolinDatum[] = [];
  @Input() height = 240;
  @Input() bins = 12;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 420;
  margin = { top: 16, right: 16, bottom: 28, left: 16 };
  violins: ViolinShape[] = [];
  xLabels: { x: number; label: string }[] = [];

  tooltip = { visible: false, x: 0, y: 0, label: '', value: '' };

  private ro?: ResizeObserver;
  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.observe();
    this.reflow();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] || changes['height'] || changes['bins']) {
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
      this.violins = [];
      this.xLabels = [];
      this.cdr.markForCheck();
      return;
    }

    const allValues = this.data.flatMap(item => item.values);
    const min = Math.min(...allValues, 0);
    const max = Math.max(...allValues, 1);
    const binCount = Math.max(6, this.bins);
    const span = max - min || 1;
    const binSize = span / binCount;

    const innerHeight = this.height - this.margin.top - this.margin.bottom;
    const innerWidth = this.width - this.margin.left - this.margin.right;
    if (innerHeight <= 0 || innerWidth <= 0) {
      this.violins = [];
      this.xLabels = [];
      this.cdr.markForCheck();
      return;
    }

    const y = linearScale(min, max || 1, this.margin.top + innerHeight, this.margin.top);
    const labels = this.data.map(item => item.label);
    const band = bandScale(labels, this.margin.left, this.margin.left + innerWidth, 0.2);
    const maxHalfWidth = band.bandwidth / 2 - 4;

    this.violins = this.data.map((item, idx) => {
      const counts = new Array(binCount).fill(0);
      item.values.forEach(v => {
        const b = Math.min(binCount - 1, Math.floor((v - min) / binSize));
        counts[b] += 1;
      });
      const maxCount = Math.max(...counts, 1);
      const points = counts.map((count, binIdx) => {
        const value = min + (binIdx + 0.5) * binSize;
        const width = (count / maxCount) * maxHalfWidth;
        return { y: y(value), width };
      });

      const centerX = band.position(item.label) + band.bandwidth / 2;
      const right = points.map(p => `${centerX + p.width} ${p.y}`);
      const left = points
        .slice()
        .reverse()
        .map(p => `${centerX - p.width} ${p.y}`);
      const path = `M ${right[0]} L ${right.slice(1).join(' L ')} L ${left.join(' L ')} Z`;

      const sorted = item.values.slice().sort((a, b) => a - b);
      const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;

      return {
        path,
        label: item.label,
        color: item.color || '#22c55e',
        medianY: y(median),
        median
      };
    });

    this.xLabels = labels.map(label => ({
      label,
      x: band.position(label) + band.bandwidth / 2
    }));
    this.cdr.markForCheck();
  }

  violinMedianX(violin: ViolinShape): number {
    const label = violin.label;
    const idx = this.data.findIndex(item => item.label === label);
    if (idx < 0) return 0;
    const innerWidth = this.width - this.margin.left - this.margin.right;
    const band = bandScale(
      this.data.map(item => item.label),
      this.margin.left,
      this.margin.left + innerWidth,
      0.2
    );
    return band.position(label) + band.bandwidth / 2;
  }

  showTooltip(event: MouseEvent, violin: ViolinShape): void {
    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    this.tooltip = {
      visible: true,
      x: event.clientX - rect.left + 12,
      y: event.clientY - rect.top - 24,
      label: violin.label,
      value: `Median ${formatNumber(violin.median, true)}`
    };
  }

  hideTooltip(): void {
    this.tooltip.visible = false;
  }

  onViolinClick(violin: ViolinShape): void {
    this.itemClick.emit({ label: violin.label, value: violin.median });
  }

  export(kind: 'png' | 'svg'): void {
    if (!this.svgRef) return;
    downloadChart(this.svgRef.nativeElement, this.exportName, kind);
  }

  exportCsv(): void {
    downloadCsvSmart(this.exportName, inferCsvPayload(this as LooseValue));
  }
}
