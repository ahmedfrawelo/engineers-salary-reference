import { isDefaultGridContext } from '../../utils/layout';
import { resolveDataGridMainScrollHost } from '../../utils/dom';

type LooseValue = ReturnType<typeof JSON.parse>;
type HelperContext = Record<string, LooseValue>;

function queryCachedDomElement(
  ctx: HelperContext,
  root: HTMLElement | null | undefined,
  cacheKey: string,
  selector: string
): HTMLElement | null {
  if (!root) {
    return null;
  }

  const cache =
    (ctx.scrollDomElementCache as Map<string, HTMLElement> | undefined) ??
    new Map<string, HTMLElement>();
  ctx.scrollDomElementCache = cache;

  const cached = cache.get(cacheKey);
  if (cached?.isConnected && root.contains(cached)) {
    return cached;
  }

  const element = root.querySelector(selector) as HTMLElement | null;
  if (element) {
    cache.set(cacheKey, element);
    return element;
  }

  cache.delete(cacheKey);
  return null;
}

function markProgrammaticScroll(
  ctx: HelperContext,
  element: HTMLElement | null | undefined,
  scrollLeft: number
): void {
  if (!element) {
    return;
  }
  const map =
    (ctx.programmaticScrollTargets as WeakMap<HTMLElement, number> | undefined) ??
    new WeakMap<HTMLElement, number>();
  map.set(element, Math.max(0, Number.isFinite(scrollLeft) ? scrollLeft : 0));
  ctx.programmaticScrollTargets = map;
}

function consumeProgrammaticScroll(
  ctx: HelperContext,
  element: HTMLElement | null | undefined
): boolean {
  if (!element) {
    return false;
  }
  const map = ctx.programmaticScrollTargets as WeakMap<HTMLElement, number> | undefined;
  if (!map?.has(element)) {
    return false;
  }
  const expected = map.get(element) ?? 0;
  const actual = Number(element.scrollLeft) || 0;
  if (Math.abs(actual - expected) > 1) {
    return false;
  }
  map.delete(element);
  return true;
}

function resolveCurrentFixedHeader(ctx: HelperContext): HTMLElement | null {
  const viewChildHeader = (ctx.fixedHeader?.nativeElement as HTMLElement | undefined) ?? null;
  if (viewChildHeader?.isConnected) {
    return viewChildHeader;
  }
  const root = (ctx.elementRef?.nativeElement as HTMLElement | undefined) ?? null;
  return (root?.querySelector('.fixed-table-header') as HTMLElement | null) ?? null;
}
function resolveCurrentViewport(ctx: HelperContext): HTMLElement | null {
  const viewChildViewport = (ctx.gridViewport?.nativeElement as HTMLElement | undefined) ?? null;
  if (viewChildViewport?.isConnected) {
    return viewChildViewport;
  }
  const root = (ctx.elementRef?.nativeElement as HTMLElement | undefined) ?? null;
  return resolveDataGridMainScrollHost(root);
}

function resolveBottomScrollbarElements(
  ctx: HelperContext
): { viewport: HTMLElement; track: HTMLElement } | null {
  const viewChildViewport =
    (ctx.bottomScrollbarViewport?.nativeElement as HTMLElement | undefined) ?? null;
  const viewChildTrack =
    (ctx.bottomScrollbarTrack?.nativeElement as HTMLElement | undefined) ?? null;

  if (viewChildViewport?.isConnected && viewChildTrack?.isConnected) {
    return {
      viewport: viewChildViewport,
      track: viewChildTrack
    };
  }

  const root = (ctx.elementRef?.nativeElement as HTMLElement | undefined) ?? null;
  const viewport =
    (root?.querySelector('.grid-bottom-scrollbar-strip') as HTMLElement | null) ?? null;
  const track =
    (viewport?.querySelector('.grid-bottom-scrollbar-track') as HTMLElement | null) ?? null;

  if (!viewport || !track) {
    return null;
  }

  return { viewport, track };
}

function syncGroupedContainerScrollLeft(
  ctx: HelperContext,
  host: HTMLElement | null | undefined,
  nextScrollLeft: number
): void {
  if (!host || !('style' in host) || !host.style || typeof host.style.setProperty !== 'function') {
    return;
  }
  const normalizedScrollLeft = Math.max(0, Number.isFinite(nextScrollLeft) ? nextScrollLeft : 0);
  writeScrollCssPx(
    ctx,
    host,
    'lastGridScrollCssLeft',
    '--dg-grid-scroll-left',
    normalizedScrollLeft
  );
  writeScrollCssPx(
    ctx,
    host,
    'lastGroupScrollCssLeft',
    '--dg-group-scroll-left',
    normalizedScrollLeft
  );
}

function writeScrollCssPx(
  ctx: HelperContext,
  host: HTMLElement,
  cacheKey: string,
  propertyName: string,
  value: number
): void {
  if (!host.style || typeof host.style.setProperty !== 'function') {
    return;
  }
  const normalized = Math.max(0, Number.isFinite(value) ? value : 0);
  const previous = Number(ctx[cacheKey]);
  if (Number.isFinite(previous) && Math.abs(previous - normalized) <= 0.5) {
    return;
  }
  ctx[cacheKey] = normalized;
  host.style.setProperty(propertyName, `${normalized}px`);
}

function syncBodyScrollYOffsetClass(
  ctx: HelperContext,
  host: HTMLElement | null | undefined,
  verticalOffset: number
): void {
  if (!host) {
    return;
  }
  const nextHasOffset = verticalOffset > 0.5;
  if (ctx.lastBodyScrollYOffsetState === nextHasOffset) {
    return;
  }
  ctx.lastBodyScrollYOffsetState = nextHasOffset;
  host.classList.toggle('dg-has-body-scroll-y-offset', nextHasOffset);
}

function isGroupedScrollHost(element: HTMLElement | null | undefined): boolean {
  return !!element?.classList?.contains('group-items-scroll');
}

function hasPinnedDataColumns(ctx: HelperContext): boolean {
  const columns =
    typeof ctx.visibleColumns === 'function'
      ? (ctx.visibleColumns() as LooseValue[] | null | undefined)
      : ((ctx.columns as LooseValue[] | null | undefined) ?? []);

  if (!Array.isArray(columns)) {
    return false;
  }

  return columns.some(column => column?.pinned === 'left' || column?.pinned === 'right');
}

function shouldUseHeaderTransformScroll(ctx: HelperContext): boolean {
  return isDefaultGridContext(ctx) && !hasPinnedDataColumns(ctx);
}

export function markScrollbarActiveHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const host = (ctx.elementRef?.nativeElement as HTMLElement | undefined) ?? null;
  const isDefaultGridGrid = isDefaultGridContext(ctx);
  // Suspend hover for ALL grids during scroll to prevent mouseenter/mouseleave from
  // triggering signal updates and change detection cycles while the user is scrolling.
  // This is the primary fix for "scroll lag when mouse is moving" with large datasets.
  if (!isDefaultGridGrid) {
    ctx.suspendHoverUntilTs = Date.now() + 200;
  }
  // Default-grid grids must keep scrollbar geometry stable.
  // Toggling `is-scrolling` changes scrollbar width in older table styles and causes header/body drift.
  if (isDefaultGridGrid) {
    return;
  }
  if (!ctx.isScrolling) {
    ctx.isScrolling = true;
    ctx.cdr.markForCheck();
  }
  if (ctx.scrollActiveTimeoutId) {
    clearTimeout(ctx.scrollActiveTimeoutId);
  }
  ctx.scrollActiveTimeoutId = setTimeout(() => {
    ctx.isScrolling = false;
    ctx.scrollActiveTimeoutId = null;
    ctx.cdr.markForCheck();
  }, 900);
}
export function onFixedHeaderScrollHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [event] = args;
  if (ctx.isScrollSyncing) return;
  const host = (ctx.elementRef?.nativeElement as HTMLElement | undefined) ?? null;
  const isNativeScrollEvent = !!event && typeof (event as { type?: unknown }).type === 'string';
  const isDefaultGridOnlyGrid = isDefaultGridContext(ctx);
  // For default-grid grids, horizontal scroll ownership is body-only.
  // Never drive body from header. If the hidden header scroller receives a native
  // wheel/trackpad scroll, snap it back to the body-owned position so header/body/footer
  // cannot become three independent horizontal owners.
  if (isDefaultGridOnlyGrid) {
    const bodyScrollTarget = resolveHorizontalBodyScrollTarget(ctx);
    const header = (event?.target as HTMLElement | null) ?? resolveCurrentFixedHeader(ctx);
    const next = Number(bodyScrollTarget?.scrollLeft) || 0;
    syncGroupedContainerScrollLeft(ctx, host, next);
    const bottomScrollbar = resolveBottomScrollbarElements(ctx)?.viewport ?? null;
    const nextBottomScrollLeft =
      bodyScrollTarget && bottomScrollbar
        ? mapDefaultGridBodyToBottom(ctx, bodyScrollTarget, bottomScrollbar)
        : next;
    if (bottomScrollbar && Math.abs((bottomScrollbar.scrollLeft || 0) - nextBottomScrollLeft) > 1) {
      markProgrammaticScroll(ctx, bottomScrollbar, nextBottomScrollLeft);
      bottomScrollbar.scrollLeft = nextBottomScrollLeft;
    }
    queueFixedHeaderScrollSync(ctx, header, next, { immediate: true });
    return;
  }
  if (!isNativeScrollEvent) {
    syncFixedHeaderScrollbarCompensation(ctx);
  }
  ctx.markScrollbarActive();
  const header = event.target as HTMLElement;
  const bodyScrollTarget = resolveHorizontalBodyScrollTarget(ctx);
  // ? Sync body scroll immediately for smooth experience
  ctx.isScrollSyncing = true;
  if (isDefaultGridContext(ctx)) {
    if (bodyScrollTarget) {
      const next = Number(header.scrollLeft) || 0;
      if (Math.abs((bodyScrollTarget.scrollLeft || 0) - next) > 1) {
        bodyScrollTarget.scrollLeft = next;
      }
    }
  } else {
    syncHorizontalScrollPosition(header, bodyScrollTarget);
  }
  // Use RAF for smoother updates
  requestAnimationFrame(() => {
    ctx.isScrollSyncing = false;
  });
}
export function onGridContainerScrollHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const [event] = args;
  // Disable pointer events on rows during scroll (for ALL grids) to prevent mouseenter/mouseleave
  // from firing as CDK Virtual Scroll recycles rows. This stops hoveredRowIndex signal updates
  // which would otherwise trigger Angular change detection on every scroll frame.
  suppressPointerEventsDuringScroll(ctx);
  const isNativeScrollEvent = !!event && typeof (event as { type?: unknown }).type === 'string';
  if (!isNativeScrollEvent) {
    syncFixedHeaderScrollbarCompensation(ctx);
  }
  const source = event.target as HTMLElement | null;
  if (consumeProgrammaticScroll(ctx, source)) {
    return;
  }
  const isDefaultGridGrid = isDefaultGridContext(ctx);
  const horizontalSource = resolveHorizontalBodyScrollTarget(ctx);
  const bottomScrollbar = resolveBottomScrollbarElements(ctx)?.viewport ?? null;
  const host = (ctx.elementRef?.nativeElement as HTMLElement | undefined) ?? null;
  if (!source || !horizontalSource) return;
  const effectiveHorizontalSource = isGroupedScrollHost(source) ? source : horizontalSource;
  if (host) {
    const verticalOffset = Math.max(
      Number(source.scrollTop) || 0,
      Number(effectiveHorizontalSource.scrollTop) || 0
    );
    syncBodyScrollYOffsetClass(ctx, host, verticalOffset);
  }
  const syncBottomScrollbarScroll = (
    nextScrollLeft: number,
    sourceScroller: HTMLElement | null | undefined = effectiveHorizontalSource
  ) => {
    if (!bottomScrollbar || bottomScrollbar === source) {
      return;
    }
    const next =
      isDefaultGridGrid && sourceScroller === horizontalSource
        ? mapDefaultGridBodyToBottom(ctx, horizontalSource, bottomScrollbar)
        : sourceScroller
          ? mapScrollLeftToTarget(sourceScroller, bottomScrollbar)
          : nextScrollLeft;
    const normalizedNext = Number.isFinite(next) ? next : nextScrollLeft;
    const current = Number(bottomScrollbar.scrollLeft) || 0;
    if (Math.abs(current - normalizedNext) > 1) {
      markProgrammaticScroll(ctx, bottomScrollbar, normalizedNext);
      bottomScrollbar.scrollLeft = normalizedNext;
    }
  };
  const syncGroupedScroll = (nextScrollLeft: number) =>
    syncGroupedContainerScrollLeft(ctx, host, nextScrollLeft);
  const fixedHeader = resolveCurrentFixedHeader(ctx);

  if (bottomScrollbar && source === bottomScrollbar) {
    const next = isDefaultGridGrid
      ? mapDefaultGridBottomToBody(ctx, source, horizontalSource)
      : mapScrollLeftToTarget(source, horizontalSource);
    if (Math.abs((horizontalSource.scrollLeft || 0) - next) > 1) {
      markProgrammaticScroll(ctx, horizontalSource, next);
      horizontalSource.scrollLeft = next;
    }
    markFastHorizontalScrollState(ctx);
    ctx.lastDefaultGridBodyScrollLeft = next;
    syncGroupedScroll(next);
    queueFixedHeaderScrollSync(ctx, fixedHeader, next, { immediate: true });
    return;
  }

  // Fast path for Default-grid grids:
  // keep body as the single owner and avoid expensive width/range reads on every scroll tick.
  if (isDefaultGridGrid) {
    const next =
      source !== horizontalSource
        ? mapScrollLeftToTarget(effectiveHorizontalSource, horizontalSource)
        : Number(horizontalSource.scrollLeft) || 0;
    const last = Number(ctx.lastDefaultGridBodyScrollLeft);
    const useHeaderTransform = shouldUseHeaderTransformScroll(ctx);
    const headerDrifted = fixedHeader
      ? Math.abs(readHeaderScrollLeft(fixedHeader, useHeaderTransform) - next) > 0.5
      : false;
    const expectedBottomScrollLeft = bottomScrollbar
      ? mapDefaultGridBodyToBottom(ctx, horizontalSource, bottomScrollbar)
      : next;
    const bottomScrollbarDrifted = bottomScrollbar
      ? Math.abs((bottomScrollbar.scrollLeft || 0) - expectedBottomScrollLeft) > 0.5
      : false;
    const sharedScrollLeft = Number.parseFloat(
      host?.style?.getPropertyValue('--dg-grid-scroll-left')?.trim() || ''
    );
    const sharedScrollLeftDrifted =
      !!host?.style &&
      (!Number.isFinite(sharedScrollLeft) || Math.abs(sharedScrollLeft - next) > 0.5);
    // Vertical scrolling fires many scroll events with unchanged scrollLeft.
    // Skip only true no-op work. If the fixed header lost its transform sync,
    // the footer/shared CSS variable drifted, or the bottom scrollbar was remounted,
    // restore them even when scrollLeft itself did not change.
    if (
      Number.isFinite(last) &&
      Math.abs(last - next) <= 0.5 &&
      !headerDrifted &&
      !bottomScrollbarDrifted &&
      !sharedScrollLeftDrifted
    ) {
      return;
    }
    markFastHorizontalScrollState(ctx);
    ctx.lastDefaultGridBodyScrollLeft = next;
    if (
      source !== horizontalSource &&
      horizontalSource &&
      Math.abs((horizontalSource.scrollLeft || 0) - next) > 1
    ) {
      markProgrammaticScroll(ctx, horizontalSource, next);
      horizontalSource.scrollLeft = next;
    }
    syncBottomScrollbarScroll(next, horizontalSource);
    syncGroupedScroll(next);
    // Keep the detached header visually locked to the body scroller on every native scroll tick.
    // Deferring the first write to RAF makes the header appear frozen during horizontal drags.
    queueFixedHeaderScrollSync(ctx, fixedHeader, next, { immediate: true });
    return;
  }

  const sourceCanScrollX = canScrollHorizontally(source);
  const horizontalSourceCanScrollX = canScrollHorizontally(effectiveHorizontalSource);

  // Ignore nested/outer scroll events when another element owns horizontal scrolling.
  if (source !== effectiveHorizontalSource && horizontalSourceCanScrollX) {
    // Common case: outer grid container fires vertical scroll while body scroller owns horizontal movement.
    if (!sourceCanScrollX || source.classList.contains('grid-container')) return;
  }

  const finalHeaderScrollLeft = isDefaultGridGrid
    ? Number(effectiveHorizontalSource.scrollLeft) || 0
    : mapScrollLeftToTarget(effectiveHorizontalSource, fixedHeader);
  syncBottomScrollbarScroll(Number(effectiveHorizontalSource.scrollLeft) || 0);
  syncGroupedScroll(Number(effectiveHorizontalSource.scrollLeft) || 0);
  if (!fixedHeader) return;
  if (Math.abs((fixedHeader.scrollLeft || 0) - finalHeaderScrollLeft) <= 1) return;

  ctx.markScrollbarActive();
  // Sync header immediately from the real body scroller.
  // Do not frame-lock body->header updates, otherwise header visibly lags on dense tables.
  fixedHeader.scrollLeft = finalHeaderScrollLeft;
}

// Use CSS transform instead of scrollLeft for Default-grid grids when the header has no data
// pinned columns. Native scrollLeft is required once data columns are pinned, because sticky
// header cells must share the same scrollport geometry as body cells.
function writeHeaderScrollLeft(header: HTMLElement, value: number, useTransform: boolean): void {
  const table =
    typeof header.querySelector === 'function'
      ? (header.querySelector('.header-table') as HTMLElement | null)
      : null;

  if (useTransform) {
    if (table) {
      table.style.transform = value > 0 ? `translate3d(-${value}px, 0, 0)` : '';
    }
    header.style.setProperty('--dg-header-counter-scroll', `${Math.max(0, value)}px`);
    if (header.dataset) {
      header.dataset['dgScrollLeft'] = String(value);
    }
    // Default-grid grids already mirror the body scroller with a compositor transform.
    // Driving the detached header with scrollLeft as well causes the header to move twice.
    if ((header.scrollLeft || 0) !== 0) {
      header.scrollLeft = 0;
    }
    return;
  }

  if (table?.style.transform) {
    table.style.transform = '';
  }
  header.style.removeProperty('--dg-header-counter-scroll');
  if (header.dataset?.['dgScrollLeft']) {
    delete header.dataset['dgScrollLeft'];
  }
  header.scrollLeft = value;
}

function readHeaderScrollLeft(header: HTMLElement, useTransform: boolean): number {
  if (useTransform) {
    return Number(header.dataset?.['dgScrollLeft']) || header.scrollLeft || 0;
  }
  return header.scrollLeft || 0;
}

function queueFixedHeaderScrollSync(
  ctx: HelperContext,
  header: HTMLElement | null | undefined,
  nextScrollLeft: number,
  options?: { immediate?: boolean }
): void {
  const host = (ctx.elementRef?.nativeElement as HTMLElement | undefined) ?? null;
  const next = Number.isFinite(nextScrollLeft) ? nextScrollLeft : 0;
  if (host?.style && typeof host.style.setProperty === 'function') {
    writeScrollCssPx(ctx, host, 'lastGridScrollCssLeft', '--dg-grid-scroll-left', next);
  }
  if (!header) return;
  const useTransform = shouldUseHeaderTransformScroll(ctx);
  const shouldWriteImmediate = options?.immediate !== false;
  if (shouldWriteImmediate && Math.abs(readHeaderScrollLeft(header, useTransform) - next) > 1) {
    writeHeaderScrollLeft(header, next, useTransform);
  }
  if (useTransform && shouldWriteImmediate) {
    ctx.pendingHeaderScrollLeft = null;
    return;
  }
  ctx.pendingHeaderScrollLeft = next;

  const flush = () => {
    ctx.headerScrollSyncRAF = null;
    const pending = Number(ctx.pendingHeaderScrollLeft) || 0;
    ctx.pendingHeaderScrollLeft = null;
    if (Math.abs(readHeaderScrollLeft(header, useTransform) - pending) > 1) {
      writeHeaderScrollLeft(header, pending, useTransform);
    }
  };

  if (ctx.headerScrollSyncRAF) {
    return;
  }

  if (typeof requestAnimationFrame === 'function') {
    ctx.headerScrollSyncRAF = requestAnimationFrame(() => flush());
  } else {
    ctx.headerScrollSyncRAF = setTimeout(flush, 16);
  }
}

function suppressPointerEventsDuringScroll(ctx: HelperContext): void {
  if (isDefaultGridContext(ctx)) {
    return;
  }
  const host = (ctx.elementRef?.nativeElement as HTMLElement | undefined) ?? null;
  if (!host) return;
  // Also suppress hover signals so if pointer-events somehow fires, it's a no-op
  ctx.suspendHoverUntilTs = Date.now() + 200;
  host.classList.add('dg-scrolling-v');
  if (ctx.scrollingVClassTimeoutId) {
    clearTimeout(ctx.scrollingVClassTimeoutId as ReturnType<typeof setTimeout>);
  }
  ctx.scrollingVClassTimeoutId = setTimeout(() => {
    ctx.scrollingVClassTimeoutId = null;
    host.classList.remove('dg-scrolling-v');
  }, 150);
}

function markFastHorizontalScrollState(ctx: HelperContext): void {
  const host = (ctx.elementRef?.nativeElement as HTMLElement | undefined) ?? null;
  if (!host) return;
  const groupingModeActive = host.classList.contains('grouping-mode-active');
  if (isDefaultGridContext(ctx) && !groupingModeActive) {
    return;
  }
  host.classList.add('dg-fast-scroll-x');
  if (ctx.fastScrollClassTimeoutId) {
    clearTimeout(ctx.fastScrollClassTimeoutId);
  }
  ctx.fastScrollClassTimeoutId = setTimeout(() => {
    ctx.fastScrollClassTimeoutId = null;
    host.classList.remove('dg-fast-scroll-x');
  }, 140);
}

function canScrollHorizontally(el: HTMLElement | null | undefined): boolean {
  if (!el) return false;
  return el.scrollWidth - el.clientWidth > 1;
}

function getMaxScrollLeft(el: HTMLElement | null | undefined): number {
  if (!el) return 0;
  return Math.max(0, (el.scrollWidth || 0) - (el.clientWidth || 0));
}

function mapScrollLeftWithinRange(
  sourceLeft: number,
  sourceMax: number,
  targetMax: number
): number {
  if (sourceMax <= 0 || targetMax <= 0) {
    return sourceLeft;
  }
  if (Math.abs(sourceMax - targetMax) <= 1) {
    return sourceLeft;
  }
  const ratio = sourceLeft / sourceMax;
  if (!Number.isFinite(ratio)) {
    return sourceLeft;
  }
  return Math.max(0, Math.min(targetMax, ratio * targetMax));
}

function mapScrollLeftToTarget(
  source: HTMLElement | null | undefined,
  target: HTMLElement | null | undefined
): number {
  if (!source || !target) return 0;
  const sourceLeft = Number(source.scrollLeft) || 0;
  const sourceMax = getMaxScrollLeft(source);
  const targetMax = getMaxScrollLeft(target);
  return mapScrollLeftWithinRange(sourceLeft, sourceMax, targetMax);
}

function getDefaultGridScrollRange(
  ctx: HelperContext,
  bodyScroller: HTMLElement | null | undefined,
  bottomScrollbar: HTMLElement | null | undefined
): { bodyMax: number; bottomMax: number } | null {
  const range = ctx.defaultGridScrollRange as
    | {
        bodyScroller?: HTMLElement | null;
        bottomScrollbar?: HTMLElement | null;
        bodyMax?: number;
        bottomMax?: number;
      }
    | undefined;

  if (
    !range ||
    range.bodyScroller !== bodyScroller ||
    range.bottomScrollbar !== bottomScrollbar ||
    !Number.isFinite(range.bodyMax) ||
    !Number.isFinite(range.bottomMax)
  ) {
    return null;
  }

  return {
    bodyMax: Math.max(0, Number(range.bodyMax) || 0),
    bottomMax: Math.max(0, Number(range.bottomMax) || 0)
  };
}

function mapDefaultGridBodyToBottom(
  ctx: HelperContext,
  bodyScroller: HTMLElement | null | undefined,
  bottomScrollbar: HTMLElement | null | undefined
): number {
  if (!bodyScroller || !bottomScrollbar) {
    return Number(bodyScroller?.scrollLeft) || 0;
  }
  const sourceLeft = Number(bodyScroller.scrollLeft) || 0;
  const range = getDefaultGridScrollRange(ctx, bodyScroller, bottomScrollbar);
  if (!range) {
    return mapScrollLeftToTarget(bodyScroller, bottomScrollbar);
  }
  return mapScrollLeftWithinRange(sourceLeft, range.bodyMax, range.bottomMax);
}

function mapDefaultGridBottomToBody(
  ctx: HelperContext,
  bottomScrollbar: HTMLElement | null | undefined,
  bodyScroller: HTMLElement | null | undefined
): number {
  if (!bottomScrollbar || !bodyScroller) {
    return Number(bottomScrollbar?.scrollLeft) || 0;
  }
  const sourceLeft = Number(bottomScrollbar.scrollLeft) || 0;
  const range = getDefaultGridScrollRange(ctx, bodyScroller, bottomScrollbar);
  if (!range) {
    return mapScrollLeftToTarget(bottomScrollbar, bodyScroller);
  }
  return mapScrollLeftWithinRange(sourceLeft, range.bottomMax, range.bodyMax);
}

function syncHorizontalScrollPosition(
  source: HTMLElement | null | undefined,
  target: HTMLElement | null | undefined
): void {
  if (!source || !target) return;
  const next = mapScrollLeftToTarget(source, target);
  if (Math.abs((target.scrollLeft || 0) - next) <= 1) return;
  target.scrollLeft = next;
}

function resolveHorizontalBodyScrollTarget(ctx: HelperContext): HTMLElement | null {
  const viewport = resolveCurrentViewport(ctx);

  // For Default-grid grids, horizontal ownership is always the inner viewport.
  // Do not fall back to the outer grid container, otherwise header sync can jitter/drift.
  if (isDefaultGridContext(ctx)) {
    return viewport ?? null;
  }

  const fixedHeader = resolveCurrentFixedHeader(ctx);
  const gridRoot = fixedHeader?.closest('.engineers-salary-reference-data-grid') as HTMLElement | null;
  const container = queryCachedDomElement(
    ctx,
    gridRoot,
    'horizontal-body-scroll-container',
    '.grid-container'
  );

  if (canScrollHorizontally(viewport)) return viewport;

  if (canScrollHorizontally(container)) return container;

  return viewport ?? container ?? null;
}

function syncDefaultGridOverflowMetrics(
  ctx: HelperContext,
  host: HTMLElement,
  bodyScroller: HTMLElement
): boolean {
  if (!isDefaultGridContext(ctx)) {
    return false;
  }
  const groupingModeActive = host.classList.contains('grouping-mode-active');

  const synchronizedWidthInline = Number.parseFloat(
    (host.style.getPropertyValue('--dg-grid-table-width') || '').trim()
  );
  const synchronizedWidthComputed = Number.parseFloat(
    (typeof window !== 'undefined' && host instanceof Element
      ? window.getComputedStyle(host).getPropertyValue('--dg-grid-table-width')
      : ''
    ).trim()
  );
  const synchronizedWidth = Number.isFinite(synchronizedWidthInline)
    ? synchronizedWidthInline
    : Number.isFinite(synchronizedWidthComputed)
      ? synchronizedWidthComputed
      : 0;
  const measuredTotal =
    typeof ctx.getTotalTableWidth === 'function' ? Number(ctx.getTotalTableWidth()) || 0 : 0;
  const containerWidth = bodyScroller.clientWidth || host.clientWidth || 0;
  const totalWidth = Math.max(synchronizedWidth, measuredTotal, containerWidth);
  const shouldScrollX = totalWidth - containerWidth > 8;
  const bottomScrollbar = resolveBottomScrollbarElements(ctx)?.viewport ?? null;
  const bottomWidth = bottomScrollbar?.clientWidth || containerWidth;
  ctx.defaultGridScrollRange = {
    bodyScroller,
    bottomScrollbar,
    bodyMax: Math.max(0, totalWidth - containerWidth),
    bottomMax: Math.max(0, totalWidth - bottomWidth)
  };
  let changed = false;

  if (containerWidth > 0) {
    const viewportWidthValue = `${Math.ceil(containerWidth)}px`;
    const previousViewportWidth = (
      host.style.getPropertyValue('--dg-group-shell-viewport-width') || ''
    ).trim();
    if (previousViewportWidth !== viewportWidthValue) {
      host.style.setProperty('--dg-group-shell-viewport-width', viewportWidthValue);
      changed = true;
    }
  }

  const hadHorizontalScroll = host.classList.contains('has-x-scroll');
  if (hadHorizontalScroll !== shouldScrollX) {
    host.classList.toggle('has-x-scroll', shouldScrollX);
    changed = true;
  }

  const groupedShell =
    queryCachedDomElement(ctx, host, 'group-items-scroll', '.group-items-scroll') ??
    queryCachedDomElement(ctx, host, 'group-row-content', 'tr.group-row .group-row-content');
  const previousInlineStart = (
    host.style.getPropertyValue('--dg-group-shell-inline-start') || ''
  ).trim();
  const previousInlineSize = (
    host.style.getPropertyValue('--dg-group-shell-inline-size') || ''
  ).trim();

  if (groupedShell?.isConnected) {
    const hostRect = host.getBoundingClientRect();
    const shellRect = groupedShell.getBoundingClientRect();
    const inlineStart = Math.max(0, Math.round(shellRect.left - hostRect.left));
    const inlineSize = Math.max(0, Math.round(shellRect.width));
    const inlineStartValue = `${inlineStart}px`;
    const inlineSizeValue = `${inlineSize}px`;

    if (previousInlineStart !== inlineStartValue) {
      host.style.setProperty('--dg-group-shell-inline-start', inlineStartValue);
      changed = true;
    }

    if (previousInlineSize !== inlineSizeValue) {
      host.style.setProperty('--dg-group-shell-inline-size', inlineSizeValue);
      changed = true;
    }
  } else {
    // When grouping just toggled, the grouped shell may not be in DOM yet.
    // Keep last known values so header/body do not drift until the shell mounts.
    if (!groupingModeActive) {
      if (previousInlineStart) {
        host.style.removeProperty('--dg-group-shell-inline-start');
        changed = true;
      }
      if (previousInlineSize) {
        host.style.removeProperty('--dg-group-shell-inline-size');
        changed = true;
      }
    }
  }

  return changed;
}

function applyDefaultGridOverflowPrediction(ctx: HelperContext, host: HTMLElement): void {
  if (!isDefaultGridContext(ctx)) {
    return;
  }

  const measuredTotal =
    typeof ctx.getTotalTableWidth === 'function' ? Number(ctx.getTotalTableWidth()) || 0 : 0;
  if (measuredTotal <= 0) {
    return;
  }

  const containerWidth = host.clientWidth || 0;
  if (containerWidth <= 0) {
    return;
  }

  host.classList.toggle('has-x-scroll', measuredTotal - containerWidth > 8);
}

export function syncDefaultGridOverflowHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  if (!isDefaultGridContext(ctx)) {
    return;
  }
  syncFixedHeaderScrollbarCompensation(ctx);
}

export function queueDefaultGridOverflowSyncHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const hostCandidate = (ctx.elementRef?.nativeElement as HTMLElement | undefined) ?? null;
  if (!hostCandidate || !isDefaultGridContext(ctx)) {
    return;
  }
  const host: HTMLElement = hostCandidate;

  const isLayoutActuallyTransitioning = () =>
    !!host.closest?.('.bg-app.sidebar-transitioning');

  if (!isLayoutActuallyTransitioning()) {
    applyDefaultGridOverflowPrediction(ctx, host);
  }

  if (ctx.defaultGridOverflowRaf != null) {
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(ctx.defaultGridOverflowRaf as number);
    } else {
      clearTimeout(ctx.defaultGridOverflowRaf as ReturnType<typeof setTimeout>);
    }
  }

  function scheduleFlush(): void {
    if (typeof requestAnimationFrame === 'function') {
      ctx.defaultGridOverflowRaf = requestAnimationFrame(flush);
    } else {
      ctx.defaultGridOverflowRaf = setTimeout(flush, 16);
    }
  }

  function flush(): void {
    if (isLayoutActuallyTransitioning()) {
      scheduleFlush();
      return;
    }
    ctx.defaultGridOverflowRaf = null;
    applyDefaultGridOverflowPrediction(ctx, host);
    syncFixedHeaderScrollbarCompensation(ctx);
  }

  scheduleFlush();
}

export function setupDefaultGridOverflowObserverHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  const host = (ctx.elementRef?.nativeElement as HTMLElement | undefined) ?? null;
  if (!host || !isDefaultGridContext(ctx)) {
    teardownDefaultGridOverflowObserverHelper(ctx);
    return;
  }

  const update = () => queueDefaultGridOverflowSyncHelper(ctx);
  if (ctx.defaultGridOverflowObserver) {
    ctx.defaultGridOverflowObserver.disconnect();
  }

  if (typeof ResizeObserver === 'undefined') {
    update();
    return;
  }

  const observer = new ResizeObserver(update);
  const viewport = resolveCurrentViewport(ctx);
  if (viewport) {
    observer.observe(viewport);
  }
  // Do not observe the table element itself here.
  // Updating --dg-grid-table-width changes the table size and can feed the observer back into
  // another overflow sync pass, which is perceived as micro-stutter on dense default-grid grids.
  observer.observe(host);
  ctx.defaultGridOverflowObserver = observer;
  update();
}

export function teardownDefaultGridOverflowObserverHelper(
  ctx: HelperContext,
  ...args: LooseValue[]
): LooseValue {
  if (ctx.defaultGridOverflowObserver) {
    ctx.defaultGridOverflowObserver.disconnect();
    ctx.defaultGridOverflowObserver = null;
  }
  if (ctx.defaultGridOverflowRaf != null) {
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(ctx.defaultGridOverflowRaf as number);
    } else {
      clearTimeout(ctx.defaultGridOverflowRaf as ReturnType<typeof setTimeout>);
    }
    ctx.defaultGridOverflowRaf = null;
  }
}

function syncFixedHeaderScrollbarCompensation(ctx: HelperContext): void {
  const bodyScroller = resolveHorizontalBodyScrollTarget(ctx);
  const host = (ctx.elementRef?.nativeElement as HTMLElement | undefined) ?? null;
  if (!host || !bodyScroller) return;
  const isDefaultGridGrid = isDefaultGridContext(ctx);
  const measuredScrollbarWidth = Math.max(
    0,
    (bodyScroller.offsetWidth || 0) - (bodyScroller.clientWidth || 0)
  );
  const hasVerticalOverflow =
    (bodyScroller.scrollHeight || 0) - (bodyScroller.clientHeight || 0) > 1;
  const scrollbarWidth = hasVerticalOverflow
    ? Math.max(measuredScrollbarWidth, 8)
    : measuredScrollbarWidth;
  const nextComp = `${scrollbarWidth}px`;
  const prevComp = (host.style.getPropertyValue('--dg-vscrollbar-comp') || '').trim();
  const compensationChanged = prevComp !== nextComp;
  const defaultGridChanged = syncDefaultGridOverflowMetrics(ctx, host, bodyScroller);
  const syncBottomScrollbarToBody = () => {
    const bottomScrollbar = resolveBottomScrollbarElements(ctx)?.viewport ?? null;
    if (!bottomScrollbar) {
      return;
    }
    const next = isDefaultGridGrid
      ? mapDefaultGridBodyToBottom(ctx, bodyScroller, bottomScrollbar)
      : mapScrollLeftToTarget(bodyScroller, bottomScrollbar);
    if (Math.abs((bottomScrollbar.scrollLeft || 0) - next) > 1) {
      markProgrammaticScroll(ctx, bottomScrollbar, next);
      bottomScrollbar.scrollLeft = next;
    }
  };
  const syncGroupedScrollToBody = () => {
    syncGroupedContainerScrollLeft(ctx, host, Number(bodyScroller.scrollLeft) || 0);
  };
  const syncFixedHeaderToBody = () => {
    const fixedHeader = resolveCurrentFixedHeader(ctx);
    const next = Number(bodyScroller.scrollLeft) || 0;
    if (isDefaultGridGrid) {
      queueFixedHeaderScrollSync(ctx, fixedHeader, next, { immediate: true });
      return;
    }
    if (fixedHeader) {
      syncHorizontalScrollPosition(bodyScroller, fixedHeader);
    }
  };
  if (!compensationChanged && !defaultGridChanged) {
    syncBottomScrollbarToBody();
    syncGroupedScrollToBody();
    syncFixedHeaderToBody();
    return;
  }
  if (compensationChanged) {
    host.style.setProperty('--dg-vscrollbar-comp', nextComp);
  }
  syncBottomScrollbarToBody();
  syncGroupedScrollToBody();
  syncFixedHeaderToBody();

  // Compensation changes the fixed-header visible width, which changes its max scroll range.
  // Re-sync after the style write so header/body stay aligned even when row-count changes
  // toggle the vertical scrollbar and max scroll widths drift by a few pixels.
  requestAnimationFrame(() => {
    syncFixedHeaderToBody();
    syncBottomScrollbarToBody();
    syncGroupedScrollToBody();
  });
}
