import { Directive, ElementRef, Input, OnInit, HostListener } from '@angular/core';

/**
 * Accessibility Directive
 *
 * يضيف دعم Accessibility تلقائياً للعناصر
 * يحسّن Keyboard Navigation و Screen Reader Support
 *
 * @example
 * ```html
 * <button appA11y role="button" [ariaLabel]="'حفظ'">Save</button>
 * <div appA11y role="region" [ariaLabel]="'المحتوى الرئيسي'">...</div>
 * ```
 */
@Directive({
  selector: '[appA11y]',
  standalone: true
})
export class AccessibilityDirective implements OnInit {
  @Input() role?: string;
  @Input() ariaLabel?: string;
  @Input() ariaDescribedBy?: string;
  @Input() ariaLabelledBy?: string;
  @Input() tabindex?: number = 0;

  constructor(private el: ElementRef) {}

  ngOnInit(): void {
    this.applyA11yAttributes();
  }

  private applyA11yAttributes(): void {
    const element = this.el.nativeElement;

    // Set role
    if (this.role) {
      element.setAttribute('role', this.role);
    }

    // Set ARIA labels
    if (this.ariaLabel) {
      element.setAttribute('aria-label', this.ariaLabel);
    }

    if (this.ariaDescribedBy) {
      element.setAttribute('aria-describedby', this.ariaDescribedBy);
    }

    if (this.ariaLabelledBy) {
      element.setAttribute('aria-labelledby', this.ariaLabelledBy);
    }

    // Set tabindex
    if (this.tabindex !== undefined) {
      element.setAttribute('tabindex', this.tabindex.toString());
    }

    // Add focus styles
    element.style.outline = 'none';
  }

  @HostListener('focus')
  onFocus(): void {
    const element = this.el.nativeElement;
    element.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.5)';
  }

  @HostListener('blur')
  onBlur(): void {
    const element = this.el.nativeElement;
    element.style.boxShadow = 'none';
  }
}

/**
 * Skip Link Directive
 * للانتقال السريع إلى المحتوى الرئيسي
 */
@Directive({
  selector: '[appSkipLink]',
  standalone: true
})
export class SkipLinkDirective {
  @Input() appSkipLink!: string; // ID of target element

  constructor(private el: ElementRef) {}

  @HostListener('click', ['$event'])
  onClick(event: Event): void {
    event.preventDefault();
    const targetElement = document.getElementById(this.appSkipLink);

    if (targetElement) {
      targetElement.focus();
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

/**
 * Focus Trap Directive
 * لحصر التركيز داخل Modal أو Dialog
 */
@Directive({
  selector: '[appFocusTrap]',
  standalone: true
})
export class FocusTrapDirective implements OnInit {
  private focusableElements!: HTMLElement[];
  private firstFocusable!: HTMLElement;
  private lastFocusable!: HTMLElement;

  constructor(private el: ElementRef) {}

  ngOnInit(): void {
    this.updateFocusableElements();

    // Focus first element
    setTimeout(() => {
      this.firstFocusable?.focus();
    }, 100);
  }

  private updateFocusableElements(): void {
    const container = this.el.nativeElement;

    this.focusableElements = Array.from(
      container.querySelectorAll(
        'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
      )
    );

    this.firstFocusable = this.focusableElements[0];
    this.lastFocusable = this.focusableElements[this.focusableElements.length - 1];
  }

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;

    if (event.shiftKey) {
      // Shift + Tab
      if (document.activeElement === this.firstFocusable) {
        event.preventDefault();
        this.lastFocusable?.focus();
      }
    } else {
      // Tab
      if (document.activeElement === this.lastFocusable) {
        event.preventDefault();
        this.firstFocusable?.focus();
      }
    }
  }
}
