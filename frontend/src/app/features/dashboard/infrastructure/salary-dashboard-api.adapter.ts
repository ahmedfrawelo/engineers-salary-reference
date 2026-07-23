import { Injectable, inject } from '@angular/core';
import { forkJoin, map, type Observable } from 'rxjs';
import { ApiClient } from '@infrastructure/http/api-client.service';
import { SalaryDashboardPort } from '../application/salary-dashboard.port';
import type {
  SalaryDashboardBreakdown,
  SalaryDashboardFilters,
  SalaryDashboardSnapshot
} from '../domain/salary-dashboard.models';

type ReadBreakdownDto = { value: string; count: number; averageMonthlyNetSalary: number };
type ReadSummaryDto = {
  totalReports: number;
  averageMonthlyNetSalary: number | null;
  minimumMonthlyNetSalary: number | null;
  maximumMonthlyNetSalary: number | null;
  byDiscipline: ReadBreakdownDto[];
  byExperience: ReadBreakdownDto[];
};
type ReadRowDto = {
  id: string;
  discipline: string;
  city: string;
  monthlyNetSalary: number;
  currency: string;
  yearsOfExperience: number;
  workMode: string;
};
type ReadPageDto = { items: ReadRowDto[] };
type AggregateResponseDto = { aggregates: Array<{ field: string; value: number | null }> };
type SalaryOptionsDto = {
  disciplines: string[];
  workModes: string[];
  currencies: string[];
  yearsOfExperience: number[];
};

@Injectable({ providedIn: 'root' })
export class SalaryDashboardApiAdapter extends SalaryDashboardPort {
  private readonly api = inject(ApiClient);

  loadSnapshot(filters: SalaryDashboardFilters): Observable<SalaryDashboardSnapshot> {
    const query = this.toReadQuery(filters);
    return forkJoin({
      summary: this.api.get<ReadSummaryDto>('salary-reports/read-rows/summary', query),
      reports: this.api.get<ReadPageDto>('salary-reports/read-rows', {
        ...query,
        pageNumber: 1,
        pageSize: 6,
        sortBy: 'id',
        sortDirection: 'desc'
      }),
      median: this.api.post<AggregateResponseDto>('salary-reports/read-rows/aggregates', {
        filters: query,
        scope: 'filtered',
        aggregates: [{ field: 'monthlyNetSalary', operation: 'median', resultKey: 'medianSalary' }]
      }),
      options: this.api.get<SalaryOptionsDto>('salary-reports/options')
    }).pipe(map(result => ({
      summary: {
        totalReports: result.summary.totalReports,
        averageSalary: result.summary.averageMonthlyNetSalary ?? 0,
        medianSalary: result.median.aggregates.find(item => item.field === 'medianSalary')?.value ?? 0,
        minSalary: result.summary.minimumMonthlyNetSalary ?? 0,
        maxSalary: result.summary.maximumMonthlyNetSalary ?? 0,
        currency: 'EGP',
        byDiscipline: result.summary.byDiscipline.map(this.mapBreakdown),
        bySeniority: result.summary.byExperience.map(this.mapBreakdown)
      },
      latestReports: result.reports.items.map(report => ({
        ...report,
        roleTitle: report.discipline,
        seniority: `${report.yearsOfExperience} ${report.yearsOfExperience === 1 ? 'year' : 'years'}`,
        companyName: 'Anonymous company',
        isAnonymous: true
      })),
      options: {
        disciplines: result.options.disciplines,
        seniorities: result.options.yearsOfExperience.map(value => `${value} ${value === 1 ? 'year' : 'years'}`),
        workModes: result.options.workModes,
        currencies: result.options.currencies
      }
    })));
  }

  private toReadQuery(filters: SalaryDashboardFilters): Record<string, string | number | undefined> {
    const years = Number.parseInt(filters.experience ?? '', 10);
    return {
      discipline: filters.discipline,
      workMode: filters.workMode,
      currency: 'EGP',
      minExperience: Number.isFinite(years) ? years : undefined,
      maxExperience: Number.isFinite(years) ? years : undefined
    };
  }

  private readonly mapBreakdown = (item: ReadBreakdownDto): SalaryDashboardBreakdown => ({
    label: item.value,
    count: item.count,
    averageSalary: item.averageMonthlyNetSalary
  });
}
