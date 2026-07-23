import {
  Directive,
  Output,
  EventEmitter,
  HostListener,
  ElementRef,
  OnInit,
  OnDestroy
} from '@angular/core';

type LooseValue = ReturnType<typeof JSON.parse>;
/**
 * Swipe Direction
 */
export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

/**
 * Swipe Event Data
 */
export interface SwipeEvent {
  direction: SwipeDirection;
  distance: number;
  velocity: number;
  duration: number;
}

/**
 * Pinch Event Data
 */
export interface PinchEvent {
  scale: number;
  velocity: number;
}

/**
 * Long Press Event Data
 */
export interface LongPressEvent {
  x: number;
  y: number;
  duration: number;
}

/**
 * Swipe Gesture Directive
 *
 * Detects swipe gestures on mobile devices
 *
 * @example
 * ```html
 * <div appSwipe
 *      (swipeLeft)="onSwipeLeft()"
 *      (swipeRight)="onSwipeRight()">
 *   Swipeable content
 * </div>
 * ```
 */
@Directive({
  selector: '[appSwipe]',
  standalone: true
})
export class SwipeDirective {
  @Output() swipeLeft = new EventEmitter<SwipeEvent>();
  @Output() swipeRight = new EventEmitter<SwipeEvent>();
  @Output() swipeUp = new EventEmitter<SwipeEvent>();
  @Output() swipeDown = new EventEmitter<SwipeEvent>();
  @Output() swipe = new EventEmitter<SwipeEvent>();

  private swipeCoord?: [number, number];
  private swipeTime?: number;
  private readonly MIN_SWIPE_DISTANCE = 50;
  private readonly MAX_SWIPE_TIME = 1000;

  @HostListener('touchstart', ['$event'])
  onTouchStart(event: TouchEvent): void {
    this.swipeCoord = [event.touches[0].clientX, event.touches[0].clientY];
    this.swipeTime = Date.now();
  }

  @HostListener('touchend', ['$event'])
  onTouchEnd(event: TouchEvent): void {
    if (!this.swipeCoord || !this.swipeTime) return;

    const endCoord: [number, number] = [
      event.changedTouches[0].clientX,
      event.changedTouches[0].clientY
    ];
    const duration = Date.now() - this.swipeTime;

    if (duration > this.MAX_SWIPE_TIME) return;

    const [startX, startY] = this.swipeCoord;
    const [endX, endY] = endCoord;

    const deltaX = endX - startX;
    const deltaY = endY - startY;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const velocity = distance / duration;

    if (Math.max(absX, absY) < this.MIN_SWIPE_DISTANCE) return;

    const swipeEvent: SwipeEvent = {
      direction: this.getDirection(deltaX, deltaY, absX, absY),
      distance,
      velocity,
      duration
    };

    this.swipe.emit(swipeEvent);

    switch (swipeEvent.direction) {
      case 'left':
        this.swipeLeft.emit(swipeEvent);
        break;
      case 'right':
        this.swipeRight.emit(swipeEvent);
        break;
      case 'up':
        this.swipeUp.emit(swipeEvent);
        break;
      case 'down':
        this.swipeDown.emit(swipeEvent);
        break;
    }
  }

  private getDirection(deltaX: number, deltaY: number, absX: number, absY: number): SwipeDirection {
    if (absX > absY) {
      return deltaX < 0 ? 'left' : 'right';
    } else {
      return deltaY < 0 ? 'up' : 'down';
    }
  }
}

/**
 * Long Press Directive
 *
 * Detects long press gestures
 *
 * @example
 * ```html
 * <button appLongPress (longPress)="onLongPress($event)">
 *   Hold me
 * </button>
 * ```
 */
@Directive({
  selector: '[appLongPress]',
  standalone: true
})
export class LongPressDirective {
  @Output() longPress = new EventEmitter<LongPressEvent>();

  private timeout?: LooseValue;
  private readonly LONG_PRESS_DURATION = 500; // 500ms
  private startTime?: number;
  private coords?: [number, number];

  @HostListener('mousedown', ['$event'])
  @HostListener('touchstart', ['$event'])
  onPressStart(event: MouseEvent | TouchEvent): void {
    this.startTime = Date.now();

    if (event instanceof MouseEvent) {
      this.coords = [event.clientX, event.clientY];
    } else {
      this.coords = [event.touches[0].clientX, event.touches[0].clientY];
    }

    this.timeout = setTimeout(() => {
      if (this.coords && this.startTime) {
        this.longPress.emit({
          x: this.coords[0],
          y: this.coords[1],
          duration: Date.now() - this.startTime
        });
      }
    }, this.LONG_PRESS_DURATION);
  }

  @HostListener('mouseup')
  @HostListener('mouseleave')
  @HostListener('touchend')
  @HostListener('touchcancel')
  onPressEnd(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
  }
}

/**
 * Pinch Zoom Directive
 *
 * Detects pinch-to-zoom gestures
 *
 * @example
 * ```html
 * <div appPinchZoom (pinchIn)="onPinchIn($event)" (pinchOut)="onPinchOut($event)">
 *   Zoomable content
 * </div>
 * ```
 */
@Directive({
  selector: '[appPinchZoom]',
  standalone: true
})
export class PinchZoomDirective implements OnInit, OnDestroy {
  @Output() pinchIn = new EventEmitter<PinchEvent>();
  @Output() pinchOut = new EventEmitter<PinchEvent>();
  @Output() pinch = new EventEmitter<PinchEvent>();

  private initialDistance?: number;
  private initialTime?: number;

  constructor(private el: ElementRef) {}

  ngOnInit(): void {
    this.el.nativeElement.addEventListener('touchstart', this.onTouchStart.bind(this), {
      passive: true
    });
    this.el.nativeElement.addEventListener('touchmove', this.onTouchMove.bind(this), {
      passive: true
    });
    this.el.nativeElement.addEventListener('touchend', this.onTouchEnd.bind(this));
  }

  ngOnDestroy(): void {
    this.el.nativeElement.removeEventListener('touchstart', this.onTouchStart.bind(this));
    this.el.nativeElement.removeEventListener('touchmove', this.onTouchMove.bind(this));
    this.el.nativeElement.removeEventListener('touchend', this.onTouchEnd.bind(this));
  }

  private onTouchStart(event: TouchEvent): void {
    if (event.touches.length === 2) {
      this.initialDistance = this.getDistance(event.touches);
      this.initialTime = Date.now();
    }
  }

  private onTouchMove(event: TouchEvent): void {
    if (event.touches.length === 2 && this.initialDistance && this.initialTime) {
      const currentDistance = this.getDistance(event.touches);
      const scale = currentDistance / this.initialDistance;
      const duration = Date.now() - this.initialTime;
      const velocity = Math.abs(scale - 1) / duration;

      const pinchEvent: PinchEvent = {
        scale,
        velocity
      };

      this.pinch.emit(pinchEvent);

      if (scale < 1) {
        this.pinchIn.emit(pinchEvent);
      } else if (scale > 1) {
        this.pinchOut.emit(pinchEvent);
      }
    }
  }

  private onTouchEnd(): void {
    this.initialDistance = undefined;
    this.initialTime = undefined;
  }

  private getDistance(touches: TouchList): number {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

/**
 * Double Tap Directive
 *
 * Detects double tap gestures
 *
 * @example
 * ```html
 * <div appDoubleTap (doubleTap)="onDoubleTap()">
 *   Double tap me
 * </div>
 * ```
 */
@Directive({
  selector: '[appDoubleTap]',
  standalone: true
})
export class DoubleTapDirective {
  @Output() doubleTap = new EventEmitter<void>();

  private lastTapTime = 0;
  private readonly DOUBLE_TAP_DELAY = 300; // 300ms

  @HostListener('touchend', ['$event'])
  onTouchEnd(event: TouchEvent): void {
    const currentTime = Date.now();
    const tapGap = currentTime - this.lastTapTime;

    if (tapGap < this.DOUBLE_TAP_DELAY && tapGap > 0) {
      this.doubleTap.emit();
      event.preventDefault();
    }

    this.lastTapTime = currentTime;
  }
}

/**
 * Pan Directive
 *
 * Detects pan/drag gestures
 *
 * @example
 * ```html
 * <div appPan (pan)="onPan($event)">
 *   Pannable content
 * </div>
 * ```
 */
@Directive({
  selector: '[appPan]',
  standalone: true
})
export class PanDirective {
  @Output() pan = new EventEmitter<{ deltaX: number; deltaY: number }>();
  @Output() panStart = new EventEmitter<void>();
  @Output() panEnd = new EventEmitter<void>();

  private startCoords?: [number, number];
  private isPanning = false;

  @HostListener('touchstart', ['$event'])
  @HostListener('mousedown', ['$event'])
  onPanStart(event: TouchEvent | MouseEvent): void {
    if (event instanceof TouchEvent) {
      this.startCoords = [event.touches[0].clientX, event.touches[0].clientY];
    } else {
      this.startCoords = [event.clientX, event.clientY];
    }
    this.isPanning = true;
    this.panStart.emit();
  }

  @HostListener('touchmove', ['$event'])
  @HostListener('mousemove', ['$event'])
  onPanMove(event: TouchEvent | MouseEvent): void {
    if (!this.isPanning || !this.startCoords) return;

    let currentX: number, currentY: number;

    if (event instanceof TouchEvent) {
      currentX = event.touches[0].clientX;
      currentY = event.touches[0].clientY;
    } else {
      currentX = event.clientX;
      currentY = event.clientY;
    }

    const deltaX = currentX - this.startCoords[0];
    const deltaY = currentY - this.startCoords[1];

    this.pan.emit({ deltaX, deltaY });
  }

  @HostListener('touchend')
  @HostListener('mouseup')
  onPanEnd(): void {
    if (this.isPanning) {
      this.isPanning = false;
      this.startCoords = undefined;
      this.panEnd.emit();
    }
  }
}
