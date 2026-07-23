import { Injectable } from '@angular/core';
import { Observable, from, throwError, firstValueFrom } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { inject } from '@angular/core';
import { EnvironmentService } from '../environment.service';
import { environment } from '../../../environments/environment';

type LooseValue = ReturnType<typeof JSON.parse>;
/**
 * IndexedDB Configuration
 */
export interface IndexedDBConfig {
  /** Database name */
  name: string;
  /** Database version */
  version: number;
  /** Object stores configuration */
  stores: {
    name: string;
    keyPath?: string;
    autoIncrement?: boolean;
    indexes?: { name: string; keyPath: string; unique?: boolean }[];
  }[];
}

export interface QueuedOfflineMutation {
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  body?: LooseValue;
  headers?: Record<string, string>;
  timestamp: number;
}

/**
 * IndexedDB Service
 *
 * Offline storage service using IndexedDB for:
 * - Offline data persistence
 * - Large data storage
 * - Queue for offline mutations
 * - Sync when online
 *
 * @example
 * ```typescript
 * // Initialize DB
 * await this.indexedDB.init({
 *   name: 'engineers-salary-reference',
 *   version: 1,
 *   stores: [
 *     { name: 'suppliers', keyPath: 'id' },
 *     { name: 'projects', keyPath: 'id' },
 *     { name: 'offline-queue', autoIncrement: true }
 *   ]
 * });
 *
 * // Save data
 * await this.indexedDB.set('suppliers', supplier);
 *
 * // Get data
 * const supplier = await this.indexedDB.get('suppliers', supplierId);
 *
 * // Get all
 * const suppliers = await this.indexedDB.getAll('suppliers');
 *
 * // Delete
 * await this.indexedDB.delete('suppliers', supplierId);
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class IndexedDBService {
  private readonly environment = inject(EnvironmentService);
  private db: IDBDatabase | null = null;
  private config: IndexedDBConfig | null = null;

  /**
   * Initialize IndexedDB
   * @param config Database configuration
   */
  init(config: IndexedDBConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('IndexedDB not supported in this browser'));
        return;
      }

      this.config = config;

      const request = indexedDB.open(config.name, config.version);

      request.onerror = () => {
        reject(new Error(`IndexedDB error: ${request.error}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        if (environment.enableDebugLogs)
          console.log(`[IndexedDB] Connected to "${config.name}" v${config.version}`);
        resolve();
      };

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        config.stores.forEach(store => {
          if (!db.objectStoreNames.contains(store.name)) {
            const objectStore = db.createObjectStore(store.name, {
              keyPath: store.keyPath,
              autoIncrement: store.autoIncrement ?? false
            });

            // Create indexes
            store.indexes?.forEach(index => {
              objectStore.createIndex(index.name, index.keyPath, { unique: index.unique ?? false });
            });

            if (environment.enableDebugLogs)
              console.log(`[IndexedDB] Created object store: ${store.name}`);
          }
        });
      };
    });
  }

  /**
   * Set item in store
   * @param storeName Object store name
   * @param value Value to store
   * @param key Optional key (if not using keyPath)
   */
  set<T = LooseValue>(storeName: string, value: T, key?: IDBValidKey): Observable<IDBValidKey> {
    return from(
      new Promise<IDBValidKey>((resolve, reject) => {
        if (!this.db) {
          reject(new Error('IndexedDB not initialized'));
          return;
        }

        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = key ? store.put(value, key) : store.put(value);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })
    ).pipe(
      catchError(error => {
        console.error(`[IndexedDB] Set error in "${storeName}":`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get item from store
   * @param storeName Object store name
   * @param key Item key
   */
  get<T = LooseValue>(storeName: string, key: IDBValidKey): Observable<T | undefined> {
    return from(
      new Promise<T | undefined>((resolve, reject) => {
        if (!this.db) {
          reject(new Error('IndexedDB not initialized'));
          return;
        }

        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })
    ).pipe(
      catchError(error => {
        console.error(`[IndexedDB] Get error in "${storeName}":`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get all items from store
   * @param storeName Object store name
   * @param query Optional query
   * @param count Optional limit
   */
  getAll<T = LooseValue>(
    storeName: string,
    query?: IDBValidKey | IDBKeyRange,
    count?: number
  ): Observable<T[]> {
    return from(
      new Promise<T[]>((resolve, reject) => {
        if (!this.db) {
          reject(new Error('IndexedDB not initialized'));
          return;
        }

        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll(query, count);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })
    ).pipe(
      catchError(error => {
        console.error(`[IndexedDB] GetAll error in "${storeName}":`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Delete item from store
   * @param storeName Object store name
   * @param key Item key
   */
  delete(storeName: string, key: IDBValidKey): Observable<void> {
    return from(
      new Promise<void>((resolve, reject) => {
        if (!this.db) {
          reject(new Error('IndexedDB not initialized'));
          return;
        }

        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
    ).pipe(
      catchError(error => {
        console.error(`[IndexedDB] Delete error in "${storeName}":`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Clear all items from store
   * @param storeName Object store name
   */
  clear(storeName: string): Observable<void> {
    return from(
      new Promise<void>((resolve, reject) => {
        if (!this.db) {
          reject(new Error('IndexedDB not initialized'));
          return;
        }

        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
    ).pipe(
      catchError(error => {
        console.error(`[IndexedDB] Clear error in "${storeName}":`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Count items in store
   * @param storeName Object store name
   * @param query Optional query
   */
  count(storeName: string, query?: IDBValidKey | IDBKeyRange): Observable<number> {
    return from(
      new Promise<number>((resolve, reject) => {
        if (!this.db) {
          reject(new Error('IndexedDB not initialized'));
          return;
        }

        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.count(query);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })
    ).pipe(
      catchError(error => {
        console.error(`[IndexedDB] Count error in "${storeName}":`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Query by index
   * @param storeName Object store name
   * @param indexName Index name
   * @param query Query value or range
   */
  getByIndex<T = LooseValue>(
    storeName: string,
    indexName: string,
    query: IDBValidKey | IDBKeyRange
  ): Observable<T[]> {
    return from(
      new Promise<T[]>((resolve, reject) => {
        if (!this.db) {
          reject(new Error('IndexedDB not initialized'));
          return;
        }

        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const index = store.index(indexName);
        const request = index.getAll(query);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })
    ).pipe(
      catchError(error => {
        console.error(`[IndexedDB] GetByIndex error in "${storeName}.${indexName}":`, error);
        return throwError(() => error);
      })
    );
  }

  // ==================== Offline Queue Methods ====================

  /**
   * Add mutation to offline queue
   * @param mutation Mutation to queue (API call)
   */
  queueMutation(mutation: QueuedOfflineMutation): Observable<IDBValidKey> {
    if (!this.offlineModeEnabled()) {
      this.logOfflineModeDisabled('offline queue write');
      return from(Promise.resolve('offline-disabled' as IDBValidKey));
    }

    return this.set('offline-queue', mutation);
  }

  /**
   * Get all queued mutations
   */
  getQueuedMutations(): Observable<LooseValue[]> {
    if (!this.offlineModeEnabled()) {
      this.logOfflineModeDisabled('offline queue read');
      return from(Promise.resolve([]));
    }

    return this.getAll('offline-queue');
  }

  /**
   * Clear offline queue
   */
  clearQueue(): Observable<void> {
    if (!this.offlineModeEnabled()) {
      this.logOfflineModeDisabled('offline queue clear');
      return from(Promise.resolve());
    }

    return this.clear('offline-queue');
  }

  // ==================== Sync Methods ====================

  /**
   * Sync offline data when online
   * Sync remains intentionally disabled until the offline feature flag is enabled.
   */
  async syncWhenOnline(): Promise<void> {
    if (!this.offlineModeEnabled()) {
      this.logOfflineModeDisabled('offline sync');
      return;
    }

    if (!navigator.onLine) {
      if (environment.enableDebugLogs) console.log('[IndexedDB] Device is offline. Skipping sync.');
      return;
    }

    try {
      const mutations = await firstValueFrom(this.getQueuedMutations());
      if (environment.enableDebugLogs)
        console.log(`[IndexedDB] Syncing ${mutations?.length || 0} mutations...`);

      let failed = false;

      for (const mutation of mutations || []) {
        try {
          const response = await fetch(mutation.url, {
            method: mutation.method,
            headers: {
              'Content-Type': 'application/json',
              ...(mutation.headers || {})
            },
            body: mutation.body ? JSON.stringify(mutation.body) : undefined
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        } catch (error) {
          failed = true;
          console.error('[IndexedDB] Failed to sync mutation:', mutation, error);
          break;
        }
      }

      if (!failed) {
        await firstValueFrom(this.clearQueue());
      }
    } catch (error) {
      console.error('[IndexedDB] Sync error:', error);
    }
  }

  private offlineModeEnabled(): boolean {
    return this.environment.isFeatureEnabled('offline-mode');
  }

  private logOfflineModeDisabled(action: string): void {
    console.info(`[IndexedDB] Skipping ${action} because offline mode is disabled.`);
  }

  // ==================== Database Management ====================

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      if (environment.enableDebugLogs) console.log('[IndexedDB] Connection closed');
    }
  }

  /**
   * Delete database
   * @param name Database name
   */
  static deleteDatabase(name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => {
        if (environment.enableDebugLogs) console.log(`[IndexedDB] Database "${name}" deleted`);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  ngOnDestroy(): void {
    this.close();
  }
}
