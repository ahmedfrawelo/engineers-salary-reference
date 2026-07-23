import { Directive } from '@angular/core';
import type { CalendarEvent, CalendarHoliday, NormalizedEvent } from './calendar.models';
import { CalendarComponentState } from './calendar.component.state';
import * as calendarUtils from './calendar.utils';
import {
  buildCalendarHolidayMap,
  getCalendarHolidaysForDate,
  isCalendarTypingInField
} from './calendar-holiday.utils';

@Directive()
export abstract class CalendarComponentDateTimeBase extends CalendarComponentState {
  protected formatRange(start: Date, end: Date): string {
    return calendarUtils.formatRange(start, end, this.locale, this.selectedTimeZone || undefined);
  }

  formatDate(date: Date, options: Intl.DateTimeFormatOptions): string {
    return this.formatDateWithTimeZone(date, options, this.selectedTimeZone || undefined);
  }

  formatDateForEvent(
    date: Date,
    event: NormalizedEvent,
    options: Intl.DateTimeFormatOptions
  ): string {
    return this.formatDateWithTimeZone(
      date,
      options,
      event.timeZone || this.selectedTimeZone || undefined
    );
  }

  protected formatDateWithTimeZone(
    date: Date,
    options: Intl.DateTimeFormatOptions,
    timeZone?: string
  ): string {
    return calendarUtils.formatDateWithTimeZone(date, options, this.locale, timeZone);
  }

  protected buildHolidayMap(): Map<string, CalendarHoliday[]> {
    return buildCalendarHolidayMap(
      this.showHolidays,
      this.holidays,
      value => this.parseDateInput(value),
      date => this.toDateInput(date)
    );
  }

  protected getHolidaysForDate(date: Date): CalendarHoliday[] {
    return getCalendarHolidaysForDate(date, this.holidayMap, value => this.toDateInput(value));
  }

  protected isTypingInField(target: HTMLElement | null): boolean {
    return isCalendarTypingInField(target);
  }

  protected parseQuickAdd(
    input: string
  ): { title: string; start: Date; end: Date; allDay: boolean } | null {
    return calendarUtils.parseQuickAdd(input, {
      anchorDate: this.anchorDate,
      timeSlotMinutes: this.timeSlotMinutes,
      clampMinutes: minutes => this.clampMinutes(minutes)
    });
  }

  protected buildPolicyWarnings(
    start: Date,
    end: Date,
    resourceIds: string[],
    eventId?: string
  ): string[] {
    return calendarUtils.buildPolicyWarnings({
      policy: this.policy,
      start,
      end,
      resourceIds,
      eventId,
      weekendDays: this.weekendDays,
      getHolidaysForDate: date => this.getHolidaysForDate(date),
      buildNormalizedEvents: (rangeStart, rangeEnd) =>
        this.buildNormalizedEvents(rangeStart, rangeEnd),
      formatDate: (date, options) => this.formatDate(date, options)
    });
  }

  parseDateInput(value: string | Date): Date {
    return calendarUtils.parseDateInput(value);
  }

  protected isDateOnly(value: string | Date | undefined): boolean {
    return calendarUtils.isDateOnly(value);
  }

  toDateInput(date: Date): string {
    return calendarUtils.toDateInput(date);
  }

  protected toTimeInput(date: Date): string {
    return calendarUtils.toTimeInput(date);
  }

  startOfDay(date: Date): Date {
    return calendarUtils.startOfDay(date);
  }

  protected endOfDay(date: Date): Date {
    return calendarUtils.endOfDay(date);
  }

  addDays(date: Date, days: number): Date {
    return calendarUtils.addDays(date, days);
  }

  addMonths(date: Date, months: number): Date {
    return calendarUtils.addMonths(date, months);
  }

  addYears(date: Date, years: number): Date {
    return calendarUtils.addYears(date, years);
  }

  startOfWeek(date: Date): Date {
    return calendarUtils.startOfWeek(date, this.weekStart);
  }

  protected endOfWeek(date: Date): Date {
    return calendarUtils.endOfWeek(date, this.weekStart);
  }

  protected isSameDay(a: Date, b: Date): boolean {
    return calendarUtils.isSameDay(a, b);
  }

  protected getWeekNumber(date: Date): number {
    return calendarUtils.getWeekNumber(date);
  }

  protected isToday(date: Date): boolean {
    return calendarUtils.isToday(date);
  }

  protected isWeekend(date: Date): boolean {
    return calendarUtils.isWeekend(date, this.weekendDays);
  }

  protected isWithinDate(date: Date, start: Date, end: Date): boolean {
    return calendarUtils.isWithinDate(date, start, end);
  }

  protected daysBetween(start: Date, end: Date): number {
    return calendarUtils.daysBetween(start, end);
  }

  protected mergeDateWithTime(date: Date, timeSource: Date): Date {
    return calendarUtils.mergeDateWithTime(date, timeSource);
  }

  protected setTimeOnDate(date: Date, minutes: number): Date {
    return calendarUtils.setTimeOnDate(date, minutes);
  }

  protected minutesFromPointer(container: HTMLElement, clientY: number): number {
    return calendarUtils.minutesFromPointer(
      container,
      clientY,
      this.startHour,
      this.endHour,
      this.timeSlotMinutes
    );
  }

  protected snapMinutes(value: number): number {
    return calendarUtils.snapMinutes(value, this.timeSlotMinutes);
  }

  protected slugify(value: string): string {
    return calendarUtils.slugify(value);
  }

  protected abstract buildNormalizedEvents(rangeStart: Date, rangeEnd: Date): NormalizedEvent[];

  protected abstract clampMinutes(minutes: number): number;
}
