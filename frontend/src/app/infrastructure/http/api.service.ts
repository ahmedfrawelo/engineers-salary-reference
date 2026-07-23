import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export type HttpQuery = Record<string, string | number | boolean | undefined | null>;
type RequestOptions = { params?: HttpParams; headers?: Record<string, string> };

/**
 * Cache entry with TTL support
 */
interface CacheEntry<T = unknown> {
  data: Observable<T>;
  timestamp: number;
  ttl: number;
  hits: number;
}

/**
 * Cache configuration options
 */
export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  key?: string; // Cache key
  forceRefresh?: boolean; // Bypass cache
}

/**
 * Default cache TTL values (in milliseconds)
 */
export const DEFAULT_CACHE_TTL = {
  SHORT: 1 * 60 * 1000, // 1 minute
  MEDIUM: 5 * 60 * 1000, // 5 minutes
  LONG: 30 * 60 * 1000, // 30 minutes
  VERY_LONG: 60 * 60 * 1000 // 1 hour
};

/**
 * Centralized API service for handling HTTP requests with advanced caching.
 *
 * @description
 * Provides a wrapper around Angular's HttpClient with support for:
 * - Request caching with TTL (Time To Live)
 * - Automatic cache expiration
 * - Cache invalidation (full or prefix-based)
 * - Cache statistics (hits, size)
 * - Automatic query parameter serialization
 *
 * @example
 * ```typescript
 * constructor(private api: ApiService) {}
 *
 * // Get with 5-minute cache
 * this.api.get('/users', { params: { id: 1 } }, { key: 'user_1', ttl: DEFAULT_CACHE_TTL.MEDIUM });
 *
 * // Get without cache
 * this.api.get('/users', undefined, { forceRefresh: true });
 * ```
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly cache = new Map<string, CacheEntry>();
  private cleanupInterval?: ReturnType<typeof setInterval>;

  constructor(private readonly http: HttpClient) {
    // Start automatic cache cleanup every 5 minutes
    this.startAutomaticCleanup();
  }

  /**
   * Execute a GET request with optional caching
   * @template T - Response type
   * @param url - API endpoint URL
   * @param options - Request options (params, headers)
   * @param cacheOptions - Cache configuration (key, ttl, forceRefresh)
   * @returns Observable of the response
   */
  get<T>(
    url: string,
    options?: { params?: HttpQuery; headers?: Record<string, string> },
    cacheOptions?: CacheOptions | string
  ): Observable<T> {
    const request = () => this.http.get<T>(url, this.buildOptions(options));

    // Handle legacy string cacheKey parameter
    if (typeof cacheOptions === 'string') {
      return this.remember(cacheOptions, request, DEFAULT_CACHE_TTL.MEDIUM);
    }

    // No caching if no options provided
    if (!cacheOptions?.key || cacheOptions.forceRefresh) {
      return request();
    }

    return this.remember(cacheOptions.key, request, cacheOptions.ttl || DEFAULT_CACHE_TTL.MEDIUM);
  }

  /**
   * Cache and share an observable stream with TTL
   * @template T - Data type
   * @param key - Cache key
   * @param factory - Function that returns the observable to cache
   * @param ttl - Time to live in milliseconds (default: 5 minutes)
   * @returns Shared observable
   */
  remember<T>(
    key: string,
    factory: () => Observable<T>,
    ttl: number = DEFAULT_CACHE_TTL.MEDIUM
  ): Observable<T> {
    const normalizedKey = key.trim();
    const entry = this.cache.get(normalizedKey);

    // Check if cache exists and is still valid
    if (entry && this.isCacheValid(entry)) {
      entry.hits++;
      return entry.data as Observable<T>;
    }

    // Create new cache entry
    const shared$ = factory().pipe(
      shareReplay({ bufferSize: 1, refCount: false }),
      tap(() => {
        // Cache hit tracking
        const currentEntry = this.cache.get(normalizedKey);
        if (currentEntry) {
          currentEntry.hits++;
        }
      })
    );

    this.cache.set(normalizedKey, {
      data: shared$,
      timestamp: Date.now(),
      ttl,
      hits: 0
    });

    return shared$;
  }

  /**
   * Check if cache entry is still valid
   */
  private isCacheValid(entry: CacheEntry): boolean {
    const age = Date.now() - entry.timestamp;
    return age < entry.ttl;
  }

  /**
   * Remove items from cache by prefix
   * @param prefix - Key prefix to invalidate (empty string clears all)
   */
  invalidate(prefix: string): void {
    const normalizedPrefix = prefix.trim();
    if (!normalizedPrefix) {
      this.cache.clear();
      return;
    }
    for (const key of Array.from(this.cache.keys())) {
      if (key.startsWith(normalizedPrefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear the entire request cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    totalHits: number;
    entries: Array<{ key: string; age: number; hits: number; ttl: number }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: Date.now() - entry.timestamp,
      hits: entry.hits,
      ttl: entry.ttl
    }));

    const totalHits = entries.reduce((sum, entry) => sum + entry.hits, 0);

    return {
      size: this.cache.size,
      totalHits,
      entries
    };
  }

  /**
   * Remove expired cache entries
   */
  cleanExpired(): number {
    let removed = 0;
    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (!this.isCacheValid(entry)) {
        this.cache.delete(key);
        removed++;
      }
    }
    return removed;
  }

  /**
   * Start automatic cache cleanup
   */
  private startAutomaticCleanup(): void {
    // Clean expired entries every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        const removed = this.cleanExpired();
        if (removed > 0 && typeof console !== 'undefined' && environment.enableDebugLogs) {
          console.log(`🧹 [ApiService] Cleaned ${removed} expired cache entries`);
        }
      },
      5 * 60 * 1000
    );
  }

  /**
   * Stop automatic cache cleanup (for testing or cleanup)
   */
  stopAutomaticCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /**
   * Construct request options including params and headers
   */
  private buildOptions(options?: {
    params?: HttpQuery;
    headers?: Record<string, string>;
  }): RequestOptions | undefined {
    if (!options) {
      return undefined;
    }
    const params = options.params ? this.toParams(options.params) : undefined;
    if (!params && !options.headers) {
      return undefined;
    }
    return { params, headers: options.headers };
  }

  /**
   * Convert dynamic query object to HttpParams
   */
  private toParams(query: HttpQuery): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) {
        continue;
      }
      params = params.set(key, String(value));
    }
    return params;
  }
}
