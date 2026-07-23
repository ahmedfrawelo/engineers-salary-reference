import {
  Directive,
  HostListener,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges
} from '@angular/core';
import type { CdkDragDrop } from '@angular/cdk/drag-drop';
import type {
  CalendarBar,
  CalendarBreakdownItem,
  CalendarDay,
  CalendarEvent,
  CalendarEventChange,
  CalendarEventRecurrence,
  CalendarFilterPreset,
  CalendarHoliday,
  CalendarInsightMetric,
  CalendarResource,
  CalendarSidePanelId,
  CalendarSidePanelPosition,
  CalendarTemplate,
  CalendarView,
  DayColumn,
  EditorModel,
  MonthWeek,
  NormalizedEvent,
  ResourceGroup,
  TimedEventLayout,
  TimelineDay,
  TimelineRow,
  WeekDay,
  YearDay,
  YearMonth
} from './calendar.models';
import * as calendarUtils from './calendar.utils';
import * as calendarRecurrence from './calendar.component.recurrence';
import * as calendarList from './calendar.component.list';
import * as calendarSettings from './calendar.component.settings';
import * as calendarResources from './calendar.component.resources';
import { CalendarComponentInfrastructureBase } from './calendar.component.infrastructure.base';

@Directive()
export class CalendarComponentPresenter
  extends CalendarComponentInfrastructureBase
  implements OnInit, OnChanges, OnDestroy
{
  private calendarFilterFrameId: number | null = null;
  private calendarFilterRefreshPending = false;
  private readonly calendarTypeClassCache = new Map<string, string>();
  private readonly calendarStatusClassCache = new Map<string, string>();
  private calendarTooltipCache = new WeakMap<NormalizedEvent, string>();
  private calendarResourceNameCacheSource: CalendarResource[] | null = null;
  private calendarResourceNameCache = new Map<string, string>();
  private calendarResourceColorCacheSource: CalendarResource[] | null = null;
  private calendarResourceColorCache = new Map<string, string | undefined>();
  private weekdayLabelsCacheKey = '';
  private weekdayLabelsCache: string[] = [];
  private holidayMapCacheSource: readonly CalendarHoliday[] | null = null;
  private holidayMapCacheEnabled = false;
  private holidayMapCache = new Map<string, CalendarHoliday[]>();
  private lastRangeChangeKey = '';
  private lastInitialDateInputKey = '';
  private initialDateAnchorApplied = false;
  private userControlledAnchor = false;
  private selectionDocumentListenersAttached = false;
  private readonly selectionDocumentPointerMoveHandler = (event: PointerEvent) =>
    this.onDocumentPointerMove(event);
  private readonly selectionDocumentPointerUpHandler = () => this.onDocumentPointerUp();
  private readonly sidePanelPositionPointerMoveHandler = (event: PointerEvent) =>
    this.onCalendarSidePanelPositionPointerMove(event);
  private readonly sidePanelPositionPointerUpHandler = (event: PointerEvent) =>
    this.onCalendarSidePanelPositionPointerUp(event);
  private readonly sidePanelResizePointerMoveHandler = (event: PointerEvent) =>
    this.onCalendarSidePanelResizePointerMove(event);
  private readonly sidePanelResizePointerUpHandler = () => this.onCalendarSidePanelResizePointerUp();
  private sidePanelPositionDragBounds: DOMRect | null = null;
  private sidePanelResizeStartX = 0;
  private sidePanelResizeStartWidth = 0;
  private readonly legacySidePanelDefaultWidth = 332;

  ngOnInit(): void {
    this.currentView = this.view;
    this.internalEvents = Array.isArray(this.events) ? [...this.events] : [];
    this.localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    this.resolvedTimeZones = this.getTimeZones();
    this.updateTimeGridMetrics();
    this.buildWeekdayOptions();
    this.userControlledAnchor = this.loadStateFromStorage();
    this.syncCurrentViewWithOptions();
    if (!this.userControlledAnchor) {
      this.applyInitialDateInput(this.initialDate);
    }
    this.calendarSidePanelWidth = this.getCalendarSidePanelWidthBounds().defaultWidth;
    this.setCalendarSidePanelPosition(this.sidePanelPosition);
    this.loadCalendarSidePanelOrder();
    this.loadCalendarSidePanelPosition();
    this.loadCalendarSidePanelWidth();
    this.loadCalendarSidePanelCollapsedState();
    this.loadCalendarSidePanelHiddenState();
    this.loadPresetsFromStorage();
    this.loadEventsFromStorage();
    this.refreshCalendar();
    this.initialized = true;
  }
  ngOnDestroy(): void {
    this.cancelCalendarFilterRefresh();
    this.detachSelectionDocumentListeners();
    this.detachCalendarSidePanelPositionDragListeners();
    this.detachCalendarSidePanelResizeListeners();
    this.stopNowTicker();
  }
  ngOnChanges(changes: SimpleChanges): void {
    if (!this.initialized) {
      return;
    }
    if (changes['view'] && changes['view'].currentValue) {
      this.currentView = changes['view'].currentValue as CalendarView;
    }
    if (changes['view'] || changes['viewOptions']) {
      this.syncCurrentViewWithOptions();
    }
    if (changes['initialDate'] && !this.userControlledAnchor && !this.initialDateAnchorApplied) {
      this.applyInitialDateInput(changes['initialDate'].currentValue);
    }
    if (changes['events']) {
      if (!this.persistEvents || !this.internalEvents.length) {
        this.internalEvents = Array.isArray(this.events) ? [...this.events] : [];
      } else {
        this.mergeExternalEvents();
      }
    }
    if (
      changes['timeSlotMinutes'] ||
      changes['startHour'] ||
      changes['endHour'] ||
      changes['workStartHour'] ||
      changes['workEndHour']
    ) {
      this.updateTimeGridMetrics();
    }
    if (changes['weekStart'] || changes['locale']) {
      this.buildWeekdayOptions();
    }
    if (changes['resources'] || changes['layers']) {
      this.selectedResource = 'all';
      this.selectedLayer = 'all';
    }
    if (changes['sidePanelPosition']) {
      this.setCalendarSidePanelPosition(changes['sidePanelPosition'].currentValue);
      this.persistCalendarSidePanelPosition();
    }
    if (changes['policy']) {
      this.policyWarnings = [];
    }
    this.refreshCalendar();
  }
  private applyInitialDateInput(value: string | Date | null | undefined): void {
    const inputKey = this.normalizeInitialDateInputKey(value);
    if (inputKey === this.lastInitialDateInputKey) {
      return;
    }
    this.lastInitialDateInputKey = inputKey;
    if (!value || !inputKey) {
      return;
    }

    const nextAnchor = this.startOfDay(this.parseDateInput(value));
    if (!Number.isFinite(nextAnchor.getTime()) || this.isSameDay(this.anchorDate, nextAnchor)) {
      this.initialDateAnchorApplied = true;
      return;
    }
    this.anchorDate = nextAnchor;
    this.initialDateAnchorApplied = true;
  }

  private normalizeInitialDateInputKey(value: string | Date | null | undefined): string {
    if (!value) {
      return '';
    }
    if (value instanceof Date) {
      return Number.isFinite(value.getTime()) ? this.toDateInput(this.startOfDay(value)) : '';
    }
    return value.trim();
  }

  private resolveCalendarWeekdayLabels(): string[] {
    const cacheKey = [this.locale, this.selectedTimeZone, this.weekStart].join('|');
    if (this.weekdayLabelsCacheKey === cacheKey) {
      return this.weekdayLabelsCache;
    }
    this.weekdayLabelsCacheKey = cacheKey;
    this.weekdayLabelsCache = this.buildWeekdayLabels();
    return this.weekdayLabelsCache;
  }

  private resolveCalendarHolidayMap(): Map<string, CalendarHoliday[]> {
    if (
      this.holidayMapCacheSource === this.holidays &&
      this.holidayMapCacheEnabled === this.showHolidays
    ) {
      return this.holidayMapCache;
    }
    this.holidayMapCacheSource = this.holidays;
    this.holidayMapCacheEnabled = this.showHolidays;
    this.holidayMapCache = this.buildHolidayMap();
    return this.holidayMapCache;
  }

  private isViewOptionEnabled(view: CalendarView | null | undefined): view is CalendarView {
    return (
      !!view &&
      (!Array.isArray(this.viewOptions) || !this.viewOptions.length || this.viewOptions.includes(view))
    );
  }

  private syncCurrentViewWithOptions(): void {
    if (this.isViewOptionEnabled(this.currentView)) {
      return;
    }
    if (this.isViewOptionEnabled(this.view)) {
      this.currentView = this.view;
      return;
    }
    this.currentView = this.viewOptions.find(option => this.isViewOptionEnabled(option)) || 'month';
  }

  setView(view: CalendarView): void {
    if (!this.isViewOptionEnabled(view) || this.currentView === view) {
      return;
    }
    this.currentView = view;
    this.refreshCalendar();
  }
  applyPreset(presetId: string): void {
    const preset = this.presets.find(item => item.id === presetId);
    if (!preset) {
      return;
    }
    this.currentView = preset.view;
    this.searchQuery = preset.query;
    this.selectedType = preset.type || 'all';
    this.selectedStatus = preset.status || 'all';
    this.selectedResource = preset.resource || 'all';
    this.selectedLayer = preset.layer || 'all';
    this.presetChange.emit(preset);
    this.refreshCalendar();
  }

  savePreset(): void {
    const name = `${this.viewLabels[this.currentView] || this.currentView} - ${this.selectedType}/${this.selectedStatus}`;
    const preset: CalendarFilterPreset = {
      id: this.selectedPresetId || `preset-${Date.now()}`,
      name,
      view: this.currentView,
      query: this.searchQuery,
      type: this.selectedType,
      status: this.selectedStatus,
      resource: this.selectedResource,
      layer: this.selectedLayer
    };
    const existingIndex = this.presets.findIndex(item => item.id === preset.id);
    if (existingIndex >= 0) {
      this.presets[existingIndex] = preset;
    } else {
      this.presets = [preset, ...this.presets];
      this.selectedPresetId = preset.id;
    }
    this.persistPresets();
  }

  deletePreset(): void {
    if (!this.selectedPresetId) {
      return;
    }
    this.presets = this.presets.filter(item => item.id !== this.selectedPresetId);
    this.selectedPresetId = '';
    this.persistPresets();
  }

  exportIcs(): void {
    const payload = this.buildIcs(this.filteredEvents);
    this.eventsExport.emit({ type: 'ics', payload });
    this.downloadFile(payload, 'calendar.ics', 'text/calendar');
  }

  exportCsv(): void {
    const payload = this.buildCsv(this.filteredEvents);
    this.eventsExport.emit({ type: 'csv', payload });
    this.downloadFile(payload, 'calendar.csv', 'text/csv');
  }

  onImport(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    if (!input?.files?.length) {
      return;
    }
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const parsed = this.parseImport(file.name, text);
      if (parsed.length) {
        this.internalEvents = [...parsed, ...this.internalEvents];
        this.eventsImport.emit(parsed);
        this.persistEventsToStorage();
        this.refreshCalendar();
      }
      input.value = '';
    };
    reader.readAsText(file);
  }

  applyTemplate(templateId: string): void {
    const template = this.eventTemplates.find(item => item.id === templateId);
    if (!template) {
      return;
    }
    if (!this.editorModel.title) {
      this.editorModel.title = template.label;
    }
    this.editorModel.type = template.type || this.editorModel.type;
    this.editorModel.status = template.status || this.editorModel.status;
    this.editorModel.allDay = template.allDay ?? this.editorModel.allDay;
    this.editorModel.location = template.location || this.editorModel.location;
    this.editorModel.meta = template.meta || this.editorModel.meta;
    this.editorModel.description = template.description || this.editorModel.description;
    if (template.color) {
      this.editorModel.meta = this.editorModel.meta || `Color: ${template.color}`;
    }
    if (template.durationDays) {
      const start = this.parseDateInput(this.editorModel.startDate);
      const end = this.addDays(start, Math.max(0, template.durationDays - 1));
      this.editorModel.endDate = this.toDateInput(end);
    }
  }

  applyQuickAdd(): void {
    const text = this.quickAddText.trim();
    if (!text) {
      return;
    }
    const parsed = this.parseQuickAdd(text);
    if (!parsed) {
      this.openEditorForDate(this.anchorDate);
      this.editorModel.title = text;
      this.quickAddText = '';
      return;
    }
    if (parsed.allDay) {
      this.openEditorForDateRange(parsed.start, parsed.end);
    } else {
      this.openEditorForDateTime(
        parsed.start,
        parsed.end,
        this.selectedResource !== 'all' ? this.selectedResource : undefined
      );
    }
    this.editorModel.title = parsed.title;
    this.quickAddText = '';
  }

  jumpFromYear(date: Date): void {
    this.userControlledAnchor = true;
    this.anchorDate = this.startOfDay(date);
    this.currentView = 'month';
    this.refreshCalendar();
  }

  shiftCalendar(step: number): void {
    this.userControlledAnchor = true;
    const amount = Math.sign(step) || 1;
    if (this.currentView === 'month') {
      this.anchorDate = this.addMonths(this.anchorDate, amount);
    } else if (this.currentView === 'week') {
      this.anchorDate = this.addDays(this.anchorDate, amount * 7);
    } else if (this.currentView === 'day') {
      this.anchorDate = this.addDays(this.anchorDate, amount);
    } else if (this.currentView === 'year') {
      this.anchorDate = this.addYears(this.anchorDate, amount);
    } else if (this.currentView === 'quarter') {
      this.anchorDate = this.addMonths(this.anchorDate, amount * 3);
    } else if (this.currentView === 'list') {
      this.anchorDate = this.addDays(this.anchorDate, amount * this.agendaDays);
    } else if (this.currentView === 'timeline') {
      this.anchorDate = this.addDays(this.anchorDate, amount * this.timelineSpanDays);
    } else {
      this.anchorDate = this.addDays(this.anchorDate, amount * 7);
    }
    this.refreshCalendar();
  }

  goToToday(): void {
    this.userControlledAnchor = true;
    this.anchorDate = this.startOfDay(new Date());
    this.refreshCalendar();
  }

  setAnchor(date: Date): void {
    this.userControlledAnchor = true;
    this.anchorDate = this.startOfDay(date);
    this.refreshCalendar();
  }

  onJumpDateChange(value: string): void {
    if (!value) {
      return;
    }
    this.setAnchor(this.parseDateInput(value));
  }

  onTimeZoneChange(value: string): void {
    this.selectedTimeZone = value || '';
    this.timeZoneChange.emit(this.selectedTimeZone);
    this.refreshCalendar();
  }

  onCalendarSearchInput(value: string): void {
    this.searchQuery = value ?? '';
    this.scheduleCalendarFilterRefresh();
  }

  onCalendarFilterChange(): void {
    this.refreshCalendar();
  }

  refreshCalendar(): void {
    this.syncCurrentViewWithOptions();
    this.calendarTooltipCache = new WeakMap<NormalizedEvent, string>();
    this.calendarWeekdayLabels = this.resolveCalendarWeekdayLabels();
    this.holidayMap = this.resolveCalendarHolidayMap();
    const range = this.getViewRange();
    this.calendarSubtitle = this.subtitle || this.buildSubtitle(range.start, range.end);
    this.jumpDate = this.toDateInput(this.anchorDate);

    const windowStart = this.addDays(range.start, -14);
    const windowEnd = this.addDays(range.end, Math.max(14, this.agendaDays));
    this.normalizedEvents = this.buildNormalizedEvents(windowStart, windowEnd);
    this.updateFilterOptions(this.normalizedEvents);
    this.filteredEvents = this.applyFilters(this.normalizedEvents);
    if (this.showConflicts) {
      this.filteredEvents = this.markConflicts(this.filteredEvents);
    }
    this.decorateNormalizedEvents(this.filteredEvents);

    this.buildMonthWeeks(range.start, range.end, this.filteredEvents);
    this.buildWeekDays(range.start, range.end, this.filteredEvents);
    this.buildAgenda(range.start, range.end, this.filteredEvents);
    this.buildYearView(range.start);
    this.buildQuarterView(range.start);
    this.buildTimeline(range.start, range.end, this.filteredEvents);
    this.buildListRows();
    this.buildResourceGroups(range.start, range.end);
    this.buildCalendarInsights(range.start, range.end, this.filteredEvents);
    this.buildUpcoming();
    this.refreshCalendarSidePanelSummary();
    this.syncCalendarSidePanelItems();
    this.updateNowIndicator(range.start, range.end);

    this.listConfig = { ...this.listConfig, rtl: this.rtl };
    this.persistStateToStorage();
    this.syncNowTicker();
    this.emitRangeChange(range.start, range.end);
  }

  private emitRangeChange(start: Date, end: Date): void {
    const key = `${start.getTime()}:${end.getTime()}`;
    if (this.lastRangeChangeKey === key) {
      return;
    }
    this.lastRangeChangeKey = key;
    this.rangeChange.emit({ start, end });
  }

  private buildCalendarInsights(
    rangeStart: Date,
    rangeEnd: Date,
    events: NormalizedEvent[]
  ): void {
    const rangeEvents: NormalizedEvent[] = [];
    const activeDays = new Set<string>();
    const dayCounts = new Map<string, number>();
    const timingLabels = new WeakMap<NormalizedEvent, string>();
    const today = this.startOfDay(new Date());
    const nextWeekEnd = this.endOfDay(this.addDays(today, 7));
    let conflicts = 0;
    let unassigned = 0;
    let dueSoon = 0;
    let overdue = 0;
    let multiDay = 0;
    let completed = 0;

    for (const event of events) {
      const timingLabel = this.calendarTimingLabel(event, today, nextWeekEnd);
      timingLabels.set(event, timingLabel);
      if (event.end >= today && event.start <= nextWeekEnd) {
        dueSoon += 1;
      }
      if (event.end < today) {
        overdue += 1;
      }
      if (event.end < rangeStart || event.start > rangeEnd) {
        continue;
      }

      rangeEvents.push(event);
      if (event.conflict) {
        conflicts += 1;
      }
      if (!event.resourceIds.length) {
        unassigned += 1;
      }
      if (event.isMultiDay) {
        multiDay += 1;
      }
      if (this.isCalendarCompletedStatus(event.status)) {
        completed += 1;
      }
      const start = event.start < rangeStart ? rangeStart : event.start;
      const end = event.end > rangeEnd ? rangeEnd : event.end;
      let cursor = this.startOfDay(start);
      const last = this.startOfDay(end);
      while (cursor <= last) {
        const iso = this.toDateInput(cursor);
        activeDays.add(iso);
        dayCounts.set(iso, (dayCounts.get(iso) || 0) + 1);
        cursor = this.addDays(cursor, 1);
      }
    }

    let busiestDayLabel = 'No load';
    let busiestDayCount = 0;
    for (const [iso, count] of dayCounts) {
      if (count > busiestDayCount) {
        busiestDayCount = count;
        busiestDayLabel = this.formatDate(this.parseDateInput(iso), {
          month: 'short',
          day: 'numeric'
        });
      }
    }

    const rangeDays = Math.max(1, this.daysBetween(this.startOfDay(rangeStart), this.startOfDay(rangeEnd)) + 1);
    const coveragePercent = Math.round((activeDays.size / rangeDays) * 100);
    const averagePerActiveDayValue = activeDays.size ? rangeEvents.length / activeDays.size : 0;
    const averagePerActiveDay = averagePerActiveDayValue.toFixed(1);
    const averagePerRangeDay = (rangeEvents.length / rangeDays).toFixed(1);
    const attention = conflicts + overdue;
    const open = Math.max(0, rangeEvents.length - completed);
    const completionPercent = rangeEvents.length
      ? Math.round((completed / rangeEvents.length) * 100)
      : 0;
    const riskPercent = rangeEvents.length
      ? Math.round(((attention + unassigned) / rangeEvents.length) * 100)
      : 0;
    const heavyDayLimit = Math.max(2, Math.ceil(averagePerActiveDayValue));
    const heavyDays = Array.from(dayCounts.values()).filter(count => count >= heavyDayLimit).length;
    const riskScore = attention + unassigned + heavyDays;

    this.calendarInsightRangeLabel = this.formatRange(rangeStart, rangeEnd);
    this.calendarInsightMetrics = [
      {
        id: 'attention',
        label: 'Attention',
        value: String(attention),
        meta: attention ? 'Conflicts or overdue' : 'Clear',
        tone: attention ? 'danger' : 'good',
        empty: attention === 0
      },
      {
        id: 'events',
        label: 'Events',
        value: String(rangeEvents.length),
        meta: 'Visible range',
        empty: rangeEvents.length === 0
      },
      {
        id: 'active-days',
        label: 'Active days',
        value: String(activeDays.size),
        meta: `${rangeEvents.length} scheduled`,
        tone: activeDays.size ? 'good' : 'neutral',
        empty: activeDays.size === 0
      },
      {
        id: 'busiest',
        label: 'Busiest day',
        value: String(busiestDayCount),
        meta: busiestDayLabel,
        empty: busiestDayCount === 0
      },
      {
        id: 'conflicts',
        label: 'Conflicts',
        value: String(conflicts),
        meta: conflicts ? 'Needs review' : 'Clear',
        tone: conflicts ? 'danger' : 'good',
        empty: conflicts === 0
      },
      {
        id: 'unassigned',
        label: 'Unassigned',
        value: String(unassigned),
        meta: this.resourceLabel,
        empty: unassigned === 0
      }
    ];
    this.calendarHealthMetrics = [
      {
        id: 'coverage',
        label: 'Coverage',
        value: `${coveragePercent}%`,
        meta: `${activeDays.size}/${rangeDays} active days`,
        tone: activeDays.size ? 'good' : 'neutral',
        empty: activeDays.size === 0
      },
      {
        id: 'avg-active-day',
        label: 'Avg / active day',
        value: averagePerActiveDay,
        meta: 'Workload density',
        tone: Number(averagePerActiveDay) > 4 ? 'warn' : 'neutral',
        empty: Number(averagePerActiveDay) === 0
      },
      {
        id: 'due-soon',
        label: 'Due soon',
        value: String(dueSoon),
        meta: 'Next 7 days',
        tone: dueSoon ? 'warn' : 'good',
        empty: dueSoon === 0
      },
      {
        id: 'overdue',
        label: 'Overdue',
        value: String(overdue),
        meta: overdue ? 'Past due' : 'Clear',
        tone: overdue ? 'danger' : 'good',
        empty: overdue === 0
      },
      {
        id: 'multi-day',
        label: 'Multi-day',
        value: String(multiDay),
        meta: 'Spanning items',
        empty: multiDay === 0
      }
    ];
    this.calendarRiskMetrics = [
      {
        id: 'risk-score',
        label: 'Risk score',
        value: String(riskScore),
        meta: riskScore ? 'Needs control' : 'Stable',
        tone: riskScore ? (riskScore > 8 ? 'danger' : 'warn') : 'good',
        empty: riskScore === 0
      },
      {
        id: 'risk-rate',
        label: 'Risk rate',
        value: `${riskPercent}%`,
        meta: 'Attention + unassigned',
        tone: riskPercent > 25 ? 'danger' : riskPercent > 0 ? 'warn' : 'good',
        empty: riskPercent === 0
      },
      {
        id: 'heavy-days',
        label: 'Heavy days',
        value: String(heavyDays),
        meta: `${heavyDayLimit}+ items/day`,
        tone: heavyDays ? 'warn' : 'good',
        empty: heavyDays === 0
      },
      {
        id: 'unassigned-risk',
        label: 'Unassigned',
        value: String(unassigned),
        meta: this.resourceLabel,
        tone: unassigned ? 'warn' : 'good',
        empty: unassigned === 0
      }
    ];
    this.calendarFlowMetrics = [
      {
        id: 'open',
        label: 'Open',
        value: String(open),
        meta: `${completionPercent}% completed`,
        tone: open ? 'neutral' : 'good',
        empty: open === 0
      },
      {
        id: 'completed',
        label: 'Completed',
        value: String(completed),
        meta: 'Visible range',
        tone: completed ? 'good' : 'neutral',
        empty: completed === 0
      },
      {
        id: 'daily-load',
        label: 'Daily load',
        value: averagePerRangeDay,
        meta: 'Across range',
        tone: Number(averagePerRangeDay) > 2 ? 'warn' : 'neutral',
        empty: rangeEvents.length === 0
      },
      {
        id: 'spanning-flow',
        label: 'Spanning',
        value: String(multiDay),
        meta: 'Cross-day items',
        tone: multiDay ? 'warn' : 'neutral',
        empty: multiDay === 0
      }
    ];
    this.calendarTypeBreakdown = this.buildCalendarBreakdown(
      rangeEvents,
      event => event.type || 'Uncategorized',
      event => event.color
    );
    this.calendarTimingBreakdown = this.buildCalendarBreakdown(
      events,
      event => timingLabels.get(event) || 'Upcoming',
      event => this.calendarTimingColor(timingLabels.get(event) || 'Upcoming')
    );
    this.calendarStatusBreakdown = this.buildCalendarBreakdown(
      rangeEvents,
      event => event.status || 'No status',
      event => this.calendarStatusColor(event.status)
    );
    const resourceNames = this.resourceNameMap();
    const resourceColors = this.resourceColorMap();
    this.calendarResourceBreakdown = this.buildCalendarBreakdown(
      rangeEvents,
      event =>
        event.resourceIds.length
          ? event.resourceIds.map(id => resourceNames.get(id) || id).join(', ')
          : 'Unassigned',
      event => resourceColors.get(event.resourceIds[0] || '')
    );
    this.calendarWeekdayBreakdown = this.buildCalendarWeekdayBreakdown(dayCounts);
  }

  onCalendarSidePanelDrop(event: CdkDragDrop<CalendarSidePanelId[]>): void {
    const previousIndex = event.previousIndex;
    const currentIndex = event.currentIndex;
    if (previousIndex === currentIndex || previousIndex < 0 || currentIndex < 0) {
      return;
    }

    const nextVisible = [...this.calendarSidePanelItems];
    const [moved] = nextVisible.splice(previousIndex, 1);
    if (!moved) {
      return;
    }
    nextVisible.splice(currentIndex, 0, moved);

    const visibleSet = new Set(nextVisible);
    const hiddenItems = this.calendarSidePanelOrder.filter(item => !visibleSet.has(item));
    this.calendarSidePanelOrder = [...nextVisible, ...hiddenItems];
    this.calendarSidePanelItems = nextVisible;
    this.persistCalendarSidePanelOrder();
  }

  resetCalendarSidePanelOrder(event?: Event): void {
    event?.stopPropagation();
    this.calendarSidePanelOrder = [...this.defaultCalendarSidePanelOrder];
    this.calendarSidePanelWidth = this.getCalendarSidePanelWidthBounds().defaultWidth;
    this.resetCalendarSidePanelCollapsedState();
    this.resetCalendarSidePanelHiddenState();
    this.calendarSidePanelPickerOpen = false;
    this.syncCalendarSidePanelItems();
    this.persistCalendarSidePanelOrder();
    this.persistCalendarSidePanelCollapsedState();
    this.persistCalendarSidePanelHiddenState();
    this.persistCalendarSidePanelWidth();
  }

  toggleCalendarSidePanelCollapsed(item: CalendarSidePanelId, event?: Event): void {
    event?.stopPropagation();
    this.calendarSidePanelCollapsedState = {
      ...this.calendarSidePanelCollapsedState,
      [item]: !this.calendarSidePanelCollapsedState[item]
    };
    this.updateCalendarSidePanelCollapseState();
    this.persistCalendarSidePanelCollapsedState();
  }

  collapseAllCalendarSidePanelItems(event?: Event): void {
    event?.stopPropagation();
    this.setCalendarSidePanelItemsCollapsed(true);
  }

  expandAllCalendarSidePanelItems(event?: Event): void {
    event?.stopPropagation();
    this.setCalendarSidePanelItemsCollapsed(false);
  }

  toggleCalendarSidePanelPicker(event?: Event): void {
    event?.stopPropagation();
    this.calendarSidePanelPickerOpen = !this.calendarSidePanelPickerOpen;
  }

  toggleCalendarSidePanelVisibility(item: CalendarSidePanelId, event?: Event): void {
    event?.stopPropagation();
    if (!this.isCalendarSidePanelVisible(item)) {
      return;
    }
    this.calendarSidePanelHiddenState = {
      ...this.calendarSidePanelHiddenState,
      [item]: !this.calendarSidePanelHiddenState[item]
    };
    this.syncCalendarSidePanelItems();
    this.persistCalendarSidePanelHiddenState();
  }

  showAllCalendarSidePanelItems(event?: Event): void {
    event?.stopPropagation();
    this.resetCalendarSidePanelHiddenState();
    this.syncCalendarSidePanelItems();
    this.persistCalendarSidePanelHiddenState();
  }

  toggleCalendarSidePanelPosition(event?: Event): void {
    event?.stopPropagation();
    this.setCalendarSidePanelPosition(
      this.calendarSidePanelPosition === 'right' ? 'left' : 'right'
    );
    this.persistCalendarSidePanelPosition();
  }

  startCalendarSidePanelPositionDrag(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    const trigger = event.currentTarget as HTMLElement | null;
    const layout = trigger?.closest('.calendar-layout') as HTMLElement | null;
    if (!layout) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.sidePanelPositionDragBounds = layout.getBoundingClientRect();
    this.calendarSidePanelDragging = true;
    this.calendarSidePanelDragPreviewPosition = this.calendarSidePanelPosition;
    window.addEventListener('pointermove', this.sidePanelPositionPointerMoveHandler, {
      passive: true
    });
    window.addEventListener('pointerup', this.sidePanelPositionPointerUpHandler, { once: true });
    window.addEventListener('pointercancel', this.sidePanelPositionPointerUpHandler, {
      once: true
    });
  }

  startCalendarSidePanelResize(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.sidePanelResizeStartX = event.clientX;
    this.sidePanelResizeStartWidth = this.calendarSidePanelWidth;
    this.calendarSidePanelResizing = true;
    window.addEventListener('pointermove', this.sidePanelResizePointerMoveHandler, {
      passive: true
    });
    window.addEventListener('pointerup', this.sidePanelResizePointerUpHandler, { once: true });
    window.addEventListener('pointercancel', this.sidePanelResizePointerUpHandler, { once: true });
  }

  private syncCalendarSidePanelItems(): void {
    const availableItems = this.calendarSidePanelOrder.filter(item =>
      this.isCalendarSidePanelVisible(item)
    );
    this.calendarSidePanelItems = availableItems.filter(
      item => !this.calendarSidePanelHiddenState[item]
    );
    this.calendarSidePanelOptions = this.defaultCalendarSidePanelOrder.map(item => {
      const available = this.isCalendarSidePanelVisible(item);
      return {
        id: item,
        label: this.calendarSidePanelOptionLabel(item),
        available,
        enabled: available && !this.calendarSidePanelHiddenState[item]
      };
    });
    this.updateCalendarSidePanelCollapseState();
  }

  private isCalendarSidePanelVisible(item: CalendarSidePanelId): boolean {
    if (item === 'upcoming') {
      return this.upcomingEvents.length > 0;
    }
    if (item === 'insights') {
      return this.calendarInsightMetrics.length > 0;
    }
    if (item === 'health') {
      return this.calendarHealthMetrics.length > 0;
    }
    if (item === 'risk') {
      return this.calendarRiskMetrics.length > 0;
    }
    if (item === 'flow') {
      return this.calendarFlowMetrics.length > 0;
    }
    if (item === 'timing') {
      return this.calendarTimingBreakdown.length > 0;
    }
    if (item === 'eventMix') {
      return this.calendarTypeBreakdown.length > 0;
    }
    if (item === 'status') {
      return this.calendarStatusBreakdown.length > 0;
    }
    if (item === 'resources') {
      return this.calendarResourceBreakdown.length > 0;
    }
    if (item === 'weekdays') {
      return this.calendarWeekdayBreakdown.length > 0;
    }
    return false;
  }

  private calendarSidePanelOptionLabel(item: CalendarSidePanelId): string {
    return item === 'resources' ? this.resourceLabel : this.calendarSidePanelLabels[item];
  }

  private loadCalendarSidePanelOrder(): void {
    if (!this.canStore()) {
      return;
    }
    try {
      const raw = localStorage.getItem(this.getStorageKey('side-panel-order'));
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return;
      }
      const valid = new Set(this.defaultCalendarSidePanelOrder);
      const next = parsed.filter((item): item is CalendarSidePanelId => valid.has(item));
      for (const item of this.defaultCalendarSidePanelOrder) {
        if (!next.includes(item)) {
          next.push(item);
        }
      }
      this.calendarSidePanelOrder = next;
    } catch {
      return;
    }
  }

  private persistCalendarSidePanelOrder(): void {
    if (!this.canStore()) {
      return;
    }
    try {
      localStorage.setItem(
        this.getStorageKey('side-panel-order'),
        JSON.stringify(this.calendarSidePanelOrder)
      );
    } catch {
      return;
    }
  }

  private refreshCalendarSidePanelSummary(): void {
    this.calendarSidePanelSummary = {
      upcoming: this.upcomingEvents.length ? `${this.upcomingEvents.length} next` : 'No upcoming',
      insights: this.calendarInsightsSummary(),
      health: this.calendarHealthSummary(),
      risk: this.calendarMetricsSummary(this.calendarRiskMetrics, 'No risk data'),
      flow: this.calendarMetricsSummary(this.calendarFlowMetrics, 'No flow data'),
      timing: this.calendarBreakdownSummary(this.calendarTimingBreakdown),
      eventMix: this.calendarBreakdownSummary(this.calendarTypeBreakdown),
      status: this.calendarBreakdownSummary(this.calendarStatusBreakdown),
      resources: this.calendarBreakdownSummary(this.calendarResourceBreakdown),
      weekdays: this.calendarBreakdownSummary(this.calendarWeekdayBreakdown)
    };
  }

  private calendarInsightsSummary(): string {
    const attention = this.calendarInsightMetrics.find(metric => metric.id === 'attention');
    const events = this.calendarInsightMetrics.find(metric => metric.id === 'events');
    if (!attention && !events) {
      return 'No insight';
    }
    return `${attention?.value || '0'} attention · ${events?.value || '0'} events`;
  }

  private calendarHealthSummary(): string {
    const coverage = this.calendarHealthMetrics.find(metric => metric.id === 'coverage');
    const average = this.calendarHealthMetrics.find(metric => metric.id === 'avg-active-day');
    if (!coverage && !average) {
      return 'No health data';
    }
    return `${coverage?.value || '0%'} coverage · ${average?.value || '0'} avg`;
  }

  private calendarBreakdownSummary(items: CalendarBreakdownItem[]): string {
    const top = items[0];
    return top ? `${top.label} ${top.count}` : 'No data';
  }

  private calendarMetricsSummary(metrics: CalendarInsightMetric[], fallback: string): string {
    const first = metrics[0];
    const second = metrics[1];
    if (!first && !second) {
      return fallback;
    }
    return `${first?.value || '0'} ${first?.label || 'items'} - ${second?.value || '0'} ${
      second?.label || 'more'
    }`;
  }

  private setCalendarSidePanelItemsCollapsed(collapsed: boolean): void {
    const next = { ...this.calendarSidePanelCollapsedState };
    for (const item of this.calendarSidePanelItems) {
      next[item] = collapsed;
    }
    this.calendarSidePanelCollapsedState = next;
    this.updateCalendarSidePanelCollapseState();
    this.persistCalendarSidePanelCollapsedState();
  }

  private updateCalendarSidePanelCollapseState(): void {
    const { defaultWidth } = this.getCalendarSidePanelWidthBounds();
    const availableCount = this.calendarSidePanelOptions.filter(item => item.available).length;
    this.calendarSidePanelCollapsedVisibleCount = this.calendarSidePanelItems.filter(
      item => this.calendarSidePanelCollapsedState[item]
    ).length;
    this.calendarSidePanelEnabledCount = this.calendarSidePanelItems.length;
    this.calendarSidePanelAllCollapsed =
      this.calendarSidePanelItems.length > 0 &&
      this.calendarSidePanelCollapsedVisibleCount === this.calendarSidePanelItems.length;
    this.calendarSidePanelStatusLabel = `${this.calendarSidePanelEnabledCount}/${availableCount} cards`;
    if (this.calendarSidePanelCollapsedVisibleCount) {
      this.calendarSidePanelStatusLabel += ` · ${this.calendarSidePanelCollapsedVisibleCount} collapsed`;
    }
    this.calendarSidePanelResetAvailable =
      this.calendarSidePanelOrder.join('|') !== this.defaultCalendarSidePanelOrder.join('|') ||
      Object.values(this.calendarSidePanelCollapsedState).some(Boolean) ||
      Object.values(this.calendarSidePanelHiddenState).some(Boolean) ||
      this.calendarSidePanelWidth !== defaultWidth;
  }

  private resetCalendarSidePanelCollapsedState(): void {
    this.calendarSidePanelCollapsedState = {
      upcoming: false,
      insights: false,
      health: false,
      risk: false,
      flow: false,
      timing: false,
      eventMix: false,
      status: false,
      resources: false,
      weekdays: false
    };
  }

  private resetCalendarSidePanelHiddenState(): void {
    this.calendarSidePanelHiddenState = {
      upcoming: false,
      insights: false,
      health: false,
      risk: false,
      flow: false,
      timing: false,
      eventMix: false,
      status: false,
      resources: false,
      weekdays: false
    };
  }

  private loadCalendarSidePanelCollapsedState(): void {
    if (!this.canStore()) {
      return;
    }
    try {
      const raw = localStorage.getItem(this.getStorageKey('side-panel-collapsed'));
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return;
      }
      const valid = new Set(this.defaultCalendarSidePanelOrder);
      const next = { ...this.calendarSidePanelCollapsedState };
      for (const item of parsed) {
        if (valid.has(item)) {
          next[item as CalendarSidePanelId] = true;
        }
      }
      this.calendarSidePanelCollapsedState = next;
    } catch {
      return;
    }
  }

  private persistCalendarSidePanelCollapsedState(): void {
    if (!this.canStore()) {
      return;
    }
    try {
      const collapsed = this.defaultCalendarSidePanelOrder.filter(
        item => this.calendarSidePanelCollapsedState[item]
      );
      localStorage.setItem(this.getStorageKey('side-panel-collapsed'), JSON.stringify(collapsed));
    } catch {
      return;
    }
  }

  private loadCalendarSidePanelHiddenState(): void {
    if (!this.canStore()) {
      return;
    }
    try {
      const raw = localStorage.getItem(this.getStorageKey('side-panel-hidden'));
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return;
      }
      const valid = new Set(this.defaultCalendarSidePanelOrder);
      const next = { ...this.calendarSidePanelHiddenState };
      for (const item of parsed) {
        if (valid.has(item)) {
          next[item as CalendarSidePanelId] = true;
        }
      }
      this.calendarSidePanelHiddenState = next;
    } catch {
      return;
    }
  }

  private persistCalendarSidePanelHiddenState(): void {
    if (!this.canStore()) {
      return;
    }
    try {
      const hidden = this.defaultCalendarSidePanelOrder.filter(
        item => this.calendarSidePanelHiddenState[item]
      );
      localStorage.setItem(this.getStorageKey('side-panel-hidden'), JSON.stringify(hidden));
    } catch {
      return;
    }
  }

  private getCalendarSidePanelWidthBounds(): {
    defaultWidth: number;
    minWidth: number;
    maxWidth: number;
  } {
    const fallbackMinWidth = 304;
    const fallbackMaxWidth = 440;
    const maxWidth = Math.max(260, Math.round(Number(this.sidePanelMaxWidth) || fallbackMaxWidth));
    const minWidth = Math.max(
      240,
      Math.min(maxWidth, Math.round(Number(this.sidePanelMinWidth) || fallbackMinWidth))
    );
    const defaultWidth = Math.max(
      minWidth,
      Math.min(
        maxWidth,
        Math.round(Number(this.sidePanelDefaultWidth) || this.legacySidePanelDefaultWidth)
      )
    );
    return { defaultWidth, minWidth, maxWidth };
  }

  private normalizeCalendarSidePanelWidth(value: unknown): number {
    const { defaultWidth, minWidth, maxWidth } = this.getCalendarSidePanelWidthBounds();
    const width = Number(value);
    if (!Number.isFinite(width)) {
      return defaultWidth;
    }
    return Math.round(Math.max(minWidth, Math.min(maxWidth, width)));
  }

  private loadCalendarSidePanelWidth(): void {
    if (!this.canStore()) {
      return;
    }
    try {
      const raw = localStorage.getItem(this.getStorageKey('side-panel-width'));
      if (!raw) {
        return;
      }
      const { defaultWidth } = this.getCalendarSidePanelWidthBounds();
      const migrationKey = this.getStorageKey('side-panel-width-width-bounds-v2');
      if (
        defaultWidth !== this.legacySidePanelDefaultWidth &&
        !localStorage.getItem(migrationKey) &&
        raw === String(this.legacySidePanelDefaultWidth)
      ) {
        this.calendarSidePanelWidth = defaultWidth;
        localStorage.setItem(this.getStorageKey('side-panel-width'), String(defaultWidth));
        localStorage.setItem(migrationKey, '1');
        return;
      }
      this.calendarSidePanelWidth = this.normalizeCalendarSidePanelWidth(raw);
    } catch {
      return;
    }
  }

  private persistCalendarSidePanelWidth(): void {
    if (!this.canStore()) {
      return;
    }
    try {
      localStorage.setItem(
        this.getStorageKey('side-panel-width'),
        String(this.calendarSidePanelWidth)
      );
    } catch {
      return;
    }
  }

  private normalizeCalendarSidePanelPosition(value: unknown): CalendarSidePanelPosition {
    return value === 'left' ? 'left' : 'right';
  }

  private setCalendarSidePanelPosition(value: unknown): void {
    this.calendarSidePanelPosition = this.normalizeCalendarSidePanelPosition(value);
    this.calendarSidePanelMoveTitle =
      this.calendarSidePanelPosition === 'right'
        ? 'Move analysis left'
        : 'Move analysis right';
    this.calendarSidePanelMoveIcon =
      this.calendarSidePanelPosition === 'right' ? 'arrow-left' : 'arrow-right';
  }

  private onCalendarSidePanelPositionPointerMove(event: PointerEvent): void {
    if (!this.calendarSidePanelDragging || !this.sidePanelPositionDragBounds) {
      return;
    }
    const midpoint =
      this.sidePanelPositionDragBounds.left + this.sidePanelPositionDragBounds.width / 2;
    this.calendarSidePanelDragPreviewPosition = event.clientX < midpoint ? 'left' : 'right';
  }

  private onCalendarSidePanelPositionPointerUp(event: PointerEvent): void {
    if (this.calendarSidePanelDragging) {
      this.onCalendarSidePanelPositionPointerMove(event);
      const nextPosition =
        this.calendarSidePanelDragPreviewPosition ?? this.calendarSidePanelPosition;
      if (nextPosition !== this.calendarSidePanelPosition) {
        this.setCalendarSidePanelPosition(nextPosition);
        this.persistCalendarSidePanelPosition();
      }
    }
    this.detachCalendarSidePanelPositionDragListeners();
  }

  private detachCalendarSidePanelPositionDragListeners(): void {
    window.removeEventListener('pointermove', this.sidePanelPositionPointerMoveHandler);
    window.removeEventListener('pointerup', this.sidePanelPositionPointerUpHandler);
    window.removeEventListener('pointercancel', this.sidePanelPositionPointerUpHandler);
    this.sidePanelPositionDragBounds = null;
    this.calendarSidePanelDragging = false;
    this.calendarSidePanelDragPreviewPosition = null;
  }

  private onCalendarSidePanelResizePointerMove(event: PointerEvent): void {
    if (!this.calendarSidePanelResizing) {
      return;
    }
    const delta =
      this.calendarSidePanelPosition === 'right'
        ? this.sidePanelResizeStartX - event.clientX
        : event.clientX - this.sidePanelResizeStartX;
    this.calendarSidePanelWidth = this.normalizeCalendarSidePanelWidth(
      this.sidePanelResizeStartWidth + delta
    );
    this.updateCalendarSidePanelCollapseState();
  }

  private onCalendarSidePanelResizePointerUp(): void {
    if (this.calendarSidePanelResizing) {
      this.persistCalendarSidePanelWidth();
    }
    this.detachCalendarSidePanelResizeListeners();
  }

  private detachCalendarSidePanelResizeListeners(): void {
    window.removeEventListener('pointermove', this.sidePanelResizePointerMoveHandler);
    window.removeEventListener('pointerup', this.sidePanelResizePointerUpHandler);
    window.removeEventListener('pointercancel', this.sidePanelResizePointerUpHandler);
    this.calendarSidePanelResizing = false;
    this.sidePanelResizeStartX = 0;
    this.sidePanelResizeStartWidth = 0;
  }

  private loadCalendarSidePanelPosition(): void {
    if (!this.canStore()) {
      return;
    }
    try {
      const raw = localStorage.getItem(this.getStorageKey('side-panel-position'));
      if (!raw) {
        return;
      }
      this.setCalendarSidePanelPosition(raw);
    } catch {
      return;
    }
  }

  private persistCalendarSidePanelPosition(): void {
    if (!this.canStore()) {
      return;
    }
    try {
      localStorage.setItem(
        this.getStorageKey('side-panel-position'),
        this.calendarSidePanelPosition
      );
    } catch {
      return;
    }
  }

  private calendarTimingLabel(event: NormalizedEvent, today: Date, nextWeekEnd: Date): string {
    if (event.end < today) {
      return 'Overdue';
    }
    if (event.start <= today && event.end >= today) {
      return 'In progress';
    }
    if (event.start <= nextWeekEnd) {
      return 'Next 7 days';
    }
    return 'Later';
  }

  private calendarTimingColor(label: string): string {
    if (label === 'Overdue') {
      return 'var(--app-color-danger)';
    }
    if (label === 'In progress') {
      return 'var(--app-color-primary)';
    }
    if (label === 'Next 7 days') {
      return 'var(--app-color-warning)';
    }
    return 'var(--app-color-text-muted)';
  }

  private buildCalendarBreakdown(
    events: NormalizedEvent[],
    labelFor: (event: NormalizedEvent) => string,
    colorFor: (event: NormalizedEvent) => string | undefined
  ): CalendarBreakdownItem[] {
    const map = new Map<string, { count: number; color?: string }>();
    let max = 1;
    for (const event of events) {
      const label = labelFor(event).trim() || 'Uncategorized';
      const color = colorFor(event);
      const current = map.get(label);
      if (current) {
        current.count += 1;
        current.color = current.color || color;
        if (current.count > max) {
          max = current.count;
        }
        continue;
      }
      map.set(label, { count: 1, color });
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
      .slice(0, 5)
      .map(([label, value]) => ({
        id: this.slugify(label),
        label,
        count: value.count,
        percent: Math.round((value.count / max) * 100),
        color: value.color
      }));
  }

  private buildCalendarWeekdayBreakdown(dayCounts: Map<string, number>): CalendarBreakdownItem[] {
    const map = new Map<string, number>();
    let max = 1;
    for (const [iso, count] of dayCounts) {
      const label = this.formatDate(this.parseDateInput(iso), { weekday: 'short' });
      const nextCount = (map.get(label) || 0) + count;
      map.set(label, nextCount);
      if (nextCount > max) {
        max = nextCount;
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5)
      .map(([label, count]) => ({
        id: this.slugify(label),
        label,
        count,
        percent: Math.round((count / max) * 100),
        color: 'var(--app-color-primary)'
      }));
  }

  private isCalendarCompletedStatus(status?: string): boolean {
    const value = (status || '').toLowerCase();
    return (
      value.includes('done') ||
      value.includes('complete') ||
      value.includes('completed') ||
      value.includes('closed') ||
      value.includes('approved') ||
      value.includes('accepted') ||
      value.includes('finished')
    );
  }

  private calendarStatusColor(status?: string): string | undefined {
    const value = (status || '').toLowerCase();
    if (value.includes('approved') || value.includes('accepted') || value.includes('active')) {
      return 'var(--app-color-success)';
    }
    if (value.includes('pending') || value.includes('review')) {
      return 'var(--app-color-info)';
    }
    if (value.includes('rejected') || value.includes('cancelled') || value.includes('lost')) {
      return 'var(--app-color-danger)';
    }
    if (value.includes('hold') || value.includes('draft')) {
      return 'var(--app-color-warning)';
    }
    return undefined;
  }

  eventTooltip(event: NormalizedEvent): string {
    if (event.tooltipText) {
      return event.tooltipText;
    }
    const cached = this.calendarTooltipCache.get(event);
    if (cached !== undefined) {
      return cached;
    }
    const tooltip = this.buildEventTooltip(event);
    this.calendarTooltipCache.set(event, tooltip);
    return tooltip;
  }

  private decorateNormalizedEvents(events: NormalizedEvent[]): void {
    for (const event of events) {
      event.typeClassName = this.typeClass(event.type);
      event.statusClassName = this.statusClass(event.status);
      event.tooltipText = this.buildEventTooltip(event);
      event.rangeLabel = this.formatAgendaRange(event);
    }
  }

  private buildEventTooltip(event: NormalizedEvent): string {
    const parts = [event.title];
    if (event.type) parts.push(event.type);
    if (event.status) parts.push(event.status);
    if (event.resourceIds.length) {
      const map = this.resourceNameMap();
      const label = event.resourceIds.map(id => map.get(id) || id).join(', ');
      if (label) parts.push(label);
    }
    if (event.layer) parts.push(event.layer);
    if (event.conflict) parts.push(`Conflicts: ${event.conflictCount || 1}`);
    parts.push(this.formatAgendaRange(event));
    return parts.filter(Boolean).join(' - ');
  }

  formatWeekday(date: Date): string {
    return this.formatDate(date, { weekday: 'short' });
  }

  formatTimeRange(event: NormalizedEvent): string {
    if (event.allDay) {
      return 'All day';
    }
    const start = this.formatDateForEvent(event.start, event, {
      hour: 'numeric',
      minute: '2-digit'
    });
    const end = this.formatDateForEvent(event.end, event, { hour: 'numeric', minute: '2-digit' });
    return `${start} - ${end}`;
  }

  formatAgendaRange(event: NormalizedEvent): string {
    const start = this.formatDateForEvent(event.start, event, { month: 'short', day: 'numeric' });
    const end = this.formatDateForEvent(event.end, event, { month: 'short', day: 'numeric' });
    if (event.allDay) {
      return event.isMultiDay ? `${start} - ${end}` : start;
    }
    const time = this.formatTimeRange(event);
    return `${start} - ${time}`;
  }

  private formatDateTimeRange(start: Date, end: Date, timeZone?: string): string {
    const startLabel = this.formatDateWithTimeZone(
      start,
      { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' },
      timeZone
    );
    if (this.isSameDay(start, end)) {
      const endLabel = this.formatDateWithTimeZone(
        end,
        { hour: 'numeric', minute: '2-digit' },
        timeZone
      );
      return `${startLabel} - ${endLabel}`;
    }
    const endLabel = this.formatDateWithTimeZone(
      end,
      { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' },
      timeZone
    );
    return `${startLabel} - ${endLabel}`;
  }

  onDocumentPointerMove(event: PointerEvent): void {
    if (this.selectionMode !== 'time' || !this.selectionContainer || !this.selectionStart) {
      return;
    }
    const minutes = this.minutesFromPointer(this.selectionContainer, event.clientY);
    const clampedMinutes = this.clampMinutes(minutes);
    const date = this.startOfDay(this.selectionStart);
    this.selectionEnd = this.setTimeOnDate(date, clampedMinutes);
  }

  onDocumentPointerUp(): void {
    if (!this.selectionMode || !this.selectionStart || !this.selectionEnd) {
      this.clearSelection();
      return;
    }
    if (this.selectionMode === 'month' || this.selectionMode === 'all-day') {
      const start =
        this.selectionStart < this.selectionEnd ? this.selectionStart : this.selectionEnd;
      const end = this.selectionStart < this.selectionEnd ? this.selectionEnd : this.selectionStart;
      this.openEditorForDateRange(start, end, this.selectionResourceId);
    }
    if (this.selectionMode === 'time') {
      let start = this.selectionStart < this.selectionEnd ? this.selectionStart : this.selectionEnd;
      let end = this.selectionStart < this.selectionEnd ? this.selectionEnd : this.selectionStart;
      const slotMinutes = Math.max(10, Math.min(60, Math.round(this.timeSlotMinutes)));
      if (end.getTime() - start.getTime() < slotMinutes * 60000) {
        end = new Date(start.getTime() + slotMinutes * 60000);
      }
      this.openEditorForDateTime(start, end, this.selectionResourceId);
    }
    this.clearSelection();
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (this.isTypingInField(event.target as HTMLElement | null)) {
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    const key = event.key.toLowerCase();
    if (key === 't') {
      this.goToToday();
      return;
    }
    if (key === '[') {
      this.shiftCalendar(-1);
      return;
    }
    if (key === ']') {
      this.shiftCalendar(1);
      return;
    }
    if (key === 'n' && this.enableEditor) {
      this.openEditorForDate(this.anchorDate);
      return;
    }
    if (key === 'escape') {
      this.calendarSidePanelPickerOpen = false;
      this.clearSelection();
      return;
    }
    if (key === 'm') this.setView('month');
    if (key === 'w') this.setView('week');
    if (key === 'd') this.setView('day');
    if (key === 'a') this.setView('agenda');
    if (key === 'y') this.setView('year');
    if (key === 'q') this.setView('quarter');
    if (key === 'l') this.setView('list');
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.calendarSidePanelPickerOpen = false;
  }

  typeClass(type?: string): string {
    if (!type) {
      return '';
    }
    const cached = this.calendarTypeClassCache.get(type);
    if (cached !== undefined) {
      return cached;
    }
    const next = `type-${this.slugify(type)}`;
    this.calendarTypeClassCache.set(type, next);
    return next;
  }

  statusClass(status?: string): string {
    if (!status) {
      return '';
    }
    const cached = this.calendarStatusClassCache.get(status);
    if (cached !== undefined) {
      return cached;
    }
    const next = `status-${this.slugify(status)}`;
    this.calendarStatusClassCache.set(status, next);
    return next;
  }

  private resourceNameMap(): Map<string, string> {
    if (this.calendarResourceNameCacheSource === this.resourceOptions) {
      return this.calendarResourceNameCache;
    }
    this.calendarResourceNameCacheSource = this.resourceOptions;
    this.calendarResourceNameCache = new Map(
      this.resourceOptions.map(item => [item.id, item.name])
    );
    return this.calendarResourceNameCache;
  }

  private resourceColorMap(): Map<string, string | undefined> {
    if (this.calendarResourceColorCacheSource === this.resourceOptions) {
      return this.calendarResourceColorCache;
    }
    this.calendarResourceColorCacheSource = this.resourceOptions;
    this.calendarResourceColorCache = new Map(
      this.resourceOptions.map(item => [item.id, item.color])
    );
    return this.calendarResourceColorCache;
  }

  private scheduleCalendarFilterRefresh(): void {
    this.calendarFilterRefreshPending = true;
    if (this.calendarFilterFrameId != null) {
      return;
    }

    if (typeof requestAnimationFrame === 'undefined') {
      this.flushCalendarFilterRefresh();
      return;
    }

    this.calendarFilterFrameId = requestAnimationFrame(() => {
      this.calendarFilterFrameId = null;
      this.flushCalendarFilterRefresh();
    });
  }

  private flushCalendarFilterRefresh(): void {
    if (!this.calendarFilterRefreshPending) {
      return;
    }
    this.calendarFilterRefreshPending = false;
    this.refreshCalendar();
  }

  private cancelCalendarFilterRefresh(): void {
    if (this.calendarFilterFrameId != null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.calendarFilterFrameId);
    }
    this.calendarFilterFrameId = null;
    this.calendarFilterRefreshPending = false;
  }

  onDaySelectStart(event: PointerEvent, date: Date): void {
    if (!this.enableSelection || !this.enableEditor) {
      return;
    }
    if (event.button !== 0) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.closest('.event-chip, .event-bar')) {
      return;
    }
    this.selectionMode = 'month';
    this.selectionStart = this.startOfDay(date);
    this.selectionEnd = this.startOfDay(date);
    this.selectionResourceId = undefined;
    this.suppressClick = true;
    this.attachSelectionDocumentListeners();
    event.preventDefault();
  }

  onDaySelectEnter(date: Date): void {
    if (!this.enableSelection || this.selectionMode !== 'month' || !this.selectionStart) {
      return;
    }
    this.selectionEnd = this.startOfDay(date);
  }

  onAllDaySelectStart(event: PointerEvent, date: Date, resourceId?: string): void {
    if (!this.enableSelection || !this.enableEditor) {
      return;
    }
    if (event.button !== 0) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.closest('.event-bar')) {
      return;
    }
    this.selectionMode = 'all-day';
    this.selectionStart = this.startOfDay(date);
    this.selectionEnd = this.startOfDay(date);
    this.selectionResourceId = resourceId;
    this.suppressClick = true;
    this.attachSelectionDocumentListeners();
    event.preventDefault();
  }

  onAllDaySelectEnter(date: Date, resourceId?: string): void {
    if (!this.enableSelection || this.selectionMode !== 'all-day' || !this.selectionStart) {
      return;
    }
    if (this.selectionResourceId && resourceId && this.selectionResourceId !== resourceId) {
      return;
    }
    if (this.selectionResourceId && !resourceId) {
      return;
    }
    this.selectionEnd = this.startOfDay(date);
  }

  onTimelineCellClick(date: Date, resourceId: string): void {
    if (!this.enableEditor) {
      return;
    }
    const resolved = this.resolveTimelineResource(resourceId);
    this.openEditorForDate(date);
    if (resolved) {
      this.editorModel.resourceId = resolved;
    }
  }

  onTimelineDrop(event: DragEvent, date: Date, resourceId: string): void {
    const resolved = this.resolveTimelineResource(resourceId);
    this.onDayDrop(event, date, resolved);
  }

  onTimeSelectStart(event: PointerEvent, date: Date, resourceId?: string): void {
    if (!this.enableSelection || !this.enableEditor) {
      return;
    }
    if (event.button !== 0) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.closest('.time-event, .event-resize')) {
      return;
    }
    const container = event.currentTarget as HTMLElement | null;
    if (!container) {
      return;
    }
    const minutes = this.minutesFromPointer(container, event.clientY);
    const clampedMinutes = this.clampMinutes(minutes);
    this.selectionMode = 'time';
    this.selectionStart = this.setTimeOnDate(date, clampedMinutes);
    this.selectionEnd = this.selectionStart;
    this.selectionResourceId = resourceId;
    this.selectionContainer = container;
    this.suppressClick = true;
    this.attachSelectionDocumentListeners();
    event.preventDefault();
  }

  isDateSelected(date: Date): boolean {
    if (this.selectionMode !== 'month' || !this.selectionStart || !this.selectionEnd) {
      return false;
    }
    const start = this.selectionStart < this.selectionEnd ? this.selectionStart : this.selectionEnd;
    const end = this.selectionStart < this.selectionEnd ? this.selectionEnd : this.selectionStart;
    return this.isWithinDate(this.startOfDay(date), start, end);
  }

  isAllDaySelected(date: Date, resourceId?: string): boolean {
    if (this.selectionMode !== 'all-day' || !this.selectionStart || !this.selectionEnd) {
      return false;
    }
    if (this.selectionResourceId && resourceId && this.selectionResourceId !== resourceId) {
      return false;
    }
    if (this.selectionResourceId && !resourceId) {
      return false;
    }
    const start = this.selectionStart < this.selectionEnd ? this.selectionStart : this.selectionEnd;
    const end = this.selectionStart < this.selectionEnd ? this.selectionEnd : this.selectionStart;
    return this.isWithinDate(this.startOfDay(date), start, end);
  }

  isTimeSelectionActive(date: Date, resourceId?: string): boolean {
    if (this.selectionMode !== 'time' || !this.selectionStart || !this.selectionEnd) {
      return false;
    }
    if (!this.isSameDay(this.selectionStart, date)) {
      return false;
    }
    if (this.selectionResourceId && resourceId && this.selectionResourceId !== resourceId) {
      return false;
    }
    if (this.selectionResourceId && !resourceId) {
      return false;
    }
    return true;
  }

  getTimeSelectionTop(date: Date, resourceId?: string): number {
    const range = this.getTimeSelectionRange(date, resourceId);
    return range ? range.top : 0;
  }

  getTimeSelectionHeight(date: Date, resourceId?: string): number {
    const range = this.getTimeSelectionRange(date, resourceId);
    return range ? range.height : 0;
  }

  onDateSelect(date: Date): void {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    this.dateClick.emit(date);
    if (this.enableEditor) {
      this.openEditorForDate(date);
    }
  }

  onEventClick(event: MouseEvent, item: NormalizedEvent): void {
    event.stopPropagation();
    this.eventClick.emit(item.source);
    if (this.enableEditor) {
      this.openEditorForEvent(item);
    }
  }

  onEventDragStart(event: DragEvent, item: NormalizedEvent): void {
    if (!this.enableDragDrop) {
      return;
    }
    this.draggedEvent = item;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', item.id);
    }
  }

  onDayDragOver(event: DragEvent): void {
    if (!this.enableDragDrop) {
      return;
    }
    event.preventDefault();
  }

  onDayDrop(event: DragEvent, date: Date, resourceId?: string): void {
    if (!this.enableDragDrop || !this.draggedEvent) {
      return;
    }
    event.preventDefault();
    const targetStart = this.startOfDay(date);
    const duration = this.draggedEvent.end.getTime() - this.draggedEvent.start.getTime();
    const newStart = this.mergeDateWithTime(targetStart, this.draggedEvent.start);
    const newEnd = new Date(newStart.getTime() + duration);
    this.applyEventChange(this.draggedEvent, newStart, newEnd, resourceId);
    this.draggedEvent = undefined;
  }

  onTimeDragOver(event: DragEvent): void {
    if (!this.enableDragDrop) {
      return;
    }
    event.preventDefault();
  }

  onTimeDrop(event: DragEvent, date: Date, target: EventTarget | null, resourceId?: string): void {
    if (!this.enableDragDrop || !this.draggedEvent) {
      return;
    }
    event.preventDefault();
    const container = target as HTMLElement | null;
    if (!container) {
      return;
    }
    const minutes = this.minutesFromPointer(container, event.clientY);
    const newStart = this.setTimeOnDate(date, minutes);
    const duration = this.draggedEvent.end.getTime() - this.draggedEvent.start.getTime();
    const newEnd = new Date(newStart.getTime() + duration);
    this.applyEventChange(this.draggedEvent, newStart, newEnd, resourceId);
    this.draggedEvent = undefined;
  }

  onTimeSlotClick(event: MouseEvent, date: Date, resourceId?: string): void {
    if (!this.enableEditor) {
      return;
    }
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target && target.closest('.time-event')) {
      return;
    }
    const container = target?.closest('.time-day') as HTMLElement | null;
    if (!container) {
      return;
    }
    const minutes = this.minutesFromPointer(container, event.clientY);
    const slot = Math.max(10, Math.min(60, Math.round(this.timeSlotMinutes)));
    const startMinutes = this.clampMinutes(minutes);
    const start = this.setTimeOnDate(date, startMinutes);
    const end = this.setTimeOnDate(date, startMinutes + slot);
    this.openEditorForDateTime(start, end, resourceId);
  }

  private openEditorForDateRange(start: Date, end: Date, resourceId?: string): void {
    this.editorMode = 'create';
    this.editorModel = this.createEditorModel();
    this.policyWarnings = [];
    this.editorModel.allDay = true;
    const startDate = this.toDateInput(start);
    const endDate = this.toDateInput(end);
    this.editorModel.startDate = startDate;
    this.editorModel.endDate = endDate;
    if (this.selectedTimeZone) {
      this.editorModel.timeZone = this.selectedTimeZone;
    }
    const resolvedResource =
      resourceId && this.resourceOptions.some(item => item.id === resourceId)
        ? resourceId
        : undefined;
    if (resolvedResource) {
      this.editorModel.resourceId = resolvedResource;
    } else if (this.selectedResource !== 'all') {
      this.editorModel.resourceId = this.selectedResource;
    }
    if (this.selectedLayer !== 'all') {
      this.editorModel.layer = this.selectedLayer;
    }
    this.editorOpen = true;
    this.editorTitle = 'New event';
    const startLabel = this.formatDate(start, { month: 'short', day: 'numeric' });
    const endLabel = this.formatDate(end, { month: 'short', day: 'numeric' });
    this.editorSubtitle = startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
  }

  private clearSelection(): void {
    this.detachSelectionDocumentListeners();
    this.selectionMode = null;
    this.selectionStart = undefined;
    this.selectionEnd = undefined;
    this.selectionResourceId = undefined;
    this.selectionContainer = undefined;
    if (this.suppressClick) {
      setTimeout(() => {
        this.suppressClick = false;
      }, 0);
    }
  }

  private attachSelectionDocumentListeners(): void {
    if (this.selectionDocumentListenersAttached || typeof document === 'undefined') {
      return;
    }
    this.selectionDocumentListenersAttached = true;
    document.addEventListener('pointermove', this.selectionDocumentPointerMoveHandler);
    document.addEventListener('pointerup', this.selectionDocumentPointerUpHandler);
  }

  private detachSelectionDocumentListeners(): void {
    if (!this.selectionDocumentListenersAttached || typeof document === 'undefined') {
      return;
    }
    this.selectionDocumentListenersAttached = false;
    document.removeEventListener('pointermove', this.selectionDocumentPointerMoveHandler);
    document.removeEventListener('pointerup', this.selectionDocumentPointerUpHandler);
  }

  protected clampMinutes(minutes: number): number {
    const clamped = Math.max(this.startHour * 60, Math.min(this.endHour * 60, minutes));
    return this.snapMinutes(clamped);
  }

  private resolveTimelineResource(resourceId: string): string | undefined {
    return resourceId === 'unassigned' ? undefined : resourceId;
  }

  private getTimeSelectionRange(
    date: Date,
    resourceId?: string
  ): { top: number; height: number } | null {
    if (
      !this.isTimeSelectionActive(date, resourceId) ||
      !this.selectionStart ||
      !this.selectionEnd
    ) {
      return null;
    }
    const totalMinutes = (this.endHour - this.startHour) * 60 || 1;
    const startMinutes = this.selectionStart.getHours() * 60 + this.selectionStart.getMinutes();
    const endMinutes = this.selectionEnd.getHours() * 60 + this.selectionEnd.getMinutes();
    const min = Math.max(this.startHour * 60, Math.min(startMinutes, endMinutes));
    const max = Math.min(this.endHour * 60, Math.max(startMinutes, endMinutes));
    const top = ((min - this.startHour * 60) / totalMinutes) * 100;
    const height = Math.max(2, ((max - min) / totalMinutes) * 100);
    return { top, height };
  }

  onBarResizeStart(event: PointerEvent, item: NormalizedEvent, edge: 'start' | 'end'): void {
    if (!this.enableResize) {
      return;
    }
    event.stopPropagation();
    const container = (event.target as HTMLElement).closest(
      '.week-bars, .week-all-day-grid'
    ) as HTMLElement | null;
    if (!container) {
      return;
    }
    const rect = container.getBoundingClientRect();
    this.resizeState = {
      event: item,
      edge,
      startX: event.clientX,
      startY: event.clientY,
      originStart: new Date(item.start),
      originEnd: new Date(item.end),
      containerWidth: rect.width,
      containerHeight: rect.height,
      mode: 'bar'
    };
    this.bindResizeListeners();
  }

  onTimeResizeStart(event: PointerEvent, item: NormalizedEvent): void {
    if (!this.enableResize) {
      return;
    }
    event.stopPropagation();
    const container = (event.target as HTMLElement).closest('.time-day') as HTMLElement | null;
    if (!container) {
      return;
    }
    const rect = container.getBoundingClientRect();
    this.resizeState = {
      event: item,
      edge: 'time',
      startX: event.clientX,
      startY: event.clientY,
      originStart: new Date(item.start),
      originEnd: new Date(item.end),
      containerWidth: rect.width,
      containerHeight: rect.height,
      mode: 'time'
    };
    this.bindResizeListeners();
  }

  toggleRecurrenceWeekday(day: number): void {
    const idx = this.editorModel.recurrenceWeekdays.indexOf(day);
    if (idx >= 0) {
      this.editorModel.recurrenceWeekdays.splice(idx, 1);
    } else {
      this.editorModel.recurrenceWeekdays.push(day);
    }
  }

  openEditorForDate(date: Date): void {
    this.editorMode = 'create';
    this.editorModel = this.createEditorModel();
    this.policyWarnings = [];
    this.editorModel.startDate = this.toDateInput(date);
    this.editorModel.endDate = this.toDateInput(date);
    if (this.selectedTimeZone) {
      this.editorModel.timeZone = this.selectedTimeZone;
    }
    if (this.selectedResource !== 'all') {
      this.editorModel.resourceId = this.selectedResource;
    }
    if (this.selectedLayer !== 'all') {
      this.editorModel.layer = this.selectedLayer;
    }
    this.editorOpen = true;
    this.editorTitle = 'New event';
    this.editorSubtitle = this.formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' });
  }

  openEditorForDateTime(start: Date, end: Date, resourceId?: string): void {
    this.editorMode = 'create';
    this.editorModel = this.createEditorModel();
    this.policyWarnings = [];
    this.editorModel.allDay = false;
    this.editorModel.startDate = this.toDateInput(start);
    this.editorModel.endDate = this.toDateInput(end);
    this.editorModel.startTime = this.toTimeInput(start);
    this.editorModel.endTime = this.toTimeInput(end);
    if (this.selectedTimeZone) {
      this.editorModel.timeZone = this.selectedTimeZone;
    }
    if (resourceId) {
      this.editorModel.resourceId = resourceId;
    } else if (this.selectedResource !== 'all') {
      this.editorModel.resourceId = this.selectedResource;
    }
    if (this.selectedLayer !== 'all') {
      this.editorModel.layer = this.selectedLayer;
    }
    this.editorOpen = true;
    this.editorTitle = 'New event';
    this.editorSubtitle = this.formatDateTimeRange(start, end, this.selectedTimeZone || undefined);
  }

  openEditorForEvent(event: NormalizedEvent): void {
    this.editorMode = 'edit';
    this.editorModel = this.createEditorModelFromEvent(event);
    this.policyWarnings = this.buildPolicyWarnings(
      event.start,
      event.end,
      event.resourceIds,
      event.originalId
    );
    this.editorOpen = true;
    this.editorTitle = 'Edit event';
    this.editorSubtitle = this.formatAgendaRange(event);
  }

  closeEditor(): void {
    this.editorOpen = false;
    this.policyWarnings = [];
  }

  saveEditor(): void {
    const payload = this.buildEventFromEditor();
    if (!payload) {
      return;
    }
    const start = this.parseDateInput(payload.start);
    const end = this.parseDateInput(payload.end);
    this.policyWarnings = this.buildPolicyWarnings(
      start,
      end,
      this.normalizeResourceIds(payload.resourceId),
      payload.id
    );
    if (this.policyWarnings.length && this.policyMode === 'block') {
      return;
    }
    if (this.editorMode === 'create') {
      this.internalEvents = [payload, ...this.internalEvents];
      this.eventCreate.emit(payload);
    } else {
      const index = this.internalEvents.findIndex(item => item.id === payload.id);
      if (index >= 0) {
        const updated = [...this.internalEvents];
        updated[index] = payload;
        this.internalEvents = updated;
      } else {
        this.internalEvents = [payload, ...this.internalEvents];
      }
      this.eventChange.emit({
        event: payload,
        start: this.parseDateInput(payload.start),
        end: this.parseDateInput(payload.end)
      });
    }
    this.persistEventsToStorage();
    this.editorOpen = false;
    this.refreshCalendar();
  }

  deleteEditor(): void {
    if (this.editorMode !== 'edit') {
      this.editorOpen = false;
      return;
    }
    const id = this.editorModel.id;
    const target = this.internalEvents.find(item => item.id === id);
    if (target) {
      this.internalEvents = this.internalEvents.filter(item => item.id !== id);
      this.eventDelete.emit(target);
    }
    this.persistEventsToStorage();
    this.editorOpen = false;
    this.refreshCalendar();
  }
  private bindResizeListeners(): void {
    window.addEventListener('pointermove', this.onResizeMove, { passive: false });
    window.addEventListener('pointerup', this.onResizeEnd, { once: true });
  }

  private onResizeMove = (event: PointerEvent): void => {
    if (!this.resizeState) {
      return;
    }
    event.preventDefault();
    const deltaX = event.clientX - this.resizeState.startX;
    const deltaY = event.clientY - this.resizeState.startY;

    if (this.resizeState.mode === 'bar') {
      const columns = Math.max(1, this.weekDays.length || 7);
      const dayWidth = this.resizeState.containerWidth / columns;
      const dayShift = Math.round(deltaX / dayWidth);
      if (this.resizeState.edge === 'start') {
        this.resizeState.nextStart = this.addDays(this.resizeState.originStart, dayShift);
      } else if (this.resizeState.edge === 'end') {
        this.resizeState.nextEnd = this.addDays(this.resizeState.originEnd, dayShift);
      }
    } else {
      const totalMinutes = (this.endHour - this.startHour) * 60;
      const minuteShift = Math.round((deltaY / this.resizeState.containerHeight) * totalMinutes);
      const snapped = this.snapMinutes(minuteShift);
      const nextEnd = new Date(this.resizeState.originEnd.getTime() + snapped * 60000);
      this.resizeState.nextEnd = nextEnd;
    }
  };

  private onResizeEnd = (): void => {
    if (!this.resizeState) {
      return;
    }
    window.removeEventListener('pointermove', this.onResizeMove as EventListener);
    const nextStart = this.resizeState.nextStart || this.resizeState.originStart;
    const nextEnd = this.resizeState.nextEnd || this.resizeState.originEnd;

    const fixedStart = nextStart <= nextEnd ? nextStart : this.resizeState.originStart;
    const fixedEnd = nextEnd >= fixedStart ? nextEnd : this.resizeState.originEnd;

    this.applyEventChange(this.resizeState.event, fixedStart, fixedEnd);
    this.resizeState = undefined;
  };

  private updateTimeGridMetrics(): void {
    const safeSlot = Math.max(10, Math.min(60, Math.round(this.timeSlotMinutes)));
    const hours = Math.max(1, this.endHour - this.startHour);
    const slotsPerHour = 60 / safeSlot;
    const slotHeight = 22;
    const totalMinutes = hours * 60;
    const clampedWorkStart = Math.max(
      this.startHour * 60,
      Math.min(this.endHour * 60, this.workStartHour * 60)
    );
    const clampedWorkEnd = Math.max(
      this.startHour * 60,
      Math.min(this.endHour * 60, this.workEndHour * 60)
    );

    this.hourCount = hours;
    this.slotCount = Math.round(hours * slotsPerHour);
    this.hourHeight = Math.max(40, Math.round(slotHeight * slotsPerHour));
    this.hourHeightCss = `${this.hourHeight}px`;
    if (clampedWorkEnd <= clampedWorkStart || totalMinutes <= 0) {
      this.workStartPercent = 0;
      this.workEndPercent = 100;
    } else {
      this.workStartPercent = ((clampedWorkStart - this.startHour * 60) / totalMinutes) * 100;
      this.workEndPercent = ((clampedWorkEnd - this.startHour * 60) / totalMinutes) * 100;
    }

    this.timeLabels = [];
    for (let i = 0; i < hours; i += 1) {
      const date = new Date(2000, 0, 1, this.startHour + i, 0, 0, 0);
      this.timeLabels.push(this.formatDate(date, { hour: 'numeric' }));
    }
  }

  private getTimeZones(): string[] {
    return calendarSettings.getTimeZonesHelper(this);
  }

  private buildWeekdayOptions(): void {
    calendarSettings.buildWeekdayOptionsHelper(this);
  }

  private buildWeekdayLabels(): string[] {
    return calendarSettings.buildWeekdayLabelsHelper(this);
  }

  private applyEventChange(
    item: NormalizedEvent,
    newStart: Date,
    newEnd: Date,
    resourceId?: string
  ): void {
    const updated: CalendarEvent = {
      ...item.source,
      start: newStart,
      end: newEnd,
      allDay: item.allDay,
      resourceId: resourceId || item.source.resourceId
    };

    const index = this.internalEvents.findIndex(ev => ev.id === item.originalId);
    if (index >= 0) {
      const next = [...this.internalEvents];
      next[index] = updated;
      this.internalEvents = next;
    } else {
      this.internalEvents = [updated, ...this.internalEvents];
    }

    this.eventChange.emit({
      event: updated,
      start: newStart,
      end: newEnd,
      occurrenceId: item.occurrenceId
    });

    this.persistEventsToStorage();
    this.refreshCalendar();
  }

  private normalizeEvent(
    item: CalendarEvent,
    start: Date,
    end: Date,
    allDay: boolean,
    occurrenceId?: string
  ): NormalizedEvent {
    const safeStart = allDay ? this.startOfDay(start) : start;
    const safeEnd = allDay ? this.endOfDay(end) : end;
    const startMinutes = safeStart.getHours() * 60 + safeStart.getMinutes();
    const endMinutes = safeEnd.getHours() * 60 + safeEnd.getMinutes();
    const isMultiDay = !this.isSameDay(safeStart, safeEnd);
    const resourceIds = this.normalizeResourceIds(item.resourceId);

    return {
      id: occurrenceId || item.id,
      occurrenceId,
      originalId: item.id,
      source: item,
      title: item.title,
      start: safeStart,
      end: safeEnd,
      allDay: !!allDay,
      type: item.type,
      status: item.status,
      color: item.color,
      location: item.location,
      meta: item.meta,
      description: item.description,
      resourceIds,
      layer: item.layer,
      timeZone: item.timeZone,
      url: item.url,
      recurrence: item.recurrence,
      exceptions: item.exceptions,
      searchText: this.buildEventSearchText(item, resourceIds),
      isMultiDay,
      startMinutes,
      endMinutes
    };
  }

  private buildEventSearchText(item: CalendarEvent, resourceIds: string[]): string {
    return [
      item.title,
      item.type,
      item.status,
      item.location,
      item.meta,
      item.description,
      item.layer,
      resourceIds.join(' ')
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  private buildBarsForRange(
    rangeStart: Date,
    rangeEnd: Date,
    events: NormalizedEvent[]
  ): CalendarBar[] {
    const bars: CalendarBar[] = [];
    const rows: boolean[][] = [];
    const sorted = events
      .filter(ev => ev.end >= rangeStart && ev.start <= rangeEnd)
      .sort((a, b) => {
        const diff = a.start.getTime() - b.start.getTime();
        if (diff !== 0) return diff;
        return b.end.getTime() - b.start.getTime() - (a.end.getTime() - a.start.getTime());
      });

    for (const ev of sorted) {
      const startIndex = Math.max(0, this.daysBetween(rangeStart, this.startOfDay(ev.start)));
      const endIndex = Math.min(6, this.daysBetween(rangeStart, this.startOfDay(ev.end)));
      const span = Math.max(1, endIndex - startIndex + 1);

      let rowIndex = 0;
      while (true) {
        if (!rows[rowIndex]) {
          rows[rowIndex] = Array(7).fill(false);
        }
        const row = rows[rowIndex];
        const isFree = row.slice(startIndex, startIndex + span).every(cell => !cell);
        if (isFree) {
          for (let i = startIndex; i < startIndex + span; i += 1) {
            row[i] = true;
          }
          bars.push({
            id: `${ev.id}-${rowIndex}`,
            title: ev.title,
            type: ev.type,
            status: ev.status,
            startIndex,
            span,
            row: rowIndex,
            event: ev
          });
          break;
        }
        rowIndex += 1;
      }
    }

    return bars;
  }

  private buildTimelineBars(
    rangeStart: Date,
    rangeEnd: Date,
    events: NormalizedEvent[],
    dayCount: number
  ): CalendarBar[] {
    const bars: CalendarBar[] = [];
    const rows: boolean[][] = [];
    const sorted = events
      .filter(ev => ev.end >= rangeStart && ev.start <= rangeEnd)
      .sort((a, b) => {
        const diff = a.start.getTime() - b.start.getTime();
        if (diff !== 0) return diff;
        return b.end.getTime() - b.start.getTime() - (a.end.getTime() - a.start.getTime());
      });

    for (const ev of sorted) {
      const startIndex = Math.max(0, this.daysBetween(rangeStart, this.startOfDay(ev.start)));
      const endIndex = Math.min(
        dayCount - 1,
        this.daysBetween(rangeStart, this.startOfDay(ev.end))
      );
      const span = Math.max(1, endIndex - startIndex + 1);
      let rowIndex = 0;
      while (true) {
        if (!rows[rowIndex]) {
          rows[rowIndex] = Array(dayCount).fill(false);
        }
        const row = rows[rowIndex];
        const isFree = row.slice(startIndex, startIndex + span).every(cell => !cell);
        if (isFree) {
          for (let i = startIndex; i < startIndex + span; i += 1) {
            row[i] = true;
          }
          const title = ev.allDay ? ev.title : `${ev.title} - ${this.formatTimeRange(ev)}`;
          bars.push({
            id: `${ev.id}-${rowIndex}`,
            title,
            type: ev.type,
            status: ev.status,
            startIndex,
            span,
            row: rowIndex,
            event: ev
          });
          break;
        }
        rowIndex += 1;
      }
    }

    return bars;
  }

  private buildTimeGrid(
    days: { date: Date; isToday?: boolean; isWeekend?: boolean }[],
    events: NormalizedEvent[]
  ): DayColumn[] {
    const columns: DayColumn[] = [];
    const startMinutes = this.startHour * 60;
    const endMinutes = this.endHour * 60;
    const totalMinutes = endMinutes - startMinutes;

    for (const day of days) {
      const dayStart = this.startOfDay(day.date);
      const dayEnd = this.endOfDay(day.date);
      const dayEvents = events
        .filter(ev => ev.start <= dayEnd && ev.end >= dayStart)
        .map(ev => this.clipTimedEvent(ev, dayStart, dayEnd));

      const layouts: TimedEventLayout[] = [];
      const positioned = this.layoutTimedEvents(dayEvents);

      for (const item of positioned) {
        const start = Math.max(startMinutes, item.event.startMinutes);
        const end = Math.min(endMinutes, item.event.endMinutes);
        if (end <= start) {
          continue;
        }
        const top = ((start - startMinutes) / totalMinutes) * 100;
        const height = Math.max(2.5, ((end - start) / totalMinutes) * 100);
        layouts.push({
          event: item.event,
          top,
          height,
          left: item.left,
          width: item.width
        });
      }

      columns.push({
        date: day.date,
        timedEvents: layouts,
        isToday: day.isToday ?? this.isToday(day.date),
        isWeekend: day.isWeekend ?? this.isWeekend(day.date)
      });
    }

    return columns;
  }

  private layoutTimedEvents(
    events: NormalizedEvent[]
  ): Array<{ event: NormalizedEvent; left: number; width: number }> {
    const sorted = events.slice().sort((a, b) => a.start.getTime() - b.start.getTime());
    const columns: NormalizedEvent[][] = [];
    const placements: Array<{ event: NormalizedEvent; column: number }> = [];

    for (const ev of sorted) {
      let placed = false;
      for (let i = 0; i < columns.length; i += 1) {
        const col = columns[i];
        const last = col[col.length - 1];
        if (last.end <= ev.start) {
          col.push(ev);
          placements.push({ event: ev, column: i });
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([ev]);
        placements.push({ event: ev, column: columns.length - 1 });
      }
    }

    const total = Math.max(1, columns.length);
    return placements.map(item => ({
      event: item.event,
      left: (item.column / total) * 100,
      width: 100 / total
    }));
  }

  private clipTimedEvent(event: NormalizedEvent, dayStart: Date, dayEnd: Date): NormalizedEvent {
    const start = event.start < dayStart ? dayStart : event.start;
    const end = event.end > dayEnd ? dayEnd : event.end;
    return {
      ...event,
      start,
      end,
      startMinutes: start.getHours() * 60 + start.getMinutes(),
      endMinutes: end.getHours() * 60 + end.getMinutes()
    };
  }

  private syncNowTicker(): void {
    if (!this.showNowIndicator || (this.currentView !== 'week' && this.currentView !== 'day')) {
      this.stopNowTicker();
      return;
    }
    this.startNowTicker();
  }

  private startNowTicker(): void {
    if (this.nowTimer !== undefined) {
      return;
    }
    const range = this.getViewRange();
    this.updateNowIndicator(range.start, range.end);
    this.nowTimer = window.setInterval(() => {
      const nextRange = this.getViewRange();
      this.updateNowIndicator(nextRange.start, nextRange.end);
    }, 60000);
  }

  private stopNowTicker(): void {
    if (this.nowTimer === undefined) {
      return;
    }
    window.clearInterval(this.nowTimer);
    this.nowTimer = undefined;
  }

  private updateNowIndicator(rangeStart: Date, rangeEnd: Date): void {
    this.nowIndicator = { show: false, dayIndex: 0, top: 0 };
    if (!this.showNowIndicator || (this.currentView !== 'week' && this.currentView !== 'day')) {
      return;
    }
    const now = new Date();
    if (now < rangeStart || now > rangeEnd) {
      return;
    }
    const dayIndex = this.weekDays.findIndex(day => this.isSameDay(day.date, now));
    if (dayIndex < 0) {
      return;
    }
    const totalMinutes = Math.max(1, (this.endHour - this.startHour) * 60);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const relative = Math.max(0, Math.min(totalMinutes, currentMinutes - this.startHour * 60));
    const top = (relative / totalMinutes) * 100;
    this.nowIndicator = { show: true, dayIndex, top };
  }

  private expandRecurrence(
    event: CalendarEvent,
    start: Date,
    end: Date,
    rangeStart: Date,
    rangeEnd: Date
  ): Array<{ start: Date; occurrenceId?: string }> {
    return calendarRecurrence.expandRecurrenceHelper(this, event, start, end, rangeStart, rangeEnd);
  }

  private makeOccurrenceId(id: string, date: Date): string {
    return calendarRecurrence.makeOccurrenceIdHelper(this, id, date);
  }

  private buildMonthlyDates(
    year: number,
    month: number,
    base: Date,
    recurrence: CalendarEventRecurrence
  ): Date[] {
    return calendarRecurrence.buildMonthlyDatesHelper(this, year, month, base, recurrence);
  }

  private getNthWeekdayOfMonth(
    year: number,
    month: number,
    weekday: number,
    pos: number,
    base: Date
  ): Date | null {
    return calendarRecurrence.getNthWeekdayOfMonthHelper(this, year, month, weekday, pos, base);
  }

  private applyTimeRule(date: Date, base: Date, recurrence: CalendarEventRecurrence): Date {
    return calendarRecurrence.applyTimeRuleHelper(this, date, base, recurrence);
  }

  private isExceptionDate(date: Date, exceptions: string[]): boolean {
    return calendarRecurrence.isExceptionDateHelper(this, date, exceptions);
  }

  private normalizeResourceIds(value: string | string[] | undefined): string[] {
    return calendarResources.normalizeResourceIdsHelper(this, value);
  }

  protected createEditorModel(): EditorModel {
    return {
      id: '',
      templateId: '',
      title: '',
      allDay: true,
      startDate: this.toDateInput(this.anchorDate),
      startTime: '09:00',
      endDate: this.toDateInput(this.anchorDate),
      endTime: '17:00',
      type: '',
      status: '',
      resourceId: '',
      layer: '',
      timeZone: '',
      location: '',
      meta: '',
      description: '',
      url: '',
      exceptions: '',
      recurrenceFreq: 'none',
      recurrenceInterval: 1,
      recurrenceCount: 0,
      recurrenceUntil: '',
      recurrenceWeekdays: [],
      recurrenceByMonth: '',
      recurrenceByMonthDay: '',
      recurrenceBySetPos: '',
      recurrenceByHour: '',
      recurrenceByMinute: ''
    };
  }

  protected createEditorModelFromEvent(event: NormalizedEvent): EditorModel {
    const model = this.createEditorModel();
    model.id = event.originalId;
    model.templateId = '';
    model.title = event.title;
    model.allDay = event.allDay;
    model.startDate = this.toDateInput(event.start);
    model.endDate = this.toDateInput(event.end);
    model.startTime = this.toTimeInput(event.start);
    model.endTime = this.toTimeInput(event.end);
    model.type = event.type || '';
    model.status = event.status || '';
    model.resourceId = event.resourceIds?.[0] || '';
    model.layer = event.layer || '';
    model.timeZone = event.timeZone || '';
    model.location = event.location || '';
    model.meta = event.meta || '';
    model.description = event.description || '';
    model.url = event.url || '';
    model.exceptions = (event.exceptions || []).join(', ');

    if (event.recurrence) {
      model.recurrenceFreq = event.recurrence.freq;
      model.recurrenceInterval = event.recurrence.interval ?? 1;
      model.recurrenceCount = event.recurrence.count ?? 0;
      model.recurrenceUntil = event.recurrence.until
        ? this.toDateInput(this.parseDateInput(event.recurrence.until))
        : '';
      model.recurrenceWeekdays = event.recurrence.byWeekday
        ? event.recurrence.byWeekday.slice()
        : [];
      model.recurrenceByMonth = event.recurrence.byMonth ? event.recurrence.byMonth.join(', ') : '';
      model.recurrenceByMonthDay = event.recurrence.byMonthDay
        ? event.recurrence.byMonthDay.join(', ')
        : '';
      model.recurrenceBySetPos = event.recurrence.bySetPos
        ? event.recurrence.bySetPos.join(', ')
        : '';
      model.recurrenceByHour = event.recurrence.byHour ? event.recurrence.byHour.join(', ') : '';
      model.recurrenceByMinute = event.recurrence.byMinute
        ? event.recurrence.byMinute.join(', ')
        : '';
    }

    return model;
  }

  private buildEventFromEditor(): CalendarEvent | null {
    if (!this.editorModel.title.trim()) {
      return null;
    }
    const startDate = this.editorModel.startDate || this.toDateInput(this.anchorDate);
    const endDate = this.editorModel.endDate || startDate;
    const start = this.editorModel.allDay
      ? this.parseDateInput(startDate)
      : this.parseDateInput(`${startDate}T${this.editorModel.startTime || '09:00'}`);
    let end = this.editorModel.allDay
      ? this.parseDateInput(endDate)
      : this.parseDateInput(`${endDate}T${this.editorModel.endTime || '17:00'}`);
    if (end < start) {
      end = start;
    }

    const payload: CalendarEvent = {
      id: this.editorModel.id || `EV-${Date.now()}`,
      title: this.editorModel.title.trim(),
      start,
      end,
      allDay: this.editorModel.allDay,
      type: this.editorModel.type || undefined,
      status: this.editorModel.status || undefined,
      resourceId: this.editorModel.resourceId || undefined,
      layer: this.editorModel.layer || undefined,
      timeZone: this.editorModel.timeZone || undefined,
      location: this.editorModel.location || undefined,
      meta: this.editorModel.meta || undefined,
      description: this.editorModel.description || undefined,
      url: this.editorModel.url || undefined,
      exceptions: this.parseExceptions(this.editorModel.exceptions)
    };

    if (this.editorModel.recurrenceFreq !== 'none') {
      payload.recurrence = {
        freq: this.editorModel.recurrenceFreq,
        interval: this.editorModel.recurrenceInterval || 1,
        count: this.editorModel.recurrenceCount || undefined,
        until: this.editorModel.recurrenceUntil || undefined,
        byWeekday: this.editorModel.recurrenceWeekdays.length
          ? this.editorModel.recurrenceWeekdays.slice()
          : undefined,
        byMonth: this.parseNumberList(this.editorModel.recurrenceByMonth),
        byMonthDay: this.parseNumberList(this.editorModel.recurrenceByMonthDay),
        bySetPos: this.parseNumberList(this.editorModel.recurrenceBySetPos),
        byHour: this.parseNumberList(this.editorModel.recurrenceByHour),
        byMinute: this.parseNumberList(this.editorModel.recurrenceByMinute)
      };
    }

    return payload;
  }

  private buildYearView(rangeStart: Date): void {
    if (this.currentView !== 'year') {
      this.yearMonths = [];
      return;
    }
    const year = rangeStart.getFullYear();
    this.yearMonths = this.buildYearMonths(year);
  }

  private buildQuarterView(rangeStart: Date): void {
    if (this.currentView !== 'quarter') {
      this.quarterMonths = [];
      return;
    }
    const quarterIndex = Math.floor(rangeStart.getMonth() / 3);
    const startMonth = quarterIndex * 3;
    this.quarterMonths = this.buildYearMonths(rangeStart.getFullYear(), startMonth, startMonth + 2);
  }

  private buildTimeline(rangeStart: Date, rangeEnd: Date, events: NormalizedEvent[]): void {
    if (this.currentView !== 'timeline') {
      this.timelineDays = [];
      this.timelineRows = [];
      return;
    }
    const days: TimelineDay[] = [];
    let cursor = new Date(rangeStart);
    while (cursor <= rangeEnd) {
      days.push({
        date: new Date(cursor),
        iso: this.toDateInput(cursor),
        label: this.formatDate(cursor, { weekday: 'short' }),
        isToday: this.isToday(cursor),
        isWeekend: this.isWeekend(cursor),
        holidays: this.getHolidaysForDate(cursor)
      });
      cursor = this.addDays(cursor, 1);
    }

    const dayCount = days.length;
    const rows: TimelineRow[] = [];
    const handled = new Set<string>();
    const activeResources =
      this.selectedResource !== 'all' ? new Set([this.selectedResource]) : null;
    for (const resource of this.resourceOptions) {
      if (activeResources && !activeResources.has(resource.id)) {
        continue;
      }
      const groupEvents = events.filter(ev => ev.resourceIds.includes(resource.id));
      handled.add(resource.id);
      rows.push({
        id: resource.id,
        name: resource.name,
        color: resource.color,
        events: groupEvents,
        eventCount: groupEvents.length,
        bars: this.buildTimelineBars(rangeStart, rangeEnd, groupEvents, dayCount)
      });
    }
    if (!activeResources) {
      const unassigned = events.filter(
        ev => !ev.resourceIds.length || !ev.resourceIds.some(id => handled.has(id))
      );
      if (unassigned.length) {
        rows.push({
          id: 'unassigned',
          name: 'Unassigned',
          color: '',
          events: unassigned,
          eventCount: unassigned.length,
          bars: this.buildTimelineBars(rangeStart, rangeEnd, unassigned, dayCount)
        });
      }
    }

    this.timelineDays = days;
    this.timelineRows = rows;
  }

  private buildYearMonths(year: number, startMonth = 0, endMonth = 11): YearMonth[] {
    const monthList: YearMonth[] = [];
    const dayCounts = this.buildDayCounts(this.filteredEvents);
    const maxCount = Math.max(1, ...Array.from(dayCounts.values()));

    for (let month = startMonth; month <= endMonth; month += 1) {
      const label = this.formatDate(new Date(year, month, 1), { month: 'short' });
      const first = new Date(year, month, 1);
      const start = this.startOfWeek(first);
      const last = new Date(year, month + 1, 0);
      const end = this.endOfWeek(last);
      const days: YearDay[] = [];
      let cursor = new Date(start);
      while (cursor <= end) {
        const iso = this.toDateInput(cursor);
        const count = dayCounts.get(iso) || 0;
        days.push({
          date: new Date(cursor),
          iso,
          inMonth: cursor.getMonth() === month,
          isToday: this.isToday(cursor),
          isWeekend: this.isWeekend(cursor),
          count,
          heat: Math.round((count / maxCount) * 100),
          hasHoliday: this.getHolidaysForDate(cursor).length > 0
        });
        cursor = this.addDays(cursor, 1);
      }
      monthList.push({ date: new Date(year, month, 1), label, days });
    }
    return monthList;
  }

  private buildDayCounts(events: NormalizedEvent[]): Map<string, number> {
    return calendarRecurrence.buildDayCountsHelper(this, events);
  }
  private buildListRows(): void {
    return calendarList.buildListRowsHelper(this);
  }
  private buildResourceGroups(rangeStart: Date, rangeEnd: Date): void {
    if (
      !this.groupByResource ||
      !this.resourceOptions.length ||
      (this.currentView !== 'week' && this.currentView !== 'day')
    ) {
      this.resourceGroups = [];
      return;
    }
    const groups: ResourceGroup[] = [];
    const events = this.filteredEvents;
    const handled = new Set<string>();
    const activeResources =
      this.selectedResource !== 'all' ? new Set([this.selectedResource]) : null;
    for (const resource of this.resourceOptions) {
      if (activeResources && !activeResources.has(resource.id)) {
        continue;
      }
      const groupEvents = events.filter(ev => ev.resourceIds.includes(resource.id));
      handled.add(resource.id);
      groups.push({
        id: resource.id,
        name: resource.name,
        color: resource.color,
        events: groupEvents,
        allDayBars: this.buildBarsForRange(
          rangeStart,
          rangeEnd,
          groupEvents.filter(ev => ev.allDay)
        ),
        timeGridDays: this.buildTimeGrid(
          this.weekDays,
          groupEvents.filter(ev => !ev.allDay)
        )
      });
    }
    const unassigned = events.filter(
      ev => !ev.resourceIds.length || !ev.resourceIds.some(id => handled.has(id))
    );
    if (unassigned.length) {
      groups.push({
        id: 'unassigned',
        name: 'Unassigned',
        color: '',
        events: unassigned,
        allDayBars: this.buildBarsForRange(
          rangeStart,
          rangeEnd,
          unassigned.filter(ev => ev.allDay)
        ),
        timeGridDays: this.buildTimeGrid(
          this.weekDays,
          unassigned.filter(ev => !ev.allDay)
        )
      });
    }
    this.resourceGroups = groups;
  }

  private markConflicts(events: NormalizedEvent[]): NormalizedEvent[] {
    const groups = new Map<string, NormalizedEvent[]>();
    const counts = new Map<string, number>();
    for (const ev of events) {
      const keys = ev.resourceIds.length ? ev.resourceIds : ['global'];
      for (const key of keys) {
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(ev);
      }
    }
    for (const list of groups.values()) {
      list.sort((a, b) => a.start.getTime() - b.start.getTime());
      for (let i = 0; i < list.length; i += 1) {
        const current = list[i];
        for (let j = i + 1; j < list.length; j += 1) {
          const next = list[j];
          if (next.start >= current.end) {
            break;
          }
          if (current.end > next.start) {
            current.conflict = true;
            next.conflict = true;
            counts.set(current.id, (counts.get(current.id) || 0) + 1);
            counts.set(next.id, (counts.get(next.id) || 0) + 1);
          }
        }
      }
    }
    for (const ev of events) {
      if (ev.conflict) {
        ev.conflictCount = counts.get(ev.id) || 1;
      }
    }
    return events;
  }
  private resolveResourceOptions(events: NormalizedEvent[]): CalendarResource[] {
    if (this.resources?.length) {
      return this.resources.slice();
    }
    const map = new Map<string, CalendarResource>();
    for (const ev of events) {
      for (const id of ev.resourceIds) {
        if (!map.has(id)) {
          map.set(id, { id, name: id });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  protected override buildIcs(events: NormalizedEvent[]): string {
    return calendarUtils.buildIcs(events);
  }
}
