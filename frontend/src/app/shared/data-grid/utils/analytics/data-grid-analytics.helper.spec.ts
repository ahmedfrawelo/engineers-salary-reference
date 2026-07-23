import { describe, expect, it, vi } from 'vitest';

import {
  getAnomalySummaryHelper,
  getDataQualitySummaryHelper,
  getSelectionInsightsHelper
} from './data-grid-analytics.helper';

describe('data-grid-analytics.helper', () => {
  it('aggregates selection insights in a single pass without changing output', () => {
    const ctx = {
      selectedRows() {
        return [
          { amount: 10, score: 2, title: 'A' },
          { amount: 20, score: null, title: 'B' }
        ];
      },
      visibleColumns() {
        return [
          { field: 'amount', header: 'Amount' },
          { field: 'score', header: 'Score' },
          { field: 'title', header: 'Title' }
        ];
      },
      isNumericColumn(column: { field: string }) {
        return column.field === 'amount' || column.field === 'score';
      },
      getColumnField(column: { field: string }) {
        return column.field;
      },
      getRowFieldValue(row: Record<string, unknown>, field: string) {
        return row[field];
      },
      normalizeNumericValue(value: unknown) {
        return typeof value === 'number' ? value : value == null ? null : Number(value);
      },
      paginationState() {
        return { totalRecords: 4 };
      },
      dataSignal() {
        return [];
      }
    };

    const result = getSelectionInsightsHelper(ctx);

    expect(result).toEqual({
      count: 2,
      percentage: 50,
      metrics: [
        {
          header: 'Amount',
          field: 'amount',
          sum: 30,
          min: 10,
          max: 20,
          avg: 15,
          count: 2
        },
        {
          header: 'Score',
          field: 'score',
          sum: 2,
          min: 2,
          max: 2,
          avg: 2,
          count: 1
        }
      ]
    });
  });

  it('skips append rows and raw-cell renderer work in data quality summary', () => {
    const getCellValue = vi.fn(() => {
      throw new Error('data quality summary should not call rendered cell values');
    });

    const ctx = {
      processedData() {
        return [
          { name: '', amount: 0 },
          { __appendRow: true, name: '', amount: 0 }
        ];
      },
      visibleColumns() {
        return [{ field: 'name' }, { field: 'amount' }];
      },
      getColumnField(column: { field: string }) {
        return column.field;
      },
      getRowFieldValue(row: Record<string, unknown>, field: string) {
        return row[field];
      },
      normalizeNumericValue(value: unknown) {
        return typeof value === 'number' ? value : null;
      },
      getCellValue
    };

    const result = getDataQualitySummaryHelper(ctx);

    expect(getCellValue).not.toHaveBeenCalled();
    expect(result).toEqual({
      score: 70,
      emptyPercent: 50,
      zeroPercent: 50,
      duplicateRows: 0,
      issues: [
        {
          label: 'Missing data',
          detail: '50% of cells empty',
          severity: 'high'
        },
        {
          label: 'Zero values',
          detail: '50% zero entries',
          severity: 'low'
        }
      ]
    });
  });

  it('loads numeric column stats once per column when computing anomaly summary', () => {
    const getColumnStats = vi.fn((field: string) => ({ field }));

    const ctx = {
      showAnomalyAlerts() {
        return true;
      },
      getFilteredSortedData() {
        return [
          { revenue: 10, margin: 2 },
          { revenue: 99, margin: 3 }
        ];
      },
      visibleColumns() {
        return [{ field: 'revenue' }, { field: 'margin' }];
      },
      isNumericColumn() {
        return true;
      },
      getColumnField(column: { field: string }) {
        return column.field;
      },
      getColumnStats,
      getRowFieldValue(row: Record<string, unknown>, field: string) {
        return row[field];
      },
      normalizeNumericValue(value: unknown) {
        return typeof value === 'number' ? value : null;
      },
      isValueAnomaly(value: number | null, stats: { field: string }) {
        return stats.field === 'revenue' && value === 99;
      }
    };

    const result = getAnomalySummaryHelper(ctx);

    expect(getColumnStats).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ rows: 1, cells: 1 });
  });
});
