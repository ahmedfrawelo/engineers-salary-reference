import { TestBed } from '@angular/core/testing';
import { Subject, firstValueFrom, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signal } from '@angular/core';
import { Router } from '@angular/router';

import { NotificationsBridgeService } from './notifications-bridge.service';
import { ApiClient } from '@infrastructure/http/api-client.service';
import {
  AUTH_SESSION_FACADE,
  type AuthSessionFacade
} from '../../../core/auth/auth-session.facade';
import {
  NotificationCenterService,
  type Notification,
  type NotificationPageMeta,
  type NotificationStats
} from '../../../core/notifications/notification-center.service';
import { ToastService } from '../../../shared/toast/toast.service';
import { WebSocketService } from '../realtime/websocket.service';
import { FeatureFlagsService } from '../../../core/feature-flags/feature-flags.service';

type NotificationsBridgePrivateHarness = {
  mapNotification(raw: Record<string, unknown>): Notification | null;
  presentIncomingNotificationToast(notification: Notification): void;
};

function getPrivateHarness(service: NotificationsBridgeService): NotificationsBridgePrivateHarness {
  return service as unknown as NotificationsBridgePrivateHarness;
}

describe('NotificationsBridgeService', () => {
  let service: NotificationsBridgeService;
  let apiClientSpy: {
    get: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
  };
  let websocketSpy: {
    init: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    events: ReturnType<typeof vi.fn>;
  };
  let notificationCenterSpy: {
    replaceAll: ReturnType<typeof vi.fn>;
    syncPageMeta: ReturnType<typeof vi.fn>;
    syncServerUnreadCount: ReturnType<typeof vi.fn>;
    syncStats: ReturnType<typeof vi.fn>;
    stats: ReturnType<typeof signal>;
    getStats: ReturnType<typeof vi.fn>;
    getPageMeta: ReturnType<typeof vi.fn>;
    reconcileStats: ReturnType<typeof vi.fn>;
    markAsRead: ReturnType<typeof vi.fn>;
    markAsUnread: ReturnType<typeof vi.fn>;
    markAllAsRead: ReturnType<typeof vi.fn>;
    markAllAsUnread: ReturnType<typeof vi.fn>;
    archive: ReturnType<typeof vi.fn>;
    unarchive: ReturnType<typeof vi.fn>;
    archiveRead: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    deleteArchived: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    mergeServerNotificationsPage: ReturnType<typeof vi.fn>;
  };
  let toastSpy: {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warning: ReturnType<typeof vi.fn>;
    danger: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
  };
  let routerSpy: {
    navigateByUrl: ReturnType<typeof vi.fn>;
  };
  let authFacade: AuthSessionFacade;
  let ensureAuthenticatedSpy: ReturnType<typeof vi.fn>;
  let realtimeEvents$: Subject<unknown>;
  let statsSnapshot: NotificationStats;
  let pageMetaSnapshot: NotificationPageMeta;

  beforeEach(() => {
    realtimeEvents$ = new Subject();
    statsSnapshot = {
      total: 8,
      active: 6,
      archived: 2,
      read: 4,
      unread: 2
    };
    pageMetaSnapshot = {
      totalCount: 6,
      pageNumber: 1,
      pageSize: 20,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false
    };
    apiClientSpy = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      patch: vi.fn(),
      post: vi.fn()
    };
    apiClientSpy.put.mockReturnValue(of({}));
    apiClientSpy.delete.mockReturnValue(of({}));
    apiClientSpy.get.mockImplementation((path: string) => {
      if (typeof path === 'string' && path.includes('Notifications/stats')) {
        return of({
          data: {
            totalCount: 5,
            activeCount: 5,
            archivedCount: 0,
            readCount: 2,
            unreadCount: 3
          }
        });
      }

      if (typeof path === 'string' && path.includes('Notifications/unread-count')) {
        return of({
          data: {
            unreadCount: 3
          }
        });
      }

      if (typeof path === 'string' && path.includes('Notifications/42')) {
        return of({
          data: {
            id: 42,
            title: 'Mention',
            message: 'You were mentioned',
            notificationType: 'info',
            priority: 'high',
            actionUrl: '/account/notifications',
            actionLabel: 'Open',
            sourceModule: 'tender-activity',
            entityType: 'Comment',
            entityId: 42,
            isRead: false,
            isArchived: false,
            createdAt: '2026-04-06T15:00:00Z'
          }
        });
      }

      if (typeof path === 'string' && path.includes('Notifications/99')) {
        return of({
          data: {
            id: 99,
            title: 'Access changed',
            message: 'Your access was updated.',
            notificationType: 'system',
            priority: 'high',
            actionUrl: '/settings/account',
            actionLabel: 'Review access',
            sourceModule: 'identity',
            entityType: 'PermissionChange',
            entityId: 0,
            isRead: false,
            isArchived: false,
            createdAt: '2026-04-06T15:05:00Z'
          }
        });
      }

      if (typeof path === 'string' && path.includes('Notifications/77')) {
        return of({
          data: {
            id: 77,
            title: 'مراجعة',
            message: 'تمت العملية بنجاح رغم وجود كلمات error warning urgent داخل النص.',
            entityType: 'Unknown',
            entityId: 77,
            isRead: false,
            isArchived: false,
            createdAt: '2026-04-06T15:10:00Z'
          }
        });
      }

      return of({
        data: {
          items: [],
          totalCount: 0,
          pageNumber: 1,
          pageSize: 20,
          totalPages: 1,
          hasPreviousPage: false,
          hasNextPage: false
        }
      });
    });

    websocketSpy = {
      init: vi.fn(),
      disconnect: vi.fn(),
      events: vi.fn().mockReturnValue(realtimeEvents$)
    };

    notificationCenterSpy = {
      replaceAll: vi.fn(),
      syncPageMeta: vi.fn(),
      syncServerUnreadCount: vi.fn(),
      syncStats: vi.fn(),
      stats: signal(statsSnapshot),
      getStats: vi.fn(() => statsSnapshot),
      getPageMeta: vi.fn(() => pageMetaSnapshot),
      reconcileStats: vi.fn(),
      markAsRead: vi.fn(),
      markAsUnread: vi.fn(),
      markAllAsRead: vi.fn(),
      markAllAsUnread: vi.fn(),
      archive: vi.fn(),
      unarchive: vi.fn(),
      archiveRead: vi.fn(),
      delete: vi.fn(),
      deleteArchived: vi.fn(),
      getById: vi.fn().mockReturnValue(undefined),
      upsert: vi.fn(),
      mergeServerNotificationsPage: vi.fn()
    };

    toastSpy = {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      danger: vi.fn(),
      info: vi.fn()
    };

    routerSpy = {
      navigateByUrl: vi.fn()
    };

    ensureAuthenticatedSpy = vi.fn().mockResolvedValue(false);

    authFacade = {
      tokens: signal(null) as AuthSessionFacade['tokens'],
      isAuthenticated: () => false,
      initializeSession: () => Promise.resolve(),
      ensureAuthenticated:
        ensureAuthenticatedSpy as unknown as AuthSessionFacade['ensureAuthenticated']
    };

    TestBed.configureTestingModule({
      providers: [
        NotificationsBridgeService,
        { provide: ApiClient, useValue: apiClientSpy },
        { provide: AUTH_SESSION_FACADE, useValue: authFacade },
        { provide: NotificationCenterService, useValue: notificationCenterSpy },
        { provide: ToastService, useValue: toastSpy },
        { provide: Router, useValue: routerSpy },
        { provide: WebSocketService, useValue: websocketSpy },
        { provide: FeatureFlagsService, useValue: { isEnabled: () => true } }
      ]
    });

    service = TestBed.inject(NotificationsBridgeService);
  });

  afterEach(() => {
    realtimeEvents$.complete();
    TestBed.resetTestingModule();
  });

  it('does not initialize notifications before auth is ready and retries later', async () => {
    service.init();
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(ensureAuthenticatedSpy).toHaveBeenCalledTimes(1);
    expect(apiClientSpy.get).not.toHaveBeenCalled();
    expect(websocketSpy.init).not.toHaveBeenCalled();

    ensureAuthenticatedSpy.mockResolvedValue(true);

    service.init();
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(ensureAuthenticatedSpy).toHaveBeenCalledTimes(2);
    expect(apiClientSpy.get).toHaveBeenCalled();
    expect(websocketSpy.init).toHaveBeenCalled();
  });

  it('refreshes the preview with query plus stats only', async () => {
    ensureAuthenticatedSpy.mockResolvedValue(true);

    service.init();
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(apiClientSpy.get).toHaveBeenCalledTimes(2);
    expect(apiClientSpy.get).toHaveBeenNthCalledWith(
      1,
      'Notifications/query',
      expect.objectContaining({
        includeArchived: false,
        onlyArchived: false,
        pageNumber: 1
      }),
      expect.objectContaining({
        timeoutMs: 7500,
        retries: 0
      })
    );
    expect(apiClientSpy.get).toHaveBeenNthCalledWith(
      2,
      'Notifications/stats',
      undefined,
      expect.objectContaining({
        timeoutMs: 7500,
        retries: 0
      })
    );
    expect(notificationCenterSpy.syncStats).toHaveBeenCalledWith({
      total: 5,
      active: 5,
      archived: 0,
      read: 2,
      unread: 3
    });
  });

  it('marks the preview state as error when the notification list request fails', async () => {
    ensureAuthenticatedSpy.mockResolvedValue(true);
    apiClientSpy.get.mockImplementation((path: string) => {
      if (
        typeof path === 'string' &&
        (path.includes('Notifications/query') ||
          path.includes('Notifications/paged') ||
          path === 'Notifications')
      ) {
        return throwError(() => new Error('Notifications preview failed'));
      }

      if (typeof path === 'string' && path.includes('Notifications/stats')) {
        return of({
          data: {
            totalCount: 0,
            activeCount: 0,
            archivedCount: 0,
            readCount: 0,
            unreadCount: 0
          }
        });
      }

      return of({
        data: {
          items: [],
          totalCount: 0,
          pageNumber: 1,
          pageSize: 20,
          totalPages: 1,
          hasPreviousPage: false,
          hasNextPage: false
        }
      });
    });

    service.init();
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(service.previewState()).toBe('error');
    expect(service.previewError()).toBe('Notifications preview failed');
    expect(notificationCenterSpy.replaceAll).not.toHaveBeenCalled();
  });

  it('retries a failed preview fetch when the panel asks for a fresh preview', async () => {
    ensureAuthenticatedSpy.mockResolvedValue(true);
    let failPreview = true;
    apiClientSpy.get.mockImplementation((path: string) => {
      if (
        typeof path === 'string' &&
        (path.includes('Notifications/query') ||
          path.includes('Notifications/paged') ||
          path === 'Notifications')
      ) {
        return failPreview
          ? throwError(() => new Error('Notifications preview failed'))
          : of({
              data: {
                items: [
                  {
                    id: 901,
                    title: 'Supplier updated',
                    message: 'AWAL EAMAR was updated.',
                    notificationType: 'info',
                    entityType: 'Supplier',
                    entityId: 44,
                    isRead: false,
                    isArchived: false,
                    createdAt: '2026-04-06T15:00:00Z'
                  }
                ],
                totalCount: 1,
                pageNumber: 1,
                pageSize: 20,
                totalPages: 1,
                hasPreviousPage: false,
                hasNextPage: false
              }
            });
      }

      if (typeof path === 'string' && path.includes('Notifications/stats')) {
        return of({
          data: {
            totalCount: failPreview ? 0 : 1,
            activeCount: failPreview ? 0 : 1,
            archivedCount: 0,
            readCount: 0,
            unreadCount: failPreview ? 0 : 1
          }
        });
      }

      return of({
        data: {
          items: [],
          totalCount: 0,
          pageNumber: 1,
          pageSize: 20,
          totalPages: 1,
          hasPreviousPage: false,
          hasNextPage: false
        }
      });
    });

    service.init();
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(service.previewState()).toBe('error');

    failPreview = false;
    service.ensureFreshPreview();
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(service.previewState()).toBe('ready');
    expect(notificationCenterSpy.replaceAll).toHaveBeenCalledWith([
      expect.objectContaining({
        id: '901'
      })
    ]);
  });

  it('falls back to the legacy notifications list endpoint when the query endpoint fails', async () => {
    apiClientSpy.get.mockImplementation((path: string) => {
      if (typeof path === 'string' && path.includes('Notifications/query')) {
        return throwError(() => new Error('Query endpoint unavailable'));
      }

      if (typeof path === 'string' && path.includes('Notifications/paged')) {
        return throwError(() => new Error('Paged endpoint unavailable'));
      }

      if (typeof path === 'string' && path === 'Notifications') {
        return of([
          {
            id: 201,
            title: 'Supplier updated',
            message: 'AWAL EAMAR was updated.',
            notificationType: 'info',
            entityType: 'Supplier',
            entityId: 17,
            isRead: false,
            isArchived: false,
            createdAt: '2026-04-06T15:00:00Z'
          }
        ]);
      }

      return of({
        data: {
          totalCount: 0,
          activeCount: 0,
          archivedCount: 0,
          readCount: 0,
          unreadCount: 0
        }
      });
    });

    const result = await firstValueFrom(
      service.query$({
        pageNumber: 1,
        pageSize: 20
      })
    );

    expect(apiClientSpy.get).toHaveBeenNthCalledWith(
      1,
      'Notifications/query',
      expect.objectContaining({ pageNumber: 1, pageSize: 20 }),
      expect.objectContaining({
        timeoutMs: 7500,
        retries: 0
      })
    );
    expect(apiClientSpy.get).toHaveBeenNthCalledWith(
      2,
      'Notifications',
      expect.objectContaining({ pageNumber: 1, pageSize: 20 }),
      expect.objectContaining({
        timeoutMs: 7500,
        retries: 0
      })
    );
    expect(apiClientSpy.get).toHaveBeenCalledTimes(2);
    expect(result.items).toHaveLength(1);
    expect(result.totalCount).toBe(1);
    expect(result.items[0]?.id).toBe('201');
  });

  it('client-paginates legacy array responses when the fallback endpoint returns all notifications at once', async () => {
    apiClientSpy.get.mockImplementation((path: string) => {
      if (typeof path === 'string' && path.includes('Notifications/query')) {
        return throwError(() => new Error('Query endpoint unavailable'));
      }

      if (typeof path === 'string' && path.includes('Notifications/paged')) {
        return throwError(() => new Error('Paged endpoint unavailable'));
      }

      if (typeof path === 'string' && path === 'Notifications') {
        return of([
          {
            id: 301,
            title: 'First',
            message: 'First notification',
            notificationType: 'info',
            entityType: 'Supplier',
            entityId: 1,
            isRead: false,
            isArchived: false,
            createdAt: '2026-04-06T15:00:00Z'
          },
          {
            id: 302,
            title: 'Second',
            message: 'Second notification',
            notificationType: 'info',
            entityType: 'Supplier',
            entityId: 2,
            isRead: false,
            isArchived: false,
            createdAt: '2026-04-06T15:01:00Z'
          },
          {
            id: 303,
            title: 'Third',
            message: 'Third notification',
            notificationType: 'info',
            entityType: 'Supplier',
            entityId: 3,
            isRead: false,
            isArchived: false,
            createdAt: '2026-04-06T15:02:00Z'
          }
        ]);
      }

      return of({
        data: {
          totalCount: 0,
          activeCount: 0,
          archivedCount: 0,
          readCount: 0,
          unreadCount: 0
        }
      });
    });

    const result = await firstValueFrom(
      service.query$({
        pageNumber: 2,
        pageSize: 1
      })
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe('302');
    expect(result.totalCount).toBe(3);
    expect(result.pageNumber).toBe(2);
    expect(result.pageSize).toBe(1);
    expect(result.totalPages).toBe(3);
    expect(result.hasPreviousPage).toBe(true);
    expect(result.hasNextPage).toBe(true);
  });

  it('resets realtime lifecycle so a later login can initialize a fresh bridge', async () => {
    ensureAuthenticatedSpy.mockResolvedValue(true);

    service.init();
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(websocketSpy.init).toHaveBeenCalledTimes(1);

    service.reset();

    expect(websocketSpy.disconnect).toHaveBeenCalledTimes(1);

    apiClientSpy.get.mockClear();
    websocketSpy.init.mockClear();

    service.init();
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(ensureAuthenticatedSpy).toHaveBeenCalledTimes(2);
    expect(apiClientSpy.get).toHaveBeenCalled();
    expect(websocketSpy.init).toHaveBeenCalledTimes(1);
  });

  it('ignores realtime events after bridge reset', async () => {
    ensureAuthenticatedSpy.mockResolvedValue(true);

    service.init();
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    service.reset();
    notificationCenterSpy.upsert.mockClear();
    toastSpy.info.mockClear();

    realtimeEvents$.next({
      module: 'tender-activity',
      entityName: 'Notification',
      action: 'created',
      entityId: '42',
      channels: ['user:receiver'],
      changedFields: []
    });

    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(notificationCenterSpy.upsert).not.toHaveBeenCalled();
    expect(toastSpy.info).not.toHaveBeenCalled();
  });

  it('fetches and presents a created realtime notification', async () => {
    ensureAuthenticatedSpy.mockResolvedValue(true);

    service.init();
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    realtimeEvents$.next({
      module: 'tender-activity',
      entityName: 'Notification',
      action: 'created',
      entityId: '42',
      channels: ['user:receiver'],
      changedFields: []
    });

    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(notificationCenterSpy.upsert).toHaveBeenCalled();
    expect(toastSpy.info).toHaveBeenCalled();
  });

  it('uses an inline realtime notification snapshot without fetching by id', async () => {
    ensureAuthenticatedSpy.mockResolvedValue(true);

    service.init();
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    apiClientSpy.get.mockClear();

    realtimeEvents$.next({
      module: 'messaging',
      entityName: 'Notification',
      action: 'created',
      entityId: '500',
      channels: ['user:receiver'],
      changedFields: ['title', 'message'],
      data: {
        affectedCount: 1,
        totalDelta: 1,
        activeDelta: 1,
        archivedDelta: 0,
        readDelta: 0,
        unreadDelta: 1,
        id: 500,
        title: 'New message from Sara',
        message: 'Hello there',
        notificationType: 'info',
        priority: 'medium',
        sourceModule: 'messaging',
        entityType: 'Message',
        entityId: 88,
        actionUrl: '/messages?conversationId=12',
        actionLabel: 'Open conversation',
        isRead: false,
        isArchived: false,
        createdAt: '2026-04-06T15:20:00Z'
      }
    });

    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(notificationCenterSpy.mergeServerNotificationsPage).toHaveBeenCalled();
    expect(notificationCenterSpy.reconcileStats).toHaveBeenCalledWith(
      statsSnapshot,
      pageMetaSnapshot,
      {
        total: 1,
        active: 1,
        archived: 0,
        read: 0,
        unread: 1
      }
    );
    expect(apiClientSpy.get).not.toHaveBeenCalledWith('Notifications/500');
  });

  it('infers stats deltas for inline realtime notifications when the event omits counters', async () => {
    ensureAuthenticatedSpy.mockResolvedValue(true);

    service.init();
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    apiClientSpy.get.mockClear();

    realtimeEvents$.next({
      module: 'messaging',
      entityName: 'Notification',
      action: 'created',
      entityId: '501',
      channels: ['user:receiver'],
      changedFields: ['title', 'message'],
      data: {
        id: 501,
        title: 'New message from Sara',
        message: 'Hello there',
        notificationType: 'info',
        priority: 'medium',
        sourceModule: 'messaging',
        entityType: 'Message',
        entityId: 88,
        actionUrl: '/messages?conversationId=12',
        actionLabel: 'Open conversation',
        isRead: false,
        isArchived: false,
        createdAt: '2026-04-06T15:20:00Z'
      }
    });

    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(notificationCenterSpy.mergeServerNotificationsPage).toHaveBeenCalled();
    expect(notificationCenterSpy.reconcileStats).toHaveBeenCalledWith(
      statsSnapshot,
      pageMetaSnapshot,
      {
        total: 1,
        active: 1,
        archived: 0,
        read: 0,
        unread: 1
      }
    );
    expect(apiClientSpy.get).not.toHaveBeenCalledWith('Notifications/501');
  });

  it('does not emit duplicate created mailbox events when the same inline notification is replayed', async () => {
    ensureAuthenticatedSpy.mockResolvedValue(true);

    service.init();
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    apiClientSpy.get.mockClear();
    notificationCenterSpy.getById
      .mockReturnValueOnce(undefined)
      .mockReturnValue({
        id: '500'
      });

    const mailboxEvents: Array<{ action: string; notificationId?: string }> = [];
    const subscription = service.mailboxEvents$().subscribe(event => {
      if (event.action === 'created') {
        mailboxEvents.push({
          action: event.action,
          notificationId: event.notification.id
        });
      }
    });

    const createdEvent = {
      module: 'messaging',
      entityName: 'Notification',
      action: 'created',
      entityId: '500',
      channels: ['user:receiver'],
      changedFields: ['title', 'message'],
      data: {
        affectedCount: 1,
        totalDelta: 1,
        activeDelta: 1,
        archivedDelta: 0,
        readDelta: 0,
        unreadDelta: 1,
        id: 500,
        title: 'New message from Sara',
        message: 'Hello there',
        notificationType: 'info',
        priority: 'medium',
        sourceModule: 'messaging',
        entityType: 'Message',
        entityId: 88,
        actionUrl: '/messages?conversationId=12',
        actionLabel: 'Open conversation',
        isRead: false,
        isArchived: false,
        createdAt: '2026-04-06T15:20:00Z'
      }
    };

    realtimeEvents$.next(createdEvent);
    realtimeEvents$.next(createdEvent);

    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));
    subscription.unsubscribe();

    expect(notificationCenterSpy.mergeServerNotificationsPage).toHaveBeenCalledTimes(2);
    expect(notificationCenterSpy.reconcileStats).toHaveBeenCalledTimes(1);
    expect(mailboxEvents).toEqual([
      {
        action: 'created',
        notificationId: '500'
      }
    ]);
    expect(toastSpy.info).toHaveBeenCalledTimes(1);
    expect(apiClientSpy.get).not.toHaveBeenCalled();
  });

  it('fills creator display data from realtime event metadata when the inline snapshot omits it', async () => {
    ensureAuthenticatedSpy.mockResolvedValue(true);

    service.init();
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    realtimeEvents$.next({
      module: 'messaging',
      entityName: 'Notification',
      action: 'created',
      entityId: '501',
      initiatedByUserId: 'sender-55',
      initiatedByUserName: 'Sara Ahmed',
      channels: ['user:receiver'],
      changedFields: ['title', 'message'],
      data: {
        id: 501,
        title: 'Conversation updated',
        message: 'New activity in the thread.',
        notificationType: 'info',
        priority: 'medium',
        sourceModule: 'messaging',
        entityType: 'Message',
        entityId: 89,
        actionUrl: '/messages?conversationId=13',
        actionLabel: 'Open conversation',
        isRead: false,
        isArchived: false,
        createdAt: '2026-04-06T15:21:00Z'
      }
    });

    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(notificationCenterSpy.mergeServerNotificationsPage).toHaveBeenCalledWith([
      expect.objectContaining({
        createdByUserId: 'sender-55',
        createdByUserName: 'Sara Ahmed'
      })
    ]);
  });

  it('applies known realtime notification mutations locally without refetching the inbox', async () => {
    ensureAuthenticatedSpy.mockResolvedValue(true);

    service.init();
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    notificationCenterSpy.getById.mockReturnValue({
      id: '42'
    });

    const mutationAssertions = [
      {
        action: 'read',
        assertion: () => expect(notificationCenterSpy.markAsRead).toHaveBeenCalledWith('42')
      },
      {
        action: 'unread',
        assertion: () => expect(notificationCenterSpy.markAsUnread).toHaveBeenCalledWith('42')
      },
      {
        action: 'archived',
        assertion: () => expect(notificationCenterSpy.archive).toHaveBeenCalledWith('42')
      },
      {
        action: 'unarchived',
        assertion: () => expect(notificationCenterSpy.unarchive).toHaveBeenCalledWith('42')
      },
      {
        action: 'deleted',
        assertion: () => expect(notificationCenterSpy.delete).toHaveBeenCalledWith('42')
      }
    ];

    for (const mutation of mutationAssertions) {
      apiClientSpy.get.mockClear();
      notificationCenterSpy.markAsRead.mockClear();
      notificationCenterSpy.markAsUnread.mockClear();
      notificationCenterSpy.archive.mockClear();
      notificationCenterSpy.unarchive.mockClear();
      notificationCenterSpy.delete.mockClear();

      realtimeEvents$.next({
        module: 'tender-activity',
        entityName: 'Notification',
        action: mutation.action,
        entityId: '42',
        channels: ['user:receiver'],
        changedFields: []
      });

      await Promise.resolve();
      await new Promise(resolve => setTimeout(resolve, 0));

      mutation.assertion();
      expect(apiClientSpy.get).not.toHaveBeenCalled();
    }
  });

  it('applies bulk realtime notification mutations locally without refetching the inbox', async () => {
    ensureAuthenticatedSpy.mockResolvedValue(true);

    service.init();
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    apiClientSpy.get.mockClear();

    realtimeEvents$.next({
      module: 'tender-activity',
      entityName: 'Notification',
      action: 'bulk-read',
      channels: ['user:receiver'],
      changedFields: [],
      data: {
        affectedCount: 3
      }
    });

    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(notificationCenterSpy.markAllAsRead).toHaveBeenCalledTimes(1);
    expect(apiClientSpy.get).not.toHaveBeenCalled();
  });

  it('reconciles authoritative realtime deltas for a known single-item mutation without refetching', async () => {
    ensureAuthenticatedSpy.mockResolvedValue(true);

    service.init();
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    notificationCenterSpy.getById.mockReturnValue({
      id: '42'
    });
    notificationCenterSpy.reconcileStats.mockClear();
    apiClientSpy.get.mockClear();

    realtimeEvents$.next({
      module: 'tender-activity',
      entityName: 'Notification',
      action: 'read',
      entityId: '42',
      channels: ['user:receiver'],
      changedFields: [],
      data: {
        affectedCount: 1,
        totalDelta: 0,
        activeDelta: 0,
        archivedDelta: 0,
        readDelta: 1,
        unreadDelta: -1
      }
    });

    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(notificationCenterSpy.markAsRead).toHaveBeenCalledWith('42');
    expect(notificationCenterSpy.reconcileStats).toHaveBeenCalledWith(
      statsSnapshot,
      pageMetaSnapshot,
      {
        total: 0,
        active: 0,
        archived: 0,
        read: 1,
        unread: -1
      }
    );
    expect(apiClientSpy.get).not.toHaveBeenCalled();
  });

  it('reconciles and emits a known realtime mutation even when the preview cache misses it', async () => {
    ensureAuthenticatedSpy.mockResolvedValue(true);

    service.init();
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    notificationCenterSpy.getById.mockReturnValue(undefined);
    notificationCenterSpy.reconcileStats.mockClear();
    apiClientSpy.get.mockClear();

    const mailboxEvents: Array<{ action: string; notificationId?: string }> = [];
    const subscription = service.mailboxEvents$().subscribe(event => {
      if ('notificationId' in event) {
        mailboxEvents.push({
          action: event.action,
          notificationId: event.notificationId
        });
      }
    });

    realtimeEvents$.next({
      module: 'tender-activity',
      entityName: 'Notification',
      action: 'archived',
      entityId: '42',
      channels: ['user:receiver'],
      changedFields: [],
      data: {
        affectedCount: 1,
        totalDelta: 0,
        activeDelta: -1,
        archivedDelta: 1,
        readDelta: 0,
        unreadDelta: -1
      }
    });

    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 300));
    subscription.unsubscribe();

    expect(notificationCenterSpy.archive).not.toHaveBeenCalled();
    expect(notificationCenterSpy.reconcileStats).toHaveBeenCalledWith(
      statsSnapshot,
      pageMetaSnapshot,
      {
        total: 0,
        active: -1,
        archived: 1,
        read: 0,
        unread: -1
      }
    );
    expect(mailboxEvents).toContainEqual({
      action: 'archived',
      notificationId: '42'
    });
    expect(apiClientSpy.get).not.toHaveBeenCalled();
  });

  it('reconciles authoritative realtime deltas for bulk mutations without refetching', async () => {
    ensureAuthenticatedSpy.mockResolvedValue(true);

    service.init();
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    notificationCenterSpy.reconcileStats.mockClear();
    apiClientSpy.get.mockClear();

    realtimeEvents$.next({
      module: 'tender-activity',
      entityName: 'Notification',
      action: 'bulk-archived',
      channels: ['user:receiver'],
      changedFields: [],
      data: {
        affectedCount: 3,
        totalDelta: 0,
        activeDelta: -3,
        archivedDelta: 3,
        readDelta: -3,
        unreadDelta: 0
      }
    });

    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(notificationCenterSpy.archiveRead).toHaveBeenCalledTimes(1);
    expect(notificationCenterSpy.reconcileStats).toHaveBeenCalledWith(
      statsSnapshot,
      pageMetaSnapshot,
      {
        total: 0,
        active: -3,
        archived: 3,
        read: -3,
        unread: 0
      }
    );
    expect(apiClientSpy.get).not.toHaveBeenCalled();
  });

  it('suppresses realtime echoes for a locally-applied single notification mutation', async () => {
    ensureAuthenticatedSpy.mockResolvedValue(true);
    notificationCenterSpy.getById.mockReturnValue({ id: '42' });

    service.init();
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    await firstValueFrom(service.markRead$('42'));
    expect(notificationCenterSpy.markAsRead).toHaveBeenCalledTimes(1);

    realtimeEvents$.next({
      module: 'tender-activity',
      entityName: 'Notification',
      action: 'read',
      entityId: '42',
      channels: ['user:receiver'],
      changedFields: [],
      data: {
        affectedCount: 1
      }
    });

    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(notificationCenterSpy.markAsRead).toHaveBeenCalledTimes(1);
  });

  it('suppresses realtime echoes for a locally-applied bulk notification mutation', async () => {
    ensureAuthenticatedSpy.mockResolvedValue(true);
    apiClientSpy.put.mockReturnValue(
      of({
        data: {
          action: 'mark-read',
          affectedCount: 2,
          totalDelta: 0,
          activeDelta: 0,
          archivedDelta: 0,
          readDelta: 2,
          unreadDelta: -2
        }
      })
    );

    service.init();
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    await firstValueFrom(service.markAllRead$());
    expect(notificationCenterSpy.markAllAsRead).toHaveBeenCalledTimes(1);

    realtimeEvents$.next({
      module: 'tender-activity',
      entityName: 'Notification',
      action: 'bulk-read',
      channels: ['user:receiver'],
      changedFields: [],
      data: {
        affectedCount: 2
      }
    });

    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(notificationCenterSpy.markAllAsRead).toHaveBeenCalledTimes(1);
  });

  it('reconciles authoritative mutation deltas without refetching stats after a single action', async () => {
    ensureAuthenticatedSpy.mockResolvedValue(true);
    notificationCenterSpy.getById.mockReturnValue({
      id: '42'
    });
    apiClientSpy.put.mockReturnValue(
      of({
        data: {
          action: 'read',
          affectedCount: 1,
          entityId: 42,
          totalDelta: 0,
          activeDelta: 0,
          archivedDelta: 0,
          readDelta: 1,
          unreadDelta: -1
        }
      })
    );

    service.init();
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));
    apiClientSpy.get.mockClear();

    await firstValueFrom(service.markRead$('42'));

    expect(notificationCenterSpy.reconcileStats).toHaveBeenCalledWith(
      statsSnapshot,
      pageMetaSnapshot,
      {
        total: 0,
        active: 0,
        archived: 0,
        read: 1,
        unread: -1
      }
    );
    expect(apiClientSpy.get).not.toHaveBeenCalled();
  });

  it('reconciles authoritative bulk deltas without refetching stats after bulk read', async () => {
    ensureAuthenticatedSpy.mockResolvedValue(true);
    apiClientSpy.put.mockReturnValue(
      of({
        data: {
          action: 'mark-read',
          affectedCount: 2,
          totalDelta: 0,
          activeDelta: 0,
          archivedDelta: 0,
          readDelta: 2,
          unreadDelta: -2
        }
      })
    );

    service.init();
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));
    apiClientSpy.get.mockClear();

    await firstValueFrom(service.markAllRead$());

    expect(notificationCenterSpy.reconcileStats).toHaveBeenCalledWith(
      statsSnapshot,
      pageMetaSnapshot,
      {
        total: 0,
        active: 0,
        archived: 0,
        read: 2,
        unread: -2
      }
    );
    expect(apiClientSpy.get).not.toHaveBeenCalled();
  });

  it('dedupes duplicate realtime created events while the detail request is in flight', async () => {
    ensureAuthenticatedSpy.mockResolvedValue(true);

    service.init();
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    const detail$ = new Subject<unknown>();
    apiClientSpy.get.mockClear();
    apiClientSpy.get.mockImplementation((path: string) => {
      if (typeof path === 'string' && path.includes('Notifications/43')) {
        return detail$.asObservable();
      }

      return of({
        data: {
          items: [],
          totalCount: 0,
          pageNumber: 1,
          pageSize: 20,
          totalPages: 1,
          hasPreviousPage: false,
          hasNextPage: false
        }
      });
    });

    const event = {
      module: 'tender-activity',
      entityName: 'Notification',
      action: 'created',
      entityId: '43',
      channels: ['user:receiver'],
      changedFields: []
    };

    realtimeEvents$.next(event);
    realtimeEvents$.next(event);

    expect(apiClientSpy.get).toHaveBeenCalledTimes(1);

    detail$.next({
      data: {
        id: 43,
        title: 'Supplier updated',
        message: 'AWAL EAMAR was updated.',
        notificationType: 'info',
        priority: 'high',
        actionUrl: '/tender/suppliers?supplierId=43&panel=supplier',
        actionLabel: 'Open',
        sourceModule: 'tendering',
        entityType: 'Supplier',
        entityId: 43,
        isRead: false,
        isArchived: false,
        createdAt: '2026-04-06T15:00:00Z'
      }
    });
    detail$.complete();
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(notificationCenterSpy.upsert).toHaveBeenCalledTimes(1);
    expect(toastSpy.info).toHaveBeenCalledTimes(1);
    expect(apiClientSpy.get).toHaveBeenCalledTimes(1);
  });

  it('suppresses realtime toast for identity system notifications', async () => {
    ensureAuthenticatedSpy.mockResolvedValue(true);

    service.init();
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    realtimeEvents$.next({
      module: 'identity',
      entityName: 'Notification',
      action: 'created',
      entityId: '99',
      channels: ['user:receiver'],
      changedFields: []
    });

    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(notificationCenterSpy.upsert).toHaveBeenCalled();
    expect(toastSpy.info).not.toHaveBeenCalled();
    expect(toastSpy.success).not.toHaveBeenCalled();
    expect(toastSpy.warning).not.toHaveBeenCalled();
    expect(toastSpy.error).not.toHaveBeenCalled();
    expect(toastSpy.danger).not.toHaveBeenCalled();
  });

  it('uses realtime module as source fallback and suppresses identity system toasts case-insensitively', async () => {
    ensureAuthenticatedSpy.mockResolvedValue(true);

    service.init();
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    realtimeEvents$.next({
      module: 'Identity',
      entityName: 'Notification',
      action: 'created',
      entityId: '199',
      channels: ['user:receiver'],
      changedFields: ['title', 'message'],
      data: {
        id: 199,
        title: 'Workspace sign-in',
        message: 'A user signed in.',
        entityType: 'AccountLifecycle',
        isRead: false,
        isArchived: false,
        createdAt: '2026-04-06T15:00:00Z'
      }
    });

    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(notificationCenterSpy.mergeServerNotificationsPage).toHaveBeenCalledWith([
      expect.objectContaining({
        id: '199',
        sourceModule: 'Identity',
        type: 'system',
        priority: 'high'
      })
    ]);
    expect(toastSpy.info).not.toHaveBeenCalled();
    expect(toastSpy.success).not.toHaveBeenCalled();
    expect(toastSpy.warning).not.toHaveBeenCalled();
    expect(toastSpy.error).not.toHaveBeenCalled();
    expect(toastSpy.danger).not.toHaveBeenCalled();
  });

  it('maps project and official notifications to exact in-app targets', () => {
    const mapNotification = getPrivateHarness(service).mapNotification.bind(
      service
    ) as NotificationsBridgePrivateHarness['mapNotification'];

    const projectNotification = mapNotification({
      id: 501,
      title: 'Project updated',
      message: 'Riyadh Metro was updated in tender projects.',
      notificationType: 'info',
      entityType: 'Project',
      entityId: 88,
      actionLabel: 'Open',
      isRead: false,
      isArchived: false,
      createdAt: '2026-04-06T15:00:00Z'
    });

    const officialNotification = mapNotification({
      id: 502,
      title: 'Official updated',
      message: 'Hany Mostafa was updated in supplier officials.',
      notificationType: 'info',
      entityType: 'Official',
      entityId: 42,
      actionLabel: 'Open',
      isRead: false,
      isArchived: false,
      createdAt: '2026-04-06T15:00:00Z'
    });

    if (!projectNotification || !officialNotification) {
      throw new Error('Expected backend notifications to map to in-app notifications.');
    }

    expect(projectNotification.actionUrl).toBe('/tender/projects?projectId=88&panel=details');
    expect(projectNotification.actionLabel).toBe('Open project details');
    expect(projectNotification.metadata?.subject).toBe('Riyadh Metro');

    expect(officialNotification.actionUrl).toBe('/tender/suppliers?officialId=42&panel=official');
    expect(officialNotification.actionLabel).toBe('Open official details');
    expect(officialNotification.metadata?.subject).toBe('Hany Mostafa');
  });

  it('preserves explicit backend subject and summary fields', () => {
    const mapNotification = getPrivateHarness(service).mapNotification.bind(
      service
    ) as NotificationsBridgePrivateHarness['mapNotification'];

    const notification = mapNotification({
      id: 700,
      title: 'New message from Rahma Ali',
      message: 'Please review supplier #17 today.',
      subject: 'Rahma Ali',
      summary: 'New direct message',
      notificationType: 'info',
      entityType: 'Message',
      entityId: 12,
      actionUrl: '/messages?conversationId=12',
      actionLabel: 'Open conversation',
      sourceModule: 'messaging',
      isRead: false,
      isArchived: false,
      createdAt: '2026-04-06T15:00:00Z'
    });

    expect(notification?.subject).toBe('Rahma Ali');
    expect(notification?.summary).toBe('New direct message');
    expect(notification?.metadata?.subject).toBe('Rahma Ali');
    expect(notification?.metadata?.summary).toBe('New direct message');
  });

  it('skips stats refresh after a known single-item mutation because local state is already updated', async () => {
    notificationCenterSpy.getById.mockReturnValue({
      id: '42'
    });
    apiClientSpy.put.mockReturnValue(
      of({
        data: {
          action: 'read',
          affectedCount: 1,
          entityId: 42,
          totalDelta: 0,
          activeDelta: 0,
          archivedDelta: 0,
          readDelta: 1,
          unreadDelta: -1
        }
      })
    );

    await firstValueFrom(service.markRead$('42'));
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(notificationCenterSpy.markAsRead).toHaveBeenCalledWith('42');
    expect(apiClientSpy.put).toHaveBeenCalledWith('Notifications/42/read', {});
    expect(notificationCenterSpy.reconcileStats).toHaveBeenCalledWith(
      statsSnapshot,
      pageMetaSnapshot,
      {
        total: 0,
        active: 0,
        archived: 0,
        read: 1,
        unread: -1
      }
    );
    expect(apiClientSpy.get).not.toHaveBeenCalled();
  });

  it('reconciles fallback stats deltas after a mutation succeeds when the notification is not cached locally', async () => {
    notificationCenterSpy.getById.mockReturnValue(undefined);
    apiClientSpy.put.mockReturnValue(of({}));
    notificationCenterSpy.getStats.mockReturnValueOnce(statsSnapshot).mockReturnValueOnce({
      total: 8,
      active: 6,
      archived: 2,
      read: 5,
      unread: 1
    });

    await firstValueFrom(service.markRead$('42'));
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(apiClientSpy.put).toHaveBeenCalledWith('Notifications/42/read', {});
    expect(notificationCenterSpy.reconcileStats).toHaveBeenCalledWith(
      statsSnapshot,
      pageMetaSnapshot,
      {
        total: 0,
        active: 0,
        archived: 0,
        read: 1,
        unread: -1
      }
    );
    expect(apiClientSpy.get).not.toHaveBeenCalled();
  });

  it('normalizes entity type and numeric id variants before resolving action targets', () => {
    const mapNotification = getPrivateHarness(service).mapNotification.bind(
      service
    ) as NotificationsBridgePrivateHarness['mapNotification'];

    const taskItemNotification = mapNotification({
      id: 601,
      title: 'Task item updated',
      message: 'Checklist item was updated.',
      notificationType: 'info',
      entityType: 'Task Item',
      entityId: '8',
      actionUrl: '/tasks?taskId=77',
      isRead: false,
      isArchived: false,
      createdAt: '2026-04-06T15:00:00Z'
    });

    const supplierConnectionNotification = mapNotification({
      id: 602,
      title: 'Material connection updated',
      message: 'Supplier material connection was updated.',
      notificationType: 'info',
      entityType: 'supplier_material_category_connection',
      entityId: '44',
      isRead: false,
      isArchived: false,
      createdAt: '2026-04-06T15:00:00Z'
    });

    expect(taskItemNotification?.actionUrl).toBe('/tasks?taskId=77&taskItemId=8');
    expect(supplierConnectionNotification?.actionUrl).toBe(
      '/tender/suppliers?connectionId=44&panel=item'
    );
  });

  it('resolves missing backend action urls to concrete workspace targets', () => {
    const mapNotification = getPrivateHarness(service).mapNotification.bind(
      service
    ) as NotificationsBridgePrivateHarness['mapNotification'];

    const messageNotification = mapNotification({
      id: 603,
      title: 'Conversation updated',
      message: 'New activity in the thread.',
      notificationType: 'info',
      entityType: 'Message',
      entityId: '13',
      isRead: false,
      isArchived: false,
      createdAt: '2026-04-06T15:00:00Z'
    });

    const crmNotification = mapNotification({
      id: 604,
      title: 'Company note updated',
      message: 'A CRM company note was updated.',
      notificationType: 'info',
      entityType: 'CrmCompanyNote',
      entityId: 42,
      isRead: false,
      isArchived: false,
      createdAt: '2026-04-06T15:00:00Z'
    });

    const materialNotification = mapNotification({
      id: 605,
      title: 'Material updated',
      message: 'A material was updated.',
      notificationType: 'info',
      entityType: 'Material',
      entityId: 7,
      isRead: false,
      isArchived: false,
      createdAt: '2026-04-06T15:00:00Z'
    });

    const lifecycleNotification = mapNotification({
      id: 606,
      title: 'Account created',
      message: 'A user joined the workspace.',
      notificationType: 'system',
      entityType: 'AccountLifecycle',
      isRead: false,
      isArchived: false,
      createdAt: '2026-04-06T15:00:00Z'
    });

    expect(messageNotification?.actionUrl).toBe('/messages?conversationId=13');
    expect(crmNotification?.actionUrl).toBe('/crm/companies/42');
    expect(materialNotification?.actionUrl).toBe('/tender/material-classification');
    expect(lifecycleNotification?.actionUrl).toBe('/settings/access-control');
  });

  it('presents realtime toast copy with derived headline, summary, and action label', () => {
    const presentIncomingNotificationToast = getPrivateHarness(
      service
    ).presentIncomingNotificationToast.bind(
      service
    ) as NotificationsBridgePrivateHarness['presentIncomingNotificationToast'];

    presentIncomingNotificationToast({
      id: 'supplier-17',
      type: 'info',
      priority: 'medium',
      title: 'Supplier updated',
      message: 'AWAL EAMR was updated in tender suppliers.',
      timestamp: Date.now(),
      read: false,
      isArchived: false,
      createdByUserName: 'Rahma Ali',
      entityType: 'Supplier',
      actionLabel: 'Open',
      actionUrl: '/tender/suppliers?supplierId=17&panel=supplier'
    });

    expect(toastSpy.info).toHaveBeenCalledWith(
      'AWAL EAMR',
      expect.objectContaining({
        description: 'Supplier updated. Updated in tender suppliers.',
        action: expect.objectContaining({
          label: 'Open supplier details'
        })
      })
    );
  });

  it('does not infer type or priority from message text when backend contract omits them', async () => {
    const notification = await firstValueFrom(service.getById$('77'));

    expect(notification).not.toBeNull();
    expect(notification?.type).toBe('info');
    expect(notification?.priority).toBe('medium');
  });

  it('uses short non-retrying request options for notification reads so the UI falls back quickly', async () => {
    await firstValueFrom(
      service.query$({
        pageNumber: 1,
        pageSize: 20
      })
    );

    expect(apiClientSpy.get).toHaveBeenNthCalledWith(
      1,
      'Notifications/query',
      expect.objectContaining({ pageNumber: 1, pageSize: 20 }),
      expect.objectContaining({
        timeoutMs: 7500,
        retries: 0
      })
    );

    await firstValueFrom(service.getStats$());

    expect(apiClientSpy.get).toHaveBeenCalledWith(
      'Notifications/stats',
      undefined,
      expect.objectContaining({
        timeoutMs: 7500,
        retries: 0
      })
    );
  });

  it('exposes the configured preview page size for compact panel pagination', () => {
    expect(service.previewPageSize).toBe(20);
  });
});
