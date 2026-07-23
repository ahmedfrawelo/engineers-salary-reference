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
import { ChartDatum, SankeyLink, SankeyNode } from './chart-types';
import { CHART_PALETTE, formatNumber } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type SankeyNodeShape = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
  color: string;
  side: 'left' | 'right';
};

type SankeyLinkShape = {
  path: string;
  width: number;
  value: number;
  label: string;
  color: string;
  sourceId: string;
  targetId: string;
  sourceLabel: string;
  targetLabel: string;
};

@Component({
  selector: 'engineers-salary-reference-sankey-chart',
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
        <g class="sankey-links">
          @for (link of linkShapes; track link) {
            <path
              class="sankey-link"
              [attr.d]="link.path"
              [attr.stroke]="link.color"
              [attr.stroke-width]="link.width"
              (click)="onLinkClick(link)"
              (mousemove)="showLinkTooltip($event, link)"
              (mouseleave)="hideTooltip()"
            ></path>
          }
        </g>
        <g class="sankey-nodes">
          @for (node of nodeShapes; track node) {
            <g
              (click)="onNodeClick(node)"
              (mousemove)="showNodeTooltip($event, node)"
              (mouseleave)="hideTooltip()"
            >
              <rect
                class="sankey-node"
                [attr.x]="node.x"
                [attr.y]="node.y"
                [attr.width]="node.width"
                [attr.height]="node.height"
                [attr.fill]="node.color"
                [attr.rx]="6"
                [attr.ry]="6"
              ></rect>
              <text
                class="sankey-label"
                [attr.x]="node.side === 'left' ? node.x - 6 : node.x + node.width + 6"
                [attr.y]="node.y + 12"
                [attr.text-anchor]="node.side === 'left' ? 'end' : 'start'"
              >
                {{ node.label }}
              </text>
            </g>
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
      .sankey-link {
        fill: none;
        opacity: 0.4;
        transition: opacity 0.2s ease;
        cursor: pointer;
      }
      .sankey-link:hover {
        opacity: 0.75;
      }
      .sankey-node {
        stroke: rgba(0, 0, 0, 0.15);
        stroke-width: 1;
        cursor: pointer;
      }
      .sankey-label {
        font-size: 10px;
        fill: rgb(var(--muted));
        dominant-baseline: hanging;
        pointer-events: none;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalarySankeyChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() nodes: SankeyNode[] = [];
  @Input() links: SankeyLink[] = [];
  @Input() height = 260;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 640;
  nodeShapes: SankeyNodeShape[] = [];
  linkShapes: SankeyLinkShape[] = [];
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
    if (!this.nodes.length || !this.links.length) {
      this.nodeShapes = [];
      this.linkShapes = [];
      this.cdr.markForCheck();
      return;
    }

    const sourceSet = new Set(this.links.map(link => link.source));
    const targetSet = new Set(this.links.map(link => link.target));
    const leftNodes = this.nodes.filter(n => sourceSet.has(n.id) && !targetSet.has(n.id));
    const rightNodes = this.nodes.filter(n => targetSet.has(n.id) && !sourceSet.has(n.id));
    const fallbackNodes = this.nodes.filter(n => !leftNodes.includes(n) && !rightNodes.includes(n));
    if (!leftNodes.length || !rightNodes.length) {
      leftNodes.push(...fallbackNodes.filter((_, idx) => idx % 2 === 0));
      rightNodes.push(...fallbackNodes.filter((_, idx) => idx % 2 === 1));
    }

    const valueMap = new Map<string, number>();
    this.links.forEach(link => {
      valueMap.set(link.source, (valueMap.get(link.source) || 0) + link.value);
      valueMap.set(link.target, (valueMap.get(link.target) || 0) + link.value);
    });

    const margin = { top: 16, right: 16, bottom: 16, left: 16 };
    const nodeWidth = 14;
    const gap = 10;
    const innerHeight = this.height - margin.top - margin.bottom;
    const leftTotalRaw = leftNodes.reduce(
      (sum, node) => sum + (node.value ?? valueMap.get(node.id) ?? 0),
      0
    );
    const rightTotalRaw = rightNodes.reduce(
      (sum, node) => sum + (node.value ?? valueMap.get(node.id) ?? 0),
      0
    );
    const leftTotal = leftTotalRaw || 1;
    const rightTotal = rightTotalRaw || 1;
    const scaleLeft = (innerHeight - gap * (leftNodes.length - 1)) / leftTotal;
    const scaleRight = (innerHeight - gap * (rightNodes.length - 1)) / rightTotal;

    const leftX = margin.left;
    const rightX = this.width - margin.right - nodeWidth;

    const nodeShapes: SankeyNodeShape[] = [];
    let cursor = margin.top;
    leftNodes.forEach((node, idx) => {
      const value = node.value ?? valueMap.get(node.id) ?? 0;
      const height = Math.max(6, value * scaleLeft);
      nodeShapes.push({
        id: node.id,
        label: node.label,
        x: leftX,
        y: cursor,
        width: nodeWidth,
        height,
        value,
        color: node.color || CHART_PALETTE[idx % CHART_PALETTE.length],
        side: 'left'
      });
      cursor += height + gap;
    });

    cursor = margin.top;
    rightNodes.forEach((node, idx) => {
      const value = node.value ?? valueMap.get(node.id) ?? 0;
      const height = Math.max(6, value * scaleRight);
      nodeShapes.push({
        id: node.id,
        label: node.label,
        x: rightX,
        y: cursor,
        width: nodeWidth,
        height,
        value,
        color: node.color || CHART_PALETTE[(idx + leftNodes.length) % CHART_PALETTE.length],
        side: 'right'
      });
      cursor += height + gap;
    });

    const nodeMap = new Map(nodeShapes.map(node => [node.id, node]));
    const sourceOffset = new Map<string, number>();
    const targetOffset = new Map<string, number>();
    const linkShapes: SankeyLinkShape[] = [];

    const scale = Math.min(scaleLeft, scaleRight);
    this.links.forEach(link => {
      const source = nodeMap.get(link.source);
      const target = nodeMap.get(link.target);
      if (!source || !target) return;
      const offsetS = sourceOffset.get(source.id) || 0;
      const offsetT = targetOffset.get(target.id) || 0;
      const linkHeight = Math.max(2, link.value * scale);
      const y1 = source.y + offsetS + linkHeight / 2;
      const y2 = target.y + offsetT + linkHeight / 2;
      sourceOffset.set(source.id, offsetS + linkHeight);
      targetOffset.set(target.id, offsetT + linkHeight);
      const x1 = source.x + source.width;
      const x2 = target.x;
      const cx = (x1 + x2) / 2;
      const path = `M ${x1} ${y1} C ${cx} ${y1} ${cx} ${y2} ${x2} ${y2}`;
      linkShapes.push({
        path,
        width: linkHeight,
        value: link.value,
        label: `${source.label} -> ${target.label}`,
        color: link.color || source.color,
        sourceId: source.id,
        targetId: target.id,
        sourceLabel: source.label,
        targetLabel: target.label
      });
    });

    this.nodeShapes = nodeShapes;
    this.linkShapes = linkShapes;
    this.cdr.markForCheck();
  }

  showNodeTooltip(event: MouseEvent, node: SankeyNodeShape): void {
    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    this.tooltip = {
      visible: true,
      x: event.clientX - rect.left + 12,
      y: event.clientY - rect.top - 24,
      label: node.label,
      value: formatNumber(node.value, true)
    };
  }

  showLinkTooltip(event: MouseEvent, link: SankeyLinkShape): void {
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

  onNodeClick(node: SankeyNodeShape): void {
    this.itemClick.emit({
      label: node.label,
      value: node.value,
      color: node.color,
      meta: { id: node.id, side: node.side }
    });
  }

  onLinkClick(link: SankeyLinkShape): void {
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
