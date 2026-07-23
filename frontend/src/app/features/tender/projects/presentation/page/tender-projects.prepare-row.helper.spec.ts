import { describe, expect, it } from 'vitest';
import { firstValueFrom, of } from 'rxjs';

import { prepareTenderProjectRowForSave } from './tender-projects.prepare-row.helper';
import type { IdName } from './tender-projects.contracts';
import type { TenderRow } from './tender-project-details/project-details.component';

function createLookupResolver() {
  const parseId = (value: unknown): number | null => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };
  const resolveNameById = (list: IdName[], id?: number | string | null): string | null => {
    const parsed = parseId(id);
    if (!parsed) return null;
    return list.find(item => item.id === parsed)?.name ?? null;
  };
  const findLookupByName = (list: IdName[], name?: string | null): IdName | null => {
    const key = String(name ?? '')
      .trim()
      .toLowerCase();
    if (!key) return null;
    return list.find(item => item.name.trim().toLowerCase() === key) ?? null;
  };
  const upsertLookup = (list: IdName[], item: IdName): IdName[] => {
    const index = list.findIndex(entry => entry.id === item.id);
    if (index === -1) return [...list, item];
    const next = [...list];
    next[index] = item;
    return next;
  };

  return {
    parseId,
    resolveNameById,
    findLookupByName,
    upsertLookup,
    extractApiErrorMessage: (err: unknown) => String(err ?? 'error')
  };
}

describe('prepareTenderProjectRowForSave', () => {
  it('uses the newly selected stage when the row still carries a stale stage id', async () => {
    const stages: IdName[] = [
      { id: 1, name: 'Old Stage' },
      { id: 2, name: 'New Stage' }
    ];
    const resolver = createLookupResolver();
    const row: TenderRow = {
      id: 10,
      title: 'Project',
      owner: 'Owner A',
      ownerType: 'Government',
      ownerId: 5,
      deadline: '2026-03-08',
      top: 'Type A',
      typeOfProjectId: 7,
      ts: 'New Stage',
      tenderStageId: 1,
      price: 1000,
      assignTo: 'Ahmed',
      acceptDate: '',
      status: 'New',
      statusId: 3,
      doi: 'High',
      degreeOfImportanceId: 8,
      country: 'Egypt',
      countryId: 9,
      inCharge: 'Sara'
    };

    const prepared = await firstValueFrom(
      prepareTenderProjectRowForSave({
        ...resolver,
        row,
        countries: [{ id: 9, name: 'Egypt' }],
        owners: [{ id: 5, name: 'Owner A' }],
        stages,
        top: [{ id: 7, name: 'Type A' }],
        createCountry: name => of({ id: 99, name }),
        createOwner: (name, _countryId) => of({ id: 98, name }),
        createTenderStage: name => of({ id: 97, name }),
        createTypeOfProject: name => of({ id: 96, name }),
        onCountriesChange: () => undefined,
        onOwnersChange: () => undefined,
        onStagesChange: () => undefined,
        onTopChange: () => undefined
      })
    );

    expect(prepared.ts).toBe('New Stage');
    expect(prepared.tenderStageId).toBe(2);
  });

  it('uses the newly selected owner when the row still carries a stale owner id', async () => {
    const owners: IdName[] = [
      { id: 5, name: 'Owner A' },
      { id: 6, name: 'Owner B' }
    ];
    const resolver = createLookupResolver();
    const row: TenderRow = {
      id: 11,
      title: 'Project',
      owner: 'Owner B',
      ownerType: 'Government',
      ownerId: 5,
      deadline: '2026-03-08',
      top: 'Type A',
      typeOfProjectId: 7,
      ts: 'Stage A',
      tenderStageId: 4,
      price: 1000,
      assignTo: 'Ahmed',
      acceptDate: '',
      status: 'New',
      statusId: 3,
      doi: 'High',
      degreeOfImportanceId: 8,
      country: 'Egypt',
      countryId: 9,
      inCharge: 'Sara'
    };

    const prepared = await firstValueFrom(
      prepareTenderProjectRowForSave({
        ...resolver,
        row,
        countries: [{ id: 9, name: 'Egypt' }],
        owners,
        stages: [{ id: 4, name: 'Stage A' }],
        top: [{ id: 7, name: 'Type A' }],
        createCountry: name => of({ id: 99, name }),
        createOwner: (name, _countryId) => of({ id: 98, name }),
        createTenderStage: name => of({ id: 97, name }),
        createTypeOfProject: name => of({ id: 96, name }),
        onCountriesChange: () => undefined,
        onOwnersChange: () => undefined,
        onStagesChange: () => undefined,
        onTopChange: () => undefined
      })
    );

    expect(prepared.owner).toBe('Owner B');
    expect(prepared.ownerId).toBe(6);
  });
});
