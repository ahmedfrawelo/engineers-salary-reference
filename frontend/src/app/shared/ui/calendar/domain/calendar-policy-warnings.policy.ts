import type { CalendarHoliday, CalendarPolicyConfig, NormalizedEvent } from '../../calendar.models';

export interface CalendarPolicyWarningsContext {
  policy: CalendarPolicyConfig | null;
  start: Date;
  end: Date;
  resourceIds: string[];
  eventId?: string;
  weekendDays: number[];
  getHolidaysForDate: (date: Date) => CalendarHoliday[];
  buildNormalizedEvents: (rangeStart: Date, rangeEnd: Date) => NormalizedEvent[];
  formatDate: (date: Date, options: Intl.DateTimeFormatOptions) => string;
}

function parseDateInput(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(value);
  }
  if (value.includes('T')) {
    return new Date(value);
  }
  return new Date(`${value}T00:00:00`);
}

function toDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isWeekend(date: Date, weekendDays: number[]): boolean {
  return weekendDays.includes(date.getDay());
}

function isWithinDate(date: Date, start: Date, end: Date): boolean {
  const value = startOfDay(date).getTime();
  return value >= startOfDay(start).getTime() && value <= endOfDay(end).getTime();
}

function daysBetween(start: Date, end: Date): number {
  const ms = startOfDay(end).getTime() - startOfDay(start).getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function buildCalendarPolicyWarnings(context: CalendarPolicyWarningsContext): string[] {
  if (!context.policy) {
    return [];
  }
  const warnings: string[] = [];
  const startDay = startOfDay(context.start);
  const endDay = startOfDay(context.end);
  const blockedSet = new Set(
    (context.policy.blockedDates || []).map((item: string | Date) =>
      toDateInput(parseDateInput(item))
    )
  );

  if (context.policy.minNoticeDays && context.policy.minNoticeDays > 0) {
    const notice = daysBetween(startOfDay(new Date()), startDay);
    if (notice < context.policy.minNoticeDays) {
      warnings.push(`Requires at least ${context.policy.minNoticeDays} days notice.`);
    }
  }

  let cursor = new Date(startDay);
  while (cursor <= endDay) {
    if (
      context.policy.allowedWeekdays &&
      !context.policy.allowedWeekdays.includes(cursor.getDay())
    ) {
      warnings.push('Selected range includes a non-working weekday.');
      break;
    }
    if (context.policy.disallowWeekends && isWeekend(cursor, context.weekendDays)) {
      warnings.push('Selected range includes weekend days.');
      break;
    }
    if (context.policy.disallowHolidays && context.getHolidaysForDate(cursor).length) {
      warnings.push('Selected range includes a holiday.');
      break;
    }
    if (blockedSet.has(toDateInput(cursor))) {
      warnings.push('Selected range includes a blocked date.');
      break;
    }
    cursor = addDays(cursor, 1);
  }

  const rangeStart = startOfDay(startDay);
  const rangeEnd = endOfDay(endDay);
  const existing = context
    .buildNormalizedEvents(rangeStart, rangeEnd)
    .filter(ev => ev.originalId !== context.eventId);

  if (context.policy.maxDailyEvents && context.policy.maxDailyEvents > 0) {
    cursor = new Date(startDay);
    while (cursor <= endDay) {
      const count = existing.filter(ev => {
        const dayMatch =
          isSameDay(ev.start, cursor) || (ev.allDay && isWithinDate(cursor, ev.start, ev.end));
        if (!dayMatch) {
          return false;
        }
        if (!context.resourceIds.length) {
          return true;
        }
        return ev.resourceIds.some((id: string) => context.resourceIds.includes(id));
      }).length;
      if (count + 1 > context.policy.maxDailyEvents) {
        warnings.push(
          `Daily limit exceeded on ${context.formatDate(cursor, { month: 'short', day: 'numeric' })}.`
        );
        break;
      }
      cursor = addDays(cursor, 1);
    }
  }

  if (context.policy.maxConcurrentEvents && context.policy.maxConcurrentEvents > 0) {
    const overlapCount = existing.filter(ev => {
      if (
        context.resourceIds.length &&
        !ev.resourceIds.some((id: string) => context.resourceIds.includes(id))
      ) {
        return false;
      }
      return ev.start < context.end && ev.end > context.start;
    }).length;
    if (overlapCount + 1 > context.policy.maxConcurrentEvents) {
      warnings.push('Too many overlapping events for the same resource.');
    }
  }

  return warnings;
}
