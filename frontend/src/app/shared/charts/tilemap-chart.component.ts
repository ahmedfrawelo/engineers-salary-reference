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
import { ChartDatum, TileMapDatum } from './chart-types';
import { CHART_PALETTE, colorRamp, formatNumber } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type TileCell = {
  x: number;
  y: number;
  label: string;
  value: number;
  color: string;
};

@Component({
  selector: 'engineers-salary-reference-tilemap-chart',
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
        <g class="tilemap">
          @for (cell of cells; track cell) {
            <rect
              class="tilemap-cell"
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
          @for (cell of cells; track cell) {
            <text
              class="tilemap-label"
              [attr.x]="cell.x + cellSize / 2"
              [attr.y]="cell.y + cellSize / 2 + 4"
            >
              {{ cell.label }}
            </text>
          }
        </g>
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
      .tilemap-cell {
        stroke: rgba(0, 0, 0, 0.2);
        stroke-width: 1;
        rx: 6;
        ry: 6;
        cursor: pointer;
      }
      .tilemap-label {
        font-size: 9px;
        fill: rgb(var(--fg));
        text-anchor: middle;
        pointer-events: none;
        font-weight: 700;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryTileMapChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data: TileMapDatum[] = [];
  @Input() height = 240;
  @Input() columns = 6;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 420;
  cellSize = 40;
  cells: TileCell[] = [];
  tooltip = { visible: false, x: 0, y: 0, label: '', value: '' };

  private ro?: ResizeObserver;
  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.observe();
    this.reflow();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] || changes['height'] || changes['columns']) {
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
        const nextWidth = Math.max(entry.contentRect.width, 260);
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
      this.width = Math.max(host.clientWidth || 0, 260);
    }
    if (!this.data.length) {
      this.cells = [];
      this.cdr.markForCheck();
      return;
    }

    const padding = 12;
    const cols = Math.max(2, this.columns);
    const rows = Math.ceil(this.data.length / cols);
    const gridWidth = this.width - padding * 2;
    const gridHeight = this.height - padding * 2;
    this.cellSize = Math.max(28, Math.floor(Math.min(gridWidth / cols, gridHeight / rows) - 4));

    const values = this.data.map(item => item.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    this.cells = this.data.map((item, idx) => {
      const col = item.col ?? idx % cols;
      const row = item.row ?? Math.floor(idx / cols);
      return {
        x: padding + col * (this.cellSize + 6),
        y: padding + row * (this.cellSize + 6),
        label: item.label,
        value: item.value,
        color:
          item.color ||
          colorRamp(item.value, min, max, '#0ea5e9', '#22c55e') ||
          CHART_PALETTE[idx % CHART_PALETTE.length]
      };
    });

    this.cdr.markForCheck();
  }

  showTooltip(event: MouseEvent, cell: TileCell): void {
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

  onCellClick(cell: TileCell): void {
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
