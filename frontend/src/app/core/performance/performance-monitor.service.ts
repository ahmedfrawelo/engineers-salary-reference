import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AnalyticsService } from '../analytics/analytics.service';
import type { MetricType } from 'web-vitals';

/**
 * Performance monitoring service using Web Vitals
 *
 * Tracks Core Web Vitals:
 * - LCP (Largest Contentful Paint) - Loading performance
 * - INP (Interaction to Next Paint) - Interactivity
 * - CLS (Cumulative Layout Shift) - Visual stability
 * - FCP (First Contentful Paint) - Initial render
 * - TTFB (Time to First Byte) - Server response time
 *
 * @example
 * ```typescript
 * constructor(private perf: PerformanceMonitorService) {
 *   perf.initializeMonitoring();
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class PerformanceMonitorService {
  private metricsCollected: Map<string, number> = new Map();
  constructor(private analytics: AnalyticsService) {}

  /**
   * Initialize performance monitoring
   * Call this in app initialization (app.component.ts or main.ts)
   */
  async initializeMonitoring(): Promise<void> {
    if (!environment.production && environment.enableDebugLogs) {
      console.log('📊 [Performance] Monitoring initialized (dev mode)');
    }

    try {
      const { onCLS, onINP, onLCP, onFCP, onTTFB } = await import('web-vitals');
      const report = (name: string) => (metric: MetricType) => {
        this.logMetric(name, metric.value, metric.rating);
        this.metricsCollected.set(name, metric.value);
      };

      // Track Cumulative Layout Shift
      onCLS(report('CLS'));

      // Track Interaction to Next Paint
      onINP(report('INP'));

      // Track Largest Contentful Paint
      onLCP(report('LCP'));

      // Track First Contentful Paint
      onFCP(report('FCP'));

      // Track Time to First Byte
      onTTFB(report('TTFB'));
    } catch (error) {
      console.error('Failed to initialize performance monitoring:', error);
    }
  }

  /**
   * Log metric to console (development) or send to analytics (production)
   */
  private logMetric(
    name: string,
    value: number,
    rating: 'good' | 'needs-improvement' | 'poor'
  ): void {
    const emoji = rating === 'good' ? '✅' : rating === 'needs-improvement' ? '⚠️' : '❌';

    if (!environment.production && environment.enableDebugLogs) {
      console.log(`${emoji} [Performance] ${name}: ${value.toFixed(2)}ms (${rating})`);
    }

    // In production, send to analytics service
    if (environment.production) {
      this.sendToAnalytics(name, value, rating);
    }
  }

  /**
   * Send metrics to analytics service (Google Analytics, custom backend, etc.)
   */
  private sendToAnalytics(name: string, value: number, rating: string): void {
    this.analytics.trackEvent({
      category: 'Web Vitals',
      action: name,
      label: rating,
      value: Math.round(value)
    });
  }

  /**
   * Get collected metrics
   */
  getMetrics(): Map<string, number> {
    return this.metricsCollected;
  }

  /**
   * Mark custom performance milestone
   */
  mark(name: string): void {
    if (performance && performance.mark) {
      performance.mark(name);
    }
  }

  /**
   * Measure time between two marks
   */
  measure(name: string, startMark: string, endMark?: string): number | undefined {
    if (!performance || !performance.measure) {
      return undefined;
    }

    try {
      const measureName = `${name}_measure`;

      if (endMark) {
        performance.measure(measureName, startMark, endMark);
      } else {
        performance.measure(measureName, startMark);
      }

      const entries = performance.getEntriesByName(measureName);
      if (entries.length > 0) {
        const duration = entries[0].duration;

        if (!environment.production && environment.enableDebugLogs) {
          console.log(`⏱️ [Performance] ${name}: ${duration.toFixed(2)}ms`);
        }

        return duration;
      }
    } catch (error) {
      console.error('Performance measurement failed:', error);
    }

    return undefined;
  }

  /**
   * Clear all performance marks and measures
   */
  clearMarks(): void {
    if (performance && performance.clearMarks) {
      performance.clearMarks();
      performance.clearMeasures();
    }
  }

  /**
   * Get Navigation Timing metrics
   */
  getNavigationTiming(): PerformanceNavigationTiming | null {
    if (!performance || !performance.getEntriesByType) {
      return null;
    }

    const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    return navEntries.length > 0 ? navEntries[0] : null;
  }

  /**
   * Log detailed page load metrics
   */
  logPageLoadMetrics(): void {
    const timing = this.getNavigationTiming();
    if (!timing) {
      if (environment.enableDebugLogs) console.warn('Navigation Timing API not supported');
      return;
    }

    const metrics = {
      'DNS Lookup': timing.domainLookupEnd - timing.domainLookupStart,
      'TCP Connection': timing.connectEnd - timing.connectStart,
      'TLS Negotiation':
        timing.secureConnectionStart > 0 ? timing.connectEnd - timing.secureConnectionStart : 0,
      'Request Time': timing.responseStart - timing.requestStart,
      'Response Time': timing.responseEnd - timing.responseStart,
      'DOM Processing': timing.domComplete - timing.domInteractive,
      'Page Load': timing.loadEventEnd - timing.loadEventStart,
      'Total Load Time': timing.loadEventEnd - timing.fetchStart
    };

    if (!environment.production && environment.enableDebugLogs) {
      console.group('📈 [Performance] Page Load Metrics');
      Object.entries(metrics).forEach(([key, value]) => {
        console.log(`${key}: ${value.toFixed(2)}ms`);
      });
      console.groupEnd();
    }
  }
}
