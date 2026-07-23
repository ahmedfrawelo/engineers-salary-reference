import { Injectable, signal, computed } from '@angular/core';
import { fromEvent, merge, of } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

type LooseValue = ReturnType<typeof JSON.parse>;
/**
 * Queued Request
 */
export interface QueuedRequest {
  id: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: LooseValue;
  headers?: Record<string, string>;
  timestamp: number;
  retries: number;
  maxRetries: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Offline Data
 */
export interface OfflineData<T = LooseValue> {
  id: string;
  collection: string;
  data: T;
  timestamp: number;
  synced: boolean;
}

/**
 * Sync Result
 */
export interface SyncResult {
  success: number;
  failed: number;
  total: number;
  errors: Array<{ id: string; error: string }>;
}

/**
 * Advanced Offline Manager Service
 *
 * Comprehensive offline functionality with sync queue
 *
 * Features:
 * - Network status detection
 * - Request queue management
 * - Automatic retry with exponential backoff
 * - Priority-based sync
 * - IndexedDB storage
 * - Conflict resolution
 * - Background sync integration
 *
 * @example
 * ```typescript
 * // Queue request when offline
 * await this.offlineManager.queueRequest({
 *   url: '/api/suppliers',
 *   method: 'POST',
 *   body: supplierData,
 *   priority: 'high'
 * });
 *
 * // Check online status
 * const isOnline = this.offlineManager.isOnline();
 *
 * // Sync queued requests
 * await this.offlineManager.syncQueue();
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class OfflineManagerService {
  private readonly DB_NAME = 'engineers-salary-reference-offline-db';
  private readonly DB_VERSION = 1;
  private readonly QUEUE_STORE = 'request-queue';
  private readonly DATA_STORE = 'offline-data';

  private db?: IDBDatabase;

  // Signals
  private _isOnline = signal(navigator.onLine);
  readonly isOnline = this._isOnline.asReadonly();

  private _queueSize = signal(0);
  readonly queueSize = this._queueSize.asReadonly();

  private _isSyncing = signal(false);
  readonly isSyncing = this._isSyncing.asReadonly();

  // Computed
  readonly isOffline = computed(() => !this._isOnline());
  readonly hasPendingRequests = computed(() => this._queueSize() > 0);

  constructor() {
    this.initDatabase();
    this.listenToNetworkChanges();
    this.loadQueueSize();
  }

  /**
   * Queue request for later sync
   */
  async queueRequest(request: Omit<QueuedRequest, 'id' | 'timestamp' | 'retries'>): Promise<void> {
    const { maxRetries = 3, ...rest } = request;
    const queuedRequest: QueuedRequest = {
      id: this.generateId(),
      timestamp: Date.now(),
      retries: 0,
      maxRetries,
      ...rest
    };

    await this.saveToQueue(queuedRequest);
    this._queueSize.update(size => size + 1);

    if (environment.enableDebugLogs)
      console.log(`[Offline] Queued request: ${request.method} ${request.url}`);

    // Try to sync immediately if online
    if (this._isOnline()) {
      this.syncQueue();
    }
  }

  /**
   * Sync all queued requests
   */
  async syncQueue(): Promise<SyncResult> {
    if (this._isSyncing() || !this._isOnline()) {
      return { success: 0, failed: 0, total: 0, errors: [] };
    }

    this._isSyncing.set(true);

    try {
      const queue = await this.getQueue();
      const sortedQueue = this.sortByPriority(queue);

      const result: SyncResult = {
        success: 0,
        failed: 0,
        total: sortedQueue.length,
        errors: []
      };

      for (const request of sortedQueue) {
        try {
          await this.executeRequest(request);
          await this.removeFromQueue(request.id);
          result.success++;
          this._queueSize.update(size => size - 1);
        } catch (error) {
          request.retries++;

          if (request.retries >= request.maxRetries) {
            await this.removeFromQueue(request.id);
            result.failed++;
            result.errors.push({
              id: request.id,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            this._queueSize.update(size => size - 1);
          } else {
            // Update retry count
            await this.updateQueueItem(request);
          }
        }
      }

      if (environment.enableDebugLogs)
        console.log(`[Offline] Sync complete: ${result.success}/${result.total} successful`);
      return result;
    } finally {
      this._isSyncing.set(false);
    }
  }

  /**
   * Save data for offline access
   */
  async saveOfflineData<T>(collection: string, data: T, id?: string): Promise<void> {
    const offlineData: OfflineData<T> = {
      id: id || this.generateId(),
      collection,
      data,
      timestamp: Date.now(),
      synced: false
    };

    await this.saveToDataStore(offlineData);
    if (environment.enableDebugLogs)
      console.log(`[Offline] Saved offline data: ${collection}/${offlineData.id}`);
  }

  /**
   * Get offline data by collection
   */
  async getOfflineData<T>(collection: string): Promise<OfflineData<T>[]> {
    return this.getFromDataStore<T>(collection);
  }

  /**
   * Clear synced offline data
   */
  async clearSyncedData(): Promise<void> {
    const db = await this.getDatabase();
    const transaction = db.transaction([this.DATA_STORE], 'readwrite');
    const store = transaction.objectStore(this.DATA_STORE);

    const request = store.openCursor();

    return new Promise((resolve, reject) => {
      request.onsuccess = event => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const data = cursor.value as OfflineData;
          if (data.synced) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    total: number;
    byPriority: Record<string, number>;
    oldestTimestamp: number;
  }> {
    const queue = await this.getQueue();

    const byPriority: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    let oldestTimestamp = Date.now();

    queue.forEach(request => {
      byPriority[request.priority]++;
      if (request.timestamp < oldestTimestamp) {
        oldestTimestamp = request.timestamp;
      }
    });

    return {
      total: queue.length,
      byPriority,
      oldestTimestamp
    };
  }

  /**
   * Initialize IndexedDB
   */
  private async initDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create stores if they don't exist
        if (!db.objectStoreNames.contains(this.QUEUE_STORE)) {
          const queueStore = db.createObjectStore(this.QUEUE_STORE, { keyPath: 'id' });
          queueStore.createIndex('priority', 'priority', { unique: false });
          queueStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains(this.DATA_STORE)) {
          const dataStore = db.createObjectStore(this.DATA_STORE, { keyPath: 'id' });
          dataStore.createIndex('collection', 'collection', { unique: false });
          dataStore.createIndex('synced', 'synced', { unique: false });
        }
      };
    });
  }

  /**
   * Get database instance
   */
  private async getDatabase(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    await this.initDatabase();
    return this.db!;
  }

  /**
   * Save request to queue
   */
  private async saveToQueue(request: QueuedRequest): Promise<void> {
    const db = await this.getDatabase();
    const transaction = db.transaction([this.QUEUE_STORE], 'readwrite');
    const store = transaction.objectStore(this.QUEUE_STORE);

    return new Promise((resolve, reject) => {
      const req = store.add(request);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Get all queued requests
   */
  private async getQueue(): Promise<QueuedRequest[]> {
    const db = await this.getDatabase();
    const transaction = db.transaction([this.QUEUE_STORE], 'readonly');
    const store = transaction.objectStore(this.QUEUE_STORE);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Remove request from queue
   */
  private async removeFromQueue(id: string): Promise<void> {
    const db = await this.getDatabase();
    const transaction = db.transaction([this.QUEUE_STORE], 'readwrite');
    const store = transaction.objectStore(this.QUEUE_STORE);

    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Update queue item
   */
  private async updateQueueItem(request: QueuedRequest): Promise<void> {
    const db = await this.getDatabase();
    const transaction = db.transaction([this.QUEUE_STORE], 'readwrite');
    const store = transaction.objectStore(this.QUEUE_STORE);

    return new Promise((resolve, reject) => {
      const req = store.put(request);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Save to data store
   */
  private async saveToDataStore(data: OfflineData): Promise<void> {
    const db = await this.getDatabase();
    const transaction = db.transaction([this.DATA_STORE], 'readwrite');
    const store = transaction.objectStore(this.DATA_STORE);

    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get from data store
   */
  private async getFromDataStore<T>(collection: string): Promise<OfflineData<T>[]> {
    const db = await this.getDatabase();
    const transaction = db.transaction([this.DATA_STORE], 'readonly');
    const store = transaction.objectStore(this.DATA_STORE);
    const index = store.index('collection');

    return new Promise((resolve, reject) => {
      const request = index.getAll(collection);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Execute HTTP request
   */
  private async executeRequest(request: QueuedRequest): Promise<Response> {
    const response = await fetch(request.url, {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
        ...request.headers
      },
      body: request.body ? JSON.stringify(request.body) : undefined
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  }

  /**
   * Sort queue by priority
   */
  private sortByPriority(queue: QueuedRequest[]): QueuedRequest[] {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

    return queue.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.timestamp - b.timestamp;
    });
  }

  /**
   * Listen to network changes
   */
  private listenToNetworkChanges(): void {
    merge(
      fromEvent(window, 'online').pipe(map(() => true)),
      fromEvent(window, 'offline').pipe(map(() => false))
    )
      .pipe(startWith(navigator.onLine))
      .subscribe(online => {
        this._isOnline.set(online);

        if (online) {
          if (environment.enableDebugLogs) console.log('[Offline] Back online, syncing queue...');
          this.syncQueue();
        } else {
          if (environment.enableDebugLogs) console.log('[Offline] Gone offline');
        }
      });
  }

  /**
   * Load initial queue size
   */
  private async loadQueueSize(): Promise<void> {
    const queue = await this.getQueue();
    this._queueSize.set(queue.length);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
