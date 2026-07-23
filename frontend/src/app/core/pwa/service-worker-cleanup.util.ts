const STALE_SERVICE_WORKER_CACHE_PREFIXES = ['ngsw:', 'workbox'];

export function shouldDeleteStaleServiceWorkerCache(cacheName: string): boolean {
  const normalized = cacheName.trim().toLowerCase();
  return STALE_SERVICE_WORKER_CACHE_PREFIXES.some(prefix => normalized.startsWith(prefix));
}

export async function cleanupStaleServiceWorkers(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map(registration => registration.unregister().catch(() => false))
      );
    } catch {
      // Ignore service worker cleanup failures and let the app continue booting.
    }
  }

  if (!('caches' in window)) {
    return;
  }

  try {
    const cacheNames = await caches.keys();
    const staleNames = cacheNames.filter(shouldDeleteStaleServiceWorkerCache);
    await Promise.all(staleNames.map(name => caches.delete(name).catch(() => false)));
  } catch {
    // Ignore cache cleanup failures and let the app continue booting.
  }
}
