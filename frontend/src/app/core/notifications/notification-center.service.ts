import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AUTH_SESSION_FACADE, type AuthSessionFacade } from '@core/auth/auth-session.facade';
import {
  type LooseValue,
  type Notification,
  type NotificationFilter,
  type NotificationPageMeta,
  type NotificationPriority,
  type NotificationStats,
  type NotificationType,
  DEFAULT_NOTIFICATION_PAGE_META,
  DEFAULT_NOTIFICATION_STATS
} from './models/notification.models';
import {
  buildNotificationStorageKey,
  getLegacyNotificationStorageKey,
  resolveNotificationStorageOwner
} from './utils/notification-storage.util';
import {
  formatNotificationDisplaySubject,
  formatNotificationDisplayTitle,
  formatNotificationMessage
} from './utils/notification-presentation.util';

export type {
  Notification,
  NotificationFilter,
  NotificationPageMeta,
  NotificationPriority,
  NotificationStats,
  NotificationType
} from './models/notification.models';

export interface NotificationStatsDelta {
  total: number;
  active: number;
  archived: number;
  read: number;
  unread: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationCenterService {
  private readonly authFacade = inject<AuthSessionFacade>(AUTH_SESSION_FACADE);
  private readonly maxNotifications = 2000;
  private readonly browserNotificationDedupeMs = 5 * 60 * 1000;
  private readonly storageFlushTimeoutMs = 200;

  private readonly storageOwner = signal<string | null>(null);
  private readonly _notifications = signal<Notification[]>([]);
  private readonly _serverUnreadCount = signal<number | null>(null);
  private readonly _stats = signal<NotificationStats>({ ...DEFAULT_NOTIFICATION_STATS });
  private readonly _pageMeta = signal<NotificationPageMeta>(DEFAULT_NOTIFICATION_PAGE_META);
  private readonly _hydratedFromServer = signal(false);
  private storageWriteQueued = false;
  private pendingStorageWrite: { ownerKey: string; notifications: Notification[] } | null = null;
  private storageFlushHandle: number | ReturnType<typeof setTimeout> | null = null;
  private browserPermissionRequest: Promise<NotificationPermission> | null = null;
  private readonly browserNotificationDisplayTimes = new Map<string, number>();

  readonly notifications = this._notifications.asReadonly();
  readonly stats = this._stats.asReadonly();
  readonly pageMeta = this._pageMeta.asReadonly();
  readonly hydratedFromServer = this._hydratedFromServer.asReadonly();

  readonly activeNotifications = computed(() =>
    this._notifications().filter(notification => !notification.isArchived)
  );

  readonly archivedNotifications = computed(() =>
    this._notifications().filter(notification => notification.isArchived)
  );

  readonly unreadCount = computed(() => {
    const serverUnreadCount = this._serverUnreadCount();
    return serverUnreadCount ?? this._stats().unread;
  });

  readonly unreadNotifications = computed(() =>
    this.activeNotifications().filter(notification => !notification.read)
  );

  readonly urgentNotifications = computed(() =>
    this.activeNotifications().filter(
      notification => notification.priority === 'urgent' && !notification.read
    )
  );

  readonly hasUnread = computed(() => this.unreadCount() > 0);

  constructor() {
    effect(() => {
      const ownerKey = resolveNotificationStorageOwner(this.authFacade.tokens()?.accessToken);
      if (ownerKey === this.storageOwner()) {
        return;
      }

      this.hydrateNotificationsForOwner(ownerKey);
    });
  }

  add(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): void {
    const newNotification =
      this.normalizeNotification({
        id: this.generateId(),
        timestamp: Date.now(),
        read: false,
        isArchived: false,
        ...notification
      }) ?? this.createFallbackNotification();

    const previous = this._notifications();
    const updated = [newNotification, ...previous].slice(0, this.maxNotifications);
    this.setNotifications(updated);
    this.applyLocalMutation(previous, updated);

    if (this.shouldShowBrowserNotification(newNotification)) {
      void this.showBrowserNotification(newNotification);
    }
  }

  replaceAll(notifications: Notification[]): void {
    const normalized = this.normalizeNotifications(notifications).slice(0, this.maxNotifications);
    this.setNotifications(normalized);

    if (!this._hydratedFromServer()) {
      this._stats.set(this.summarize(normalized));
    }
  }

  upsert(notification: Notification): void {
    if (!notification?.id) {
      return;
    }

    this.upsertMany([notification]);
  }

  upsertMany(incoming: Notification[]): void {
    this.mergeNotifications(incoming, {
      adjustCounters: true,
      notifyNewUrgent: true
    });
  }

  mergeServerNotificationsPage(incoming: Notification[]): void {
    this.mergeNotifications(incoming, {
      adjustCounters: false,
      notifyNewUrgent: false
    });
  }

  private mergeNotifications(
    incoming: Notification[],
    options: {
      adjustCounters: boolean;
      notifyNewUrgent: boolean;
    }
  ): void {
    if (!Array.isArray(incoming) || incoming.length === 0) {
      return;
    }

    const previous = this._notifications();
    const byId = new Map(previous.map(item => [item.id, item]));
    const newUrgent: Notification[] = [];

    for (const rawItem of incoming) {
      const item = this.normalizeNotification(rawItem);
      if (!item) {
        continue;
      }

      const existing = byId.get(item.id);
      const merged = existing ? { ...existing, ...item } : item;
      byId.set(item.id, merged);

      if (
        options.notifyNewUrgent &&
        !existing &&
        this.shouldShowBrowserNotification(merged) &&
        !merged.read &&
        !merged.isArchived
      ) {
        newUrgent.push(merged);
      }
    }

    const mergedList = Array.from(byId.values())
      .sort((left, right) => right.timestamp - left.timestamp)
      .slice(0, this.maxNotifications);

    this.setNotifications(mergedList);
    if (options.adjustCounters) {
      this.applyLocalMutation(previous, mergedList);
    }

    newUrgent.forEach(notification => {
      void this.showBrowserNotification(notification);
    });
  }

  syncServerUnreadCount(count: number | null): void {
    this._serverUnreadCount.set(
      typeof count === 'number' && Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : null
    );
  }

  syncStats(stats: Partial<NotificationStats> | null | undefined): void {
    if (!stats) {
      this._stats.set(this.summarize(this._notifications()));
      this._serverUnreadCount.set(null);
      this._hydratedFromServer.set(false);
      return;
    }

    this._stats.set({
      total: this.normalizeCount(stats.total),
      active: this.normalizeCount(stats.active),
      archived: this.normalizeCount(stats.archived),
      read: this.normalizeCount(stats.read),
      unread: this.normalizeCount(stats.unread)
    });

    if (typeof stats.unread === 'number' && Number.isFinite(stats.unread)) {
      this._serverUnreadCount.set(Math.max(0, Math.trunc(stats.unread)));
    }

    this._hydratedFromServer.set(true);
  }

  syncPageMeta(meta: Partial<NotificationPageMeta> | null | undefined): void {
    if (!meta) {
      this._pageMeta.set(DEFAULT_NOTIFICATION_PAGE_META);
      return;
    }

    const pageSize =
      this.normalizeCount(meta.pageSize || DEFAULT_NOTIFICATION_PAGE_META.pageSize) ||
      DEFAULT_NOTIFICATION_PAGE_META.pageSize;
    const totalCount = this.normalizeCount(meta.totalCount);
    const pageNumber =
      this.normalizeCount(meta.pageNumber || DEFAULT_NOTIFICATION_PAGE_META.pageNumber) || 1;
    const totalPages =
      this.normalizeCount(meta.totalPages) ||
      Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize)));

    this._pageMeta.set({
      totalCount,
      pageNumber,
      pageSize,
      totalPages,
      hasPreviousPage:
        typeof meta.hasPreviousPage === 'boolean' ? meta.hasPreviousPage : pageNumber > 1,
      hasNextPage:
        typeof meta.hasNextPage === 'boolean' ? meta.hasNextPage : pageNumber < totalPages
    });
  }

  markAsRead(id: string): void {
    this.updateOne(id, notification =>
      notification.read
        ? notification
        : { ...notification, read: true, readAt: notification.readAt ?? Date.now() }
    );
  }

  markAsUnread(id: string): void {
    this.updateOne(id, notification =>
      !notification.read ? notification : { ...notification, read: false, readAt: null }
    );
  }

  markAllAsRead(): void {
    this.updateMany(notification =>
      notification.isArchived || notification.read
        ? notification
        : { ...notification, read: true, readAt: notification.readAt ?? Date.now() }
    );
  }

  markAllAsUnread(): void {
    this.updateMany(notification =>
      notification.isArchived || !notification.read
        ? notification
        : { ...notification, read: false, readAt: null }
    );
  }

  archive(id: string): void {
    this.updateOne(id, notification =>
      notification.isArchived
        ? notification
        : {
            ...notification,
            isArchived: true,
            archivedAt: notification.archivedAt ?? Date.now()
          }
    );
  }

  unarchive(id: string): void {
    this.updateOne(id, notification =>
      !notification.isArchived
        ? notification
        : { ...notification, isArchived: false, archivedAt: null }
    );
  }

  archiveRead(): void {
    this.updateMany(notification =>
      notification.isArchived || !notification.read
        ? notification
        : {
            ...notification,
            isArchived: true,
            archivedAt: notification.archivedAt ?? Date.now()
          }
    );
  }

  delete(id: string): void {
    const previous = this._notifications();
    const updated = previous.filter(notification => notification.id !== id);

    if (updated.length === previous.length) {
      return;
    }

    this.setNotifications(updated);
    this.applyLocalMutation(previous, updated);
  }

  deleteAll(): void {
    const previous = this._notifications();
    if (previous.length === 0) {
      return;
    }

    this.setNotifications([]);
    this.applyLocalMutation(previous, []);
  }

  deleteRead(): void {
    const previous = this._notifications();
    const updated = previous.filter(notification => !notification.read);

    if (updated.length === previous.length) {
      return;
    }

    this.setNotifications(updated);
    this.applyLocalMutation(previous, updated);
  }

  deleteArchived(): void {
    const previous = this._notifications();
    const updated = previous.filter(notification => !notification.isArchived);

    if (updated.length === previous.length) {
      return;
    }

    this.setNotifications(updated);
    this.applyLocalMutation(previous, updated);
  }

  filter(filter: NotificationFilter): Notification[] {
    let filtered = this._notifications();

    if (filter.type) {
      filtered = filtered.filter(notification => notification.type === filter.type);
    }

    if (filter.priority) {
      filtered = filtered.filter(notification => notification.priority === filter.priority);
    }

    if (filter.unreadOnly) {
      filtered = filtered.filter(notification => !notification.read);
    }

    if (filter.archivedOnly) {
      filtered = filtered.filter(notification => notification.isArchived);
    }

    if (filter.startDate) {
      filtered = filtered.filter(
        notification => notification.timestamp >= filter.startDate!.getTime()
      );
    }

    if (filter.endDate) {
      filtered = filtered.filter(
        notification => notification.timestamp <= filter.endDate!.getTime()
      );
    }

    return filtered;
  }

  search(query: string): Notification[] {
    const normalizedQuery = String(query ?? '')
      .trim()
      .toLowerCase();
    if (!normalizedQuery) {
      return this._notifications();
    }

    return this._notifications().filter(notification => {
      const haystack = [
        notification.title,
        notification.message,
        notification.createdByUserName,
        notification.entityType,
        notification.sourceModule
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }

  getById(id: string): Notification | undefined {
    return this._notifications().find(notification => notification.id === id);
  }

  getByType(type: NotificationType): Notification[] {
    return this._notifications().filter(notification => notification.type === type);
  }

  getRecent(count = 5): Notification[] {
    return this.activeNotifications().slice(0, Math.max(0, count));
  }

  getStats(): NotificationStats {
    return this._stats();
  }

  getPageMeta(): NotificationPageMeta {
    return this._pageMeta();
  }

  reconcileStats(
    previousStats: NotificationStats,
    previousPageMeta: NotificationPageMeta,
    delta: NotificationStatsDelta
  ): void {
    const nextStats: NotificationStats = {
      total: Math.max(0, this.normalizeCount(previousStats.total) + delta.total),
      active: Math.max(0, this.normalizeCount(previousStats.active) + delta.active),
      archived: Math.max(0, this.normalizeCount(previousStats.archived) + delta.archived),
      read: Math.max(0, this.normalizeCount(previousStats.read) + delta.read),
      unread: Math.max(0, this.normalizeCount(previousStats.unread) + delta.unread)
    };

    this._stats.set(nextStats);

    const serverUnreadCount = this._serverUnreadCount();
    if (serverUnreadCount !== null) {
      this._serverUnreadCount.set(Math.max(0, serverUnreadCount + delta.unread));
    }

    this.reconcilePageMeta(previousPageMeta, delta.active);
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (typeof Notification === 'undefined') {
      return 'denied';
    }

    if (Notification.permission !== 'default') {
      return Notification.permission;
    }

    if (!this.browserPermissionRequest) {
      this.browserPermissionRequest = Notification.requestPermission().finally(() => {
        this.browserPermissionRequest = null;
      });
    }

    return this.browserPermissionRequest;
  }

  cleanOld(daysToKeep = 30): void {
    const cutoffDate = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
    const previous = this._notifications();
    const updated = previous.filter(
      notification => notification.timestamp > cutoffDate || !notification.read
    );

    if (updated.length === previous.length) {
      return;
    }

    this.setNotifications(updated);
    this.applyLocalMutation(previous, updated);
  }

  private updateOne(id: string, updater: (notification: Notification) => Notification): void {
    const previous = this._notifications();
    let changed = false;

    const updated = previous.map(notification => {
      if (notification.id !== id) {
        return notification;
      }

      const next = this.normalizeNotification(updater(notification)) ?? notification;
      changed = changed || !this.areNotificationsEqual(notification, next);
      return next;
    });

    if (!changed) {
      return;
    }

    this.setNotifications(updated);
    this.applyLocalMutation(previous, updated);
  }

  private updateMany(updater: (notification: Notification) => Notification): void {
    const previous = this._notifications();
    let changed = false;

    const updated = previous.map(notification => {
      const next = this.normalizeNotification(updater(notification)) ?? notification;
      changed = changed || !this.areNotificationsEqual(notification, next);
      return next;
    });

    if (!changed) {
      return;
    }

    this.setNotifications(updated);
    this.applyLocalMutation(previous, updated);
  }

  private applyLocalMutation(previous: Notification[], next: Notification[]): void {
    const previousStats = this.summarize(previous);
    const nextStats = this.summarize(next);

    if (this._hydratedFromServer()) {
      const unreadDelta = nextStats.unread - previousStats.unread;
      const archivedDelta = nextStats.archived - previousStats.archived;
      const readDelta = nextStats.read - previousStats.read;
      const totalDelta = nextStats.total - previousStats.total;
      const activeDelta = nextStats.active - previousStats.active;

      this._stats.update(stats => ({
        total: Math.max(0, stats.total + totalDelta),
        active: Math.max(0, stats.active + activeDelta),
        archived: Math.max(0, stats.archived + archivedDelta),
        read: Math.max(0, stats.read + readDelta),
        unread: Math.max(0, stats.unread + unreadDelta)
      }));

      const serverUnreadCount = this._serverUnreadCount();
      if (serverUnreadCount !== null) {
        this._serverUnreadCount.set(Math.max(0, serverUnreadCount + unreadDelta));
      }

      this.adjustPageMetaActiveTotal(activeDelta);
      return;
    }

    this._stats.set(nextStats);
  }

  private adjustPageMetaActiveTotal(activeDelta: number): void {
    if (!activeDelta) {
      return;
    }

    const current = this._pageMeta();
    const pageSize =
      Math.max(
        1,
        this.normalizeCount(current.pageSize || DEFAULT_NOTIFICATION_PAGE_META.pageSize)
      ) || DEFAULT_NOTIFICATION_PAGE_META.pageSize;
    const totalCount = Math.max(0, this.normalizeCount(current.totalCount) + activeDelta);
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const pageNumber = Math.min(
      Math.max(
        1,
        this.normalizeCount(current.pageNumber || DEFAULT_NOTIFICATION_PAGE_META.pageNumber) || 1
      ),
      totalPages
    );

    this._pageMeta.set({
      ...current,
      totalCount,
      pageNumber,
      totalPages,
      hasPreviousPage: pageNumber > 1,
      hasNextPage: pageNumber < totalPages
    });
  }

  private reconcilePageMeta(previousMeta: NotificationPageMeta, activeDelta: number): void {
    if (!activeDelta) {
      return;
    }

    const pageSize =
      Math.max(
        1,
        this.normalizeCount(previousMeta.pageSize || DEFAULT_NOTIFICATION_PAGE_META.pageSize)
      ) || DEFAULT_NOTIFICATION_PAGE_META.pageSize;
    const totalCount = Math.max(0, this.normalizeCount(previousMeta.totalCount) + activeDelta);
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const pageNumber = Math.min(
      Math.max(
        1,
        this.normalizeCount(previousMeta.pageNumber || DEFAULT_NOTIFICATION_PAGE_META.pageNumber) || 1
      ),
      totalPages
    );

    this._pageMeta.set({
      ...previousMeta,
      totalCount,
      pageNumber,
      totalPages,
      hasPreviousPage: pageNumber > 1,
      hasNextPage: pageNumber < totalPages
    });
  }

  private summarize(notifications: Notification[]): NotificationStats {
    return notifications.reduce<NotificationStats>(
      (summary, notification) => {
        summary.total += 1;

        if (notification.isArchived) {
          summary.archived += 1;
          return summary;
        }

        summary.active += 1;
        if (notification.read) {
          summary.read += 1;
        } else {
          summary.unread += 1;
        }

        return summary;
      },
      { ...DEFAULT_NOTIFICATION_STATS }
    );
  }

  private shouldShowBrowserNotification(notification: Notification): boolean {
    if (
      notification.read ||
      notification.isArchived ||
      this.wasBrowserNotificationDisplayed(notification)
    ) {
      return false;
    }

    if (notification.priority === 'urgent' || notification.priority === 'high') {
      return true;
    }

    return typeof document !== 'undefined' && document.visibilityState === 'hidden';
  }

  private wasBrowserNotificationDisplayed(notification: Notification): boolean {
    const displayedAt = this.browserNotificationDisplayTimes.get(
      this.getBrowserNotificationKey(notification)
    );
    if (typeof displayedAt !== 'number') {
      return false;
    }

    if (Date.now() - displayedAt <= this.browserNotificationDedupeMs) {
      return true;
    }

    this.browserNotificationDisplayTimes.delete(this.getBrowserNotificationKey(notification));
    return false;
  }

  private markBrowserNotificationDisplayed(notification: Notification): void {
    this.browserNotificationDisplayTimes.set(
      this.getBrowserNotificationKey(notification),
      Date.now()
    );

    if (this.browserNotificationDisplayTimes.size <= this.maxNotifications) {
      return;
    }

    const cutoff = Date.now() - this.browserNotificationDedupeMs;
    for (const [id, displayedAt] of this.browserNotificationDisplayTimes) {
      if (displayedAt < cutoff) {
        this.browserNotificationDisplayTimes.delete(id);
      }
    }
  }

  private async showBrowserNotification(notification: Notification): Promise<void> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    const BrowserNotification = window.Notification;
    if (
      BrowserNotification.permission !== 'granted' ||
      this.wasBrowserNotificationDisplayed(notification)
    ) {
      return;
    }

    let browserNotification: globalThis.Notification;
    const title =
      this.pickString(formatNotificationDisplayTitle(notification), notification.title) ||
      'Notification';
    const subject = this.pickString(formatNotificationDisplaySubject(notification));
    const detail = this.pickString(formatNotificationMessage(notification), notification.message);
    const body =
      [subject, detail].filter(Boolean).join('. ') ||
      this.pickString(notification.message, notification.title);
    try {
      browserNotification = new BrowserNotification(title, {
        body,
        icon: notification.icon || notification.createdByUserAvatarUrl || '/favicon.ico',
        tag: this.getBrowserNotificationKey(notification)
      });
      this.markBrowserNotificationDisplayed(notification);
    } catch {
      return;
    }

    browserNotification.onclick = () => {
      try {
        browserNotification.close?.();
      } catch {
        // Ignore browser notification close errors to keep navigation responsive.
      }

      this.openBrowserNotificationTarget(notification.actionUrl);
    };
  }

  private getBrowserNotificationKey(notification: Notification): string {
    return notification.serverId ? `notification-${notification.serverId}` : notification.id;
  }

  private openBrowserNotificationTarget(actionUrl?: string | null): void {
    if (typeof window === 'undefined') {
      return;
    }

    const target = this.pickString(actionUrl, '/account/notifications');

    try {
      window.focus?.();
    } catch {
      // Focus may be blocked by the browser; navigation should still proceed.
    }

    if (/^https?:\/\//i.test(target)) {
      window.open(target, '_blank', 'noopener,noreferrer');
      return;
    }

    const normalized = target.startsWith('/') ? target : `/${target}`;
    window.open(normalized, '_self');
  }

  private createFallbackNotification(): Notification {
    return {
      id: this.generateId(),
      timestamp: Date.now(),
      read: false,
      isArchived: false,
      type: 'info',
      priority: 'medium',
      title: 'Notification',
      message: ''
    };
  }

  private setNotifications(notifications: Notification[]): void {
    this._notifications.set(notifications);
    this.queueStorageSave(this.storageOwner(), notifications);
  }

  private hydrateNotificationsForOwner(ownerKey: string | null): void {
    this.storageOwner.set(ownerKey);

    const notifications = ownerKey ? this.loadFromStorage(ownerKey) : [];
    this._notifications.set(notifications);
    this._stats.set(this.summarize(notifications));
    this._serverUnreadCount.set(null);
    this._hydratedFromServer.set(false);
    this._pageMeta.set(DEFAULT_NOTIFICATION_PAGE_META);
  }

  private loadFromStorage(ownerKey: string): Notification[] {
    if (!ownerKey || typeof window === 'undefined' || !window.localStorage) {
      return [];
    }

    try {
      const scopedKey = buildNotificationStorageKey(ownerKey);
      const stored = window.localStorage.getItem(scopedKey);
      const legacyStored =
        stored === null ? window.localStorage.getItem(getLegacyNotificationStorageKey()) : null;
      const source = stored ?? legacyStored;

      if (!source) {
        return [];
      }

      if (!stored && legacyStored) {
        window.localStorage.setItem(scopedKey, legacyStored);
        window.localStorage.removeItem(getLegacyNotificationStorageKey());
      }

      const parsed = JSON.parse(source);
      return this.normalizeNotifications(parsed);
    } catch {
      return [];
    }
  }

  private saveToStorage(ownerKey: string | null, notifications: Notification[]): void {
    if (!ownerKey || typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      window.localStorage.setItem(
        buildNotificationStorageKey(ownerKey),
        JSON.stringify(notifications)
      );
    } catch {
      // Ignore storage quota failures to keep the UI responsive.
    }
  }

  private queueStorageSave(ownerKey: string | null, notifications: Notification[]): void {
    if (!ownerKey || typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    this.pendingStorageWrite = { ownerKey, notifications };
    if (this.storageWriteQueued) {
      return;
    }

    this.storageWriteQueued = true;
    this.scheduleStorageFlush();
  }

  private scheduleStorageFlush(): void {
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      this.storageFlushHandle = window.requestIdleCallback(
        () => {
          this.storageFlushHandle = null;
          this.flushQueuedStorageSave();
        },
        { timeout: this.storageFlushTimeoutMs }
      );
      return;
    }

    this.storageFlushHandle = setTimeout(() => {
      this.storageFlushHandle = null;
      this.flushQueuedStorageSave();
    }, 0);
  }

  private flushQueuedStorageSave(): void {
    this.storageWriteQueued = false;
    const pending = this.pendingStorageWrite;
    this.pendingStorageWrite = null;
    if (pending) {
      this.saveToStorage(pending.ownerKey, pending.notifications);
    }
  }

  private normalizeNotifications(value: unknown): Notification[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map(item => this.normalizeNotification(item))
      .filter((item): item is Notification => !!item)
      .sort((left, right) => right.timestamp - left.timestamp);
  }

  private normalizeNotification(raw: unknown): Notification | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return null;
    }

    const record = raw as Record<string, unknown>;
    const idValue = record['id'] ?? record['notificationId'] ?? record['serverId'];
    const title = this.pickString(record['title'], record['subject'], 'Notification');
    const message = this.pickString(record['message'], record['body'], '');
    const type = this.normalizeType(record['type'] ?? record['notificationType']);
    const priority = this.normalizePriority(record['priority']);
    const timestamp = this.normalizeTimestamp(record['timestamp'] ?? record['createdAt']);
    const read = this.normalizeRead(record['read'] ?? record['isRead']);
    const isArchived = this.normalizeBoolean(record['isArchived'] ?? record['archived']);

    return {
      id: idValue ? String(idValue) : this.generateId(),
      serverId: this.normalizeOptionalNumber(record['serverId'] ?? record['id']) ?? undefined,
      type,
      priority,
      title,
      message,
      timestamp,
      read,
      isArchived,
      receiverUserId: this.pickString(record['receiverUserId']),
      createdByUserId: this.pickString(record['createdByUserId']),
      createdByUserName: this.pickString(record['createdByUserName']),
      createdByUserAvatarUrl: this.pickString(record['createdByUserAvatarUrl']),
      subject: this.pickOptionalString(record['subject']),
      summary: this.pickOptionalString(record['summary']),
      entityType: this.pickString(record['entityType']),
      entityId: this.normalizeOptionalNumber(record['entityId']),
      readAt: this.normalizeOptionalTimestamp(record['readAt']),
      archivedAt: this.normalizeOptionalTimestamp(record['archivedAt']),
      actionUrl: this.pickString(record['actionUrl'], record['url'], record['link']),
      actionLabel: this.pickString(record['actionLabel'], record['cta']),
      icon: this.pickString(record['icon']),
      sourceModule: this.pickString(record['sourceModule']),
      metadata:
        record['metadata'] &&
        typeof record['metadata'] === 'object' &&
        !Array.isArray(record['metadata'])
          ? (record['metadata'] as Record<string, LooseValue>)
          : undefined
    };
  }

  private pickString(...values: unknown[]): string {
    for (const value of values) {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) {
          return trimmed;
        }
      }
    }

    return '';
  }

  private pickOptionalString(...values: unknown[]): string | null {
    const value = this.pickString(...values);
    return value || null;
  }

  private normalizeRead(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value > 0;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (!normalized) {
        return false;
      }

      if (['false', '0', 'no', 'unread'].includes(normalized)) {
        return false;
      }

      return true;
    }

    return Boolean(value);
  }

  private normalizeBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value > 0;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (!normalized) {
        return false;
      }

      return ['true', '1', 'yes', 'y', 'archived'].includes(normalized);
    }

    return Boolean(value);
  }

  private normalizeTimestamp(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value < 1_000_000_000_000 ? value * 1000 : value;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return Date.now();
      }

      const numeric = Number(trimmed);
      if (Number.isFinite(numeric)) {
        return this.normalizeTimestamp(numeric);
      }

      const parsed = Date.parse(trimmed);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }

    if (value instanceof Date) {
      return value.getTime();
    }

    return Date.now();
  }

  private normalizeOptionalTimestamp(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    return this.normalizeTimestamp(value);
  }

  private normalizeOptionalNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.trunc(value);
    }

    if (typeof value === 'string') {
      const numeric = Number(value.trim());
      if (Number.isFinite(numeric)) {
        return Math.trunc(numeric);
      }
    }

    return null;
  }

  private normalizeType(value: unknown): NotificationType {
    const normalized = this.pickString(value).toLowerCase();
    if (
      normalized === 'info' ||
      normalized === 'success' ||
      normalized === 'warning' ||
      normalized === 'error' ||
      normalized === 'system'
    ) {
      return normalized;
    }

    return 'info';
  }

  private normalizePriority(value: unknown): NotificationPriority {
    const normalized = this.pickString(value).toLowerCase();
    if (
      normalized === 'low' ||
      normalized === 'medium' ||
      normalized === 'high' ||
      normalized === 'urgent'
    ) {
      return normalized;
    }

    return 'medium';
  }

  private normalizeCount(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(0, Math.trunc(value));
    }

    if (typeof value === 'string') {
      const numeric = Number(value.trim());
      if (Number.isFinite(numeric)) {
        return Math.max(0, Math.trunc(numeric));
      }
    }

    return 0;
  }

  private areNotificationsEqual(left: Notification, right: Notification): boolean {
    return (
      left.id === right.id &&
      left.serverId === right.serverId &&
      left.type === right.type &&
      left.priority === right.priority &&
      left.title === right.title &&
      left.message === right.message &&
      left.timestamp === right.timestamp &&
      left.read === right.read &&
      left.isArchived === right.isArchived &&
      left.receiverUserId === right.receiverUserId &&
      left.createdByUserId === right.createdByUserId &&
      left.createdByUserName === right.createdByUserName &&
      left.createdByUserAvatarUrl === right.createdByUserAvatarUrl &&
      left.subject === right.subject &&
      left.summary === right.summary &&
      left.entityType === right.entityType &&
      left.entityId === right.entityId &&
      left.readAt === right.readAt &&
      left.archivedAt === right.archivedAt &&
      left.actionUrl === right.actionUrl &&
      left.actionLabel === right.actionLabel &&
      left.icon === right.icon &&
      left.sourceModule === right.sourceModule &&
      JSON.stringify(left.metadata ?? null) === JSON.stringify(right.metadata ?? null)
    );
  }

  private generateId(): string {
    return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}
