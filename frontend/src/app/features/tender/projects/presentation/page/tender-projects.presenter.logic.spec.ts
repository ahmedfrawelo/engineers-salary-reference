import { describe, expect, it, vi } from 'vitest';

import {
  buildTenderProjectCreateDto,
  buildTenderProjectUpdateDto
} from './tender-projects.presenter.logic';
import type { IdName } from './tender-projects.contracts';
import type { TenderRow } from './tender-project-details/project-details.component';

function normalizeLabel(value: string | null | undefined): string | null {
  const text = (value ?? '').trim();
  return text ? text : null;
}

function resolveId(list: IdName[], name: string | undefined | null): number | null {
  const key = normalizeLabel(name)?.toLowerCase();
  if (!key) {
    return null;
  }

  const match = list.find(item =>
    [item.customLabel, item.name].some(
      candidate => normalizeLabel(candidate)?.toLowerCase() === key
    )
  );
  return match?.id ?? null;
}

function createLookups(
  overrides: Partial<Record<keyof ReturnType<typeof emptyLookups>, IdName[]>> = {}
) {
  return {
    ...emptyLookups(),
    ...overrides
  };
}

function emptyLookups() {
  return {
    statuses: [] as IdName[],
    top: [] as IdName[],
    stages: [] as IdName[],
    doi: [] as IdName[],
    owners: [] as IdName[],
    ownerTypes: [] as IdName[],
    countries: [] as IdName[],
    assignToSettings: [] as IdName[],
    inChargeSettings: [] as IdName[]
  };
}

describe('tender-projects.presenter.logic', () => {
  it('clears stale lookup ids and whitespace-only optional people fields in create dto', () => {
    const row: TenderRow = {
      title: 'Project Alpha',
      owner: '',
      ownerType: '',
      deadline: '',
      top: '',
      ts: '',
      assignTo: '   ',
      acceptDate: '',
      status: 'Ghost Status' as TenderRow['status'],
      statusId: 7,
      prb: null,
      doi: 'Ghost Importance',
      degreeOfImportanceId: 8,
      country: '',
      inCharge: '   '
    };

    const dto = buildTenderProjectCreateDto({
      row,
      lookups: createLookups({
        statuses: [{ id: 7, name: 'Open' }],
        doi: [{ id: 8, name: 'High' }]
      }),
      debugLog: () => undefined,
      resolveId,
      parseNumberOrNull: value => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      },
      normalizeApiDate: value => normalizeLabel(value),
      normalizeLabel
    });

    expect(dto.statusId).toBeNull();
    expect(dto.degreeOfImportanceId).toBeNull();
    expect(dto.assignTo).toBeNull();
    expect(dto.inCharge).toBeNull();
  });

  it('keeps trusted fallback lookup ids during update when the lookup cache is completely unavailable', () => {
    const toastError = vi.fn();
    const row: TenderRow = {
      id: 42,
      title: 'Project Beta',
      owner: '',
      ownerType: '',
      deadline: '',
      top: '',
      ts: '',
      assignTo: 'Ahmed',
      acceptDate: '',
      status: 'New',
      statusId: 3,
      prb: null,
      doi: 'High',
      degreeOfImportanceId: 4,
      country: '',
      inCharge: 'Sara'
    };

    const dto = buildTenderProjectUpdateDto({
      row,
      lookups: createLookups(),
      debugLog: () => undefined,
      resolveId,
      parseNumberOrNull: value => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      },
      normalizeApiDate: value => normalizeLabel(value),
      normalizeLabel,
      parseId: value => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      },
      toastError
    });

    expect(dto).not.toBeNull();
    expect(dto?.statusId).toBe(3);
    expect(dto?.degreeOfImportanceId).toBe(4);
    expect(dto?.assignTo).toBe('Ahmed');
    expect(dto?.inCharge).toBe('Sara');
    expect(toastError).not.toHaveBeenCalled();
  });

  it('clears fallback lookup ids when a partially loaded lookup cache cannot confirm the current label', () => {
    const toastError = vi.fn();
    const row: TenderRow = {
      id: 43,
      title: 'Project Gamma',
      owner: '',
      ownerType: '',
      deadline: '',
      top: '',
      ts: '',
      assignTo: '',
      acceptDate: '',
      status: 'Under Review' as TenderRow['status'],
      statusId: 3,
      prb: null,
      doi: 'Critical',
      degreeOfImportanceId: 4,
      country: '',
      inCharge: ''
    };

    const dto = buildTenderProjectUpdateDto({
      row,
      lookups: createLookups({
        statuses: [{ id: 9, name: 'Open' }],
        doi: [{ id: 10, name: 'High' }]
      }),
      debugLog: () => undefined,
      resolveId,
      parseNumberOrNull: value => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      },
      normalizeApiDate: value => normalizeLabel(value),
      normalizeLabel,
      parseId: value => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      },
      toastError
    });

    expect(dto).not.toBeNull();
    expect(dto?.statusId).toBeNull();
    expect(dto?.degreeOfImportanceId).toBeNull();
    expect(toastError).not.toHaveBeenCalled();
  });
});
