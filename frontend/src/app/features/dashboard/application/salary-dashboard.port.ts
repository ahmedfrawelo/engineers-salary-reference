import type { Observable } from 'rxjs';
import type { SalaryDashboardFilters, SalaryDashboardSnapshot } from '../domain/salary-dashboard.models';

export abstract class SalaryDashboardPort {
  abstract loadSnapshot(filters: SalaryDashboardFilters): Observable<SalaryDashboardSnapshot>;
}
