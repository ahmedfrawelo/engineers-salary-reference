import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of, timer } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

type ConnectionInfo = {
  effectiveType?: string;
  saveData?: boolean;
};

const ON_DEMAND_PRELOAD_INITIAL_DELAY_MS = 12_000;
const ON_DEMAND_PRELOAD_STAGGER_MS = 1_500;

const getNavigatorConnection = (): ConnectionInfo | null => {
  const nav = navigator as Navigator & {
    connection?: ConnectionInfo;
    mozConnection?: ConnectionInfo;
    webkitConnection?: ConnectionInfo;
  };

  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
};

/**
 * Custom Preloading Strategy
 *
 * Strategies:
 * 1. Preload all lazy routes
 * 2. Network-aware preloading (only on fast connections)
 * 3. Custom preload flag per route
 * 4. Delayed preloading (after initial load)
 *
 * @example
 * // In app.config.ts
 * provideRouter(routes, withPreloading(CustomPreloadingStrategy))
 *
 * // In routes
 * {
 *   path: 'admin',
 *   loadChildren: () => import('./admin/admin.routes'),
 *   data: { preload: true, delay: 2000 }
 * }
 */
@Injectable({
  providedIn: 'root'
})
export class CustomPreloadingStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    // 1. Check if route should be preloaded
    if (!this.shouldPreload(route)) {
      return of(null);
    }

    // 2. Get delay from route data
    const delay = route.data?.['delay'] || 0;

    // 3. Check network conditions
    if (!this.isGoodConnection()) {
      if (environment.enableDebugLogs)
        console.log(`[Preload] Skipping ${route.path} - slow connection`);
      return of(null);
    }

    // 4. Preload with delay
    if (environment.enableDebugLogs)
      console.log(`[Preload] Loading ${route.path} with ${delay}ms delay`);

    return timer(delay).pipe(mergeMap(() => load()));
  }

  /**
   * Check if route should be preloaded
   */
  private shouldPreload(route: Route): boolean {
    // Check custom preload flag
    if (route.data && route.data['preload'] === false) {
      return false;
    }

    // Preload all lazy routes by default
    return route.loadChildren !== undefined || route.loadComponent !== undefined;
  }

  /**
   * Check if connection is good enough for preloading
   * Uses Network Information API
   */
  private isGoodConnection(): boolean {
    // Check if Network Information API is available
    const connection = getNavigatorConnection();

    if (!connection) {
      // If API not available, assume good connection
      return true;
    }

    // Preload only on fast connections (4g, wifi)
    const effectiveType = connection.effectiveType;
    return effectiveType === '4g' || effectiveType === 'wifi';
  }
}

/**
 * Preload All Strategy
 * Preloads all lazy routes immediately
 */
@Injectable({
  providedIn: 'root'
})
export class PreloadAllStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    if (route.loadChildren || route.loadComponent) {
      if (environment.enableDebugLogs) console.log(`[PreloadAll] Loading ${route.path}`);
      return load();
    }
    return of(null);
  }
}

/**
 * Network-Aware Preloading Strategy
 * Only preloads on fast connections (4g, wifi)
 */
@Injectable({
  providedIn: 'root'
})
export class NetworkAwarePreloadingStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    if (!route.loadChildren && !route.loadComponent) {
      return of(null);
    }

    const connection = getNavigatorConnection();

    if (!connection) {
      return load();
    }

    const effectiveType = connection.effectiveType;
    const saveData = connection.saveData;

    // Don't preload if user enabled data saver
    if (saveData) {
      if (environment.enableDebugLogs)
        console.log(`[NetworkAware] Skipping ${route.path} - data saver enabled`);
      return of(null);
    }

    // Only preload on fast connections
    if (effectiveType === '4g' || effectiveType === 'wifi') {
      if (environment.enableDebugLogs)
        console.log(`[NetworkAware] Loading ${route.path} on ${effectiveType}`);
      return load();
    }

    if (environment.enableDebugLogs)
      console.log(`[NetworkAware] Skipping ${route.path} - connection: ${effectiveType}`);
    return of(null);
  }
}

/**
 * On-Demand Preloading Strategy
 * Only preloads routes explicitly marked with preload: true
 */
@Injectable({
  providedIn: 'root'
})
export class OnDemandPreloadingStrategy implements PreloadingStrategy {
  private nextSlot = 0;

  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    if (!route.data || route.data['preload'] !== true) {
      return of(null);
    }

    const connection = getNavigatorConnection();
    if (connection?.saveData) {
      if (environment.enableDebugLogs)
        console.log(`[OnDemand] Skipping ${route.path} - data saver enabled`);
      return of(null);
    }

    const configuredDelay = Number(route.data['preloadDelayMs']);
    const initialDelay = Number.isFinite(configuredDelay)
      ? Math.max(0, configuredDelay)
      : ON_DEMAND_PRELOAD_INITIAL_DELAY_MS;
    const delay = initialDelay + this.nextSlot * ON_DEMAND_PRELOAD_STAGGER_MS;
    this.nextSlot += 1;

    if (environment.enableDebugLogs)
      console.log(`[OnDemand] Queued ${route.path} with ${delay}ms delay`);

    return timer(delay).pipe(mergeMap(() => load()));
  }
}

/**
 * Preloading Service
 * Helper service to trigger preloading manually
 */
@Injectable({
  providedIn: 'root'
})
export class PreloadingService {
  /**
   * Preload a specific route
   * @param routePath Route path to preload
   */
  preloadRoute(routePath: string): void {
    // This would require router integration
    if (environment.enableDebugLogs) console.log(`[Preloading] Manually preloading: ${routePath}`);
  }

  /**
   * Get preloading statistics
   */
  getStats(): { preloaded: number; total: number } {
    // Would track preloaded routes
    return { preloaded: 0, total: 0 };
  }
}
