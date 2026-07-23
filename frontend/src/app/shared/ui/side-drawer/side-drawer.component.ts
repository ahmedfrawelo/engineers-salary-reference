import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  TemplateRef,
  ViewChild
} from '@angular/core';
import { AppIconDirective } from '@shared/icons/app-icon.directive';
import { OverlayPanelComponent } from '../overlay-panel.component';
import { AppTipDirective } from '../tip';

type LooseValue = ReturnType<typeof JSON.parse>;
type SideDrawerPositionMode = 'absolute' | 'fixed';
type SideDrawerMotionPreset = 'default' | 'snappy' | 'instant';
export type SideDrawerMode = 'sidebar' | 'overlay';

/**
 * Shared side drawer shell (sidebar + overlay modes).
 *
 * Dropdown / filter menus inside this drawer should use
 * `app-side-drawer-menu` (or `app-icon-action-combo`) by default —
 * both open the shared context menu. Do not invent one-off popovers here.
 * Chrome action tips use shared `appTip`. Icon actions use shared `app-icon-action`.
 */
@Component({
  selector: 'app-side-drawer',
  standalone: true,
  styleUrls: ['../icon-action/app-icon-action.deep.scss'],
  imports: [CommonModule, AppIconDirective, OverlayPanelComponent, AppTipDirective],
  template: `
    @if (mode === 'overlay') {
      <overlay-panel
        [open]="open"
        [showHeader]="true"
        [title]="title || 'Panel'"
        [subtitle]="subtitle"
        [dense]="true"
        [bodyPaddingDense]="0"
        [bodyPadding]="0"
        [autoFitContent]="false"
        [draggable]="false"
        [lockPosition]="false"
        [geometryMode]="'viewport'"
        [minWidth]="overlayMinWidth"
        [minHeight]="overlayMinHeight"
        [maxWidth]="overlayMaxWidth"
        [maxHeight]="overlayMaxHeight"
        [fitRatioWDesktop]="overlayFitRatioWDesktop"
        [fitRatioHDesktop]="overlayFitRatioHDesktop"
        [fitRatioWMobile]="overlayFitRatioWMobile"
        [fitRatioHMobile]="overlayFitRatioHMobile"
        [compactBreakpoint]="overlayCompactBreakpoint"
        [edgeGap]="overlayEdgeGap"
        [panelSidePad]="overlayPanelSidePad"
        [backdropBlur]="overlayBackdropBlur"
        [backdropTint]="overlayBackdropTint"
        [backdropSaturate]="1"
        [backdropBrightness]="1"
        [anim]="'scale'"
        [panelClass]="resolvedOverlayPanelClass"
        [hotkeyEscCloses]="true"
        (closed)="closed.emit()"
      >
        <div panel-actions class="side-drawer-overlay-actions">
          @if (actionsTemplate) {
            <ng-container *ngTemplateOutlet="actionsTemplate"></ng-container>
          }
          @if (showModeToggle) {
            <button
              type="button"
              class="app-icon-action"
              [appTip]="modeToggleLabel"
              [attr.aria-label]="modeToggleLabel"
              [attr.aria-pressed]="true"
              (click)="onModeToggle($event)"
            >
              <i [appIcon]="modeToggleIcon" aria-hidden="true"></i>
              <span class="app-icon-action-label">{{ modeToggleShortLabel }}</span>
            </button>
          }
        </div>
        <div class="side-drawer-overlay-body">
          @if (toolbarTemplate) {
            <div class="side-drawer-toolbar">
              <ng-container *ngTemplateOutlet="toolbarTemplate"></ng-container>
            </div>
          }
          @if (contentTemplate) {
            <ng-container *ngTemplateOutlet="contentTemplate"></ng-container>
          }
        </div>
      </overlay-panel>
    } @else {
      <div
        class="side-drawer-layer"
        [class.is-open]="open"
        [class.is-snappy]="motionPreset === 'snappy'"
        [class.is-instant]="motionPreset === 'instant'"
        [style.position]="positionMode"
        [style.zIndex]="resolvedZIndex"
        [style.top.px]="topInset"
        [style.right.px]="rightInset"
        [style.bottom.px]="bottomInset"
        [style.left.px]="leftInset"
        [style.background]="backdropTint > 0 ? tint : null"
        [style.backdropFilter]="backdropBlur > 0 ? blur : null"
        (click)="onBackdrop($event)"
      >
        <aside
          #panel
          class="side-drawer-panel"
          [class.is-open]="open"
          [class.is-snappy]="motionPreset === 'snappy'"
          [class.is-instant]="motionPreset === 'instant'"
          [class.has-shell-header]="showHeader"
          role="dialog"
          [attr.aria-modal]="open ? 'true' : null"
          [attr.aria-hidden]="open ? null : 'true'"
          [ngClass]="panelClass"
          [style.width.px]="resolvedWidth"
          (click)="$event.stopPropagation()"
        >
          @if (showHeader) {
            <div class="side-drawer-header">
              <div class="side-drawer-header__copy">
                @if (title) {
                  <div class="side-drawer-header__title">{{ title }}</div>
                }
                @if (subtitle) {
                  <div class="side-drawer-header__subtitle">{{ subtitle }}</div>
                }
              </div>
              <div class="side-drawer-header__actions">
                @if (actionsTemplate) {
                  <ng-container *ngTemplateOutlet="actionsTemplate"></ng-container>
                }
                @if (showModeToggle) {
                  <button
                    type="button"
                    class="app-icon-action"
                    [appTip]="modeToggleLabel"
                    [attr.aria-label]="modeToggleLabel"
                    [attr.aria-pressed]="false"
                    (click)="onModeToggle($event)"
                  >
                    <i [appIcon]="modeToggleIcon" aria-hidden="true"></i>
                    <span class="app-icon-action-label">{{ modeToggleShortLabel }}</span>
                  </button>
                }
              </div>
            </div>
            @if (toolbarTemplate) {
              <div class="side-drawer-toolbar">
                <ng-container *ngTemplateOutlet="toolbarTemplate"></ng-container>
              </div>
            }
            <div class="side-drawer-body">
              @if (contentTemplate) {
                <ng-container *ngTemplateOutlet="contentTemplate"></ng-container>
              }
            </div>
          } @else if (contentTemplate) {
            <ng-container *ngTemplateOutlet="contentTemplate"></ng-container>
          } @else {
            <ng-content></ng-content>
          }
        </aside>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      .side-drawer-layer {
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        left: 0;
        z-index: 40;
        display: flex;
        justify-content: flex-end;
        overflow: hidden;
        pointer-events: none;
        visibility: hidden;
        opacity: 0;
        transition:
          opacity 180ms ease,
          visibility 0ms linear 220ms;
      }

      .side-drawer-layer.is-open {
        pointer-events: auto;
        visibility: visible;
        opacity: 1;
        transition:
          opacity 180ms ease,
          visibility 0ms linear 0ms;
      }

      .side-drawer-layer.is-snappy {
        transition:
          opacity 90ms ease,
          visibility 0ms linear 120ms;
      }

      .side-drawer-layer.is-snappy.is-open {
        transition:
          opacity 90ms ease,
          visibility 0ms linear 0ms;
      }

      .side-drawer-panel {
        position: relative;
        z-index: 1;
        width: min(360px, 100%);
        max-width: 100%;
        height: 100%;
        min-height: 0;
        display: flex;
        flex-direction: column;
        border-radius: 0;
        opacity: 0.98;
        transform: translate3d(32px, 0, 0);
        transition:
          transform 220ms cubic-bezier(0.2, 0.82, 0.24, 1),
          opacity 180ms ease;
        will-change: transform;
      }

      .side-drawer-panel.is-open {
        opacity: 1;
        transform: translate3d(0, 0, 0);
      }

      .side-drawer-panel.is-snappy {
        transform: translate3d(14px, 0, 0);
        transition:
          transform 110ms cubic-bezier(0.2, 0.82, 0.24, 1),
          opacity 90ms ease;
      }

      .side-drawer-layer.is-instant,
      .side-drawer-layer.is-instant.is-open,
      .side-drawer-panel.is-instant,
      .side-drawer-panel.is-instant.is-open {
        transition: none !important;
      }

      .side-drawer-panel.is-instant {
        opacity: 1;
        transform: none;
      }

      .side-drawer-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        flex: 0 0 auto;
        min-width: 0;
        padding: 10px 12px 8px;
        overflow: visible;
      }

      .side-drawer-header__copy {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }

      .side-drawer-header__title {
        font-size: 13px;
        font-weight: 850;
        letter-spacing: 0;
        color: rgb(var(--fg) / 0.94);
        line-height: 1.2;
      }

      .side-drawer-header__subtitle {
        font-size: 10.5px;
        font-weight: 650;
        color: rgb(var(--muted) / 0.86);
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .side-drawer-header__actions {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        flex: 0 0 auto;
        margin-left: auto;
        overflow: visible;
      }

      .side-drawer-overlay-actions {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .side-drawer-toolbar {
        display: flex;
        flex: 0 0 auto;
        flex-direction: column;
        min-width: 0;
        overflow: visible;
      }

      .side-drawer-overlay-body > .side-drawer-toolbar {
        margin-top: 4px;
      }

      /* Optional combo / split action (chevron menu). Omit menuItems → plain button. */
      :host ::ng-deep .app-icon-action-split {
        position: relative;
        display: inline-flex;
        align-items: center;
        flex: 0 0 auto;
      }

      :host ::ng-deep .app-icon-action-split.has-menu {
        --app-icon-action-outline: rgb(var(--border) / 0.42);
        --app-icon-action-outline-hover: rgb(var(--border) / 0.82);
        --app-icon-action-hover-bg: color-mix(in oklab, rgb(var(--fg)) 10%, transparent);
        border: 1px solid var(--app-icon-action-outline);
        border-radius: 8px;
        background: transparent;
        overflow: visible;
        transition:
          border-color 0.15s ease,
          background 0.15s ease;
      }

      :host ::ng-deep .app-icon-action-split.has-menu:hover,
      :host ::ng-deep .app-icon-action-split.has-menu:focus-within,
      :host ::ng-deep .app-icon-action-split.has-menu:has(.app-icon-action-menu[open]) {
        border-color: var(--app-icon-action-outline-hover);
        background: var(--app-icon-action-hover-bg);
      }

      :host ::ng-deep .app-icon-action-split.has-menu .app-icon-action {
        border: 0;
        border-radius: 0;
        background: transparent;
      }

      :host ::ng-deep .app-icon-action-split.has-menu .app-icon-action:hover:not(:disabled),
      :host ::ng-deep .app-icon-action-split.has-menu .app-icon-action:focus-visible,
      :host ::ng-deep .app-icon-action-split.has-menu .app-icon-action:active:not(:disabled) {
        background: color-mix(in oklab, rgb(var(--fg)) 8%, transparent);
      }

      :host ::ng-deep .app-icon-action-split.has-menu .app-icon-action--main {
        border-radius: 7px 0 0 7px;
      }

      :host ::ng-deep .app-icon-action-split.has-menu .app-icon-action--trigger {
        width: 22px;
        min-width: 22px;
        border: 0;
        border-left: 1px solid var(--app-icon-action-outline);
        border-radius: 0 7px 7px 0;
        list-style: none;
        transition:
          border-color 0.15s ease,
          background 0.15s ease,
          color 0.15s ease;
      }

      :host ::ng-deep .app-icon-action-split.has-menu:hover .app-icon-action--trigger,
      :host ::ng-deep .app-icon-action-split.has-menu:focus-within .app-icon-action--trigger,
      :host ::ng-deep .app-icon-action-split.has-menu:has(.app-icon-action-menu[open]) .app-icon-action--trigger {
        border-left-color: var(--app-icon-action-outline-hover);
      }

      :host ::ng-deep .app-icon-action-split.has-menu .app-icon-action--trigger::-webkit-details-marker {
        display: none;
      }

      :host ::ng-deep .app-icon-action-split.has-menu .app-icon-action--main:hover:not(:disabled),
      :host ::ng-deep .app-icon-action-split.has-menu .app-icon-action--main:focus-visible,
      :host ::ng-deep .app-icon-action-split.has-menu:has(.app-icon-action-menu[open]) .app-icon-action--main {
        width: var(--app-icon-action-expand-width, 88px);
        gap: 6px;
        padding: 0 8px;
      }

      :host ::ng-deep .app-icon-action-menu {
        display: contents;
      }

      :host ::ng-deep .app-icon-action-menu__panel {
        --app-icon-action-outline: rgb(var(--border) / 0.42);
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        z-index: 8;
        display: block;
        min-width: 196px;
        max-width: min(280px, 70vw);
        overflow: visible;
        padding: 6px;
        border: 1px solid var(--app-icon-action-outline);
        border-radius: 8px;
        background: rgb(var(--bg0));
        box-shadow: none;
      }

      :host ::ng-deep .app-icon-action-menu__list {
        display: grid;
        gap: 2px;
        max-height: min(320px, 50vh);
        overflow: auto;
      }

      :host ::ng-deep .app-icon-action-menu__submenu {
        position: absolute;
        top: 0;
        right: calc(100% + 6px);
        z-index: 9;
        display: grid;
        gap: 2px;
        min-width: 188px;
        max-width: min(260px, 60vw);
        max-height: min(280px, 45vh);
        overflow: auto;
        padding: 6px;
        border: 1px solid var(--app-icon-action-outline);
        border-radius: 8px;
        background: rgb(var(--bg0));
      }

      :host ::ng-deep .app-icon-action-menu__panel button {
        position: relative;
        width: 100%;
        min-height: 32px;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 8px 0 10px;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: rgb(var(--fg) / 0.9);
        font: inherit;
        font-size: 12px;
        font-weight: 700;
        text-align: start;
        cursor: pointer;
        transition:
          background 0.14s ease,
          color 0.14s ease,
          padding 0.14s ease;
      }

      :host ::ng-deep .app-icon-action-menu__panel button::before {
        content: '';
        position: absolute;
        top: 6px;
        bottom: 6px;
        left: 0;
        width: 2px;
        border-radius: 999px;
        background: transparent;
        transition: background 0.14s ease;
      }

      :host ::ng-deep .app-icon-action-menu__panel button .app-icon-host,
      :host ::ng-deep .app-icon-action-menu__panel button > i {
        width: 15px;
        height: 15px;
        flex: 0 0 auto;
      }

      :host ::ng-deep .app-icon-action-menu__panel button:hover:not(:disabled),
      :host ::ng-deep .app-icon-action-menu__panel button:focus-visible {
        background: color-mix(in oklab, rgb(var(--fg)) 10%, transparent);
        color: rgb(var(--fg) / 0.98);
        outline: none;
        padding-left: 12px;
      }

      :host ::ng-deep .app-icon-action-menu__panel button:hover:not(:disabled)::before,
      :host ::ng-deep .app-icon-action-menu__panel button:focus-visible::before {
        background: rgb(var(--fg) / 0.72);
      }

      :host ::ng-deep .app-icon-action-menu__panel button:disabled {
        cursor: not-allowed;
        opacity: 0.48;
      }

      .side-drawer-body,
      .side-drawer-overlay-body {
        display: flex;
        flex: 1 1 auto;
        flex-direction: column;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
      }

      .side-drawer-panel.has-shell-header .side-drawer-body {
        min-height: 0;
      }

      @media (prefers-reduced-motion: reduce) {
        .side-drawer-layer,
        .side-drawer-panel {
          transition-duration: 0.001ms;
        }
      }
    `
  ]
})
export class SideDrawerComponent implements OnChanges, OnDestroy {
  private openState = false;
  private modeState: SideDrawerMode = 'sidebar';
  private openDomListenersAttached = false;
  private readonly windowKeydownHandler = (event: KeyboardEvent) => this.onKeyDown(event);
  private readonly documentPointerDownHandler = (event: PointerEvent) =>
    this.onDocumentPointerDown(event);

  @Input() set open(value: boolean) {
    const nextOpen = !!value;
    if (this.openState === nextOpen) return;
    this.openState = nextOpen;
    this.syncOpenDomListeners();
  }
  get open(): boolean {
    return this.openState;
  }

  @Input() set mode(value: SideDrawerMode) {
    const nextMode: SideDrawerMode = value === 'overlay' ? 'overlay' : 'sidebar';
    if (this.modeState === nextMode) return;
    this.modeState = nextMode;
    this.syncOpenDomListeners();
  }
  get mode(): SideDrawerMode {
    return this.modeState;
  }

  @Input() width: number | string = 352;
  @Input() zIndex: number | null = null;
  @Input() positionMode: SideDrawerPositionMode = 'absolute';
  @Input() topInset: number | null = null;
  @Input() rightInset: number | null = null;
  @Input() bottomInset: number | null = null;
  @Input() leftInset: number | null = null;
  @Input() backdropTint = 0;
  @Input() backdropBlur = 0;
  @Input() closeOnBackdrop = true;
  @Input() closeOnOutsidePointerDown = true;
  @Input() ignoreOutsideSelectors = '';
  @Input() motionPreset: SideDrawerMotionPreset = 'default';
  @Input() panelClass: string | string[] | Set<string> | { [klass: string]: LooseValue } = '';
  @Input() title = '';
  @Input() subtitle = '';
  @Input() showHeader = false;
  @Input() showModeToggle = false;
  @Input() contentTemplate?: TemplateRef<unknown> | null;
  @Input() actionsTemplate?: TemplateRef<unknown> | null;
  /** Optional strip under the shell header (search/filter tools). Not required. */
  @Input() toolbarTemplate?: TemplateRef<unknown> | null;
  @Input() overlayPanelClass:
    | string
    | string[]
    | Set<string>
    | { [klass: string]: LooseValue } = 'task-panel task-panel-clickup task-panel-ref-size';
  @Input() overlayMinWidth = 420;
  @Input() overlayMinHeight = 560;
  @Input() overlayMaxWidth = 760;
  @Input() overlayMaxHeight = 920;
  @Input() overlayFitRatioWDesktop = 0.5;
  @Input() overlayFitRatioHDesktop = 0.9;
  @Input() overlayFitRatioWMobile = 0.98;
  @Input() overlayFitRatioHMobile = 0.96;
  @Input() overlayCompactBreakpoint = 1180;
  @Input() overlayEdgeGap = 4;
  @Input() overlayPanelSidePad = 8;
  @Input() overlayBackdropBlur = 0;
  @Input() overlayBackdropTint = 0;

  @Output() closed = new EventEmitter<void>();
  @Output() modeChange = new EventEmitter<SideDrawerMode>();

  @ViewChild('panel') private panelRef?: ElementRef<HTMLElement>;

  get resolvedWidth(): number {
    const pixels = typeof this.width === 'string' ? parseInt(this.width, 10) : this.width;
    return Number.isFinite(pixels) && pixels > 0 ? pixels : 352;
  }

  get resolvedZIndex(): number {
    return Number.isFinite(this.zIndex) ? Number(this.zIndex) : 40;
  }

  get blur(): string {
    return `blur(${this.backdropBlur}px)`;
  }

  get tint(): string {
    return `rgba(0,0,0,${this.backdropTint})`;
  }

  get modeToggleLabel(): string {
    return this.mode === 'overlay' ? 'Dock as sidebar' : 'Open as overlay';
  }

  get modeToggleShortLabel(): string {
    return this.mode === 'overlay' ? 'Dock' : 'Overlay';
  }

  get modeToggleIcon(): string {
    // Destination affordance: pop out to overlay when docked, dock to sidebar when floating.
    return this.mode === 'overlay' ? 'layout-sidebar' : 'box-arrow-up-right';
  }

  get resolvedOverlayPanelClass():
    | string
    | string[]
    | Set<string>
    | { [klass: string]: LooseValue } {
    return this.overlayPanelClass;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] || changes['mode']) {
      this.syncOpenDomListeners();
    }
  }

  onModeToggle(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const nextMode: SideDrawerMode = this.mode === 'overlay' ? 'sidebar' : 'overlay';
    this.modeChange.emit(nextMode);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (!this.open || this.mode !== 'sidebar' || event.key !== 'Escape') return;
    event.preventDefault();
    this.closed.emit();
  }

  onDocumentPointerDown(event: PointerEvent): void {
    if (!this.open || this.mode !== 'sidebar' || !this.closeOnOutsidePointerDown) return;

    const target = event.target as HTMLElement | null;
    if (!target) return;

    if (this.ignoreOutsideSelectors && target.closest(this.ignoreOutsideSelectors)) return;

    const panel = this.panelRef?.nativeElement;
    if (panel?.contains(target)) return;

    this.closed.emit();
  }

  onBackdrop(event: MouseEvent): void {
    if (!this.open || this.mode !== 'sidebar' || !this.closeOnBackdrop) return;
    if (event.target !== event.currentTarget) return;
    this.closed.emit();
  }

  ngOnDestroy(): void {
    this.detachOpenDomListeners();
  }

  private syncOpenDomListeners(): void {
    if (this.open && this.mode === 'sidebar') {
      this.attachOpenDomListeners();
    } else {
      this.detachOpenDomListeners();
    }
  }

  private attachOpenDomListeners(): void {
    if (this.openDomListenersAttached) return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    this.openDomListenersAttached = true;
    window.addEventListener('keydown', this.windowKeydownHandler);
    document.addEventListener('pointerdown', this.documentPointerDownHandler);
  }

  private detachOpenDomListeners(): void {
    if (!this.openDomListenersAttached) return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    this.openDomListenersAttached = false;
    window.removeEventListener('keydown', this.windowKeydownHandler);
    document.removeEventListener('pointerdown', this.documentPointerDownHandler);
  }
}
