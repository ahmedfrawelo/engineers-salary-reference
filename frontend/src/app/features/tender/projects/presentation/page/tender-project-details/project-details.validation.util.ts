import type { TenderRow } from './project-details.models';

export type ProjectValidationField =
  | 'title'
  | 'owner'
  | 'ownerType'
  | 'country'
  | 'deadline'
  | 'assignTo'
  | 'inCharge'
  | 'status'
  | 'ts'
  | 'top'
  | 'startDate'
  | 'endDate'
  | 'price'
  | 'prb';

export type ProjectValidationSeverity = 'error' | 'warning';

export type ProjectValidationIssue = {
  field: ProjectValidationField;
  severity: ProjectValidationSeverity;
  message: string;
};

export type ProjectValidationIssueInput = {
  field: string;
  message: string;
  severity?: ProjectValidationSeverity;
};

export type ProjectValidationSummary = {
  issues: ProjectValidationIssue[];
  errorCount: number;
  warningCount: number;
};

const PROJECT_VALIDATION_FIELD_ALIASES: Record<string, ProjectValidationField> = {
  title: 'title',
  name: 'title',
  projectname: 'title',
  projecttitle: 'title',
  owner: 'owner',
  ownerid: 'owner',
  ownername: 'owner',
  ownertype: 'ownerType',
  ownertypeid: 'ownerType',
  ownertypename: 'ownerType',
  ownercategory: 'ownerType',
  ownercategoryid: 'ownerType',
  ownercategoryname: 'ownerType',
  country: 'country',
  countryid: 'country',
  countryname: 'country',
  deadline: 'deadline',
  deadlinedate: 'deadline',
  assignto: 'assignTo',
  assignedto: 'assignTo',
  assignee: 'assignTo',
  incharge: 'inCharge',
  personincharge: 'inCharge',
  status: 'status',
  statusid: 'status',
  statusname: 'status',
  ts: 'ts',
  stage: 'ts',
  tenderstage: 'ts',
  tenderstageid: 'ts',
  tenderstagename: 'ts',
  top: 'top',
  projecttype: 'top',
  typeofproject: 'top',
  typeofprojectid: 'top',
  typeofprojectname: 'top',
  startdate: 'startDate',
  start: 'startDate',
  enddate: 'endDate',
  end: 'endDate',
  price: 'price',
  pricing: 'price',
  amount: 'price',
  prb: 'prb'
};

export function normalizeProjectValidationField(field: unknown): ProjectValidationField | null {
  const key = String(field ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return PROJECT_VALIDATION_FIELD_ALIASES[key] ?? null;
}

export function normalizeProjectValidationIssues(
  issues: readonly ProjectValidationIssueInput[] | null | undefined
): ProjectValidationIssue[] {
  if (!issues?.length) {
    return [];
  }

  const normalized: ProjectValidationIssue[] = [];
  for (const issue of issues) {
    const field = normalizeProjectValidationField(issue.field);
    const message = String(issue.message ?? '').trim();
    if (!field || !message) {
      continue;
    }
    normalized.push({
      field,
      message,
      severity: issue.severity ?? 'error'
    });
  }

  return dedupeIssues(normalized);
}

export function collectProjectValidationIssues(
  row: TenderRow | null | undefined,
  externalIssues: readonly ProjectValidationIssue[] = []
): ProjectValidationIssue[] {
  const issues: ProjectValidationIssue[] = [];

  if (row) {
    if (!hasText(row.title)) {
      issues.push({
        field: 'title',
        severity: 'error',
        message: 'Project title is required.'
      });
    }

    if (!hasText(row.deadline)) {
      issues.push({
        field: 'deadline',
        severity: 'error',
        message: 'Add a deadline to keep the project on track.'
      });
    }

    if (!hasText(row.owner)) {
      issues.push({
        field: 'owner',
        severity: 'warning',
        message: 'Assign an owner for accountability.'
      });
    }

    if (!hasText(row.country)) {
      issues.push({
        field: 'country',
        severity: 'warning',
        message: 'Choose the target country.'
      });
    }

    if (!hasText(row.ownerType)) {
      issues.push({
        field: 'ownerType',
        severity: 'warning',
        message: 'Select the owner type.'
      });
    }

    if (!hasText(row.assignTo)) {
      issues.push({
        field: 'assignTo',
        severity: 'warning',
        message: 'Add an assignee for follow-up.'
      });
    }

    if (!hasText(row.inCharge)) {
      issues.push({
        field: 'inCharge',
        severity: 'warning',
        message: 'Pick the person in charge.'
      });
    }

    if (!hasText(row.status)) {
      issues.push({
        field: 'status',
        severity: 'warning',
        message: 'Set the current project status.'
      });
    }

    if (!hasText(row.ts)) {
      issues.push({
        field: 'ts',
        severity: 'warning',
        message: 'Select the tender stage.'
      });
    }

    if (!hasText(row.top)) {
      issues.push({
        field: 'top',
        severity: 'warning',
        message: 'Select the type of project.'
      });
    }

    const deadline = parseIsoDate(row.deadline);
    const startDate = parseIsoDate(row.startDate);
    const endDate = parseIsoDate(row.endDate);

    if (deadline && startDate && deadline.getTime() < startDate.getTime()) {
      issues.push({
        field: 'deadline',
        severity: 'error',
        message: 'Deadline cannot be earlier than the start date.'
      });
    }

    if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
      issues.push({
        field: 'endDate',
        severity: 'error',
        message: 'End date cannot be earlier than the start date.'
      });
    }

    const price = parseNumberish(row.price);
    if (price != null && price < 0) {
      issues.push({
        field: 'price',
        severity: 'error',
        message: 'Pricing must be zero or greater.'
      });
    }

    const prb = parseNumberish(row.prb);
    if (prb != null && prb < 0) {
      issues.push({
        field: 'prb',
        severity: 'error',
        message: 'Project repeatability percent must be zero or greater.'
      });
    }
  }

  return dedupeIssues([...externalIssues, ...issues]);
}

export function summarizeProjectValidation(
  row: TenderRow | null | undefined,
  externalIssues: readonly ProjectValidationIssue[] = []
): ProjectValidationSummary {
  const issues = collectProjectValidationIssues(row, externalIssues);
  return {
    issues,
    errorCount: issues.filter(issue => issue.severity === 'error').length,
    warningCount: issues.filter(issue => issue.severity === 'warning').length
  };
}

function hasText(value: unknown): boolean {
  return String(value ?? '').trim().length > 0;
}

function parseIsoDate(value: unknown): Date | null {
  const iso = String(value ?? '').match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (!iso) {
    return null;
  }

  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function parseNumberish(value: unknown): number | null {
  if (value == null || value === '') {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dedupeIssues(issues: ProjectValidationIssue[]): ProjectValidationIssue[] {
  const seen = new Set<string>();
  return issues.filter(issue => {
    const key = `${issue.field}:${issue.severity}:${issue.message}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
