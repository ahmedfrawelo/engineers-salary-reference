import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { catchError, firstValueFrom, of } from 'rxjs';
import { vi } from 'vitest';
import { AuthTokenStoreService } from '../auth/auth.service';
import { EnvironmentService } from '../environment.service';
import { IndexedDBService } from '../storage/indexeddb.service';
import { BackgroundSyncService, backgroundSyncInterceptor } from './background-sync.service';

const setOnline = (value: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => value
  });
};

describe('BackgroundSyncService', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('falls back to an in-memory queue and replays queued requests on initialize', async () => {
    setOnline(false);

    const indexedDbMock = {
      init: vi.fn().mockRejectedValue(new Error('IndexedDB unavailable')),
      set: vi.fn(),
      getAll: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn()
    };
    const environmentMock = {
      isFeatureEnabled: vi.fn().mockReturnValue(true)
    };

    TestBed.configureTestingModule({
      providers: [
        BackgroundSyncService,
        { provide: IndexedDBService, useValue: indexedDbMock },
        { provide: EnvironmentService, useValue: environmentMock },
        { provide: AuthTokenStoreService, useValue: { getToken: () => undefined } }
      ]
    });

    const service = TestBed.inject(BackgroundSyncService);
    vi.spyOn(
      service as unknown as { delay: (ms: number) => Promise<void> },
      'delay'
    ).mockResolvedValue(undefined);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: vi.fn().mockResolvedValue('')
    } as unknown as Response);

    await service.queueRequest({
      method: 'POST',
      url: '/api/offline-tasks',
      body: { name: 'Queued while offline' }
    });

    await expect(service.getQueueSize()).resolves.toBe(1);

    setOnline(true);
    await service.initialize();

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/offline-tasks',
      expect.objectContaining({
        method: 'POST'
      })
    );
    await expect(service.getQueueSize()).resolves.toBe(0);
  });

  it('skips queue writes while offline mode is disabled', async () => {
    setOnline(false);

    const indexedDbMock = {
      init: vi.fn().mockResolvedValue(undefined),
      set: vi.fn(),
      getAll: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn()
    };
    const environmentMock = {
      isFeatureEnabled: vi.fn().mockReturnValue(false)
    };

    TestBed.configureTestingModule({
      providers: [
        BackgroundSyncService,
        { provide: IndexedDBService, useValue: indexedDbMock },
        { provide: EnvironmentService, useValue: environmentMock },
        { provide: AuthTokenStoreService, useValue: { getToken: () => undefined } }
      ]
    });

    const service = TestBed.inject(BackgroundSyncService);

    await service.queueRequest({
      method: 'POST',
      url: '/api/disabled',
      body: { ok: false }
    });

    expect(indexedDbMock.set).not.toHaveBeenCalled();
    await expect(service.getQueueSize()).resolves.toBe(0);
  });
});

describe('backgroundSyncInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  const queueRequest = vi.fn().mockResolvedValue(undefined);
  const environmentMock = {
    isFeatureEnabled: vi.fn().mockReturnValue(true)
  };

  beforeEach(() => {
    setOnline(false);
    queueRequest.mockClear();
    environmentMock.isFeatureEnabled.mockClear();
    environmentMock.isFeatureEnabled.mockReturnValue(true);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([backgroundSyncInterceptor])),
        provideHttpClientTesting(),
        { provide: BackgroundSyncService, useValue: { queueRequest } },
        { provide: EnvironmentService, useValue: environmentMock },
        { provide: AuthTokenStoreService, useValue: { getToken: () => undefined } }
      ]
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  it('queues offline mutation requests before surfacing a queued-for-sync response', async () => {
    const resultPromise = firstValueFrom(
      http.post('/api/items', { title: 'offline item' }).pipe(catchError(error => of(error)))
    );

    httpMock
      .expectOne('/api/items')
      .error(new ProgressEvent('offline'), { status: 0, statusText: 'Unknown Error' });

    const error = await resultPromise;

    expect(queueRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/api/items',
        body: { title: 'offline item' }
      })
    );
    expect(error.error.message).toContain('Request saved offline');
  });

  it('does not queue read-only requests', async () => {
    const resultPromise = firstValueFrom(
      http.get('/api/items').pipe(catchError(error => of(error)))
    );

    httpMock
      .expectOne('/api/items')
      .error(new ProgressEvent('offline'), { status: 0, statusText: 'Unknown Error' });

    await resultPromise;

    expect(queueRequest).not.toHaveBeenCalled();
  });
});
