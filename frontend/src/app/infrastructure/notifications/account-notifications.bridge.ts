import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';
import { type NotificationStats } from '@core/notifications/notification-center.service';
import {
  type NotificationMailboxMutation,
  NotificationsBridgeService,
  type NotificationPageResult,
  type NotificationQueryOptions
} from '@platform/angular/notifications/notifications-bridge.service';

@Injectable({ providedIn: 'root' })
export class AccountNotificationsBridge {
  private readonly bridge = inject(NotificationsBridgeService);

  init(): void {
    this.bridge.init();
  }

  refresh(): void {
    this.bridge.refresh();
  }

  markRead(id: string): void {
    this.bridge.markRead(id);
  }

  query$(query: NotificationQueryOptions = {}): Observable<NotificationPageResult> {
    return this.bridge.query$(query);
  }

  changes$(): Observable<NotificationMailboxMutation> {
    return this.bridge.mailboxEvents$();
  }

  getStats$(): Observable<NotificationStats> {
    return this.bridge.getStats$();
  }

  markRead$(id: string): Observable<void> {
    return this.bridge.markRead$(id);
  }

  markUnread$(id: string): Observable<void> {
    return this.bridge.markUnread$(id);
  }

  archive$(id: string): Observable<void> {
    return this.bridge.archive$(id);
  }

  unarchive$(id: string): Observable<void> {
    return this.bridge.unarchive$(id);
  }

  delete$(id: string): Observable<void> {
    return this.bridge.delete$(id);
  }

  markAllRead$(): Observable<void> {
    return this.bridge.markAllRead$();
  }

  markAllUnread$(): Observable<void> {
    return this.bridge.markAllUnread$();
  }

  archiveRead$(): Observable<void> {
    return this.bridge.archiveRead$();
  }

  deleteArchived$(): Observable<void> {
    return this.bridge.deleteArchived$();
  }
}

export type { NotificationMailboxMutation, NotificationPageResult, NotificationQueryOptions };
