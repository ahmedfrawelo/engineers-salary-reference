import { Routes } from '@angular/router';
import { PermissionGuard } from '../../../infrastructure/routing/permission.guard';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [PermissionGuard],
    data: { permission: 'settings.global' },
    loadComponent: () => import('./settings.component').then(m => m.SettingsComponent)
  },
  {
    path: 'access-control',
    canActivate: [PermissionGuard],
    data: { permission: 'settings.access_control' },
    loadChildren: () =>
      import('./user-access-control/user-access-control.module').then(
        m => m.UserAccessControlModule
      )
  },
  {
    path: 'appearance',
    canActivate: [PermissionGuard],
    data: { permission: 'settings.appearance' },
    loadComponent: () =>
      import('./appearance/theme-appearance.component').then(m => m.ThemeAppearanceComponent)
  },
  {
    path: 'active-sessions',
    canActivate: [PermissionGuard],
    data: { permission: 'settings.active_sessions' },
    loadComponent: () =>
      import('./active-sessions/active-sessions.component').then(m => m.ActiveSessionsComponent)
  },
  { path: '**', redirectTo: '' }
];
