import { TenderRow } from './tender-project-details/project-details.component';
import type { Status } from './tender-projects.types';

type NumberParser = (value: unknown) => number | null;

export function normalizeBulkTextValue(value: unknown): string {
  if (value == null) return '';
  const text = String(value).trim();
  if (!text || text === '-' || text === '?') {
    return '';
  }
  return text;
}

export function sameBulkTextValue(a: unknown, b: unknown): boolean {
  return normalizeBulkTextValue(a).toLowerCase() === normalizeBulkTextValue(b).toLowerCase();
}

export function buildBulkEditPatchFromRows(
  payload: TenderRow,
  baseline: TenderRow,
  parseNumberOrNull: NumberParser
): Partial<TenderRow> {
  const patch: Partial<TenderRow> = {};

  const title = normalizeBulkTextValue(payload.title);
  const baselineTitle = normalizeBulkTextValue(baseline.title);
  if (title && title !== baselineTitle) {
    patch.title = title;
  }

  const description = normalizeBulkTextValue(payload.description);
  const baselineDescription = normalizeBulkTextValue(baseline.description);
  if (description !== baselineDescription) {
    patch.description = description;
  }

  const owner = normalizeBulkTextValue(payload.owner);
  const baselineOwner = normalizeBulkTextValue(baseline.owner);
  if (owner && owner !== baselineOwner) {
    patch.owner = owner;
  }

  const ownerType = normalizeBulkTextValue(payload.ownerType);
  const baselineOwnerType = normalizeBulkTextValue(baseline.ownerType);
  if (ownerType && ownerType !== baselineOwnerType) {
    patch.ownerType = ownerType;
  }

  const deadline = normalizeBulkTextValue(payload.deadline);
  const baselineDeadline = normalizeBulkTextValue(baseline.deadline);
  if (deadline !== baselineDeadline) {
    patch.deadline = deadline;
  }

  const startDate = normalizeBulkTextValue(payload.startDate);
  const baselineStartDate = normalizeBulkTextValue(baseline.startDate);
  if (startDate !== baselineStartDate) {
    patch.startDate = startDate;
  }

  const endDate = normalizeBulkTextValue(payload.endDate);
  const baselineEndDate = normalizeBulkTextValue(baseline.endDate);
  if (endDate !== baselineEndDate) {
    patch.endDate = endDate;
  }

  const top = normalizeBulkTextValue(payload.top);
  const baselineTop = normalizeBulkTextValue(baseline.top);
  if (top && top !== baselineTop) {
    patch.top = top;
  }

  const ts = normalizeBulkTextValue(payload.ts);
  const baselineTs = normalizeBulkTextValue(baseline.ts);
  if (ts && ts !== baselineTs) {
    patch.ts = ts;
  }

  const assignTo = normalizeBulkTextValue(payload.assignTo);
  const baselineAssignTo = normalizeBulkTextValue(baseline.assignTo);
  if (assignTo !== baselineAssignTo) {
    patch.assignTo = assignTo;
  }

  const acceptDate = normalizeBulkTextValue(payload.acceptDate);
  const baselineAcceptDate = normalizeBulkTextValue(baseline.acceptDate);
  if (acceptDate !== baselineAcceptDate) {
    patch.acceptDate = acceptDate;
  }

  const status = normalizeBulkTextValue(payload.status);
  const baselineStatus = normalizeBulkTextValue(baseline.status);
  if (status && status !== baselineStatus) {
    patch.status = status as Status;
  }

  const doi = normalizeBulkTextValue(payload.doi);
  const baselineDoi = normalizeBulkTextValue(baseline.doi);
  if (doi && doi !== baselineDoi) {
    patch.doi = doi;
  }

  const country = normalizeBulkTextValue(payload.country);
  const baselineCountry = normalizeBulkTextValue(baseline.country);
  if (country && country !== baselineCountry) {
    patch.country = country;
  }

  const inCharge = normalizeBulkTextValue(payload.inCharge);
  const baselineInCharge = normalizeBulkTextValue(baseline.inCharge);
  if (inCharge !== baselineInCharge) {
    patch.inCharge = inCharge;
  }

  const price = parseNumberOrNull(payload.price);
  const baselinePrice = parseNumberOrNull(baseline.price);
  if (price !== baselinePrice) {
    patch.price = price ?? undefined;
  }

  const prb = parseNumberOrNull(payload.prb);
  const baselinePrb = parseNumberOrNull(baseline.prb);
  if (prb !== baselinePrb) {
    patch.prb = prb;
  }

  const consultant = normalizeBulkTextValue(payload.consultant);
  const baselineConsultant = normalizeBulkTextValue(baseline.consultant);
  if (consultant !== baselineConsultant) {
    patch.consultant = consultant;
  }

  const delayReasons = normalizeBulkTextValue(payload.delayReasons);
  const baselineDelayReasons = normalizeBulkTextValue(baseline.delayReasons);
  if (delayReasons !== baselineDelayReasons) {
    patch.delayReasons = delayReasons;
  }

  return patch;
}

export function clearLookupIdsForChangedFieldsInRow(
  next: TenderRow,
  previous: TenderRow
): TenderRow {
  const row = { ...next };
  if (!sameBulkTextValue(row.owner, previous.owner)) {
    row.ownerId = undefined;
  }
  if (!sameBulkTextValue(row.ownerType, previous.ownerType)) {
    row.ownerTypeId = undefined;
  }
  if (!sameBulkTextValue(row.status, previous.status)) {
    row.statusId = undefined;
  }
  if (!sameBulkTextValue(row.ts, previous.ts)) {
    row.tenderStageId = undefined;
  }
  if (!sameBulkTextValue(row.top, previous.top)) {
    row.typeOfProjectId = undefined;
  }
  if (!sameBulkTextValue(row.doi, previous.doi)) {
    row.degreeOfImportanceId = undefined;
  }
  if (!sameBulkTextValue(row.country, previous.country)) {
    row.countryId = undefined;
  }
  return row;
}
