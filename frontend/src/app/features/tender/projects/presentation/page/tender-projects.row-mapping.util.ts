import type { IdName, TenderProject } from './tender-projects.contracts';
import type { TenderRow } from './tender-project-details/project-details.component';
import type { Status } from './tender-projects.types';

export interface TenderProjectRowMappingHost {
  debugMode: boolean;
  debugLog(...args: unknown[]): void;
  owners: IdName[];
  ownerTypes: IdName[];
  statuses: IdName[];
  top: IdName[];
  stages: IdName[];
  doi: IdName[];
  countries: IdName[];
  pickId(...values: unknown[]): number | null;
  pickName(...values: unknown[]): string | null;
  normalizeLabel(value: unknown): string | null;
  coalesceLabel(
    preferred: string | null,
    list: IdName[],
    id: number | null,
    fallback: string
  ): string;
}

export function mapTenderProjectToRow(
  host: TenderProjectRowMappingHost,
  project: TenderProject
): TenderRow {
  const source = project as TenderProject & Record<string, unknown>;
  if (host.debugMode) {
    host.debugLog('[mapToRow] Mapping project:', source);
    host.debugLog('[mapToRow] Full project object:', JSON.stringify(source, null, 2));
  }

  const projectId = host.pickId(
    source.id,
    source.Id,
    source.ID,
    source.projectId,
    source.projectID,
    source.project_id,
    source.ProjectId,
    source.ProjectID
  );
  const ownerId = host.pickId(source.ownerId, source.ownerID, source.owner_id, source.owner);
  const statusId = host.pickId(source.statusId, source.statusID, source.status_id, source.status);
  const ownerTypeId = host.pickId(
    source.ownerTypeId,
    source.ownerTypeID,
    source.ownerType_id,
    source.ownerType,
    source.owner_type,
    source.ownerCategoryId,
    source.ownerCategory
  );
  const tenderStageId = host.pickId(
    source.tenderStageId,
    source.tenderStageID,
    source.stageId,
    source.stageID,
    source.stage_id,
    source.tenderStage,
    source.stage
  );
  const typeOfProjectId = host.pickId(
    source.typeOfProjectId,
    source.typeOfProjectID,
    source.typeId,
    source.typeID,
    source.projectTypeId,
    source.projectTypeID,
    source.typeOfProject,
    source.type,
    source.projectType
  );
  const degreeOfImportanceId = host.pickId(
    source.degreeOfImportanceId,
    source.degreeOfImportanceID,
    source.degreeId,
    source.importanceId,
    source.importanceID,
    source.degreeOfImportance,
    source.importance,
    source.degree
  );
  const countryId = host.pickId(
    source.countryId,
    source.countryID,
    source.country_id,
    source.country
  );

  const ownerName = host.coalesceLabel(
    host.pickName(source.ownerName, source.owner),
    host.owners,
    ownerId,
    '-'
  );
  const statusName = host.coalesceLabel(
    host.pickName(source.statusName, source.status),
    host.statuses,
    statusId,
    'New'
  ) as Status;
  const typeName = host.coalesceLabel(
    host.pickName(
      source.typeOfProjectName,
      source.typeName,
      source.projectTypeName,
      source.typeOfProject,
      source.type,
      source.projectType
    ),
    host.top,
    typeOfProjectId,
    'Other'
  );
  const stageName = host.coalesceLabel(
    host.pickName(source.tenderStageName, source.stageName, source.tenderStage, source.stage),
    host.stages,
    tenderStageId,
    '-'
  );
  const doiName = host.coalesceLabel(
    host.pickName(
      source.degreeOfImportanceName,
      source.importanceName,
      source.degreeOfImportance,
      source.importance,
      source.degree
    ),
    host.doi,
    degreeOfImportanceId,
    '-'
  );
  const countryName = host.coalesceLabel(
    host.pickName(source.countryName, source.country),
    host.countries,
    countryId,
    'Other'
  );
  const ownerTypeName = host.coalesceLabel(
    host.pickName(
      source.ownerTypeName,
      source.ownerType,
      source.ownerCategoryName,
      source.ownerCategory
    ),
    host.ownerTypes,
    ownerTypeId,
    '-'
  );
  const delayReasons = host.normalizeLabel(
    source.delayReasons ?? source.delayReason ?? source.delay_reason
  );
  const consultant = host.normalizeLabel(
    source.consultant ?? source.consultantName ?? source.consultant_name
  );
  const rawPrb = source.prb ?? source['prbCode'];
  const prbValue =
    typeof rawPrb === 'number' || typeof rawPrb === 'string'
      ? rawPrb
      : (host.normalizeLabel(rawPrb) ?? '?');

  const row = {
    id: projectId ?? undefined,
    ownerId: ownerId ?? undefined,
    ownerTypeId: ownerTypeId ?? undefined,
    statusId: statusId ?? undefined,
    tenderStageId: tenderStageId ?? undefined,
    typeOfProjectId: typeOfProjectId ?? undefined,
    degreeOfImportanceId: degreeOfImportanceId ?? undefined,
    countryId: countryId ?? undefined,
    title:
      host.normalizeLabel(
        source.name ?? source.title ?? source.projectTitle ?? source.projectName
      ) ?? '?',
    description: host.normalizeLabel(source.description ?? source.desc) ?? null,
    owner: ownerName,
    ownerType: ownerTypeName,
    deadline: host.normalizeLabel(source.deadline ?? source['dueDate']) ?? '',
    startDate: host.normalizeLabel(source.startDate ?? source['startedDate']) ?? '',
    endDate: host.normalizeLabel(source.endDate ?? source['finishedDate']) ?? '',
    top: typeName,
    ts: stageName,
    price: source.price ?? undefined,
    assignTo:
      host.normalizeLabel(source.assignTo ?? source.assignedTo ?? source.assignee) ?? 'Unassigned',
    acceptDate: host.normalizeLabel(source.acceptDate ?? source['acceptedDate']) ?? '',
    status: statusName,
    prb: prbValue,
    consultant: consultant ?? '',
    delayReasons: delayReasons ?? '',
    doi: doiName,
    country: countryName,
    inCharge: host.normalizeLabel(source.inCharge ?? source.incharge ?? source.lead) ?? '?',
    tone: host.normalizeLabel(source.tone) ?? null,
    customLabel: host.normalizeLabel(source.customLabel ?? source.custom_label) ?? null,
    createdAt: host.normalizeLabel(source.createdAt ?? source.created_at) ?? null
  };
  host.debugLog('[mapToRow] Mapped row.owner:', row.owner);
  return row;
}
