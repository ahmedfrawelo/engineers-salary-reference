import { Injectable, Injector, OnDestroy, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { AUTH_SESSION_FACADE, AuthSessionFacade } from '../../../core/auth/auth-session.facade';
import {
  COOKIE_AUTH_SESSION_TOKEN,
  resolveAuthRuntimeOptions
} from '../../../core/auth/auth-runtime.util';
import {
  extractRealtimeEvent,
  type RealtimeEventPayload,
  isNotificationRealtimeEvent
} from './realtime-events';
import { runtimeConfig } from '../../../core/runtime-config';
import { environment } from '../../../../environments/environment';

type LooseValue = ReturnType<typeof JSON.parse>;
const AUTH_SESSION_STORAGE_KEY = 'engineers-salary-reference.portal.session';

export interface WebSocketMessage<T = LooseValue> {
  type: string;
  payload: T;
  timestamp?: number;
}

export interface WebSocketConfig {
  url: string;
  enabled?: boolean;
  tokenParam?: string;
  reconnect?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  defaultChannels?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService implements OnDestroy {
  private readonly ticketDebounceMs = 200;
  private readonly auth = inject<AuthSessionFacade>(AUTH_SESSION_FACADE);
  private readonly injector = inject(Injector);

  private socket: WebSocket | null = null;
  private readonly messagesSubject$ = new Subject<WebSocketMessage>();
  private readonly baseChannels = new Set<string>();
  private readonly extraChannels = new Set<string>();
  private readonly initialized = signal(false);
  private reconnectAttempt = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private ticketDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private ticketRequestInFlight = false;
  private ticketRateLimitedUntil = 0;
  private readonly intentionalClosures = new WeakSet<WebSocket>();
  private currentUrl = '';
  private config: Required<WebSocketConfig> = {
    url: '',
    enabled: true,
    tokenParam: 'access_token',
    reconnect: true,
    reconnectAttempts: 12,
    reconnectInterval: 1200,
    heartbeatInterval: 30000,
    defaultChannels: [
      'module:tasks',
      'module:crm',
      'module:tendering',
      'module:tender-activity',
      'module:suppliers',
      'module:materials',
      'module:messaging',
      'module:identity',
      'module:boq'
    ]
  };

  readonly connected = signal(false);
  readonly connecting = signal(false);

  private get http(): HttpClient {
    return this.injector.get(HttpClient);
  }

  constructor() {
    this.syncBaseChannels(this.config.defaultChannels);

    effect(
      () => {
        const isInitialized = this.initialized();
        const token = this.auth.tokens()?.accessToken?.trim() ?? '';
        const hasWsAuthContext = this.hasWsAuthContext();

        if (!isInitialized || !this.config.enabled || !this.config.url || !hasWsAuthContext) {
          if (this.ticketDebounceTimer) {
            clearTimeout(this.ticketDebounceTimer);
            this.ticketDebounceTimer = null;
          }
          this.closeConnection();
          return;
        }

        this.scheduleTicketConnection(token || undefined);
      }
    );
  }

  init(config?: Partial<WebSocketConfig>): void {
    if (config) {
      this.config = {
        ...this.config,
        ...config,
        defaultChannels:
          config.defaultChannels && config.defaultChannels.length > 0
            ? [
                ...new Set(
                  config.defaultChannels
                    .map(channel => this.normalizeChannel(channel))
                    .filter(Boolean)
                )
              ]
            : this.config.defaultChannels
      };
      this.syncBaseChannels(this.config.defaultChannels);
    }

    this.initialized.set(true);
  }

  connect(url: string, config?: Partial<WebSocketConfig>): void {
    this.init({ url, ...config });
  }

  disconnect(): void {
    this.initialized.set(false);
    this.closeConnection();
  }

  send<T = LooseValue>(type: string, payload: T): void {
    if (!this.socket || !this.connected()) {
      this.debugRealtime('[WebSocket] Not connected. Cannot send message.');
      return;
    }

    const normalizedType = String(type ?? '')
      .trim()
      .toLowerCase();
    if (!normalizedType) {
      return;
    }

    if (normalizedType === 'ping') {
      this.sendRaw({ type: 'ping' });
      return;
    }

    if (normalizedType === 'subscribe' || normalizedType === 'unsubscribe') {
      const payloadRecord = payload as { channels?: unknown } | null;
      const channels = Array.isArray(payloadRecord?.channels)
        ? payloadRecord.channels
        : (payload as unknown[]);
      this.sendRaw({
        type: normalizedType,
        channels: this.normalizeChannels(channels)
      });
      return;
    }

    this.sendRaw({
      type: normalizedType,
      payload,
      timestamp: Date.now()
    });
  }

  on<T = LooseValue>(type: string): Observable<WebSocketMessage<T>> {
    return new Observable(observer => {
      const subscription = this.messagesSubject$.subscribe({
        next: message => {
          if (message.type === type) {
            observer.next(message as WebSocketMessage<T>);
          }
        },
        error: error => observer.error(error),
        complete: () => observer.complete()
      });

      return () => subscription.unsubscribe();
    });
  }

  onAll(): Observable<WebSocketMessage> {
    return this.messagesSubject$.asObservable();
  }

  events(): Observable<RealtimeEventPayload> {
    return new Observable(observer => {
      const subscription = this.messagesSubject$.subscribe({
        next: message => {
          const event = extractRealtimeEvent(message);
          if (event) {
            observer.next(event);
          }
        },
        error: error => observer.error(error),
        complete: () => observer.complete()
      });

      return () => subscription.unsubscribe();
    });
  }

  subscribeChannels(channels: string[]): void {
    const normalized = this.normalizeChannels(channels);
    const pending: string[] = [];

    normalized.forEach(channel => {
      if (this.baseChannels.has(channel) || this.extraChannels.has(channel)) {
        return;
      }

      this.extraChannels.add(channel);
      pending.push(channel);
    });

    if (pending.length > 0) {
      this.sendRaw({ type: 'subscribe', channels: pending });
    }
  }

  unsubscribeChannels(channels: string[]): void {
    const normalized = this.normalizeChannels(channels);
    const pending: string[] = [];

    normalized.forEach(channel => {
      if (!this.extraChannels.delete(channel)) {
        return;
      }

      pending.push(channel);
    });

    if (pending.length > 0) {
      this.sendRaw({ type: 'unsubscribe', channels: pending });
    }
  }

  onSupplierUpdate<T = LooseValue>(): Observable<WebSocketMessage<T>> {
    return this.on<T>('supplier:update');
  }

  onInventoryChange<T = LooseValue>(): Observable<WebSocketMessage<T>> {
    return this.on<T>('inventory:change');
  }

  onTenderDeadline<T = LooseValue>(): Observable<WebSocketMessage<T>> {
    return this.on<T>('tender:deadline');
  }

  onProjectUpdate<T = LooseValue>(): Observable<WebSocketMessage<T>> {
    return this.on<T>('project:update');
  }

  onNotification<T = LooseValue>(): Observable<WebSocketMessage<T>> {
    return new Observable(observer => {
      const subscription = this.messagesSubject$.subscribe({
        next: message => {
          const event = extractRealtimeEvent(message);
          if (!event || !isNotificationRealtimeEvent(event)) {
            return;
          }

          observer.next({
            type: 'notification',
            payload: event as T
          });
        },
        error: error => observer.error(error),
        complete: () => observer.complete()
      });

      return () => subscription.unsubscribe();
    });
  }

  private openConnectionWithTicket(accessToken?: string): void {
    if (this.ticketRequestInFlight) {
      return;
    }

    // Keep retrying the short-lived ticket flow instead of leaking JWTs into URLs.
    if (Date.now() < this.ticketRateLimitedUntil) {
      this.scheduleTicketRetry(this.ticketRateLimitedUntil - Date.now());
      return;
    }

    this.ticketRequestInFlight = true;
    const runtime = runtimeConfig();
    const base = (runtime.apiBaseUrl ?? environment.API_BASE_URL ?? '').replace(/\/+$/, '');
    this.http
      .get<LooseValue>(`${base}/Auth/ws-ticket`, {
        withCredentials: resolveAuthRuntimeOptions().withCredentials
      })
      .subscribe({
        next: res => {
          this.ticketRequestInFlight = false;
          const ticket: string = res?.data?.ticket ?? res?.ticket ?? '';
          if (!ticket) {
            this.handleTicketFailure(accessToken);
            return;
          }
          const url = this.appendParam(this.config.url, 'ws_ticket', ticket);
          if (!this.isActiveConnection(url)) {
            this.openConnection(url, accessToken);
          }
        },
        error: (err: { status?: number }) => {
          this.ticketRequestInFlight = false;
          // On 429, apply 60s cooldown before retrying ws-ticket
          if (err?.status === 429) {
            this.ticketRateLimitedUntil = Date.now() + 60_000;
          }
          this.handleTicketFailure(accessToken);
        }
      });
  }

  private openConnection(url: string, ticketFallbackToken?: string): void {
    if (!url) {
      return;
    }

    this.clearReconnectTimer();
    if (this.socket && this.currentUrl === url && this.socket.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.socket && this.currentUrl === url && this.socket.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.closeSocketOnly();

    this.connecting.set(true);
    this.currentUrl = url;
    const socket = new WebSocket(url);
    let opened = false;
    this.socket = socket;

    socket.addEventListener('open', () => {
      if (this.socket !== socket) {
        return;
      }

      opened = true;
      this.connected.set(true);
      this.connecting.set(false);
      this.reconnectAttempt = 0;
      this.startHeartbeat();
      this.sendChannelSubscriptions();
    });

    socket.addEventListener('message', event => {
      const parsed = this.parseMessage(event.data);
      if (parsed) {
        this.messagesSubject$.next(parsed);
      }
    });

    socket.addEventListener('error', error => {
      this.debugRealtime('[WebSocket] Connection error event.', error);
    });

    socket.addEventListener('close', () => {
      if (this.socket !== socket) {
        return;
      }

      this.connected.set(false);
      this.connecting.set(false);
      this.stopHeartbeat();
      this.socket = null;

      if (this.intentionalClosures.has(socket)) {
        this.intentionalClosures.delete(socket);
        return;
      }

      if (!opened && ticketFallbackToken && this.shouldAllowLegacyQueryTokenFallback()) {
        const fallbackUrl = this.appendToken(this.config.url, ticketFallbackToken);
        if (!this.isActiveConnection(fallbackUrl)) {
          this.openConnection(fallbackUrl);
        }
        return;
      }

      this.scheduleReconnect();
    });
  }

  private closeConnection(): void {
    this.clearReconnectTimer();
    this.closeSocketOnly();
    this.currentUrl = '';
    this.connected.set(false);
    this.connecting.set(false);
  }

  private closeSocketOnly(): void {
    this.stopHeartbeat();
    if (!this.socket) {
      return;
    }

    this.intentionalClosures.add(this.socket);
    try {
      this.socket.close();
    } catch {
      // Ignore close failures during teardown.
    }
    this.socket = null;
  }

  private scheduleReconnect(): void {
    if (
      !this.initialized() ||
      !this.config.reconnect ||
      !this.config.url ||
      !this.hasWsAuthContext()
    ) {
      return;
    }

    if (this.reconnectAttempt >= this.config.reconnectAttempts) {
      return;
    }

    this.reconnectAttempt += 1;
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      const token = this.auth.tokens()?.accessToken?.trim() ?? '';
      if (!token && !this.hasStoredCookieSession()) {
        return;
      }

      this.openConnectionWithTicket(token || undefined);
    }, this.config.reconnectInterval);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startHeartbeat(): void {
    if (this.config.heartbeatInterval <= 0) {
      return;
    }

    this.heartbeatTimer = setInterval(() => {
      this.sendRaw({ type: 'ping' });
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private sendChannelSubscriptions(): void {
    const channels = this.currentChannels();
    if (channels.length === 0) {
      return;
    }

    this.sendRaw({ type: 'subscribe', channels });
  }

  private currentChannels(): string[] {
    return [...new Set([...this.baseChannels, ...this.extraChannels])];
  }

  private syncBaseChannels(channels: string[]): void {
    this.baseChannels.clear();
    this.normalizeChannels(channels).forEach(channel => this.baseChannels.add(channel));
  }

  private sendRaw(message: Record<string, unknown>): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      this.socket.send(JSON.stringify(message));
    } catch (error) {
      console.error('[WebSocket] Failed to send message:', error);
    }
  }

  private parseMessage(raw: unknown): WebSocketMessage | null {
    if (typeof raw !== 'string') {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as LooseValue;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
      }

      const type = String(parsed.type ?? '').trim();
      if (!type) {
        return null;
      }

      return {
        type,
        payload: parsed.payload,
        timestamp:
          typeof parsed.timestamp === 'number' && Number.isFinite(parsed.timestamp)
            ? parsed.timestamp
            : undefined
      };
    } catch (error) {
      console.error('[WebSocket] Failed to parse message:', error);
      return null;
    }
  }

  private debugRealtime(message: string, ...args: unknown[]): void {
    if (environment.enableDebugLogs) {
      console.debug(message, ...args);
    }
  }

  private appendToken(url: string, token: string): string {
    return this.appendParam(url, this.config.tokenParam, token);
  }

  private scheduleTicketConnection(accessToken?: string): void {
    if (this.ticketDebounceTimer) {
      clearTimeout(this.ticketDebounceTimer);
      this.ticketDebounceTimer = null;
    }

    // Cold-start the first authenticated socket immediately, and only debounce later churn.
    if (!this.shouldDebounceTicketConnect()) {
      this.openConnectionWithTicket(accessToken);
      return;
    }

    this.ticketDebounceTimer = setTimeout(() => {
      this.ticketDebounceTimer = null;
      this.openConnectionWithTicket(accessToken);
    }, this.ticketDebounceMs);
  }

  private shouldDebounceTicketConnect(): boolean {
    return (
      this.ticketRequestInFlight ||
      !!this.reconnectTimer ||
      !!this.currentUrl ||
      !!this.socket ||
      this.connecting()
    );
  }

  private handleTicketFailure(accessToken?: string): void {
    if (this.shouldAllowLegacyQueryTokenFallback() && accessToken) {
      const url = this.appendToken(this.config.url, accessToken);
      if (!this.isActiveConnection(url)) {
        this.openConnection(url);
      }
      return;
    }

    this.scheduleTicketRetry(
      this.ticketRateLimitedUntil > Date.now()
        ? this.ticketRateLimitedUntil - Date.now()
        : this.config.reconnectInterval
    );
  }

  private scheduleTicketRetry(delayMs: number): void {
    const retryDelay = Math.max(1000, delayMs);
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      const token = this.auth.tokens()?.accessToken?.trim() ?? '';
      if (!token && !this.hasStoredCookieSession()) {
        return;
      }

      this.openConnectionWithTicket(token || undefined);
    }, retryDelay);
  }

  private hasWsAuthContext(): boolean {
    const token = this.auth.tokens()?.accessToken?.trim();
    return !!token || this.hasStoredCookieSession();
  }

  private hasStoredCookieSession(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    const storages = [window.sessionStorage, window.localStorage];
    for (const storage of storages) {
      try {
        const raw = storage.getItem(AUTH_SESSION_STORAGE_KEY);
        if (!raw) {
          continue;
        }

        const session = this.unwrapStoredSession(JSON.parse(raw) as LooseValue);
        const accessToken = this.readStoredAccessToken(session);
        const expiresAt = this.normalizeStoredExpiry(
          session?.tokens?.expiresAt ??
            session?.tokens?.expires_at ??
            session?.expiresAt ??
            session?.expires_at
        );

        if (
          typeof expiresAt === 'number' &&
          Number.isFinite(expiresAt) &&
          expiresAt <= Date.now()
        ) {
          continue;
        }

        if (session?.authMode === 'cookie' || accessToken === COOKIE_AUTH_SESSION_TOKEN) {
          return true;
        }
      } catch {
        // Ignore malformed storage records.
      }
    }

    return false;
  }

  private unwrapStoredSession(raw: LooseValue): LooseValue {
    let current: LooseValue = raw;
    for (let i = 0; i < 4; i += 1) {
      if (!current || typeof current !== 'object') {
        break;
      }

      const next = current.data ?? current.payload ?? current.result ?? current.session;
      if (!next || next === current) {
        break;
      }

      current = next;
    }

    return current;
  }

  private readStoredAccessToken(session: LooseValue): string | undefined {
    const accessToken =
      session?.tokens?.accessToken ??
      session?.tokens?.access_token ??
      session?.accessToken ??
      session?.access_token;
    return typeof accessToken === 'string' ? accessToken.trim() : undefined;
  }

  private normalizeStoredExpiry(raw: unknown): number | undefined {
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      if (raw < 1_000_000_000) {
        return Date.now() + raw * 1000;
      }

      if (raw < 1_000_000_000_000) {
        return raw * 1000;
      }

      return raw;
    }

    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed) {
        return undefined;
      }

      const asNumber = Number(trimmed);
      if (Number.isFinite(asNumber)) {
        return this.normalizeStoredExpiry(asNumber);
      }

      const parsed = Date.parse(trimmed);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }

    return undefined;
  }

  private shouldAllowLegacyQueryTokenFallback(): boolean {
    return !environment.production && !resolveAuthRuntimeOptions().useCookieAuth;
  }

  private appendParam(url: string, key: string, value: string): string {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${key}=${encodeURIComponent(value)}`;
  }

  private isActiveConnection(url: string): boolean {
    return (
      this.currentUrl === url &&
      !!this.socket &&
      (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)
    );
  }

  private normalizeChannels(channels: unknown): string[] {
    if (!Array.isArray(channels)) {
      return [];
    }

    return [...new Set(channels.map(channel => this.normalizeChannel(channel)).filter(Boolean))];
  }

  private normalizeChannel(channel: unknown): string {
    return typeof channel === 'string' ? channel.trim() : '';
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.messagesSubject$.complete();
  }
}
