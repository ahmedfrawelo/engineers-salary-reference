import { describe, expect, it } from 'vitest';
import { extractItemsAndPaginationMeta } from './api-response.util';

describe('api-response.util pagination metadata', () => {
  it('extracts paged items and grouping metadata from wrapped backend responses', () => {
    const result = extractItemsAndPaginationMeta<{ id: number }>({
      success: true,
      statusCode: 200,
      message: 'OK',
      errors: [],
      data: {
        Items: [{ id: 1 }],
        TotalCount: 12,
        PageNumber: 1,
        PageSize: 10,
        TotalPages: 2,
        HasPreviousPage: false,
        HasNextPage: true,
        Grouping: {
          Field: 'country',
          Direction: 'desc',
          TotalGroups: 1,
          Groups: [{ Key: 'Kuwait', Value: 'Kuwait', Count: 12 }]
        }
      }
    });

    expect(result.items).toEqual([{ id: 1 }]);
    expect(result.meta).toMatchObject({
      totalCount: 12,
      pageNumber: 1,
      pageSize: 10,
      totalPages: 2,
      hasPreviousPage: false,
      hasNextPage: true,
      grouping: {
        field: 'country',
        direction: 'desc',
        totalGroups: 1,
        groups: [{ field: 'country', key: 'Kuwait', value: 'Kuwait', count: 12 }]
      }
    });
  });

  it('returns array payloads without pagination metadata', () => {
    const result = extractItemsAndPaginationMeta([{ id: 1 }, { id: 2 }]);

    expect(result.items).toEqual([{ id: 1 }, { id: 2 }]);
    expect(result.meta).toBeNull();
  });
});
