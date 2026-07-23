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
import { linearScale } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
@Component({
  selector: 'engineers-salary-reference-sparkline-chart',
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
        (click)="onSparklineClick()"
      >
        <path class="sparkline-area" [attr.d]="areaPath"></path>
        <path class="sparkline-line" [attr.d]="linePath"></path>
      </svg>
      @if (!linePath) {
        <div class="chart-empty">No data</div>
      }
    </div>
  `,
  styleUrls: ['./chart-base.css'],
  styles: [
    `
      .sparkline-line {
        fill: none;
        stroke: rgb(var(--primary));
        stroke-width: 2.2;
      }
      .sparkline-area {
        fill: rgba(var(--primary), 0.2);
      }
      .chart-svg {
        cursor: pointer;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalarySparklineChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() values: number[] = [];
  @Input() height = 120;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 240;
  linePath = '';
  areaPath = '';

  private ro?: ResizeObserver;
  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.observe();
    this.reflow();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['values'] || changes['height']) {
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
        const nextWidth = Math.max(entry.contentRect.width, 180);
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
      this.width = Math.max(host.clientWidth || 0, 180);
    }
    if (!this.values.length) {
      this.linePath = '';
      this.areaPath = '';
      this.cdr.markForCheck();
      return;
    }

    const min = Math.min(...this.values);
    const max = Math.max(...this.values, 1);
    const xStep = this.values.length > 1 ? this.width / (this.values.length - 1) : 0;
    const y = linearScale(min, max || 1, this.height - 10, 10);

    const points = this.values.map((v, idx) => ({ x: idx * xStep, y: y(v) }));
    this.linePath = [
      `M ${points[0].x} ${points[0].y}`,
      ...points.slice(1).map(p => `L ${p.x} ${p.y}`)
    ].join(' ');
    this.areaPath = `${this.linePath} L ${points[points.length - 1].x} ${this.height} L 0 ${this.height} Z`;
    this.cdr.markForCheck();
  }

  onSparklineClick(): void {
    if (!this.values.length) return;
    const last = this.values[this.values.length - 1] ?? 0;
    this.itemClick.emit({
      label: 'Sparkline',
      value: last,
      meta: { values: [...this.values] }
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
