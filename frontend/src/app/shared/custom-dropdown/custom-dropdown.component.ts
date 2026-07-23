import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  OnDestroy,
  ViewChild,
  signal,
  ChangeDetectionStrategy
} from '@angular/core';
import { animate, style, transition, trigger } from '@angular/animations';
import {
  OverlayModule,
  ConnectedPosition,
  ConnectedOverlayPositionChange,
  CdkOverlayOrigin
} from '@angular/cdk/overlay';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { ArrowDown01Icon, CheckmarkSquare02Icon } from '@shared/icons/app-icon.registry';

export interface DropdownOption {
  value: string;
  text: string;
}

@Component({
  selector: 'app-custom-dropdown',
  standalone: true,
  imports: [OverlayModule, HugeiconsIconComponent],
  template: `
    <div class="custom-dropdown" [class.open]="isOpen()" [class.disabled]="disabled">
      <button
        #triggerOrigin="cdkOverlayOrigin"
        cdkOverlayOrigin
        type="button"
        class="dropdown-trigger"
        (pointerdown)="onTriggerPointerDown($event)"
        (click)="onTriggerClick($event)"
        [disabled]="disabled"
        [attr.aria-expanded]="isOpen()"
      >
        <span class="selected-text">{{ getSelectedText() }}</span>
        <hugeicons-icon
          class="dropdown-arrow"
          [icon]="dropdownArrowIcon"
          [size]="16"
          [strokeWidth]="2.2"
          aria-hidden="true"
        ></hugeicons-icon>
      </button>

      <ng-template
        cdkConnectedOverlay
        [cdkConnectedOverlayOrigin]="triggerOrigin"
        [cdkConnectedOverlayOpen]="isOpen()"
        [cdkConnectedOverlayPositions]="positions"
        [cdkConnectedOverlayHasBackdrop]="false"
        [cdkConnectedOverlayWidth]="overlayWidth()"
        [cdkConnectedOverlayMinWidth]="overlayWidth()"
        cdkConnectedOverlayPanelClass="custom-dropdown-overlay"
        (detach)="closeDropdown()"
        (positionChange)="onPositionChange($event)"
      >
        <div class="dropdown-menu" @slideDown [class.drop-up]="dropUp()">
          @for (option of options; track option; let i = $index) {
            <div
              class="dropdown-option"
              [class.selected]="option.value === selectedValue()"
              (pointerdown)="selectOption(option, $event)"
              (click)="selectOption(option, $event)"
              [style.animation-delay]="i * 0.03 + 's'"
            >
              <span class="option-text">{{ option.text }}</span>
              @if (option.value === selectedValue()) {
                <hugeicons-icon
                  class="check-icon"
                  [icon]="selectedCheckIcon"
                  [size]="16"
                  [strokeWidth]="2.1"
                  aria-hidden="true"
                ></hugeicons-icon>
              }
            </div>
          }
        </div>
      </ng-template>
    </div>
  `,
  styles: [
    `
      .custom-dropdown {
        position: relative;
        min-width: 0;
        z-index: 8000;
        pointer-events: auto;
      }
      .custom-dropdown.disabled .dropdown-trigger,
      .dropdown-trigger:disabled {
        opacity: 0.55;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
      }

      .dropdown-trigger {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: var(--dropdown-height, auto);
        min-height: var(--dropdown-height, auto);
        padding: var(--dropdown-padding-y, 11px) var(--dropdown-padding-x, 14px);
        border: 1px solid rgb(var(--border));
        border-radius: var(--dropdown-radius, 10px);
        background: rgb(var(--bg1));
        color: rgb(var(--fg));
        font-size: var(--dropdown-font-size, 14px);
        font-weight: 500;
        cursor: pointer;
        pointer-events: auto;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        gap: 8px;
      }

      .dropdown-trigger:hover {
        border-color: rgb(var(--primary));
        box-shadow: 0 0 0 3px rgba(var(--primary), 0.1);
        transform: translateY(-1px);
      }

      .dropdown-trigger:focus {
        outline: none;
        border-color: rgb(var(--primary));
        box-shadow: 0 0 0 3px rgba(var(--primary), 0.15);
      }

      .custom-dropdown.open .dropdown-trigger {
        border-color: rgb(var(--primary));
        box-shadow: 0 0 0 4px rgba(var(--primary), 0.12);
        transform: translateY(0);
      }

      .selected-text {
        flex: 1;
        text-align: left;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .dropdown-arrow {
        flex-shrink: 0;
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        color: rgb(var(--muted));
      }

      .custom-dropdown.open .dropdown-arrow {
        transform: rotate(180deg);
        color: rgb(var(--primary));
      }

      .dropdown-menu {
        position: relative;
        top: 0;
        left: 0;
        width: 100%;
        box-sizing: border-box;
        background: rgb(var(--surface));
        border: 1px solid rgb(var(--primary));
        border-radius: 8px;
        box-shadow:
          0 10px 20px rgba(0, 0, 0, 0.18),
          0 4px 10px rgba(0, 0, 0, 0.08);
        max-height: none;
        overflow-y: visible;
        z-index: 1000;
        animation: slideDown 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        padding: 4px;
        pointer-events: auto !important; /* ✅ Ensure clicks work */
      }

      @keyframes slideDown {
        from {
          opacity: 0;
          transform: translateY(-12px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      .dropdown-option {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 10px;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        animation: fadeIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
        gap: 10px;
        font-size: 14px;
        pointer-events: auto !important; /* ✅ Ensure clicks work */
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateX(-8px) scale(0.96);
        }
        to {
          opacity: 1;
          transform: translateX(0) scale(1);
        }
      }

      .dropdown-option:hover {
        background: rgba(var(--primary), 0.1);
        color: rgb(var(--primary));
        transform: translateX(6px) scale(1.02);
        box-shadow: 0 2px 8px rgba(var(--primary), 0.15);
      }

      .dropdown-option.selected {
        background: rgba(var(--primary), 0.14);
        color: rgb(var(--primary));
        font-weight: 600;
        box-shadow: 0 1px 4px rgba(var(--primary), 0.2);
      }

      .dropdown-option.selected:hover {
        background: rgba(var(--primary), 0.18);
        transform: translateX(6px) scale(1.02);
        box-shadow: 0 2px 8px rgba(var(--primary), 0.25);
      }

      .option-text {
        flex: 1;
        text-align: left;
      }

      .check-icon {
        flex-shrink: 0;
        color: rgb(var(--primary));
        animation: checkPop 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
      }

      @keyframes checkPop {
        0% {
          transform: scale(0);
          opacity: 0;
        }
        50% {
          transform: scale(1.2);
        }
        100% {
          transform: scale(1);
          opacity: 1;
        }
      }

      /* Custom Scrollbar */
      .dropdown-menu::-webkit-scrollbar {
        width: 6px;
      }

      .dropdown-menu::-webkit-scrollbar-track {
        background: transparent;
      }

      .dropdown-menu::-webkit-scrollbar-thumb {
        background: rgba(var(--primary), 0.3);
        border-radius: 3px;
      }

      .dropdown-menu::-webkit-scrollbar-thumb:hover {
        background: rgba(var(--primary), 0.5);
      }

      .dropdown-menu.drop-up {
        transform-origin: bottom center;
      }

      :host ::ng-deep .custom-dropdown-overlay {
        z-index: 200001 !important;
        pointer-events: auto !important;
      }
    `
  ],
  animations: [
    trigger('slideDown', [
      transition(':enter', [
        style({
          opacity: 0,
          transform: 'translateY(-10px) scale(0.96)',
          transformOrigin: 'top center'
        }),
        animate(
          '180ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          style({ opacity: 1, transform: 'translateY(0) scale(1)' })
        )
      ]),
      transition(':leave', [
        animate(
          '120ms cubic-bezier(0.4, 0, 0.2, 1)',
          style({ opacity: 0, transform: 'translateY(-6px) scale(0.98)' })
        )
      ])
    ])
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomDropdownComponent implements OnDestroy {
  readonly dropdownArrowIcon = ArrowDown01Icon;
  readonly selectedCheckIcon = CheckmarkSquare02Icon;
  private static openDropdown: CustomDropdownComponent | null = null;
  private triggerPointerDown = false;
  @Input() options: DropdownOption[] = [];
  @Input() placeholder: string = 'Select...';
  private isDisabled = false;
  @Input() set value(val: string) {
    this.selectedValue.set(val);
  }
  @Input() set disabled(val: boolean) {
    this.isDisabled = !!val;
    if (this.isDisabled && this.isOpen()) {
      this.closeDropdown();
    }
  }
  get disabled(): boolean {
    return this.isDisabled;
  }

  @Output() valueChange = new EventEmitter<string>();

  selectedValue = signal<string>('');
  isOpen = signal<boolean>(false);
  dropUp = signal<boolean>(false);
  overlayWidth = signal<number>(60);
  @ViewChild('triggerOrigin', { read: CdkOverlayOrigin }) triggerOrigin?: CdkOverlayOrigin;
  private suppressNextClick = false;
  private openDomListenersAttached = false;
  private readonly documentClickHandler = (event: Event) => this.onGlobalClick(event);
  private readonly documentEscapeHandler = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      this.closeDropdown();
    }
  };

  readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 }
  ];

  toggleDropdown(event?: Event) {
    if (this.disabled) {
      return;
    }
    event?.stopPropagation();
    if (!this.isOpen()) {
      if (CustomDropdownComponent.openDropdown && CustomDropdownComponent.openDropdown !== this) {
        CustomDropdownComponent.openDropdown.closeDropdown();
      }
      CustomDropdownComponent.openDropdown = this;
      this.refreshOverlayWidth();
      this.isOpen.set(true);
      this.attachOpenDomListeners();
      return;
    }
    this.closeDropdown();
  }

  onTriggerPointerDown(event: PointerEvent) {
    if (this.disabled) {
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    this.triggerPointerDown = true;
    this.toggleDropdown();
  }

  onTriggerClick(event: Event) {
    if (this.disabled) {
      return;
    }
    event.stopPropagation();
    if (this.triggerPointerDown) {
      this.triggerPointerDown = false;
      return;
    }
    this.toggleDropdown();
  }

  selectOption(option: DropdownOption, event?: Event) {
    if (this.disabled) {
      return;
    }
    if (event) {
      event.stopPropagation();
      if (event.type === 'pointerdown') {
        event.preventDefault();
        this.suppressNextClick = true;
      } else if (event.type === 'click' && this.suppressNextClick) {
        this.suppressNextClick = false;
        return;
      } else {
        this.suppressNextClick = false;
      }
    }

    this.selectedValue.set(option.value);
    this.valueChange.emit(option.value);
    this.closeDropdown();
  }

  getSelectedText(): string {
    const selected = this.options.find(opt => opt.value === this.selectedValue());
    return selected ? selected.text : this.placeholder;
  }

  // ✅ Only listen to click (not pointerdown) to avoid race conditions
  onGlobalClick(event: Event) {
    const target = event.target as HTMLElement | null;
    if (!this.isOpen()) return;
    if (!target) return;

    // ✅ IMPORTANT: If clicking on a dropdown option, let selectOption handle it - don't interfere!
    if (target.closest('.dropdown-option')) {
      return; // Let the option's click handler do its job
    }

    // ✅ Check if click is inside any dropdown elements
    const insideHost = this.el.nativeElement.contains(target);
    const insideOverlay = !!target.closest('.custom-dropdown-overlay');
    const insideDropdownMenu = !!target.closest('.dropdown-menu');

    // Only close if click is truly outside all dropdown elements
    if (!insideHost && !insideOverlay && !insideDropdownMenu) {
      this.closeDropdown();
    }
  }

  closeDropdown() {
    if (this.isOpen()) {
      this.isOpen.set(false);
      this.detachOpenDomListeners();
    }
    if (CustomDropdownComponent.openDropdown === this) {
      CustomDropdownComponent.openDropdown = null;
    }
  }

  onPositionChange(ev: ConnectedOverlayPositionChange) {
    this.dropUp.set(ev.connectionPair.overlayY === 'bottom');
  }

  constructor(private el: ElementRef<HTMLElement>) {}

  ngOnDestroy(): void {
    if (CustomDropdownComponent.openDropdown === this) {
      CustomDropdownComponent.openDropdown = null;
    }
    this.detachOpenDomListeners();
  }

  private attachOpenDomListeners(): void {
    if (this.openDomListenersAttached || typeof document === 'undefined') return;
    this.openDomListenersAttached = true;
    document.addEventListener('click', this.documentClickHandler);
    document.addEventListener('keydown', this.documentEscapeHandler);
  }

  private detachOpenDomListeners(): void {
    if (!this.openDomListenersAttached || typeof document === 'undefined') return;
    this.openDomListenersAttached = false;
    document.removeEventListener('click', this.documentClickHandler);
    document.removeEventListener('keydown', this.documentEscapeHandler);
  }

  private refreshOverlayWidth(): void {
    const width = this.triggerOrigin?.elementRef.nativeElement.offsetWidth || 60;
    this.overlayWidth.set(width);
  }
}
