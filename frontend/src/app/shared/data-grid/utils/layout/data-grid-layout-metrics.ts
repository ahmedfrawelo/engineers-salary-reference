const DEFAULT_UNIFIED_DATA_GRID_LAYOUT_METRICS = {
  selectionColumnWidth: 44,
  rowActionsColumnWidth: 120
} as const;

function normalizeMetric(value: string | null | undefined, fallback: number): number {
  const parsed = Number.parseFloat(String(value ?? '').trim());
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function readHostMetric(token: string, fallback: number, host?: HTMLElement | null): number {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const root = host?.ownerDocument?.documentElement ?? document.documentElement;
  const candidates = [host, root].filter(
    (value): value is HTMLElement => value instanceof HTMLElement
  );

  for (const candidate of candidates) {
    const value = window.getComputedStyle(candidate).getPropertyValue(token);
    const resolved = normalizeMetric(value, 0);
    if (resolved > 0) {
      return resolved;
    }
  }

  return fallback;
}

export function resolveUnifiedDataGridSelectionColumnWidth(host?: HTMLElement | null): number {
  return readHostMetric(
    '--app-grid-selection-column-width',
    DEFAULT_UNIFIED_DATA_GRID_LAYOUT_METRICS.selectionColumnWidth,
    host
  );
}

export function resolveUnifiedDataGridRowActionsColumnWidth(host?: HTMLElement | null): number {
  return readHostMetric(
    '--app-grid-row-actions-column-width',
    DEFAULT_UNIFIED_DATA_GRID_LAYOUT_METRICS.rowActionsColumnWidth,
    host
  );
}
