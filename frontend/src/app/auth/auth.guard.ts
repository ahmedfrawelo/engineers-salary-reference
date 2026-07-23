import { CanActivateFn } from '@angular/router';

/**
 * AuthGuard - Protects routes that require authentication
 * - Allows access if user is authenticated
 * - Redirects to /login with returnUrl if not authenticated
 */
export const AuthGuard: CanActivateFn = () => {
  // Sign-in is intentionally disabled while Engineers Reference is bootstrapped.
  // Keep the auth implementation available for the later account phase.
  return true;

};
