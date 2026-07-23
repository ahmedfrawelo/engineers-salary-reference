import { Injectable, Injector, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription, filter } from 'rxjs';
import { AUTH_SESSION_FACADE, AuthSessionFacade } from '../../../core/auth/auth-session.facade';
import { runtimeConfig } from '../../../core/runtime-config';
import { environment } from '../../../../environments/environment';
import { WebSocketService } from './websocket.service';
import { OnlineUser, PresenceHeartbeatPayload, PresenceSnapshot } from './presence.models';

const PRESENCE_REST_INITIAL_BACKOFF_MS = 15_000;
const PRESENCE_REST_MAX_BACKOFF_MS = 5 * 60_000;
const PRESENCE_SNAPSHOT_FALLBACK_DELAY_MS = 1_500;

@Injectable({ providedIn: 'root' })
export class PresenceService implements OnDestroy {
  private readonly router = inject(Router);
  private readonly ws = inject(WebSocketService);
  private readonly injector = inject(Injector);
  private readonly auth = inject<AuthSessionFacade>(AUTH_SESSION_FACADE);

  private readonly _onlineUsers = signal<OnlineUser[]>([]);
  private readonly _lastUpdated = signal<number | null>(null);

  readonly onlineUsers = this._onlineUsers.asReadonly();
  readonly onlineCount = computed(() => this._onlineUsers().length);
  readonly lastUpdated = this._lastUpdated.asReadonly();

  private get http(): HttpClient {
    return this.injector.get(HttpClient);
  }

  private readonly sessionId = PresenceService.resolveSessionId();
  private currentPage = '/';
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private snapshotFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private subscriptions: Subscription[] = [];
  private running = false;
  private restFailureCount = 0;
  private restBackoffUntil = 0;

  // GPS location — updated once granted, reused in every heartbeat
  private gpsCoords: { lat: number; lng: number; accuracy: number } | null = null;

  private gpsWatchId: number | null = null;

  private requestGpsOnce(): void {
    if (!navigator.geolocation) return;

    // First: get a quick coarse fix immediately
    navigator.geolocation.getCurrentPosition(
      pos => {
        this.gpsCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        };
        this.sendHeartbeat();

        // Then: watch for a more accurate fix (GPS chip warm-up)
        this.gpsWatchId = navigator.geolocation.watchPosition(
          refined => {
            // Only update if accuracy improved by at least 20m
            const prevAcc = this.gpsCoords?.accuracy ?? Infinity;
            if (refined.coords.accuracy < prevAcc - 20) {
              this.gpsCoords = {
                lat: refined.coords.latitude,
                lng: refined.coords.longitude,
                accuracy: refined.coords.accuracy
              };
              this.sendHeartbeat();
            }
          },
          () => {},
          { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
        );
      },
      () => {
        /* user denied — silently ignore */
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  }

  constructor() {
    effect(
      () => {
        const token = this.auth.tokens()?.accessToken;
        if (token) {
          this.start();
        } else {
          this.stop();
        }
      },
      { allowSignalWrites: true }
    );
  }

  /** Request a fresh snapshot of all online users from the backend. */
  requestSnapshot(): void {
    const requestStartedAt = Date.now();
    this.ws.send('presence:request-snapshot', { sessionId: this.sessionId });

    if (this.ws.connected()) {
      this.clearSnapshotFallbackTimer();
      this.snapshotFallbackTimer = setTimeout(() => {
        const lastUpdated = this._lastUpdated() ?? 0;
        if (!this.running || lastUpdated >= requestStartedAt) {
          return;
        }
        this.fetchSnapshotViaRest();
      }, PRESENCE_SNAPSHOT_FALLBACK_DELAY_MS);
      return;
    }

    this.fetchSnapshotViaRest();
  }

  private start(): void {
    if (this.running) return;
    this.running = true;
    this.recordRestSuccess();

    this.ws.subscribeChannels(['module:presence']);

    this.subscriptions.push(
      // Full snapshot (on connect or on demand)
      this.ws.on<PresenceSnapshot>('presence:snapshot').subscribe(msg => {
        if (Array.isArray(msg.payload?.users)) {
          this.recordRestSuccess();
          this.clearSnapshotFallbackTimer();
          this._onlineUsers.set(msg.payload.users);
          this._lastUpdated.set(Date.now());
        }
      }),

      // User joined or updated their page
      this.ws.on<OnlineUser>('presence:join').subscribe(msg => {
        if (!msg.payload?.sessionId) return;
        this.recordRestSuccess();
        this._onlineUsers.update(users => {
          const idx = users.findIndex(u => u.sessionId === msg.payload.sessionId);
          if (idx >= 0) {
            const next = [...users];
            next[idx] = msg.payload;
            return next;
          }
          return [...users, msg.payload];
        });
        this._lastUpdated.set(Date.now());
      }),

      // User navigated to a different page
      this.ws.on<OnlineUser>('presence:update').subscribe(msg => {
        if (!msg.payload?.sessionId) return;
        this.recordRestSuccess();
        this._onlineUsers.update(users =>
          users.map(u => (u.sessionId === msg.payload.sessionId ? msg.payload : u))
        );
        this._lastUpdated.set(Date.now());
      }),

      // User left
      this.ws.on<{ sessionId: string }>('presence:leave').subscribe(msg => {
        if (!msg.payload?.sessionId) return;
        this.recordRestSuccess();
        this._onlineUsers.update(users => users.filter(u => u.sessionId !== msg.payload.sessionId));
        this._lastUpdated.set(Date.now());
      }),

      // Track route changes and broadcast them
      this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(e => {
        this.currentPage = (e as NavigationEnd).urlAfterRedirects;
        this.sendHeartbeat();
      })
    );

    // Heartbeat every 30s to stay alive
    this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), 30_000);

    // Announce presence immediately then get current snapshot
    this.sendHeartbeat();
    this.requestSnapshot();

    // Request GPS once — sends another heartbeat when granted
    this.requestGpsOnce();

    window.addEventListener('beforeunload', this.handlePageClose);
  }

  private stop(): void {
    if (!this.running) return;
    this.running = false;
    this.recordRestSuccess();

    if (this.gpsWatchId !== null) {
      navigator.geolocation?.clearWatch(this.gpsWatchId);
      this.gpsWatchId = null;
    }

    this.handlePageClose();
    this.ws.unsubscribeChannels(['module:presence']);

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.clearSnapshotFallbackTimer();

    this.subscriptions.forEach(s => s.unsubscribe());
    this.subscriptions = [];

    window.removeEventListener('beforeunload', this.handlePageClose);
    this._onlineUsers.set([]);
    this._lastUpdated.set(null);
  }

  private sendHeartbeat(): void {
    const payload: PresenceHeartbeatPayload = {
      sessionId: this.sessionId,
      page: this.currentPage,
      pageTitle: document.title,
      device: this.detectDevice(),
      browser: this.detectBrowser(),
      os: this.detectOs(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      ...(this.gpsCoords && {
        latitude: this.gpsCoords.lat,
        longitude: this.gpsCoords.lng,
        locationAccuracy: this.gpsCoords.accuracy
      })
    };

    // Primary channel
    this.ws.send('presence:heartbeat', payload);

    // REST fallback is only used while realtime is disconnected.
    if (!this.ws.connected()) {
      this.sendHeartbeatViaRest(payload);
    }
  }

  private readonly handlePageClose = (): void => {
    const base = this.apiBase();
    const leavePayload = JSON.stringify({ sessionId: this.sessionId });

    // sendBeacon survives page unload; fetch does not
    if (navigator.sendBeacon) {
      navigator.sendBeacon(`${base}/presence/leave`, leavePayload);
    }

    this.ws.send('presence:leave', { sessionId: this.sessionId });
  };

  private apiBase(): string {
    return (runtimeConfig().apiBaseUrl ?? environment.API_BASE_URL ?? '').replace(/\/+$/, '');
  }

  private fetchSnapshotViaRest(): void {
    if (!this.canAttemptRestFallback()) {
      return;
    }

    const base = this.apiBase();
    this.http
      .get<{ data?: { users?: OnlineUser[] }; users?: OnlineUser[] }>(`${base}/presence/active`)
      .subscribe({
        next: res => {
          const users = res?.data?.users ?? res?.users ?? [];
          this.recordRestSuccess();
          this._onlineUsers.set(users);
          this._lastUpdated.set(Date.now());
        },
        error: () => {
          this.recordRestFailure();
        }
      });
  }

  private sendHeartbeatViaRest(payload: PresenceHeartbeatPayload): void {
    if (!this.canAttemptRestFallback()) {
      return;
    }

    const base = this.apiBase();
    this.http.post(`${base}/presence/heartbeat`, payload).subscribe({
      next: () => {
        this.recordRestSuccess();
      },
      error: () => {
        this.recordRestFailure();
      }
    });
  }

  private canAttemptRestFallback(): boolean {
    return Date.now() >= this.restBackoffUntil;
  }

  private recordRestSuccess(): void {
    this.restFailureCount = 0;
    this.restBackoffUntil = 0;
  }

  private recordRestFailure(): void {
    this.restFailureCount += 1;
    const delay = Math.min(
      PRESENCE_REST_INITIAL_BACKOFF_MS * Math.pow(2, this.restFailureCount - 1),
      PRESENCE_REST_MAX_BACKOFF_MS
    );
    this.restBackoffUntil = Date.now() + delay;
  }

  private clearSnapshotFallbackTimer(): void {
    if (this.snapshotFallbackTimer) {
      clearTimeout(this.snapshotFallbackTimer);
      this.snapshotFallbackTimer = null;
    }
  }

  private detectDevice(): 'desktop' | 'mobile' | 'tablet' {
    const ua = navigator.userAgent;
    if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
    if (/mobile|android|iphone|iemobile|blackberry/i.test(ua)) return 'mobile';
    return 'desktop';
  }

  private detectBrowser(): string {
    const ua = navigator.userAgent;
    if (/Edg\//i.test(ua)) return 'Edge';
    if (/OPR\//i.test(ua) || /Opera\//i.test(ua)) return 'Opera';
    if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) return 'Chrome';
    if (/Firefox\//i.test(ua)) return 'Firefox';
    if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) return 'Safari';
    if (/Trident\/|MSIE /i.test(ua)) return 'IE';
    return 'Unknown';
  }

  private detectOs(): string {
    const ua = navigator.userAgent;
    if (/Windows NT 10\.0/i.test(ua)) return 'Windows 10/11';
    if (/Windows NT 6\.3/i.test(ua)) return 'Windows 8.1';
    if (/Windows NT 6\.1/i.test(ua)) return 'Windows 7';
    if (/Windows/i.test(ua)) return 'Windows';
    if (/iPhone OS/i.test(ua)) return 'iOS';
    if (/iPad/i.test(ua)) return 'iPadOS';
    if (/Android/i.test(ua)) return 'Android';
    if (/Mac OS X/i.test(ua)) return 'macOS';
    if (/Linux/i.test(ua)) return 'Linux';
    return 'Unknown';
  }

  /**
   * Returns a stable session ID that survives page reloads within the same browser tab.
   * Uses sessionStorage so each tab gets its own ID, and closing the tab clears it.
   */
  private static resolveSessionId(): string {
    const key = 'engineers-salary-reference.presence.sid';
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
    return id;
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
