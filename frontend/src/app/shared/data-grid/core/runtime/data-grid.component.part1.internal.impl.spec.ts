import { describe, expect, it, vi } from 'vitest';

import {
  batchDeleteSelectedHelper,
  clearSelectionHelper,
  clearSelectionUndoHelper,
  emitChangeHelper,
  getCellValueHelper,
  getCellValueWithHighlightHelper,
  getPerformanceStatsHelper,
  getGroupSelectionSummaryHelper,
  getGroupSelectionViewStateHelper,
  getRowSelectionNumberHelper,
  onFilterHelper,
  onGlobalSearchHelper,
  getSortDirectionHelper,
  getSortOrderHelper,
  hasActiveFilterHelper,
  handleCellClickHelper,
  handleCellDoubleClickHelper,
  invertVisibleSelectionHelper,
  isGroupPartiallySelectedHelper,
  isGroupSelectedHelper,
  isRowPinnedHelper,
  isRowSelectedHelper,
  batchEditFieldHelper,
  replaceSelectionHelper,
  saveEditHelper,
  selectAllHelper,
  shouldRunAutomaticAutoSizeHelper,
  toggleGroupSelectionHelper,
  toggleRowSelectionHelper,
  undoSelectionChangeHelper,
  updatePaginationStateHelper
} from './data-grid.component.part1.internal.impl';
import { registerGridFeedbackHandlers } from '../../utils/feedback';

function createHost(attributes: Record<string, string | null> = {}): HTMLElement {
  return {
    getAttribute(name: string) {
      return attributes[name] ?? null;
    }
  } as unknown as HTMLElement;
}

function createSignalState<T>(initial: T): (() => T) & {
  set(value: T): void;
  update(updater: (value: T) => T): void;
} {
  let value = initial;
  const signal = vi.fn(() => value) as unknown as (() => T) & {
    set(value: T): void;
    update(updater: (value: T) => T): void;
  };
  signal.set = vi.fn((next: T) => {
    value = next;
  });
  signal.update = vi.fn((updater: (current: T) => T) => {
    value = updater(value);
  });
  return signal;
}

describe('data-grid.component.part1.internal.impl', () => {
  it('uses cached sort and filter field lookups on hot class paths', () => {
    const ctx = {
      getColumnField: vi.fn((column: { field: string }) => column.field),
      sortStateLookup: vi.fn(
        () => new Map([['name', { field: 'name', direction: 'asc', order: 0 }]])
      ),
      activeFilterFieldLookup: vi.fn(() => new Set(['name'])),
      sortStates: vi.fn(() => {
        throw new Error('sortStates should not be scanned when the lookup is available');
      }),
      filterStates: vi.fn(() => {
        throw new Error('filterStates should not be scanned when the lookup is available');
      })
    };

    expect(getSortDirectionHelper(ctx, { field: 'name' })).toBe('asc');
    expect(getSortOrderHelper(ctx, { field: 'name' })).toBe(1);
    expect(hasActiveFilterHelper(ctx, 'name')).toBe(true);
    expect(ctx.sortStates).not.toHaveBeenCalled();
    expect(ctx.filterStates).not.toHaveBeenCalled();
  });

  it('updates column filters when object-like values differ', () => {
    const filterStates = createSignalState([
      { field: 'meta', operator: 'contains', value: { id: 1 } }
    ]);
    const paginationState = { update: vi.fn() };
    const emitChange = vi.fn();

    onFilterHelper(
      {
        filterStates,
        paginationState,
        emitChange
      },
      { field: 'meta' },
      { id: 2 }
    );

    expect(filterStates()).toEqual([{ field: 'meta', value: { id: 2 }, operator: 'contains' }]);
    expect(paginationState.update).toHaveBeenCalledOnce();
    expect(emitChange).toHaveBeenCalledWith('filter');
  });

  it('rebuilds global search filters when searchable columns change', () => {
    const filterStates = createSignalState([
      { field: 'name', value: 'alpha', operator: 'globalSearch' }
    ]);
    const paginationState = { update: vi.fn() };
    const emitChange = vi.fn();

    onGlobalSearchHelper(
      {
        columns: [{ field: 'name' }, { field: 'owner' }],
        filterStates,
        paginationState,
        emitChange,
        globalSearchTerm: 'alpha'
      },
      'alpha'
    );

    expect(filterStates()).toEqual([
      { field: 'name', value: 'alpha', operator: 'globalSearch' },
      { field: 'owner', value: 'alpha', operator: 'globalSearch' }
    ]);
    expect(filterStates.update).toHaveBeenCalledOnce();
    expect(paginationState.update).toHaveBeenCalledOnce();
    expect(emitChange).toHaveBeenCalledWith('filter');
  });

  it('clears stale global search filters when no searchable columns remain', () => {
    const filterStates = createSignalState([
      { field: 'name', value: 'alpha', operator: 'globalSearch' }
    ]);
    const paginationState = { update: vi.fn() };
    const emitChange = vi.fn();

    onGlobalSearchHelper(
      {
        columns: [{ field: 'name', filterable: false }],
        filterStates,
        paginationState,
        emitChange,
        globalSearchTerm: 'alpha'
      },
      'alpha'
    );

    expect(filterStates()).toEqual([]);
    expect(paginationState.update).toHaveBeenCalledOnce();
    expect(emitChange).toHaveBeenCalledWith('filter');
  });

  it('emits persisted grouping state as a first-class group change event', () => {
    const emit = vi.fn();
    const saveState = vi.fn();

    emitChangeHelper(
      {
        sortStates: () => [],
        filterStates: () => [],
        paginationState: () => ({ currentPage: 1, pageSize: 100, totalRecords: 500 }),
        selectedRows: () => [],
        groupColumns: () => ['status'],
        expandedGroups: () => new Set(['status:open']),
        groupExpansionAuto: () => false,
        onChange: { emit },
        stateKey: 'projects-grid',
        saveState,
        bumpAggregateCache: vi.fn()
      },
      'group'
    );

    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'group',
        groupColumns: ['status'],
        expandedGroups: ['status:open'],
        groupExpansionAuto: false
      })
    );
    expect(saveState).toHaveBeenCalledOnce();
  });

  it('keeps the previous remote total while an empty remote page is still loading', () => {
    const paginationState = createSignalState({
      currentPage: 3,
      pageSize: 100,
      totalRecords: 500,
      totalPages: 5
    });

    updatePaginationStateHelper(
      {
        config: { remoteData: true },
        loading: true,
        dataSignal: () => [],
        paginationState
      },
      0
    );

    expect(paginationState()).toEqual({
      currentPage: 3,
      pageSize: 100,
      totalRecords: 500,
      totalPages: 5
    });
  });

  it('reuses cached expanded group snapshots and debounces persisted expansion saves', () => {
    const emit = vi.fn();
    const saveState = vi.fn();
    const scheduleStateSave = vi.fn();
    const expandedGroups = vi.fn(() => {
      throw new Error('expandedGroups should not be scanned when snapshot exists');
    });

    emitChangeHelper(
      {
        sortStates: () => [],
        filterStates: () => [],
        paginationState: () => ({ currentPage: 1, pageSize: 100, totalRecords: 500 }),
        selectedRows: () => [],
        groupColumns: () => ['status'],
        expandedGroups,
        expandedGroupsSnapshot: () => ['status:open'],
        groupExpansionAuto: () => false,
        onChange: { emit },
        stateKey: 'projects-grid',
        saveState,
        scheduleStateSave,
        bumpAggregateCache: vi.fn()
      },
      'groupExpansion'
    );

    expect(expandedGroups).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'groupExpansion',
        groupColumns: ['status'],
        expandedGroups: ['status:open'],
        groupExpansionAuto: false
      })
    );
    expect(scheduleStateSave).toHaveBeenCalledWith(120);
    expect(saveState).not.toHaveBeenCalled();
  });

  it('does not materialize group expansion snapshots for selection-only change events', () => {
    const emit = vi.fn();

    emitChangeHelper(
      {
        sortStates: () => [],
        filterStates: () => [],
        paginationState: () => ({ currentPage: 1, pageSize: 100, totalRecords: 500 }),
        selectedRows: () => [{ id: 1 }],
        groupColumns: () => ['status'],
        expandedGroupsSnapshot: vi.fn(() => {
          throw new Error('selection changes should not snapshot expanded groups');
        }),
        groupExpansionAuto: vi.fn(() => {
          throw new Error('selection changes should not read group expansion mode');
        }),
        onChange: { emit },
        bumpAggregateCache: vi.fn()
      },
      'selection'
    );

    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'selection',
        selectedRows: [{ id: 1 }],
        groupColumns: ['status']
      })
    );
    const event = emit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(event['expandedGroups']).toBeUndefined();
    expect(event['groupExpansionAuto']).toBeUndefined();
  });

  it('caches rendered cell values across hot template reads', () => {
    const row = { id: 1, name: 'Alpha' };
    const renderer = vi.fn((value: unknown) => `<strong>${value}</strong>`);
    const ctx = {
      cellValueCache: new Map<string, unknown>()
    };
    const column = {
      field: 'name',
      header: 'Name',
      cellRenderer: renderer,
      renderAsHtml: true
    };

    expect(getCellValueHelper(ctx, row, column)).toBe('<strong>Alpha</strong>');
    expect(getCellValueHelper(ctx, row, column)).toBe('<strong>Alpha</strong>');
    expect(renderer).toHaveBeenCalledOnce();
  });

  it('caches highlighted render output for repeated cell bindings', () => {
    const row = { id: 1, name: 'Alpha' };
    const getCellValue = vi.fn(() => 'Alpha');
    const ctx = {
      cellValueCache: new Map<string, unknown>(),
      globalSearchTerm: 'alp',
      getCellValue,
      normalizeDisplayValue: (value: unknown) => value,
      escapeRegExp: (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    };
    const column = {
      field: 'name',
      header: 'Name'
    };

    const first = getCellValueWithHighlightHelper(ctx, row, column);
    const second = getCellValueWithHighlightHelper(ctx, row, column);

    expect(first).toBe(second);
    expect(String(first)).toContain('search-highlight');
    expect(getCellValue).toHaveBeenCalledOnce();
  });

  it('runs automatic auto-size when config enables it for default-grid grids', () => {
    const host = createHost({
      'data-grid-layout-preset': 'default'
    });

    expect(
      shouldRunAutomaticAutoSizeHelper({
        config: {
          autoSizeColumns: true
        },
        elementRef: { nativeElement: host }
      })
    ).toBe(true);
  });

  it('runs automatic auto-size even when the default host attr is implicit', () => {
    expect(
      shouldRunAutomaticAutoSizeHelper({
        config: { autoSizeColumns: true },
        elementRef: { nativeElement: createHost() }
      })
    ).toBe(true);
  });

  it('returns false when auto-size is disabled in config', () => {
    const host = createHost({
      'data-grid-layout-preset': 'default'
    });

    expect(
      shouldRunAutomaticAutoSizeHelper({
        config: {
          autoSizeColumns: false
        },
        elementRef: { nativeElement: host }
      })
    ).toBe(false);
  });

  it('selects only visible selectable rows when using select all', () => {
    const rowA = { id: 'A' };
    const rowB = { id: 'B' };
    const appendRow = { __appendRow: true };
    let selected: unknown[] = [];
    const selectedRows = (() => selected) as (() => unknown[]) & {
      set(value: unknown[]): void;
      update(updater: (value: unknown[]) => unknown[]): void;
    };
    selectedRows.set = (value: unknown[]) => {
      selected = value;
    };
    selectedRows.update = (updater: (value: unknown[]) => unknown[]) => {
      selected = updater(selected);
    };

    const ctx = {
      selectedRows,
      selectableRowsSnapshot() {
        return [rowA, rowB, rowA, appendRow];
      },
      onSelectionChange: {
        emit() {
          return undefined;
        }
      },
      emitChange() {
        return undefined;
      }
    };

    selectAllHelper(ctx);

    expect(selected).toEqual([rowA, rowB]);
  });

  it('inverts only the currently visible selection scope', () => {
    const rowA = { id: 'A' };
    const rowB = { id: 'B' };
    const rowC = { id: 'C' };
    let selected: unknown[] = [rowA, rowC];
    const selectedRows = (() => selected) as (() => unknown[]) & {
      set(value: unknown[]): void;
    };
    selectedRows.set = (value: unknown[]) => {
      selected = value;
    };

    const ctx = {
      selectedRows,
      selectableRowsSnapshot() {
        return [rowA, rowB];
      },
      onSelectionChange: {
        emit() {
          return undefined;
        }
      },
      emitChange() {
        return undefined;
      }
    };

    invertVisibleSelectionHelper(ctx);

    expect(selected).toEqual([rowC, rowB]);
  });

  it('stores the previous selection for undo and restores it after clearing', () => {
    const rowA = { id: 'A' };
    const rowB = { id: 'B' };
    let selected: unknown[] = [rowA, rowB];
    let undoSnapshot: unknown[] | null = null;
    let undoLabel = '';
    const selectedRows = (() => selected) as (() => unknown[]) & {
      set(value: unknown[]): void;
    };
    selectedRows.set = (value: unknown[]) => {
      selected = value;
    };
    const selectionUndoSnapshot = (() => undoSnapshot) as (() => unknown[] | null) & {
      set(value: unknown[] | null): void;
    };
    selectionUndoSnapshot.set = (value: unknown[] | null) => {
      undoSnapshot = value;
    };
    const selectionUndoLabel = (() => undoLabel) as (() => string) & {
      set(value: string): void;
    };
    selectionUndoLabel.set = (value: string) => {
      undoLabel = value;
    };
    const emitSelectionChange = vi.fn();

    const ctx = {
      selectedRows,
      selectionUndoSnapshot,
      selectionUndoLabel,
      onSelectionChange: { emit: emitSelectionChange },
      emitChange() {
        return undefined;
      }
    };

    clearSelectionHelper(ctx);

    expect(selected).toEqual([]);
    expect(undoSnapshot).toEqual([rowA, rowB]);
    expect(undoLabel).toBe('Selection restored');

    undoSelectionChangeHelper(ctx);

    expect(selected).toEqual([rowA, rowB]);
    expect(undoSnapshot).toBeNull();
    expect(undoLabel).toBe('');
    expect(emitSelectionChange).toHaveBeenCalledTimes(2);
  });

  it('deletes local selected rows immediately and restores them from the undo toast', () => {
    const rowA = { id: 'A' };
    const rowB = { id: 'B' };
    const rowC = { id: 'C' };
    const rowD = { id: 'D' };
    let data = [rowA, rowB, rowC, rowD];
    let selected = [rowB, rowD];
    let pinned = [rowB];
    let bookmarked = [rowD];
    const confirm = vi.fn();
    const action = vi.fn((_message: string, _options: { onAction: () => void }) => undefined);
    const onBatchDelete = { observers: [], emit: vi.fn() };
    const onSelectionChange = { emit: vi.fn() };
    const emitChange = vi.fn();
    const selectedRows = (() => selected) as (() => unknown[]) & {
      set(value: unknown[]): void;
    };
    selectedRows.set = (value: unknown[]) => {
      selected = value as typeof selected;
    };
    const pinnedRows = (() => pinned) as (() => unknown[]) & {
      update(updater: (rows: unknown[]) => unknown[]): void;
    };
    pinnedRows.update = updater => {
      pinned = updater(pinned) as typeof pinned;
    };
    const bookmarkedRows = (() => bookmarked) as (() => unknown[]) & {
      update(updater: (rows: unknown[]) => unknown[]): void;
    };
    bookmarkedRows.update = updater => {
      bookmarked = updater(bookmarked) as typeof bookmarked;
    };
    const unregister = registerGridFeedbackHandlers({
      action,
      confirm
    });

    try {
      batchDeleteSelectedHelper({
        bookmarkedRows,
        config: { remoteData: false },
        cdr: { markForCheck: vi.fn() },
        dataSignal: () => data,
        emitChange,
        onBatchDelete,
        onSelectionChange,
        pinnedRows,
        selectedRows,
        setDataInternal: (rows: typeof data) => {
          data = rows;
        }
      });

      expect(confirm).not.toHaveBeenCalled();
      expect(action).toHaveBeenCalledWith(
        '2 rows deleted.',
        expect.objectContaining({ actionLabel: 'Undo', tone: 'danger' })
      );
      expect(data).toEqual([rowA, rowC]);
      expect(selected).toEqual([]);
      expect(pinned).toEqual([]);
      expect(bookmarked).toEqual([]);
      expect(onBatchDelete.emit).toHaveBeenCalledWith([rowB, rowD]);

      const actionOptions = action.mock.calls[0]?.[1];
      expect(actionOptions).toBeDefined();
      actionOptions!.onAction();

      expect(data).toEqual([rowA, rowB, rowC, rowD]);
      expect(selected).toEqual([rowB, rowD]);
      expect(pinned).toEqual([rowB]);
      expect(bookmarked).toEqual([rowD]);
      expect(onSelectionChange.emit).toHaveBeenLastCalledWith([rowB, rowD]);
    } finally {
      unregister();
    }
  });

  it('replaces selection in one pass without emitting when requested', () => {
    const rowA = { id: 'A' };
    const rowB = { id: 'B' };
    let selected: unknown[] = [rowA];
    let undoSnapshot: unknown[] | null = [rowA];
    let undoLabel = 'Selection restored';
    const selectedRows = (() => selected) as (() => unknown[]) & {
      set(value: unknown[]): void;
    };
    selectedRows.set = (value: unknown[]) => {
      selected = value;
    };
    const selectionUndoSnapshot = (() => undoSnapshot) as (() => unknown[] | null) & {
      set(value: unknown[] | null): void;
    };
    selectionUndoSnapshot.set = (value: unknown[] | null) => {
      undoSnapshot = value;
    };
    const selectionUndoLabel = (() => undoLabel) as (() => string) & {
      set(value: string): void;
    };
    selectionUndoLabel.set = (value: string) => {
      undoLabel = value;
    };
    const emitSelectionChange = vi.fn();

    replaceSelectionHelper(
      {
        selectedRows,
        selectionUndoSnapshot,
        selectionUndoLabel,
        onSelectionChange: { emit: emitSelectionChange },
        emitChange() {
          return undefined;
        }
      },
      [rowB, rowB, { __appendRow: true }],
      { emitChange: false, preserveUndo: false }
    );

    expect(selected).toEqual([rowB]);
    expect(undoSnapshot).toBeNull();
    expect(undoLabel).toBe('');
    expect(emitSelectionChange).not.toHaveBeenCalled();
  });

  it('clears the pending undo state explicitly', () => {
    let undoSnapshot: unknown[] | null = [{ id: 'A' }];
    let undoLabel = 'Selection restored';
    const selectionUndoSnapshot = (() => undoSnapshot) as (() => unknown[] | null) & {
      set(value: unknown[] | null): void;
    };
    selectionUndoSnapshot.set = (value: unknown[] | null) => {
      undoSnapshot = value;
    };
    const selectionUndoLabel = (() => undoLabel) as (() => string) & {
      set(value: string): void;
    };
    selectionUndoLabel.set = (value: string) => {
      undoLabel = value;
    };

    clearSelectionUndoHelper({
      selectionUndoSnapshot,
      selectionUndoLabel
    });

    expect(undoSnapshot).toBeNull();
    expect(undoLabel).toBe('');
  });

  it('toggles group selection and reports full or partial states from group rows', () => {
    const rowA = { id: 'A' };
    const rowB = { id: 'B' };
    const rowC = { id: 'C' };
    const group = { rows: [rowA, rowB, rowA, { __appendRow: true }] };
    let selected: unknown[] = [rowC];
    const selectedRows = (() => selected) as (() => unknown[]) & {
      set(value: unknown[]): void;
      update(updater: (value: unknown[]) => unknown[]): void;
    };
    selectedRows.set = (value: unknown[]) => {
      selected = value;
    };
    selectedRows.update = (updater: (value: unknown[]) => unknown[]) => {
      selected = updater(selected);
    };

    const ctx = {
      selectedRows,
      onSelectionChange: {
        emit() {
          return undefined;
        }
      },
      emitChange() {
        return undefined;
      }
    };

    expect(isGroupSelectedHelper(ctx, group)).toBe(false);
    expect(isGroupPartiallySelectedHelper(ctx, group)).toBe(false);
    expect(getGroupSelectionSummaryHelper(ctx, group)).toBe('0 of 2 rows selected');
    expect(getGroupSelectionViewStateHelper(ctx, group)).toEqual({
      checked: false,
      partial: false,
      title: '0 of 2 rows selected'
    });

    toggleGroupSelectionHelper(ctx, group, {
      preventDefault() {
        return undefined;
      },
      stopPropagation() {
        return undefined;
      }
    });

    expect(selected).toEqual([rowC, rowA, rowB]);
    expect(isGroupSelectedHelper(ctx, group)).toBe(true);
    expect(isGroupPartiallySelectedHelper(ctx, group)).toBe(false);
    expect(getGroupSelectionSummaryHelper(ctx, group)).toBe('2 of 2 rows selected');
    expect(getGroupSelectionViewStateHelper(ctx, group)).toEqual({
      checked: true,
      partial: false,
      title: '2 of 2 rows selected'
    });

    selected = [rowA];

    expect(isGroupSelectedHelper(ctx, group)).toBe(false);
    expect(isGroupPartiallySelectedHelper(ctx, group)).toBe(true);
    expect(getGroupSelectionSummaryHelper(ctx, group)).toBe('1 of 2 rows selected');
    expect(getGroupSelectionViewStateHelper(ctx, group)).toEqual({
      checked: false,
      partial: true,
      title: '1 of 2 rows selected'
    });
  });

  it('keeps grouped selection state and parent selection emissions synchronous', () => {
    const rowA = { id: 'A' };
    const rowB = { id: 'B' };
    const group = { rows: [rowA, rowB] };
    let selected: unknown[] = [];
    const selectedRows = (() => selected) as (() => unknown[]) & {
      set(value: unknown[]): void;
    };
    selectedRows.set = (value: unknown[]) => {
      selected = value;
    };
    const selectionEmit = vi.fn();
    const changeEmit = vi.fn();
    const ctx = {
      selectedRows,
      onSelectionChange: { emit: selectionEmit },
      emitChange: changeEmit
    };

    toggleGroupSelectionHelper(ctx, group, {
      preventDefault() {
        return undefined;
      },
      stopPropagation() {
        return undefined;
      }
    });

    expect(selected).toEqual([rowA, rowB]);
    expect(selectionEmit).toHaveBeenCalledWith([rowA, rowB]);
    expect(changeEmit).toHaveBeenCalledWith('selection');
  });

  it('updates large group selection immediately and defers only parent emissions', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      return setTimeout(() => callback(0), 0) as unknown as number;
    });
    vi.stubGlobal('cancelAnimationFrame', (handle: number) => {
      clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
    });
    try {
      const rows = Array.from({ length: 300 }, (_, id) => ({ id }));
      const group = { rows };
      let selected: unknown[] = [];
      const selectedRows = (() => selected) as (() => unknown[]) & {
        set(value: unknown[]): void;
      };
      selectedRows.set = (value: unknown[]) => {
        selected = value;
      };
      const selectionEmit = vi.fn();
      const changeEmit = vi.fn();
      const markForCheck = vi.fn();

      toggleGroupSelectionHelper(
        {
          selectedRows,
          onSelectionChange: { emit: selectionEmit },
          emitChange: changeEmit,
          cdr: { markForCheck }
        },
        group,
        { stopPropagation: vi.fn() }
      );

      expect(selected).toEqual(rows);
      expect(markForCheck).toHaveBeenCalled();
      expect(selectionEmit).not.toHaveBeenCalled();
      expect(changeEmit).not.toHaveBeenCalled();

      vi.runOnlyPendingTimers();
      vi.runOnlyPendingTimers();

      expect(selected).toEqual(rows);
      expect(selectionEmit).toHaveBeenCalledWith(rows);
      expect(changeEmit).toHaveBeenCalledWith('selection');
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it('updates trusted generated group selections synchronously for large groups', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      return setTimeout(() => callback(0), 0) as unknown as number;
    });
    vi.stubGlobal('cancelAnimationFrame', (handle: number) => {
      clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
    });

    try {
      const rows = Array.from({ length: 300 }, (_, id) => ({ id }));
      const group = {
        id: 'status:open',
        field: 'status',
        value: 'Open',
        count: rows.length,
        rows
      };
      let selected: unknown[] = [];
      const selectedRows = (() => selected) as (() => unknown[]) & {
        set(value: unknown[]): void;
      };
      selectedRows.set = (value: unknown[]) => {
        selected = value;
      };
      const selectionEmit = vi.fn();
      const changeEmit = vi.fn();

      toggleGroupSelectionHelper(
        {
          selectedRows,
          selectedRowCount: () => selected.length,
          onSelectionChange: { emit: selectionEmit },
          emitChange: changeEmit,
          cdr: { markForCheck: vi.fn() }
        },
        group,
        { stopPropagation: vi.fn() }
      );

      expect(selected).toEqual(rows);
      expect(selectionEmit).not.toHaveBeenCalled();
      expect(changeEmit).not.toHaveBeenCalled();

      vi.runOnlyPendingTimers();
      vi.runOnlyPendingTimers();

      expect(selectionEmit).toHaveBeenCalledWith(rows);
      expect(changeEmit).toHaveBeenCalledWith('selection');
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it('marks remote group headers selected from loaded rows even when the group count is larger', () => {
    const rowA = { id: 'A' };
    const rowB = { id: 'B' };
    const group = { rows: [rowA, rowB], count: 420 };
    const ctx = {
      selectedRows() {
        return [rowA, rowB];
      },
      selectedRowCount() {
        return 2;
      }
    };

    expect(isGroupSelectedHelper(ctx, group)).toBe(true);
    expect(isGroupPartiallySelectedHelper(ctx, group)).toBe(false);
  });

  it('skips heavy grouped selection scans when nothing is selected', () => {
    const selectedRows = vi.fn(() => {
      throw new Error('selectedRows should not be scanned when selectedRowCount exists');
    });
    const getGroupData = vi.fn(() => {
      throw new Error('group rows should not be materialized when count is already known');
    });
    const group = { id: 'status:open', count: 420 };
    const ctx = {
      selectedRows,
      selectedRowCount: () => 0,
      getGroupData
    };

    expect(isGroupSelectedHelper(ctx, group)).toBe(false);
    expect(isGroupPartiallySelectedHelper(ctx, group)).toBe(false);
    expect(getGroupSelectionSummaryHelper(ctx, group)).toBe('0 of 420 rows selected');
    expect(getGroupSelectionViewStateHelper(ctx, group)).toEqual({
      checked: false,
      partial: false,
      title: '0 of 420 rows selected'
    });
    expect(selectedRows).not.toHaveBeenCalled();
    expect(getGroupData).not.toHaveBeenCalled();
  });

  it('computes performance row counts without materializing grouped display rows', () => {
    const displayRows = vi.fn(() => {
      throw new Error('performance stats should not materialize grouped display rows');
    });
    const processedData = vi.fn(() => {
      throw new Error('performance stats should not materialize grouped processed rows');
    });
    const selectedRows = vi.fn(() => {
      throw new Error('selectedRows should not be read when selectedRowCount exists');
    });

    const stats = getPerformanceStatsHelper({
      dataSignal: () => [{ id: 1 }, { id: 2 }, { __appendRow: true }],
      filteredSortedRowBuckets: () => ({ dataRows: [{ id: 1 }, { id: 2 }], appendRows: [] }),
      processedData,
      displayRows,
      selectedRowCount: () => 1,
      selectedRows,
      filterStates: () => [],
      sortStates: () => [],
      groupColumns: () => ['status'],
      renderTime: () => 12
    });

    expect(stats.visibleRows).toBe(2);
    expect(stats.selectedRows).toBe(1);
    expect(displayRows).not.toHaveBeenCalled();
    expect(processedData).not.toHaveBeenCalled();
    expect(selectedRows).not.toHaveBeenCalled();
  });

  it('selects a group from an empty selection without building a selected lookup scan', () => {
    const rowA = { id: 'A' };
    const rowB = { id: 'B' };
    const group = { id: 'status:open', rows: [rowA, rowB], count: 2 };
    let selected: unknown[] = [];
    const selectedRows = (() => selected) as (() => unknown[]) & {
      set(value: unknown[]): void;
    };
    selectedRows.set = (value: unknown[]) => {
      selected = value;
    };

    toggleGroupSelectionHelper(
      {
        selectedRows,
        selectedRowCount: () => 0,
        selectedRowLookup: vi.fn(() => {
          throw new Error('empty selection should not build a selected lookup');
        }),
        onSelectionChange: { emit: vi.fn() },
        emitChange: vi.fn()
      },
      group,
      { stopPropagation: vi.fn() }
    );

    expect(selected).toEqual([rowA, rowB]);
  });

  it('materializes unknown large group rows synchronously so row checkboxes update immediately', () => {
    const rows = Array.from({ length: 300 }, (_, id) => ({ id }));
    const group = { id: 'status:open', count: 300 };
    let selected: unknown[] = [];
    const selectedRows = (() => selected) as (() => unknown[]) & {
      set(value: unknown[]): void;
    };
    selectedRows.set = (value: unknown[]) => {
      selected = value;
    };
    const getGroupData = vi.fn(() => rows);
    const markForCheck = vi.fn();
    const ctx = {
      selectedRows,
      selectedRowCount: () => selected.length,
      getGroupData,
      onSelectionChange: { emit: vi.fn() },
      emitChange: vi.fn(),
      cdr: { markForCheck }
    };

    toggleGroupSelectionHelper(ctx, group, { stopPropagation: vi.fn() });

    expect(getGroupData).toHaveBeenCalledOnce();
    expect(selected).toEqual(rows);
    expect(getGroupSelectionViewStateHelper(ctx, group)).toEqual({
      checked: true,
      partial: false,
      title: '300 of 300 rows selected'
    });
    expect(markForCheck).toHaveBeenCalled();
  });

  it('uses row membership lookups for hot render selection and pin checks', () => {
    const rowA = { id: 'A' };
    const rowB = { id: 'B' };
    const selectedRows = vi.fn(() => {
      throw new Error('selectedRows should not be scanned when lookup exists');
    });
    const pinnedRows = vi.fn(() => {
      throw new Error('pinnedRows should not be scanned when lookup exists');
    });

    const ctx = {
      selectedRows,
      selectedRowLookup() {
        return new Set([rowA]);
      },
      pinnedRows,
      pinnedRowLookup() {
        return new Set([rowB]);
      }
    };

    expect(isRowSelectedHelper(ctx, rowA)).toBe(true);
    expect(isRowSelectedHelper(ctx, rowB)).toBe(false);
    expect(isRowPinnedHelper(ctx, rowB)).toBe(true);
    expect(isRowPinnedHelper(ctx, rowA)).toBe(false);
    expect(selectedRows).not.toHaveBeenCalled();
    expect(pinnedRows).not.toHaveBeenCalled();
  });

  it('does not build the full processed row index for normal indexed row selection', () => {
    const row = { id: 1 };
    let selected: unknown[] = [];
    const selectedRows = (() => selected) as (() => unknown[]) & {
      set(value: unknown[]): void;
    };
    selectedRows.set = (value: unknown[]) => {
      selected = value;
    };
    const processedDataRowIndexLookup = vi.fn(() => {
      throw new Error('processedDataRowIndexLookup should be reserved for shift-click fallback');
    });
    const processedData = vi.fn(() => {
      throw new Error('processedData should not be scanned for a normal indexed click');
    });

    toggleRowSelectionHelper(
      {
        config: { selectMode: 'multiple' },
        selectedRows,
        selectedRowLookup: () => new Set(selected),
        processedDataRowIndexLookup,
        processedData,
        lastSelectedIndex: -1,
        onSelectionChange: { emit: vi.fn() },
        emitChange: vi.fn()
      },
      row,
      { shiftKey: false },
      42
    );

    expect(selected).toEqual([row]);
    expect(processedDataRowIndexLookup).not.toHaveBeenCalled();
    expect(processedData).not.toHaveBeenCalled();
  });

  it('computes body row numbering from the global row index', () => {
    const rowA = { id: 'A' };

    expect(
      getRowSelectionNumberHelper(
        {
          config: {
            remoteData: false
          },
          getGlobalRowIndex(row: unknown) {
            return row === rowA ? 4 : -1;
          }
        },
        rowA
      )
    ).toBe(5);
  });

  it('returns no body row number for append rows', () => {
    expect(
      getRowSelectionNumberHelper(
        {
          config: {
            remoteData: false
          },
          getGlobalRowIndex() {
            return 0;
          }
        },
        { __appendRow: true }
      )
    ).toBeNull();
  });

  it('adds the current remote page offset to body row numbering', () => {
    const rowA = { id: 'A' };

    expect(
      getRowSelectionNumberHelper(
        {
          config: {
            remoteData: true
          },
          paginationState() {
            return {
              currentPage: 3,
              pageSize: 25,
              totalRecords: 300
            };
          },
          getGlobalRowIndex(row: unknown) {
            return row === rowA ? 2 : -1;
          }
        },
        rowA
      )
    ).toBe(53);
  });

  it('ignores selection toggles for append rows', () => {
    let selected: unknown[] = [];
    const selectedRows = (() => selected) as (() => unknown[]) & {
      set(value: unknown[]): void;
      update(updater: (value: unknown[]) => unknown[]): void;
    };
    selectedRows.set = (value: unknown[]) => {
      selected = value;
    };
    selectedRows.update = (updater: (value: unknown[]) => unknown[]) => {
      selected = updater(selected);
    };

    toggleRowSelectionHelper(
      {
        config: { selectMode: 'checkbox' },
        selectedRows,
        processedData() {
          return [{ __appendRow: true }];
        }
      },
      { __appendRow: true }
    );

    expect(selected).toEqual([]);
  });

  it('uses processed row index lookups for normal selection toggles without scanning rows', () => {
    const rowA = { id: 'A' };
    let selected: unknown[] = [];
    const selectedRows = (() => selected) as (() => unknown[]) & {
      set(value: unknown[]): void;
    };
    selectedRows.set = (value: unknown[]) => {
      selected = value;
    };
    const processedData = vi.fn(() => {
      throw new Error('processedData should not be scanned when lookup exists');
    });
    const ctx = {
      config: { selectMode: 'checkbox' },
      selectedRows,
      processedData,
      processedDataRowIndexLookup() {
        return new WeakMap<object, number>([[rowA, 12]]);
      },
      onSelectionChange: {
        emit() {
          return undefined;
        }
      },
      emitChange() {
        return undefined;
      },
      lastSelectedIndex: -1
    };

    toggleRowSelectionHelper(ctx, rowA, {});

    expect(selected).toEqual([rowA]);
    expect(ctx.lastSelectedIndex).toBe(12);
    expect(processedData).not.toHaveBeenCalled();
  });

  it('creates and starts editing a real row when the append row is clicked', () => {
    const rowA = { id: 'A' };
    const rowB = { id: 'B' };
    const appendRow = { __appendRow: true, __gridRowKey: '__append-row__' };
    const createdRow: Record<string, unknown> = { item: '', description: '' };
    const inserted: Array<{ referenceRow: unknown; newRow: unknown }> = [];
    const activeCellState = { value: null as { rowIndex: number; columnIndex: number } | null };
    const activeCell = (() => activeCellState.value) as (() => {
      rowIndex: number;
      columnIndex: number;
    } | null) & {
      set(next: { rowIndex: number; columnIndex: number }): void;
    };
    activeCell.set = (next: { rowIndex: number; columnIndex: number }) => {
      activeCellState.value = next;
    };
    const startEdit = vi.fn();
    const emitChange = vi.fn();
    const stopPropagation = vi.fn();
    const preventDefault = vi.fn();
    const descriptionColumn = { field: 'description', editable: true };

    handleCellClickHelper(
      {
        config: {
          appendRow: true,
          editMode: 'cell'
        },
        getEventTargetElement() {
          return {
            closest(selector: string) {
              if (selector === '.data-grid-link[data-link]') {
                return null;
              }
              if (selector === 'td') {
                return {
                  querySelector() {
                    return null;
                  }
                };
              }
              return null;
            }
          };
        },
        buildEmptyRow() {
          return createdRow;
        },
        assignRowKey(row: Record<string, unknown>) {
          row.__gridRowKey = 'created-row';
        },
        processedData() {
          return [rowA, rowB, appendRow];
        },
        dataSignal() {
          return [rowA, rowB];
        },
        insertRowAfter(referenceRow: unknown, newRow: unknown) {
          inserted.push({ referenceRow, newRow });
        },
        emitChange,
        visibleColumns() {
          return [{ field: 'item', editable: true }, descriptionColumn];
        },
        activeCell,
        startEdit,
        onCellAction: {
          emit() {
            return undefined;
          }
        }
      },
      appendRow,
      descriptionColumn,
      { stopPropagation, preventDefault }
    );

    expect(inserted).toEqual([{ referenceRow: rowB, newRow: createdRow }]);
    expect(emitChange).toHaveBeenCalledWith('edit');
    expect(activeCellState.value).toEqual({ rowIndex: 2, columnIndex: 1 });
    expect(startEdit).toHaveBeenCalledWith(2, descriptionColumn);
    expect(createdRow.__gridRowKey).toBe('created-row');
    expect(stopPropagation).toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalled();
  });

  it('emits a cell action for explicit in-cell action controls without starting edit', () => {
    const row = { id: 'A', description: 'Open me' };
    const column = { field: 'description', editable: true };
    const actionEl = {};
    const emit = vi.fn();
    const startEdit = vi.fn();
    const stopPropagation = vi.fn();
    const preventDefault = vi.fn();

    handleCellClickHelper(
      {
        config: {
          singleClickEdit: true,
          editMode: 'cell'
        },
        getEventTargetElement() {
          return {
            closest(selector: string) {
              if (selector === '[data-grid-cell-action], .data-grid-cell-action') {
                return actionEl;
              }
              return null;
            }
          };
        },
        onCellAction: { emit },
        getGlobalRowIndex: vi.fn(() => 0),
        visibleColumns: vi.fn(() => [column]),
        activeCell: Object.assign(vi.fn(() => null), { set: vi.fn() }),
        startEdit
      },
      row,
      column,
      { stopPropagation, preventDefault }
    );

    expect(emit).toHaveBeenCalledWith({
      row,
      column,
      event: { stopPropagation, preventDefault }
    });
    expect(startEdit).not.toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalled();
  });

  it('emits a delayed cell action for configured text clicks', () => {
    vi.useFakeTimers();
    const row = { id: 'A', description: 'Open me' };
    const column = { field: 'description', editable: true, textClickAction: true };
    const textEl = {};
    const emit = vi.fn();
    const startEdit = vi.fn();
    const stopPropagation = vi.fn();
    const preventDefault = vi.fn();

    handleCellClickHelper(
      {
        config: {
          singleClickEdit: true,
          editMode: 'cell'
        },
        getEventTargetElement() {
          return {
            closest(selector: string) {
              if (selector === '[data-grid-cell-action], .data-grid-cell-action') {
                return null;
              }
              if (selector === '[data-grid-cell-text-action]') {
                return textEl;
              }
              return null;
            }
          };
        },
        onCellAction: { emit },
        getGlobalRowIndex: vi.fn(() => 0),
        visibleColumns: vi.fn(() => [column]),
        activeCell: Object.assign(vi.fn(() => null), { set: vi.fn() }),
        startEdit
      },
      row,
      column,
      { stopPropagation, preventDefault }
    );

    expect(emit).not.toHaveBeenCalled();
    expect(startEdit).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();

    expect(emit).toHaveBeenCalledWith({
      row,
      column,
      event: { stopPropagation, preventDefault }
    });
    expect(startEdit).not.toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('cancels text click action and starts edit on configured text double click', () => {
    vi.useFakeTimers();
    const row = { id: 'A', description: 'Open me' };
    const column = {
      field: 'description',
      editable: true,
      textClickAction: true,
      textDoubleClickEdit: true
    };
    const textEl = {};
    const emit = vi.fn();
    const startEdit = vi.fn();
    const stopPropagation = vi.fn();
    const preventDefault = vi.fn();
    const target = {
      closest(selector: string) {
        if (selector === '[data-grid-cell-action], .data-grid-cell-action') {
          return null;
        }
        if (selector === '[data-grid-cell-text-action]') {
          return textEl;
        }
        return null;
      }
    };
    const ctx = {
      config: {
        singleClickEdit: true,
        editMode: 'cell'
      },
      getEventTargetElement: vi.fn(() => target),
      onCellAction: { emit },
      getGlobalRowIndex: vi.fn(() => 0),
      visibleColumns: vi.fn(() => [column]),
      activeCell: Object.assign(vi.fn(() => null), { set: vi.fn() }),
      startEdit
    };

    handleCellClickHelper(ctx, row, column, { stopPropagation, preventDefault });
    handleCellDoubleClickHelper(ctx, row, column, { stopPropagation, preventDefault }, false);
    vi.runOnlyPendingTimers();

    expect(emit).not.toHaveBeenCalled();
    expect(startEdit).toHaveBeenCalledWith(0, column);
    expect(stopPropagation).toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('moves down to the same column and creates a new row when Enter reaches the append row', () => {
    const rowA: Record<string, unknown> = { id: 'A', description: 'old' };
    const appendRow = { __appendRow: true, __gridRowKey: '__append-row__' };
    const createdRow: Record<string, unknown> = { item: '', description: '' };
    const inserted: Array<{ referenceRow: unknown; newRow: unknown }> = [];
    const activeCellState = { value: null as { rowIndex: number; columnIndex: number } | null };
    const activeCell = (() => activeCellState.value) as (() => {
      rowIndex: number;
      columnIndex: number;
    } | null) & {
      set(next: { rowIndex: number; columnIndex: number }): void;
    };
    activeCell.set = (next: { rowIndex: number; columnIndex: number }) => {
      activeCellState.value = next;
    };
    const editingCellState = {
      value: { rowIndex: 0, field: 'description' } as { rowIndex: number; field: string } | null
    };
    const editingCell = (() => editingCellState.value) as (() => {
      rowIndex: number;
      field: string;
    } | null) & {
      set(next: { rowIndex: number; field: string } | null): void;
    };
    editingCell.set = (next: { rowIndex: number; field: string } | null) => {
      editingCellState.value = next;
    };
    const descriptionColumn = { field: 'description', editable: true };
    const startEdit = vi.fn();
    const emitChange = vi.fn();
    const columnRangeCache = { delete: vi.fn() };
    const columnStatsCache = { delete: vi.fn() };
    const cellValueCache = { clear: vi.fn() };
    const bumpAggregateCache = vi.fn();

    saveEditHelper(
      {
        config: {
          appendRow: true,
          editMode: 'cell',
          enterNavigatesNextCell: true,
          enterNavigationDirection: 'down'
        },
        editingCell,
        invalidateFilteredSortedCache: vi.fn(),
        columnRangeCache,
        columnStatsCache,
        cellValueCache,
        bumpAggregateCache,
        onCellEdit: { emit: vi.fn() },
        emitChange,
        flashCell: vi.fn(),
        visibleColumns() {
          return [{ field: 'item', editable: true }, descriptionColumn];
        },
        processedData() {
          return [rowA, appendRow];
        },
        buildEmptyRow() {
          return createdRow;
        },
        assignRowKey(row: Record<string, unknown>) {
          row.__gridRowKey = 'created-row';
        },
        insertRowAfter(referenceRow: unknown, newRow: unknown) {
          inserted.push({ referenceRow, newRow });
        },
        activeCell,
        scrollToActiveCell: vi.fn(),
        startEdit
      },
      rowA,
      descriptionColumn,
      'new value'
    );

    expect(rowA.description).toBe('new value');
    expect(inserted).toEqual([{ referenceRow: rowA, newRow: createdRow }]);
    expect(createdRow.__gridRowKey).toBe('created-row');
    expect(activeCellState.value).toEqual({ rowIndex: 1, columnIndex: 1 });
    expect(startEdit).toHaveBeenCalledWith(1, descriptionColumn);
    expect(columnRangeCache.delete).toHaveBeenCalledWith('description');
    expect(columnStatsCache.delete).toHaveBeenCalledWith('description');
    expect(cellValueCache.clear).toHaveBeenCalledOnce();
    expect(bumpAggregateCache).toHaveBeenCalledOnce();
    expect(emitChange).toHaveBeenCalledOnce();
  });

  it('does not create a new row when a blur save reaches the append row', () => {
    const rowA: Record<string, unknown> = { id: 'A', description: 'old' };
    const appendRow = { __appendRow: true, __gridRowKey: '__append-row__' };
    const descriptionColumn = { field: 'description', editable: true };
    const inserted: Array<{ referenceRow: unknown; newRow: unknown }> = [];
    const activeCell = createSignalState<{ rowIndex: number; columnIndex: number } | null>({
      rowIndex: 0,
      columnIndex: 1
    });
    const editingCell = createSignalState<{ rowIndex: number; field: string } | null>({
      rowIndex: 0,
      field: 'description'
    });
    const emitChange = vi.fn();
    const startEdit = vi.fn();

    saveEditHelper(
      {
        config: {
          appendRow: true,
          editMode: 'cell',
          enterNavigatesNextCell: true,
          enterNavigationDirection: 'down'
        },
        suppressNextEditNavigation: true,
        editingCell,
        invalidateFilteredSortedCache: vi.fn(),
        columnRangeCache: { delete: vi.fn() },
        columnStatsCache: { delete: vi.fn() },
        cellValueCache: { clear: vi.fn() },
        spreadsheetFormulaCache: { clear: vi.fn() },
        bumpAggregateCache: vi.fn(),
        onCellEdit: { emit: vi.fn() },
        emitChange,
        flashCell: vi.fn(),
        visibleColumns() {
          return [{ field: 'item', editable: true }, descriptionColumn];
        },
        processedData() {
          return [rowA, appendRow];
        },
        buildEmptyRow() {
          return { item: '', description: '' };
        },
        assignRowKey: vi.fn(),
        insertRowAfter(referenceRow: unknown, newRow: unknown) {
          inserted.push({ referenceRow, newRow });
        },
        activeCell,
        scrollToActiveCell: vi.fn(),
        startEdit
      },
      rowA,
      descriptionColumn,
      'new value'
    );

    expect(rowA.description).toBe('new value');
    expect(inserted).toEqual([]);
    expect(activeCell()).toEqual({ rowIndex: 0, columnIndex: 1 });
    expect(startEdit).not.toHaveBeenCalled();
    expect(emitChange).toHaveBeenCalledOnce();
  });

  it('restores the active cell to the edited cell after formula reference picking', () => {
    const row: Record<string, unknown> = { qty: 0, rate: 43 };
    const qtyColumn = { field: 'qty', editable: true };
    const activeCell = createSignalState<{ rowIndex: number; columnIndex: number } | null>({
      rowIndex: 0,
      columnIndex: 1
    });
    const editingCell = createSignalState<{ rowIndex: number; field: string } | null>({
      rowIndex: 0,
      field: 'qty'
    });
    const emitChange = vi.fn();

    saveEditHelper(
      {
        config: {},
        editingCell,
        invalidateFilteredSortedCache: vi.fn(),
        columnRangeCache: { delete: vi.fn() },
        columnStatsCache: { delete: vi.fn() },
        cellValueCache: { clear: vi.fn() },
        spreadsheetFormulaCache: { clear: vi.fn() },
        bumpAggregateCache: vi.fn(),
        onCellEdit: { emit: vi.fn() },
        emitChange,
        flashCell: vi.fn(),
        visibleColumns() {
          return [qtyColumn, { field: 'rate', editable: true }];
        },
        activeCell
      },
      row,
      qtyColumn,
      '=Rate@1'
    );

    expect(row.qty).toBe('=Rate@1');
    expect(activeCell()).toEqual({ rowIndex: 0, columnIndex: 0 });
    expect(emitChange).toHaveBeenCalledWith('edit');
  });

  it('clears derived caches and emits one batch edit event for changed multi-edit rows', () => {
    const rowA: Record<string, unknown> = { id: 'A', status: 'old' };
    const rowB: Record<string, unknown> = { id: 'B', status: 'old' };
    const appendRow: Record<string, unknown> = { id: 'append', status: 'old', __appendRow: true };
    const onBatchEditEmit = vi.fn();
    const emitChange = vi.fn();
    const columnRangeCache = { delete: vi.fn() };
    const columnStatsCache = { delete: vi.fn() };
    const cellValueCache = { clear: vi.fn() };
    const bumpAggregateCache = vi.fn();

    const changedCount = batchEditFieldHelper(
      {
        selectedRows() {
          return [rowA, rowB, rowA, appendRow];
        },
        invalidateFilteredSortedCache: vi.fn(),
        columnRangeCache,
        columnStatsCache,
        cellValueCache,
        bumpAggregateCache,
        onBatchEdit: { emit: onBatchEditEmit },
        emitChange
      },
      'status',
      'new'
    );

    expect(rowA.status).toBe('new');
    expect(rowB.status).toBe('new');
    expect(appendRow.status).toBe('old');
    expect(columnRangeCache.delete).toHaveBeenCalledWith('status');
    expect(columnStatsCache.delete).toHaveBeenCalledWith('status');
    expect(cellValueCache.clear).toHaveBeenCalledOnce();
    expect(bumpAggregateCache).toHaveBeenCalledOnce();
    expect(onBatchEditEmit).toHaveBeenCalledWith({
      rows: [rowA, rowB],
      field: 'status',
      value: 'new'
    });
    expect(emitChange).toHaveBeenCalledOnce();
    expect(emitChange).toHaveBeenCalledWith('edit');
    expect(changedCount).toBe(2);
  });

  it('skips multi-edit cache invalidation and events when selected values are unchanged', () => {
    const rowA: Record<string, unknown> = { id: 'A', status: 'new' };
    const rowB: Record<string, unknown> = { id: 'B', status: 'new' };
    const invalidateFilteredSortedCache = vi.fn();
    const onBatchEditEmit = vi.fn();
    const emitChange = vi.fn();
    const columnRangeCache = { delete: vi.fn() };
    const columnStatsCache = { delete: vi.fn() };
    const cellValueCache = { clear: vi.fn() };
    const bumpAggregateCache = vi.fn();

    const changedCount = batchEditFieldHelper(
      {
        selectedRows() {
          return [rowA, rowB];
        },
        invalidateFilteredSortedCache,
        columnRangeCache,
        columnStatsCache,
        cellValueCache,
        bumpAggregateCache,
        onBatchEdit: { emit: onBatchEditEmit },
        emitChange
      },
      'status',
      'new'
    );

    expect(changedCount).toBe(0);
    expect(invalidateFilteredSortedCache).not.toHaveBeenCalled();
    expect(columnRangeCache.delete).not.toHaveBeenCalled();
    expect(columnStatsCache.delete).not.toHaveBeenCalled();
    expect(cellValueCache.clear).not.toHaveBeenCalled();
    expect(bumpAggregateCache).not.toHaveBeenCalled();
    expect(onBatchEditEmit).not.toHaveBeenCalled();
    expect(emitChange).not.toHaveBeenCalled();
  });
});
