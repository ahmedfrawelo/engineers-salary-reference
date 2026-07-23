import 'zone.js';

import { bootstrapApplication } from '@angular/platform-browser';

import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { installFocusModality } from './app/core/accessibility/focus-modality';
import { cleanupStaleServiceWorkers } from './app/core/pwa/service-worker-cleanup.util';
import { environment } from './environments/environment';

if (!environment.enableDebugLogs) {
  const noop = () => {};
  console.log = noop;
  console.debug = noop;
  console.info = noop;
}

installFocusModality(document);

const bootstrap = () =>
  bootstrapApplication(AppComponent, appConfig).catch((err: unknown) => console.error(err));

const loadRuntimeConfig = async (): Promise<void> => {
  try {
    const response = await fetch('/assets/runtime-config.json', { cache: 'no-store' });
    if (!response.ok) return;
    const config = (await response.json()) as Record<string, unknown>;
    // An empty runtime override means "use the environment default". Keeping
    // it as an empty string would bypass the local /api proxy in development.
    if (typeof config.apiBaseUrl === 'string' && config.apiBaseUrl.trim() === '') {
      delete config.apiBaseUrl;
    }
    (window as typeof window & { __ENGINEERS_SALARY_REFERENCE_RUNTIME_CONFIG__?: Record<string, unknown> })
      .__ENGINEERS_SALARY_REFERENCE_RUNTIME_CONFIG__ = config;
  } catch {
    // Development and offline previews deliberately fall back to environment defaults.
  }
};

void loadRuntimeConfig().then(() => cleanupStaleServiceWorkers()).finally(bootstrap);
