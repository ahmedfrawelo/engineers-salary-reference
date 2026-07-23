import { normalizeAppIconToken } from '@shared/icons/app-icon.tokens';
import type { AppStatusListColumnKey, AppStatusListRow } from '../models/app-status-list.models';

export interface AppStatusListColorHost<TPayload = unknown> {
  customColorDraft: string;
  customHue: number;
  customSaturation: number;
  customValue: number;
  groupIconSet: ReadonlySet<string>;
  rowValue(row: AppStatusListRow<TPayload>, column: AppStatusListColumnKey): string;
}

export function clampStatusListValue(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function updateStatusListColorFromCustomPicker(host: AppStatusListColorHost<unknown>): void {
  host.customColorDraft = hsvStatusListToHex(
    host.customHue,
    host.customSaturation,
    host.customValue
  );
}

export function updateStatusListPickerFromAreaPointer(
  host: AppStatusListColorHost<unknown>,
  event: PointerEvent,
  area: HTMLElement
): void {
  const rect = area.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const x = clampStatusListValue(event.clientX - rect.left, 0, rect.width);
  const y = clampStatusListValue(event.clientY - rect.top, 0, rect.height);
  host.customSaturation = Math.round((x / rect.width) * 100);
  host.customValue = Math.round(100 - (y / rect.height) * 100);
  updateStatusListColorFromCustomPicker(host);
}

export function normalizeStatusListHexColor(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const normalized = raw.startsWith('#') ? raw : `#${raw}`;
  if (/^#([0-9a-f]{6})$/i.test(normalized)) return normalized.toLowerCase();
  if (/^#([0-9a-f]{3})$/i.test(normalized)) {
    const [, triplet] = normalized.match(/^#([0-9a-f]{3})$/i) ?? [];
    if (!triplet) return null;
    const expanded = triplet
      .split('')
      .map(char => `${char}${char}`)
      .join('');
    return `#${expanded}`.toLowerCase();
  }
  return null;
}

export function normalizeStatusListGroupIcon(
  host: AppStatusListColorHost<unknown>,
  value: string | null | undefined
): string | null {
  const icon = normalizeAppIconToken(value);
  if (!icon) return null;
  return host.groupIconSet.has(icon) ? icon : null;
}

export function statusListHexToRgb(hex: string): [number, number, number] | null {
  const normalized = normalizeStatusListHexColor(hex);
  if (!normalized) return null;
  const value = normalized.slice(1);
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  if (![r, g, b].every(channel => Number.isFinite(channel))) return null;
  return [r, g, b];
}

export function statusListRgbToHex(r: number, g: number, b: number): string {
  const toHex = (value: number) =>
    clampStatusListValue(Math.round(value), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function parseStatusListChannel(
  value: string,
  min: number,
  max: number,
  fallback: number
): number {
  const cleaned = value.replace(/[^\d.-]/g, '');
  if (!cleaned) return fallback;
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return fallback;
  return Math.round(clampStatusListValue(num, min, max));
}

export function syncStatusListCustomPickerFromHex(
  host: AppStatusListColorHost<unknown>,
  hex: string
): void {
  const rgb = statusListHexToRgb(hex);
  if (!rgb) return;
  const [h, s, v] = statusListRgbToHsv(rgb[0], rgb[1], rgb[2]);
  host.customHue = h;
  host.customSaturation = s;
  host.customValue = v;
}

export function statusListRgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : (delta / max) * 100;
  const v = max * 100;
  return [Math.round(h), Math.round(s), Math.round(v)];
}

export function statusListRgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

export function hsvStatusListToHex(h: number, s: number, v: number): string {
  const [r, g, b] = statusListHsvToRgb(h, s, v);
  const toHex = (value: number) => value.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function statusListHsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const hue = ((h % 360) + 360) % 360;
  const sat = clampStatusListValue(s, 0, 100) / 100;
  const val = clampStatusListValue(v, 0, 100) / 100;
  const c = val * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = val - c;

  let rPrime = 0;
  let gPrime = 0;
  let bPrime = 0;

  if (hue < 60) [rPrime, gPrime, bPrime] = [c, x, 0];
  else if (hue < 120) [rPrime, gPrime, bPrime] = [x, c, 0];
  else if (hue < 180) [rPrime, gPrime, bPrime] = [0, c, x];
  else if (hue < 240) [rPrime, gPrime, bPrime] = [0, x, c];
  else if (hue < 300) [rPrime, gPrime, bPrime] = [x, 0, c];
  else [rPrime, gPrime, bPrime] = [c, 0, x];

  return [
    Math.round((rPrime + m) * 255),
    Math.round((gPrime + m) * 255),
    Math.round((bPrime + m) * 255)
  ];
}

export function statusListHslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hue = ((h % 360) + 360) % 360;
  const sat = clampStatusListValue(s, 0, 100) / 100;
  const light = clampStatusListValue(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - c / 2;

  let rPrime = 0;
  let gPrime = 0;
  let bPrime = 0;

  if (hue < 60) [rPrime, gPrime, bPrime] = [c, x, 0];
  else if (hue < 120) [rPrime, gPrime, bPrime] = [x, c, 0];
  else if (hue < 180) [rPrime, gPrime, bPrime] = [0, c, x];
  else if (hue < 240) [rPrime, gPrime, bPrime] = [0, x, c];
  else if (hue < 300) [rPrime, gPrime, bPrime] = [x, 0, c];
  else [rPrime, gPrime, bPrime] = [c, 0, x];

  return [
    Math.round((rPrime + m) * 255),
    Math.round((gPrime + m) * 255),
    Math.round((bPrime + m) * 255)
  ];
}

export function compareStatusListRows<TPayload>(
  host: AppStatusListColorHost<TPayload>,
  a: AppStatusListRow<TPayload>,
  b: AppStatusListRow<TPayload>,
  column: AppStatusListColumnKey,
  direction: 'asc' | 'desc'
): number {
  const av = sortStatusListValueForColumn(host, a, column);
  const bv = sortStatusListValueForColumn(host, b, column);
  const aEmpty = isStatusListSortEmpty(av);
  const bEmpty = isStatusListSortEmpty(bv);
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  let result = 0;
  if (typeof av === 'number' && typeof bv === 'number') {
    result = av - bv;
  } else {
    result = String(av).localeCompare(String(bv), undefined, {
      numeric: true,
      sensitivity: 'base'
    });
  }
  return direction === 'asc' ? result : -result;
}

export function sortStatusListValueForColumn<TPayload>(
  host: AppStatusListColorHost<TPayload>,
  row: AppStatusListRow<TPayload>,
  column: AppStatusListColumnKey
): number | string {
  if (column === 'name') return row.title || '';
  if (column === 'assignee') return row.owner || '';
  if (column === 'priority') return priorityStatusListSortWeight(row.priorityLabel);
  if (column === 'status') return row.statusLabel || '';
  if (column === 'comments') return row.commentsCount ?? -1;

  const raw =
    column === 'taskId'
      ? row.idLabel
      : column === 'created'
        ? row.createdLabel
        : column === 'updated'
          ? row.updatedLabel
          : column === 'taskType'
            ? row.typeLabel
            : column === 'dueDate'
              ? row.dueLabel
              : host.rowValue(row, column);
  const dateValue = parseStatusListDateValue(raw);
  return dateValue ?? (raw || '');
}

export function priorityStatusListSortWeight(priorityLabel: string | null | undefined): number {
  const normalized = (priorityLabel || '').trim().toLowerCase();
  if (!normalized) return -1;
  const map: Record<string, number> = {
    urgent: 5,
    critical: 4,
    high: 3,
    medium: 2,
    normal: 2,
    low: 1
  };
  return map[normalized] ?? 0;
}

export function parseStatusListDateValue(value: string | null | undefined): number | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized || normalized === '--') return null;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isStatusListSortEmpty(value: string | number | null | undefined): boolean {
  if (value == null) return true;
  if (typeof value === 'number') return Number.isNaN(value);
  const normalized = value.trim();
  return !normalized || normalized === '--';
}
