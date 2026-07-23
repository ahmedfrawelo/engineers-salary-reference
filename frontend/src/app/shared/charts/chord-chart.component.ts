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
import { ChartDatum, ChordLink, ChordNode } from './chart-types';
import { CHART_PALETTE, formatNumber } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type ChordNodeShape = {
  id: string;
  label: string;
  start: number;
  end: number;
  mid: number;
  value: number;
  color: string;
};

type ChordLinkShape = {
  path: string;
  value: number;
  label: string;
  color: string;
  width: number;
  sourceId: string;
  targetId: string;
  sourceLabel: string;
  targetLabel: string;
};

@Component({
  selector: 'engineers-salary-reference-chord-chart',
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
        <g class="chord-links">
          @for (link of linkShapes; track link) {
            <path
              class="chord-link"
              [attr.d]="link.path"
              [attr.stroke]="link.color"
              [attr.stroke-width]="link.width"
              (click)="onLinkClick(link)"
              (mousemove)="showLinkTooltip($event, link)"
              (mouseleave)="hideTooltip()"
            ></path>
          }
        </g>
        <g class="chord-nodes">
          @for (node of nodeShapes; track node) {
            <path
              class="chord-arc"
              [attr.d]="arcPath(node.start, node.end)"
              [attr.stroke]="node.color"
              (click)="onNodeClick(node)"
              (mousemove)="showNodeTooltip($event, node)"
              (mouseleave)="hideTooltip()"
            ></path>
          }
          @for (node of nodeShapes; track node) {
            <text
              class="chord-label"
              [attr.x]="labelPosition(node).x"
              [attr.y]="labelPosition(node).y"
            >
              {{ node.label }}
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
      @if (!nodeShapes.length) {
        <div class="chart-empty">No data</div>
      }
    </div>
  `,
  styleUrls: ['./chart-base.css'],
  styles: [
    `
      .chord-link {
        fill: none;
        opacity: 0.35;
        transition: opacity 0.2s ease;
        cursor: pointer;
      }
      .chord-link:hover {
        opacity: 0.75;
      }
      .chord-arc {
        fill: none;
        stroke-width: 10;
        stroke-linecap: round;
        cursor: pointer;
      }
      .chord-label {
        font-size: 10px;
        fill: rgb(var(--muted));
        text-anchor: middle;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryChordChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() nodes: ChordNode[] = [];
  @Input() links: ChordLink[] = [];
  @Input() height = 260;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 420;
  nodeShapes: ChordNodeShape[] = [];
  linkShapes: ChordLinkShape[] = [];
  tooltip = { visible: false, x: 0, y: 0, label: '', value: '' };

  private ro?: ResizeObserver;
  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.observe();
    this.reflow();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['nodes'] || changes['links'] || changes['height']) {
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
        const nextWidth = Math.max(entry.contentRect.width, 300);
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
      this.width = Math.max(host.clientWidth || 0, 300);
    }
    if (!this.links.length) {
      this.nodeShapes = [];
      this.linkShapes = [];
      this.cdr.markForCheck();
      return;
    }

    const nodeIds = this.nodes.length
      ? this.nodes.map(n => n.id)
      : Array.from(new Set(this.links.flatMap(link => [link.source, link.target])));
    const baseNodes: ChordNode[] = this.nodes.length
      ? this.nodes
      : nodeIds.map(id => ({ id, label: id }));

    const valueMap = new Map<string, number>();
    this.links.forEach(link => {
      valueMap.set(link.source, (valueMap.get(link.source) || 0) + link.value);
      valueMap.set(link.target, (valueMap.get(link.target) || 0) + link.value);
    });

    const totalRaw = baseNodes.reduce(
      (sum, node) => sum + (node.value ?? valueMap.get(node.id) ?? 0),
      0
    );
    const total = totalRaw || 1;
    const gap = 0.08;
    const full = Math.PI * 2 - gap * baseNodes.length;
    let cursor = -Math.PI / 2;

    this.nodeShapes = baseNodes.map((node, idx) => {
      const value = node.value ?? valueMap.get(node.id) ?? 0;
      const span = (value / total) * full;
      const start = cursor;
      const end = cursor + span;
      cursor = end + gap;
      return {
        id: node.id,
        label: node.label,
        start,
        end,
        mid: (start + end) / 2,
        value,
        color: node.color || CHART_PALETTE[idx % CHART_PALETTE.length]
      };
    });

    const nodeMap = new Map(this.nodeShapes.map(node => [node.id, node]));
    const offsetMap = new Map<string, number>();
    const linkShapes: ChordLinkShape[] = [];
    this.links.forEach(link => {
      const source = nodeMap.get(link.source);
      const target = nodeMap.get(link.target);
      if (!source || !target) return;
      const sourceOffset = offsetMap.get(source.id) || 0;
      const targetOffset = offsetMap.get(target.id) || 0;
      const sourceAngle =
        source.start +
        ((sourceOffset + link.value / 2) / (source.value || 1)) * (source.end - source.start);
      const targetAngle =
        target.start +
        ((targetOffset + link.value / 2) / (target.value || 1)) * (target.end - target.start);
      offsetMap.set(source.id, sourceOffset + link.value);
      offsetMap.set(target.id, targetOffset + link.value);

      const p1 = polar(this.width / 2, this.height / 2, this.innerRadius(), sourceAngle);
      const p2 = polar(this.width / 2, this.height / 2, this.innerRadius(), targetAngle);
      const path = `M ${p1.x} ${p1.y} Q ${this.width / 2} ${this.height / 2} ${p2.x} ${p2.y}`;
      linkShapes.push({
        path,
        value: link.value,
        label: `${source.label} -> ${target.label}`,
        color: link.color || source.color,
        width: Math.max(1, link.value * 0.04),
        sourceId: source.id,
        targetId: target.id,
        sourceLabel: source.label,
        targetLabel: target.label
      });
    });

    this.linkShapes = linkShapes;
    this.cdr.markForCheck();
  }

  innerRadius(): number {
    return Math.min(this.width, this.height) / 2 - 24;
  }

  arcPath(start: number, end: number): string {
    const r = this.innerRadius();
    const cx = this.width / 2;
    const cy = this.height / 2;
    const p1 = polar(cx, cy, r, start);
    const p2 = polar(cx, cy, r, end);
    const large = end - start > Math.PI ? 1 : 0;
    return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y}`;
  }

  labelPosition(node: ChordNodeShape): { x: number; y: number } {
    const r = this.innerRadius() + 14;
    return polar(this.width / 2, this.height / 2, r, node.mid);
  }

  showNodeTooltip(event: MouseEvent, node: ChordNodeShape): void {
    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    this.tooltip = {
      visible: true,
      x: event.clientX - rect.left + 12,
      y: event.clientY - rect.top - 24,
      label: node.label,
      value: formatNumber(node.value, true)
    };
  }

  showLinkTooltip(event: MouseEvent, link: ChordLinkShape): void {
    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    this.tooltip = {
      visible: true,
      x: event.clientX - rect.left + 12,
      y: event.clientY - rect.top - 24,
      label: link.label,
      value: formatNumber(link.value, true)
    };
  }

  hideTooltip(): void {
    this.tooltip.visible = false;
  }

  onNodeClick(node: ChordNodeShape): void {
    this.itemClick.emit({
      label: node.label,
      value: node.value,
      color: node.color,
      meta: { id: node.id }
    });
  }

  onLinkClick(link: ChordLinkShape): void {
    this.itemClick.emit({
      label: link.label,
      value: link.value,
      color: link.color,
      meta: {
        source: link.sourceLabel,
        target: link.targetLabel,
        sourceId: link.sourceId,
        targetId: link.targetId
      }
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

function polar(cx: number, cy: number, r: number, angle: number): { x: number; y: number } {
  return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
}
