import { InjectionToken, WritableSignal } from '@angular/core';

export type AuthSessionState = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
};

export interface AuthSessionFacade {
  tokens: WritableSignal<AuthSessionState | null>;
  isAuthenticated(): boolean;
  initializeSession(): Promise<void>;
  ensureAuthenticated(): Promise<boolean>;
  mustChangePassword?: () => boolean;
}

export const AUTH_SESSION_FACADE = new InjectionToken<AuthSessionFacade>('AUTH_SESSION_FACADE');
