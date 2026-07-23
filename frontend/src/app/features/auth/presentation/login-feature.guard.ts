import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AUTH_SESSION_FACADE } from '@core/auth/auth-session.facade';

export const loginFeatureGuard: CanActivateFn = async (_route, state) => {
  const authSession = inject(AUTH_SESSION_FACADE);
  const router = inject(Router);
  const passwordChangeAwareSession = authSession as typeof authSession & {
    mustChangePassword?: () => boolean;
  };

  if (await authSession.ensureAuthenticated()) {
    if (passwordChangeAwareSession.mustChangePassword?.()) {
      if (state.url.startsWith('/login/password-update')) {
        return true;
      }

      return router.createUrlTree(['/login/password-update']);
    }

    return router.createUrlTree(['/dashboard']);
  }

  return true;
};
