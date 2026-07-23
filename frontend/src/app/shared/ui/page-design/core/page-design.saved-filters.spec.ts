import { describe, expect, it } from 'vitest';
import type { SharedFilterGroup, SharedFilterRow } from '../models';
import {
  buildSharedSavedFilterComparableKey,
  restoreSharedSavedFilterGroups,
  serializeSharedSavedFilterDefinition
} from './page-design.saved-filters';

function createRow(id: string, overrides?: Partial<SharedFilterRow>): SharedFilterRow {
  return {
    id,
    joinWithPrev: 'and',
    field: '',
    operator: 'contains',
    value: '',
    ...overrides
  };
}

function createGroup(
  id: string,
  rows: SharedFilterRow[],
  joinWithPrev: 'and' | 'or' = 'and'
): SharedFilterGroup {
  return {
    id,
    joinWithPrev,
    rows
  };
}

describe('page-design.saved-filters', () => {
  it('serializes only complete filters and preserves joins', () => {
    const definition = serializeSharedSavedFilterDefinition(
      [
        createGroup('g1', [
          createRow('r1', { field: 'supplier', operator: 'equals', value: 'acme' }),
          createRow('r2', {
            field: 'country',
            operator: 'equals',
            value: 'kuwait',
            joinWithPrev: 'and'
          }),
          createRow('r3', { field: '', operator: 'equals', value: 'ignored' })
        ]),
        createGroup(
          'g2',
          [createRow('r4', { field: 'brand', operator: 'contains', value: 'vortice' })],
          'or'
        )
      ],
      {
        isFilterComplete: filter => !!filter.field.trim() && !!filter.value.trim(),
        operatorNeedsNoValue: () => false
      }
    );

    expect(definition).toEqual({
      groups: [
        {
          joinWithPrev: 'and',
          rows: [
            {
              field: 'supplier',
              operator: 'equals',
              value: 'acme',
              joinWithPrev: 'and'
            },
            {
              field: 'country',
              operator: 'equals',
              value: 'kuwait',
              joinWithPrev: 'and'
            }
          ]
        },
        {
          joinWithPrev: 'or',
          rows: [
            {
              field: 'brand',
              operator: 'contains',
              value: 'vortice',
              joinWithPrev: 'and'
            }
          ]
        }
      ]
    });
  });

  it('restores saved definitions into fresh rows and groups', () => {
    let rowCounter = 0;
    let groupCounter = 0;

    const restored = restoreSharedSavedFilterGroups(
      {
        groups: [
          {
            joinWithPrev: 'and',
            rows: [
              { field: 'supplier', operator: 'equals', value: 'acme', joinWithPrev: 'and' },
              { field: 'country', operator: 'equals', value: 'kuwait', joinWithPrev: 'or' }
            ]
          }
        ]
      },
      {
        createFilterRow: () => createRow(`row-${++rowCounter}`),
        createFilterGroup: rows => createGroup(`group-${++groupCounter}`, rows)
      }
    );

    expect(restored).toHaveLength(1);
    expect(restored[0].id).toBe('group-1');
    expect(restored[0].rows.map(row => row.id)).toEqual(['row-1', 'row-2']);
    expect(restored[0].rows[0]).toMatchObject({
      field: 'supplier',
      operator: 'equals',
      value: 'acme',
      joinWithPrev: 'and'
    });
    expect(restored[0].rows[1]).toMatchObject({
      field: 'country',
      operator: 'equals',
      value: 'kuwait',
      joinWithPrev: 'or'
    });
  });

  it('builds the same comparable key for normalized equivalent definitions', () => {
    const left = buildSharedSavedFilterComparableKey({
      groups: [
        {
          joinWithPrev: 'and',
          rows: [
            {
              field: ' supplier ',
              operator: 'equals',
              value: ' acme ',
              joinWithPrev: 'and'
            }
          ]
        }
      ]
    });
    const right = buildSharedSavedFilterComparableKey({
      groups: [
        {
          joinWithPrev: 'and',
          rows: [
            {
              field: 'supplier',
              operator: 'equals',
              value: 'acme',
              joinWithPrev: 'and'
            }
          ]
        }
      ]
    });

    expect(left).toBe(right);
  });
});
