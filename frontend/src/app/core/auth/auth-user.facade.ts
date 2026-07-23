import { InjectionToken, Signal } from '@angular/core';

export type AuthUserFacadeState = {
  id: string | number;
  name: string;
  email: string;
  roles?: string[];
  permissions?: string[];
};

export interface AuthUserFacade {
  user: Signal<AuthUserFacadeState | null>;
  isAuthenticated(): boolean;
}

export const AUTH_USER_FACADE = new InjectionToken<AuthUserFacade>('AUTH_USER_FACADE');
