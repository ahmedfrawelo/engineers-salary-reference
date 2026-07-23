import { ErrorHandler, Injectable } from '@angular/core';
import * as Sentry from '@sentry/angular';
import { environment } from '../../../environments/environment';

type LooseValue = ReturnType<typeof JSON.parse>;
/**
 * Sentry Configuration
 */
export interface SentryConfig {
  dsn: string;
  environment: string;
  release?: string;
  tracesSampleRate?: number;
  replaysSessionSampleRate?: number;
  replaysOnErrorSampleRate?: number;
}

/**
 * Sentry Error Tracking Service
 *
 * Features:
 * - Automatic error tracking
 * - User context
 * - Breadcrumbs
 * - Performance monitoring
 * - Session replay
 * - Release tracking
 *
 * @example
 * // In app.config.ts
 * providers: [
 *   { provide: ErrorHandler, useClass: SentryErrorHandler }
 * ]
 *
 * // Manual tracking
 * this.sentry.captureException(error);
 * this.sentry.captureMessage('Something went wrong', 'warning');
 */
@Injectable({
  providedIn: 'root'
})
export class SentryService {
  private initialized = false;

  /**
   * Initialize Sentry
   */
  init(config: SentryConfig): void {
    if (this.initialized) {
      if (environment.enableDebugLogs) console.warn('[Sentry] Already initialized');
      return;
    }

    Sentry.init({
      dsn: config.dsn,
      environment: config.environment,
      release: config.release,

      // Performance Monitoring
      tracesSampleRate: config.tracesSampleRate ?? 0.1, // 10% of transactions

      // Session Replay
      replaysSessionSampleRate: config.replaysSessionSampleRate ?? 0.1, // 10% of sessions
      replaysOnErrorSampleRate: config.replaysOnErrorSampleRate ?? 1.0, // 100% on errors

      integrations: [
        // Angular/browser tracing
        Sentry.browserTracingIntegration({}),

        // Session Replay
        Sentry.replayIntegration({
          maskAllText: false,
          blockAllMedia: false
        })
      ],

      // Error filtering
      beforeSend(event, hint) {
        // Filter out known errors
        const error = hint.originalException;

        if (error && typeof error === 'object' && 'message' in error) {
          const message = (error as Error).message;

          // Ignore specific errors
          if (message.includes('ResizeObserver loop')) {
            return null;
          }
          if (message.includes('Non-Error promise rejection')) {
            return null;
          }
        }

        return event;
      }
    });

    this.initialized = true;
    if (environment.enableDebugLogs) console.log('[Sentry] Initialized');
  }

  /**
   * Capture exception
   */
  captureException(error: Error, context?: Record<string, LooseValue>): void {
    if (!this.initialized) return;

    if (context) {
      Sentry.withScope(scope => {
        Object.entries(context).forEach(([key, value]) => {
          scope.setContext(key, value);
        });
        Sentry.captureException(error);
      });
    } else {
      Sentry.captureException(error);
    }
  }

  /**
   * Capture message
   */
  captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): void {
    if (!this.initialized) return;
    Sentry.captureMessage(message, level);
  }

  /**
   * Set user context
   */
  setUser(user: { id: string; email?: string; username?: string }): void {
    if (!this.initialized) return;
    Sentry.setUser(user);
  }

  /**
   * Clear user context
   */
  clearUser(): void {
    if (!this.initialized) return;
    Sentry.setUser(null);
  }

  /**
   * Add breadcrumb
   */
  addBreadcrumb(breadcrumb: {
    message: string;
    category?: string;
    level?: Sentry.SeverityLevel;
    data?: Record<string, LooseValue>;
  }): void {
    if (!this.initialized) return;
    Sentry.addBreadcrumb(breadcrumb);
  }

  /**
   * Set tag
   */
  setTag(key: string, value: string): void {
    if (!this.initialized) return;
    Sentry.setTag(key, value);
  }

  /**
   * Set context
   */
  setContext(name: string, context: Record<string, LooseValue>): void {
    if (!this.initialized) return;
    Sentry.setContext(name, context);
  }

  /**
   * Start transaction (Performance monitoring)
   */
  startTransaction(name: string, op: string): Sentry.Span | undefined {
    if (!this.initialized) return undefined;
    return Sentry.startInactiveSpan({ name, op });
  }
}

/**
 * Sentry Error Handler
 * Integrates with Angular's ErrorHandler
 */
@Injectable()
export class SentryErrorHandler implements ErrorHandler {
  constructor(private sentry: SentryService) {}

  handleError(error: Error): void {
    // Log to console in development
    if (!environment.production) {
      console.error('[Error]', error);
    }

    // Send to Sentry
    this.sentry.captureException(error);

    // Don't throw to prevent app crash
  }
}
