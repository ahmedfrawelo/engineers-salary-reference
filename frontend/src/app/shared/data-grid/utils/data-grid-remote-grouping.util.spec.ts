import { describe, expect, it } from 'vitest';

import { resolvePersistedGridRemoteGrouping } from './data-grid-remote-grouping.util';

describe('data-grid-remote-grouping.util', () => {
  it('returns empty params when no persisted state exists', () => {
    const storage = {
      getItem() {
        return null;
      }
    };

    expect(resolvePersistedGridRemoteGrouping(storage, 'projects-grid')).toEqual({});
  });

  it('returns empty params when persisted state is invalid', () => {
    const storage = {
      getItem() {
        return '{invalid';
      }
    };

    expect(resolvePersistedGridRemoteGrouping(storage, 'projects-grid')).toEqual({});
  });

  it('extracts the primary grouped field and its persisted descending sort direction', () => {
    const storage = {
      getItem() {
        return JSON.stringify({
          groupColumns: ['status', 'owner'],
          sorts: [
            { field: 'status', direction: 'desc' },
            { field: 'owner', direction: 'asc' }
          ]
        });
      }
    };

    expect(resolvePersistedGridRemoteGrouping(storage, 'projects-grid')).toEqual({
      groupBy: 'status',
      groupDirection: 'desc'
    });
  });

  it('defaults grouped direction to ascending when no matching grouped sort exists', () => {
    const storage = {
      getItem() {
        return JSON.stringify({
          groupColumns: ['ownerType'],
          sorts: [{ field: 'deadline', direction: 'desc' }]
        });
      }
    };

    expect(resolvePersistedGridRemoteGrouping(storage, 'projects-grid')).toEqual({
      groupBy: 'ownerType',
      groupDirection: 'asc'
    });
  });

  it('extracts the persisted date interval for the grouped field', () => {
    const storage = {
      getItem() {
        return JSON.stringify({
          groupColumns: ['deadline'],
          sorts: [{ field: 'deadline', direction: 'asc' }],
          groupDateIntervals: { deadline: 'month' }
        });
      }
    };

    expect(resolvePersistedGridRemoteGrouping(storage, 'projects-grid')).toEqual({
      groupBy: 'deadline',
      groupDirection: 'asc',
      groupDateInterval: 'month'
    });
  });
});
