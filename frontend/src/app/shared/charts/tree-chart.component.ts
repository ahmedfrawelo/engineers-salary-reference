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
import { ChartDatum, TreeNode } from './chart-types';
import { formatNumber } from './chart-utils';
import { downloadChart, downloadCsvSmart, inferCsvPayload } from './chart-export';

type LooseValue = ReturnType<typeof JSON.parse>;
type TreePoint = {
  id: string;
  label: string;
  value: number;
  x: number;
  y: number;
  depth: number;
  parentId?: string;
};

type TreeLink = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

@Component({
  selector: 'engineers-salary-reference-tree-chart',
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
        @for (link of links; track link) {
          <line
            class="tree-link"
            [attr.x1]="link.x1"
            [attr.y1]="link.y1"
            [attr.x2]="link.x2"
            [attr.y2]="link.y2"
          ></line>
        }
        @for (node of nodes; track node) {
          <g>
            <rect
              class="tree-node"
              [attr.x]="node.x - 6"
              [attr.y]="node.y - 10"
              [attr.width]="nodeWidth(node)"
              [attr.height]="20"
              (click)="onNodeClick(node)"
            ></rect>
            <text
              class="tree-label"
              [attr.x]="node.x"
              [attr.y]="node.y + 4"
              (click)="onNodeClick(node)"
            >
              {{ node.label }} ({{ formatNumber(node.value, true) }})
            </text>
          </g>
        }
      </svg>
      @if (!nodes.length) {
        <div class="chart-empty">No data</div>
      }
    </div>
  `,
  styleUrls: ['./chart-base.css'],
  styles: [
    `
      .tree-link {
        stroke: rgba(148, 163, 184, 0.45);
        stroke-width: 1.2;
      }
      .tree-node {
        fill: rgba(14, 165, 233, 0.15);
        stroke: rgba(14, 165, 233, 0.45);
        rx: 8;
        ry: 8;
        cursor: pointer;
      }
      .tree-label {
        font-size: 10px;
        fill: rgb(var(--fg));
        font-weight: 700;
        text-anchor: start;
        cursor: pointer;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryTreeChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() root: TreeNode | null = null;
  @Input() height = 260;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgRef', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  width = 520;
  nodes: TreePoint[] = [];
  links: TreeLink[] = [];

  private ro?: ResizeObserver;
  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.observe();
    this.reflow();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['root'] || changes['height']) {
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
    if (!this.root) {
      this.nodes = [];
      this.links = [];
      this.cdr.markForCheck();
      return;
    }

    const margin = { top: 20, left: 20 };
    const points: TreePoint[] = [];
    const links: TreeLink[] = [];
    let order = 0;
    const depthSpacing = 140;

    const walk = (node: TreeNode, depth: number, parentId?: string) => {
      const y = margin.top + order * 28;
      const x = margin.left + depth * depthSpacing;
      const value = node.value ?? (node.children ? node.children.length : 0);
      points.push({
        id: node.id,
        label: node.label,
        value,
        x,
        y,
        depth,
        parentId
      });
      order += 1;
      node.children?.forEach(child => walk(child, depth + 1, node.id));
    };

    walk(this.root, 0, undefined);

    const pointMap = new Map(points.map(pt => [pt.id, pt]));
    points.forEach(pt => {
      if (!pt.parentId) return;
      const parent = pointMap.get(pt.parentId);
      if (!parent) return;
      links.push({
        x1: parent.x + this.nodeWidth(parent),
        y1: parent.y,
        x2: pt.x,
        y2: pt.y
      });
    });

    this.nodes = points;
    this.links = links;
    this.cdr.markForCheck();
  }

  nodeWidth(node: TreePoint): number {
    return Math.max(120, node.label.length * 6 + 60);
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

  onNodeClick(node: TreePoint): void {
    const kind = node.depth === 1 ? 'owner' : node.depth === 2 ? 'stage' : 'node';
    this.itemClick.emit({
      label: node.label,
      value: node.value,
      meta: { kind, depth: node.depth, parent: node.parentId }
    });
  }
}
