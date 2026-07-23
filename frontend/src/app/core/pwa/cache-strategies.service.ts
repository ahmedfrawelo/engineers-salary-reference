import { Injectable } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ToastService } from '@shared/toast/toast.service';

/**
 * Cache Strategy Type
 */
export type CacheStrategy =
  | 'cache-first'
  | 'network-first'
  | 'cache-only'
  | 'network-only'
  | 'stale-while-revalidate';

/**
 * Cache Configuration
 */
export interface CacheConfig {
  name: string;
  strategy: CacheStrategy;
  maxAge?: number; // in seconds
  maxEntries?: number;
  urlPattern: RegExp;
}

/**
 * Service Worker Cache Strategies Service
 *
 * Implements advanced caching strategies for PWA
 *
 * Features:
 * - Cache-First: Serve from cache, fallback to network
 * - Network-First: Try network first, fallback to cache
 * - Stale-While-Revalidate: Serve stale cache while fetching fresh
 * - Cache versioning and invalidation
 * - Automatic cache cleanup
 *
 * @example
 * ```typescript
 * // Register cache strategy
 * this.cacheStrategies.registerStrategy({
 *   name: 'api-cache',
 *   strategy: 'network-first',
 *   maxAge: 3600,
 *   urlPattern: /\/api\//
 * });
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class CacheStrategiesService {
  private strategies = new Map<string, CacheConfig>();
  private cacheVersion = 'v1';

  constructor(
    private swUpdate: SwUpdate,
    private toast: ToastService
  ) {
    this.registerDefaultStrategies();
    this.listenForUpdates();
  }

  /**
   * Register a cache strategy
   */
  registerStrategy(config: CacheConfig): void {
    this.strategies.set(config.name, config);
    if (environment.enableDebugLogs)
      console.log(`[Cache] Strategy registered: ${config.name} (${config.strategy})`);
  }

  /**
   * Get strategy by URL
   */
  getStrategy(url: string): CacheConfig | undefined {
    for (const strategy of this.strategies.values()) {
      if (strategy.urlPattern.test(url)) {
        return strategy;
      }
    }
    return undefined;
  }

  /**
   * Clear all caches
   */
  async clearAllCaches(): Promise<void> {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      if (environment.enableDebugLogs) console.log('[Cache] All caches cleared');
    }
  }

  /**
   * Clear specific cache
   */
  async clearCache(cacheName: string): Promise<void> {
    if ('caches' in window) {
      await caches.delete(this.getCacheName(cacheName));
      if (environment.enableDebugLogs) console.log(`[Cache] Cache cleared: ${cacheName}`);
    }
  }

  /**
   * Get cache size
   */
  async getCacheSize(cacheName: string): Promise<number> {
    if (!('caches' in window)) return 0;

    const cache = await caches.open(this.getCacheName(cacheName));
    const keys = await cache.keys();
    return keys.length;
  }

  /**
   * Prune old cache entries
   */
  async pruneCache(cacheName: string, maxEntries: number): Promise<void> {
    if (!('caches' in window)) return;

    const cache = await caches.open(this.getCacheName(cacheName));
    const keys = await cache.keys();

    if (keys.length > maxEntries) {
      const toDelete = keys.slice(0, keys.length - maxEntries);
      await Promise.all(toDelete.map(key => cache.delete(key)));
      if (environment.enableDebugLogs)
        console.log(`[Cache] Pruned ${toDelete.length} entries from ${cacheName}`);
    }
  }

  /**
   * Check if cached response is stale
   */
  async isCacheStale(cacheName: string, url: string, maxAge: number): Promise<boolean> {
    if (!('caches' in window)) return true;

    const cache = await caches.open(this.getCacheName(cacheName));
    const response = await cache.match(url);

    if (!response) return true;

    const cachedDate = response.headers.get('sw-cached-date');
    if (!cachedDate) return true;

    const age = (Date.now() - new Date(cachedDate).getTime()) / 1000;
    return age > maxAge;
  }

  /**
   * Cache-First Strategy
   * Serve from cache if available, fallback to network
   */
  async cacheFirst(url: string, cacheName: string): Promise<Response> {
    const cache = await caches.open(this.getCacheName(cacheName));
    const cachedResponse = await cache.match(url);

    if (cachedResponse) {
      if (environment.enableDebugLogs) console.log(`[Cache] Cache hit: ${url}`);
      return cachedResponse;
    }

    if (environment.enableDebugLogs) console.log(`[Cache] Cache miss, fetching: ${url}`);
    const networkResponse = await fetch(url);
    const responseClone = networkResponse.clone();

    await this.cacheResponse(cache, url, responseClone);
    return networkResponse;
  }

  /**
   * Network-First Strategy
   * Try network first, fallback to cache on failure
   */
  async networkFirst(url: string, cacheName: string): Promise<Response> {
    const cache = await caches.open(this.getCacheName(cacheName));

    try {
      if (environment.enableDebugLogs) console.log(`[Cache] Fetching from network: ${url}`);
      const networkResponse = await fetch(url);
      const responseClone = networkResponse.clone();

      await this.cacheResponse(cache, url, responseClone);
      return networkResponse;
    } catch (error) {
      if (environment.enableDebugLogs) console.log(`[Cache] Network failed, using cache: ${url}`);
      const cachedResponse = await cache.match(url);
      if (cachedResponse) {
        return cachedResponse;
      }
      throw error;
    }
  }

  /**
   * Stale-While-Revalidate Strategy
   * Serve stale cache immediately, fetch fresh in background
   */
  async staleWhileRevalidate(url: string, cacheName: string): Promise<Response> {
    const cache = await caches.open(this.getCacheName(cacheName));
    const cachedResponse = await cache.match(url);

    // Fetch fresh data in background
    const fetchPromise = fetch(url).then(networkResponse => {
      const responseClone = networkResponse.clone();
      this.cacheResponse(cache, url, responseClone);
      return networkResponse;
    });

    // Return cached response immediately or wait for network
    return cachedResponse || fetchPromise;
  }

  /**
   * Register default strategies
   */
  private registerDefaultStrategies(): void {
    // API calls: Network-First (fresh data preferred)
    this.registerStrategy({
      name: 'api-calls',
      strategy: 'network-first',
      maxAge: 300, // 5 minutes
      maxEntries: 50,
      urlPattern: /\/api\//
    });

    // Static assets: Cache-First (performance)
    this.registerStrategy({
      name: 'static-assets',
      strategy: 'cache-first',
      maxAge: 86400, // 24 hours
      maxEntries: 100,
      urlPattern: /\.(js|css|png|jpg|jpeg|svg|woff2?)$/
    });

    // Images: Stale-While-Revalidate (balance)
    this.registerStrategy({
      name: 'images',
      strategy: 'stale-while-revalidate',
      maxAge: 604800, // 7 days
      maxEntries: 50,
      urlPattern: /\.(png|jpg|jpeg|gif|webp|svg)$/
    });

    // Documents: Network-First
    this.registerStrategy({
      name: 'documents',
      strategy: 'network-first',
      maxAge: 3600, // 1 hour
      maxEntries: 20,
      urlPattern: /\.(pdf|doc|docx|xls|xlsx)$/
    });
  }

  /**
   * Cache response with metadata
   */
  private async cacheResponse(cache: Cache, url: string, response: Response): Promise<void> {
    const headers = new Headers(response.headers);
    headers.set('sw-cached-date', new Date().toISOString());

    const modifiedResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });

    await cache.put(url, modifiedResponse);
  }

  /**
   * Get versioned cache name
   */
  private getCacheName(name: string): string {
    return `${name}-${this.cacheVersion}`;
  }

  /**
   * Listen for service worker updates
   */
  private listenForUpdates(): void {
    if (!this.swUpdate.isEnabled) {
      if (environment.enableDebugLogs) console.log('[Cache] Service Worker not enabled');
      return;
    }

    this.swUpdate.versionUpdates
      .pipe(
        filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'),
        map(evt => ({
          current: evt.currentVersion,
          available: evt.latestVersion
        }))
      )
      .subscribe(update => {
        if (environment.enableDebugLogs) console.log('[Cache] New version available:', update);
        // Auto-reload or notify user
        this.toast.action(
          'info',
          'تحديث جديد متاح',
          'إعادة التحميل',
          () => window.location.reload(),
          15000
        );
      });

    // Check for updates every 6 hours
    if (this.swUpdate.isEnabled) {
      setInterval(
        () => {
          this.swUpdate.checkForUpdate().then(() => {
            if (environment.enableDebugLogs) console.log('[Cache] Checked for updates');
          });
        },
        6 * 60 * 60 * 1000
      );
    }
  }
}
