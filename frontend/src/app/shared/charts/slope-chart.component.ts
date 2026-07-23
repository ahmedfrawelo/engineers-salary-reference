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
import { ChartDatum, SlopeDatum } from './chart-types';
import { formatNumber, linearScale } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type SlopeLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  start: number;
  end: number;
  color: string;
};

@Component({
  selector: 'engineers-salary-reference-slope-chart',
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
        <g class="slope-lines">
          @for (line of lines; track line) {
            <line
              class="slope-line"
              [attr.x1]="line.x1"
              [attr.y1]="line.y1"
              [attr.x2]="line.x2"
              [attr.y2]="line.y2"
              [attr.stroke]="line.color"
              (click)="onLineClick(line)"
              (mousemove)="showTooltip($event, line)"
              (mouseleave)="hideTooltip()"
            ></line>
          }
        </g>
        <g class="slope-labels">
          @for (label of labels; track label) {
            <text class="slope-label" [attr.x]="label.x" [attr.y]="label.y">{{ label.text }}</text>
          }
        </g>
      </svg>

      @if (tooltip.visible) {
        <div class="chart-tooltip" [style.left.px]="tooltip.x" [style.top.px]="tooltip.y">
          <span class="label">{{ tooltip.label }}</span>
          <span class="value">{{ tooltip.value }}</span>
        </div>
      }
      @if (!lines.length) {
        <div class="chart-empty">No data</div>
      }
    </div>
  `,
  styleUrls: ['./chart-base.css'],
  styles: [
    `
      .slope-line {
        stroke-width: 2.2;
        opacity: 0.85;
        cursor: pointer;
      }
      .slope-label {
        font-size: 10px;
        fill: rgb(var(--muted));
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalarySlopeChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data: SlopeDatum[] = [];
  @Input() height = 240;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 420;
  margin = { top: 20, right: 40, bottom: 20, left: 40 };
  lines: SlopeLine[] = [];
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
      this.lines = [];
      this.labels = [];
      this.cdr.markForCheck();
      return;
    }

    const values = this.data.flatMap(item => [item.start, item.end]);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);
    const y = linearScale(min, max || 1, this.height - this.margin.bottom, this.margin.top);
    const x1 = this.margin.left;
    const x2 = this.width - this.margin.right;

    this.lines = this.data.map((item, idx) => ({
      x1,
      y1: y(item.start),
      x2,
      y2: y(item.end),
      label: item.label,
      start: item.start,
      end: item.end,
      color: item.color || (item.end >= item.start ? '#22c55e' : '#ef4444')
    }));

    this.labels = this.data.map(item => ({
      x: x1 - 4,
      y: y(item.start) + 4,
      text: item.label
    }));
    this.cdr.markForCheck();
  }

  showTooltip(event: MouseEvent, line: SlopeLine): void {
    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    this.tooltip = {
      visible: true,
      x: event.clientX - rect.left + 12,
      y: event.clientY - rect.top - 24,
      label: line.label,
      value: `${formatNumber(line.start, true)} -> ${formatNumber(line.end, true)}`
    };
  }

  hideTooltip(): void {
    this.tooltip.visible = false;
  }

  onLineClick(line: SlopeLine): void {
    const delta = line.end - line.start;
    this.itemClick.emit({
      label: line.label,
      value: line.end,
      color: line.color,
      meta: { start: line.start, end: line.end, delta }
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
