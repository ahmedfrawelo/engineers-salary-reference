import type { CalendarEvent, CalendarHoliday, NormalizedEvent } from './calendar.models';
import {
  buildCalendarPolicyWarnings,
  type CalendarPolicyWarningsContext
} from './calendar/domain/calendar-policy-warnings.policy';

export interface QuickAddResult {
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
}

export interface QuickAddOptions {
  anchorDate: Date;
  timeSlotMinutes: number;
  clampMinutes: (minutes: number) => number;
}

export type PolicyWarningsContext = CalendarPolicyWarningsContext;

export function parseDateInput(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(value);
  }
  if (value.includes('T')) {
    return new Date(value);
  }
  return new Date(`${value}T00:00:00`);
}

export function isDateOnly(value: string | Date | undefined): boolean {
  if (!value || value instanceof Date) {
    return false;
  }
  return !value.includes('T');
}

export function toDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toTimeInput(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function addYears(date: Date, years: number): Date {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

export function startOfWeek(date: Date, weekStart: number): Date {
  const day = date.getDay();
  const diff = (day - weekStart + 7) % 7;
  return addDays(startOfDay(date), -diff);
}

export function endOfWeek(date: Date, weekStart: number): Date {
  const start = startOfWeek(date, weekStart);
  return endOfDay(addDays(start, 6));
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function getWeekNumber(date: Date): number {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const diff = target.getTime() - yearStart.getTime();
  return Math.ceil((diff / 86400000 + 1) / 7);
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

export function isWeekend(date: Date, weekendDays: number[]): boolean {
  return weekendDays.includes(date.getDay());
}

export function isWithinDate(date: Date, start: Date, end: Date): boolean {
  return date >= startOfDay(start) && date <= endOfDay(end);
}

export function daysBetween(start: Date, end: Date): number {
  const dayMs = 24 * 60 * 60 * 1000;
  const startDay = startOfDay(start).getTime();
  const endDay = startOfDay(end).getTime();
  return Math.round((endDay - startDay) / dayMs);
}

export function mergeDateWithTime(date: Date, timeSource: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    timeSource.getHours(),
    timeSource.getMinutes()
  );
}

export function setTimeOnDate(date: Date, minutes: number): Date {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, mins);
}

export function snapMinutes(value: number, timeSlotMinutes: number): number {
  const slot = Math.max(10, Math.min(60, Math.round(timeSlotMinutes)));
  return Math.round(value / slot) * slot;
}

export function minutesFromPointer(
  container: HTMLElement,
  clientY: number,
  startHour: number,
  endHour: number,
  timeSlotMinutes: number
): number {
  const rect = container.getBoundingClientRect();
  const y = Math.min(Math.max(clientY - rect.top, 0), rect.height);
  const totalMinutes = (endHour - startHour) * 60;
  const minutes = Math.round((y / rect.height) * totalMinutes);
  return startHour * 60 + snapMinutes(minutes, timeSlotMinutes);
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export function parseNumberList(value: string): number[] | undefined {
  if (!value) {
    return undefined;
  }
  const list = value
    .split(',')
    .map(item => parseInt(item.trim(), 10))
    .filter(item => !isNaN(item));
  return list.length ? list : undefined;
}

export function parseExceptions(value: string): string[] | undefined {
  if (!value) {
    return undefined;
  }
  const list = value
    .split(',')
    .map(item => item.trim())
    .filter(item => item.length >= 8);
  return list.length ? list : undefined;
}

export function buildStateKey(storageKey: string): string {
  return storageKey || 'engineers-salary-reference-calendar';
}

export function getStorageKey(storageKey: string, suffix: string): string {
  return `${buildStateKey(storageKey)}:${suffix}`;
}

export function canStoreWindow(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

export function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n');
}

export function formatIcsDate(date: Date, allDay: boolean): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  if (allDay) {
    return `${year}${month}${day}`;
  }
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
}

export function parseIcsDate(value: string): string {
  if (value.length === 8) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  if (value.includes('T')) {
    const date = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
    const time = `${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}`;
    return `${date}T${time}`;
  }
  return value;
}

export function escapeCsv(value: string): string {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function splitCsvRow(row: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i += 1) {
    const ch = row[i];
    if (ch === '"' && row[i + 1] === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  result.push(current);
  return result.map(item => item.trim());
}

export function buildIcs(events: NormalizedEvent[]): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ENGINEERS_SALARY_REFERENCE//Calendar//EN'];
  for (const ev of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${ev.originalId}`);
    lines.push(`SUMMARY:${escapeIcs(ev.title)}`);
    lines.push(`DTSTART:${formatIcsDate(ev.start, ev.allDay)}`);
    const endDate = ev.allDay ? addDays(ev.end, 1) : ev.end;
    lines.push(`DTEND:${formatIcsDate(endDate, ev.allDay)}`);
    if (ev.location) {
      lines.push(`LOCATION:${escapeIcs(ev.location)}`);
    }
    if (ev.description) {
      lines.push(`DESCRIPTION:${escapeIcs(ev.description)}`);
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function buildCsv(events: NormalizedEvent[]): string {
  const header = [
    'id',
    'title',
    'start',
    'end',
    'allDay',
    'type',
    'status',
    'resourceId',
    'layer',
    'location',
    'meta',
    'description'
  ];
  const rows = events.map(ev => [
    ev.originalId,
    ev.title,
    ev.start.toISOString(),
    ev.end.toISOString(),
    ev.allDay ? '1' : '0',
    ev.type || '',
    ev.status || '',
    ev.resourceIds.join('|'),
    ev.layer || '',
    ev.location || '',
    ev.meta || '',
    ev.description || ''
  ]);
  return [header.join(','), ...rows.map(row => row.map(item => escapeCsv(item)).join(','))].join(
    '\n'
  );
}

export function parseImport(name: string, content: string): CalendarEvent[] {
  const lower = name.toLowerCase();
  if (lower.endsWith('.ics')) {
    return parseIcs(content);
  }
  if (lower.endsWith('.csv')) {
    return parseCsv(content);
  }
  return [];
}

export function parseIcs(content: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const lines = content.split(/\r?\n/);
  let current: Partial<CalendarEvent> | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (line === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (line === 'END:VEVENT' && current) {
      if (current.id && current.title && current.start && current.end) {
        events.push(current as CalendarEvent);
      }
      current = null;
      continue;
    }
    if (!current) {
      continue;
    }
    const [key, value] = line.split(':', 2);
    if (!value) {
      continue;
    }
    if (key.startsWith('UID')) {
      current.id = value;
    }
    if (key.startsWith('SUMMARY')) {
      current.title = value;
    }
    if (key.startsWith('DTSTART')) {
      current.start = parseIcsDate(value);
      current.allDay = value.length === 8;
    }
    if (key.startsWith('DTEND')) {
      current.end = parseIcsDate(value);
    }
    if (key.startsWith('DESCRIPTION')) {
      current.description = value;
    }
    if (key.startsWith('LOCATION')) {
      current.location = value;
    }
  }
  return events;
}

export function parseCsv(content: string): CalendarEvent[] {
  const rows = content.split(/\r?\n/).filter(Boolean);
  if (!rows.length) {
    return [];
  }
  const header = rows[0].split(',').map(item => item.trim());
  const events: CalendarEvent[] = [];
  for (const row of rows.slice(1)) {
    const cols = splitCsvRow(row);
    const record: Record<string, string> = {};
    header.forEach((key, i) => {
      record[key] = cols[i] || '';
    });
    if (!record['id'] || !record['title'] || !record['start'] || !record['end']) {
      continue;
    }
    events.push({
      id: record['id'],
      title: record['title'],
      start: record['start'],
      end: record['end'],
      allDay: record['allDay'] === '1',
      type: record['type'] || undefined,
      status: record['status'] || undefined,
      resourceId: record['resourceId'] ? record['resourceId'].split('|') : undefined,
      layer: record['layer'] || undefined,
      location: record['location'] || undefined,
      meta: record['meta'] || undefined,
      description: record['description'] || undefined
    });
  }
  return events;
}

export function formatDateWithTimeZone(
  date: Date,
  options: Intl.DateTimeFormatOptions,
  locale: string,
  timeZone?: string
): string {
  const formatter = new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone
  });
  return formatter.format(date);
}

export function formatRange(start: Date, end: Date, locale: string, timeZone?: string): string {
  const formatter = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone
  });
  if (
    (formatter as Intl.DateTimeFormat & { formatRange?: (a: Date, b: Date) => string }).formatRange
  ) {
    return (
      formatter as Intl.DateTimeFormat & { formatRange: (a: Date, b: Date) => string }
    ).formatRange(start, end);
  }
  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

export function parseWeekday(value: string): number | null {
  const map: Record<string, number> = {
    sun: 0,
    sunday: 0,
    mon: 1,
    monday: 1,
    tue: 2,
    tuesday: 2,
    wed: 3,
    wednesday: 3,
    thu: 4,
    thursday: 4,
    fri: 5,
    friday: 5,
    sat: 6,
    saturday: 6
  };
  return map[value] ?? null;
}

export function nextWeekday(base: Date, target: number, nextOnly: boolean): Date {
  const day = base.getDay();
  let diff = (target - day + 7) % 7;
  if (diff === 0 && nextOnly) {
    diff = 7;
  }
  return addDays(base, diff);
}

export function toMinutes(hours: string, minutes?: string, ampm?: string): number {
  let hour = Math.min(23, Math.max(0, Number(hours)));
  const minute = Math.min(59, Math.max(0, Number(minutes || 0)));
  if (ampm) {
    const meridian = ampm.toLowerCase();
    if (meridian === 'pm' && hour < 12) {
      hour += 12;
    }
    if (meridian === 'am' && hour === 12) {
      hour = 0;
    }
  }
  return hour * 60 + minute;
}

export function parseQuickAddTime(
  text: string,
  timeSlotMinutes: number,
  clampMinutes: (minutes: number) => number
): { startMinutes: number; endMinutes: number } | null {
  const rangeMatch = text.match(
    /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/
  );
  if (rangeMatch) {
    const startMinutes = toMinutes(rangeMatch[1], rangeMatch[2], rangeMatch[3]);
    const endMinutes = toMinutes(rangeMatch[4], rangeMatch[5], rangeMatch[6] || rangeMatch[3]);
    return {
      startMinutes: clampMinutes(startMinutes),
      endMinutes: clampMinutes(endMinutes)
    };
  }
  const singleMatch = text.match(/(?:@|at)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (singleMatch) {
    const startMinutes = toMinutes(singleMatch[1], singleMatch[2], singleMatch[3]);
    const slotMinutes = Math.max(10, Math.min(60, Math.round(timeSlotMinutes)));
    return {
      startMinutes: clampMinutes(startMinutes),
      endMinutes: clampMinutes(startMinutes + slotMinutes)
    };
  }
  const simpleMatch = text.match(/\b(\d{1,2})(?::(\d{2}))\s*(am|pm)\b/);
  if (simpleMatch) {
    const startMinutes = toMinutes(simpleMatch[1], simpleMatch[2], simpleMatch[3]);
    const slotMinutes = Math.max(10, Math.min(60, Math.round(timeSlotMinutes)));
    return {
      startMinutes: clampMinutes(startMinutes),
      endMinutes: clampMinutes(startMinutes + slotMinutes)
    };
  }
  return null;
}

export function parseQuickAddDurationDays(text: string): number {
  const match = text.match(/\b(\d+)\s*(day|days|d)\b/);
  if (!match) {
    return 1;
  }
  return Math.max(1, Number(match[1]));
}

export function stripQuickAddTitle(text: string): string {
  const patterns = [
    /\b(today|tomorrow|next|on|at|from|to|for|all\s*day)\b/gi,
    /\b(sun|mon|tue|wed|thu|fri|sat|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi,
    /\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/g,
    /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g,
    /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/gi,
    /(?:@|at)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/gi,
    /\b(\d+)\s*(day|days|d)\b/gi
  ];
  let title = text;
  for (const pattern of patterns) {
    title = title.replace(pattern, ' ');
  }
  title = title.replace(/\s+/g, ' ').trim();
  return title || text.trim();
}

export function parseQuickAdd(
  input: string,
  options: QuickAddOptions
): { title: string; start: Date; end: Date; allDay: boolean } | null {
  const text = input.trim();
  if (!text) {
    return null;
  }
  const lower = text.toLowerCase();
  const today = startOfDay(new Date());
  let date = startOfDay(options.anchorDate);
  const isoMatch = lower.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
  const mdMatch = lower.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  const weekdayMatch = lower.match(
    /\b(next\s+)?(sun|mon|tue|wed|thu|fri|sat|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/
  );

  if (lower.includes('today')) {
    date = today;
  } else if (lower.includes('tomorrow')) {
    date = addDays(today, 1);
  } else if (isoMatch) {
    date = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  } else if (mdMatch) {
    let year = mdMatch[3] ? Number(mdMatch[3]) : today.getFullYear();
    if (year < 100) {
      year += 2000;
    }
    date = new Date(year, Number(mdMatch[1]) - 1, Number(mdMatch[2]));
  } else if (weekdayMatch) {
    const nextOnly = !!weekdayMatch[1];
    const target = parseWeekday(weekdayMatch[2]);
    if (target !== null) {
      date = nextWeekday(today, target, nextOnly);
    }
  }

  const timeRange = parseQuickAddTime(lower, options.timeSlotMinutes, options.clampMinutes);
  const allDay = !timeRange;
  let start = date;
  let end = date;
  const durationDays = parseQuickAddDurationDays(lower);

  if (timeRange) {
    start = setTimeOnDate(date, timeRange.startMinutes);
    end = setTimeOnDate(date, timeRange.endMinutes);
    if (end <= start) {
      end = new Date(start.getTime() + options.timeSlotMinutes * 60000);
    }
  } else if (durationDays > 1) {
    end = addDays(date, durationDays - 1);
  }

  const title = stripQuickAddTitle(text);
  if (!title) {
    return null;
  }
  return { title, start, end, allDay };
}

export function buildPolicyWarnings(context: PolicyWarningsContext): string[] {
  return buildCalendarPolicyWarnings(context);
}
