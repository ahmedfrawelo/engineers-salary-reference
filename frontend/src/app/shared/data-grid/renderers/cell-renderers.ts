type LooseValue = ReturnType<typeof JSON.parse>;
/**
 * Cell Renderers - محولات عرض الخلايا
 * Ready-to-use cell renderers for common data types
 */

import { GridColumn } from '../models';

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, char => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function escapeAttribute(value: unknown): string {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function sanitizeCssClass(value: unknown, fallback = ''): string {
  const safe = String(value ?? '')
    .split(/\s+/)
    .filter(token => /^[a-zA-Z0-9_-]+$/.test(token))
    .join(' ')
    .trim();
  return safe || fallback;
}

function sanitizeUrl(value: unknown, fallback = '#'): string {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return fallback;
  }

  const protocol = raw.replace(/[\u0000-\u001F\s]+/g, '').toLowerCase();
  if (
    protocol.startsWith('javascript:') ||
    protocol.startsWith('vbscript:') ||
    (protocol.startsWith('data:') && !protocol.startsWith('data:image/'))
  ) {
    return fallback;
  }

  return escapeAttribute(raw);
}

// ===== Date Renderer =====

export function dateRenderer(
  format: 'short' | 'medium' | 'long' = 'medium'
): (value: unknown) => string {
  return (value: unknown) => {
    if (value === null || value === undefined) return '';

    const date = value instanceof Date ? value : new Date(value as string | number);
    if (isNaN(date.getTime())) return String(value);

    let options: Intl.DateTimeFormatOptions;

    if (format === 'short') {
      options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    } else if (format === 'medium') {
      options = { year: 'numeric', month: 'short', day: 'numeric' };
    } else {
      options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    }

    return new Intl.DateTimeFormat('en-US', options).format(date);
  };
}

// ===== Number Renderer =====

export function numberRenderer(decimals = 2, prefix = '', suffix = ''): (value: unknown) => string {
  return (value: unknown) => {
    if (value === null || value === undefined || isNaN(Number(value))) return '';

    const formatted = Number(value).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });

    return `${prefix}${formatted}${suffix}`;
  };
}

// ===== Currency Renderer =====

export function currencyRenderer(currency = 'SAR', decimals = 2): (value: unknown) => string {
  return (value: unknown) => {
    if (value === null || value === undefined || isNaN(Number(value))) return '';

    return Number(value).toLocaleString('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };
}

// ===== Percentage Renderer =====

export function percentageRenderer(decimals = 1): (value: unknown) => string {
  return (value: unknown) => {
    if (value === null || value === undefined || isNaN(Number(value))) return '';

    const formatted = Number(value).toFixed(decimals);
    return `${formatted}%`;
  };
}

// ===== Boolean Renderer =====

export function booleanRenderer(
  trueLabel = 'Yes',
  falseLabel = 'No',
  showIcon = true
): (value: unknown) => string {
  return (value: unknown) => {
    const isTrue = value === true || value === 'true' || value === 1;
    const icon = showIcon ? (isTrue ? '&check;' : '&times;') : '';
    const label = escapeHtml(isTrue ? trueLabel : falseLabel);
    const colorClass = isTrue ? 'text-success' : 'text-danger';

    return `<span class="${colorClass}">${icon} ${label}</span>`;
  };
}
// ===== Status Badge Renderer =====

export interface StatusConfig {
  [key: string]: {
    label: string;
    class: string;
  };
}

export function statusBadgeRenderer(
  statusConfig: StatusConfig
): (value: string | number) => string {
  return (value: string | number) => {
    const config = statusConfig[value] || { label: String(value), class: 'status-default' };
    const className = sanitizeCssClass(config.class, 'status-default');
    return `<span class="status-badge ${className}">${escapeHtml(config.label)}</span>`;
  };
}

// Default status badge configuration
export const DEFAULT_STATUS_BADGE_CONFIG: StatusConfig = {
  active: { label: 'Active', class: 'status-active' },
  inactive: { label: 'Inactive', class: 'status-inactive' },
  pending: { label: 'Pending', class: 'status-pending' },
  completed: { label: 'Completed', class: 'status-completed' },
  cancelled: { label: 'Cancelled', class: 'status-cancelled' }
};

// ===== Link Renderer =====

export function linkRenderer(
  urlField?: string,
  target = '_blank'
): (value: unknown, row: Record<string, unknown>) => string {
  return (value: unknown, row: Record<string, unknown>) => {
    if (!value) return '';

    const url = urlField ? row[urlField] : `#${value}`;
    const safeUrl = sanitizeUrl(url);
    const safeTarget = sanitizeCssClass(target, '_blank');

    return `<a href="${safeUrl}" target="${safeTarget}" rel="noopener noreferrer" class="cell-link" onclick="event.stopPropagation()">${escapeHtml(value)}</a>`;
  };
}

// ===== Image Renderer =====

export function imageRenderer(width = 40, height = 40, alt = 'صورة'): (value: unknown) => string {
  return (value: unknown) => {
    if (!value) return '';

    const safeUrl = sanitizeUrl(value, '');
    return `<img src="${safeUrl}" alt="${escapeAttribute(alt)}" width="${width}" height="${height}" style="object-fit: cover; border-radius: 4px;" />`;
  };
}

// ===== Avatar Renderer =====

export function avatarRenderer(
  nameField?: string
): (value: unknown, row: Record<string, unknown>) => string {
  return (value: unknown, row: Record<string, unknown>) => {
    const name = nameField ? (row[nameField] as string) : '';
    const initials = name
      ? name
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
      : '؟';

    if (value) {
      const safeUrl = sanitizeUrl(value, '');
      return `<img src="${safeUrl}" alt="${escapeAttribute(name)}" class="avatar" />`;
    } else {
      return `<div class="avatar avatar-text">${escapeHtml(initials)}</div>`;
    }
  };
}

// ===== Tag List Renderer =====

export function tagListRenderer(separator = ', ', maxTags = 3): (value: unknown) => string {
  return (value: unknown) => {
    if (!value) return '';

    const tags = Array.isArray(value) ? value : String(value).split(separator);
    const displayTags = tags.slice(0, maxTags);
    const remainingCount = tags.length - maxTags;

    const tagsHtml = displayTags
      .map(tag => `<span class="tag">${escapeHtml(tag)}</span>`)
      .join(' ');

    const moreHtml =
      remainingCount > 0 ? `<span class="tag tag-more">+${remainingCount}</span>` : '';

    return `<div class="tag-list">${tagsHtml}${moreHtml}</div>`;
  };
}

// ===== Progress Bar Renderer =====

export function progressBarRenderer(showLabel = true): (value: unknown) => string {
  return (value: unknown) => {
    if (value === null || value === undefined || isNaN(Number(value))) return '';

    const percentage = Math.max(0, Math.min(100, Number(value)));
    const colorClass =
      percentage >= 75
        ? 'progress-success'
        : percentage >= 50
          ? 'progress-info'
          : percentage >= 25
            ? 'progress-warning'
            : 'progress-danger';

    const label = showLabel ? `<span class="progress-label">${percentage.toFixed(0)}%</span>` : '';

    return `
      <div class="progress-container">
        <div class="progress-bar ${colorClass}" style="width: ${percentage}%"></div>
        ${label}
      </div>
    `;
  };
}

// ===== Rating Renderer =====

export function ratingRenderer(max = 5, icon = '⭐'): (value: unknown) => string {
  return (value: unknown) => {
    if (value === null || value === undefined) return '';

    const rating = Math.max(0, Math.min(max, Number(value)));
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = max - fullStars - (hasHalfStar ? 1 : 0);
    const fullStarHtml = `<span class="star star-full">${escapeHtml(icon)}</span>`.repeat(
      fullStars
    );
    const emptyStarHtml = '<span class="star star-empty">☆</span>'.repeat(emptyStars);

    return `
      <div class="rating">
        ${fullStarHtml}
        ${hasHalfStar ? '<span class="star star-half">⭐</span>' : ''}
        ${emptyStarHtml}
        <span class="rating-value">(${rating.toFixed(1)})</span>
      </div>
    `;
  };
}

// ===== File Size Renderer =====

export function fileSizeRenderer(): (value: unknown) => string {
  return (value: unknown) => {
    if (value === null || value === undefined || isNaN(Number(value))) return '';

    const bytes = Number(value);
    const units = ['بايت', 'كيلوبايت', 'ميجيابايت', 'جيجابايت', 'تيرابايت'];
    let unitIndex = 0;
    let size = bytes;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  };
}

// ===== Highlight Renderer =====

export function highlightRenderer(
  searchTerm: string,
  caseSensitive = false
): (value: unknown) => string {
  return (value: unknown) => {
    if (!value || !searchTerm) return String(value || '');

    const valueStr = String(value);
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, flags);

    return escapeHtml(valueStr).replace(regex, '<mark>$1</mark>');
  };
}

// ===== Truncate Renderer =====

export function truncateRenderer(maxLength = 50, suffix = '...'): (value: unknown) => string {
  return (value: unknown) => {
    if (!value) return '';

    const valueStr = String(value);
    if (valueStr.length <= maxLength) return escapeHtml(valueStr);

    return `<span>${escapeHtml(valueStr.substring(0, maxLength))}${escapeHtml(suffix)}</span>`;
  };
}

// ===== Enum Renderer =====

export function enumRenderer(enumMap: {
  [key: string]: string;
}): (value: string | number) => string {
  return (value: string | number) => {
    return escapeHtml(enumMap[value] || String(value) || '');
  };
}

// ===== Multi-line Text Renderer =====

export function multilineRenderer(maxLines = 3): (value: unknown) => string {
  return (value: unknown) => {
    if (!value) return '';

    const lines = String(value).split('\n').slice(0, maxLines).map(escapeHtml);
    return `<div class="multiline-text">${lines.join('<br />')}</div>`;
  };
}

// ===== Action Buttons Renderer =====

export interface ActionButton {
  icon: string;
  label: string;
  class?: string;
  onClick: (row: Record<string, unknown>) => void;
}

export function actionButtonsRenderer(
  buttons: ActionButton[]
): (_value: unknown, row: Record<string, unknown>, _column: GridColumn) => HTMLElement {
  return (_value: unknown, row: Record<string, unknown>, _column: GridColumn) => {
    const container = document.createElement('div');
    container.className = 'action-buttons';

    buttons.forEach(btn => {
      const button = document.createElement('button');
      button.className = `btn btn-sm ${sanitizeCssClass(btn.class, 'btn-secondary')}`;
      const icon = document.createElement('span');
      icon.className = 'icon';
      icon.textContent = btn.icon;
      button.appendChild(icon);
      button.appendChild(document.createTextNode(` ${btn.label}`));
      button.onclick = e => {
        e.stopPropagation();
        btn.onClick(row);
      };
      container.appendChild(button);
    });

    return container;
  };
}

// ===== Conditional Renderer =====

export function conditionalRenderer(
  condition: (value: unknown, row: Record<string, unknown>) => boolean,
  trueRenderer: (value: unknown, row: Record<string, unknown>) => string,
  falseRenderer: (value: unknown, row: Record<string, unknown>) => string
): (value: unknown, row: Record<string, unknown>) => string {
  return (value: unknown, row: Record<string, unknown>) => {
    return condition(value, row) ? trueRenderer(value, row) : falseRenderer(value, row);
  };
}

// ===== Icon Renderer =====

export const ICON_MAP = {
  edit: '📝',
  delete: '🗑️',
  view: '👁️',
  download: '⬇️',
  upload: '⬆️',
  copy: '📋',
  share: '🔗',
  print: '🖨️',
  archive: '📦',
  restore: '♻️',
  check: '✓',
  close: '✕',
  info: 'ℹ️',
  warning: '⚠️',
  error: '❌',
  success: '✅'
};

export function iconRenderer(
  iconName: keyof typeof ICON_MAP,
  tooltip?: string
): (value: unknown) => string {
  return (value: unknown) => {
    const icon = ICON_MAP[iconName] || iconName;
    const title = tooltip || String(value) || '';
    return `<span class="icon" title="${escapeAttribute(title)}">${escapeHtml(icon)}</span>`;
  };
}

// ===== Export all renderers =====

export const CellRenderers = {
  date: dateRenderer,
  number: numberRenderer,
  currency: currencyRenderer,
  percentage: percentageRenderer,
  boolean: booleanRenderer,
  statusBadge: statusBadgeRenderer,
  link: linkRenderer,
  image: imageRenderer,
  avatar: avatarRenderer,
  tagList: tagListRenderer,
  progressBar: progressBarRenderer,
  rating: ratingRenderer,
  fileSize: fileSizeRenderer,
  highlight: highlightRenderer,
  truncate: truncateRenderer,
  enum: enumRenderer,
  multiline: multilineRenderer,
  actionButtons: actionButtonsRenderer,
  conditional: conditionalRenderer,
  icon: iconRenderer
};

// ===== Helper: Combine multiple renderers =====

export function combineRenderers(
  ...renderers: Array<(value: LooseValue, row?: Record<string, unknown>) => string>
): (value: LooseValue, row?: Record<string, unknown>) => string {
  return (value: LooseValue, row?: Record<string, unknown>) => {
    return renderers.reduce((result, renderer) => renderer(result, row), value);
  };
}
