import type { CalendarEvent, CalendarFilterPreset, CalendarView } from './calendar.models';

export interface CalendarStateSnapshot {
  view: CalendarView;
  anchor: Date;
  query: string;
  type: string;
  status: string;
  resource: string;
  layer: string;
  timeZone: string;
}

export interface CalendarStorageHost {
  stateStorageKey: string;
  presetStorageKey: string;
  persistState: boolean;
  persistEvents: boolean;
  enablePresets: boolean;
  currentView: CalendarView;
  anchorDate: Date;
  searchQuery: string;
  selectedType: string;
  selectedStatus: string;
  selectedResource: string;
  selectedLayer: string;
  selectedTimeZone: string;
  internalEvents: CalendarEvent[];
  events: CalendarEvent[];
  presets: CalendarFilterPreset[];
  canStore(): boolean;
  getStorageKey(suffix: string): string;
  parseDateInput(value: string | Date): Date;
  startOfDay(date: Date): Date;
  toDateInput(date: Date): string;
  lastPersistedCalendarStateJson?: string;
  stateChange: { emit(payload: CalendarStateSnapshot): void };
}

function readStoredString(state: Record<string, unknown>, key: string, fallback: string): string {
  const value = state[key];
  return typeof value === 'string' ? value : fallback;
}

export function persistCalendarState(host: CalendarStorageHost): void {
  if (!host.persistState || !host.canStore()) {
    return;
  }

  const snapshot: CalendarStateSnapshot = {
    view: host.currentView,
    anchor: host.anchorDate,
    query: host.searchQuery,
    type: host.selectedType,
    status: host.selectedStatus,
    resource: host.selectedResource,
    layer: host.selectedLayer,
    timeZone: host.selectedTimeZone
  };

  const serialized = JSON.stringify({
    view: snapshot.view,
    anchor: host.toDateInput(snapshot.anchor),
    query: snapshot.query,
    type: snapshot.type,
    status: snapshot.status,
    resource: snapshot.resource,
    layer: snapshot.layer,
    timeZone: snapshot.timeZone
  });

  if (host.lastPersistedCalendarStateJson === serialized) {
    return;
  }

  localStorage.setItem(host.getStorageKey(host.stateStorageKey), serialized);
  host.lastPersistedCalendarStateJson = serialized;
  host.stateChange.emit(snapshot);
}

export function loadCalendarState(host: CalendarStorageHost): boolean {
  if (!host.persistState || !host.canStore()) {
    return false;
  }

  const raw = localStorage.getItem(host.getStorageKey(host.stateStorageKey));
  if (!raw) {
    return false;
  }

  try {
    const state = JSON.parse(raw) as Record<string, unknown>;
    host.lastPersistedCalendarStateJson = raw;
    const view = state['view'];
    if (typeof view === 'string') {
      host.currentView = view as CalendarView;
    }

    const anchor = state['anchor'];
    if (typeof anchor === 'string') {
      host.anchorDate = host.startOfDay(host.parseDateInput(anchor));
    }

    host.searchQuery = readStoredString(state, 'query', '');
    host.selectedType = readStoredString(state, 'type', 'all');
    host.selectedStatus = readStoredString(state, 'status', 'all');
    host.selectedResource = readStoredString(state, 'resource', 'all');
    host.selectedLayer = readStoredString(state, 'layer', 'all');
    host.selectedTimeZone = readStoredString(state, 'timeZone', '');
    return true;
  } catch {
    return false;
  }
}

export function persistCalendarEvents(host: CalendarStorageHost): void {
  if (!host.persistEvents || !host.canStore()) {
    return;
  }

  localStorage.setItem(host.getStorageKey('events'), JSON.stringify(host.internalEvents));
}

export function loadCalendarEvents(host: CalendarStorageHost): void {
  if (!host.persistEvents || !host.canStore()) {
    return;
  }

  const raw = localStorage.getItem(host.getStorageKey('events'));
  if (!raw) {
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) {
      host.internalEvents = parsed as CalendarEvent[];
    }
  } catch {
    return;
  }
}

export function loadCalendarPresets(host: CalendarStorageHost): void {
  if (!host.enablePresets || !host.canStore()) {
    return;
  }

  const raw = localStorage.getItem(host.getStorageKey(host.presetStorageKey));
  if (!raw) {
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      host.presets = parsed as CalendarFilterPreset[];
    }
  } catch {
    return;
  }
}

export function persistCalendarPresets(host: CalendarStorageHost): void {
  if (!host.enablePresets || !host.canStore()) {
    return;
  }

  localStorage.setItem(host.getStorageKey(host.presetStorageKey), JSON.stringify(host.presets));
}

export function mergeExternalCalendarEvents(host: CalendarStorageHost): void {
  if (!Array.isArray(host.events) || !host.events.length) {
    return;
  }

  const existing = new Set(host.internalEvents.map(item => item.id));
  const incoming = host.events.filter(item => !existing.has(item.id));
  if (incoming.length) {
    host.internalEvents = [...incoming, ...host.internalEvents];
  }
}

export function downloadCalendarFile(content: string, filename: string, type: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
