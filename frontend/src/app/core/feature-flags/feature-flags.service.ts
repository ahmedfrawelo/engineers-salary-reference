import { Injectable, signal, computed } from '@angular/core';
import { runtimeConfig } from '../runtime-config';
import { environment } from '../../../environments/environment';

type LooseValue = ReturnType<typeof JSON.parse>;
/**
 * Feature Flag Configuration
 */
export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description?: string;
  rolloutPercentage?: number; // 0-100
  enabledForUsers?: string[]; // User IDs
  enabledForRoles?: string[]; // Role IDs
  expiresAt?: Date;
}

/**
 * Feature Flags Service
 *
 * Allows toggling features on/off without deploying new code.
 *
 * Features:
 * - Simple boolean flags
 * - Percentage-based rollouts
 * - User-specific flags
 * - Role-based flags
 * - Expiration dates
 * - Remote configuration (future)
 *
 * @example
 * ```typescript
 * // Check if feature is enabled
 * if (this.featureFlags.isEnabled('new-dashboard')) {
 *   // Show new dashboard
 * }
 *
 * // In template
 * <div *ngIf="featureFlags.isEnabled('experimental-feature')">
 *   New Feature!
 * </div>
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class FeatureFlagsService {
  // Feature flags state
  private flags = signal<Map<string, FeatureFlag>>(
    new Map([
      // Default flags
      [
        'new-dashboard',
        {
          key: 'new-dashboard',
          enabled: false,
          description: 'New dashboard UI',
          rolloutPercentage: 0
        }
      ],
      [
        'advanced-filters',
        {
          key: 'advanced-filters',
          enabled: true,
          description: 'Advanced filtering in data grids'
        }
      ],
      [
        'dark-mode',
        {
          key: 'dark-mode',
          enabled: true,
          description: 'Dark mode support'
        }
      ],
      [
        'export-pdf',
        {
          key: 'export-pdf',
          enabled: true,
          description: 'PDF export functionality'
        }
      ],
      [
        'websocket-updates',
        {
          key: 'websocket-updates',
          enabled: false,
          description: 'Real-time updates via WebSocket'
        }
      ]
    ])
  );

  readonly allFlags = computed(() => Array.from(this.flags().values()));

  constructor() {
    this.loadFromRuntime();
  }

  /**
   * Check if feature is enabled
   * @param key Feature flag key
   * @param userId Optional user ID for user-specific flags
   * @param userRoles Optional user roles for role-based flags
   */
  isEnabled(key: string, userId?: string, userRoles?: string[]): boolean {
    const flag = this.flags().get(key);

    if (!flag) {
      if (environment.enableDebugLogs) {
        console.warn(`[FeatureFlags] Unknown flag: ${key}`);
      }
      return false;
    }

    // Check if expired
    if (flag.expiresAt && new Date() > flag.expiresAt) {
      return false;
    }

    // Check user-specific flags
    if (userId && flag.enabledForUsers && flag.enabledForUsers.length > 0) {
      return flag.enabledForUsers.includes(userId);
    }

    // Check role-based flags
    if (userRoles && flag.enabledForRoles && flag.enabledForRoles.length > 0) {
      return userRoles.some(role => flag.enabledForRoles!.includes(role));
    }

    // Check rollout percentage
    if (flag.rolloutPercentage !== undefined && userId) {
      const hash = this.hashCode(userId + key);
      const bucket = Math.abs(hash % 100);
      if (bucket >= flag.rolloutPercentage) {
        return false;
      }
    }

    return flag.enabled;
  }

  /**
   * Enable a feature flag
   */
  enable(key: string): void {
    const current = this.flags();
    const flag = current.get(key);

    if (flag) {
      current.set(key, { ...flag, enabled: true });
      this.flags.set(new Map(current));
      if (environment.enableDebugLogs) console.log(`[FeatureFlags] Enabled: ${key}`);
    }
  }

  /**
   * Disable a feature flag
   */
  disable(key: string): void {
    const current = this.flags();
    const flag = current.get(key);

    if (flag) {
      current.set(key, { ...flag, enabled: false });
      this.flags.set(new Map(current));
      if (environment.enableDebugLogs) console.log(`[FeatureFlags] Disabled: ${key}`);
    }
  }

  /**
   * Set rollout percentage
   */
  setRolloutPercentage(key: string, percentage: number): void {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Rollout percentage must be between 0 and 100');
    }

    const current = this.flags();
    const flag = current.get(key);

    if (flag) {
      current.set(key, { ...flag, rolloutPercentage: percentage });
      this.flags.set(new Map(current));
      if (environment.enableDebugLogs) console.log(`[FeatureFlags] Rollout ${key}: ${percentage}%`);
    }
  }

  /**
   * Add feature flag
   */
  addFlag(flag: FeatureFlag): void {
    const current = this.flags();
    current.set(flag.key, flag);
    this.flags.set(new Map(current));
    if (environment.enableDebugLogs) console.log(`[FeatureFlags] Added: ${flag.key}`);
  }

  /**
   * Remove feature flag
   */
  removeFlag(key: string): void {
    const current = this.flags();
    current.delete(key);
    this.flags.set(new Map(current));
    if (environment.enableDebugLogs) console.log(`[FeatureFlags] Removed: ${key}`);
  }

  /**
   * Get flag configuration
   */
  getFlag(key: string): FeatureFlag | undefined {
    return this.flags().get(key);
  }

  /**
   * Load flags from remote server (future implementation)
   */
  async loadFromRemote(): Promise<void> {
    this.loadFromRuntime();
  }

  /**
   * Save flags to localStorage (for development)
   */
  saveToLocalStorage(): void {
    const flagsArray = Array.from(this.flags().entries());
    localStorage.setItem('feature-flags', JSON.stringify(flagsArray));
  }

  /**
   * Load flags from localStorage
   */
  loadFromLocalStorage(): void {
    const stored = localStorage.getItem('feature-flags');
    if (stored) {
      try {
        const flagsArray = JSON.parse(stored);
        this.flags.set(new Map(flagsArray));
        if (environment.enableDebugLogs) console.log('[FeatureFlags] Loaded from localStorage');
      } catch (error) {
        console.error('[FeatureFlags] Error loading from localStorage', error);
      }
    }
  }

  private loadFromRuntime(): void {
    const runtime = runtimeConfig() as {
      featureFlags?: Record<string, unknown> | Array<Record<string, unknown>>;
    };
    const raw = runtime?.featureFlags;
    if (!raw) {
      return;
    }

    if (Array.isArray(raw)) {
      raw.forEach(entry => {
        if (!entry || typeof entry !== 'object') {
          return;
        }
        const flag = this.normalizeFlagEntry(entry as Record<string, unknown>);
        if (flag) {
          this.applyFlag(flag);
        }
      });
      return;
    }

    if (typeof raw === 'object') {
      Object.entries(raw).forEach(([key, value]) => {
        const flag = this.normalizeFlag(key, value);
        if (flag) {
          this.applyFlag(flag);
        }
      });
    }
  }

  private normalizeFlag(key: string, value: unknown): FeatureFlag | null {
    if (typeof value === 'boolean') {
      return { key, enabled: value };
    }
    if (!value || typeof value !== 'object') {
      return null;
    }

    const raw = value as Partial<FeatureFlag>;
    const flag: FeatureFlag = {
      key,
      enabled: typeof raw.enabled === 'boolean' ? raw.enabled : false,
      description: typeof raw.description === 'string' ? raw.description : undefined,
      rolloutPercentage:
        typeof raw.rolloutPercentage === 'number' ? raw.rolloutPercentage : undefined,
      enabledForUsers: Array.isArray(raw.enabledForUsers) ? raw.enabledForUsers : undefined,
      enabledForRoles: Array.isArray(raw.enabledForRoles) ? raw.enabledForRoles : undefined,
      expiresAt: this.parseExpiresAt(raw.expiresAt)
    };

    return flag;
  }

  private normalizeFlagEntry(entry: Record<string, unknown>): FeatureFlag | null {
    const key = typeof entry.key === 'string' ? entry.key : '';
    if (!key) {
      return null;
    }
    const raw = entry as Partial<FeatureFlag>;
    return {
      key,
      enabled: typeof raw.enabled === 'boolean' ? raw.enabled : false,
      description: typeof raw.description === 'string' ? raw.description : undefined,
      rolloutPercentage:
        typeof raw.rolloutPercentage === 'number' ? raw.rolloutPercentage : undefined,
      enabledForUsers: Array.isArray(raw.enabledForUsers) ? raw.enabledForUsers : undefined,
      enabledForRoles: Array.isArray(raw.enabledForRoles) ? raw.enabledForRoles : undefined,
      expiresAt: this.parseExpiresAt(raw.expiresAt)
    };
  }

  private parseExpiresAt(value: FeatureFlag['expiresAt']): Date | undefined {
    if (!value) {
      return undefined;
    }
    if (value instanceof Date) {
      return value;
    }
    const parsed = new Date(value as LooseValue);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private applyFlag(flag: FeatureFlag): void {
    const current = this.flags();
    const existing = current.get(flag.key);
    current.set(flag.key, { ...existing, ...flag });
    this.flags.set(new Map(current));
  }

  /**
   * Hash function for consistent user bucketing
   */
  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }
}

/**
 * Feature Flag Directive
 * Show/hide elements based on feature flags
 *
 * @example
 * ```html
 * <div *featureFlag="'new-dashboard'">
 *   New Dashboard Content
 * </div>
 * ```
 */
import { Directive, Input, TemplateRef, ViewContainerRef, OnInit } from '@angular/core';

@Directive({
  selector: '[featureFlag]',
  standalone: true
})
export class FeatureFlagDirective implements OnInit {
  @Input() featureFlag!: string;

  constructor(
    private templateRef: TemplateRef<LooseValue>,
    private viewContainer: ViewContainerRef,
    private featureFlags: FeatureFlagsService
  ) {}

  ngOnInit(): void {
    if (this.featureFlags.isEnabled(this.featureFlag)) {
      this.viewContainer.createEmbeddedView(this.templateRef);
    } else {
      this.viewContainer.clear();
    }
  }
}
