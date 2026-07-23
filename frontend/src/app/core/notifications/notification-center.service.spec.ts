import { TestBed, getTestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting
} from '@angular/platform-browser-dynamic/testing';
import { describe, beforeEach, afterEach, expect, it, vi } from 'vitest';
import { NotificationCenterService } from './notification-center.service';
import {
  AUTH_SESSION_FACADE,
  type AuthSessionFacade,
  type AuthSessionState
} from '@core/auth/auth-session.facade';
import {
  buildNotificationStorageKey,
  getLegacyNotificationStorageKey
} from './utils/notification-storage.util';

const notificationInstances: MockBrowserNotification[] = [];

try {
  getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
} catch (error) {
  const message = error instanceof Error ? error.message : '';
  if (!message.includes('NG0400') && !message.includes('already been called')) {
    throw error;
  }
}

describe('NotificationCenterService', () => {
  let service: NotificationCenterService;
  let tokens: AuthSessionFacade['tokens'];
  const originalNotification = globalThis.Notification;
  const originalRequestIdleCallback = window.requestIdleCallback;
  const originalCancelIdleCallback = window.cancelIdleCallback;
  let openSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    tokens = signal<AuthSessionState | null>(null);
    notificationInstances.length = 0;
    openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      writable: true,
      value: MockBrowserNotification
    });
    MockBrowserNotification.permission = 'granted';
    MockBrowserNotification.requestPermission.mockResolvedValue('granted');

    TestBed.configureTestingModule({
      providers: [
        NotificationCenterService,
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
  });

  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    openSpy.mockRestore();
    Object.defineProperty(window, 'requestIdleCallback', {
      configurable: true,
      writable: true,
      value: originalRequestIdleCallback
    });
    Object.defineProperty(window, 'cancelIdleCallback', {
      configurable: true,
      writable: true,
      value: originalCancelIdleCallback
    });
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      writable: true,
      value: originalNotification
    });
  });

  it('stores notifications per authenticated user and reloads the correct inbox on user switch', async () => {
    tokens.set(createSession('user-a'));
    service = TestBed.inject(NotificationCenterService);
    await settleEffects();

    service.add({
      type: 'info',
      priority: 'medium',
      title: 'User A notification',
      message: 'Scoped to user A'
    });
    await settleEffects();

    const userAKey = buildNotificationStorageKey('user-a');
    expect(localStorage.getItem(userAKey)).toContain('User A notification');
    expect(service.notifications()).toHaveLength(1);

    tokens.set(createSession('user-b'));
    await settleEffects();

    expect(service.notifications()).toEqual([]);

    service.add({
      type: 'success',
      priority: 'high',
      title: 'User B notification',
      message: 'Scoped to user B'
    });
    await settleEffects();

    const userBKey = buildNotificationStorageKey('user-b');
    expect(localStorage.getItem(userBKey)).toContain('User B notification');
    expect(localStorage.getItem(userBKey)).not.toContain('User A notification');

    tokens.set(createSession('user-a'));
    await settleEffects();

    expect(service.notifications()).toHaveLength(1);
    expect(service.notifications()[0]?.title).toBe('User A notification');
  });

  it('migrates legacy notification storage into the authenticated user scope', async () => {
    const legacyPayload = JSON.stringify([
      {
        id: 'legacy-1',
        title: 'Legacy notification',
        message: 'Migrated from shared storage',
        type: 'info',
        priority: 'medium',
        timestamp: Date.now(),
        read: false,
        isArchived: false
      }
    ]);

    localStorage.setItem(getLegacyNotificationStorageKey(), legacyPayload);
    tokens.set(createSession('user-a'));
    service = TestBed.inject(NotificationCenterService);
    await settleEffects();

    const scopedKey = buildNotificationStorageKey('user-a');
    const migrated = JSON.parse(localStorage.getItem(scopedKey) ?? '[]') as Array<{
      title?: string;
      message?: string;
    }>;
    expect(migrated).toHaveLength(1);
    expect(migrated[0]?.title).toBe('Legacy notification');
    expect(migrated[0]?.message).toBe('Migrated from shared storage');
    expect(localStorage.getItem(getLegacyNotificationStorageKey())).toBeNull();
    expect(service.notifications()).toHaveLength(1);
    expect(service.notifications()[0]?.title).toBe('Legacy notification');
  });

  it('does not inflate unread counters when older server pages are merged into the preview cache', async () => {
    tokens.set(createSession('user-a'));
    service = TestBed.inject(NotificationCenterService);
    await settleEffects();

    service.replaceAll([createNotification('n-1', false)]);
    service.syncStats({
      total: 3,
      active: 3,
      archived: 0,
      read: 2,
      unread: 1
    });
    service.syncServerUnreadCount(1);

    service.mergeServerNotificationsPage([
      createNotification('n-2', false),
      createNotification('n-3', true)
    ]);

    expect(service.notifications().map(notification => notification.id)).toEqual([
      'n-3',
      'n-2',
      'n-1'
    ]);
    expect(service.stats().unread).toBe(1);
    expect(service.unreadCount()).toBe(1);
  });

  it('falls back to local unread counts when server stats are unavailable', async () => {
    tokens.set(createSession('user-a'));
    service = TestBed.inject(NotificationCenterService);
    await settleEffects();

    service.replaceAll([createNotification('n-1', false), createNotification('n-2', true)]);
    service.syncStats({
      total: 20,
      active: 20,
      archived: 0,
      read: 10,
      unread: 10
    });
    service.syncServerUnreadCount(10);

    service.syncStats(null);

    expect(service.stats().unread).toBe(1);
    expect(service.unreadCount()).toBe(1);
  });

  it('preserves creator avatar urls when notifications are normalized', async () => {
    tokens.set(createSession('user-a'));
    service = TestBed.inject(NotificationCenterService);
    await settleEffects();

    service.replaceAll([
      {
        ...createNotification('n-avatar', false),
        createdByUserName: 'Rahma Ali',
        createdByUserAvatarUrl: '/assets/users/rahma.png'
      }
    ]);

    expect(service.notifications()[0]?.createdByUserAvatarUrl).toBe('/assets/users/rahma.png');
  });

  it('still increments unread counters for newly pushed realtime notifications', async () => {
    tokens.set(createSession('user-a'));
    service = TestBed.inject(NotificationCenterService);
    await settleEffects();

    service.replaceAll([createNotification('n-1', false)]);
    service.syncPageMeta({
      totalCount: 1,
      pageNumber: 1,
      pageSize: 20,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false
    });
    service.syncStats({
      total: 1,
      active: 1,
      archived: 0,
      read: 0,
      unread: 1
    });
    service.syncServerUnreadCount(1);

    service.upsertMany([createNotification('n-2', false)]);

    expect(service.stats().unread).toBe(2);
    expect(service.unreadCount()).toBe(2);
    expect(service.pageMeta().totalCount).toBe(2);
  });

  it('reconciles unread server count from the current authoritative baseline', async () => {
    tokens.set(createSession('user-a'));
    service = TestBed.inject(NotificationCenterService);
    await settleEffects();

    service.replaceAll([createNotification('n-1', false)]);
    service.syncStats({
      total: 5,
      active: 5,
      archived: 0,
      read: 2,
      unread: 3
    });
    service.syncServerUnreadCount(9);

    service.reconcileStats(
      {
        total: 5,
        active: 5,
        archived: 0,
        read: 2,
        unread: 3
      },
      {
        totalCount: 5,
        pageNumber: 1,
        pageSize: 20,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false
      },
      {
        total: 0,
        active: 0,
        archived: 0,
        read: 1,
        unread: -1
      }
    );

    expect(service.stats().unread).toBe(2);
    expect(service.unreadCount()).toBe(8);
  });

  it('shows browser notifications for high-priority unread notifications', async () => {
    tokens.set(createSession('user-a'));
    service = TestBed.inject(NotificationCenterService);
    await settleEffects();

    service.upsertMany([
      {
        ...createNotification('n-high', false),
        priority: 'high'
      }
    ]);
    await settleEffects();

    expect(notificationInstances).toHaveLength(1);
    expect(notificationInstances[0]?.title).toBe('Notification n-high');
    expect(notificationInstances[0]?.options?.tag).toBe('n-high');
  });

  it('formats browser notification copy from structured subject and summary when available', async () => {
    tokens.set(createSession('user-a'));
    service = TestBed.inject(NotificationCenterService);
    await settleEffects();

    service.upsertMany([
      {
        ...createNotification('n-message', false),
        title: 'New message from Rahma Ali',
        message: 'Please review supplier #17 today.',
        subject: 'Rahma Ali',
        summary: 'New direct message',
        createdByUserName: 'Rahma Ali',
        entityType: 'Message',
        sourceModule: 'Messaging',
        priority: 'high'
      }
    ]);
    await settleEffects();

    expect(notificationInstances).toHaveLength(1);
    expect(notificationInstances[0]?.title).toBe('Rahma Ali');
    expect(notificationInstances[0]?.options?.body).toBe(
      'New direct message. Please review supplier #17 today.'
    );
  });

  it('dedupes browser notifications by server id when local ids differ', async () => {
    tokens.set(createSession('user-a'));
    service = TestBed.inject(NotificationCenterService);
    await settleEffects();

    service.upsertMany([
      {
        ...createNotification('local-a', false),
        serverId: 500,
        priority: 'high'
      }
    ]);
    await settleEffects();

    service.upsertMany([
      {
        ...createNotification('local-b', false),
        serverId: 500,
        priority: 'high'
      }
    ]);
    await settleEffects();

    expect(notificationInstances).toHaveLength(1);
    expect(notificationInstances[0]?.options?.tag).toBe('notification-500');
  });

  it('coalesces concurrent browser notification permission requests', async () => {
    tokens.set(createSession('user-a'));
    service = TestBed.inject(NotificationCenterService);
    MockBrowserNotification.permission = 'default';

    const first = service.requestPermission();
    const second = service.requestPermission();
    await Promise.all([first, second]);

    expect(MockBrowserNotification.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('opens the notification target when the browser notification is clicked', async () => {
    tokens.set(createSession('user-a'));
    service = TestBed.inject(NotificationCenterService);
    await settleEffects();

    service.add({
      type: 'info',
      priority: 'urgent',
      title: 'Supplier updated',
      message: 'Open the supplier details',
      actionUrl: '/tender/suppliers'
    });
    await settleEffects();

    expect(notificationInstances).toHaveLength(1);

    notificationInstances[0]?.onclick?.(new Event('click'));

    expect(openSpy).toHaveBeenCalledWith('/tender/suppliers', '_self');
    expect(notificationInstances[0]?.close).toHaveBeenCalled();
  });

  it('defers notification storage writes until idle when requestIdleCallback is available', async () => {
    tokens.set(createSession('user-a'));
    const idleCallbacks: Array<() => void> = [];
    Object.defineProperty(window, 'requestIdleCallback', {
      configurable: true,
      writable: true,
      value: vi.fn((callback: IdleRequestCallback) => {
        idleCallbacks.push(() =>
          callback({
            didTimeout: false,
            timeRemaining: () => 12
          } as IdleDeadline)
        );
        return idleCallbacks.length;
      })
    });
    Object.defineProperty(window, 'cancelIdleCallback', {
      configurable: true,
      writable: true,
      value: vi.fn()
    });

    service = TestBed.inject(NotificationCenterService);
    await settleEffects();

    service.add({
      type: 'info',
      priority: 'medium',
      title: 'Idle write notification',
      message: 'Deferred until idle'
    });

    const storageKey = buildNotificationStorageKey('user-a');
    expect(localStorage.getItem(storageKey)).toBeNull();
    expect(idleCallbacks).toHaveLength(1);

    idleCallbacks[0]?.();

    expect(localStorage.getItem(storageKey)).toContain('Idle write notification');
  });
});

class MockBrowserNotification {
  static permission: NotificationPermission = 'default';
  static requestPermission = vi.fn<() => Promise<NotificationPermission>>();

  onclick: ((ev: Event) => unknown) | null = null;
  readonly close = vi.fn();

  constructor(
    readonly title: string,
    readonly options?: NotificationOptions
  ) {
    notificationInstances.push(this);
  }
}

function createSession(subject: string): AuthSessionState {
  return {
    accessToken: createJwt({ sub: subject }),
    expiresAt: Date.now() + 60_000
  };
}

const fixedTestTimestamp = new Date('2026-04-28T08:00:00Z').getTime();

function createNotification(id: string, read: boolean) {
  const index = Number(id.replace(/\D+/g, '')) || 1;
  return {
    id,
    type: 'info' as const,
    priority: 'medium' as const,
    title: `Notification ${id}`,
    message: `Message ${id}`,
    timestamp: fixedTestTimestamp + index,
    read,
    isArchived: false
  };
}

function createJwt(payload: Record<string, unknown>): string {
  const header = toBase64Url({ alg: 'none', typ: 'JWT' });
  const body = toBase64Url(payload);
  return `${header}.${body}.signature`;
}

function toBase64Url(value: Record<string, unknown>): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function settleEffects(): Promise<void> {
  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
}
