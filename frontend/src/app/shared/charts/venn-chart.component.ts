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
import { ChartDatum, VennIntersection, VennSet } from './chart-types';
import { formatNumber } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type VennCircle = {
  id: string;
  label: string;
  value: number;
  x: number;
  y: number;
  r: number;
  color: string;
};

type VennLabel = {
  label: string;
  value: number;
  x: number;
  y: number;
};

@Component({
  selector: 'engineers-salary-reference-venn-chart',
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
        @for (c of circles; track c) {
          <circle
            class="venn-circle"
            [attr.cx]="c.x"
            [attr.cy]="c.y"
            [attr.r]="c.r"
            [attr.fill]="c.color"
            [attr.fill-opacity]="0.28"
            [attr.stroke]="c.color"
            [attr.stroke-opacity]="0.7"
            (click)="onCircleClick(c)"
          ></circle>
        }
        @for (c of circles; track c) {
          <text class="venn-title" [attr.x]="c.x" [attr.y]="c.y - c.r - 8">
            {{ c.label }}
          </text>
        }
        @for (l of labels; track l) {
          <text class="venn-value" [attr.x]="l.x" [attr.y]="l.y">
            {{ l.label }}: {{ formatNumber(l.value, true) }}
          </text>
        }
      </svg>

      @if (!circles.length) {
        <div class="chart-empty">No data</div>
      }
    </div>
  `,
  styleUrls: ['./chart-base.css'],
  styles: [
    `
      .venn-circle {
        transition: opacity 0.2s ease;
        cursor: pointer;
      }
      .venn-title {
        font-size: 11px;
        font-weight: 700;
        fill: rgb(var(--fg));
        text-anchor: middle;
      }
      .venn-value {
        font-size: 11px;
        fill: rgb(var(--fg));
        text-anchor: middle;
        font-weight: 700;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryVennChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() sets: VennSet[] = [];
  @Input() intersections: VennIntersection[] = [];
  @Input() height = 260;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 420;
  circles: VennCircle[] = [];
  labels: VennLabel[] = [];

  private ro?: ResizeObserver;
  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.observe();
    this.reflow();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sets'] || changes['intersections'] || changes['height']) {
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
    if (this.sets.length < 2) {
      this.circles = [];
      this.labels = [];
      this.cdr.markForCheck();
      return;
    }

    const palette = ['#22c55e', '#60a5fa', '#f59e0b'];
    const r = Math.min(this.width, this.height) / 3.2;
    const center = { x: this.width / 2, y: this.height / 2 };
    const positions = [
      { x: center.x - r * 0.7, y: center.y - r * 0.2 },
      { x: center.x + r * 0.7, y: center.y - r * 0.2 },
      { x: center.x, y: center.y + r * 0.7 }
    ];

    this.circles = this.sets.slice(0, 3).map((set, idx) => ({
      id: set.id,
      label: set.label,
      value: set.value,
      x: positions[idx].x,
      y: positions[idx].y,
      r,
      color: set.color || palette[idx % palette.length]
    }));

    const labelMap = new Map<string, VennLabel>();
    const idToPos = new Map(this.circles.map(circle => [circle.id, circle]));
    const center3 = {
      x: (positions[0].x + positions[1].x + positions[2].x) / 3,
      y: (positions[0].y + positions[1].y + positions[2].y) / 3
    };
    const positionsMap: Record<string, { x: number; y: number }> = {
      A: positions[0],
      B: positions[1],
      C: positions[2],
      AB: { x: (positions[0].x + positions[1].x) / 2, y: positions[0].y - r * 0.1 },
      AC: {
        x: (positions[0].x + positions[2].x) / 2 - r * 0.1,
        y: (positions[0].y + positions[2].y) / 2 + r * 0.1
      },
      BC: {
        x: (positions[1].x + positions[2].x) / 2 + r * 0.1,
        y: (positions[1].y + positions[2].y) / 2 + r * 0.1
      },
      ABC: center3
    };

    const setIds = this.circles.map(circle => circle.id);
    const idMap: Record<string, string> = {
      [setIds[0]]: 'A',
      [setIds[1]]: 'B',
      [setIds[2]]: 'C'
    };

    this.intersections.forEach(entry => {
      const key = entry.sets
        .map(id => idMap[id])
        .sort()
        .join('');
      const posKey =
        key === 'A' || key === 'B' || key === 'C' ? key : key.length === 2 ? key : 'ABC';
      const pos = positionsMap[posKey];
      if (!pos) return;
      labelMap.set(`${key}`, { label: key, value: entry.value, x: pos.x, y: pos.y });
    });

    this.labels = Array.from(labelMap.values()).map(label => ({
      ...label,
      label:
        label.label === 'A'
          ? (idToPos.get(setIds[0])?.label ?? 'A')
          : label.label === 'B'
            ? (idToPos.get(setIds[1])?.label ?? 'B')
            : label.label === 'C'
              ? (idToPos.get(setIds[2])?.label ?? 'C')
              : label.label
    }));
    this.cdr.markForCheck();
  }

  formatNumber(value: number, compact = false): string {
    return formatNumber(value, compact);
  }

  export(kind: 'png' | 'svg'): void {
    if (!this.svgRef) return;
    downloadChart(this.svgRef.nativeElement, this.exportName, kind);
  }

  exportCsv(): void {
    downloadCsvSmart(this.exportName, inferCsvPayload(this as LooseValue));
  }

  onCircleClick(circle: VennCircle): void {
    this.itemClick.emit({ label: circle.label, value: circle.value, color: circle.color });
  }
}
