import type { TenderRow } from './project-details.models';

export type ProjectTitleRenamePayload = {
  from: TenderRow | null;
  to: string;
};

export type PendingProjectDetailsAction = { type: 'close' } | { type: 'switch'; row: TenderRow };

export type PendingProjectDetailsActionDecision =
  | { type: 'none' }
  | { type: 'wait' }
  | { type: 'clear' }
  | { type: 'request-save'; snapshot: string }
  | { type: 'emit-close' }
  | { type: 'emit-switch'; row: TenderRow };

export function buildProjectDetailsSnapshot(row: TenderRow | null | undefined): string {
  if (!row) {
    return '';
  }

  return JSON.stringify({
    id: row.id ?? null,
    ownerId: row.ownerId ?? null,
    ownerTypeId: row.ownerTypeId ?? null,
    statusId: row.statusId ?? null,
    tenderStageId: row.tenderStageId ?? null,
    typeOfProjectId: row.typeOfProjectId ?? null,
    degreeOfImportanceId: row.degreeOfImportanceId ?? null,
    countryId: row.countryId ?? null,
    title: row.title ?? '',
    description: row.description ?? null,
    owner: row.owner ?? '',
    ownerType: row.ownerType ?? '',
    deadline: row.deadline ?? '',
    startDate: row.startDate ?? '',
    endDate: row.endDate ?? '',
    top: row.top ?? '',
    ts: row.ts ?? '',
    price: row.price ?? null,
    assignTo: row.assignTo ?? '',
    acceptDate: row.acceptDate ?? '',
    status: row.status ?? '',
    prb: row.prb ?? null,
    consultant: row.consultant ?? null,
    delayReasons: row.delayReasons ?? null,
    doi: row.doi ?? '',
    country: row.country ?? '',
    inCharge: row.inCharge ?? ''
  });
}

export function resolvePendingProjectDetailsAction(params: {
  action: PendingProjectDetailsAction | null;
  currentSnapshot: string;
  persistedSnapshot: string;
  saveBusy: boolean;
  detailsLoading: boolean;
  pendingLookups: number;
  waitingForSave: boolean;
  saveCycleFinished: boolean;
}): PendingProjectDetailsActionDecision {
  const {
    action,
    currentSnapshot,
    persistedSnapshot,
    saveBusy,
    detailsLoading,
    pendingLookups,
    waitingForSave,
    saveCycleFinished
  } = params;

  if (!action) {
    return { type: 'none' };
  }

  const dirty = Boolean(currentSnapshot) && currentSnapshot !== persistedSnapshot;
  if (!dirty) {
    if (saveBusy || detailsLoading || pendingLookups > 0) {
      return { type: 'wait' };
    }

    return action.type === 'close'
      ? { type: 'emit-close' }
      : { type: 'emit-switch', row: action.row };
  }

  if (pendingLookups > 0 || saveBusy || detailsLoading) {
    return { type: 'wait' };
  }

  if (waitingForSave) {
    return saveCycleFinished ? { type: 'clear' } : { type: 'wait' };
  }

  return { type: 'request-save', snapshot: currentSnapshot };
}
