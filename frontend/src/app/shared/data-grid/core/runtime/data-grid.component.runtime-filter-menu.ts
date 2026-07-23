import { firstValueFrom, isObservable } from 'rxjs';
import type { FilterState, GridColumn, GridFilterOptionValue } from '../../models';
import type { FilterOption } from '../../components/menus/filter-menu.component';
import { debugGridWarn } from '../../utils';

type LooseValue = ReturnType<typeof JSON.parse>;
type HelperContext = Record<string, LooseValue>;
type T = unknown;
const DATA_GRID_FILTER_PANEL_REQUEST_EVENT = 'engineers-salary-referenceDataGridFilterPanelRequested';

function sortFilterOptions(options: FilterOption[]): FilterOption[] {
  return [...options].sort((a, b) => a.label.localeCompare(b.label, 'ar', { sensitivity: 'base' }));
}

function buildFilterOptionsFromValues(
  ctx: HelperContext,
  column: GridColumn<T>,
  values: GridFilterOptionValue[],
  selectedKeys: Set<string> | null
): FilterOption[] {
  const optionMap = new Map<string, FilterOption>();
  for (const item of values ?? []) {
    const rawValue = item?.value;
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      continue;
    }

    const key = ctx.getFilterOptionKey(rawValue);
    if (optionMap.has(key)) {
      continue;
    }

    const label = String(item?.label ?? ctx.getFilterOptionLabel(column, rawValue)).trim();
    if (!label) {
      continue;
    }

    optionMap.set(key, {
      label,
      value: rawValue,
      checked: selectedKeys ? selectedKeys.has(key) : true
    });
  }

  return sortFilterOptions(Array.from(optionMap.values()));
}

function buildLocalFilterOptionValues(
  ctx: HelperContext,
  column: GridColumn<T>,
  field: string
): GridFilterOptionValue[] {
  const dataForOptions = ctx.getFilteredDataExcludingField(field);
  const optionMap = new Map<string, GridFilterOptionValue>();
  for (const row of dataForOptions) {
    const rawValue = (row as LooseValue)[field];
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      continue;
    }

    const key = ctx.getFilterOptionKey(rawValue);
    if (optionMap.has(key)) {
      continue;
    }

    optionMap.set(key, {
      label: ctx.getFilterOptionLabel(column, rawValue),
      value: rawValue
    });
  }

  return Array.from(optionMap.values());
}

async function resolveFilterOptionsLoader(
  values:
    | GridFilterOptionValue[]
    | Promise<GridFilterOptionValue[]>
    | { subscribe?: unknown }
    | null
    | undefined
): Promise<GridFilterOptionValue[]> {
  if (!values) {
    return [];
  }

  if (Array.isArray(values)) {
    return values;
  }

  if (isObservable(values)) {
    return (
      (await firstValueFrom(values as import('rxjs').Observable<GridFilterOptionValue[]>)) ?? []
    );
  }

  return await Promise.resolve(values as Promise<GridFilterOptionValue[]>);
}
export function handleGlobalDismissHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [event] = args;
  const target = event.target as HTMLElement;
  const isInside = (selector: string) => {
    if (target?.closest(selector)) {
      return true;
    }
    const path = (
      event as Event & {
        composedPath?: () => EventTarget[];
      }
    ).composedPath?.();
    if (!path) {
      return false;
    }
    return path.some((node: LooseValue) => node instanceof Element && node.matches(selector));
  };
  const isInsideFilterMenu = isInside('engineers-salary-reference-filter-menu');
  const isFilterButton = isInside('.header-filter-btn');
  if (!isInsideFilterMenu && !isFilterButton) {
    ctx.closeFilterMenu();
  }
  const isInsideColumnMenu =
    isInside('.column-context-menu') || isInside('.column-context-submenu');
  const isInsideCellMenu = isInside('.cell-context-menu') || isInside('.cell-submenu');
  if (!isInsideColumnMenu && !isInsideCellMenu) {
    ctx.closeContextMenu();
  }
  const isInsideGroupContextMenu = isInside('.group-context-menu');
  if (!isInsideGroupContextMenu) {
    ctx.closeGroupContextMenu();
  }
  const isInsideEmptyGroupMenu = isInside('.empty-group-context-menu');
  if (!isInsideEmptyGroupMenu) {
    ctx.closeEmptyGroupMenu();
  }
  ctx.closeActionLauncher();
}
export function openFilterMenuHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column, event] = args;
  event.stopPropagation();
  if (column.filterable === false) {
    return;
  }
  if (requestExternalFilterPanelHelper(ctx, column)) {
    ctx.closeAllMenus?.();
    ctx.cdr?.markForCheck?.();
    return;
  }
  if (ctx.activeFilterColumn === column) {
    ctx.closeAllMenus();
    return;
  }
  ctx.closeAllMenus();
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const { boundsW, boundsH, originX, originY, scale } = ctx.getOverlaySpace();
  const menuW = 280; // aligns with filter menu max-width
  const menuH = 380; // aligns with filter menu max-height
  const margin = 8;
  let x = (rect.left - originX) / scale;
  let y = (rect.bottom - originY) / scale + 4;
  // If the menu would overflow to the right, align it to the trigger's right edge
  if (x + menuW > boundsW - margin) {
    x = (rect.right - originX) / scale - menuW;
  }
  // If the menu would overflow below, flip it above the trigger
  if (y + menuH > boundsH - margin) {
    y = (rect.top - originY) / scale - menuH - margin;
  }
  // Final clamp to keep it visible
  x = Math.max(margin, Math.min(x, boundsW - menuW - margin));
  y = Math.max(margin, Math.min(y, boundsH - menuH - margin));
  ctx.filterMenuPosition = { x, y };
  ctx.filterMenuSearchTerm = '';
  ctx.buildFilterMenuOptions(column);
}
export function openFilterMenuFromColumnContextMenuHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const [column] = args;
  if (column.filterable === false) {
    return;
  }
  if (requestExternalFilterPanelHelper(ctx, column)) {
    ctx.closeAllMenus?.();
    ctx.cdr?.markForCheck?.();
    return;
  }
  const contextPos = ctx.columnContextMenuPosition();
  ctx.closeAllMenus();
  const { boundsW, boundsH } = ctx.getOverlaySpace();
  const menuW = 280;
  const menuH = 380;
  const margin = 8;
  const contextMenuWidth = 300;
  const gap = 6;
  let x = contextPos.x + contextMenuWidth + gap;
  let y = contextPos.y;
  if (x + menuW > boundsW - margin) {
    x = contextPos.x - menuW - gap;
  }
  x = Math.max(margin, Math.min(x, boundsW - menuW - margin));
  y = Math.max(margin, Math.min(y, boundsH - menuH - margin));
  ctx.filterMenuPosition = { x, y };
  ctx.filterMenuSearchTerm = '';
  ctx.buildFilterMenuOptions(column);
}

export function requestExternalFilterPanelHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): boolean {
  const [column] = args;
  const host = ctx.elementRef?.nativeElement as HTMLElement | null | undefined;
  if (!host || typeof CustomEvent === 'undefined') {
    return false;
  }

  const field =
    typeof ctx.getColumnField === 'function'
      ? String(ctx.getColumnField(column) ?? '').trim()
      : String(column?.field ?? '').trim();
  if (!field) {
    return false;
  }

  const event = new CustomEvent(DATA_GRID_FILTER_PANEL_REQUEST_EVENT, {
    bubbles: true,
    cancelable: true,
    composed: true,
    detail: {
      field,
      header: column?.header ?? field
    }
  });

  host.dispatchEvent(event);
  return event.defaultPrevented;
}
export async function buildFilterMenuOptionsHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): Promise<void> {
  const [column] = args;
  const field = String(column.field);
  const currentStates = ctx.filterStates();
  const activeSelectionState = currentStates.find(
    (state: LooseValue) =>
      state.field === field && state.operator === 'in' && Array.isArray(state.value)
  );
  const selectedKeys = activeSelectionState
    ? new Set(
        (activeSelectionState.value as LooseValue[]).map((value: LooseValue) =>
          ctx.getFilterOptionKey(value)
        )
      )
    : null;
  ctx.activeFilterColumn = column;
  ctx.filterPlaceholder = `Search ${column.header ?? column.field ?? ''}...`;
  const requestToken = ++ctx.filterOptionsRequestToken;
  ctx.filterOptionsLoading = true;
  ctx.filterOptions = [];
  ctx.cdr.detectChanges();

  try {
    const optionSearch = String(ctx.filterMenuSearchTerm ?? '').trim();
    const sourceValues = column.filterOptionsLoader
      ? await resolveFilterOptionsLoader(column.filterOptionsLoader({ field, optionSearch }))
      : column.options?.length
        ? column.options
        : buildLocalFilterOptionValues(ctx, column, field);

    if (ctx.filterOptionsRequestToken !== requestToken || ctx.activeFilterColumn !== column) {
      return;
    }

    ctx.filterOptions = buildFilterOptionsFromValues(ctx, column, sourceValues, selectedKeys);
  } catch (error) {
    debugGridWarn(
      '[DataGrid] Failed to load remote filter options. Falling back to local values.',
      error
    );

    if (ctx.filterOptionsRequestToken !== requestToken || ctx.activeFilterColumn !== column) {
      return;
    }

    const fallbackValues = buildLocalFilterOptionValues(ctx, column, field);
    ctx.filterOptions = buildFilterOptionsFromValues(ctx, column, fallbackValues, selectedKeys);
  } finally {
    if (ctx.filterOptionsRequestToken === requestToken && ctx.activeFilterColumn === column) {
      ctx.filterOptionsLoading = false;
      ctx.cdr.detectChanges();
    }
  }
}
export function closeFilterMenuHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  ctx.filterOptionsRequestToken += 1;
  ctx.activeFilterColumn = null;
  ctx.filterOptions = [];
  ctx.filterOptionsLoading = false;
  ctx.filterMenuSearchTerm = '';
}
export function applyFilterMenuHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column, selectedValues] = args;
  const field = String(column.field);
  const nextSelectedValues = Array.isArray(selectedValues) ? selectedValues : [];
  const totalOptions = ctx.filterOptions.length;
  const currentStates = ctx.filterStates();
  const existingSelectionState = currentStates.find(
    (state: LooseValue) =>
      state.field === field && state.operator === 'in' && Array.isArray(state.value)
  );

  const toKeySet = (values: LooseValue[]) =>
    new Set(values.map((value: LooseValue) => ctx.getFilterOptionKey(value)));
  const nextSelectionKeys = toKeySet(nextSelectedValues);
  const existingSelectionKeys = existingSelectionState
    ? toKeySet(existingSelectionState.value as LooseValue[])
    : null;
  const isSameSelection =
    !!existingSelectionKeys &&
    existingSelectionKeys.size === nextSelectionKeys.size &&
    Array.from(existingSelectionKeys).every((key: LooseValue) => nextSelectionKeys.has(key));
  const shouldKeepInFilter = totalOptions > 0 && nextSelectedValues.length < totalOptions;
  if (!shouldKeepInFilter && !existingSelectionState) {
    return;
  }
  if (shouldKeepInFilter && existingSelectionState && isSameSelection) {
    return;
  }

  const statesWithoutIn = currentStates.filter(
    (state: LooseValue) => !(state.field === field && state.operator === 'in')
  );
  const nextStates = shouldKeepInFilter
    ? ([...statesWithoutIn, { field, value: nextSelectedValues, operator: 'in' }] as FilterState[])
    : statesWithoutIn;

  ctx.filterStates.set(nextStates);
  ctx.paginationState.update((state: LooseValue) => ({ ...state, currentPage: 1 }));
  ctx.emitChange('filter');
}
export function applyFilterMenuSearchHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column, rawSearchTerm] = args;
  ctx.filterMenuSearchTerm = String(rawSearchTerm ?? '').trim();
  if (column?.filterOptionsLoader) {
    void buildFilterMenuOptionsHelper(ctx, column);
  }
}
export function getFilterOptionLabelHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [column, value] = args;
  if (column.options?.length) {
    const valueKey = ctx.getFilterOptionKey(value);
    const match = column.options.find(
      (opt: LooseValue) => ctx.getFilterOptionKey(opt.value) === valueKey
    );
    if (match) {
      return match.label;
    }
  }
  if (typeof column.format === 'function') {
    try {
      const formatted = column.format(value);
      if (typeof formatted === 'string' && formatted.trim()) {
        return formatted;
      }
    } catch {
      // Fall through to plain string conversion.
    }
  }
  return String(value);
}
export function getFilterOptionKeyHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [value] = args;
  if (value === null || value === undefined) {
    return '__null__';
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return `__object__${value}`;
    }
  }
  return `${typeof value}:${value}`;
}
