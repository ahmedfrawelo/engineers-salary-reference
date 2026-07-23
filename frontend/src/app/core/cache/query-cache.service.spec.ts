import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { QueryCacheService } from './query-cache.service';
import { vi } from 'vitest';

describe('QueryCacheService', () => {
  let service: QueryCacheService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(QueryCacheService);
  });

  afterEach(() => {
    service.clear();
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should cache query results', async () => {
    let callCount = 0;
    const factory = () => {
      callCount++;
      return of({ data: 'test' });
    };

    await firstValueFrom(service.query('test-key', factory));
    await firstValueFrom(service.query('test-key', factory));

    expect(callCount).toBe(1);
  });

  it('should return cached data', async () => {
    const testData = { value: 123 };
    const factory = () => of(testData);

    await expect(firstValueFrom(service.query('test-key', factory))).resolves.toEqual(testData);
  });

  it('should respect TTL expiration', async () => {
    let callCount = 0;
    const factory = () => {
      callCount++;
      return of({ data: 'test' });
    };
    const nowSpy = vi.spyOn(Date, 'now');

    nowSpy.mockReturnValue(1000);
    await firstValueFrom(service.query('test-key', factory, { ttl: 1000 }));

    nowSpy.mockReturnValue(1500);
    await firstValueFrom(service.query('test-key', factory, { ttl: 1000 }));
    expect(callCount).toBe(1);

    nowSpy.mockReturnValue(2501);
    await firstValueFrom(service.query('test-key', factory, { ttl: 1000 }));
    expect(callCount).toBe(2);
  });

  it('should invalidate cache entry', async () => {
    let callCount = 0;
    const factory = () => {
      callCount++;
      return of({ data: 'test' });
    };

    await firstValueFrom(service.query('test-key', factory));
    service.invalidate('test-key');
    await firstValueFrom(service.query('test-key', factory));

    expect(callCount).toBe(2);
  });

  it('should clear all cache', async () => {
    await firstValueFrom(service.query('key1', () => of({ data: 'test1' })));
    await firstValueFrom(service.query('key2', () => of({ data: 'test2' })));

    expect(service.has('key1')).toBe(true);
    expect(service.has('key2')).toBe(true);

    service.clear();

    expect(service.has('key1')).toBe(false);
    expect(service.has('key2')).toBe(false);
  });

  it('should track statistics', async () => {
    const factory = () => of({ data: 'test' });

    expect(service.stats().hits).toBe(0);
    expect(service.stats().misses).toBe(0);

    await firstValueFrom(service.query('test-key', factory));
    expect(service.stats().misses).toBe(1);

    await firstValueFrom(service.query('test-key', factory));
    expect(service.stats().hits).toBe(1);
  });

  it('should handle errors', async () => {
    const factory = () => throwError(() => new Error('Test error'));

    await expect(firstValueFrom(service.query('test-key', factory))).rejects.toThrow('Test error');
    expect(service.has('test-key')).toBe(false);
  });

  it('should invalidate by pattern', async () => {
    const factory = () => of({ data: 'test' });

    await firstValueFrom(service.query('user:1', factory));
    await firstValueFrom(service.query('user:2', factory));
    await firstValueFrom(service.query('product:1', factory));

    service.invalidatePattern(/^user:/);

    expect(service.has('user:1')).toBe(false);
    expect(service.has('user:2')).toBe(false);
    expect(service.has('product:1')).toBe(true);
  });

  it('should get all cache keys', async () => {
    const factory = () => of({ data: 'test' });

    await firstValueFrom(service.query('key1', factory));
    await firstValueFrom(service.query('key2', factory));

    const keys = service.keys();
    expect(keys).toContain('key1');
    expect(keys).toContain('key2');
  });

  it('should skip cache when disabled', async () => {
    let callCount = 0;
    const factory = () => {
      callCount++;
      return of({ data: 'test' });
    };

    await firstValueFrom(service.query('test-key', factory, { enabled: false }));
    await firstValueFrom(service.query('test-key', factory, { enabled: false }));

    expect(callCount).toBe(2);
  });
});
