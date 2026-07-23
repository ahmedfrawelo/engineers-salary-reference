import { environment } from '../../../environments/environment';

type LooseValue = ReturnType<typeof JSON.parse>;
/**
 * Dynamic import utilities for code splitting and bundle optimization
 *
 * These utilities help reduce the initial bundle size by loading
 * heavy libraries only when needed.
 *
 * @example
 * ```typescript
 * // Instead of:
 * import { jsPDF } from 'jspdf';
 *
 * // Use:
 * const jsPDF = await loadJsPDF();
 * ```
 */

/**
 * Dynamically load jsPDF library
 * Reduces initial bundle by ~500KB
 */
export async function loadJsPDF() {
  const { jsPDF } = await import('jspdf');
  return jsPDF;
}

/**
 * Dynamically load jsPDF AutoTable plugin
 * Reduces initial bundle by ~100KB
 */
export async function loadAutoTable() {
  const autoTable = await import('jspdf-autotable');
  return autoTable.default;
}

/**
 * Dynamically load xlsx-js-style library
 * Reduces initial bundle by ~1MB
 */
export async function loadXLSX() {
  const XLSX = await import('xlsx-js-style');
  return XLSX;
}

/**
 * Dynamically load ECharts library
 * Reduces initial bundle by ~800KB
 */
export async function loadECharts() {
  const echarts = await import('echarts');
  return echarts;
}

/**
 * Preload heavy library in the background
 * Useful for libraries that will be needed soon
 */
export function preloadLibrary(importFn: () => Promise<LooseValue>): void {
  // Use requestIdleCallback if available, otherwise setTimeout
  if ('requestIdleCallback' in window) {
    (window as LooseValue).requestIdleCallback(() => {
      importFn().catch(err => {
        if (environment.enableDebugLogs) console.warn('Failed to preload library:', err);
      });
    });
  } else {
    setTimeout(() => {
      importFn().catch(err => {
        if (environment.enableDebugLogs) console.warn('Failed to preload library:', err);
      });
    }, 1000);
  }
}

/**
 * Cache for loaded modules to prevent re-fetching
 */
const moduleCache = new Map<string, LooseValue>();

/**
 * Generic dynamic import with caching
 */
export async function loadModule<T>(moduleName: string, loader: () => Promise<T>): Promise<T> {
  if (moduleCache.has(moduleName)) {
    return moduleCache.get(moduleName);
  }

  const module = await loader();
  moduleCache.set(moduleName, module);
  return module;
}
