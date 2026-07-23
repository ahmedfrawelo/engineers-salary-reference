import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, firstValueFrom, from, switchMap, throwError } from 'rxjs';
import { AuthTokenStoreService } from '../auth/auth.service';
import { EnvironmentService } from '../environment.service';
import { IndexedDBService } from '../storage/indexeddb.service';
import { environment as envConfig } from '../../../environments/environment';

type LooseValue = ReturnType<typeof JSON.parse>;

/**
 * Sync Request
 */
export interface SyncRequest {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  body?: LooseValue;
  headers?: Record<string, string>;
  timestamp: number;
  retries: number;
}

/**
 * Background Sync Service
 *
 * Queues failed mutations and syncs them once connectivity returns.
 */
@Injectable({
  providedIn: 'root'
})
export class BackgroundSyncService {
  private readonly QUEUE_NAME = 'sync-queue';
  private readonly MAX_RETRIES = 3;
  private readonly sensitiveHeaderNames: Set<string>;
  private syncing = false;
  private storageMode: 'indexeddb' | 'memory' = 'memory';
  private storageReady: Promise<void>;
  private memoryQueue: SyncRequest[] = [];

  constructor(
    private indexedDb: IndexedDBService,
    private environment: EnvironmentService,
    private authTokenStore: AuthTokenStoreService
  ) {
    const deleteProtectionHeaderName = String(
      (this.environment.security as { deleteProtection?: { headerName?: string } })
        ?.deleteProtection?.headerName ?? 'X-Delete-Code'
    )
      .trim()
      .toLowerCase();

    this.sensitiveHeaderNames = new Set([
      'authorization',
      'cookie',
      'set-cookie',
      deleteProtectionHeaderName || 'x-delete-code',
      'x-csrf-token',
      'x-xsrf-token'
    ]);
    this.storageReady = this.initStorage();
    this.initOnlineListener();
  }

  async initialize(): Promise<void> {
    if (!this.isEnabled()) {
      console.info('[BackgroundSync] Offline mode is disabled. Skipping initialization.');
      return;
    }

    await this.storageReady;
    if (navigator.onLine) {
      await this.sync();
    }
  }

  /**
   * Queue a request for background sync
   */
  async queueRequest(request: Omit<SyncRequest, 'id' | 'timestamp' | 'retries'>): Promise<void> {
    if (!this.isEnabled()) {
      console.info('[BackgroundSync] Offline mode is disabled. Skipping queue write.');
      return;
    }

    await this.storageReady;
    const syncRequest: SyncRequest = {
      id: this.generateId(),
      ...request,
      timestamp: Date.now(),
      retries: 0
    };

    await this.saveToQueue(syncRequest);

    if (envConfig.enableDebugLogs) console.log('[BackgroundSync] Queued request:', syncRequest.id);

    if (navigator.onLine) {
      await this.sync();
    }
  }

  /**
   * Sync all queued requests
   */
  async sync(): Promise<void> {
    if (!this.isEnabled()) {
      console.info('[BackgroundSync] Offline mode is disabled. Skipping sync.');
      return;
    }

    await this.storageReady;
    if (this.syncing) {
      if (envConfig.enableDebugLogs) console.log('[BackgroundSync] Sync already in progress');
      return;
    }

    if (!navigator.onLine) {
      if (envConfig.enableDebugLogs)
        console.log('[BackgroundSync] Device is offline, skipping sync');
      return;
    }

    this.syncing = true;

    try {
      const queue = await this.getQueue();

      if (envConfig.enableDebugLogs)
        console.log(`[BackgroundSync] Syncing ${queue.length} requests...`);

      for (const request of queue) {
        try {
          await this.executeRequest(request);
          await this.removeFromQueue(request.id);
          if (envConfig.enableDebugLogs) console.log(`[BackgroundSync] Synced: ${request.id}`);
        } catch (error) {
          console.error(`[BackgroundSync] Failed to sync ${request.id}:`, error);

          request.retries += 1;

          if (request.retries >= this.MAX_RETRIES) {
            await this.removeFromQueue(request.id);
            console.error(
              `[BackgroundSync] Max retries reached for ${request.id}, removing from queue`
            );
          } else {
            await this.updateInQueue(request);
            if (envConfig.enableDebugLogs) {
              console.log(
                `[BackgroundSync] Retry ${request.retries}/${this.MAX_RETRIES} for ${request.id}`
              );
            }
          }
        }

        await this.delay(500);
      }

      if (envConfig.enableDebugLogs) console.log('[BackgroundSync] Sync completed');
    } finally {
      this.syncing = false;
    }
  }

  /**
   * Get queue size
   */
  async getQueueSize(): Promise<number> {
    if (!this.isEnabled()) {
      return 0;
    }

    await this.storageReady;
    const queue = await this.getQueue();
    return queue.length;
  }

  /**
   * Clear queue
   */
  async clearQueue(): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    await this.storageReady;
    if (this.storageMode === 'indexeddb') {
      await firstValueFrom(this.indexedDb.clear(this.QUEUE_NAME));
    } else {
      this.memoryQueue = [];
    }
    if (envConfig.enableDebugLogs) console.log('[BackgroundSync] Queue cleared');
  }

  private async executeRequest(request: SyncRequest): Promise<void> {
    const headers = new Headers({
      'Content-Type': 'application/json'
    });
    for (const [key, value] of Object.entries(request.headers ?? {})) {
      if (!this.isSensitiveHeader(key) && value) {
        headers.set(key, value);
      }
    }

    const authHeader = this.buildAuthorizationHeader();
    if (authHeader) {
      headers.set('Authorization', authHeader);
    }

    const response = await fetch(request.url, {
      method: request.method,
      headers,
      body: request.body ? JSON.stringify(request.body) : undefined,
      credentials: this.resolveCredentialsMode()
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    await response.text().catch(() => undefined);
  }

  private initOnlineListener(): void {
    window.addEventListener('online', () => {
      if (!this.isEnabled()) {
        return;
      }

      if (envConfig.enableDebugLogs)
        console.log('[BackgroundSync] Device is online, starting sync...');
      void this.sync();
    });

    window.addEventListener('offline', () => {
      if (envConfig.enableDebugLogs) console.log('[BackgroundSync] Device is offline');
    });
  }

  private generateId(): string {
    return `sync-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async saveToQueue(request: SyncRequest): Promise<void> {
    if (this.storageMode === 'indexeddb') {
      await firstValueFrom(this.indexedDb.set(this.QUEUE_NAME, request));
      return;
    }

    this.memoryQueue = [...this.memoryQueue, request];
  }

  private async getQueue(): Promise<SyncRequest[]> {
    if (this.storageMode === 'indexeddb') {
      return await firstValueFrom(this.indexedDb.getAll<SyncRequest>(this.QUEUE_NAME));
    }

    return [...this.memoryQueue];
  }

  private async removeFromQueue(id: string): Promise<void> {
    if (this.storageMode === 'indexeddb') {
      await firstValueFrom(this.indexedDb.delete(this.QUEUE_NAME, id));
      return;
    }

    this.memoryQueue = this.memoryQueue.filter(request => request.id !== id);
  }

  private async updateInQueue(request: SyncRequest): Promise<void> {
    if (this.storageMode === 'indexeddb') {
      await firstValueFrom(this.indexedDb.set(this.QUEUE_NAME, request));
      return;
    }

    const queue = [...this.memoryQueue];
    const index = queue.findIndex(entry => entry.id === request.id);
    if (index !== -1) {
      queue[index] = request;
      this.memoryQueue = queue;
    }
  }

  private async initStorage(): Promise<void> {
    try {
      await this.indexedDb.init({
        name: 'engineers-salary-reference',
        version: 2,
        stores: [
          { name: this.QUEUE_NAME, keyPath: 'id' },
          { name: 'supplier-connections-cache', keyPath: 'key' }
        ]
      });
      this.storageMode = 'indexeddb';
    } catch (error) {
      this.storageMode = 'memory';
      if (envConfig.enableDebugLogs)
        console.warn('[BackgroundSync] IndexedDB unavailable, using in-memory queue.', error);
    }
  }

  private isEnabled(): boolean {
    return this.environment.isFeatureEnabled('offline-mode');
  }

  private isSensitiveHeader(headerName: string): boolean {
    return this.sensitiveHeaderNames.has(headerName.trim().toLowerCase());
  }

  private buildAuthorizationHeader(): string | null {
    const token = this.authTokenStore.getToken()?.trim();
    if (!token) {
      return null;
    }
    return /^bearer\s+/i.test(token) ? token : `Bearer ${token}`;
  }

  private resolveCredentialsMode(): RequestCredentials {
    const httpConfig = this.environment.http as { withCredentials?: boolean };
    return httpConfig?.withCredentials === true ? 'include' : 'same-origin';
  }
}

/**
 * Background Sync HTTP Interceptor
 *
 * Automatically queues failed mutation requests for replay after reconnect.
 */
export const backgroundSyncInterceptor: HttpInterceptorFn = (req, next) => {
  const syncService = inject(BackgroundSyncService);
  const environment = inject(EnvironmentService);
  const deleteProtectionHeaderName = String(
    (environment.security as { deleteProtection?: { headerName?: string } })?.deleteProtection
      ?.headerName ?? 'X-Delete-Code'
  ).trim();

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const shouldQueue =
        environment.isFeatureEnabled('offline-mode') &&
        !navigator.onLine &&
        (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') &&
        !/\/auth\//i.test(req.url) &&
        !req.headers.has(deleteProtectionHeaderName);

      if (!shouldQueue) {
        return throwError(() => error);
      }

      return from(
        syncService.queueRequest({
          method: req.method as SyncRequest['method'],
          url: req.urlWithParams,
          body: req.body,
          headers: Object.fromEntries(
            req.headers.keys().map(key => [key, req.headers.get(key) ?? ''])
          )
        })
      ).pipe(
        catchError(queueError => {
          console.error('[BackgroundSync] Failed to queue request:', queueError);
          return throwError(() => error);
        }),
        switchMap(() => {
          if (envConfig.enableDebugLogs)
            console.log('[BackgroundSync] Request queued for later sync');
          return throwError(
            () =>
              new HttpErrorResponse({
                status: 0,
                statusText: 'Queued for sync',
                url: req.urlWithParams,
                error: {
                  queuedForSync: true,
                  message:
                    'Request saved offline and will sync automatically once the connection is restored.'
                }
              })
          );
        })
      );
    })
  );
};
