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
import { ChartDatum, TernaryDatum } from './chart-types';
import { CHART_PALETTE, formatNumber } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type TernaryPoint = {
  x: number;
  y: number;
  label: string;
  value: string;
  valueNumber: number;
  a: number;
  b: number;
  c: number;
  color: string;
};

@Component({
  selector: 'engineers-salary-reference-ternary-chart',
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
        <polygon class="ternary-triangle" [attr.points]="trianglePoints"></polygon>
        <text class="ternary-label" [attr.x]="cornerA.x" [attr.y]="cornerA.y - 8">
          {{ labels[0] }}
        </text>
        <text
          class="ternary-label"
          [attr.x]="cornerB.x - 8"
          [attr.y]="cornerB.y + 12"
          text-anchor="end"
        >
          {{ labels[1] }}
        </text>
        <text class="ternary-label" [attr.x]="cornerC.x + 8" [attr.y]="cornerC.y + 12">
          {{ labels[2] }}
        </text>

        @for (pt of points; track pt) {
          <circle
            class="ternary-point"
            [attr.cx]="pt.x"
            [attr.cy]="pt.y"
            [attr.r]="5"
            [attr.fill]="pt.color"
            (click)="onPointClick(pt)"
            (mousemove)="showTooltip($event, pt)"
            (mouseleave)="hideTooltip()"
          ></circle>
        }
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
      .ternary-triangle {
        fill: rgba(15, 23, 42, 0.35);
        stroke: rgba(148, 163, 184, 0.6);
        stroke-width: 1.5;
      }
      .ternary-label {
        font-size: 10px;
        fill: rgb(var(--fg));
        font-weight: 700;
      }
      .ternary-point {
        stroke: rgba(0, 0, 0, 0.3);
        stroke-width: 1;
        cursor: pointer;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryTernaryChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data: TernaryDatum[] = [];
  @Input() height = 260;
  @Input() labels: [string, string, string] = ['A', 'B', 'C'];
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 360;
  points: TernaryPoint[] = [];
  trianglePoints = '';
  cornerA = { x: 0, y: 0 };
  cornerB = { x: 0, y: 0 };
  cornerC = { x: 0, y: 0 };

  tooltip = { visible: false, x: 0, y: 0, label: '', value: '' };

  private ro?: ResizeObserver;
  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.observe();
    this.reflow();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] || changes['height'] || changes['labels']) {
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
      this.points = [];
      this.trianglePoints = '';
      this.cdr.markForCheck();
      return;
    }

    const margin = { top: 20, right: 24, bottom: 26, left: 24 };
    const top = { x: this.width / 2, y: margin.top };
    const left = { x: margin.left, y: this.height - margin.bottom };
    const right = { x: this.width - margin.right, y: this.height - margin.bottom };
    this.cornerA = top;
    this.cornerB = left;
    this.cornerC = right;
    this.trianglePoints = `${top.x},${top.y} ${left.x},${left.y} ${right.x},${right.y}`;

    const points = this.data
      .map((item, idx) => {
        const sum = item.a + item.b + item.c;
        if (!sum) return null;
        const a = item.a / sum;
        const b = item.b / sum;
        const c = item.c / sum;
        const x = a * top.x + b * left.x + c * right.x;
        const y = a * top.y + b * left.y + c * right.y;
        return {
          x,
          y,
          label: item.label || `Point ${idx + 1}`,
          value: `${formatNumber(item.a, true)} / ${formatNumber(item.b, true)} / ${formatNumber(item.c, true)}`,
          valueNumber: sum,
          a: item.a,
          b: item.b,
          c: item.c,
          color: item.color || CHART_PALETTE[idx % CHART_PALETTE.length]
        };
      })
      .filter(Boolean) as TernaryPoint[];

    this.points = points;
    this.cdr.markForCheck();
  }

  showTooltip(event: MouseEvent, point: TernaryPoint): void {
    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    this.tooltip = {
      visible: true,
      x: event.clientX - rect.left + 10,
      y: event.clientY - rect.top - 18,
      label: point.label,
      value: point.value
    };
  }

  hideTooltip(): void {
    this.tooltip.visible = false;
  }

  onPointClick(point: TernaryPoint): void {
    this.itemClick.emit({
      label: point.label,
      value: point.valueNumber,
      color: point.color,
      meta: { a: point.a, b: point.b, c: point.c }
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
