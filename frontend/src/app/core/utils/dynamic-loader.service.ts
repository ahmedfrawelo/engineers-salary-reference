import {
  Injectable,
  ComponentRef,
  Type,
  ViewContainerRef,
  createEnvironmentInjector,
  EnvironmentInjector
} from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

type LooseValue = ReturnType<typeof JSON.parse>;
/**
 * Dynamic Component Loader Service
 *
 * Dynamically loads components with code splitting
 * Reduces initial bundle size
 *
 * @example
 * ```typescript
 * // Load component dynamically
 * const componentRef = await this.dynamicLoader.loadComponent(
 *   () => import('./heavy-component').then(m => m.HeavyComponent),
 *   viewContainerRef
 * );
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class DynamicLoaderService {
  private loadedModules = new Map<string, LooseValue>();

  constructor(
    private router: Router,
    private injector: EnvironmentInjector
  ) {}

  /**
   * Dynamically load a component
   */
  async loadComponent<T>(
    loader: () => Promise<Type<T>>,
    viewContainerRef: ViewContainerRef,
    data?: LooseValue
  ): Promise<ComponentRef<T>> {
    try {
      const componentType = await loader();

      // Create environment injector with data
      const envInjector = createEnvironmentInjector([], this.injector);

      // Create component
      const componentRef = viewContainerRef.createComponent(componentType, {
        environmentInjector: envInjector
      });

      // Pass data if provided
      if (data) {
        Object.assign(componentRef.instance as LooseValue, data);
      }

      if (environment.enableDebugLogs) console.log('[DynamicLoader] Component loaded successfully');
      return componentRef;
    } catch (error) {
      console.error('[DynamicLoader] Failed to load component:', error);
      throw error;
    }
  }

  /**
   * Preload a component (without instantiating)
   */
  async preloadComponent<T>(loader: () => Promise<Type<T>>): Promise<Type<T>> {
    return loader();
  }

  /**
   * Load route module dynamically
   */
  async loadRoute(path: string): Promise<void> {
    try {
      await this.router.navigateByUrl(path);
      if (environment.enableDebugLogs) console.log(`[DynamicLoader] Route loaded: ${path}`);
    } catch (error) {
      console.error(`[DynamicLoader] Failed to load route: ${path}`, error);
      throw error;
    }
  }

  /**
   * Cache loaded module
   */
  cacheModule(key: string, module: LooseValue): void {
    this.loadedModules.set(key, module);
  }

  /**
   * Get cached module
   */
  getCachedModule(key: string): LooseValue {
    return this.loadedModules.get(key);
  }

  /**
   * Check if module is cached
   */
  isModuleCached(key: string): boolean {
    return this.loadedModules.has(key);
  }

  /**
   * Clear module cache
   */
  clearCache(): void {
    this.loadedModules.clear();
    if (environment.enableDebugLogs) console.log('[DynamicLoader] Cache cleared');
  }
}

/**
 * Lazy Module Configuration
 */
export interface LazyModuleConfig {
  path: string;
  loader: () => Promise<LooseValue>;
  preload?: boolean;
  priority?: 'high' | 'medium' | 'low';
}

/**
 * Lazy Module Registry
 *
 * Central registry for lazy-loaded modules
 */
@Injectable({
  providedIn: 'root'
})
export class LazyModuleRegistry {
  private modules = new Map<string, LazyModuleConfig>();

  /**
   * Register lazy module
   */
  register(config: LazyModuleConfig): void {
    this.modules.set(config.path, config);
  }

  /**
   * Get module config
   */
  getConfig(path: string): LazyModuleConfig | undefined {
    return this.modules.get(path);
  }

  /**
   * Get all modules by priority
   */
  getModulesByPriority(priority: 'high' | 'medium' | 'low'): LazyModuleConfig[] {
    return Array.from(this.modules.values()).filter(config => config.priority === priority);
  }

  /**
   * Get all preloadable modules
   */
  getPreloadableModules(): LazyModuleConfig[] {
    return Array.from(this.modules.values()).filter(config => config.preload === true);
  }
}
