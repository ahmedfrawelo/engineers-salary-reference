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
import { CalendarDatum, ChartDatum } from './chart-types';
import { colorRamp, formatNumber } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type CalendarCell = {
  x: number;
  y: number;
  size: number;
  date: Date;
  value: number;
  fill: string;
};

@Component({
  selector: 'engineers-salary-reference-calendar-heatmap',
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
        <g class="calendar-cells">
          @for (cell of cells; track cell) {
            <rect
              class="calendar-cell"
              [attr.x]="cell.x"
              [attr.y]="cell.y"
              [attr.width]="cell.size"
              [attr.height]="cell.size"
              [attr.rx]="4"
              [attr.ry]="4"
              [attr.fill]="cell.fill"
              (click)="onCellClick(cell)"
              (mousemove)="showTooltip($event, cell)"
              (mouseleave)="hideTooltip()"
            ></rect>
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
      .calendar-cell {
        stroke: rgba(0, 0, 0, 0.12);
        stroke-width: 1;
        cursor: pointer;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryCalendarHeatmapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data: CalendarDatum[] = [];
  @Input() height = 220;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 420;
  cells: CalendarCell[] = [];
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
      this.cells = [];
      this.cdr.markForCheck();
      return;
    }

    const parsed = this.data
      .map(item => ({ date: toDate(item.date), value: item.value }))
      .filter(item => !Number.isNaN(item.date.getTime()));
    if (!parsed.length) {
      this.cells = [];
      this.cdr.markForCheck();
      return;
    }

    const minDate = new Date(Math.min(...parsed.map(p => p.date.getTime())));
    const maxDate = new Date(Math.max(...parsed.map(p => p.date.getTime())));
    const start = startOfWeek(minDate);
    const end = endOfWeek(maxDate);
    const dayMs = 24 * 60 * 60 * 1000;
    const totalDays = Math.round((end.getTime() - start.getTime()) / dayMs) + 1;
    const weeks = Math.ceil(totalDays / 7);

    const padding = 10;
    const cellSize = Math.min(
      Math.floor((this.width - padding * 2) / Math.max(weeks, 1)),
      Math.floor((this.height - padding * 2) / 7)
    );
    const offsetX = padding;
    const offsetY = padding;

    const valueMap = new Map<string, number>();
    parsed.forEach(item => {
      valueMap.set(dateKey(item.date), item.value);
    });
    const values = Array.from(valueMap.values());
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);

    const cells: CalendarCell[] = [];
    for (let day = 0; day < totalDays; day += 1) {
      const date = new Date(start.getTime() + day * dayMs);
      const week = Math.floor(day / 7);
      const weekday = date.getDay();
      const value = valueMap.get(dateKey(date)) || 0;
      cells.push({
        x: offsetX + week * cellSize,
        y: offsetY + weekday * cellSize,
        size: Math.max(8, cellSize - 2),
        date,
        value,
        fill: value ? colorRamp(value, min, max, '#0f172a', '#22c55e') : 'rgba(148,163,184,0.12)'
      });
    }

    this.cells = cells;
    this.cdr.markForCheck();
  }

  showTooltip(event: MouseEvent, cell: CalendarCell): void {
    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    this.tooltip = {
      visible: true,
      x: event.clientX - rect.left + 12,
      y: event.clientY - rect.top - 24,
      label: cell.date.toLocaleDateString(),
      value: formatNumber(cell.value, true)
    };
  }

  hideTooltip(): void {
    this.tooltip.visible = false;
  }

  onCellClick(cell: CalendarCell): void {
    this.itemClick.emit({
      label: cell.date.toISOString().slice(0, 10),
      value: cell.value
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

function toDate(input: string | Date): Date {
  return input instanceof Date ? input : new Date(input);
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (6 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}
