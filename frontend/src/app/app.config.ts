import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { AuthFacadeService } from './auth/auth.service';
import { AUTH_SESSION_FACADE } from './core/auth/auth-session.facade';
import { AUTH_USER_FACADE } from './core/auth/auth-user.facade';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection(),
    provideRouter(routes),
    provideHttpClient(withFetch()),
    provideAnimations(),
    { provide: AUTH_SESSION_FACADE, useExisting: AuthFacadeService },
    { provide: AUTH_USER_FACADE, useExisting: AuthFacadeService }
  ]
};
