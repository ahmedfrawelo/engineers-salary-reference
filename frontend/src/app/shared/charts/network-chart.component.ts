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
import { ChartDatum, NetworkLink, NetworkNode } from './chart-types';
import { CHART_PALETTE, formatNumber } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type NodeShape = {
  id: string;
  label: string;
  x: number;
  y: number;
  r: number;
  color: string;
  value: number;
};

type LinkShape = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
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
  selector: 'engineers-salary-reference-network-chart',
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
        <g class="network-links">
          @for (link of linkShapes; track link) {
            <line
              class="network-link"
              [attr.x1]="link.x1"
              [attr.y1]="link.y1"
              [attr.x2]="link.x2"
              [attr.y2]="link.y2"
              [attr.stroke]="link.color"
              [attr.stroke-width]="link.width"
              (click)="onLinkClick(link)"
              (mousemove)="showLinkTooltip($event, link)"
              (mouseleave)="hideTooltip()"
            ></line>
          }
        </g>
        <g class="network-nodes">
          @for (node of nodeShapes; track node) {
            <g
              (click)="onNodeClick(node)"
              (mousemove)="showNodeTooltip($event, node)"
              (mouseleave)="hideTooltip()"
            >
              <circle
                class="network-node"
                [attr.cx]="node.x"
                [attr.cy]="node.y"
                [attr.r]="node.r"
                [attr.fill]="node.color"
              ></circle>
              <text class="network-label" [attr.x]="node.x" [attr.y]="node.y - node.r - 4">
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
      .network-link {
        opacity: 0.4;
      }
      .network-node {
        stroke: rgba(0, 0, 0, 0.2);
        stroke-width: 1;
        cursor: pointer;
      }
      .network-link {
        cursor: pointer;
      }
      .network-label {
        font-size: 9px;
        fill: rgb(var(--muted));
        text-anchor: middle;
        pointer-events: none;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryNetworkChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() nodes: NetworkNode[] = [];
  @Input() links: NetworkLink[] = [];
  @Input() height = 260;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 420;
  nodeShapes: NodeShape[] = [];
  linkShapes: LinkShape[] = [];
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
    if (!this.nodes.length) {
      this.nodeShapes = [];
      this.linkShapes = [];
      this.cdr.markForCheck();
      return;
    }

    const center = { x: this.width / 2, y: this.height / 2 };
    const groups = new Map<string, NetworkNode[]>();
    this.nodes.forEach(node => {
      const group = node.group || 'default';
      const list = groups.get(group) ?? [];
      list.push(node);
      groups.set(group, list);
    });

    const groupKeys = Array.from(groups.keys());
    const ringGap = 60;
    const baseRadius = Math.min(this.width, this.height) / 2 - 30;
    const nodeShapes: NodeShape[] = [];
    groupKeys.forEach((group, idx) => {
      const list = groups.get(group) || [];
      const radius = Math.max(40, baseRadius - idx * ringGap);
      const step = (Math.PI * 2) / Math.max(list.length, 1);
      list.forEach((node, nIdx) => {
        const angle = step * nIdx - Math.PI / 2;
        const x = center.x + Math.cos(angle) * radius;
        const y = center.y + Math.sin(angle) * radius;
        const value = node.value ?? 1;
        const r = Math.max(6, Math.min(16, Math.sqrt(value)));
        nodeShapes.push({
          id: node.id,
          label: node.label,
          x,
          y,
          r,
          value,
          color: node.color || CHART_PALETTE[(idx + nIdx) % CHART_PALETTE.length]
        });
      });
    });

    const nodeMap = new Map(nodeShapes.map(node => [node.id, node]));
    const linkShapes: LinkShape[] = [];
    this.links.forEach(link => {
      const source = nodeMap.get(link.source);
      const target = nodeMap.get(link.target);
      if (!source || !target) return;
      const value = link.value ?? 1;
      linkShapes.push({
        x1: source.x,
        y1: source.y,
        x2: target.x,
        y2: target.y,
        width: Math.max(1, Math.min(6, value * 0.08)),
        value,
        label: `${source.label} -> ${target.label}`,
        color: link.color || 'rgba(148,163,184,0.6)',
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

  showNodeTooltip(event: MouseEvent, node: NodeShape): void {
    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    this.tooltip = {
      visible: true,
      x: event.clientX - rect.left + 12,
      y: event.clientY - rect.top - 24,
      label: node.label,
      value: formatNumber(node.value, true)
    };
  }

  showLinkTooltip(event: MouseEvent, link: LinkShape): void {
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

  onNodeClick(node: NodeShape): void {
    this.itemClick.emit({
      label: node.label,
      value: node.value,
      color: node.color,
      meta: { id: node.id }
    });
  }

  onLinkClick(link: LinkShape): void {
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
