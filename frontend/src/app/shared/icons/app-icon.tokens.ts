import type { IconSvgObject } from '@hugeicons/angular';
import { resolveAppIconDefinition } from './app-icon.registry';

export const DEFAULT_APP_ICON_TOKEN = 'circle-fill';

export const APP_GROUP_ICON_LIBRARY = [
  'circle-fill',
  'record-circle',
  'check-circle-fill',
  'check2-circle',
  'arrow-repeat',
  'search',
  'exclamation-octagon',
  'exclamation-triangle',
  'flag',
  'lightning-fill',
  'clock-history',
  'bullseye',
  'gear',
  'tools',
  'wrench-adjustable-circle',
  'briefcase',
  'building',
  'people',
  'person-gear',
  'person-check',
  'kanban',
  'list-check',
  'diagram-3',
  'diagram-2',
  'clipboard-data',
  'clipboard-check',
  'journal-check',
  'journal-text',
  'chat-dots',
  'envelope',
  'telephone',
  'camera-video',
  'calendar-event',
  'calendar2-week',
  'calendar-check',
  'alarm',
  'hourglass-split',
  'stopwatch',
  'pin-angle',
  'geo-alt',
  'truck',
  'box-seam',
  'box2',
  'archive',
  'folder2-open',
  'file-earmark-text',
  'file-earmark-check',
  'file-earmark-bar-graph',
  'cloud-arrow-up',
  'cloud-check',
  'database',
  'hdd-network',
  'wifi',
  'shield-check',
  'shield-exclamation',
  'lock',
  'unlock',
  'key',
  'bug',
  'patch-check',
  'stars',
  'star',
  'bookmark-star',
  'trophy',
  'award',
  'gem',
  'rocket-takeoff',
  'signpost',
  'cash-stack',
  'coin',
  'receipt',
  'cart-check',
  'bag-check',
  'shop',
  'heart-pulse',
  'activity',
  'graph-up-arrow',
  'bar-chart',
  'pie-chart',
  'emoji-smile',
  'moon-stars',
  'sun',
  'magic',
  'brush',
  'palette',
  'pencil-square',
  'pen',
  'link-45deg',
  'node-plus',
  'bezier2',
  'sliders',
  'filter-circle',
  'funnel',
  'hammer'
] as const;

export const APP_GROUP_ICON_SEEDS = [
  'arrow-repeat',
  'record-circle',
  'search',
  'exclamation-octagon',
  'check-circle-fill',
  'lightning-fill',
  'flag',
  'clock-history',
  'bullseye'
] as const;

export const APP_GROUP_ICON_CATEGORY_DEFS = [
  { key: 'all', label: 'All' },
  { key: 'workflow', label: 'Workflow' },
  { key: 'alerts', label: 'Alerts' },
  { key: 'people', label: 'People' },
  { key: 'docs', label: 'Docs' },
  { key: 'business', label: 'Business' },
  { key: 'tech', label: 'Tech' },
  { key: 'media', label: 'Media' },
  { key: 'finance', label: 'Finance' },
  { key: 'other', label: 'Other' }
] as const;

const ICON_TOKEN_ALIASES: Record<string, string> = {
  'cu-icon-backlog-ring': 'circle',
  'backlog-ring': 'circle'
};

export function normalizeAppIconToken(value: string | null | undefined): string | null {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!raw) return null;

  const classTokens = raw.split(/\s+/).filter(Boolean);
  const resolvedRaw =
    classTokens.find(token => token.startsWith('bi-')) ??
    classTokens.find(token => token !== 'bi') ??
    raw;
  const aliased = ICON_TOKEN_ALIASES[resolvedRaw] ?? resolvedRaw;
  const normalized = aliased.startsWith('bi-') ? aliased.slice(3) : aliased;
  return /^[a-z0-9-]+$/.test(normalized) ? normalized : null;
}

export function resolveAppIconToken(
  value: string | null | undefined,
  fallback: string = DEFAULT_APP_ICON_TOKEN
): IconSvgObject {
  const normalized =
    normalizeAppIconToken(value) ?? normalizeAppIconToken(fallback) ?? DEFAULT_APP_ICON_TOKEN;
  return resolveAppIconDefinition(normalized);
}

export function collectAppIconTokensFromSelector(selector: string, sink: Set<string>): void {
  const regex = /\.bi-([a-z0-9-]+)(?::before|::after)?/gi;
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(selector))) {
    sink.add(match[1]);
  }

  if (/\.cu-icon-backlog-ring\b/i.test(selector)) {
    sink.add('circle');
  }
}

export function detectAppGroupIconCategory(iconValue: string): string {
  const icon = normalizeAppIconToken(iconValue) ?? '';
  if (
    /(arrow|chevron|caret|plus|dash|check|search|funnel|filter|sort|sliders|toggle|repeat|clock|hourglass|stopwatch|play|pause|skip|list|kanban|diagram|node|bezier|bullseye|flag|pin|signpost)/.test(
      icon
    )
  )
    return 'workflow';
  if (
    /(alert|alarm|exclamation|x-|ban|slash|stop|shield-exclamation|bug|patch-exclamation)/.test(
      icon
    )
  )
    return 'alerts';
  if (/(person|people|emoji|chat|telephone|envelope|camera-video|heart|hand)/.test(icon))
    return 'people';
  if (
    /(file|folder|journal|clipboard|book|bookmark|archive|receipt|card-text|card-checklist|stickies|paperclip)/.test(
      icon
    )
  )
    return 'docs';
  if (
    /(briefcase|building|shop|cart|bag|truck|box|package|gem|award|trophy|rocket|target|lightning|flag|kanban|calendar|pin|geo|signpost)/.test(
      icon
    )
  )
    return 'business';
  if (/(gear|tools|wrench|database|wifi|shield|lock|unlock|key|cpu|hdd|cloud|activity)/.test(icon))
    return 'tech';
  if (/(camera|image|film|music|mic|broadcast|play|pause|record)/.test(icon)) return 'media';
  if (/(cash|coin|bank|wallet|credit|graph|chart|bar-chart|pie-chart)/.test(icon)) return 'finance';
  return 'other';
}
