import type {
  CalendarEvent,
  CalendarLegendItem,
  CalendarResource,
  CalendarView
} from '@shared/ui/calendar.component';
import type { TenderRow } from './tender-project-details/project-details.component';

export type TenderProjectsCalendarModel = {
  events: CalendarEvent[];
  resources: CalendarResource[];
  legend: CalendarLegendItem[];
  initialDate: string | null;
};

export type TenderProjectsCalendarGrouping = {
  field: string | null;
  label: string;
  order: 'asc' | 'desc';
  dateInterval?: 'day' | 'week' | 'month' | 'quarter' | 'year';
};

export const TENDER_PROJECT_CALENDAR_STORAGE_KEY = 'tender-projects-calendar-v2';
export const TENDER_PROJECT_CALENDAR_VIEW_OPTIONS: CalendarView[] = [
  'day',
  'week',
  'month',
  'year',
  'agenda',
  'timeline'
];

const TENDER_PROJECT_EVENT_TYPE_LABELS = ['Deadline', 'Project timeline', 'Accepted'];

const TENDER_PROJECT_EVENT_TYPE_COLORS: Record<string, string> = {
  Deadline: 'var(--app-color-danger)',
  'Project timeline': 'var(--app-color-primary)',
  Accepted: 'var(--app-color-success)'
};

const TENDER_PROJECT_CALENDAR_LEGEND: CalendarLegendItem[] = TENDER_PROJECT_EVENT_TYPE_LABELS.map(label => ({
  id: label,
  label,
  color: TENDER_PROJECT_EVENT_TYPE_COLORS[label]
}));

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeDateInput(value: unknown): string | null {
  const raw = normalizeText(value);
  if (!raw) {
    return null;
  }

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createDateInputNormalizer() {
  const cache = new Map<string, string | null>();
  return (value: unknown): string | null => {
    const raw = normalizeText(value);
    if (!raw) {
      return null;
    }
    if (cache.has(raw)) {
      return cache.get(raw) ?? null;
    }
    const normalized = normalizeDateInput(raw);
    cache.set(raw, normalized);
    return normalized;
  };
}

function compareDateInput(left: string, right: string): number {
  return left.localeCompare(right);
}

function normalizeResourceId(value: unknown): string {
  return normalizeText(value, 'Unassigned');
}

function formatDateGroup(value: unknown, interval: TenderProjectsCalendarGrouping['dateInterval']) {
  const iso = normalizeDateInput(value);
  if (!iso) {
    return 'No date';
  }

  const date = new Date(`${iso}T00:00:00`);
  if (!Number.isFinite(date.getTime())) {
    return 'No date';
  }

  const year = date.getFullYear();
  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = String(date.getDate()).padStart(2, '0');

  if (interval === 'year') {
    return String(year);
  }
  if (interval === 'quarter') {
    return `Q${Math.floor(date.getMonth() / 3) + 1} ${year}`;
  }
  if (interval === 'month') {
    return `${month} ${year}`;
  }
  if (interval === 'week') {
    const weekStart = new Date(date);
    const diff = (weekStart.getDay() + 6) % 7;
    weekStart.setDate(weekStart.getDate() - diff);
    const startMonth = weekStart.toLocaleString('en-US', { month: 'short' });
    return `${startMonth} ${weekStart.getDate()}, ${weekStart.getFullYear()}`;
  }
  return `${month} ${day}, ${year}`;
}

function resolveCalendarResource(row: TenderRow, grouping?: TenderProjectsCalendarGrouping) {
  const field = grouping?.field?.trim();
  if (!field) {
    const assignee = normalizeResourceId(row.assignTo);
    return { id: assignee, name: assignee };
  }

  const value = (row as Record<string, unknown>)[field];
  const isDateGroup =
    field.toLowerCase().includes('date') || field.toLowerCase().includes('deadline');
  const name = isDateGroup
    ? formatDateGroup(value, grouping?.dateInterval)
    : normalizeText(value, `No ${grouping?.label || 'group'}`);
  return { id: `${field}:${name}`, name };
}

function projectCalendarKey(row: TenderRow, index: number): string {
  if (row.id != null) {
    return `id:${row.id}`;
  }
  const title = normalizeText(row.title, `row-${index}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  return `title:${title || index}`;
}

function createCalendarEvent(
  row: TenderRow,
  key: string,
  kind: 'deadline' | 'timeline' | 'accepted',
  start: string,
  end: string,
  resourceId: string
): CalendarEvent {
  const type =
    kind === 'deadline' ? 'Deadline' : kind === 'accepted' ? 'Accepted' : 'Project timeline';
  const title =
    kind === 'deadline'
      ? `${row.title} deadline`
      : kind === 'accepted'
        ? `${row.title} accepted`
        : row.title;

  return {
    id: `tender-project:${key}:${kind}`,
    title,
    start,
    end,
    allDay: true,
    type,
    status: row.status,
    color: TENDER_PROJECT_EVENT_TYPE_COLORS[type],
    resourceId,
    layer: normalizeText(row.ts, 'No stage'),
    location: normalizeText(row.country),
    meta: [normalizeText(row.owner), normalizeText(row.top), normalizeText(row.doi)]
      .filter(Boolean)
      .join(' - '),
    description: normalizeText(row.description)
  };
}

export function buildTenderProjectsCalendarModel(
  rows: readonly TenderRow[],
  grouping?: TenderProjectsCalendarGrouping
): TenderProjectsCalendarModel {
  const events: CalendarEvent[] = [];
  const resources = new Map<string, CalendarResource>();
  const normalizeDate = createDateInputNormalizer();

  rows.forEach((row, index) => {
    const key = projectCalendarKey(row, index);
    const resource = resolveCalendarResource(row, grouping);
    resources.set(resource.id, resource);

    const startDate = normalizeDate(row.startDate);
    const endDate = normalizeDate(row.endDate);
    const deadline = normalizeDate(row.deadline);
    const acceptDate = normalizeDate(row.acceptDate);

    if (startDate && endDate && compareDateInput(startDate, endDate) <= 0) {
      events.push(createCalendarEvent(row, key, 'timeline', startDate, endDate, resource.id));
    } else if (startDate) {
      events.push(createCalendarEvent(row, key, 'timeline', startDate, startDate, resource.id));
    }

    if (deadline) {
      events.push(createCalendarEvent(row, key, 'deadline', deadline, deadline, resource.id));
    }

    if (acceptDate) {
      events.push(createCalendarEvent(row, key, 'accepted', acceptDate, acceptDate, resource.id));
    }
  });

  const resourceSort = grouping?.order === 'desc' ? -1 : 1;
  const sortedEvents = events.sort(
    (left, right) =>
      String(left.start).localeCompare(String(right.start)) || left.title.localeCompare(right.title)
  );
  return {
    events: sortedEvents,
    resources: Array.from(resources.values()).sort(
      (left, right) =>
        resourceSort * left.name.localeCompare(right.name, 'en', { sensitivity: 'base' })
    ),
    legend: TENDER_PROJECT_CALENDAR_LEGEND,
    initialDate: resolveInitialDateFromSortedEvents(sortedEvents)
  };
}

function resolveInitialDateFromSortedEvents(events: readonly CalendarEvent[], now = new Date()): string | null {
  if (!events.length) {
    return null;
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  let lastPastDate: string | null = null;

  for (const event of events) {
    const iso = typeof event.start === 'string' ? normalizeDateInput(event.start) : normalizeDateInput(event.start);
    if (!iso) {
      continue;
    }
    const time = new Date(`${iso}T00:00:00`).getTime();
    if (!Number.isFinite(time)) {
      continue;
    }
    if (time >= today) {
      return iso;
    }
    lastPastDate = iso;
  }

  return lastPastDate;
}

export function resolveTenderProjectCalendarEventRow(
  event: CalendarEvent,
  rows: readonly TenderRow[]
): TenderRow | null {
  const idMatch = event.id.match(/^tender-project:id:(\d+):/);
  if (idMatch) {
    const id = Number(idMatch[1]);
    return rows.find(row => row.id === id) ?? null;
  }

  const title = event.title
    .replace(/\s+(deadline|accepted)$/i, '')
    .trim()
    .toLowerCase();
  if (!title) {
    return null;
  }
  return rows.find(row => row.title.trim().toLowerCase() === title) ?? null;
}

export function resolveTenderProjectsCalendarInitialDate(
  model: TenderProjectsCalendarModel,
  now = new Date()
): string | null {
  return model.initialDate ?? resolveInitialDateFromSortedEvents(model.events, now);
}
