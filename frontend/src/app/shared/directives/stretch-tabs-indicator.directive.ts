import {
  AfterViewInit,
  Directive,
  ElementRef,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Renderer2,
  SimpleChanges
} from '@angular/core';

@Directive({
  selector: '[appStretchTabsIndicator]',
  standalone: true,
  host: {
    '(window:resize)': 'onWindowResize()'
  }
})
export class StretchTabsIndicatorDirective implements AfterViewInit, OnChanges, OnDestroy {
  @Input('appStretchTabsIndicator')
  activeState: unknown;

  @Input()
  stretchTabsItemSelector = '.tab-btn';

  @Input()
  stretchTabsIndicatorClass = 'stretch-tabs-indicator';

  private indicatorEl?: HTMLElement;
  private resizeObserver?: ResizeObserver;
  private animationFrameId: number | null = null;
  private stretchTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private indicatorLeft = 0;
  private indicatorWidth = 0;
  private indicatorVisible = false;

  constructor(
    private readonly hostRef: ElementRef<HTMLElement>,
    private readonly renderer: Renderer2,
    private readonly zone: NgZone
  ) {}

  ngAfterViewInit(): void {
    this.ensureIndicator();
    this.installResizeObserver();
    this.scheduleSync();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['activeState']) {
      this.scheduleSync(true);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.clearPendingAnimation();
    if (this.indicatorEl?.parentNode) {
      this.indicatorEl.parentNode.removeChild(this.indicatorEl);
    }
  }

  onWindowResize(): void {
    this.scheduleSync();
  }

  private ensureIndicator(): void {
    if (this.indicatorEl) {
      return;
    }

    const indicator = this.renderer.createElement('span') as HTMLElement;
    this.renderer.addClass(indicator, this.stretchTabsIndicatorClass);
    this.renderer.setStyle(indicator, 'left', '0px');
    this.renderer.setStyle(indicator, 'width', '0px');
    this.renderer.setStyle(indicator, 'transition', 'none');
    this.renderer.appendChild(this.hostRef.nativeElement, indicator);
    this.indicatorEl = indicator;
  }

  private installResizeObserver(): void {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => this.scheduleSync());

    this.zone.runOutsideAngular(() => {
      this.resizeObserver?.observe(this.hostRef.nativeElement);
      this.getTabItems().forEach(item => this.resizeObserver?.observe(item));
    });
  }

  private scheduleSync(animate = false): void {
    if (!this.indicatorEl) {
      return;
    }

    if (typeof requestAnimationFrame === 'undefined') {
      this.syncIndicator(animate);
      return;
    }

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    this.animationFrameId = requestAnimationFrame(() => {
      this.animationFrameId = null;
      this.syncIndicator(animate);
    });
  }

  private syncIndicator(animate = false): void {
    const activeItem = this.getActiveItem();
    if (!activeItem || !this.indicatorEl) {
      this.hideIndicator();
      return;
    }

    const { left, width } = this.measureIndicator(activeItem);
    if (this.indicatorVisible && this.indicatorLeft === left && this.indicatorWidth === width) {
      return;
    }

    if (!animate || !this.indicatorVisible || this.indicatorWidth <= 0) {
      this.applyIndicator(left, width, true, 'none');
      return;
    }

    this.animateStretch(left, width);
  }

  private getTabItems(): HTMLElement[] {
    return Array.from(
      this.hostRef.nativeElement.querySelectorAll<HTMLElement>(this.stretchTabsItemSelector)
    );
  }

  private getActiveItem(): HTMLElement | null {
    return this.hostRef.nativeElement.querySelector<HTMLElement>(
      `${this.stretchTabsItemSelector}.active`
    );
  }

  private measureIndicator(item: HTMLElement): { left: number; width: number } {
    const computedStyle = getComputedStyle(item);
    const insetStart =
      Number.parseFloat(computedStyle.paddingInlineStart || computedStyle.paddingLeft) || 0;
    const insetEnd =
      Number.parseFloat(computedStyle.paddingInlineEnd || computedStyle.paddingRight) || 0;

    return {
      left: item.offsetLeft + insetStart,
      width: Math.max(0, item.offsetWidth - insetStart - insetEnd)
    };
  }

  private animateStretch(nextLeft: number, nextWidth: number): void {
    const currentRight = this.indicatorLeft + this.indicatorWidth;
    const nextRight = nextLeft + nextWidth;
    const stretchLeft = Math.min(this.indicatorLeft, nextLeft);
    const stretchWidth = Math.max(currentRight, nextRight) - stretchLeft;

    this.clearStretchTimeout();
    this.applyIndicator(
      stretchLeft,
      stretchWidth,
      true,
      'left 220ms cubic-bezier(0.22, 0.82, 0.36, 1), width 220ms cubic-bezier(0.22, 0.82, 0.36, 1), opacity 160ms ease'
    );

    this.stretchTimeoutId = setTimeout(() => {
      this.applyIndicator(
        nextLeft,
        nextWidth,
        true,
        'left 180ms cubic-bezier(0.4, 0, 0.2, 1), width 180ms cubic-bezier(0.4, 0, 0.2, 1), opacity 160ms ease'
      );
      this.stretchTimeoutId = null;
    }, 150);
  }

  private hideIndicator(): void {
    if (!this.indicatorVisible) {
      return;
    }

    this.clearStretchTimeout();
    this.applyIndicator(0, 0, false, 'none');
  }

  private applyIndicator(left: number, width: number, visible: boolean, transition: string): void {
    if (!this.indicatorEl) {
      return;
    }

    this.indicatorLeft = left;
    this.indicatorWidth = width;
    this.indicatorVisible = visible;

    this.renderer.setStyle(this.indicatorEl, 'transition', transition);
    this.renderer.setStyle(this.indicatorEl, 'left', `${left}px`);
    this.renderer.setStyle(this.indicatorEl, 'width', `${width}px`);

    if (visible) {
      this.renderer.addClass(this.indicatorEl, 'is-visible');
    } else {
      this.renderer.removeClass(this.indicatorEl, 'is-visible');
    }
  }

  private clearPendingAnimation(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.clearStretchTimeout();
  }

  private clearStretchTimeout(): void {
    if (this.stretchTimeoutId !== null) {
      clearTimeout(this.stretchTimeoutId);
      this.stretchTimeoutId = null;
    }
  }
}
