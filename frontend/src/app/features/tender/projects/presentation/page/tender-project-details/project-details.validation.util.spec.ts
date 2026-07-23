import { describe, expect, it } from 'vitest';

import {
  collectProjectValidationIssues,
  normalizeProjectValidationField,
  normalizeProjectValidationIssues,
  summarizeProjectValidation
} from './project-details.validation.util';
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

describe('project details validation', () => {
  it('returns no issues for a complete baseline row', () => {
    expect(collectProjectValidationIssues(createRow())).toEqual([]);
  });

  it('reports missing ownership and scheduling fields', () => {
    const issues = collectProjectValidationIssues(
      createRow({
        owner: '',
        ownerType: '',
        country: '',
        deadline: '',
        ts: '',
        top: '',
        assignTo: '',
        inCharge: ''
      })
    );

    expect(issues.map(issue => issue.field)).toEqual([
      'deadline',
      'owner',
      'country',
      'ownerType',
      'assignTo',
      'inCharge',
      'ts',
      'top'
    ]);
  });

  it('reports invalid timeline and numeric values', () => {
    const summary = summarizeProjectValidation(
      createRow({
        deadline: '2026-04-05',
        startDate: '2026-04-07',
        endDate: '2026-04-06',
        price: -10,
        prb: -2
      })
    );

    expect(summary.errorCount).toBe(4);
    expect(summary.warningCount).toBe(0);
    expect(summary.issues.map(issue => issue.field)).toEqual([
      'deadline',
      'endDate',
      'price',
      'prb'
    ]);
  });

  it('normalizes API field aliases into known project validation fields', () => {
    expect(normalizeProjectValidationField('ProjectName')).toBe('title');
    expect(normalizeProjectValidationField('OwnerId')).toBe('owner');
    expect(normalizeProjectValidationField('TenderStageName')).toBe('ts');
    expect(normalizeProjectValidationField('Type_Of_Project')).toBe('top');
    expect(normalizeProjectValidationField('unknownField')).toBeNull();
  });

  it('merges external validation issues ahead of local warnings', () => {
    const externalIssues = normalizeProjectValidationIssues([
      { field: 'ProjectName', message: 'Project name already exists.' },
      { field: 'OwnerId', message: 'Owner is required.' }
    ]);

    const issues = collectProjectValidationIssues(
      createRow({
        title: '',
        owner: '',
        country: '',
        assignTo: ''
      }),
      externalIssues
    );

    expect(issues.slice(0, 3)).toEqual([
      { field: 'title', severity: 'error', message: 'Project name already exists.' },
      { field: 'owner', severity: 'error', message: 'Owner is required.' },
      { field: 'title', severity: 'error', message: 'Project title is required.' }
    ]);
  });
});
