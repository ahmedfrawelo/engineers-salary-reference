import { CommonModule } from '@angular/common';
import { Component, ContentChild, EventEmitter, Input, Output, TemplateRef } from '@angular/core';

type RowClassFn = (index: number, item: unknown) => string | string[] | Record<string, boolean>;
type RowDepthFn = (index: number, item: unknown) => number;

@Component({
  selector: 'thread-tree',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="thread-tree"
      [class.collapsed]="collapsed"
      [class.thread-hover]="threadHover"
      [style.--thread-row-height.px]="rowHeight"
      [style.--thread-branch-height.px]="branchHeight"
      [style.--thread-line-width.px]="lineWidth"
      [style.--thread-line-active-width.px]="lineActiveWidth"
      [style.--thread-branch-width.px]="branchWidth"
      [style.--thread-indent-step.px]="indentStep"
      [style.--thread-label-width.px]="labelWidth"
      [style.--thread-row-pad-inline.px]="rowPadding"
    >
      <button
        type="button"
        class="thread-hitbox"
        (click)="toggle()"
        (mouseenter)="threadHover = true"
        (mouseleave)="threadHover = false"
        [style.top.px]="0"
        [style.height.px]="hitboxHeight"
        [style.width.px]="hitboxWidth"
        [attr.aria-expanded]="!collapsed"
        [attr.aria-label]="ariaLabel"
      ></button>
      @for (item of items; track item; let i = $index) {
        <div
          class="thread-row"
          [class.thread-root]="resolveRowDepth(i, item) === 0"
          [class.thread-has-child]="hasRowChild(i, item)"
          [style.--thread-depth]="resolveRowDepth(i, item)"
          [style.--thread-depth-shift.px]="resolveRowDepth(i, item) * indentStep"
          [style.--thread-parent-depth-shift.px]="resolveParentDepthShift(i, item)"
          [ngClass]="rowClass ? rowClass(i, item) : null"
        >
          <ng-container
            *ngTemplateOutlet="rowTemplate || defaultRow; context: { $implicit: item, index: i }"
          ></ng-container>
        </div>
      }
      <ng-template #defaultRow let-index="index">
        <div class="thread-label">L{{ index + 1 }}</div>
      </ng-template>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .thread-tree {
        --thread-line-width: 1px;
        --thread-line-active-width: 2px;
        --thread-branch-width: 16px;
        --thread-branch-height: 12px;
        --thread-curve-radius: 12px;
        --thread-indent-step: 18px;
        --thread-label-width: 88px;
        --thread-row-pad-inline: 6px;
        --thread-line-left: calc(var(--thread-row-pad-inline) + var(--thread-label-width) * 0.5);
        --thread-line-offset: calc(var(--thread-line-left) - var(--thread-row-pad-inline));
        --thread-row-height: 52px;
        --thread-line-color: var(--mc-panel-soft);
        border-radius: 12px;
        border: none;
        background: transparent;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0;
        position: relative;
        padding-left: 0;
        width: 100%;
        box-sizing: border-box;
      }

      .thread-row {
        display: grid;
        grid-template-columns: var(--thread-label-width) minmax(0, 1fr) 80px;
        align-items: center;
        gap: 10px;
        padding: 10px var(--thread-row-pad-inline);
        height: var(--thread-row-height);
        border-radius: 0;
        border: none;
        background: transparent;
        position: relative;
        z-index: 1;
        width: 100%;
        box-sizing: border-box;
      }

      .thread-row > * {
        position: relative;
        z-index: 2;
      }

      .thread-row.thread-has-child {
        background-image: linear-gradient(
          to bottom,
          transparent 50%,
          var(--thread-line-color) 50%,
          var(--thread-line-color) 100%
        );
        background-repeat: no-repeat;
        background-size: var(--thread-line-width) 100%;
        background-position: calc(var(--thread-line-left) + var(--thread-depth-shift)) 0;
        transition: background 0.2s ease;
      }

      .thread-row:not(.thread-root)::before {
        content: '';
        position: absolute;
        inset-inline-start: calc(var(--thread-line-left) + var(--thread-parent-depth-shift));
        top: 0;
        height: calc(50% - var(--thread-branch-height));
        border-inline-start: var(--thread-line-width) solid var(--thread-line-color);
        z-index: 0;
        transition: border-color 0.2s ease;
      }

      .thread-row:not(.thread-root)::after {
        content: '';
        position: absolute;
        inset-inline-start: calc(var(--thread-line-left) + var(--thread-parent-depth-shift));
        top: calc(50% - var(--thread-branch-height));
        width: var(--thread-indent-step);
        height: var(--thread-branch-height);
        border-inline-start: var(--thread-line-width) solid var(--thread-line-color);
        border-block-end: var(--thread-line-width) solid var(--thread-line-color);
        border-end-start-radius: var(--thread-curve-radius);
        z-index: 0;
        transition: border-color 0.2s ease;
      }

      .thread-row.is-locked {
        opacity: 0.6;
      }

      .thread-label {
        font-size: 12px;
        font-weight: 700;
        color: var(--mc-muted-2);
        text-transform: uppercase;
        letter-spacing: 0.12em;
        padding-inline-start: 0;
        text-align: center;
      }

      .thread-row:not(.thread-root) .thread-label {
        padding-inline-start: min(
          calc(var(--thread-line-offset) + var(--thread-depth-shift) + 8px),
          calc(var(--thread-label-width) - 24px)
        );
        text-align: start;
      }

      :host ::ng-deep .thread-tree .thread-label {
        font-size: 12px;
        font-weight: 700;
        color: var(--mc-muted-2);
        text-transform: uppercase;
        letter-spacing: 0.12em;
        padding-inline-start: 0;
        text-align: center;
      }

      :host ::ng-deep .thread-tree .thread-row:not(.thread-root) .thread-label {
        padding-inline-start: min(
          calc(var(--thread-line-offset) + var(--thread-depth-shift) + 8px),
          calc(var(--thread-label-width) - 24px)
        );
        text-align: start;
      }

      .thread-hitbox {
        position: absolute;
        inset-inline-start: 0;
        border: none;
        padding: 0;
        margin: 0;
        background: transparent;
        cursor: pointer;
        z-index: 3;
      }

      .thread-tree.thread-hover {
        --thread-line-color: rgb(var(--mc-primary));
      }

      .thread-tree.collapsed .thread-row:not(.thread-root) {
        display: none;
      }
    `
  ]
})
export class ThreadTreeComponent {
  @Input() items: unknown[] = [];
  @Input() collapsed = false;
  @Input() rowHeight = 52;
  @Input() branchHeight = 12;
  @Input() lineStartRatio = 0.7;
  @Input() lineEndRatio = 0.5;
  @Input() lineTrim = 8;
  @Input() lineWidth = 1;
  @Input() lineActiveWidth = 2;
  @Input() branchWidth = 16;
  @Input() indentStep = 18;
  @Input() labelWidth = 88;
  @Input() rowPadding = 6;
  @Input() ariaLabel = 'Toggle thread';
  @Input() rowClass?: RowClassFn;
  @Input() rowDepth?: RowDepthFn;
  @Output() collapsedChange = new EventEmitter<boolean>();

  @ContentChild(TemplateRef) rowTemplate?: TemplateRef<{
    $implicit: unknown;
    index: number;
  }>;

  threadHover = false;

  get hitboxHeight(): number {
    const count = this.collapsed ? 1 : Math.max(1, this.items.length);
    return count * this.rowHeight;
  }

  get hitboxWidth(): number {
    return this.rowPadding + this.labelWidth * 0.5 + this.indentStep + 14;
  }

  toggle(): void {
    this.collapsed = !this.collapsed;
    this.collapsedChange.emit(this.collapsed);
  }

  resolveRowDepth(index: number, item: unknown): number {
    const rawDepth = this.rowDepth ? this.rowDepth(index, item) : index;
    const normalized = Number.isFinite(rawDepth) ? Math.floor(rawDepth) : index;
    return Math.max(0, normalized);
  }

  hasRowChild(index: number, item: unknown): boolean {
    if (this.collapsed || index >= this.items.length - 1) {
      return false;
    }
    const currentDepth = this.resolveRowDepth(index, item);
    const nextItem = this.items[index + 1];
    if (nextItem === undefined) {
      return false;
    }
    return this.resolveRowDepth(index + 1, nextItem) > currentDepth;
  }

  resolveParentDepthShift(index: number, item: unknown): number {
    return Math.max(0, this.resolveRowDepth(index, item) - 1) * this.indentStep;
  }
}
