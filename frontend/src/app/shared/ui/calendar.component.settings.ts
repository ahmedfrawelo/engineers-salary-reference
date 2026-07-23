import type { CalendarComponentPresenter } from './calendar.component.presenter';
import type { LooseValue } from './calendar.component.state';

export function getTimeZonesHelper(ctx: CalendarComponentPresenter): string[] {
  const supported = (Intl as LooseValue).supportedValuesOf?.('timeZone');
  if (Array.isArray(supported)) {
    return supported.slice();
  }
  return ['UTC', 'Asia/Riyadh', 'Europe/London', 'America/New_York'];
}

export function buildWeekdayOptionsHelper(ctx: CalendarComponentPresenter): void {
  const labels = buildWeekdayLabelsHelper(ctx);
  const options: { label: string; value: number }[] = [];
  for (let i = 0; i < 7; i += 1) {
    const weekday = (ctx.weekStart + i) % 7;
    options.push({ label: labels[i], value: weekday });
  }
  ctx.weekdayOptions = options;
}

export function buildWeekdayLabelsHelper(ctx: CalendarComponentPresenter): string[] {
  const start = ctx.startOfWeek(ctx.anchorDate);
  const labels: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    labels.push(ctx.formatDate(ctx.addDays(start, i), { weekday: 'short' }));
  }
  return labels;
}
