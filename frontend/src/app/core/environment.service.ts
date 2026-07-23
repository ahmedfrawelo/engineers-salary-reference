import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { mergeRuntimeFeatureFlags, resolveAuthRuntimeOptions } from './auth/auth-runtime.util';
import { runtimeConfig } from './runtime-config';

type LooseValue = ReturnType<typeof JSON.parse>;

/**
 * Environment Configuration Service
 *
 * Provides centralized access to environment variables
 * with runtime configuration and feature flags
 */
@Injectable({
  providedIn: 'root'
})
export class EnvironmentService {
  private readonly env = environment;
  private readonly envFeatureFlags = (
    this.env as typeof environment & {
      featureFlags?: Record<string, boolean>;
    }
  ).featureFlags;

  /**
   * Check if running in production mode
   */
  get isProduction(): boolean {
    return this.env.production;
  }

  /**
   * Check if running in development mode
   */
  get isDevelopment(): boolean {
    return !this.env.production;
  }

  /**
   * Get API base URL
   */
  get apiUrl(): string {
    return runtimeConfig().apiBaseUrl ?? this.env.API_BASE_URL;
  }

  /**
   * Check if using mock data
   */
  get useMock(): boolean {
    return this.env.useMock;
  }

  /**
   * Get application version
   */
  get version(): string {
    return this.env.version;
  }

  /**
   * Check if debug logging is enabled
   */
  get debugEnabled(): boolean {
    return this.env.enableDebugLogs ?? false;
  }

  /**
   * Get security configuration
   */
  get security() {
    const runtime = runtimeConfig();
    const envSecurity = this.env.security;
    return (
      (envSecurity
        ? {
            ...envSecurity,
            allowSelfRegistration:
              runtime.allowSelfRegistration ?? envSecurity.allowSelfRegistration,
            deleteProtection: {
              ...envSecurity.deleteProtection,
              ...runtime.deleteProtection
            }
          }
        : undefined) ?? {
        enableHttps: this.isProduction,
        tokenExpiration: 3600000,
        enableCsrf: true
      }
    );
  }

  /**
   * Get HTTP configuration
   */
  get http() {
    const runtime = runtimeConfig();
    const authRuntime = resolveAuthRuntimeOptions();
    return this.env.http
      ? {
          ...this.env.http,
          timeout: runtime.timeoutMs ?? this.env.http.timeout,
          retries:
            typeof runtime.retries === 'number'
              ? runtime.retries
              : ((this.env.http as LooseValue)?.retries as number | undefined),
          withCredentials: authRuntime.withCredentials
        }
      : {
          timeout: runtime.timeoutMs ?? 30000,
          retryAttempts: 3,
          retryDelay: 1000,
          withCredentials: authRuntime.withCredentials
        };
  }

  /**
   * Get feature flags
   *
   * @param feature Feature name
   * @returns Whether feature is enabled
   */
  isFeatureEnabled(feature: string): boolean {
    const runtimeFeatures = mergeRuntimeFeatureFlags(
      this.envFeatureFlags,
      runtimeConfig().featureFlags
    );
    const features: Record<string, boolean> = {
      'offline-mode': true,
      'push-notifications': true,
      'voice-commands': true,
      'real-time-collaboration': false,
      analytics: this.isProduction,
      'error-tracking': this.isProduction,
      'performance-monitoring': this.isProduction
    };

    return runtimeFeatures?.[feature] ?? features[feature] ?? false;
  }

  /**
   * Get environment-specific configuration
   *
   * @param key Configuration key
   * @param defaultValue Default value if not found
   * @returns Configuration value
   */
  getConfig<T>(key: string, defaultValue: T): T {
    const config: Record<string, LooseValue> = {
      'max-upload-size': 10 * 1024 * 1024,
      'page-size': 10,
      'cache-duration': 5 * 60 * 1000,
      'session-timeout': 30 * 60 * 1000,
      'auto-save-interval': 30 * 1000,
      'notification-duration': 5000,
      'debounce-time': 300,
      'animation-duration': 200
    };

    return (config[key] as T) ?? defaultValue;
  }

  /**
   * Get all environment variables (for debugging)
   *
   * @returns Environment object (without sensitive data)
   */
  getEnvironment() {
    return {
      production: this.isProduction,
      version: this.version,
      apiUrl: this.apiUrl,
      useMock: this.useMock,
      debugEnabled: this.debugEnabled
    };
  }

  /**
   * Log environment info (development only)
   */
  logEnvironmentInfo(): void {
    if (this.isDevelopment) {
      console.group('Environment Configuration');
      console.table(this.getEnvironment());
      console.groupEnd();
    }
  }
}
