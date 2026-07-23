import type { AuditTrail } from './tender-projects.contracts';
import type { TenderRow } from './tender-project-details/project-details.component';
import type { ProjectToolbarFilter } from './tender-projects.component.models';
import { getProjectIdFromTenderRow } from './tender-projects.mapping.util';

type AuditChange = { field: string; from?: string; to?: string };

type AuditUser = {
  name?: string | null;
  email?: string | null;
};

export interface TenderProjectAuditHost {
  authUserFacade: {
    user(): AuditUser | null;
  };
  grid?: {
    reconcileFiltersForRowUpdate(previousRow: TenderRow, nextRow: TenderRow): void;
  } | null;
  projectToolbarFilters: ProjectToolbarFilter[];
  touchProjectToolbarFilters(): void;
  normalizeLabel(value: unknown): string | null;
  parseId(value: unknown): number | null;
  parseNumberOrNull(value: unknown): number | null;
  formatDate(value: unknown): string | null | undefined;
  formatPercentFromDecimal(value: unknown, fallback?: string): string;
}

function projectAuditFieldDescriptors(host: TenderProjectAuditHost): Array<{
  field: string;
  read: (row: TenderRow) => string | null;
}> {
  const asText = (value: unknown): string | null => host.normalizeLabel(value);
  const asDate = (value: unknown): string | null =>
    host.normalizeLabel(value) ? host.normalizeLabel(host.formatDate(value)) : null;
  const asNumber = (value: unknown): string | null => {
    const parsed = host.parseNumberOrNull(value);
    if (parsed == null) {
      return null;
    }
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(parsed);
  };
  const asPercent = (value: unknown): string | null =>
    host.normalizeLabel(host.formatPercentFromDecimal(value, ''));

  return [
    { field: 'Project Title', read: row => asText(row.title) },
    { field: 'Owner', read: row => asText(row.owner) },
    { field: 'Country', read: row => asText(row.country) },
    { field: 'Deadline', read: row => asDate(row.deadline) },
    { field: 'Assign To', read: row => asText(row.assignTo) },
    { field: 'In Charge', read: row => asText(row.inCharge) },
    { field: 'Accept Date', read: row => asDate(row.acceptDate) },
    { field: 'Start Date', read: row => asDate(row.startDate) },
    { field: 'End Date', read: row => asDate(row.endDate) },
    { field: 'Pricing', read: row => asNumber(row.price) },
    { field: 'Status', read: row => asText(row.status) },
    { field: 'Tender Stage (TS)', read: row => asText(row.ts) },
    { field: 'Degree Of Importance', read: row => asText(row.doi) },
    { field: 'TOP', read: row => asText(row.top) },
    { field: 'Consultant', read: row => asText(row.consultant) },
    { field: 'Project Repeatability Percent', read: row => asPercent(row.prb) },
    { field: 'Delay Reason', read: row => asText(row.delayReasons) }
  ];
}

export function buildTenderProjectUpdateAuditChanges(
  host: TenderProjectAuditHost,
  previousRow: TenderRow,
  nextRow: TenderRow
): AuditChange[] {
  const normalizeCompare = (value: string | null): string => (value ?? '').trim().toLowerCase();
  const changes: AuditChange[] = [];
  for (const descriptor of projectAuditFieldDescriptors(host)) {
    const from = descriptor.read(previousRow);
    const to = descriptor.read(nextRow);
    if (!from && !to) {
      continue;
    }
    if (normalizeCompare(from) === normalizeCompare(to)) {
      continue;
    }
    changes.push({
      field: descriptor.field,
      from: from ?? undefined,
      to: to ?? undefined
    });
  }
  return changes;
}

export function buildTenderProjectSnapshotAuditChanges(
  host: TenderProjectAuditHost,
  row: TenderRow,
  direction: 'from' | 'to'
): AuditChange[] {
  const changes: AuditChange[] = [];
  for (const descriptor of projectAuditFieldDescriptors(host)) {
    const value = descriptor.read(row);
    if (!value) {
      continue;
    }
    changes.push(
      direction === 'to'
        ? { field: descriptor.field, to: value }
        : { field: descriptor.field, from: value }
    );
  }
  return changes;
}

export function buildTenderProjectLifecycleAudit(
  host: TenderProjectAuditHost,
  action: 'created' | 'deleted',
  row: TenderRow
): AuditTrail | null {
  const projectId = getProjectIdFromTenderRow(row, value => host.parseId(value));
  if (!projectId) {
    return null;
  }

  const changes = buildTenderProjectSnapshotAuditChanges(
    host,
    row,
    action === 'created' ? 'to' : 'from'
  );
  const nowIso = new Date().toISOString();
  const user = host.authUserFacade.user();
  const actor = user?.name?.trim() || user?.email?.trim() || 'You';
  const projectTitle = host.normalizeLabel(row.title);
  const audit: AuditTrail = {
    entityName: 'Projects',
    entityId: projectId,
    actionType: action,
    action,
    message: action === 'created' ? 'Created project' : 'Deleted project',
    description: changes.length ? JSON.stringify(changes) : (projectTitle ?? undefined),
    details: changes.length ? JSON.stringify(changes) : (projectTitle ?? undefined),
    changes: changes.length ? changes : undefined,
    createdAt: nowIso,
    createdOn: nowIso,
    timestamp: nowIso,
    userName: actor,
    performedBy: actor,
    createdBy: actor,
    entityDisplayName: projectTitle ?? undefined,
    targetName: projectTitle ?? undefined,
    referenceName: projectTitle ?? undefined
  };
  (audit as Record<string, unknown>)['projectId'] = projectId;
  return audit;
}

export function buildTenderProjectRowUpdateAudit(
  host: TenderProjectAuditHost,
  previousRow: TenderRow,
  nextRow: TenderRow
): AuditTrail | null {
  const projectId =
    getProjectIdFromTenderRow(nextRow, value => host.parseId(value)) ??
    getProjectIdFromTenderRow(previousRow, value => host.parseId(value));
  if (!projectId) {
    return null;
  }

  const changes = buildTenderProjectUpdateAuditChanges(host, previousRow, nextRow);
  if (!changes.length) {
    return null;
  }

  const nowIso = new Date().toISOString();
  const user = host.authUserFacade.user();
  const actor = user?.name?.trim() || user?.email?.trim() || 'You';
  const projectTitle = host.normalizeLabel(nextRow.title) ?? host.normalizeLabel(previousRow.title);

  const audit: AuditTrail = {
    entityName: 'Projects',
    entityId: projectId,
    actionType: 'updated',
    action: 'updated',
    message: changes.length === 1 ? `Updated ${changes[0].field}` : 'Updated',
    description: JSON.stringify(changes),
    details: JSON.stringify(changes),
    changes,
    createdAt: nowIso,
    createdOn: nowIso,
    timestamp: nowIso,
    userName: actor,
    performedBy: actor,
    createdBy: actor,
    entityDisplayName: projectTitle ?? undefined,
    targetName: projectTitle ?? undefined,
    referenceName: projectTitle ?? undefined,
    field: changes.length === 1 ? changes[0].field : undefined
  };
  (audit as Record<string, unknown>)['projectId'] = projectId;
  return audit;
}

export function syncTenderProjectFiltersForRowUpdate(
  host: TenderProjectAuditHost,
  previousRow: TenderRow | null | undefined,
  nextRow: TenderRow | null | undefined
): void {
  if (!previousRow || !nextRow) {
    return;
  }

  const filters = Array.isArray(host.projectToolbarFilters) ? host.projectToolbarFilters : [];
  if (filters.length) {
    const normalize = (value: unknown): string =>
      String(value ?? '')
        .trim()
        .toLowerCase();
    const readFieldValue = (row: TenderRow, field: string): string => {
      const value = (row as Record<string, unknown>)[field];
      return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
    };

    let changed = false;
    const nextFilters = filters.map(filter => {
      const field = String(filter.field ?? '').trim();
      if (!field || !filter.value?.trim()) {
        return filter;
      }

      const previousValue = readFieldValue(previousRow, field);
      const updatedValue = readFieldValue(nextRow, field);
      if (!previousValue || !updatedValue || normalize(previousValue) === normalize(updatedValue)) {
        return filter;
      }

      const canFollowValue =
        filter.operator === 'equals' ||
        filter.operator === 'contains' ||
        filter.operator === 'startsWith' ||
        filter.operator === 'endsWith';
      if (!canFollowValue || normalize(filter.value) !== normalize(previousValue)) {
        return filter;
      }

      changed = true;
      return { ...filter, value: updatedValue };
    });

    if (changed) {
      host.projectToolbarFilters = nextFilters;
      host.touchProjectToolbarFilters();
    }
  }

  host.grid?.reconcileFiltersForRowUpdate(previousRow, nextRow);
}
