import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyExternalFiltersHelper,
  applyGroupingStateHelper,
  applyColumnWidthHelper,
  buildGroupedRowsHelper,
  calculateAutoWidthHelper,
  collapseAllGroupsHelper,
  expandAllGroupsHelper,
  getAggregateCellClassHelper,
  getCellClassHelper,
  getCellStyleHelper,
  getColumnPixelWidthHelper,
  getHeaderStyleHelper,
  hasAggregatesHelper,
  getFilterLabelHelper,
  getGroupLabelHelper,
  getPercentAggregateHelper,
  getRenderedColumnWidthHelper,
  getTotalTableWidthHelper,
  isFirstVisibleColumnHelper,
  isGroupExpandedByIdHelper,
  getMaximumColumnWidthHelper,
  getMinimumColumnWidthHelper,
  onColumnResizeStartHelper,
  onFixedHeaderScrollHelper,
  onHeaderDragStartHelper,
  onHeaderDragEndHelper,
  onHeaderDragOverHelper,
  onHeaderDropHelper,
  onHeaderPointerDownHelper,
  onHeaderPointerMoveHelper,
  onHeaderPointerUpHelper,
  applyPinnedOrderingHelper,
  onGridContainerScrollHelper,
  reorderColumnsHelper,
  clearAllFiltersHelper,
  setColumnPinnedHelper,
  queueDefaultGridOverflowSyncHelper,
  setupDefaultGridOverflowObserverHelper,
  syncHeaderBodyWidthsHelper,
  syncDefaultGridOverflowHelper
} from './data-grid.component.part2.internal.impl';

function createClassList(...tokens: string[]) {
  const values = new Set(tokens);
  return {
    contains(token: string) {
      return values.has(token);
    },
    add(token: string) {
      values.add(token);
    },
    remove(token: string) {
      values.delete(token);
    },
    toggle(token: string, force?: boolean) {
      if (force === true) {
        values.add(token);
        return true;
      }
      if (force === false) {
        values.delete(token);
        return false;
      }
      if (values.has(token)) {
        values.delete(token);
        return false;
      }
      values.add(token);
      return true;
    }
  };
}

function createStyleStore() {
  const values = new Map<string, string>();
  return {
    transform: '',
    setProperty(name: string, value: string) {
      values.set(name, value);
    },
    getPropertyValue(name: string) {
      return values.get(name) ?? '';
    },
    removeProperty(name: string) {
      values.delete(name);
    }
  };
}

function createAttributeGetter(attributes: Record<string, string | null>) {
  return (name: string) => attributes[name] ?? null;
}

function createPointerEventLike(
  overrides: Partial<PointerEvent> & {
    target?: EventTarget | null;
    preventDefault?: () => void;
    stopPropagation?: () => void;
  }
): PointerEvent {
  return {
    pointerId: 1,
    button: 0,
    isPrimary: true,
    clientX: 0,
    clientY: 0,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...overrides
  } as unknown as PointerEvent;
}

describe('data-grid.component.part2.internal.impl', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1)
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reuses cached cell and header style objects for stable layout inputs', () => {
    const column = { field: 'name', align: 'center', pinned: 'left' };
    const ctx = {
      alignmentChangeTimestamp: vi.fn(),
      pinnedOffsets() {
        return { left: new Map([['name', 32]]), right: new Map() };
      },
      getColumnField(col: { field: string }) {
        return col.field;
      }
    };

    const first = getCellStyleHelper(ctx, {}, column);
    const second = getCellStyleHelper(ctx, {}, column);
    const header = getHeaderStyleHelper(ctx, column);

    expect(second).toBe(first);
    expect(header).toBe(first);
    expect(first).toEqual({
      'text-align': 'center',
      position: 'sticky',
      zIndex: '12',
      left: '32px'
    });

    const shifted = getCellStyleHelper(
      {
        ...ctx,
        pinnedOffsets() {
          return { left: new Map([['name', 48]]), right: new Map() };
        }
      },
      {},
      column
    );

    expect(shifted).not.toBe(first);
    expect(shifted).toEqual({
      'text-align': 'center',
      position: 'sticky',
      zIndex: '12',
      left: '48px'
    });
  });

  it('builds cell class strings without dropping dynamic state classes', () => {
    const column = {
      field: 'status',
      align: 'right',
      pinned: 'left',
      cellClass: (value: unknown) => (value === 'open' ? 'status-open' : '')
    };
    const ctx = {
      alignmentChangeTimestamp: vi.fn(),
      getColumnField(col: { field: string }) {
        return col.field;
      },
      getSortDirection: vi.fn(() => 'asc'),
      hasActiveFilter: vi.fn(() => true),
      wrappedColumns: vi.fn(() => new Set(['status'])),
      duplicateHighlightColumns: vi.fn(() => new Set(['status'])),
      duplicateValueKeys: vi.fn(() => new Map([['status', new Set(['open'])]])),
      isEmptyValue: vi.fn(
        (value: unknown) => value === null || value === undefined || value === ''
      ),
      getFilterOptionKey: vi.fn((value: unknown) => String(value))
    };

    expect(getCellClassHelper(ctx, { status: 'open' }, column)).toBe(
      'status-open text-right col-is-sorted col-is-filtered pinned-left cell-wrap cell-duplicate'
    );
  });

  it('uses sorted and filtered field lookups for per-cell class state', () => {
    const column = { field: 'name', align: 'left' };
    const ctx = {
      alignmentChangeTimestamp: vi.fn(),
      getColumnField: vi.fn((col: { field: string }) => col.field),
      sortedColumnFieldLookup: vi.fn(() => new Set(['name'])),
      activeFilterFieldLookup: vi.fn(() => new Set(['name'])),
      getSortDirection: vi.fn(() => {
        throw new Error('getSortDirection should not run when the lookup is available');
      }),
      hasActiveFilter: vi.fn(() => {
        throw new Error('hasActiveFilter should not run when the lookup is available');
      }),
      wrappedColumns: vi.fn(() => new Set()),
      duplicateHighlightColumns: vi.fn(() => new Set())
    };

    expect(getCellClassHelper(ctx, { name: 'Ahmed' }, column)).toBe(
      'text-left col-is-sorted col-is-filtered'
    );
    expect(getAggregateCellClassHelper(ctx, column)).toBe(
      'text-left col-is-sorted col-is-filtered'
    );
    expect(ctx.getSortDirection).not.toHaveBeenCalled();
    expect(ctx.hasActiveFilter).not.toHaveBeenCalled();
  });

  it('uses the cached aggregate column flag on grouped hot paths', () => {
    const ctx = {
      hasAggregateColumnsCached: vi.fn(() => true),
      visibleColumns: vi.fn(() => {
        throw new Error('visibleColumns should not be scanned when aggregate flag is cached');
      })
    };

    expect(hasAggregatesHelper(ctx)).toBe(true);
    expect(ctx.hasAggregateColumnsCached).toHaveBeenCalledOnce();
    expect(ctx.visibleColumns).not.toHaveBeenCalled();
  });

  it('uses the cached total table width for repeated grouped table bindings', () => {
    const ctx = {
      totalTableWidthCached: vi.fn(() => 960),
      visibleColumns: vi.fn(() => {
        throw new Error('visibleColumns should not be scanned when total width is cached');
      }),
      config: { selectable: true, rowActions: [{}] }
    };

    expect(getTotalTableWidthHelper(ctx)).toBe(960);
    expect(ctx.totalTableWidthCached).toHaveBeenCalledOnce();
    expect(ctx.visibleColumns).not.toHaveBeenCalled();
  });

  it('uses cached column labels on grouped and filter chip hot paths', () => {
    const lookup = new Map([
      ['status', 'Status'],
      ['owner', 'Owner']
    ]);
    const ctx = {
      columnLabelLookup: vi.fn(() => lookup),
      columns: {
        find() {
          throw new Error('columns should not be scanned when label lookup is cached');
        }
      }
    };

    expect(getGroupLabelHelper(ctx, 'status')).toBe('Status');
    expect(getFilterLabelHelper(ctx, 'owner')).toBe('Owner');
    expect(ctx.columnLabelLookup).toHaveBeenCalledTimes(2);
  });

  it('uses the cached first visible column field for footer aggregate cells', () => {
    const ctx = {
      firstVisibleColumnField: vi.fn(() => 'name'),
      visibleColumns: vi.fn(() => {
        throw new Error('visibleColumns should not be scanned when first field is cached');
      }),
      getColumnField: vi.fn((column: { field: string }) => column.field)
    };

    expect(isFirstVisibleColumnHelper(ctx, { field: 'name' })).toBe(true);
    expect(isFirstVisibleColumnHelper(ctx, { field: 'owner' })).toBe(false);
    expect(ctx.visibleColumns).not.toHaveBeenCalled();
  });

  it('syncs the detached header immediately for Default-grid horizontal scrolling', () => {
    const headerTable = {
      style: {
        transform: ''
      }
    } as unknown as HTMLElement;

    const gridContainer = {
      classList: createClassList('grid-container')
    } as unknown as HTMLElement;

    const host = {
      classList: createClassList(),
      getAttribute: createAttributeGetter({
        'data-grid-layout-preset': 'default'
      }),
      ownerDocument: {
        body: {
          classList: createClassList()
        }
      },
      querySelector(selector: string) {
        return selector === '.grid-container' ? gridContainer : null;
      }
    } as unknown as HTMLElement;

    const fixedHeader = {
      isConnected: true,
      scrollLeft: 0,
      dataset: {},
      style: {
        setProperty: vi.fn(),
        removeProperty: vi.fn()
      },
      querySelector(selector: string) {
        return selector === '.header-table' ? headerTable : null;
      },
      closest(selector: string) {
        return selector === '.engineers-salary-reference-data-grid' ? host : null;
      }
    } as unknown as HTMLElement;

    const viewport = {
      isConnected: true,
      classList: createClassList('table-scroll'),
      scrollLeft: 148
    } as unknown as HTMLElement;

    const ctx = {
      config: {
        selectable: true,
        pinSelectionColumn: true
      },
      elementRef: { nativeElement: host },
      fixedHeader: { nativeElement: fixedHeader },
      gridViewport: { nativeElement: viewport },
      lastDefaultGridBodyScrollLeft: null,
      headerScrollSyncRAF: null,
      pendingHeaderScrollLeft: null,
      suspendHoverUntilTs: undefined
    };

    onGridContainerScrollHelper(ctx, { target: viewport, type: 'scroll' });

    expect(fixedHeader.scrollLeft).toBe(0);
    expect(fixedHeader.dataset['dgScrollLeft']).toBe('148');
    expect(headerTable.style.transform).toBe('translate3d(-148px, 0, 0)');
    expect(ctx.pendingHeaderScrollLeft).toBeNull();
    expect(ctx.headerScrollSyncRAF).toBeNull();
    expect(ctx.suspendHoverUntilTs).toBeUndefined();
  });

  it('uses native header scroll when Default-grid has pinned data columns', () => {
    const headerTable = {
      style: {
        transform: 'translate3d(-80px, 0, 0)'
      }
    } as unknown as HTMLElement;

    const gridContainer = {
      classList: createClassList('grid-container')
    } as unknown as HTMLElement;

    const host = {
      classList: createClassList('has-pinned-data-columns'),
      getAttribute: createAttributeGetter({
        'data-grid-layout-preset': 'default'
      }),
      ownerDocument: {
        body: {
          classList: createClassList()
        }
      },
      querySelector(selector: string) {
        return selector === '.grid-container' ? gridContainer : null;
      }
    } as unknown as HTMLElement;

    const fixedHeader = {
      isConnected: true,
      scrollLeft: 0,
      dataset: {
        dgScrollLeft: '80'
      },
      style: {
        setProperty: vi.fn(),
        removeProperty: vi.fn()
      },
      querySelector(selector: string) {
        return selector === '.header-table' ? headerTable : null;
      },
      closest(selector: string) {
        return selector === '.engineers-salary-reference-data-grid' ? host : null;
      }
    } as unknown as HTMLElement;

    const viewport = {
      isConnected: true,
      classList: createClassList('table-scroll'),
      scrollLeft: 148
    } as unknown as HTMLElement;

    const ctx = {
      config: {
        selectable: true,
        pinSelectionColumn: true
      },
      visibleColumns: vi.fn(() => [{ field: 'supplier', pinned: 'left' }]),
      elementRef: { nativeElement: host },
      fixedHeader: { nativeElement: fixedHeader },
      gridViewport: { nativeElement: viewport },
      lastDefaultGridBodyScrollLeft: null,
      headerScrollSyncRAF: null,
      pendingHeaderScrollLeft: null,
      suspendHoverUntilTs: undefined
    };

    onGridContainerScrollHelper(ctx, { target: viewport, type: 'scroll' });

    expect(fixedHeader.scrollLeft).toBe(148);
    expect(fixedHeader.dataset['dgScrollLeft']).toBeUndefined();
    expect(headerTable.style.transform).toBe('');
    expect(fixedHeader.style.removeProperty).toHaveBeenCalledWith('--dg-header-counter-scroll');
    expect(ctx.pendingHeaderScrollLeft).toBe(148);
    expect(ctx.headerScrollSyncRAF).toBe(1);
  });

  it('keeps default-grid header scroll as a body-owned mirror only', () => {
    const headerTable = {
      style: {
        transform: ''
      }
    } as unknown as HTMLElement;
    const hostStyle = createStyleStore();
    const bottomViewport = {
      isConnected: true,
      scrollLeft: 12
    } as unknown as HTMLElement;
    const bottomTrack = {
      isConnected: true,
      style: createStyleStore()
    } as unknown as HTMLElement;
    const host = {
      classList: createClassList('grouping-mode-active'),
      getAttribute: createAttributeGetter({
        'data-grid-layout-preset': 'default'
      }),
      style: hostStyle,
      ownerDocument: {
        body: {
          classList: createClassList()
        }
      },
      querySelector() {
        return null;
      }
    } as unknown as HTMLElement;
    const fixedHeader = {
      isConnected: true,
      scrollLeft: 64,
      dataset: {},
      style: {
        setProperty: vi.fn(),
        removeProperty: vi.fn()
      },
      querySelector(selector: string) {
        return selector === '.header-table' ? headerTable : null;
      },
      closest(selector: string) {
        return selector === '.engineers-salary-reference-data-grid' ? host : null;
      }
    } as unknown as HTMLElement;
    const viewport = {
      isConnected: true,
      classList: createClassList('table-scroll'),
      scrollLeft: 148,
      scrollTop: 0
    } as unknown as HTMLElement;
    const ctx = {
      config: {
        selectable: true,
        pinSelectionColumn: true
      },
      elementRef: { nativeElement: host },
      fixedHeader: { nativeElement: fixedHeader },
      gridViewport: { nativeElement: viewport },
      bottomScrollbarViewport: { nativeElement: bottomViewport },
      bottomScrollbarTrack: { nativeElement: bottomTrack },
      headerScrollSyncRAF: null,
      pendingHeaderScrollLeft: null
    };

    onFixedHeaderScrollHelper(ctx, { target: fixedHeader, type: 'scroll' });

    expect(viewport.scrollLeft).toBe(148);
    expect(bottomViewport.scrollLeft).toBe(148);
    expect(fixedHeader.scrollLeft).toBe(0);
    expect(fixedHeader.dataset['dgScrollLeft']).toBe('148');
    expect(hostStyle.getPropertyValue('--dg-grid-scroll-left')).toBe('148px');
    expect(hostStyle.getPropertyValue('--dg-group-scroll-left')).toBe('148px');
    expect(headerTable.style.transform).toBe('translate3d(-148px, 0, 0)');
  });

  it('syncs the bottom horizontal scrollbar from the body viewport for default-grid grids', () => {
    const headerTable = {
      style: {
        transform: ''
      }
    } as unknown as HTMLElement;

    const bottomViewport = {
      isConnected: true,
      scrollLeft: 0
    } as unknown as HTMLElement;

    const bottomTrack = {
      isConnected: true,
      style: createStyleStore()
    } as unknown as HTMLElement;

    const host = {
      classList: createClassList(),
      getAttribute: createAttributeGetter({
        'data-grid-layout-preset': 'default'
      }),
      ownerDocument: {
        body: {
          classList: createClassList()
        }
      },
      querySelector() {
        return null;
      }
    } as unknown as HTMLElement;

    const fixedHeader = {
      isConnected: true,
      scrollLeft: 0,
      dataset: {},
      style: {
        setProperty: vi.fn(),
        removeProperty: vi.fn()
      },
      querySelector(selector: string) {
        return selector === '.header-table' ? headerTable : null;
      },
      closest(selector: string) {
        return selector === '.engineers-salary-reference-data-grid' ? host : null;
      }
    } as unknown as HTMLElement;

    const viewport = {
      isConnected: true,
      classList: createClassList('table-scroll'),
      scrollLeft: 164,
      scrollTop: 0
    } as unknown as HTMLElement;

    const ctx = {
      config: {
        selectable: true,
        pinSelectionColumn: true
      },
      elementRef: { nativeElement: host },
      fixedHeader: { nativeElement: fixedHeader },
      gridViewport: { nativeElement: viewport },
      bottomScrollbarViewport: { nativeElement: bottomViewport },
      bottomScrollbarTrack: { nativeElement: bottomTrack },
      lastDefaultGridBodyScrollLeft: null,
      headerScrollSyncRAF: null,
      pendingHeaderScrollLeft: null,
      suspendHoverUntilTs: undefined
    };

    onGridContainerScrollHelper(ctx, { target: viewport, type: 'scroll' });

    expect(bottomViewport.scrollLeft).toBe(164);
    expect(headerTable.style.transform).toBe('translate3d(-164px, 0, 0)');
  });

  it('drives the body viewport from the bottom horizontal scrollbar for default-grid grids', () => {
    const headerTable = {
      style: {
        transform: ''
      }
    } as unknown as HTMLElement;

    const bottomViewport = {
      isConnected: true,
      scrollLeft: 188
    } as unknown as HTMLElement;

    const bottomTrack = {
      isConnected: true,
      style: createStyleStore()
    } as unknown as HTMLElement;

    const host = {
      classList: createClassList(),
      getAttribute: createAttributeGetter({
        'data-grid-layout-preset': 'default'
      }),
      ownerDocument: {
        body: {
          classList: createClassList()
        }
      },
      querySelector() {
        return null;
      }
    } as unknown as HTMLElement;

    const fixedHeader = {
      isConnected: true,
      scrollLeft: 0,
      dataset: {},
      style: {
        setProperty: vi.fn(),
        removeProperty: vi.fn()
      },
      querySelector(selector: string) {
        return selector === '.header-table' ? headerTable : null;
      },
      closest(selector: string) {
        return selector === '.engineers-salary-reference-data-grid' ? host : null;
      }
    } as unknown as HTMLElement;

    const viewport = {
      isConnected: true,
      classList: createClassList('table-scroll'),
      scrollLeft: 0,
      scrollTop: 0
    } as unknown as HTMLElement;

    const ctx = {
      config: {
        selectable: true,
        pinSelectionColumn: true
      },
      elementRef: { nativeElement: host },
      fixedHeader: { nativeElement: fixedHeader },
      gridViewport: { nativeElement: viewport },
      bottomScrollbarViewport: { nativeElement: bottomViewport },
      bottomScrollbarTrack: { nativeElement: bottomTrack },
      lastDefaultGridBodyScrollLeft: null,
      headerScrollSyncRAF: null,
      pendingHeaderScrollLeft: null,
      suspendHoverUntilTs: undefined
    };

    onGridContainerScrollHelper(ctx, { target: bottomViewport, type: 'scroll' });

    expect(viewport.scrollLeft).toBe(188);
    expect(fixedHeader.dataset['dgScrollLeft']).toBe('188');
    expect(headerTable.style.transform).toBe('translate3d(-188px, 0, 0)');
  });

  it('maps bottom scrollbar range to the body viewport range for default-grid grids', () => {
    const headerTable = {
      style: {
        transform: ''
      }
    } as unknown as HTMLElement;
    const hostStyle = createStyleStore();

    const bottomViewport = {
      isConnected: true,
      scrollLeft: 150,
      scrollWidth: 700,
      clientWidth: 200
    } as unknown as HTMLElement;

    const bottomTrack = {
      isConnected: true,
      style: createStyleStore()
    } as unknown as HTMLElement;

    const host = {
      classList: createClassList(),
      getAttribute: createAttributeGetter({
        'data-grid-layout-preset': 'default'
      }),
      style: hostStyle,
      ownerDocument: {
        body: {
          classList: createClassList()
        }
      },
      querySelector() {
        return null;
      }
    } as unknown as HTMLElement;

    const fixedHeader = {
      isConnected: true,
      scrollLeft: 0,
      dataset: {},
      style: {
        setProperty: vi.fn(),
        removeProperty: vi.fn()
      },
      querySelector(selector: string) {
        return selector === '.header-table' ? headerTable : null;
      },
      closest(selector: string) {
        return selector === '.engineers-salary-reference-data-grid' ? host : null;
      }
    } as unknown as HTMLElement;

    const viewport = {
      isConnected: true,
      classList: createClassList('table-scroll'),
      scrollLeft: 0,
      scrollTop: 0,
      scrollWidth: 1200,
      clientWidth: 200
    } as unknown as HTMLElement;

    const ctx = {
      config: {
        selectable: true,
        pinSelectionColumn: true
      },
      elementRef: { nativeElement: host },
      fixedHeader: { nativeElement: fixedHeader },
      gridViewport: { nativeElement: viewport },
      bottomScrollbarViewport: { nativeElement: bottomViewport },
      bottomScrollbarTrack: { nativeElement: bottomTrack },
      lastDefaultGridBodyScrollLeft: null,
      headerScrollSyncRAF: null,
      pendingHeaderScrollLeft: null,
      suspendHoverUntilTs: undefined
    };

    onGridContainerScrollHelper(ctx, { target: bottomViewport, type: 'scroll' });

    expect(viewport.scrollLeft).toBe(300);
    expect(hostStyle.getPropertyValue('--dg-grid-scroll-left')).toBe('300px');
    expect(hostStyle.getPropertyValue('--dg-group-scroll-left')).toBe('300px');
    expect(fixedHeader.dataset['dgScrollLeft']).toBe('300');
    expect(headerTable.style.transform).toBe('translate3d(-300px, 0, 0)');
  });

  it('maps body viewport range back to the bottom scrollbar range for default-grid grids', () => {
    const headerTable = {
      style: {
        transform: ''
      }
    } as unknown as HTMLElement;
    const hostStyle = createStyleStore();

    const bottomViewport = {
      isConnected: true,
      scrollLeft: 0,
      scrollWidth: 700,
      clientWidth: 200
    } as unknown as HTMLElement;

    const bottomTrack = {
      isConnected: true,
      style: createStyleStore()
    } as unknown as HTMLElement;

    const host = {
      classList: createClassList(),
      getAttribute: createAttributeGetter({
        'data-grid-layout-preset': 'default'
      }),
      style: hostStyle,
      ownerDocument: {
        body: {
          classList: createClassList()
        }
      },
      querySelector() {
        return null;
      }
    } as unknown as HTMLElement;

    const fixedHeader = {
      isConnected: true,
      scrollLeft: 0,
      dataset: {},
      style: {
        setProperty: vi.fn(),
        removeProperty: vi.fn()
      },
      querySelector(selector: string) {
        return selector === '.header-table' ? headerTable : null;
      },
      closest(selector: string) {
        return selector === '.engineers-salary-reference-data-grid' ? host : null;
      }
    } as unknown as HTMLElement;

    const viewport = {
      isConnected: true,
      classList: createClassList('table-scroll'),
      scrollLeft: 300,
      scrollTop: 0,
      scrollWidth: 1200,
      clientWidth: 200
    } as unknown as HTMLElement;

    const ctx = {
      config: {
        selectable: true,
        pinSelectionColumn: true
      },
      elementRef: { nativeElement: host },
      fixedHeader: { nativeElement: fixedHeader },
      gridViewport: { nativeElement: viewport },
      bottomScrollbarViewport: { nativeElement: bottomViewport },
      bottomScrollbarTrack: { nativeElement: bottomTrack },
      lastDefaultGridBodyScrollLeft: null,
      headerScrollSyncRAF: null,
      pendingHeaderScrollLeft: null,
      suspendHoverUntilTs: undefined
    };

    onGridContainerScrollHelper(ctx, { target: viewport, type: 'scroll' });

    expect(bottomViewport.scrollLeft).toBe(150);
    expect(hostStyle.getPropertyValue('--dg-grid-scroll-left')).toBe('300px');
    expect(hostStyle.getPropertyValue('--dg-group-scroll-left')).toBe('300px');
    expect(fixedHeader.dataset['dgScrollLeft']).toBe('300');
    expect(headerTable.style.transform).toBe('translate3d(-300px, 0, 0)');
  });

  it('keeps grouped default-grid header, footer and bottom scrollbar on the body scroll position', () => {
    const headerTable = {
      style: {
        transform: ''
      }
    } as unknown as HTMLElement;
    const hostStyle = createStyleStore();

    const bottomViewport = {
      isConnected: true,
      scrollLeft: 0
    } as unknown as HTMLElement;

    const bottomTrack = {
      isConnected: true,
      style: createStyleStore()
    } as unknown as HTMLElement;

    const host = {
      classList: createClassList('grouping-mode-active'),
      getAttribute: createAttributeGetter({
        'data-grid-layout-preset': 'default'
      }),
      style: hostStyle,
      ownerDocument: {
        body: {
          classList: createClassList()
        }
      },
      querySelector() {
        return null;
      }
    } as unknown as HTMLElement;

    const fixedHeader = {
      isConnected: true,
      scrollLeft: 0,
      dataset: {},
      style: {
        setProperty: vi.fn(),
        removeProperty: vi.fn()
      },
      querySelector(selector: string) {
        return selector === '.header-table' ? headerTable : null;
      },
      closest(selector: string) {
        return selector === '.engineers-salary-reference-data-grid' ? host : null;
      }
    } as unknown as HTMLElement;

    const viewport = {
      isConnected: true,
      classList: createClassList('table-scroll'),
      scrollLeft: 96,
      scrollTop: 0
    } as unknown as HTMLElement;

    const ctx = {
      config: {
        selectable: true,
        pinSelectionColumn: true
      },
      elementRef: { nativeElement: host },
      fixedHeader: { nativeElement: fixedHeader },
      gridViewport: { nativeElement: viewport },
      bottomScrollbarViewport: { nativeElement: bottomViewport },
      bottomScrollbarTrack: { nativeElement: bottomTrack },
      lastDefaultGridBodyScrollLeft: null,
      headerScrollSyncRAF: null,
      pendingHeaderScrollLeft: null,
      suspendHoverUntilTs: undefined
    };

    onGridContainerScrollHelper(ctx, { target: viewport, type: 'scroll' });

    expect(bottomViewport.scrollLeft).toBe(96);
    expect(hostStyle.getPropertyValue('--dg-grid-scroll-left')).toBe('96px');
    expect(hostStyle.getPropertyValue('--dg-group-scroll-left')).toBe('96px');
    expect(fixedHeader.dataset['dgScrollLeft']).toBe('96');
    expect(headerTable.style.transform).toBe('translate3d(-96px, 0, 0)');
  });

  it('resolves percentage column widths against the grid viewport width', () => {
    const viewport = {
      clientWidth: 800
    } as HTMLElement;

    const ctx = {
      gridViewport: { nativeElement: viewport }
    };

    expect(getColumnPixelWidthHelper(ctx, { field: 'name', width: '25%' })).toBe(200);
  });

  it('tracks the drop edge and inserts the dragged column after the target when hovering its trailing half', () => {
    const target = document.createElement('th');
    Object.defineProperty(target, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left: 100,
        width: 80
      })
    });

    const ctx = {
      draggingColumnField: 'owner',
      dropTargetColumnField: null,
      dropTargetColumnEdge: null,
      headerDropHandled: false,
      config: { rtl: false },
      columns: [
        { field: 'name', header: 'Name' },
        { field: 'owner', header: 'Owner' },
        { field: 'status', header: 'Status' }
      ],
      applyPinnedOrdering: vi.fn(),
      saveState: vi.fn(),
      stateKey: 'grid'
    };

    onHeaderDragOverHelper(
      ctx,
      {
        preventDefault: vi.fn(),
        currentTarget: target,
        clientX: 170,
        dataTransfer: { dropEffect: 'none' }
      } as unknown as DragEvent,
      { field: 'status' }
    );

    expect(ctx.dropTargetColumnField).toBe('status');
    expect(ctx.dropTargetColumnEdge).toBe('after');

    reorderColumnsHelper(ctx, 'owner', 'status', ctx.dropTargetColumnEdge);

    expect(ctx.columns.map((column: { field: string }) => column.field)).toEqual([
      'name',
      'status',
      'owner'
    ]);
    expect(ctx.applyPinnedOrdering).toHaveBeenCalledTimes(1);
    expect(ctx.saveState).toHaveBeenCalledTimes(1);
  });

  it('marks the reorder target without moving table cells during header drag', () => {
    const target = document.createElement('th');
    Object.defineProperty(target, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left: 100,
        width: 80
      })
    });
    const ctx = {
      draggingColumnField: 'owner',
      dropTargetColumnField: null,
      dropTargetColumnEdge: null,
      headerDropHandled: false,
      columnDragPreviewOriginalColumns: [
        { field: 'name' },
        { field: 'owner' },
        { field: 'status' }
      ],
      config: { rtl: false },
      columns: [
        { field: 'name', header: 'Name' },
        { field: 'owner', header: 'Owner' },
        { field: 'status', header: 'Status' }
      ],
      applyPinnedOrdering: vi.fn(),
      cdr: { markForCheck: vi.fn() },
      syncHeaderBodyWidths: vi.fn()
    };

    onHeaderDragOverHelper(
      ctx,
      {
        preventDefault: vi.fn(),
        currentTarget: target,
        clientX: 110,
        dataTransfer: { dropEffect: 'none' }
      } as unknown as DragEvent,
      { field: 'status' }
    );

    expect(ctx.dropTargetColumnField).toBe('status');
    expect(ctx.dropTargetColumnEdge).toBe('before');
    expect(ctx.columns.map((column: { field: string }) => column.field)).toEqual([
      'name',
      'owner',
      'status'
    ]);
    expect(ctx.applyPinnedOrdering).not.toHaveBeenCalled();
    expect(ctx.syncHeaderBodyWidths).not.toHaveBeenCalled();
  });

  it('keeps column order stable during header drag and persists only on drop', () => {
    const target = document.createElement('th');
    Object.defineProperty(target, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left: 100,
        width: 80
      })
    });

    const emitColumnsChange = vi.fn();
    const saveState = vi.fn();
    const ctx = {
      draggingColumnField: 'owner',
      dropTargetColumnField: null,
      dropTargetColumnEdge: null,
      headerDropHandled: false,
      columnDragPreviewOriginalColumns: null,
      config: { rtl: false },
      columns: [{ field: 'name' }, { field: 'owner' }, { field: 'status' }],
      applyPinnedOrdering: vi.fn(),
      cdr: { markForCheck: vi.fn() },
      syncHeaderBodyWidths: vi.fn(),
      emitColumnsChange,
      saveState,
      stateKey: 'grid'
    };

    onHeaderDragOverHelper(
      ctx,
      {
        preventDefault: vi.fn(),
        currentTarget: target,
        clientX: 170,
        dataTransfer: { dropEffect: 'none' }
      } as unknown as DragEvent,
      { field: 'status' }
    );

    expect(ctx.columns.map((column: { field: string }) => column.field)).toEqual([
      'name',
      'owner',
      'status'
    ]);
    expect(ctx.columnDragPreviewOriginalColumns).toBeNull();
    expect(ctx.dropTargetColumnField).toBe('status');
    expect(ctx.dropTargetColumnEdge).toBe('after');
    expect(ctx.applyPinnedOrdering).not.toHaveBeenCalled();
    expect(ctx.cdr.markForCheck).toHaveBeenCalledTimes(1);
    expect(ctx.syncHeaderBodyWidths).not.toHaveBeenCalled();
    expect(emitColumnsChange).not.toHaveBeenCalled();
    expect(saveState).not.toHaveBeenCalled();
  });

  it('restores the original column order when a pending header drag is cancelled', () => {
    const originalColumns = [{ field: 'name' }, { field: 'owner' }, { field: 'status' }];
    const ctx = {
      draggingColumnField: 'owner',
      dropTargetColumnField: 'status',
      dropTargetColumnEdge: 'after' as const,
      headerDropHandled: false,
      columnDragPreviewOriginalColumns: originalColumns,
      columns: [originalColumns[0], originalColumns[2], originalColumns[1]],
      applyPinnedOrdering: vi.fn(),
      cdr: { markForCheck: vi.fn() },
      syncHeaderBodyWidths: vi.fn()
    };

    onHeaderDragEndHelper(ctx);

    expect(ctx.columns.map((column: { field: string }) => column.field)).toEqual([
      'name',
      'owner',
      'status'
    ]);
    expect(ctx.columnDragPreviewOriginalColumns).toBeNull();
    expect(ctx.draggingColumnField).toBeNull();
    expect(ctx.dropTargetColumnField).toBeNull();
    expect(ctx.dropTargetColumnEdge).toBeNull();
    expect(ctx.applyPinnedOrdering).toHaveBeenCalledTimes(1);
  });

  it('commits a pending header drag on dragend when drop is missed inside the grid', () => {
    const reorderColumns = vi.fn();
    const ctx = {
      draggingColumnField: 'owner',
      dropTargetColumnField: 'status',
      dropTargetColumnEdge: 'after' as const,
      headerDropHandled: false,
      columnDragPreviewOriginalColumns: [
        { field: 'name' },
        { field: 'owner' },
        { field: 'status' }
      ],
      columnDragPointerInsideGrid: true,
      reorderColumns
    };

    onHeaderDragEndHelper(ctx);

    expect(reorderColumns).toHaveBeenCalledWith('owner', 'status', 'after');
    expect(ctx.columnDragPreviewOriginalColumns).toBeNull();
    expect(ctx.draggingColumnField).toBeNull();
    expect(ctx.dropTargetColumnField).toBeNull();
    expect(ctx.dropTargetColumnEdge).toBeNull();
    expect(ctx.headerDropHandled).toBe(false);
  });

  it('commits a pending header drag on drop', () => {
    const reorderColumns = vi.fn();
    const ctx = {
      draggingColumnField: 'owner',
      dropTargetColumnField: 'status',
      dropTargetColumnEdge: 'after' as const,
      headerDropHandled: false,
      columnDragPreviewOriginalColumns: [
        { field: 'name' },
        { field: 'owner' },
        { field: 'status' }
      ],
      reorderColumns
    };

    onHeaderDropHelper(
      ctx,
      {
        preventDefault: vi.fn()
      } as unknown as DragEvent,
      { field: 'status' }
    );

    expect(reorderColumns).toHaveBeenCalledWith('owner', 'status', 'after');
    expect(ctx.columnDragPreviewOriginalColumns).toBeNull();
    expect(ctx.headerDropHandled).toBe(true);
    expect(ctx.draggingColumnField).toBeNull();
  });

  it('reorders columns through pointer drag on drop without native drag/drop', () => {
    const root = document.createElement('div');
    root.className = 'engineers-salary-reference-data-grid';
    Object.defineProperty(root, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, right: 420, top: 0, bottom: 180 })
    });
    const table = document.createElement('table');
    table.className = 'header-table';
    const thead = document.createElement('thead');
    const row = document.createElement('tr');
    row.className = 'header-row';
    const fields = ['name', 'owner', 'status'];
    fields.forEach((field, index) => {
      const cell = document.createElement('th');
      cell.dataset['columnField'] = field;
      Object.defineProperty(cell, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({
          left: index * 120,
          right: index * 120 + 120,
          top: 40,
          bottom: 72,
          width: 120
        })
      });
      row.appendChild(cell);
    });
    thead.appendChild(row);
    table.appendChild(thead);
    root.appendChild(table);

    const ctx = {
      elementRef: { nativeElement: root },
      config: { rtl: false },
      columns: [
        { field: 'name', header: 'Name' },
        { field: 'owner', header: 'Owner' },
        { field: 'status', header: 'Status' }
      ],
      getColumnField: (column: { field: string }) => column.field,
      applyPinnedOrdering: vi.fn(),
      cdr: { markForCheck: vi.fn() },
      syncHeaderBodyWidths: vi.fn(),
      reorderColumns(sourceField: string, targetField: string, edge?: 'before' | 'after') {
        reorderColumnsHelper(ctx, sourceField, targetField, edge);
      },
      emitColumnsChange: vi.fn(),
      saveState: vi.fn(),
      stateKey: 'grid',
      draggingColumnField: undefined as string | null | undefined,
      dropTargetColumnField: null as string | null,
      dropTargetColumnEdge: null as 'before' | 'after' | null
    };
    const source = ctx.columns[1];

    onHeaderPointerDownHelper(
      ctx,
      createPointerEventLike({ target: row.children[1], clientX: 150, clientY: 56 }),
      source
    );
    onHeaderPointerMoveHelper(
      ctx,
      createPointerEventLike({ pointerId: 1, clientX: 154, clientY: 58 })
    );

    expect(ctx.draggingColumnField).toBeUndefined();

    onHeaderPointerMoveHelper(
      ctx,
      createPointerEventLike({ pointerId: 1, clientX: 250, clientY: 58 })
    );

    expect(ctx.draggingColumnField).toBe('owner');
    expect(ctx.dropTargetColumnField).toBe('status');
    expect(ctx.dropTargetColumnEdge).toBe('after');
    expect(root.classList.contains('is-column-reordering')).toBe(true);
    const dragCard = root.querySelector<HTMLElement>('.dg-column-drag-card');
    const dropMarker = root.querySelector<HTMLElement>('.dg-column-drop-marker');
    expect(dragCard?.textContent).toBe('Owner');
    expect(dragCard?.style.left).toBe('250px');
    expect(dragCard?.style.top).toBe('0px');
    expect(dragCard?.style.height).toBe('42px');
    expect(dropMarker?.style.left).toBe('360px');
    expect(dropMarker?.style.top).toBe('40px');
    expect(dropMarker?.style.height).toBe('32px');
    expect(ctx.columns.map((column: { field: string }) => column.field)).toEqual([
      'name',
      'owner',
      'status'
    ]);

    onHeaderPointerUpHelper(
      ctx,
      createPointerEventLike({ pointerId: 1, clientX: 250, clientY: 58 })
    );

    expect(ctx.columns.map((column: { field: string }) => column.field)).toEqual([
      'name',
      'status',
      'owner'
    ]);
    expect(ctx.emitColumnsChange).toHaveBeenCalledOnce();
    expect(ctx.saveState).toHaveBeenCalledOnce();
    expect(ctx.draggingColumnField).toBeNull();
    expect(ctx.dropTargetColumnField).toBeNull();
    expect(root.classList.contains('is-column-reordering')).toBe(false);
    expect(root.querySelector('.dg-column-drag-card')).toBeNull();
    expect(root.querySelector('.dg-column-drop-marker')).toBeNull();
  });

  it('restores column preview and groups the source column when pointer dropped on group panel', () => {
    const root = document.createElement('div');
    root.className = 'engineers-salary-reference-data-grid';
    Object.defineProperty(root, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, right: 420, top: 0, bottom: 220 })
    });
    const groupPanel = document.createElement('div');
    groupPanel.className = 'group-panel';
    Object.defineProperty(groupPanel, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, right: 420, top: 0, bottom: 34 })
    });
    const table = document.createElement('table');
    table.className = 'header-table';
    const thead = document.createElement('thead');
    const row = document.createElement('tr');
    row.className = 'header-row';
    const fields = ['name', 'owner', 'status'];
    fields.forEach((field, index) => {
      const cell = document.createElement('th');
      cell.dataset['columnField'] = field;
      Object.defineProperty(cell, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({
          left: index * 120,
          right: index * 120 + 120,
          top: 48,
          bottom: 80,
          width: 120
        })
      });
      row.appendChild(cell);
    });
    thead.appendChild(row);
    table.appendChild(thead);
    root.append(groupPanel, table);

    const addGroupColumn = vi.fn();
    const ctx = {
      elementRef: { nativeElement: root },
      config: { rtl: false },
      columns: [
        { field: 'name', header: 'Name' },
        { field: 'owner', header: 'Owner' },
        { field: 'status', header: 'Status' }
      ],
      getColumnField: (column: { field: string }) => column.field,
      applyPinnedOrdering: vi.fn(),
      cdr: { markForCheck: vi.fn() },
      syncHeaderBodyWidths: vi.fn(),
      addGroupColumn,
      draggingColumnField: null as string | null,
      dropTargetColumnField: null as string | null,
      dropTargetColumnEdge: null as 'before' | 'after' | null
    };

    onHeaderPointerDownHelper(
      ctx,
      createPointerEventLike({ target: row.children[1], clientX: 150, clientY: 64 }),
      ctx.columns[1]
    );
    onHeaderPointerMoveHelper(
      ctx,
      createPointerEventLike({ pointerId: 1, clientX: 260, clientY: 64 })
    );

    expect(ctx.columns.map((column: { field: string }) => column.field)).toEqual([
      'name',
      'owner',
      'status'
    ]);
    expect(root.querySelector<HTMLElement>('.dg-column-drag-card')?.textContent).toBe('Owner');

    onHeaderPointerUpHelper(
      ctx,
      createPointerEventLike({ pointerId: 1, clientX: 32, clientY: 18 })
    );

    expect(ctx.columns.map((column: { field: string }) => column.field)).toEqual([
      'name',
      'owner',
      'status'
    ]);
    expect(addGroupColumn).toHaveBeenCalledWith('owner');
    expect(ctx.draggingColumnField).toBeNull();
    expect(ctx.dropTargetColumnField).toBeNull();
    expect(root.querySelector('.dg-column-drag-card')).toBeNull();
  });

  it('pins a column through the layout sync path', () => {
    const columns = [{ field: 'name' }, { field: 'owner' }, { field: 'status' }];
    const syncHeaderBodyWidths = vi.fn();
    const emitColumnsChange = vi.fn();
    const saveState = vi.fn();
    const markForCheck = vi.fn();
    const ctx = {
      columns,
      getColumnField(column: { field: string }) {
        return column.field;
      },
      findColumn(field: string) {
        return ctx.columns.find(column => column.field === field) ?? null;
      },
      applyPinnedOrdering() {
        applyPinnedOrderingHelper(ctx);
      },
      syncHeaderBodyWidths,
      emitColumnsChange,
      saveState,
      stateKey: 'grid',
      cdr: { markForCheck }
    };

    setColumnPinnedHelper(ctx, 'owner', 'left');

    expect(ctx.columns.map(column => column.field)).toEqual(['owner', 'name', 'status']);
    expect((ctx.columns[0] as { pinned?: string }).pinned).toBe('left');
    expect(markForCheck).toHaveBeenCalledOnce();
    expect(syncHeaderBodyWidths).toHaveBeenCalledOnce();
    expect(emitColumnsChange).toHaveBeenCalledOnce();
    expect(saveState).toHaveBeenCalledOnce();
  });

  it('resets horizontal scroll owners when pinning so sticky headers do not overlap', () => {
    const host = document.createElement('div');
    host.setAttribute('data-grid-layout-preset', 'default');
    const viewport = document.createElement('div');
    viewport.className = 'table-scroll';
    const fixedHeader = document.createElement('div');
    fixedHeader.className = 'fixed-table-header';
    const headerTable = document.createElement('table');
    headerTable.className = 'header-table';
    const bottomScrollbar = document.createElement('div');
    bottomScrollbar.className = 'grid-bottom-scrollbar-strip';
    fixedHeader.appendChild(headerTable);
    host.append(fixedHeader, viewport, bottomScrollbar);

    viewport.scrollLeft = 96;
    fixedHeader.scrollLeft = 96;
    bottomScrollbar.scrollLeft = 96;
    fixedHeader.dataset['dgScrollLeft'] = '96';
    fixedHeader.style.setProperty('--dg-header-counter-scroll', '96px');
    headerTable.style.transform = 'translate3d(-96px, 0, 0)';
    host.style.setProperty('--dg-grid-scroll-left', '96px');
    host.style.setProperty('--dg-group-scroll-left', '96px');

    const columns = [{ field: 'name' }, { field: 'owner' }, { field: 'status' }];
    const ctx = {
      columns,
      config: { selectable: true },
      elementRef: { nativeElement: host },
      gridViewport: { nativeElement: viewport },
      fixedHeader: { nativeElement: fixedHeader },
      bottomScrollbarViewport: { nativeElement: bottomScrollbar },
      getColumnField(column: { field: string }) {
        return column.field;
      },
      findColumn(field: string) {
        return ctx.columns.find(column => column.field === field) ?? null;
      },
      applyPinnedOrdering() {
        applyPinnedOrderingHelper(ctx);
      },
      syncHeaderBodyWidths: vi.fn(),
      emitColumnsChange: vi.fn(),
      saveState: vi.fn(),
      stateKey: 'grid',
      cdr: { markForCheck: vi.fn() }
    };

    setColumnPinnedHelper(ctx, 'owner', 'left');

    expect(viewport.scrollLeft).toBe(0);
    expect(fixedHeader.scrollLeft).toBe(0);
    expect(bottomScrollbar.scrollLeft).toBe(0);
    expect(headerTable.style.transform).toBe('');
    expect(fixedHeader.dataset['dgScrollLeft']).toBeUndefined();
    expect(fixedHeader.style.getPropertyValue('--dg-header-counter-scroll')).toBe('');
    expect(host.style.getPropertyValue('--dg-grid-scroll-left')).toBe('0px');
    expect(host.style.getPropertyValue('--dg-group-scroll-left')).toBe('0px');
    expect(requestAnimationFrame).toHaveBeenCalled();
  });

  it('does not hide the column when a drag ends without a drop target', () => {
    const ctx = {
      draggingColumnField: 'owner',
      dropTargetColumnField: 'status',
      dropTargetColumnEdge: 'after',
      headerDropHandled: false,
      removeColumnFromView: vi.fn()
    };

    onHeaderDragEndHelper(ctx);

    expect(ctx.removeColumnFromView).not.toHaveBeenCalled();
    expect(ctx.draggingColumnField).toBeNull();
    expect(ctx.dropTargetColumnField).toBeNull();
    expect(ctx.dropTargetColumnEdge).toBeNull();
    expect(ctx.headerDropHandled).toBe(false);
  });

  it('applies grouping and grouped sort in a single grouped change pass', () => {
    const setGroups = vi.fn();
    const setExpandedGroups = vi.fn();
    const setGroupFilterTerms = vi.fn();
    const setSortStates = vi.fn();
    const emitChange = vi.fn();
    const markForCheck = vi.fn();
    const closeColumnContextMenu = vi.fn();
    const getFilteredSortedData = vi.fn(() => [{ status: 'Open' }]);

    const ctx = {
      groupColumns: Object.assign(
        vi.fn(() => ['owner']),
        {
          set: setGroups
        }
      ),
      sortStates: Object.assign(
        vi.fn(() => [
          { field: 'owner', direction: 'asc', order: 0 },
          { field: 'priority', direction: 'desc', order: 1 }
        ]),
        {
          set: setSortStates
        }
      ),
      groupExpansionAuto: { set: vi.fn() },
      resetGroupExpansion: vi.fn(),
      expandedGroups: { set: setExpandedGroups },
      groupFilterTerms: { set: setGroupFilterTerms },
      bumpAggregateCache: vi.fn(),
      cdr: { markForCheck },
      emitChange,
      closeColumnContextMenu,
      getColumnField: (column: { field: string }) => column.field,
      getFilteredSortedData,
      getRowFieldValue: (row: { status?: string }) => row.status,
      normalizeGroupKey: (value: unknown) => String(value),
      getAllGroupIds: () => [],
      displayRows: () => [],
      syncHeaderBodyWidths: vi.fn()
    };

    applyGroupingStateHelper(ctx, { field: 'status' }, 'desc');

    expect(setGroups).toHaveBeenCalledWith(['status']);
    expect(setExpandedGroups).toHaveBeenCalledWith(new Set());
    expect(getFilteredSortedData).not.toHaveBeenCalled();
    expect(setGroupFilterTerms).toHaveBeenCalledWith(new Map());
    expect(setSortStates).toHaveBeenCalledWith([
      { field: 'status', direction: 'desc', order: 0 },
      { field: 'priority', direction: 'desc', order: 1 }
    ]);
    expect(markForCheck).toHaveBeenCalledOnce();
    expect(emitChange).toHaveBeenCalledWith('group');
    expect(closeColumnContextMenu).toHaveBeenCalledOnce();
  });

  it('treats date interval changes as grouping structure changes', () => {
    const setGroups = vi.fn();
    const setDateIntervals = vi.fn();
    const setSortStates = vi.fn();
    const emitChange = vi.fn();

    const ctx = {
      groupColumns: Object.assign(
        vi.fn(() => ['deadline']),
        { set: setGroups }
      ),
      groupDateIntervals: Object.assign(
        vi.fn(() => ({ deadline: 'month' })),
        {
          set: setDateIntervals
        }
      ),
      sortStates: Object.assign(
        vi.fn(() => [{ field: 'deadline', direction: 'asc', order: 0 }]),
        { set: setSortStates }
      ),
      groupExpansionAuto: { set: vi.fn() },
      resetGroupExpansion: vi.fn(),
      expandedGroups: { set: vi.fn() },
      groupFilterTerms: { set: vi.fn() },
      bumpAggregateCache: vi.fn(),
      cdr: { markForCheck: vi.fn() },
      emitChange,
      closeColumnContextMenu: vi.fn(),
      getColumnField: (column: { field: string }) => column.field,
      resolveGridDateGroupInterval: vi.fn((_column, interval) => interval)
    };

    applyGroupingStateHelper(ctx, { field: 'deadline', type: 'date' }, 'asc', 'year');

    expect(setGroups).toHaveBeenCalledWith(['deadline']);
    expect(setDateIntervals).toHaveBeenCalledWith({ deadline: 'year' });
    expect(setSortStates).toHaveBeenCalledWith([{ field: 'deadline', direction: 'asc', order: 0 }]);
    expect(emitChange).toHaveBeenCalledWith('group');
  });

  it('suspends remote presentation while a structural grouping refresh is in flight', async () => {
    const pendingSet = vi.fn();
    const ctx = {
      config: { remoteData: true },
      loading: true,
      groupColumns: Object.assign(
        vi.fn(() => []),
        {
          set: vi.fn()
        }
      ),
      sortStates: Object.assign(
        vi.fn(() => []),
        {
          set: vi.fn()
        }
      ),
      groupExpansionAuto: { set: vi.fn() },
      resetGroupExpansion: vi.fn(),
      expandedGroups: { set: vi.fn() },
      groupFilterTerms: { set: vi.fn() },
      remoteDataStructureRefreshPending: { set: pendingSet },
      bumpAggregateCache: vi.fn(),
      cdr: { markForCheck: vi.fn() },
      emitChange: vi.fn(),
      getColumnField: (column: { field: string }) => column.field,
      closeColumnContextMenu: vi.fn(),
      syncHeaderBodyWidths: vi.fn()
    };

    applyGroupingStateHelper(ctx, { field: 'status' }, 'asc');
    await Promise.resolve();

    expect(pendingSet).toHaveBeenCalledWith(true);
    expect(pendingSet).not.toHaveBeenCalledWith(false);
  });

  it('keeps remote regroup presentation suspended past the same microtask when loading has not propagated yet', async () => {
    vi.useFakeTimers();
    let pending = false;
    const pendingSignal = Object.assign(
      vi.fn(() => pending),
      {
        set: vi.fn((value: boolean) => {
          pending = value;
        })
      }
    );
    const rows = [{ status: 'Open' }];
    const ctx = {
      config: { remoteData: true },
      loading: false,
      dataSignal: vi.fn(() => rows),
      remoteDataStructureRefreshToken: 0,
      remoteDataStructureRefreshPending: pendingSignal,
      groupColumns: Object.assign(
        vi.fn(() => []),
        {
          set: vi.fn()
        }
      ),
      sortStates: Object.assign(
        vi.fn(() => []),
        {
          set: vi.fn()
        }
      ),
      groupExpansionAuto: { set: vi.fn() },
      resetGroupExpansion: vi.fn(),
      expandedGroups: { set: vi.fn() },
      groupFilterTerms: { set: vi.fn() },
      bumpAggregateCache: vi.fn(),
      cdr: { markForCheck: vi.fn() },
      emitChange: vi.fn(),
      getColumnField: (column: { field: string }) => column.field,
      closeColumnContextMenu: vi.fn(),
      syncHeaderBodyWidths: vi.fn()
    };

    applyGroupingStateHelper(ctx, { field: 'status' }, 'asc');
    await Promise.resolve();

    expect(pendingSignal.set).toHaveBeenCalledWith(true);
    expect(pendingSignal.set).not.toHaveBeenCalledWith(false);

    vi.advanceTimersByTime(14_999);
    expect(pendingSignal.set).not.toHaveBeenCalledWith(false);

    vi.advanceTimersByTime(1);
    expect(pendingSignal.set).toHaveBeenLastCalledWith(false);
  });

  it('builds nested grouped rows without recursive context callbacks', () => {
    const ctx = {
      groupExpansionAuto: vi.fn(() => true),
      getGroupFilterTerm: vi.fn(() => ''),
      filterGroupRows: vi.fn((rows: unknown[]) => rows),
      shouldShowGroupFooterAggregates: vi.fn(() => false),
      buildGroupedRows: vi.fn(() => {
        throw new Error('unexpected recursive callback');
      })
    };

    const rows = [
      { team: 'A', status: 'Open', id: 1 },
      { team: 'A', status: 'Done', id: 2 },
      { team: 'B', status: 'Open', id: 3 }
    ];

    const result = buildGroupedRowsHelper(ctx, rows, ['team', 'status'], 0, 'root', new Set());

    expect(ctx.buildGroupedRows).not.toHaveBeenCalled();
    expect(result).toMatchObject([
      { kind: 'group', field: 'team', value: 'A', count: 2, expanded: true },
      { kind: 'group', field: 'status', value: 'Open', count: 1, expanded: true },
      { kind: 'data', data: { id: 1 } },
      { kind: 'group', field: 'status', value: 'Done', count: 1, expanded: true },
      { kind: 'data', data: { id: 2 } },
      { kind: 'group', field: 'team', value: 'B', count: 1, expanded: true },
      { kind: 'group', field: 'status', value: 'Open', count: 1, expanded: true },
      { kind: 'data', data: { id: 3 } }
    ]);
  });

  it('keeps heavy remote auto-grouping collapsed until the user expands explicitly', () => {
    const ctx = {
      config: { remoteData: true },
      groupColumns: vi.fn(() => ['team']),
      getFilteredSortedData: vi.fn(() =>
        Array.from({ length: 121 }, (_, index) => ({
          team: index < 80 ? 'A' : 'B',
          id: index + 1
        }))
      )
    };

    expect(
      isGroupExpandedByIdHelper(
        {
          ...ctx,
          groupExpansionAuto: vi.fn(() => true),
          expandedGroups: vi.fn(() => new Set()),
          shouldAutoExpandGroups: vi.fn(() => false)
        },
        'team:A'
      )
    ).toBe(false);

    const uncachedAutoExpand = vi.fn(() => {
      throw new Error('uncached auto-expand should not run when cached state exists');
    });
    const cachedAutoExpand = vi.fn(() => false);
    expect(
      isGroupExpandedByIdHelper(
        {
          ...ctx,
          groupExpansionAuto: vi.fn(() => true),
          expandedGroups: vi.fn(() => new Set()),
          shouldAutoExpandGroups: uncachedAutoExpand,
          shouldAutoExpandGroupsCached: cachedAutoExpand
        },
        'team:A'
      )
    ).toBe(false);
    expect(cachedAutoExpand).toHaveBeenCalledTimes(1);
    expect(uncachedAutoExpand).not.toHaveBeenCalled();

    const result = buildGroupedRowsHelper(
      {
        ...ctx,
        groupExpansionAuto: vi.fn(() => true),
        getGroupFilterTerm: vi.fn(() => ''),
        filterGroupRows: vi.fn((rows: unknown[]) => rows),
        shouldShowGroupFooterAggregates: vi.fn(() => false),
        shouldAutoExpandGroups: vi.fn(() => false)
      },
      Array.from({ length: 121 }, (_, index) => ({
        team: index < 80 ? 'A' : 'B',
        id: index + 1
      })),
      ['team'],
      0,
      'root',
      new Set()
    );

    expect(result).toMatchObject([
      { kind: 'group', field: 'team', value: 'A', expanded: false },
      { kind: 'group', field: 'team', value: 'B', expanded: false }
    ]);
    expect(result).toHaveLength(2);
  });

  it('groups date rows by the resolved date interval value', () => {
    const ctx = {
      groupExpansionAuto: vi.fn(() => true),
      getGroupFilterTerm: vi.fn(() => ''),
      filterGroupRows: vi.fn((rows: unknown[]) => rows),
      shouldShowGroupFooterAggregates: vi.fn(() => false),
      shouldAutoExpandGroups: vi.fn(() => true),
      resolveGroupValue: vi.fn((_field: string, raw: string) => {
        const month = raw.slice(0, 7);
        return { key: month, value: month };
      })
    };

    const result = buildGroupedRowsHelper(
      ctx,
      [
        { deadline: '2026-04-01', id: 1 },
        { deadline: '2026-04-20', id: 2 },
        { deadline: '2026-05-01', id: 3 }
      ],
      ['deadline'],
      0,
      'root',
      new Set()
    );

    expect(result).toMatchObject([
      { kind: 'group', field: 'deadline', value: '2026-04', count: 2 },
      { kind: 'data', data: { id: 1 } },
      { kind: 'data', data: { id: 2 } },
      { kind: 'group', field: 'deadline', value: '2026-05', count: 1 },
      { kind: 'data', data: { id: 3 } }
    ]);
  });

  it('expands single-column non-virtual groups using grouped block ids without scanning displayRows', () => {
    const expandedGroupsSet = vi.fn();
    const displayRows = vi.fn(() => {
      throw new Error('displayRows should not be materialized for single-column expansion');
    });
    const ctx = {
      config: { virtualScroll: false },
      groupColumns: vi.fn(() => ['status']),
      groupExpansionAuto: { set: vi.fn() },
      groupExpansionToken: 0,
      expandedGroups: { set: expandedGroupsSet },
      getFilteredSortedData: vi.fn(() => [
        { status: 'Open' },
        { status: 'Done' },
        { status: 'Open' },
        { status: null },
        { status: 'Ignored', __appendRow: true }
      ]),
      displayRows,
      getAllGroupIds: vi.fn(),
      emitChange: vi.fn(),
      closeGroupContextMenu: vi.fn()
    };

    expandAllGroupsHelper(ctx);

    expect(displayRows).not.toHaveBeenCalled();
    expect(expandedGroupsSet).toHaveBeenCalledWith(
      new Set(['status:Open', 'status:Done', 'status:-'])
    );
    expect(ctx.emitChange).toHaveBeenCalledWith('groupExpansion');
  });

  it('expands single-column groups from cached grouped blocks without scanning rows', () => {
    const expandedGroupsSet = vi.fn();
    const ctx = {
      config: { virtualScroll: false },
      groupColumns: vi.fn(() => ['status']),
      groupExpansionAuto: { set: vi.fn() },
      groupExpansionToken: 0,
      expandedGroups: { set: expandedGroupsSet },
      groupedBlocks: vi.fn(() => [{ id: 'status:Open' }, { id: 'status:Done' }]),
      getFilteredSortedData: vi.fn(() => {
        throw new Error('cached grouped blocks should provide expand-all ids');
      }),
      displayRows: vi.fn(() => {
        throw new Error('displayRows should not be materialized for single-column expansion');
      }),
      emitChange: vi.fn(),
      closeGroupContextMenu: vi.fn()
    };

    expandAllGroupsHelper(ctx);

    expect(ctx.getFilteredSortedData).not.toHaveBeenCalled();
    expect(ctx.displayRows).not.toHaveBeenCalled();
    expect(expandedGroupsSet).toHaveBeenCalledWith(new Set(['status:Open', 'status:Done']));
  });

  it('expands single-column virtual groups using grouped block ids', () => {
    const expandedGroupsSet = vi.fn();
    const ctx = {
      config: { virtualScroll: true },
      groupColumns: vi.fn(() => ['status']),
      groupExpansionAuto: { set: vi.fn() },
      groupExpansionToken: 0,
      expandedGroups: { set: expandedGroupsSet },
      getFilteredSortedData: vi.fn(() => [{ status: 'Open' }, { status: null }]),
      normalizeGroupKey: (value: unknown) => String(value).trim() || 'empty',
      getAllGroupIds: vi.fn(),
      displayRows: vi.fn(),
      emitChange: vi.fn(),
      closeGroupContextMenu: vi.fn()
    };

    expandAllGroupsHelper(ctx);

    expect(ctx.displayRows).not.toHaveBeenCalled();
    expect(expandedGroupsSet).toHaveBeenCalledWith(new Set(['status:Open', 'status:-']));
  });

  it('expands multi-column groups without materializing display rows', () => {
    const expandedGroupsSet = vi.fn();
    const displayRows = vi.fn(() => {
      throw new Error('multi-column expansion should collect group ids without display rows');
    });
    const processedData = vi.fn(() => {
      throw new Error('multi-column expansion should use row buckets when available');
    });
    const ctx = {
      config: { virtualScroll: false },
      groupColumns: vi.fn(() => ['team', 'status']),
      groupExpansionAuto: { set: vi.fn() },
      groupExpansionToken: 0,
      expandedGroups: { set: expandedGroupsSet },
      filteredSortedRowBuckets: vi.fn(() => ({
        dataRows: [
          { team: 'A', status: 'Open', id: 1 },
          { team: 'A', status: 'Done', id: 2 },
          { team: 'B', status: 'Open', id: 3 }
        ],
        appendRows: [{ team: 'Ignored', status: 'Open', __appendRow: true }]
      })),
      processedData,
      displayRows,
      getAllGroupIds: vi.fn(),
      emitChange: vi.fn(),
      closeGroupContextMenu: vi.fn()
    };

    expandAllGroupsHelper(ctx);

    expect(displayRows).not.toHaveBeenCalled();
    expect(processedData).not.toHaveBeenCalled();
    expect(ctx.getAllGroupIds).not.toHaveBeenCalled();
    expect(expandedGroupsSet).toHaveBeenCalledWith(
      new Set([
        'root|team:A-0',
        'root|team:A-0|status:Open-0',
        'root|team:A-0|status:Done-1',
        'root|team:B-1',
        'root|team:B-1|status:Open-0'
      ])
    );
    expect(ctx.emitChange).toHaveBeenCalledWith('groupExpansion');
  });

  it('skips no-op group expansion updates to avoid redundant refresh and save', () => {
    const groupExpansionAutoSet = vi.fn();
    const expandedGroupsSet = vi.fn();
    const emitChange = vi.fn();
    const closeGroupContextMenu = vi.fn();
    const ctx = {
      config: {},
      groupExpansionAuto: Object.assign(
        vi.fn(() => false),
        { set: groupExpansionAutoSet }
      ),
      expandedGroups: Object.assign(
        vi.fn(() => new Set<string>()),
        { set: expandedGroupsSet }
      ),
      emitChange,
      closeGroupContextMenu
    };

    collapseAllGroupsHelper(ctx);

    expect(groupExpansionAutoSet).not.toHaveBeenCalled();
    expect(expandedGroupsSet).not.toHaveBeenCalled();
    expect(emitChange).not.toHaveBeenCalled();
    expect(closeGroupContextMenu).toHaveBeenCalledOnce();
  });

  it('caches total percent aggregate stats per field across repeated group calculations', () => {
    const normalizeNumericValue = vi.fn((value: unknown) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    });
    const ctx = {
      aggregateCacheToken: 7,
      percentAggregateTotalsCache: new Map(),
      getColumnField: (column: { field: string }) => column.field,
      normalizeNumericValue,
      isEmptyValue: (value: unknown) => value === null || value === undefined || value === ''
    };
    const totalRows = [{ amount: 10 }, { amount: 20 }, { amount: null }];

    const first = getPercentAggregateHelper(ctx, [{ amount: 10 }, { amount: null }], totalRows, {
      field: 'amount'
    });
    const second = getPercentAggregateHelper(ctx, [{ amount: 20 }], totalRows, {
      field: 'amount'
    });

    expect(first).toBeCloseTo(33.3333, 3);
    expect(second).toBeCloseTo(66.6667, 3);
    expect(normalizeNumericValue).toHaveBeenCalledTimes(6);
    expect(ctx.percentAggregateTotalsCache.size).toBe(1);
  });

  it('applies external filters and emits a filter change event', () => {
    const nextStates: Array<Record<string, unknown>> = [];
    const filterStates = Object.assign(vi.fn(() => nextStates), {
      set: vi.fn((filters: Array<Record<string, unknown>>) => {
        nextStates.splice(0, nextStates.length, ...filters);
      })
    });
    const ctx = {
      filterStates,
      filteredDataCount: vi.fn(() => 12),
      updatePaginationState: vi.fn(),
      emitChange: vi.fn()
    };

    applyExternalFiltersHelper(ctx, [
      { field: 'status', operator: 'equals', value: 'Active', joinWithPrev: 'and' },
      { field: 'owner', operator: 'isEmpty', value: 'ignored', joinWithPrev: 'or' },
      { field: '   ', operator: 'contains', value: 'skip' }
    ]);

    expect(ctx.filterStates.set).toHaveBeenCalledOnce();
    expect(nextStates).toEqual([
      { field: 'status', operator: 'equals', value: 'Active', joinWithPrev: 'and' },
      { field: 'owner', operator: 'isEmpty', value: '', joinWithPrev: 'or' }
    ]);
    expect(ctx.updatePaginationState).toHaveBeenCalledWith(12);
    expect(ctx.emitChange).toHaveBeenCalledWith('filter');
  });

  it('skips external filter changes when the normalized state is unchanged', () => {
    const existingStates = [
      { field: 'status', operator: 'equals', value: 'Active', joinWithPrev: 'and' }
    ];
    const filterStates = Object.assign(vi.fn(() => existingStates), {
      set: vi.fn()
    });
    const ctx = {
      filterStates,
      filteredDataCount: vi.fn(() => 12),
      updatePaginationState: vi.fn(),
      emitChange: vi.fn()
    };

    applyExternalFiltersHelper(ctx, [
      { field: 'status', operator: 'equals', value: 'Active', joinWithPrev: 'and' }
    ]);

    expect(filterStates.set).not.toHaveBeenCalled();
    expect(ctx.updatePaginationState).not.toHaveBeenCalled();
    expect(ctx.emitChange).not.toHaveBeenCalled();
  });

  it('clears filter state, quick filters, and global search together', () => {
    const filters = [{ field: 'status', operator: 'equals', value: 'Active' }];
    const quickFilters = new Map([['owner', 'Ahmed']]);
    const filterStates = Object.assign(vi.fn(() => filters), {
      set: vi.fn()
    });
    const quickFilterValues = Object.assign(vi.fn(() => quickFilters), {
      set: vi.fn()
    });
    const ctx = {
      filterStates,
      quickFilterValues,
      globalSearchTerm: 'alpha',
      filteredDataCount: vi.fn(() => 5),
      updatePaginationState: vi.fn(),
      emitChange: vi.fn()
    };

    clearAllFiltersHelper(ctx);

    expect(filterStates.set).toHaveBeenCalledWith([]);
    expect(quickFilterValues.set).toHaveBeenCalledWith(new Map());
    expect(ctx.globalSearchTerm).toBe('');
    expect(ctx.updatePaginationState).toHaveBeenCalledWith(5);
    expect(ctx.emitChange).toHaveBeenCalledWith('filter');
  });

  it('uses current processed rows for viewport autosize mode', () => {
    const measureText = vi.fn((text: string) => ({ width: text.length * 8 }));
    const measureCtx = { font: '', measureText };

    const ctx = {
      ensureMeasureContext: () => measureCtx,
      getTableFont: () => '12px Test Sans',
      getColumnField: (column: { field: string }) => column.field,
      getCellTitle: (row: { name: string }) => row.name,
      getCellValue: (row: { name: string }) => row.name,
      processedData: () => [{ name: 'Very Long Visible Value' }],
      getFilteredSortedData: () => [{ name: 'Tiny' }],
      getMinimumColumnWidth: () => 100,
      getMaximumColumnWidth: () => 400
    };

    const viewportWidth = calculateAutoWidthHelper(
      ctx,
      { field: 'name', header: 'Name' },
      { mode: 'viewport' }
    ) as number;
    const filteredWidth = calculateAutoWidthHelper(
      ctx,
      { field: 'name', header: 'Name' },
      { mode: 'filtered' }
    ) as number;

    expect(viewportWidth).toBeGreaterThan(filteredWidth);
  });

  it('applies type-aware minimum and maximum width presets', () => {
    const measureCtx = {
      font: '',
      measureText: vi.fn(() => ({ width: 54 }))
    };

    const ctx = {
      ensureMeasureContext: () => measureCtx,
      getTableFont: () => '12px Test Sans'
    };

    expect(
      getMinimumColumnWidthHelper(ctx, { field: 'deadline', header: 'Deadline', type: 'date' })
    ).toBeGreaterThanOrEqual(104);
    expect(
      getMaximumColumnWidthHelper(ctx, { field: 'deadline', header: 'Deadline', type: 'date' })
    ).toBe(240);
    expect(
      getMaximumColumnWidthHelper(ctx, { field: 'projectTitle', header: 'Project Title' })
    ).toBe(760);
  });

  it('keeps flexible columns at their computed widths and leaves the remaining shell area empty', () => {
    const rafCallbacks: FrameRequestCallback[] = [];
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        rafCallbacks.push(callback);
        return rafCallbacks.length;
      })
    );

    const root = document.createElement('div');
    root.innerHTML = `
      <div class="table-scroll"></div>
      <table class="header-table">
        <colgroup>
          <col />
          <col />
          <col />
        </colgroup>
      </table>
      <table class="data-grid-table">
        <colgroup>
          <col />
          <col />
          <col />
        </colgroup>
      </table>
      <table class="grid-calculate-footer__table">
        <colgroup>
          <col />
          <col />
          <col />
        </colgroup>
      </table>
    `;

    const viewport = root.querySelector('.table-scroll') as HTMLElement;
    const headerTable = root.querySelector('.header-table') as HTMLElement;
    const bodyTable = root.querySelector('.data-grid-table') as HTMLElement;
    const footerTable = root.querySelector('.grid-calculate-footer__table') as HTMLElement;

    Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 500 });
    Object.defineProperty(root, 'clientWidth', { configurable: true, value: 500 });

    const firstColumn = { field: 'name' };
    const secondColumn = { field: 'owner' };

    const ctx = {
      config: {
        selectable: true
      },
      elementRef: { nativeElement: root },
      gridViewport: { nativeElement: viewport },
      headerBodyWidthSyncRAF: null,
      visibleColumns: () => [firstColumn, secondColumn],
      getSelectionColumnWidth: () => 44,
      getColumnPixelWidth: (column: { field: string }) => (column.field === 'name' ? 120 : 180),
      queueDefaultGridOverflowSync: vi.fn()
    };

    syncHeaderBodyWidthsHelper(ctx);

    const scheduledFrame = rafCallbacks[0];
    if (typeof scheduledFrame !== 'function') {
      throw new Error('requestAnimationFrame callback was not scheduled');
    }
    scheduledFrame(0);

    const headerCols = Array.from(headerTable.querySelectorAll('col')) as HTMLElement[];
    const bodyCols = Array.from(bodyTable.querySelectorAll('col')) as HTMLElement[];
    const footerCols = Array.from(footerTable.querySelectorAll('col')) as HTMLElement[];

    expect(root.style.getPropertyValue('--dg-grid-content-width')).toBe('344px');
    expect(root.style.getPropertyValue('--dg-grid-table-width')).toBe('344px');
    expect(headerCols.map(col => col.style.width)).toEqual(['44px', '120px', '180px']);
    expect(bodyCols.map(col => col.style.width)).toEqual(['44px', '120px', '180px']);
    expect(footerCols.map(col => col.style.width)).toEqual(['44px', '120px', '180px']);
  });

  it('keeps unsized columns at their measured widths even when auto-size is enabled', () => {
    const rafCallbacks: Array<(time: number) => void> = [];
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: (time: number) => void) => {
        rafCallbacks.push(callback);
        return 1;
      })
    );

    const root = document.createElement('div');
    root.innerHTML = `
      <div class="table-scroll"></div>
      <table class="header-table">
        <colgroup>
          <col />
          <col />
          <col />
        </colgroup>
      </table>
      <table class="data-grid-table">
        <colgroup>
          <col />
          <col />
          <col />
        </colgroup>
      </table>
      <table class="grid-calculate-footer__table">
        <colgroup>
          <col />
          <col />
          <col />
        </colgroup>
      </table>
    `;

    const viewport = root.querySelector('.table-scroll') as HTMLElement;
    const headerTable = root.querySelector('.header-table') as HTMLElement;
    const bodyTable = root.querySelector('.data-grid-table') as HTMLElement;
    const footerTable = root.querySelector('.grid-calculate-footer__table') as HTMLElement;

    Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 500 });
    Object.defineProperty(root, 'clientWidth', { configurable: true, value: 500 });

    const firstColumn = { field: 'name' };
    const secondColumn = { field: 'owner' };

    const ctx = {
      config: {
        selectable: true,
        autoSizeColumns: true
      },
      elementRef: { nativeElement: root },
      gridViewport: { nativeElement: viewport },
      headerBodyWidthSyncRAF: null,
      visibleColumns: () => [firstColumn, secondColumn],
      getSelectionColumnWidth: () => 44,
      getColumnPixelWidth: (column: { field: string }) => (column.field === 'name' ? 120 : 180),
      queueDefaultGridOverflowSync: vi.fn()
    };

    syncHeaderBodyWidthsHelper(ctx);

    const scheduledFrame = rafCallbacks[0];
    if (typeof scheduledFrame !== 'function') {
      throw new Error('requestAnimationFrame callback was not scheduled');
    }
    scheduledFrame(0);

    const headerCols = Array.from(headerTable.querySelectorAll('col')) as HTMLElement[];
    const bodyCols = Array.from(bodyTable.querySelectorAll('col')) as HTMLElement[];
    const footerCols = Array.from(footerTable.querySelectorAll('col')) as HTMLElement[];

    expect(root.style.getPropertyValue('--dg-grid-content-width')).toBe('344px');
    expect(root.style.getPropertyValue('--dg-grid-table-width')).toBe('344px');
    expect(headerCols.map(col => col.style.width)).toEqual(['44px', '120px', '180px']);
    expect(bodyCols.map(col => col.style.width)).toEqual(['44px', '120px', '180px']);
    expect(footerCols.map(col => col.style.width)).toEqual(['44px', '120px', '180px']);
  });

  it('keeps explicit data columns and structural columns fixed instead of stretching to the viewport', () => {
    const rafCallbacks: Array<(time: number) => void> = [];
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: (time: number) => void) => {
        rafCallbacks.push(callback);
        return 1;
      })
    );

    const root = document.createElement('div');
    root.innerHTML = `
      <div class="table-scroll"></div>
      <table class="header-table">
        <colgroup>
          <col />
          <col />
          <col />
        </colgroup>
      </table>
      <table class="data-grid-table">
        <colgroup>
          <col />
          <col />
          <col />
        </colgroup>
      </table>
    `;

    const viewport = root.querySelector('.table-scroll') as HTMLElement;
    const headerTable = root.querySelector('.header-table') as HTMLElement;
    const bodyTable = root.querySelector('.data-grid-table') as HTMLElement;

    Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 500 });
    Object.defineProperty(root, 'clientWidth', { configurable: true, value: 500 });

    const firstColumn = { field: 'name', width: 120 };
    const secondColumn = { field: 'owner', width: 180 };

    const ctx = {
      config: {
        selectable: true
      },
      elementRef: { nativeElement: root },
      gridViewport: { nativeElement: viewport },
      headerBodyWidthSyncRAF: null,
      visibleColumns: () => [firstColumn, secondColumn],
      getSelectionColumnWidth: () => 44,
      getColumnPixelWidth: (column: { field: string }) => (column.field === 'name' ? 120 : 180),
      queueDefaultGridOverflowSync: vi.fn()
    };

    syncHeaderBodyWidthsHelper(ctx);

    const scheduledFrame = rafCallbacks[0];
    if (typeof scheduledFrame !== 'function') {
      throw new Error('requestAnimationFrame callback was not scheduled');
    }
    scheduledFrame(0);

    const headerCols = Array.from(headerTable.querySelectorAll('col')) as HTMLElement[];
    const bodyCols = Array.from(bodyTable.querySelectorAll('col')) as HTMLElement[];

    expect(root.style.getPropertyValue('--dg-grid-content-width')).toBe('344px');
    expect(root.style.getPropertyValue('--dg-grid-table-width')).toBe('344px');
    expect(headerTable.style.width).toBe('344px');
    expect(bodyTable.style.width).toBe('344px');
    expect(headerCols.map(col => col.style.width)).toEqual(['44px', '120px', '180px']);
    expect(bodyCols.map(col => col.style.width)).toEqual(['44px', '120px', '180px']);
  });

  it('keeps fill-remaining columns on their explicit width and leaves the remaining shell area empty', () => {
    const rafCallbacks: Array<(time: number) => void> = [];
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: (time: number) => void) => {
        rafCallbacks.push(callback);
        return 1;
      })
    );

    const root = document.createElement('div');
    root.innerHTML = `
      <div class="table-scroll"></div>
      <table class="header-table">
        <colgroup>
          <col />
          <col />
          <col />
        </colgroup>
      </table>
      <table class="data-grid-table">
        <colgroup>
          <col />
          <col />
          <col />
        </colgroup>
      </table>
    `;

    const viewport = root.querySelector('.table-scroll') as HTMLElement;
    const headerTable = root.querySelector('.header-table') as HTMLElement;
    const bodyTable = root.querySelector('.data-grid-table') as HTMLElement;

    Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 500 });
    Object.defineProperty(root, 'clientWidth', { configurable: true, value: 500 });

    const firstColumn = { field: 'name', width: 120, fillRemaining: true };
    const secondColumn = { field: 'owner', width: 180 };

    const ctx = {
      config: {
        selectable: true
      },
      elementRef: { nativeElement: root },
      gridViewport: { nativeElement: viewport },
      headerBodyWidthSyncRAF: null,
      visibleColumns: () => [firstColumn, secondColumn],
      getSelectionColumnWidth: () => 44,
      getColumnPixelWidth: (column: { field: string }) => (column.field === 'name' ? 120 : 180),
      queueDefaultGridOverflowSync: vi.fn()
    };

    syncHeaderBodyWidthsHelper(ctx);

    const scheduledFrame = rafCallbacks[0];
    if (typeof scheduledFrame !== 'function') {
      throw new Error('requestAnimationFrame callback was not scheduled');
    }
    scheduledFrame(0);

    const headerCols = Array.from(headerTable.querySelectorAll('col')) as HTMLElement[];
    const bodyCols = Array.from(bodyTable.querySelectorAll('col')) as HTMLElement[];

    expect(root.style.getPropertyValue('--dg-grid-content-width')).toBe('344px');
    expect(root.style.getPropertyValue('--dg-grid-table-width')).toBe('344px');
    expect(headerCols.map(col => col.style.width)).toEqual(['44px', '120px', '180px']);
    expect(bodyCols.map(col => col.style.width)).toEqual(['44px', '120px', '180px']);
  });

  it('freezes fill-remaining columns to their current rendered width before resizing another column', () => {
    const addEventListener = vi.spyOn(document, 'addEventListener');
    const fillColumn = { field: 'name', width: 420, fillRemaining: true };
    const targetColumn = { field: 'industry', width: 170 };
    const event = {
      target: {
        closest: () => ({
          getBoundingClientRect: () => ({ width: 170 })
        })
      },
      clientX: 320,
      stopPropagation: vi.fn(),
      preventDefault: vi.fn()
    };

    const ctx = {
      visibleColumns: () => [fillColumn, targetColumn],
      getColumnField: (candidate: { field: string }) => candidate.field,
      getRenderedColumnWidth: (candidate: { field: string }) =>
        candidate.field === 'name' ? 603 : 170,
      getColumnPixelWidth: (candidate: { field: string }) =>
        candidate.field === 'name' ? 420 : 170,
      getMinimumColumnWidth: () => 120,
      getMaximumColumnWidth: () => 360,
      columnAutoWidthCache: new Map<string, number>(),
      resizingColumnField: null as string | null,
      resizeStartWidth: 0,
      handleColumnResizeMove: vi.fn(),
      handleColumnResizeUp: vi.fn()
    };

    onColumnResizeStartHelper(ctx, event, targetColumn);

    expect(fillColumn.width).toBe(603);
    expect(ctx.columnAutoWidthCache.get('name')).toBe(603);
    expect(ctx.columnAutoWidthCache.get('industry')).toBe(170);
    expect(ctx.resizingColumnField).toBe('industry');
    expect(ctx.resizeStartWidth).toBe(170);
    expect(addEventListener).toHaveBeenCalledWith('mousemove', ctx.handleColumnResizeMove);
    expect(addEventListener).toHaveBeenCalledWith('mouseup', ctx.handleColumnResizeUp);
  });

  it('freezes the active fill-remaining column to its rendered width before manual resize', () => {
    const addEventListener = vi.spyOn(document, 'addEventListener');
    const fillColumn = { field: 'name', width: 420, fillRemaining: true };
    const secondaryColumn = { field: 'industry', width: 170 };
    const event = {
      target: {
        closest: () => ({
          getBoundingClientRect: () => ({ width: 603 })
        })
      },
      clientX: 640,
      stopPropagation: vi.fn(),
      preventDefault: vi.fn()
    };

    const ctx = {
      visibleColumns: () => [fillColumn, secondaryColumn],
      getColumnField: (candidate: { field: string }) => candidate.field,
      getRenderedColumnWidth: (candidate: { field: string }) =>
        candidate.field === 'name' ? 603 : 170,
      getColumnPixelWidth: (candidate: { field: string }) =>
        candidate.field === 'name' ? 420 : 170,
      getMinimumColumnWidth: () => 120,
      getMaximumColumnWidth: () => 720,
      columnAutoWidthCache: new Map<string, number>(),
      resizingColumnField: null as string | null,
      resizeStartWidth: 0,
      handleColumnResizeMove: vi.fn(),
      handleColumnResizeUp: vi.fn()
    };

    onColumnResizeStartHelper(ctx, event, fillColumn);

    expect(fillColumn.width).toBe(603);
    expect(fillColumn.fillRemaining).toBe(true);
    expect(ctx.columnAutoWidthCache.get('name')).toBe(603);
    expect(ctx.columnAutoWidthCache.get('industry')).toBe(170);
    expect(ctx.resizingColumnField).toBe('name');
    expect(ctx.resizeStartWidth).toBe(603);
    expect(addEventListener).toHaveBeenCalledWith('mousemove', ctx.handleColumnResizeMove);
    expect(addEventListener).toHaveBeenCalledWith('mouseup', ctx.handleColumnResizeUp);
  });

  it('falls back to the current DOM header when the view child reference is stale', () => {
    const liveHeaderTable = {
      style: {
        transform: ''
      }
    } as unknown as HTMLElement;

    const gridContainer = {
      classList: createClassList('grid-container')
    } as unknown as HTMLElement;

    const liveHeader = {
      isConnected: true,
      scrollLeft: 0,
      dataset: {},
      style: {
        setProperty: vi.fn(),
        removeProperty: vi.fn()
      },
      querySelector(selector: string) {
        return selector === '.header-table' ? liveHeaderTable : null;
      },
      closest(selector: string) {
        return selector === '.engineers-salary-reference-data-grid' ? host : null;
      }
    } as unknown as HTMLElement;

    const staleHeader = {
      isConnected: false,
      scrollLeft: 0
    } as HTMLElement;

    const viewport = {
      isConnected: true,
      classList: createClassList('table-scroll'),
      scrollLeft: 260
    } as HTMLElement;

    const host = {
      classList: createClassList(),
      getAttribute: createAttributeGetter({
        'data-grid-layout-preset': 'default'
      }),
      ownerDocument: {
        body: {
          classList: createClassList()
        }
      },
      querySelector(selector: string) {
        if (selector === '.grid-container') return gridContainer;
        if (selector === '.fixed-table-header') {
          return liveHeader;
        }
        if (selector === '.table-scroll, .virtual-scroll-viewport') return viewport;
        return null;
      }
    } as HTMLElement;

    const ctx = {
      config: {
        selectable: true,
        pinSelectionColumn: true
      },
      elementRef: { nativeElement: host },
      fixedHeader: { nativeElement: staleHeader },
      gridViewport: { nativeElement: viewport },
      lastDefaultGridBodyScrollLeft: null,
      headerScrollSyncRAF: null,
      pendingHeaderScrollLeft: null,
      suspendHoverUntilTs: undefined
    };

    onGridContainerScrollHelper(ctx, { target: viewport, type: 'scroll' });

    expect(liveHeader.scrollLeft).toBe(0);
    expect(liveHeader.dataset['dgScrollLeft']).toBe('260');
    expect(liveHeaderTable.style.transform).toBe('translate3d(-260px, 0, 0)');
    expect(staleHeader.scrollLeft).toBe(0);
    expect(ctx.pendingHeaderScrollLeft).toBeNull();
    expect(ctx.headerScrollSyncRAF).toBeNull();
    expect(ctx.suspendHoverUntilTs).toBeUndefined();
  });

  it('avoids extra DOM lookups on no-op Default-grid scroll ticks', () => {
    const headerTable = {
      style: {
        transform: 'translate3d(-72px, 0, 0)'
      }
    } as unknown as HTMLElement;

    const viewport = {
      isConnected: true,
      classList: createClassList('table-scroll'),
      scrollLeft: 72
    } as HTMLElement;

    let gridContainerLookups = 0;
    const host = {
      classList: createClassList(),
      getAttribute: createAttributeGetter({
        'data-grid-layout-preset': 'default'
      }),
      ownerDocument: {
        body: {
          classList: createClassList()
        }
      },
      querySelector(selector: string) {
        if (selector === '.grid-container') {
          gridContainerLookups += 1;
          return null;
        }
        return null;
      }
    } as HTMLElement;

    const fixedHeader = {
      isConnected: true,
      scrollLeft: 0,
      dataset: {
        dgScrollLeft: '72'
      },
      style: {
        setProperty: vi.fn(),
        removeProperty: vi.fn()
      },
      querySelector(selector: string) {
        return selector === '.header-table' ? headerTable : null;
      },
      closest(selector: string) {
        return selector === '.engineers-salary-reference-data-grid' ? host : null;
      }
    } as unknown as HTMLElement;

    const ctx = {
      config: {
        selectable: true,
        pinSelectionColumn: true
      },
      elementRef: { nativeElement: host },
      fixedHeader: { nativeElement: fixedHeader },
      gridViewport: { nativeElement: viewport },
      lastDefaultGridBodyScrollLeft: 72,
      headerScrollSyncRAF: null,
      pendingHeaderScrollLeft: null,
      suspendHoverUntilTs: undefined
    };

    onGridContainerScrollHelper(ctx, { target: viewport, type: 'scroll' });

    expect(gridContainerLookups).toBe(0);
    expect(headerTable.style.transform).toBe('translate3d(-72px, 0, 0)');
  });

  it('moves Default-grid overflow geometry into DataGrid host styles', () => {
    const viewport = {
      isConnected: true,
      classList: createClassList('table-scroll'),
      clientWidth: 200,
      offsetWidth: 212,
      clientHeight: 120,
      scrollHeight: 420,
      scrollLeft: 0
    } as unknown as HTMLElement;

    const hostStyle = createStyleStore();
    hostStyle.setProperty('--dg-grid-table-width', '500px');
    const host = {
      classList: createClassList(),
      getAttribute: createAttributeGetter({
        'data-grid-layout-preset': 'default'
      }),
      style: hostStyle,
      querySelector(selector: string) {
        if (selector === '.table-scroll, .virtual-scroll-viewport') {
          return viewport;
        }
        if (selector === '.data-grid-table') {
          return { isConnected: true } as HTMLElement;
        }
        return null;
      }
    } as unknown as HTMLElement;

    const ctx = {
      config: {
        selectable: true,
        pinSelectionColumn: true
      },
      elementRef: { nativeElement: host },
      gridViewport: { nativeElement: viewport },
      getTotalTableWidth: () => 440
    };

    syncDefaultGridOverflowHelper(ctx);

    expect(hostStyle.getPropertyValue('--dg-grid-table-width')).toBe('500px');
    expect(hostStyle.getPropertyValue('--dg-vscrollbar-comp')).toBe('12px');
    expect(host.classList.contains('has-x-scroll')).toBe(true);
  });

  it('applies overflow metrics for any shared default-grid grid context', () => {
    const viewport = {
      isConnected: true,
      classList: createClassList('table-scroll'),
      clientWidth: 200,
      offsetWidth: 212,
      clientHeight: 120,
      scrollHeight: 420,
      scrollLeft: 0
    } as unknown as HTMLElement;

    const hostStyle = createStyleStore();
    hostStyle.setProperty('--dg-grid-table-width', '440px');
    const host = {
      classList: createClassList(),
      getAttribute: createAttributeGetter({
        'data-grid-layout-preset': 'default'
      }),
      style: hostStyle,
      querySelector(selector: string) {
        if (selector === '.table-scroll, .virtual-scroll-viewport') {
          return viewport;
        }
        return null;
      }
    } as unknown as HTMLElement;

    const ctx = {
      config: {},
      elementRef: { nativeElement: host },
      gridViewport: { nativeElement: viewport },
      getTotalTableWidth: () => 440
    };

    syncDefaultGridOverflowHelper(ctx);

    expect(hostStyle.getPropertyValue('--dg-grid-table-width')).toBe('440px');
    expect(hostStyle.getPropertyValue('--dg-vscrollbar-comp')).toBe('12px');
    expect(host.classList.contains('has-x-scroll')).toBe(true);
  });

  it('predicts Default-grid horizontal overflow before the deferred layout sync runs', () => {
    const host = {
      clientWidth: 320,
      classList: createClassList(),
      getAttribute: createAttributeGetter({
        'data-grid-layout-preset': 'default'
      }),
      style: createStyleStore(),
      querySelector: vi.fn(() => null)
    } as unknown as HTMLElement;
    const ctx = {
      elementRef: { nativeElement: host },
      getTotalTableWidth: () => 640
    };

    queueDefaultGridOverflowSyncHelper(ctx);

    expect(host.classList.contains('has-x-scroll')).toBe(true);
  });

  it('defers Default-grid overflow measurement until the app shell transition settles', () => {
    let shellTransitioning = true;
    const rafCallbacks: FrameRequestCallback[] = [];
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        rafCallbacks.push(callback);
        return rafCallbacks.length;
      })
    );

    const getTotalTableWidth = vi.fn(() => 640);
    const host = {
      clientWidth: 320,
      classList: createClassList(),
      closest: vi.fn(() => (shellTransitioning ? {} : null)),
      getAttribute: createAttributeGetter({
        'data-grid-layout-preset': 'default'
      }),
      style: createStyleStore(),
      querySelector: vi.fn(() => null)
    } as unknown as HTMLElement;
    const ctx = {
      elementRef: { nativeElement: host },
      defaultGridOverflowRaf: null,
      getTotalTableWidth
    };

    queueDefaultGridOverflowSyncHelper(ctx);

    expect(getTotalTableWidth).not.toHaveBeenCalled();
    rafCallbacks.shift()?.(0);
    expect(getTotalTableWidth).not.toHaveBeenCalled();
    expect(rafCallbacks).toHaveLength(1);

    shellTransitioning = false;
    rafCallbacks.shift()?.(16);
    expect(getTotalTableWidth).toHaveBeenCalled();
  });

  it('defers Salary Reports overflow measurement until shell motion settles', () => {
    let shellTransitioning = true;
    const rafCallbacks: FrameRequestCallback[] = [];
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        rafCallbacks.push(callback);
        return rafCallbacks.length;
      })
    );

    const getTotalTableWidth = vi.fn(() => 640);
    const host = {
      clientWidth: 320,
      classList: createClassList(),
      closest: vi.fn(() => (shellTransitioning ? {} : null)),
      ownerDocument: {
        body: { classList: createClassList('salary-reports-page') }
      },
      getAttribute: createAttributeGetter({
        'data-grid-layout-preset': 'default'
      }),
      style: createStyleStore(),
      querySelector: vi.fn(() => null)
    } as unknown as HTMLElement;
    const ctx = {
      elementRef: { nativeElement: host },
      defaultGridOverflowRaf: null,
      getTotalTableWidth
    };

    queueDefaultGridOverflowSyncHelper(ctx);

    expect(getTotalTableWidth).not.toHaveBeenCalled();
    rafCallbacks.shift()?.(0);
    expect(getTotalTableWidth).not.toHaveBeenCalled();
    expect(rafCallbacks).toHaveLength(1);

    shellTransitioning = false;
    rafCallbacks.shift()?.(16);
    expect(getTotalTableWidth).toHaveBeenCalledTimes(1);
  });

  it('observes only the host and viewport for Default-grid overflow sync', () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    const ResizeObserverMock = vi.fn(function (this: {
      observe: typeof observe;
      disconnect: typeof disconnect;
    }) {
      this.observe = observe;
      this.disconnect = disconnect;
    });

    vi.stubGlobal('ResizeObserver', ResizeObserverMock as unknown as typeof ResizeObserver);

    const viewport = {
      isConnected: true,
      classList: createClassList('table-scroll'),
      clientWidth: 320,
      offsetWidth: 328,
      clientHeight: 180,
      scrollHeight: 420,
      scrollLeft: 0
    } as unknown as HTMLElement;

    const table = {
      isConnected: true
    } as unknown as HTMLElement;

    const host = {
      classList: createClassList(),
      getAttribute: createAttributeGetter({
        'data-grid-layout-preset': 'default'
      }),
      style: createStyleStore(),
      querySelector(selector: string) {
        if (selector === '.table-scroll, .virtual-scroll-viewport') {
          return viewport;
        }
        if (selector === '.data-grid-table') {
          return table;
        }
        return null;
      }
    } as unknown as HTMLElement;

    const ctx = {
      elementRef: { nativeElement: host },
      gridViewport: { nativeElement: viewport },
      defaultGridOverflowObserver: null,
      defaultGridOverflowRaf: null,
      getTotalTableWidth: () => 400
    };

    setupDefaultGridOverflowObserverHelper(ctx);

    expect(observe).toHaveBeenCalledWith(viewport);
    expect(observe).toHaveBeenCalledWith(host);
    expect(observe).not.toHaveBeenCalledWith(table);
  });

  it('attaches overflow observers for any shared default-grid grid context', () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    const ResizeObserverMock = vi.fn(function (this: {
      observe: typeof observe;
      disconnect: typeof disconnect;
    }) {
      this.observe = observe;
      this.disconnect = disconnect;
    });

    vi.stubGlobal('ResizeObserver', ResizeObserverMock as unknown as typeof ResizeObserver);

    const viewport = {
      isConnected: true,
      classList: createClassList('table-scroll')
    } as unknown as HTMLElement;

    const host = {
      classList: createClassList(),
      getAttribute: createAttributeGetter({
        'data-grid-layout-preset': 'default'
      }),
      style: createStyleStore(),
      querySelector(selector: string) {
        if (selector === '.table-scroll, .virtual-scroll-viewport') {
          return viewport;
        }
        return null;
      }
    } as unknown as HTMLElement;

    const ctx = {
      config: {},
      elementRef: { nativeElement: host },
      gridViewport: { nativeElement: viewport },
      defaultGridOverflowObserver: null,
      defaultGridOverflowRaf: null
    };

    setupDefaultGridOverflowObserverHelper(ctx);

    expect(observe).toHaveBeenCalledWith(viewport);
    expect(observe).toHaveBeenCalledWith(host);
    expect(ctx.defaultGridOverflowObserver).not.toBeNull();
  });

  it('calculates and caches automatic column widths when explicit widths are missing', () => {
    const column = { field: 'name', header: 'Name' };
    const cache = new Map<string, number>();
    const calculateAutoWidth = vi.fn(() => 156);

    const ctx = {
      config: { autoSizeColumns: true },
      columnAutoWidthCache: cache,
      calculateAutoWidth,
      getColumnField: (candidate: { field: string }) => candidate.field,
      getMinimumColumnWidth: () => 80
    };

    const firstWidth = getColumnPixelWidthHelper(ctx, column);
    const secondWidth = getColumnPixelWidthHelper(ctx, column);

    expect(firstWidth).toBe(156);
    expect(secondWidth).toBe(156);
    expect(cache.get('name')).toBe(156);
    expect(calculateAutoWidth).toHaveBeenCalledTimes(1);
  });

  it('uses the type-aware default width without measuring content when auto-size is disabled', () => {
    const column = { field: 'name', header: 'Name' };
    const calculateAutoWidth = vi.fn(() => 156);

    const ctx = {
      config: { autoSizeColumns: false },
      columnAutoWidthCache: new Map<string, number>(),
      calculateAutoWidth,
      getColumnField: (candidate: { field: string }) => candidate.field,
      getMinimumColumnWidth: () => 120
    };

    expect(getColumnPixelWidthHelper(ctx, column)).toBe(220);
    expect(calculateAutoWidth).not.toHaveBeenCalled();
  });

  it('returns the stretched template width immediately for unsized columns when space is available', () => {
    const root = document.createElement('div');
    Object.defineProperty(root, 'clientWidth', { configurable: true, value: 500 });

    const firstColumn = { field: 'name' };
    const secondColumn = { field: 'owner' };

    const ctx = {
      config: { selectable: true },
      elementRef: { nativeElement: root },
      visibleColumns: () => [firstColumn, secondColumn],
      getColumnField: (candidate: { field: string }) => candidate.field,
      getSelectionColumnWidth: () => 44,
      getColumnPixelWidth: (column: { field: string }) => (column.field === 'name' ? 120 : 180)
    };

    expect(getRenderedColumnWidthHelper(ctx, firstColumn)).toBe(120);
    expect(getRenderedColumnWidthHelper(ctx, secondColumn)).toBe(180);
  });

  it('keeps the actively resized column fixed without redistributing the leftover viewport width', () => {
    const root = document.createElement('div');
    Object.defineProperty(root, 'clientWidth', { configurable: true, value: 500 });

    const firstColumn = { field: 'name', width: 120, fillRemaining: true };
    const secondColumn = { field: 'owner', width: 180 };

    const ctx = {
      config: { selectable: true },
      elementRef: { nativeElement: root },
      resizingColumnField: 'name',
      visibleColumns: () => [firstColumn, secondColumn],
      getColumnField: (candidate: { field: string }) => candidate.field,
      getSelectionColumnWidth: () => 44,
      getColumnPixelWidth: (column: { field: string }) => (column.field === 'name' ? 120 : 180)
    };

    expect(getRenderedColumnWidthHelper(ctx, firstColumn)).toBe(120);
    expect(getRenderedColumnWidthHelper(ctx, secondColumn)).toBe(180);
  });

  it('reuses rendered width model and column index caches on repeated colgroup reads', () => {
    const root = document.createElement('div');
    Object.defineProperty(root, 'clientWidth', { configurable: true, value: 500 });

    const firstColumn = { field: 'name', width: 120 };
    const secondColumn = { field: 'owner', width: 180 };
    let allowColumnScan = true;
    const visibleColumns = vi.fn(() => {
      if (!allowColumnScan) {
        throw new Error('visibleColumns should not be scanned after rendered widths are cached');
      }
      return [firstColumn, secondColumn];
    });
    const ctx = {
      config: { selectable: false },
      elementRef: { nativeElement: root },
      visibleColumns,
      renderedColumnWidthModelKey: vi.fn(() => '0|0|name:120:::0|owner:180:::0'),
      visibleColumnIndexLookup: vi.fn(
        () =>
          new Map([
            ['name', 0],
            ['owner', 1]
          ])
      ),
      getColumnField: (candidate: { field: string }) => candidate.field,
      getColumnPixelWidth: (column: { field: string }) => (column.field === 'name' ? 120 : 180)
    };

    expect(getRenderedColumnWidthHelper(ctx, firstColumn)).toBe(120);
    allowColumnScan = false;
    expect(getRenderedColumnWidthHelper(ctx, secondColumn)).toBe(180);
    expect(visibleColumns).toHaveBeenCalledOnce();
  });

  it('syncs header and body widths from the column model instead of DOM header measurements', () => {
    const rafCallbacks: Array<(time: number) => void> = [];
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: (time: number) => void) => {
        rafCallbacks.push(callback);
        return 1;
      })
    );

    const root = document.createElement('div');
    root.innerHTML = `
      <div class="table-scroll"></div>
      <table class="header-table">
        <colgroup>
          <col />
          <col />
          <col />
        </colgroup>
      </table>
      <table class="data-grid-table">
        <colgroup>
          <col />
          <col />
          <col />
        </colgroup>
      </table>
      <table class="grid-calculate-footer__table">
        <colgroup>
          <col />
          <col />
          <col />
        </colgroup>
      </table>
    `;

    const viewport = root.querySelector('.table-scroll') as HTMLElement;
    const headerTable = root.querySelector('.header-table') as HTMLElement;
    const bodyTable = root.querySelector('.data-grid-table') as HTMLElement;
    const footerTable = root.querySelector('.grid-calculate-footer__table') as HTMLElement;

    Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 280 });
    Object.defineProperty(root, 'clientWidth', { configurable: true, value: 260 });

    const firstColumn = { field: 'name' };
    const secondColumn = { field: 'owner' };

    const ctx = {
      config: {
        selectable: true
      },
      elementRef: { nativeElement: root },
      gridViewport: { nativeElement: viewport },
      headerBodyWidthSyncRAF: null,
      visibleColumns: () => [firstColumn, secondColumn],
      getSelectionColumnWidth: () => 44,
      getColumnPixelWidth: (column: { field: string }) => (column.field === 'name' ? 120 : 180),
      queueDefaultGridOverflowSync: vi.fn()
    };

    syncHeaderBodyWidthsHelper(ctx);
    expect(ctx.headerBodyWidthSyncRAF).toBe(1);

    const scheduledFrame = rafCallbacks[0];
    if (typeof scheduledFrame !== 'function') {
      throw new Error('requestAnimationFrame callback was not scheduled');
    }
    scheduledFrame(0);

    expect(root.style.getPropertyValue('--dg-grid-content-width')).toBe('344px');
    expect(root.style.getPropertyValue('--dg-grid-table-width')).toBe('344px');
    expect(headerTable.style.width).toBe('344px');
    expect(headerTable.style.minWidth).toBe('344px');
    expect(bodyTable.style.width).toBe('344px');
    expect(bodyTable.style.minWidth).toBe('344px');
    expect(footerTable.style.width).toBe('344px');
    expect(footerTable.style.minWidth).toBe('344px');

    const headerCols = Array.from(headerTable.querySelectorAll('col')) as HTMLElement[];
    const bodyCols = Array.from(bodyTable.querySelectorAll('col')) as HTMLElement[];
    const footerCols = Array.from(footerTable.querySelectorAll('col')) as HTMLElement[];

    expect(headerCols.map(col => col.style.width)).toEqual(['44px', '120px', '180px']);
    expect(bodyCols.map(col => col.style.width)).toEqual(['44px', '120px', '180px']);
    expect(footerCols.map(col => col.style.width)).toEqual(['44px', '120px', '180px']);
    expect(ctx.queueDefaultGridOverflowSync).toHaveBeenCalledTimes(1);
    expect(ctx.headerBodyWidthSyncRAF).toBeNull();
  });

  it('skips overflow sync work during live resize preview frames', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <div class="table-scroll"></div>
      <table class="header-table">
        <colgroup>
          <col />
          <col />
          <col />
        </colgroup>
      </table>
      <table class="data-grid-table">
        <colgroup>
          <col />
          <col />
          <col />
        </colgroup>
      </table>
      <table class="grid-calculate-footer__table">
        <colgroup>
          <col />
          <col />
          <col />
        </colgroup>
      </table>
    `;

    const viewport = root.querySelector('.table-scroll') as HTMLElement;
    Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 420 });
    Object.defineProperty(root, 'clientWidth', { configurable: true, value: 420 });

    const ctx = {
      config: {
        selectable: true
      },
      elementRef: { nativeElement: root },
      gridViewport: { nativeElement: viewport },
      isResizingColumn: true,
      headerBodyWidthSyncRAF: null,
      headerBodyWidthSyncTargets: null,
      visibleColumns: () => [{ field: 'name' }, { field: 'owner' }],
      getSelectionColumnWidth: () => 44,
      getColumnPixelWidth: (column: { field: string }) => (column.field === 'name' ? 140 : 160),
      queueDefaultGridOverflowSync: vi.fn()
    };

    syncHeaderBodyWidthsHelper(ctx, { preview: true });

    expect(root.style.getPropertyValue('--dg-grid-content-width')).toBe('344px');
    expect(root.style.getPropertyValue('--dg-grid-table-width')).toBe('344px');
    expect(ctx.queueDefaultGridOverflowSync).not.toHaveBeenCalled();
    expect(ctx.headerBodyWidthSyncRAF).toBeNull();
  });

  it('skips width synchronization while a remote structural refresh is pending', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <div class="table-scroll"></div>
      <table class="header-table">
        <colgroup>
          <col />
          <col />
          <col />
        </colgroup>
      </table>
      <table class="data-grid-table">
        <colgroup>
          <col />
          <col />
          <col />
        </colgroup>
      </table>
    `;

    const viewport = root.querySelector('.table-scroll') as HTMLElement;
    Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 420 });
    Object.defineProperty(root, 'clientWidth', { configurable: true, value: 420 });

    const ctx = {
      config: {
        selectable: true,
        remoteData: true
      },
      elementRef: { nativeElement: root },
      gridViewport: { nativeElement: viewport },
      headerBodyWidthSyncRAF: null,
      remoteDataStructureRefreshPending: () => true,
      visibleColumns: () => [{ field: 'name' }, { field: 'owner' }],
      getSelectionColumnWidth: () => 44,
      getColumnPixelWidth: (column: { field: string }) => (column.field === 'name' ? 140 : 160),
      queueDefaultGridOverflowSync: vi.fn()
    };

    syncHeaderBodyWidthsHelper(ctx);

    expect(root.style.getPropertyValue('--dg-grid-content-width')).toBe('');
    expect(root.style.getPropertyValue('--dg-grid-table-width')).toBe('');
    expect(ctx.queueDefaultGridOverflowSync).not.toHaveBeenCalled();
    expect(ctx.headerBodyWidthSyncRAF).toBeNull();
  });

  it('reuses cached resize bounds during preview width updates', () => {
    const column = { field: 'owner', width: 180 };
    const ctx = {
      resizingColumnField: 'owner',
      resizeMinWidth: 120,
      resizeMaxWidth: 360,
      findColumn: (field: string) => (field === 'owner' ? column : null),
      getMinimumColumnWidth: vi.fn(() => 120),
      getMaximumColumnWidth: vi.fn(() => 360),
      getColumnPixelWidth: vi.fn(() => 180),
      columnAutoWidthCache: new Map<string, number>(),
      syncHeaderBodyWidths: vi.fn(),
      columnsSignal: {
        set: vi.fn()
      },
      cdr: {
        detectChanges: vi.fn()
      }
    };

    applyColumnWidthHelper(ctx, 'owner', 220, { preview: true, save: false });

    expect(ctx.getMinimumColumnWidth).not.toHaveBeenCalled();
    expect(ctx.getMaximumColumnWidth).not.toHaveBeenCalled();
    expect(ctx.syncHeaderBodyWidths).toHaveBeenCalledWith({ preview: true });
    expect(column.width).toBe(220);
  });

  it('emits columns change after committing a resized width', () => {
    const column = { field: 'owner', width: 180 };
    const emitColumnsChange = vi.fn();
    const columnsSignal = Object.assign(
      vi.fn(() => [column]),
      {
        set: vi.fn()
      }
    );
    const ctx = {
      resizingColumnField: null,
      resizeMinWidth: 120,
      resizeMaxWidth: 360,
      findColumn: (field: string) => (field === 'owner' ? column : null),
      getMinimumColumnWidth: vi.fn(() => 120),
      getMaximumColumnWidth: vi.fn(() => 360),
      getColumnPixelWidth: vi.fn(() => 180),
      columnAutoWidthCache: new Map<string, number>(),
      syncHeaderBodyWidths: vi.fn(),
      columnsSignal,
      cdr: {
        detectChanges: vi.fn()
      },
      emitColumnsChange
    };

    applyColumnWidthHelper(ctx, 'owner', 220, { commit: true, save: false });

    expect(column.width).toBe(220);
    expect(emitColumnsChange).toHaveBeenCalledOnce();
  });

  it('blocks header drag start when the gesture originates from the resize handle', () => {
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();
    const setData = vi.fn();
    const ctx = {
      draggingColumnField: null,
      dropTargetColumnEdge: 'before',
      headerDropHandled: true,
      isResizingColumn: false
    };
    const resizeHandle = {
      closest: (selector: string) => (selector === '.resize-handle' ? {} : null)
    };
    const event = {
      target: resizeHandle,
      preventDefault,
      stopPropagation,
      dataTransfer: {
        setData
      }
    };

    onHeaderDragStartHelper(ctx, event, { field: 'owner', header: 'Owner' });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(setData).not.toHaveBeenCalled();
    expect(ctx.draggingColumnField).toBeNull();
    expect(ctx.dropTargetColumnEdge).toBe('before');
    expect(ctx.headerDropHandled).toBe(true);
  });

  it('shows a stable drag card without translating table cells while dragging a header', () => {
    const host = document.createElement('div');
    host.innerHTML =
      '<div class="engineers-salary-reference-data-grid"><table><thead><tr><th>Owner</th></tr></thead></table></div>';
    document.body.appendChild(host);
    const root = host.querySelector('.engineers-salary-reference-data-grid') as HTMLElement;
    const sourceHeader = host.querySelector('th') as HTMLTableCellElement;
    const setData = vi.fn();
    const setDragImage = vi.fn();
    const ctx = {
      draggingColumnField: null,
      dropTargetColumnEdge: null,
      headerDropHandled: false,
      columnDragPreviewOriginalColumns: null,
      columns: [{ field: 'owner', header: 'Owner' }],
      config: { selectable: true },
      elementRef: { nativeElement: host },
      getColumnField: (column: { field: string }) => column.field,
      getColumnPixelWidth: vi.fn(() => 140),
      isResizingColumn: false,
      cdr: { markForCheck: vi.fn() }
    };

    onHeaderDragStartHelper(
      ctx,
      {
        target: sourceHeader,
        currentTarget: sourceHeader,
        clientX: 180,
        dataTransfer: {
          setData,
          setDragImage,
          effectAllowed: 'copy'
        }
      } as unknown as DragEvent,
      { field: 'owner', header: 'Owner' }
    );

    expect(root.classList.contains('is-column-reordering')).toBe(true);
    const dragCard = root.querySelector<HTMLElement>('.dg-column-drag-card');
    expect(dragCard?.textContent).toBe('Owner');
    expect(dragCard?.style.left).toBe('180px');
    expect(dragCard?.style.top).toBe('0px');
    onHeaderDragOverHelper(
      ctx,
      {
        preventDefault: vi.fn(),
        currentTarget: sourceHeader,
        clientX: 204,
        clientY: 0,
        dataTransfer: { dropEffect: 'none' }
      } as unknown as DragEvent,
      { field: 'owner', header: 'Owner' }
    );

    expect(root.querySelector<HTMLElement>('.dg-column-drag-card')?.style.left).toBe('204px');
    expect(host.querySelector('.dg-column-drag-floating-preview')).toBeNull();
    expect(setDragImage).toHaveBeenCalledOnce();
    expect(ctx.draggingColumnField).toBe('owner');

    onHeaderDragEndHelper(ctx);

    expect(root.querySelector('.dg-column-drag-card')).toBeNull();
    expect(root.classList.contains('is-column-reordering')).toBe(false);
    document.body.removeChild(host);
  });
});
