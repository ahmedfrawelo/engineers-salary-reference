import { describe, expect, it } from 'vitest';
import type { GridColumn } from '../../models';
import { DataGridService } from './data-grid.service';

type TestRow = {
  id: number;
  name: string;
  age: number;
};

describe('DataGridService', () => {
  it('applies joined filters with OR semantics in sequence', () => {
    const service = new DataGridService();
    const rows: TestRow[] = [
      { id: 1, name: 'Ahmed', age: 30 },
      { id: 2, name: 'Sara', age: 25 },
      { id: 3, name: 'Mona', age: 35 }
    ];
    const columns: GridColumn<TestRow>[] = [
      { field: 'id', header: 'ID', filterable: true },
      { field: 'name', header: 'Name', filterable: true },
      { field: 'age', header: 'Age', filterable: true, filterType: 'number' }
    ];

    const result = service.applyFilters(
      rows,
      [
        { field: 'name', operator: 'contains', value: 'ahmed' },
        { field: 'age', operator: 'equals', value: 25, joinWithPrev: 'or' }
      ],
      columns
    );

    expect(result.map(row => row.id)).toEqual([1, 2]);
  });
});
