// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { TokenDebugService } from './token-debug.service';

const toBase64Url = (value: string): string =>
  btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

const createJwt = (claims: Record<string, unknown>): string => {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = toBase64Url(JSON.stringify(claims));
  return `${header}.${payload}.signature`;
};

describe('TokenDebugService', () => {
  let service: TokenDebugService;
  let originalDebugLogs: boolean;
  let debugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalDebugLogs = environment.enableDebugLogs;
    environment.enableDebugLogs = true;
    service = new TokenDebugService();
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    environment.enableDebugLogs = originalDebugLogs;
    vi.restoreAllMocks();
  });

  it('logs token metadata without exposing token contents or personal claims', () => {
    const token = createJwt({
      exp: Math.floor((Date.now() + 60 * 60 * 1000) / 1000),
      email: 'secret@example.test',
      name: 'Sensitive User',
      sub: 'user-123',
      role: ['Admin'],
      typ: 'access'
    });

    service.debugToken(token, 'Sensitive token');

    expect(debugSpy).toHaveBeenCalledOnce();
    const [, metadata] = debugSpy.mock.calls[0] as [string, Record<string, unknown>];
    const serializedCall = JSON.stringify(debugSpy.mock.calls);

    expect(metadata['present']).toBe(true);
    expect(metadata['isJwt']).toBe(true);
    expect(metadata['length']).toBe(token.length);
    expect(metadata['claimKeys']).toEqual(['email', 'exp', 'name', 'role', 'sub', 'typ']);
    expect(serializedCall).not.toContain(token);
    expect(serializedCall).not.toContain('secret@example.test');
    expect(serializedCall).not.toContain('Sensitive User');
    expect(serializedCall).not.toContain('user-123');
  });

  it('compares tokens without exposing raw token values', () => {
    const first = createJwt({ exp: Math.floor((Date.now() + 60 * 60 * 1000) / 1000), sub: 'a' });
    const second = createJwt({ exp: Math.floor((Date.now() + 90 * 60 * 1000) / 1000), sub: 'b' });

    service.compareTokens(first, second, 'Sent Token', 'Stored Token');

    const serializedCall = JSON.stringify(debugSpy.mock.calls);

    expect(debugSpy).toHaveBeenCalledOnce();
    expect(serializedCall).toContain('tokensMatch');
    expect(serializedCall).not.toContain(first);
    expect(serializedCall).not.toContain(second);
    expect(serializedCall).not.toContain('"a"');
    expect(serializedCall).not.toContain('"b"');
  });

  it('does not log when debug logging is disabled', () => {
    environment.enableDebugLogs = false;

    service.debugToken(createJwt({ sub: 'hidden' }), 'Hidden token');

    expect(debugSpy).not.toHaveBeenCalled();
  });
});
