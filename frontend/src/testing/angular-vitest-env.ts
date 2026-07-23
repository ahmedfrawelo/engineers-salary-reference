import 'zone.js';
import 'zone.js/testing';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting
} from '@angular/platform-browser-dynamic/testing';

let initialized = false;

export function ensureAngularVitestEnv(): void {
  if (initialized) return;
  try {
    getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting(), {
      teardown: { destroyAfterEach: true }
    });
  } catch {
    // Already initialized in this worker.
  }
  initialized = true;
}
