import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ApiService]
    });
    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should make a GET request', async () => {
    const mockData = { id: 1, name: 'Test' };
    const promise = firstValueFrom(service.get<typeof mockData>('/api/test'));

    const req = httpMock.expectOne('/api/test');
    expect(req.request.method).toBe('GET');
    req.flush(mockData);

    await expect(promise).resolves.toEqual(mockData);
  });

  it('should add query parameters', async () => {
    const promise = firstValueFrom(service.get('/api/test', { params: { page: 1, size: 10 } }));

    const req = httpMock.expectOne(
      request =>
        request.url === '/api/test' &&
        request.params.get('page') === '1' &&
        request.params.get('size') === '10'
    );
    expect(req.request.method).toBe('GET');
    req.flush({});

    await expect(promise).resolves.toEqual({});
  });

  it('should skip null and undefined query parameters', async () => {
    const promise = firstValueFrom(
      service.get('/api/test', { params: { page: 1, empty: null, missing: undefined } })
    );

    const req = httpMock.expectOne(
      request =>
        request.params.has('page') && !request.params.has('empty') && !request.params.has('missing')
    );
    req.flush({});

    await expect(promise).resolves.toEqual({});
  });

  it('should cache requests when cache key is provided', async () => {
    const mockData = { id: 1, name: 'Test' };
    const first = firstValueFrom(
      service.get<typeof mockData>('/api/test', undefined, 'test-cache')
    );

    const req = httpMock.expectOne('/api/test');
    req.flush(mockData);
    await expect(first).resolves.toEqual(mockData);

    const second = firstValueFrom(
      service.get<typeof mockData>('/api/test', undefined, 'test-cache')
    );
    httpMock.expectNone('/api/test');
    await expect(second).resolves.toEqual(mockData);
  });

  it('should trim cache keys in remember()', async () => {
    const factory = () => service.get('/api/data');
    const first = firstValueFrom(service.remember('  test-key  ', factory));

    httpMock.expectOne('/api/data').flush({});
    await expect(first).resolves.toEqual({});

    const second = firstValueFrom(service.remember('test-key', factory));
    httpMock.expectNone('/api/data');
    await expect(second).resolves.toEqual({});
  });

  it('should clear cache by prefix', async () => {
    const userFactory = () => service.get('/api/user-data');
    const productFactory = () => service.get('/api/product-data');

    const firstUser = firstValueFrom(service.remember('user-1', userFactory));
    const firstProduct = firstValueFrom(service.remember('product-1', productFactory));
    httpMock.expectOne('/api/user-data').flush({});
    httpMock.expectOne('/api/product-data').flush({});
    await expect(firstUser).resolves.toEqual({});
    await expect(firstProduct).resolves.toEqual({});

    service.invalidate('user-');

    const userAgain = firstValueFrom(service.remember('user-1', userFactory));
    const productAgain = firstValueFrom(service.remember('product-1', productFactory));
    httpMock.expectOne('/api/user-data').flush({});
    httpMock.expectNone('/api/product-data');

    await expect(userAgain).resolves.toEqual({});
    await expect(productAgain).resolves.toEqual({});
  });

  it('should clear full cache with clear()', async () => {
    const factory = () => service.get('/api/data');
    const first = firstValueFrom(service.remember('test-key', factory));
    httpMock.expectOne('/api/data').flush({});
    await expect(first).resolves.toEqual({});

    service.clear();

    const second = firstValueFrom(service.remember('test-key', factory));
    httpMock.expectOne('/api/data').flush({});
    await expect(second).resolves.toEqual({});
  });
});
