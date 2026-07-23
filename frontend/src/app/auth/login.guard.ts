import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthFacadeService } from './auth.service';

/**
 * LoginGuard - Prevents authenticated users from accessing login page
 * - Redirects to /dashboard if user is already authenticated
 * - Allows access to login page if not authenticated
 */
export const LoginGuard: CanActivateFn = async () => {
  const auth = inject(AuthFacadeService);
  const router = inject(Router);

  if (await auth.ensureAuthenticated()) {
    // User already logged in - redirect to main app
    return router.createUrlTree(['/dashboard']);
  }

  // User not authenticated - allow access to login page
  return true;
};
