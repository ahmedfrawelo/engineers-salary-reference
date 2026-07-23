import { Injectable, signal, computed, effect } from '@angular/core';
import { interval, Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

type LooseValue = ReturnType<typeof JSON.parse>;
/**
 * Memory Snapshot
 */
export interface MemorySnapshot {
  timestamp: number;
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  percentage: number;
}

/**
 * Memory Leak Warning
 */
export interface MemoryLeakWarning {
  timestamp: number;
  message: string;
  severity: 'warning' | 'critical';
  currentMemory: number;
  trend: 'increasing' | 'stable' | 'decreasing';
}

/**
 * Component Lifecycle Tracking
 */
interface ComponentLifecycle {
  name: string;
  createdAt: number;
  destroyedAt?: number;
  subscriptions: number;
  unsubscribed: number;
}

/**
 * Memory Leak Detector Service
 *
 * Detects and prevents memory leaks in Angular applications
 *
 * Features:
 * - Automatic memory profiling
 * - Subscription leak detection
 * - Component lifecycle tracking
 * - Memory usage alerts
 * - Automatic cleanup helpers
 *
 * @example
 * ```typescript
 * // Track component
 * this.memoryLeakDetector.trackComponent('MyComponent');
 *
 * // Track subscription
 * const subscription = this.memoryLeakDetector.trackSubscription(
 *   observable$.subscribe()
 * );
 *
 * // In ngOnDestroy
 * this.memoryLeakDetector.componentDestroyed('MyComponent');
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class MemoryLeakDetectorService {
  private readonly SNAPSHOT_INTERVAL = 10000; // 10 seconds
  private readonly WARNING_THRESHOLD = 0.8; // 80% memory usage
  private readonly CRITICAL_THRESHOLD = 0.9; // 90% memory usage

  private snapshots = signal<MemorySnapshot[]>([]);
  private warnings = signal<MemoryLeakWarning[]>([]);
  private components = new Map<string, ComponentLifecycle>();
  private trackedSubscriptions = new Map<string, Subscription>();
  private monitoringActive = false;
  private destroy$ = new Subject<void>();

  // Computed signals
  readonly currentMemory = computed(() => {
    const latest = this.snapshots().slice(-1)[0];
    return latest ? latest.usedJSHeapSize : 0;
  });

  readonly memoryTrend = computed(() => {
    const snapshots = this.snapshots();
    if (snapshots.length < 2) return 'stable';

    const recent = snapshots.slice(-5);
    const increasing = recent.every(
      (snap, i) => i === 0 || snap.usedJSHeapSize > recent[i - 1].usedJSHeapSize
    );

    if (increasing) return 'increasing';

    const decreasing = recent.every(
      (snap, i) => i === 0 || snap.usedJSHeapSize < recent[i - 1].usedJSHeapSize
    );

    return decreasing ? 'decreasing' : 'stable';
  });

  readonly hasWarnings = computed(() => this.warnings().length > 0);

  constructor() {
    this.setupMemoryMonitoring();
  }

  /**
   * Start memory monitoring
   */
  startMonitoring(): void {
    if (this.monitoringActive) return;

    if (environment.enableDebugLogs) console.log('[MemoryLeakDetector] Monitoring started');
    this.monitoringActive = true;

    interval(this.SNAPSHOT_INTERVAL)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.takeSnapshot();
        this.analyzeMemoryUsage();
      });
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring(): void {
    this.destroy$.next();
    this.monitoringActive = false;
    if (environment.enableDebugLogs) console.log('[MemoryLeakDetector] Monitoring stopped');
  }

  /**
   * Take memory snapshot
   */
  private takeSnapshot(): void {
    if (!('memory' in performance)) {
      if (environment.enableDebugLogs)
        console.warn('[MemoryLeakDetector] Performance.memory not supported');
      return;
    }

    const memory = (performance as LooseValue).memory;
    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      percentage: memory.usedJSHeapSize / memory.jsHeapSizeLimit
    };

    this.snapshots.update(snapshots => {
      const updated = [...snapshots, snapshot];
      // Keep last 100 snapshots
      return updated.slice(-100);
    });
  }

  /**
   * Analyze memory usage and emit warnings
   */
  private analyzeMemoryUsage(): void {
    const snapshots = this.snapshots();
    if (snapshots.length === 0) return;

    const latest = snapshots[snapshots.length - 1];
    const trend = this.memoryTrend();

    // Critical memory usage
    if (latest.percentage >= this.CRITICAL_THRESHOLD) {
      this.addWarning({
        timestamp: Date.now(),
        message: `Critical memory usage: ${(latest.percentage * 100).toFixed(1)}%`,
        severity: 'critical',
        currentMemory: latest.usedJSHeapSize,
        trend
      });
    }
    // Warning threshold
    else if (latest.percentage >= this.WARNING_THRESHOLD && trend === 'increasing') {
      this.addWarning({
        timestamp: Date.now(),
        message: `High memory usage: ${(latest.percentage * 100).toFixed(1)}%`,
        severity: 'warning',
        currentMemory: latest.usedJSHeapSize,
        trend
      });
    }

    // Check for memory leaks (continuously increasing)
    if (snapshots.length >= 10) {
      const last10 = snapshots.slice(-10);
      const isConstantlyIncreasing = last10.every(
        (snap, i) => i === 0 || snap.usedJSHeapSize > last10[i - 1].usedJSHeapSize
      );

      if (isConstantlyIncreasing) {
        this.addWarning({
          timestamp: Date.now(),
          message: 'Potential memory leak detected: Memory constantly increasing',
          severity: 'critical',
          currentMemory: latest.usedJSHeapSize,
          trend: 'increasing'
        });
      }
    }
  }

  /**
   * Add warning
   */
  private addWarning(warning: MemoryLeakWarning): void {
    this.warnings.update(warnings => {
      const updated = [...warnings, warning];
      // Keep last 50 warnings
      return updated.slice(-50);
    });

    if (environment.enableDebugLogs)
      console.warn(`[MemoryLeakDetector] ${warning.severity.toUpperCase()}: ${warning.message}`);
  }

  /**
   * Track component lifecycle
   */
  trackComponent(componentName: string): void {
    this.components.set(componentName, {
      name: componentName,
      createdAt: Date.now(),
      subscriptions: 0,
      unsubscribed: 0
    });

    if (environment.enableDebugLogs)
      console.log(`[MemoryLeakDetector] Tracking component: ${componentName}`);
  }

  /**
   * Mark component as destroyed
   */
  componentDestroyed(componentName: string): void {
    const component = this.components.get(componentName);
    if (component) {
      component.destroyedAt = Date.now();

      // Check for subscription leaks
      if (component.subscriptions > component.unsubscribed) {
        const leakedCount = component.subscriptions - component.unsubscribed;
        if (environment.enableDebugLogs) {
          console.warn(
            `[MemoryLeakDetector] Subscription leak in ${componentName}: ${leakedCount} subscriptions not unsubscribed`
          );
        }
      }

      // Remove from tracking after 1 minute
      setTimeout(() => this.components.delete(componentName), 60000);
    }
  }

  /**
   * Track subscription
   */
  trackSubscription(subscription: Subscription, componentName?: string): Subscription {
    const id = `sub-${Date.now()}-${Math.random()}`;
    this.trackedSubscriptions.set(id, subscription);

    if (componentName) {
      const component = this.components.get(componentName);
      if (component) {
        component.subscriptions++;
      }
    }

    // Wrap unsubscribe
    const originalUnsubscribe = subscription.unsubscribe.bind(subscription);
    subscription.unsubscribe = () => {
      this.trackedSubscriptions.delete(id);

      if (componentName) {
        const component = this.components.get(componentName);
        if (component) {
          component.unsubscribed++;
        }
      }

      originalUnsubscribe();
    };

    return subscription;
  }

  /**
   * Get memory report
   */
  getMemoryReport(): {
    current: MemorySnapshot | null;
    trend: string;
    warnings: MemoryLeakWarning[];
    activeComponents: number;
    trackedSubscriptions: number;
  } {
    const snapshots = this.snapshots();
    const current = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;

    return {
      current,
      trend: this.memoryTrend(),
      warnings: this.warnings(),
      activeComponents: this.components.size,
      trackedSubscriptions: this.trackedSubscriptions.size
    };
  }

  /**
   * Force garbage collection (if available)
   */
  forceGarbageCollection(): void {
    if ('gc' in window) {
      (window as LooseValue).gc();
      if (environment.enableDebugLogs)
        console.log('[MemoryLeakDetector] Forced garbage collection');
    } else {
      if (environment.enableDebugLogs)
        console.warn('[MemoryLeakDetector] Garbage collection not available');
    }
  }

  /**
   * Clear warnings
   */
  clearWarnings(): void {
    this.warnings.set([]);
  }

  /**
   * Setup automatic monitoring
   */
  private setupMemoryMonitoring(): void {
    if ('memory' in performance) {
      // Auto-start monitoring in development
      if (!this.isProduction()) {
        this.startMonitoring();
      }
    }
  }

  /**
   * Check if production
   */
  private isProduction(): boolean {
    return typeof ngDevMode === 'undefined' || !ngDevMode;
  }

  ngOnDestroy(): void {
    this.stopMonitoring();
  }
}

/**
 * Auto-Unsubscribe Decorator
 *
 * Automatically unsubscribes from all subscriptions on component destroy
 *
 * @example
 * ```typescript
 * @Component({...})
 * @AutoUnsubscribe()
 * export class MyComponent {
 *   private subscription = new Subscription();
 * }
 * ```
 */
export function AutoUnsubscribe() {
  return function (constructor: LooseValue) {
    const original = constructor.prototype.ngOnDestroy;

    constructor.prototype.ngOnDestroy = function () {
      // Unsubscribe from all subscriptions
      for (const prop in this) {
        const property = this[prop];
        if (property && typeof property.unsubscribe === 'function') {
          property.unsubscribe();
        }
      }

      // Call original ngOnDestroy
      if (original && typeof original === 'function') {
        original.apply(this, arguments);
      }
    };
  };
}
