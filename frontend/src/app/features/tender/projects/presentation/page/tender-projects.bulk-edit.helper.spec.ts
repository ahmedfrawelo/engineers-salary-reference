import { describe, expect, it } from 'vitest';

import type { TenderRow } from './tender-project-details/project-details.component';
import {
  buildBulkEditPatchFromRows,
  clearLookupIdsForChangedFieldsInRow
} from './tender-projects.bulk-edit.helper';

function createRow(overrides: Partial<TenderRow> = {}): TenderRow {
  return {
    id: 1,
    title: 'Project 1',
    description: '',
    owner: 'Owner A',
    ownerType: 'Public',
    deadline: '',
    startDate: '',
    endDate: '',
    top: '',
    ts: '',
    price: undefined,
    assignTo: '',
    acceptDate: '',
    status: 'New',
    prb: null,
    consultant: '',
    delayReasons: '',
    doi: '',
    country: '',
    inCharge: '',
    ...overrides
  };
}

function parseNumberOrNull(value: unknown): number | null {
  if (value == null || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

describe('tender-projects.bulk-edit.helper', () => {
  it('includes description changes in the bulk edit patch', () => {
    const baseline = createRow({ description: '' });
    const payload = createRow({ description: 'Updated project summary' });

    const patch = buildBulkEditPatchFromRows(payload, baseline, parseNumberOrNull);

    expect(patch).toEqual({ description: 'Updated project summary' });
  });

  it('includes owner type changes in the bulk edit patch', () => {
    const baseline = createRow({ ownerType: 'Public' });
    const payload = createRow({ ownerType: 'Private' });

    const patch = buildBulkEditPatchFromRows(payload, baseline, parseNumberOrNull);

    expect(patch).toEqual({ ownerType: 'Private' });
  });

  it('clears the owner type lookup id when the label changes', () => {
    const previous = createRow({ ownerType: 'Public', ownerTypeId: 9 });
    const next = createRow({ ownerType: 'Private', ownerTypeId: 9 });

    const cleared = clearLookupIdsForChangedFieldsInRow(next, previous);

    expect(cleared.ownerTypeId).toBeUndefined();
  });

  it('includes price clearing in the bulk edit patch', () => {
    const baseline = createRow({ price: 1200 });
    const payload = createRow({ price: undefined });

    const patch = buildBulkEditPatchFromRows(payload, baseline, parseNumberOrNull);

    expect(patch).toEqual({ price: undefined });
  });

  it('includes PRB clearing in the bulk edit patch', () => {
    const baseline = createRow({ prb: 35 });
    const payload = createRow({ prb: null });

    const patch = buildBulkEditPatchFromRows(payload, baseline, parseNumberOrNull);

    expect(patch).toEqual({ prb: null });
  });
});
