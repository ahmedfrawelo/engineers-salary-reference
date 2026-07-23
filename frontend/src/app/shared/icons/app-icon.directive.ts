import { Directive, ElementRef, Input, inject, OnChanges } from '@angular/core';
import type { IconSvgObject } from '@hugeicons/angular';
import {
  DEFAULT_APP_ICON_TOKEN,
  normalizeAppIconToken,
  resolveAppIconToken
} from './app-icon.tokens';

const SVG_NS = 'http://www.w3.org/2000/svg';

@Directive({
  selector: '[appIcon]',
  standalone: true
})
export class AppIconDirective implements OnChanges {
  private _appIcon: string | null | undefined;
  @Input()
  set appIcon(value: string | null | undefined) {
    this._appIcon = value;
  }
  get appIcon(): string | null | undefined {
    return this._appIcon;
  }

  private _appIconFallback = DEFAULT_APP_ICON_TOKEN;
  @Input()
  set appIconFallback(value: string | undefined) {
    this._appIconFallback = value ?? DEFAULT_APP_ICON_TOKEN;
  }
  get appIconFallback(): string {
    return this._appIconFallback;
  }

  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly host = this.elementRef.nativeElement;

  ngOnChanges(): void {
    this.render();
  }

  private render(): void {
    const token =
      normalizeAppIconToken(this.appIcon) ??
      normalizeAppIconToken(this.appIconFallback) ??
      DEFAULT_APP_ICON_TOKEN;

    if (this.host.dataset['appIconToken'] === token) {
      return;
    }

    const icon = resolveAppIconToken(token, this.appIconFallback);
    this.host.classList.add('app-icon-host');
    this.host.replaceChildren(this.createSvg(icon));
    this.host.dataset['appIconToken'] = token;
  }

  private createSvg(icon: IconSvgObject): SVGSVGElement {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', 'app-icon-svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');

    for (const [tagName, rawAttributes] of icon) {
      const child = document.createElementNS(SVG_NS, tagName);
      for (const [attribute, value] of Object.entries(rawAttributes)) {
        if (attribute === 'key' || value === undefined || value === null) {
          continue;
        }
        child.setAttribute(this.toKebabCase(attribute), String(value));
      }
      svg.appendChild(child);
    }

    return svg;
  }

  private toKebabCase(value: string): string {
    return value.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`);
  }
}
