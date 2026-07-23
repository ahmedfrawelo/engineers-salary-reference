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
import { ChartDatum, WaffleDatum } from './chart-types';
import { CHART_PALETTE, formatNumber } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type WaffleCell = {
  x: number;
  y: number;
  color: string;
  label: string;
  value: number;
};

@Component({
  selector: 'engineers-salary-reference-waffle-chart',
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
        @for (cell of cells; track cell) {
          <rect
            class="waffle-cell"
            [attr.x]="cell.x"
            [attr.y]="cell.y"
            [attr.width]="cellSize"
            [attr.height]="cellSize"
            [attr.fill]="cell.color"
            (click)="onCellClick(cell)"
            (mousemove)="showTooltip($event, cell)"
            (mouseleave)="hideTooltip()"
          ></rect>
        }
      </svg>
      @if (tooltip.visible) {
        <div class="chart-tooltip" [style.left.px]="tooltip.x" [style.top.px]="tooltip.y">
          <span class="label">{{ tooltip.label }}</span>
          <span class="value">{{ tooltip.value }}</span>
        </div>
      }
      @if (!cells.length) {
        <div class="chart-empty">No data</div>
      }
    </div>
  `,
  styleUrls: ['./chart-base.css'],
  styles: [
    `
      .waffle-cell {
        stroke: rgba(0, 0, 0, 0.2);
        stroke-width: 1;
        rx: 3;
        ry: 3;
        cursor: pointer;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryWaffleChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data: WaffleDatum[] = [];
  @Input() height = 220;
  @Input() rows = 10;
  @Input() columns = 10;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 320;
  cellSize = 12;
  cells: WaffleCell[] = [];
  tooltip = { visible: false, x: 0, y: 0, label: '', value: '' };

  private ro?: ResizeObserver;
  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.observe();
    this.reflow();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] || changes['height'] || changes['rows'] || changes['columns']) {
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
    if (!this.data.length) {
      this.cells = [];
      this.cdr.markForCheck();
      return;
    }

    const totalCells = Math.max(1, this.rows * this.columns);
    const totalValue = this.data.reduce((sum, item) => sum + item.value, 0);
    if (!totalValue) {
      this.cells = [];
      this.cdr.markForCheck();
      return;
    }

    const baseCounts = this.data.map(item => ({
      item,
      raw: (item.value / totalValue) * totalCells
    }));
    const counts = baseCounts.map(entry => Math.floor(entry.raw));
    let remaining = totalCells - counts.reduce((sum, v) => sum + v, 0);
    baseCounts
      .map((entry, idx) => ({ idx, frac: entry.raw - Math.floor(entry.raw) }))
      .sort((a, b) => b.frac - a.frac)
      .forEach(entry => {
        if (remaining <= 0) return;
        counts[entry.idx] += 1;
        remaining -= 1;
      });

    const padding = 10;
    const gridWidth = this.width - padding * 2;
    const gridHeight = this.height - padding * 2;
    this.cellSize = Math.max(
      8,
      Math.floor(Math.min(gridWidth / this.columns, gridHeight / this.rows) - 2)
    );
    const cells: WaffleCell[] = [];
    let cursor = 0;

    counts.forEach((count, idx) => {
      const item = this.data[idx];
      const color = item.color || CHART_PALETTE[idx % CHART_PALETTE.length];
      for (let i = 0; i < count; i += 1) {
        const col = cursor % this.columns;
        const row = Math.floor(cursor / this.columns);
        if (row >= this.rows) break;
        cells.push({
          x: padding + col * (this.cellSize + 2),
          y: padding + row * (this.cellSize + 2),
          color,
          label: item.label,
          value: item.value
        });
        cursor += 1;
      }
    });

    this.cells = cells;
    this.cdr.markForCheck();
  }

  showTooltip(event: MouseEvent, cell: WaffleCell): void {
    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    this.tooltip = {
      visible: true,
      x: event.clientX - rect.left + 10,
      y: event.clientY - rect.top - 18,
      label: cell.label,
      value: formatNumber(cell.value, true)
    };
  }

  hideTooltip(): void {
    this.tooltip.visible = false;
  }

  onCellClick(cell: WaffleCell): void {
    this.itemClick.emit({ label: cell.label, value: cell.value, color: cell.color });
  }

  export(kind: 'png' | 'svg'): void {
    if (!this.svgRef) return;
    downloadChart(this.svgRef.nativeElement, this.exportName, kind);
  }

  exportCsv(): void {
    downloadCsvSmart(this.exportName, inferCsvPayload(this as LooseValue));
  }
}
