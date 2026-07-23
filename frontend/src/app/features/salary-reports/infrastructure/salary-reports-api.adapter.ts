import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient } from '@infrastructure/http/api-client.service';
import { SalaryReportsPort } from '../application/ports/salary-reports.port';
import type { SalaryOptions, SalaryReportDetail, SalaryReportDraft } from '../domain/salary-report.models';

@Injectable({ providedIn: 'root' })
export class SalaryReportsApiAdapter extends SalaryReportsPort {
  private readonly api = inject(ApiClient);

  loadOptions(): Observable<SalaryOptions> {
    return this.api.get<SalaryOptions>('salary-reports/options');
  }

  getById(id: string): Observable<SalaryReportDetail> {
    return this.api.get<SalaryReportDetail>(
      `salary-reports/${encodeURIComponent(id)}`,
      undefined,
      { suppressErrorLog: true, retries: 1 }
    );
  }

  submit(draft: SalaryReportDraft, idempotencyKey: string): Observable<SalaryReportDetail> {
    return this.api.post<SalaryReportDetail>('salary-reports', {
      country: draft.country,
      city: draft.city,
      discipline: draft.discipline,
      yearsOfExperience: Number(draft.yearsOfExperience),
      companyType: draft.companyType,
      workMode: draft.workMode,
      currency: draft.currency,
      monthlyNetSalary: Number(draft.monthlyNetSalary),
      housingProvided: draft.housingProvided || null,
      transportationProvided: draft.transportationProvided || null,
      annualBonus: draft.annualBonus || null,
      salaryFairness: draft.salaryFairness || null,
      recommendField: draft.recommendField || null,
      negotiationAdvice: draft.negotiationAdvice || null,
      professionalCertificate: draft.professionalCertificate || null,
      benefits: draft.benefits || null,
      highestEducation: draft.highestEducation || null,
      dailyWorkHours: draft.dailyWorkHours,
      extraDayOff: draft.extraDayOff || null
    }, { headers: { 'Idempotency-Key': idempotencyKey } });
  }
}
