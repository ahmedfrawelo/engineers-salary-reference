import { Directive, EventEmitter, Input, Output } from '@angular/core';
import { GridColumn, GridConfig } from '../data-grid';
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
  CalendarLegendItem,
  CalendarListRow,
  CalendarPolicyConfig,
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

export type LooseValue = ReturnType<typeof JSON.parse>;

@Directive()
export abstract class CalendarComponentState {
  protected abstract startOfDay(date: Date): Date;
  protected abstract createEditorModel(): EditorModel;

  @Input() events: CalendarEvent[] = [];
  @Input() legend: CalendarLegendItem[] = [];
  @Input() holidays: CalendarHoliday[] = [];
  @Input() policy: CalendarPolicyConfig | null = null;
  @Input() policyMode: 'warn' | 'block' = 'warn';
  @Input() title = 'Calendar';
  @Input() subtitle = '';
  @Input() view: CalendarView = 'month';
  @Input() viewOptions: CalendarView[] = ['month', 'week', 'day', 'agenda'];
  @Input() weekStart = 0;
  @Input() weekendDays: number[] = [5, 6];
  @Input() maxVisiblePerDay = 3;
  @Input() emptyMessage = 'No events scheduled.';
  @Input() emptyDayMessage = 'No events.';
  @Input() resources: CalendarResource[] = [];
  @Input() layers: string[] = [];
  @Input() resourceLabel = 'Resources';
  @Input() layerLabel = 'Layers';
  @Input() groupByResource = false;
  @Input() showConflicts = true;
  @Input() enableExport = true;
  @Input() enableImport = true;
  @Input() enablePresets = true;
  @Input() persistEvents = false;
  @Input() persistState = false;
  @Input() storageKey = '';
  @Input() eventTemplates: CalendarTemplate[] = [];
  @Input() showToolbar = true;
  @Input() showNav = true;
  @Input() showToday = true;
  @Input() showViewToggle = true;
  @Input() showWeekdayHeader = true;
  @Input() showWeekNumbers = false;
  @Input() showLegend = true;
  @Input() showSidePanel = true;
  @Input() sidePanelPosition: CalendarSidePanelPosition = 'left';
  @Input() sidePanelDefaultWidth = 332;
  @Input() sidePanelMinWidth = 304;
  @Input() sidePanelMaxWidth = 440;
  @Input()
  set showMini(value: boolean) {
    this.showSidePanel = value;
  }
  get showMini(): boolean {
    return this.showSidePanel;
  }
  @Input() showHolidays = true;
  @Input() showNowIndicator = true;
  @Input() showJump = true;
  @Input() showTimeZone = false;
  @Input() enableFilters = true;
  @Input() enableQuickAdd = true;
  @Input() enableSelection = true;
  @Input() enableDragDrop = true;
  @Input() enableResize = true;
  @Input() enableEditor = true;
  @Input() showWorkingHours = true;
  @Input() rtl = false;
  @Input() locale = 'en-US';
  @Input() timeSlotMinutes = 30;
  @Input() startHour = 0;
  @Input() endHour = 24;
  @Input() workStartHour = 8;
  @Input() workEndHour = 18;
  @Input() timelineSpanDays = 14;
  @Input() agendaDays = 30;
  @Input() maxUpcoming = 5;
  @Input() initialDate: string | Date | null = null;
  @Input() maxHolidayLabels = 1;

  @Output() eventCreate = new EventEmitter<CalendarEvent>();
  @Output() eventChange = new EventEmitter<CalendarEventChange>();
  @Output() eventDelete = new EventEmitter<CalendarEvent>();
  @Output() eventClick = new EventEmitter<CalendarEvent>();
  @Output() eventsImport = new EventEmitter<CalendarEvent[]>();
  @Output() eventsExport = new EventEmitter<{ type: 'ics' | 'csv'; payload: string }>();
  @Output() rangeChange = new EventEmitter<{ start: Date; end: Date }>();
  @Output() timeZoneChange = new EventEmitter<string>();
  @Output() dateClick = new EventEmitter<Date>();
  @Output() stateChange = new EventEmitter<{
    view: CalendarView;
    anchor: Date;
    query: string;
    type: string;
    status: string;
    resource: string;
    layer: string;
    timeZone: string;
  }>();
  @Output() presetChange = new EventEmitter<CalendarFilterPreset>();

  readonly viewLabels = {
    month: 'Month',
    week: 'Week',
    day: 'Day',
    agenda: 'Schedule',
    year: 'Year',
    quarter: 'Quarter',
    list: 'List',
    timeline: 'Timeline'
  };
  currentView: CalendarView = 'month';
  anchorDate = this.startOfDay(new Date());

  calendarSubtitle = '';
  jumpDate = '';

  localTimeZone = 'UTC';
  resolvedTimeZones: string[] = [];
  selectedTimeZone = '';
  quickAddText = '';

  searchQuery = '';
  selectedType = 'all';
  selectedStatus = 'all';
  selectedResource = 'all';
  selectedLayer = 'all';
  typeOptions: string[] = [];
  statusOptions: string[] = [];
  resourceOptions: CalendarResource[] = [];
  layerOptions: string[] = [];

  presets: CalendarFilterPreset[] = [];
  selectedPresetId = '';
  readonly presetStorageKey = 'calendar-presets';
  readonly stateStorageKey = 'calendar-state';
  lastPersistedCalendarStateJson = '';
  protected holidayMap = new Map<string, CalendarHoliday[]>();

  calendarWeekdayLabels: string[] = [];
  readonly defaultCalendarSidePanelOrder: CalendarSidePanelId[] = [
    'upcoming',
    'insights',
    'health',
    'risk',
    'flow',
    'timing',
    'eventMix',
    'status',
    'resources',
    'weekdays'
  ];
  calendarSidePanelOrder: CalendarSidePanelId[] = [...this.defaultCalendarSidePanelOrder];
  calendarSidePanelItems: CalendarSidePanelId[] = [];
  calendarSidePanelOptions: Array<{
    id: CalendarSidePanelId;
    label: string;
    enabled: boolean;
    available: boolean;
  }> = [];
  readonly calendarSidePanelLabels: Record<CalendarSidePanelId, string> = {
    upcoming: 'Upcoming',
    insights: 'Calendar insights',
    health: 'Schedule health',
    risk: 'Risk review',
    flow: 'Flow',
    timing: 'Timing',
    eventMix: 'Event mix',
    status: 'Status',
    resources: 'Resources',
    weekdays: 'Weekdays'
  };
  calendarSidePanelCollapsedState: Record<CalendarSidePanelId, boolean> = {
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
  calendarSidePanelHiddenState: Record<CalendarSidePanelId, boolean> = {
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
  calendarSidePanelSummary: Record<CalendarSidePanelId, string> = {
    upcoming: '',
    insights: '',
    health: '',
    risk: '',
    flow: '',
    timing: '',
    eventMix: '',
    status: '',
    resources: '',
    weekdays: ''
  };
  calendarSidePanelCollapsedVisibleCount = 0;
  calendarSidePanelAllCollapsed = false;
  calendarSidePanelResetAvailable = false;
  calendarSidePanelStatusLabel = '';
  calendarSidePanelPickerOpen = false;
  calendarSidePanelEnabledCount = 0;
  calendarSidePanelWidth = 332;
  calendarSidePanelPosition: CalendarSidePanelPosition = 'left';
  calendarSidePanelMoveTitle = 'Move analysis right';
  calendarSidePanelMoveIcon = 'arrow-right';
  calendarSidePanelDragging = false;
  calendarSidePanelResizing = false;
  calendarSidePanelDragPreviewPosition: CalendarSidePanelPosition | null = null;
  calendarInsightRangeLabel = '';
  calendarInsightMetrics: CalendarInsightMetric[] = [];
  calendarHealthMetrics: CalendarInsightMetric[] = [];
  calendarRiskMetrics: CalendarInsightMetric[] = [];
  calendarFlowMetrics: CalendarInsightMetric[] = [];
  calendarTypeBreakdown: CalendarBreakdownItem[] = [];
  calendarStatusBreakdown: CalendarBreakdownItem[] = [];
  calendarResourceBreakdown: CalendarBreakdownItem[] = [];
  calendarTimingBreakdown: CalendarBreakdownItem[] = [];
  calendarWeekdayBreakdown: CalendarBreakdownItem[] = [];
  monthWeeks: MonthWeek[] = [];
  weekDays: WeekDay[] = [];
  weekAllDayBars: CalendarBar[] = [];
  timeGridDays: DayColumn[] = [];
  agendaEvents: NormalizedEvent[] = [];
  yearMonths: YearMonth[] = [];
  quarterMonths: YearMonth[] = [];
  timelineDays: TimelineDay[] = [];
  timelineRows: TimelineRow[] = [];
  resourceGroups: ResourceGroup[] = [];
  listRows: CalendarListRow[] = [];
  upcomingEvents: NormalizedEvent[] = [];

  timeLabels: string[] = [];
  slotCount = 0;
  hourCount = 0;
  hourHeight = 46;
  hourHeightCss = '46px';
  workStartPercent = 0;
  workEndPercent = 100;

  nowIndicator = { show: false, dayIndex: 0, top: 0 };
  protected nowTimer?: number;

  protected selectionMode: 'month' | 'time' | 'all-day' | null = null;
  protected selectionStart?: Date;
  protected selectionEnd?: Date;
  protected selectionResourceId?: string;
  protected selectionContainer?: HTMLElement;
  protected suppressClick = false;

  policyWarnings: string[] = [];

  editorModel: EditorModel = this.createEditorModel();
  editorOpen = false;
  editorMode: 'create' | 'edit' = 'create';
  editorTitle = '';
  editorSubtitle = '';

  weekdayOptions: { label: string; value: number }[] = [];

  listColumns: GridColumn<CalendarListRow>[] = [
    { field: 'title', header: 'Title', width: 220, sortable: true, filterable: true },
    { field: 'start', header: 'Start', width: 160, sortable: true, filterable: true },
    { field: 'end', header: 'End', width: 160, sortable: true, filterable: true },
    { field: 'type', header: 'Type', width: 140, sortable: true, filterable: true },
    { field: 'status', header: 'Status', width: 140, sortable: true, filterable: true },
    { field: 'resource', header: 'Resource', width: 180, sortable: true, filterable: true },
    { field: 'layer', header: 'Layer', width: 140, sortable: true, filterable: true },
    { field: 'meta', header: 'Meta', width: 240, sortable: false, filterable: true }
  ];

  listConfig: GridConfig = {
    simpleMode: true,
    selectable: false,
    pagination: true,
    pageSize: 15,
    pageSizeOptions: [15, 25, 50],
    multiSort: true,
    showFilter: true,
    hover: true,
    striped: false,
    bordered: false,
    editMode: 'none',
    density: 'compact',
    rtl: false,
    emptyMessage: 'No events to show.',
    ariaLabel: 'Calendar list'
  };

  protected initialized = false;
  protected internalEvents: CalendarEvent[] = [];
  protected normalizedEvents: NormalizedEvent[] = [];
  filteredEvents: NormalizedEvent[] = [];
  protected draggedEvent?: NormalizedEvent;
  protected resizeState?: {
    event: NormalizedEvent;
    edge: 'start' | 'end' | 'time';
    startX: number;
    startY: number;
    originStart: Date;
    originEnd: Date;
    containerWidth: number;
    containerHeight: number;
    mode: 'bar' | 'time';
    nextStart?: Date;
    nextEnd?: Date;
  };
}
