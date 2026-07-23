import { Overlay, OverlayRef, type ConnectedPosition } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import {
  Directive,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  inject
} from '@angular/core';
import type { Subscription } from 'rxjs';
import { AppTipPanelComponent } from './app-tip-panel.component';

/**
 * Shared hover/focus tip that renders in a CDK overlay (above clipping parents).
 *
 * Usage: `<span [appTip]="'Explain this badge.'">Label</span>`
 *
 * The caret tracks the trigger: when the panel is pushed to stay in-viewport,
 * the arrow still points at the hovered/focused host — not at a neighbor.
 */
@Directive({
  selector: '[appTip]',
  standalone: true
})
export class AppTipDirective implements OnDestroy {
  private readonly overlay = inject(Overlay);
  private readonly host = inject(ElementRef<HTMLElement>);

  @Input('appTip') text = '';
  /** Delay before show (ms). */
  @Input() appTipDelay = 160;

  private overlayRef: OverlayRef | null = null;
  private panel: AppTipPanelComponent | null = null;
  private panelCd: { markForCheck(): void; detectChanges(): void } | null = null;
  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private positionSub: Subscription | null = null;

  /** Prefer centered above/below; fall back to start/end so push is rarer. */
  private readonly positions: ConnectedPosition[] = [
    {
      originX: 'center',
      originY: 'top',
      overlayX: 'center',
      overlayY: 'bottom',
      offsetY: -8
    },
    {
      originX: 'center',
      originY: 'bottom',
      overlayX: 'center',
      overlayY: 'top',
      offsetY: 8
    },
    {
      originX: 'end',
      originY: 'top',
      overlayX: 'end',
      overlayY: 'bottom',
      offsetY: -8
    },
    {
      originX: 'start',
      originY: 'top',
      overlayX: 'start',
      overlayY: 'bottom',
      offsetY: -8
    },
    {
      originX: 'end',
      originY: 'bottom',
      overlayX: 'end',
      overlayY: 'top',
      offsetY: 8
    },
    {
      originX: 'start',
      originY: 'bottom',
      overlayX: 'start',
      overlayY: 'top',
      offsetY: 8
    }
  ];

  @HostListener('mouseenter')
  onMouseEnter(): void {
    this.scheduleShow();
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    this.hide();
  }

  @HostListener('focus')
  onFocus(): void {
    this.scheduleShow();
  }

  @HostListener('blur')
  onBlur(): void {
    this.hide();
  }

  ngOnDestroy(): void {
    this.hide();
  }

  private scheduleShow(): void {
    const tip = String(this.text ?? '').trim();
    if (!tip) {
      return;
    }

    this.clearShowTimer();
    this.showTimer = setTimeout(() => this.show(tip), Math.max(0, this.appTipDelay));
  }

  private show(tip: string): void {
    if (this.overlayRef?.hasAttached()) {
      if (this.panel) {
        this.panel.text = tip;
        this.panelCd?.detectChanges();
        this.queueArrowSync();
      }
      return;
    }

    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(this.host)
      .withFlexibleDimensions(false)
      .withPush(true)
      .withViewportMargin(8)
      .withPositions(this.positions);

    this.overlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      panelClass: 'app-tip-overlay-pane',
      hasBackdrop: false
    });

    const portal = new ComponentPortal(AppTipPanelComponent);
    const ref = this.overlayRef.attach(portal);
    this.panel = ref.instance;
    this.panelCd = ref.changeDetectorRef;
    this.panel.text = tip;
    this.panel.placement = 'above';
    this.panelCd.detectChanges();

    this.positionSub = positionStrategy.positionChanges.subscribe(change => {
      if (!this.panel) {
        return;
      }
      this.panel.placement =
        change.connectionPair.overlayY === 'top' ? 'below' : 'above';
      this.panelCd?.detectChanges();
      this.queueArrowSync();
    });

    this.queueArrowSync();
  }

  private queueArrowSync(): void {
    // Wait for CDK transform + panel layout, then aim the caret at the host.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.syncArrow());
    });
  }

  /**
   * Point the caret at the trigger center, even after viewport push.
   * If the caret would sit on the rounded corner (visual gap), nudge the
   * panel so the caret stays on the flat edge while still aiming at the host.
   */
  private syncArrow(): void {
    if (!this.panel || !this.overlayRef?.hasAttached()) {
      return;
    }

    const pane = this.overlayRef.overlayElement;
    // Reset prior nudge before measuring, otherwise offsets accumulate.
    pane.style.marginLeft = '';

    const originRect = this.host.nativeElement.getBoundingClientRect();
    const panelEl = pane.querySelector('.app-tip-panel') as HTMLElement | null;
    if (!panelEl) {
      return;
    }

    let panelRect = panelEl.getBoundingClientRect();
    if (panelRect.width <= 0 || panelRect.height <= 0) {
      return;
    }

    // Keep caret clear of border-radius (10) + half diamond (4).
    const edgePad = 16;
    const originCenterX = originRect.left + originRect.width / 2;
    let arrowX = originCenterX - panelRect.left;
    const safeMin = edgePad;
    const safeMax = panelRect.width - edgePad;

    if (arrowX < safeMin || arrowX > safeMax) {
      const nudgeX =
        arrowX < safeMin ? arrowX - safeMin : arrowX - safeMax;
      pane.style.marginLeft = `${Math.round(nudgeX)}px`;
      panelRect = panelEl.getBoundingClientRect();
      arrowX = originCenterX - panelRect.left;
    }

    const clamped = Math.max(
      edgePad,
      Math.min(panelRect.width - edgePad, arrowX)
    );
    this.panel.setArrowOffset(clamped);
  }

  private hide(): void {
    this.clearShowTimer();
    this.positionSub?.unsubscribe();
    this.positionSub = null;
    this.panel = null;
    this.panelCd = null;
    if (this.overlayRef) {
      this.overlayRef.dispose();
      this.overlayRef = null;
    }
  }

  private clearShowTimer(): void {
    if (this.showTimer != null) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }
  }
}
