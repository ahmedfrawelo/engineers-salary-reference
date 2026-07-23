import { describe, expect, it } from 'vitest';

import {
  buildProjectDetailsSnapshot,
  resolvePendingProjectDetailsAction,
  type PendingProjectDetailsAction
} from './project-details.panel-action.util';
import type { TenderRow } from './project-details.models';

function createRow(overrides: Partial<TenderRow> = {}): TenderRow {
  return {
    id: 1,
    title: 'Project Alpha',
    owner: 'Built TECH',
    ownerType: 'Government',
    deadline: '2026-04-09',
    top: 'Elec',
    ts: 'InHand',
    assignTo: 'Ahmed',
    acceptDate: '',
    status: 'New',
    country: 'Saudi Arabia',
    inCharge: 'Ranine',
    ...overrides
  };
}

describe('project details pending panel action', () => {
  it('requests save before closing when the panel is dirty', () => {
    const currentSnapshot = buildProjectDetailsSnapshot(createRow({ title: 'Project Beta' }));
    const persistedSnapshot = buildProjectDetailsSnapshot(createRow());

    expect(
      resolvePendingProjectDetailsAction({
        action: { type: 'close' },
        currentSnapshot,
        persistedSnapshot,
        saveBusy: false,
        detailsLoading: false,
        pendingLookups: 0,
        waitingForSave: false,
        saveCycleFinished: false
      })
    ).toEqual({ type: 'request-save', snapshot: currentSnapshot });
  });

  it('emits the queued switch after the row becomes clean', () => {
    const target = createRow({ id: 2, title: 'Project Gamma' });
    const action: PendingProjectDetailsAction = { type: 'switch', row: target };
    const cleanSnapshot = buildProjectDetailsSnapshot(createRow());

    expect(
      resolvePendingProjectDetailsAction({
        action,
        currentSnapshot: cleanSnapshot,
        persistedSnapshot: cleanSnapshot,
        saveBusy: false,
        detailsLoading: false,
        pendingLookups: 0,
        waitingForSave: true,
        saveCycleFinished: true
      })
    ).toEqual({ type: 'emit-switch', row: target });
  });

  it('waits while lookup creation is still in progress after save was deferred', () => {
    const currentSnapshot = buildProjectDetailsSnapshot(createRow({ title: 'Project Beta' }));
    const persistedSnapshot = buildProjectDetailsSnapshot(createRow());

    expect(
      resolvePendingProjectDetailsAction({
        action: { type: 'close' },
        currentSnapshot,
        persistedSnapshot,
        saveBusy: false,
        detailsLoading: false,
        pendingLookups: 1,
        waitingForSave: true,
        saveCycleFinished: false
      })
    ).toEqual({ type: 'wait' });
  });

  it('keeps waiting until the requested save cycle actually finishes', () => {
    const currentSnapshot = buildProjectDetailsSnapshot(createRow({ title: 'Project Beta' }));
    const persistedSnapshot = buildProjectDetailsSnapshot(createRow());

    expect(
      resolvePendingProjectDetailsAction({
        action: { type: 'close' },
        currentSnapshot,
        persistedSnapshot,
        saveBusy: false,
        detailsLoading: false,
        pendingLookups: 0,
        waitingForSave: true,
        saveCycleFinished: false
      })
    ).toEqual({ type: 'wait' });
  });

  it('clears the queued action when the save cycle finishes but the row is still dirty', () => {
    const currentSnapshot = buildProjectDetailsSnapshot(createRow({ title: 'Project Beta' }));
    const persistedSnapshot = buildProjectDetailsSnapshot(createRow());

    expect(
      resolvePendingProjectDetailsAction({
        action: { type: 'close' },
        currentSnapshot,
        persistedSnapshot,
        saveBusy: false,
        detailsLoading: false,
        pendingLookups: 0,
        waitingForSave: true,
        saveCycleFinished: true
      })
    ).toEqual({ type: 'clear' });
  });
});
