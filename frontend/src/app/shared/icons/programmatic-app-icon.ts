import type { IconSvgObject } from '@hugeicons/angular';
import {
  DEFAULT_APP_ICON_TOKEN,
  normalizeAppIconToken,
  resolveAppIconToken
} from './app-icon.tokens';

const SVG_NS = 'http://www.w3.org/2000/svg';

function resolveProgrammaticToken(value: string | null | undefined): string {
  return normalizeAppIconToken(value) ?? DEFAULT_APP_ICON_TOKEN;
}

function toKebabCase(value: string): string {
  return value.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`);
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function serializeSvg(icon: IconSvgObject): string {
  const body = icon
    .map(([tagName, rawAttributes]) => {
      const attributes = Object.entries(rawAttributes)
        .filter(
          ([attribute, value]) => attribute !== 'key' && value !== undefined && value !== null
        )
        .map(([attribute, value]) => `${toKebabCase(attribute)}="${escapeHtmlAttr(String(value))}"`)
        .join(' ');
      return `<${tagName}${attributes ? ` ${attributes}` : ''}></${tagName}>`;
    })
    .join('');

  return `<svg viewBox="0 0 24 24" fill="none" focusable="false" aria-hidden="true" class="app-icon-svg" width="100%" height="100%">${body}</svg>`;
}

function createSvg(icon: IconSvgObject, ownerDocument: Document): SVGSVGElement {
  const svg = ownerDocument.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'app-icon-svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');

  for (const [tagName, rawAttributes] of icon) {
    const child = ownerDocument.createElementNS(SVG_NS, tagName);
    for (const [attribute, value] of Object.entries(rawAttributes)) {
      if (attribute === 'key' || value === undefined || value === null) {
        continue;
      }
      child.setAttribute(toKebabCase(attribute), String(value));
    }
    svg.appendChild(child);
  }

  return svg;
}

export function createAppIconElement(
  value: string | null | undefined,
  ownerDocument: Document = document
): HTMLElement {
  const token = resolveProgrammaticToken(value);
  const host = ownerDocument.createElement('i');
  host.className = 'app-icon-host';
  host.dataset['appIconToken'] = token;
  host.setAttribute('aria-hidden', 'true');
  host.appendChild(createSvg(resolveAppIconToken(token), ownerDocument));
  return host;
}

export function renderAppIconHtml(
  value: string | null | undefined,
  options: { className?: string; style?: string; ariaHidden?: boolean } = {}
): string {
  const token = resolveProgrammaticToken(value);
  const classes = ['app-icon-host', options.className?.trim()].filter(Boolean).join(' ');
  const attrs = [`class="${escapeHtmlAttr(classes)}"`, `data-app-icon-token="${token}"`];

  if (options.ariaHidden ?? true) {
    attrs.push('aria-hidden="true"');
  }
  if (options.style?.trim()) {
    attrs.push(`style="${escapeHtmlAttr(options.style.trim())}"`);
  }

  return `<i ${attrs.join(' ')}>${serializeSvg(resolveAppIconToken(token))}</i>`;
}
