import { Injectable, inject, Injector, signal } from '@angular/core';
import { clearHttpResponseCache } from '../../infrastructure/http/http-response-cache';
import { runtimeConfig } from '../runtime-config';
import { clearApplicationCacheState } from '../pwa/service-worker-cleanup.util';
import { QueryCacheService } from '../cache/query-cache.service';
import { OfflineManagerService } from '../offline/offline-manager.service';

export type ReleaseUpdateState = 'idle' | 'updating' | 'ready';

@Injectable({ providedIn: 'root' })
export class ReleaseUpdateService {
  readonly state = signal<ReleaseUpdateState>('idle');
  readonly releaseId = signal('');
  private timer?: number;
  private processing = false;
  private readonly queryCache = inject(QueryCacheService);

  private readonly injector = inject(Injector);

  constructor() {
    this.releaseId.set(runtimeConfig().releaseId?.trim() || 'unknown');
  }

  start(): void {
    if (typeof window === 'undefined' || this.timer !== undefined) return;
    void this.checkForUpdate();
    this.timer = window.setInterval(() => void this.checkForUpdate(), 30_000);
    document.addEventListener('visibilitychange', this.handleVisibility);
  }

  stop(): void {
    if (this.timer !== undefined) window.clearInterval(this.timer);
    this.timer = undefined;
    document.removeEventListener('visibilitychange', this.handleVisibility);
  }

  private readonly handleVisibility = (): void => {
    if (document.visibilityState === 'visible') void this.checkForUpdate();
  };

  private async checkForUpdate(): Promise<void> {
    if (this.processing) return;
    try {
      const response = await fetch(`/assets/runtime-config.json?release-check=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!response.ok) return;
      const next = (await response.json()) as { releaseId?: unknown };
      const nextRelease = typeof next.releaseId === 'string' ? next.releaseId.trim() : '';
      if (nextRelease && this.releaseId() !== 'unknown' && nextRelease !== this.releaseId()) {
        await this.applyUpdate(nextRelease);
      }
    } catch {
      // A temporary network failure must not interrupt the current session.
    }
  }

  private async applyUpdate(nextRelease: string): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    this.state.set('updating');
    await new Promise(resolve => window.setTimeout(resolve, 700));
    this.state.set('ready');
    await new Promise(resolve => window.setTimeout(resolve, 900));
    clearHttpResponseCache();
    this.queryCache.clear();
    try {
      await this.injector.get(OfflineManagerService).clearAllStoredData();
    } catch {
      // Preserve the forced reload even if IndexedDB is unavailable.
    }
    await clearApplicationCacheState();
    const url = new URL(window.location.href);
    url.searchParams.set('release', nextRelease);
    window.location.replace(url.toString());
  }
}
