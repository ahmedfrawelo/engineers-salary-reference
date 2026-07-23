import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { Observable, Subject, Subscription, forkJoin, of, throwError } from 'rxjs';
import { catchError, finalize, map, tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { ApiClient } from '@infrastructure/http/api-client.service';
import { AUTH_SESSION_FACADE, AuthSessionFacade } from '../../../core/auth/auth-session.facade';
import {
  Notification,
  NotificationCenterService,
  NotificationPageMeta,
  type NotificationStatsDelta,
  NotificationStats
} from '../../../core/notifications/notification-center.service';
import {
  ToastService,
  type ToastShowOptions,
  type ToastType
} from '../../../shared/toast/toast.service';
import {
  formatNotificationActionLabel,
  formatNotificationDisplaySubject,
  formatNotificationDisplayTitle,
  formatNotificationMessage,
  formatNotificationSubject,
  formatNotificationSummary
} from '../../../core/notifications/utils/notification-presentation.util';
import { WebSocketService } from '../realtime/websocket.service';
import { FeatureFlagsService } from '../../../core/feature-flags/feature-flags.service';
import { environment } from '../../../../environments/environment';
import { runtimeConfig } from '../../../core/runtime-config';
import {
  type RealtimeEventPayload,
  isNotificationRealtimeEvent
} from '../realtime/realtime-events';
import { resolveNotificationActionUrl } from './notification-action-url.util';

type LooseValue = ReturnType<typeof JSON.parse>;
type NotificationPriority = Notification['priority'];
type NotificationType = Notification['type'];

type NotificationRuntimeConfig = {
  apiBaseUrl?: string;
  notifications?: {
    apiBaseUrl?: string;
    listPath?: string;
    queryPath?: string;
    detailPath?: string;
    markReadPath?: string;
    markUnreadPath?: string;
    markAllReadPath?: string;
    markAllUnreadPath?: string;
    statsPath?: string;
    unreadCountPath?: string;
    archivePath?: string;
    unarchivePath?: string;
    archiveReadPath?: string;
    deletePath?: string;
    deleteArchivedPath?: string;
    wsUrl?: string;
    wsPath?: string;
    wsEnabled?: boolean;
    wsTokenParam?: string;
    fetchOnInit?: boolean;
    maxInitial?: number;
    defaultPageSize?: number;
  };
};

type NotificationConfig = {
  apiBaseUrl: string;
  listPath: string;
  queryPath: string;
  detailPath: string;
  markReadPath: string;
  markUnreadPath: string;
  markAllReadPath: string;
  markAllUnreadPath: string;
  statsPath: string;
  unreadCountPath: string;
  archivePath: string;
  unarchivePath: string;
  archiveReadPath: string;
  deletePath: string;
  deleteArchivedPath: string;
  wsUrl?: string;
  wsPath: string;
  wsEnabled: boolean;
  wsTokenParam: string;
  fetchOnInit: boolean;
  maxInitial: number;
  defaultPageSize: number;
};

type ApiEnvelope<T> = {
  data?: T;
  result?: T;
  payload?: T;
  response?: T;
  notifications?: T;
};

type BackendNotificationDto = {
  id?: number | string;
  receiverUserId?: string;
  createdByUserId?: string;
  createdByUserName?: string;
  createdByUserAvatarUrl?: string;
  subject?: string;
  summary?: string;
  title?: string;
  message?: string;
  entityType?: string;
  entityId?: number | string | null;
  notificationType?: string;
  priority?: string;
  isRead?: boolean;
  isArchived?: boolean;
  readAt?: string;
  archivedAt?: string;
  createdAt?: string;
  actionUrl?: string;
  actionLabel?: string;
  icon?: string;
  sourceModule?: string;
};

type BackendNotificationStatsDto = {
  totalCount?: number;
  activeCount?: number;
  archivedCount?: number;
  readCount?: number;
  unreadCount?: number;
};

type BackendNotificationMutationDto = {
  action?: string;
  affectedCount?: number;
  entityId?: number | string | null;
  totalDelta?: number;
  activeDelta?: number;
  archivedDelta?: number;
  readDelta?: number;
  unreadDelta?: number;
};

type ResolvedBackendNotificationMutationDto = BackendNotificationMutationDto & {
  affectedCount: number;
};

type BackendPagedResponseDto<T> = {
  items?: T[];
  totalCount?: number;
  pageNumber?: number;
  pageSize?: number;
  totalPages?: number;
  hasPreviousPage?: boolean;
  hasNextPage?: boolean;
};

export interface NotificationQueryOptions {
  pageNumber?: number;
  pageSize?: number;
  isRead?: boolean;
  includeArchived?: boolean;
  onlyArchived?: boolean;
  entityType?: string;
  entityId?: number;
  searchTerm?: string;
  createdFrom?: string;
  createdTo?: string;
}

export interface NotificationPageResult extends NotificationPageMeta {
  items: Notification[];
}

export type NotificationMailboxMutation =
  | {
      action: 'created';
      notification: Notification;
    }
  | {
      action: 'read' | 'unread' | 'archived' | 'unarchived' | 'deleted';
      notificationId: string;
    }
  | {
      action: 'bulk-read' | 'bulk-unread' | 'bulk-archived' | 'bulk-deleted';
      affectedCount: number;
    }
  | {
      action: 'reload';
    };

type SingleMailboxMutationAction = Extract<
  NotificationMailboxMutation,
  { notificationId: string }
>['action'];

type BulkMailboxMutationAction = Extract<
  NotificationMailboxMutation,
  { affectedCount: number }
>['action'];

@Injectable({ providedIn: 'root' })
export class NotificationsBridgeService implements OnDestroy {
  private static readonly NOTIFICATION_REQUEST_TIMEOUT_MS = 7_500;
  private static readonly NOTIFICATION_REQUEST_RETRIES = 0;

  private readonly api = inject(ApiClient);
  private readonly authFacade = inject<AuthSessionFacade>(AUTH_SESSION_FACADE);
  private readonly notificationCenter = inject(NotificationCenterService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly websocket = inject(WebSocketService);
  private readonly featureFlags = inject(FeatureFlagsService);

  private readonly config = this.resolveConfig();
  readonly previewPageSize = this.config.maxInitial;
  private readonly mailboxMutations$ = new Subject<NotificationMailboxMutation>();
  private subscriptions = new Subscription();
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;
  private refreshInFlight = false;
  private refreshQueued = false;
  private readonly inFlightNotificationFetches = new Set<string>();
  private readonly presentedIncomingToastIds = new Map<string, number>();
  private readonly incomingToastDedupeWindowMs = 60 * 1000;
  private readonly localMutationEchoSuppressions = new Map<string, number>();
  private readonly localMutationEchoSuppressionMs = 2500;
  private readonly _previewState = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  private readonly _previewError = signal<string | null>(null);
  private readonly _lastPreviewRefreshAt = signal<number | null>(null);

  readonly previewState = this._previewState.asReadonly();
  readonly previewError = this._previewError.asReadonly();
  readonly lastPreviewRefreshAt = this._lastPreviewRefreshAt.asReadonly();

  init(): void {
    if (this.initialized || this.initializationPromise) {
      return;
    }

    this.initializationPromise = this.initializeWhenAuthenticated().finally(() => {
      this.initializationPromise = null;
    });
  }

  private async initializeWhenAuthenticated(): Promise<void> {
    const isAuthenticated = await this.authFacade.ensureAuthenticated().catch(() => false);

    if (!isAuthenticated || this.initialized) {
      return;
    }

    this.initialized = true;

    if (this.config.fetchOnInit) {
      this.refresh();
    }

    this.connectRealtime();
  }

  reset(): void {
    this.initialized = false;
    this.initializationPromise = null;
    this.refreshInFlight = false;
    this.refreshQueued = false;
    this._previewState.set('idle');
    this._previewError.set(null);
    this._lastPreviewRefreshAt.set(null);
    this.inFlightNotificationFetches.clear();
    this.presentedIncomingToastIds.clear();
    this.localMutationEchoSuppressions.clear();

    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer);
      this.reloadTimer = null;
    }

    this.websocket.disconnect();
    this.subscriptions.unsubscribe();
    this.subscriptions = new Subscription();
  }

  ngOnDestroy(): void {
    this.reset();
  }

  refresh(): void {
    if (this.refreshInFlight) {
      this.refreshQueued = true;
      return;
    }

    this.refreshInFlight = true;
    this._previewState.set('loading');
    this._previewError.set(null);
    const refreshSubscription = forkJoin({
      preview: this.query$({
        pageNumber: 1,
        pageSize: this.config.maxInitial,
        includeArchived: false,
        onlyArchived: false
      }).pipe(
        tap(result => {
          this.notificationCenter.replaceAll(result.items);
          this.notificationCenter.syncPageMeta(result);
          this._previewState.set('ready');
          this._previewError.set(null);
          this._lastPreviewRefreshAt.set(Date.now());
        }),
        catchError(error => {
          this._previewState.set('error');
          this._previewError.set(this.resolveRefreshErrorMessage(error));
          return of(null);
        })
      ),
      stats: this.getStats$().pipe(
        tap(stats => this.notificationCenter.syncStats(stats)),
        catchError(() => {
          this.notificationCenter.syncStats(null);
          return of(null);
        })
      )
    })
      .pipe(finalize(() => this.finishRefresh()))
      .subscribe();

    this.subscriptions.add(refreshSubscription);
  }

  ensureFreshPreview(options?: {
    force?: boolean;
    maxAgeMs?: number;
  }): void {
    if (options?.force) {
      this.refresh();
      return;
    }

    if (this.refreshInFlight) {
      return;
    }

    const maxAgeMs = Math.max(0, options?.maxAgeMs ?? 45_000);
    const previewState = this._previewState();
    const lastRefreshAt = this._lastPreviewRefreshAt();

    if (
      previewState === 'idle' ||
      previewState === 'error' ||
      lastRefreshAt === null ||
      Date.now() - lastRefreshAt >= maxAgeMs
    ) {
      this.refresh();
    }
  }

  private finishRefresh(): void {
    this.refreshInFlight = false;
    if (!this.refreshQueued) {
      return;
    }

    this.refreshQueued = false;
    this.refresh();
  }

  query$(query: NotificationQueryOptions = {}): Observable<NotificationPageResult> {
    const params = this.toQueryParams(query);
    const pageNumber = query.pageNumber ?? 1;
    const pageSize = query.pageSize ?? this.config.defaultPageSize;
    const [primaryPath, ...fallbackPaths] = this.buildNotificationQueryPaths();
    if (!primaryPath) {
      return throwError(() => new Error('Notification query path is not configured.'));
    }

    return this.fetchNotificationPageWithFallback$(
      primaryPath,
      fallbackPaths,
      params,
      pageNumber,
      pageSize
    );
  }

  getStats$(): Observable<NotificationStats> {
    return this.api
      .get<unknown>(this.config.statsPath, undefined, this.getNotificationRequestOptions())
      .pipe(map(response => this.extractStats(response)));
  }

  getUnreadCount$(): Observable<number> {
    return this.api
      .get<unknown>(this.config.unreadCountPath, undefined, this.getNotificationRequestOptions())
      .pipe(map(response => this.extractUnreadCount(response)));
  }

  getById$(id: string): Observable<Notification | null> {
    if (!id) {
      return of(null);
    }

    return this.api
      .get<unknown>(
        this.resolvePath(this.config.detailPath, id),
        undefined,
        this.getNotificationRequestOptions()
      )
      .pipe(
      map(response => this.extractEnvelopeData<BackendNotificationDto>(response)),
      map(notification => (notification ? this.mapNotification(notification) : null))
      );
  }

  markRead(id: string): void {
    const subscription = this.markRead$(id).subscribe({
      error: () => {
        this.refresh();
      }
    });
    this.subscriptions.add(subscription);
  }

  markRead$(id: string): Observable<void> {
    if (!id) {
      return of(void 0);
    }

    const previousStats = this.notificationCenter.getStats();
    const previousPageMeta = this.notificationCenter.getPageMeta();
    this.applyKnownLocalMutation(id, currentId =>
      this.notificationCenter.markAsRead(currentId)
    );
    return this.api.put<unknown>(this.resolvePath(this.config.markReadPath, id), {}).pipe(
      tap(response => {
        this.reconcileMutationResult(
          response,
          previousStats,
          previousPageMeta,
          this.buildOptimisticStatsDelta(previousStats),
          { action: 'read', entityId: id }
        );
        this.emitLocalMailboxMutation({ action: 'read', notificationId: id });
      }),
      map(() => void 0),
      catchError(error => {
        this.refresh();
        return throwError(() => error);
        })
      );
  }

  mailboxEvents$(): Observable<NotificationMailboxMutation> {
    return this.mailboxMutations$.asObservable();
  }

  markUnread$(id: string): Observable<void> {
    if (!id) {
      return of(void 0);
    }

    const previousStats = this.notificationCenter.getStats();
    const previousPageMeta = this.notificationCenter.getPageMeta();
    this.applyKnownLocalMutation(id, currentId =>
      this.notificationCenter.markAsUnread(currentId)
    );
    return this.api.put<unknown>(this.resolvePath(this.config.markUnreadPath, id), {}).pipe(
      tap(response => {
        this.reconcileMutationResult(
          response,
          previousStats,
          previousPageMeta,
          this.buildOptimisticStatsDelta(previousStats),
          { action: 'unread', entityId: id }
        );
        this.emitLocalMailboxMutation({ action: 'unread', notificationId: id });
      }),
      map(() => void 0),
      catchError(error => {
        this.refresh();
        return throwError(() => error);
      })
    );
  }

  markAllRead(): void {
    const subscription = this.markAllRead$().subscribe({
      error: () => {
        this.refresh();
      }
    });
    this.subscriptions.add(subscription);
  }

  markAllRead$(): Observable<void> {
    const previousStats = this.notificationCenter.getStats();
    const previousPageMeta = this.notificationCenter.getPageMeta();
    this.notificationCenter.markAllAsRead();
    return this.api.put<unknown>(this.config.markAllReadPath, {}).pipe(
      tap(response => {
        const mutation = this.reconcileMutationResult(
          response,
          previousStats,
          previousPageMeta,
          this.buildOptimisticStatsDelta(previousStats),
          { action: 'bulk-read' }
        );
        this.emitLocalMailboxMutation({
          action: 'bulk-read',
          affectedCount: mutation.affectedCount
        });
      }),
      map(() => void 0),
      catchError(error => {
        this.refresh();
        return throwError(() => error);
      })
    );
  }

  markAllUnread$(): Observable<void> {
    const previousStats = this.notificationCenter.getStats();
    const previousPageMeta = this.notificationCenter.getPageMeta();
    this.notificationCenter.markAllAsUnread();
    return this.api.put<unknown>(this.config.markAllUnreadPath, {}).pipe(
      tap(response => {
        const mutation = this.reconcileMutationResult(
          response,
          previousStats,
          previousPageMeta,
          this.buildOptimisticStatsDelta(previousStats),
          { action: 'bulk-unread' }
        );
        this.emitLocalMailboxMutation({
          action: 'bulk-unread',
          affectedCount: mutation.affectedCount
        });
      }),
      map(() => void 0),
      catchError(error => {
        this.refresh();
        return throwError(() => error);
      })
    );
  }

  archive$(id: string): Observable<void> {
    if (!id) {
      return of(void 0);
    }

    const previousStats = this.notificationCenter.getStats();
    const previousPageMeta = this.notificationCenter.getPageMeta();
    this.applyKnownLocalMutation(id, currentId =>
      this.notificationCenter.archive(currentId)
    );
    return this.api.put<unknown>(this.resolvePath(this.config.archivePath, id), {}).pipe(
      tap(response => {
        this.reconcileMutationResult(
          response,
          previousStats,
          previousPageMeta,
          this.buildOptimisticStatsDelta(previousStats),
          { action: 'archived', entityId: id }
        );
        this.emitLocalMailboxMutation({ action: 'archived', notificationId: id });
      }),
      map(() => void 0),
      catchError(error => {
        this.refresh();
        return throwError(() => error);
      })
    );
  }

  unarchive$(id: string): Observable<void> {
    if (!id) {
      return of(void 0);
    }

    const previousStats = this.notificationCenter.getStats();
    const previousPageMeta = this.notificationCenter.getPageMeta();
    this.applyKnownLocalMutation(id, currentId =>
      this.notificationCenter.unarchive(currentId)
    );
    return this.api.put<unknown>(this.resolvePath(this.config.unarchivePath, id), {}).pipe(
      tap(response => {
        this.reconcileMutationResult(
          response,
          previousStats,
          previousPageMeta,
          this.buildOptimisticStatsDelta(previousStats),
          { action: 'unarchived', entityId: id }
        );
        this.emitLocalMailboxMutation({ action: 'unarchived', notificationId: id });
      }),
      map(() => void 0),
      catchError(error => {
        this.refresh();
        return throwError(() => error);
      })
    );
  }

  archiveRead$(): Observable<void> {
    const previousStats = this.notificationCenter.getStats();
    const previousPageMeta = this.notificationCenter.getPageMeta();
    this.notificationCenter.archiveRead();
    return this.api.put<unknown>(this.config.archiveReadPath, {}).pipe(
      tap(response => {
        const mutation = this.reconcileMutationResult(
          response,
          previousStats,
          previousPageMeta,
          this.buildOptimisticStatsDelta(previousStats),
          { action: 'bulk-archived' }
        );
        this.emitLocalMailboxMutation({
          action: 'bulk-archived',
          affectedCount: mutation.affectedCount
        });
      }),
      map(() => void 0),
      catchError(error => {
        this.refresh();
        return throwError(() => error);
      })
    );
  }

  delete$(id: string): Observable<void> {
    if (!id) {
      return of(void 0);
    }

    const previousStats = this.notificationCenter.getStats();
    const previousPageMeta = this.notificationCenter.getPageMeta();
    this.applyKnownLocalMutation(id, currentId =>
      this.notificationCenter.delete(currentId)
    );
    return this.api.delete<unknown>(this.resolvePath(this.config.deletePath, id)).pipe(
      tap(response => {
        this.reconcileMutationResult(
          response,
          previousStats,
          previousPageMeta,
          this.buildOptimisticStatsDelta(previousStats),
          { action: 'deleted', entityId: id }
        );
        this.emitLocalMailboxMutation({ action: 'deleted', notificationId: id });
      }),
      map(() => void 0),
      catchError(error => {
        this.refresh();
        return throwError(() => error);
      })
    );
  }

  deleteArchived$(): Observable<void> {
    const previousStats = this.notificationCenter.getStats();
    const previousPageMeta = this.notificationCenter.getPageMeta();
    this.notificationCenter.deleteArchived();
    return this.api.delete<unknown>(this.config.deleteArchivedPath).pipe(
      tap(response => {
        const mutation = this.reconcileMutationResult(
          response,
          previousStats,
          previousPageMeta,
          this.buildOptimisticStatsDelta(previousStats),
          { action: 'bulk-deleted' }
        );
        this.emitLocalMailboxMutation({
          action: 'bulk-deleted',
          affectedCount: mutation.affectedCount
        });
      }),
      map(() => void 0),
      catchError(error => {
        this.refresh();
        return throwError(() => error);
      })
    );
  }

  private reconcileMutationResult(
    response: unknown,
    previousStats: NotificationStats,
    previousPageMeta: NotificationPageMeta,
    fallbackDelta: NotificationStatsDelta,
    fallback: {
      action: string;
      entityId?: string;
    }
  ): ResolvedBackendNotificationMutationDto {
    const mutation = this.extractMutationResult(response, fallbackDelta, fallback);
    this.notificationCenter.reconcileStats(previousStats, previousPageMeta, {
      total: mutation.totalDelta ?? fallbackDelta.total,
      active: mutation.activeDelta ?? fallbackDelta.active,
      archived: mutation.archivedDelta ?? fallbackDelta.archived,
      read: mutation.readDelta ?? fallbackDelta.read,
      unread: mutation.unreadDelta ?? fallbackDelta.unread
    });
    return mutation;
  }

  private extractMutationResult(
    response: unknown,
    fallbackDelta: NotificationStatsDelta,
    fallback: {
      action: string;
      entityId?: string;
    }
  ): ResolvedBackendNotificationMutationDto {
    const raw = this.extractEnvelopeData<BackendNotificationMutationDto>(response);
    const record = this.asRecord(raw);
    const inferredAffectedCount = this.inferAffectedCountFromDelta(fallbackDelta);

    if (!record) {
      return {
        action: fallback.action,
        affectedCount: inferredAffectedCount,
        entityId: fallback.entityId ?? null,
        totalDelta: fallbackDelta.total,
        activeDelta: fallbackDelta.active,
        archivedDelta: fallbackDelta.archived,
        readDelta: fallbackDelta.read,
        unreadDelta: fallbackDelta.unread
      };
    }

    return {
      action: this.pickString(record['action']) || fallback.action,
      affectedCount: this.normalizeCount(record['affectedCount']) || inferredAffectedCount,
      entityId:
        this.normalizeEntityId(record['entityId']) ??
        this.normalizeEntityId(fallback.entityId) ??
        null,
      totalDelta: this.normalizeSignedCount(record['totalDelta'], fallbackDelta.total),
      activeDelta: this.normalizeSignedCount(record['activeDelta'], fallbackDelta.active),
      archivedDelta: this.normalizeSignedCount(record['archivedDelta'], fallbackDelta.archived),
      readDelta: this.normalizeSignedCount(record['readDelta'], fallbackDelta.read),
      unreadDelta: this.normalizeSignedCount(record['unreadDelta'], fallbackDelta.unread)
    };
  }

  private buildOptimisticStatsDelta(previousStats: NotificationStats): NotificationStatsDelta {
    const currentStats = this.notificationCenter.getStats();
    return {
      total: currentStats.total - previousStats.total,
      active: currentStats.active - previousStats.active,
      archived: currentStats.archived - previousStats.archived,
      read: currentStats.read - previousStats.read,
      unread: currentStats.unread - previousStats.unread
    };
  }

  private inferAffectedCountFromDelta(delta: NotificationStatsDelta): number {
    return Math.max(
      Math.abs(delta.total),
      Math.abs(delta.active),
      Math.abs(delta.archived),
      Math.abs(delta.read),
      Math.abs(delta.unread)
    );
  }

  private applyKnownLocalMutation(
    notificationId: string,
    mutation: (notificationId: string) => void
  ): boolean {
    if (!this.notificationCenter.getById(notificationId)) {
      return false;
    }

    mutation(notificationId);
    return true;
  }

  private connectRealtime(): void {
    const wsUrl = this.resolveWsUrl();
    this.websocket.init({
      url: wsUrl ?? '',
      enabled: this.config.wsEnabled && !!wsUrl,
      tokenParam: this.config.wsTokenParam,
      reconnect: true,
      reconnectAttempts: 10,
      reconnectInterval: 2500,
      heartbeatInterval: 30000
    });

    const subscription = this.websocket.events().subscribe({
      next: event => {
        if (isNotificationRealtimeEvent(event)) {
          this.handleRealtimeNotificationEvent(event);
        }
      }
    });

    this.subscriptions.add(subscription);
  }

  private resolveConfig(): NotificationConfig {
    const runtime = runtimeConfig() as NotificationRuntimeConfig;
    const envNotifications = (
      environment as { notifications?: NotificationRuntimeConfig['notifications'] }
    ).notifications;
    const runtimeNotifications = runtime.notifications ?? {};

    return {
      apiBaseUrl:
        runtimeNotifications.apiBaseUrl ?? runtime.apiBaseUrl ?? environment.API_BASE_URL ?? '',
      listPath:
        runtimeNotifications.listPath ?? envNotifications?.listPath ?? 'Notifications',
      queryPath:
        runtimeNotifications.queryPath ?? envNotifications?.queryPath ?? 'Notifications/query',
      detailPath:
        runtimeNotifications.detailPath ?? envNotifications?.detailPath ?? 'Notifications/:id',
      markReadPath:
        runtimeNotifications.markReadPath ??
        envNotifications?.markReadPath ??
        'Notifications/:id/read',
      markUnreadPath:
        runtimeNotifications.markUnreadPath ??
        envNotifications?.markUnreadPath ??
        'Notifications/:id/unread',
      markAllReadPath:
        runtimeNotifications.markAllReadPath ??
        envNotifications?.markAllReadPath ??
        'Notifications/read-all',
      markAllUnreadPath:
        runtimeNotifications.markAllUnreadPath ??
        envNotifications?.markAllUnreadPath ??
        'Notifications/unread-all',
      statsPath:
        runtimeNotifications.statsPath ?? envNotifications?.statsPath ?? 'Notifications/stats',
      unreadCountPath:
        runtimeNotifications.unreadCountPath ??
        envNotifications?.unreadCountPath ??
        'Notifications/unread-count',
      archivePath:
        runtimeNotifications.archivePath ??
        envNotifications?.archivePath ??
        'Notifications/:id/archive',
      unarchivePath:
        runtimeNotifications.unarchivePath ??
        envNotifications?.unarchivePath ??
        'Notifications/:id/unarchive',
      archiveReadPath:
        runtimeNotifications.archiveReadPath ??
        envNotifications?.archiveReadPath ??
        'Notifications/archive-read',
      deletePath:
        runtimeNotifications.deletePath ?? envNotifications?.deletePath ?? 'Notifications/:id',
      deleteArchivedPath:
        runtimeNotifications.deleteArchivedPath ??
        envNotifications?.deleteArchivedPath ??
        'Notifications/archived',
      wsUrl: runtimeNotifications.wsUrl ?? envNotifications?.wsUrl ?? '',
      wsPath: runtimeNotifications.wsPath ?? envNotifications?.wsPath ?? '/ws',
      wsEnabled:
        runtimeNotifications.wsEnabled ??
        envNotifications?.wsEnabled ??
        this.featureFlags.isEnabled('websocket-updates') ??
        true,
      wsTokenParam:
        runtimeNotifications.wsTokenParam ?? envNotifications?.wsTokenParam ?? 'access_token',
      fetchOnInit: runtimeNotifications.fetchOnInit ?? envNotifications?.fetchOnInit ?? true,
      maxInitial: this.normalizeCount(
        runtimeNotifications.maxInitial ?? envNotifications?.maxInitial ?? 100
      ),
      defaultPageSize: this.normalizeCount(
        runtimeNotifications.defaultPageSize ?? envNotifications?.defaultPageSize ?? 20
      )
    };
  }

  private resolveWsUrl(): string | null {
    const explicit = this.config.wsUrl?.trim();
    if (explicit) {
      return explicit;
    }

    const wsPath = this.normalizeWsPath(this.config.wsPath);
    const base = (this.config.apiBaseUrl ?? '').trim();
    if (!base) {
      return this.resolveRelativeWsUrl(wsPath);
    }

    if (/^wss?:\/\//i.test(base)) {
      return base;
    }

    if (/^https?:\/\//i.test(base)) {
      try {
        const url = new URL(base);
        const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${url.host}${wsPath}`;
      } catch {
        return null;
      }
    }

    return this.resolveRelativeWsUrl(wsPath);
  }

  private resolveRelativeWsUrl(wsPath: string): string | null {
    if (typeof window === 'undefined' || !window.location?.origin) {
      return null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}${wsPath}`;
  }

  private normalizeWsPath(path: string): string {
    if (!path) {
      return '/ws';
    }

    return path.startsWith('/') ? path : `/${path}`;
  }

  private queueRealtimeReload(): void {
    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer);
    }

    this.reloadTimer = setTimeout(() => {
      this.reloadTimer = null;
      this.emitMailboxMutation({ action: 'reload' });
      this.refresh();
    }, 250);
  }

  private handleRealtimeNotificationEvent(event: RealtimeEventPayload): void {
    const action = this.pickString(event.action).toLowerCase();
    const notificationId = this.pickString(event.entityId);
    const affectedCount = this.extractAffectedCount(event.data);

    if (this.shouldIgnoreRealtimeEcho(action, notificationId, affectedCount)) {
      return;
    }

    if (action === 'created' && notificationId) {
      if (this.tryUpsertRealtimeNotification(event, notificationId)) {
        return;
      }

      if (this.notificationCenter.getById(notificationId)) {
        return;
      }

      this.fetchIncomingNotification(notificationId);
      return;
    }

    if (notificationId && this.applyKnownRealtimeMutation(action, notificationId, event.data)) {
      return;
    }

    if (this.applyBulkRealtimeMutation(action, event.data, affectedCount)) {
      return;
    }

    this.queueRealtimeReload();
  }

  private tryUpsertRealtimeNotification(
    event: RealtimeEventPayload,
    notificationId: string
  ): boolean {
    const data = this.asRecord(event.data);
    if (!data) {
      return false;
    }

    const realtimeNotificationId =
      typeof data['id'] === 'number' || typeof data['id'] === 'string'
        ? data['id']
        : notificationId;
    const createdByUserId = this.pickString(data['createdByUserId'], event.initiatedByUserId);
    const createdByUserName = this.pickString(
      data['createdByUserName'],
      event.initiatedByUserName
    );
    const sourceModule = this.pickString(data['sourceModule'], event.module);
    const notification = this.mapNotification({
      ...(data as BackendNotificationDto),
      id: realtimeNotificationId,
      ...(createdByUserId ? { createdByUserId } : {}),
      ...(createdByUserName ? { createdByUserName } : {}),
      ...(sourceModule ? { sourceModule } : {})
    });
    if (!notification) {
      return false;
    }

    const wasKnown = !!this.notificationCenter.getById(notification.id);
    const previousStats = this.notificationCenter.getStats();
    const previousPageMeta = this.notificationCenter.getPageMeta();
    this.notificationCenter.mergeServerNotificationsPage([notification]);
    if (!wasKnown) {
      this.reconcileRealtimeMutationResult(
        event.data,
        previousStats,
        previousPageMeta,
        {
          action: 'created',
          entityId: notification.id
        },
        this.buildCreatedNotificationStatsDelta(notification)
      );
    }
    if (!wasKnown) {
      this.emitMailboxMutation({
        action: 'created',
        notification
      });
    }

    if (
      !wasKnown &&
      !notification.read &&
      !notification.isArchived &&
      this.shouldPresentIncomingToast(notification) &&
      !this.wasIncomingToastRecentlyPresented(notification)
    ) {
      this.markIncomingToastPresented(notification);
      this.presentIncomingNotificationToast(notification);
    }

    return true;
  }

  private applyKnownRealtimeMutation(
    action: string,
    notificationId: string,
    payload: unknown
  ): boolean {
    const previousStats = this.notificationCenter.getStats();
    const previousPageMeta = this.notificationCenter.getPageMeta();
    const reconcileAndEmit = (knownAction: SingleMailboxMutationAction): boolean => {
      this.reconcileRealtimeMutationResult(payload, previousStats, previousPageMeta, {
        action: knownAction,
        entityId: notificationId
      });
      this.emitMailboxMutation({ action: knownAction, notificationId });
      return true;
    };

    switch (action) {
      case 'read':
        this.applyKnownLocalMutation(notificationId, currentId =>
          this.notificationCenter.markAsRead(currentId)
        );
        return reconcileAndEmit('read');
      case 'unread':
        this.applyKnownLocalMutation(notificationId, currentId =>
          this.notificationCenter.markAsUnread(currentId)
        );
        return reconcileAndEmit('unread');
      case 'archived':
        this.applyKnownLocalMutation(notificationId, currentId =>
          this.notificationCenter.archive(currentId)
        );
        return reconcileAndEmit('archived');
      case 'unarchived':
        this.applyKnownLocalMutation(notificationId, currentId =>
          this.notificationCenter.unarchive(currentId)
        );
        return reconcileAndEmit('unarchived');
      case 'deleted':
        this.applyKnownLocalMutation(notificationId, currentId =>
          this.notificationCenter.delete(currentId)
        );
        return reconcileAndEmit('deleted');
      default:
        return false;
    }
  }

  private applyBulkRealtimeMutation(
    action: string,
    payload: unknown,
    fallbackAffectedCount: number
  ): boolean {
    const previousStats = this.notificationCenter.getStats();
    const previousPageMeta = this.notificationCenter.getPageMeta();
    const reconcileAndEmit = (knownAction: BulkMailboxMutationAction): boolean => {
      const mutation = this.reconcileRealtimeMutationResult(
        payload,
        previousStats,
        previousPageMeta,
        { action: knownAction }
      );
      this.emitMailboxMutation({
        action: knownAction,
        affectedCount: mutation.affectedCount || Math.max(0, fallbackAffectedCount)
      });
      return true;
    };

    switch (action) {
      case 'bulk-read':
        this.notificationCenter.markAllAsRead();
        return reconcileAndEmit('bulk-read');
      case 'bulk-unread':
        this.notificationCenter.markAllAsUnread();
        return reconcileAndEmit('bulk-unread');
      case 'bulk-archived':
        this.notificationCenter.archiveRead();
        return reconcileAndEmit('bulk-archived');
      case 'bulk-deleted':
        this.notificationCenter.deleteArchived();
        return reconcileAndEmit('bulk-deleted');
      default:
        return false;
    }
  }

  private fetchIncomingNotification(notificationId: string): void {
    if (this.inFlightNotificationFetches.has(notificationId)) {
      return;
    }

    this.inFlightNotificationFetches.add(notificationId);
    const wasKnown = !!this.notificationCenter.getById(notificationId);
    const subscription = this.getById$(notificationId)
      .pipe(
        tap(notification => {
          if (!notification) {
            this.queueRealtimeReload();
            return;
          }

          this.notificationCenter.upsert(notification);
          if (!wasKnown) {
            this.emitMailboxMutation({
              action: 'created',
              notification
            });
          }

          if (
            !wasKnown &&
            !notification.read &&
            !notification.isArchived &&
            this.shouldPresentIncomingToast(notification) &&
            !this.wasIncomingToastRecentlyPresented(notification)
          ) {
            this.markIncomingToastPresented(notification);
            this.presentIncomingNotificationToast(notification);
          }
        }),
        catchError(() => {
          this.queueRealtimeReload();
          return of(null);
        }),
        finalize(() => {
          this.inFlightNotificationFetches.delete(notificationId);
        })
      )
      .subscribe();

    this.subscriptions.add(subscription);
  }

  private extractAffectedCount(data: RealtimeEventPayload['data']): number {
    const record = this.asRecord(data);
    const rawCount = record?.['affectedCount'];
    if (typeof rawCount === 'number') {
      return Number.isFinite(rawCount) ? Math.max(0, Math.trunc(rawCount)) : 0;
    }

    if (typeof rawCount === 'string') {
      const parsed = Number(rawCount);
      return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
    }

    if (!record) {
      return 0;
    }

    return this.inferAffectedCountFromDelta({
      total: this.normalizeSignedCount(record['totalDelta']),
      active: this.normalizeSignedCount(record['activeDelta']),
      archived: this.normalizeSignedCount(record['archivedDelta']),
      read: this.normalizeSignedCount(record['readDelta']),
      unread: this.normalizeSignedCount(record['unreadDelta'])
    });
  }

  private reconcileRealtimeMutationResult(
    response: unknown,
    previousStats: NotificationStats,
    previousPageMeta: NotificationPageMeta,
    fallback: {
      action: string;
      entityId?: string;
    },
    fallbackDelta = this.buildOptimisticStatsDelta(previousStats)
  ): ResolvedBackendNotificationMutationDto {
    return this.reconcileMutationResult(
      response,
      previousStats,
      previousPageMeta,
      fallbackDelta,
      fallback
    );
  }

  private buildCreatedNotificationStatsDelta(notification: Notification): NotificationStatsDelta {
    const isArchived = notification.isArchived;
    const isRead = notification.read;

    return {
      total: 1,
      active: isArchived ? 0 : 1,
      archived: isArchived ? 1 : 0,
      read: !isArchived && isRead ? 1 : 0,
      unread: !isArchived && !isRead ? 1 : 0
    };
  }

  private shouldIgnoreRealtimeEcho(
    action: string,
    notificationId: string,
    affectedCount: number
  ): boolean {
    const key = this.buildMailboxMutationKey(action, notificationId, affectedCount);
    if (!key) {
      return false;
    }

    const recordedAt = this.localMutationEchoSuppressions.get(key);
    if (typeof recordedAt !== 'number') {
      return false;
    }

    if (Date.now() - recordedAt <= this.localMutationEchoSuppressionMs) {
      this.localMutationEchoSuppressions.delete(key);
      return true;
    }

    this.localMutationEchoSuppressions.delete(key);
    return false;
  }

  private emitLocalMailboxMutation(event: Exclude<NotificationMailboxMutation, { action: 'created' | 'reload' }>): void {
    const key =
      'notificationId' in event
        ? this.buildMailboxMutationKey(event.action, event.notificationId, 0)
        : this.buildMailboxMutationKey(event.action, '', event.affectedCount);
    if (key) {
      this.localMutationEchoSuppressions.set(key, Date.now());
      this.pruneLocalMailboxMutationEchoSuppressions();
    }

    this.emitMailboxMutation(event);
  }

  private buildMailboxMutationKey(
    action: string,
    notificationId: string,
    affectedCount: number
  ): string | null {
    if (
      action === 'read' ||
      action === 'unread' ||
      action === 'archived' ||
      action === 'unarchived' ||
      action === 'deleted'
    ) {
      return notificationId ? `${action}:${notificationId}` : null;
    }

    if (
      action === 'bulk-read' ||
      action === 'bulk-unread' ||
      action === 'bulk-archived' ||
      action === 'bulk-deleted'
    ) {
      return `${action}:${Math.max(0, affectedCount)}`;
    }

    return null;
  }

  private pruneLocalMailboxMutationEchoSuppressions(): void {
    const cutoff = Date.now() - this.localMutationEchoSuppressionMs;
    for (const [key, recordedAt] of this.localMutationEchoSuppressions) {
      if (recordedAt < cutoff) {
        this.localMutationEchoSuppressions.delete(key);
      }
    }
  }

  private emitMailboxMutation(event: NotificationMailboxMutation): void {
    this.mailboxMutations$.next(event);
  }

  private presentIncomingNotificationToast(notification: Notification): void {
    const title = this.pickString(formatNotificationDisplayTitle(notification));
    const subject = this.pickString(formatNotificationDisplaySubject(notification));
    const detail = this.pickString(formatNotificationMessage(notification));
    const description = [subject, detail].filter(Boolean).join('. ');
    const primaryText = title || description;
    if (!primaryText) {
      return;
    }

    const target = this.pickString(notification.actionUrl) || '/account/notifications';
    const actionLabel = formatNotificationActionLabel(notification.actionLabel, notification);
    const options: ToastShowOptions = {
      duration: 7000,
      action: {
        label: actionLabel,
        onClick: () => this.openNotificationTarget(target)
      }
    };

    if (title && description && !this.hasSameToastCopy(title, description)) {
      this.showToastVariant(this.mapToastType(notification.type), title, {
        ...options,
        description
      });
      return;
    }

    this.showToastVariant(this.mapToastType(notification.type), primaryText, options);
  }

  private shouldPresentIncomingToast(notification: Notification): boolean {
    const sourceModule = this.normalizeEntityTypeKey(notification.sourceModule ?? '');
    return !(
      notification.type === 'system' &&
      (sourceModule === 'identity' || sourceModule === 'auth')
    );
  }

  private wasIncomingToastRecentlyPresented(notification: Notification): boolean {
    const presentedAt = this.presentedIncomingToastIds.get(notification.id);
    if (typeof presentedAt !== 'number') {
      return false;
    }

    if (Date.now() - presentedAt <= this.incomingToastDedupeWindowMs) {
      return true;
    }

    this.presentedIncomingToastIds.delete(notification.id);
    return false;
  }

  private markIncomingToastPresented(notification: Notification): void {
    this.presentedIncomingToastIds.set(notification.id, Date.now());

    if (this.presentedIncomingToastIds.size <= this.config.maxInitial * 2) {
      return;
    }

    const cutoff = Date.now() - this.incomingToastDedupeWindowMs;
    for (const [id, presentedAt] of this.presentedIncomingToastIds) {
      if (presentedAt < cutoff) {
        this.presentedIncomingToastIds.delete(id);
      }
    }
  }

  private openNotificationTarget(target: string): void {
    if (!target) {
      return;
    }

    if (typeof window !== 'undefined' && /^https?:\/\//i.test(target)) {
      window.open(target, '_blank', 'noopener,noreferrer');
      return;
    }

    const normalized = target.startsWith('/') ? target : `/${target}`;
    void this.router.navigateByUrl(normalized);
  }

  private extractPageResult(
    payload: unknown,
    fallbackPageNumber: number,
    fallbackPageSize: number
  ): NotificationPageResult {
    const data = this.extractEnvelopeData<
      BackendPagedResponseDto<BackendNotificationDto> | BackendNotificationDto[]
    >(payload);
    const record = this.asRecord(data);
    const itemsRaw = this.extractNotificationArray(data);
    const allItems = itemsRaw
      .map(item => this.mapNotification(item))
      .filter((item): item is Notification => !!item);
    const shouldClientPaginate =
      Array.isArray(data) ||
      (Array.isArray(record?.['items']) && !this.normalizeCount(record?.['totalCount']));

    const pageSize =
      this.normalizeCount(record?.['pageSize']) ||
      Math.max(1, fallbackPageSize || allItems.length || 1);
    const totalCount = this.normalizeCount(record?.['totalCount']) || allItems.length;
    const pageNumber =
      this.normalizeCount(record?.['pageNumber']) || Math.max(1, fallbackPageNumber);
    const totalPages =
      this.normalizeCount(record?.['totalPages']) || Math.max(1, Math.ceil(totalCount / pageSize));
    const items = shouldClientPaginate
      ? this.sliceNotificationPage(allItems, pageNumber, pageSize)
      : allItems;

    return {
      items,
      totalCount,
      pageNumber,
      pageSize,
      totalPages,
      hasPreviousPage:
        typeof record?.['hasPreviousPage'] === 'boolean'
          ? (record['hasPreviousPage'] as boolean)
          : pageNumber > 1,
      hasNextPage:
        typeof record?.['hasNextPage'] === 'boolean'
          ? (record['hasNextPage'] as boolean)
          : pageNumber < totalPages
    };
  }

  private fetchNotificationPage$(
    path: string,
    params: Record<string, string | number | boolean>,
    pageNumber: number,
    pageSize: number
  ): Observable<NotificationPageResult> {
    return this.api.get<unknown>(path, params, this.getNotificationRequestOptions()).pipe(
      map(response => this.extractPageResult(response, pageNumber, pageSize))
    );
  }

  private fetchNotificationPageWithFallback$(
    path: string,
    fallbackPaths: string[],
    params: Record<string, string | number | boolean>,
    pageNumber: number,
    pageSize: number
  ): Observable<NotificationPageResult> {
    return this.fetchNotificationPage$(path, params, pageNumber, pageSize).pipe(
      catchError(error => {
        const [nextPath, ...remainingPaths] = fallbackPaths;
        if (!nextPath) {
          return throwError(() => error);
        }

        return this.fetchNotificationPageWithFallback$(
          nextPath,
          remainingPaths,
          params,
          pageNumber,
          pageSize
        );
      })
    );
  }

  private buildNotificationQueryPaths(): string[] {
    const orderedPaths = [
      this.config.queryPath,
      this.config.listPath,
      'Notifications/paged',
      'Notifications'
    ];

    return orderedPaths.filter(
      (path, index): path is string => !!path && orderedPaths.indexOf(path) === index
    );
  }

  private getNotificationRequestOptions(): {
    timeoutMs: number;
    retries: number;
  } {
    return {
      timeoutMs: NotificationsBridgeService.NOTIFICATION_REQUEST_TIMEOUT_MS,
      retries: NotificationsBridgeService.NOTIFICATION_REQUEST_RETRIES
    };
  }

  private sliceNotificationPage(
    items: Notification[],
    pageNumber: number,
    pageSize: number
  ): Notification[] {
    const start = Math.max(0, (Math.max(1, pageNumber) - 1) * Math.max(1, pageSize));
    return items.slice(start, start + Math.max(1, pageSize));
  }

  private extractStats(payload: unknown): NotificationStats {
    const data = this.extractEnvelopeData<BackendNotificationStatsDto>(payload);
    return {
      total: this.normalizeCount(data?.totalCount),
      active: this.normalizeCount(data?.activeCount),
      archived: this.normalizeCount(data?.archivedCount),
      read: this.normalizeCount(data?.readCount),
      unread: this.normalizeCount(data?.unreadCount)
    };
  }

  private extractUnreadCount(payload: unknown): number {
    const data = this.extractEnvelopeData<number | string | Record<string, unknown>>(payload);

    if (typeof data === 'number' || typeof data === 'string') {
      return this.normalizeCount(data);
    }

    const record = this.asRecord(data);
    return this.normalizeCount(record?.['unreadCount'] ?? record?.['count'] ?? record?.['value']);
  }

  private extractEnvelopeData<T>(payload: unknown): T | null {
    if (payload === null || payload === undefined) {
      return null;
    }

    if (Array.isArray(payload)) {
      return payload as T;
    }

    const record = this.asRecord(payload);
    if (!record) {
      return payload as T;
    }

    const candidates = [
      record['data'],
      record['result'],
      record['payload'],
      record['response'],
      record['notifications']
    ];

    for (const candidate of candidates) {
      if (candidate !== undefined) {
        return candidate as T;
      }
    }

    return payload as T;
  }

  private extractNotificationArray(
    payload: BackendPagedResponseDto<BackendNotificationDto> | BackendNotificationDto[] | null
  ): BackendNotificationDto[] {
    if (!payload) {
      return [];
    }

    if (Array.isArray(payload)) {
      return payload;
    }

    if (Array.isArray(payload.items)) {
      return payload.items;
    }

    return [];
  }

  private mapNotification(raw: BackendNotificationDto): Notification | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const entityType = this.pickString(raw.entityType);
    const entityId = this.normalizeEntityId(raw.entityId);
    const createdByUserName = this.pickString(raw.createdByUserName);
    const title =
      this.pickString(raw.title) || this.buildTitle(entityType, createdByUserName, raw.message);
    const message = this.pickString(raw.message, title);
    const timestamp = this.normalizeTimestamp(raw.createdAt);
    const actionUrl = resolveNotificationActionUrl({
      rawActionUrl: this.pickString(raw.actionUrl),
      derivedActionUrl: this.resolveActionUrl(entityType, entityId),
      genericActionUrl: this.resolveActionUrl(entityType, null)
    });
    const priority =
      this.normalizeNotificationPriority(raw.priority) ??
      this.resolvePriority(entityType, raw.isRead);

    const notification: Notification = {
      id: String(raw.id ?? `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`),
      serverId: typeof raw.id === 'number' ? raw.id : undefined,
      type: this.normalizeNotificationType(raw.notificationType) ?? this.resolveType(entityType),
      priority,
      title,
      message,
      timestamp,
      read: Boolean(raw.isRead),
      isArchived: Boolean(raw.isArchived),
      receiverUserId: this.pickString(raw.receiverUserId),
      createdByUserId: this.pickString(raw.createdByUserId),
      createdByUserName,
      createdByUserAvatarUrl: this.pickString(raw.createdByUserAvatarUrl),
      subject: this.pickOptionalString(raw.subject),
      summary: this.pickOptionalString(raw.summary),
      entityType,
      entityId,
      readAt: raw.readAt ? this.normalizeTimestamp(raw.readAt) : null,
      archivedAt: raw.archivedAt ? this.normalizeTimestamp(raw.archivedAt) : null,
      actionUrl,
      actionLabel: formatNotificationActionLabel(this.pickString(raw.actionLabel), {
        actionLabel: this.pickString(raw.actionLabel),
        actionUrl,
        entityType
      }),
      icon: this.pickString(raw.icon),
      sourceModule: this.pickString(raw.sourceModule),
      metadata: {
        source: 'backend'
      }
    };

    const subject = notification.subject || formatNotificationSubject(notification);
    const summary = notification.summary || formatNotificationSummary(notification);
    if (subject || summary) {
      notification.subject = subject;
      notification.summary = summary;
      notification.metadata = {
        ...(notification.metadata ?? {}),
        ...(subject ? { subject } : {}),
        ...(summary ? { summary } : {})
      };
    }

    return notification;
  }

  private buildTitle(entityType: string, createdByUserName: string, message?: string): string {
    const normalizedEntityType = this.normalizeEntityTypeKey(entityType);

    if (createdByUserName && normalizedEntityType === 'comment') {
      return `${createdByUserName} mentioned you`;
    }

    if (normalizedEntityType === 'passwordsecurity') {
      return 'Security update';
    }
    if (normalizedEntityType === 'accountlifecycle') {
      return 'Account activity';
    }
    if (normalizedEntityType === 'projectassignment') {
      return 'Project assignment';
    }
    if (normalizedEntityType === 'projectchecklist') {
      return 'Project checklist';
    }
    if (normalizedEntityType === 'taskchecklist') {
      return 'Task checklist';
    }
    if (normalizedEntityType === 'taskchecklistitem') {
      return 'Task checklist item';
    }
    if (normalizedEntityType === 'taskactivity') {
      return 'Task activity';
    }
    if (normalizedEntityType === 'tasklink') {
      return 'Task link';
    }

    if (createdByUserName) {
      return createdByUserName;
    }

    if (entityType) {
      return `${entityType} update`;
    }

    const trimmedMessage = this.pickString(message);
    return trimmedMessage ? trimmedMessage.slice(0, 48) : 'Notification';
  }

  private resolveType(entityType: string): NotificationType {
    const normalizedEntityType = this.normalizeEntityTypeKey(entityType);
    if (normalizedEntityType === 'comment' || normalizedEntityType === 'mention') {
      return 'info';
    }
    if (
      normalizedEntityType === 'passwordsecurity' ||
      normalizedEntityType === 'accountlifecycle' ||
      normalizedEntityType === 'permissionchange' ||
      normalizedEntityType === 'rolemembership' ||
      normalizedEntityType === 'sessionsecurity'
    ) {
      return 'system';
    }
    if (
      normalizedEntityType === 'projectassignment' ||
      normalizedEntityType === 'projectchecklist' ||
      normalizedEntityType === 'taskchecklist' ||
      normalizedEntityType === 'taskchecklistitem' ||
      normalizedEntityType === 'taskactivity' ||
      normalizedEntityType === 'tasklink'
    ) {
      return 'info';
    }

    return 'info';
  }

  private resolvePriority(entityType: string, isRead: boolean | undefined): NotificationPriority {
    const normalizedEntityType = this.normalizeEntityTypeKey(entityType);
    if (!isRead && (normalizedEntityType === 'comment' || normalizedEntityType === 'mention')) {
      return 'high';
    }
    if (
      normalizedEntityType === 'passwordsecurity' ||
      normalizedEntityType === 'accountlifecycle' ||
      normalizedEntityType === 'permissionchange' ||
      normalizedEntityType === 'rolemembership' ||
      normalizedEntityType === 'sessionsecurity'
    ) {
      return 'high';
    }
    if (
      normalizedEntityType === 'projectassignment' ||
      normalizedEntityType === 'projectchecklist' ||
      normalizedEntityType === 'taskchecklist' ||
      normalizedEntityType === 'taskchecklistitem'
    ) {
      return 'high';
    }

    return 'medium';
  }

  private resolveActionUrl(entityType: string, entityId: number | null): string {
    const normalizedEntityType = this.normalizeEntityTypeKey(entityType);
    const hasEntityId = typeof entityId === 'number' && Number.isFinite(entityId) && entityId > 0;

    if (normalizedEntityType === 'comment' || normalizedEntityType === 'mention') {
      if (hasEntityId) {
        return `/tender/projects?commentId=${entityId}&section=activity`;
      }
      return '/tender/projects';
    }
    if (normalizedEntityType === 'task') {
      if (hasEntityId) {
        return `/tasks?taskId=${entityId}&panel=details`;
      }
      return '/tasks';
    }
    if (normalizedEntityType === 'taskassignment' || normalizedEntityType === 'taskstatus') {
      if (hasEntityId) {
        return `/tasks?taskId=${entityId}&panel=details`;
      }
      return '/tasks';
    }
    if (normalizedEntityType === 'taskitem') {
      return hasEntityId ? `/tasks?taskItemId=${entityId}` : '/tasks';
    }
    if (normalizedEntityType === 'taskchecklist') {
      return hasEntityId ? `/tasks?taskChecklistId=${entityId}` : '/tasks';
    }
    if (normalizedEntityType === 'taskchecklistitem') {
      return hasEntityId ? `/tasks?taskChecklistItemId=${entityId}` : '/tasks';
    }
    if (normalizedEntityType === 'tasklink') {
      return hasEntityId ? `/tasks?taskLinkId=${entityId}` : '/tasks';
    }
    if (normalizedEntityType === 'taskactivity') {
      return hasEntityId ? `/tasks?taskActivityId=${entityId}` : '/tasks';
    }
    if (
      normalizedEntityType === 'priority' ||
      normalizedEntityType === 'taskstatustype' ||
      normalizedEntityType === 'tasktype'
    ) {
      return '/tasks';
    }
    if (normalizedEntityType === 'message') {
      return hasEntityId ? `/messages?conversationId=${entityId}` : '/messages';
    }
    if (
      normalizedEntityType === 'crmcompany' ||
      normalizedEntityType === 'crmcompanynote' ||
      normalizedEntityType === 'crmcompanynotecomment'
    ) {
      return hasEntityId ? `/crm/companies/${entityId}` : '/crm/companies';
    }
    if (
      normalizedEntityType === 'crmcontact' ||
      normalizedEntityType === 'crmcontactnote' ||
      normalizedEntityType === 'crmcontactnotecomment'
    ) {
      return hasEntityId ? `/crm/contacts/${entityId}` : '/crm/contacts';
    }
    if (
      normalizedEntityType === 'crmdeal' ||
      normalizedEntityType === 'crmdealnote' ||
      normalizedEntityType === 'crmdealnotecomment'
    ) {
      return hasEntityId ? `/crm/deals/${entityId}` : '/crm/deals';
    }
    if (normalizedEntityType === 'project') {
      if (hasEntityId) {
        return `/tender/projects?projectId=${entityId}&panel=details`;
      }
      return '/tender/projects';
    }
    if (normalizedEntityType === 'projectassignment') {
      if (hasEntityId) {
        return `/tender/projects?projectId=${entityId}&panel=details`;
      }
      return '/tender/projects';
    }
    if (normalizedEntityType === 'projectchecklist') {
      if (hasEntityId) {
        return `/tender/projects?checklistId=${entityId}&section=checklists`;
      }
      return '/tender/projects';
    }
    if (
      normalizedEntityType === 'passwordsecurity' ||
      normalizedEntityType === 'accountlifecycle' ||
      normalizedEntityType === 'permissionchange' ||
      normalizedEntityType === 'rolemembership' ||
      normalizedEntityType === 'sessionsecurity'
    ) {
      if (normalizedEntityType === 'accountlifecycle') {
        return '/settings/access-control';
      }
      return '/account/settings';
    }
    if (
      normalizedEntityType === 'material' ||
      normalizedEntityType === 'materialcategory' ||
      normalizedEntityType === 'materialitem' ||
      normalizedEntityType === 'materiallevelmap' ||
      normalizedEntityType === 'materialleveltype' ||
      normalizedEntityType === 'materialtag' ||
      normalizedEntityType === 'tag' ||
      normalizedEntityType === 'unit' ||
      normalizedEntityType === 'unitcategory' ||
      normalizedEntityType === 'valueconversion'
    ) {
      return '/tender/material-classification';
    }
    if (
      normalizedEntityType === 'country' ||
      normalizedEntityType === 'degreeofimportance' ||
      normalizedEntityType === 'owner' ||
      normalizedEntityType === 'ownertype' ||
      normalizedEntityType === 'status' ||
      normalizedEntityType === 'tenderstage' ||
      normalizedEntityType === 'typeofproject'
    ) {
      return '/tender/projects';
    }
    if (
      normalizedEntityType === 'supplier' ||
      normalizedEntityType === 'official' ||
      normalizedEntityType === 'suppliermaterialcategoryconnection' ||
      normalizedEntityType === 'brand'
    ) {
      if (normalizedEntityType === 'supplier' && hasEntityId) {
        return `/tender/suppliers?supplierId=${entityId}&panel=supplier`;
      }
      if (normalizedEntityType === 'official' && hasEntityId) {
        return `/tender/suppliers?officialId=${entityId}&panel=official`;
      }
      if (normalizedEntityType === 'suppliermaterialcategoryconnection' && hasEntityId) {
        return `/tender/suppliers?connectionId=${entityId}&panel=item`;
      }
      return '/tender/suppliers';
    }
    if (
      normalizedEntityType === 'boq' ||
      normalizedEntityType === 'boqitem' ||
      normalizedEntityType === 'boqversion' ||
      normalizedEntityType === 'boqitemversion' ||
      normalizedEntityType === 'building' ||
      normalizedEntityType === 'buildingleveltype' ||
      normalizedEntityType === 'family' ||
      normalizedEntityType === 'familyleveltype'
    ) {
      return '/tender/boq';
    }

    return '/account/notifications';
  }

  private normalizeNotificationType(value: unknown): NotificationType | null {
    const normalized = this.pickString(value).toLowerCase();
    if (
      normalized === 'info' ||
      normalized === 'success' ||
      normalized === 'warning' ||
      normalized === 'error' ||
      normalized === 'system'
    ) {
      return normalized;
    }

    return null;
  }

  private normalizeNotificationPriority(value: unknown): NotificationPriority | null {
    const normalized = this.pickString(value).toLowerCase();
    if (
      normalized === 'low' ||
      normalized === 'medium' ||
      normalized === 'high' ||
      normalized === 'urgent'
    ) {
      return normalized;
    }

    return null;
  }

  private normalizeEntityTypeKey(value: string): string {
    return value.replace(/[\s_-]+/g, '').toLowerCase();
  }

  private normalizeEntityId(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return Math.trunc(value);
    }

    if (typeof value === 'string') {
      const parsed = Number(value.trim());
      return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
    }

    return null;
  }

  private mapToastType(type: NotificationType): ToastType {
    return type === 'system' ? 'info' : type;
  }

  private showToastVariant(
    type: ToastType,
    messageOrTitle: string,
    options: ToastShowOptions
  ): void {
    switch (type) {
      case 'success':
        this.toast.success(messageOrTitle, options);
        break;
      case 'error':
        this.toast.error(messageOrTitle, options);
        break;
      case 'warning':
        this.toast.warning(messageOrTitle, options);
        break;
      case 'danger':
        this.toast.danger(messageOrTitle, options);
        break;
      default:
        this.toast.info(messageOrTitle, options);
        break;
    }
  }

  private toQueryParams(
    query: NotificationQueryOptions
  ): Record<string, string | number | boolean> {
    const params: Record<string, string | number | boolean> = {};

    if (query.pageNumber) {
      params['pageNumber'] = query.pageNumber;
    }
    if (query.pageSize) {
      params['pageSize'] = query.pageSize;
    }
    if (typeof query.isRead === 'boolean') {
      params['isRead'] = query.isRead;
    }
    if (typeof query.includeArchived === 'boolean') {
      params['includeArchived'] = query.includeArchived;
    }
    if (typeof query.onlyArchived === 'boolean') {
      params['onlyArchived'] = query.onlyArchived;
    }
    if (query.entityType) {
      params['entityType'] = query.entityType;
    }
    if (typeof query.entityId === 'number') {
      params['entityId'] = query.entityId;
    }
    if (query.searchTerm) {
      params['searchTerm'] = query.searchTerm;
    }
    if (query.createdFrom) {
      params['createdFrom'] = query.createdFrom;
    }
    if (query.createdTo) {
      params['createdTo'] = query.createdTo;
    }

    return params;
  }

  private resolvePath(path: string, id: string): string {
    return path.includes(':id') ? path.replace(':id', encodeURIComponent(id)) : path;
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private pickString(...values: unknown[]): string {
    for (const value of values) {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) {
          return trimmed;
        }
      }
    }

    return '';
  }

  private pickOptionalString(value: unknown): string | null {
    return this.pickString(value) || null;
  }

  private hasSameToastCopy(left: string, right: string): boolean {
    return (
      left.trim().replace(/\s+/g, ' ').toLowerCase() ===
      right.trim().replace(/\s+/g, ' ').toLowerCase()
    );
  }

  private normalizeTimestamp(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value < 1_000_000_000_000 ? value * 1000 : value;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return Date.now();
      }

      const numeric = Number(trimmed);
      if (Number.isFinite(numeric)) {
        return this.normalizeTimestamp(numeric);
      }

      const parsed = Date.parse(trimmed);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }

    return Date.now();
  }

  private normalizeCount(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(0, Math.trunc(value));
    }

    if (typeof value === 'string') {
      const numeric = Number(value.trim());
      if (Number.isFinite(numeric)) {
        return Math.max(0, Math.trunc(numeric));
      }
    }

    return 0;
  }

  private normalizeSignedCount(value: unknown, fallback = 0): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.trunc(value);
    }

    if (typeof value === 'string') {
      const numeric = Number(value.trim());
      if (Number.isFinite(numeric)) {
        return Math.trunc(numeric);
      }
    }

    return Math.trunc(fallback);
  }

  private resolveRefreshErrorMessage(error: unknown): string {
    const record = this.asRecord(error);
    const message = this.pickString(
      record?.['message'],
      this.asRecord(record?.['error'])?.['message'],
      this.asRecord(record?.['data'])?.['message']
    );

    return message || 'Unable to load notifications right now.';
  }
}
