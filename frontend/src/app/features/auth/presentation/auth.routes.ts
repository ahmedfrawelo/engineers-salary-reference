import { Routes } from '@angular/router';
import { loginFeatureGuard } from './login-feature.guard';
import { requiredPasswordChangeGuard } from './required-password-change.guard';

const loadAuthScreen = () =>
  import('./login-feature-page.component').then(m => m.LoginFeaturePageComponent);
const loadForgotPasswordPage = () =>
  import('./forgot-password-page.component').then(m => m.ForgotPasswordPageComponent);
const loadPasswordUpdatePage = () =>
  import('./password-update-page.component').then(m => m.PasswordUpdatePageComponent);
const loadResetPasswordPage = () =>
  import('./reset-password-page.component').then(m => m.ResetPasswordPageComponent);

export const LOGIN_ROUTES: Routes = [
  {
    path: 'forgot-password',
    canActivate: [loginFeatureGuard],
    loadComponent: loadForgotPasswordPage
  },
  {
    path: 'password-update',
    canActivate: [requiredPasswordChangeGuard, loginFeatureGuard],
    loadComponent: loadPasswordUpdatePage
  },
  {
    path: 'reset-password',
    canActivate: [loginFeatureGuard],
    loadComponent: loadResetPasswordPage
  },
  {
    path: '',
    canActivate: [loginFeatureGuard],
    data: { mode: 'login' },
    loadComponent: loadAuthScreen
  }
];

export const SIGNUP_ROUTES: Routes = [
  {
    path: '',
    canActivate: [loginFeatureGuard],
    data: { mode: 'signup' },
    loadComponent: loadAuthScreen
  }
];

export const AUTH_ROUTES = LOGIN_ROUTES;
