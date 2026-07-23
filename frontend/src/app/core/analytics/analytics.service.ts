import { Injectable } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

type LooseValue = ReturnType<typeof JSON.parse>;
declare global {
  interface Window {
    gtag?: (...args: LooseValue[]) => void;
    dataLayer?: LooseValue[];
  }
}

export interface AnalyticsEvent {
  category: string;
  action: string;
  label?: string;
  value?: number;
}

/**
 * Analytics Service
 *
 * Tracks user behavior and supports Google Analytics 4.
 *
 * @example
 * ```typescript
 * constructor(private analytics: AnalyticsService) {
 *   this.analytics.trackEvent({
 *     category: 'Button',
 *     action: 'Click',
 *     label: 'Submit Form'
 *   });
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly enabled = !!environment.analytics?.enabled;
  private trackingId = (environment.analytics?.trackingId || '').trim();
  private initialized = false;

  constructor(private router: Router) {
    if (this.isConfigured()) {
      this.initializeOnce();
    } else if (this.enabled) {
      this.debugLog('[Analytics] Analytics enabled but tracking ID is missing or invalid.');
    }
  }

  initialize(trackingId?: string): void {
    if (typeof trackingId === 'string' && trackingId.trim()) {
      this.trackingId = trackingId.trim();
    }
    this.initializeOnce();
    if (!this.initialized && this.enabled) {
      this.debugLog('[Analytics] Analytics enabled but tracking ID is missing or invalid.');
    }
  }

  /**
   * Initialize Google Analytics
   */
  private initializeGoogleAnalytics(): void {
    if (!this.isConfigured()) {
      return;
    }
    // Tracking ID comes from environment.analytics.trackingId.
    const trackingId = this.trackingId;
    if (!trackingId) {
      this.debugLog('[Analytics] Tracking ID not configured.');
      return;
    }
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${trackingId}`;
    document.head.appendChild(script);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer!.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', trackingId);
  }

  private initializeOnce(): void {
    if (this.initialized || !this.isConfigured()) {
      return;
    }
    this.initializeGoogleAnalytics();
    this.trackPageViews();
    this.initialized = true;
  }

  /**
   * Track page views automatically
   */
  private trackPageViews(): void {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: LooseValue) => {
        this.trackPageView(event.urlAfterRedirects);
      });
  }

  /**
   * Track a page view
   */
  trackPageView(path: string): void {
    if (!this.isConfigured() || !window.gtag) return;

    window.gtag('config', this.trackingId, {
      page_path: path
    });
    this.debugLog('[Analytics] Page view:', path);
  }

  /**
   * Track a custom event
   */
  trackEvent(event: AnalyticsEvent): void {
    if (!this.isConfigured() || !window.gtag) return;

    window.gtag('event', event.action, {
      event_category: event.category,
      event_label: event.label,
      value: event.value,
      non_interaction: false
    });
    this.debugLog('[Analytics] Event:', event);
  }

  /**
   * Track user login
   */
  trackLogin(method: string = 'email'): void {
    this.trackEvent({
      category: 'User',
      action: 'Login',
      label: method
    });
  }

  /**
   * Track user logout
   */
  trackLogout(): void {
    this.trackEvent({
      category: 'User',
      action: 'Logout'
    });
  }

  /**
   * Track search
   */
  trackSearch(searchTerm: string): void {
    if (!this.isConfigured() || !window.gtag) return;

    window.gtag('event', 'search', {
      search_term: searchTerm
    });
  }

  /**
   * Track form submission
   */
  trackFormSubmit(formName: string, success: boolean = true): void {
    this.trackEvent({
      category: 'Form',
      action: success ? 'Submit Success' : 'Submit Failed',
      label: formName
    });
  }

  /**
   * Track export operation
   */
  trackExport(exportType: 'excel' | 'pdf' | 'csv', itemCount: number): void {
    this.trackEvent({
      category: 'Export',
      action: exportType.toUpperCase(),
      value: itemCount
    });
  }

  /**
   * Track error
   */
  trackError(errorMessage: string, errorType: 'API' | 'Client' | 'Network'): void {
    this.trackEvent({
      category: 'Error',
      action: errorType,
      label: errorMessage
    });
  }

  /**
   * Track performance metric
   */
  trackPerformance(metric: string, value: number): void {
    if (!this.isConfigured() || !window.gtag) return;

    window.gtag('event', 'timing_complete', {
      name: metric,
      value: Math.round(value),
      event_category: 'Performance'
    });
  }

  /**
   * Set user properties
   */
  setUserProperties(properties: Record<string, LooseValue>): void {
    if (!this.isConfigured() || !window.gtag) return;

    window.gtag('set', 'user_properties', properties);
  }

  /**
   * Set user ID
   */
  setUserId(userId: string): void {
    if (!this.isConfigured() || !window.gtag) return;

    window.gtag('config', this.trackingId, {
      user_id: userId
    });
  }

  private isConfigured(): boolean {
    return this.enabled && this.isValidTrackingId(this.trackingId);
  }

  private isValidTrackingId(value: string): boolean {
    const trackingId = value.trim().toUpperCase();
    return /^G-[A-Z0-9]+$/.test(trackingId) && !/^G-X+$/.test(trackingId);
  }

  private debugLog(message: string, ...args: unknown[]): void {
    if (!environment.enableDebugLogs) {
      return;
    }
    console.log(message, ...args);
  }
}
