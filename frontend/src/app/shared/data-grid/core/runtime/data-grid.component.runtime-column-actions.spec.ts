import { describe, expect, it, vi } from 'vitest';
import { registerGridFeedbackHandlers } from '../../utils/feedback';

import {
  autoSizeAllColumnsInternalHelper,
  deleteColumnHelper,
  getColumnDataTypeHelper,
  insertColumnRelativeHelper,
  moveColumnLeftHelper,
  moveColumnRightHelper,
  saveColumnDropdownOptionsHelper,
  setColumnDataTypeHelper
} from './data-grid.component.runtime-column-actions';

describe('data-grid.component.runtime-column-actions', () => {
  it('auto-sizes only unsized columns during automatic auto-size and syncs once', () => {
    const sizedColumn = { field: 'name', width: 180 };
    const unsizedColumn = { field: 'owner' };
    const autoSizeColumn = vi.fn();
    const syncHeaderBodyWidths = vi.fn();
    const saveState = vi.fn();

    const ctx = {
      visibleColumns: () => [sizedColumn, unsizedColumn],
      autoSizeColumn,
      syncHeaderBodyWidths,
      saveState,
      stateKey: 'grid-state',
      automaticAutoSizeApplied: false
    };

    autoSizeAllColumnsInternalHelper(ctx, { automatic: true, save: false });

    expect(autoSizeColumn).toHaveBeenCalledTimes(1);
    expect(autoSizeColumn).toHaveBeenCalledWith(unsizedColumn, null, {
      automatic: true,
      notify: false,
      save: false,
      sync: false
    });
    expect(syncHeaderBodyWidths).toHaveBeenCalledTimes(1);
    expect(saveState).not.toHaveBeenCalled();
    expect(ctx.automaticAutoSizeApplied).toBe(true);
  });

  it('auto-sizes all visible columns during manual auto-size and saves once', () => {
    const firstColumn = { field: 'name', width: 180 };
    const secondColumn = { field: 'owner' };
    const autoSizeColumn = vi.fn();
    const syncHeaderBodyWidths = vi.fn();
    const saveState = vi.fn();

    const ctx = {
      visibleColumns: () => [firstColumn, secondColumn],
      autoSizeColumn,
      syncHeaderBodyWidths,
      saveState,
      stateKey: 'grid-state',
      automaticAutoSizeApplied: false
    };

    autoSizeAllColumnsInternalHelper(ctx);

    expect(autoSizeColumn).toHaveBeenCalledTimes(2);
    expect(autoSizeColumn).toHaveBeenNthCalledWith(1, firstColumn, null, {
      automatic: false,
      notify: false,
      save: false,
      sync: false
    });
    expect(autoSizeColumn).toHaveBeenNthCalledWith(2, secondColumn, null, {
      automatic: false,
      notify: false,
      save: false,
      sync: false
    });
    expect(syncHeaderBodyWidths).toHaveBeenCalledTimes(1);
    expect(saveState).toHaveBeenCalledTimes(1);
  });

  it('inserts a new editable column to the right and starts header editing', () => {
    const firstColumn = { field: 'name', header: 'Name' };
    const secondColumn = { field: 'owner', header: 'Owner', align: 'center', pinned: 'left' };
    const markForCheck = vi.fn();
    const emitColumnsChange = vi.fn();
    const saveState = vi.fn();
    const editingHeaderField = { set: vi.fn() };
    const editingHeaderValue = { set: vi.fn() };
    const focus = vi.fn();
    const select = vi.fn();
    const requestAnimationFrameSpy = vi
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation(callback => {
        callback(0);
        return 1;
      });

    const ctx = {
      columns: [firstColumn, secondColumn],
      getColumnField(column: { field: string }) {
        return column.field;
      },
      cdr: { markForCheck },
      emitColumnsChange,
      saveState,
      stateKey: 'grid-state',
      editingHeaderField,
      editingHeaderValue,
      elementRef: {
        nativeElement: {
          querySelector: vi.fn(() => ({ focus, select }))
        }
      }
    };

    insertColumnRelativeHelper(ctx, secondColumn, 'right');

    expect(ctx.columns).toHaveLength(3);
    expect(ctx.columns.map(column => column.field)).toEqual(['owner', 'column1', 'name']);
    expect(ctx.columns[1]).toMatchObject({
      field: 'column1',
      header: 'Column 1',
      headerEditable: true,
      editable: true,
      sortable: true,
      filterable: true,
      resizable: true,
      type: 'text',
      align: 'center',
      pinned: 'left'
    });
    expect(markForCheck).toHaveBeenCalledOnce();
    expect(emitColumnsChange).toHaveBeenCalledOnce();
    expect(saveState).toHaveBeenCalledOnce();
    expect(editingHeaderField.set).toHaveBeenCalledWith('column1');
    expect(editingHeaderValue.set).toHaveBeenCalledWith('Column 1');
    expect(focus).toHaveBeenCalledOnce();
    expect(select).toHaveBeenCalledOnce();

    requestAnimationFrameSpy.mockRestore();
  });

  it('keeps move actions inside the current pinned section', () => {
    const columns = [
      { field: 'left', pinned: 'left' },
      { field: 'name' },
      { field: 'owner' },
      { field: 'right', pinned: 'right' }
    ];
    const ctx = {
      columns,
      getColumnField(column: { field: string }) {
        return column.field;
      },
      cdr: { markForCheck: vi.fn() },
      syncHeaderBodyWidths: vi.fn(),
      emitColumnsChange: vi.fn(),
      saveState: vi.fn(),
      stateKey: 'grid-state',
      closeColumnContextMenu: vi.fn()
    };

    moveColumnLeftHelper(ctx, columns[1]);

    expect(ctx.columns.map(column => column.field)).toEqual(['left', 'name', 'owner', 'right']);
    expect(ctx.emitColumnsChange).not.toHaveBeenCalled();
    expect(ctx.syncHeaderBodyWidths).not.toHaveBeenCalled();
    expect(ctx.closeColumnContextMenu).toHaveBeenCalledOnce();
  });

  it('normalizes stale pinned ordering before moving a column', () => {
    const normal = { field: 'name' };
    const pinnedLeft = { field: 'left', pinned: 'left' };
    const owner = { field: 'owner' };
    const pinnedRight = { field: 'right', pinned: 'right' };
    const ctx = {
      columns: [normal, pinnedLeft, pinnedRight, owner],
      getColumnField(column: { field: string }) {
        return column.field;
      },
      cdr: { markForCheck: vi.fn() },
      syncHeaderBodyWidths: vi.fn(),
      emitColumnsChange: vi.fn(),
      saveState: vi.fn(),
      stateKey: 'grid-state',
      closeColumnContextMenu: vi.fn()
    };

    moveColumnLeftHelper(ctx, owner);

    expect(ctx.columns.map(column => column.field)).toEqual(['left', 'owner', 'name', 'right']);
    expect(ctx.syncHeaderBodyWidths).toHaveBeenCalledOnce();
    expect(ctx.emitColumnsChange).toHaveBeenCalledOnce();
    expect(ctx.saveState).toHaveBeenCalledOnce();
    expect(ctx.closeColumnContextMenu).toHaveBeenCalledOnce();

    moveColumnRightHelper(ctx, pinnedLeft);

    expect(ctx.columns.map(column => column.field)).toEqual(['left', 'owner', 'name', 'right']);
  });

  it('generates the next free field and header when column names already exist', () => {
    const ctx = {
      columns: [
        { field: 'column1', header: 'Column 1' },
        { field: 'column2', header: 'Column 2' }
      ],
      getColumnField(column: { field: string }) {
        return column.field;
      },
      cdr: { markForCheck: vi.fn() },
      emitColumnsChange: vi.fn(),
      editingHeaderField: { set: vi.fn() },
      editingHeaderValue: { set: vi.fn() },
      elementRef: {
        nativeElement: {
          querySelector: vi.fn(() => null)
        }
      }
    };

    insertColumnRelativeHelper(ctx, ctx.columns[0], 'left');

    expect(ctx.columns[0]).toMatchObject({
      field: 'column3',
      header: 'Column 3'
    });
  });

  it('removes a column, cleans its related state, and emits columns change once', () => {
    const resetGridFeedbackHandlers = registerGridFeedbackHandlers({
      confirm: (_message, options) => {
        options.onConfirm();
      }
    });

    const markForCheck = vi.fn();
    const emitColumnsChange = vi.fn();
    const saveState = vi.fn();
    const closeColumnContextMenu = vi.fn();
    const quickFilterValues = Object.assign(
      vi.fn(
        () =>
          new Map([
            ['owner', 'abc'],
            ['name', 'ok']
          ])
      ),
      {
        set: vi.fn()
      }
    );
    const groupColumns = Object.assign(
      vi.fn(() => ['owner', 'name']),
      {
        update: vi.fn(updater => updater(['owner', 'name']))
      }
    );
    const wrappedColumns = Object.assign(
      vi.fn(() => new Set(['owner'])),
      {
        update: vi.fn(updater => updater(new Set(['owner'])))
      }
    );
    const duplicateHighlightColumns = Object.assign(
      vi.fn(() => new Set(['owner'])),
      {
        update: vi.fn(updater => updater(new Set(['owner'])))
      }
    );
    const editingHeaderField = Object.assign(
      vi.fn(() => 'owner'),
      {
        set: vi.fn()
      }
    );
    const editingHeaderValue = { set: vi.fn() };
    const columns = [
      { field: 'name', header: 'Name' },
      { field: 'owner', header: 'Owner' },
      { field: 'notes', header: 'Notes' }
    ];
    const ctx = {
      columns,
      getColumnField(column: { field: string }) {
        return column.field;
      },
      sortStates: {
        update: vi.fn(updater =>
          updater([
            { field: 'owner', direction: 'asc', order: 0 },
            { field: 'name', direction: 'desc', order: 1 }
          ])
        )
      },
      filterStates: {
        update: vi.fn(updater =>
          updater([
            { field: 'owner', operator: 'contains', value: 'abc' },
            { field: 'name', operator: 'contains', value: 'ok' }
          ])
        )
      },
      quickFilterValues,
      groupColumns,
      resetGroupExpansion: vi.fn(),
      wrappedColumns,
      duplicateHighlightColumns,
      columnAutoWidthCache: new Map([['owner', 180]]),
      columnMinWidthCache: new Map([['owner', 96]]),
      columnRangeCache: new Map([['owner', { min: 1, max: 10 }]]),
      columnStatsCache: new Map([['owner', { mean: 3, std: 1 }]]),
      columnHiddenSnapshot: new Map([['owner', false]]),
      columnWidthLocks: new Map([['owner', { minWidth: 96 }]]),
      initialColumnState: new Map([['owner', { width: 180 }]]),
      initialColumnOrder: ['name', 'owner', 'notes'],
      activeFilterColumn: { field: 'owner', header: 'Owner' },
      closeFilterMenu: vi.fn(),
      editingHeaderField,
      editingHeaderValue,
      cdr: { markForCheck },
      emitColumnsChange,
      saveState,
      stateKey: 'grid-state',
      closeColumnContextMenu
    };

    deleteColumnHelper(ctx, columns[1]);

    expect(ctx.columns.map(column => column.field)).toEqual(['name', 'notes']);
    expect(markForCheck).toHaveBeenCalledOnce();
    expect(emitColumnsChange).toHaveBeenCalledOnce();
    expect(saveState).toHaveBeenCalledOnce();
    expect(ctx.columnAutoWidthCache.has('owner')).toBe(false);
    expect(quickFilterValues.set).toHaveBeenCalledOnce();
    expect(groupColumns.update).toHaveBeenCalledOnce();
    expect(ctx.resetGroupExpansion).toHaveBeenCalledOnce();
    expect(editingHeaderField.set).toHaveBeenCalledWith(null);
    expect(editingHeaderValue.set).toHaveBeenCalledWith('');
    expect(closeColumnContextMenu).toHaveBeenCalledOnce();

    resetGridFeedbackHandlers();
  });

  it('configures a dropdown column and de-duplicates entered options', () => {
    const column = { field: 'status', header: 'Status' };
    const ctx = {
      columns: [column],
      columnDropdownOptionsDraft: 'Open\nClosed\nopen, Pending',
      cdr: { markForCheck: vi.fn() },
      emitColumnsChange: vi.fn(),
      saveState: vi.fn(),
      stateKey: 'grid-state'
    };

    setColumnDataTypeHelper(ctx, column, 'dropdown');
    saveColumnDropdownOptionsHelper(ctx, column);

    expect(column).toMatchObject({
      type: 'dropdown',
      cellType: 'search-select',
      filterType: 'select',
      options: [
        { label: 'Open', value: 'Open' },
        { label: 'Closed', value: 'Closed' },
        { label: 'Pending', value: 'Pending' }
      ]
    });
    expect(ctx.emitColumnsChange).toHaveBeenCalledTimes(2);
    expect(ctx.saveState).toHaveBeenCalledTimes(2);
  });

  it('reports configured search-select columns as dropdown data columns', () => {
    expect(getColumnDataTypeHelper({}, { field: 'assignTo', cellType: 'search-select' })).toBe(
      'dropdown'
    );
    expect(getColumnDataTypeHelper({}, { field: 'owner', searchSelect: { options: [] } })).toBe(
      'dropdown'
    );
  });

  it('keeps managed search-select column wiring intact when choosing another data type', () => {
    const column = {
      field: 'assignTo',
      header: 'Assign To',
      cellType: 'search-select',
      searchSelect: { options: [] }
    };
    const ctx = {
      columns: [column],
      cdr: { markForCheck: vi.fn() },
      emitColumnsChange: vi.fn(),
      saveState: vi.fn()
    };

    setColumnDataTypeHelper(ctx, column, 'text');

    expect(column).toMatchObject({
      cellType: 'search-select',
      searchSelect: { options: [] }
    });
    expect(ctx.emitColumnsChange).not.toHaveBeenCalled();
  });
});
