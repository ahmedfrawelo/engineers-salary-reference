import type { CalendarHoliday } from './calendar.models';

export function buildCalendarHolidayMap(
  showHolidays: boolean,
  holidays: CalendarHoliday[],
  parseDateInput: (value: string | Date) => Date,
  toDateInput: (date: Date) => string
): Map<string, CalendarHoliday[]> {
  const map = new Map<string, CalendarHoliday[]>();
  if (!showHolidays || !Array.isArray(holidays)) {
    return map;
  }

  for (const holiday of holidays) {
    const date = parseDateInput(holiday.date);
    const iso = toDateInput(date);
    if (!map.has(iso)) {
      map.set(iso, []);
    }
    map.get(iso)!.push(holiday);
  }

  return map;
}

export function getCalendarHolidaysForDate(
  date: Date,
  holidayMap: Map<string, CalendarHoliday[]>,
  toDateInput: (date: Date) => string
): CalendarHoliday[] {
  return holidayMap.get(toDateInput(date)) || [];
}

export function isCalendarTypingInField(target: HTMLElement | null): boolean {
  if (!target) {
    return false;
  }

  const tag = target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    return true;
  }

  if (target.isContentEditable) {
    return true;
  }

  return !!target.closest('input, textarea, select, [contenteditable="true"]');
}
