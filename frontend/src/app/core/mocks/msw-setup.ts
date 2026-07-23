/**
 * Mock Service Worker (MSW) Setup
 *
 * Allows mocking API responses for development and testing
 * without changing application code.
 *
 * Installation:
 * ```bash
 * npm install -D msw
 * npx msw init src/assets --save
 * ```
 *
 * Usage in main.ts:
 * ```typescript
 * if (environment.useMock) {
 *   import('./core/mocks/msw-setup').then(({ startMockServiceWorker }) => {
 *     startMockServiceWorker();
 *   });
 * }
 * ```
 */

import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

/**
 * Start Mock Service Worker
 */
export async function startMockServiceWorker(): Promise<void> {
  await worker.start({
    onUnhandledRequest: 'bypass', // Don't warn about unhandled requests
    serviceWorker: {
      url: '/assets/mockServiceWorker.js'
    }
  });

  console.log('[MSW] Mock Service Worker started');
}

/**
 * Stop Mock Service Worker
 */
export function stopMockServiceWorker(): void {
  worker.stop();
  console.log('[MSW] Mock Service Worker stopped');
}
