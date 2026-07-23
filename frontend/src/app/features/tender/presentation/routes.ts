import { Routes } from '@angular/router';
import { PermissionGuard } from '../../../infrastructure/routing/permission.guard';

export const TENDER_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'projects' },
  { path: 'dashboard', pathMatch: 'full', redirectTo: '/dashboard' },
  {
    path: 'projects',
    canActivate: [PermissionGuard],
    data: { preload: true, reuse: true, permission: 'tender.projects' },
    loadComponent: () =>
      import('../projects/presentation/tender-projects-feature-page.component').then(
        m => m.TenderProjectsFeaturePageComponent
      )
  },
];
