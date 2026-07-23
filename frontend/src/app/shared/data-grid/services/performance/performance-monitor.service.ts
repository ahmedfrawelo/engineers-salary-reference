import { Injectable } from '@angular/core';
import {
  debugGridGroup,
  debugGridGroupEnd,
  debugGridLog,
  debugGridTable,
  debugGridWarn
} from '../../utils';

type LooseValue = ReturnType<typeof JSON.parse>;
/**
 * Development-time performance instrumentation for the data grid.
 * Use this service to measure hot paths and inspect slow operations.
 */

export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
}

export interface PerformanceStats {
  count: number;
  total: number;
  avg: number;
  min: number;
  max: number;
  last: number;
}

@Injectable({ providedIn: 'root' })
export class PerformanceMonitorService {
  private metrics = new Map<string, PerformanceMetric[]>();
  private readonly maxMetricsPerKey = 100; // Keep last 100 measurements
  private readonly slowThresholdMs = 100; // Warn if operation takes > 100ms
  private enabled = true;

  /**
   * Enable or disable performance tracking...
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Track the execution time of a synchronous function.
   */
  track<T>(name: string, fn: () => T): T {
    if (!this.enabled) {
      return fn();
    }

    const start = performance.now();
    try {
      return fn();
    } finally {
      const duration = performance.now() - start;
      this.recordMetric(name, duration);

      if (duration > this.slowThresholdMs) {
        debugGridWarn(`[Grid Performance] Slow operation: ${name} took ${duration.toFixed(2)}ms`);
      }
    }
  }

  /**
   * Track the execution time of an async function.
   */
  async trackAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    if (!this.enabled) {
      return fn();
    }

    const start = performance.now();
    try {
      return await fn();
    } finally {
      const duration = performance.now() - start;
      this.recordMetric(name, duration);

      if (duration > this.slowThresholdMs) {
        debugGridWarn(
          `[Grid Performance] Slow async operation: ${name} took ${duration.toFixed(2)}ms`
        );
      }
    }
  }

  /**
   * Start a manual timer and return its stop callback.
   */
  startTimer(name: string): () => void {
    if (!this.enabled) {
      return () => {};
    }

    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.recordMetric(name, duration);
    };
  }

  /**
   * Record a metric manually...
   */
  recordMetric(name: string, duration: number): void {
    if (!this.enabled) {
      return;
    }

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricsList = this.metrics.get(name)!;
    metricsList.push({
      name,
      duration,
      timestamp: Date.now()
    });

    // Keep only last N metrics
    if (metricsList.length > this.maxMetricsPerKey) {
      metricsList.shift();
    }
  }

  /**
   * Return statistics for a specific metric.
   */
  getStats(name: string): PerformanceStats | null {
    const metricsList = this.metrics.get(name);
    if (!metricsList || metricsList.length === 0) {
      return null;
    }

    const durations = metricsList.map(m => m.duration);
    const total = durations.reduce((sum, d) => sum + d, 0);

    return {
      count: durations.length,
      total,
      avg: total / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      last: durations[durations.length - 1]
    };
  }

  /**
   * Return statistics for all tracked metrics.
   */
  getAllStats(): Map<string, PerformanceStats> {
    const statsMap = new Map<string, PerformanceStats>();

    for (const [name] of this.metrics) {
      const stats = this.getStats(name);
      if (stats) {
        statsMap.set(name, stats);
      }
    }

    return statsMap;
  }

  /**
   * Print a performance report to the console.
   */
  printReport(): void {
    if (!this.enabled) {
      debugGridLog('[Grid Performance] Monitoring is disabled');
      return;
    }

    debugGridGroup('[Grid Performance] Report');

    const stats = this.getAllStats();
    if (stats.size === 0) {
      debugGridLog('No metrics recorded yet');
      debugGridGroupEnd();
      return;
    }

    // Sort by average duration (slowest first)
    const sorted = Array.from(stats.entries()).sort((a, b) => b[1].avg - a[1].avg);

    debugGridTable(
      sorted.map(([name, stat]) => ({
        Operation: name,
        Count: stat.count,
        'Avg (ms)': stat.avg.toFixed(2),
        'Min (ms)': stat.min.toFixed(2),
        'Max (ms)': stat.max.toFixed(2),
        'Last (ms)': stat.last.toFixed(2),
        'Total (ms)': stat.total.toFixed(2)
      }))
    );

    // Highlight slow operations
    const slowOps = sorted.filter(([_, stat]) => stat.avg > this.slowThresholdMs);
    if (slowOps.length > 0) {
      debugGridWarn(
        `[Grid Performance] ${slowOps.length} operations are slower than ${this.slowThresholdMs}ms:`
      );
      slowOps.forEach(([name, stat]) => {
        debugGridWarn(`  - ${name}: ${stat.avg.toFixed(2)}ms avg`);
      });
    }

    debugGridGroupEnd();
  }

  /**
   * Clear one metric bucket or all metric buckets.
   */
  clear(name?: string): void {
    if (name) {
      this.metrics.delete(name);
    } else {
      this.metrics.clear();
    }
  }

  /**
   * Return memory usage information when supported by the browser.
   */
  getMemoryUsage(): { usedMB: number; totalMB: number } | null {
    if ('memory' in performance) {
      const mem = (performance as LooseValue).memory;
      return {
        usedMB: Math.round((mem.usedJSHeapSize / 1048576) * 100) / 100,
        totalMB: Math.round((mem.totalJSHeapSize / 1048576) * 100) / 100
      };
    }
    return null;
  }

  /**
   * Log current memory usage when available.
   */
  logMemory(): void {
    const memory = this.getMemoryUsage();
    if (memory) {
      debugGridLog(
        `[Grid Performance] Memory: ${memory.usedMB}MB / ${memory.totalMB}MB (${Math.round((memory.usedMB / memory.totalMB) * 100)}%)`
      );
    } else {
      debugGridLog('[Grid Performance] Memory API not available (Chrome only)');
    }
  }
}
