import { Directive } from '@angular/core';
import type { CalendarEvent, NormalizedEvent } from './calendar.models';
import * as calendarUtils from './calendar.utils';
import {
  downloadCalendarFile,
  loadCalendarEvents,
  loadCalendarPresets,
  loadCalendarState,
  mergeExternalCalendarEvents,
  persistCalendarEvents,
  persistCalendarPresets,
  persistCalendarState,
  type CalendarStorageHost
} from './calendar-storage.utils';
import {
  applyCalendarFilters,
  buildCalendarAgenda,
  buildCalendarMonthWeeks,
  buildCalendarNormalizedEvents,
  buildCalendarSubtitle,
  buildCalendarUpcoming,
  buildCalendarWeekDays,
  getCalendarViewRange,
  updateCalendarFilterOptions,
  type CalendarViewBuildersHost
} from './calendar-view-builders.utils';
import { CalendarComponentDateTimeBase } from './calendar.component.date-time.base';

@Directive()
export abstract class CalendarComponentInfrastructureBase extends CalendarComponentDateTimeBase {
  protected storageHost(): CalendarStorageHost {
    return this as unknown as CalendarStorageHost;
  }

  protected viewBuildersHost(): CalendarViewBuildersHost {
    return this as unknown as CalendarViewBuildersHost;
  }

  protected buildMonthWeeks(rangeStart: Date, rangeEnd: Date, events: NormalizedEvent[]): void {
    buildCalendarMonthWeeks(this.viewBuildersHost(), rangeStart, rangeEnd, events);
  }

  protected buildWeekDays(rangeStart: Date, rangeEnd: Date, events: NormalizedEvent[]): void {
    buildCalendarWeekDays(this.viewBuildersHost(), rangeStart, rangeEnd, events);
  }

  protected buildAgenda(rangeStart: Date, rangeEnd: Date, events: NormalizedEvent[]): void {
    buildCalendarAgenda(this.viewBuildersHost(), rangeStart, rangeEnd, events);
  }

  protected buildUpcoming(): void {
    buildCalendarUpcoming(this.viewBuildersHost());
  }

  protected getViewRange(): { start: Date; end: Date } {
    return getCalendarViewRange(this.viewBuildersHost());
  }

  protected buildSubtitle(start: Date, end: Date): string {
    return buildCalendarSubtitle(this.viewBuildersHost(), start, end);
  }

  protected buildNormalizedEvents(rangeStart: Date, rangeEnd: Date): NormalizedEvent[] {
    return buildCalendarNormalizedEvents(this.viewBuildersHost(), rangeStart, rangeEnd);
  }

  protected applyFilters(events: NormalizedEvent[]): NormalizedEvent[] {
    return applyCalendarFilters(this.viewBuildersHost(), events);
  }

  protected updateFilterOptions(events: NormalizedEvent[]): void {
    updateCalendarFilterOptions(this.viewBuildersHost(), events);
  }

  protected buildIcs(events: NormalizedEvent[]): string {
    return calendarUtils.buildIcs(events);
  }

  protected buildCsv(events: NormalizedEvent[]): string {
    return calendarUtils.buildCsv(events);
  }

  protected parseImport(name: string, content: string): CalendarEvent[] {
    return calendarUtils.parseImport(name, content);
  }

  protected persistStateToStorage(): void {
    persistCalendarState(this.storageHost());
  }

  protected loadStateFromStorage(): boolean {
    return loadCalendarState(this.storageHost());
  }

  protected persistEventsToStorage(): void {
    persistCalendarEvents(this.storageHost());
  }

  protected loadEventsFromStorage(): void {
    loadCalendarEvents(this.storageHost());
  }

  protected loadPresetsFromStorage(): void {
    loadCalendarPresets(this.storageHost());
  }

  protected persistPresets(): void {
    persistCalendarPresets(this.storageHost());
  }

  protected mergeExternalEvents(): void {
    mergeExternalCalendarEvents(this.storageHost());
  }

  protected parseNumberList(value: string): number[] | undefined {
    return calendarUtils.parseNumberList(value);
  }

  protected parseExceptions(value: string): string[] | undefined {
    return calendarUtils.parseExceptions(value);
  }

  protected buildStateKey(): string {
    return calendarUtils.buildStateKey(this.storageKey);
  }

  protected getStorageKey(suffix: string): string {
    return calendarUtils.getStorageKey(this.storageKey, suffix);
  }

  protected canStore(): boolean {
    return calendarUtils.canStoreWindow();
  }

  protected downloadFile(content: string, filename: string, type: string): void {
    downloadCalendarFile(content, filename, type);
  }
}
