import type { CalendarComponentPresenter } from './calendar.component.presenter';

export function buildListRowsHelper(ctx: CalendarComponentPresenter): void {
  if (ctx.currentView !== 'list') {
    ctx.listRows = [];
    return;
  }
  const resourceMap = new Map(ctx.resourceOptions.map(item => [item.id, item.name]));
  ctx.listRows = ctx.filteredEvents.map(ev => ({
    id: ev.id,
    title: ev.title,
    start: ctx.formatDateForEvent(
      ev.start,
      ev,
      ev.allDay
        ? { year: 'numeric', month: 'short', day: 'numeric' }
        : { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    ),
    end: ctx.formatDateForEvent(
      ev.end,
      ev,
      ev.allDay
        ? { year: 'numeric', month: 'short', day: 'numeric' }
        : { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    ),
    type: ev.type,
    status: ev.status,
    resource: ev.resourceIds.map(id => resourceMap.get(id) || id).join(', '),
    layer: ev.layer,
    meta: ev.meta
  }));
}
