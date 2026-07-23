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
import { ChartDatum, MekkoDatum } from './chart-types';
import { CHART_PALETTE, formatNumber } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type MekkoRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  group: string;
  label: string;
  value: number;
  color: string;
};

@Component({
  selector: 'engineers-salary-reference-mekko-chart',
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
        @for (rect of rects; track rect) {
          <rect
            class="mekko-rect"
            [attr.x]="rect.x"
            [attr.y]="rect.y"
            [attr.width]="rect.width"
            [attr.height]="rect.height"
            [attr.fill]="rect.color"
            (click)="onRectClick(rect)"
            (mousemove)="showTooltip($event, rect)"
            (mouseleave)="hideTooltip()"
          ></rect>
        }
        @for (rect of rectLabels; track rect) {
          <text class="mekko-label" [attr.x]="rect.x + 6" [attr.y]="rect.y + 14">
            {{ rect.label }}
          </text>
        }
      </svg>
      @if (tooltip.visible) {
        <div class="chart-tooltip" [style.left.px]="tooltip.x" [style.top.px]="tooltip.y">
          <span class="label">{{ tooltip.label }}</span>
          <span class="value">{{ tooltip.value }}</span>
        </div>
      }
      @if (!rects.length) {
        <div class="chart-empty">No data</div>
      }
    </div>
  `,
  styleUrls: ['./chart-base.css'],
  styles: [
    `
      .mekko-rect {
        stroke: rgba(0, 0, 0, 0.2);
        stroke-width: 1;
        cursor: pointer;
      }
      .mekko-label {
        font-size: 10px;
        fill: rgba(255, 255, 255, 0.9);
        font-weight: 700;
        pointer-events: none;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryMekkoChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data: MekkoDatum[] = [];
  @Input() height = 260;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 420;
  rects: MekkoRect[] = [];
  rectLabels: MekkoRect[] = [];
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
      this.rects = [];
      this.rectLabels = [];
      this.cdr.markForCheck();
      return;
    }

    const margin = { top: 16, right: 12, bottom: 16, left: 12 };
    const innerWidth = this.width - margin.left - margin.right;
    const innerHeight = this.height - margin.top - margin.bottom;
    const total = this.data.reduce((sum, item) => sum + item.total, 0) || 1;

    let cursorX = margin.left;
    const rects: MekkoRect[] = [];
    const labels: MekkoRect[] = [];

    this.data.forEach((item, idx) => {
      const colWidth = (item.total / total) * innerWidth;
      let cursorY = margin.top;
      const segTotal = item.segments.reduce((sum, seg) => sum + seg.value, 0) || 1;
      item.segments.forEach((seg, segIdx) => {
        const height = (seg.value / segTotal) * innerHeight;
        const color = seg.color || CHART_PALETTE[(idx + segIdx) % CHART_PALETTE.length];
        const rect: MekkoRect = {
          x: cursorX,
          y: cursorY,
          width: Math.max(2, colWidth - 2),
          height: Math.max(2, height - 2),
          group: item.label,
          label: seg.label,
          value: seg.value,
          color
        };
        rects.push(rect);
        if (rect.height > 18 && rect.width > 40) {
          labels.push(rect);
        }
        cursorY += height;
      });
      cursorX += colWidth;
    });

    this.rects = rects;
    this.rectLabels = labels;
    this.cdr.markForCheck();
  }

  showTooltip(event: MouseEvent, rect: MekkoRect): void {
    const box = this.hostRef.nativeElement.getBoundingClientRect();
    this.tooltip = {
      visible: true,
      x: event.clientX - box.left + 10,
      y: event.clientY - box.top - 18,
      label: rect.label,
      value: formatNumber(rect.value, true)
    };
  }

  hideTooltip(): void {
    this.tooltip.visible = false;
  }

  onRectClick(rect: MekkoRect): void {
    this.itemClick.emit({
      label: rect.label,
      value: rect.value,
      color: rect.color,
      meta: { group: rect.group }
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
