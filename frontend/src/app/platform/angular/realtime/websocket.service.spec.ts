import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocketService } from './websocket.service';
import { environment } from '../../../../environments/environment';
import {
  AUTH_SESSION_FACADE,
  type AuthSessionFacade,
  type AuthSessionState
} from '../../../core/auth/auth-session.facade';

describe('WebSocketService', () => {
  let service: WebSocketService;
  let tokens: AuthSessionFacade['tokens'];
  let httpGetSpy: ReturnType<typeof vi.fn>;
  const originalWebSocket = globalThis.WebSocket;
  const originalProduction = environment.production;

  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.instances = [];
    environment.production = false;
    tokens = signal<AuthSessionState | null>(null);
    httpGetSpy = vi.fn().mockReturnValue(
      of({
        data: {
          ticket: 'ws-ticket'
        }
      })
    );

    Object.defineProperty(globalThis, 'WebSocket', {
      configurable: true,
      writable: true,
      value: MockWebSocket
    });

    TestBed.configureTestingModule({
      providers: [
        WebSocketService,
        {
          provide: HttpClient,
          useValue: {
            get: httpGetSpy
          }
        },
        {
          provide: AUTH_SESSION_FACADE,
          useValue: {
            tokens,
            isAuthenticated: () => !!tokens(),
            initializeSession: () => Promise.resolve(),
            ensureAuthenticated: () => Promise.resolve(!!tokens())
          } satisfies AuthSessionFacade
        }
      ]
    });

    service = TestBed.inject(WebSocketService);
  });

  afterEach(() => {
    service.ngOnDestroy();
    TestBed.resetTestingModule();
    vi.useRealTimers();
    Object.defineProperty(globalThis, 'WebSocket', {
      configurable: true,
      writable: true,
      value: originalWebSocket
    });
    environment.production = originalProduction;
  });

  it('requests a websocket ticket immediately on the first authenticated init', async () => {
    tokens.set(createSession('user-a'));

    service.init({
      url: 'ws://localhost/realtime'
    });

    TestBed.flushEffects();
    await Promise.resolve();

    expect(httpGetSpy).toHaveBeenCalledTimes(1);
    expect(httpGetSpy.mock.calls[0]?.[0]).toContain('/Auth/ws-ticket');
  });

  it('debounces later auth-token churn after the socket has been initialized', async () => {
    tokens.set(createSession('user-a'));

    service.init({
      url: 'ws://localhost/realtime'
    });

    TestBed.flushEffects();
    await Promise.resolve();
    expect(httpGetSpy).toHaveBeenCalledTimes(1);

    httpGetSpy.mockClear();
    tokens.set(createSession('user-b'));
    TestBed.flushEffects();
    await Promise.resolve();

    expect(httpGetSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(199);
    expect(httpGetSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(httpGetSpy).toHaveBeenCalledTimes(1);
  });

  it('falls back to the legacy dev token URL when the ticket socket closes before opening', async () => {
    tokens.set(createSession('user-a'));

    service.init({
      url: 'ws://localhost/realtime'
    });

    TestBed.flushEffects();
    await Promise.resolve();

    expect(MockWebSocket.instances[0]?.url).toBe('ws://localhost/realtime?ws_ticket=ws-ticket');

    MockWebSocket.instances[0]?.emit('close');

    expect(MockWebSocket.instances).toHaveLength(2);
    expect(MockWebSocket.instances[1]?.url).toContain('ws://localhost/realtime?access_token=');
  });
});

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readonly readyState = MockWebSocket.CONNECTING;
  private readonly listeners = new Map<string, Array<(event?: unknown) => void>>();

  constructor(readonly url: string) {
    MockWebSocket.instances.push(this);
  }

  addEventListener(type: string, callback: (event?: unknown) => void): void {
    const callbacks = this.listeners.get(type) ?? [];
    callbacks.push(callback);
    this.listeners.set(type, callbacks);
  }

  emit(type: string, event?: unknown): void {
    for (const callback of this.listeners.get(type) ?? []) {
      callback(event);
    }
  }

  close(): void {}

  send(): void {}
}

function createSession(subject: string): AuthSessionState {
  return {
    accessToken: createJwt({ sub: subject }),
    expiresAt: Date.now() + 60_000
  };
}

function createJwt(payload: Record<string, unknown>): string {
  const header = { alg: 'none', typ: 'JWT' };
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode(header)}.${encode(payload)}.`;
}
