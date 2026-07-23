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
import { ChartDatum, UpsetDatum } from './chart-types';
import { formatNumber, linearScale } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type UpsetCombo = {
  sets: string[];
  value: number;
  x: number;
  barHeight: number;
};

@Component({
  selector: 'engineers-salary-reference-upset-chart',
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
        <g class="upset-bars">
          @for (combo of combos; track combo) {
            <rect
              class="upset-bar"
              [attr.x]="combo.x"
              [attr.y]="margin.top - combo.barHeight"
              [attr.width]="bandwidth"
              [attr.height]="combo.barHeight"
              (click)="onComboClick(combo)"
            ></rect>
          }
        </g>
        <g class="upset-matrix">
          @for (combo of combos; track combo) {
            <g>
              @for (set of sets; track set; let idx = $index) {
                <circle
                  class="upset-dot"
                  [attr.cx]="combo.x + bandwidth / 2"
                  [attr.cy]="matrixY(idx)"
                  [attr.r]="setSelected(combo, set) ? 4.6 : 3.4"
                  [attr.fill]="
                    setSelected(combo, set) ? 'rgb(var(--primary))' : 'rgba(148,163,184,0.4)'
                  "
                ></circle>
              }
              @if (combo.sets.length > 1) {
                <line
                  class="upset-line"
                  [attr.x1]="combo.x + bandwidth / 2"
                  [attr.x2]="combo.x + bandwidth / 2"
                  [attr.y1]="matrixY(firstSetIndex(combo))"
                  [attr.y2]="matrixY(lastSetIndex(combo))"
                ></line>
              }
            </g>
          }
        </g>
        <g class="upset-labels">
          @for (set of sets; track set; let idx = $index) {
            <text
              class="upset-set"
              [attr.x]="margin.left - 8"
              [attr.y]="matrixY(idx) + 4"
              text-anchor="end"
            >
              {{ set }}
            </text>
          }
        </g>
      </svg>
      @if (!combos.length) {
        <div class="chart-empty">No data</div>
      }
    </div>
  `,
  styleUrls: ['./chart-base.css'],
  styles: [
    `
      .upset-bar {
        fill: rgb(var(--primary));
        opacity: 0.8;
        cursor: pointer;
      }
      .upset-line {
        stroke: rgb(var(--primary));
        stroke-width: 2;
      }
      .upset-set {
        font-size: 10px;
        fill: rgb(var(--fg));
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryUpsetChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() sets: string[] = [];
  @Input() data: UpsetDatum[] = [];
  @Input() height = 260;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 460;
  margin = { top: 40, right: 16, bottom: 16, left: 70 };
  bandwidth = 30;
  combos: UpsetCombo[] = [];

  private ro?: ResizeObserver;
  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.observe();
    this.reflow();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] || changes['sets'] || changes['height']) {
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
    if (!this.data.length || !this.sets.length) {
      this.combos = [];
      this.cdr.markForCheck();
      return;
    }

    const combos = this.data
      .slice()
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
    const innerWidth = this.width - this.margin.left - this.margin.right;
    this.bandwidth = Math.min(50, innerWidth / Math.max(combos.length, 1) - 6);
    const max = Math.max(...combos.map(c => c.value), 1);
    const scale = linearScale(0, max, 0, this.margin.top - 8);

    this.combos = combos.map((combo, idx) => ({
      sets: combo.sets,
      value: combo.value,
      x: this.margin.left + idx * (this.bandwidth + 10),
      barHeight: scale(combo.value)
    }));
    this.cdr.markForCheck();
  }

  matrixY(idx: number): number {
    const innerHeight = this.height - this.margin.top - this.margin.bottom;
    if (this.sets.length <= 1) return this.margin.top + innerHeight / 2;
    return this.margin.top + (innerHeight / (this.sets.length - 1)) * idx;
  }

  setSelected(combo: UpsetCombo, set: string): boolean {
    return combo.sets.includes(set);
  }

  firstSetIndex(combo: UpsetCombo): number {
    const indices = combo.sets.map(set => this.sets.indexOf(set)).filter(v => v >= 0);
    return indices.length ? Math.min(...indices) : 0;
  }

  lastSetIndex(combo: UpsetCombo): number {
    const indices = combo.sets.map(set => this.sets.indexOf(set)).filter(v => v >= 0);
    return indices.length ? Math.max(...indices) : 0;
  }

  format(value: number): string {
    return formatNumber(value, true);
  }

  export(kind: 'png' | 'svg'): void {
    if (!this.svgRef) return;
    downloadChart(this.svgRef.nativeElement, this.exportName, kind);
  }

  exportCsv(): void {
    downloadCsvSmart(this.exportName, inferCsvPayload(this as LooseValue));
  }

  onComboClick(combo: UpsetCombo): void {
    this.itemClick.emit({
      label: combo.sets.join(' & '),
      value: combo.value,
      meta: { sets: combo.sets }
    });
  }
}
