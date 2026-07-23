import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

export enum LogLevel {
  Debug = 0,
  Info = 1,
  Warn = 2,
  Error = 3,
  None = 4
}

/**
 * Professional logging service with environment-based log levels
 *
 * @description
 * Provides centralized logging with automatic suppression in production.
 * Use this instead of console.log for all application logging.
 *
 * @example
 * ```typescript
 * constructor(private logger: LoggerService) {}
 *
 * this.logger.debug('User action', { userId: 123 });
 * this.logger.error('API failed', error);
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class LoggerService {
  private currentLevel: LogLevel;
  private readonly enableConsole: boolean;

  constructor() {
    // In production, only show warnings and errors
    this.currentLevel = environment.production ? LogLevel.Warn : LogLevel.Debug;
    this.enableConsole = !environment.production || environment.enableDebugLogs || false;
  }

  /**
   * Log debug message (development only)
   * @param message - Debug message
   * @param args - Additional arguments to log
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.Debug)) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  /**
   * Log informational message
   * @param message - Info message
   * @param args - Additional arguments to log
   */
  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.Info)) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  /**
   * Log warning message
   * @param message - Warning message
   * @param args - Additional arguments to log
   */
  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.Warn)) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  /**
   * Log error message
   * @param message - Error message
   * @param error - Error object (optional)
   * @param args - Additional arguments to log
   */
  error(message: string, error?: unknown, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.Error)) {
      if (error) {
        console.error(`[ERROR] ${message}`, error, ...args);
      } else {
        console.error(`[ERROR] ${message}`, ...args);
      }
    }
  }

  setLogLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  logPerformance(operationName: string, startTime: number): void {
    const duration = performance.now() - startTime;
    if (duration > 1000) {
      this.warn(`[PERFORMANCE] ${operationName} took ${duration.toFixed(2)}ms`);
      return;
    }
    this.debug(`[PERFORMANCE] ${operationName} took ${duration.toFixed(2)}ms`);
  }

  logApiCall(method: string, url: string, statusCode?: number, duration?: number): void {
    const message = `[API] ${method} ${url}`;
    if (statusCode && statusCode >= 400) {
      if (statusCode === 401 && /\/auth\/me\b/i.test(url)) {
        this.warn(`${message} - Status: ${statusCode}`);
        return;
      }
      this.error(`${message} - Status: ${statusCode}`);
      return;
    }
    if (duration && duration > 2000) {
      this.warn(`${message} - Slow response: ${duration}ms`);
      return;
    }
    this.debug(`${message} - Status: ${statusCode || 'pending'}`);
  }

  private shouldLog(level: LogLevel): boolean {
    return this.enableConsole && level >= this.currentLevel;
  }
}
