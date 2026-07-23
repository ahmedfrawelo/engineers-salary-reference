import type { CalendarEvent, CalendarEventRecurrence, NormalizedEvent } from './calendar.models';
import type { CalendarComponentPresenter } from './calendar.component.presenter';

type RecurrenceOccurrence = { start: Date; occurrenceId?: string };

export function expandRecurrenceHelper(
  ctx: CalendarComponentPresenter,
  event: CalendarEvent,
  start: Date,
  end: Date,
  rangeStart: Date,
  rangeEnd: Date
): RecurrenceOccurrence[] {
  if (!event.recurrence) {
    return [{ start }];
  }
  const recurrence = event.recurrence;
  const interval = Math.max(1, recurrence.interval ?? 1);
  const countLimit = recurrence.count && recurrence.count > 0 ? recurrence.count : 999;
  const until = recurrence.until ? ctx.parseDateInput(recurrence.until) : null;
  const exceptions = (event.exceptions || []).map(item => item.slice(0, 10));

  const occurrences: RecurrenceOccurrence[] = [];
  let generated = 0;

  if (recurrence.freq === 'daily') {
    let cursor = new Date(start);
    while (cursor <= rangeEnd && generated < countLimit) {
      if (until && cursor > until) {
        break;
      }
      if (cursor >= rangeStart && !isExceptionDateHelper(ctx, cursor, exceptions)) {
        const adjusted = applyTimeRuleHelper(ctx, cursor, start, recurrence);
        occurrences.push({
          start: adjusted,
          occurrenceId: makeOccurrenceIdHelper(ctx, event.id, adjusted)
        });
      }
      generated += 1;
      cursor = ctx.addDays(cursor, interval);
    }
    return occurrences;
  }

  if (recurrence.freq === 'weekly') {
    const weekdays =
      recurrence.byWeekday && recurrence.byWeekday.length
        ? recurrence.byWeekday.slice()
        : [start.getDay()];
    let weekCursor = ctx.startOfWeek(start);
    while (weekCursor <= rangeEnd && generated < countLimit) {
      for (const weekday of weekdays) {
        const occurrence = ctx.addDays(weekCursor, (weekday - ctx.weekStart + 7) % 7);
        if (occurrence < start) {
          continue;
        }
        if (until && occurrence > until) {
          continue;
        }
        if (
          occurrence >= rangeStart &&
          occurrence <= rangeEnd &&
          !isExceptionDateHelper(ctx, occurrence, exceptions)
        ) {
          const adjusted = applyTimeRuleHelper(ctx, occurrence, start, recurrence);
          occurrences.push({
            start: adjusted,
            occurrenceId: makeOccurrenceIdHelper(ctx, event.id, adjusted)
          });
        }
        generated += 1;
        if (generated >= countLimit) {
          break;
        }
      }
      weekCursor = ctx.addDays(weekCursor, interval * 7);
    }
    return occurrences;
  }

  if (recurrence.freq === 'monthly') {
    let cursor = new Date(start);
    while (cursor <= rangeEnd && generated < countLimit) {
      if (until && cursor > until) {
        break;
      }
      const monthDates = buildMonthlyDatesHelper(
        ctx,
        cursor.getFullYear(),
        cursor.getMonth(),
        start,
        recurrence
      );
      for (const date of monthDates) {
        if (date < start) {
          continue;
        }
        if (until && date > until) {
          continue;
        }
        if (
          date >= rangeStart &&
          date <= rangeEnd &&
          !isExceptionDateHelper(ctx, date, exceptions)
        ) {
          const adjusted = applyTimeRuleHelper(ctx, date, start, recurrence);
          occurrences.push({
            start: adjusted,
            occurrenceId: makeOccurrenceIdHelper(ctx, event.id, adjusted)
          });
        }
        generated += 1;
        if (generated >= countLimit) {
          break;
        }
      }
      cursor = ctx.addMonths(cursor, interval);
    }
    return occurrences;
  }

  if (recurrence.freq === 'yearly') {
    let cursor = new Date(start);
    while (cursor <= rangeEnd && generated < countLimit) {
      if (until && cursor > until) {
        break;
      }
      const months =
        recurrence.byMonth && recurrence.byMonth.length
          ? recurrence.byMonth.map(m => Math.max(1, Math.min(12, m)) - 1)
          : [cursor.getMonth()];
      for (const month of months) {
        const yearDates = buildMonthlyDatesHelper(
          ctx,
          cursor.getFullYear(),
          month,
          start,
          recurrence
        );
        for (const date of yearDates) {
          if (date < start) {
            continue;
          }
          if (until && date > until) {
            continue;
          }
          if (
            date >= rangeStart &&
            date <= rangeEnd &&
            !isExceptionDateHelper(ctx, date, exceptions)
          ) {
            const adjusted = applyTimeRuleHelper(ctx, date, start, recurrence);
            occurrences.push({
              start: adjusted,
              occurrenceId: makeOccurrenceIdHelper(ctx, event.id, adjusted)
            });
          }
          generated += 1;
          if (generated >= countLimit) {
            break;
          }
        }
        if (generated >= countLimit) {
          break;
        }
      }
      cursor = ctx.addYears(cursor, interval);
    }
    return occurrences;
  }

  return [{ start }];
}

export function makeOccurrenceIdHelper(
  _ctx: CalendarComponentPresenter,
  id: string,
  date: Date
): string {
  return `${id}__${date.toISOString().slice(0, 10)}`;
}

export function buildMonthlyDatesHelper(
  ctx: CalendarComponentPresenter,
  year: number,
  month: number,
  base: Date,
  recurrence: CalendarEventRecurrence
): Date[] {
  const result: Date[] = [];
  const lastDay = new Date(year, month + 1, 0).getDate();
  if (recurrence.byMonthDay && recurrence.byMonthDay.length) {
    for (const day of recurrence.byMonthDay) {
      const safeDay = Math.max(1, Math.min(lastDay, day));
      result.push(new Date(year, month, safeDay, base.getHours(), base.getMinutes()));
    }
    return result;
  }

  if (
    recurrence.byWeekday &&
    recurrence.byWeekday.length &&
    recurrence.bySetPos &&
    recurrence.bySetPos.length
  ) {
    for (const weekday of recurrence.byWeekday) {
      for (const pos of recurrence.bySetPos) {
        const date = getNthWeekdayOfMonthHelper(ctx, year, month, weekday, pos, base);
        if (date) {
          result.push(date);
        }
      }
    }
    return result;
  }

  const safeDay = Math.min(lastDay, base.getDate());
  return [new Date(year, month, safeDay, base.getHours(), base.getMinutes())];
}

export function getNthWeekdayOfMonthHelper(
  _ctx: CalendarComponentPresenter,
  year: number,
  month: number,
  weekday: number,
  pos: number,
  base: Date
): Date | null {
  const dates: Date[] = [];
  const first = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= lastDay; d += 1) {
    const date = new Date(year, month, d);
    if (date.getDay() === weekday) {
      dates.push(date);
    }
  }
  if (!dates.length) {
    return null;
  }
  const index = pos > 0 ? pos - 1 : dates.length + pos;
  const target = dates[index];
  if (!target) {
    return null;
  }
  return new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
    base.getHours(),
    base.getMinutes()
  );
}

export function applyTimeRuleHelper(
  _ctx: CalendarComponentPresenter,
  date: Date,
  base: Date,
  recurrence: CalendarEventRecurrence
): Date {
  const hours = recurrence.byHour?.length ? recurrence.byHour[0] : base.getHours();
  const minutes = recurrence.byMinute?.length ? recurrence.byMinute[0] : base.getMinutes();
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes);
}

export function isExceptionDateHelper(
  ctx: CalendarComponentPresenter,
  date: Date,
  exceptions: string[]
): boolean {
  const iso = ctx.toDateInput(date);
  return exceptions.includes(iso);
}

export function buildDayCountsHelper(
  ctx: CalendarComponentPresenter,
  events: NormalizedEvent[]
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const ev of events) {
    const start = ctx.startOfDay(ev.start);
    const end = ctx.startOfDay(ev.end);
    let cursor = new Date(start);
    while (cursor <= end) {
      const iso = ctx.toDateInput(cursor);
      counts.set(iso, (counts.get(iso) || 0) + 1);
      cursor = ctx.addDays(cursor, 1);
    }
  }
  return counts;
}
