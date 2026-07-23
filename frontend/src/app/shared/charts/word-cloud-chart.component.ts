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
import { ChartDatum, WordCloudDatum } from './chart-types';
import { CHART_PALETTE, formatNumber, linearScale } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type WordItem = {
  label: string;
  value: number;
  x: number;
  y: number;
  fontSize: number;
  color: string;
};

@Component({
  selector: 'engineers-salary-reference-word-cloud',
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
        @for (item of items; track item) {
          <text
            class="cloud-word"
            [attr.x]="item.x"
            [attr.y]="item.y"
            [attr.font-size]="item.fontSize"
            [attr.fill]="item.color"
            (click)="onWordClick(item)"
            (mousemove)="showTooltip($event, item)"
            (mouseleave)="hideTooltip()"
          >
            {{ item.label }}
          </text>
        }
      </svg>

      @if (tooltip.visible) {
        <div class="chart-tooltip" [style.left.px]="tooltip.x" [style.top.px]="tooltip.y">
          <span class="label">{{ tooltip.label }}</span>
          <span class="value">{{ tooltip.value }}</span>
        </div>
      }
      @if (!items.length) {
        <div class="chart-empty">No data</div>
      }
    </div>
  `,
  styleUrls: ['./chart-base.css'],
  styles: [
    `
      .cloud-word {
        font-weight: 700;
        opacity: 0.95;
        cursor: pointer;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryWordCloudComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data: WordCloudDatum[] = [];
  @Input() height = 260;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 420;
  items: WordItem[] = [];
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
    if (!this.data.length) {
      this.items = [];
      this.cdr.markForCheck();
      return;
    }

    const values = this.data.map(item => item.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const sizeScale = linearScale(min, max || 1, 12, 34);

    const padding = 12;
    const margin = { top: 18, right: 16, bottom: 16, left: 16 };
    const items: WordItem[] = [];

    let x = margin.left;
    let y = margin.top + 24;
    let rowMax = 0;

    this.data
      .slice()
      .sort((a, b) => b.value - a.value)
      .forEach((item, idx) => {
        const fontSize = Math.round(sizeScale(item.value));
        const wordWidth = Math.max(20, item.label.length * fontSize * 0.55);
        if (x + wordWidth > this.width - margin.right) {
          x = margin.left;
          y += rowMax + padding;
          rowMax = 0;
        }
        const color = item.color || CHART_PALETTE[idx % CHART_PALETTE.length];
        items.push({
          label: item.label,
          value: item.value,
          x,
          y,
          fontSize,
          color
        });
        x += wordWidth + padding;
        rowMax = Math.max(rowMax, fontSize);
      });

    this.items = items;
    this.cdr.markForCheck();
  }

  showTooltip(event: MouseEvent, item: WordItem): void {
    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    this.tooltip = {
      visible: true,
      x: event.clientX - rect.left + 10,
      y: event.clientY - rect.top - 18,
      label: item.label,
      value: formatNumber(item.value, true)
    };
  }

  hideTooltip(): void {
    this.tooltip.visible = false;
  }

  onWordClick(item: WordItem): void {
    this.itemClick.emit({ label: item.label, value: item.value, color: item.color });
  }

  export(kind: 'png' | 'svg'): void {
    if (!this.svgRef) return;
    downloadChart(this.svgRef.nativeElement, this.exportName, kind);
  }

  exportCsv(): void {
    downloadCsvSmart(this.exportName, inferCsvPayload(this as LooseValue));
  }
}
