import { describe, expect, it, vi } from 'vitest';

import {
  bookmarkSelectedRowsHelper,
  getSpreadsheetCellValueHelper,
  isNumericColumnHelper,
  onPasteSpreadsheetHelper,
  isRowBookmarkedHelper,
  setSpreadsheetCellValueHelper,
  setDataInternalHelper
} from './data-grid.component.part5.logic';
import { FormulaEngineService } from '../../services/formula';

describe('data-grid.component.part5.logic', () => {
  it('evaluates formulas with visible column names and row numbers', () => {
    const rows: Array<Record<string, unknown>> = [
      {
        rate: 43,
        qty: 2,
        quoteRate: 5,
        total: '=Rate@1 + Qty@1 + [Quote Rate]@1'
      }
    ];
    const columns = [
      { field: 'rate', header: 'Rate' },
      { field: 'qty', header: 'Qty' },
      { field: 'quoteRate', header: 'Quote Rate' },
      { field: 'total', header: 'Total' }
    ];
    const ctx = {
      config: { spreadsheetMode: true },
      spreadsheetFormulaCache: new Map<string, unknown>(),
      formulaEngine: new FormulaEngineService(),
      isSpreadsheetMode: () => true,
      visibleColumns: () => columns,
      getColumnField: (column: { field: string }) => column.field,
      getCellValueAt: (row: number, col: number) => rows[row]?.[columns[col]?.field],
      getSpreadsheetCellValue: (row: number, col: number) =>
        getSpreadsheetCellValueHelper(ctx, row, col)
    };

    expect(getSpreadsheetCellValueHelper(ctx, 0, 3)).toBe(50);
  });

  it('invalidates caches and pagination immediately when internal rows change', () => {
    const rows = [{ id: 1 }, { id: 2 }];
    const dataSignalState = { value: [] as unknown[] };
    const selectionUndoSnapshotState = { value: [{ id: 'stale' }] as unknown[] | null };
    const selectionUndoLabelState = { value: 'Selection restored' };
    const dataSignal = (() => dataSignalState.value) as (() => unknown[]) & {
      set(value: unknown[]): void;
    };
    dataSignal.set = (value: unknown[]) => {
      dataSignalState.value = value;
    };
    const selectionUndoSnapshot = (() => selectionUndoSnapshotState.value) as (() =>
      | unknown[]
      | null) & {
      set(value: unknown[] | null): void;
    };
    selectionUndoSnapshot.set = (value: unknown[] | null) => {
      selectionUndoSnapshotState.value = value;
    };
    const selectionUndoLabel = (() => selectionUndoLabelState.value) as (() => string) & {
      set(value: string): void;
    };
    selectionUndoLabel.set = (value: string) => {
      selectionUndoLabelState.value = value;
    };

    const ctx = {
      _data: [] as unknown[],
      dataSignal,
      gridService: { clearCache: vi.fn() },
      invalidateFilteredSortedCache: vi.fn(),
      updatePaginationState: vi.fn(),
      columnAutoWidthCache: { clear: vi.fn() },
      columnRangeCache: { clear: vi.fn() },
      columnStatsCache: { clear: vi.fn() },
      cellValueCache: { clear: vi.fn() },
      spreadsheetFormulaCache: { clear: vi.fn() },
      selectionUndoSnapshot,
      selectionUndoLabel,
      bumpAggregateCache: vi.fn(),
      syncAggregateDisplayState: vi.fn(),
      cdr: { markForCheck: vi.fn() },
      config: { remoteData: false }
    };

    setDataInternalHelper(ctx, rows);

    expect(ctx._data).toBe(rows);
    expect(dataSignal()).toBe(rows);
    expect(ctx.gridService.clearCache).toHaveBeenCalledOnce();
    expect(ctx.invalidateFilteredSortedCache).toHaveBeenCalledOnce();
    expect(ctx.updatePaginationState).toHaveBeenCalledWith(2);
    expect(ctx.columnAutoWidthCache.clear).toHaveBeenCalledOnce();
    expect(ctx.columnRangeCache.clear).toHaveBeenCalledOnce();
    expect(ctx.columnStatsCache.clear).toHaveBeenCalledOnce();
    expect(ctx.cellValueCache.clear).toHaveBeenCalledOnce();
    expect(ctx.spreadsheetFormulaCache.clear).toHaveBeenCalledOnce();
    expect(selectionUndoSnapshotState.value).toBeNull();
    expect(selectionUndoLabelState.value).toBe('');
    expect(ctx.bumpAggregateCache).toHaveBeenCalledOnce();
    expect(ctx.syncAggregateDisplayState).toHaveBeenCalledOnce();
    expect(ctx.cdr.markForCheck).toHaveBeenCalledOnce();
  });

  it('clears all spreadsheet formulas when a dependency cell changes', () => {
    const rows: Array<Record<string, unknown>> = [{ qty: 1, rate: 10, total: '=Qty@1 * Rate@1' }];
    const columns = [
      { field: 'qty', header: 'Qty' },
      { field: 'rate', header: 'Rate' },
      { field: 'total', header: 'Total' }
    ];
    const spreadsheetFormulaCache = new Map<string, unknown>([
      ['0:1', 10],
      ['0:2', 10]
    ]);
    const ctx: Record<string, unknown> = {
      config: { spreadsheetMode: true, autoCalculate: false },
      isSpreadsheetMode: () => true,
      getFilteredSortedData: () => rows,
      visibleColumns: () => columns,
      getColumnField: (column: { field: string }) => column.field,
      invalidateFilteredSortedCache: vi.fn(),
      columnRangeCache: { delete: vi.fn() },
      columnStatsCache: { delete: vi.fn() },
      cellValueCache: { clear: vi.fn() },
      spreadsheetFormulaCache,
      bumpAggregateCache: vi.fn(),
      onCellEdit: { emit: vi.fn() },
      emitChange: vi.fn()
    };

    setSpreadsheetCellValueHelper(ctx, 0, 0, 2);

    expect(rows[0]!.qty).toBe(2);
    expect(spreadsheetFormulaCache.size).toBe(0);
    expect(ctx.emitChange).toHaveBeenCalledWith('edit');
  });

  it('pastes into editable columns and creates a real row from the append row', () => {
    const appendRow = { __appendRow: true };
    let rows: Array<Record<string, unknown>> = [appendRow];
    const columns = [
      { field: 'item', header: 'Item', editable: true, cellType: 'text' },
      { field: 'unit', header: 'Unit', editable: false },
      { field: 'price', header: 'Price', editable: true, cellType: 'number' }
    ];
    const ctx: Record<string, unknown> = {
      config: { spreadsheetMode: true, enableExcelPaste: true, appendRow: true, editMode: 'cell' },
      isSpreadsheetMode: () => true,
      activeCell: () => ({ rowIndex: 0, columnIndex: 0 }),
      spreadsheetCurrentCell: () => null,
      processedData: () => [...rows, appendRow],
      visibleColumns: () => columns,
      getColumnField: (column: { field: string }) => column.field,
      buildEmptyRow: () => ({ item: '', unit: '', price: null }),
      assignRowKey: vi.fn(),
      insertRowAfter: (_reference: unknown, newRow: Record<string, unknown>) => {
        rows = [newRow];
      },
      dataSignal: () => rows,
      setDataInternal: vi.fn(),
      saveEdit: vi.fn((row: Record<string, unknown>, column: { field: string }, value: unknown) => {
        row[column.field] = value;
      }),
      excelPasteService: { parseExcelData: vi.fn(() => [['Fan', 'EA', '1250']]) },
      spreadsheetFormulaCache: { clear: vi.fn() },
      columnRangeCache: { clear: vi.fn() },
      columnStatsCache: { clear: vi.fn() },
      cellValueCache: { clear: vi.fn() },
      bumpAggregateCache: vi.fn(),
      cdr: { markForCheck: vi.fn() }
    };

    onPasteSpreadsheetHelper(ctx, createPasteEvent('Fan\t1250'));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ item: 'Fan', price: 1250 });
    expect(ctx.saveEdit).toHaveBeenCalledTimes(2);
    expect(ctx.saveEdit).not.toHaveBeenCalledWith(expect.anything(), columns[1], expect.anything());
  });

  it('resolves pasted search-select labels through the shared grid cell handler', () => {
    const row = { item: '' };
    const option = { label: 'Computer Room AHU', value: 'ahu-1' };
    const column = {
      field: 'item',
      header: 'Item',
      editable: true,
      cellType: 'search-select',
      searchSelect: {
        options: [option],
        displayFn: (value: typeof option) => value.label
      }
    };
    const ctx: Record<string, unknown> = {
      config: { spreadsheetMode: true, enableExcelPaste: true, editMode: 'cell' },
      isSpreadsheetMode: () => true,
      activeCell: () => ({ rowIndex: 0, columnIndex: 0 }),
      spreadsheetCurrentCell: () => null,
      processedData: () => [row],
      visibleColumns: () => [column],
      getSearchSelectOptions: () => [option],
      getSearchSelectDisplayFn: () => column.searchSelect.displayFn,
      onSearchSelectValueChange: vi.fn(),
      excelPasteService: { parseExcelData: vi.fn(() => [['Computer Room AHU']]) },
      spreadsheetFormulaCache: { clear: vi.fn() },
      columnRangeCache: { clear: vi.fn() },
      columnStatsCache: { clear: vi.fn() },
      cellValueCache: { clear: vi.fn() },
      bumpAggregateCache: vi.fn(),
      cdr: { markForCheck: vi.fn() }
    };

    onPasteSpreadsheetHelper(ctx, createPasteEvent('Computer Room AHU'));

    expect(ctx.onSearchSelectValueChange).toHaveBeenCalledWith(row, column, option);
  });

  it('falls back to raw inline edit when pasted search-select text has no matching option', () => {
    const row = { item: 'Existing' };
    const column = {
      field: 'item',
      header: 'Item',
      editable: true,
      cellType: 'search-select',
      searchSelect: {
        options: [{ label: 'Known Item', value: 'known' }],
        displayFn: (value: { label: string }) => value.label
      }
    };
    const ctx: Record<string, unknown> = {
      config: { spreadsheetMode: true, enableExcelPaste: true, editMode: 'cell' },
      isSpreadsheetMode: () => true,
      activeCell: () => ({ rowIndex: 0, columnIndex: 0 }),
      spreadsheetCurrentCell: () => null,
      processedData: () => [row],
      visibleColumns: () => [column],
      getSearchSelectOptions: () => column.searchSelect.options,
      getSearchSelectDisplayFn: () => column.searchSelect.displayFn,
      onSearchSelectValueChange: vi.fn(),
      saveEdit: vi.fn((target: Record<string, unknown>, targetColumn: { field: string }, value: unknown) => {
        target[targetColumn.field] = value;
      }),
      excelPasteService: { parseExcelData: vi.fn(() => [['Unknown Item']]) },
      spreadsheetFormulaCache: { clear: vi.fn() },
      columnRangeCache: { clear: vi.fn() },
      columnStatsCache: { clear: vi.fn() },
      cellValueCache: { clear: vi.fn() },
      bumpAggregateCache: vi.fn(),
      cdr: { markForCheck: vi.fn() }
    };

    onPasteSpreadsheetHelper(ctx, createPasteEvent('Unknown Item'));

    expect(ctx.onSearchSelectValueChange).not.toHaveBeenCalled();
    expect(ctx.saveEdit).toHaveBeenCalledWith(row, column, 'Unknown Item');
    expect(row.item).toBe('Unknown Item');
  });

  it('skips an Excel header row before applying pasted values', () => {
    const row = { item: '', unit: '', price: null };
    const columns = [
      { field: 'item', header: 'Item', editable: true, cellType: 'text' },
      { field: 'unit', header: 'Unit', editable: false },
      { field: 'price', header: 'Unit Price', editable: true, cellType: 'number' }
    ];
    const ctx: Record<string, unknown> = {
      config: { spreadsheetMode: true, enableExcelPaste: true, editMode: 'cell' },
      isSpreadsheetMode: () => true,
      activeCell: () => ({ rowIndex: 0, columnIndex: 0 }),
      spreadsheetCurrentCell: () => null,
      processedData: () => [row],
      visibleColumns: () => columns,
      getColumnField: (column: { field: string }) => column.field,
      saveEdit: vi.fn((target: Record<string, unknown>, column: { field: string }, value: unknown) => {
        target[column.field] = value;
      }),
      excelPasteService: {
        parseExcelData: vi.fn(() => [
          ['Item', 'Unit', 'Unit Price'],
          ['Fan', 'EA', '950']
        ])
      },
      spreadsheetFormulaCache: { clear: vi.fn() },
      columnRangeCache: { clear: vi.fn() },
      columnStatsCache: { clear: vi.fn() },
      cellValueCache: { clear: vi.fn() },
      bumpAggregateCache: vi.fn(),
      cdr: { markForCheck: vi.fn() }
    };

    onPasteSpreadsheetHelper(ctx, createPasteEvent('Item\tUnit\tUnit Price\nFan\tEA\t950'));

    expect(row).toMatchObject({ item: 'Fan', price: 950 });
    expect(ctx.saveEdit).toHaveBeenCalledTimes(2);
  });

  it('uses the append row on the first paste when no active cell exists', () => {
    const appendRow = { __appendRow: true };
    let rows: Array<Record<string, unknown>> = [appendRow];
    const columns = [
      { field: 'item', header: 'Item', editable: true, cellType: 'text' },
      { field: 'price', header: 'Price', editable: true, cellType: 'number' }
    ];
    const activeCellSet = vi.fn();
    const spreadsheetCellSet = vi.fn();
    const ctx: Record<string, unknown> = {
      config: { spreadsheetMode: true, enableExcelPaste: true, appendRow: true, editMode: 'cell' },
      elementRef: { nativeElement: document.createElement('engineers-salary-reference-data-grid') },
      isSpreadsheetMode: () => true,
      activeCell: Object.assign(() => null, { set: activeCellSet }),
      spreadsheetCurrentCell: Object.assign(() => null, { set: spreadsheetCellSet }),
      processedData: () => [...rows, appendRow],
      visibleColumns: () => columns,
      getColumnField: (column: { field: string }) => column.field,
      buildEmptyRow: () => ({ item: '', price: null }),
      assignRowKey: vi.fn(),
      insertRowAfter: (_reference: unknown, newRow: Record<string, unknown>) => {
        rows = [newRow];
      },
      dataSignal: () => rows,
      saveEdit: vi.fn((target: Record<string, unknown>, column: { field: string }, value: unknown) => {
        target[column.field] = value;
      }),
      excelPasteService: { parseExcelData: vi.fn(() => [['Fan', '775']]) },
      spreadsheetFormulaCache: { clear: vi.fn() },
      columnRangeCache: { clear: vi.fn() },
      columnStatsCache: { clear: vi.fn() },
      cellValueCache: { clear: vi.fn() },
      bumpAggregateCache: vi.fn(),
      cdr: { markForCheck: vi.fn() }
    };

    onPasteSpreadsheetHelper(ctx, createPasteEvent('Fan\t775'));

    expect(activeCellSet).toHaveBeenCalledWith({ rowIndex: 0, columnIndex: 0 });
    expect(spreadsheetCellSet).toHaveBeenCalledWith({ row: 0, col: 0 });
    expect(rows[0]).toMatchObject({ item: 'Fan', price: 775 });
  });

  it('adds only missing selected rows to bookmarks and logs one audit entry', () => {
    const rowA = { id: 'A' };
    const rowB = { id: 'B' };
    const rowC = { id: 'C' };
    type BookmarkRow = typeof rowA;
    let bookmarked: BookmarkRow[] = [rowC];
    const bookmarkedRows = (() => bookmarked) as (() => BookmarkRow[]) & {
      set(value: BookmarkRow[]): void;
    };
    bookmarkedRows.set = (value: BookmarkRow[]) => {
      bookmarked = value;
    };

    bookmarkSelectedRowsHelper({
      config: { enableBookmarks: true },
      selectedRows() {
        return [rowA, rowB, rowC];
      },
      bookmarkedRows,
      logAuditEvent: vi.fn()
    });

    expect(bookmarked).toEqual([rowA, rowB, rowC]);
  });

  it('uses the bookmark lookup for hot render bookmark checks', () => {
    const rowA = { id: 'A' };
    const rowB = { id: 'B' };
    const bookmarkedRows = vi.fn(() => {
      throw new Error('bookmarkedRows should not be scanned when lookup exists');
    });

    const ctx = {
      config: { enableBookmarks: true },
      bookmarkedRows,
      bookmarkedRowLookup() {
        return new Set([rowA]);
      }
    };

    expect(isRowBookmarkedHelper(ctx, rowA)).toBe(true);
    expect(isRowBookmarkedHelper(ctx, rowB)).toBe(false);
    expect(bookmarkedRows).not.toHaveBeenCalled();
  });

  it('uses the numeric column lookup without scanning rows in hot analytics paths', () => {
    const ctx = {
      getColumnField: vi.fn(() => 'amount'),
      numericColumnFieldLookup: vi.fn(() => new Set(['amount'])),
      dataSignal: vi.fn(() => {
        throw new Error('dataSignal should not be scanned when lookup exists');
      }),
      normalizeNumericValue: vi.fn()
    };

    expect(isNumericColumnHelper(ctx, { field: 'amount' })).toBe(true);
    expect(ctx.numericColumnFieldLookup).toHaveBeenCalledOnce();
    expect(ctx.dataSignal).not.toHaveBeenCalled();
  });
});

function createPasteEvent(text: string): ClipboardEvent {
  return {
    preventDefault: vi.fn(),
    clipboardData: {
      getData: vi.fn(() => text)
    }
  } as unknown as ClipboardEvent;
}
