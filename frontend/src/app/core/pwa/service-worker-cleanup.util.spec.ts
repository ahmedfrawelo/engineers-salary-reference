import { describe, expect, it } from 'vitest';

import { shouldDeleteStaleServiceWorkerCache } from './service-worker-cleanup.util';

describe('service worker cleanup', () => {
  it('matches Angular service worker caches', () => {
    expect(shouldDeleteStaleServiceWorkerCache('ngsw:app:assets')).toBe(true);
  });

  it('matches workbox caches', () => {
    expect(shouldDeleteStaleServiceWorkerCache('workbox-precache-v2')).toBe(true);
  });

  it('leaves unrelated caches alone', () => {
    expect(shouldDeleteStaleServiceWorkerCache('api-calls-v1')).toBe(false);
  });
});
