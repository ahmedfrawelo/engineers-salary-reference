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
import { ChartDatum, FunnelDatum } from './chart-types';
import { CHART_PALETTE, formatNumber } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type FunnelSlice = {
  path: string;
  label: string;
  value: number;
  color: string;
};

@Component({
  selector: 'engineers-salary-reference-funnel-chart',
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
        <g class="funnel-slices">
          @for (slice of slices; track slice) {
            <path
              class="funnel-slice"
              [attr.d]="slice.path"
              [attr.fill]="slice.color"
              (click)="onSliceClick(slice)"
              (mousemove)="showTooltip($event, slice)"
              (mouseleave)="hideTooltip()"
            ></path>
          }
        </g>
        <g class="funnel-labels">
          @for (label of labels; track label) {
            <text class="funnel-label" [attr.x]="label.x" [attr.y]="label.y">{{ label.text }}</text>
          }
        </g>
      </svg>

      @if (tooltip.visible) {
        <div class="chart-tooltip" [style.left.px]="tooltip.x" [style.top.px]="tooltip.y">
          <span class="label">{{ tooltip.label }}</span>
          <span class="value">{{ tooltip.value }}</span>
        </div>
      }
      @if (!slices.length) {
        <div class="chart-empty">No data</div>
      }
    </div>
  `,
  styleUrls: ['./chart-base.css'],
  styles: [
    `
      .funnel-slice {
        stroke: rgba(0, 0, 0, 0.12);
        stroke-width: 1;
        cursor: pointer;
      }
      .funnel-label {
        font-size: 10px;
        fill: #f8fafc;
        font-weight: 600;
        text-anchor: middle;
        dominant-baseline: middle;
        pointer-events: none;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryFunnelChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data: FunnelDatum[] = [];
  @Input() height = 260;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 320;
  slices: FunnelSlice[] = [];
  labels: { x: number; y: number; text: string }[] = [];
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
    if (!this.data.length) {
      this.slices = [];
      this.labels = [];
      this.cdr.markForCheck();
      return;
    }

    const max = Math.max(...this.data.map(d => d.value), 1);
    const innerHeight = this.height - 16;
    const sliceHeight = innerHeight / this.data.length;
    const center = this.width / 2;
    const maxWidth = this.width - 24;

    this.slices = this.data.map((item, idx) => {
      const topWidth = (item.value / max) * maxWidth;
      const nextValue = this.data[idx + 1]?.value ?? 0;
      const bottomWidth = (nextValue / max) * maxWidth;
      const yTop = 8 + idx * sliceHeight;
      const yBottom = yTop + sliceHeight;
      const path = [
        `M ${center - topWidth / 2} ${yTop}`,
        `L ${center + topWidth / 2} ${yTop}`,
        `L ${center + bottomWidth / 2} ${yBottom}`,
        `L ${center - bottomWidth / 2} ${yBottom}`,
        'Z'
      ].join(' ');
      return {
        path,
        label: item.label,
        value: item.value,
        color: item.color || CHART_PALETTE[idx % CHART_PALETTE.length]
      };
    });

    this.labels = this.data.map((item, idx) => ({
      x: center,
      y: 8 + idx * sliceHeight + sliceHeight / 2,
      text: item.label
    }));
    this.cdr.markForCheck();
  }

  showTooltip(event: MouseEvent, slice: FunnelSlice): void {
    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    this.tooltip = {
      visible: true,
      x: event.clientX - rect.left + 12,
      y: event.clientY - rect.top - 24,
      label: slice.label,
      value: formatNumber(slice.value)
    };
  }

  hideTooltip(): void {
    this.tooltip.visible = false;
  }

  onSliceClick(slice: FunnelSlice): void {
    this.itemClick.emit({ label: slice.label, value: slice.value, color: slice.color });
  }

  export(kind: 'png' | 'svg'): void {
    if (!this.svgRef) return;
    downloadChart(this.svgRef.nativeElement, this.exportName, kind);
  }

  exportCsv(): void {
    downloadCsvSmart(this.exportName, inferCsvPayload(this as LooseValue));
  }
}
