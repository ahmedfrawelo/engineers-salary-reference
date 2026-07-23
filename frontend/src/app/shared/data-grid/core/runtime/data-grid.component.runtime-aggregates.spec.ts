import { describe, expect, it, vi } from 'vitest';

import { getRowSelectionNumberHelper } from './data-grid.component.part1.internal.impl';
import {
  getFilteredSortedDataHelper,
  getGroupAggregateHelper,
  getGroupBlockAggregateHelper,
  getGroupDataHelper,
  getGroupIdsByLevelHelper,
  getGlobalRowIndexHelper,
  setColumnAlignmentHelper
} from './data-grid.component.runtime-aggregates';

describe('data-grid.component.runtime-aggregates', () => {
  it('returns cached group aggregates before resolving group rows', () => {
    const column = { field: 'amount', aggregate: 'sum' };
    const ctx = {
      aggregateCache: new Map([['group|status:Open|amount|sum|3', '42']]),
      aggregateCacheToken: 3,
      getColumnField: vi.fn(() => 'amount'),
      getAggregateCacheKey: vi.fn(() => 'group|status:Open|amount|sum|3'),
      getGroupData: vi.fn(() => {
        throw new Error('cached group aggregate should not resolve group rows');
      })
    };

    expect(getGroupAggregateHelper(ctx, { id: 'status:Open' }, column)).toBe('42');
    expect(ctx.getGroupData).not.toHaveBeenCalled();
  });

  it('returns cached group block aggregates before reading block rows', () => {
    const column = { field: 'amount', aggregate: 'sum' };
    const ctx = {
      aggregateCache: new Map([['block|status:Open|amount|sum|3', '84']]),
      aggregateCacheToken: 3,
      getColumnField: vi.fn(() => 'amount'),
      getAggregateCacheKey: vi.fn(() => 'block|status:Open|amount|sum|3')
    };

    expect(getGroupBlockAggregateHelper(ctx, { id: 'status:Open' }, column)).toBe('84');
  });

  it('reuses the remote row array when append rows are absent', () => {
    const rows = [{ id: 'A' }, { id: 'B' }];
    const ctx = {
      config: {
        remoteData: true
      },
      filteredSortedCache: null as {
        key: number;
        rows: unknown[];
        indexMap: WeakMap<object, number>;
        identityIndexMap: Map<string, number>;
      } | null,
      filteredSortedCacheKey: 1,
      dataSignal() {
        return rows;
      }
    };

    const result = getFilteredSortedDataHelper(ctx);

    expect(result).toBe(rows);
    expect(ctx.filteredSortedCache?.rows).toBe(rows);
  });

  it('moves append rows after data rows using one split pass', () => {
    const rowA = { id: 'A' };
    const appendRow = { __appendRow: true };
    const rowB = { id: 'B' };
    const ctx = {
      config: {
        remoteData: true
      },
      filteredSortedCache: null as {
        key: number;
        rows: unknown[];
        indexMap: WeakMap<object, number>;
        identityIndexMap: Map<string, number>;
      } | null,
      filteredSortedCacheKey: 1,
      dataSignal() {
        return [rowA, appendRow, rowB];
      }
    };

    expect(getFilteredSortedDataHelper(ctx)).toEqual([rowA, rowB, appendRow]);
    expect(ctx.filteredSortedCache?.indexMap.get(rowA)).toBe(0);
    expect(ctx.filteredSortedCache?.indexMap.get(rowB)).toBe(1);
    expect(ctx.filteredSortedCache?.indexMap.get(appendRow)).toBe(2);
  });

  it('keeps local sort operations isolated from caller-owned rows', () => {
    const rows = [{ id: 2 }, { id: 1 }];
    const ctx = {
      config: {
        remoteData: false
      },
      filteredSortedCache: null,
      filteredSortedCacheKey: 1,
      dataSignal() {
        return rows;
      },
      quickFilterValues() {
        return new Map();
      },
      filterStates() {
        return [];
      },
      sortStates() {
        return [{ field: 'id', direction: 'asc' }];
      },
      columnsSignal() {
        return [];
      },
      gridService: {
        applyFilters: vi.fn(),
        applySorts: vi.fn((inputRows: Array<{ id: number }>) =>
          inputRows.sort((a, b) => a.id - b.id)
        )
      }
    };

    expect(getFilteredSortedDataHelper(ctx)).toEqual([{ id: 1 }, { id: 2 }]);
    expect(rows).toEqual([{ id: 2 }, { id: 1 }]);
  });

  it('uses cached row indexes without recomputing filtered rows', () => {
    const rowA = { id: 'A' };
    const indexMap = new WeakMap<object, number>([[rowA, 7]]);
    const getFilteredSortedData = vi.fn(() => {
      throw new Error('cached row indexes should not recompute filtered rows');
    });

    expect(
      getGlobalRowIndexHelper(
        {
          filteredSortedCache: {
            key: 1,
            rows: [],
            indexMap,
            identityIndexMap: new Map()
          },
          getFilteredSortedData
        },
        rowA
      )
    ).toBe(7);
    expect(getFilteredSortedData).not.toHaveBeenCalled();
  });

  it('resolves a grouped row clone back to its global row index by stable row identity', () => {
    const rowA = { id: 'A', name: 'Alpha' };
    const rowB = { id: 'B', name: 'Bravo' };
    const cloneB = { id: 'B', name: 'Bravo' };

    const ctx = {
      config: {
        remoteData: true
      },
      filteredSortedCache: null as {
        key: number;
        rows: Array<Record<string, unknown>>;
        indexMap: WeakMap<object, number>;
        identityIndexMap: Map<string, number>;
      } | null,
      filteredSortedCacheKey: 1,
      dataSignal() {
        return [rowA, rowB];
      },
      getFilteredSortedData() {
        return getFilteredSortedDataHelper(ctx) as Array<Record<string, unknown>>;
      },
      getGlobalRowIndex(row: unknown) {
        return getGlobalRowIndexHelper(ctx, row) as number;
      },
      processedDataRowIndexLookup: vi.fn(() => {
        throw new Error('stable row identity should resolve before building processed row indexes');
      }),
      paginationState() {
        return {
          currentPage: 1,
          pageSize: 25,
          totalRecords: 2
        };
      }
    };

    getFilteredSortedDataHelper(ctx);

    expect(getGlobalRowIndexHelper(ctx, cloneB)).toBe(1);
    expect(getRowSelectionNumberHelper(ctx, cloneB)).toBe(2);
    expect(ctx.processedDataRowIndexLookup).not.toHaveBeenCalled();
  });

  it('updates column alignment without cloning data or forcing immediate change detection', () => {
    const detectChanges = vi.fn();
    const markForCheck = vi.fn();
    const dataSignal = { set: vi.fn() };
    const columns = [{ field: 'name', align: 'left' }, { field: 'owner' }];
    const ctx = {
      columns,
      cdr: { detectChanges, markForCheck },
      dataSignal,
      alignmentChangeTimestamp: { set: vi.fn() },
      emitColumnsChange: vi.fn(),
      saveState: vi.fn(),
      stateKey: 'grid-state',
      closeColumnContextMenu: vi.fn()
    };

    setColumnAlignmentHelper(ctx, columns[0], 'right');

    expect(ctx.columns[0]).toMatchObject({ field: 'name', align: 'right' });
    expect(dataSignal.set).not.toHaveBeenCalled();
    expect(detectChanges).not.toHaveBeenCalled();
    expect(markForCheck).toHaveBeenCalledOnce();
    expect(ctx.emitColumnsChange).toHaveBeenCalledOnce();
    expect(ctx.saveState).toHaveBeenCalledOnce();
    expect(ctx.closeColumnContextMenu).toHaveBeenCalledOnce();
  });

  it('uses grouped block ids for single-column level expansion without materializing display rows', () => {
    const displayRows = vi.fn(() => {
      throw new Error('single-column level expansion should not scan display rows');
    });
    const ctx = {
      groupColumns: vi.fn(() => ['status']),
      groupedBlocks: vi.fn(() => [{ id: 'status:Open' }, { id: 'status:Done' }]),
      displayRows
    };

    expect(getGroupIdsByLevelHelper(ctx, 0)).toEqual(['status:Open', 'status:Done']);
    expect(displayRows).not.toHaveBeenCalled();
  });

  it('resolves fallback group data through normalized date group values', () => {
    const aprilOne = { deadline: '2026-04-01', id: 1 };
    const aprilTwenty = { deadline: '2026-04-20', id: 2 };
    const mayOne = { deadline: '2026-05-01', id: 3 };
    const ctx = {
      getFilteredSortedData: vi.fn(() => [aprilOne, aprilTwenty, mayOne]),
      resolveGroupValue: vi.fn((_field: string, raw: string) => {
        const month = raw.slice(0, 7);
        return {
          key: month,
          value: month === '2026-04' ? 'April 2026' : 'May 2026'
        };
      })
    };

    expect(getGroupDataHelper(ctx, { field: 'deadline', value: 'April 2026' })).toEqual([
      aprilOne,
      aprilTwenty
    ]);
  });

  it('collects visible multi-column group ids by level without materializing display rows', () => {
    const displayRows = vi.fn(() => {
      throw new Error('multi-column level expansion should not scan display rows');
    });
    const ctx = {
      groupColumns: vi.fn(() => ['team', 'status']),
      processedData: vi.fn(() => [
        { team: 'A', status: 'Open', id: 1 },
        { team: 'A', status: 'Done', id: 2 },
        { team: 'B', status: 'Open', id: 3 }
      ]),
      expandedGroups: vi.fn(() => new Set(['root|team:A-0'])),
      groupExpansionAuto: vi.fn(() => false),
      shouldAutoExpandGroupsCached: vi.fn(() => false),
      groupFilterTerms: vi.fn(() => new Map()),
      displayRows
    };

    expect(getGroupIdsByLevelHelper(ctx, 1)).toEqual([
      'root|team:A-0|status:Open-0',
      'root|team:A-0|status:Done-1'
    ]);
    expect(displayRows).not.toHaveBeenCalled();
  });
});
