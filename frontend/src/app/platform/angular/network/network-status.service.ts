import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { fromEvent, merge, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

type LooseValue = ReturnType<typeof JSON.parse>;
/**
 * Network Status Service
 * خدمة مراقبة حالة الاتصال بالإنترنت
 *
 * Monitors online/offline status and connection quality
 */
@Injectable({
  providedIn: 'root'
})
export class NetworkStatusService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  /**
   * Online status signal
   * إشارة حالة الاتصال
   */
  private _isOnline = signal(true);
  readonly isOnline = this._isOnline.asReadonly();

  /**
   * Connection type signal
   * نوع الاتصال (4g, 3g, wifi, etc.)
   */
  private _connectionType = signal<string>('unknown');
  readonly connectionType = this._connectionType.asReadonly();

  /**
   * Downlink speed in Mbps
   * سرعة التنزيل
   */
  private _downlink = signal<number>(0);
  readonly downlink = this._downlink.asReadonly();

  /**
   * Round-trip time in ms
   * وقت الاستجابة
   */
  private _rtt = signal<number>(0);
  readonly rtt = this._rtt.asReadonly();

  constructor() {
    if (this.isBrowser) {
      this.initializeStatusMonitoring();
      this.initializeConnectionMonitoring();
    }
  }

  /**
   * Initialize online/offline monitoring
   * تهيئة مراقبة الاتصال/عدم الاتصال
   */
  private initializeStatusMonitoring(): void {
    // Set initial status
    this._isOnline.set(navigator.onLine);

    // Listen to online/offline events
    const online$ = fromEvent(window, 'online').pipe(map(() => true));
    const offline$ = fromEvent(window, 'offline').pipe(map(() => false));

    merge(online$, offline$).subscribe(status => {
      this._isOnline.set(status);
      if (environment.enableDebugLogs)
        console.log(`🌐 Network status changed: ${status ? 'Online' : 'Offline'}`);
    });
  }

  /**
   * Initialize connection quality monitoring
   * تهيئة مراقبة جودة الاتصال
   */
  private initializeConnectionMonitoring(): void {
    // Check if Network Information API is available
    const connection =
      (navigator as LooseValue).connection ||
      (navigator as LooseValue).mozConnection ||
      (navigator as LooseValue).webkitConnection;

    if (!connection) {
      return;
    }

    // Update connection info
    const updateConnectionInfo = () => {
      this._connectionType.set(connection.effectiveType || 'unknown');
      this._downlink.set(connection.downlink || 0);
      this._rtt.set(connection.rtt || 0);
    };

    // Initial update
    updateConnectionInfo();

    // Listen to connection changes
    connection.addEventListener('change', updateConnectionInfo);
  }

  /**
   * Check if connection is slow
   * التحقق من بطء الاتصال
   */
  get isSlowConnection(): boolean {
    const type = this._connectionType();
    return type === 'slow-2g' || type === '2g';
  }

  /**
   * Check if connection is fast
   * التحقق من سرعة الاتصال
   */
  get isFastConnection(): boolean {
    const type = this._connectionType();
    return type === '4g' || type === 'wifi';
  }

  /**
   * Get connection quality label
   * الحصول على تسمية جودة الاتصال
   */
  getConnectionQuality(): 'excellent' | 'good' | 'fair' | 'poor' {
    const downlink = this._downlink();

    if (downlink >= 10) return 'excellent';
    if (downlink >= 5) return 'good';
    if (downlink >= 1.5) return 'fair';
    return 'poor';
  }

  /**
   * Ping check (simulate)
   * فحص الاتصال
   */
  async checkConnection(): Promise<boolean> {
    if (!this.isBrowser) {
      return true;
    }

    try {
      const response = await fetch('/assets/ping.json', {
        method: 'HEAD',
        cache: 'no-cache'
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get status summary
   * ملخص حالة الاتصال
   */
  getStatusSummary() {
    return {
      isOnline: this._isOnline(),
      connectionType: this._connectionType(),
      downlink: this._downlink(),
      rtt: this._rtt(),
      quality: this.getConnectionQuality(),
      isSlow: this.isSlowConnection,
      isFast: this.isFastConnection
    };
  }
}
