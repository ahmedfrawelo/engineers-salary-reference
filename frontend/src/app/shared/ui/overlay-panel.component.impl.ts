import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  NgZone,
  Renderer2,
  RendererStyleFlags2
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppIconDirective } from '@shared/icons/app-icon.directive';
import { HugeiconsIconComponent, type IconSvgObject } from '@hugeicons/angular';
import {
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Delete02Icon,
  Edit01Icon,
  UserAdd01Icon
} from '@shared/icons/app-icon.registry';
import {
  resolveOverlayCloseEvent,
  type OverlayCloseEventState
} from './overlay-panel-close.util';

type LooseValue = ReturnType<typeof JSON.parse>;
type OverlayVariant = 'panel' | 'dialog';
type OverlayAnim = 'spring' | 'slide' | 'scale' | 'morph';
type OverlayHeaderIcon = 'person-add' | 'person-edit';
type OverlayPlacement = 'center' | 'right-drawer';
type OverlayGeometryMode = 'shell' | 'viewport';
type OverlayGeometryRoot = {
  left: number;
  top: number;
  width: number;
  height: number;
  local: boolean;
};

@Component({
  selector: 'overlay-panel',
  standalone: true,
  imports: [CommonModule, HugeiconsIconComponent, AppIconDirective],
  templateUrl: './overlay-panel.component.html',
  styleUrls: ['./overlay-panel.component.scss']
})
export class OverlayPanelComponent implements AfterViewInit, OnChanges, OnDestroy {
  readonly saveOverlayIcon = CheckmarkCircle02Icon;
  readonly deleteOverlayIcon = Delete02Icon;
  readonly closeOverlayIcon = Cancel01Icon;
  readonly titleOverlayIcons: Record<OverlayHeaderIcon, IconSvgObject> = {
    'person-add': UserAdd01Icon,
    'person-edit': Edit01Icon
  };

  @Input() title = 'Panel';
  @Input() subtitle = '';
  @Input() titleIcon: OverlayHeaderIcon | null = null;
  @Input() open = false;
  @Input() set width(val: string | number) {
    const pixels = typeof val === 'string' ? parseInt(val, 10) : val;
    if (!isNaN(pixels)) {
      this.minWidth = pixels;
      this.maxWidth = pixels;
    }
  }

  @Input() minWidth = 320;
  @Input() minHeight = 320;

  @Input() maxWidth = 1760;
  @Input() maxHeight = 980;

  @Input() fitRatioWDesktop = 0.98;
  @Input() fitRatioHDesktop = 0.92;
  @Input() fitRatioWMobile = 0.98;
  @Input() fitRatioHMobile = 0.96;
  @Input() compactBreakpoint = 900;

  @Input() headerSelector = 'header';
  @Input() sidebarSelectors = '.sidebar,.side-nav,.app-sidebar,side-fab';
  @Input() safeLeftSelectors = '[data-safe-left],.side-fab,.side-dock';
  @Input() safeRightSelectors = '[data-safe-right],.right-dock';
  @Input() boundsSelector = '';

  @Input() safeInsets?: { top: number; left: number; right: number; bottom: number };
  @Input() edgeGap = 8;
  @Input() panelSidePad = 12;
  @Input() extraSafeLeft = 0;
  @Input() extraSafeRight = 0;
  @Input() equalMovementRange = false;

  @Input() draggable = true;
  @Input() dragAnywhere = false;

  @Input() backdropBlur = 2;
  @Input() backdropTint = 0;
  @Input() backdropSaturate = 1.01;
  @Input() backdropBrightness = 1;

  @Input() showSave = false;
  @Input() showDelete = false;
  @Input() closeDanger = true;
  @Input() saveAccent = true;
  @Input() showHeaderAction = false;
  @Input() headerActionLabel = '';
  @Input() headerActionTitle = '';
  @Input() headerActionIcon = 'box-arrow-up-right';
  @Input() bubbleTooltips = false;

  @Input() hotkeyEscCloses = true;
  @Input() hotkeyEnterSaves = true;

  @Input() autoFitContent = true;
  @Input() lockPosition = false;

  @Input() panelClass: string | string[] | Set<string> | { [klass: string]: LooseValue } = '';
  @Input() variant: OverlayVariant = 'panel';
  @Input() placement: OverlayPlacement = 'center';
  @Input() geometryMode: OverlayGeometryMode = 'shell';

  @Input() dense = false;
  @Input() showHeader = true;
  @Input() bodyPadding = 14;
  @Input() bodyPaddingDense = 6;

  /** ????????? — ??????? random */
  @Input() anim: OverlayAnim | 'random' = 'random';

  @Output() closed = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();
  @Output() headerAction = new EventEmitter<void>();

  @ViewChild('overlay') overlayRef!: ElementRef<HTMLDivElement>;
  @ViewChild('panel') panelRef!: ElementRef<HTMLDivElement>;
  @ViewChild('dragHandle') dragHandleRef?: ElementRef<HTMLDivElement>;

  pos = { left: -10000, top: -10000 };
  size = { w: 800, h: 600 };
  limits = { w: 800, h: 600 };

  dragging = false;
  private dragOff = { x: 0, y: 0 };
  private startPos = { left: 0, top: 0 };
  private dragDelta = { x: 0, y: 0 };
  private pendingDragDelta = { x: 0, y: 0 };
  private dragFrame: number | null = null;
  dragTransform = 'translate3d(0,0,0)';
  private userMoved = false;
  private dragBounds?: { minL: number; maxL: number; minT: number; maxT: number };
  private dragPointerTarget?: Element;
  private readonly dragSkipSelector =
    'button, a, input, textarea, select, option, label, summary, [role="button"], [contenteditable], [data-no-drag], .hdr-actions';

  private roHeader?: ResizeObserver;
  private roSidebars: ResizeObserver[] = [];
  private roSafeLefts?: ResizeObserver;
  private roSafeRights?: ResizeObserver;
  private roBounds?: ResizeObserver;
  private roPanel?: ResizeObserver;
  private bodyMutationObserver?: MutationObserver;
  private postOpenLayoutFrames: number[] = [];
  private postOpenLayoutTimer: number | null = null;
  private boundsSyncFrames: number[] = [];
  private panelObserverSetupFrame: number | null = null;
  private openStateFrame: number | null = null;
  private awaitingLayoutReveal = false;
  private closeEventState: OverlayCloseEventState = { handledByPointer: false };

  private inited = false;
  justOpened = false;
  layoutReady = true;

  /** ????????? ??????? ?????? */
  selectedAnim: OverlayAnim = 'spring';
  private readonly anims: OverlayAnim[] = ['spring', 'slide', 'scale', 'morph'];

  constructor(
    private zone: NgZone,
    private r2: Renderer2,
    private hostRef: ElementRef<HTMLElement>,
    private cdr: ChangeDetectorRef
  ) {}

  get backdropFilter() {
    const parts: string[] = [];
    if (this.backdropBlur > 0) parts.push(`blur(${this.backdropBlur}px)`);
    if (Math.abs(this.backdropSaturate - 1) > 0.001) {
      parts.push(`saturate(${this.backdropSaturate})`);
    }
    if (Math.abs(this.backdropBrightness - 1) > 0.001) {
      parts.push(`brightness(${this.backdropBrightness})`);
    }
    return parts.length ? parts.join(' ') : 'none';
  }

  get backdropSurface() {
    if (this.backdropTint <= 0 && this.backdropBlur <= 0) return 'transparent';
    const base = this.clamp(this.backdropTint, 0, 1);
    return `rgba(255, 255, 255, ${base})`;
  }

  get backdropGlow() {
    return 'transparent';
  }

  get panelMinWidth() {
    return Math.min(this.minWidth, this.size.w);
  }

  get panelMinHeight() {
    if (this.placement === 'right-drawer' || this.dense) return 0;
    return Math.min(this.minHeight, this.size.h);
  }

  ngAfterViewInit() {
    this.inited = true;
    this.setupObservers();
    if (this.open) {
      this.startOpenCycle();
    }
  }

  ngOnChanges(ch: SimpleChanges) {
    if (!this.inited) return;
    if (ch['open']) {
      const nowOpen = !!ch['open'].currentValue;
      if (nowOpen) {
        this.startOpenCycle();
      } else {
        this.roPanel?.disconnect();
        this.bodyMutationObserver?.disconnect();
        this.cancelPanelObserverSetup();
        this.cancelBoundsSync();
        this.cancelPostOpenLayoutSync();
        this.cancelOpenStateFrame();
        this.awaitingLayoutReveal = false;
        this.layoutReady = true;
        this.justOpened = false;
        this.endDrag();
      }
    }
  }

  private pickAnim() {
    if (this.placement === 'right-drawer' && this.anim === 'random') {
      this.selectedAnim = 'slide';
      return;
    }
    if (this.anim === 'random') {
      const i = Math.floor(Math.random() * this.anims.length);
      this.selectedAnim = this.anims[i];
    } else {
      this.selectedAnim = this.anim as OverlayAnim;
    }
  }

  private clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  ngOnDestroy() {
    this.roHeader?.disconnect();
    this.roSidebars.forEach(ro => ro.disconnect());
    this.roSafeLefts?.disconnect();
    this.roSafeRights?.disconnect();
    this.roBounds?.disconnect();
    this.roPanel?.disconnect();
    this.bodyMutationObserver?.disconnect();
    this.cancelPanelObserverSetup();
    this.cancelBoundsSync();
    this.cancelPostOpenLayoutSync();
    this.cancelOpenStateFrame();
    this.endDrag();
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(ev: KeyboardEvent) {
    if (!this.open) return;
    const t = ev.target as HTMLElement | null;
    const tag = t?.tagName?.toLowerCase();
    const inEditable =
      t?.isContentEditable || tag === 'input' || tag === 'select' || tag === 'textarea';
    if (this.hotkeyEscCloses && ev.key === 'Escape') {
      ev.preventDefault();
      this.closed.emit();
      return;
    }
    if (this.hotkeyEnterSaves && ev.key === 'Enter' && this.showSave && !inEditable) {
      if (!ev.shiftKey && !ev.ctrlKey && !ev.altKey && !ev.metaKey) {
        ev.preventDefault();
        this.save.emit();
      }
    }
  }

  private setupObservers() {
    const header = document.querySelector(this.headerSelector) as HTMLElement | null;
    const sidebars = Array.from(document.querySelectorAll<HTMLElement>(this.sidebarSelectors));
    if ('ResizeObserver' in window) {
      if (header) {
        this.roHeader = new ResizeObserver(() => this.onBoundsChanged());
        this.roHeader.observe(header);
      }
      const boundsElement = this.boundsElement();
      if (boundsElement) {
        this.roBounds = new ResizeObserver(() => this.onBoundsChanged());
        this.roBounds.observe(boundsElement);
      }
      if (sidebars.length) {
        this.roSidebars = sidebars.map(sb => {
          const ro = new ResizeObserver(() => this.onBoundsChanged());
          ro.observe(sb);
          return ro;
        });
      }
      const leftBlocks = Array.from(document.querySelectorAll<HTMLElement>(this.safeLeftSelectors));
      if (leftBlocks.length) {
        this.roSafeLefts = new ResizeObserver(() => this.onBoundsChanged());
        leftBlocks.forEach(el => this.roSafeLefts!.observe(el));
      }
      const rightBlocks = Array.from(
        document.querySelectorAll<HTMLElement>(this.safeRightSelectors)
      );
      if (rightBlocks.length) {
        this.roSafeRights = new ResizeObserver(() => this.onBoundsChanged());
        rightBlocks.forEach(el => this.roSafeRights!.observe(el));
      }
      this.setupPanelObservers();
    }
  }

  private setupPanelObservers() {
    this.roPanel?.disconnect();
    this.bodyMutationObserver?.disconnect();

    const panel = this.panelRef?.nativeElement;
    if (!panel) return;

    if ('ResizeObserver' in window) {
      this.roPanel = new ResizeObserver(() => {
        if (!this.open) return;
        if (!this.userMoved && !this.dragging && this.placement !== 'right-drawer') this.center();
        else this.keepInside();
      });
      this.roPanel.observe(panel);
    }

    const body = panel.querySelector('.body');
    if (body && 'MutationObserver' in window) {
      this.bodyMutationObserver = new MutationObserver(() => this.requestPostOpenLayoutSync());
      this.bodyMutationObserver.observe(body, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }
  }

  private onBoundsChanged() {
    if (!this.open) return;
    this.syncBoundsLayout();
    this.requestBoundsSync();
  }

  @HostListener('window:resize')
  onResize() {
    if (!this.open) return;
    this.syncBoundsLayout();
    this.requestBoundsSync();
  }

  private syncBoundsLayout() {
    this.measure();
    if (this.placement === 'right-drawer') this.dockToRight();
    else if (!this.userMoved && !this.dragging) this.center();
    else this.keepInside();
    if (this.autoFitContent) this.requestPostOpenLayoutSync();
  }

  private requestBoundsSync() {
    this.cancelBoundsSync();
    const run = () => this.zone.run(() => this.syncBoundsLayout());
    const frameOne = window.requestAnimationFrame(() => {
      this.boundsSyncFrames = this.boundsSyncFrames.filter(id => id !== frameOne);
      run();
      const frameTwo = window.requestAnimationFrame(() => {
        this.boundsSyncFrames = this.boundsSyncFrames.filter(id => id !== frameTwo);
        run();
      });
      this.boundsSyncFrames.push(frameTwo);
    });
    this.boundsSyncFrames.push(frameOne);
  }

  private cancelBoundsSync() {
    for (const frame of this.boundsSyncFrames) {
      window.cancelAnimationFrame(frame);
    }
    this.boundsSyncFrames = [];
  }

  private measure() {
    const viewport = this.geometryRoot();
    const b = this.safe();
    const availWRaw = Math.max(0, viewport.width - b.left - b.right);
    const availHRaw = Math.max(0, viewport.height - b.top - b.bottom);

    if (this.placement === 'right-drawer') {
      this.limits.w = Math.max(0, Math.floor(availWRaw));
      this.limits.h = Math.max(0, Math.floor(availHRaw));
      const effMinW = Math.min(this.minWidth, this.limits.w);
      const effMinH = Math.min(this.dense ? 0 : this.minHeight, this.limits.h);
      this.size.w = Math.max(effMinW, Math.min(this.maxWidth, this.limits.w));
      this.size.h = Math.max(effMinH, this.limits.h);
      return;
    }

    const availW = Math.max(0, availWRaw - 2 * this.panelSidePad);
    const availH = Math.max(0, availHRaw - 2 * this.panelSidePad);

    this.limits.w = Math.max(0, Math.floor(availW - 4));
    this.limits.h = Math.max(0, Math.floor(availH - 4));

    const effMinW = Math.min(this.minWidth, this.limits.w);
    const effMinH = Math.min(this.dense ? 0 : this.minHeight, this.limits.h);

    const isCompact = availWRaw <= this.compactBreakpoint;
    const ratioW = isCompact ? this.fitRatioWMobile : this.fitRatioWDesktop;
    const ratioH = isCompact ? this.fitRatioHMobile : this.fitRatioHDesktop;

    const targetW = Math.min(this.maxWidth, Math.floor(this.limits.w * ratioW));
    const targetH = Math.min(this.maxHeight, Math.floor(this.limits.h * ratioH));

    this.size.w = Math.max(effMinW, targetW);
    this.size.h = Math.max(effMinH, targetH);
  }

  private measureThenCenter() {
    this.measure();
    this.placePanel();
    requestAnimationFrame(() => {
      this.measure();
      requestAnimationFrame(() => {
        this.measure();
        if (this.placement === 'right-drawer') this.dockToRight();
        else if (!this.userMoved && !this.dragging) this.center();
        else this.keepInside();
        if (!this.autoFitContent || this.placement === 'right-drawer') {
          this.zone.run(() => this.revealOpenPanel());
        }
        if (this.autoFitContent) this.requestPostOpenLayoutSync();
      });
    });
  }

  private startOpenCycle() {
    this.cancelOpenStateFrame();
    this.pickAnim();
    this.userMoved = false;
    this.awaitingLayoutReveal = true;
    this.layoutReady = false;
    this.justOpened = false;
    this.requestPanelObserverSetup();
    this.measureThenCenter();
    if (this.autoFitContent && this.placement !== 'right-drawer') {
      this.requestPostOpenLayoutSync();
    }
  }

  private requestPanelObserverSetup() {
    this.cancelPanelObserverSetup();
    this.panelObserverSetupFrame = window.requestAnimationFrame(() => {
      this.panelObserverSetupFrame = null;
      this.setupPanelObservers();
    });
  }

  private cancelPanelObserverSetup() {
    if (this.panelObserverSetupFrame !== null) {
      window.cancelAnimationFrame(this.panelObserverSetupFrame);
      this.panelObserverSetupFrame = null;
    }
  }

  public requestLayoutRefit(): void {
    if (!this.inited || !this.open) return;

    if (this.autoFitContent) {
      this.requestPostOpenLayoutSync();
      return;
    }

    this.measure();
    if (this.placement === 'right-drawer') this.dockToRight();
    else if (!this.userMoved && !this.dragging) this.center();
    else this.keepInside();
  }

  private revealOpenPanel() {
    if (!this.awaitingLayoutReveal) return;
    this.awaitingLayoutReveal = false;
    this.layoutReady = true;
    this.justOpened = true;
    this.cdr.detectChanges();
    this.scheduleOpenStateReset();
  }

  private runPostOpenLayoutSync() {
    if (!this.open) return;
    this.setupPanelObservers();
    this.measure();
    if (this.placement === 'right-drawer') this.dockToRight();
    else if (!this.userMoved && !this.dragging) this.center();
    else this.keepInside();
    if (this.autoFitContent) this.fitToContent();
  }

  private requestPostOpenLayoutSync() {
    if (!this.autoFitContent || this.placement === 'right-drawer') return;

    const preserveRevealTimer = this.awaitingLayoutReveal && this.postOpenLayoutTimer !== null;
    this.cancelPostOpenLayoutFrames();

    const run = () => this.zone.run(() => this.runPostOpenLayoutSync());

    const rafOne = window.requestAnimationFrame(() => {
      this.postOpenLayoutFrames = this.postOpenLayoutFrames.filter(id => id !== rafOne);
      run();

      const rafTwo = window.requestAnimationFrame(() => {
        this.postOpenLayoutFrames = this.postOpenLayoutFrames.filter(id => id !== rafTwo);
        run();
      });

      this.postOpenLayoutFrames.push(rafTwo);
    });

    this.postOpenLayoutFrames.push(rafOne);
    if (!preserveRevealTimer) {
      this.postOpenLayoutTimer = window.setTimeout(() => {
        this.postOpenLayoutTimer = null;
        run();
        this.zone.run(() => this.revealOpenPanel());
      }, 90);
    }
  }

  private cancelPostOpenLayoutFrames() {
    for (const frame of this.postOpenLayoutFrames) {
      window.cancelAnimationFrame(frame);
    }
    this.postOpenLayoutFrames = [];
  }

  private cancelPostOpenLayoutSync() {
    this.cancelPostOpenLayoutFrames();

    if (this.postOpenLayoutTimer !== null) {
      window.clearTimeout(this.postOpenLayoutTimer);
      this.postOpenLayoutTimer = null;
    }
  }

  private scheduleOpenStateReset() {
    this.cancelOpenStateFrame();
    this.openStateFrame = window.requestAnimationFrame(() => {
      this.openStateFrame = null;
      this.justOpened = false;
      this.cdr.detectChanges();
    });
  }

  private cancelOpenStateFrame() {
    if (this.openStateFrame !== null) {
      window.cancelAnimationFrame(this.openStateFrame);
      this.openStateFrame = null;
    }
  }

  private fitToContent() {
    if (this.placement === 'right-drawer') return;
    const panel = this.panelRef?.nativeElement;
    if (!panel) return;
    const body = panel.querySelector('.body') as HTMLElement | null;
    if (!body) return;

    const headerH = this.dragHandleRef?.nativeElement
      ? Math.round(this.dragHandleRef.nativeElement.getBoundingClientRect().height)
      : 0;
    const bodyStyles = window.getComputedStyle(body);
    const bodyPaddingTop = parseFloat(bodyStyles.paddingTop || '0') || 0;
    const bodyPaddingBottom = parseFloat(bodyStyles.paddingBottom || '0') || 0;
    const childExtent = Array.from(body.children).reduce((max, child) => {
      const el = child as HTMLElement;
      return Math.max(max, el.offsetTop + el.offsetHeight);
    }, 0);
    const bodyContentH = Math.max(
      bodyPaddingTop + bodyPaddingBottom,
      childExtent + bodyPaddingBottom
    );
    const contentH = headerH + Math.ceil(bodyContentH);
    const compactH = Math.min(contentH, this.limits.h, this.maxHeight);
    const effMinH = this.dense ? 0 : this.minHeight;
    const nextH = Math.max(effMinH, compactH);
    let finalH = Math.max(effMinH, Math.min(nextH, this.limits.h));

    // When position is locked, keep top edge fixed and grow downward only.
    if (this.lockPosition) {
      const safe = this.safe();
      const viewport = this.geometryRoot();
      const roomBelow = Math.max(
        effMinH,
        Math.floor(viewport.height - safe.bottom - this.panelSidePad - this.pos.top)
      );
      finalH = Math.min(finalH, roomBelow);
    }

    if (Math.abs(finalH - this.size.h) > 1) {
      this.size.h = finalH;

      if (this.lockPosition) {
        const bounds = this.calcBounds(this.size.w, this.size.h);
        this.pos.left = Math.min(Math.max(this.pos.left, bounds.minL), bounds.maxL);
        this.pos.top = Math.max(this.pos.top, bounds.minT);
      } else if (!this.userMoved && !this.dragging) {
        this.center();
      } else {
        this.keepInside();
      }
    }
  }

  private center() {
    const bounds = this.calcBounds();
    this.pos.left = Math.round(bounds.minL + Math.max(0, bounds.maxL - bounds.minL) / 2);
    this.pos.top = Math.round(bounds.minT + Math.max(0, bounds.maxT - bounds.minT) / 2);
    this.applyDragTransform('translate3d(0,0,0)');
  }

  private dockToRight() {
    const bounds = this.calcBounds();
    this.pos.left = bounds.maxL;
    this.pos.top = bounds.minT;
    this.applyDragTransform('translate3d(0,0,0)');
  }

  private placePanel() {
    if (this.placement === 'right-drawer') this.dockToRight();
    else this.center();
  }

  private keepInside() {
    const bounds = this.calcBounds();
    this.pos.left = Math.min(Math.max(this.pos.left, bounds.minL), bounds.maxL);
    this.pos.top = Math.min(Math.max(this.pos.top, bounds.minT), bounds.maxT);
  }

  private safe() {
    if (this.safeInsets) return this.safeInsets;

    const viewport = this.geometryRoot();
    const bounds = this.boundsElementRect();
    if (bounds) {
      const localBounds = this.toLocalRect(bounds, viewport);
      return {
        top: Math.max(0, Math.round(localBounds.top)) + this.edgeGap,
        left: Math.max(0, Math.round(localBounds.left)) + this.edgeGap,
        right: Math.max(0, Math.round(viewport.width - localBounds.right)) + this.edgeGap,
        bottom: Math.max(0, Math.round(viewport.height - localBounds.bottom)) + this.edgeGap
      };
    }

    const hdr = document.querySelector(this.headerSelector) as HTMLElement | null;
    const sidebars = Array.from(document.querySelectorAll<HTMLElement>(this.sidebarSelectors));

    const top = viewport.local
      ? this.edgeGap
      : (hdr ? Math.round(hdr.getBoundingClientRect().height) : 56) + this.edgeGap;

    let leftDockMax = 0;
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(this.safeLeftSelectors))) {
      const localRect = this.toLocalRect(el.getBoundingClientRect(), viewport);
      if (localRect.left <= 4) leftDockMax = Math.max(leftDockMax, Math.round(localRect.right));
    }

    let rightDockMax = 0;
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(this.safeRightSelectors))) {
      const localRect = this.toLocalRect(el.getBoundingClientRect(), viewport);
      if (localRect.right >= viewport.width - 4) {
        rightDockMax = Math.max(rightDockMax, Math.round(viewport.width - localRect.left));
      }
    }

    const sideW = sidebars.reduce(
      (w, s) =>
        Math.max(w, Math.round(this.toLocalRect(s.getBoundingClientRect(), viewport).width)),
      0
    );

    const sideInset = sideW > 0 ? sideW + this.edgeGap : this.edgeGap;
    const left = Math.max(this.edgeGap, sideInset, leftDockMax + this.edgeGap) + this.extraSafeLeft;
    const right = Math.max(this.edgeGap, rightDockMax + this.edgeGap) + this.extraSafeRight;

    return { top, left, right, bottom: this.edgeGap };
  }

  private boundsElementRect(): DOMRect | null {
    const el = this.boundsElement();
    if (!el) return null;

    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    return rect;
  }

  private geometryRoot(): OverlayGeometryRoot {
    if (this.geometryMode === 'viewport') {
      return {
        left: 0,
        top: 0,
        width: window.innerWidth,
        height: window.innerHeight,
        local: false
      };
    }

    const root = this.hostRef.nativeElement.closest('.shell') as HTMLElement | null;
    if (!root) {
      return {
        left: 0,
        top: 0,
        width: window.innerWidth,
        height: window.innerHeight,
        local: false
      };
    }

    const rect = root.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return {
        left: 0,
        top: 0,
        width: window.innerWidth,
        height: window.innerHeight,
        local: false
      };
    }

    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      local: true
    };
  }

  private toLocalRect(rect: DOMRect | DOMRectReadOnly, viewport = this.geometryRoot()) {
    const left = rect.left - viewport.left;
    const top = rect.top - viewport.top;

    return {
      left,
      top,
      right: left + rect.width,
      bottom: top + rect.height,
      width: rect.width,
      height: rect.height
    };
  }

  private toLocalPoint(clientX: number, clientY: number, viewport = this.geometryRoot()) {
    return {
      x: clientX - viewport.left,
      y: clientY - viewport.top
    };
  }

  private boundsElement(): HTMLElement | null {
    const selector = this.boundsSelector.trim();
    if (!selector) return null;

    return document.querySelector(selector) as HTMLElement | null;
  }

  private moveListener = (ev: PointerEvent) => {
    if (!this.dragging) return;
    ev.preventDefault();
    const viewport = this.geometryRoot();
    const bounds = this.dragBounds ?? this.calcBounds();
    const pointer = this.toLocalPoint(ev.clientX, ev.clientY, viewport);

    const nextL = pointer.x - this.dragOff.x;
    const nextT = pointer.y - this.dragOff.y;

    const clampedL = Math.max(bounds.minL, Math.min(bounds.maxL, nextL));
    const clampedT = Math.max(bounds.minT, Math.min(bounds.maxT, nextT));

    const dx = clampedL - this.startPos.left;
    const dy = clampedT - this.startPos.top;

    if (dx === this.pendingDragDelta.x && dy === this.pendingDragDelta.y) return;
    this.pendingDragDelta = { x: dx, y: dy };
    this.scheduleDragFrame();
  };

  private upListener = (ev?: PointerEvent) => {
    this.zone.run(() => {
      if (this.dragging) {
        this.flushDragFrame();
        const moved =
          Math.abs(this.dragDelta.x) > 2 ||
          Math.abs(this.dragDelta.y) > 2 ||
          Math.abs(this.pendingDragDelta.x) > 2 ||
          Math.abs(this.pendingDragDelta.y) > 2;
        this.pos.left = Math.round(this.startPos.left + this.dragDelta.x);
        this.pos.top = Math.round(this.startPos.top + this.dragDelta.y);
        this.keepInside();
        if (moved) this.userMoved = true;
      }
      this.endDrag(ev);
    });
  };

  private cancelListener = (ev?: PointerEvent) =>
    this.zone.run(() => {
      this.endDrag(ev);
    });

  onPanelPointerDown(event: PointerEvent) {
    if (this.dragAnywhere) {
      this.startDragIfAllowed(event);
    }
  }

  onHeaderPointerDown(event: PointerEvent) {
    if (this.dragAnywhere) return;
    this.startDragIfAllowed(event);
  }

  private startDragIfAllowed(event: PointerEvent) {
    if (!this.draggable || this.placement === 'right-drawer') return;
    if (this.isBlockedDragTarget(event.target)) return;
    this.startDrag(event);
  }

  startDrag(e: PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!this.draggable || this.placement === 'right-drawer') return;

    this.dragging = true;
    this.startPos = { ...this.pos };
    this.dragBounds = this.calcBounds();
    this.dragDelta = { x: 0, y: 0 };
    this.pendingDragDelta = { x: 0, y: 0 };

    const viewport = this.geometryRoot();
    const panelRect = this.toLocalRect(
      this.panelRef.nativeElement.getBoundingClientRect(),
      viewport
    );
    const pointer = this.toLocalPoint(e.clientX, e.clientY, viewport);
    this.dragOff = { x: pointer.x - panelRect.left, y: pointer.y - panelRect.top };
    this.dragPointerTarget =
      (e.currentTarget as Element | null) ??
      this.dragHandleRef?.nativeElement ??
      this.panelRef.nativeElement;
    this.dragPointerTarget.setPointerCapture?.(e.pointerId);

    this.applyDragTransform('translate3d(0,0,0)');
    this.r2.setStyle(document.body, 'user-select', 'none');
    this.r2.setStyle(document.body, 'cursor', 'grabbing');

    this.zone.runOutsideAngular(() => {
      document.addEventListener('pointermove', this.moveListener, { passive: false });
      document.addEventListener('pointerup', this.upListener, { passive: true, once: true });
      document.addEventListener('pointercancel', this.cancelListener, {
        passive: true,
        once: true
      });
    });
  }

  private endDrag(ev?: PointerEvent) {
    this.flushDragFrame();
    this.dragging = false;
    this.dragBounds = undefined;
    if (ev && this.dragPointerTarget) {
      try {
        if (this.dragPointerTarget.hasPointerCapture?.(ev.pointerId)) {
          this.dragPointerTarget.releasePointerCapture?.(ev.pointerId);
        }
      } catch {}
    }
    this.dragPointerTarget = undefined;
    document.removeEventListener('pointermove', this.moveListener as LooseValue);
    document.removeEventListener('pointerup', this.upListener as LooseValue);
    document.removeEventListener('pointercancel', this.cancelListener as LooseValue);
    this.dragDelta = { x: 0, y: 0 };
    this.pendingDragDelta = { x: 0, y: 0 };
    this.applyDragTransform('translate3d(0,0,0)');
    this.r2.removeStyle(document.body, 'user-select');
    this.r2.removeStyle(document.body, 'cursor');
  }

  onBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) this.closed.emit();
  }

  onClosePointerDown(event: PointerEvent) {
    const result = resolveOverlayCloseEvent(this.closeEventState, 'pointerdown', event.button);
    this.closeEventState = result.state;
    if (!result.emitClose) return;
    event.preventDefault();
    event.stopPropagation();
    this.closed.emit();
  }

  onCloseClick(event: MouseEvent) {
    const result = resolveOverlayCloseEvent(this.closeEventState, 'click');
    this.closeEventState = result.state;
    event.preventDefault();
    event.stopPropagation();
    if (!result.emitClose) return;
    this.closed.emit();
  }
  bringToFront() {}
  markInteracted() {}

  private isBlockedDragTarget(target: EventTarget | null) {
    const el = target instanceof Element ? target : null;
    if (el?.closest('[data-overlay-drag-handle]')) return false;
    return !!el?.closest(this.dragSkipSelector);
  }

  private applyDragTransform(transform: string) {
    if (this.dragTransform === transform) return;
    this.dragTransform = transform;
    if (this.panelRef?.nativeElement) {
      this.r2.setStyle(
        this.panelRef.nativeElement,
        'transform',
        transform,
        RendererStyleFlags2.Important
      );
    }
  }

  private scheduleDragFrame() {
    if (this.dragFrame !== null) return;
    this.dragFrame = window.requestAnimationFrame(() => {
      this.dragFrame = null;
      this.dragDelta = { ...this.pendingDragDelta };
      this.applyDragTransform(`translate3d(${this.dragDelta.x}px, ${this.dragDelta.y}px, 0)`);
    });
  }

  private flushDragFrame() {
    if (this.dragFrame !== null) {
      window.cancelAnimationFrame(this.dragFrame);
      this.dragFrame = null;
    }
    this.dragDelta = { ...this.pendingDragDelta };
    this.applyDragTransform(`translate3d(${this.dragDelta.x}px, ${this.dragDelta.y}px, 0)`);
  }

  private calcBounds(width = this.size.w, height = this.size.h) {
    const viewport = this.geometryRoot();
    const b = this.safe();
    if (this.placement === 'right-drawer') {
      const minL = Math.round(b.left);
      const minT = Math.round(b.top);
      const maxL = Math.max(minL, Math.round(viewport.width - b.right - width));
      const maxT = Math.max(minT, Math.round(viewport.height - b.bottom - height));
      return { minL, maxL, minT, maxT };
    }
    const minL = Math.round(b.left + this.panelSidePad);
    const minT = Math.round(b.top + this.panelSidePad);
    const maxL = Math.max(minL, Math.round(viewport.width - b.right - width - this.panelSidePad));
    const maxT = Math.max(
      minT,
      Math.round(viewport.height - b.bottom - height - this.panelSidePad)
    );
    if (!this.equalMovementRange) {
      return { minL, maxL, minT, maxT };
    }

    return this.balanceMovementRange({ minL, maxL, minT, maxT });
  }

  private balanceMovementRange(bounds: { minL: number; maxL: number; minT: number; maxT: number }) {
    const spanX = Math.max(0, bounds.maxL - bounds.minL);
    const spanY = Math.max(0, bounds.maxT - bounds.minT);
    const balancedSpan = Math.min(spanX, spanY);

    if (balancedSpan === spanX && balancedSpan === spanY) {
      return bounds;
    }

    const insetX = (spanX - balancedSpan) / 2;
    const insetY = (spanY - balancedSpan) / 2;

    const minL = Math.round(bounds.minL + insetX);
    const maxL = Math.round(bounds.maxL - insetX);
    const minT = Math.round(bounds.minT + insetY);
    const maxT = Math.round(bounds.maxT - insetY);

    return {
      minL: Math.min(minL, maxL),
      maxL: Math.max(minL, maxL),
      minT: Math.min(minT, maxT),
      maxT: Math.max(minT, maxT)
    };
  }
}
