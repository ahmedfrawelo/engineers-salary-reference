import type {
  CalendarBar,
  CalendarDay,
  CalendarEvent,
  CalendarHoliday,
  CalendarLegendItem,
  CalendarResource,
  CalendarView,
  MonthWeek,
  NormalizedEvent,
  WeekDay
} from './calendar.models';

export interface CalendarViewBuildersHost {
  currentView: CalendarView;
  monthWeeks: MonthWeek[];
  anchorDate: Date;
  weekDays: WeekDay[];
  weekAllDayBars: CalendarBar[];
  timeGridDays: unknown[];
  agendaEvents: NormalizedEvent[];
  filteredEvents: NormalizedEvent[];
  maxUpcoming: number;
  upcomingEvents: NormalizedEvent[];
  searchQuery: string;
  selectedType: string;
  selectedStatus: string;
  selectedResource: string;
  selectedLayer: string;
  typeOptions: string[];
  statusOptions: string[];
  layerOptions: string[];
  resourceOptions: CalendarResource[];
  layers: string[];
  timelineSpanDays: number;
  agendaDays: number;
  maxVisiblePerDay: number;
  internalEvents: CalendarEvent[];
  addDays(date: Date, days: number): Date;
  isSameDay(a: Date, b: Date): boolean;
  toDateInput(date: Date): string;
  isToday(date: Date): boolean;
  isWeekend(date: Date): boolean;
  getHolidaysForDate(date: Date): CalendarHoliday[];
  buildBarsForRange(rangeStart: Date, rangeEnd: Date, events: NormalizedEvent[]): CalendarBar[];
  buildTimeGrid(days: WeekDay[], events: NormalizedEvent[]): unknown[];
  startOfWeek(date: Date): Date;
  endOfWeek(date: Date): Date;
  startOfDay(date: Date): Date;
  endOfDay(date: Date): Date;
  formatDate(date: Date, options: Intl.DateTimeFormatOptions): string;
  formatRange(start: Date, end: Date): string;
  parseDateInput(value: string | Date): Date;
  isDateOnly(value: string | Date | undefined): boolean;
  expandRecurrence(
    item: CalendarEvent,
    start: Date,
    end: Date,
    rangeStart: Date,
    rangeEnd: Date
  ): Array<{ start: Date; occurrenceId?: string }>;
  normalizeEvent(
    item: CalendarEvent,
    start: Date,
    end: Date,
    allDay: boolean,
    occurrenceId?: string
  ): NormalizedEvent;
  resolveResourceOptions(events: NormalizedEvent[]): CalendarResource[];
}

export function buildCalendarMonthWeeks(
  host: CalendarViewBuildersHost,
  rangeStart: Date,
  rangeEnd: Date,
  events: NormalizedEvent[]
): void {
  if (host.currentView !== 'month') {
    host.monthWeeks = [];
    return;
  }

  const weeks: MonthWeek[] = [];
  const month = host.anchorDate.getMonth();
  const eventsByDay = buildCalendarDayEventMap(host, rangeStart, rangeEnd, events);
  let cursor = new Date(rangeStart);

  while (cursor <= rangeEnd) {
    const weekStart = new Date(cursor);
    const days: CalendarDay[] = [];
    for (let i = 0; i < 7; i += 1) {
      const date = host.addDays(weekStart, i);
      const iso = host.toDateInput(date);
      const dayEvents = eventsByDay.get(iso) || [];
      days.push({
        date,
        iso,
        label: formatCalendarMonthDayLabel(host, date),
        inMonth: date.getMonth() === month,
        isToday: host.isToday(date),
        isWeekend: host.isWeekend(date),
        events: dayEvents,
        eventHints: buildCalendarDayEventHints(dayEvents),
        moreCount: Math.max(0, dayEvents.length - host.maxVisiblePerDay),
        holidays: host.getHolidaysForDate(date)
      });
    }

    weeks.push({
      start: weekStart,
      days,
      bars: [],
      weekNumber: getCalendarWeekNumber(weekStart)
    });

    cursor = host.addDays(cursor, 7);
  }

  host.monthWeeks = weeks;
}

function formatCalendarMonthDayLabel(host: CalendarViewBuildersHost, date: Date): string {
  if (date.getDate() === 1) {
    return host.formatDate(date, { month: 'short', day: 'numeric' });
  }
  return host.formatDate(date, { day: 'numeric' });
}

function buildCalendarDayEventMap(
  host: CalendarViewBuildersHost,
  rangeStart: Date,
  rangeEnd: Date,
  events: NormalizedEvent[]
): Map<string, NormalizedEvent[]> {
  const map = new Map<string, NormalizedEvent[]>();
  const safeRangeStart = host.startOfDay(rangeStart);
  const safeRangeEnd = host.startOfDay(rangeEnd);

  for (const event of events) {
    if (event.end < rangeStart || event.start > rangeEnd) {
      continue;
    }
    let cursor = host.startOfDay(event.start < rangeStart ? rangeStart : event.start);
    const last = host.startOfDay(event.end > rangeEnd ? rangeEnd : event.end);
    if (cursor < safeRangeStart) {
      cursor = new Date(safeRangeStart);
    }

    while (cursor <= last && cursor <= safeRangeEnd) {
      const iso = host.toDateInput(cursor);
      const list = map.get(iso);
      if (list) {
        list.push(event);
      } else {
        map.set(iso, [event]);
      }
      cursor = host.addDays(cursor, 1);
    }
  }

  for (const list of map.values()) {
    list.sort(compareCalendarEvents);
  }

  return map;
}

function buildCalendarDayEventHints(events: NormalizedEvent[]): CalendarLegendItem[] {
  const hints = new Map<string, CalendarLegendItem>();

  for (const event of events) {
    const label = (event.type || event.status || event.title || '').trim();
    if (!label) {
      continue;
    }
    const id = label.toLowerCase();
    if (hints.has(id)) {
      continue;
    }
    hints.set(id, {
      id,
      label,
      color: event.color
    });
    if (hints.size >= 3) {
      break;
    }
  }

  return Array.from(hints.values());
}

function compareCalendarEvents(a: NormalizedEvent, b: NormalizedEvent): number {
  if (a.allDay !== b.allDay) {
    return a.allDay ? -1 : 1;
  }
  const diff = a.start.getTime() - b.start.getTime();
  if (diff !== 0) {
    return diff;
  }
  return a.title.localeCompare(b.title);
}

function getCalendarWeekNumber(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target.getTime() - firstThursday.getTime();
  return 1 + Math.round(diff / 604800000);
}

export function buildCalendarWeekDays(
  host: CalendarViewBuildersHost,
  rangeStart: Date,
  rangeEnd: Date,
  events: NormalizedEvent[]
): void {
  if (host.currentView !== 'week' && host.currentView !== 'day') {
    host.weekDays = [];
    host.weekAllDayBars = [];
    host.timeGridDays = [];
    return;
  }

  const days: WeekDay[] = [];
  let cursor = new Date(rangeStart);
  while (cursor <= rangeEnd) {
    days.push({
      date: new Date(cursor),
      iso: host.toDateInput(cursor),
      isToday: host.isToday(cursor),
      isWeekend: host.isWeekend(cursor),
      holidays: host.getHolidaysForDate(cursor)
    });
    cursor = host.addDays(cursor, 1);
  }

  host.weekDays = days;
  const allDayEvents: NormalizedEvent[] = [];
  const timedEvents: NormalizedEvent[] = [];
  for (const event of events) {
    if (event.allDay) {
      allDayEvents.push(event);
    } else {
      timedEvents.push(event);
    }
  }
  host.weekAllDayBars = host.buildBarsForRange(rangeStart, rangeEnd, allDayEvents);
  host.timeGridDays = host.buildTimeGrid(days, timedEvents);
}

export function buildCalendarAgenda(
  host: CalendarViewBuildersHost,
  rangeStart: Date,
  rangeEnd: Date,
  events: NormalizedEvent[]
): void {
  if (host.currentView !== 'agenda') {
    host.agendaEvents = [];
    return;
  }

  host.agendaEvents = events
    .filter(ev => ev.start <= rangeEnd && ev.end >= rangeStart)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function buildCalendarUpcoming(host: CalendarViewBuildersHost): void {
  if (!host.maxUpcoming) {
    host.upcomingEvents = [];
    return;
  }

  const today = host.startOfDay(new Date());
  host.upcomingEvents = host.filteredEvents
    .filter(ev => ev.end >= today)
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, host.maxUpcoming);
}

export function getCalendarViewRange(host: CalendarViewBuildersHost): { start: Date; end: Date } {
  if (host.currentView === 'month') {
    const first = new Date(host.anchorDate.getFullYear(), host.anchorDate.getMonth(), 1);
    const last = new Date(host.anchorDate.getFullYear(), host.anchorDate.getMonth() + 1, 0);
    return { start: host.startOfWeek(first), end: host.endOfWeek(last) };
  }
  if (host.currentView === 'week') {
    return { start: host.startOfWeek(host.anchorDate), end: host.endOfWeek(host.anchorDate) };
  }
  if (host.currentView === 'day') {
    return { start: host.startOfDay(host.anchorDate), end: host.endOfDay(host.anchorDate) };
  }
  if (host.currentView === 'year') {
    return {
      start: new Date(host.anchorDate.getFullYear(), 0, 1),
      end: new Date(host.anchorDate.getFullYear(), 11, 31, 23, 59, 59, 999)
    };
  }
  if (host.currentView === 'quarter') {
    const quarterIndex = Math.floor(host.anchorDate.getMonth() / 3);
    const startMonth = quarterIndex * 3;
    return {
      start: new Date(host.anchorDate.getFullYear(), startMonth, 1),
      end: host.endOfDay(new Date(host.anchorDate.getFullYear(), startMonth + 3, 0))
    };
  }
  if (host.currentView === 'timeline') {
    const start = host.startOfDay(host.anchorDate);
    return {
      start,
      end: host.endOfDay(host.addDays(start, Math.max(1, host.timelineSpanDays) - 1))
    };
  }

  const start = host.startOfDay(host.anchorDate);
  return {
    start,
    end: host.endOfDay(host.addDays(start, Math.max(1, host.agendaDays) - 1))
  };
}

export function buildCalendarSubtitle(
  host: CalendarViewBuildersHost,
  start: Date,
  end: Date
): string {
  if (host.currentView === 'month') {
    return host.formatDate(host.anchorDate, { month: 'long', year: 'numeric' });
  }
  if (host.currentView === 'day') {
    return host.formatDate(host.anchorDate, { weekday: 'long', month: 'long', day: 'numeric' });
  }
  if (host.currentView === 'year') {
    return host.formatDate(host.anchorDate, { year: 'numeric' });
  }
  if (host.currentView === 'quarter') {
    const quarter = Math.floor(host.anchorDate.getMonth() / 3) + 1;
    return `Q${quarter} ${host.anchorDate.getFullYear()}`;
  }
  return host.formatRange(start, end);
}

export function buildCalendarNormalizedEvents(
  host: CalendarViewBuildersHost,
  rangeStart: Date,
  rangeEnd: Date
): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];

  for (const item of host.internalEvents) {
    const baseStart = host.parseDateInput(item.start);
    const baseEnd = item.end ? host.parseDateInput(item.end) : baseStart;
    const allDay = item.allDay ?? (host.isDateOnly(item.start) && host.isDateOnly(item.end));

    const safeStart = allDay ? host.startOfDay(baseStart) : baseStart;
    const rawEnd = allDay ? host.endOfDay(baseEnd) : baseEnd;
    const safeEnd = rawEnd >= safeStart ? rawEnd : safeStart;
    const duration = Math.max(0, safeEnd.getTime() - safeStart.getTime());

    const occurrences = host.expandRecurrence(item, safeStart, safeEnd, rangeStart, rangeEnd);
    for (const occurrence of occurrences) {
      const occStart = occurrence.start;
      const occEnd = new Date(occStart.getTime() + duration);
      if (occEnd < rangeStart || occStart > rangeEnd) {
        continue;
      }
      events.push(host.normalizeEvent(item, occStart, occEnd, allDay, occurrence.occurrenceId));
    }
  }

  return events.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function applyCalendarFilters(
  host: CalendarViewBuildersHost,
  events: NormalizedEvent[]
): NormalizedEvent[] {
  const query = host.searchQuery.trim().toLowerCase();
  const typeFilter = host.selectedType.toLowerCase();
  const statusFilter = host.selectedStatus.toLowerCase();
  const resourceFilter = host.selectedResource.toLowerCase();
  const layerFilter = host.selectedLayer.toLowerCase();

  return events.filter(ev => {
    if (typeFilter !== 'all' && (ev.type || '').toLowerCase() !== typeFilter) {
      return false;
    }
    if (statusFilter !== 'all' && (ev.status || '').toLowerCase() !== statusFilter) {
      return false;
    }
    if (resourceFilter !== 'all') {
      const match = ev.resourceIds.some(id => id.toLowerCase() === resourceFilter);
      if (!match) {
        return false;
      }
    }
    if (layerFilter !== 'all' && (ev.layer || '').toLowerCase() !== layerFilter) {
      return false;
    }
    if (!query) {
      return true;
    }

    return getCalendarEventSearchText(ev).includes(query);
  });
}

function getCalendarEventSearchText(event: NormalizedEvent): string {
  if (event.searchText) {
    return event.searchText;
  }
  return [
    event.title,
    event.type,
    event.status,
    event.location,
    event.meta,
    event.description,
    event.layer,
    event.resourceIds.join(' ')
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function updateCalendarFilterOptions(
  host: CalendarViewBuildersHost,
  events: NormalizedEvent[]
): void {
  const types = new Set<string>();
  const statuses = new Set<string>();
  const layers = new Set<string>();

  events.forEach(ev => {
    if (ev.type) types.add(ev.type);
    if (ev.status) statuses.add(ev.status);
    if (ev.layer) layers.add(ev.layer);
  });

  host.typeOptions = Array.from(types).sort();
  host.statusOptions = Array.from(statuses).sort();
  host.layerOptions = (host.layers?.length ? host.layers : Array.from(layers)).sort();
  host.resourceOptions = host.resolveResourceOptions(events);

  if (host.selectedType !== 'all' && !host.typeOptions.includes(host.selectedType)) {
    host.selectedType = 'all';
  }
  if (host.selectedStatus !== 'all' && !host.statusOptions.includes(host.selectedStatus)) {
    host.selectedStatus = 'all';
  }
  if (host.selectedLayer !== 'all' && !host.layerOptions.includes(host.selectedLayer)) {
    host.selectedLayer = 'all';
  }
  if (
    host.selectedResource !== 'all' &&
    !host.resourceOptions.some(item => item.id === host.selectedResource)
  ) {
    host.selectedResource = 'all';
  }
}
