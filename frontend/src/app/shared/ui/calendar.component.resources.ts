import type { CalendarComponentPresenter } from './calendar.component.presenter';

export function normalizeResourceIdsHelper(
  _ctx: CalendarComponentPresenter,
  value: string | string[] | undefined
): string[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  return [value];
}
