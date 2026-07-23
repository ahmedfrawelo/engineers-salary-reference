import {
  buildReportingExportRows,
  getSearchableReportingFields,
  resolveReportingMetrics
} from './report-definition.service';
import type { ReportingTemplateDefinition } from '../models/reporting.models';

describe('report definition helpers', () => {
  const definition: ReportingTemplateDefinition = {
    id: 'reports',
    title: 'Reports',
    fields: [
      { key: 'title', label: 'Title', type: 'string', searchable: true },
      { key: 'owner.name', label: 'Owner', type: 'string', searchable: true },
      { key: 'value', label: 'Value', type: 'currency' },
      { key: 'internalNote', label: 'Internal note', type: 'string', exportable: false }
    ],
    metrics: [
      { key: 'count', label: 'Reports', aggregation: 'count' },
      { key: 'value', label: 'Value', aggregation: 'sum', field: 'value', format: 'currency' },
      {
        key: 'ready',
        label: 'Ready',
        aggregation: 'countWhere',
        where: [{ field: 'status', operator: 'equals', value: 'Ready' }]
      }
    ]
  };

  const rows = [
    { title: 'Alpha', owner: { name: 'Mona' }, value: 100, status: 'Ready', internalNote: 'x' },
    { title: 'Beta', owner: { name: 'Omar' }, value: 250, status: 'Draft', internalNote: 'y' }
  ];

  it('resolves searchable fields from the definition', () => {
    expect(getSearchableReportingFields(definition)).toEqual(['title', 'owner.name']);
  });

  it('builds export rows from exportable fields and nested values', () => {
    expect(buildReportingExportRows(rows, definition)).toEqual([
      { Title: 'Alpha', Owner: 'Mona', Value: 100 },
      { Title: 'Beta', Owner: 'Omar', Value: 250 }
    ]);
  });

  it('resolves configured metrics', () => {
    expect(resolveReportingMetrics(rows, definition)).toMatchObject([
      { key: 'count', value: '2', rawValue: 2 },
      { key: 'value', value: '$350', rawValue: 350 },
      { key: 'ready', value: '1', rawValue: 1 }
    ]);
  });
});
