export type CalendarView =
  | 'month'
  | 'week'
  | 'day'
  | 'agenda'
  | 'year'
  | 'quarter'
  | 'list'
  | 'timeline';

export type CalendarSidePanelId =
  | 'upcoming'
  | 'insights'
  | 'health'
  | 'risk'
  | 'flow'
  | 'timing'
  | 'eventMix'
  | 'status'
  | 'resources'
  | 'weekdays';

export type CalendarSidePanelPosition = 'left' | 'right';

export interface CalendarLegendItem {
  id: string;
  label: string;
  color?: string;
}

export interface CalendarInsightMetric {
  id: string;
  label: string;
  value: string;
  meta?: string;
  tone?: 'neutral' | 'good' | 'warn' | 'danger';
  empty?: boolean;
}

export interface CalendarBreakdownItem {
  id: string;
  label: string;
  count: number;
  percent: number;
  color?: string;
}

export interface CalendarEventRecurrence {
  freq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number;
  count?: number;
  until?: string | Date;
  byWeekday?: number[];
  byMonth?: number[];
  byMonthDay?: number[];
  bySetPos?: number[];
  byHour?: number[];
  byMinute?: number[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string | Date;
  end: string | Date;
  allDay?: boolean;
  type?: string;
  status?: string;
  color?: string;
  location?: string;
  meta?: string;
  description?: string;
  resourceId?: string | string[];
  layer?: string;
  timeZone?: string;
  url?: string;
  recurrence?: CalendarEventRecurrence;
  exceptions?: string[];
}

export interface CalendarResource {
  id: string;
  name: string;
  color?: string;
  group?: string;
  meta?: string;
}

export interface CalendarTemplate {
  id: string;
  label: string;
  type?: string;
  status?: string;
  allDay?: boolean;
  durationDays?: number;
  color?: string;
  location?: string;
  meta?: string;
  description?: string;
}

export interface CalendarHoliday {
  date: string | Date;
  label: string;
  color?: string;
}

export interface CalendarPolicyConfig {
  disallowWeekends?: boolean;
  disallowHolidays?: boolean;
  minNoticeDays?: number;
  maxDailyEvents?: number;
  maxConcurrentEvents?: number;
  blockedDates?: Array<string | Date>;
  allowedWeekdays?: number[];
}

export interface CalendarFilterPreset {
  id: string;
  name: string;
  view: CalendarView;
  query: string;
  type: string;
  status: string;
  resource: string;
  layer: string;
}

export interface CalendarEventChange {
  event: CalendarEvent;
  start: Date;
  end: Date;
  occurrenceId?: string;
}

export interface CalendarDay {
  date: Date;
  iso: string;
  label: string;
  inMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  events: NormalizedEvent[];
  eventHints: CalendarLegendItem[];
  moreCount: number;
  holidays: CalendarHoliday[];
}

export interface CalendarBar {
  id: string;
  title: string;
  type?: string;
  status?: string;
  startIndex: number;
  span: number;
  row: number;
  event: NormalizedEvent;
}

export interface MonthWeek {
  start: Date;
  days: CalendarDay[];
  bars: CalendarBar[];
  weekNumber: number;
}

export interface TimedEventLayout {
  event: NormalizedEvent;
  top: number;
  height: number;
  left: number;
  width: number;
}

export interface DayColumn {
  date: Date;
  timedEvents: TimedEventLayout[];
  isToday: boolean;
  isWeekend: boolean;
}

export interface WeekDay {
  date: Date;
  iso: string;
  isToday: boolean;
  isWeekend: boolean;
  holidays: CalendarHoliday[];
}

export interface YearDay {
  date: Date;
  iso: string;
  inMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  count: number;
  heat: number;
  hasHoliday: boolean;
}

export interface YearMonth {
  date: Date;
  label: string;
  days: YearDay[];
}

export interface TimelineDay {
  date: Date;
  iso: string;
  label: string;
  isToday: boolean;
  isWeekend: boolean;
  holidays: CalendarHoliday[];
}

export interface TimelineRow {
  id: string;
  name: string;
  color?: string;
  bars: CalendarBar[];
  events: NormalizedEvent[];
  eventCount: number;
}

export interface ResourceGroup {
  id: string;
  name: string;
  color?: string;
  events: NormalizedEvent[];
  allDayBars: CalendarBar[];
  timeGridDays: DayColumn[];
}

export interface CalendarListRow {
  id: string;
  title: string;
  start: string;
  end: string;
  type?: string;
  status?: string;
  resource?: string;
  layer?: string;
  meta?: string;
}

export interface NormalizedEvent {
  id: string;
  occurrenceId?: string;
  originalId: string;
  source: CalendarEvent;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  type?: string;
  status?: string;
  color?: string;
  searchText?: string;
  typeClassName?: string;
  statusClassName?: string;
  tooltipText?: string;
  rangeLabel?: string;
  location?: string;
  meta?: string;
  description?: string;
  resourceIds: string[];
  layer?: string;
  timeZone?: string;
  url?: string;
  recurrence?: CalendarEventRecurrence;
  exceptions?: string[];
  isMultiDay: boolean;
  startMinutes: number;
  endMinutes: number;
  conflict?: boolean;
  conflictCount?: number;
}

export interface EditorModel {
  id: string;
  templateId: string;
  title: string;
  allDay: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  type: string;
  status: string;
  resourceId: string;
  layer: string;
  timeZone: string;
  location: string;
  meta: string;
  description: string;
  url: string;
  exceptions: string;
  recurrenceFreq: 'none' | CalendarEventRecurrence['freq'];
  recurrenceInterval: number;
  recurrenceCount: number;
  recurrenceUntil: string;
  recurrenceWeekdays: number[];
  recurrenceByMonth: string;
  recurrenceByMonthDay: string;
  recurrenceBySetPos: string;
  recurrenceByHour: string;
  recurrenceByMinute: string;
}
