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
import { ChartDatum, GaugeDatum } from './chart-types';
import { clamp, formatNumber } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
@Component({
  selector: 'engineers-salary-reference-gauge-chart',
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
      <svg
        class="chart-svg"
        #svgRef
        [attr.viewBox]="'0 0 ' + width + ' ' + height"
        (click)="onGaugeClick()"
      >
        <path class="gauge-track" [attr.d]="trackPath"></path>
        <path class="gauge-value" [attr.d]="valuePath"></path>
        <line
          class="gauge-needle"
          [attr.x1]="center.x"
          [attr.y1]="center.y"
          [attr.x2]="needle.x"
          [attr.y2]="needle.y"
        ></line>
        <circle
          class="gauge-center"
          [attr.cx]="center.x"
          [attr.cy]="center.y"
          [attr.r]="6"
        ></circle>
        <text class="gauge-label" [attr.x]="center.x" [attr.y]="labelY">{{ label }}</text>
        <text class="gauge-value-text" [attr.x]="center.x" [attr.y]="valueY">
          {{ valueText }}
        </text>
      </svg>
      @if (!hasValue) {
        <div class="chart-empty">No data</div>
      }
    </div>
  `,
  styleUrls: ['./chart-base.css'],
  styles: [
    `
      .gauge-track {
        fill: none;
        stroke: rgba(var(--border), 0.4);
        stroke-width: 12;
        stroke-linecap: round;
      }
      .gauge-value {
        fill: none;
        stroke: rgb(var(--primary));
        stroke-width: 12;
        stroke-linecap: round;
      }
      .gauge-needle {
        stroke: rgb(var(--fg));
        stroke-width: 2;
      }
      .gauge-center {
        fill: rgb(var(--fg));
      }
      .gauge-label {
        font-size: 11px;
        fill: rgb(var(--muted));
        text-anchor: middle;
      }
      .gauge-value-text {
        font-size: 14px;
        fill: rgb(var(--fg));
        font-weight: 700;
        text-anchor: middle;
      }
      .chart-svg {
        cursor: pointer;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryGaugeChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data: GaugeDatum = { value: 0 };
  @Input() height = 220;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 320;
  trackPath = '';
  valuePath = '';
  center = { x: 0, y: 0 };
  needle = { x: 0, y: 0 };
  labelY = 0;
  valueY = 0;
  valueText = '--';
  label = '';
  hasValue = false;

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
    const value = this.data?.value;
    if (!Number.isFinite(value)) {
      this.hasValue = false;
      this.cdr.markForCheck();
      return;
    }
    this.hasValue = true;
    const min = this.data.min ?? 0;
    const max = this.data.max ?? 100;
    const target = this.data.target ?? null;
    const ratio = clamp((value - min) / (max - min || 1), 0, 1);

    const footerSpace = 54;
    const cx = this.width / 2;
    const cy = Math.max(this.height - footerSpace, 84);
    const radius = Math.max(Math.min(this.width / 2 - 18, cy - 18), 44);
    this.center = { x: cx, y: cy };
    this.labelY = Math.min(cy + 26, this.height - 26);
    this.valueY = Math.min(cy + 48, this.height - 8);
    this.label = this.data.label || 'Score';
    this.valueText = formatNumber(value, true);

    const startAngle = Math.PI;
    const endAngle = 0;
    const valueAngle = startAngle - ratio * Math.PI;

    this.trackPath = arcPath(cx, cy, radius, startAngle, endAngle);
    this.valuePath = arcPath(cx, cy, radius, startAngle, valueAngle);

    const needlePoint = polar(cx, cy, radius - 8, valueAngle);
    this.needle = { x: needlePoint.x, y: needlePoint.y };

    if (target != null && Number.isFinite(target)) {
      const targetRatio = clamp((target - min) / (max - min || 1), 0, 1);
      const targetAngle = startAngle - targetRatio * Math.PI;
      const targetPoint = polar(cx, cy, radius - 2, targetAngle);
      this.valuePath += ` M ${targetPoint.x} ${targetPoint.y}`;
    }
    this.cdr.markForCheck();
  }

  onGaugeClick(): void {
    if (!this.hasValue) return;
    this.itemClick.emit({
      label: this.label || 'Gauge',
      value: this.data.value ?? 0,
      meta: { min: this.data.min ?? 0, max: this.data.max ?? 100, target: this.data.target ?? null }
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

function arcPath(cx: number, cy: number, r: number, start: number, end: number): string {
  const startPoint = polar(cx, cy, r, start);
  const endPoint = polar(cx, cy, r, end);
  const large = Math.abs(end - start) > Math.PI ? 1 : 0;
  return `M ${startPoint.x} ${startPoint.y} A ${r} ${r} 0 ${large} 0 ${endPoint.x} ${endPoint.y}`;
}

function polar(cx: number, cy: number, r: number, angle: number): { x: number; y: number } {
  return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
}
