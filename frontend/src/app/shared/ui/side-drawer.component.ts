import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild
} from '@angular/core';

type LooseValue = ReturnType<typeof JSON.parse>;
type SideDrawerPositionMode = 'absolute' | 'fixed';
type SideDrawerMotionPreset = 'default' | 'snappy' | 'instant';

@Component({
  selector: 'app-side-drawer',
  standalone: true,
  imports: [CommonModule],
  template: `
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
        role="dialog"
        [attr.aria-modal]="open ? 'true' : null"
        [attr.aria-hidden]="open ? null : 'true'"
        [ngClass]="panelClass"
        [style.width.px]="resolvedWidth"
        (click)="$event.stopPropagation()"
      >
        <ng-content></ng-content>
      </aside>
    </div>
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

      @media (prefers-reduced-motion: reduce) {
        .side-drawer-layer,
        .side-drawer-panel {
          transition-duration: 0.001ms;
        }
      }
    `
  ]
})
export class SideDrawerComponent implements OnDestroy {
  private openState = false;
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

  @Output() closed = new EventEmitter<void>();

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

  onKeyDown(event: KeyboardEvent): void {
    if (!this.open || event.key !== 'Escape') return;
    event.preventDefault();
    this.closed.emit();
  }

  onDocumentPointerDown(event: PointerEvent): void {
    if (!this.open || !this.closeOnOutsidePointerDown) return;

    const target = event.target as HTMLElement | null;
    if (!target) return;

    if (this.ignoreOutsideSelectors && target.closest(this.ignoreOutsideSelectors)) return;

    const panel = this.panelRef?.nativeElement;
    if (panel?.contains(target)) return;

    this.closed.emit();
  }

  onBackdrop(event: MouseEvent): void {
    if (!this.open || !this.closeOnBackdrop || event.target !== event.currentTarget) return;
    this.closed.emit();
  }

  ngOnDestroy(): void {
    this.detachOpenDomListeners();
  }

  private syncOpenDomListeners(): void {
    if (this.open) {
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
