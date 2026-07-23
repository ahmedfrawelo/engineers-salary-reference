import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subscription, firstValueFrom, forkJoin } from 'rxjs';
import { ToastService } from '../../../core/notifications/toast.service';
import {
  Notification,
  NotificationCenterService
} from '../../../core/notifications/notification-center.service';
import {
  AccountNotificationsBridge,
  type NotificationMailboxMutation,
  type NotificationQueryOptions
} from '../infrastructure/account-notifications.bridge';
import {
  buildNotificationPreviewView,
  type NotificationPreviewView
} from '../../../shared/utils/notification-preview-view.util';
import {
  isExternalNotificationTarget,
  normalizeNotificationTarget,
  shouldOpenNotificationInNewContext
} from '../../../shared/utils/notification-target.util';

type ReadFilter = 'all' | 'unread' | 'read';
type InboxView = 'active' | 'archived' | 'all';

@Component({
  standalone: true,
  selector: 'feature-account-notifications-page',
  template: `
    <section class="notifications-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Account</p>
          <h1>Notifications Inbox</h1>
          <p class="lede">
            Review mentions and activity updates, then manage read state, archive, and cleanup from
            one place.
          </p>
        </div>
        <div class="page-actions">
          <button type="button" class="btn ghost" (click)="refresh()" [disabled]="loading()">
            Refresh
          </button>
          <button
            type="button"
            class="btn primary"
            (click)="markAllRead()"
            [disabled]="actionBusy() || stats().unread === 0"
          >
            Mark all read
          </button>
        </div>
      </header>

      <section class="stats-grid">
        <article class="stat-card">
          <span>Total</span>
          <strong>{{ stats().total }}</strong>
          <small>All notifications in your inbox</small>
        </article>
        <article class="stat-card">
          <span>Active</span>
          <strong>{{ stats().active }}</strong>
          <small>Visible in your current feed</small>
        </article>
        <article class="stat-card">
          <span>Unread</span>
          <strong>{{ stats().unread }}</strong>
          <small>Need your attention</small>
        </article>
        <article class="stat-card">
          <span>Archived</span>
          <strong>{{ stats().archived }}</strong>
          <small>Stored away from the active list</small>
        </article>
      </section>

      <section class="toolbar">
        <div class="toolbar-group">
          <label class="field">
            <span>Search</span>
            <input
              type="search"
              [value]="searchTerm()"
              placeholder="Search by sender, subject, or details"
              (input)="setSearchTerm($any($event.target).value || '')"
              (keydown.enter)="applyFilters()"
            />
          </label>

          <label class="field">
            <span>Read state</span>
            <select [value]="readFilter()" (change)="setReadFilter($any($event.target).value)">
              <option value="all">All</option>
              <option value="unread">Unread only</option>
              <option value="read">Read only</option>
            </select>
          </label>

          <label class="field">
            <span>View</span>
            <select [value]="viewMode()" (change)="setViewMode($any($event.target).value)">
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="all">All</option>
            </select>
          </label>
        </div>

        <div class="toolbar-group toolbar-group--actions">
          <button type="button" class="btn ghost" (click)="clearFilters()" [disabled]="loading()">
            Reset
          </button>
          <button type="button" class="btn ghost" (click)="archiveRead()" [disabled]="actionBusy()">
            Archive read
          </button>
          <button
            type="button"
            class="btn danger"
            (click)="deleteArchived()"
            [disabled]="actionBusy() || stats().archived === 0"
          >
            Clear archived
          </button>
        </div>
      </section>

      <section class="result-meta">
        <div>
          Showing <strong>{{ notifications().length }}</strong> of
          <strong>{{ totalCount() }}</strong>
        </div>
        <div>
          Page <strong>{{ pageNumber() }}</strong> / <strong>{{ totalPages() }}</strong>
        </div>
      </section>

      @if (loading()) {
        <div class="empty-state">
          <strong>Loading notifications...</strong>
          <span>Fetching the latest inbox state from the backend.</span>
        </div>
      } @else if (notifications().length === 0) {
        <div class="empty-state">
          <strong>{{ emptyTitle() }}</strong>
          <span>{{ emptyDescription() }}</span>
        </div>
      } @else {
        <section class="feed">
          @for (notificationView of notificationViews(); track notificationView.id) {
            <article class="notification-card" [class.is-unread]="!notificationView.read">
              <div
                class="notification-card__main"
                role="button"
                tabindex="0"
                [attr.aria-label]="
                  notificationView.title +
                  (notificationView.summary ? ': ' + notificationView.summary : '') +
                  (notificationView.timeLabel ? ', ' + notificationView.timeLabel : '')
                "
                (click)="openNotification(notificationView.notification, $event)"
                (auxclick)="openNotificationInNewContext(notificationView.notification, $event)"
                (keydown.enter)="
                  openNotificationFromKeyboard(notificationView.notification, $event)
                "
                (keydown.space)="
                  openNotificationFromKeyboard(notificationView.notification, $event)
                "
              >
                <div class="notification-card__meta">
                  <span class="pill pill--state" [class.pill--unread]="!notificationView.read">
                    {{ notificationView.read ? 'Read' : 'Unread' }}
                  </span>
                  @if (notificationView.notification.isArchived) {
                    <span class="pill">Archived</span>
                  }
                  @if (notificationView.contextLabel; as contextLabel) {
                    <span class="pill pill--context">{{ contextLabel }}</span>
                  }
                  <span class="pill pill--type" [attr.data-type]="notificationView.type">
                    {{ notificationTypeLabel(notificationView.notification) }}
                  </span>
                </div>

                <div class="notification-card__title-row">
                  <div class="notification-card__title-block">
                    <span
                      class="notification-card__avatar"
                      [class.notification-card__avatar--image]="
                        notificationAvatarUrl(notificationView)
                      "
                      [attr.data-type]="notificationView.type"
                      [attr.aria-label]="notificationView.avatarLabel"
                    >
                      @if (notificationAvatarUrl(notificationView); as avatarUrl) {
                        <img
                          [src]="avatarUrl"
                          [alt]="notificationView.avatarLabel"
                          loading="lazy"
                          decoding="async"
                          (error)="markNotificationAvatarFailed(avatarUrl, $event)"
                        />
                      } @else {
                        <span aria-hidden="true">{{ notificationView.avatarInitials }}</span>
                      }
                    </span>
                    <div class="notification-card__headline">
                      <h2>{{ notificationView.title }}</h2>
                      @if (notificationView.summary; as summary) {
                        <p class="summary">{{ summary }}</p>
                      }
                      @if (notificationView.message; as message) {
                        <p class="message">{{ message }}</p>
                      }
                    </div>
                  </div>
                  <span
                    class="priority"
                    [attr.data-priority]="notificationView.priority"
                    [class.priority--quiet]="!notificationView.showPriority"
                  >
                    {{ notificationView.priorityLabel }}
                  </span>
                </div>

                <div class="notification-card__footer">
                  <span
                    class="notification-card__footer-item notification-card__footer-item--actor"
                  >
                    {{ notificationView.actorLabel || 'System' }}
                  </span>
                  <span class="notification-card__footer-separator" aria-hidden="true">&bull;</span>
                  <span class="notification-card__footer-item">
                    {{ notificationView.sourceLabel }}
                  </span>
                  <span class="notification-card__footer-separator" aria-hidden="true">&bull;</span>
                  <time
                    class="notification-card__footer-item"
                    [attr.datetime]="notificationView.dateTime"
                    [attr.title]="notificationView.absoluteTimeLabel"
                  >
                    {{ notificationView.timeLabel }}
                  </time>
                  @if (notificationView.targetLabel || notificationView.referenceLabel) {
                    <span class="notification-card__footer-separator" aria-hidden="true"
                      >&bull;</span
                    >
                    <span class="notification-card__target">
                      @if (notificationView.targetLabel; as targetLabel) {
                        <span>{{ targetLabel }}</span>
                      }
                      @if (notificationView.referenceLabel; as referenceLabel) {
                        <span>{{ referenceLabel }}</span>
                      }
                    </span>
                  }
                  @if (notificationView.actionUrl) {
                    <span class="notification-card__action-hint">
                      {{ notificationView.actionLabel }}
                      <span aria-hidden="true">&rarr;</span>
                    </span>
                  }
                </div>
              </div>

              <div class="notification-card__actions">
                @if (!notificationView.read) {
                  <button
                    type="button"
                    class="btn ghost btn-sm"
                    (click)="markRead(notificationView.notification, $event)"
                    [disabled]="actionBusy()"
                  >
                    Mark read
                  </button>
                } @else {
                  <button
                    type="button"
                    class="btn ghost btn-sm"
                    (click)="markUnread(notificationView.notification, $event)"
                    [disabled]="actionBusy()"
                  >
                    Mark unread
                  </button>
                }

                @if (!notificationView.notification.isArchived) {
                  <button
                    type="button"
                    class="btn ghost btn-sm"
                    (click)="archive(notificationView.notification, $event)"
                    [disabled]="actionBusy()"
                  >
                    Archive
                  </button>
                } @else {
                  <button
                    type="button"
                    class="btn ghost btn-sm"
                    (click)="unarchive(notificationView.notification, $event)"
                    [disabled]="actionBusy()"
                  >
                    Restore
                  </button>
                }

                <button
                  type="button"
                  class="btn danger btn-sm"
                  (click)="delete(notificationView.notification, $event)"
                  [disabled]="actionBusy()"
                >
                  Delete
                </button>
              </div>
            </article>
          }
        </section>
      }

      <footer class="pager">
        <button
          type="button"
          class="btn ghost"
          (click)="goToPreviousPage()"
          [disabled]="loading() || pageNumber() <= 1"
        >
          Previous
        </button>
        <button
          type="button"
          class="btn ghost"
          (click)="goToNextPage()"
          [disabled]="loading() || pageNumber() >= totalPages()"
        >
          Next
        </button>
      </footer>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .notifications-page {
        display: flex;
        flex-direction: column;
        gap: 20px;
        padding: 20px;
        color: var(--app-color-text-body);
      }

      .page-head,
      .toolbar,
      .result-meta,
      .pager {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }

      .eyebrow {
        margin: 0 0 4px;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-size: 11px;
        color: var(--app-color-text-muted);
      }

      .page-head h1 {
        margin: 0;
        font-size: 30px;
        line-height: 1.1;
      }

      .lede {
        margin: 8px 0 0;
        max-width: 680px;
        color: var(--app-color-text-muted);
      }

      .page-actions,
      .toolbar-group {
        display: flex;
        gap: 12px;
        align-items: end;
        flex-wrap: wrap;
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 14px;
      }

      .stat-card,
      .toolbar,
      .empty-state,
      .notification-card {
        border: 1px solid var(--app-shell-control-border);
        border-radius: 18px;
        background: var(--app-shell-panel-bg);
      }

      .stat-card {
        padding: 18px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .stat-card span,
      .field span {
        font-size: 11px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--app-color-text-muted);
      }

      .stat-card strong {
        font-size: 28px;
      }

      .stat-card small {
        color: var(--app-color-text-muted);
      }

      .toolbar {
        padding: 16px;
      }

      .field {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 180px;
      }

      .field input,
      .field select {
        height: 42px;
        border: 1px solid var(--app-shell-control-border);
        border-radius: 12px;
        background: var(--app-shell-control-bg);
        color: var(--app-color-text-high);
        padding: 0 12px;
      }

      .result-meta {
        color: var(--app-color-text-muted);
        font-size: 13px;
      }

      .feed {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .notification-card {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 16px;
        padding: 18px;
      }

      .notification-card.is-unread {
        border-color: var(--app-color-primary-border);
        box-shadow: 0 0 0 1px var(--app-color-primary-focus-ring);
      }

      .notification-card__main {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-width: 0;
        cursor: pointer;
      }

      .notification-card__meta,
      .notification-card__actions {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
      }

      .notification-card__title-row {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 12px;
      }

      .notification-card__title-block {
        display: flex;
        align-items: start;
        gap: 12px;
        min-width: 0;
      }

      .notification-card__headline {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 5px;
      }

      .notification-card__avatar {
        width: 38px;
        height: 38px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        background: var(--app-shell-control-bg);
        border: 1px solid var(--app-shell-control-border);
        flex: 0 0 auto;
      }

      .notification-card__avatar img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .notification-card__avatar span {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
      }

      .notification-card__avatar--image {
        background: var(--app-shell-control-bg) !important;
      }

      .notification-card__avatar[data-type='info'] {
        background: var(--app-color-info-bg);
        color: var(--app-color-info-text);
      }

      .notification-card__avatar[data-type='success'] {
        background: var(--app-color-success-bg);
        color: var(--app-color-success-text);
      }

      .notification-card__avatar[data-type='warning'] {
        background: var(--app-color-warning-bg);
        color: var(--app-color-warning-text);
      }

      .notification-card__avatar[data-type='error'] {
        background: var(--app-color-danger-bg);
        color: var(--app-color-danger-text);
      }

      .notification-card__avatar[data-type='system'] {
        background: var(--app-color-primary-bg);
        color: var(--app-color-primary-text);
      }

      .notification-card__title-row h2 {
        margin: 0;
        font-size: 18px;
        line-height: 1.25;
      }

      .summary {
        margin: 0;
        color: var(--app-color-text-body);
        font-size: 13px;
        font-weight: 700;
        line-height: 1.45;
      }

      .message {
        margin: 0;
        color: var(--app-color-text-muted);
        line-height: 1.6;
      }

      .notification-card__footer {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        color: var(--app-color-text-muted);
        font-size: 12px;
      }

      .notification-card__footer-item {
        white-space: nowrap;
      }

      .pill,
      .priority {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 24px;
        padding: 0 10px;
        border-radius: 999px;
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        background: var(--app-shell-control-bg);
        color: var(--app-color-text-body);
      }

      .pill--state {
        background: var(--app-color-primary-bg);
        color: var(--app-color-primary-text);
      }

      .pill--unread {
        background: var(--app-color-warning-bg);
        color: var(--app-color-warning-text);
      }

      .pill--context {
        background: var(--app-shell-control-bg);
        color: var(--app-color-text-muted);
      }

      .pill--type[data-type='info'] {
        background: var(--app-color-info-bg);
        color: var(--app-color-info-text);
      }

      .pill--type[data-type='success'] {
        background: var(--app-color-success-bg);
        color: var(--app-color-success-text);
      }

      .pill--type[data-type='warning'] {
        background: var(--app-color-warning-bg);
        color: var(--app-color-warning-text);
      }

      .pill--type[data-type='error'] {
        background: var(--app-color-danger-bg);
        color: var(--app-color-danger-text);
      }

      .priority[data-priority='urgent'] {
        background: var(--app-color-danger-bg);
        color: var(--app-color-danger-text);
      }

      .priority[data-priority='high'] {
        background: var(--app-color-warning-bg);
        color: var(--app-color-warning-text);
      }

      .priority[data-priority='medium'] {
        background: var(--app-color-primary-bg);
        color: var(--app-color-primary-text);
      }

      .priority[data-priority='low'] {
        background: var(--app-color-success-bg);
        color: var(--app-color-success-text);
      }

      .priority--quiet {
        background: var(--app-shell-control-bg);
        color: var(--app-color-text-muted);
      }

      .empty-state {
        padding: 32px 20px;
        text-align: center;
        display: flex;
        flex-direction: column;
        gap: 8px;
        color: var(--app-color-text-muted);
      }

      .empty-state strong {
        color: var(--app-color-text-high);
        font-size: 18px;
      }

      .notification-card__action-hint {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        min-height: 26px;
        padding: 0 11px;
        border-radius: 999px;
        background: var(--app-color-primary-bg);
        border: 1px solid var(--app-color-primary-border);
        font-weight: 600;
        color: var(--app-color-primary-text);
      }

      .notification-card__target {
        display: inline-flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
      }

      .notification-card__target span {
        display: inline-flex;
        align-items: center;
        min-height: 24px;
        padding: 0 9px;
        border-radius: 999px;
        border: 1px solid var(--app-color-outline);
        background: var(--app-shell-control-bg);
        color: var(--app-color-text-soft);
        font-weight: 700;
      }

      .notification-card__target span:first-child {
        border-color: var(--app-color-primary-border);
        background: var(--app-color-primary-bg);
        color: var(--app-color-primary-text);
      }

      .notification-card__footer-item--actor {
        color: var(--app-color-text-high);
        font-weight: 600;
      }

      .notification-card__footer-separator {
        color: var(--app-color-text-muted);
      }

      .btn {
        height: 40px;
        border-radius: 12px;
        border: 1px solid var(--app-shell-control-border);
        padding: 0 16px;
        background: var(--app-shell-control-bg);
        color: var(--app-color-text-high);
        cursor: pointer;
      }

      .btn.primary {
        background: var(--app-color-primary-bg);
        color: var(--app-color-primary-text);
      }

      .btn.danger {
        color: var(--app-color-danger-text);
        border-color: var(--app-color-danger-border);
      }

      .btn.ghost {
        background: var(--app-shell-control-bg);
      }

      .btn-sm {
        height: 34px;
        padding: 0 12px;
      }

      .btn:disabled {
        opacity: 0.5;
        cursor: default;
      }

      @media (max-width: 900px) {
        .notification-card {
          grid-template-columns: 1fr;
        }

        .notification-card__actions {
          justify-content: flex-start;
        }
      }
    `
  ]
})
export class AccountNotificationsPageComponent implements OnInit, OnDestroy {
  private readonly bridge = inject(AccountNotificationsBridge);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly notificationCenter = inject(NotificationCenterService);
  private pageLoadSubscription: Subscription | null = null;
  private inboxChangesSubscription: Subscription | null = null;
  private searchApplyTimer: ReturnType<typeof setTimeout> | null = null;

  readonly notifications = signal<Notification[]>([]);
  readonly notificationViews = computed<NotificationPreviewView[]>(() =>
    this.notifications().map(notification => buildNotificationPreviewView(notification))
  );
  readonly stats = this.notificationCenter.stats;
  readonly loading = signal(true);
  readonly actionBusy = signal(false);
  readonly failedNotificationAvatarUrls = signal<ReadonlySet<string>>(new Set());
  readonly searchTerm = signal('');
  readonly readFilter = signal<ReadFilter>('all');
  readonly viewMode = signal<InboxView>('active');
  readonly pageNumber = signal(1);
  readonly pageSize = signal(20);
  readonly totalCount = signal(0);
  readonly totalPages = signal(1);

  readonly emptyTitle = computed(() => {
    if (this.viewMode() === 'archived') {
      return 'No archived notifications';
    }
    if (this.readFilter() === 'unread') {
      return 'No unread notifications';
    }
    if (this.readFilter() === 'read') {
      return 'No read notifications';
    }
    return 'Your inbox is clear';
  });

  readonly emptyDescription = computed(() => {
    if (this.searchTerm().trim()) {
      return 'Try a different keyword or reset the filters.';
    }
    if (this.viewMode() === 'archived') {
      return 'Archive something from the active feed and it will appear here.';
    }
    return 'New mentions and activity alerts will appear here once they reach your account.';
  });

  ngOnInit(): void {
    this.bridge.init();
    this.inboxChangesSubscription = this.bridge
      .changes$()
      .subscribe(change => this.applyBridgeMailboxMutation(change));
    this.loadPage();
  }

  ngOnDestroy(): void {
    this.pageLoadSubscription?.unsubscribe();
    this.inboxChangesSubscription?.unsubscribe();
    this.clearSearchApplyTimer();
  }

  refresh(): void {
    this.bridge.refresh();
    this.loadPage();
  }

  setSearchTerm(value: string): void {
    this.searchTerm.set(String(value ?? '').trimStart());
    this.scheduleSearchApply();
  }

  setReadFilter(value: string): void {
    this.readFilter.set(this.normalizeReadFilter(value));
    this.pageNumber.set(1);
    this.loadPage();
  }

  setViewMode(value: string): void {
    this.viewMode.set(this.normalizeViewMode(value));
    this.pageNumber.set(1);
    this.loadPage();
  }

  applyFilters(): void {
    this.clearSearchApplyTimer();
    this.pageNumber.set(1);
    this.loadPage();
  }

  clearFilters(): void {
    this.clearSearchApplyTimer();
    this.searchTerm.set('');
    this.readFilter.set('all');
    this.viewMode.set('active');
    this.pageNumber.set(1);
    this.loadPage();
  }

  goToPreviousPage(): void {
    if (this.pageNumber() <= 1) {
      return;
    }
    this.pageNumber.update(value => value - 1);
    this.loadPage();
  }

  goToNextPage(): void {
    if (this.pageNumber() >= this.totalPages()) {
      return;
    }
    this.pageNumber.update(value => value + 1);
    this.loadPage();
  }

  openNotification(notification: Notification, event?: Event): void {
    event?.stopPropagation();
    if (event && shouldOpenNotificationInNewContext(event)) {
      event.preventDefault();
      this.openNotificationTarget(notification, true);
      return;
    }

    this.openNotificationTarget(notification, false);
  }

  openNotificationInNewContext(notification: Notification, event: MouseEvent): void {
    if (event.button !== 1) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.openNotificationTarget(notification, true);
  }

  openNotificationFromKeyboard(notification: Notification, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.openNotificationTarget(notification, false);
  }

  notificationAvatarUrl(notificationView: NotificationPreviewView): string | null {
    const avatarUrl = notificationView.avatarUrl;
    if (!avatarUrl || this.failedNotificationAvatarUrls().has(avatarUrl)) {
      return null;
    }

    return avatarUrl;
  }

  markNotificationAvatarFailed(avatarUrl: string, event?: Event): void {
    const image = event?.target;
    if (image instanceof HTMLImageElement) {
      image.removeAttribute('src');
    }

    this.failedNotificationAvatarUrls.update(previous => {
      const next = new Set(previous);
      next.add(avatarUrl);
      return next;
    });
  }

  private openNotificationTarget(notification: Notification, openInNewContext: boolean): void {
    if (this.readFilter() !== 'unread' && !notification.read) {
      this.patchNotificationInCurrentPage(notification.id, current => ({
        ...current,
        read: true,
        readAt: current.readAt ?? Date.now()
      }));
    }

    this.bridge.markRead(notification.id);
    const target = normalizeNotificationTarget(notification.actionUrl);

    if (
      (openInNewContext || isExternalNotificationTarget(target)) &&
      typeof window !== 'undefined'
    ) {
      window.open(target, '_blank', 'noopener,noreferrer');
      return;
    }

    void this.router.navigateByUrl(target);
  }

  markRead(notification: Notification, event?: Event): void {
    event?.stopPropagation();
    const removedFromView = this.readFilter() === 'unread' && !notification.read;
    if (removedFromView) {
      this.removeNotificationFromCurrentPage(notification.id);
    } else if (!notification.read) {
      this.patchNotificationInCurrentPage(notification.id, current => ({
        ...current,
        read: true,
        readAt: current.readAt ?? Date.now()
      }));
    }

    this.performAction(this.bridge.markRead$(notification.id), {
      reloadPage: removedFromView && this.shouldReloadCurrentPageAfterRemoval()
    });
  }

  markUnread(notification: Notification, event?: Event): void {
    event?.stopPropagation();
    const removedFromView = this.readFilter() === 'read' && notification.read;
    if (removedFromView) {
      this.removeNotificationFromCurrentPage(notification.id);
    } else if (notification.read) {
      this.patchNotificationInCurrentPage(notification.id, current => ({
        ...current,
        read: false,
        readAt: null
      }));
    }

    this.performAction(this.bridge.markUnread$(notification.id), {
      reloadPage: removedFromView && this.shouldReloadCurrentPageAfterRemoval()
    });
  }

  archive(notification: Notification, event?: Event): void {
    event?.stopPropagation();
    const removedFromView = this.viewMode() === 'active' && !notification.isArchived;
    if (removedFromView) {
      this.removeNotificationFromCurrentPage(notification.id);
    } else if (!notification.isArchived) {
      this.patchNotificationInCurrentPage(notification.id, current => ({
        ...current,
        isArchived: true,
        archivedAt: current.archivedAt ?? Date.now()
      }));
    }

    this.performAction(this.bridge.archive$(notification.id), {
      reloadPage: removedFromView && this.shouldReloadCurrentPageAfterRemoval(),
      onSuccess: () => {
        this.toast.info('Notification archived', {
          duration: 5000,
          action: {
            label: 'Undo',
            onClick: () => this.performAction(this.bridge.unarchive$(notification.id))
          }
        });
      }
    });
  }

  unarchive(notification: Notification, event?: Event): void {
    event?.stopPropagation();
    const removedFromView = this.viewMode() === 'archived' && !!notification.isArchived;
    if (removedFromView) {
      this.removeNotificationFromCurrentPage(notification.id);
    } else if (notification.isArchived) {
      this.patchNotificationInCurrentPage(notification.id, current => ({
        ...current,
        isArchived: false,
        archivedAt: null
      }));
    }

    this.performAction(this.bridge.unarchive$(notification.id), {
      reloadPage: removedFromView && this.shouldReloadCurrentPageAfterRemoval(),
      onSuccess: () => {
        this.toast.success('Notification restored', {
          duration: 5000,
          action: {
            label: 'Undo',
            onClick: () => this.performAction(this.bridge.archive$(notification.id))
          }
        });
      }
    });
  }

  delete(notification: Notification, event?: Event): void {
    event?.stopPropagation();
    this.removeNotificationFromCurrentPage(notification.id);
    this.toast.danger('Notification deleted', {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          this.restoreNotificationToCurrentPage(notification);
        }
      },
      onExpire: () => {
        this.performAction(this.bridge.delete$(notification.id), {
          reloadPage: this.shouldReloadCurrentPageAfterRemoval()
        });
      }
    });
  }

  markAllRead(): void {
    void this.markAllReadWithUndo();
  }

  archiveRead(): void {
    void this.archiveReadWithUndo();
  }

  deleteArchived(): void {
    this.toast.danger('Delete all archived notifications?', {
      title: 'Confirm delete',
      description:
        'This permanently removes archived notifications. This will not run unless you confirm.',
      duration: 8000,
      action: {
        label: 'Delete',
        onClick: () => {
          this.performAction(this.bridge.deleteArchived$(), {
            onSuccess: () => {
              this.toast.success('Archived notifications cleared.', 2400);
            }
          });
        }
      }
    });
  }

  notificationTypeLabel(notification: Notification): string {
    const value = notification.type || 'info';
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  private performAction(
    request$: Observable<void>,
    options?: {
      onSuccess?: () => void;
      reloadPage?: boolean;
    }
  ): void {
    this.actionBusy.set(true);
    request$.subscribe({
      next: () => {
        options?.onSuccess?.();
        if (options?.reloadPage) {
          this.loadPage();
        }
      },
      error: () => {
        this.loadPage();
        this.actionBusy.set(false);
      },
      complete: () => {
        this.actionBusy.set(false);
      }
    });
  }

  private async markAllReadWithUndo(): Promise<void> {
    if (this.actionBusy()) {
      return;
    }

    const unread = await this.loadAllNotifications({
      isRead: false,
      includeArchived: true,
      onlyArchived: false
    }).catch(() => [] as Notification[]);

    if (!unread.length) {
      this.toast.info('No unread notifications to mark as read.', 2400);
      return;
    }

    const unreadIds = Array.from(new Set(unread.map(notification => notification.id)));
    const applied = await this.runAsyncAction(() => firstValueFrom(this.bridge.markAllRead$()), {
      refreshOnSuccess: false
    });
    if (!applied) {
      return;
    }

    this.toast.success('All notifications marked as read', {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          void this.runAsyncAction(
            () => firstValueFrom(forkJoin(unreadIds.map(id => this.bridge.markUnread$(id)))),
            {
              refreshOnSuccess: false,
              successMessage: 'Unread state restored.',
              errorMessage: 'Failed to undo mark-all-read.'
            }
          );
        }
      }
    });
  }

  private async archiveReadWithUndo(): Promise<void> {
    if (this.actionBusy()) {
      return;
    }

    const readNotifications = await this.loadAllNotifications({
      isRead: true,
      includeArchived: false,
      onlyArchived: false
    }).catch(() => [] as Notification[]);
    const targets = readNotifications.filter(notification => !notification.isArchived);

    if (!targets.length) {
      this.toast.info('No read notifications to archive.', 2400);
      return;
    }

    const applied = await this.runAsyncAction(() => firstValueFrom(this.bridge.archiveRead$()), {
      refreshOnSuccess: false
    });
    if (!applied) {
      return;
    }

    this.toast.success('Read notifications archived', {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          void this.runAsyncAction(
            () =>
              firstValueFrom(
                forkJoin(targets.map(notification => this.bridge.unarchive$(notification.id)))
              ),
            {
              refreshOnSuccess: false,
              successMessage: 'Archived notifications restored.',
              errorMessage: 'Failed to undo archive-read.'
            }
          );
        }
      }
    });
  }

  private loadPage(): void {
    this.clearSearchApplyTimer();
    this.loading.set(true);
    this.pageLoadSubscription?.unsubscribe();
    this.pageLoadSubscription = this.bridge.query$(this.buildQuery()).subscribe({
      next: result => {
        this.notifications.set(result.items);
        this.totalCount.set(result.totalCount);
        this.pageNumber.set(result.pageNumber);
        this.pageSize.set(result.pageSize);
        this.totalPages.set(Math.max(1, result.totalPages));
        this.loading.set(false);
      },
      error: () => {
        this.notifications.set([]);
        this.totalCount.set(0);
        this.totalPages.set(1);
        this.loading.set(false);
      }
    });
  }

  private applyBridgeMailboxMutation(change: NotificationMailboxMutation): void {
    switch (change.action) {
      case 'created':
        this.applyCreatedNotification(change.notification);
        return;
      case 'read':
      case 'unread':
      case 'archived':
      case 'unarchived':
      case 'deleted':
        this.applySingleNotificationMutation(change.action, change.notificationId);
        return;
      case 'bulk-read':
      case 'bulk-unread':
      case 'bulk-archived':
      case 'bulk-deleted':
        this.applyBulkNotificationMutation(change.action, change.affectedCount);
        return;
      case 'reload':
        if (!this.loading()) {
          this.loadPage();
        }
        return;
    }
  }

  private applyCreatedNotification(notification: Notification): void {
    if (!this.matchesCurrentView(notification)) {
      return;
    }

    const alreadyVisible = this.notifications().some(item => item.id === notification.id);
    if (!alreadyVisible) {
      this.totalCount.update(value => value + 1);
      this.totalPages.set(this.computeTotalPages(this.totalCount(), this.pageSize()));
    }

    if (this.pageNumber() !== 1) {
      return;
    }

    this.notifications.update(current =>
      [notification, ...current.filter(item => item.id !== notification.id)]
        .sort((left, right) => right.timestamp - left.timestamp)
        .slice(0, this.pageSize())
    );
  }

  private applySingleNotificationMutation(
    action: 'read' | 'unread' | 'archived' | 'unarchived' | 'deleted',
    notificationId: string
  ): void {
    const existing = this.notifications().find(notification => notification.id === notificationId);

    if (!existing) {
      if (this.shouldReloadForPotentialIncomingMutation(action)) {
        this.loadPage();
      }
      return;
    }

    switch (action) {
      case 'read':
        if (this.readFilter() === 'unread') {
          this.removeNotificationFromCurrentPage(notificationId);
        } else {
          this.patchNotificationInCurrentPage(notificationId, current => ({
            ...current,
            read: true,
            readAt: current.readAt ?? Date.now()
          }));
        }
        return;
      case 'unread':
        if (this.readFilter() === 'read') {
          this.removeNotificationFromCurrentPage(notificationId);
        } else {
          this.patchNotificationInCurrentPage(notificationId, current => ({
            ...current,
            read: false,
            readAt: null
          }));
        }
        return;
      case 'archived':
        if (this.viewMode() === 'active') {
          this.removeNotificationFromCurrentPage(notificationId);
        } else {
          this.patchNotificationInCurrentPage(notificationId, current => ({
            ...current,
            isArchived: true,
            archivedAt: current.archivedAt ?? Date.now()
          }));
        }
        return;
      case 'unarchived':
        if (this.viewMode() === 'archived') {
          this.removeNotificationFromCurrentPage(notificationId);
        } else {
          this.patchNotificationInCurrentPage(notificationId, current => ({
            ...current,
            isArchived: false,
            archivedAt: null
          }));
        }
        return;
      case 'deleted':
        this.removeNotificationFromCurrentPage(notificationId);
        return;
    }
  }

  private applyBulkNotificationMutation(
    action: 'bulk-read' | 'bulk-unread' | 'bulk-archived' | 'bulk-deleted',
    affectedCount: number
  ): void {
    switch (action) {
      case 'bulk-read':
        if (this.viewMode() === 'archived') {
          return;
        }

        if (this.readFilter() === 'read') {
          this.loadPage();
          return;
        }

        if (this.readFilter() === 'unread') {
          this.notifications.set(
            this.notifications().filter(notification => notification.isArchived || notification.read)
          );
          this.totalCount.update(value => Math.max(0, value - affectedCount));
        } else {
          this.notifications.update(current =>
            current.map(notification =>
              notification.isArchived || notification.read
                ? notification
                : { ...notification, read: true, readAt: notification.readAt ?? Date.now() }
            )
          );
        }
        this.totalPages.set(this.computeTotalPages(this.totalCount(), this.pageSize()));
        return;
      case 'bulk-unread':
        if (this.viewMode() === 'archived') {
          return;
        }

        if (this.readFilter() === 'unread') {
          this.loadPage();
          return;
        }

        if (this.readFilter() === 'read') {
          this.notifications.set(
            this.notifications().filter(notification => notification.isArchived || !notification.read)
          );
          this.totalCount.update(value => Math.max(0, value - affectedCount));
        } else {
          this.notifications.update(current =>
            current.map(notification =>
              notification.isArchived || !notification.read
                ? notification
                : { ...notification, read: false, readAt: null }
            )
          );
        }
        this.totalPages.set(this.computeTotalPages(this.totalCount(), this.pageSize()));
        return;
      case 'bulk-archived':
        if (this.viewMode() === 'archived') {
          this.loadPage();
          return;
        }

        if (this.viewMode() === 'active') {
          this.notifications.set(
            this.notifications().filter(notification => notification.isArchived || !notification.read)
          );
          this.totalCount.update(value => Math.max(0, value - affectedCount));
        } else {
          this.notifications.update(current =>
            current.map(notification =>
              notification.isArchived || !notification.read
                ? notification
                : {
                    ...notification,
                    isArchived: true,
                    archivedAt: notification.archivedAt ?? Date.now()
                  }
            )
          );
        }
        this.totalPages.set(this.computeTotalPages(this.totalCount(), this.pageSize()));
        return;
      case 'bulk-deleted':
        if (this.viewMode() === 'active') {
          return;
        }

        this.notifications.set(this.notifications().filter(notification => !notification.isArchived));
        this.totalCount.update(value => Math.max(0, value - affectedCount));
        this.totalPages.set(this.computeTotalPages(this.totalCount(), this.pageSize()));
        return;
    }
  }

  private shouldReloadForPotentialIncomingMutation(
    action: 'read' | 'unread' | 'archived' | 'unarchived' | 'deleted'
  ): boolean {
    if (this.searchTerm().trim()) {
      return true;
    }

    switch (action) {
      case 'read':
        return this.readFilter() === 'read' && this.viewMode() !== 'archived';
      case 'unread':
        return this.readFilter() === 'unread' && this.viewMode() !== 'archived';
      case 'archived':
        return this.viewMode() === 'archived' || this.viewMode() === 'all';
      case 'unarchived':
        return this.viewMode() === 'active' || this.viewMode() === 'all';
      case 'deleted':
        return false;
    }
  }

  private patchNotificationInCurrentPage(
    id: string,
    patcher: (notification: Notification) => Notification
  ): void {
    this.notifications.update(current =>
      current.map(notification =>
        notification.id === id ? patcher(notification) : notification
      )
    );
  }

  private removeNotificationFromCurrentPage(id: string): void {
    let removed = false;
    this.notifications.update(current => {
      const next = current.filter(notification => {
        const keep = notification.id !== id;
        if (!keep) {
          removed = true;
        }
        return keep;
      });
      return next;
    });

    if (!removed) {
      return;
    }

    this.totalCount.update(value => Math.max(0, value - 1));
    this.totalPages.set(this.computeTotalPages(this.totalCount(), this.pageSize()));
    if (this.pageNumber() > this.totalPages()) {
      this.pageNumber.set(this.totalPages());
    }
  }

  private restoreNotificationToCurrentPage(notification: Notification): void {
    if (!this.matchesCurrentView(notification)) {
      return;
    }

    const alreadyVisible = this.notifications().some(item => item.id === notification.id);
    this.notifications.update(current => {
      const withoutTarget = current.filter(item => item.id !== notification.id);
      return [notification, ...withoutTarget]
        .sort((left, right) => right.timestamp - left.timestamp)
        .slice(0, this.pageSize());
    });

    if (!alreadyVisible) {
      this.totalCount.update(value => value + 1);
      this.totalPages.set(this.computeTotalPages(this.totalCount(), this.pageSize()));
    }
  }

  private shouldReloadCurrentPageAfterRemoval(): boolean {
    if (this.totalCount() === 0) {
      return false;
    }

    if (this.notifications().length === 0) {
      return true;
    }

    return this.notifications().length < this.pageSize() && this.pageNumber() < this.totalPages();
  }

  private matchesCurrentView(notification: Notification): boolean {
    const viewMode = this.viewMode();
    if (viewMode === 'active' && notification.isArchived) {
      return false;
    }

    if (viewMode === 'archived' && !notification.isArchived) {
      return false;
    }

    const readFilter = this.readFilter();
    if (readFilter === 'read' && !notification.read) {
      return false;
    }

    if (readFilter === 'unread' && notification.read) {
      return false;
    }

    return this.matchesCurrentSearch(notification);
  }

  private matchesCurrentSearch(notification: Notification): boolean {
    const query = this.searchTerm().trim().toLowerCase();
    if (!query) {
      return true;
    }

    const haystack = [
      notification.title,
      notification.message,
      notification.subject,
      notification.summary,
      notification.createdByUserName,
      notification.entityType,
      notification.sourceModule,
      notification.actionLabel
    ]
      .filter((value): value is string => !!value)
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  }

  private computeTotalPages(totalCount: number, pageSize: number): number {
    return Math.max(1, Math.ceil(Math.max(0, totalCount) / Math.max(1, pageSize)));
  }

  private async loadAllNotifications(query: NotificationQueryOptions): Promise<Notification[]> {
    const pageSize = Math.max(this.pageSize(), 200);
    const initial = await firstValueFrom(
      this.bridge.query$({
        ...query,
        pageNumber: 1,
        pageSize
      })
    );

    if (initial.totalPages <= 1) {
      return initial.items;
    }

    const remainingPages = Array.from({ length: initial.totalPages - 1 }, (_, index) =>
      firstValueFrom(
        this.bridge.query$({
          ...query,
          pageNumber: index + 2,
          pageSize: initial.pageSize
        })
      )
    );

    const remaining = await Promise.all(remainingPages);
    return [initial, ...remaining].flatMap(result => result.items);
  }

  private async runAsyncAction(
    action: () => Promise<unknown>,
    options?: { successMessage?: string; errorMessage?: string; refreshOnSuccess?: boolean }
  ): Promise<boolean> {
    this.actionBusy.set(true);
    try {
      await action();
      if (options?.refreshOnSuccess ?? true) {
        this.refresh();
      }
      if (options?.successMessage) {
        this.toast.info(options.successMessage, 2200);
      }
      return true;
    } catch {
      if (options?.errorMessage) {
        this.toast.error(options.errorMessage, 4000);
      }
      return false;
    } finally {
      this.actionBusy.set(false);
    }
  }

  private buildQuery(): NotificationQueryOptions {
    const viewMode = this.viewMode();
    const readFilter = this.readFilter();

    return {
      pageNumber: this.pageNumber(),
      pageSize: this.pageSize(),
      includeArchived: viewMode === 'all',
      onlyArchived: viewMode === 'archived',
      isRead: readFilter === 'all' ? undefined : readFilter === 'read',
      searchTerm: this.searchTerm().trim() || undefined
    };
  }

  private normalizeReadFilter(value: string): ReadFilter {
    return value === 'read' || value === 'unread' ? value : 'all';
  }

  private normalizeViewMode(value: string): InboxView {
    return value === 'archived' || value === 'all' ? value : 'active';
  }

  private scheduleSearchApply(): void {
    this.clearSearchApplyTimer();
    this.searchApplyTimer = setTimeout(() => {
      this.searchApplyTimer = null;
      this.pageNumber.set(1);
      this.loadPage();
    }, 220);
  }

  private clearSearchApplyTimer(): void {
    if (!this.searchApplyTimer) {
      return;
    }

    clearTimeout(this.searchApplyTimer);
    this.searchApplyTimer = null;
  }
}
