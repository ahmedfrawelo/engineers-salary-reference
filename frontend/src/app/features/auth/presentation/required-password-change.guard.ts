import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthFacadeService } from '../../../auth/auth.service';

export const requiredPasswordChangeGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthFacadeService);
  const router = inject(Router);

  if (!(await auth.ensureAuthenticated())) {
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url }
    });
  }

  if (!auth.mustChangePassword()) {
    return router.createUrlTree(['/dashboard']);
  }

  return true;
};
