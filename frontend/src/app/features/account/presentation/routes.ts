import { Routes } from '@angular/router';
import { PermissionGuard } from '../../../infrastructure/routing/permission.guard';

export const ACCOUNT_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'profile' },
  {
    path: 'profile',
    canActivate: [PermissionGuard],
    data: { permission: 'account.profile' },
    loadComponent: () =>
      import('./account-profile-page.component').then(m => m.AccountProfilePageComponent)
  },
  {
    path: 'settings',
    canActivate: [PermissionGuard],
    data: { permission: 'account.settings' },
    loadComponent: () =>
      import('./account-settings-page.component').then(m => m.AccountSettingsPageComponent)
  },
  {
    path: 'notifications',
    loadComponent: () =>
      import('./account-notifications-page.component').then(
        m => m.AccountNotificationsPageComponent
      )
  },
  { path: '**', redirectTo: 'profile' }
];
