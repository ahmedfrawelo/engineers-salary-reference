import { TestBed } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';
import { Router } from '@angular/router';
import { EMPTY, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountNotificationsPageComponent } from './account-notifications-page.component';
import { AccountNotificationsBridge } from '../infrastructure/account-notifications.bridge';
import { ToastService } from '../../../core/notifications/toast.service';
import { NotificationCenterService } from '../../../core/notifications/notification-center.service';
import type { Notification } from '../../../core/notifications/notification-center.service';

type AccountNotificationsPageHarness = {
  notifications: WritableSignal<Notification[]>;
  totalCount: WritableSignal<number>;
  totalPages: WritableSignal<number>;
  pageNumber: WritableSignal<number>;
  pageSize: WritableSignal<number>;
  viewMode: WritableSignal<'active' | 'archived'>;
  readFilter: WritableSignal<'all' | 'read' | 'unread'>;
  searchTerm: WritableSignal<string>;
  applyCreatedNotification(notification: Notification): void;
};

describe('AccountNotificationsPageComponent', () => {
  let bridgeMock: {
    init: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
    query$: ReturnType<typeof vi.fn>;
    changes$: ReturnType<typeof vi.fn>;
    getStats$: ReturnType<typeof vi.fn>;
    markRead$: ReturnType<typeof vi.fn>;
    markUnread$: ReturnType<typeof vi.fn>;
    archive$: ReturnType<typeof vi.fn>;
    unarchive$: ReturnType<typeof vi.fn>;
    delete$: ReturnType<typeof vi.fn>;
    markAllRead$: ReturnType<typeof vi.fn>;
    markAllUnread$: ReturnType<typeof vi.fn>;
    archiveRead$: ReturnType<typeof vi.fn>;
    deleteArchived$: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    bridgeMock = {
      init: vi.fn(),
      refresh: vi.fn(),
      query$: vi.fn(() =>
        of({
          items: [],
          totalCount: 0,
          pageNumber: 1,
          pageSize: 20,
          totalPages: 1,
          hasPreviousPage: false,
          hasNextPage: false
        })
      ),
      changes$: vi.fn(() => EMPTY),
      getStats$: vi.fn(() =>
        of({
          total: 0,
          active: 0,
          archived: 0,
          read: 0,
          unread: 0
        })
      ),
      markRead$: vi.fn(() => of(void 0)),
      markUnread$: vi.fn(() => of(void 0)),
      archive$: vi.fn(() => of(void 0)),
      unarchive$: vi.fn(() => of(void 0)),
      delete$: vi.fn(() => of(void 0)),
      markAllRead$: vi.fn(() => of(void 0)),
      markAllUnread$: vi.fn(() => of(void 0)),
      archiveRead$: vi.fn(() => of(void 0)),
      deleteArchived$: vi.fn(() => of(void 0))
    };

    TestBed.configureTestingModule({
      imports: [AccountNotificationsPageComponent],
      providers: [
        { provide: AccountNotificationsBridge, useValue: bridgeMock },
        { provide: Router, useValue: { navigateByUrl: vi.fn() } },
        {
          provide: ToastService,
          useValue: {
            info: vi.fn(),
            success: vi.fn(),
            warning: vi.fn(),
            error: vi.fn(),
            danger: vi.fn()
          }
        },
        {
          provide: NotificationCenterService,
          useValue: {
            stats: signal({
              total: 0,
              active: 0,
              archived: 0,
              read: 0,
              unread: 0
            })
          }
        }
      ]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('does not increment total count when a replayed created notification is already visible', () => {
    const fixture = TestBed.createComponent(AccountNotificationsPageComponent);
    const component = fixture.componentInstance as unknown as AccountNotificationsPageHarness;
    const existing = createNotification('n-1', {
      title: 'Supplier updated',
      message: 'AWAL EAMAR was updated.'
    });

    component.notifications.set([existing]);
    component.totalCount.set(1);
    component.totalPages.set(1);
    component.pageNumber.set(1);
    component.pageSize.set(20);
    component.viewMode.set('active');
    component.readFilter.set('all');
    component.searchTerm.set('');

    component.applyCreatedNotification({
      ...existing,
      message: 'AWAL EAMAR details were updated.'
    });

    expect(component.totalCount()).toBe(1);
    expect(component.notifications()).toHaveLength(1);
    expect(component.notifications()[0]?.message).toBe('AWAL EAMAR details were updated.');
  });

  it('applies created notifications only when they match the current search locally', () => {
    const fixture = TestBed.createComponent(AccountNotificationsPageComponent);
    const component = fixture.componentInstance as unknown as AccountNotificationsPageHarness;

    component.notifications.set([]);
    component.totalCount.set(0);
    component.totalPages.set(1);
    component.pageNumber.set(1);
    component.pageSize.set(20);
    component.viewMode.set('active');
    component.readFilter.set('all');
    component.searchTerm.set('supplier');

    component.applyCreatedNotification(
      createNotification('n-no-match', {
        title: 'Task updated',
        message: 'Checklist item changed.'
      })
    );

    expect(component.totalCount()).toBe(0);
    expect(component.notifications()).toEqual([]);

    component.applyCreatedNotification(
      createNotification('n-match', {
        title: 'Supplier updated',
        summary: 'AWAL EAMAR',
        message: 'Supplier details changed.'
      })
    );

    expect(component.totalCount()).toBe(1);
    expect(component.notifications().map(notification => notification.id)).toEqual(['n-match']);
  });
});

function createNotification(
  id: string,
  overrides: Partial<Notification> = {}
): Notification {
  return {
    id,
    type: 'info',
    priority: 'medium',
    title: `Notification ${id}`,
    message: `Message ${id}`,
    timestamp: Date.now(),
    read: false,
    isArchived: false,
    ...overrides
  };
}
