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
import { ChartDatum, TreemapDatum } from './chart-types';
import { CHART_PALETTE, formatNumber } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type TreemapNode = {
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
  ry: number;
  label: string;
  value: number;
  color: string;
};

@Component({
  selector: 'engineers-salary-reference-treemap-chart',
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
        <g class="treemap-nodes">
          @for (node of nodes; track node) {
            <ng-container>
              <rect
                class="treemap-rect"
                [attr.x]="node.x"
                [attr.y]="node.y"
                [attr.width]="node.width"
                [attr.height]="node.height"
                [attr.fill]="node.color"
                [attr.rx]="node.rx"
                [attr.ry]="node.ry"
                (click)="onNodeClick(node)"
                (mousemove)="showTooltip($event, node)"
                (mouseleave)="hideTooltip()"
              ></rect>
              @if (node.width > 48 && node.height > 24) {
                <text class="treemap-label" [attr.x]="node.x + 8" [attr.y]="node.y + 18">
                  {{ node.label }}
                </text>
              }
            </ng-container>
          }
        </g>
      </svg>

      @if (tooltip.visible) {
        <div class="chart-tooltip" [style.left.px]="tooltip.x" [style.top.px]="tooltip.y">
          <span class="label">{{ tooltip.label }}</span>
          <span class="value">{{ tooltip.value }}</span>
        </div>
      }
      @if (!nodes.length) {
        <div class="chart-empty">No data</div>
      }
    </div>
  `,
  styleUrls: ['./chart-base.css'],
  styles: [
    `
      .treemap-rect {
        stroke: rgba(0, 0, 0, 0.12);
        stroke-width: 1;
        cursor: pointer;
      }
      .treemap-label {
        font-size: 11px;
        fill: #f8fafc;
        font-weight: 600;
        pointer-events: none;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryTreemapChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data: TreemapDatum[] = [];
  @Input() height = 320;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 640;
  nodes: TreemapNode[] = [];
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
    const height = this.height;
    const pad = 12;
    const items = this.data.filter(item => item.value > 0).sort((a, b) => b.value - a.value);
    const total = items.reduce((sum, item) => sum + item.value, 0);
    if (!items.length || total <= 0) {
      this.nodes = [];
      return;
    }

    const rect = { x: pad, y: pad, width: this.width - pad * 2, height: height - pad * 2 };
    const areas = items.map(item => ({
      ...item,
      area: (item.value / total) * rect.width * rect.height
    }));

    const nodes: TreemapNode[] = [];
    squarify(areas, rect, nodes);
    this.nodes = nodes.map((node, idx) => {
      const radius = Math.max(0, Math.min(6, Math.floor(Math.min(node.width, node.height) / 4)));
      return {
        ...node,
        rx: radius,
        ry: radius,
        color: node.color || CHART_PALETTE[idx % CHART_PALETTE.length]
      };
    });
    this.cdr.markForCheck();
  }

  showTooltip(event: MouseEvent, node: TreemapNode): void {
    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    this.tooltip = {
      visible: true,
      x: event.clientX - rect.left + 12,
      y: event.clientY - rect.top - 24,
      label: node.label,
      value: formatNumber(node.value)
    };
  }

  hideTooltip(): void {
    this.tooltip.visible = false;
  }

  onNodeClick(node: TreemapNode): void {
    this.itemClick.emit({ label: node.label, value: node.value, color: node.color });
  }

  export(kind: 'png' | 'svg'): void {
    if (!this.svgRef) return;
    downloadChart(this.svgRef.nativeElement, this.exportName, kind);
  }

  exportCsv(): void {
    downloadCsvSmart(this.exportName, inferCsvPayload(this as LooseValue));
  }
}

type AreaItem = TreemapDatum & { area: number };

function squarify(
  items: AreaItem[],
  rect: { x: number; y: number; width: number; height: number },
  out: TreemapNode[]
) {
  let remaining = items.slice();
  let row: AreaItem[] = [];
  let shortSide = Math.min(rect.width, rect.height);

  while (remaining.length) {
    const next = remaining[0];
    if (!row.length || worst(row.concat(next), shortSide) <= worst(row, shortSide)) {
      row.push(next);
      remaining.shift();
    } else {
      layoutRow(row, rect, out);
      rect = cutRect(rect, row);
      shortSide = Math.min(rect.width, rect.height);
      row = [];
    }
  }
  if (row.length) {
    layoutRow(row, rect, out);
  }
}

function worst(row: AreaItem[], shortSide: number): number {
  if (!row.length) return Number.POSITIVE_INFINITY;
  const sum = row.reduce((acc, item) => acc + item.area, 0);
  const max = Math.max(...row.map(item => item.area));
  const min = Math.min(...row.map(item => item.area));
  const sideSquared = shortSide * shortSide;
  return Math.max((sideSquared * max) / (sum * sum), (sum * sum) / (sideSquared * min));
}

function layoutRow(
  row: AreaItem[],
  rect: { x: number; y: number; width: number; height: number },
  out: TreemapNode[]
) {
  const sum = row.reduce((acc, item) => acc + item.area, 0);
  const horizontal = rect.width >= rect.height;
  const rowSize = sum ? (horizontal ? sum / rect.width : sum / rect.height) : 0;
  let offset = horizontal ? rect.x : rect.y;

  for (const item of row) {
    const itemSize = rowSize ? item.area / rowSize : 0;
    const node: TreemapNode = {
      x: horizontal ? offset : rect.x,
      y: horizontal ? rect.y : offset,
      width: horizontal ? itemSize : rowSize,
      height: horizontal ? rowSize : itemSize,
      rx: 0,
      ry: 0,
      label: item.label,
      value: item.value,
      color: item.color || ''
    };
    out.push(node);
    offset += itemSize;
  }
}

function cutRect(rect: { x: number; y: number; width: number; height: number }, row: AreaItem[]) {
  const sum = row.reduce((acc, item) => acc + item.area, 0);
  if (rect.width >= rect.height) {
    const height = sum / rect.width;
    return {
      x: rect.x,
      y: rect.y + height,
      width: rect.width,
      height: rect.height - height
    };
  }
  const width = sum / rect.height;
  return {
    x: rect.x + width,
    y: rect.y,
    width: rect.width - width,
    height: rect.height
  };
}
