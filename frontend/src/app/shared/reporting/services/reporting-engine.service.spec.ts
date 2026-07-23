import { runReportingQuery, summarizeReportingRows } from './reporting-engine.service';

describe('reporting engine', () => {
  const rows = [
    {
      title: 'Pipeline Health',
      status: 'Ready',
      owner: 'Mona',
      health: 92,
      value: 1200,
      lastRun: '2026-05-18',
      starred: true
    },
    {
      title: 'Cost Control',
      status: 'Failed',
      owner: 'Omar',
      health: 61,
      value: 2400,
      lastRun: '2026-05-11',
      starred: false
    },
    {
      title: 'Supplier Performance',
      status: 'Scheduled',
      owner: 'Mona',
      health: 78,
      value: 1800,
      lastRun: '2026-05-15',
      starred: false
    }
  ];

  it('runs search, filters, and date sorting in one query', () => {
    const result = runReportingQuery(rows, {
      search: { term: 'performance', fields: ['title', 'owner'] },
      filters: [{ field: 'health', operator: 'gte', value: 70 }],
      sort: { field: 'lastRun', direction: 'desc', valueType: 'date' }
    });

    expect(result.totalRows).toBe(3);
    expect(result.filteredRows).toBe(1);
    expect(result.activeFilterCount).toBe(2);
    expect(result.rows[0].title).toBe('Supplier Performance');
  });

  it('supports ranked sorting for business statuses', () => {
    const result = runReportingQuery(rows, {
      sort: {
        field: 'status',
        direction: 'asc',
        valueType: 'rank',
        rankOrder: ['Failed', 'Scheduled', 'Ready']
      }
    });

    expect(result.rows.map(row => row.status)).toEqual(['Failed', 'Scheduled', 'Ready']);
  });

  it('summarizes counts, sums, and averages', () => {
    const summary = summarizeReportingRows(rows, {
      countFields: ['owner', 'status'],
      sumFields: ['value'],
      averageFields: ['health']
    });

    expect(summary.totalRows).toBe(3);
    expect(summary.counts.owner).toEqual({ Mona: 2, Omar: 1 });
    expect(summary.counts.status.Failed).toBe(1);
    expect(summary.sums.value).toBe(5400);
    expect(summary.averages.health).toBeCloseTo(77);
  });
});
