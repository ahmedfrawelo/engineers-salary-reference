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
import { ChartDatum } from './chart-types';
import { CHART_PALETTE, formatNumber } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type PieSlice = {
  path: string;
  color: string;
  label: string;
  value: number;
  midAngle: number;
  ratio: number;
};

@Component({
  selector: 'engineers-salary-reference-pie-chart',
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
        <g class="pie-slices">
          @for (slice of slices; track slice) {
            <path
              class="pie-slice"
              [attr.d]="slice.path"
              [attr.fill]="slice.color"
              (click)="onSliceClick(slice)"
              (mousemove)="showTooltip($event, slice)"
              (mouseleave)="hideTooltip()"
            ></path>
          }
        </g>
        @if (showLabels) {
          <g class="pie-labels">
            @for (slice of labelSlices; track slice) {
              <text
                class="pie-label"
                [attr.x]="labelPosition(slice).x"
                [attr.y]="labelPosition(slice).y"
              >
                {{ slice.label }}
              </text>
            }
          </g>
        }
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
      @if (showLegend && data.length) {
        <div class="chart-legend">
          @for (item of data; track item) {
            <div class="legend-item" [class.off]="isHidden(item)" (click)="toggleSlice(item)">
              <span class="legend-dot" [style.background]="item.color || defaultColor(item)"></span>
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
      .pie-slice {
        stroke: rgba(0, 0, 0, 0.08);
        stroke-width: 1;
        transition: opacity 0.2s ease;
        cursor: pointer;
      }
      .pie-slice:hover {
        opacity: 0.9;
      }
      .pie-label {
        font-size: 10px;
        fill: #e2e8f0;
        text-anchor: middle;
        dominant-baseline: middle;
        pointer-events: none;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryPieChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data: ChartDatum[] = [];
  @Input() height = 260;
  @Input() innerRadius = 0.5;
  @Input() showLegend = true;
  @Input() showLabels = true;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 320;
  slices: PieSlice[] = [];
  labelSlices: PieSlice[] = [];

  tooltip = { visible: false, x: 0, y: 0, label: '', value: '' };

  private ro?: ResizeObserver;
  private hidden = new Set<string>();
  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.observe();
    this.reflow();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] || changes['height'] || changes['innerRadius']) {
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
        const nextWidth = Math.max(entry.contentRect.width, 220);
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
      this.width = Math.max(host.clientWidth || 0, 220);
    }
    const visibleData = this.data.filter(item => !this.hidden.has(item.label));
    const values = visibleData.map(item => item.value).filter(v => v > 0);
    const total = values.reduce((sum, value) => sum + value, 0);
    if (!total) {
      this.slices = [];
      this.labelSlices = [];
      this.cdr.markForCheck();
      return;
    }

    const radius = Math.min(this.width, this.height) / 2 - 12;
    const inner = Math.max(
      0,
      Math.min(radius - 8, radius * Math.max(0, Math.min(this.innerRadius, 0.8)))
    );
    const cx = this.width / 2;
    const cy = this.height / 2;

    let angle = -Math.PI / 2;
    const slices: PieSlice[] = [];
    visibleData.forEach(item => {
      if (item.value <= 0) return;
      const ratio = item.value / total;
      const sliceAngle = ratio * Math.PI * 2;
      const start = angle;
      const end = angle + sliceAngle;
      const mid = (start + end) / 2;
      const path = describeArc(cx, cy, radius, inner, start, end);
      const idx = this.data.findIndex(d => d.label === item.label);
      slices.push({
        path,
        color: item.color || CHART_PALETTE[(idx >= 0 ? idx : 0) % CHART_PALETTE.length],
        label: item.label,
        value: item.value,
        midAngle: mid,
        ratio
      });
      angle = end;
    });
    this.slices = slices;
    this.labelSlices = slices.filter(slice => slice.ratio > 0.08);
    this.cdr.markForCheck();
  }

  labelPosition(slice: PieSlice): { x: number; y: number } {
    const radius = Math.min(this.width, this.height) / 2 - 16;
    const r = radius * (this.innerRadius > 0 ? (this.innerRadius + 1) / 2 : 0.6);
    return {
      x: this.width / 2 + Math.cos(slice.midAngle) * r,
      y: this.height / 2 + Math.sin(slice.midAngle) * r
    };
  }

  showTooltip(event: MouseEvent, slice: PieSlice): void {
    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    this.tooltip = {
      visible: true,
      x: event.clientX - rect.left + 10,
      y: event.clientY - rect.top - 18,
      label: slice.label,
      value: formatNumber(slice.value)
    };
  }

  hideTooltip(): void {
    this.tooltip.visible = false;
  }

  onSliceClick(slice: PieSlice): void {
    this.itemClick.emit({ label: slice.label, value: slice.value, color: slice.color });
  }

  defaultColor(item: ChartDatum): string {
    const idx = this.data.findIndex(d => d.label === item.label);
    return CHART_PALETTE[idx >= 0 ? idx % CHART_PALETTE.length : 0];
  }

  isHidden(item: ChartDatum): boolean {
    return this.hidden.has(item.label);
  }

  toggleSlice(item: ChartDatum): void {
    if (this.hidden.has(item.label)) {
      this.hidden.delete(item.label);
    } else {
      this.hidden.add(item.label);
    }
    this.reflow();
  }

  export(kind: 'png' | 'svg'): void {
    if (!this.svgRef) return;
    downloadChart(this.svgRef.nativeElement, this.exportName, kind);
  }

  exportCsv(): void {
    downloadCsvSmart(this.exportName, inferCsvPayload(this as LooseValue));
  }
}

function describeArc(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  start: number,
  end: number
): string {
  const startOuter = polar(cx, cy, outer, start);
  const endOuter = polar(cx, cy, outer, end);
  const large = end - start > Math.PI ? 1 : 0;

  if (inner <= 0) {
    return [
      `M ${cx} ${cy}`,
      `L ${startOuter.x} ${startOuter.y}`,
      `A ${outer} ${outer} 0 ${large} 1 ${endOuter.x} ${endOuter.y}`,
      'Z'
    ].join(' ');
  }

  const startInner = polar(cx, cy, inner, end);
  const endInner = polar(cx, cy, inner, start);
  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outer} ${outer} 0 ${large} 1 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${inner} ${inner} 0 ${large} 0 ${endInner.x} ${endInner.y}`,
    'Z'
  ].join(' ');
}

function polar(cx: number, cy: number, r: number, angle: number): { x: number; y: number } {
  return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
}
