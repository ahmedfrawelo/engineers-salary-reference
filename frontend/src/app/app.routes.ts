import { Routes } from '@angular/router';
import { SalaryDashboardPort } from './features/dashboard/application/salary-dashboard.port';
import { SalaryDashboardApiAdapter } from './features/dashboard/infrastructure/salary-dashboard-api.adapter';
import { SalaryReportsPort } from './features/salary-reports/application/ports/salary-reports.port';
import { SalaryReportsApiAdapter } from './features/salary-reports/infrastructure/salary-reports-api.adapter';
const salaryReportsProviders = [{ provide: SalaryReportsPort, useExisting: SalaryReportsApiAdapter }];
export const routes: Routes = [
  { path: 'dashboard', providers: [{ provide: SalaryDashboardPort, useExisting: SalaryDashboardApiAdapter }], loadComponent: () => import('./features/dashboard/presentation/page/dashboard-feature-page.component').then(m => m.DashboardFeaturePageComponent) },
  { path: 'salary-reports', providers: salaryReportsProviders, loadComponent: () => import('./features/tender/projects/presentation/tender-projects-feature-page.component').then(m => m.TenderProjectsFeaturePageComponent) },
  { path: 'submit-report', providers: salaryReportsProviders, loadComponent: () => import('./features/salary-reports/presentation/submit-salary-report-page.component').then(m => m.SubmitSalaryReportPageComponent) },
  { path: 'reports/:id', providers: salaryReportsProviders, loadComponent: () => import('./features/salary-reports/presentation/salary-report-detail-page.component').then(m => m.SalaryReportDetailPageComponent) },
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' }, { path: '**', redirectTo: 'dashboard' }
];
