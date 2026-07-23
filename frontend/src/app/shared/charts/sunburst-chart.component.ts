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
import { ChartDatum, SunburstDatum } from './chart-types';
import { CHART_PALETTE, formatNumber } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type SunburstSlice = {
  path: string;
  label: string;
  value: number;
  color: string;
  midAngle: number;
};

@Component({
  selector: 'engineers-salary-reference-sunburst-chart',
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
        <g class="sunburst-slices">
          @for (slice of slices; track slice) {
            <path
              class="sunburst-slice"
              [attr.d]="slice.path"
              [attr.fill]="slice.color"
              (click)="onSliceClick(slice)"
              (mousemove)="showTooltip($event, slice)"
              (mouseleave)="hideTooltip()"
            ></path>
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
      .sunburst-slice {
        stroke: rgba(0, 0, 0, 0.1);
        stroke-width: 1;
        transition: opacity 0.2s ease;
        cursor: pointer;
      }
      .sunburst-slice:hover {
        opacity: 0.9;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalarySunburstChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data: SunburstDatum[] = [];
  @Input() height = 240;
  @Input() innerRadius = 0.45;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 320;
  slices: SunburstSlice[] = [];
  tooltip = { visible: false, x: 0, y: 0, label: '', value: '' };

  private ro?: ResizeObserver;
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
    const total = this.data.reduce((sum, item) => sum + (item.value || 0), 0);
    if (!total) {
      this.slices = [];
      this.cdr.markForCheck();
      return;
    }
    const radius = Math.min(this.width, this.height) / 2 - 12;
    const inner = Math.max(0, Math.min(radius - 8, radius * this.innerRadius));
    const cx = this.width / 2;
    const cy = this.height / 2;
    let angle = -Math.PI / 2;

    this.slices = this.data.map((item, idx) => {
      const ratio = item.value / total;
      const sliceAngle = ratio * Math.PI * 2;
      const start = angle;
      const end = angle + sliceAngle;
      angle = end;
      return {
        path: describeArc(cx, cy, radius, inner, start, end),
        label: item.label,
        value: item.value,
        color: item.color || CHART_PALETTE[idx % CHART_PALETTE.length],
        midAngle: (start + end) / 2
      };
    });
    this.cdr.markForCheck();
  }

  showTooltip(event: MouseEvent, slice: SunburstSlice): void {
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

  onSliceClick(slice: SunburstSlice): void {
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
