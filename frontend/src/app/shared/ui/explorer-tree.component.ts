import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  Directive,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  Output,
  SimpleChanges,
  inject
} from '@angular/core';
import { AppIconDirective } from '@shared/icons/app-icon.directive';

@Directive({
  selector: '[explorerTreeAutoFocus]',
  standalone: true
})
export class ExplorerTreeAutoFocusDirective implements AfterViewInit, OnChanges {
  @Input('explorerTreeAutoFocus') enabled = true;
  @Input() explorerTreeAutoFocusSelect = false;

  private readonly elementRef = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private readonly zone = inject(NgZone);

  ngAfterViewInit(): void {
    this.scheduleFocus();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('enabled' in changes && !changes['enabled'].firstChange) {
      this.scheduleFocus();
    }
  }

  private scheduleFocus(): void {
    if (!this.enabled) {
      return;
    }

    this.zone.runOutsideAngular(() => {
      queueMicrotask(() => {
        const input = this.elementRef.nativeElement;
        if (!input || input.disabled) {
          return;
        }
        input.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        input.focus({ preventScroll: true });
        if (this.explorerTreeAutoFocusSelect) {
          input.select();
        }
      });
    });
  }
}

export type ExplorerTreeNodeId = string | number | null;

export type ExplorerTreeNode = {
  id: ExplorerTreeNodeId;
  label: string;
  meta?: string | null;
  tags?: Array<{ label: string; inherited?: boolean; overflow?: boolean; title?: string | null }>;
  matchesSearch?: boolean;
  count?: number | null;
  recordCount?: number | null;
  priceRecordCount?: number | null;
  selected?: boolean;
  isRoot?: boolean;
  expanded?: boolean;
  canToggle?: boolean;
  tooltip?: string | null;
  showActions?: boolean;
  canAdd?: boolean;
  canRename?: boolean;
  canDelete?: boolean;
  inlineMode?: 'create' | 'rename' | null;
  inlineValue?: string | null;
  inlinePlaceholder?: string | null;
  inlineSaving?: boolean;
  inlineError?: string | null;
  dragging?: boolean;
  dropTarget?: boolean;
  dropBlocked?: boolean;
  dropHint?: string | null;
  dropBlockedHint?: string | null;
  children?: ExplorerTreeNode[];
};

export type ExplorerTreeSelectEvent = {
  node: ExplorerTreeNode;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
};

export type ExplorerTreeContextMenuEvent = {
  node: ExplorerTreeNode;
  clientX: number;
  clientY: number;
  horizontalAlign?: 'auto' | 'left' | 'right';
};

export type ExplorerTreeDoubleClickEvent = {
  node: ExplorerTreeNode;
};

export type ExplorerTreeDragEvent = {
  node: ExplorerTreeNode;
  clientX: number;
  clientY: number;
};

export type ExplorerTreeDropEvent = {
  node: ExplorerTreeNode;
};

export type ExplorerTreePointerDragStartEvent = {
  node: ExplorerTreeNode;
  pointerId: number;
  clientX: number;
  clientY: number;
  grabOffsetX: number;
  grabOffsetY: number;
  sourceWidth: number;
  sourceHeight: number;
};

export type ExplorerTreeActionEvent = {
  node: ExplorerTreeNode;
  action: 'add' | 'rename' | 'delete';
};

export type ExplorerTreeInlineEditorEvent = {
  node: ExplorerTreeNode;
  mode: 'create' | 'rename';
  value: string;
};

export type ExplorerTreeInlineEditorCancelEvent = {
  node: ExplorerTreeNode;
  mode: 'create' | 'rename';
};

@Component({
  selector: 'explorer-tree',
  standalone: true,
  imports: [CommonModule, AppIconDirective, ExplorerTreeAutoFocusDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (root) {
      <div class="explorer-tree" role="tree" [attr.aria-label]="ariaLabel">
        @if (renderRootNode) {
          <ng-container
            [ngTemplateOutlet]="nodeTemplate"
            [ngTemplateOutletContext]="{
              $implicit: root,
              depth: 0,
              isRoot: true,
              isLast: true,
              guides: []
            }"
          ></ng-container>
        } @else {
          @for (child of root.children ?? []; track trackNode($index, child); let last = $last) {
            <ng-container
              [ngTemplateOutlet]="nodeTemplate"
              [ngTemplateOutletContext]="{
                $implicit: child,
                depth: 0,
                isRoot: false,
                isLast: last,
                guides: []
              }"
            ></ng-container>
          }

          @if (root.inlineMode === 'create') {
            <div
              class="explorer-tree__item explorer-tree__item--editor explorer-tree__item--root-editor"
            >
              <div
                class="explorer-tree__row explorer-tree__row--editor"
                role="treeitem"
                aria-level="1"
              >
                <div class="explorer-tree__cell">
                  <div class="explorer-tree__editor explorer-tree__editor--create">
                    <input
                      class="explorer-tree__editor-input"
                      type="text"
                      [value]="root.inlineValue ?? ''"
                      [placeholder]="root.inlinePlaceholder || 'Add child node'"
                      [disabled]="root.inlineSaving"
                      [explorerTreeAutoFocus]="true"
                      (click)="$event.stopPropagation()"
                      (input)="onInlineInput(root, 'create', $event)"
                      (keydown.enter)="onInlineSubmit(root, 'create', $event)"
                      (keydown.escape)="onInlineCancel(root, 'create', $event)"
                    />
                    <div class="explorer-tree__editor-actions">
                      <button
                        type="button"
                        class="explorer-tree__editor-btn"
                        [disabled]="root.inlineSaving"
                        (click)="onInlineCancel(root, 'create', $event)"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        class="explorer-tree__editor-btn is-primary"
                        [disabled]="root.inlineSaving"
                        (click)="onInlineSubmit(root, 'create', $event)"
                      >
                        {{ root.inlineSaving ? 'Adding...' : 'Save' }}
                      </button>
                    </div>
                    @if (root.inlineError) {
                      <div class="explorer-tree__editor-error">{{ root.inlineError }}</div>
                    }
                  </div>
                </div>
              </div>
            </div>
          }
        }

        <ng-template
          #nodeTemplate
          let-node
          let-depth="depth"
          let-isRoot="isRoot"
          let-isLast="isLast"
          let-guides="guides"
        >
          <div
            class="explorer-tree__item"
            [class.is-root]="isRoot"
            [class.is-last]="isLast"
            [class.is-level-0]="depth === 0"
            [class.is-level-1]="depth === 1"
            [class.is-level-2]="depth === 2"
            [class.is-level-3]="depth === 3"
            [class.is-level-deep]="depth >= 4"
            [class.is-branch]="hasChildren(node)"
            [class.is-leaf]="!hasChildren(node)"
            [class.is-expanded]="hasChildren(node) && isExpanded(node)"
            [class.has-tags]="!!node.tags?.length"
            [class.is-selected]="isNodeSelected(node)"
            [class.is-active-node]="isNodeSelected(node)"
            [class.is-dragging]="node.dragging === true"
            [class.is-drop-target]="node.dropTarget === true"
            [class.is-drop-blocked]="node.dropBlocked === true"
            [attr.data-depth]="depth"
            [style.--explorer-tree-depth]="depth"
          >
            <div
              class="explorer-tree__row"
              [class.is-selected]="isNodeSelected(node)"
              [class.is-active-node]="isNodeSelected(node)"
              [class.has-tags]="!!node.tags?.length"
              [class.is-drop-target]="node.dropTarget === true"
              [class.is-drop-blocked]="node.dropBlocked === true"
              [attr.data-explorer-node-id]="node.id"
              role="treeitem"
              [attr.aria-level]="depth + 1"
              [attr.aria-expanded]="hasChildren(node) ? isExpanded(node) : null"
              [attr.aria-selected]="node.selected === true"
              (pointerdown)="onPointerDragStart(node, $event)"
            >
              <div class="explorer-tree__cell">
                @if (guides.length || !isRoot) {
                  <div class="explorer-tree__gutter">
                    @for (guide of guides; track $index) {
                      <span
                        class="explorer-tree__guide"
                        [class.is-active]="guide"
                        aria-hidden="true"
                      ></span>
                    }

                    @if (!isRoot) {
                      <span class="explorer-tree__branch" [class.is-last]="isLast">
                        @if (hasChildren(node)) {
                          <button
                            type="button"
                            class="explorer-tree__toggle"
                            [class.is-open]="isExpanded(node)"
                            [attr.aria-label]="
                              isExpanded(node) ? 'Collapse branch' : 'Expand branch'
                            "
                            (click)="onToggle(node, $event)"
                          >
                            <i
                              appIcon="chevron-right"
                              class="explorer-tree__toggle-icon"
                              aria-hidden="true"
                            ></i>
                          </button>
                        } @else {
                          <span class="explorer-tree__toggle-spacer" aria-hidden="true"></span>
                        }
                      </span>
                    }
                  </div>
                }

                @if (node.inlineMode === 'rename') {
                  <div class="explorer-tree__editor explorer-tree__editor--rename">
                    <input
                      class="explorer-tree__editor-input"
                      type="text"
                      [value]="node.inlineValue ?? node.label"
                      [placeholder]="node.inlinePlaceholder || 'Rename this node'"
                      [disabled]="node.inlineSaving"
                      [explorerTreeAutoFocus]="true"
                      [explorerTreeAutoFocusSelect]="true"
                      (click)="$event.stopPropagation()"
                      (input)="onInlineInput(node, 'rename', $event)"
                      (keydown.enter)="onInlineSubmit(node, 'rename', $event)"
                      (keydown.escape)="onInlineCancel(node, 'rename', $event)"
                    />
                    <div class="explorer-tree__editor-actions">
                      <button
                        type="button"
                        class="explorer-tree__editor-btn"
                        [disabled]="node.inlineSaving"
                        (click)="onInlineCancel(node, 'rename', $event)"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        class="explorer-tree__editor-btn is-primary"
                        [disabled]="node.inlineSaving"
                        (click)="onInlineSubmit(node, 'rename', $event)"
                      >
                        {{ node.inlineSaving ? 'Saving...' : 'Save' }}
                      </button>
                    </div>
                    @if (node.inlineError) {
                      <div class="explorer-tree__editor-error">{{ node.inlineError }}</div>
                    }
                  </div>
                } @else {
                  <button
                    type="button"
                    class="explorer-tree__node"
                    [class.is-selected]="isNodeSelected(node)"
                    [class.is-active-node]="isNodeSelected(node)"
                    [class.is-root]="node.isRoot"
                    [class.is-level-0]="depth === 0"
                    [class.is-level-1]="depth === 1"
                    [class.is-level-2]="depth === 2"
                    [class.is-level-3]="depth === 3"
                    [class.is-level-deep]="depth >= 4"
                    [class.is-branch]="hasChildren(node)"
                    [class.is-leaf]="!hasChildren(node)"
                    [class.has-tags]="!!node.tags?.length"
                    [class.is-search-match]="node.matchesSearch === true"
                    [class.is-expanded]="hasChildren(node) && isExpanded(node)"
                    [attr.data-depth]="depth"
                    [attr.data-explorer-node-id]="node.id"
                    [attr.title]="node.tooltip || node.label"
                    [attr.aria-current]="isNodeSelected(node) ? 'true' : null"
                    [class.is-dragging]="node.dragging === true"
                    [class.is-drop-target]="node.dropTarget === true"
                    [class.is-drop-blocked]="node.dropBlocked === true"
                    (click)="onSelect(node, $event)"
                    (dblclick)="onDoubleClick(node, $event)"
                    (contextmenu)="onContextMenu(node, $event)"
                    (keydown)="onNodeKeydown(node, $event)"
                  >
                    @if (showGlyph) {
                      <span
                        class="explorer-tree__glyph"
                        [class.is-branch]="hasChildren(node)"
                        [class.is-root]="node.isRoot"
                        aria-hidden="true"
                      ></span>
                    }

                    <span class="explorer-tree__content">
                      <span class="explorer-tree__title">
                        <span
                          class="explorer-tree__label"
                          [class.is-search-match]="node.matchesSearch === true"
                          dir="auto"
                        >
                          @for (part of getLabelParts(node.label); track $index) {
                            @if (part.match) {
                              <mark class="explorer-tree__label-mark">{{ part.text }}</mark>
                            } @else {
                              <span>{{ part.text }}</span>
                            }
                          }
                        </span>
                      </span>

                    @if (showMeta && node.meta) {
                      <span class="explorer-tree__meta" dir="auto">{{ node.meta }}</span>
                    }

                      @if (node.tags?.length) {
                        <span class="explorer-tree__tag-list" aria-label="Material tags">
                          @for (tag of node.tags; track tag.label) {
                            <span
                              class="explorer-tree__tag"
                              [class.is-inherited]="tag.inherited"
                              [class.is-overflow]="tag.overflow"
                              [attr.title]="
                                tag.title || (tag.inherited ? 'Inherited tag' : 'Direct tag')
                              "
                              dir="auto"
                            >
                              {{ tag.label }}
                            </span>
                          }
                        </span>
                      }
                    </span>

                    <span class="explorer-tree__side">
                    @if (
                      shouldShowPriceRecordCount(node) ||
                      shouldShowRecordCount(node) ||
                      shouldShowCount(node)
                    ) {
                      <span class="explorer-tree__badges">
                        @if (shouldShowCount(node)) {
                          <span
                            class="explorer-tree__count-badge explorer-tree__count-badge--branches"
                            [attr.aria-label]="'Child branches: ' + node.count"
                            [attr.title]="getNodeCountSummary(node)"
                          >
                            <i
                              appIcon="tree-branches"
                              class="explorer-tree__count-icon explorer-tree__count-icon--branches"
                              aria-hidden="true"
                            ></i>
                            {{ node.count }}
                          </span>
                        }

                        @if (shouldShowRecordCount(node)) {
                          <span
                            class="explorer-tree__count-badge explorer-tree__count-badge--records"
                            [attr.aria-label]="'Material records: ' + node.recordCount"
                            [attr.title]="getNodeCountSummary(node)"
                          >
                            <i
                              class="explorer-tree__count-icon explorer-tree__count-icon--records"
                              appIcon="box-seam"
                              aria-hidden="true"
                            ></i>
                            {{ node.recordCount }}
                          </span>
                        }

                        @if (shouldShowPriceRecordCount(node)) {
                          <span
                            class="explorer-tree__count-badge explorer-tree__count-badge--price-records"
                            [attr.aria-label]="'Price records: ' + node.priceRecordCount"
                            [attr.title]="getNodeCountSummary(node)"
                          >
                            <i
                              class="explorer-tree__count-icon explorer-tree__count-icon--price-records"
                              appIcon="cash-coin"
                              aria-hidden="true"
                            ></i>
                            {{ node.priceRecordCount }}
                          </span>
                        }
                      </span>
                    }

                      <span
                        class="explorer-tree__more"
                        title="Open menu"
                        (click)="onMore(node, $event)"
                      >
                        <span aria-hidden="true"></span>
                        <span aria-hidden="true"></span>
                        <span aria-hidden="true"></span>
                      </span>
                    </span>

                    @if (node.dropTarget === true && node.dropHint) {
                      <span class="explorer-tree__drop-hint">{{ node.dropHint }}</span>
                    } @else if (node.dropBlocked === true && node.dropBlockedHint) {
                      <span class="explorer-tree__drop-hint is-blocked">
                        {{ node.dropBlockedHint }}
                      </span>
                    }
                  </button>
                }
              </div>
            </div>

            @if (node.inlineMode === 'create' || hasChildren(node)) {
              <div
                class="explorer-tree__children"
                [class.is-collapsed]="hasChildren(node) && !isExpanded(node)"
                role="group"
                [attr.aria-hidden]="hasChildren(node) && !isExpanded(node)"
                [attr.inert]="hasChildren(node) && !isExpanded(node) ? '' : null"
              >
                <div class="explorer-tree__children-track">
                  @if (shouldRenderChildren(node)) {
                    <span
                      class="explorer-tree__thread-hitbox"
                      aria-hidden="true"
                      (click)="onToggle(node, $event)"
                      (pointerdown)="$event.stopPropagation()"
                    >
                      <span class="explorer-tree__thread-line" aria-hidden="true"></span>
                    </span>
                  }

                  @if (node.inlineMode === 'create') {
                    <div
                      class="explorer-tree__item explorer-tree__item--editor"
                      [class.is-last]="(node.children?.length ?? 0) === 0"
                    >
                      <div
                        class="explorer-tree__row explorer-tree__row--editor"
                        role="treeitem"
                        [attr.aria-level]="depth + 2"
                      >
                        <div class="explorer-tree__cell">
                          <div class="explorer-tree__gutter">
                            @for (
                              guide of getChildGuides(guides, isRoot, isLast, depth);
                              track $index
                            ) {
                              <span
                                class="explorer-tree__guide"
                                [class.is-active]="guide"
                                aria-hidden="true"
                              ></span>
                            }

                            <span
                              class="explorer-tree__branch"
                              [class.is-last]="(node.children?.length ?? 0) === 0"
                            >
                              <span class="explorer-tree__toggle-spacer" aria-hidden="true"></span>
                            </span>
                          </div>

                          <div class="explorer-tree__editor explorer-tree__editor--create">
                            <input
                              class="explorer-tree__editor-input"
                              type="text"
                              [value]="node.inlineValue ?? ''"
                              [placeholder]="node.inlinePlaceholder || 'Add child node'"
                              [disabled]="node.inlineSaving"
                              [explorerTreeAutoFocus]="true"
                              (click)="$event.stopPropagation()"
                              (input)="onInlineInput(node, 'create', $event)"
                              (keydown.enter)="onInlineSubmit(node, 'create', $event)"
                              (keydown.escape)="onInlineCancel(node, 'create', $event)"
                            />
                            <div class="explorer-tree__editor-actions">
                              <button
                                type="button"
                                class="explorer-tree__editor-btn"
                                [disabled]="node.inlineSaving"
                                (click)="onInlineCancel(node, 'create', $event)"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                class="explorer-tree__editor-btn is-primary"
                                [disabled]="node.inlineSaving"
                                (click)="onInlineSubmit(node, 'create', $event)"
                              >
                                {{ node.inlineSaving ? 'Adding...' : 'Save' }}
                              </button>
                            </div>
                            @if (node.inlineError) {
                              <div class="explorer-tree__editor-error">{{ node.inlineError }}</div>
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                  }

                  @if ((node.children?.length ?? 0) > 0) {
                    @for (
                      child of node.children ?? [];
                      track trackNode($index, child);
                      let last = $last
                    ) {
                      <ng-container
                        [ngTemplateOutlet]="nodeTemplate"
                        [ngTemplateOutletContext]="{
                          $implicit: child,
                          depth: depth + 1,
                          isRoot: false,
                          isLast: last,
                          guides: getChildGuides(guides, isRoot, isLast, depth)
                        }"
                      ></ng-container>
                    }
                  }
                </div>
              </div>
            }
          </div>
        </ng-template>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }

      .explorer-tree {
        min-width: 0;
        direction: ltr;
        font-family: var(--app-font-family, inherit);
        color: var(--app-tree-label-text, rgb(var(--fg) / 0.92));
        --explorer-tree-line-width: var(--app-tree-connector-width, 1px);
        --explorer-tree-line-color: var(
          --app-tree-connector-color,
          color-mix(in oklab, rgb(var(--fg, 255 255 255)) 42%, transparent)
        );
        --explorer-tree-line-hover: var(
          --app-tree-connector-hover-color,
          var(--explorer-tree-line-color)
        );
        --explorer-tree-line-selected: var(
          --app-tree-connector-selected-color,
          var(--explorer-tree-line-color)
        );
        --explorer-tree-toggle-border: transparent;
        --explorer-tree-toggle-bg: var(--app-tree-toggle-bg, rgb(var(--bg0)));
        --explorer-tree-toggle-hover-bg: var(--app-tree-toggle-hover-bg, rgb(var(--bg1)));
        --explorer-tree-node-bg: var(--app-tree-card-fill, transparent);
        --explorer-tree-node-branch-bg: var(--app-tree-branch-card-fill-top);
        --explorer-tree-node-hover-border: var(--app-tree-card-hover-outline, transparent);
        --explorer-tree-node-hover-bg: var(--app-tree-card-hover-fill);
        --explorer-tree-node-hover-accent: transparent;
        --explorer-tree-node-hover-ring: none;
        --explorer-tree-node-hover-glow: none;
        --explorer-tree-node-selected-start: var(--app-tree-card-selected-fill-start);
        --explorer-tree-node-selected-mid: var(--app-tree-card-selected-fill-mid);
        --explorer-tree-node-selected-tail: var(--app-tree-card-selected-fill-tail);
        --explorer-tree-node-selected-ring: inset 0 0 0 1px
          var(--app-tree-card-selected-outline);
        --explorer-tree-node-selected-glow: none;
        --explorer-tree-node-hover-rail: var(--app-tree-card-hover-rail);
        --explorer-tree-level-0-border: var(--app-tree-root-card-outline);
        --explorer-tree-level-0-bg-top: var(--app-tree-root-card-fill-top);
        --explorer-tree-level-0-bg-tail: var(--app-tree-root-card-fill-bottom);
        --explorer-tree-level-0-hover-bg-top: var(--app-tree-root-card-hover-fill-top);
        --explorer-tree-level-0-hover-bg-tail: var(--app-tree-root-card-hover-fill-bottom);
        --explorer-tree-level-0-selected-bg-top: var(--app-tree-root-card-selected-fill-top);
        --explorer-tree-level-0-selected-bg-mid: var(--app-tree-root-card-selected-fill-mid);
        --explorer-tree-level-0-selected-bg-tail: var(--app-tree-root-card-selected-fill-tail);
        --explorer-tree-level-0-hover-ring: var(--app-tree-root-card-hover-ring);
        --explorer-tree-level-0-selected-ring: var(--app-tree-root-card-selected-ring);
        --explorer-tree-glyph-bg-tail: rgb(var(--bg1) / 0.82);
        --explorer-tree-leaf-glyph-border: rgb(var(--border-strong) / 0.42);
        --explorer-tree-leaf-glyph-bg: rgb(var(--border-strong) / 0.2);
        --explorer-tree-label-color: var(--app-tree-label-text);
        --explorer-tree-label-hover-color: var(--app-tree-hover-label-text, rgb(var(--fg)));
        --explorer-tree-level-0-label-color: var(--app-tree-root-label-text);
        --explorer-tree-count-border: transparent;
        --explorer-tree-count-bg: var(--app-tree-count-bg);
        --explorer-tree-branch-count-bg: var(--app-tree-branch-count-bg);
        --explorer-tree-branch-count-text: var(--app-tree-branch-count-text);
        --explorer-tree-record-count-bg: var(--app-tree-record-count-bg);
        --explorer-tree-record-count-text: var(--app-tree-record-count-text);
        --explorer-tree-price-record-count-bg: var(--app-tree-price-record-count-bg);
        --explorer-tree-price-record-count-text: var(--app-tree-price-record-count-text);
        --explorer-tree-root-bg: var(--app-tree-root-bg);
        --explorer-tree-root-selected-bg-end: var(--app-tree-root-selected-bg-end);
        --explorer-tree-editor-bg: var(--app-tree-editor-bg);
        --explorer-tree-thread-hitbox-width: var(--app-tree-connector-hitbox-width, 30px);
        --explorer-tree-thread-line-width: var(
          --app-tree-connector-width,
          var(--explorer-tree-line-width)
        );
        --explorer-tree-thread-line-active-width: var(
          --app-tree-connector-width,
          var(--explorer-tree-line-width)
        );
        --explorer-tree-thread-line-color: var(
          --app-tree-connector-color,
          var(--explorer-tree-line-color)
        );
        --explorer-tree-thread-line-hover: var(
          --app-tree-connector-hover-color,
          var(--explorer-tree-line-color)
        );
        --explorer-tree-elbow-height: var(--app-tree-connector-elbow-height, 8px);
        --explorer-tree-connector-center: var(--explorer-tree-guide-offset);
        --explorer-tree-connector-left: calc(
          var(--explorer-tree-connector-center) - (var(--explorer-tree-line-width) / 2)
        );
        --explorer-tree-row-height: 36px;
        --explorer-tree-tag-row-extra: var(--app-tree-tag-row-extra, 12px);
        --explorer-tree-level-indent: 20px;
        --explorer-tree-guide-offset: 10px;
        --explorer-tree-toggle-size: 16px;
        --explorer-tree-branch-node-min-width: 0;
        --explorer-tree-root-node-min-width: 0;
        --explorer-tree-root-node-width: 100%;
        --explorer-tree-radius: 8px;
        --explorer-tree-row-gap: 4px;
        padding: 2px 2px 10px;
        border-radius: 0;
        background: transparent;
      }

      .explorer-tree,
      .explorer-tree *,
      .explorer-tree *::before,
      .explorer-tree *::after {
        animation: none !important;
      }

      .explorer-tree__node,
      .explorer-tree__node::before,
      .explorer-tree__label,
      .explorer-tree__meta,
      .explorer-tree__count-badge,
      .explorer-tree__glyph,
      .explorer-tree__toggle,
      .explorer-tree__guide::before,
      .explorer-tree__branch::before,
      .explorer-tree__branch::after,
      .explorer-tree__thread-line {
        transition:
          background 0.14s ease,
          border-color 0.14s ease,
          color 0.14s ease,
          -webkit-text-fill-color 0.14s ease,
          box-shadow 0.14s ease,
          opacity 0.14s ease,
          transform 0.14s ease !important;
      }

      .explorer-tree__item {
        position: relative;
        min-width: 0;
        box-sizing: border-box;
        margin-block: 1px;
        content-visibility: auto;
        contain-intrinsic-size: auto var(--explorer-tree-current-row-height);
        --explorer-tree-current-row-height: var(--explorer-tree-row-height);
        --explorer-tree-connector-join-y: calc(var(--explorer-tree-current-row-height) / 2);
      }

      .explorer-tree__item.has-tags {
        --explorer-tree-current-row-height: calc(
          var(--explorer-tree-row-height) + var(--explorer-tree-tag-row-extra)
        );
      }

      .explorer-tree__item.is-level-0 {
        margin-block: 7px;
      }

      .explorer-tree__item:not(.is-level-0) {
        margin-block: 0;
      }

      .explorer-tree__item:not(.is-level-0)::before {
        content: '';
        position: absolute;
        top: 0;
        bottom: auto;
        left: calc(
          max(0, var(--explorer-tree-depth, 1) - 1) * var(--explorer-tree-level-indent) +
            var(--explorer-tree-connector-left)
        );
        width: var(--explorer-tree-line-width);
        height: calc(
          var(--explorer-tree-connector-join-y) + (var(--explorer-tree-line-width) / 2)
        );
        background: var(--explorer-tree-thread-line-color);
        opacity: 1;
        pointer-events: none;
        z-index: 0;
      }

      .explorer-tree__item:not(.is-level-0):not(.is-last)::before {
        height: auto;
        bottom: 0;
      }

      .explorer-tree__row {
        position: relative;
        min-height: var(--explorer-tree-current-row-height);
        min-width: 0;
        z-index: 1;
        --explorer-tree-current-line-color: var(--explorer-tree-thread-line-color);
      }

      .explorer-tree__row.has-tags,
      .explorer-tree__row.has-tags .explorer-tree__cell,
      .explorer-tree__row.has-tags .explorer-tree__gutter {
        min-height: var(--explorer-tree-current-row-height);
      }

      .explorer-tree__row[data-explorer-node-id] {
        cursor: grab;
      }

      .explorer-tree__row::after {
        content: '';
        position: absolute;
        inset: 1px 2px;
        border-radius: 12px;
        background: transparent;
        opacity: 0.9;
        pointer-events: none;
      }

      .explorer-tree__item:hover > .explorer-tree__row::after {
        opacity: 0;
        background: transparent;
      }

      .explorer-tree__item.is-selected > .explorer-tree__row::after {
        opacity: 0;
        background: transparent;
      }

      .explorer-tree__row.is-drop-target::after {
        opacity: 1;
        background: linear-gradient(
          90deg,
          rgba(132, 204, 22, 0.17),
          rgba(132, 204, 22, 0.08) 58%,
          transparent 100%
        );
      }

      .explorer-tree__row.is-drop-blocked::after {
        opacity: 1;
        background: linear-gradient(
          90deg,
          rgba(248, 113, 113, 0.14),
          rgba(248, 113, 113, 0.06) 58%,
          transparent 100%
        );
      }

      .explorer-tree__children {
        --explorer-tree-children-pad-top: 2px;
        display: grid;
        grid-template-rows: 1fr;
        min-width: 0;
        position: relative;
        padding-top: var(--explorer-tree-children-pad-top);
        padding-inline-start: 0;
        opacity: 1;
        overflow: visible;
        transform-origin: top left;
        will-change: grid-template-rows, opacity, padding-top;
        transition:
          grid-template-rows 0.18s ease,
          opacity 0.16s ease,
          padding-top 0.18s ease !important;
      }

      .explorer-tree__children.is-collapsed {
        grid-template-rows: 0fr;
        padding-top: 0;
        opacity: 0;
        pointer-events: none;
      }

      .explorer-tree__children-track {
        position: relative;
        display: flex;
        flex-direction: column;
        min-height: 0;
        min-width: 0;
        overflow: visible;
      }

      .explorer-tree__children.is-collapsed > .explorer-tree__children-track {
        overflow: hidden;
      }

      .explorer-tree__thread-hitbox {
        position: absolute;
        top: 0;
        bottom: calc((var(--explorer-tree-row-height) / 2) + 1px);
        left: calc(
          var(--explorer-tree-depth, 0) * var(--explorer-tree-level-indent) +
            var(--explorer-tree-connector-center) -
            (var(--explorer-tree-thread-hitbox-width) / 2)
        );
        z-index: 5;
        display: block;
        width: var(--explorer-tree-thread-hitbox-width);
        min-width: var(--explorer-tree-thread-hitbox-width);
        padding: 0;
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: inherit;
        cursor: pointer;
        outline: none;
        appearance: none;
        -webkit-appearance: none;
      }

      .explorer-tree__thread-line {
        position: absolute;
        --explorer-tree-thread-bridge-length: calc(
          ((var(--explorer-tree-current-row-height) - var(--explorer-tree-toggle-size)) / 2) +
            var(--explorer-tree-children-pad-top)
        );
        top: calc(var(--explorer-tree-thread-bridge-length) * -1);
        left: calc(
          (var(--explorer-tree-thread-hitbox-width) - var(--explorer-tree-line-width)) / 2
        );
        display: block;
        width: var(--explorer-tree-line-width);
        height: var(--explorer-tree-thread-bridge-length);
        border-radius: 0;
        background: var(--explorer-tree-thread-line-color);
        opacity: 1;
        pointer-events: none;
      }

      .explorer-tree__thread-hitbox:hover .explorer-tree__thread-line,
      .explorer-tree__thread-hitbox:focus-visible .explorer-tree__thread-line {
        background: var(--explorer-tree-line-hover);
      }

      .explorer-tree__item.is-level-0 > .explorer-tree__children {
        --explorer-tree-children-pad-top: 4px;
      }

      .explorer-tree__cell {
        display: flex;
        align-items: center;
        gap: var(--explorer-tree-row-gap);
        min-height: var(--explorer-tree-current-row-height);
        min-width: 0;
        direction: ltr;
        position: relative;
        z-index: 1;
      }

      .explorer-tree__gutter {
        display: inline-flex;
        align-items: flex-start;
        flex: 0 0 auto;
        min-height: var(--explorer-tree-current-row-height);
        min-width: 0;
        opacity: 1;
      }

      .explorer-tree__guide,
      .explorer-tree__branch {
        position: relative;
        display: block;
        flex: 0 0 auto;
        width: var(--explorer-tree-level-indent);
        min-width: var(--explorer-tree-level-indent);
        height: var(--explorer-tree-current-row-height);
      }

      .explorer-tree__row.has-tags .explorer-tree__guide,
      .explorer-tree__row.has-tags .explorer-tree__branch {
        height: var(--explorer-tree-current-row-height);
      }

      .explorer-tree__guide::before {
        content: '';
        position: absolute;
        top: -3px;
        bottom: -3px;
        left: var(--explorer-tree-connector-left);
        width: var(--explorer-tree-line-width);
        display: none;
        background: transparent;
        opacity: 1;
        pointer-events: none;
      }

      .explorer-tree__guide.is-active::before {
        background: var(--explorer-tree-thread-line-color);
        opacity: 1;
      }

      .explorer-tree__branch::before {
        content: '';
        position: absolute;
        top: 0;
        bottom: auto;
        left: var(--explorer-tree-connector-left);
        width: var(--explorer-tree-line-width);
        height: calc(var(--explorer-tree-connector-join-y) + var(--explorer-tree-line-width));
        background: var(--explorer-tree-thread-line-color);
        pointer-events: none;
        display: none;
        opacity: 1;
        z-index: 3;
      }

      .explorer-tree__branch::after {
        content: '';
        position: absolute;
        top: calc(
          var(--explorer-tree-connector-join-y) -
            (var(--explorer-tree-line-width) / 2)
        );
        left: calc(var(--explorer-tree-connector-left) + var(--explorer-tree-line-width));
        width: calc(
          var(--explorer-tree-level-indent) + var(--explorer-tree-row-gap) -
            var(--explorer-tree-guide-offset) + 2px - var(--explorer-tree-line-width)
        );
        height: var(--explorer-tree-line-width);
        display: block;
        border: 0;
        border-radius: 0;
        background: var(--explorer-tree-current-line-color);
        box-sizing: border-box;
        pointer-events: none;
        opacity: 1;
        z-index: 2;
      }

      .explorer-tree__item.is-level-0 > .explorer-tree__row .explorer-tree__branch::after {
        display: none;
      }

      .explorer-tree__item.is-level-0 > .explorer-tree__row .explorer-tree__branch::before {
        display: none;
      }

      .explorer-tree__item:hover > .explorer-tree__row .explorer-tree__guide.is-active::before,
      .explorer-tree__item:hover > .explorer-tree__row .explorer-tree__branch::before {
        background: var(--explorer-tree-line-hover);
      }

      .explorer-tree__item.is-selected
        > .explorer-tree__row
        .explorer-tree__guide.is-active::before,
      .explorer-tree__item.is-selected > .explorer-tree__row .explorer-tree__branch::before {
        background: var(--explorer-tree-line-selected);
      }

      .explorer-tree__item:hover > .explorer-tree__row .explorer-tree__branch::after {
        --explorer-tree-current-line-color: var(--explorer-tree-line-hover);
      }

      .explorer-tree__item.is-selected > .explorer-tree__row .explorer-tree__branch::after {
        --explorer-tree-current-line-color: var(--explorer-tree-line-selected);
      }

      .explorer-tree__toggle,
      .explorer-tree__toggle-spacer {
        position: absolute;
        top: calc(
          (var(--explorer-tree-current-row-height) - var(--explorer-tree-toggle-size)) / 2
        );
        right: auto;
        left: calc(
          var(--explorer-tree-connector-center) - (var(--explorer-tree-toggle-size) / 2)
        );
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: var(--explorer-tree-toggle-size);
        min-width: var(--explorer-tree-toggle-size);
        height: var(--explorer-tree-toggle-size);
        z-index: 4;
        box-sizing: border-box;
      }

      .explorer-tree__toggle-spacer {
        visibility: hidden;
      }

      .explorer-tree__toggle {
        border: var(--explorer-tree-line-width) solid var(--explorer-tree-thread-line-color);
        border-radius: 999px;
        background: var(--explorer-tree-toggle-bg);
        color: var(--explorer-tree-thread-line-color);
        cursor: pointer;
        font-size: 0;
        line-height: 0;
        opacity: 1;
        padding: 0;
        box-shadow: 0 0 0 3px var(--explorer-tree-toggle-bg);
      }

      .explorer-tree__toggle::before {
        content: none;
      }

      .explorer-tree__toggle-icon {
        display: block;
        width: 12px;
        height: 12px;
        flex: 0 0 12px;
        margin: auto;
        overflow: visible;
        transform: rotate(0deg);
        transform-origin: 50% 50%;
        pointer-events: none;
        transition: transform 0.14s ease !important;
      }

      .explorer-tree__toggle:hover {
        border-color: var(--explorer-tree-line-hover);
        background: var(--explorer-tree-toggle-hover-bg);
        color: var(--explorer-tree-line-hover);
      }

      .explorer-tree__toggle.is-open {
        border-color: var(--explorer-tree-thread-line-color);
        background: var(--explorer-tree-toggle-bg);
        color: var(--explorer-tree-thread-line-color);
      }

      .explorer-tree__row:hover .explorer-tree__toggle,
      .explorer-tree__toggle:focus-visible {
        opacity: 1;
      }

      .explorer-tree__toggle.is-open .explorer-tree__toggle-icon {
        transform: rotate(90deg);
      }

      .explorer-tree__item:not(.is-level-0).is-branch > .explorer-tree__row .explorer-tree__toggle,
      .explorer-tree__item:not(.is-level-0).is-branch
        > .explorer-tree__row
        .explorer-tree__toggle-spacer {
        left: calc(
          var(--explorer-tree-level-indent) + var(--explorer-tree-connector-center) -
            (var(--explorer-tree-toggle-size) / 2)
        );
      }

      .explorer-tree__node {
        display: inline-flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        position: relative;
        flex: 1 1 auto;
        width: 100%;
        max-width: none;
        min-width: 0;
        min-height: var(--explorer-tree-row-height);
        border: 1px solid transparent;
        border-radius: 7px;
        background: var(--explorer-tree-node-bg);
        border-color: transparent !important;
        color: rgb(var(--fg) / 0.9);
        -webkit-text-fill-color: rgb(var(--fg) / 0.9);
        cursor: pointer;
        padding: 0 10px;
        text-align: start;
        outline: none !important;
        box-shadow: none;
        transition:
          background 0.14s ease,
          border-color 0.14s ease,
          box-shadow 0.14s ease,
          color 0.14s ease;
      }

      .explorer-tree__node.has-tags {
        align-items: flex-start;
        min-height: var(--explorer-tree-current-row-height);
        padding-block: 5px;
      }

      .explorer-tree__item.is-branch > .explorer-tree__row .explorer-tree__node {
        flex: 1 1 auto;
        width: 100%;
        min-width: var(--explorer-tree-root-node-min-width);
        max-width: 100%;
        padding-inline-start: 10px;
      }

      .explorer-tree__item:not(.is-level-0).is-branch
        > .explorer-tree__row
        .explorer-tree__node {
        margin-inline-start: calc(var(--explorer-tree-level-indent) + 2px);
      }

      .explorer-tree__item:not(.is-level-0) > .explorer-tree__row .explorer-tree__node {
        border-radius: 7px;
        min-height: calc(var(--explorer-tree-row-height) - 2px);
        padding-inline: 10px;
        background: transparent;
        border-color: transparent !important;
        box-shadow: none;
      }

      .explorer-tree__item:not(.is-level-0) > .explorer-tree__row .explorer-tree__node:hover {
        border-color: transparent !important;
        background: transparent;
        box-shadow: none;
      }

      .explorer-tree__node:hover {
        border-color: transparent !important;
        background: linear-gradient(
          90deg,
          var(--explorer-tree-node-hover-accent),
          var(--explorer-tree-node-hover-bg)
        );
        box-shadow: var(--explorer-tree-node-hover-ring), var(--explorer-tree-node-hover-glow);
        transform: none;
      }

      .explorer-tree__node.is-dragging {
        cursor: grabbing;
        opacity: 0.48;
      }

      .explorer-tree__node.is-drop-target {
        background: rgba(132, 204, 22, 0.095);
      }

      .explorer-tree__node.is-drop-blocked {
        background: rgba(248, 113, 113, 0.085);
      }

      .explorer-tree__drop-hint {
        display: inline-flex;
        flex: 0 0 auto;
        align-items: center;
        min-width: 0;
        max-width: 44%;
        padding: 0 8px;
        height: 20px;
        border-radius: 999px;
        background: rgba(132, 204, 22, 0.16);
        color: rgba(217, 249, 157, 0.98);
        -webkit-text-fill-color: rgba(217, 249, 157, 0.98);
        font-size: 10.5px;
        font-weight: 760;
        line-height: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .explorer-tree__drop-hint.is-blocked {
        background: rgba(248, 113, 113, 0.16);
        color: rgba(254, 202, 202, 0.98);
        -webkit-text-fill-color: rgba(254, 202, 202, 0.98);
      }

      .explorer-tree__node.is-selected {
        border-color: transparent !important;
        background: linear-gradient(
          90deg,
          var(--explorer-tree-node-selected-start),
          var(--explorer-tree-node-selected-mid) 34%,
          var(--explorer-tree-node-selected-tail)
        );
        box-shadow: var(--explorer-tree-node-selected-ring), var(--explorer-tree-node-selected-glow);
        transform: none;
      }

      .explorer-tree__node::before {
        display: none;
      }

      .explorer-tree__node:hover::before {
        opacity: 1;
        background: var(--explorer-tree-node-hover-rail);
        width: 3px;
      }

      .explorer-tree__node.is-selected::before {
        opacity: 1;
        background: rgb(var(--primary) / 0.95);
        width: 3px;
      }

      .explorer-tree__item:not(.is-level-0) .explorer-tree__node.is-selected::before {
        opacity: 0;
      }

      .explorer-tree__node.is-level-0 {
        width: var(--explorer-tree-root-node-width);
        min-width: var(--explorer-tree-root-node-min-width);
        min-height: calc(var(--explorer-tree-row-height) + 4px);
        border-radius: 9px;
        border-color: var(--explorer-tree-level-0-border) !important;
        background: linear-gradient(
          180deg,
          var(--explorer-tree-level-0-bg-top),
          var(--explorer-tree-level-0-bg-tail)
        );
        color: rgb(var(--fg));
        -webkit-text-fill-color: rgb(var(--fg));
        padding-inline: 13px;
      }

      .explorer-tree__item.is-level-0.is-branch > .explorer-tree__row .explorer-tree__node {
        flex: 1 1 auto;
        width: var(--explorer-tree-root-node-width);
        min-width: var(--explorer-tree-root-node-min-width);
        max-width: none;
      }

      .explorer-tree__node.is-level-0:hover {
        background: linear-gradient(
          180deg,
          var(--explorer-tree-level-0-hover-bg-top),
          var(--explorer-tree-level-0-hover-bg-tail)
        );
        box-shadow: var(--explorer-tree-level-0-hover-ring);
      }

      .explorer-tree__node.is-level-0.is-selected {
        background: linear-gradient(
          180deg,
          var(--explorer-tree-level-0-selected-bg-top),
          var(--explorer-tree-level-0-selected-bg-mid) 52%,
          var(--explorer-tree-level-0-selected-bg-tail)
        );
        box-shadow: var(--explorer-tree-level-0-selected-ring);
      }

      .explorer-tree__node.is-branch:not(.is-level-0) {
        min-width: var(--explorer-tree-branch-node-min-width);
        min-height: calc(var(--explorer-tree-row-height) - 1px);
        padding-inline: 11px !important;
        border-radius: 8px;
        border-color: var(--app-tree-nested-branch-outline) !important;
        background: var(--app-tree-nested-branch-fill);
        box-shadow: inset 0 0 0 1px var(--app-tree-nested-branch-outline);
      }

      .explorer-tree__node.is-branch:not(.is-level-0):not(:hover):not(.is-selected) {
        background: var(--app-tree-nested-branch-fill);
        box-shadow: inset 0 0 0 1px var(--app-tree-nested-branch-outline);
      }

      .explorer-tree__node.is-branch:not(.is-level-0):hover {
        border-color: var(--app-tree-nested-branch-outline) !important;
        background: var(--app-tree-nested-branch-fill);
        box-shadow: inset 0 0 0 1px var(--app-tree-nested-branch-outline);
      }

      .explorer-tree__node.is-branch:not(.is-level-0).is-expanded {
        border-color: var(--app-tree-nested-branch-open-outline) !important;
        background: var(--app-tree-nested-branch-open-fill);
        box-shadow: inset 0 0 0 1px var(--app-tree-nested-branch-open-outline);
      }

      .explorer-tree__node.is-branch:not(.is-level-0).is-expanded:hover {
        border-color: var(--app-tree-nested-branch-open-outline) !important;
        background: var(--app-tree-nested-branch-open-fill);
        box-shadow: inset 0 0 0 1px var(--app-tree-nested-branch-open-outline);
      }

      .explorer-tree__node.is-branch:not(.is-level-0).is-selected {
        border-color: var(--app-tree-nested-branch-selected-outline) !important;
        background: var(--app-tree-nested-branch-selected-fill);
        box-shadow: inset 0 0 0 1px var(--app-tree-nested-branch-selected-outline);
      }

      .explorer-tree__node.is-leaf:not(:hover):not(.is-selected) {
        background: transparent;
      }

      .explorer-tree__node.is-leaf {
        min-height: calc(var(--explorer-tree-row-height) - 4px);
      }

      .explorer-tree__item > .explorer-tree__row .explorer-tree__node.has-tags {
        min-height: var(--explorer-tree-current-row-height);
        padding-block: 5px;
      }

      .explorer-tree__glyph {
        display: none;
      }

      .explorer-tree__glyph::before,
      .explorer-tree__glyph::after {
        display: none;
      }

      .explorer-tree__glyph:not(.is-branch):not(.is-root) {
        width: 6px;
        height: 6px;
        border-radius: 999px;
        border-color: var(--explorer-tree-leaf-glyph-border);
        background: var(--explorer-tree-leaf-glyph-bg);
      }

      .explorer-tree__glyph:not(.is-branch):not(.is-root)::before,
      .explorer-tree__glyph:not(.is-branch):not(.is-root)::after {
        display: none;
      }

      .explorer-tree__content {
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex: 1 1 auto;
        min-width: 0;
        max-width: 100%;
        direction: ltr;
      }

      .explorer-tree__side {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        flex: 0 0 auto;
        min-width: 0;
      }

      .explorer-tree__node.has-tags .explorer-tree__side {
        padding-top: 0;
      }

      .explorer-tree__node.is-branch .explorer-tree__content {
        flex: 0 1 auto;
      }

      .explorer-tree__title {
        display: inline-flex;
        align-items: center;
        gap: 9px;
        min-width: 0;
        width: 100%;
        max-width: 100%;
      }

      .explorer-tree__label,
      .explorer-tree__meta {
        display: block;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        unicode-bidi: plaintext;
      }

      .explorer-tree__label {
        flex: 1 1 auto;
        max-width: 100%;
        font-size: 12px;
        font-weight: 600;
        color: var(--explorer-tree-label-color) !important;
        -webkit-text-fill-color: var(--explorer-tree-label-color) !important;
        opacity: 1;
        letter-spacing: 0.002em;
        line-height: 1.4;
      }

      .explorer-tree__tag-list {
        display: flex;
        align-items: center;
        gap: var(--app-tree-tag-list-gap, 4px);
        min-width: 0;
        max-width: 100%;
        overflow: hidden;
        padding-top: 0;
      }

      .explorer-tree__tag {
        display: inline-flex;
        align-items: center;
        gap: var(--app-tree-tag-gap, 3px);
        max-width: var(--app-tree-tag-max-width, 96px);
        min-height: var(--app-tree-tag-height, 15px);
        padding: 0 var(--app-tree-tag-padding-inline, 5px);
        border-radius: var(--app-tree-tag-radius, 4px);
        border: 1px solid var(--app-tree-tag-border);
        border-color: transparent;
        background: var(--app-tree-tag-bg);
        color: var(--app-tree-tag-text);
        font-size: var(--app-tree-tag-font-size, 8.7px);
        font-weight: var(--app-tree-tag-font-weight, 760);
        letter-spacing: 0;
        line-height: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .explorer-tree__tag::before {
        content: '#';
        display: inline;
        color: currentColor;
        opacity: 0.72;
      }

      .explorer-tree__tag.is-inherited {
        border-color: var(--app-tree-tag-inherited-border);
        background: var(--app-tree-tag-inherited-bg);
        color: var(--app-tree-tag-inherited-text);
        opacity: var(--app-tree-tag-inherited-opacity, 0.78);
      }

      .explorer-tree__tag.is-overflow {
        min-width: 20px;
        max-width: var(--app-tree-tag-overflow-max-width, 92px);
        justify-content: center;
        border-color: var(--app-tree-tag-inherited-border);
        background: var(--app-tree-tag-inherited-bg);
        color: var(--app-tree-tag-inherited-text);
      }

      .explorer-tree__tag.is-overflow::before {
        display: none;
      }

      .explorer-tree__node.is-level-0 .explorer-tree__label {
        font-size: var(--app-tree-root-label-font-size, 14px);
        font-weight: var(--app-tree-root-label-font-weight, 820);
        color: var(--explorer-tree-level-0-label-color) !important;
        -webkit-text-fill-color: var(--explorer-tree-level-0-label-color) !important;
        opacity: 1;
      }

      .explorer-tree__item:not(.is-level-0)
        > .explorer-tree__row
        .explorer-tree__node.is-leaf
        .explorer-tree__label {
        font-size: 11.65px;
        font-weight: 570;
        color: var(--app-tree-leaf-label-text) !important;
        -webkit-text-fill-color: var(--app-tree-leaf-label-text) !important;
      }

      .explorer-tree__item:not(.is-level-0)
        > .explorer-tree__row
        .explorer-tree__node.is-branch
        .explorer-tree__label {
        font-size: 12px;
        font-weight: 720;
        color: var(--app-tree-branch-label-text) !important;
        -webkit-text-fill-color: var(--app-tree-branch-label-text) !important;
      }

      .explorer-tree__node.is-level-1 .explorer-tree__label {
        font-size: var(--app-tree-level-1-label-font-size, 12.15px) !important;
        font-weight: var(--app-tree-level-1-label-font-weight, 640) !important;
        color: var(--app-tree-level-1-label-text) !important;
        -webkit-text-fill-color: var(--app-tree-level-1-label-text) !important;
      }

      .explorer-tree__node.is-level-1.is-branch .explorer-tree__label {
        font-size: var(--app-tree-level-1-branch-label-font-size, 12.85px) !important;
        font-weight: var(--app-tree-level-1-branch-label-font-weight, 780) !important;
        color: var(--app-tree-level-1-branch-label-text) !important;
        -webkit-text-fill-color: var(--app-tree-level-1-branch-label-text) !important;
      }

      .explorer-tree__node.is-level-2 .explorer-tree__label {
        font-size: var(--app-tree-level-2-label-font-size, 11.55px) !important;
        font-weight: var(--app-tree-level-2-label-font-weight, 590) !important;
        color: var(--app-tree-level-2-label-text) !important;
        -webkit-text-fill-color: var(--app-tree-level-2-label-text) !important;
      }

      .explorer-tree__node.is-level-2.is-branch .explorer-tree__label {
        font-size: var(--app-tree-level-2-branch-label-font-size, 12.1px) !important;
        font-weight: var(--app-tree-level-2-branch-label-font-weight, 740) !important;
        color: var(--app-tree-level-2-branch-label-text) !important;
        -webkit-text-fill-color: var(--app-tree-level-2-branch-label-text) !important;
      }

      .explorer-tree__node.is-level-3 .explorer-tree__label,
      .explorer-tree__node.is-level-deep .explorer-tree__label {
        font-size: var(--app-tree-level-deep-label-font-size, 11px) !important;
        font-weight: var(--app-tree-level-deep-label-font-weight, 560) !important;
        color: var(--app-tree-level-deep-label-text) !important;
        -webkit-text-fill-color: var(--app-tree-level-deep-label-text) !important;
      }

      .explorer-tree__item.is-level-deep
        > .explorer-tree__row
        .explorer-tree__node
        .explorer-tree__label {
        font-size: var(--app-tree-level-deep-label-font-size, 11px) !important;
      }

      .explorer-tree__item.is-level-1
        > .explorer-tree__row
        .explorer-tree__node
        .explorer-tree__label {
        font-size: var(--app-tree-level-1-label-font-size, 12.15px) !important;
        font-weight: var(--app-tree-level-1-label-font-weight, 640) !important;
        color: var(--app-tree-level-1-label-text) !important;
        -webkit-text-fill-color: var(--app-tree-level-1-label-text) !important;
      }

      .explorer-tree__item.is-level-1
        > .explorer-tree__row
        .explorer-tree__node.is-branch
        .explorer-tree__label {
        font-size: var(--app-tree-level-1-branch-label-font-size, 12.85px) !important;
        font-weight: var(--app-tree-level-1-branch-label-font-weight, 780) !important;
        color: var(--app-tree-level-1-branch-label-text) !important;
        -webkit-text-fill-color: var(--app-tree-level-1-branch-label-text) !important;
      }

      .explorer-tree__item.is-level-2
        > .explorer-tree__row
        .explorer-tree__node
        .explorer-tree__label {
        font-size: var(--app-tree-level-2-label-font-size, 11.55px) !important;
        font-weight: var(--app-tree-level-2-label-font-weight, 590) !important;
        color: var(--app-tree-level-2-label-text) !important;
        -webkit-text-fill-color: var(--app-tree-level-2-label-text) !important;
      }

      .explorer-tree__item.is-level-2
        > .explorer-tree__row
        .explorer-tree__node.is-branch
        .explorer-tree__label {
        font-size: var(--app-tree-level-2-branch-label-font-size, 12.1px) !important;
        font-weight: var(--app-tree-level-2-branch-label-font-weight, 740) !important;
        color: var(--app-tree-level-2-branch-label-text) !important;
        -webkit-text-fill-color: var(--app-tree-level-2-branch-label-text) !important;
      }

      .explorer-tree__item.is-level-3
        > .explorer-tree__row
        .explorer-tree__node
        .explorer-tree__label,
      .explorer-tree__item.is-level-deep
        > .explorer-tree__row
        .explorer-tree__node
        .explorer-tree__label {
        font-size: var(--app-tree-level-deep-label-font-size, 11px) !important;
        font-weight: var(--app-tree-level-deep-label-font-weight, 560) !important;
        color: var(--app-tree-level-deep-label-text) !important;
        -webkit-text-fill-color: var(--app-tree-level-deep-label-text) !important;
      }

      .explorer-tree__item
        > .explorer-tree__row
        .explorer-tree__node.is-selected
        .explorer-tree__label,
      .explorer-tree__item
        > .explorer-tree__row
        .explorer-tree__node.is-active-node
        .explorer-tree__label {
        color: var(--app-tree-active-label-text) !important;
        -webkit-text-fill-color: var(--app-tree-active-label-text) !important;
      }

      .explorer-tree__node.is-search-match:not(.is-selected) .explorer-tree__label {
        color: var(--app-tree-search-match-text, rgb(var(--fg))) !important;
        -webkit-text-fill-color: var(--app-tree-search-match-text, rgb(var(--fg))) !important;
      }

      .explorer-tree__label-mark {
        display: inline;
        padding: 0 1px;
        border-radius: 3px;
        background: var(--app-tree-search-highlight-bg, rgb(var(--primary) / 0.18));
        color: var(--app-tree-search-highlight-text, rgb(var(--primary)));
        -webkit-text-fill-color: var(--app-tree-search-highlight-text, rgb(var(--primary)));
        font: inherit;
      }

      .explorer-tree__count-badge {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        min-width: 0;
        height: 18px;
        padding: 0 2px;
        border: 0;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
        color: var(--app-tree-count-text);
        -webkit-text-fill-color: var(--app-tree-count-text);
        font-size: 10.8px;
        font-weight: 820;
        font-variant-numeric: tabular-nums;
        letter-spacing: 0;
        line-height: 1;
      }

      .explorer-tree__count-badge--branches {
        color: var(--app-tree-count-text);
        -webkit-text-fill-color: var(--app-tree-count-text);
      }

      .explorer-tree__badges {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .explorer-tree__count-badge--records {
        padding-inline: 2px;
        color: var(--app-tree-count-text);
        -webkit-text-fill-color: var(--app-tree-count-text);
      }

      .explorer-tree__count-badge--price-records {
        padding-inline: 2px;
        color: var(--app-tree-count-text);
        -webkit-text-fill-color: var(--app-tree-count-text);
      }

      .explorer-tree__count-icon {
        width: 15px;
        height: 15px;
        flex: 0 0 auto;
        display: block;
        color: currentColor;
        opacity: 0.94;
      }

      .explorer-tree__count-badge--branches .explorer-tree__count-icon {
        width: 14px;
        height: 14px;
      }

      .explorer-tree__count-badge--records .explorer-tree__count-icon {
        width: 14px;
        height: 14px;
      }

      .explorer-tree__count-badge--price-records .explorer-tree__count-icon {
        width: 14px;
        height: 14px;
      }

      .explorer-tree__node.is-level-0 .explorer-tree__count-badge {
        min-width: 0;
        height: 18px;
        border-color: transparent;
        background: transparent;
      }

      .explorer-tree__node.is-level-1 .explorer-tree__count-badge {
        min-width: 0;
        height: 17px;
        font-size: 10.6px;
        background: transparent;
      }

      .explorer-tree__node.is-level-2 .explorer-tree__count-badge,
      .explorer-tree__node.is-level-3 .explorer-tree__count-badge,
      .explorer-tree__node.is-level-deep .explorer-tree__count-badge {
        min-width: 0;
        height: 16px;
        padding-inline: 2px;
        font-size: 10.4px;
        opacity: 0.96;
      }

      .explorer-tree__node:hover .explorer-tree__count-badge {
        background: transparent;
      }

      .explorer-tree__node.is-selected .explorer-tree__count-badge {
        background: transparent;
      }

      .explorer-tree__node:hover .explorer-tree__glyph,
      .explorer-tree__node.is-selected .explorer-tree__glyph {
        transform: scale(1.04);
      }

      .explorer-tree__node:hover .explorer-tree__label {
        color: var(--explorer-tree-label-hover-color) !important;
        -webkit-text-fill-color: var(--explorer-tree-label-hover-color) !important;
      }

      .explorer-tree__item.is-level-0
        > .explorer-tree__row
        .explorer-tree__node:hover
        .explorer-tree__label,
      .explorer-tree__item.is-level-1
        > .explorer-tree__row
        .explorer-tree__node:hover
        .explorer-tree__label,
      .explorer-tree__item.is-level-2
        > .explorer-tree__row
        .explorer-tree__node:hover
        .explorer-tree__label,
      .explorer-tree__item.is-level-3
        > .explorer-tree__row
        .explorer-tree__node:hover
        .explorer-tree__label,
      .explorer-tree__item.is-level-deep
        > .explorer-tree__row
        .explorer-tree__node:hover
        .explorer-tree__label {
        color: var(--explorer-tree-label-hover-color) !important;
        -webkit-text-fill-color: var(--explorer-tree-label-hover-color) !important;
      }

      .explorer-tree__node:hover .explorer-tree__count-badge,
      .explorer-tree__node:hover .explorer-tree__count-icon,
      .explorer-tree__node:hover .explorer-tree__meta {
        color: var(--explorer-tree-label-hover-color) !important;
        -webkit-text-fill-color: var(--explorer-tree-label-hover-color) !important;
      }

      .explorer-tree__meta {
        color: rgb(var(--fg) / 0.44);
        -webkit-text-fill-color: rgb(var(--fg) / 0.44);
        font-size: 10px;
        line-height: 1.2;
        padding-inline-start: 1px;
      }

      .explorer-tree__node.is-selected .explorer-tree__label {
        color: var(--app-tree-active-label-text) !important;
        -webkit-text-fill-color: var(--app-tree-active-label-text) !important;
      }

      .explorer-tree__node.is-active-node .explorer-tree__label {
        color: var(--app-tree-active-label-text) !important;
        -webkit-text-fill-color: var(--app-tree-active-label-text) !important;
      }

      .explorer-tree__item:not(.is-level-0)
        > .explorer-tree__row
        .explorer-tree__node.is-active-node
        .explorer-tree__label,
      .explorer-tree__item:not(.is-level-0)
        > .explorer-tree__row
        .explorer-tree__node.is-selected
        .explorer-tree__label {
        color: var(--app-tree-active-label-text) !important;
        -webkit-text-fill-color: var(--app-tree-active-label-text) !important;
      }

      .explorer-tree__node.is-selected .explorer-tree__count-badge,
      .explorer-tree__node.is-selected .explorer-tree__count-icon,
      .explorer-tree__node.is-selected .explorer-tree__meta,
      .explorer-tree__node.is-active-node .explorer-tree__count-badge,
      .explorer-tree__node.is-active-node .explorer-tree__count-icon,
      .explorer-tree__node.is-active-node .explorer-tree__meta {
        color: var(--app-tree-active-label-text) !important;
        -webkit-text-fill-color: var(--app-tree-active-label-text) !important;
      }

      .explorer-tree__node.is-selected .explorer-tree__count-badge {
        border-color: transparent;
        background: transparent;
      }

      .explorer-tree__more {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 2px;
        width: 22px;
        height: 22px;
        border-radius: 7px;
        color: var(--app-tree-more-text);
        opacity: 0;
        transition:
          opacity 0.14s ease,
          background 0.14s ease,
          color 0.14s ease;
      }

      .explorer-tree__more > span {
        width: 3px;
        height: 3px;
        border-radius: 999px;
        background: currentColor;
      }

      .explorer-tree__node:hover .explorer-tree__more,
      .explorer-tree__node.is-selected .explorer-tree__more,
      .explorer-tree__more:focus-visible {
        opacity: 1;
      }

      .explorer-tree__more:hover,
      .explorer-tree__more:focus-visible {
        background: var(--app-tree-more-hover-fill);
        color: var(--app-tree-more-hover-text);
        outline: none;
      }

      .explorer-tree__node.is-root {
        border-color: transparent !important;
        background: var(--explorer-tree-root-bg);
        color: rgb(var(--fg));
        -webkit-text-fill-color: rgb(var(--fg));
        padding-inline: 10px 12px;
      }

      .explorer-tree__node.is-root.is-selected {
        border-color: transparent !important;
        background: linear-gradient(
          90deg,
          rgb(var(--primary) / 0.18),
          var(--explorer-tree-root-selected-bg-end)
        );
      }

      .explorer-tree__node.is-root .explorer-tree__label {
        font-weight: 600;
      }

      .explorer-tree__row-actions {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        flex: 0 0 auto;
        margin-inline-start: auto;
        padding-inline-end: 6px;
      }

      .explorer-tree__action,
      .explorer-tree__editor-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 18px;
        padding: 0 5px;
        border: 0 !important;
        border-radius: 0 !important;
        background: transparent !important;
        color: rgb(var(--fg) / 0.72);
        font-size: 10px;
        font-weight: 600;
        line-height: 1;
        cursor: pointer;
        outline: none !important;
        box-shadow: none !important;
        appearance: none;
        -webkit-appearance: none;
        transition: color 0.16s ease;
      }

      .explorer-tree__action:hover,
      .explorer-tree__editor-btn:hover {
        background: transparent !important;
        color: rgb(var(--fg) / 0.92);
      }

      .explorer-tree__action.is-danger,
      .explorer-tree__editor-btn.is-danger {
        color: rgb(254, 202, 202);
      }

      .explorer-tree__editor-btn.is-primary {
        color: rgb(var(--primary) / 0.96);
      }

      .explorer-tree__action:disabled,
      .explorer-tree__editor-btn:disabled {
        opacity: 0.42;
        cursor: not-allowed;
      }

      .explorer-tree__action:focus,
      .explorer-tree__action:focus-visible,
      .explorer-tree__editor-btn:focus,
      .explorer-tree__editor-btn:focus-visible {
        outline: none !important;
        box-shadow: none !important;
        border: 0 !important;
        background: transparent !important;
      }

      .explorer-tree__editor {
        display: flex;
        flex: 1 1 auto;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
        min-width: 0;
        padding: 8px 12px;
        border: 1px solid rgb(var(--primary) / 0.16) !important;
        border-radius: 12px !important;
        background: var(--explorer-tree-editor-bg) !important;
        box-shadow: none !important;
      }

      .explorer-tree__editor--rename {
        max-width: min(100%, 380px);
      }

      .explorer-tree__editor--create {
        flex-direction: row;
        max-width: min(100%, 420px);
      }

      .explorer-tree__editor-input {
        flex: 1 1 120px;
        min-width: 96px;
        min-height: 24px;
        padding: 0;
        border: 0 !important;
        border-radius: 0 !important;
        background: transparent !important;
        color: rgb(var(--fg) / 0.94);
        -webkit-text-fill-color: rgb(var(--fg) / 0.94);
        font-size: 12.5px;
        font-weight: 560;
        outline: none !important;
        box-shadow: none !important;
        appearance: none;
        -webkit-appearance: none;
      }

      .explorer-tree__editor-input:focus,
      .explorer-tree__editor-input:focus-visible {
        outline: none !important;
        box-shadow: none !important;
        border: 0 !important;
        background: transparent !important;
      }

      .explorer-tree__editor-actions {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        flex: 0 0 auto;
        margin-inline-start: auto;
      }

      .explorer-tree__editor-error {
        flex: 1 0 100%;
        color: #fca5a5;
        font-size: 11px;
        line-height: 1.4;
        padding-inline: 2px;
      }

      @media (max-width: 768px) {
        .explorer-tree {
          --explorer-tree-row-gap: 6px;
          --explorer-tree-thread-hitbox-width: 34px;
          padding-inline: 8px 4px;
        }

        .explorer-tree__meta {
          display: none;
        }
      }
    `
  ]
})
export class ExplorerTreeComponent {
  @Input() root: ExplorerTreeNode | null = null;
  @Input() ariaLabel = 'Hierarchy tree';
  @Input() showGlyph = false;
  @Input() showMeta = true;
  @Input() renderRootNode = true;
  @Input() searchTerm = '';

  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private activeNodeId: ExplorerTreeNodeId | undefined;
  private labelPartsCacheKey = '';
  private readonly labelPartsCache = new Map<string, Array<{ text: string; match: boolean }>>();

  @Output() nodeSelected = new EventEmitter<ExplorerTreeSelectEvent>();
  @Output() nodeToggled = new EventEmitter<ExplorerTreeNode>();
  @Output() nodeContextMenu = new EventEmitter<ExplorerTreeContextMenuEvent>();
  @Output() nodeDoubleClick = new EventEmitter<ExplorerTreeDoubleClickEvent>();
  @Output() nodeDragStart = new EventEmitter<ExplorerTreeDragEvent>();
  @Output() nodeDragEnter = new EventEmitter<ExplorerTreeDragEvent>();
  @Output() nodeDrop = new EventEmitter<ExplorerTreeDropEvent>();
  @Output() nodeDragEnd = new EventEmitter<ExplorerTreeDropEvent>();
  @Output() nodePointerDragStart = new EventEmitter<ExplorerTreePointerDragStartEvent>();
  @Output() nodeAction = new EventEmitter<ExplorerTreeActionEvent>();
  @Output() nodeInlineValueChange = new EventEmitter<ExplorerTreeInlineEditorEvent>();
  @Output() nodeInlineSubmit = new EventEmitter<ExplorerTreeInlineEditorEvent>();
  @Output() nodeInlineCancel = new EventEmitter<ExplorerTreeInlineEditorCancelEvent>();

  trackNode(index: number, node: ExplorerTreeNode): ExplorerTreeNodeId | string {
    return node.id ?? `${node.label}-${index}`;
  }

  hasChildren(node: ExplorerTreeNode): boolean {
    return Boolean(node.canToggle ?? node.children?.length);
  }

  isExpanded(node: ExplorerTreeNode): boolean {
    return node.expanded !== false;
  }

  shouldRenderChildren(node: ExplorerTreeNode): boolean {
    return this.hasChildren(node) && this.isExpanded(node) && (node.children?.length ?? 0) > 0;
  }

  shouldShowCount(node: ExplorerTreeNode): boolean {
    return node.count != null && node.count > 0;
  }

  shouldShowRecordCount(node: ExplorerTreeNode): boolean {
    return node.recordCount != null && node.recordCount > 0;
  }

  shouldShowPriceRecordCount(node: ExplorerTreeNode): boolean {
    return node.priceRecordCount != null && node.priceRecordCount > 0;
  }

  getNodeCountSummary(node: ExplorerTreeNode): string {
    const parts: string[] = [];
    if (this.shouldShowCount(node)) {
      parts.push(`${node.count} child ${node.count === 1 ? 'branch' : 'branches'}`);
    }
    if (this.shouldShowRecordCount(node)) {
      parts.push(`${node.recordCount} material ${node.recordCount === 1 ? 'record' : 'records'}`);
    }
    if (this.shouldShowPriceRecordCount(node)) {
      parts.push(
        `${node.priceRecordCount} price ${node.priceRecordCount === 1 ? 'record' : 'records'}`
      );
    }
    return parts.join(' / ');
  }

  getLabelParts(label: string): Array<{ text: string; match: boolean }> {
    const value = String(label ?? '');
    const query = this.searchTerm.trim();
    const cacheKey = `${query}\u0000${value}`;
    if (this.labelPartsCacheKey !== query) {
      this.labelPartsCacheKey = query;
      this.labelPartsCache.clear();
    }
    const cached = this.labelPartsCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    if (!query) {
      const parts = [{ text: value, match: false }];
      this.labelPartsCache.set(cacheKey, parts);
      return parts;
    }

    const lowerValue = value.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const parts: Array<{ text: string; match: boolean }> = [];
    let cursor = 0;
    let index = lowerValue.indexOf(lowerQuery, cursor);
    while (index >= 0) {
      if (index > cursor) {
        parts.push({ text: value.slice(cursor, index), match: false });
      }
      parts.push({ text: value.slice(index, index + query.length), match: true });
      cursor = index + query.length;
      index = lowerValue.indexOf(lowerQuery, cursor);
    }

    if (!parts.length) {
      parts.push({ text: value, match: false });
    } else if (cursor < value.length) {
      parts.push({ text: value.slice(cursor), match: false });
    }

    this.labelPartsCache.set(cacheKey, parts);
    return parts;
  }

  canDragNode(node: ExplorerTreeNode): boolean {
    return node.id != null && node.inlineMode == null && !node.inlineSaving;
  }

  isNodeSelected(node: ExplorerTreeNode): boolean {
    return node.selected === true || this.sameNodeId(node.id, this.activeNodeId);
  }

  onSelect(node: ExplorerTreeNode, event: MouseEvent): void {
    this.activeNodeId = event.ctrlKey || event.metaKey || event.shiftKey ? undefined : node.id;
    this.nodeSelected.emit({
      node,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey
    });
  }

  onToggle(node: ExplorerTreeNode, event: Event): void {
    event.stopPropagation();
    if (!this.hasChildren(node) || node.isRoot) {
      return;
    }
    this.nodeToggled.emit(node);
  }

  onNodeKeydown(node: ExplorerTreeNode, event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      this.activeNodeId = node.id;
      this.nodeSelected.emit({
        node,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false
      });
      return;
    }

    if (event.key === 'F2' && node.canRename !== false) {
      event.preventDefault();
      event.stopPropagation();
      this.nodeAction.emit({ node, action: 'rename' });
      return;
    }

    if ((event.key === 'Delete' || event.key === 'Backspace') && node.canDelete !== false) {
      event.preventDefault();
      event.stopPropagation();
      this.nodeAction.emit({ node, action: 'delete' });
      return;
    }

    if (event.key === 'ArrowRight') {
      if (!this.hasChildren(node) || this.isExpanded(node)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      this.nodeToggled.emit(node);
      return;
    }

    if (event.key === 'ArrowLeft') {
      if (!this.hasChildren(node) || !this.isExpanded(node)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      this.nodeToggled.emit(node);
      return;
    }

    if (event.key === 'ArrowDown') {
      this.focusAdjacentNode(event, 1);
      return;
    }

    if (event.key === 'ArrowUp') {
      this.focusAdjacentNode(event, -1);
      return;
    }

    if (event.key === 'Home') {
      this.focusEdgeNode(event, 'first');
      return;
    }

    if (event.key === 'End') {
      this.focusEdgeNode(event, 'last');
      return;
    }

    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      this.onKeyboardContextMenu(node, event);
    }
  }

  private sameNodeId(
    left: ExplorerTreeNodeId | undefined,
    right: ExplorerTreeNodeId | undefined
  ): boolean {
    return left != null && right != null && String(left) === String(right);
  }

  onContextMenu(node: ExplorerTreeNode, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.nodeContextMenu.emit({
      node,
      clientX: event.clientX,
      clientY: event.clientY
    });
  }

  onMore(node: ExplorerTreeNode, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement | null;
    const rect = target?.getBoundingClientRect();
    this.nodeContextMenu.emit({
      node,
      clientX: rect ? rect.left : event instanceof MouseEvent ? event.clientX : 0,
      clientY: rect ? rect.top + rect.height / 2 : event instanceof MouseEvent ? event.clientY : 0,
      horizontalAlign: 'left'
    });
  }

  private onKeyboardContextMenu(node: ExplorerTreeNode, event: KeyboardEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const target = (event.currentTarget as HTMLElement | null)?.closest(
      '.explorer-tree__node'
    ) as HTMLElement | null;
    const rect = target?.getBoundingClientRect();
    this.nodeContextMenu.emit({
      node,
      clientX: rect ? rect.left + rect.width / 2 : 0,
      clientY: rect ? rect.top + rect.height / 2 : 0,
      horizontalAlign: 'auto'
    });
  }

  private focusAdjacentNode(event: KeyboardEvent, delta: 1 | -1): void {
    const nodes = this.getFocusableNodes();
    if (!nodes.length) {
      return;
    }

    const current = this.resolveCurrentFocusableNode(event, nodes);
    const currentIndex = current ? nodes.indexOf(current) : -1;
    const nextIndex =
      currentIndex < 0
        ? delta > 0
          ? 0
          : nodes.length - 1
        : Math.min(nodes.length - 1, Math.max(0, currentIndex + delta));

    event.preventDefault();
    event.stopPropagation();
    this.focusNodeElement(nodes[nextIndex]);
  }

  private focusEdgeNode(event: KeyboardEvent, edge: 'first' | 'last'): void {
    const nodes = this.getFocusableNodes();
    if (!nodes.length) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.focusNodeElement(edge === 'first' ? nodes[0] : nodes[nodes.length - 1]);
  }

  private resolveCurrentFocusableNode(
    event: KeyboardEvent,
    nodes: HTMLElement[]
  ): HTMLElement | null {
    const eventTarget = event.target as HTMLElement | null;
    const fromEvent = eventTarget?.closest('.explorer-tree__node') as HTMLElement | null;
    if (fromEvent && nodes.includes(fromEvent)) {
      return fromEvent;
    }

    const active = document.activeElement?.closest('.explorer-tree__node') as HTMLElement | null;
    return active && nodes.includes(active) ? active : null;
  }

  private getFocusableNodes(): HTMLElement[] {
    const host = this.hostRef.nativeElement;
    return Array.from(host.querySelectorAll<HTMLElement>('.explorer-tree__node')).filter(
      element =>
        element.offsetParent !== null &&
        !element.closest('.explorer-tree__children.is-collapsed')
    );
  }

  private focusNodeElement(element: HTMLElement | undefined): void {
    if (!element) {
      return;
    }

    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  onDoubleClick(node: ExplorerTreeNode, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.nodeDoubleClick.emit({ node });
  }

  onPointerDragStart(node: ExplorerTreeNode, event: PointerEvent): void {
    if (!this.canDragNode(node) || event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (
      target?.closest('.explorer-tree__toggle') ||
      target?.closest('.explorer-tree__thread-hitbox') ||
      target?.closest('.explorer-tree__more') ||
      target?.closest('.explorer-tree__editor') ||
      target?.closest('.explorer-tree__editor-input') ||
      target?.closest('.explorer-tree__editor-btn')
    ) {
      return;
    }

    const dragElement =
      (target?.closest('.explorer-tree__node') as HTMLElement | null) ??
      (target?.closest('.explorer-tree__row') as HTMLElement | null);
    const dragRect = dragElement?.getBoundingClientRect();

    this.nodePointerDragStart.emit({
      node,
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      grabOffsetX: dragRect ? event.clientX - dragRect.left : 18,
      grabOffsetY: dragRect ? event.clientY - dragRect.top : 18,
      sourceWidth: dragRect?.width ?? 220,
      sourceHeight: dragRect?.height ?? 36
    });
  }

  onAction(node: ExplorerTreeNode, action: ExplorerTreeActionEvent['action'], event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.nodeAction.emit({ node, action });
  }

  onInlineInput(
    node: ExplorerTreeNode,
    mode: ExplorerTreeInlineEditorEvent['mode'],
    event: Event
  ): void {
    event.stopPropagation();
    const target = event.target as HTMLInputElement | null;
    this.nodeInlineValueChange.emit({
      node,
      mode,
      value: target?.value ?? ''
    });
  }

  onInlineSubmit(
    node: ExplorerTreeNode,
    mode: ExplorerTreeInlineEditorEvent['mode'],
    event: Event
  ): void {
    event.preventDefault();
    event.stopPropagation();
    this.nodeInlineSubmit.emit({
      node,
      mode,
      value: (event.target as HTMLInputElement | null)?.value ?? node.inlineValue ?? ''
    });
  }

  onInlineCancel(
    node: ExplorerTreeNode,
    mode: ExplorerTreeInlineEditorCancelEvent['mode'],
    event: Event
  ): void {
    event.preventDefault();
    event.stopPropagation();
    this.nodeInlineCancel.emit({ node, mode });
  }

  getChildGuides(
    guides: boolean[],
    isRoot: boolean,
    isLast: boolean,
    depth: number = 0
  ): boolean[] {
    return isRoot || depth === 0 ? guides : [...guides, !isLast];
  }
}
