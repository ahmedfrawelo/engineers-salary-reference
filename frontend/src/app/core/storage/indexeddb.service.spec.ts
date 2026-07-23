import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { vi } from 'vitest';
import { EnvironmentService } from '../environment.service';
import { IndexedDBService } from './indexeddb.service';

describe('IndexedDBService', () => {
  let service: IndexedDBService;
  const environmentMock = {
    isFeatureEnabled: vi.fn((feature: string) => feature !== 'offline-mode')
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [IndexedDBService, { provide: EnvironmentService, useValue: environmentMock }]
    });

    service = TestBed.inject(IndexedDBService);
    environmentMock.isFeatureEnabled.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses no-op queue operations while offline mode is disabled', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    await expect(
      firstValueFrom(
        service.queueMutation({
          method: 'POST',
          url: '/api/test',
          body: { ok: true },
          timestamp: Date.now()
        })
      )
    ).resolves.toBe('offline-disabled');
    await expect(firstValueFrom(service.getQueuedMutations())).resolves.toEqual([]);
    await expect(firstValueFrom(service.clearQueue())).resolves.toBeUndefined();

    expect(infoSpy).toHaveBeenCalledWith(
      '[IndexedDB] Skipping offline queue write because offline mode is disabled.'
    );
  });

  it('skips sync when offline mode is disabled', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await service.syncWhenOnline();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledWith(
      '[IndexedDB] Skipping offline sync because offline mode is disabled.'
    );
  });
});
