import { buildReportCsv, buildReportFileName } from './report-export.service';

describe('report export helpers', () => {
  it('builds CSV with merged headers and escaped values', () => {
    const csv = buildReportCsv([
      { title: 'Tender Alpha', owner: 'Omar', note: 'Ready' },
      { title: 'Tender, Beta', value: 1250, note: 'Needs "review"' }
    ]);

    expect(csv).toBe(
      [
        'title,owner,note,value',
        'Tender Alpha,Omar,Ready,',
        '"Tender, Beta",,"Needs ""review""",1250'
      ].join('\n')
    );
  });

  it('normalizes report file names', () => {
    const fileName = buildReportFileName(
      'Tender Reports / Executive View',
      'csv',
      new Date('2026-05-20T09:00:00.000Z')
    );

    expect(fileName).toBe('tender-reports-executive-view-2026-05-20.csv');
  });
});
