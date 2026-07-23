import type { Observable } from 'rxjs';
import type { SalaryOptions, SalaryReportDetail, SalaryReportDraft } from '../../domain/salary-report.models';

export abstract class SalaryReportsPort {
  abstract loadOptions(): Observable<SalaryOptions>;
  abstract getById(id: string): Observable<SalaryReportDetail>;
  abstract submit(draft: SalaryReportDraft, idempotencyKey: string): Observable<SalaryReportDetail>;
}
