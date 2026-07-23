import {
  Component,
  effect,
  signal,
  HostListener,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  ElementRef,
  PLATFORM_ID,
  inject,
  computed,
  Injector
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { HugeiconsIconComponent, type IconSvgObject } from '@hugeicons/angular';
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  File02Icon,
  LayoutLeftIcon,
  Moon02Icon,
  Notification03Icon,
  Search01Icon,
  Settings02Icon,
  SidebarToggleIcon,
  ShoppingCartIcon,
  Sun03Icon,
  UserCircleIcon,
  UserIcon,
  ViewSidebarRightIcon
} from '@shared/icons/app-icon.registry';
import {
  Router,
  RouterLink,
  RouterOutlet,
  NavigationEnd,
  NavigationStart,
  NavigationCancel,
  NavigationError
} from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { ToastComponent } from './shared/toast/toast.component';
import { ToastService } from './shared/toast/toast.service';
import { DeleteCodeDialogComponent } from './shared/ui/delete-code-dialog.component';
import { AuthFacadeService } from './auth/auth.service';
import { PermissionService } from './core/authorization/permission.service';
import {
  applyThemeOverrides,
  loadThemeOverrides,
  recoverLocalAppearanceState
} from '@platform/angular/theme/theme-overrides.util';
import { NetworkIndicatorComponent } from './shared/network-indicator/network-indicator.component';
import { StatefulIconComponent } from './shared/icons/stateful-icon.component';
import {
  resolveAppIconSpec,
  type AppIconSpec
} from './shared/icons/app-icon.registry';
import {
  Notification,
  NotificationCenterService
} from './core/notifications/notification-center.service';
import { resolveNotificationStorageOwner } from './core/notifications/utils/notification-storage.util';
import { NotificationsBridgeService } from '@platform/angular/notifications/notifications-bridge.service';
import {
  buildNotificationPreviewView,
  type NotificationPreviewView
} from './shared/utils/notification-preview-view.util';
import {
  isExternalNotificationTarget,
  normalizeNotificationTarget,
  shouldOpenNotificationInNewContext
} from './shared/utils/notification-target.util';
import { MessagesStoreService } from './features/messages/infrastructure/messages-store.service';
import { LoadingService } from './core/loading/loading.service';
import {
  AREA_ICONS,
  APP_SHELL_ITEMS,
  AREA_LABELS,
  AREA_MENUS,
  AREA_ORDER,
  Area,
  MenuItem
} from './shared/data/app-navigation.data';
import {
  APP_SEARCH_SUBPAGE_DESTINATIONS,
  type AppSearchStaticDestination
} from './shared/data/app-search.data';
import {
  buildAppSearchHighlightSegments,
  formatAppSearchPath,
  getAppSidebarTooltipCoords,
  itemMatchesAppSearch,
  normalizeAppSearchValue,
  scoreAppSearchItem,
  type AppSearchHighlightSegment,
  updateAppAccountMenuPosition
} from './shared/utils/app-component.behavior.util';
import {
  applyAppRouteClasses,
  ThemeId,
  isAuthRoute,
  loadStoredArea,
  normalizeAppUrl,
  parseStoredSidebarCollapsed,
  parseStoredTheme,
  persistStoredSidebarCollapsed,
  persistStoredArea,
  persistStoredTheme,
  showPostLoginWelcomeToast
} from './shared/utils/app-shell.util';
import { environment } from '../environments/environment';

interface GlobalSearchDestination extends MenuItem {
  sectionLabel: string;
  metaLabel: string;
}

interface GlobalSearchResultView {
  index: number;
  item: GlobalSearchDestination;
  score: number;
  labelSegments: AppSearchHighlightSegment[];
  metaSegments: AppSearchHighlightSegment[];
}

interface HeaderBreadcrumb {
  label: string;
  path: string;
  current: boolean;
}

interface GlobalSearchSection {
  id: string;
  label: string;
  items: GlobalSearchResultView[];
}

interface CollapsedAreaFlyoutState {
  area: Area;
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  pinned: boolean;
}

@Component({
  selector: 'app-root',
  standalone: true,
  host: {
    '[class.app-shell-ready]': '!appShellReloading()'
  },
  imports: [
    RouterLink,
    RouterOutlet,
    ToastComponent,
    DeleteCodeDialogComponent,
    HugeiconsIconComponent,
    StatefulIconComponent,
    NetworkIndicatorComponent
  ],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('navList', { read: ElementRef }) navListRef?: ElementRef<HTMLDivElement>;
  @ViewChild('globalSearchInput', { read: ElementRef })
  globalSearchInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('globalSearchPanel', { read: ElementRef })
  globalSearchPanelRef?: ElementRef<HTMLDivElement>;
  private readonly platformId = inject(PLATFORM_ID);
  private readonly title = inject(Title);
  readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly notificationCenter = inject(NotificationCenterService);
  private readonly notificationsBridge = inject(NotificationsBridgeService);
  private readonly loadingService = inject(LoadingService);
  private readonly injector = inject(Injector);
  private readonly debugEnabled = environment.enableDebugLogs === true;
  private readonly themeStorageKey = 'engineers-salary-reference.theme';
  private readonly sidebarCollapsedStorageKey = 'engineers-salary-reference.sidebar.collapsed';
  private readonly recentSearchStorageKey = 'engineers-salary-reference.global-search.recent-paths';
  private readonly notificationBadgeStoragePrefix = 'engineers-salary-reference.notification-badge.acknowledged:';
  readonly appShellReloading = signal(true);
  private appShellReloadTimer?: number;

  private debugLog(...args: unknown[]): void {
    if (this.debugEnabled) {
      console.log(...args);
    }
  }

  readonly theme = signal<ThemeId>('auto'); // Auto runs in background
  readonly prefersDark = signal(false);
  private systemThemeQuery: MediaQueryList | null = null;
  sideUserOpen = false;
  notifOpen = false;
  sideCollapsed = false;
  readonly sidebarGroupsVisible = false;
  collapsedSidebarReveal = false;
  sidebarTransitioning = false;
  readonly headerRightReady = signal(!this.isBrowser);
  readonly headerRouteUrl = signal('');
  readonly headerBackIcon = resolveAppIconSpec('arrow-left').outline;
  readonly headerBreadcrumbs = computed<HeaderBreadcrumb[]>(() =>
    this.buildHeaderBreadcrumbs(this.headerRouteUrl())
  );
  readonly headerCanGoBack = computed(() => this.headerRouteUrl() !== 'dashboard');
  private readonly internalRouteHistory: string[] = [];
  private isHeaderBackNavigation = false;
  sidebarTooltip: { text: string; left: number; top: number } | null = null;
  collapsedAreaFlyout: CollapsedAreaFlyoutState | null = null;
  private collapsedAreaFlyoutCloseTimer?: number;
  private headerRightReadyTimer?: number;
  private sidebarTransitionTimer?: number;
  private readonly collapsedAreaFlyoutWidth = 238;
  private readonly collapsedAreaFlyoutViewportGap = 12;
  private readonly sidebarTransitionWindowFallback = 220;
  readonly currentUser = this.auth.user;
  readonly unreadCount = this.notificationCenter.unreadCount;
  readonly hasUnread = this.notificationCenter.hasUnread;
  private notificationBadgeStorageOwner: string | null = null;
  private readonly notificationBadgeAcknowledgedUnreadCount = signal(0);
  readonly notificationBadgeCount = computed(() =>
    Math.max(0, this.unreadCount() - this.notificationBadgeAcknowledgedUnreadCount())
  );
  readonly notificationPageMeta = this.notificationCenter.pageMeta;
  readonly recentNotifications = this.notificationCenter.activeNotifications;
  readonly notificationsPreviewState = this.notificationsBridge.previewState;
  readonly notificationsPreviewError = this.notificationsBridge.previewError;
  readonly notificationsLoadingMore = signal(false);
  readonly failedNotificationAvatarUrls = signal<ReadonlySet<string>>(new Set());
  readonly notificationsHasMore = computed(() => {
    const totalCount = this.notificationPageMeta().totalCount;
    return totalCount > this.recentNotifications().length;
  });
  readonly notificationsShouldShowScrollHint = computed(
    () => this.recentNotifications().length > 5
  );
  readonly notificationsHeaderMeta = computed(() => {
    const unreadCount = this.unreadCount();
    if (unreadCount > 0) {
      return {
        label: `${unreadCount} unread`,
        quiet: false,
        error: false
      };
    }

    const previewState = this.notificationsPreviewState();
    if (previewState === 'loading') {
      return {
        label: 'Loading',
        quiet: true,
        error: false
      };
    }

    if (previewState === 'error') {
      return {
        label: 'Unavailable',
        quiet: true,
        error: true
      };
    }

    return {
      label: 'Up to date',
      quiet: true,
      error: false
    };
  });
  readonly notificationsFeedSummary = computed(() => {
    const previewState = this.notificationsPreviewState();
    const loadedCount = this.recentNotifications().length;
    if (previewState === 'loading' && loadedCount === 0) {
      return 'Loading latest workspace activity';
    }

    if (previewState === 'error' && loadedCount === 0) {
      return 'Notifications are temporarily unavailable';
    }

    if (loadedCount === 0) {
      return 'Stay on top of workspace activity';
    }

    const totalCount = this.notificationPageMeta().totalCount;
    if (totalCount > loadedCount) {
      return `Showing latest ${loadedCount} of ${totalCount} active notifications`;
    }

    return `${loadedCount} active notification${loadedCount === 1 ? '' : 's'} loaded`;
  });
  readonly notificationsEmptyState = computed(() => {
    const previewState = this.notificationsPreviewState();
    if (previewState === 'loading') {
      return {
        state: 'loading' as const,
        title: 'Loading notifications',
        text: 'Pulling the latest workspace activity now.'
      };
    }

    if (previewState === 'error') {
      return {
        state: 'error' as const,
        title: 'Notifications unavailable',
        text: this.notificationsPreviewError() || 'Unable to load your notifications right now.'
      };
    }

    return {
      state: 'ready' as const,
      title: 'All caught up',
      text: 'No new notifications right now.'
    };
  });
  readonly notificationsCanRetry = computed(
    () => this.notificationsPreviewState() === 'error'
  );
  readonly notificationsFeedState = computed(() => {
    if (this.recentNotifications().length === 0) {
      return null;
    }

    if (this.notificationsLoadingMore()) {
      return 'Loading earlier notifications...';
    }

    if (this.notificationsHasMore()) {
      return 'Scroll for earlier activity';
    }

    return 'You have reached the end of this feed';
  });
  readonly recentNotificationViews = computed<NotificationPreviewView[]>(() =>
    this.recentNotifications().map(notification => buildNotificationPreviewView(notification))
  );
  readonly userName = computed(() => {
    const user = this.currentUser();
    const name = user?.name?.trim();
    if (name) {
      return name;
    }
    const email = user?.email?.trim();
    return email ? email.split('@')[0] : 'Account';
  });
  readonly userEmail = computed(() => {
    const user = this.currentUser();
    const email = user?.email?.trim() || '';
    const name = user?.name?.trim() || '';
    if (!email) {
      return '';
    }
    if (name && name.toLowerCase() === email.toLowerCase()) {
      return '';
    }
    return email;
  });
  readonly userTooltip = computed(() => {
    const user = this.currentUser();
    const name = user?.name?.trim();
    const email = user?.email?.trim();
    return name || email || 'Account';
  });
  accountMenuLeft = 0;
  accountMenuTop = 0;
  accountMenuWidth = 0;

  readonly currentArea = signal<Area>('Tender');
  readonly expandedAreas = signal<Area[]>([]);

  readonly areaIcons: Record<Area, string> = AREA_ICONS;
  readonly shellMenuItems: MenuItem[] = APP_SHELL_ITEMS;
  readonly areaLabels: Record<Area, string> = AREA_LABELS;
  readonly areaOrder: Area[] = AREA_ORDER;
  readonly sidebarOpenIcon = ViewSidebarRightIcon;
  readonly sidebarCollapseIcon = LayoutLeftIcon;
  readonly sidebarToggleIcon = SidebarToggleIcon;
  readonly sidebarChevronDownIcon = ArrowDown01Icon;
  readonly sidebarChevronUpIcon = ArrowUp01Icon;
  readonly headerSearchIcon = Search01Icon;
  readonly headerClearSearchIcon = Cancel01Icon;
  readonly headerSettingsIcon = Settings02Icon;
  readonly headerNotificationsIcon = Notification03Icon;
  readonly headerNotificationsEmptyIcon = CheckmarkCircle02Icon;
  readonly headerThemeSunIcon = Sun03Icon;
  readonly headerThemeMoonIcon = Moon02Icon;
  readonly sidebarAreaIcons: Record<Area, IconSvgObject> = {
    Tender: File02Icon
  };
  readonly sidebarMenuIconSpecs: Record<string, AppIconSpec> = {
    'app-dashboard': resolveAppIconSpec('nav-dashboard'),
    'salary-reports': resolveAppIconSpec('nav-salary-reports'),
    'submit-salary-report': resolveAppIconSpec('nav-submit-report')
  };
  activeKey = '';

  private readonly permissionService = inject(PermissionService);
  private notificationsPreviewLoadSubscription?: Subscription;

  /** Filtered menus — reactive signal, items with a sectionKey are hidden unless user has access */
  readonly menus = computed<Record<Area, MenuItem[]>>(
    () =>
      Object.fromEntries(
        (Object.entries(AREA_MENUS) as [Area, MenuItem[]][]).map(([area, items]) => [
          area,
          items.filter(item => this.permissionService.canAccessSection(item.sectionKey))
        ])
      ) as Record<Area, MenuItem[]>
  );
  readonly globalSearchTerm = signal('');
  readonly normalizedGlobalSearchTerm = computed(() =>
    this.normalizeSearchValue(this.globalSearchTerm())
  );
  readonly isGlobalSearchOpen = signal(false);
  readonly globalSearchActiveIndex = signal(-1);
  private readonly searchResultLimit = 8;
  private readonly quickAccessResultLimit = 4;
  private readonly recentSearchLimit = 4;
  private readonly areaSuggestionLimit = 5;
  private readonly recentSearchPaths = signal<string[]>(this.loadRecentSearchPaths());
  private readonly quickAccessSeedItems: MenuItem[] = [
    {
      key: 'quick-settings',
      label: 'Settings',
      ico: 'gear-wide-connected',
      path: 'settings',
      sectionKey: 'settings.global',
      searchTerms: ['configuration', 'preferences', 'admin']
    },
    {
      key: 'quick-profile',
      label: 'Profile',
      ico: 'person-badge',
      path: 'account/profile',
      sectionKey: 'account.profile',
      searchTerms: ['account', 'user', 'me']
    },
    {
      key: 'quick-notifications',
      label: 'Notifications',
      ico: 'bell',
      path: 'account/notifications',
      searchTerms: ['alerts', 'inbox', 'mentions', 'notification center']
    },
    {
      key: 'quick-preferences',
      label: 'Preferences',
      ico: 'sliders2',
      path: 'account/settings',
      sectionKey: 'account.settings',
      searchTerms: ['theme', 'privacy', 'alerts', 'account settings']
    }
  ];
  readonly quickAccessItems = computed<GlobalSearchDestination[]>(() =>
    this.quickAccessSeedItems
      .filter(item => this.permissionService.canAccessSection(item.sectionKey))
      .map(item => this.createGlobalSearchDestination(item, 'Quick Access'))
  );
  readonly allSearchDestinations = computed<GlobalSearchDestination[]>(() => {
    const seen = new Set<string>();
    return [
      ...this.buildShellSearchDestinations(),
      ...this.quickAccessItems(),
      ...this.buildAreaSearchDestinations(),
      ...this.buildStaticSearchDestinations()
    ].filter(item => {
      const dedupeKey = item.path;
      if (seen.has(dedupeKey)) {
        return false;
      }
      seen.add(dedupeKey);
      return true;
    });
  });
  readonly searchableMenuItems = computed(() => this.allSearchDestinations());
  readonly recentSearchItems = computed(() => {
    const itemsByPath = new Map(this.allSearchDestinations().map(item => [item.path, item]));
    return this.recentSearchPaths()
      .map(path => itemsByPath.get(path))
      .filter((item): item is GlobalSearchDestination => !!item)
      .slice(0, this.recentSearchLimit);
  });
  readonly quickAccessSearchItems = computed(() => {
    const recentPaths = new Set(this.recentSearchItems().map(item => item.path));
    return this.quickAccessItems()
      .filter(item => !recentPaths.has(item.path))
      .slice(0, this.quickAccessResultLimit);
  });
  readonly currentAreaSearchItems = computed(() => {
    const recentPaths = new Set(this.recentSearchItems().map(item => item.path));
    const areaLabel = this.areaLabels[this.currentArea()];
    return this.allSearchDestinations()
      .filter(item => item.sectionLabel === areaLabel && !recentPaths.has(item.path))
      .slice(0, this.areaSuggestionLimit);
  });
  readonly matchingSearchItems = computed(() => {
    const query = this.normalizedGlobalSearchTerm();
    if (!query) {
      return [];
    }
    return this.allSearchDestinations()
      .filter(item => this.itemMatchesSearch(item, query))
      .map(item => ({ item, score: this.scoreSearchItem(item, query) }))
      .sort(
        (left, right) => right.score - left.score || left.item.label.localeCompare(right.item.label)
      )
      .slice(0, this.searchResultLimit);
  });
  readonly globalSearchSections = computed<GlobalSearchSection[]>(() => {
    const query = this.normalizedGlobalSearchTerm();
    const sections: Array<{
      id: string;
      label: string;
      items: Array<{ item: GlobalSearchDestination; score: number }>;
    }> = [];

    if (query) {
      sections.push({
        id: 'matching-pages',
        label: 'Matching pages',
        items: this.matchingSearchItems()
      });
    } else {
      if (this.recentSearchItems().length > 0) {
        sections.push({
          id: 'recent-pages',
          label: 'Recent pages',
          items: this.recentSearchItems().map(item => ({ item, score: 0 }))
        });
      }

      if (this.quickAccessSearchItems().length > 0) {
        sections.push({
          id: 'quick-access',
          label: 'Quick access',
          items: this.quickAccessSearchItems().map(item => ({ item, score: 0 }))
        });
      }

      if (this.currentAreaSearchItems().length > 0) {
        sections.push({
          id: 'current-area',
          label: `Browse ${this.areaLabels[this.currentArea()]}`,
          items: this.currentAreaSearchItems().map(item => ({ item, score: 0 }))
        });
      }
    }

    let index = 0;
    return sections
      .filter(section => section.items.length > 0)
      .map(section => ({
        id: section.id,
        label: section.label,
        items: section.items.map(result =>
          this.buildGlobalSearchResult(result.item, query, result.score, index++)
        )
      }));
  });
  readonly flattenedGlobalSearchResults = computed(() =>
    this.globalSearchSections().flatMap(section => section.items)
  );
  readonly globalSearchPanelVisible = computed(
    () =>
      this.isGlobalSearchOpen() &&
      (this.flattenedGlobalSearchResults().length > 0 ||
        this.normalizedGlobalSearchTerm().length > 0)
  );
  readonly activeGlobalSearchResultId = computed(() => {
    const activeIndex = this.globalSearchActiveIndex();
    return activeIndex >= 0 ? `global-search-option-${activeIndex}` : null;
  });

  isLoginRoute = this.detectInitialAuthRoute();
  private previousActiveIndex = -1;
  private navListScrollCleanup?: () => void;
  private themeNoAnimTimer?: number;
  private themeSidebarFreezeTimer?: number;
  private themeSidebarLeaveCleanup?: () => void;
  private resizeFrameId?: number;
  private lastCompactSidebarNoticeAt = 0;

  private readonly handleSystemTheme = (event: MediaQueryListEvent) => {
    this.prefersDark.set(event.matches);
  };

  constructor(
    private router: Router,
    private auth: AuthFacadeService,
    private toast: ToastService
  ) {
    recoverLocalAppearanceState();
    applyThemeOverrides(loadThemeOverrides());

    const storedArea = loadStoredArea<Area>(this.isBrowser, AREA_MENUS);
    if (storedArea) {
      this.currentArea.set(storedArea);
    }
    this.ensureAreaExpanded(this.currentArea());

    const storedTheme = this.loadStoredTheme();
    if (storedTheme) {
      this.theme.set(storedTheme);
    }

    if (this.isBrowser && typeof window !== 'undefined' && 'matchMedia' in window) {
      this.systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.prefersDark.set(this.systemThemeQuery.matches);
      if (this.systemThemeQuery.addEventListener) {
        this.systemThemeQuery.addEventListener('change', this.handleSystemTheme);
      } else if (this.systemThemeQuery.addListener) {
        this.systemThemeQuery.addListener(this.handleSystemTheme);
      }
    }

    effect(() => {
      const unreadCount = this.unreadCount();
      const acknowledgedUnreadCount = this.notificationBadgeAcknowledgedUnreadCount();
      if (acknowledgedUnreadCount > unreadCount) {
        this.notificationBadgeAcknowledgedUnreadCount.set(unreadCount);
        this.saveNotificationBadgeAcknowledgement(unreadCount);
      }
    });

    effect(() => {
      const ownerKey = this.resolveNotificationBadgeStorageOwner();
      if (ownerKey === this.notificationBadgeStorageOwner) {
        return;
      }

      this.notificationBadgeStorageOwner = ownerKey;
      this.notificationBadgeAcknowledgedUnreadCount.set(
        this.loadNotificationBadgeAcknowledgement(ownerKey)
      );
    });

    if (this.isBrowser) {
      effect(() => {
        const themeSetting = this.theme();
        const html = document.documentElement;
        const body = document.body;

        const releaseSidebarFreeze = () => {
          body.classList.remove('theme-switching');
          this.themeSidebarLeaveCleanup?.();
          this.themeSidebarLeaveCleanup = undefined;
          if (this.themeSidebarFreezeTimer) {
            window.clearTimeout(this.themeSidebarFreezeTimer);
            this.themeSidebarFreezeTimer = undefined;
          }
        };

        html.classList.add('theme-no-anim');
        body.classList.add('theme-switching');

        if (this.themeNoAnimTimer) {
          window.clearTimeout(this.themeNoAnimTimer);
          this.themeNoAnimTimer = undefined;
        }
        if (this.themeSidebarFreezeTimer) {
          window.clearTimeout(this.themeSidebarFreezeTimer);
          this.themeSidebarFreezeTimer = undefined;
        }
        this.themeSidebarLeaveCleanup?.();
        this.themeSidebarLeaveCleanup = undefined;

        const appliedTheme =
          themeSetting === 'auto' ? (this.prefersDark() ? 'dark' : 'light') : themeSetting;

        html.setAttribute('data-theme', appliedTheme);
        this.syncThemeFavicons(appliedTheme);

        this.themeNoAnimTimer = window.setTimeout(() => {
          html.classList.remove('theme-no-anim');
          this.themeNoAnimTimer = undefined;
        }, 260);

        const sidebar = document.querySelector('.sidebar') as HTMLElement | null;
        const armReleaseOnSidebarLeave = () => {
          if (!sidebar) {
            releaseSidebarFreeze();
            return;
          }
          const onSidebarLeave = () => {
            releaseSidebarFreeze();
          };
          sidebar.addEventListener('pointerleave', onSidebarLeave, { passive: true, once: true });
          this.themeSidebarLeaveCleanup = () => {
            sidebar.removeEventListener('pointerleave', onSidebarLeave);
          };
        };

        const releaseWhenSidebarIdle = () => {
          if (!body.classList.contains('theme-switching')) {
            this.themeSidebarFreezeTimer = undefined;
            return;
          }
          if (sidebar?.matches(':hover')) {
            armReleaseOnSidebarLeave();
            return;
          }
          releaseSidebarFreeze();
        };

        this.themeSidebarFreezeTimer = window.setTimeout(releaseWhenSidebarIdle, 950);
      });
    }

    this.isLoginRoute = isAuthRoute(this.router.url);
  }

  private updateRouteClasses(url: string): void {
    applyAppRouteClasses(this.isBrowser, typeof document === 'undefined' ? undefined : document, url);
  }

  setTheme(themeId: 'light' | 'dark'): void {
    this.theme.set(themeId);
    persistStoredTheme(this.isBrowser, this.themeStorageKey, themeId);
  }

  private loadStoredTheme(): ThemeId | null {
    if (!this.isBrowser || typeof window === 'undefined') {
      return null;
    }
    try {
      return parseStoredTheme(window.localStorage.getItem(this.themeStorageKey));
    } catch {
      return null;
    }
  }

  private loadStoredSidebarCollapsed(): boolean | null {
    if (!this.isBrowser || typeof window === 'undefined') {
      return null;
    }
    try {
      return parseStoredSidebarCollapsed(
        window.localStorage.getItem(this.sidebarCollapsedStorageKey)
      );
    } catch {
      return null;
    }
  }

  private shouldForceCompactSidebar(): boolean {
    // Tablets have enough room for the labelled navigation. Only phones start
    // compact; the header control can still expand the menu when it is needed.
    return this.isBrowser && typeof window !== 'undefined' && window.innerWidth <= 640;
  }

  private showCompactSidebarNotice(): void {
    if (!this.isBrowser || typeof Date === 'undefined') {
      return;
    }

    const now = Date.now();
    if (now - this.lastCompactSidebarNoticeAt < 2500) {
      return;
    }

    this.lastCompactSidebarNoticeAt = now;
    this.toast.info('Sidebar stays compact on small screens to keep the table visible.', {
      duration: 3500,
      title: 'Compact navigation'
    });
  }

  private setSidebarCollapsed(collapsed: boolean): void {
    this.sideCollapsed = collapsed;
    persistStoredSidebarCollapsed(this.isBrowser, this.sidebarCollapsedStorageKey, collapsed);
  }

  private syncThemeFavicons(theme: Exclude<ThemeId, 'auto'>): void {
    if (!this.isBrowser || typeof document === 'undefined') {
      return;
    }

    const iconHref = 'assets/brand/engref-favicon-v6.svg';

    this.updateHeadIcon('app-favicon', 'icon', iconHref, 'image/svg+xml');
    this.updateHeadIcon('app-touch-icon', 'apple-touch-icon', iconHref);
  }

  private updateHeadIcon(
    elementId: string,
    rel: 'icon' | 'apple-touch-icon',
    href: string,
    type?: string
  ): void {
    const head = document.head;
    if (!head) {
      return;
    }

    let link = document.getElementById(elementId) as HTMLLinkElement | null;

    if (!link) {
      link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
      if (link && !link.id) {
        link.id = elementId;
      }
    }

    if (!link) {
      link = document.createElement('link');
      link.id = elementId;
      link.rel = rel;
      head.appendChild(link);
    }

    link.rel = rel;
    if (type) {
      link.type = type;
    }
    link.href = href;
  }

  isAreaExpanded(area: Area): boolean {
    return this.expandedAreas().includes(area);
  }

  isShellItemActive(item: MenuItem): boolean {
    return this.activeKey === item.key;
  }

  hasActivePageInArea(area: Area): boolean {
    return this.menus()[area].some(item => item.key === this.activeKey);
  }

  menuItemTooltip(item: MenuItem): string {
    const availability = item.availabilityLabel?.trim();
    return availability ? `${item.label} (${availability})` : item.label;
  }

  isCollapsedAreaFlyoutOpen(area: Area): boolean {
    return this.collapsedAreaFlyout?.area === area;
  }

  activateAreaItem(area: Area, item: MenuItem): void {
    this.setCurrentArea(area);
    this.ensureAreaExpanded(area);
    this.closeCollapsedAreaFlyout(true);
    this.activate(item);
  }

  activateShellItem(item: MenuItem): void {
    this.closeCollapsedAreaFlyout(true);
    this.hideSidebarTooltip();
    this.activate(item);
  }

  onAreaItemLinkClick(area: Area, item: MenuItem, event: MouseEvent): void {
    if (item.disabled) {
      event.preventDefault();
      event.stopPropagation();
      this.activateAreaItem(area, item);
      return;
    }

    if (this.isNewTabNavigation(event)) {
      return;
    }

    event.preventDefault();
    this.activateAreaItem(area, item);
  }

  onShellItemLinkClick(item: MenuItem, event: MouseEvent): void {
    if (item.disabled) {
      event.preventDefault();
      event.stopPropagation();
      this.activateShellItem(item);
      return;
    }

    if (this.isNewTabNavigation(event)) {
      return;
    }

    event.preventDefault();
    this.activateShellItem(item);
  }

  onGlobalSearchResultLinkClick(item: GlobalSearchDestination, event: MouseEvent): void {
    if (item.disabled) {
      event.preventDefault();
      event.stopPropagation();
      this.selectGlobalSearchResult(item, event);
      return;
    }

    if (this.isNewTabNavigation(event)) {
      return;
    }

    this.selectGlobalSearchResult(item, event);
  }

  onAccountLinkClick(target: string, event: MouseEvent): void {
    if (this.isNewTabNavigation(event)) {
      return;
    }

    event.preventDefault();
    this.navigateAccount(target, event);
  }

  private isNewTabNavigation(event: MouseEvent): boolean {
    return event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
  }

  activate(item: MenuItem): void {
    if (!item.path) {
      return;
    }
    if (item.disabled) {
      this.toast.info(
        `${item.label} ${item.availabilityLabel?.toLowerCase() || 'is not available yet'}.`,
        4500
      );
      return;
    }
    this.activeKey = item.key;
    this.go(item.path);
    setTimeout(() => this.updateIndicatorPosition(), 50);
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.updateIndicatorPosition(), 100);
    if (this.isBrowser) {
      this.headerRightReadyTimer = window.setTimeout(() => {
        this.headerRightReady.set(true);
        this.headerRightReadyTimer = undefined;
      }, 140);
    }
    if (this.isBrowser && this.navListRef) {
      const navList = this.navListRef.nativeElement;
      const onScroll = () => {
        this.hideSidebarTooltip();
        this.closeCollapsedAreaFlyout(true);
      };
      navList.addEventListener('scroll', onScroll, { passive: true });
      this.navListScrollCleanup = () => navList.removeEventListener('scroll', onScroll);
    }
  }

  private updateIndicatorPosition(): void {
    if (!this.isBrowser || !this.navListRef) {
      return;
    }
    const navList = this.navListRef.nativeElement;
    const allItems = Array.from(
      navList.querySelectorAll('.shell-primary-item, .area-page-item')
    ) as HTMLElement[];
    const activeItem = navList.querySelector(
      '.shell-primary-item.is-current, .area-page-item.active'
    ) as HTMLElement | null;

    if (!activeItem) {
      navList.classList.remove('has-selection', 'indicator-flowing');
      this.previousActiveIndex = -1;
      return;
    }

    const currentIndex = allItems.indexOf(activeItem);
    if (currentIndex < 0) {
      return;
    }

    const listRect = navList.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();
    const relativeTop = itemRect.top - listRect.top + navList.scrollTop;
    const relativeLeft = itemRect.left - listRect.left + navList.scrollLeft;
    const distance = this.previousActiveIndex >= 0
      ? Math.abs(currentIndex - this.previousActiveIndex)
      : 0;
    // Give the selection lens enough travel time to be perceived while keeping
    // adjacent navigation responsive. Longer jumps cap below feedback-lag territory.
    const motionDuration = distance === 0 ? 220 : Math.min(480, 260 + distance * 95);

    if (this.previousActiveIndex < 0) {
      navList.classList.add('indicator-initializing');
    } else if (this.previousActiveIndex !== currentIndex) {
      navList.classList.add('indicator-flowing');
    }

    if (this.previousActiveIndex >= 0 && this.previousActiveIndex !== currentIndex) {
      const direction = currentIndex > this.previousActiveIndex ? 1 : -1;
      for (let step = 1; step < distance; step += 1) {
        const item = allItems[this.previousActiveIndex + step * direction];
        if (!item) {
          continue;
        }
        const delay = Math.round((step / distance) * motionDuration * 0.76);
        item.style.setProperty('--indicator-trail-delay', `${delay}ms`);
        item.classList.remove('indicator-trail');
        void item.offsetWidth;
        item.classList.add('indicator-trail');
        window.setTimeout(() => {
          item.classList.remove('indicator-trail');
          item.style.removeProperty('--indicator-trail-delay');
        }, delay + 380);
      }
    }

    navList.style.setProperty('--indicator-x', `${relativeLeft}px`);
    navList.style.setProperty('--indicator-y', `${relativeTop}px`);
    navList.style.setProperty('--indicator-width', `${itemRect.width}px`);
    navList.style.setProperty('--indicator-height', `${itemRect.height}px`);
    navList.style.setProperty('--indicator-duration', `${motionDuration}ms`);
    navList.classList.add('has-selection');
    this.previousActiveIndex = currentIndex;

    window.requestAnimationFrame(() => navList.classList.remove('indicator-initializing'));
    window.setTimeout(() => navList.classList.remove('indicator-flowing'), motionDuration + 40);
  }

  showSidebarTooltip(event: Event, text: string): void {
    if (!this.isBrowser || !this.sideCollapsed || this.sidebarTransitioning || !text) {
      return;
    }
    const target = event.currentTarget as HTMLElement | null;
    if (!target) {
      return;
    }
    const { left, top } = this.getSidebarTooltipCoords(target);
    this.sidebarTooltip = { text, left, top };
  }

  hideSidebarTooltip(): void {
    if (!this.sidebarTooltip) {
      return;
    }
    this.sidebarTooltip = null;
  }

  private getSidebarTooltipCoords(target: HTMLElement): { left: number; top: number } {
    return getAppSidebarTooltipCoords(this.isBrowser, target);
  }

  selectArea(area: Area): void {
    const shouldExpand = !this.isAreaExpanded(area);
    this.hideSidebarTooltip();
    this.setCurrentArea(area);
    this.expandedAreas.update(current =>
      shouldExpand
        ? current.includes(area)
          ? current
          : [...current, area]
        : current.filter(item => item !== area)
    );
  }

  onAreaTriggerMouseEnter(area: Area, event: Event): void {
    if (this.sidebarTransitioning) {
      return;
    }
    if (this.sideCollapsed) {
      this.showSidebarTooltip(event, this.areaLabels[area]);
      return;
    }
    this.showSidebarTooltip(event, this.areaLabels[area]);
  }

  onAreaTriggerMouseLeave(): void {
    this.hideSidebarTooltip();
  }

  onAreaTriggerFocus(area: Area, event: Event): void {
    if (this.sidebarTransitioning) {
      return;
    }
    if (this.sideCollapsed) {
      this.showSidebarTooltip(event, this.areaLabels[area]);
      return;
    }
    this.showSidebarTooltip(event, this.areaLabels[area]);
  }

  onAreaTriggerBlur(): void {
    this.hideSidebarTooltip();
  }

  onAreaTriggerClick(area: Area, event: Event): void {
    if (!this.sideCollapsed) {
      this.selectArea(area);
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const isSameArea = this.collapsedAreaFlyout?.area === area;
    const isPinned = this.collapsedAreaFlyout?.pinned === true;

    if (isSameArea && isPinned) {
      this.closeCollapsedAreaFlyout(true);
      return;
    }

    this.setCurrentArea(area);
    this.ensureAreaExpanded(area);
    this.openCollapsedAreaFlyout(area, event, true);
  }

  onCollapsedAreaFlyoutMouseEnter(): void {
    this.clearCollapsedAreaFlyoutCloseTimer();
  }

  onCollapsedAreaFlyoutMouseLeave(): void {
    this.scheduleCollapsedAreaFlyoutClose();
  }

  private openCollapsedAreaFlyout(area: Area, event: Event, pinned: boolean): void {
    if (!this.isBrowser || !this.sideCollapsed) {
      return;
    }
    const trigger = event.currentTarget as HTMLElement | null;
    if (!trigger) {
      return;
    }
    if (!pinned && this.collapsedAreaFlyout?.pinned) {
      return;
    }

    this.clearCollapsedAreaFlyoutCloseTimer();
    this.hideSidebarTooltip();
    this.collapsedAreaFlyout = this.buildCollapsedAreaFlyoutState(area, trigger, pinned);
  }

  private buildCollapsedAreaFlyoutState(
    area: Area,
    trigger: HTMLElement,
    pinned: boolean
  ): CollapsedAreaFlyoutState {
    const rect = trigger.getBoundingClientRect();
    const sidebarRect =
      document.querySelector<HTMLElement>('.sidebar.is-collapsed')?.getBoundingClientRect() ?? rect;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const flyoutWidth = Math.min(
      this.collapsedAreaFlyoutWidth,
      viewportWidth - this.collapsedAreaFlyoutViewportGap * 2
    );
    const itemCount = this.menus()[area]?.length ?? 0;
    const estimatedHeight = Math.min(
      64 + itemCount * 40 + 18,
      viewportHeight - this.collapsedAreaFlyoutViewportGap * 2
    );
    const left = Math.min(
      sidebarRect.right + 12,
      viewportWidth - flyoutWidth - this.collapsedAreaFlyoutViewportGap
    );
    const top = Math.min(
      Math.max(rect.top - 10, this.collapsedAreaFlyoutViewportGap),
      viewportHeight - estimatedHeight - this.collapsedAreaFlyoutViewportGap
    );

    return {
      area,
      pinned,
      width: flyoutWidth,
      left: Math.max(left, this.collapsedAreaFlyoutViewportGap),
      top,
      maxHeight: viewportHeight - top - this.collapsedAreaFlyoutViewportGap
    };
  }

  private scheduleCollapsedAreaFlyoutClose(): void {
    if (!this.sideCollapsed || this.collapsedAreaFlyout?.pinned) {
      return;
    }
    this.clearCollapsedAreaFlyoutCloseTimer();
    this.collapsedAreaFlyoutCloseTimer = window.setTimeout(() => {
      if (!this.collapsedAreaFlyout?.pinned) {
        this.closeCollapsedAreaFlyout(true);
      }
    }, 110);
  }

  private clearCollapsedAreaFlyoutCloseTimer(): void {
    if (this.collapsedAreaFlyoutCloseTimer !== undefined) {
      window.clearTimeout(this.collapsedAreaFlyoutCloseTimer);
      this.collapsedAreaFlyoutCloseTimer = undefined;
    }
  }

  private closeCollapsedAreaFlyout(force = false): void {
    if (!force && this.collapsedAreaFlyout?.pinned) {
      return;
    }
    if (!this.collapsedAreaFlyout && this.collapsedAreaFlyoutCloseTimer === undefined) {
      return;
    }
    this.clearCollapsedAreaFlyoutCloseTimer();
    this.collapsedAreaFlyout = null;
  }

  logout(): void {
    this.closeAll();
    this.auth.logout();
  }

  navigateAccount(target: string, event?: Event): void {
    event?.stopPropagation();
    this.activeKey = '';
    this.closeAll();
    this.go('account/' + target);
  }

  closeAll(except?: 'sideUserOpen' | 'notifOpen'): void {
    if (except !== 'sideUserOpen' && this.sideUserOpen) {
      this.sideUserOpen = false;
    }
    if (except !== 'notifOpen' && this.notifOpen) {
      this.notifOpen = false;
    }
    this.closeCollapsedAreaFlyout(true);
    this.closeGlobalSearch();
  }

  toggleNotificationsPanel(event: Event): void {
    event.stopPropagation();
    this.closeAll('notifOpen');
    this.notifOpen = !this.notifOpen;

    if (this.notifOpen) {
      this.acknowledgeNotificationBadge();
      void this.notificationCenter.requestPermission();
      this.notificationsBridge.ensureFreshPreview();
      if (this.shouldLoadMoreNotificationsPreviewOnOpen()) {
        this.loadMoreNotificationsPreview();
      }
    }
  }

  onNotificationsScroll(event: Event): void {
    if (this.notificationsLoadingMore() || !this.notificationsHasMore()) {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const remaining = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (remaining <= 96) {
      this.loadMoreNotificationsPreview();
    }
  }

  markAllNotificationsRead(event?: Event): void {
    event?.stopPropagation();
    this.notificationBadgeAcknowledgedUnreadCount.set(0);
    this.saveNotificationBadgeAcknowledgement(0);
    this.notificationsBridge.markAllRead();
  }

  private acknowledgeNotificationBadge(): void {
    const unreadCount = this.unreadCount();
    this.notificationBadgeAcknowledgedUnreadCount.set(unreadCount);
    this.saveNotificationBadgeAcknowledgement(unreadCount);
  }

  private resolveNotificationBadgeStorageOwner(): string | null {
    const tokenOwner = resolveNotificationStorageOwner(this.auth.tokens()?.accessToken);
    if (tokenOwner) {
      return tokenOwner;
    }

    const user = this.currentUser();
    const record = user as Record<string, unknown> | null;
    const owner =
      this.pickNotificationBadgeOwnerValue(record?.['id']) ||
      this.pickNotificationBadgeOwnerValue(record?.['userId']) ||
      this.pickNotificationBadgeOwnerValue(record?.['email']) ||
      this.pickNotificationBadgeOwnerValue(record?.['userName']) ||
      this.pickNotificationBadgeOwnerValue(record?.['fullName']);

    return owner ? `user:${owner}` : null;
  }

  private pickNotificationBadgeOwnerValue(value: unknown): string {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(Math.trunc(value));
    }

    return typeof value === 'string' ? value.trim() : '';
  }

  private buildNotificationBadgeStorageKey(ownerKey: string): string {
    return `${this.notificationBadgeStoragePrefix}${encodeURIComponent(ownerKey)}`;
  }

  private loadNotificationBadgeAcknowledgement(ownerKey: string | null): number {
    if (!this.isBrowser || !ownerKey || typeof window === 'undefined' || !window.localStorage) {
      return 0;
    }

    try {
      const raw = window.localStorage.getItem(this.buildNotificationBadgeStorageKey(ownerKey));
      const parsed = raw === null ? 0 : Number(raw);
      return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
    } catch {
      return 0;
    }
  }

  private saveNotificationBadgeAcknowledgement(unreadCount: number): void {
    const ownerKey = this.notificationBadgeStorageOwner;
    if (!this.isBrowser || !ownerKey || typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      window.localStorage.setItem(
        this.buildNotificationBadgeStorageKey(ownerKey),
        String(Math.max(0, Math.trunc(unreadCount)))
      );
    } catch {
      // Badge acknowledgement is a UI convenience; storage failures should not block notifications.
    }
  }

  retryNotificationsPreview(event?: Event): void {
    event?.stopPropagation();
    this.notificationsBridge.ensureFreshPreview({ force: true });
  }

  openNotificationsInbox(event?: Event): void {
    event?.stopPropagation();
    this.activeKey = '';
    this.closeAll();
    this.go('account/notifications');
  }

  private loadMoreNotificationsPreview(): void {
    if (this.notificationsLoadingMore() || !this.notificationsHasMore()) {
      return;
    }

    const pageMeta = this.notificationPageMeta();
    const nextPage = Math.max(1, pageMeta.pageNumber + 1);
    const pageSize = this.getNotificationsPreviewPageSize();

    this.notificationsLoadingMore.set(true);
    this.notificationsPreviewLoadSubscription?.unsubscribe();
    this.notificationsPreviewLoadSubscription = this.notificationsBridge
      .query$({
        pageNumber: nextPage,
        pageSize,
        includeArchived: false,
        onlyArchived: false
      })
      .subscribe({
        next: result => {
          this.notificationCenter.mergeServerNotificationsPage(result.items);
          this.notificationCenter.syncPageMeta(result);
          this.notificationsLoadingMore.set(false);
        },
        error: () => {
          this.notificationsLoadingMore.set(false);
        }
      });
  }

  private shouldLoadMoreNotificationsPreviewOnOpen(): boolean {
    if (this.notificationsPreviewState() !== 'ready' || !this.notificationsHasMore()) {
      return false;
    }

    return this.recentNotifications().length < this.getNotificationsPreviewPageSize();
  }

  private getNotificationsPreviewPageSize(): number {
    return Math.max(20, this.notificationsBridge.previewPageSize || 20);
  }

  updateGlobalSearchTerm(value: string): void {
    this.globalSearchTerm.set(String(value ?? ''));
    this.isGlobalSearchOpen.set(true);
    this.syncGlobalSearchActiveIndex(true);
  }

  clearGlobalSearch(): void {
    this.globalSearchTerm.set('');
    this.isGlobalSearchOpen.set(true);
    this.syncGlobalSearchActiveIndex(true);
    this.focusGlobalSearchInput();
  }

  openGlobalSearch(selectText = false): void {
    this.sideUserOpen = false;
    this.notifOpen = false;
    this.isGlobalSearchOpen.set(true);
    this.syncGlobalSearchActiveIndex(true);
    if (selectText) {
      this.focusGlobalSearchInput(true);
    }
  }

  closeGlobalSearch(restoreFocus = false): void {
    if (!this.isGlobalSearchOpen() && this.globalSearchActiveIndex() === -1) {
      if (restoreFocus) {
        this.focusGlobalSearchInput();
      }
      return;
    }
    this.isGlobalSearchOpen.set(false);
    this.globalSearchActiveIndex.set(-1);
    if (restoreFocus) {
      this.focusGlobalSearchInput();
    }
  }

  setGlobalSearchActiveIndex(index: number): void {
    if (this.globalSearchActiveIndex() === index) {
      return;
    }
    this.globalSearchActiveIndex.set(index);
  }

  onGlobalSearchKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.globalSearchPanelVisible()) {
          this.openGlobalSearch();
          return;
        }
        this.moveGlobalSearchSelection(1);
        return;
      case 'ArrowUp':
        event.preventDefault();
        if (!this.globalSearchPanelVisible()) {
          this.openGlobalSearch();
        }
        this.moveGlobalSearchSelection(-1);
        return;
      case 'Enter':
        this.submitGlobalSearch(event);
        return;
      case 'Escape':
        if (this.isGlobalSearchOpen()) {
          event.preventDefault();
          this.closeGlobalSearch();
        }
        return;
      case 'Tab':
        this.closeGlobalSearch();
        return;
      default:
        return;
    }
  }

  submitGlobalSearch(event?: Event): void {
    event?.preventDefault();
    const query = this.globalSearchTerm().trim();
    const activeResult = this.getActiveGlobalSearchResult();
    const fallbackResult = query ? (this.flattenedGlobalSearchResults()[0] ?? null) : null;
    const target = activeResult ?? fallbackResult;

    if (!target) {
      if (query) {
        this.toast.info(`No page matched "${query}".`, 3500);
      }
      return;
    }

    this.selectGlobalSearchResult(target.item, event);
  }

  selectGlobalSearchResult(item: GlobalSearchDestination, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    if (item.disabled) {
      this.toast.info(
        `${item.label} ${item.availabilityLabel?.toLowerCase() || 'is not available yet'}.`,
        4500
      );
      this.globalSearchTerm.set(item.label);
      this.isGlobalSearchOpen.set(true);
      this.syncGlobalSearchActiveIndex(false);
      return;
    }

    this.rememberRecentSearchPath(item.path);
    this.globalSearchTerm.set(item.label);
    this.closeGlobalSearch();
    this.activate(item);
  }

  openNotification(notification: Notification, event?: Event): void {
    event?.stopPropagation();
    if (event && shouldOpenNotificationInNewContext(event, this.isBrowser)) {
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
    if (!notification) {
      return;
    }

    this.notificationsBridge.markRead(notification.id);
    const target = normalizeNotificationTarget(notification.actionUrl);
    if (target) {
      if (openInNewContext && this.isBrowser) {
        window.open(target, '_blank', 'noopener,noreferrer');
      } else if (this.isBrowser && isExternalNotificationTarget(target)) {
        window.open(target, '_blank', 'noopener,noreferrer');
      } else {
        this.router.navigateByUrl(target);
      }
    }
    this.notifOpen = false;
  }

  toggleAccountMenu(event: Event): void {
    event.stopPropagation();
    this.closeAll('sideUserOpen');
    const nextState = !this.sideUserOpen;
    if (nextState) {
      this.updateAccountMenuPosition();
    }
    this.sideUserOpen = nextState;
    if (this.sideUserOpen) {
      setTimeout(() => this.updateAccountMenuPosition(), 0);
    }
  }

  private updateAccountMenuPosition(): void {
    updateAppAccountMenuPosition(this);
  }

  @HostListener('document:click')
  onDoc(): void {
    this.closeAll();
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeydown(event: KeyboardEvent): void {
    if (!this.isBrowser || this.isLoginRoute) {
      return;
    }

    const isOpenSearchShortcut =
      (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
    if (!isOpenSearchShortcut) {
      return;
    }

    const target = event.target;
    if (this.isEditableEventTarget(target) && target !== this.globalSearchInputRef?.nativeElement) {
      return;
    }

    event.preventDefault();
    this.openGlobalSearch(true);
  }

  @HostListener('window:resize')
  onResize(): void {
    if (!this.isBrowser) {
      return;
    }
    if (this.resizeFrameId !== undefined) {
      return;
    }
    this.resizeFrameId = window.requestAnimationFrame(() => {
      this.resizeFrameId = undefined;
      this.syncResponsiveShellState();
    });
  }

  private syncResponsiveShellState(): void {
    if (!this.isBrowser) {
      return;
    }

    const nextCollapsed = this.shouldForceCompactSidebar()
      ? true
      : (this.loadStoredSidebarCollapsed() ?? window.innerWidth < 1200);
    const collapsedChanged = this.sideCollapsed !== nextCollapsed;
    this.sideCollapsed = nextCollapsed;

    if (collapsedChanged) {
      this.collapsedSidebarReveal = false;
      this.closeCollapsedAreaFlyout(true);
      this.hideSidebarTooltip();
    }

    if (this.sideUserOpen) {
      setTimeout(() => this.updateAccountMenuPosition(), 0);
    }
    setTimeout(() => this.updateIndicatorPosition(), 80);
  }

  @HostListener('window:storage', ['$event'])
  onStorage(event: StorageEvent): void {
    if (!this.isBrowser) {
      return;
    }
    if (event.key === this.sidebarCollapsedStorageKey) {
      this.sideCollapsed = this.shouldForceCompactSidebar()
        ? true
        : (parseStoredSidebarCollapsed(event.newValue) ?? window.innerWidth < 1200);
      this.collapsedSidebarReveal = false;
      this.closeCollapsedAreaFlyout(true);
      this.hideSidebarTooltip();
      if (this.sideUserOpen) {
        setTimeout(() => this.updateAccountMenuPosition(), 0);
      }
      setTimeout(() => this.updateIndicatorPosition(), 80);
      return;
    }
    if (event.key === 'engineers-salary-reference.broadcast' && event.newValue?.startsWith('logout')) {
      this.auth.forceLogoutFromAnotherTab();
    }
  }

  ngOnInit(): void {
    const initialUrl = this.getCurrentUrl();
    this.isLoginRoute = isAuthRoute(initialUrl);
    if (this.isBrowser) {
      this.syncResponsiveShellState();

      this.showPendingPostLoginWelcomeToast();
      if (!this.isLoginRoute) {
        setTimeout(() => this.initializeNotificationsBridge(), 0);
        setTimeout(() => this.loadMessagesIfAuthenticated(), 0);
      }
    }
    this.updateRouteClasses(initialUrl);
    this.trackHeaderRoute(initialUrl);
    if (!this.isLoginRoute) {
      this.syncNavigationState(initialUrl);
    } else {
      this.activeKey = '';
    }
    this.updateDocumentTitle(initialUrl);
    this.finishInitialShellReload();

    this.router.events
      .pipe(filter(e => e instanceof NavigationStart))
      .subscribe((event: NavigationStart) => {
        this.closeGlobalSearch();
        this.closeCollapsedAreaFlyout(true);
        this.hideSidebarTooltip();
        this.sideUserOpen = false;
        this.notifOpen = false;
        const targetIsAuth = isAuthRoute(event.url);
        if (targetIsAuth) {
          this.isLoginRoute = true;
          this.resetNotificationsBridge();
        }
      });

    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        const url = event.urlAfterRedirects ?? event.url;
        this.isLoginRoute = isAuthRoute(url);
        this.updateRouteClasses(url);
        this.trackHeaderRoute(url);
        if (!this.isLoginRoute) {
          this.showPendingPostLoginWelcomeToast();
          this.initializeNotificationsBridge();
          this.loadMessagesIfAuthenticated();
          this.syncNavigationState(url);
        } else {
          this.resetNotificationsBridge();
          this.activeKey = '';
        }
        this.updateDocumentTitle(url);
        this.finishInitialShellReload();
        setTimeout(() => this.updateIndicatorPosition(), 50);
      });

    this.router.events
      .pipe(filter(e => e instanceof NavigationCancel || e instanceof NavigationError))
      .subscribe(() => {
        this.isLoginRoute = isAuthRoute(this.router.url);
        this.updateRouteClasses(this.router.url);
        this.trackHeaderRoute(this.router.url);
        if (!this.isLoginRoute) {
          this.syncNavigationState(this.router.url);
        } else {
          this.activeKey = '';
        }
        this.updateDocumentTitle(this.router.url);
        this.finishInitialShellReload();
        setTimeout(() => this.updateIndicatorPosition(), 50);
      });
  }

  private initializeNotificationsBridge(): void {
    this.notificationsBridge.init();
  }

  private resetNotificationsBridge(): void {
    this.notificationsBridge.reset();
  }

  private showPendingPostLoginWelcomeToast(): void {
    showPostLoginWelcomeToast(
      this.isBrowser,
      (...args: unknown[]) => this.debugLog(...args),
      (message, ttlMs) => this.toast.success(message, ttlMs)
    );
  }

  private loadMessagesIfAuthenticated(): void {
    if (this.isLoginRoute || !this.auth.isAuthenticated()) {
      return;
    }

    this.getMessagesStore().load();
  }

  private getMessagesStore(): MessagesStoreService {
    return this.injector.get(MessagesStoreService);
  }

  private detectInitialAuthRoute(): boolean {
    if (this.isBrowser && typeof window !== 'undefined') {
      return isAuthRoute(
        `${window.location.pathname}${window.location.search}${window.location.hash}`
      );
    }

    return isAuthRoute(this.router.url);
  }

  private getCurrentUrl(): string {
    if (this.isBrowser && typeof window !== 'undefined') {
      return `${window.location.pathname}${window.location.search}${window.location.hash}`;
    }

    return this.router.url;
  }

  private finishInitialShellReload(): void {
    if (!this.isBrowser || !this.appShellReloading()) {
      return;
    }

    if (this.appShellReloadTimer !== undefined) {
      window.clearTimeout(this.appShellReloadTimer);
    }

    this.appShellReloadTimer = window.setTimeout(() => {
      this.appShellReloadTimer = undefined;
      const activeRequests = this.loadingService.isLoading();
      if (activeRequests > 0) {
        this.finishInitialShellReload();
        return;
      }
      this.appShellReloading.set(false);
      window.requestAnimationFrame(() => {
        document.getElementById('app-startup')?.remove();
        window.dispatchEvent(new Event('resize'));
      });
    }, 16);
  }

  ngOnDestroy(): void {
    this.notificationsPreviewLoadSubscription?.unsubscribe();
    if (this.systemThemeQuery) {
      if (this.systemThemeQuery.removeEventListener) {
        this.systemThemeQuery.removeEventListener('change', this.handleSystemTheme);
      } else if (this.systemThemeQuery.removeListener) {
        this.systemThemeQuery.removeListener(this.handleSystemTheme);
      }
    }
    this.navListScrollCleanup?.();
    if (this.themeNoAnimTimer) {
      window.clearTimeout(this.themeNoAnimTimer);
      this.themeNoAnimTimer = undefined;
    }
    if (this.themeSidebarFreezeTimer) {
      window.clearTimeout(this.themeSidebarFreezeTimer);
      this.themeSidebarFreezeTimer = undefined;
    }
    if (this.headerRightReadyTimer) {
      window.clearTimeout(this.headerRightReadyTimer);
      this.headerRightReadyTimer = undefined;
    }
    if (this.resizeFrameId !== undefined) {
      window.cancelAnimationFrame(this.resizeFrameId);
      this.resizeFrameId = undefined;
    }
    if (this.sidebarTransitionTimer) {
      window.clearTimeout(this.sidebarTransitionTimer);
      this.sidebarTransitionTimer = undefined;
    }
    if (this.appShellReloadTimer !== undefined) {
      window.clearTimeout(this.appShellReloadTimer);
      this.appShellReloadTimer = undefined;
    }
    this.themeSidebarLeaveCleanup?.();
    this.themeSidebarLeaveCleanup = undefined;
    this.clearCollapsedAreaFlyoutCloseTimer();
    if (this.isBrowser && typeof document !== 'undefined') {
      document.documentElement.classList.remove('theme-no-anim');
      document.body.classList.remove('theme-switching');
    }
  }

  private syncNavigationState(url: string): void {
    const normalized = normalizeAppUrl(url);
    if (!normalized) {
      return;
    }

    const shellMatch = this.shellMenuItems.find(
      item => normalized === item.path || normalized.startsWith(`${item.path}/`)
    );
    if (shellMatch) {
      this.activeKey = shellMatch.key;
      return;
    }

    if (normalized === 'tasks') {
      this.activeKey = '';
      return;
    }
    if (normalized.startsWith('tender/tasks')) {
      this.setCurrentArea('Tender');
      this.ensureAreaExpanded('Tender');
      this.activeKey = '';
      return;
    }
    for (const area of Object.keys(this.menus()) as Area[]) {
      const items = this.menus()[area];
      const match = items.find(it => normalized.startsWith(it.path));
      if (match) {
        this.setCurrentArea(area);
        this.ensureAreaExpanded(area);
        this.activeKey = match.key;
        return;
      }
    }
    this.activeKey = '';
  }

  goBackFromHeader(): void {
    const current = this.headerRouteUrl();
    const previous = this.internalRouteHistory.length > 1
      ? this.internalRouteHistory[this.internalRouteHistory.length - 2]
      : null;

    if (previous && previous !== current) {
      this.internalRouteHistory.pop();
      this.isHeaderBackNavigation = true;
      this.router.navigateByUrl('/' + previous);
      return;
    }

    if (current && current !== 'dashboard') {
      this.isHeaderBackNavigation = true;
      this.router.navigateByUrl('/dashboard');
    }
  }

  private trackHeaderRoute(url: string): void {
    if (isAuthRoute(url)) {
      return;
    }

    const normalized = normalizeAppUrl(url);
    if (!normalized) {
      return;
    }

    this.headerRouteUrl.set(normalized);
    if (this.isHeaderBackNavigation) {
      this.isHeaderBackNavigation = false;
      return;
    }

    if (this.internalRouteHistory[this.internalRouteHistory.length - 1] !== normalized) {
      this.internalRouteHistory.push(normalized);
      if (this.internalRouteHistory.length > 24) {
        this.internalRouteHistory.shift();
      }
    }
  }

  private buildHeaderBreadcrumbs(normalizedUrl: string): HeaderBreadcrumb[] {
    if (!normalizedUrl) {
      return [];
    }

    const destinationsByPath = new Map(
      this.allSearchDestinations().map(destination => [destination.path, destination] as const)
    );
    const segments = normalizedUrl.split('/').filter(Boolean);
    if (normalizedUrl === 'dashboard') {
      return [{ label: 'Dashboard', path: 'dashboard', current: true }];
    }

    const breadcrumbs: HeaderBreadcrumb[] = [];
    const reportDetails = normalizedUrl.startsWith('reports/');
    if (reportDetails) {
      breadcrumbs.push({ label: 'Salary Reports', path: 'salary-reports', current: false });
    }

    for (let depth = 1; depth <= segments.length; depth += 1) {
      const path = segments.slice(0, depth).join('/');
      if (path === 'dashboard' || (reportDetails && path === 'reports')) {
        continue;
      }
      const destination = destinationsByPath.get(path);
      const label = destination?.label ?? this.humanizeRouteTitle(path);
      if (!label || breadcrumbs.some(item => item.path === path)) {
        continue;
      }
      breadcrumbs.push({ label, path, current: path === normalizedUrl });
    }

    const last = breadcrumbs[breadcrumbs.length - 1];
    if (last && !last.current) {
      breadcrumbs.push({
        label: this.humanizeRouteTitle(normalizedUrl) || 'Current page',
        path: normalizedUrl,
        current: true
      });
    }

    return breadcrumbs;
  }

  private updateDocumentTitle(url: string): void {
    this.title.setTitle(this.buildDocumentTitle(url));
  }

  private buildDocumentTitle(url: string): string {
    const normalized = normalizeAppUrl(url);
    if (!normalized) {
      return '';
    }

    if (isAuthRoute(url)) {
      if (normalized === 'login') {
        return 'Login';
      }
      if (normalized.startsWith('login/forgot-password')) {
        return 'Forgot Password';
      }
      if (normalized.startsWith('login/reset-password')) {
        return 'Reset Password';
      }
      if (normalized.startsWith('login/password-update')) {
        return 'Update Password';
      }
      if (normalized === 'signup') {
        return 'Sign Up';
      }
      return '';
    }

    const matchedDestination = this.findTitleDestination(normalized);
    if (matchedDestination) {
      return this.formatDocumentTitle(matchedDestination);
    }

    const fallbackLabel = this.humanizeRouteTitle(normalized);
    return fallbackLabel;
  }

  private findTitleDestination(normalizedUrl: string): GlobalSearchDestination | null {
    const candidates = this.allSearchDestinations()
      .slice()
      .sort((left, right) => right.path.length - left.path.length);

    return (
      candidates.find(
        item => normalizedUrl === item.path || normalizedUrl.startsWith(`${item.path}/`)
      ) ?? null
    );
  }

  private formatDocumentTitle(item: GlobalSearchDestination): string {
    const pathSegments = item.path.split('/').filter(Boolean);
    const destinationsByPath = new Map(
      this.allSearchDestinations().map(destination => [destination.path, destination] as const)
    );
    const pageLabels: string[] = [];

    for (let depth = 1; depth < pathSegments.length; depth += 1) {
      const parentPath = pathSegments.slice(0, depth).join('/');
      const parentPage = destinationsByPath.get(parentPath);
      if (parentPage?.label) {
        pageLabels.push(parentPage.label);
      }
    }

    pageLabels.push(item.label);
    return Array.from(new Set(pageLabels)).join(' | ');
  }

  private humanizeRouteTitle(normalizedUrl: string): string {
    const segment = normalizedUrl
      .split('/')
      .filter(Boolean)
      .reverse()
      .find(part => !/^\d+$/.test(part) && !/^[a-f0-9-]{8,}$/i.test(part));

    if (!segment) {
      return '';
    }

    return segment.replace(/[-_]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
  }

  private setCurrentArea(area: Area): void {
    this.currentArea.set(area);
    persistStoredArea(this.isBrowser, area);
  }

  private ensureAreaExpanded(area: Area): void {
    this.expandedAreas.update(current => (current.includes(area) ? current : [...current, area]));
  }

  go(path: string): void {
    const target = '/' + path.replace(/^\/+/, '');
    const current = this.getCurrentUrl().split(/[?#]/, 1)[0];
    if (this.isBrowser && current === target) {
      window.location.assign(target);
      return;
    }
    this.router.navigateByUrl(target);
  }

  private itemMatchesSearch(item: MenuItem, normalizedQuery: string): boolean {
    return itemMatchesAppSearch(item, normalizedQuery);
  }

  private scoreSearchItem(item: MenuItem, normalizedQuery: string): number {
    return scoreAppSearchItem(item, normalizedQuery);
  }

  private normalizeSearchValue(value: string): string {
    return normalizeAppSearchValue(value);
  }

  private buildAreaSearchDestinations(): GlobalSearchDestination[] {
    return this.areaOrder.flatMap(area => {
      const areaLabel = this.areaLabels[area];
      return this.menus()[area].map(item =>
        this.createGlobalSearchDestination(item, areaLabel, [
          areaLabel,
          `${areaLabel} ${item.label}`,
          item.label === 'Dashboard' ? 'home' : '',
          item.label === 'Dashboard' ? `${areaLabel} home` : ''
        ])
      );
    });
  }

  private buildShellSearchDestinations(): GlobalSearchDestination[] {
    return this.shellMenuItems.map(item =>
      this.createGlobalSearchDestination(item, 'Workspace', [
        'workspace',
        'overview',
        'home',
        `workspace ${item.label}`
      ])
    );
  }

  private buildStaticSearchDestinations(): GlobalSearchDestination[] {
    return APP_SEARCH_SUBPAGE_DESTINATIONS.filter(item =>
      this.permissionService.canAccessSection(item.sectionKey)
    ).map(item =>
      this.createGlobalSearchDestination(
        item,
        item.sectionLabel,
        this.buildStaticSearchExtraTerms(item)
      )
    );
  }

  private createGlobalSearchDestination(
    item: MenuItem,
    sectionLabel: string,
    extraSearchTerms: string[] = []
  ): GlobalSearchDestination {
    return {
      ...item,
      sectionLabel,
      metaLabel: `${sectionLabel} | ${formatAppSearchPath(item.path)}`,
      searchTerms: Array.from(
        new Set([...(item.searchTerms ?? []), ...extraSearchTerms].filter(Boolean))
      )
    };
  }

  private buildStaticSearchExtraTerms(item: AppSearchStaticDestination): string[] {
    const contextTerms = item.contextTerms ?? [];
    return [
      item.sectionLabel,
      `${item.sectionLabel} ${item.label}`,
      ...contextTerms,
      ...contextTerms.map(term => `${term} ${item.label}`)
    ];
  }

  private buildGlobalSearchResult(
    item: GlobalSearchDestination,
    query: string,
    score: number,
    index: number
  ): GlobalSearchResultView {
    return {
      index,
      item,
      score,
      labelSegments: buildAppSearchHighlightSegments(item.label, query),
      metaSegments: buildAppSearchHighlightSegments(item.metaLabel, query)
    };
  }

  private getActiveGlobalSearchResult(): GlobalSearchResultView | null {
    const index = this.globalSearchActiveIndex();
    if (index < 0) {
      return null;
    }
    return this.flattenedGlobalSearchResults()[index] ?? null;
  }

  private moveGlobalSearchSelection(direction: 1 | -1): void {
    const results = this.flattenedGlobalSearchResults();
    if (!results.length) {
      this.globalSearchActiveIndex.set(-1);
      return;
    }

    const currentIndex = this.globalSearchActiveIndex();
    const nextIndex =
      currentIndex < 0
        ? direction > 0
          ? 0
          : results.length - 1
        : (currentIndex + direction + results.length) % results.length;

    this.globalSearchActiveIndex.set(nextIndex);
    this.scrollActiveGlobalSearchResultIntoView();
  }

  private syncGlobalSearchActiveIndex(preferFirst: boolean): void {
    if (!this.normalizedGlobalSearchTerm()) {
      this.globalSearchActiveIndex.set(-1);
      return;
    }

    const resultsCount = this.flattenedGlobalSearchResults().length;
    if (!resultsCount) {
      this.globalSearchActiveIndex.set(-1);
      return;
    }

    const activeIndex = this.globalSearchActiveIndex();
    if (preferFirst || activeIndex < 0 || activeIndex >= resultsCount) {
      this.globalSearchActiveIndex.set(0);
      this.scrollActiveGlobalSearchResultIntoView();
    }
  }

  private scrollActiveGlobalSearchResultIntoView(): void {
    if (!this.isBrowser) {
      return;
    }

    const panel = this.globalSearchPanelRef?.nativeElement;
    const activeIndex = this.globalSearchActiveIndex();
    if (!panel || activeIndex < 0) {
      return;
    }

    const activeElement = panel.querySelector<HTMLElement>(`[data-search-index="${activeIndex}"]`);
    activeElement?.scrollIntoView({ block: 'nearest' });
  }

  private focusGlobalSearchInput(selectText = false): void {
    if (!this.isBrowser) {
      return;
    }

    setTimeout(() => {
      const input = this.globalSearchInputRef?.nativeElement;
      if (!input) {
        return;
      }

      input.focus();
      if (selectText) {
        input.select();
      }
    }, 0);
  }

  private rememberRecentSearchPath(path: string): void {
    this.recentSearchPaths.update(history => {
      const nextHistory = [path, ...history.filter(itemPath => itemPath !== path)];
      return nextHistory.slice(0, this.recentSearchLimit);
    });
    this.saveRecentSearchPaths();
  }

  private loadRecentSearchPaths(): string[] {
    if (!this.isBrowser || typeof window === 'undefined') {
      return [];
    }

    try {
      const stored = window.localStorage.getItem(this.recentSearchStorageKey);
      if (!stored) {
        return [];
      }

      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter((value): value is string => typeof value === 'string')
        .slice(0, this.recentSearchLimit);
    } catch {
      return [];
    }
  }

  private saveRecentSearchPaths(): void {
    if (!this.isBrowser || typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(
        this.recentSearchStorageKey,
        JSON.stringify(this.recentSearchPaths())
      );
    } catch {
      // Ignore storage failures to keep search navigation responsive.
    }
  }

  private isEditableEventTarget(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;
    if (!element) {
      return false;
    }

    const tagName = element.tagName;
    return (
      tagName === 'INPUT' ||
      tagName === 'TEXTAREA' ||
      tagName === 'SELECT' ||
      element.isContentEditable
    );
  }

  toggleCollapse(): void {
    this.beginSidebarTransition();
    this.setSidebarCollapsed(!this.sideCollapsed);
    this.collapsedSidebarReveal = false;
    this.closeCollapsedAreaFlyout(true);
    this.hideSidebarTooltip();
    if (this.sideUserOpen) {
      setTimeout(() => this.updateAccountMenuPosition(), 0);
    }
    setTimeout(() => this.updateIndicatorPosition(), 80);
  }

  openCollapsedSidebarFromBrand(event?: Event): void {
    if (!this.sideCollapsed) {
      return;
    }
    event?.preventDefault();
    event?.stopPropagation();

    this.beginSidebarTransition();
    this.setSidebarCollapsed(false);
    this.collapsedSidebarReveal = false;
    this.closeCollapsedAreaFlyout(true);
    this.hideSidebarTooltip();
    if (this.sideUserOpen) {
      setTimeout(() => this.updateAccountMenuPosition(), 0);
    }
    setTimeout(() => this.updateIndicatorPosition(), 80);
  }

  navigateToDashboardFromBrand(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.collapsedSidebarReveal = false;
    const dashboardItem = this.shellMenuItems.find(item => item.key === 'app-dashboard');
    if (!dashboardItem) {
      return;
    }
    this.activateShellItem(dashboardItem);
  }

  onBrandShellActivate(event?: Event): void {
    if (this.sideCollapsed) {
      return;
    }
    this.navigateToDashboardFromBrand(event);
  }

  onSidebarEmptySpaceClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (this.isSidebarInteractiveTarget(target)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (this.sideCollapsed) {
      this.openCollapsedSidebarFromBrand(event);
      return;
    }

    this.toggleCollapse();
  }

  setCollapsedSidebarReveal(active: boolean): void {
    if (this.sidebarTransitioning) {
      this.collapsedSidebarReveal = false;
      return;
    }
    this.collapsedSidebarReveal = this.sideCollapsed && active;
    if (!this.collapsedSidebarReveal) {
      this.scheduleCollapsedAreaFlyoutClose();
      return;
    }
    this.clearCollapsedAreaFlyoutCloseTimer();
  }

  private beginSidebarTransition(): void {
    this.sidebarTransitioning = true;
    this.clearSidebarTransitionTimer();
    if (!this.isBrowser) {
      this.sidebarTransitioning = false;
      return;
    }
    const transitionWindow = this.getSidebarTransitionWindow();
    this.sidebarTransitionTimer = window.setTimeout(() => {
      // Measure the shared selection lens only after sidebar geometry and nav
      // control motion reach their final positions. Measuring at the old 80ms
      // checkpoint captured an in-between width and left the fill misaligned
      // until a full page reload.
      this.updateIndicatorPosition();
      this.sidebarTransitioning = false;
      this.sidebarTransitionTimer = undefined;
    }, transitionWindow);
  }

  private getSidebarTransitionWindow(): number {
    if (!this.isBrowser || typeof document === 'undefined') {
      return this.sidebarTransitionWindowFallback;
    }

    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue('--app-shell-sidebar-transition-window')
      .trim();

    if (!raw) {
      return this.sidebarTransitionWindowFallback;
    }

    const numeric = Number.parseFloat(raw);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return this.sidebarTransitionWindowFallback;
    }

    return raw.endsWith('s') && !raw.endsWith('ms')
      ? Math.round(numeric * 1000)
      : Math.round(numeric);
  }

  private clearSidebarTransitionTimer(): void {
    if (this.sidebarTransitionTimer !== undefined) {
      window.clearTimeout(this.sidebarTransitionTimer);
      this.sidebarTransitionTimer = undefined;
    }
  }

  private isSidebarInteractiveTarget(target: HTMLElement | null): boolean {
    return !!target?.closest(
      [
        'button',
        'a',
        'input',
        'select',
        'textarea',
        'label',
        '[role="button"]',
        '.area-trigger',
        '.area-page-item',
        '.account-pill',
        '.org-pill',
        '.brand-shell',
        '.brand-hitbox',
        '.brand-toggle',
        '.areas-fly',
        '.workspace-panel',
        '.menu-panel',
        '.side-fab'
      ].join(', ')
    );
  }
}
