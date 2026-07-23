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
import { ChartDatum, TimelineLane } from './chart-types';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type TimelineBar = {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  lane: string;
  color: string;
};

@Component({
  selector: 'engineers-salary-reference-timeline-chart',
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
        <g class="timeline-lanes">
          @for (lane of laneLabels; track lane) {
            <text
              class="timeline-label"
              [attr.x]="margin.left - 8"
              [attr.y]="lane.y + lane.height / 2 + 4"
              text-anchor="end"
            >
              {{ lane.label }}
            </text>
          }
        </g>
        @for (bar of bars; track bar) {
          <rect
            class="timeline-bar"
            [attr.x]="bar.x"
            [attr.y]="bar.y"
            [attr.width]="bar.width"
            [attr.height]="bar.height"
            [attr.fill]="bar.color"
            (click)="onBarClick(bar)"
          ></rect>
        }
      </svg>
      @if (!bars.length) {
        <div class="chart-empty">No data</div>
      }
    </div>
  `,
  styleUrls: ['./chart-base.css'],
  styles: [
    `
      .timeline-bar {
        stroke: rgba(0, 0, 0, 0.25);
        stroke-width: 1;
        rx: 6;
        ry: 6;
        opacity: 0.9;
        cursor: pointer;
      }
      .timeline-label {
        font-size: 10px;
        fill: rgb(var(--fg));
        font-weight: 700;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryTimelineChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() lanes: TimelineLane[] = [];
  @Input() height = 260;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 520;
  margin = { top: 12, right: 16, bottom: 16, left: 110 };
  bars: TimelineBar[] = [];
  laneLabels: Array<{ label: string; y: number; height: number }> = [];

  private ro?: ResizeObserver;
  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.observe();
    this.reflow();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['lanes'] || changes['height']) {
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
        const nextWidth = Math.max(entry.contentRect.width, 320);
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
      this.width = Math.max(host.clientWidth || 0, 320);
    }
    if (!this.lanes.length) {
      this.bars = [];
      this.laneLabels = [];
      this.cdr.markForCheck();
      return;
    }

    const allItems = this.lanes.flatMap(lane => lane.items);
    if (!allItems.length) {
      this.bars = [];
      this.laneLabels = [];
      this.cdr.markForCheck();
      return;
    }

    const toDate = (value: string | Date) => new Date(value);
    const minDate = new Date(Math.min(...allItems.map(item => toDate(item.start).getTime())));
    const maxDate = new Date(Math.max(...allItems.map(item => toDate(item.end).getTime())));
    const range = Math.max(maxDate.getTime() - minDate.getTime(), 1);

    const innerWidth = this.width - this.margin.left - this.margin.right;
    const innerHeight = this.height - this.margin.top - this.margin.bottom;
    const rowHeight = innerHeight / Math.max(this.lanes.length, 1);

    const bars: TimelineBar[] = [];
    const laneLabels: Array<{ label: string; y: number; height: number }> = [];

    this.lanes.forEach((lane, idx) => {
      const y = this.margin.top + idx * rowHeight + 4;
      laneLabels.push({ label: lane.label, y, height: rowHeight });
      lane.items.forEach((item, itemIdx) => {
        const start = toDate(item.start).getTime();
        const end = toDate(item.end).getTime();
        const x = this.margin.left + ((start - minDate.getTime()) / range) * innerWidth;
        const width = Math.max(6, ((end - start) / range) * innerWidth);
        bars.push({
          label: item.label,
          x,
          y,
          width,
          height: Math.max(8, rowHeight - 10),
          lane: lane.label,
          color: item.color || (idx % 2 === 0 ? 'rgba(34,197,94,0.65)' : 'rgba(59,130,246,0.65)')
        });
      });
    });

    this.bars = bars;
    this.laneLabels = laneLabels;
    this.cdr.markForCheck();
  }

  export(kind: 'png' | 'svg'): void {
    if (!this.svgRef) return;
    downloadChart(this.svgRef.nativeElement, this.exportName, kind);
  }

  exportCsv(): void {
    downloadCsvSmart(this.exportName, inferCsvPayload(this as LooseValue));
  }

  onBarClick(bar: TimelineBar): void {
    this.itemClick.emit({
      label: bar.label,
      value: bar.width,
      meta: { lane: bar.lane }
    });
  }
}
