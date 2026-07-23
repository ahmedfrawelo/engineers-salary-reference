import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { of, tap } from 'rxjs';
import { TIMING, UI } from '../../../core/constants';

interface CacheEntry {
  response: HttpResponse<unknown>;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

const getResourcePrefix = (url: string): string | null => {
  const normalized = url.toLowerCase();
  const apiIndex = normalized.indexOf('/api/');
  if (apiIndex < 0) {
    return null;
  }

  const path = normalized.slice(apiIndex).split('?')[0];
  const parts = path.split('/').filter(Boolean);
  if (parts.length < 2) {
    return null;
  }

  return `/${parts[0]}/${parts[1]}`;
};

const invalidateRelatedCacheEntries = (url: string): void => {
  const resourcePrefix = getResourcePrefix(url);
  if (!resourcePrefix) {
    return;
  }

  for (const key of Array.from(cache.keys())) {
    if (key.toLowerCase().includes(resourcePrefix)) {
      cache.delete(key);
    }
  }
};

const shouldBypassCache = (url: string): boolean =>
  url.includes('/suppliers') ||
  url.includes('/suppliermaterialcategoryconnections') ||
  url.includes('/suppliermaterialconnections') ||
  url.includes('/tender-boq') ||
  url.includes('/officials') ||
  url.includes('/countries') ||
  url.includes('/brands');

export const clearHttpResponseCache = (): void => {
  cache.clear();
};

export const cacheInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET') {
    invalidateRelatedCacheEntries(req.url);
    return next(req);
  }

  const url = req.url.toLowerCase();
  if (
    shouldBypassCache(url) ||
    url.includes('/checklists') ||
    url.includes('/audittrails') ||
    url.includes('/users') ||
    url.includes('/roles') ||
    url.includes('/permissions')
  ) {
    return next(req);
  }

  const cacheKey = req.urlWithParams;
  const cachedResponse = cache.get(cacheKey);
  if (cachedResponse) {
    const age = Date.now() - cachedResponse.timestamp;
    if (age < TIMING.CACHE_DURATION) {
      return of(cachedResponse.response.clone());
    }
    cache.delete(cacheKey);
  }

  return next(req).pipe(
    tap(event => {
      if (event instanceof HttpResponse) {
        if (cache.size >= UI.MAX_CACHE_ENTRIES) {
          const firstKey = cache.keys().next().value;
          if (firstKey !== undefined) {
            cache.delete(firstKey);
          }
        }

        cache.set(cacheKey, {
          response: event.clone(),
          timestamp: Date.now()
        });
      }
    })
  );
};
