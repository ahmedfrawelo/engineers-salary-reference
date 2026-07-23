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
import { ChartDatum, RadialDatum } from './chart-types';
import { clamp } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type RadialArc = {
  path: string;
  color: string;
  label: string;
  value: number;
};

@Component({
  selector: 'engineers-salary-reference-radial-bar-chart',
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
        <g class="radial-arcs">
          @for (arc of arcs; track arc) {
            <path
              class="radial-arc"
              [attr.d]="arc.path"
              [attr.stroke]="arc.color"
              (click)="onArcClick(arc)"
              (mousemove)="showTooltip($event, arc)"
              (mouseleave)="hideTooltip()"
            ></path>
          }
        </g>
        <text class="radial-center" [attr.x]="width / 2" [attr.y]="height / 2 + 4">Summary</text>
      </svg>

      @if (tooltip.visible) {
        <div class="chart-tooltip" [style.left.px]="tooltip.x" [style.top.px]="tooltip.y">
          <span class="label">{{ tooltip.label }}</span>
          <span class="value">{{ tooltip.value }}</span>
        </div>
      }
      @if (!arcs.length) {
        <div class="chart-empty">No data</div>
      }
    </div>
  `,
  styleUrls: ['./chart-base.css'],
  styles: [
    `
      .radial-arc {
        fill: none;
        stroke-width: 10;
        stroke-linecap: round;
        cursor: pointer;
      }
      .radial-center {
        font-size: 11px;
        fill: rgb(var(--muted));
        text-anchor: middle;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryRadialBarChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data: RadialDatum[] = [];
  @Input() height = 240;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 320;
  arcs: RadialArc[] = [];
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
      this.arcs = [];
      this.cdr.markForCheck();
      return;
    }

    const cx = this.width / 2;
    const cy = this.height / 2;
    const ringGap = 12;
    const baseRadius = Math.min(this.width, this.height) / 2 - 16;
    this.arcs = this.data.map((item, idx) => {
      const max = item.max ?? 100;
      const ratio = clamp(item.value / (max || 1), 0, 1);
      const radius = baseRadius - idx * ringGap;
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + ratio * Math.PI * 2;
      const path = arcPath(cx, cy, radius, startAngle, endAngle);
      return {
        path,
        color: item.color || '#22c55e',
        label: item.label || `Metric ${idx + 1}`,
        value: item.value
      };
    });
    this.cdr.markForCheck();
  }

  showTooltip(event: MouseEvent, arc: RadialArc): void {
    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    this.tooltip = {
      visible: true,
      x: event.clientX - rect.left + 12,
      y: event.clientY - rect.top - 24,
      label: arc.label,
      value: `${arc.value}`
    };
  }

  hideTooltip(): void {
    this.tooltip.visible = false;
  }

  onArcClick(arc: RadialArc): void {
    this.itemClick.emit({ label: arc.label, value: arc.value, color: arc.color });
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
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${startPoint.x} ${startPoint.y} A ${r} ${r} 0 ${large} 1 ${endPoint.x} ${endPoint.y}`;
}

function polar(cx: number, cy: number, r: number, angle: number): { x: number; y: number } {
  return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
}
