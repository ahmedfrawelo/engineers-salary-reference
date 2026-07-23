import { Routes } from '@angular/router';

export const MESSAGES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./messages-widget-route.component').then(m => m.MessagesWidgetRouteComponent)
  }
];
