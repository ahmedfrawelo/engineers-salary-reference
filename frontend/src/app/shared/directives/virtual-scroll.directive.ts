import { Directive, Input, OnInit, OnDestroy, ElementRef, Renderer2 } from '@angular/core';
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';

/**
 * Virtual Scroll Helper Directive
 *
 * Provides utilities for virtual scrolling optimization
 *
 * @example
 * ```html
 * <cdk-virtual-scroll-viewport itemSize="50" class="viewport" appVirtualScroll>
 *   <div *cdkVirtualFor="let item of items; trackBy: trackById">
 *     {{ item.name }}
 *   </div>
 * </cdk-virtual-scroll-viewport>
 * ```
 */
@Directive({
  selector: '[appVirtualScroll]',
  standalone: true
})
export class VirtualScrollDirective implements OnInit, OnDestroy {
  @Input() itemSize = 50;
  @Input() bufferSize = 10;

  constructor(
    private el: ElementRef,
    private renderer: Renderer2
  ) {}

  ngOnInit(): void {
    // Add custom styling for virtual scroll
    this.renderer.setStyle(this.el.nativeElement, 'height', '100%');
    this.renderer.setStyle(this.el.nativeElement, 'overflow-y', 'auto');
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }
}

/**
 * Virtual Scroll Configuration Helper
 *
 * Provides recommended configurations for different data sizes
 */
export class VirtualScrollConfig {
  /**
   * Get optimal item size based on content type
   */
  static getItemSize(contentType: 'compact' | 'normal' | 'expanded'): number {
    switch (contentType) {
      case 'compact':
        return 32;
      case 'normal':
        return 50;
      case 'expanded':
        return 80;
      default:
        return 50;
    }
  }

  /**
   * Get optimal buffer size based on data size
   */
  static getBufferSize(dataSize: number): number {
    if (dataSize < 100) return 5;
    if (dataSize < 1000) return 10;
    return 20;
  }

  /**
   * Calculate viewport height based on visible items
   */
  static getViewportHeight(itemSize: number, visibleItems: number): string {
    return `${itemSize * visibleItems}px`;
  }
}

/**
 * Virtual Scroll Performance Tracker
 *
 * Tracks scroll performance metrics
 */
export class VirtualScrollPerformance {
  private frameCount = 0;
  private lastTime = performance.now();

  /**
   * Measure scroll FPS
   */
  measureFPS(): number {
    this.frameCount++;
    const currentTime = performance.now();
    const elapsed = currentTime - this.lastTime;

    if (elapsed >= 1000) {
      const fps = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.lastTime = currentTime;
      return fps;
    }

    return 0;
  }

  /**
   * Check if scroll is smooth (>= 30 FPS)
   */
  isSmoothScrolling(): boolean {
    const fps = this.measureFPS();
    return fps >= 30;
  }
}
