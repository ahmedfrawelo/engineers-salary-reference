import { describe, expect, it, vi } from 'vitest';

import {
  buildGridStateHelper,
  loadStateHelper,
  restoreStateHelper
} from './data-grid.component.runtime-state';

describe('data-grid.component.runtime-state', () => {
  it('clamps restored column widths to the current minimum width', () => {
    const column = { field: 'name', maxWidth: 500, width: undefined };
    const ctx = {
      columns: [column],
      sortStates: { set: vi.fn() },
      filterStates: { set: vi.fn() },
      paginationState: { update: vi.fn() },
      groupColumns: { set: vi.fn() },
      showGroupHeaderAggregates: { set: vi.fn() },
      showGroupFooterAggregates: { set: vi.fn() },
      showGrandTotalAggregates: { set: vi.fn() },
      applyPinnedOrdering: vi.fn(),
      columnAutoWidthCache: { clear: vi.fn() },
      columnRangeCache: { clear: vi.fn() },
      columnStatsCache: { clear: vi.fn() },
      getMinimumColumnWidth: vi.fn(() => 120),
      getMaximumColumnWidth: vi.fn(() => 320),
      automaticAutoSizeApplied: true
    };

    restoreStateHelper(ctx, {
      version: '1.0',
      columnWidths: { name: 40 }
    });

    expect(column.width).toBe(120);
    expect(ctx.automaticAutoSizeApplied).toBe(false);
  });

  it('preserves percentage widths from saved state instead of converting them to pixels', () => {
    const column = { field: 'name', maxWidth: 500, width: undefined };
    const ctx = {
      columns: [column],
      sortStates: { set: vi.fn() },
      filterStates: { set: vi.fn() },
      paginationState: { update: vi.fn() },
      groupColumns: { set: vi.fn() },
      showGroupHeaderAggregates: { set: vi.fn() },
      showGroupFooterAggregates: { set: vi.fn() },
      showGrandTotalAggregates: { set: vi.fn() },
      applyPinnedOrdering: vi.fn(),
      columnAutoWidthCache: { clear: vi.fn() },
      columnRangeCache: { clear: vi.fn() },
      columnStatsCache: { clear: vi.fn() },
      getMinimumColumnWidth: vi.fn(() => 120),
      getMaximumColumnWidth: vi.fn(() => 320),
      automaticAutoSizeApplied: true
    };

    restoreStateHelper(ctx, {
      version: '1.0',
      columnWidths: { name: '25%' }
    });

    expect(column.width).toBe('25%');
    expect(ctx.automaticAutoSizeApplied).toBe(false);
  });

  it('clamps restored column widths to the current maximum width', () => {
    const column = { field: 'deadline', maxWidth: 500, width: undefined };
    const ctx = {
      columns: [column],
      sortStates: { set: vi.fn() },
      filterStates: { set: vi.fn() },
      paginationState: { update: vi.fn() },
      groupColumns: { set: vi.fn() },
      showGroupHeaderAggregates: { set: vi.fn() },
      showGroupFooterAggregates: { set: vi.fn() },
      showGrandTotalAggregates: { set: vi.fn() },
      applyPinnedOrdering: vi.fn(),
      columnAutoWidthCache: { clear: vi.fn() },
      columnRangeCache: { clear: vi.fn() },
      columnStatsCache: { clear: vi.fn() },
      getMinimumColumnWidth: vi.fn(() => 120),
      getMaximumColumnWidth: vi.fn(() => 180),
      automaticAutoSizeApplied: true
    };

    restoreStateHelper(ctx, {
      version: '1.0',
      columnWidths: { deadline: 420 }
    });

    expect(column.width).toBe(180);
    expect(ctx.automaticAutoSizeApplied).toBe(false);
  });

  it('ignores restored column widths when config disables width persistence', () => {
    const column = { field: 'deadline', maxWidth: 500, width: undefined };
    const ctx = {
      columns: [column],
      config: { persistColumnWidths: false },
      sortStates: { set: vi.fn() },
      filterStates: { set: vi.fn() },
      paginationState: { update: vi.fn() },
      groupColumns: { set: vi.fn() },
      showGroupHeaderAggregates: { set: vi.fn() },
      showGroupFooterAggregates: { set: vi.fn() },
      showGrandTotalAggregates: { set: vi.fn() },
      applyPinnedOrdering: vi.fn(),
      columnAutoWidthCache: { clear: vi.fn() },
      columnRangeCache: { clear: vi.fn() },
      columnStatsCache: { clear: vi.fn() },
      getMinimumColumnWidth: vi.fn(() => 120),
      getMaximumColumnWidth: vi.fn(() => 180),
      automaticAutoSizeApplied: true
    };

    restoreStateHelper(ctx, {
      version: '1.0',
      columnWidths: { deadline: 420 }
    });

    expect(column.width).toBeUndefined();
    expect(ctx.automaticAutoSizeApplied).toBe(false);
  });

  it('omits column widths from saved state when config disables width persistence', () => {
    const ctx = {
      config: { persistColumnWidths: false },
      columns: [
        { field: 'name', width: 240 },
        { field: 'owner', width: '25%' }
      ],
      sortStates: vi.fn(() => []),
      filterStates: vi.fn(() => []),
      paginationState: vi.fn(() => ({ pageSize: 100 })),
      groupColumns: vi.fn(() => []),
      showGroupHeaderAggregates: vi.fn(() => false),
      showGroupFooterAggregates: vi.fn(() => false),
      showGrandTotalAggregates: vi.fn(() => false),
      aggregateFooter: { enabled: false }
    };

    const state = buildGridStateHelper(ctx);

    expect(state.columnWidths).toEqual({});
  });

  it('cleans stale persisted column widths from storage when width persistence is disabled', () => {
    const storageKey = 'grid-state-crm-companies-grid';
    const restoreState = vi.fn();
    const ctx = {
      stateKey: 'crm-companies-grid',
      config: { persistColumnWidths: false },
      restoreState
    };

    localStorage.setItem(
      storageKey,
      JSON.stringify({
        version: '1.0',
        columnWidths: { name: 420 },
        filters: [],
        sorts: [],
        columnOrder: [],
        hiddenColumns: [],
        pageSize: 100,
        groupColumns: []
      })
    );

    loadStateHelper(ctx);

    expect(restoreState).toHaveBeenCalledWith(expect.objectContaining({ columnWidths: {} }));
    expect(JSON.parse(localStorage.getItem(storageKey) || '{}').columnWidths).toEqual({});

    localStorage.removeItem(storageKey);
  });

  it('omits column layout state when config disables layout persistence', () => {
    const ctx = {
      config: { persistColumnLayout: false },
      columns: [
        { field: 'name', hidden: false, pinned: 'left' as const },
        { field: 'owner', hidden: true }
      ],
      sortStates: vi.fn(() => []),
      filterStates: vi.fn(() => []),
      paginationState: vi.fn(() => ({ pageSize: 100 })),
      groupColumns: vi.fn(() => []),
      showGroupHeaderAggregates: vi.fn(() => false),
      showGroupFooterAggregates: vi.fn(() => false),
      showGrandTotalAggregates: vi.fn(() => false),
      aggregateFooter: { enabled: false }
    };

    const state = buildGridStateHelper(ctx);

    expect(state.columnOrder).toEqual([]);
    expect(state.hiddenColumns).toEqual([]);
    expect(state.pinnedColumns).toEqual({});
  });

  it('persists configured column data types and dropdown options', () => {
    const ctx = {
      columns: [
        {
          field: 'status',
          type: 'dropdown',
          cellType: 'select',
          options: [{ label: 'Open', value: 'Open' }]
        }
      ],
      sortStates: vi.fn(() => []),
      filterStates: vi.fn(() => []),
      paginationState: vi.fn(() => ({ pageSize: 100 })),
      groupColumns: vi.fn(() => []),
      showGroupHeaderAggregates: vi.fn(() => false),
      showGroupFooterAggregates: vi.fn(() => false),
      showGrandTotalAggregates: vi.fn(() => false),
      aggregateFooter: { enabled: false }
    };

    const state = buildGridStateHelper(ctx);

    expect(state.columnDefinitions).toEqual({
      status: {
        type: 'dropdown',
        cellType: 'select',
        options: [{ label: 'Open', value: 'Open' }]
      }
    });
  });

  it('does not persist source-managed column type definitions', () => {
    const ctx = {
      columns: [
        {
          field: 'assignTo',
          type: 'text',
          cellType: 'search-select',
          searchSelect: { options: [] }
        },
        {
          field: 'stage',
          type: 'text',
          cellType: 'select',
          options: [{ label: 'Tender', value: 'Tender' }],
          cellRenderer: vi.fn()
        },
        {
          field: 'status',
          type: 'dropdown',
          cellType: 'search-select',
          options: [{ label: 'Open', value: 'Open' }]
        }
      ],
      sortStates: vi.fn(() => []),
      filterStates: vi.fn(() => []),
      paginationState: vi.fn(() => ({ pageSize: 100 })),
      groupColumns: vi.fn(() => []),
      showGroupHeaderAggregates: vi.fn(() => false),
      showGroupFooterAggregates: vi.fn(() => false),
      showGrandTotalAggregates: vi.fn(() => false),
      aggregateFooter: { enabled: false }
    };

    const state = buildGridStateHelper(ctx);

    expect(state.columnDefinitions).toEqual({
      status: {
        type: 'dropdown',
        cellType: 'search-select',
        options: [{ label: 'Open', value: 'Open' }]
      }
    });
  });

  it('does not let saved column definitions override source-managed editors', () => {
    const managedColumn = {
      field: 'assignTo',
      type: 'text',
      cellType: 'search-select',
      searchSelect: { options: [] }
    };
    const renderedColumn = {
      field: 'stage',
      type: 'text',
      cellType: 'text',
      cellRenderer: vi.fn()
    };
    const statusColumn = { field: 'status', type: 'text', cellType: 'text' };
    const ctx = {
      columns: [managedColumn, renderedColumn, statusColumn],
      sortStates: { set: vi.fn() },
      filterStates: { set: vi.fn() },
      paginationState: { update: vi.fn() },
      groupColumns: { set: vi.fn() },
      showGroupHeaderAggregates: { set: vi.fn() },
      showGroupFooterAggregates: { set: vi.fn() },
      showGrandTotalAggregates: { set: vi.fn() },
      applyPinnedOrdering: vi.fn(),
      columnAutoWidthCache: { clear: vi.fn() },
      columnRangeCache: { clear: vi.fn() },
      columnStatsCache: { clear: vi.fn() },
      getMinimumColumnWidth: vi.fn(() => 120),
      getMaximumColumnWidth: vi.fn(() => 320),
      automaticAutoSizeApplied: true
    };

    restoreStateHelper(ctx, {
      version: '1.0',
      columnDefinitions: {
        assignTo: { type: 'text', cellType: 'text' },
        stage: {
          type: 'dropdown',
          cellType: 'search-select',
          options: [{ label: 'Tender', value: 'Tender' }]
        },
        status: { type: 'dropdown', cellType: 'search-select', options: [{ label: 'Open', value: 'Open' }] }
      }
    });

    expect(managedColumn).toMatchObject({
      type: 'text',
      cellType: 'search-select',
      searchSelect: { options: [] }
    });
    expect(renderedColumn).toMatchObject({
      type: 'text',
      cellType: 'text'
    });
    expect(renderedColumn.cellRenderer).toEqual(expect.any(Function));
    expect(renderedColumn).not.toHaveProperty('options');
    expect(statusColumn).toMatchObject({
      type: 'dropdown',
      cellType: 'search-select',
      options: [{ label: 'Open', value: 'Open' }]
    });
  });

  it('persists manual group expansion state when auto-expansion is disabled', () => {
    const ctx = {
      columns: [],
      sortStates: vi.fn(() => []),
      filterStates: vi.fn(() => []),
      paginationState: vi.fn(() => ({ pageSize: 100 })),
      groupColumns: vi.fn(() => ['status']),
      expandedGroups: vi.fn(() => new Set(['status:open', 'status:closed'])),
      groupExpansionAuto: vi.fn(() => false),
      showGroupHeaderAggregates: vi.fn(() => false),
      showGroupFooterAggregates: vi.fn(() => false),
      showGrandTotalAggregates: vi.fn(() => false),
      aggregateFooter: { enabled: false }
    };

    const state = buildGridStateHelper(ctx);

    expect(state.groupColumns).toEqual(['status']);
    expect(state.groupExpansionAuto).toBe(false);
    expect(state.expandedGroups).toEqual(['status:open', 'status:closed']);
  });

  it('omits expanded group ids when auto-expansion is enabled', () => {
    const ctx = {
      columns: [],
      sortStates: vi.fn(() => []),
      filterStates: vi.fn(() => []),
      paginationState: vi.fn(() => ({ pageSize: 100 })),
      groupColumns: vi.fn(() => ['status']),
      expandedGroups: vi.fn(() => new Set(['status:open'])),
      groupExpansionAuto: vi.fn(() => true),
      showGroupHeaderAggregates: vi.fn(() => false),
      showGroupFooterAggregates: vi.fn(() => false),
      showGrandTotalAggregates: vi.fn(() => false),
      aggregateFooter: { enabled: false }
    };

    const state = buildGridStateHelper(ctx);

    expect(state.groupExpansionAuto).toBe(true);
    expect(state.expandedGroups).toEqual([]);
  });

  it('ignores restored column layout when config disables layout persistence', () => {
    const columns = [
      { field: 'name', hidden: false, pinned: undefined },
      { field: 'owner', hidden: false, pinned: undefined }
    ];
    const ctx = {
      columns,
      config: { persistColumnLayout: false },
      sortStates: { set: vi.fn() },
      filterStates: { set: vi.fn() },
      paginationState: { update: vi.fn() },
      groupColumns: { set: vi.fn() },
      showGroupHeaderAggregates: { set: vi.fn() },
      showGroupFooterAggregates: { set: vi.fn() },
      showGrandTotalAggregates: { set: vi.fn() },
      applyPinnedOrdering: vi.fn(),
      columnAutoWidthCache: { clear: vi.fn() },
      columnRangeCache: { clear: vi.fn() },
      columnStatsCache: { clear: vi.fn() },
      getMinimumColumnWidth: vi.fn(() => 120),
      getMaximumColumnWidth: vi.fn(() => 320),
      automaticAutoSizeApplied: true
    };

    restoreStateHelper(ctx, {
      version: '1.0',
      columnOrder: ['owner', 'name'],
      hiddenColumns: ['owner'],
      pinnedColumns: { name: 'left' }
    });

    expect(columns.map(column => column.field)).toEqual(['name', 'owner']);
    expect(columns[0].pinned).toBeUndefined();
    expect(columns[1].hidden).toBe(false);
  });

  it('restores saved group expansion state', () => {
    const expandedGroupsSet = vi.fn();
    const groupExpansionAutoSet = vi.fn();
    const groupFilterTermsSet = vi.fn();
    const displayRowsEffectsSuspendedSet = vi.fn();
    const remoteDataStructureRefreshPendingSet = vi.fn();
    const ctx = {
      columns: [],
      config: { remoteData: true },
      loading: true,
      sortStates: { set: vi.fn() },
      filterStates: { set: vi.fn() },
      paginationState: { update: vi.fn() },
      groupColumns: { set: vi.fn() },
      expandedGroups: { set: expandedGroupsSet },
      groupExpansionAuto: { set: groupExpansionAutoSet },
      groupFilterTerms: { set: groupFilterTermsSet },
      remoteDataStructureRefreshPending: { set: remoteDataStructureRefreshPendingSet },
      displayRowsEffectsSuspended: { set: displayRowsEffectsSuspendedSet },
      showGroupHeaderAggregates: { set: vi.fn() },
      showGroupFooterAggregates: { set: vi.fn() },
      showGrandTotalAggregates: { set: vi.fn() },
      applyPinnedOrdering: vi.fn(),
      columnAutoWidthCache: { clear: vi.fn() },
      columnRangeCache: { clear: vi.fn() },
      columnStatsCache: { clear: vi.fn() },
      getMinimumColumnWidth: vi.fn(() => 120),
      getMaximumColumnWidth: vi.fn(() => 320),
      automaticAutoSizeApplied: true
    };

    restoreStateHelper(ctx, {
      version: '1.0',
      groupColumns: ['status'],
      expandedGroups: ['status:open'],
      groupExpansionAuto: false
    });

    expect(groupExpansionAutoSet).toHaveBeenCalledWith(false);
    expect(expandedGroupsSet).toHaveBeenCalledWith(new Set(['status:open']));
    expect(groupFilterTermsSet).toHaveBeenCalledWith(new Map());
    expect(remoteDataStructureRefreshPendingSet).toHaveBeenCalledWith(true);
    expect(displayRowsEffectsSuspendedSet).toHaveBeenNthCalledWith(1, true);
    expect(displayRowsEffectsSuspendedSet).toHaveBeenNthCalledWith(2, false);
  });

  it('cleans stale persisted column layout from storage when layout persistence is disabled', () => {
    const storageKey = 'grid-state-crm-deals-grid';
    const restoreState = vi.fn();
    const ctx = {
      stateKey: 'crm-deals-grid',
      config: { persistColumnLayout: false },
      restoreState
    };

    localStorage.setItem(
      storageKey,
      JSON.stringify({
        version: '1.0',
        columnWidths: {},
        filters: [],
        sorts: [],
        columnOrder: ['owner', 'name'],
        hiddenColumns: ['owner'],
        pinnedColumns: { name: 'left' },
        pageSize: 100,
        groupColumns: []
      })
    );

    loadStateHelper(ctx);

    expect(restoreState).toHaveBeenCalledWith(
      expect.objectContaining({
        columnOrder: [],
        hiddenColumns: [],
        pinnedColumns: {}
      })
    );
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    expect(saved.columnOrder).toEqual([]);
    expect(saved.hiddenColumns).toEqual([]);
    expect(saved.pinnedColumns).toEqual({});

    localStorage.removeItem(storageKey);
  });
});
