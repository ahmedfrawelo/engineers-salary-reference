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
import { ChartDatum, RidgelineDatum } from './chart-types';
import { CHART_PALETTE } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type RidgeShape = {
  path: string;
  label: string;
  color: string;
};

@Component({
  selector: 'engineers-salary-reference-ridgeline-chart',
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
        <g class="ridge-lines">
          @for (ridge of ridges; track ridge) {
            <path
              class="ridge-line"
              [attr.d]="ridge.path"
              [attr.fill]="ridge.color"
              [attr.stroke]="ridge.color"
              (click)="onRidgeClick(ridge)"
            ></path>
          }
          @for (ridge of ridges; track ridge; let i = $index) {
            <text
              class="ridge-label"
              [attr.x]="margin.left"
              [attr.y]="margin.top + i * rowHeight + 12"
            >
              {{ ridge.label }}
            </text>
          }
        </g>
      </svg>
      @if (!ridges.length) {
        <div class="chart-empty">No data</div>
      }
    </div>
  `,
  styleUrls: ['./chart-base.css'],
  styles: [
    `
      .ridge-line {
        fill-opacity: 0.18;
        stroke-width: 1.5;
        cursor: pointer;
      }
      .ridge-label {
        font-size: 10px;
        fill: rgb(var(--muted));
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryRidgelineChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data: RidgelineDatum[] = [];
  @Input() height = 260;
  @Input() bins = 16;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 420;
  margin = { top: 16, right: 16, bottom: 16, left: 120 };
  ridges: RidgeShape[] = [];
  rowHeight = 24;

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
      this.ridges = [];
      this.cdr.markForCheck();
      return;
    }

    const allValues = this.data.flatMap(item => item.values);
    const min = Math.min(...allValues, 0);
    const max = Math.max(...allValues, 1);
    const bins = Math.max(8, this.bins);
    const span = max - min || 1;
    const binSize = span / bins;

    const innerWidth = this.width - this.margin.left - this.margin.right;
    const rowHeight = Math.max(
      20,
      Math.floor((this.height - this.margin.top - this.margin.bottom) / this.data.length)
    );
    this.rowHeight = rowHeight;

    this.ridges = this.data.map((item, idx) => {
      const counts = new Array(bins).fill(0);
      item.values.forEach(v => {
        const b = Math.min(bins - 1, Math.floor((v - min) / binSize));
        counts[b] += 1;
      });
      const maxCount = Math.max(...counts, 1);
      const points = counts.map((count, binIdx) => {
        const x = this.margin.left + (binIdx / (bins - 1)) * innerWidth;
        const y =
          this.margin.top + idx * rowHeight + rowHeight - (count / maxCount) * (rowHeight * 0.8);
        return { x, y };
      });

      const baseY = this.margin.top + idx * rowHeight + rowHeight;
      const path = [
        `M ${points[0].x} ${baseY}`,
        ...points.map(p => `L ${p.x} ${p.y}`),
        `L ${points[points.length - 1].x} ${baseY}`,
        'Z'
      ].join(' ');
      return {
        path,
        label: item.label,
        color: item.color || CHART_PALETTE[idx % CHART_PALETTE.length]
      };
    });
    this.cdr.markForCheck();
  }

  export(kind: 'png' | 'svg'): void {
    if (!this.svgRef) return;
    downloadChart(this.svgRef.nativeElement, this.exportName, kind);
  }

  exportCsv(): void {
    downloadCsvSmart(this.exportName, inferCsvPayload(this as LooseValue));
  }

  onRidgeClick(ridge: RidgeShape): void {
    this.itemClick.emit({ label: ridge.label, value: 1, color: ridge.color });
  }
}
