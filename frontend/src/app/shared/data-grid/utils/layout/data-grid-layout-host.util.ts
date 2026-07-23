type GridHostContext = {
  elementRef?: {
    nativeElement?: HTMLElement | null;
  } | null;
} | null;

function hasLayoutPresetAttr(host: HTMLElement, value: string): boolean {
  return (
    typeof host.getAttribute === 'function' &&
    host.getAttribute('data-grid-layout-preset') === value
  );
}

export function isDefaultGridHost(host: HTMLElement | null | undefined): boolean {
  if (!host) return false;
  const preset = host.getAttribute?.('data-grid-layout-preset');
  return !preset || hasLayoutPresetAttr(host, 'default');
}

export function isDefaultGridContext(ctx: GridHostContext): boolean {
  const host = ctx?.elementRef?.nativeElement ?? null;
  if (host) {
    return isDefaultGridHost(host);
  }
  return true;
}
