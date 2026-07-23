import { supportsSalaryReportEventStream } from './tender-projects-realtime.adapter';

describe('supportsSalaryReportEventStream', () => {
  it('does not open an unsupported SSE connection to the public Worker API', () => {
    expect(
      supportsSalaryReportEventStream('https://engineers-salary-api.example.workers.dev/api')
    ).toBe(false);
  });

  it('keeps the local ASP.NET event stream available', () => {
    expect(supportsSalaryReportEventStream('/api')).toBe(true);
  });
});
