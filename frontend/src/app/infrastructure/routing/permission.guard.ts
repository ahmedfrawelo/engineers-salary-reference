import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PermissionService } from '@core/authorization/permission.service';
import { ToastService } from '@shared/toast/toast.service';

export const PermissionGuard: CanActivateFn = route => {
  const permissionService = inject(PermissionService);
  const router = inject(Router);
  const toast = inject(ToastService);

  const pageId = route.data?.['permission'] as string | undefined;
  if (!pageId) {
    return true;
  }

  if (permissionService.canViewPage(pageId)) {
    return true;
  }

  toast.error('You do not have permission to access this page.', 4000);
  return router.createUrlTree(['/dashboard']);
};
