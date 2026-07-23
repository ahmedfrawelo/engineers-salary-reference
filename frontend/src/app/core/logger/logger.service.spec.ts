import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { LoggerService } from './logger.service';

describe('LoggerService', () => {
  let service: LoggerService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LoggerService]
    });
    service = TestBed.inject(LoggerService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should write debug logs with [DEBUG] prefix', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    service.debug('debug message', { id: 1 });
    expect(logSpy).toHaveBeenCalledWith('[DEBUG] debug message', { id: 1 });
  });

  it('should write info logs with [INFO] prefix', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    service.info('info message');
    expect(infoSpy).toHaveBeenCalledWith('[INFO] info message');
  });

  it('should write warning logs with [WARN] prefix', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    service.warn('warn message', { code: 'W01' });
    expect(warnSpy).toHaveBeenCalledWith('[WARN] warn message', { code: 'W01' });
  });

  it('should write error logs with [ERROR] prefix and error object', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const err = new Error('boom');
    service.error('error message', err);
    expect(errorSpy).toHaveBeenCalledWith('[ERROR] error message', err);
  });

  it('should write error logs without error object', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    service.error('error-only-message');
    expect(errorSpy).toHaveBeenCalledWith('[ERROR] error-only-message');
  });
});
