import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  inject
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import {
  OverlayModule,
  ConnectedPosition,
  ConnectedOverlayPositionChange,
  CdkOverlayOrigin
} from '@angular/cdk/overlay';
import { resolveInlineSearchCommitCandidate } from './search-select.inline-commit.util';
import { AppIconDirective } from '../icons/app-icon.directive';
import {
  ExplorerTreeComponent,
  type ExplorerTreeNode,
  type ExplorerTreeSelectEvent
} from './explorer-tree.component';

type LooseValue = ReturnType<typeof JSON.parse>;
export type SearchSelectOptionAction = {
  id: string;
  label: string;
  icon?: string;
  title?: string;
  danger?: boolean;
};
export type SearchSelectOptionPresentation = {
  pill?: boolean;
  color?: string | null;
  backgroundColor?: string | null;
  borderColor?: string | null;
};
export type SearchSelectOptionHierarchy = {
  id?: string | number | null;
  parentId?: string | number | null;
  depth?: number | null;
  path?: string | null;
  meta?: string | null;
  count?: number | null;
  hasChildren?: boolean | null;
  recordCount?: number | null;
  tags?: readonly string[] | null;
};
type SearchSelectTagFilterOption = {
  name: string;
  count: number;
};

@Component({
  selector: 'search-select',
  standalone: true,
  imports: [FormsModule, OverlayModule, AppIconDirective, ExplorerTreeComponent],
  template: `
    <div
      class="ss"
      [class.open]="open"
      [class.disabled]="disabled"
      [class.inline-enabled]="allowInlineSearch"
    >
      <div #origin="cdkOverlayOrigin" cdkOverlayOrigin class="ss-origin">
        @if (allowInlineSearch) {
          <div
            class="ss-inline-trigger"
            [class.focused]="open"
            [class.has-selected-pill]="showSelectedInlinePill"
          >
            @if (showSelectedInlinePill) {
              <span
                class="ss-inline-pill"
                [style.color]="optionPresentation(value)?.color || null"
                [style.background-color]="optionPresentation(value)?.backgroundColor || null"
                [style.border-color]="optionPresentation(value)?.borderColor || null"
                [attr.title]="valueText()"
              >
                <span class="ss-pill-text">{{ valueText() }}</span>
              </span>
            }
            <input
              #inlineInput
              class="ss-inline-input"
              type="text"
              autocomplete="off"
              spellcheck="false"
              [disabled]="disabled"
              [placeholder]="placeholder || 'Select...'"
              [value]="inlineInputText"
              [attr.inputmode]="inlineInputMode"
              (focus)="onInlineFocus()"
              (input)="onInlineInput($event)"
              (keydown)="onInlineKey($event)"
              (blur)="onInlineBlur($event)"
            />
            @if (inlineSuffixText) {
              <span class="ss-inline-suffix">{{ inlineSuffixText }}</span>
            }
            <button
              #triggerButton
              type="button"
              class="ss-caret-trigger"
              (click)="onDropdownTriggerClick($event)"
              [disabled]="disabled"
              aria-label="Open options"
              aria-haspopup="listbox"
              [attr.aria-expanded]="open"
            >
              <span class="ss-caret-box">
                <span class="ss-caret" [class.open]="open"></span>
              </span>
            </button>
          </div>
        } @else {
          <button
            #triggerButton
            type="button"
            class="ss-trigger"
            (click)="toggle()"
            [disabled]="disabled"
            aria-haspopup="listbox"
            [attr.aria-expanded]="open"
          >
            <span class="ss-label" [class.placeholder]="!valueText()">{{
              valueText() || placeholder || 'Select...'
            }}</span>
            <span class="ss-caret-box">
              <span class="ss-caret" [class.open]="open"></span>
            </span>
          </button>
        }
      </div>
      <ng-template
        cdkConnectedOverlay
        [cdkConnectedOverlayOrigin]="origin"
        [cdkConnectedOverlayOpen]="open"
        [cdkConnectedOverlayPositions]="overlayPositions"
        [cdkConnectedOverlayWidth]="overlayWidth"
        [cdkConnectedOverlayMinWidth]="overlayWidth"
        [cdkConnectedOverlayPanelClass]="connectedOverlayPanelClass"
        (detach)="closePanel()"
        (positionChange)="onPositionChange($event)"
      >
        <div
          class="ss-panel"
          [class.drop-up]="dropUp"
          [class.hybrid-panel]="allowInlineSearch"
          [class.inline-panel]="openSource === 'inline'"
          [class.button-panel]="openSource === 'button'"
          [attr.role]="hasHierarchyOptions ? null : 'listbox'"
        >
          @if (showPanelSearch) {
            <div class="ss-search-row" [class.has-filter]="showOptionFilters">
              <input
                #searchInput
                class="ss-search"
                type="text"
                autocomplete="off"
                [placeholder]="searchPlaceholder"
                [(ngModel)]="query"
                [ngModelOptions]="{ standalone: true }"
                (input)="filter()"
                (keydown)="onKey($event)"
              />
              @if (showOptionFilters) {
                <button
                  type="button"
                  class="ss-filter-trigger"
                  [class.active]="optionFilterOpen || hasActiveOptionFilter"
                  [attr.aria-expanded]="optionFilterOpen"
                  aria-label="Filter service items"
                  title="Filter service items"
                  (pointerdown)="onOptionFilterTriggerPointerDown($event)"
                  (click)="toggleOptionFilterMenu($event)"
                >
                  <i appIcon="sliders" class="ss-filter-trigger-icon" aria-hidden="true"></i>
                </button>
                <button
                  type="button"
                  class="ss-tree-toggle-trigger"
                  [class.active]="hierarchyCollapsed"
                  [attr.aria-label]="hierarchyCollapsed ? 'Expand service items' : 'Collapse service items'"
                  [attr.title]="hierarchyCollapsed ? 'Expand service items' : 'Collapse service items'"
                  (pointerdown)="onHierarchyToggleTriggerPointerDown($event)"
                  (click)="toggleHierarchyCollapsed($event)"
                >
                  <i
                    [appIcon]="hierarchyCollapsed ? 'chevron-down' : 'chevron-up'"
                    class="ss-tree-toggle-trigger-icon"
                    aria-hidden="true"
                  ></i>
                </button>
              }
            </div>
          }
          @if (showOptionFilters && optionFilterOpen) {
            <div
              class="ss-filter-menu"
              role="menu"
              (pointerdown)="$event.stopPropagation()"
              (click)="$event.stopPropagation()"
            >
              <div class="ss-filter-menu__section">
                <div class="ss-filter-menu__head ss-filter-menu__head--section">
                  <span>Tags</span>
                  @if (selectedOptionFilterTag) {
                    <button type="button" (click)="setOptionFilterTag('', $event)">Clear</button>
                  }
                </div>
                @for (tag of optionFilterTagOptions; track tag.name) {
                  <button
                    type="button"
                    class="ss-filter-menu__tag"
                    [class.is-active]="selectedOptionFilterTag === tag.name"
                    role="menuitemcheckbox"
                    [attr.aria-checked]="selectedOptionFilterTag === tag.name"
                    (click)="setOptionFilterTag(tag.name, $event)"
                  >
                    <span class="ss-filter-menu__icon" appIcon="tag"></span>
                    <span>#{{ tag.name }}</span>
                    <small>{{ tag.count }}</small>
                  </button>
                } @empty {
                  <div class="ss-filter-menu__empty">No tags applied yet.</div>
                }
              </div>
            </div>
          }

          <div class="ss-list">
            @if (canEditSelected && !createText && showPanelSearch) {
              <button
                type="button"
                class="ss-item ss-edit-selected"
                (pointerdown)="onEditSelectedPointerDown($event)"
                (click)="onEditSelectedClick($event)"
                role="option"
              >
                <span class="ss-edit-label">{{ editSelectedLabel }}</span>
                <span class="ss-edit-value">"{{ valueText() }}"</span>
              </button>
            }
            @if (hasHierarchyOptions) {
              <div class="ss-tree-host">
                <explorer-tree
                  [root]="hierarchyTreeRoot"
                  [renderRootNode]="false"
                  [showGlyph]="true"
                  [showMeta]="true"
                  [searchTerm]="query"
                  ariaLabel="Service item options"
                  (nodeSelected)="onTreeOptionSelected($event)"
                  (nodeToggled)="onTreeOptionToggled($event)"
                ></explorer-tree>
              </div>
            } @else {
              @for (o of filtered; track o; let i = $index) {
                <button
                  type="button"
                  class="ss-item"
                  [class.has-actions]="optionActions.length"
                  [class.active]="i === active"
                  [class.selected]="isOptionSelected(o)"
                  [attr.aria-selected]="isOptionSelected(o)"
                  (pointerdown)="onOptionPointerDown($event, o)"
                  (click)="onOptionClick($event, o)"
                  (dblclick)="onOptionDoubleClick($event, o)"
                  role="option"
                >
                  <span
                    class="ss-item-label"
                    [class.ss-option-pill]="showOptionPresentation && optionPresentation(o)?.pill"
                    [style.color]="showOptionPresentation ? optionPresentation(o)?.color || null : null"
                    [style.background-color]="
                      showOptionPresentation ? optionPresentation(o)?.backgroundColor || null : null
                    "
                    [style.border-color]="
                      showOptionPresentation ? optionPresentation(o)?.borderColor || null : null
                    "
                    [attr.title]="displayFn ? displayFn(o) : o"
                    ><span class="ss-pill-text">{{ displayFn ? displayFn(o) : o }}</span></span
                  >
                  @if (optionActions.length) {
                    <span class="ss-option-actions" aria-label="Option actions">
                      @for (action of optionActions; track action.id) {
                        <span
                          class="ss-option-action"
                          [class.danger]="action.danger"
                          [attr.title]="action.title || action.label"
                          [attr.aria-label]="action.title || action.label"
                          role="button"
                          tabindex="0"
                          (pointerdown)="onOptionActionPointerDown($event, o, action.id)"
                          (click)="onOptionActionClick($event, o, action.id)"
                          (keydown.enter)="onOptionActionKeydown($event, o, action.id)"
                          (keydown.space)="onOptionActionKeydown($event, o, action.id)"
                        >
                          @if (action.icon) {
                            <i [appIcon]="action.icon" aria-hidden="true"></i>
                            <span class="sr-only">{{ action.label }}</span>
                          } @else {
                            {{ action.label }}
                          }
                        </span>
                      }
                    </span>
                  }
                </button>
              }
            }
            @if (canRename) {
              <button
                type="button"
                class="ss-item ss-rename"
                [class.active]="active === renameIndex"
                (pointerdown)="onRenamePointerDown($event)"
                (click)="onRenameClick($event)"
                role="option"
              >
                <span class="ss-rename-label">{{ renameLabel }}</span>
                <span class="ss-rename-value">"{{ renameText }}"</span>
              </button>
            }
            @if (canCreate) {
              <button
                type="button"
                class="ss-item ss-create"
                [class.active]="active === createIndex"
                (pointerdown)="onCreatePointerDown($event)"
                (click)="onCreateClick($event)"
                role="option"
              >
                <span class="ss-create-main">
                  <span class="ss-create-label">{{ createLabel }}</span>
                  <span class="ss-create-value" [class.badge]="allowInlineSearch">
                    {{ createText }}
                  </span>
                </span>
                @if (allowInlineSearch) {
                  <span class="ss-create-icon" aria-hidden="true">&#8629;</span>
                }
              </button>
            }
            @if (!filtered.length && !canCreate && !canRename) {
              <div class="ss-empty">{{ noResultsText }}</div>
            }
          </div>
        </div>
      </ng-template>
    </div>
  `,
  styles: [
    `
      .ss {
        position: relative;
        width: 100%;
      }
      .ss.inline-enabled,
      .ss-panel.hybrid-panel {
        --ss-hybrid-bg: var(--app-color-control-bg, rgb(var(--bg1)));
        --ss-hybrid-panel-bg: var(--app-color-panel-body, rgb(var(--surface)));
        --ss-hybrid-border: var(--app-color-outline-stroke, rgb(var(--border-strong)));
        --ss-hybrid-border-strong: var(--app-color-outline-stroke-strong, var(--ss-hybrid-border));
        --ss-hybrid-divider: var(--app-color-divider, var(--ss-hybrid-border));
        --ss-hybrid-text: var(--app-color-text-body, rgb(var(--fg)));
        --ss-hybrid-muted: var(--app-color-placeholder, rgb(var(--muted)));
        --ss-hybrid-active-bg: var(--app-color-toolbar-active-bg, var(--ss-hybrid-bg));
        --ss-hybrid-active-text: var(--app-color-toolbar-active-fg, var(--ss-hybrid-text));
      }
      .ss-origin {
        position: relative;
        width: 100%;
      }
      .ss.disabled {
        opacity: 0.6;
        pointer-events: none;
      }
      .ss-trigger {
        width: 100%;
        height: 32px;
        border-radius: 8px;
        border: 1px solid color-mix(in oklab, rgb(var(--border-strong)) 65%, transparent);
        background: rgb(var(--bg1));
        color: rgb(var(--fg));
        padding: 0 0 0 12px;
        text-align: left;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        transition:
          border-color 0.15s,
          box-shadow 0.15s;
      }
      .ss-inline-trigger {
        width: 100%;
        height: 32px;
        border-radius: 8px;
        border: 1px solid var(--ss-hybrid-border, rgb(var(--border-strong)));
        background: var(--ss-hybrid-bg, rgb(var(--bg1)));
        color: var(--ss-hybrid-text, rgb(var(--fg)));
        display: flex;
        align-items: stretch;
        overflow: hidden;
        transition:
          border-color 0.15s,
          box-shadow 0.15s;
      }
      .ss-inline-trigger.has-selected-pill {
        position: relative;
      }
      .ss-inline-trigger.has-selected-pill .ss-inline-input {
        position: absolute;
        inset: 0 32px 0 0;
        opacity: 0;
        cursor: text;
      }
      .ss-inline-pill,
      .ss-option-pill {
        display: inline-flex;
        align-items: center;
        min-width: 0;
        max-width: 100%;
        border: 1px solid transparent;
        border-radius: 6px;
        font-size: 0.76rem;
        font-weight: 700;
        line-height: 1;
      }
      .ss-inline-pill {
        align-self: center;
        max-width: calc(100% - 51px);
        margin: 0 6px 0 7px;
        padding: 3px 7px;
        pointer-events: none;
      }
      .ss-pill-text {
        display: block;
        min-width: 0;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .ss-trigger:hover {
        border-color: color-mix(in oklab, rgb(var(--border-strong)) 80%, transparent);
      }
      .ss-inline-trigger:hover {
        border-color: var(
          --ss-hybrid-border-strong,
          var(--ss-hybrid-border, rgb(var(--border-strong)))
        );
      }
      .ss-trigger:focus-visible {
        outline: none;
        border-color: color-mix(in oklab, rgb(var(--primary)) 65%, transparent);
        box-shadow: 0 0 0 2px color-mix(in oklab, rgb(var(--primary)) 22%, transparent);
      }
      .ss-inline-trigger:focus-within,
      .ss-inline-trigger.focused {
        border-color: var(
          --ss-hybrid-border-strong,
          var(--ss-hybrid-border, rgb(var(--border-strong)))
        );
        box-shadow: none;
      }
      .ss-label {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 0.9rem;
      }
      .ss-inline-input {
        flex: 1;
        min-width: 0;
        height: 100%;
        border: none;
        background: transparent;
        color: var(--ss-hybrid-text, rgb(var(--fg)));
        padding: 0 12px;
        font-size: 0.9rem;
      }
      .ss-inline-input::placeholder {
        color: var(--ss-hybrid-muted, color-mix(in oklab, rgb(var(--fg)) 45%, transparent));
      }
      .ss-inline-input:focus {
        outline: none;
      }
      .ss-inline-suffix {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        max-width: 72px;
        min-width: 0;
        overflow: hidden;
        padding: 0 8px 0 2px;
        color: var(--ss-hybrid-muted, color-mix(in oklab, rgb(var(--fg)) 48%, transparent));
        font-size: 0.78rem;
        font-weight: 700;
        line-height: 1;
        text-overflow: ellipsis;
        white-space: nowrap;
        pointer-events: none;
      }
      .ss-label.placeholder {
        color: color-mix(in oklab, rgb(var(--fg)) 45%, transparent);
      }
      .ss-caret-trigger {
        margin-left: auto;
        width: 32px;
        min-width: 32px;
        height: 100%;
        border: none;
        padding: 0;
        background: transparent;
        color: inherit;
        cursor: pointer;
      }
      .ss-caret-trigger:focus-visible {
        outline: none;
      }
      .ss-caret-box {
        width: 32px;
        height: 100%;
        border-left: 1px solid
          var(--ss-hybrid-border, color-mix(in oklab, rgb(var(--border-strong)) 40%, transparent));
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--ss-hybrid-bg, color-mix(in oklab, rgb(var(--surface)) 6%, transparent));
        border-top-right-radius: 10px;
        border-bottom-right-radius: 10px;
      }
      .ss-caret {
        width: 12px;
        height: 12px;
        border-right: 2px solid
          var(--ss-hybrid-muted, color-mix(in oklab, rgb(var(--fg)) 45%, transparent));
        border-bottom: 2px solid
          var(--ss-hybrid-muted, color-mix(in oklab, rgb(var(--fg)) 45%, transparent));
        transform: rotate(45deg);
        transition:
          transform 0.2s,
          border-color 0.15s;
        display: inline-block;
      }
      .ss-caret.open {
        transform: rotate(-135deg);
      }
      .ss-clear {
        position: absolute;
        top: 4px;
        right: 42px;
        width: 28px;
        height: 28px;
        border-radius: 8px;
        border: 1px solid color-mix(in oklab, rgb(var(--border)) 60%, transparent);
        background: rgb(var(--surface));
        color: rgb(var(--fg));
        cursor: pointer;
        z-index: 41;
      }
      .ss-panel {
        position: relative;
        width: 100%;
        box-sizing: border-box;
        background: rgb(var(--surface));
        color: rgb(var(--fg));
        border: 1px solid color-mix(in oklab, rgb(var(--border)) 65%, transparent);
        border-radius: 12px;
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.28);
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        animation: none;
      }
      .ss-panel.hybrid-panel {
        background: var(--ss-hybrid-panel-bg, rgb(var(--surface)));
        color: var(--ss-hybrid-text, rgb(var(--fg)));
        border-color: var(
          --ss-hybrid-border,
          color-mix(in oklab, rgb(var(--border)) 65%, transparent)
        );
        box-shadow: none;
      }
      .ss-panel.drop-up {
        transform-origin: bottom center;
      }
      .ss-panel.hybrid-panel.button-panel {
        padding: 0;
        overflow: hidden;
      }
      .ss-panel.inline-panel {
        padding-top: 6px;
      }
      .ss-panel.hybrid-panel.inline-panel {
        padding: 6px 6px 4px;
      }
      .ss-search-row {
        position: relative;
        display: flex;
        flex: 0 0 auto;
        align-items: stretch;
        min-width: 0;
        width: 100%;
      }
      .ss-search {
        width: 100%;
        height: 32px;
        border-radius: 8px;
        border: 1px solid color-mix(in oklab, rgb(var(--border-strong)) 50%, transparent);
        background: rgb(var(--bg1));
        color: rgb(var(--fg));
        padding: 0 10px;
        transition:
          border-color 0.15s ease,
          box-shadow 0.15s ease;
      }
      .ss-search:focus {
        outline: none;
        border-color: color-mix(in oklab, rgb(var(--border-strong)) 70%, transparent);
        box-shadow: none;
      }
      .ss-panel.hybrid-panel.button-panel .ss-search {
        height: 42px;
        flex: 1 1 auto;
        min-width: 0;
        border: none;
        border-bottom: 1px solid
          var(
            --ss-hybrid-divider,
            var(--ss-hybrid-border, color-mix(in oklab, rgb(var(--border-strong)) 40%, transparent))
          );
        border-radius: 0;
        background: var(--ss-hybrid-panel-bg, rgb(var(--surface)));
        color: var(--ss-hybrid-text, rgb(var(--fg)));
        padding: 0 14px;
      }
      .ss-search-row.has-filter .ss-search {
        padding-right: 80px;
      }
      .ss-panel.hybrid-panel.button-panel .ss-search::placeholder {
        color: var(--ss-hybrid-muted, color-mix(in oklab, rgb(var(--fg)) 45%, transparent));
      }
      .ss-tree-toggle-trigger,
      .ss-filter-trigger {
        position: absolute;
        top: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 42px;
        border: 0;
        border-left: 1px solid
          var(--ss-hybrid-divider, color-mix(in oklab, rgb(var(--border)) 55%, transparent));
        border-radius: 0;
        background: transparent;
        color: var(--ss-hybrid-muted, color-mix(in oklab, rgb(var(--fg)) 62%, transparent));
        cursor: pointer;
        outline: none;
      }
      .ss-filter-trigger {
        right: 38px;
      }
      .ss-tree-toggle-trigger {
        right: 0;
      }
      .ss-tree-toggle-trigger:hover,
      .ss-tree-toggle-trigger:focus-visible,
      .ss-tree-toggle-trigger.active,
      .ss-filter-trigger:hover,
      .ss-filter-trigger:focus-visible,
      .ss-filter-trigger.active {
        color: var(--ss-hybrid-active-text, rgb(var(--primary)));
        background: color-mix(in oklab, rgb(var(--primary)) 8%, transparent);
      }
      .ss-tree-toggle-trigger-icon,
      .ss-filter-trigger span,
      .ss-filter-trigger-icon {
        width: 15px;
        height: 15px;
      }
      .ss-filter-trigger.active::after {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 5px;
        height: 5px;
        border-radius: 999px;
        background: currentColor;
        content: '';
      }
      .ss-filter-menu {
        position: absolute;
        top: 48px;
        right: 8px;
        z-index: 4;
        display: grid;
        gap: 2px;
        width: min(252px, calc(100% - 16px));
        max-height: min(340px, calc(100vh - 180px));
        overflow-y: auto;
        padding: 10px 8px;
        border: 1px solid var(--ss-hybrid-border, color-mix(in oklab, rgb(var(--border)) 65%, transparent));
        border-radius: 8px;
        background: var(--ss-hybrid-panel-bg, rgb(var(--surface)));
        color: var(--ss-hybrid-text, rgb(var(--fg)));
        box-shadow: none;
        overscroll-behavior: contain;
      }
      .ss-filter-menu__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        min-height: 24px;
        padding: 0 8px 6px;
        color: var(--ss-hybrid-muted, color-mix(in oklab, rgb(var(--fg)) 58%, transparent));
        font-size: 11px;
        font-weight: 760;
        line-height: 1;
      }
      .ss-filter-menu__head button,
      .ss-filter-menu > button,
      .ss-filter-menu__tag {
        border: 0;
        background: transparent;
        color: inherit;
        cursor: pointer;
        outline: none;
        box-shadow: none;
      }
      .ss-filter-menu__head button {
        padding: 0;
        color: var(--ss-hybrid-text, rgb(var(--fg)));
        font-size: 11px;
        font-weight: 800;
      }
      .ss-filter-menu > button,
      .ss-filter-menu__tag {
        position: relative;
        display: grid;
        grid-template-columns: 18px minmax(0, 1fr) 18px;
        align-items: center;
        gap: 9px;
        min-height: 30px;
        padding: 0 9px;
        border: 1px solid transparent;
        border-radius: 6px;
        color: var(--ss-hybrid-text, rgb(var(--fg)));
        font-size: 12px;
        font-weight: 750;
        line-height: 1;
        text-align: left;
      }
      .ss-filter-menu > button:hover,
      .ss-filter-menu > button:focus-visible,
      .ss-filter-menu__tag:hover,
      .ss-filter-menu__tag:focus-visible,
      .ss-filter-menu > button.is-active,
      .ss-filter-menu__tag.is-active {
        border-color: var(--ss-hybrid-divider, color-mix(in oklab, rgb(var(--border)) 55%, transparent));
        background: var(--ss-hybrid-active-bg, color-mix(in oklab, rgb(var(--primary)) 9%, transparent));
        color: var(--ss-hybrid-active-text, rgb(var(--primary)));
      }
      .ss-filter-menu > button.is-active::after,
      .ss-filter-menu__tag.is-active::after {
        content: '';
        display: inline-block;
        justify-self: end;
        width: 6px;
        height: 10px;
        border: solid currentColor;
        border-width: 0 1.5px 1.5px 0;
        transform: rotate(45deg) translateY(-1px);
      }
      .ss-filter-menu__icon {
        width: 15px;
        height: 15px;
        color: var(--ss-hybrid-muted, color-mix(in oklab, rgb(var(--fg)) 58%, transparent));
      }
      .ss-filter-menu__section {
        display: grid;
        gap: 2px;
      }
      .ss-filter-menu__head--section {
        padding-top: 0;
      }
      .ss-filter-menu__tag small {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 16px;
        height: 16px;
        padding: 0 4px;
        border-radius: 999px;
        background: color-mix(in oklab, currentColor 12%, transparent);
        font-size: 10px;
        font-weight: 820;
      }
      .ss-filter-menu__empty {
        padding: 8px 9px;
        color: var(--ss-hybrid-muted, color-mix(in oklab, rgb(var(--fg)) 58%, transparent));
        font-size: 11px;
        font-weight: 700;
      }
      .ss-list {
        max-height: 300px;
        overflow-y: auto;
        overflow-x: hidden;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 2px;
        padding: 4px 2px;
      }
      .ss-panel.hybrid-panel.button-panel .ss-list {
        padding: 6px;
      }
      .ss-panel.hybrid-panel.inline-panel .ss-list {
        padding: 0 0 6px;
      }
      .ss-tree-host {
        width: 100%;
        min-width: 0;
        padding: 2px 0;
      }
      .ss-tree-host explorer-tree {
        display: block;
        width: 100%;
      }
      .ss-tree-host ::ng-deep .explorer-tree {
        padding: 0;
      }
      .ss-tree-host ::ng-deep .explorer-tree__item {
        --explorer-tree-row-height: 34px;
      }
      .ss-tree-host ::ng-deep .explorer-tree__row {
        min-width: 0;
      }
      .ss-tree-host ::ng-deep .explorer-tree__node {
        min-height: 32px;
        border-radius: 8px;
      }
      .ss-tree-host ::ng-deep .explorer-tree__content {
        min-width: 0;
      }
      .ss-tree-host ::ng-deep .explorer-tree__label,
      .ss-tree-host ::ng-deep .explorer-tree__meta {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .ss-tree-host ::ng-deep .explorer-tree__toggle {
        background: transparent !important;
        box-shadow: none !important;
      }
      .ss-tree-host ::ng-deep .explorer-tree__toggle:hover,
      .ss-tree-host ::ng-deep .explorer-tree__toggle:focus-visible,
      .ss-tree-host ::ng-deep .explorer-tree__toggle.is-open {
        background: transparent !important;
        box-shadow: none !important;
      }
      .ss-item {
        border-radius: 10px;
        padding: 10px 12px;
        min-height: 40px;
        height: auto;
        width: 100%;
        box-sizing: border-box;
        border: none;
        color: inherit;
        text-align: left;
        cursor: pointer;
        display: flex;
        align-items: flex-start;
        justify-content: flex-start;
        gap: 0;
        line-height: 1.4;
        white-space: normal;
        overflow-wrap: break-word;
        word-break: normal;
        overflow: visible;
        background: transparent;
        transition:
          background-color 0.1s ease-out,
          box-shadow 0.1s ease-out,
          color 0.1s ease-out;
      }
      .ss-item.ss-create,
      .ss-item.ss-edit-selected,
      .ss-item.ss-rename {
        gap: 8px;
      }
      .ss-item-label {
        display: block;
        flex: 1 1 auto;
        min-width: 0;
        max-width: 100%;
        white-space: normal;
        overflow-wrap: break-word;
        word-break: normal;
        line-height: 1.4;
      }
      .ss-option-pill {
        flex: 0 1 auto;
        padding: 4px 7px;
        overflow: hidden;
      }
      .ss-item.has-actions {
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .ss-option-actions {
        display: inline-flex;
        flex: 0 0 auto;
        align-items: center;
        gap: 4px;
      }
      .ss-option-action {
        display: inline-grid;
        place-items: center;
        width: 24px;
        height: 24px;
        border: 1px solid color-mix(in oklab, rgb(var(--border)) 55%, transparent);
        border-radius: 8px;
        background: color-mix(in oklab, rgb(var(--bg1)) 70%, transparent);
        color: inherit;
        font-size: 11px;
        font-weight: 800;
        line-height: 1;
        cursor: pointer;
      }
      .ss-option-action i {
        display: inline-flex;
        width: 13px;
        height: 13px;
        align-items: center;
        justify-content: center;
      }
      .ss-option-action:hover,
      .ss-option-action:focus-visible {
        outline: none;
        border-color: color-mix(in oklab, rgb(var(--primary)) 55%, transparent);
        background: color-mix(in oklab, rgb(var(--primary)) 16%, transparent);
      }
      .ss-option-action.danger:hover,
      .ss-option-action.danger:focus-visible {
        border-color: rgb(var(--danger, 239 68 68) / 0.5);
        background: rgb(var(--danger, 239 68 68) / 0.12);
        color: rgb(var(--danger, 239 68 68));
      }
      .ss-item:hover,
      .ss-item.active {
        background: linear-gradient(
          90deg,
          rgba(var(--primary), 0.14) 0%,
          rgba(var(--primary), 0.08) 100%
        );
        color: rgb(var(--primary));
        box-shadow: none;
      }
      .ss-item.selected {
        background: color-mix(
          in oklab,
          var(--app-color-primary, rgb(var(--primary))) 12%,
          transparent
        );
        color: var(--app-color-primary-text, rgb(var(--primary)));
        box-shadow: inset 2px 0 0 var(--app-color-primary, rgb(var(--primary)));
        font-weight: 700;
      }
      .ss.inline-enabled .ss-item:hover,
      .ss.inline-enabled .ss-item.active {
        background: var(
          --ss-hybrid-active-bg,
          color-mix(
            in oklab,
            var(--app-color-primary, rgb(var(--primary))) 10%,
            rgb(var(--bg1)) 90%
          )
        );
        color: var(--ss-hybrid-active-text, rgb(var(--fg)));
      }
      .ss.inline-enabled .ss-item.selected {
        background: var(
          --ss-hybrid-active-bg,
          color-mix(
            in oklab,
            var(--app-color-primary, rgb(var(--primary))) 12%,
            rgb(var(--bg1)) 88%
          )
        );
        color: var(--ss-hybrid-active-text, rgb(var(--fg)));
        box-shadow: inset 2px 0 0 var(--app-color-primary, rgb(var(--primary)));
      }
      .ss-item:active {
        transition-duration: 0s;
      }
      .ss-item.ss-create {
        border: 0;
        background: transparent;
        font-weight: 600;
        justify-content: space-between;
      }
      .ss.inline-enabled .ss-item.ss-create {
        border: 0;
        background: transparent;
      }
      .ss-create-main {
        display: flex;
        align-items: flex-start;
        flex-wrap: wrap;
        gap: 8px;
        min-width: 0;
        flex: 1 1 auto;
      }
      .ss-create-label {
        font-weight: 700;
      }
      .ss-create-value {
        opacity: 0.8;
      }
      .ss-create-value.badge {
        opacity: 1;
        padding: 2px 9px;
        border-radius: 6px;
        border: 1px solid
          var(--ss-hybrid-border, color-mix(in oklab, rgb(var(--border-strong)) 55%, transparent));
        background: var(--ss-hybrid-bg, rgb(var(--bg1)));
        color: var(--ss-hybrid-text, rgb(var(--fg)));
        line-height: 1.1;
      }
      .ss-create-icon {
        color: var(--ss-hybrid-muted, color-mix(in oklab, rgb(var(--fg)) 45%, transparent));
        opacity: 1;
        font-size: 14px;
        line-height: 1;
      }
      .ss-item.ss-edit-selected {
        border: 0;
        background: transparent;
        font-weight: 600;
      }
      .ss-edit-label {
        font-weight: 700;
        margin-right: 6px;
      }
      .ss-edit-value {
        opacity: 0.8;
        white-space: normal;
        overflow-wrap: break-word;
        word-break: normal;
      }
      .ss-item.ss-rename {
        border: 0;
        background: transparent;
        font-weight: 600;
      }
      .ss-rename-label {
        font-weight: 700;
        margin-right: 6px;
      }
      .ss-rename-value {
        opacity: 0.9;
        white-space: normal;
        overflow-wrap: break-word;
        word-break: normal;
      }
      .ss-item:focus-visible {
        outline: none;
        box-shadow: none;
      }
      .ss-empty {
        padding: 10px;
        opacity: 0.7;
        text-align: center;
        font-size: 0.85rem;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchSelectComponent<T = string> implements OnInit, OnChanges, OnDestroy {
  @Input() options: T[] = [];
  @Input() value?: T | null;
  @Output() valueChange = new EventEmitter<T | null>();
  @Output() search = new EventEmitter<string>();
  @Input() displayFn?: (v: T) => string;
  @Input() optionPresentationFn?: (
    value: T
  ) => SearchSelectOptionPresentation | null | undefined;
  @Input() optionHierarchyFn?: (value: T) => SearchSelectOptionHierarchy | null | undefined;
  @Input() showOptionPresentation = true;
  @Input() placeholder = 'Select...';
  @Input() noResultsText = 'No results';
  @Input() disabled = false;
  @Input() allowClear = false;
  @Input() allowEdit = false;
  @Input() allowCreate = false;
  @Input() allowInlineSearch = false;
  @Input() inlineTextValue: string | null | undefined;
  @Input() inlineInputMode = 'text';
  @Input() inlineSuffix: string | null | undefined;
  @Input() createLabel = 'Create';
  @Input() renameLabel = 'Edit';
  @Input() editSelectedLabel = 'Edit selected';
  @Input() searchPlaceholder = 'Type to filter';
  @Input() overlayPanelClass: string | string[] | null = null;
  @Input() overlayWidthAnchorSelector = '';
  @Input() overlayMinWidth = 0;
  @Input() optionFiltersEnabled = false;
  @Input() optionFilterTitle = 'Service Items';
  @Input() optionActions: SearchSelectOptionAction[] = [];
  @Input() doubleClickActionId = '';
  @Output() create = new EventEmitter<string>();
  @Output() rename = new EventEmitter<{ from: T | null; to: string }>();
  @Output() optionAction = new EventEmitter<{ option: T; actionId: string }>();
  @Output() inlineTextCommit = new EventEmitter<string>();

  open = false;
  inlineFocused = false;
  openSource: 'button' | 'inline' = 'button';
  query = '';
  filtered: T[] = [];
  active = 0;
  hasHierarchyOptions = false;
  optionFilterOpen = false;
  selectedOptionFilterTag = '';
  optionFilterTagOptions: SearchSelectTagFilterOption[] = [];
  hierarchyTreeRoot: ExplorerTreeNode = {
    id: '__search_select_root__',
    label: 'Options',
    expanded: true,
    children: []
  };
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('inlineInput') inlineInput?: ElementRef<HTMLInputElement>;
  @ViewChild('triggerButton') triggerButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('origin', { read: CdkOverlayOrigin }) triggerOrigin?: CdkOverlayOrigin;
  private cdr = inject(ChangeDetectorRef);
  private readonly hostElement = inject(ElementRef<HTMLElement>);
  private static activeInstance: SearchSelectComponent<unknown> | null = null;
  dropUp = false;
  overlayWidth = 200;
  overlayPositions: ConnectedPosition[] = this.createOverlayPositions(0);
  connectedOverlayPanelClass: string[] = ['search-select-overlay'];
  private overlayPointerSelectionHandled = false;
  private lastCommittedInlineText = '';
  private openDomListenersAttached = false;
  private readonly hierarchyOptionByNodeId = new Map<string, T>();
  private readonly collapsedHierarchyNodeIds = new Set<string>();
  private readonly documentPointerDownHandler = (event: PointerEvent) =>
    this.onDocumentPointerDown(event);
  private readonly windowResizeHandler = () => this.onWindowResize();

  ngOnInit() {
    this.syncConnectedOverlayPanelClass();
    this.lastCommittedInlineText = String(this.inlineTextValue ?? '');
    this.filtered = [...this.options];
    this.rebuildHierarchyTree();
    this.syncActiveWithValue();
  }
  ngOnChanges(changes: SimpleChanges) {
    if (changes['overlayPanelClass']) {
      this.syncConnectedOverlayPanelClass();
    }
    if (changes['options']) {
      this.filtered = [...this.options];
      this.rebuildHierarchyTree();
      if (this.open) this.filter();
    }
    if (
      changes['inlineTextValue'] &&
      (typeof document === 'undefined' || document.activeElement !== this.inlineInput?.nativeElement)
    ) {
      this.lastCommittedInlineText = String(changes['inlineTextValue'].currentValue ?? '');
    }
    if (changes['value']) {
      if (!this.open) {
        this.query = '';
      }
      this.syncActiveWithValue();
    }
  }

  valueText() {
    return this.optionText(this.value ?? null);
  }
  isOptionSelected(option: T): boolean {
    return this.value != null && this.sameOptionText(option, this.value);
  }
  get createText() {
    return (this.query || '').trim();
  }
  get renameText() {
    return this.createText;
  }
  get inlineDisplayText(): string {
    if (this.allowInlineSearch && this.open && this.openSource === 'inline' && this.query) {
      return this.query;
    }
    return this.valueText();
  }
  get usesExternalInlineText(): boolean {
    return this.inlineTextValue !== undefined;
  }
  get inlineInputText(): string {
    return this.usesExternalInlineText ? String(this.inlineTextValue ?? '') : this.inlineDisplayText;
  }
  get inlineSuffixText(): string {
    return String(this.inlineSuffix ?? '').trim();
  }
  get showSelectedInlinePill(): boolean {
    return Boolean(
      this.allowInlineSearch &&
        !this.inlineFocused &&
        !this.usesExternalInlineText &&
        this.valueText().trim() &&
        this.optionPresentation(this.value)?.pill
    );
  }
  get showPanelSearch(): boolean {
    return !this.allowInlineSearch || this.openSource === 'button';
  }
  get showOptionFilters(): boolean {
    return this.optionFiltersEnabled && this.hasHierarchyOptions;
  }
  get hasActiveOptionFilter(): boolean {
    return !!this.selectedOptionFilterTag;
  }
  get hierarchyCollapsed(): boolean {
    return this.collapsibleHierarchyNodeIds().length > 0 && this.collapsedHierarchyNodeIds.size > 0;
  }
  get canCreate(): boolean {
    if (!this.allowCreate) return false;
    const text = this.createText;
    if (!text) return false;
    const normalized = text.toLowerCase();
    return !(this.options || []).some(o => this.optionText(o).toLowerCase() === normalized);
  }
  get canRename(): boolean {
    if (!this.allowEdit) return false;
    if (this.value == null) return false;
    const text = this.createText;
    if (!text) return false;
    const currentText = this.optionText(this.value).trim();
    if (!currentText) return false;
    const normalized = text.toLowerCase();
    if (currentText.toLowerCase() === normalized) return false;
    const hasCurrent = (this.options || []).some(
      o => this.optionText(o).toLowerCase() === currentText.toLowerCase()
    );
    if (!hasCurrent) return false;
    return !(this.options || []).some(o => this.optionText(o).toLowerCase() === normalized);
  }
  get canEditSelected(): boolean {
    if (!this.allowEdit) return false;
    if (this.value == null) return false;
    return Boolean(this.valueText().trim());
  }
  get renameIndex(): number {
    return this.filtered.length;
  }
  get createIndex(): number {
    return this.filtered.length + (this.canRename ? 1 : 0);
  }

  openList() {
    this.openListFrom('button');
  }
  openListFrom(
    source: 'button' | 'inline',
    options?: { preserveQuery?: boolean; focusPanelSearch?: boolean }
  ) {
    if (this.disabled) return;
    this.openSource = source;
    this.refreshOverlayGeometry();
    this.open = true;
    this.closeOtherOpenInstance();
    if (!options?.preserveQuery) {
      this.query = '';
    }
    this.filter();
    this.attachOpenDomListeners();
    if ((options?.focusPanelSearch ?? source === 'button') && this.showPanelSearch) {
      setTimeout(() => this.searchInput?.nativeElement?.focus(), 0);
    }
    this.cdr.markForCheck();
  }
  toggle() {
    if (this.disabled) return;
    this.open && this.openSource === 'button' ? this.closePanel(true) : this.openListFrom('button');
  }
  clear(ev?: MouseEvent) {
    ev?.stopPropagation();
    this.value = null as LooseValue;
    this.query = '';
    this.filter();
    this.valueChange.emit(null);
    this.closePanel(this.shouldRestoreTriggerFocus());
  }

  focusControl(): void {
    if (this.disabled) return;
    setTimeout(() => {
      const target = this.allowInlineSearch
        ? this.inlineInput?.nativeElement
        : this.triggerButton?.nativeElement;
      target?.focus();
    }, 0);
  }

  filter() {
    const q = (this.query || '').toLowerCase();
    this.search.emit(q);
    this.filtered = (this.options || []).filter(o => this.matchesOptionFilters(o, q));
    this.rebuildHierarchyTree();
    this.active = 0;
    this.syncActiveWithValue();
    this.clampActive();
  }
  onOptionFilterTriggerPointerDown(event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }
  toggleOptionFilterMenu(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.optionFilterOpen = !this.optionFilterOpen;
    this.cdr.markForCheck();
  }
  setOptionFilterTag(tagName: string, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    const normalized = this.normalizeOptionFilterTag(tagName);
    if (this.selectedOptionFilterTag === normalized) {
      this.selectedOptionFilterTag = '';
    } else {
      this.selectedOptionFilterTag = normalized;
    }
    this.filter();
    this.cdr.markForCheck();
  }
  choose(o: T) {
    this.value = o;
    this.valueChange.emit(o);
    this.query = this.valueText();
    this.closePanel(this.shouldRestoreTriggerFocus());
  }

  onDropdownTriggerClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.open && this.openSource === 'button') {
      this.closePanel(true);
      return;
    }
    this.openListFrom('button');
  }

  onInlineFocus(): void {
    if (!this.allowInlineSearch || this.disabled) {
      return;
    }
    this.inlineFocused = true;
    this.cdr.markForCheck();
  }

  onInlineInput(event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    if (this.usesExternalInlineText) {
      this.inlineTextValue = value;
      return;
    }
    this.query = value;
    if (!value.trim()) {
      this.filtered = [...this.options];
      this.rebuildHierarchyTree();
      this.syncActiveWithValue();
      if (this.open && this.openSource === 'inline') {
        this.closePanel(false);
      } else {
        this.cdr.markForCheck();
      }
      return;
    }
    if (!this.open || this.openSource !== 'inline') {
      this.openListFrom('inline', { preserveQuery: true, focusPanelSearch: false });
      return;
    }
    this.filter();
  }

  onInlineKey(event: KeyboardEvent): void {
    if (this.usesExternalInlineText) {
      if (event.key === 'Enter') {
        (event.target as HTMLInputElement | null)?.blur();
        event.preventDefault();
      } else if (event.key === 'ArrowDown') {
        this.openListFrom('button');
        event.preventDefault();
      } else if (event.key === 'Escape' && this.open) {
        this.closePanel(false);
        event.preventDefault();
      }
      return;
    }
    if (event.key === 'Escape' && this.open) {
      this.closePanel(false);
      event.preventDefault();
      return;
    }
    this.onKey(event);
  }

  onInlineBlur(event: Event): void {
    this.inlineFocused = false;
    this.cdr.markForCheck();
    if (!this.usesExternalInlineText) {
      return;
    }
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    if (value === this.lastCommittedInlineText) {
      return;
    }
    this.lastCommittedInlineText = value;
    this.inlineTextCommit.emit(value);
  }

  optionPresentation(value: T | null | undefined): SearchSelectOptionPresentation | null {
    return value == null ? null : (this.optionPresentationFn?.(value) ?? null);
  }

  optionHierarchy(value: T | null | undefined): SearchSelectOptionHierarchy | null {
    return value == null ? null : (this.optionHierarchyFn?.(value) ?? null);
  }

  onTreeOptionSelected(event: ExplorerTreeSelectEvent): void {
    const option = this.hierarchyOptionByNodeId.get(String(event.node.id ?? ''));
    if (option === undefined) {
      return;
    }
    this.choose(option);
  }

  onTreeOptionToggled(node: ExplorerTreeNode): void {
    const nodeId = String(node.id ?? '').trim();
    if (!nodeId) {
      return;
    }

    if (this.collapsedHierarchyNodeIds.has(nodeId)) {
      this.collapsedHierarchyNodeIds.delete(nodeId);
    } else {
      this.collapsedHierarchyNodeIds.add(nodeId);
    }
    this.rebuildHierarchyTree();
    this.cdr.markForCheck();
  }

  onHierarchyToggleTriggerPointerDown(event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  toggleHierarchyCollapsed(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    const collapsibleIds = this.collapsibleHierarchyNodeIds();
    if (!collapsibleIds.length) {
      return;
    }

    if (this.hierarchyCollapsed) {
      this.collapsedHierarchyNodeIds.clear();
    } else {
      this.collapsedHierarchyNodeIds.clear();
      collapsibleIds.forEach(id => this.collapsedHierarchyNodeIds.add(id));
    }
    this.rebuildHierarchyTree();
    this.cdr.markForCheck();
  }

  onKey(e: KeyboardEvent) {
    if (!this.open) return;
    if (e.key === 'ArrowDown') {
      this.active = Math.min(this.active + 1, this.maxActiveIndex());
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      this.active = Math.max(this.active - 1, 0);
      e.preventDefault();
    } else if (e.key === 'Enter') {
      if (this.canRename && this.active === this.renameIndex) {
        this.emitRename();
        return;
      }
      if (this.canCreate && this.active === this.createIndex) {
        this.emitCreate();
        return;
      }
      const o = this.filtered[this.active];
      if (o) this.choose(o);
    } else if (e.key === 'Escape') {
      this.closePanel(true);
    }
  }
  onPositionChange(ev: ConnectedOverlayPositionChange) {
    this.dropUp = ev.connectionPair.overlayY === 'bottom';
  }

  private onDocumentPointerDown(ev: PointerEvent): void {
    const rawTarget = ev.target as Node | null;
    const target =
      rawTarget instanceof Element
        ? rawTarget
        : rawTarget?.parentNode instanceof Element
          ? rawTarget.parentNode
          : null;
    if (!target) return;
    if (!target.closest('search-select') && !target.closest('.search-select-overlay')) {
      this.closePanel();
    }
  }

  private onWindowResize(): void {
    if (!this.open) {
      return;
    }
    this.refreshOverlayGeometry();
    this.cdr.markForCheck();
  }

  private syncActiveWithValue(): void {
    if (!this.filtered.length) {
      this.active = 0;
      return;
    }
    if (this.value == null) {
      this.active = 0;
      return;
    }
    let idx = this.filtered.findIndex(opt => opt === this.value);
    if (idx >= 0) {
      this.active = idx;
      return;
    }
    const currentText = this.optionText(this.value).toLowerCase();
    idx = this.filtered.findIndex(opt => this.optionText(opt).toLowerCase() === currentText);
    this.active = idx >= 0 ? idx : 0;
  }

  private optionText(option: T | null): string {
    if (option == null) return '';
    return this.displayFn ? this.displayFn(option) : String(option);
  }

  private optionSearchText(option: T | null): string {
    if (option == null) return '';
    const hierarchy = this.optionHierarchy(option);
    return [this.optionText(option), hierarchy?.path, hierarchy?.meta, ...(hierarchy?.tags ?? [])]
      .map(value => String(value ?? '').trim())
      .filter(Boolean)
      .join(' ');
  }

  private matchesOptionFilters(option: T | null, normalizedQuery: string): boolean {
    if (!this.optionSearchText(option).toLowerCase().includes(normalizedQuery)) {
      return false;
    }
    if (!this.optionFiltersEnabled) {
      return true;
    }

    const tags = this.optionFilterTags(option);
    if (this.selectedOptionFilterTag && !tags.includes(this.selectedOptionFilterTag)) {
      return false;
    }
    return true;
  }

  private optionFilterTags(option: T | null): string[] {
    if (option == null) return [];
    return this.normalizeOptionFilterTags(this.optionHierarchy(option)?.tags ?? []);
  }

  private normalizeOptionFilterTags(tags: readonly string[]): string[] {
    return Array.from(
      new Set(tags.map(tag => this.normalizeOptionFilterTag(tag)).filter(Boolean))
    );
  }

  private normalizeOptionFilterTag(tag: unknown): string {
    return String(tag ?? '').trim().replace(/^#+/, '').toLowerCase();
  }

  private rebuildOptionFilterTagOptions(): void {
    if (!this.optionFiltersEnabled) {
      this.optionFilterTagOptions = [];
      this.selectedOptionFilterTag = '';
      return;
    }

    const counts = new Map<string, number>();
    for (const option of this.options ?? []) {
      for (const tag of this.optionFilterTags(option)) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    this.optionFilterTagOptions = Array.from(counts, ([name, count]) => ({ name, count })).sort(
      (left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
    );
    if (this.selectedOptionFilterTag && !counts.has(this.selectedOptionFilterTag)) {
      this.selectedOptionFilterTag = '';
    }
  }

  private rebuildHierarchyTree(): void {
    this.rebuildOptionFilterTagOptions();
    this.hierarchyOptionByNodeId.clear();
    const entries = (this.filtered || []).map((option, index) => {
      const hierarchy = this.optionHierarchy(option);
      const label = this.optionText(option);
      const rawId = hierarchy?.id ?? this.optionNodeId(option, index);
      const nodeId = this.uniqueHierarchyNodeId(String(rawId), index);
      const parentId = hierarchy?.parentId == null ? '' : String(hierarchy.parentId);
      const path = String(hierarchy?.path ?? '').trim();
      const meta = String(hierarchy?.meta ?? '').trim();
      const depth = Number(hierarchy?.depth ?? 0);
      const safeDepth = Number.isFinite(depth) ? Math.max(0, Math.round(depth)) : 0;
      const node: ExplorerTreeNode = {
        id: nodeId,
        label,
        meta: meta || null,
        tags: this.optionFilterTags(option).map(tag => ({
          label: `#${tag}`,
          title: 'Service item tag'
        })),
        count: hierarchy?.count ?? null,
        selected: this.isOptionSelected(option),
        expanded: this.query.trim() ? true : !this.collapsedHierarchyNodeIds.has(nodeId),
        tooltip: path || meta || label,
        children: []
      };
      this.hierarchyOptionByNodeId.set(nodeId, option);
      return {
        hierarchy,
        node,
        originalId: String(rawId),
        parentId,
        depth: safeDepth
      };
    });

    this.hasHierarchyOptions = entries.some(entry => !!entry.hierarchy);
    if (!this.hasHierarchyOptions) {
      this.hierarchyTreeRoot = {
        id: '__search_select_root__',
        label: 'Options',
        expanded: true,
        children: []
      };
      return;
    }

    const rootChildren: ExplorerTreeNode[] = [];
    const entriesByOriginalId = new Map<string, (typeof entries)[number]>();
    entries.forEach(entry => {
      if (!entriesByOriginalId.has(entry.originalId)) {
        entriesByOriginalId.set(entry.originalId, entry);
      }
    });

    const hasParentIds = entries.some(entry => entry.parentId);
    if (hasParentIds) {
      entries.forEach(entry => {
        const parent = entry.parentId ? entriesByOriginalId.get(entry.parentId) : null;
        if (parent && parent !== entry) {
          parent.node.children = [...(parent.node.children ?? []), entry.node];
          return;
        }
        rootChildren.push(entry.node);
      });
    } else {
      const stack: ExplorerTreeNode[] = [];
      entries.forEach(entry => {
        stack.length = Math.min(stack.length, entry.depth);
        const parent = entry.depth > 0 ? stack[entry.depth - 1] : null;
        if (parent) {
          parent.children = [...(parent.children ?? []), entry.node];
        } else {
          rootChildren.push(entry.node);
        }
        stack[entry.depth] = entry.node;
      });
    }

    this.hierarchyTreeRoot = {
      id: '__search_select_root__',
      label: 'Options',
      expanded: true,
      children: rootChildren
    };
  }

  private optionNodeId(option: T, index: number): string {
    return `${this.optionText(option)}:${index}`;
  }

  private collapsibleHierarchyNodeIds(): string[] {
    const ids: string[] = [];
    const visit = (node: ExplorerTreeNode): void => {
      if (node.children?.length) {
        const id = String(node.id ?? '').trim();
        if (id) {
          ids.push(id);
        }
        node.children.forEach(visit);
      }
    };
    this.hierarchyTreeRoot.children?.forEach(visit);
    return ids;
  }

  private uniqueHierarchyNodeId(rawId: string, index: number): string {
    const base = rawId.trim() || `option:${index}`;
    return this.hierarchyOptionByNodeId.has(base) ? `${base}:${index}` : base;
  }

  private normalizeOptionText(option: T | null): string {
    return this.optionText(option).trim().toLowerCase();
  }

  private sameOptionText(a: T | null, b: T | null): boolean {
    return this.normalizeOptionText(a) === this.normalizeOptionText(b);
  }

  onOptionPointerDown(event: PointerEvent, option: T): void {
    this.markOverlayPointerSelection(event);
    this.choose(option);
  }
  onOptionClick(event: MouseEvent, option: T): void {
    if (this.consumeOverlayPointerSelection(event)) {
      return;
    }
    this.stopOverlayAction(event);
    this.choose(option);
  }
  onOptionDoubleClick(event: MouseEvent, option: T): void {
    if (!this.doubleClickActionId) {
      return;
    }

    this.stopOverlayAction(event);
    this.optionAction.emit({ option, actionId: this.doubleClickActionId });
    this.closePanel(this.shouldRestoreTriggerFocus());
  }
  onOptionActionPointerDown(event: PointerEvent, option: T, actionId: string): void {
    this.stopOverlayAction(event);
    this.optionAction.emit({ option, actionId });
    this.closePanel(this.shouldRestoreTriggerFocus());
  }
  onOptionActionClick(event: MouseEvent, option: T, actionId: string): void {
    this.stopOverlayAction(event);
    this.optionAction.emit({ option, actionId });
    this.closePanel(this.shouldRestoreTriggerFocus());
  }
  onOptionActionKeydown(event: Event, option: T, actionId: string): void {
    this.stopOverlayAction(event);
    this.optionAction.emit({ option, actionId });
    this.closePanel(this.shouldRestoreTriggerFocus());
  }
  onCreatePointerDown(event: PointerEvent): void {
    this.markOverlayPointerSelection(event);
    this.emitCreate();
  }
  onCreateClick(event: MouseEvent): void {
    if (this.consumeOverlayPointerSelection(event)) {
      return;
    }
    this.stopOverlayAction(event);
    this.emitCreate();
  }
  onRenamePointerDown(event: PointerEvent): void {
    this.markOverlayPointerSelection(event);
    this.emitRename();
  }
  onRenameClick(event: MouseEvent): void {
    if (this.consumeOverlayPointerSelection(event)) {
      return;
    }
    this.stopOverlayAction(event);
    this.emitRename();
  }
  onEditSelectedPointerDown(event: PointerEvent): void {
    this.markOverlayPointerSelection(event);
    this.editSelected();
  }
  onEditSelectedClick(event: MouseEvent): void {
    if (this.consumeOverlayPointerSelection(event)) {
      return;
    }
    this.stopOverlayAction(event);
    this.editSelected();
  }

  private stopOverlayAction(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
  }

  private markOverlayPointerSelection(event: Event): void {
    this.stopOverlayAction(event);
    this.overlayPointerSelectionHandled = true;
    setTimeout(() => {
      this.overlayPointerSelectionHandled = false;
    }, 0);
  }

  private consumeOverlayPointerSelection(event: Event): boolean {
    this.stopOverlayAction(event);
    if (!this.overlayPointerSelectionHandled) {
      return false;
    }
    this.overlayPointerSelectionHandled = false;
    return true;
  }

  private editSelected(): void {
    const current = this.valueText();
    if (!current) return;
    this.query = current;
    this.filter();
    setTimeout(() => {
      const input = this.searchInput?.nativeElement;
      if (input) {
        input.focus();
        input.select();
      }
    }, 0);
  }

  public commitPendingInlineValue(): void {
    if (!this.allowInlineSearch || this.openSource !== 'inline') {
      return;
    }

    const inlineQueryMatch = resolveInlineSearchCommitCandidate(
      this.options,
      this.filtered,
      this.query,
      this.displayFn
    );
    if (inlineQueryMatch == null) {
      return;
    }

    const shouldEmitInlineMatch = !this.sameOptionText(inlineQueryMatch, this.value ?? null);
    this.value = inlineQueryMatch;
    if (shouldEmitInlineMatch) {
      this.valueChange.emit(inlineQueryMatch);
    }
    this.query = this.optionText(inlineQueryMatch);
  }

  closePanel(focusTrigger = false): void {
    if (!this.open && !focusTrigger) {
      return;
    }
    const wasOpen = this.open;
    this.commitPendingInlineValue();
    this.open = false;
    if (wasOpen) {
      this.detachOpenDomListeners();
      this.clearActiveInstance();
    }
    this.openSource = 'button';
    this.searchInput?.nativeElement.blur();
    this.query = '';
    this.optionFilterOpen = false;
    this.selectedOptionFilterTag = '';
    this.filtered = [...this.options];
    this.rebuildHierarchyTree();
    this.syncActiveWithValue();
    if (focusTrigger) {
      setTimeout(() => this.triggerButton?.nativeElement?.focus(), 0);
    }
    this.cdr.markForCheck();
  }

  private emitCreate(): void {
    const text = this.createText;
    if (!text) return;
    this.create.emit(text);
    this.closePanel(this.shouldRestoreTriggerFocus());
  }
  private emitRename(): void {
    const text = this.createText;
    if (!text) return;
    if (this.value == null) return;
    this.rename.emit({ from: this.value ?? null, to: text });
    this.closePanel(this.shouldRestoreTriggerFocus());
  }

  private maxActiveIndex(): number {
    let max = this.filtered.length - 1;
    if (this.canRename) max += 1;
    if (this.canCreate) max += 1;
    return Math.max(max, 0);
  }

  private clampActive(): void {
    const max = this.maxActiveIndex();
    if (this.active > max) this.active = max;
    if (this.active < 0) this.active = 0;
  }

  private shouldRestoreTriggerFocus(): boolean {
    return !this.allowInlineSearch || this.openSource === 'button';
  }
  ngOnDestroy(): void {
    this.clearActiveInstance();
    this.detachOpenDomListeners();
  }

  private refreshOverlayGeometry(): void {
    const offsetX = this.resolveOverlayOffsetX();
    this.overlayWidth = this.resolveTriggerWidth();
    this.overlayPositions = this.createOverlayPositions(offsetX);
  }

  private resolveTriggerWidth(): number {
    const anchorWidth = this.measureWidth(this.resolveOverlayWidthAnchor());
    const originWidth = this.measureWidth(this.triggerOrigin?.elementRef.nativeElement ?? null);
    const hostWidth = this.measureWidth(this.hostElement.nativeElement);
    return Math.max(1, this.overlayMinWidth, Math.round(anchorWidth || originWidth || hostWidth || 200));
  }

  private resolveOverlayOffsetX(): number {
    const anchor = this.resolveOverlayWidthAnchor();
    const origin = this.triggerOrigin?.elementRef.nativeElement ?? null;
    if (!anchor || !origin) {
      return 0;
    }

    const anchorLeft = anchor.getBoundingClientRect().left;
    const originLeft = origin.getBoundingClientRect().left;
    const offset = anchorLeft - originLeft;
    return Number.isFinite(offset) ? Math.round(offset) : 0;
  }

  private createOverlayPositions(offsetX: number): ConnectedPosition[] {
    return [
      {
        originX: 'start',
        originY: 'bottom',
        overlayX: 'start',
        overlayY: 'top',
        offsetX,
        offsetY: 6
      },
      {
        originX: 'start',
        originY: 'top',
        overlayX: 'start',
        overlayY: 'bottom',
        offsetX,
        offsetY: -6
      }
    ];
  }

  private syncConnectedOverlayPanelClass(): void {
    const classes = ['search-select-overlay'];
    const extra = this.overlayPanelClass;
    if (Array.isArray(extra)) {
      this.connectedOverlayPanelClass = classes.concat(extra.filter(Boolean));
      return;
    }
    if (extra) {
      classes.push(...extra.split(/\s+/).filter(Boolean));
    }
    this.connectedOverlayPanelClass = classes;
  }

  private closeOtherOpenInstance(): void {
    const activeInstance = SearchSelectComponent.activeInstance;
    if (activeInstance && activeInstance !== this) {
      activeInstance.closePanel();
    }
    SearchSelectComponent.activeInstance = this as SearchSelectComponent<unknown>;
  }

  private clearActiveInstance(): void {
    if (SearchSelectComponent.activeInstance === this) {
      SearchSelectComponent.activeInstance = null;
    }
  }

  private attachOpenDomListeners(): void {
    if (this.openDomListenersAttached || typeof document === 'undefined') {
      return;
    }
    document.addEventListener('pointerdown', this.documentPointerDownHandler, true);
    window.addEventListener('resize', this.windowResizeHandler, { passive: true });
    this.openDomListenersAttached = true;
  }

  private detachOpenDomListeners(): void {
    if (!this.openDomListenersAttached || typeof document === 'undefined') {
      return;
    }
    document.removeEventListener('pointerdown', this.documentPointerDownHandler, true);
    window.removeEventListener('resize', this.windowResizeHandler);
    this.openDomListenersAttached = false;
  }

  private resolveOverlayWidthAnchor(): HTMLElement | null {
    const selector = (this.overlayWidthAnchorSelector || '').trim();
    if (!selector) {
      return null;
    }

    try {
      return this.hostElement.nativeElement.closest(selector);
    } catch {
      return null;
    }
  }

  private measureWidth(element: HTMLElement | null | undefined): number {
    if (!element) {
      return 0;
    }

    const width = element.getBoundingClientRect().width || element.offsetWidth || 0;
    return Number.isFinite(width) ? width : 0;
  }
}
