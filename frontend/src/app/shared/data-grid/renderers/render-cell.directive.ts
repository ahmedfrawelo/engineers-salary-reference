import {
  Directive,
  ElementRef,
  Input,
  inject,
  OnChanges,
  SecurityContext,
  SimpleChanges
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Directive to render cell content, supporting both string/SafeHtml and HTMLElement
 *
 * When cellRenderer returns HTMLElement, we append it directly to preserve event listeners.
 * When it returns string/SafeHtml, we use innerHTML as before.
 */
@Directive({
  selector: '[renderCell]',
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone: false
})
export class RenderCellDirective implements OnChanges {
  private _renderCell: string | SafeHtml | HTMLElement | null | undefined;
  private renderedElement: HTMLElement | null = null;
  private renderedHtml = '';
  private renderedEmpty = true;
  @Input()
  set renderCell(value: string | SafeHtml | HTMLElement | null | undefined) {
    this._renderCell = value;
  }
  get renderCell(): string | SafeHtml | HTMLElement | null | undefined {
    return this._renderCell;
  }

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly sanitizer = inject(DomSanitizer);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['renderCell']) {
      this.updateContent();
    }
  }

  private updateContent(): void {
    const host = this.el.nativeElement;
    const value = this.renderCell;

    if (!value) {
      if (!this.renderedEmpty || host.childNodes.length > 0) {
        host.textContent = '';
      }
      this.renderedElement = null;
      this.renderedHtml = '';
      this.renderedEmpty = true;
      return;
    }

    if (value instanceof HTMLElement) {
      if (
        this.renderedElement === value &&
        value.parentElement === host &&
        host.childNodes.length === 1
      ) {
        return;
      }

      host.textContent = '';
      host.appendChild(value);
      this.renderedElement = value;
      this.renderedHtml = '';
      this.renderedEmpty = false;
      return;
    }

    const sanitized = this.sanitizer.sanitize(SecurityContext.HTML, value) || '';
    if (this.renderedElement === null && this.renderedHtml === sanitized && !this.renderedEmpty) {
      return;
    }

    host.innerHTML = sanitized;
    this.renderedElement = null;
    this.renderedHtml = sanitized;
    this.renderedEmpty = false;
  }
}
