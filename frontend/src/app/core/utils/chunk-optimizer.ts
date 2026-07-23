type LooseValue = ReturnType<typeof JSON.parse>;
/**
 * Chunk Optimization Utilities
 *
 * Provides utilities for optimizing code splitting and chunk loading
 *
 * @example
 * ```typescript
 * // Split vendor dependencies
 * const vendorChunks = getVendorChunks([
 *   '@angular/core',
 *   '@angular/common',
 *   'rxjs'
 * ]);
 * ```
 */

/**
 * Vendor Chunk Configuration
 */
export interface VendorChunkConfig {
  name: string;
  test: RegExp;
  priority: number;
  reuseExistingChunk?: boolean;
}

/**
 * Get vendor chunk configurations
 */
export function getVendorChunks(): VendorChunkConfig[] {
  return [
    {
      name: 'angular-core',
      test: /[\\/]node_modules[\\/]@angular[\\/](core|common|platform-browser)/,
      priority: 30,
      reuseExistingChunk: true
    },
    {
      name: 'angular-forms',
      test: /[\\/]node_modules[\\/]@angular[\\/](forms|router)/,
      priority: 25,
      reuseExistingChunk: true
    },
    {
      name: 'rxjs',
      test: /[\\/]node_modules[\\/]rxjs/,
      priority: 20,
      reuseExistingChunk: true
    },
    {
      name: 'echarts',
      test: /[\\/]node_modules[\\/]echarts/,
      priority: 10,
      reuseExistingChunk: true
    },
    {
      name: 'vendors',
      test: /[\\/]node_modules[\\/]/,
      priority: 5,
      reuseExistingChunk: true
    }
  ];
}

/**
 * Calculate chunk priority based on usage
 */
export function calculateChunkPriority(moduleName: string): number {
  const priorityMap: Record<string, number> = {
    '@angular/core': 100,
    '@angular/common': 90,
    '@angular/platform-browser': 80,
    rxjs: 70,
    '@angular/router': 60,
    '@angular/forms': 50,
    echarts: 30
  };

  for (const [key, priority] of Object.entries(priorityMap)) {
    if (moduleName.includes(key)) {
      return priority;
    }
  }

  return 10; // Default priority for other modules
}

/**
 * Check if module should be split into separate chunk
 */
export function shouldSplitChunk(moduleSize: number, usageCount: number): boolean {
  const SIZE_THRESHOLD = 30 * 1024; // 30KB
  const MIN_USAGE_COUNT = 2;

  return moduleSize > SIZE_THRESHOLD && usageCount >= MIN_USAGE_COUNT;
}

/**
 * Get optimal chunk size configuration
 */
export interface ChunkSizeConfig {
  minSize: number;
  maxSize: number;
  maxAsyncRequests: number;
  maxInitialRequests: number;
}

export function getOptimalChunkSize(): ChunkSizeConfig {
  return {
    minSize: 20000, // 20KB - minimum size for a chunk
    maxSize: 244000, // 244KB - maximum size for a chunk
    maxAsyncRequests: 30, // maximum async requests
    maxInitialRequests: 30 // maximum initial requests
  };
}

/**
 * Analyze module and determine chunk strategy
 */
export interface ChunkStrategy {
  shouldLazyLoad: boolean;
  shouldPreload: boolean;
  chunkName: string;
  priority: number;
}

export function analyzeModuleChunkStrategy(
  modulePath: string,
  moduleSize: number,
  isFrequentlyUsed: boolean
): ChunkStrategy {
  const isVendor = modulePath.includes('node_modules');
  const isCore = modulePath.includes('@angular/core') || modulePath.includes('rxjs');

  let shouldLazyLoad = false;
  let shouldPreload = false;
  let chunkName = 'default';
  let priority = 10;

  if (isCore) {
    // Core modules should not be lazy loaded
    shouldLazyLoad = false;
    shouldPreload = false;
    chunkName = 'core';
    priority = 100;
  } else if (isVendor && moduleSize > 50000) {
    // Large vendor modules should be in separate chunks
    shouldLazyLoad = true;
    shouldPreload = isFrequentlyUsed;
    chunkName = 'vendor-large';
    priority = 20;
  } else if (!isVendor && moduleSize > 30000) {
    // Large app modules should be lazy loaded
    shouldLazyLoad = true;
    shouldPreload = isFrequentlyUsed;
    chunkName = 'feature';
    priority = 30;
  } else if (isFrequentlyUsed) {
    // Frequently used modules should be preloaded
    shouldLazyLoad = true;
    shouldPreload = true;
    chunkName = 'common';
    priority = 50;
  } else {
    // Other modules can be lazy loaded without preload
    shouldLazyLoad = true;
    shouldPreload = false;
    chunkName = 'lazy';
    priority = 10;
  }

  return {
    shouldLazyLoad,
    shouldPreload,
    chunkName,
    priority
  };
}

/**
 * Get webpack optimization config
 */
export function getWebpackOptimization() {
  return {
    runtimeChunk: 'single',
    splitChunks: {
      chunks: 'all',
      cacheGroups: getVendorChunks().reduce(
        (acc, config) => {
          acc[config.name] = {
            test: config.test,
            priority: config.priority,
            reuseExistingChunk: config.reuseExistingChunk
          };
          return acc;
        },
        {} as Record<string, LooseValue>
      )
    }
  };
}
