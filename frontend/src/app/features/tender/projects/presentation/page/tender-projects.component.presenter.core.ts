import { AfterViewInit, Directive, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, forkJoin, from, Observable, of, throwError } from 'rxjs';
import { catchError, map, mergeMap, switchMap, takeUntil, toArray } from 'rxjs/operators';
import {
  FilterState,
  GridAggregateFooterChangeEvent,
  GridAggregateFooterConfig,
  GridAggregateFooterResult,
  GridAggregateScopeOption,
  GridChangeEvent,
  GridColumn,
  GridConfig,
  SortState,
  type GridFilterOptionValue
} from '@shared/data-grid';
import { ToastService as AppToastService } from '@shared/toast/toast.service';
import { AUTH_SESSION_FACADE, type AuthSessionFacade } from '@core/auth/auth-session.facade';
import { DeleteProtectionDialogService } from '@core/security/delete-protection-dialog.service';
import { UndoActionToastService } from '@core/notifications/undo-action-toast.service';
import { TenderRow } from './tender-project-details/project-details.component';
import { TenderProjectsComponentPresenterActivityBase } from './tender-projects.component.presenter.activity.base';
import { TenderProjectChecklistsFacade } from '../tender-project-checklists.facade';
import {
  buildTenderProjectLifecycleAudit,
  buildTenderProjectRowUpdateAudit,
  buildTenderProjectSnapshotAuditChanges,
  buildTenderProjectUpdateAuditChanges,
  syncTenderProjectFiltersForRowUpdate,
  type TenderProjectAuditHost
} from './tender-projects.audit.util';
import {
  attachTenderProjectsSnapshotOutsideClickHandler,
  closeTenderProjectsSnapshotPanel,
  queueTenderProjectsSnapshotMenuPosition,
  setupTenderProjectsSnapshotMenuObserver,
  syncTenderProjectsSnapshotMenuPosition,
  type TenderProjectsGridShellHost
} from './tender-projects.grid-shell.helper';
import {
  clearTenderProjectsPageSkeletonHideTimer,
  deferTenderProjectsInitialPageSkeletonHide,
  fetchTenderProjects,
  type TenderProjectsFetchHost
} from './tender-projects.fetch.helper';
import {
  buildBulkEditPatchFromRows,
  clearLookupIdsForChangedFieldsInRow,
  normalizeBulkTextValue,
  sameBulkTextValue
} from './tender-projects.bulk-edit.helper';
import {
  extractProjectApiErrorDetails,
  extractProjectApiErrorMessage,
  formatProjectDate,
  formatProjectMoney,
  formatProjectPercentFromDecimal,
  normalizeProjectLabel,
  parseProjectNumberOrNull,
  parseProjectPositiveId,
  type ProjectApiFieldIssue
} from './tender-projects.value.util';
import {
  getProjectIdFromTenderRow,
  normalizeProjectApiDate,
  pickProjectIdFromValues,
  pickProjectNameFromValues
} from './tender-projects.mapping.util';
import {
  recordTenderProjectAudit,
  seedTenderProjectActivityFeedCache
} from './tender-projects.activity.helper';
import {
  findTenderProjectLookupByName,
  resolveTenderProjectLookupDisplayLabelById,
  upsertTenderProjectLookup
} from './tender-projects.lookup.util';
import {
  hydrateTenderProjectLookupsFromCache,
  hydrateTenderProjectsFromCache,
  readTenderProjectLookupsCache,
  readTenderProjectsCache,
  writeTenderProjectLookupsCache,
  writeTenderProjectsCache,
  type TenderProjectsCacheHost
} from './tender-projects.cache.helper';
import {
  extractTenderProjectsRealtimeProjectId,
  finishTenderProjectsPrimaryFetch,
  flushDeferredTenderProjectsRefresh,
  shouldRefreshTenderProjectsFromRealtimeMessage,
  startTenderProjectsAutoRefresh,
  stopTenderProjectsAutoRefresh,
  tryTenderProjectsAutoRefresh,
  type TenderProjectsAutoRefreshHost
} from './tender-projects.auto-refresh.helper';
import {
  broadcastTenderProjectLookupsRefreshSignal,
  broadcastTenderProjectsRefreshSignal,
  destroyTenderProjectsSyncChannel,
  initTenderProjectsSyncChannel,
  markTenderProjectsRowForVisualConfirm,
  pinTenderProjectsNewRowToTop,
  showTenderProjectsNewRowAtTop,
  tenderProjectsLookupsRefreshStorageKey,
  tenderProjectsRefreshStorageKey,
  tenderProjectsSyncScope,
  type TenderProjectsPinningHost,
  type TenderProjectsSyncHost
} from './tender-projects.sync-pinning.helper';
import { prepareTenderProjectRowForSave } from './tender-projects.prepare-row.helper';
import {
  buildTenderProjectCreateDto,
  buildTenderProjectUpdateDto,
  buildTenderProjectsPageSizeState,
  createTenderProjectsSyncClientId,
  loadTenderProjectLookups
} from './tender-projects.presenter.logic';
import {
  flushTenderProjectsNotificationRouteIntent,
  subscribeTenderProjectsNotificationRoute,
  syncTenderProjectsNotificationRouteState,
  type ProjectNotificationFocus,
  type ProjectNotificationRouteIntent,
  type TenderProjectsNotificationRouteHost
} from './tender-projects.notification-route.helper';
import {
  mapTenderProjectToRow,
  type TenderProjectRowMappingHost
} from './tender-projects.row-mapping.util';
import type {
  GetProjectAggregatesRequest,
  ListParams,
  ProjectAggregateOperation,
  ProjectAggregateResult,
  ProjectAggregateScope,
  ProjectDetailsResponse,
  ProjectListFilter
} from '@features/tender/projects';

import {
  TenderProject,
  CreateProjectDto,
  UpdateProjectDto,
  IdName,
  AuditTrail,
  CheckList,
  CheckList as ProjectChecklist,
  CreateProjectCommentPayload
} from './tender-projects.contracts';

function patchGridConfigIfChanged(
  currentConfig: GridConfig,
  patch: Partial<GridConfig>
): GridConfig {
  const nextConfig: GridConfig = {
    ...currentConfig,
    ...patch
  };
  const currentRecord = currentConfig as Record<string, unknown>;
  const nextRecord = nextConfig as Record<string, unknown>;
  const keys = new Set([...Object.keys(currentRecord), ...Object.keys(nextRecord)]);
  for (const key of keys) {
    if (currentRecord[key] !== nextRecord[key]) {
      return nextConfig;
    }
  }
  return currentConfig;
}
import type { LookupKind, LookupsCache, Status, ToastKind } from './tender-projects.types';
import type {
  ChecklistItem,
  ChecklistSubItem
} from './tender-project-details/project-details.component';
import { parseChecklistNotesEnvelope } from './tender-project-details/project-details-checklist-notes.util';
import { environment } from '../../../../../../environments/environment';

const PROJECT_BULK_UPDATE_CONCURRENCY = 4;

const PROJECT_AGGREGATE_SCOPE_OPTIONS: ReadonlyArray<GridAggregateScopeOption> = [
  {
    value: 'filtered',
    label: 'Filtered',
    shortLabel: 'Fx',
    description: 'After current filters'
  },
  {
    value: 'page',
    label: 'Page',
    shortLabel: 'Pg',
    description: 'Current page only'
  },
  {
    value: 'all',
    label: 'All Data',
    shortLabel: 'All',
    description: 'Entire dataset'
  }
];

const PROJECT_AGGREGATE_OPERATION_LABELS: Record<ProjectAggregateOperation, string> = {
  sum: 'Sum',
  avg: 'Average',
  count: 'Count',
  min: 'Min',
  max: 'Max',
  distinct: 'Distinct',
  median: 'Median',
  percent: 'Percent'
};

@Directive()
export class TenderProjectsComponentPresenter
  extends TenderProjectsComponentPresenterActivityBase
  implements OnInit, OnDestroy, AfterViewInit
{
  private readonly ENABLE_PROJECT_AGGREGATE_FOOTER = true;
  pageBootstrapPending = true;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notificationToast = inject(AppToastService);
  private readonly authSessionFacade = inject(AUTH_SESSION_FACADE) as AuthSessionFacade & {
    initializeSession(): Promise<void>;
  };
  private readonly PROJECTS_AUTO_REFRESH_MS = 30_000;
  private readonly PROJECTS_REFRESH_MIN_INTERVAL_MS = 2_500;
  private readonly NEWLY_CREATED_ROW_PIN_MS = 60_000;
  private readonly DELETE_UNDO_WINDOW_MS = 6_000;
  private readonly PROJECT_UPDATE_UNDO_WINDOW_MS = 7_000;
  private readonly INITIAL_PAGE_SKELETON_MIN_MS = 400;
  private readonly AUTO_SAVE_SUCCESS_TOAST_MIN_INTERVAL_MS = 4_000;
  private readonly PROJECT_CALENDAR_FETCH_PAGE_SIZE = 500;
  private readonly PROJECT_CALENDAR_FETCH_MAX_ROWS = 5_000;
  private readonly PROJECTS_REFRESH_BROADCAST_KEY = 'engineers-salary-reference.tender.projects.refresh';
  private readonly LOOKUPS_REFRESH_BROADCAST_KEY = 'engineers-salary-reference.tender.projects.lookups.refresh';
  private readonly PROJECTS_SYNC_CHANNEL_NAME = 'engineers-salary-reference.tender.projects.sync';
  private projectsAutoRefreshTimer: ReturnType<typeof setInterval> | null = null;
  private lastProjectsRefreshTriggerAt = 0;
  private projectsPrimaryFetchInFlight = false;
  private clearExistingRowsBeforeFetch = false;
  private queuedProjectsRefresh = false;
  isLoadingMore = false;
  private deferredProjectsRefreshWhileBusy = false;
  private suppressProjectGridSelection = false;
  private skipNextDetailsCloseRefresh = false;
  private projectsFetchFailureCount = 0;
  private projectsAutoRefreshBackoffUntil = 0;
  private newlyCreatedRowKey: string | null = null;
  private newlyCreatedRowPinUntil = 0;
  private pageSkeletonShownAt = 0;
  private pageSkeletonHideTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly syncClientId = this.createSyncClientId();
  private projectsSyncChannel: BroadcastChannel | null = null;
  private readonly deleteProtection = inject(DeleteProtectionDialogService);
  private readonly undoToast = inject(UndoActionToastService);
  private readonly tenderProjectChecklistsFacade = inject(TenderProjectChecklistsFacade);
  private authBootstrapTask: Promise<void> | null = null;
  private authBootstrapCompleted = false;
  private queuedProjectsFetchAfterBootstrap = false;
  private projectCalendarRowsRequestToken = 0;
  private projectCalendarRowsLoadedKey = '';
  private projectCalendarRowsInFlightKey = '';
  private presenterDestroyed = false;
  private readonly checklistPrefetchInFlight = new Map<number, Promise<void>>();
  private readonly projectDetailsPrefetchInFlight = new Map<number, Promise<void>>();
  private readonly projectDetailsRealtimeRefreshInFlight = new Map<number, Promise<void>>();
  private readonly projectDetailsPrefetched = new Set<number>();
  private projectUpdateInFlight = false;
  projectDetailsSaveErrorMessage = '';
  projectDetailsSaveFieldIssues: ProjectApiFieldIssue[] = [];
  deleteAuthorizationCode = '';
  deleteAuthorizationError = '';
  readonly projectAggregateScopeOptions = PROJECT_AGGREGATE_SCOPE_OPTIONS;
  projectAggregateScope: ProjectAggregateScope = 'filtered';
  projectAggregateFooterLoading = false;
  projectAggregateTotalRows = 0;
  private projectAggregateRequestToken = 0;
  private readonly projectAggregateResults = new Map<string, ProjectAggregateResult>();
  private readonly projectAggregateOperations = new Map<string, ProjectAggregateOperation>();
  private projectAggregateOperationsVersion = 0;
  private projectAggregateResultsVersion = 0;
  private projectAggregateFooterColumnsCacheSource: readonly GridColumn<TenderRow>[] | null = null;
  private projectAggregateFooterColumnsCache: GridColumn<TenderRow>[] = [];
  private projectAggregateResultsRecordCacheVersion = -1;
  private projectAggregateResultsRecordCache: Record<string, GridAggregateFooterResult> = {};
  private projectAggregateFooterConfigCacheKey = '';
  private projectAggregateFooterConfigCache: GridAggregateFooterConfig<TenderRow> | null = null;
  private lastAutoSaveSuccessToastAt = 0;
  private pendingProjectNotificationRouteIntent: ProjectNotificationRouteIntent | null = null;
  private projectRouteSyncInFlight = false;
  private projectRouteNavigationInFlight = false;
  projectNotificationFocus: ProjectNotificationFocus | null = null;

  get detailsAutoSaveBusy(): boolean {
    return this.projectUpdateInFlight;
  }

  ngOnInit() {
    this.refreshLookupPresentationCaches();
    this.hydrateLookupsFromCache();
    this.hydrateProjectListQueryStateFromStorage();
    this.loadProjectAggregatePreferences();
    this.stripProjectAggregateColumns();
    if (this.shouldUseProjectsCache()) {
      this.hydrateProjectsFromCache();
      if (this.rows.length > 0) {
        this.totalProjectRecords = Math.max(this.totalProjectRecords, this.rows.length);
      }
    }
    this.syncProjectGridConfig();
    this.subscribeToNotificationRoute();
    void this.bootstrapTenderProjectsPage();
  }

  ngAfterViewInit() {
    this.setupSnapshotMenuObserver();
    this.attachSnapshotOutsideClickHandler();
    this.stripProjectAggregateColumns();
  }

  ngOnDestroy() {
    this.presenterDestroyed = true;
    this.stopProjectsAutoRefresh();
    this.destroyProjectsSyncChannel();
    this.cellRendererCache.clear();
    if (this.snapshotOutsideClickHandler && this.isBrowser) {
      this.doc.removeEventListener('click', this.snapshotOutsideClickHandler, true);
      this.snapshotOutsideClickHandler = null;
    }
    if (this.snapshotMenuObserver) {
      this.snapshotMenuObserver.disconnect();
      this.snapshotMenuObserver = null;
    }
    if (this.snapshotMenuRaf != null) {
      cancelAnimationFrame(this.snapshotMenuRaf);
      this.snapshotMenuRaf = null;
    }
    this.clearPageSkeletonHideTimer();

    this.destroy$.next();
    this.destroy$.complete();
  }
  @HostListener('window:focus')
  onWindowFocus(): void {
    this.tryAutoRefreshProjects();
  }

  @HostListener('window:online')
  onWindowOnline(): void {
    this.tryAutoRefreshProjects(true);
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (this.doc.visibilityState === 'visible') this.tryAutoRefreshProjects(true);
  }

  @HostListener('window:pageshow')
  onPageShow(): void {
    this.tryAutoRefreshProjects(true);
  }

  @HostListener('window:storage', ['$event'])
  onWindowStorage(event: StorageEvent): void {
    if (!this.isBrowser) return;
    if (event.key === this.projectsRefreshStorageKey()) {
      this.handleIncomingProjectsSync('projects');
      return;
    }
    if (event.key !== this.lookupsRefreshStorageKey()) return;
    this.handleIncomingProjectsSync('lookups');
  }

  private handleIncomingProjectsSync(kind: 'projects' | 'lookups'): void {
    if (kind === 'projects') return void this.tryAutoRefreshProjects();
    this.refreshLookupPresentationCaches();
    this.lookupsLoadedAt = 0;
    void this.loadLookups();
  }

  private async bootstrapTenderProjectsPage(): Promise<void> {
    try {
      if (!this.presenterDestroyed && !this.pageSkeletonLoading) {
        this.pageSkeletonShownAt = Date.now();
        this.pageSkeletonLoading = true;
        this.loading = true;
        this.cdr.markForCheck();
      }

      await this.ensureAuthReadyForProjects();
      if (this.presenterDestroyed) {
        return;
      }

      const bootstrapLoaded = await this.loadProjectsBootstrap();
      if (!bootstrapLoaded) {
        if (!this.lookupsLoaded) {
          await this.loadLookups();
        }
        if (this.presenterDestroyed) {
          return;
        }

        this.scheduleActivityPrefetch(this.rows);
        this.fetchProjects();
      }
    } finally {
      if (!this.presenterDestroyed) {
        this.pageBootstrapPending = false;
        this.startProjectsAutoRefresh();
        this.initProjectsSyncChannel();
        this.subscribeToProjectRealtimeUpdates();
        this.flushDeferredProjectsRefresh();
      }
    }
  }

  private async loadProjectsBootstrap(): Promise<boolean> {
    this.fetchToken += 1;
    const requestToken = this.fetchToken;
    // Always surface the first page bootstrap skeleton, even if cached rows are present.
    const showLoader = true;
    this.projectsPrimaryFetchInFlight = true;
    this.pageSkeletonShownAt = Date.now();
    if (this.pageSkeletonLoading) {
      this.clearPageSkeletonHideTimer();
    }
    this.pageSkeletonLoading = showLoader;
    this.loading = showLoader;
    this.error = null;
    this.cdr.markForCheck();

    try {
      const bootstrap = await firstValueFrom(
        this.projectsFacade.api.bootstrap(this.buildProjectsListParams())
      );

      if (this.presenterDestroyed || requestToken !== this.fetchToken) {
        this.finishPrimaryProjectsFetch(requestToken);
        return true;
      }

      this.statuses = bootstrap.lookups.statuses ?? [];
      this.top = bootstrap.lookups.types ?? [];
      this.stages = bootstrap.lookups.stages ?? [];
      this.doi = bootstrap.lookups.degreesOfImportance ?? [];
      this.owners = bootstrap.lookups.owners ?? [];
      this.ownerTypes = bootstrap.lookups.ownerTypes ?? [];
      this.countries = bootstrap.lookups.countries ?? [];
      this.assignToSettings = bootstrap.lookups.assignToSettings ?? [];
      this.inChargeSettings = bootstrap.lookups.inChargeSettings ?? [];
      this.lookupsLoaded = true;
      this.lookupsLoadedAt = Date.now();
      this.applyLookupPresentationState();
      this.rebuildLookupMaps();
      this.writeLookupsCache();

      const mappedRows = (bootstrap.projects.items ?? []).map(project => this.mapToRow(project));
      const resolvedTotalRecords =
        typeof bootstrap.projects.meta?.totalCount === 'number' &&
        Number.isFinite(bootstrap.projects.meta.totalCount)
          ? Math.max(0, bootstrap.projects.meta.totalCount)
          : mappedRows.length;

      this.totalProjectRecords = resolvedTotalRecords;
      this.projectRemoteGroups = Array.isArray(bootstrap.projects.meta?.grouping?.groups)
        ? bootstrap.projects.meta.grouping.groups
        : [];
      this.syncProjectGridConfig();
      this.rows = this.pinNewlyCreatedRowToTop(mappedRows);
      this.resetRowKeySet(this.rows);
      this.rehydrateRowsFromLookups();
      this.loading = false;
      this.deferInitialPageSkeletonHide(requestToken);
      this.projectsFetchFailureCount = 0;
      this.projectsAutoRefreshBackoffUntil = 0;
      this.writeProjectsCache(this.rows);
      this.scheduleActivityPrefetch(this.rows);
      this.onProjectsPageLoaded();
      this.finishPrimaryProjectsFetch(requestToken);
      this.cdr.markForCheck();
      return true;
    } catch (error) {
      this.debugWarn(
        '[TenderProjects] Bootstrap endpoint failed; falling back to separate page bootstrap.',
        error
      );
      this.finishPrimaryProjectsFetch(requestToken);
      return false;
    }
  }

  protected override onProjectQueryStateChanged(): void {
    this.currentProjectsPage = 1;
    this.syncProjectGridConfig();
    if (this.pageBootstrapPending || this.presenterDestroyed) {
      return;
    }
    this.fetchProjects();
  }

  private hydrateProjectListQueryStateFromStorage(): void {
    if (!this.isBrowser) {
      return;
    }

    try {
      const rawState = localStorage.getItem(`grid-state-${this.projectGridStateKey}`);
      if (!rawState) {
        return;
      }

      const parsed = JSON.parse(rawState) as {
        sorts?: SortState[];
        filters?: FilterState[];
        groupColumns?: string[];
        groupDateIntervals?: Record<string, 'day' | 'week' | 'month' | 'quarter' | 'year'>;
        pageSize?: number;
      };

      this.gridSortStates = Array.isArray(parsed.sorts) ? [...parsed.sorts] : [];
      this.gridFilterStates = Array.isArray(parsed.filters) ? [...parsed.filters] : [];
      this.gridGroupColumnsState = Array.isArray(parsed.groupColumns)
        ? parsed.groupColumns
            .filter(
              (field): field is string => typeof field === 'string' && field.trim().length > 0
            )
            .map(field => field.trim())
        : [];
      this.gridGroupDateIntervalsState =
        parsed.groupDateIntervals && typeof parsed.groupDateIntervals === 'object'
          ? parsed.groupDateIntervals
          : {};

      const savedPageSize = Number(parsed.pageSize);
      if (
        Number.isFinite(savedPageSize) &&
        savedPageSize > 0 &&
        this.tablePageSizeOptions.includes(savedPageSize)
      ) {
        this.currentPageSize = savedPageSize;
      }
    } catch (error) {
      this.debugWarn('[TenderProjects] Failed to hydrate saved grid query state.', error);
    }
  }

  private shouldUseProjectsCache(): boolean {
    if (this.currentProjectsPage !== 1) {
      return false;
    }

    if (
      this.gridSortStates.length ||
      this.gridGroupColumnsState.length ||
      this.buildProjectListApiFilters().length
    ) {
      return false;
    }

    const searchTerm = this.extractGlobalSearchTerm(this.gridFilterStates);
    const hasColumnFilters = this.gridFilterStates.some(
      filter => !['globalSearch', 'menuSearch'].includes(String(filter.operator ?? ''))
    );

    return !searchTerm && !hasColumnFilters;
  }

  private syncProjectGridConfig(): void {
    this.gridConfig = patchGridConfigIfChanged(this.gridConfig, {
      pageSize: this.currentPageSize,
      pageSizeOptions: this.tablePageSizeOptions,
      remoteData: true,
      remoteCurrentPage: this.currentProjectsPage,
      remoteTotalRecords: this.totalProjectRecords
    });
    this.projectGridConfig = patchGridConfigIfChanged(this.projectGridConfig, {
      ...this.gridConfig,
      simpleMode: false,
      pagination: true,
      // Salary Reports can render 100 rows × 19 wide cells per remote page. Rendering the
      // entire page creates thousands of live DOM nodes and makes unrelated shell motion
      // expensive. Tender Projects keeps its established non-virtual grouping behavior.
      virtualScroll: this.isSalaryReportsGrid,
      virtualScrollBuffer: this.isSalaryReportsGrid ? 4 : this.gridConfig.virtualScrollBuffer,
      trackRowsByBusinessId: this.isSalaryReportsGrid
        ? true
        : this.gridConfig.trackRowsByBusinessId,
      rowHeight: 28,
      pinSelectionColumn: true,
      autoSizeColumns: false,
      remoteData: true,
      remoteCurrentPage: this.currentProjectsPage,
      remoteTotalRecords: this.totalProjectRecords
    });
  }

  private stripProjectAggregateColumns(): void {
    const clearAggregate = (
      column: GridColumn<TenderRow>
    ): { column: GridColumn<TenderRow>; changed: boolean } => {
      if (!column.aggregate) {
        return { column, changed: false };
      }
      const next = { ...column };
      delete next.aggregate;
      return { column: next, changed: true };
    };

    if (this.ENABLE_PROJECT_AGGREGATE_FOOTER) {
      let sourceChanged = false;
      let operationsChanged = false;
      const nextSourceColumns = this.gridColumns.map(current => {
        operationsChanged = this.captureProjectAggregateOperation(current) || operationsChanged;
        const result = clearAggregate(current);
        sourceChanged = sourceChanged || result.changed;
        return result.column;
      });

      if (sourceChanged) {
        this.gridColumns = nextSourceColumns;
      }

      if (!this.grid) {
        if (operationsChanged || sourceChanged) {
          this.invalidateProjectAggregateFooterColumnsCache();
          this.cdr.markForCheck();
        }
        return;
      }

      let gridChanged = false;
      const nextGridColumns = this.grid.columns.map(current => {
        const typedColumn = current as GridColumn<TenderRow>;
        operationsChanged = this.captureProjectAggregateOperation(typedColumn) || operationsChanged;
        const result = clearAggregate(typedColumn);
        gridChanged = gridChanged || result.changed;
        return result.column;
      });

      if (gridChanged) {
        this.grid.columns = nextGridColumns;
      }

      if (operationsChanged || sourceChanged || gridChanged) {
        this.invalidateProjectAggregateFooterColumnsCache();
        this.cdr.markForCheck();
      }
      return;
    }

    let sourceChanged = false;
    this.gridColumns = this.gridColumns.map(current => {
      const result = clearAggregate(current);
      sourceChanged = sourceChanged || result.changed;
      return result.column;
    });

    this.projectAggregateFooterLoading = false;
    this.projectAggregateTotalRows = 0;
    this.projectAggregateResults.clear();

    if (!this.grid) {
      return;
    }

    let gridChanged = false;
    this.grid.columns = this.grid.columns.map(current => {
      const result = clearAggregate(current as GridColumn<TenderRow>);
      gridChanged = gridChanged || result.changed;
      return result.column;
    });

    if (sourceChanged || gridChanged) {
      this.grid.saveState();
    }
    this.cdr.markForCheck();
  }

  private buildProjectsListParams(): ListParams {
    const { sortBy, sortDirection } = this.resolveListSort(this.gridSortStates);
    const { groupBy, groupDirection, groupDateInterval } = this.getRemoteProjectGroupingParams();
    const filters = this.buildSerializedProjectFilters();
    const search = this.extractGlobalSearchTerm(this.gridFilterStates);

    return {
      pageNumber: this.currentProjectsPage,
      pageSize: this.currentPageSize,
      ...(search ? { search } : {}),
      ...(sortBy ? { sortBy } : {}),
      ...(sortDirection ? { sortDirection } : {}),
      ...(groupBy ? { groupBy } : {}),
      ...(groupDirection ? { groupDirection } : {}),
      ...(groupDateInterval ? { groupDateInterval } : {}),
      ...(filters ? { filters } : {})
    };
  }

  protected getRemoteProjectGroupingParams(): Pick<
    ListParams,
    'groupBy' | 'groupDirection' | 'groupDateInterval'
  > {
    const groupBy = this.gridGroupColumnsState[0]?.trim();
    if (!groupBy) {
      return {};
    }

    const groupedSort = this.gridSortStates.find(
      sort =>
        String(sort?.field ?? '').trim() === groupBy &&
        (sort.direction === 'asc' || sort.direction === 'desc')
    );

    return {
      groupBy,
      groupDirection: groupedSort?.direction === 'desc' ? 'desc' : 'asc',
      groupDateInterval: this.gridGroupDateIntervalsState[groupBy]
    };
  }

  private buildSerializedProjectFilters(): string | undefined {
    const gridFilters = this.buildGridApiFilters(this.gridFilterStates);
    const filters = [...this.buildProjectListApiFilters(), ...gridFilters];
    if (!filters.length) {
      return undefined;
    }
    return JSON.stringify(filters);
  }

  private buildSerializedProjectFiltersExcludingField(field: string): string | undefined {
    const normalizedField = String(field ?? '')
      .trim()
      .replace(/_/g, '')
      .toLowerCase();

    const gridFilters = this.buildGridApiFilters(this.gridFilterStates).filter(
      filter =>
        String(filter.field ?? '')
          .trim()
          .replace(/_/g, '')
          .toLowerCase() !== normalizedField
    );
    const filters = [...this.buildProjectListApiFilters(), ...gridFilters];
    if (!filters.length) {
      return undefined;
    }
    return JSON.stringify(filters);
  }

  projectAggregateFooterColumns(): GridColumn<TenderRow>[] {
    const source = this.gridColumns;
    if (this.projectAggregateFooterColumnsCacheSource === source) {
      return this.projectAggregateFooterColumnsCache;
    }
    const visibleColumns = source.filter(column => !column.hidden);
    this.projectAggregateFooterColumnsCacheSource = source;
    this.projectAggregateFooterColumnsCache = visibleColumns;
    return visibleColumns;
  }

  projectAggregateCurrentOperation(
    column: GridColumn<TenderRow>
  ): ProjectAggregateOperation | null {
    return this.projectAggregateOperations.get(this.projectAggregateFieldKey(column)) ?? null;
  }

  projectAggregateFooterConfig(): GridAggregateFooterConfig<TenderRow> {
    const cacheKey = [
      this.ENABLE_PROJECT_AGGREGATE_FOOTER ? '1' : '0',
      this.projectAggregateScope,
      String(this.projectAggregateOperationsVersion),
      this.projectAggregateFooterLoading ? '1' : '0',
      String(this.projectAggregateTotalRows),
      String(this.projectAggregateResultsVersion)
    ].join('|');

    if (
      this.projectAggregateFooterConfigCache &&
      this.projectAggregateFooterConfigCacheKey === cacheKey
    ) {
      return this.projectAggregateFooterConfigCache;
    }

    const nextConfig: GridAggregateFooterConfig<TenderRow> = {
      enabled: this.ENABLE_PROJECT_AGGREGATE_FOOTER,
      scope: this.projectAggregateScope,
      scopeOptions: this.projectAggregateScopeOptions,
      loading: this.projectAggregateFooterLoading,
      emptyPrimaryText: 'Calculate',
      loadingPrimaryText: '...',
      totalRows: this.projectAggregateTotalRows,
      summaryText: this.projectAggregateScopeSummaryText(),
      results: this.projectAggregateResultsRecord(),
      currentOperation: column => this.projectAggregateCurrentOperation(column),
      operationLabel: operation =>
        this.projectAggregateOperationLabel(operation as ProjectAggregateOperation),
      supportsOperation: (column, operation) =>
        this.projectAggregateSupportsOperation(column, operation as ProjectAggregateOperation),
      formatValue: (column, result) =>
        this.formatProjectAggregateValue(
          column,
          result.value,
          result.operation as ProjectAggregateOperation
        )
    };

    this.projectAggregateFooterConfigCacheKey = cacheKey;
    this.projectAggregateFooterConfigCache = nextConfig;
    return nextConfig;
  }

  handleProjectAggregateFooterChange(event: GridAggregateFooterChangeEvent<TenderRow>): void {
    if (!this.ENABLE_PROJECT_AGGREGATE_FOOTER) {
      return;
    }
    if (event.type === 'scope') {
      if (this.projectAggregateScope === event.scope) {
        return;
      }
      this.projectAggregateScope = event.scope;
      this.persistProjectAggregatePreferences();
      void this.refreshProjectAggregateFooter();
      return;
    }

    if (this.projectAggregateCurrentOperation(event.column) === event.operation) {
      return;
    }
    this.applyProjectAggregateColumnOperation(event.column, event.operation);
    void this.refreshProjectAggregateFooter();
  }

  projectAggregateScopeSummaryText(): string {
    if (this.projectAggregateFooterLoading) {
      return 'Loading from backend';
    }
    if (this.projectAggregateTotalRows > 0) {
      return `${this.projectAggregateTotalRows.toLocaleString('en-US')} rows`;
    }
    return 'Choose scope';
  }

  closeProjectAggregateMenus(): void {}

  projectAggregateCellPrimaryText(column: GridColumn<TenderRow>): string {
    const operation = this.projectAggregateCurrentOperation(column);
    if (!operation) {
      return 'Calculate';
    }
    if (this.projectAggregateFooterLoading) {
      return 'Calculating...';
    }
    const result = this.projectAggregateResultForColumn(column);
    if (!result) {
      return '—';
    }
    return this.formatProjectAggregateValue(column, result.value, operation);
  }

  projectAggregateCellSecondaryText(column: GridColumn<TenderRow>): string {
    const operation = this.projectAggregateCurrentOperation(column);
    return operation ? this.projectAggregateOperationLabel(operation) : 'Choose function';
  }

  setProjectAggregateOperation(
    column: GridColumn<TenderRow>,
    operation: ProjectAggregateOperation,
    event?: Event
  ): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!this.projectAggregateSupportsOperation(column, operation)) {
      return;
    }
    this.closeProjectAggregateMenus();
    this.applyProjectAggregateColumnOperation(column, operation);
    void this.refreshProjectAggregateFooter();
  }

  clearProjectAggregateOperation(column: GridColumn<TenderRow>, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.closeProjectAggregateMenus();
    this.applyProjectAggregateColumnOperation(column, null);
    void this.refreshProjectAggregateFooter();
  }

  setProjectAggregateScope(scope: ProjectAggregateScope, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.projectAggregateScope === scope) {
      this.closeProjectAggregateMenus();
      return;
    }
    this.projectAggregateScope = scope;
    this.persistProjectAggregatePreferences();
    this.closeProjectAggregateMenus();
    void this.refreshProjectAggregateFooter();
  }

  onProjectsPageLoaded(): void {
    this.isLoadingMore = false;
    void this.refreshProjectAggregateFooter();
    void this.flushPendingProjectNotificationRouteIntent();
  }

  private applyProjectAggregateColumnOperation(
    column: GridColumn<TenderRow>,
    operation: ProjectAggregateOperation | null
  ): void {
    if (operation && !this.projectAggregateSupportsOperation(column, operation)) {
      return;
    }

    const field = this.projectAggregateFieldKey(column);
    if (!this.setProjectAggregateOperationForField(field, operation)) {
      return;
    }
    this.cdr.markForCheck();
  }

  private projectAggregateResultsRecord(): Record<string, GridAggregateFooterResult> {
    if (this.projectAggregateResultsRecordCacheVersion === this.projectAggregateResultsVersion) {
      return this.projectAggregateResultsRecordCache;
    }

    const results: Record<string, GridAggregateFooterResult> = {};
    for (const [field, aggregate] of this.projectAggregateResults.entries()) {
      results[field] = {
        field: aggregate.field,
        operation: aggregate.operation,
        value: aggregate.value
      };
    }
    this.projectAggregateResultsRecordCacheVersion = this.projectAggregateResultsVersion;
    this.projectAggregateResultsRecordCache = results;
    return results;
  }

  private async refreshProjectAggregateFooter(): Promise<void> {
    if (!this.ENABLE_PROJECT_AGGREGATE_FOOTER) {
      this.projectAggregateFooterLoading = false;
      this.projectAggregateTotalRows = 0;
      this.projectAggregateResults.clear();
      this.projectAggregateResultsVersion += 1;
      this.cdr.markForCheck();
      return;
    }

    const request = this.buildProjectAggregateRequest();
    const requestToken = ++this.projectAggregateRequestToken;

    if (!request) {
      this.projectAggregateFooterLoading = false;
      this.projectAggregateTotalRows = 0;
      this.projectAggregateResults.clear();
      this.projectAggregateResultsVersion += 1;
      this.cdr.markForCheck();
      return;
    }

    this.projectAggregateFooterLoading = true;
    this.cdr.markForCheck();

    try {
      const response = await firstValueFrom(this.api.getAggregates(request));
      if (requestToken !== this.projectAggregateRequestToken || this.presenterDestroyed) {
        return;
      }

      this.projectAggregateResults.clear();
      this.projectAggregateTotalRows = Math.max(0, Number(response.totalRows ?? 0) || 0);
      for (const aggregate of response.aggregates ?? []) {
        this.projectAggregateResults.set(
          this.projectAggregateResultKey(aggregate.field),
          aggregate
        );
      }
      this.projectAggregateResultsVersion += 1;
    } catch (error) {
      if (requestToken !== this.projectAggregateRequestToken || this.presenterDestroyed) {
        return;
      }
      this.projectAggregateTotalRows = 0;
      this.projectAggregateResults.clear();
      this.projectAggregateResultsVersion += 1;
      this.debugWarn('[TenderProjects] Failed to load project aggregates.', error);
    } finally {
      if (requestToken === this.projectAggregateRequestToken && !this.presenterDestroyed) {
        this.projectAggregateFooterLoading = false;
        this.cdr.markForCheck();
      }
    }
  }

  private buildProjectAggregateRequest(): GetProjectAggregatesRequest | null {
    const aggregates = this.projectAggregateFooterColumns()
      .map(column => {
        const operation = this.projectAggregateCurrentOperation(column);
        if (!operation) {
          return null;
        }
        return {
          field: String(column.field ?? '').trim(),
          operation
        };
      })
      .filter(
        (aggregate): aggregate is { field: string; operation: ProjectAggregateOperation } =>
          !!aggregate
      );

    if (!aggregates.length) {
      return null;
    }

    return {
      ...this.buildProjectsListParams(),
      scope: this.projectAggregateScope,
      aggregates
    };
  }

  private projectAggregateResultForColumn(
    column: GridColumn<TenderRow>
  ): ProjectAggregateResult | null {
    const result = this.projectAggregateResults.get(this.projectAggregateFieldKey(column));
    const operation = this.projectAggregateCurrentOperation(column);
    if (!result || !operation || result.operation !== operation) {
      return null;
    }
    return result;
  }

  private projectAggregateOperationLabel(operation: ProjectAggregateOperation): string {
    return PROJECT_AGGREGATE_OPERATION_LABELS[operation] ?? 'Calculate';
  }

  private formatProjectAggregateValue(
    column: GridColumn<TenderRow>,
    value: unknown,
    operation: ProjectAggregateOperation
  ): string {
    if (value === null || value === undefined || value === '') {
      return '—';
    }

    const field = this.projectAggregateFieldKey(column);
    if (field === 'price') {
      const parsed = this.parseNumberOrNull(value);
      return parsed != null ? this.formatMoney(parsed) : '—';
    }

    if (field === 'prb') {
      return this.formatPercentFromDecimal(value, '—');
    }

    if (operation === 'percent') {
      const parsed = this.parseNumberOrNull(value);
      return parsed != null ? `${parsed.toFixed(2)}%` : '—';
    }

    if (operation === 'count' || operation === 'distinct') {
      const parsed = Number(value);
      return Number.isFinite(parsed)
        ? parsed.toLocaleString('en-US', { maximumFractionDigits: 0 })
        : String(value);
    }

    if (this.projectAggregateIsDateColumn(column)) {
      return this.formatDate(value);
    }

    if (typeof column.format === 'function') {
      try {
        return column.format(value);
      } catch {
        // Fall through to the generic formatter below.
      }
    }

    const parsedNumber = this.parseNumberOrNull(value);
    if (parsedNumber != null) {
      return parsedNumber.toLocaleString('en-US', {
        minimumFractionDigits: Number.isInteger(parsedNumber) ? 0 : 2,
        maximumFractionDigits: 2
      });
    }

    return String(value);
  }

  private projectAggregateSupportsOperation(
    column: GridColumn<TenderRow>,
    operation: ProjectAggregateOperation
  ): boolean {
    if (operation === 'count' || operation === 'distinct') {
      return true;
    }

    if (operation === 'min' || operation === 'max') {
      return true;
    }

    return this.projectAggregateIsNumericColumn(column);
  }

  private projectAggregateIsNumericColumn(column: GridColumn<TenderRow>): boolean {
    const field = this.projectAggregateFieldKey(column);
    return column.type === 'number' || field === 'price' || field === 'prb';
  }

  private projectAggregateIsDateColumn(column: GridColumn<TenderRow>): boolean {
    const field = this.projectAggregateFieldKey(column);
    return (
      column.type === 'date' ||
      field === 'deadline' ||
      field === 'startdate' ||
      field === 'enddate' ||
      field === 'acceptdate'
    );
  }

  private projectAggregateFieldKey(fieldOrColumn: string | GridColumn<TenderRow>): string {
    const rawField =
      typeof fieldOrColumn === 'string' ? fieldOrColumn : String(fieldOrColumn.field ?? '');
    return rawField.trim().replace(/_/g, '').toLowerCase();
  }

  private projectAggregateResultKey(field: string): string {
    return this.projectAggregateFieldKey(field);
  }

  private loadProjectAggregatePreferences(): void {
    if (!this.isBrowser) {
      return;
    }

    try {
      const savedScope = localStorage.getItem(this.projectAggregateScopeStorageKey());
      if (savedScope === 'page' || savedScope === 'filtered' || savedScope === 'all') {
        this.projectAggregateScope = savedScope;
      }
    } catch (error) {
      this.debugWarn('[TenderProjects] Failed to restore aggregate scope preference.', error);
    }
  }

  private persistProjectAggregatePreferences(): void {
    if (!this.isBrowser) {
      return;
    }

    try {
      localStorage.setItem(this.projectAggregateScopeStorageKey(), this.projectAggregateScope);
    } catch (error) {
      this.debugWarn('[TenderProjects] Failed to persist aggregate scope preference.', error);
    }
  }

  private projectAggregateScopeStorageKey(): string {
    return this.scopedStorageKey('engineers-salary-reference.tender.projects.aggregate.scope');
  }

  private captureProjectAggregateOperation(column: GridColumn<TenderRow>): boolean {
    const aggregate = column.aggregate as ProjectAggregateOperation | null | undefined;
    if (!aggregate) {
      return false;
    }
    return this.setProjectAggregateOperationForField(
      this.projectAggregateFieldKey(column),
      aggregate
    );
  }

  private setProjectAggregateOperationForField(
    field: string,
    operation: ProjectAggregateOperation | null
  ): boolean {
    const normalizedField = this.projectAggregateFieldKey(field);
    const current = this.projectAggregateOperations.get(normalizedField) ?? null;
    if (current === operation) {
      return false;
    }

    if (operation) {
      this.projectAggregateOperations.set(normalizedField, operation);
    } else {
      this.projectAggregateOperations.delete(normalizedField);
    }

    this.projectAggregateOperationsVersion += 1;
    this.invalidateProjectAggregateFooterColumnsCache();
    return true;
  }

  private invalidateProjectAggregateFooterColumnsCache(): void {
    this.projectAggregateFooterColumnsCacheSource = null;
    this.projectAggregateFooterColumnsCache = [];
  }

  protected override loadProjectFilterOptions(field: string): Observable<GridFilterOptionValue[]> {
    return this.api
      .getFilterOptions({
        field,
        search: this.extractGlobalSearchTerm(this.gridFilterStates),
        filters: this.buildSerializedProjectFiltersExcludingField(field),
        take: 2000
      })
      .pipe(
        map(values =>
          (values ?? [])
            .map(value => this.mapProjectFilterOptionValue(field, value))
            .filter(option => option.label.trim().length > 0)
        )
      );
  }

  private mapProjectFilterOptionValue(field: string, value: string): GridFilterOptionValue {
    const normalizedField = String(field ?? '')
      .trim()
      .replace(/_/g, '')
      .toLowerCase();

    switch (normalizedField) {
      case 'deadline':
      case 'startdate':
      case 'enddate':
      case 'acceptdate':
        return { value, label: this.formatDate(value) };
      case 'price': {
        const parsed = this.parseNumberOrNull(value);
        return {
          value,
          label: parsed != null ? this.formatMoney(parsed) : String(value ?? '').trim()
        };
      }
      case 'prb':
        return {
          value,
          label: this.formatPercentFromDecimal(value, String(value ?? '').trim())
        };
      default:
        return { value, label: String(value ?? '').trim() };
    }
  }

  private buildGridApiFilters(filters: readonly FilterState[]): ProjectListFilter[] {
    return filters
      .filter(filter => {
        const operator = String(filter.operator ?? '').trim();
        return operator && operator !== 'globalSearch' && operator !== 'menuSearch';
      })
      .map(filter => ({
        field: String(filter.field ?? '').trim(),
        operator: String(filter.operator ?? 'contains').trim(),
        value: filter.value,
        joinWithPrev: filter.joinWithPrev === 'or' ? ('or' as const) : ('and' as const)
      }))
      .filter(filter => filter.field.length > 0);
  }

  private extractGlobalSearchTerm(filters: readonly FilterState[]): string | undefined {
    const globalFilter = filters.find(
      filter => String(filter.operator ?? '').trim() === 'globalSearch'
    );
    const searchTerm = String(globalFilter?.value ?? '').trim();
    return searchTerm || undefined;
  }

  private resolveListSort(sorts: readonly SortState[]): {
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
  } {
    const activeSort = sorts.find(
      sort =>
        typeof sort.field === 'string' && (sort.direction === 'asc' || sort.direction === 'desc')
    );

    if (!activeSort?.field || !activeSort.direction) {
      return {};
    }

    return {
      sortBy: activeSort.field,
      sortDirection: activeSort.direction
    };
  }

  handleGridChange(event: GridChangeEvent) {
    if (event.type === 'selection' || event.type === 'edit' || event.type === 'groupExpansion') {
      return;
    }

    if (event.type === 'aggregate') {
      this.cdr.markForCheck();
      void this.refreshProjectAggregateFooter();
      return;
    }

    this.gridSortStates = Array.isArray(event.sorts) ? [...event.sorts] : this.gridSortStates;
    this.gridFilterStates = Array.isArray(event.filters)
      ? [...event.filters]
      : this.gridFilterStates;
    this.gridGroupColumnsState = Array.isArray(event.groupColumns)
      ? event.groupColumns
          .filter((field): field is string => typeof field === 'string' && field.trim().length > 0)
          .map(field => field.trim())
      : this.gridGroupColumnsState;
    this.gridGroupDateIntervalsState = event.groupDateIntervals ?? this.gridGroupDateIntervalsState;

    if (event.type === 'page') {
      const page = Math.max(1, event.pagination?.currentPage ?? this.currentProjectsPage);
      this.fetchProjectsForPage(page);
      return;
    }

    if (event.type === 'sort' || event.type === 'filter' || event.type === 'group') {
      this.currentProjectsPage = 1;
    }

    if (event.type === 'group') {
      this.clearExistingRowsBeforeFetch = true;
      if (this.selectedRows.length > 0) {
        this.clearGridSelection();
      }
    }

    this.syncProjectGridConfig();
    this.cdr.markForCheck();
    this.fetchProjects();

    if (event.type === 'pageSize') {
    }
  }

  handleSelectionChange(rows: TenderRow[]) {
    if (this.suppressProjectGridSelection) {
      return;
    }
    this.selectedRows = rows ?? [];
    if (!this.selectedRows.length) this.flushDeferredProjectsRefresh();
    this.cdr.markForCheck();
  }

  openSavedViews(btn: HTMLElement): void {
    if (!btn) return;
    this.lastSnapshotAnchor = btn;
    this.grid?.toggleSnapshotManager();
    this.queueSnapshotMenuPosition();
  }

  private closeSnapshotPanel(): void {
    return closeTenderProjectsSnapshotPanel(this.gridShellHost());
  }

  private setupSnapshotMenuObserver(): void {
    return setupTenderProjectsSnapshotMenuObserver(this.gridShellHost());
  }

  private attachSnapshotOutsideClickHandler(): void {
    return attachTenderProjectsSnapshotOutsideClickHandler(this.gridShellHost());
  }

  private queueSnapshotMenuPosition(): void {
    return queueTenderProjectsSnapshotMenuPosition(this.gridShellHost());
  }

  private syncSnapshotMenuPosition(): void {
    return syncTenderProjectsSnapshotMenuPosition(this.gridShellHost());
  }

  onSettingsClosed() {
    this.showSettings = false;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.flushDeferredProjectsRefresh();
      this.cdr.markForCheck();
    }, 0);
  }

  get deleteDialogCount() {
    return this.deleteDialogTargets.length;
  }

  get deleteDialogTitle() {
    return this.deleteDialogCount > 1 ? 'Delete Projects' : 'Delete Project';
  }

  get deleteDialogName() {
    return (this.deleteDialogTargets[0]?.title || '').trim() || 'this project';
  }

  get deleteProtectionEnabled() {
    return this.deleteProtection.isEnabled();
  }

  onDeleteAuthorizationCodeInput(value: string) {
    this.deleteAuthorizationCode = value;
    if (this.deleteAuthorizationError) {
      this.deleteAuthorizationError = '';
    }
    this.cdr.markForCheck();
  }

  private resetDeleteAuthorizationState() {
    this.deleteAuthorizationCode = '';
    this.deleteAuthorizationError = '';
    this.deleteProtection.clearAuthorizedCode();
  }

  private prepareDeleteAuthorization(rows: TenderRow[]) {
    if (!this.deleteProtectionEnabled) {
      this.resetDeleteAuthorizationState();
      return true;
    }

    const code = this.deleteAuthorizationCode.trim();
    if (!code) {
      this.deleteAuthorizationError = 'Enter the delete authorization code.';
      this.cdr.markForCheck();
      return false;
    }

    if (!this.deleteProtection.isCodeAccepted(code)) {
      this.deleteAuthorizationError = 'Incorrect code. Delete request was blocked.';
      this.cdr.markForCheck();
      return false;
    }

    const remoteDeleteCount = rows.filter(row => row?.id != null).length;
    if (remoteDeleteCount > 0) {
      this.deleteProtection.authorizeNextDelete(code, remoteDeleteCount);
    } else {
      this.deleteProtection.clearAuthorizedCode();
    }
    this.deleteAuthorizationError = '';
    this.cdr.markForCheck();
    return true;
  }

  onCellAction(event: { row?: TenderRow; column?: GridColumn<TenderRow>; event: MouseEvent }) {
    const mouseEvent = event.event;
    if (!mouseEvent || mouseEvent.defaultPrevented) {
      return;
    }
    const target = mouseEvent.target as HTMLElement | null;
    const linkEl = target?.closest<HTMLElement>('.data-grid-link[data-link]');
    if (linkEl) {
      const resolvedRow = this.resolveRowFromLink(linkEl);
      const rowIdAttr = linkEl.dataset.rowId;
      let row = resolvedRow ?? event.row;
      if (rowIdAttr && event.row?.id != null && String(event.row.id) !== rowIdAttr && resolvedRow) {
        row = resolvedRow;
      }
      if (!row) return;
      mouseEvent.preventDefault();
      mouseEvent.stopPropagation();
      this.openProjectDetails(row);
      return;
    }
    if (event.column?.field === 'title' && event.row) {
      mouseEvent.preventDefault();
      mouseEvent.stopPropagation();
      this.openProjectDetails(event.row);
    }
  }

  private openProjectDetails(row: TenderRow): void {
    this.zone.run(() => {
      this.openDetails(row);
      this.cdr.markForCheck();
    });
  }

  protected getRowKeyValue(row: TenderRow, label?: string): string | null {
    if (row?.id != null) return `id:${row.id}`;
    const title = (row?.title ?? label ?? '').trim().toLowerCase();
    if (!title) return null;
    return `name:${encodeURIComponent(title)}`;
  }

  private resetRowKeySet(rows: TenderRow[]) {
    this.rowKeySet = new Set<string>();
    for (const row of rows ?? []) {
      const key = this.getRowKeyValue(row);
      if (key) {
        this.rowKeySet.add(key);
      }
    }
    // Cell renderers cache HTMLElements per row object. Clear the cache whenever rows are
    // fully replaced so stale row identities do not keep old render output alive.
    this.cellRendererCache.clear();
  }

  private appendUniqueRows(existing: TenderRow[], incoming: TenderRow[]): TenderRow[] {
    if (!incoming?.length) return existing;
    if (this.rowKeySet.size === 0 && existing?.length) {
      this.resetRowKeySet(existing);
    }
    const merged = existing ? [...existing] : [];
    for (const row of incoming) {
      const key = this.getRowKeyValue(row, row?.title);
      if (key && this.rowKeySet.has(key)) {
        continue;
      }
      if (key) {
        this.rowKeySet.add(key);
      }
      merged.push(row);
    }
    return merged;
  }

  private findRowByKey(key: string | null): TenderRow | null {
    if (!key || !this.rows?.length) return null;
    if (key.startsWith('id:')) {
      const idValue = key.slice(3);
      return this.rows.find(row => String(row.id ?? '') === idValue) ?? null;
    }
    if (key.startsWith('name:')) {
      const nameValue = decodeURIComponent(key.slice(5)).toLowerCase();
      return this.rows.find(row => (row.title || '').trim().toLowerCase() === nameValue) ?? null;
    }
    return null;
  }

  private resolveRowFromLink(linkEl: HTMLElement): TenderRow | null {
    return this.findRowForLink(linkEl);
  }

  private findRowForLink(linkEl: HTMLElement): TenderRow | null {
    if (!this.rows?.length) return null;
    const rowIdAttr = linkEl.dataset.rowId ?? '';
    if (rowIdAttr) {
      const byId = this.rows.find(row => String(row.id ?? '') === rowIdAttr);
      if (byId) return byId;
    }

    const key = linkEl.dataset.key ?? null;
    const byKey = this.findRowByKey(key);
    if (byKey) return byKey;

    const text = (linkEl.textContent || '').trim().toLowerCase();
    if (!text) return null;
    return this.rows.find(row => (row.title || '').trim().toLowerCase() === text) ?? null;
  }

  protected getCachedElement(
    field: string,
    row: TenderRow,
    factory: () => HTMLElement
  ): HTMLElement {
    if (!this.cellRendererCache.has(field)) {
      this.cellRendererCache.set(field, new WeakMap());
    }

    const fieldCache = this.cellRendererCache.get(field)!;
    const cached = fieldCache.get(row);
    if (cached) {
      return cached;
    }

    const element = factory();
    fieldCache.set(row, element);
    return element;
  }

  openDetails(row: TenderRow) {
    if (!row) return;
    this.openProjectDetailsPanel(row);
  }

  onSwitchProject(row: TenderRow) {
    if (!row) return;
    this.openProjectDetailsPanel(row);
  }

  private resetAddPanelContext(): void {
    this.editingPanelTarget = null;
    this.bulkEditTargets = [];
    this.bulkEditBaseline = null;
    this.addPanelSeedRow = null;
  }

  private closeAddPanel(options?: { skipDeferredRefresh?: boolean }): void {
    this.showAdd = false;
    this.resetAddPanelContext();
    if (options?.skipDeferredRefresh) {
      this.deferredProjectsRefreshWhileBusy = false;
      this.queuedProjectsRefresh = false;
      return;
    }
    this.flushDeferredProjectsRefresh();
  }

  onAddPanelClose(): void {
    this.closeAddPanel();
    this.cdr.markForCheck();
  }

  private openSingleEditPanel(row: TenderRow): void {
    this.closeSnapshotPanel();
    this.showDetails = false;
    this.projectDetailsLoading = false;
    this.editingPanelTarget = this.cloneTenderRow(row);
    this.bulkEditTargets = [];
    this.bulkEditBaseline = null;
    this.addPanelSeedRow = this.cloneTenderRow(row);
    this.showAdd = true;
    this.cdr.markForCheck();
  }

  private openBulkEditPanel(rows: TenderRow[]): void {
    this.closeSnapshotPanel();
    this.showDetails = false;
    this.projectDetailsLoading = false;
    this.editingPanelTarget = null;
    const targets = rows.map(row => this.cloneTenderRow(row));
    this.bulkEditTargets = targets;
    const seed = this.buildBulkEditSeedRow(targets);
    this.bulkEditBaseline = this.cloneTenderRow(seed);
    this.addPanelSeedRow = this.cloneTenderRow(seed);
    this.showAdd = true;
    this.cdr.markForCheck();
  }

  onEditSelected() {
    if (!this.permission.canEditPage('tender.projects')) {
      this.toast('You do not have permission to edit projects', 'error');
      return;
    }
    if (!this.selectedRows.length) {
      this.toast('Select a project to edit', 'info');
      return;
    }
    if (this.selectedRows.length === 1) {
      this.openSingleEditPanel(this.selectedRows[0]);
      return;
    }
    this.openBulkEditPanel(this.selectedRows);
  }

  closeOverlay(syncRoute = true) {
    this.showDetails = false;
    this.activities = [];
    this.activityLoading = false;
    this.projectDetailsLoading = false;
    this.projectDetailsSaveErrorMessage = '';
    this.projectDetailsSaveFieldIssues = [];
    this.projectNotificationFocus = null;
    this.auditLoadToken += 1;
    if (syncRoute) {
      this.syncProjectNotificationRouteState(null);
    }
    if (this.skipNextDetailsCloseRefresh) {
      this.skipNextDetailsCloseRefresh = false;
      this.deferredProjectsRefreshWhileBusy = false;
      this.queuedProjectsRefresh = false;
      return;
    }
    this.flushDeferredProjectsRefresh();
  }

  onLookupCreated(payload: {
    type: 'owner' | 'ownerType' | 'country' | 'stage' | 'type';
    item: IdName;
  }) {
    const item = payload?.item;
    if (!item) return;

    switch (payload.type) {
      case 'owner':
        this.owners = upsertTenderProjectLookup(this.owners, item);
        break;
      case 'ownerType':
        this.ownerTypes = upsertTenderProjectLookup(this.ownerTypes, item);
        break;
      case 'country':
        this.countries = upsertTenderProjectLookup(this.countries, item);
        break;
      case 'stage':
        this.stages = upsertTenderProjectLookup(this.stages, item);
        break;
      case 'type':
        this.top = upsertTenderProjectLookup(this.top, item);
        break;
      default:
        return;
    }

    this.applyLookupPresentationState();
    this.rebuildLookupMaps();
    this.writeLookupsCache();
    this.broadcastLookupsRefresh('create');
    this.rehydrateRowsFromLookups();
    this.cdr.markForCheck();
  }
  onLookupUpdated(payload: { type: LookupKind; item: IdName }) {
    const item = payload?.item;
    if (!item) return;

    switch (payload.type) {
      case 'owner':
        this.owners = upsertTenderProjectLookup(this.owners, item);
        break;
      case 'ownerType':
        this.ownerTypes = upsertTenderProjectLookup(this.ownerTypes, item);
        break;
      case 'country':
        this.countries = upsertTenderProjectLookup(this.countries, item);
        break;
      case 'stage':
        this.stages = upsertTenderProjectLookup(this.stages, item);
        break;
      case 'type':
        this.top = upsertTenderProjectLookup(this.top, item);
        break;
      case 'status':
        this.statuses = upsertTenderProjectLookup(this.statuses, item);
        break;
      case 'importance':
        this.doi = upsertTenderProjectLookup(this.doi, item);
        break;
      default:
        return;
    }

    this.applyLookupPresentationState();
    this.rebuildLookupMaps();
    this.writeLookupsCache();
    this.broadcastLookupsRefresh('update');
    this.rehydrateRowsFromLookups();
    this.cdr.markForCheck();
  }

  onSaveDeferred() {
    this.toast('Saving after new items are created...', 'info', 2600);
  }
  onLookupCreateFailed(payload: {
    type: 'owner' | 'ownerType' | 'country' | 'stage' | 'type';
    name: string;
    message: string;
  }) {
    const label = payload?.type
      ? payload.type === 'ownerType'
        ? 'Owner Type'
        : payload.type.charAt(0).toUpperCase() + payload.type.slice(1)
      : 'Item';
    const name = payload?.name?.trim();
    const message = payload?.message || 'Please check your connection and try again';
    const prefix = name ? `${label} "${name}"` : label;
    this.toast(`Failed to add ${prefix}: ${message}`, 'error', 6000);
  }
  onLookupUpdateFailed(payload: { type: LookupKind; name: string; message: string }) {
    const label = payload?.type
      ? payload.type.charAt(0).toUpperCase() + payload.type.slice(1)
      : 'Item';
    const name = payload?.name?.trim();
    const message = payload?.message || 'Please check your connection and try again';
    const prefix = name ? `${label} "${name}"` : label;
    this.toast(`Failed to update ${prefix}: ${message}`, 'error', 6000);
  }
  onChecklistActionFailed(payload: {
    action: 'load' | 'create' | 'update' | 'delete';
    message: string;
  }) {
    const action = payload?.action ? payload.action : 'update';
    const message = payload?.message || 'Please check your connection and try again';
    const label = action.charAt(0).toUpperCase() + action.slice(1);
    this.toast(`Checklist ${label} failed: ${message}`, 'error', 6000);
  }

  onSaveTenderFromPanel(payload: TenderRow): void {
    if (this.bulkEditMode) {
      this.onSaveBulkEditFromPanel(payload);
      return;
    }
    if (this.editingPanelTarget) {
      this.onSaveSingleEditFromPanel(payload);
      return;
    }
    this.onCreateTender(payload);
  }

  private onSaveSingleEditFromPanel(payload: TenderRow): void {
    if (!this.editingPanelTarget) {
      this.onCreateTender(payload);
      return;
    }
    const merged = this.mergePanelRowForSingleEdit(this.editingPanelTarget, payload);
    this.persistProjectUpdate(merged, { closePanelOnSuccess: true });
  }

  private onSaveBulkEditFromPanel(payload: TenderRow): void {
    const targets = this.normalizeBulkEditTargets(this.bulkEditTargets);
    if (!targets.length) {
      this.toast('Select projects to edit', 'info');
      return;
    }
    const baseline = this.bulkEditBaseline
      ? this.cloneTenderRow(this.bulkEditBaseline)
      : this.buildBulkEditSeedRow(targets);
    const patch = this.buildBulkEditPatch(payload, baseline);
    if (!this.hasBulkEditPatch(patch)) {
      this.toast('No bulk changes to apply.', 'info');
      return;
    }

    type BulkUpdateResult = { ok: boolean; source: TenderRow; updated?: TenderRow };
    this.loading = true;

    const buildBulkUpdateRequest = (target: TenderRow): Observable<BulkUpdateResult> => {
      const projectId = this.parseId(target.id);
      if (!projectId) {
        return of({ ok: false, source: target } as BulkUpdateResult);
      }
      const merged = this.applyBulkEditPatchToRow(target, patch);
      return this.prepareRowForSave(merged).pipe(
        switchMap(prepared => {
          const dto = this.buildUpdateDtoFromRow(prepared);
          if (!dto) {
            return of({ ok: false, source: target } as BulkUpdateResult);
          }
          const optimisticRow = this.buildSavedDisplayRow(prepared, target);
          return this.api.update(projectId, dto).pipe(
            map(() => ({ ok: true, source: target, updated: optimisticRow })),
            catchError(error => {
              if (environment.enableDebugLogs) console.error('Bulk update failed:', error);
              return of({ ok: false, source: target } as BulkUpdateResult);
            })
          );
        }),
        catchError(error => {
          if (environment.enableDebugLogs) console.error('Bulk prepare failed:', error);
          return of({ ok: false, source: target } as BulkUpdateResult);
        })
      );
    };

    from(targets)
      .pipe(
        mergeMap(target => buildBulkUpdateRequest(target), PROJECT_BULK_UPDATE_CONCURRENCY),
        toArray(),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: results => {
          const succeeded = results
            .filter(result => result.ok && result.updated)
            .map(result => result.updated as TenderRow);
          const failedCount = results.length - succeeded.length;

          if (succeeded.length) {
            const byId = new Map<number, TenderRow>();
            succeeded.forEach(row => {
              const id = this.parseId(row.id);
              if (id) {
                byId.set(id, row);
              }
            });
            this.rows = this.rows.map(row => {
              const rowId = this.parseId(row.id);
              return rowId && byId.has(rowId) ? byId.get(rowId)! : row;
            });
            this.resetRowKeySet(this.rows);
            this.syncRowStateFromRows();
            results
              .filter(
                (result): result is BulkUpdateResult & { updated: TenderRow } =>
                  result.ok && !!result.updated
              )
              .forEach(result => {
                this.syncFiltersForRowUpdate(result.source, result.updated);
                this.recordProjectRowUpdateAudit(result.source, result.updated);
              });
            this.rows = [...this.rows];
            this.writeProjectsCache(this.rows);
          }

          this.loading = false;
          if (succeeded.length > 0) {
            this.broadcastProjectsRefresh('bulk-update');
            this.toast(
              succeeded.length > 1
                ? `${succeeded.length} projects updated successfully`
                : 'Project updated successfully',
              'success'
            );
            if (failedCount === 0) {
              this.closeAddPanel({ skipDeferredRefresh: true });
            }
          }
          if (failedCount > 0) {
            this.toast(
              failedCount === results.length
                ? 'Failed to update selected projects.'
                : `${failedCount} project(s) failed to update`,
              'error',
              5000
            );
          }
          this.cdr.markForCheck();
        },
        error: err => {
          if (environment.enableDebugLogs) console.error('Bulk update failed:', err);
          this.loading = false;
          this.toast('Failed to update selected projects.', 'error', 5000);
          this.cdr.markForCheck();
        }
      });
  }

  private persistProjectUpdate(
    updated: TenderRow,
    options?: {
      closePanelOnSuccess?: boolean;
      silentSuccess?: boolean;
      successMessage?: string;
    }
  ): void {
    if (!this.permission.canEditPage('tender.projects')) {
      this.toast('You do not have permission to update projects', 'error');
      return;
    }
    if (!updated.id) {
      this.toast('Cannot update project: missing ID', 'error');
      return;
    }
    if (this.projectUpdateInFlight) {
      return;
    }

    this.projectDetailsSaveErrorMessage = '';
    this.projectDetailsSaveFieldIssues = [];
    this.projectUpdateInFlight = true;
    this.loading = true;
    this.prepareRowForSave(updated)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: prepared => {
          const dto = this.buildUpdateDtoFromRow(prepared);
          if (!dto) {
            this.projectUpdateInFlight = false;
            this.loading = false;
            this.projectDetailsSaveErrorMessage =
              'Some lookup values are not recognized. Please check all fields.';
            this.projectDetailsSaveFieldIssues = [];
            this.toast('Some lookup values are not recognized. Please check all fields.', 'error');
            return;
          }

          this.api
            .update(prepared.id as number, dto)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: result => {
                void result;
                const updatedId = this.parseId(prepared.id ?? updated.id);
                const rowById = updatedId
                  ? this.rows.find(r => this.parseId(r.id) === updatedId)
                  : undefined;
                const rowBySelected =
                  !rowById && updatedId && this.parseId(this.selectedRow?.id) === updatedId
                    ? this.selectedRow
                    : undefined;
                const previousRow = this.cloneTenderRow(rowById ?? rowBySelected ?? updated);
                const updatedRow = this.buildSavedDisplayRow(prepared, previousRow);
                const i = updatedId
                  ? this.rows.findIndex(r => this.parseId(r.id) === updatedId)
                  : -1;
                if (i >= 0) {
                  this.rows[i] = updatedRow;
                }
                this.rows = [...this.rows];
                this.resetRowKeySet(this.rows);
                this.syncRowStateFromRows();
                this.syncFiltersForRowUpdate(previousRow, updatedRow);
                this.recordProjectRowUpdateAudit(previousRow, updatedRow);
                this.writeProjectsCache(this.rows);

                this.projectUpdateInFlight = false;
                this.loading = false;
                this.projectDetailsSaveErrorMessage = '';
                this.projectDetailsSaveFieldIssues = [];
                this.skipNextDetailsCloseRefresh = !options?.closePanelOnSuccess;
                if (options?.closePanelOnSuccess) {
                  this.closeAddPanel({ skipDeferredRefresh: true });
                }
                this.cdr.markForCheck();
                this.broadcastProjectsRefresh('update');
                if (!options?.silentSuccess) {
                  this.presentProjectUpdateSuccessToast(
                    options?.successMessage || 'Project updated successfully',
                    previousRow,
                    updatedRow
                  );
                }
              },
              error: err => {
                if (environment.enableDebugLogs) console.error('Update failed:', err);
                this.projectUpdateInFlight = false;
                this.loading = false;
                const errorDetails = extractProjectApiErrorDetails(err);
                this.projectDetailsSaveErrorMessage = errorDetails.message;
                this.projectDetailsSaveFieldIssues = errorDetails.fieldIssues;
                this.toast(`Failed to save: ${errorDetails.message}`, 'error', 8000);
              }
            });
        },
        error: err => {
          if (environment.enableDebugLogs) console.error('Prepare save failed:', err);
          this.projectUpdateInFlight = false;
          this.loading = false;
          const errorDetails = extractProjectApiErrorDetails(err);
          this.projectDetailsSaveErrorMessage = errorDetails.message;
          this.projectDetailsSaveFieldIssues = errorDetails.fieldIssues;
          this.toast(`Failed to save: ${errorDetails.message}`, 'error', 8000);
        }
      });
  }

  applySave(updated: TenderRow) {
    if (!this.permission.canEditPage('tender.projects')) {
      this.toast('You do not have permission to save project changes', 'error');
      return;
    }
    const now = Date.now();
    const shouldShowSuccessToast =
      now - this.lastAutoSaveSuccessToastAt >= this.AUTO_SAVE_SUCCESS_TOAST_MIN_INTERVAL_MS;
    if (shouldShowSuccessToast) {
      this.lastAutoSaveSuccessToastAt = now;
    }
    this.persistProjectUpdate(updated, {
      silentSuccess: !shouldShowSuccessToast,
      successMessage: 'Changes saved'
    });
  }

  onDeleteSelected() {
    if (!this.permission.canDeletePage('tender.projects')) return;
    const targets = [...this.selectedRows];
    if (!targets.length) {
      this.toast('Select projects to delete', 'info');
      return;
    }
    this.openDeleteDialog(targets);
  }

  onDelete() {
    if (!this.permission.canDeletePage('tender.projects')) return;
    if (!this.selectedRow) return;
    this.openDeleteDialog([this.selectedRow]);
  }
  private openDeleteDialog(rows: TenderRow[]) {
    const targets = rows.filter(Boolean);
    if (!targets.length) return;
    this.resetDeleteAuthorizationState();
    this.deleteDialogTargets = targets;
    this.deleteDialogOpen = true;
    this.deleteInProgress = false;
    this.cdr.markForCheck();
  }

  cancelDeleteDialog() {
    if (this.deleteInProgress) return;
    this.closeDeleteDialog();
  }

  confirmDeleteDialog() {
    if (this.deleteInProgress) return;
    if (!this.deleteDialogTargets.length) {
      this.closeDeleteDialog();
      return;
    }
    if (!this.prepareDeleteAuthorization(this.deleteDialogTargets)) {
      return;
    }
    const authorizedCode = this.deleteProtectionEnabled
      ? this.deleteAuthorizationCode.trim() || null
      : null;
    this.deleteInProgress = true;
    this.cdr.markForCheck();
    this.deleteSelectedRows(this.deleteDialogTargets, authorizedCode);
  }

  private closeDeleteDialog() {
    this.resetDeleteAuthorizationState();
    this.deleteDialogOpen = false;
    this.deleteDialogTargets = [];
    this.deleteInProgress = false;
    this.flushDeferredProjectsRefresh();
    this.cdr.markForCheck();
  }

  private deleteSelectedRows(rows: TenderRow[], authorizedCode: string | null) {
    const targets = rows.filter(Boolean);
    if (!targets.length) {
      this.closeDeleteDialog();
      return;
    }

    const snapshots = this.captureDeleteSnapshots(targets);
    if (!snapshots.length) {
      this.closeDeleteDialog();
      return;
    }

    const queuedRows = snapshots.map(snapshot => snapshot.row);
    const queuedSet = new Set(queuedRows);
    this.rows = this.rows.filter(row => !queuedSet.has(row));
    this.resetRowKeySet(this.rows);
    this.writeProjectsCache(this.rows);
    this.closeOverlayIfDeleted(queuedRows);
    this.clearGridSelection();
    this.cdr.markForCheck();
    this.closeDeleteDialog();

    const deleteToast = this.buildQueuedDeleteToastCopy(queuedRows);
    this.notificationToast.action(
      'danger',
      deleteToast.message,
      'Undo',
      () => {
        this.restoreDeleteSnapshots(snapshots);
        this.notificationToast.info('Delete canceled.', 2400);
      },
      this.DELETE_UNDO_WINDOW_MS,
      () => {
        this.finalizeQueuedDelete(snapshots, authorizedCode);
      },
      { title: deleteToast.title }
    );
  }

  private buildQueuedDeleteToastCopy(rows: TenderRow[]): { title: string; message: string } {
    const labels = rows.map(row => this.getQueuedDeleteLabel(row));
    const summary = this.summarizeQueuedDeleteLabels(labels);

    if (rows.length === 1) {
      return {
        title: summary || 'Project selected',
        message: 'Queued for delete'
      };
    }

    return {
      title: `${rows.length} projects queued`,
      message: summary || `${rows.length} selected projects`
    };
  }

  private getQueuedDeleteLabel(row: TenderRow): string {
    const title = String(row?.title ?? '').trim();
    if (title) {
      return title;
    }

    return row?.id != null ? `Project #${row.id}` : '';
  }

  private summarizeQueuedDeleteLabels(labels: string[]): string {
    const clean = Array.from(
      new Set(
        labels.map(label => label.trim()).filter((label): label is string => label.length > 0)
      )
    );

    if (!clean.length) {
      return '';
    }

    if (clean.length === 1) {
      return clean[0];
    }

    const preview = clean.slice(0, 2).join(', ');
    const remainder = clean.length - 2;
    return remainder > 0 ? `${preview} +${remainder} more` : preview;
  }

  private captureDeleteSnapshots(rows: TenderRow[]): Array<{ row: TenderRow; index: number }> {
    const snapshots: Array<{ row: TenderRow; index: number }> = [];
    const currentRows = this.rows;
    const seen = new Set<TenderRow>();

    rows.forEach(row => {
      if (!row || seen.has(row)) {
        return;
      }

      let index = currentRows.indexOf(row);
      let source = row;
      if (index < 0 && row.id != null) {
        index = currentRows.findIndex(candidate => candidate.id === row.id);
        if (index >= 0) {
          source = currentRows[index];
        }
      }

      if (index < 0 || seen.has(source)) {
        return;
      }

      seen.add(source);
      snapshots.push({ row: source, index });
    });

    return snapshots.sort((left, right) => left.index - right.index);
  }

  private restoreDeleteSnapshots(snapshots: Array<{ row: TenderRow; index: number }>) {
    if (!snapshots.length) {
      return;
    }

    const nextRows = [...this.rows];
    snapshots
      .slice()
      .sort((left, right) => left.index - right.index)
      .forEach(snapshot => {
        if (nextRows.includes(snapshot.row)) {
          return;
        }
        const insertAt = Math.max(0, Math.min(snapshot.index, nextRows.length));
        nextRows.splice(insertAt, 0, snapshot.row);
      });

    this.rows = nextRows;
    this.resetRowKeySet(this.rows);
    this.writeProjectsCache(this.rows);
    this.cdr.markForCheck();
  }

  private finalizeQueuedDelete(
    snapshots: Array<{ row: TenderRow; index: number }>,
    authorizedCode: string | null
  ) {
    const remoteRows = snapshots
      .map(snapshot => snapshot.row)
      .filter((row): row is TenderRow => row?.id != null);

    if (!remoteRows.length) {
      return;
    }

    if (authorizedCode) {
      this.deleteProtection.authorizeNextDelete(authorizedCode, remoteRows.length);
    }

    this.loading = true;
    const requests = remoteRows.map(row =>
      this.api.remove(row.id as number).pipe(
        map(() => ({ row, ok: true })),
        catchError(error => {
          if (environment.enableDebugLogs) console.error('Delete failed:', error);
          return of({ row, ok: false });
        })
      )
    );

    forkJoin(requests)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: results => {
          const succeeded = results.filter(result => result.ok).map(result => result.row);
          const failed = results.filter(result => !result.ok).map(result => result.row);
          this.loading = false;

          if (succeeded.length) {
            succeeded.forEach(row => this.recordProjectDeletedAudit(row));
            this.broadcastProjectsRefresh('delete');
          }

          if (failed.length) {
            const failedIds = new Set(failed.map(row => row.id as number));
            const failedSnapshots = snapshots.filter(
              snapshot => snapshot.row.id != null && failedIds.has(snapshot.row.id as number)
            );
            this.restoreDeleteSnapshots(failedSnapshots);
            const failMsg =
              failed.length === 1
                ? '1 project failed to delete'
                : `${failed.length} projects failed to delete`;
            this.toast(failMsg, 'error', 5000);
          }

          this.cdr.markForCheck();
        },
        error: err => {
          if (environment.enableDebugLogs) console.error('Delete failed:', err);
          this.loading = false;
          const remoteIds = new Set(remoteRows.map(row => row.id as number));
          const remoteSnapshots = snapshots.filter(
            snapshot => snapshot.row.id != null && remoteIds.has(snapshot.row.id as number)
          );
          this.restoreDeleteSnapshots(remoteSnapshots);
          this.toast('Failed to delete from backend', 'error');
          this.cdr.markForCheck();
        }
      });
  }

  private closeOverlayIfDeleted(rows: TenderRow[]) {
    if (this.showDetails && this.selectedRow && rows.includes(this.selectedRow)) {
      this.closeOverlay();
    }
  }

  private clearGridSelection() {
    this.selectedRows = [];
    this.grid?.clearSelection();
    this.cdr.markForCheck();
  }

  private syncGridSelectionFromRows(): void {
    if (!this.grid) {
      return;
    }

    this.suppressProjectGridSelection = true;
    try {
      this.grid.replaceSelection(this.selectedRows, {
        emitChange: false,
        preserveUndo: false
      });
    } finally {
      this.suppressProjectGridSelection = false;
    }
  }

  private cloneTenderRow(row: TenderRow): TenderRow {
    return { ...row };
  }

  private normalizeBulkEditTargets(rows: TenderRow[]): TenderRow[] {
    const unique = new Map<string, TenderRow>();
    rows.forEach((row, index) => {
      const key = this.getRowKeyValue(row, row?.title) ?? `row:${index}`;
      if (!unique.has(key)) {
        unique.set(key, this.cloneTenderRow(row));
      }
    });
    return Array.from(unique.values());
  }

  private normalizeBulkText(value: unknown): string {
    return normalizeBulkTextValue(value);
  }

  private sameBulkText(a: unknown, b: unknown): boolean {
    return sameBulkTextValue(a, b);
  }

  private buildBulkEditSeedRow(rows: TenderRow[]): TenderRow {
    if (!rows.length) {
      return {
        title: '',
        description: '',
        owner: '',
        ownerType: '',
        deadline: '',
        startDate: '',
        endDate: '',
        top: '',
        ts: '',
        price: undefined,
        assignTo: '',
        acceptDate: '',
        status: 'New',
        prb: null,
        consultant: '',
        delayReasons: '',
        doi: '',
        country: '',
        inCharge: ''
      };
    }

    const pickUniformText = (selector: (row: TenderRow) => unknown): string => {
      const values = rows.map(row => this.normalizeBulkText(selector(row)));
      const first = values[0] ?? '';
      return values.every(value => value === first) ? first : '';
    };

    const pickUniformNumber = (selector: (row: TenderRow) => unknown): number | null => {
      const values = rows.map(row => this.parseNumberOrNull(selector(row)));
      const first = values[0];
      return values.every(value => value === first) ? first : null;
    };

    const pickUniformId = (selector: (row: TenderRow) => unknown): number | undefined => {
      const values = rows.map(row => this.parseId(selector(row)));
      const first = values[0];
      return values.every(value => value === first) ? (first ?? undefined) : undefined;
    };

    return {
      title: pickUniformText(row => row.title),
      description: pickUniformText(row => row.description),
      owner: pickUniformText(row => row.owner),
      ownerType: pickUniformText(row => row.ownerType),
      deadline: pickUniformText(row => row.deadline),
      startDate: pickUniformText(row => row.startDate),
      endDate: pickUniformText(row => row.endDate),
      top: pickUniformText(row => row.top),
      ts: pickUniformText(row => row.ts),
      price: pickUniformNumber(row => row.price) ?? undefined,
      assignTo: pickUniformText(row => row.assignTo),
      acceptDate: pickUniformText(row => row.acceptDate),
      status: pickUniformText(row => row.status) as Status,
      prb: pickUniformNumber(row => row.prb),
      consultant: pickUniformText(row => row.consultant),
      doi: pickUniformText(row => row.doi),
      country: pickUniformText(row => row.country),
      inCharge: pickUniformText(row => row.inCharge),
      ownerId: pickUniformId(row => row.ownerId),
      ownerTypeId: pickUniformId(row => row.ownerTypeId),
      statusId: pickUniformId(row => row.statusId),
      tenderStageId: pickUniformId(row => row.tenderStageId),
      typeOfProjectId: pickUniformId(row => row.typeOfProjectId),
      degreeOfImportanceId: pickUniformId(row => row.degreeOfImportanceId),
      countryId: pickUniformId(row => row.countryId),
      delayReasons: pickUniformText(row => row.delayReasons)
    };
  }

  private buildBulkEditPatch(payload: TenderRow, baseline: TenderRow): Partial<TenderRow> {
    return buildBulkEditPatchFromRows(payload, baseline, value => this.parseNumberOrNull(value));
  }

  private hasBulkEditPatch(patch: Partial<TenderRow>): boolean {
    return Object.keys(patch).length > 0;
  }

  private clearLookupIdsForChangedFields(next: TenderRow, previous: TenderRow): TenderRow {
    return clearLookupIdsForChangedFieldsInRow(next, previous);
  }

  private applyBulkEditPatchToRow(base: TenderRow, patch: Partial<TenderRow>): TenderRow {
    const merged: TenderRow = { ...this.cloneTenderRow(base), ...patch };
    return this.clearLookupIdsForChangedFields(merged, base);
  }

  private mergePanelRowForSingleEdit(base: TenderRow, payload: TenderRow): TenderRow {
    const merged: TenderRow = { ...this.cloneTenderRow(base), ...payload, id: base.id };
    return this.clearLookupIdsForChangedFields(merged, base);
  }

  onAddTender() {
    if (!this.permission.canCreatePage('tender.projects')) return;
    this.closeSnapshotPanel();
    this.resetAddPanelContext();
    if (!this.lookupsLoaded) {
      void this.loadLookups();
    }
    this.showAdd = true;
  }

  onCreateTender(newRow: TenderRow) {
    this.debugLog('[onCreateTender] New row:', newRow);
    this.debugLog('[onCreateTender] Lookups loaded?', this.lookupsLoaded);

    if (!this.lookupsLoaded) {
      this.debugLog('[onCreateTender] Lookups not ready, retrying load before create...');
      this.loading = true;
      this.cdr.markForCheck();
      void this.loadLookups().then(() => {
        if (!this.lookupsLoaded) {
          if (environment.enableDebugLogs)
            console.error('[onCreateTender] Lookups not loaded after retry, cannot create project');
          this.loading = false;
          this.cdr.markForCheck();
          this.toast('Backend not ready - Please refresh the page and try again', 'error', 5000);
          return;
        }
        this.onCreateTender(newRow);
      });
      return;
    }

    this.loading = true;
    this.prepareRowForSave(newRow)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: prepared => {
          const dto = this.buildCreateDtoFromRow(prepared);
          if (!dto) {
            if (environment.enableDebugLogs)
              console.error(
                '[onCreateTender] Missing required lookups (Status/Stage/Type/Importance)'
              );
            this.loading = false;
            this.toast(
              'Missing required settings - Please add Status/Stage/Type/Importance in Settings first',
              'error',
              6000
            );
            return;
          }

          this.api
            .create(dto)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: created => {
                const row = this.mapToRow(created);
                this.rows = [row, ...this.rows];
                this.markNewlyCreatedRowForVisualConfirm(row);
                this.rows = this.pinNewlyCreatedRowToTop(this.rows);
                const key = this.getRowKeyValue(row);
                if (key) {
                  this.rowKeySet.add(key);
                }
                this.writeProjectsCache(this.rows);
                this.recordProjectCreatedAudit(row);
                this.loading = false;
                this.closeAddPanel({ skipDeferredRefresh: true });
                this.cdr.markForCheck();
                this.showNewlyCreatedRowAtTop();
                this.flashFirstRow();
                this.broadcastProjectsRefresh('create');
                this.toast('Tender created and saved successfully!', 'success');
              },
              error: err => {
                if (environment.enableDebugLogs) console.error('[onCreateTender] API error:', err);
                if (environment.enableDebugLogs)
                  console.error('[onCreateTender] Error details:', {
                    status: err.status,
                    statusText: err.statusText,
                    message: err.error?.message || err.message,
                    errors: err.error?.errors || [],
                    fullError: err
                  });
                this.loading = false;
                const errorMsg = extractProjectApiErrorMessage(err);
                this.toast(`Failed to save: ${errorMsg}`, 'error', 8000);
              }
            });
        },
        error: err => {
          if (environment.enableDebugLogs) console.error('[onCreateTender] Prepare failed:', err);
          this.loading = false;
          const errorMsg = extractProjectApiErrorMessage(err);
          this.toast(`Failed to save: ${errorMsg}`, 'error', 8000);
        }
      });
  }

  private flashFirstRow() {
    setTimeout(() => {
      const rowEl = document
        .querySelector('app-data-grid')
        ?.querySelector('tbody tr:first-child') as HTMLElement | null;
      rowEl?.classList.add('row-flash');
      setTimeout(() => rowEl?.classList.remove('row-flash'), 1100);
    }, 0);
  }

  private presentProjectUpdateSuccessToast(
    title: string,
    previousRow: TenderRow,
    updatedRow: TenderRow
  ): void {
    const previousSnapshot = this.cloneTenderRow(previousRow);
    const description = this.buildProjectUpdateSuccessDescription(updatedRow);

    this.undoToast.updated(
      description,
      () => {
        if (this.projectUpdateInFlight) {
          return;
        }

        this.persistProjectUpdate(previousSnapshot, { silentSuccess: true });
      },
      {
        title,
        duration: this.PROJECT_UPDATE_UNDO_WINDOW_MS,
        completionMessage: undefined
      }
    );
  }

  private buildProjectUpdateSuccessDescription(updatedRow: TenderRow): string {
    const label = this.getQueuedDeleteLabel(updatedRow);
    if (!label) {
      return 'Your changes have been saved and synced successfully.';
    }

    return `Project "${label}" has been saved and synced successfully.`;
  }

  private toast(msg: string, kind: ToastKind = 'info', ttlMs = 2200) {
    switch (kind) {
      case 'success':
        this.notificationToast.success(msg, ttlMs);
        break;
      case 'error':
        this.notificationToast.error(msg, ttlMs);
        break;
      default:
        this.notificationToast.info(msg, ttlMs);
        break;
    }
  }
  protected formatDate(iso?: unknown) {
    return formatProjectDate(iso);
  }
  protected formatMoney(v: number) {
    return formatProjectMoney(v);
  }
  protected formatPercentFromDecimal(value: unknown, fallback = '?'): string {
    return formatProjectPercentFromDecimal(value, fallback);
  }
  protected parseNumberOrNull(value: unknown): number | null {
    return parseProjectNumberOrNull(value);
  }
  protected normalizeLabel(value: unknown): string | null {
    return normalizeProjectLabel(value);
  }
  protected parseId(value: unknown): number | null {
    return parseProjectPositiveId(value);
  }
  private pickId(...values: unknown[]): number | null {
    return pickProjectIdFromValues(values, value => this.parseId(value));
  }
  protected pickName(...values: unknown[]): string | null {
    return pickProjectNameFromValues(values, value => this.normalizeLabel(value));
  }
  protected resolveNameById(list: IdName[], id?: number | string | null): string | null {
    return resolveTenderProjectLookupDisplayLabelById(list, id);
  }

  private prepareRowForSave(row: TenderRow): Observable<TenderRow> {
    return prepareTenderProjectRowForSave({
      row,
      countries: this.countries,
      owners: this.owners,
      stages: this.stages,
      top: this.top,
      parseId: value => this.parseId(value),
      resolveNameById: (list, id) => resolveTenderProjectLookupDisplayLabelById(list, id),
      findLookupByName: (list, name) => findTenderProjectLookupByName(list, name),
      upsertLookup: (list, item) => upsertTenderProjectLookup(list, item),
      extractApiErrorMessage: err => extractProjectApiErrorMessage(err),
      createCountry: name => this.api.createCountry(name),
      createOwner: (name, countryId) =>
        this.api.createOwner(name, countryId).pipe(
          catchError(err =>
            this.api.owners().pipe(
              mergeMap(items => {
                const refreshed = Array.isArray(items) ? (items as IdName[]) : [];
                if (refreshed.length) {
                  this.owners = refreshed;
                }
                const found = findTenderProjectLookupByName(refreshed, name);
                return found ? of(found) : throwError(() => err);
              }),
              catchError(() => throwError(() => err))
            )
          )
        ),
      createTenderStage: name => this.api.createTenderStage(name),
      createTypeOfProject: name => this.api.createTypeOfProject(name),
      onCountriesChange: next => {
        this.countries = next;
      },
      onOwnersChange: next => {
        this.owners = next;
      },
      onStagesChange: next => {
        this.stages = next;
      },
      onTopChange: next => {
        this.top = next;
      }
    });
  }

  private coalesceLabel(
    value: unknown,
    list: IdName[],
    id: number | null | undefined,
    fallback: string
  ): string {
    return this.coalesceRowLabel(this.normalizeLabel(value) ?? undefined, list, id, fallback);
  }

  private coalesceRowLabel(
    current: string | undefined,
    list: IdName[],
    id: number | null | undefined,
    fallback: string,
    placeholders: string[] = ['-']
  ): string {
    const normalized = this.normalizeLabel(current);
    const resolved = resolveTenderProjectLookupDisplayLabelById(list, id);
    if (resolved) {
      if (!normalized || placeholders.includes(normalized)) {
        return resolved;
      }
      const normalizedKey = normalized.trim().toLowerCase();
      const resolvedKey = resolved.trim().toLowerCase();
      if (normalizedKey !== resolvedKey) {
        const currentLookup = findTenderProjectLookupByName(list, normalized);
        if (!currentLookup || this.parseId(currentLookup.id) === this.parseId(id)) {
          return resolved;
        }
      }
    }
    return normalized ?? fallback;
  }

  private rehydrateRowsFromLookups() {
    if (!this.rows?.length) return;
    let changed = false;
    const nextRows = this.rows.map(row => {
      const owner = this.coalesceRowLabel(row.owner, this.owners, row.ownerId, '-');
      const status = this.coalesceRowLabel(
        row.status,
        this.statuses,
        row.statusId,
        'New'
      ) as Status;
      const top = this.coalesceRowLabel(row.top, this.top, row.typeOfProjectId, 'Other', [
        '-',
        'Other'
      ]);
      const ts = this.coalesceRowLabel(row.ts, this.stages, row.tenderStageId, '-');
      const doi = this.coalesceRowLabel(row.doi ?? '', this.doi, row.degreeOfImportanceId, '-');
      const country = this.coalesceRowLabel(row.country, this.countries, row.countryId, 'Other', [
        '-',
        'Other'
      ]);

      if (
        owner !== row.owner ||
        status !== row.status ||
        top !== row.top ||
        ts !== row.ts ||
        doi !== row.doi ||
        country !== row.country
      ) {
        changed = true;
        return {
          ...row,
          owner,
          status,
          top,
          ts,
          doi,
          country
        };
      }
      return row;
    });

    this.cellRendererCache.clear();

    if (changed) {
      this.rows = [...nextRows];
      this.syncRowStateFromRows();
      this.writeProjectsCache(this.rows);
      this.cdr.markForCheck();
      return;
    }

    this.rows = [...this.rows];
    this.cdr.markForCheck();
  }

  private buildSavedDisplayRow(prepared: TenderRow, previous?: TenderRow | null): TenderRow {
    const current = previous ? this.cloneTenderRow(previous) : ({ ...prepared } as TenderRow);
    return {
      ...current,
      ...prepared,
      id: prepared.id ?? current.id,
      owner: this.coalesceRowLabel(
        prepared.owner,
        this.owners,
        prepared.ownerId ?? current.ownerId,
        current.owner || '-'
      ),
      status: this.coalesceRowLabel(
        prepared.status,
        this.statuses,
        prepared.statusId ?? current.statusId,
        current.status || 'New'
      ) as Status,
      top: this.coalesceRowLabel(
        prepared.top,
        this.top,
        prepared.typeOfProjectId ?? current.typeOfProjectId,
        current.top || 'Other',
        ['-', 'Other']
      ),
      ts: this.coalesceRowLabel(
        prepared.ts,
        this.stages,
        prepared.tenderStageId ?? current.tenderStageId,
        current.ts || '-'
      ),
      doi: this.coalesceRowLabel(
        prepared.doi ?? '',
        this.doi,
        prepared.degreeOfImportanceId ?? current.degreeOfImportanceId,
        current.doi || '-'
      ),
      country: this.coalesceRowLabel(
        prepared.country,
        this.countries,
        prepared.countryId ?? current.countryId,
        current.country || 'Other',
        ['-', 'Other']
      ),
      assignTo: this.normalizeLabel(prepared.assignTo) ?? current.assignTo ?? 'Unassigned',
      inCharge: this.normalizeLabel(prepared.inCharge) ?? current.inCharge ?? '?',
      consultant: this.normalizeLabel(prepared.consultant) ?? '',
      delayReasons: this.normalizeLabel(prepared.delayReasons) ?? '',
      checklists: current.checklists ?? prepared.checklists
    };
  }

  private recordProjectRowUpdateAudit(previousRow: TenderRow, nextRow: TenderRow): void {
    const audit = this.buildProjectRowUpdateAudit(previousRow, nextRow);
    this.recordProjectAudit(audit);
  }

  private recordProjectCreatedAudit(row: TenderRow): void {
    this.recordProjectAudit(this.buildProjectLifecycleAudit('created', row));
  }

  private recordProjectDeletedAudit(row: TenderRow): void {
    this.recordProjectAudit(this.buildProjectLifecycleAudit('deleted', row));
  }

  protected recordProjectAudit(audit: AuditTrail | null | undefined): void {
    if (!audit) {
      return;
    }
    recordTenderProjectAudit(this.activityHost(), audit);
  }

  private buildProjectLifecycleAudit(
    action: 'created' | 'deleted',
    row: TenderRow
  ): AuditTrail | null {
    return buildTenderProjectLifecycleAudit(this as unknown as TenderProjectAuditHost, action, row);
  }

  private buildProjectRowUpdateAudit(
    previousRow: TenderRow,
    nextRow: TenderRow
  ): AuditTrail | null {
    return buildTenderProjectRowUpdateAudit(
      this as unknown as TenderProjectAuditHost,
      previousRow,
      nextRow
    );
  }

  private buildProjectUpdateAuditChanges(
    previousRow: TenderRow,
    nextRow: TenderRow
  ): Array<{ field: string; from?: string; to?: string }> {
    return buildTenderProjectUpdateAuditChanges(
      this as unknown as TenderProjectAuditHost,
      previousRow,
      nextRow
    );
  }

  private buildProjectSnapshotAuditChanges(
    row: TenderRow,
    direction: 'from' | 'to'
  ): Array<{ field: string; from?: string; to?: string }> {
    return buildTenderProjectSnapshotAuditChanges(
      this as unknown as TenderProjectAuditHost,
      row,
      direction
    );
  }

  private projectAuditFieldDescriptors(): Array<{
    field: string;
    read: (row: TenderRow) => string | null;
  }> {
    return [];
  }

  private syncFiltersForRowUpdate(
    previousRow: TenderRow | null | undefined,
    nextRow: TenderRow | null | undefined
  ): void {
    return syncTenderProjectFiltersForRowUpdate(
      this as unknown as TenderProjectAuditHost,
      previousRow,
      nextRow
    );
  }

  private syncToolbarFiltersForRowUpdate(previousRow: TenderRow, nextRow: TenderRow): void {
    return syncTenderProjectFiltersForRowUpdate(
      this as unknown as TenderProjectAuditHost,
      previousRow,
      nextRow
    );
  }

  private syncRowStateFromRows(): void {
    if (!this.rows?.length) return;
    const byId = new Map<number, TenderRow>();
    for (const row of this.rows) {
      const id = this.parseId(row?.id);
      if (id) {
        byId.set(id, row);
      }
    }
    const resolve = (row: TenderRow | null): TenderRow | null => {
      if (!row) return row;
      const id = this.parseId(row.id);
      return id ? (byId.get(id) ?? row) : row;
    };

    this.selectedRow = resolve(this.selectedRow);
    this.selectedRows = this.selectedRows.map(row => resolve(row) ?? row);
    this.deleteDialogTargets = this.deleteDialogTargets.map(row => resolve(row) ?? row);
    this.editingPanelTarget = resolve(this.editingPanelTarget);
    this.bulkEditTargets = this.bulkEditTargets.map(row => resolve(row) ?? row);
    this.bulkEditBaseline = resolve(this.bulkEditBaseline);
    this.addPanelSeedRow = resolve(this.addPanelSeedRow);
    this.syncGridSelectionFromRows();
  }

  private cacheHost(): TenderProjectsCacheHost {
    return this as unknown as TenderProjectsCacheHost;
  }

  private gridShellHost(): TenderProjectsGridShellHost {
    return this as unknown as TenderProjectsGridShellHost;
  }

  private fetchHost(): TenderProjectsFetchHost {
    return this as unknown as TenderProjectsFetchHost;
  }

  private autoRefreshHost(): TenderProjectsAutoRefreshHost {
    return this as unknown as TenderProjectsAutoRefreshHost;
  }

  private syncHost(): TenderProjectsSyncHost {
    return this as unknown as TenderProjectsSyncHost;
  }

  private pinningHost(): TenderProjectsPinningHost {
    return this as unknown as TenderProjectsPinningHost;
  }

  private readProjectsCache(): { rows: TenderRow[]; storedAt: number } | null {
    return readTenderProjectsCache(this.cacheHost());
  }

  private writeProjectsCache(rows: TenderRow[]) {
    if (!this.shouldUseProjectsCache()) {
      return;
    }
    return writeTenderProjectsCache(this.cacheHost(), rows);
  }

  private hydrateProjectsFromCache(): boolean {
    if (!this.shouldUseProjectsCache()) {
      return false;
    }
    return hydrateTenderProjectsFromCache(this.cacheHost());
  }

  private readLookupsCache(): LookupsCache | null {
    return readTenderProjectLookupsCache(this.cacheHost());
  }

  private writeLookupsCache() {
    return writeTenderProjectLookupsCache(this.cacheHost());
  }

  private hydrateLookupsFromCache(): boolean {
    const hydrated = hydrateTenderProjectLookupsFromCache(this.cacheHost());
    if (hydrated) {
      this.applyLookupPresentationState();
      this.rebuildLookupMaps();
      this.rehydrateRowsFromLookups();
    }
    return hydrated;
  }
  private mapToRow(p: TenderProject): TenderRow {
    return mapTenderProjectToRow(this as unknown as TenderProjectRowMappingHost, p);
  }

  private fetchProjects() {
    this.isLoadingMore = false;
    if (this.currentProjectsPage !== 1) {
      this.currentProjectsPage = 1;
      this.syncProjectGridConfig();
    }
    if (!this.authBootstrapCompleted) {
      if (this.queuedProjectsFetchAfterBootstrap) {
        return;
      }
      this.queuedProjectsFetchAfterBootstrap = true;
      void this.ensureAuthReadyForProjects().then(() => {
        this.queuedProjectsFetchAfterBootstrap = false;
        if (!this.presenterDestroyed) {
          this.fetchProjects();
        }
      });
      return;
    }
    return fetchTenderProjects(this.fetchHost());
  }

  private fetchProjectsForPage(page: number): void {
    this.fetchProjectsPage(page);
  }

  private fetchProjectsPage(page: number): void {
    this.isLoadingMore = false;
    this.currentProjectsPage = page;
    this.syncProjectGridConfig();
    this.cdr.markForCheck();
    if (!this.authBootstrapCompleted) {
      return;
    }
    fetchTenderProjects(this.fetchHost());
  }

  protected projectCalendarSourceRows(): TenderRow[] {
    if (this.projectCalendarRowsLoadedKey || this.projectCalendarRowsLoading || this.projectCalendarRows.length) {
      return this.projectCalendarRows;
    }
    return this.rows;
  }

  protected invalidateProjectCalendarRows(preserveSnapshot = true): void {
    this.projectCalendarRowsLoadedKey = '';
    this.projectCalendarRowsInFlightKey = '';
    this.projectCalendarRowsRequestToken += 1;
    if (!preserveSnapshot) {
      this.projectCalendarRows = [];
    }
    this.projectCalendarRowsLoading = false;
  }

  protected ensureProjectCalendarRows(force = false): void {
    const queryKey = this.buildProjectCalendarRowsQueryKey();
    if (
      !force &&
      queryKey &&
      (this.projectCalendarRowsLoadedKey === queryKey ||
        this.projectCalendarRowsInFlightKey === queryKey)
    ) {
      return;
    }

    void this.loadProjectCalendarRows(queryKey);
  }

  private async loadProjectCalendarRows(queryKey: string): Promise<void> {
    const requestToken = ++this.projectCalendarRowsRequestToken;
    this.projectCalendarRowsInFlightKey = queryKey;
    this.projectCalendarRowsLoading = true;
    this.cdr.markForCheck();

    try {
      await this.ensureAuthReadyForProjects();
      if (this.presenterDestroyed || requestToken !== this.projectCalendarRowsRequestToken) {
        return;
      }

      const baseParams = this.buildProjectCalendarListParams();
      const pageSize = this.PROJECT_CALENDAR_FETCH_PAGE_SIZE;
      const firstPage = await this.fetchProjectCalendarRowsPage(baseParams, 1, pageSize);
      if (this.presenterDestroyed || requestToken !== this.projectCalendarRowsRequestToken) {
        return;
      }

      const firstItems = firstPage.items ?? [];
      const totalCount =
        typeof firstPage.meta?.totalCount === 'number' && Number.isFinite(firstPage.meta.totalCount)
          ? Math.max(0, firstPage.meta.totalCount)
          : firstItems.length;
      const metaTotalPages =
        typeof firstPage.meta?.totalPages === 'number' && Number.isFinite(firstPage.meta.totalPages)
          ? Math.max(1, firstPage.meta.totalPages)
          : Math.max(1, Math.ceil(totalCount / pageSize));
      const maxRows = Math.max(pageSize, this.PROJECT_CALENDAR_FETCH_MAX_ROWS);
      const maxPages = Math.max(1, Math.ceil(Math.min(totalCount, maxRows) / pageSize));
      const totalPages = Math.min(metaTotalPages, maxPages);
      const pageNumbers = Array.from(
        { length: Math.max(0, totalPages - 1) },
        (_, index) => index + 2
      );
      const remainingItems: TenderProject[] = [];

      for (let index = 0; index < pageNumbers.length; index += this.pageFetchConcurrency) {
        const batch = pageNumbers.slice(index, index + this.pageFetchConcurrency);
        const pages = await Promise.all(
          batch.map(pageNumber =>
            this.fetchProjectCalendarRowsPage(baseParams, pageNumber, pageSize)
          )
        );
        if (this.presenterDestroyed || requestToken !== this.projectCalendarRowsRequestToken) {
          return;
        }
        for (const page of pages) {
          remainingItems.push(...(page.items ?? []));
        }
      }

      const rows = [...firstItems, ...remainingItems]
        .filter(project => this.hasProjectCalendarDates(project))
        .slice(0, maxRows)
        .map(project => this.mapToRow(project));

      this.zone.run(() => {
        if (this.presenterDestroyed || requestToken !== this.projectCalendarRowsRequestToken) {
          return;
        }
        this.projectCalendarRows = this.areProjectCalendarRowsEquivalent(
          this.projectCalendarRows,
          rows
        )
          ? this.projectCalendarRows
          : rows;
        this.projectCalendarRowsLoadedKey = queryKey;
        this.projectCalendarRowsInFlightKey = '';
        this.projectCalendarRowsLoading = false;
        this.cdr.markForCheck();
      });
    } catch (error) {
      this.debugWarn('[TenderProjects] Failed to load calendar project rows.', error);
      this.zone.run(() => {
        if (this.presenterDestroyed || requestToken !== this.projectCalendarRowsRequestToken) {
          return;
        }
        this.projectCalendarRowsInFlightKey = '';
        this.projectCalendarRowsLoading = false;
        this.cdr.markForCheck();
      });
    }
  }

  private buildProjectCalendarListParams(): ListParams {
    const params = { ...this.buildProjectsListParams() };
    delete params.pageNumber;
    delete params.pageSize;
    delete params.groupBy;
    delete params.groupDirection;
    delete params.groupDateInterval;
    return params;
  }

  private buildProjectCalendarRowsQueryKey(): string {
    const params = this.buildProjectCalendarListParams();
    return JSON.stringify(
      Object.keys(params)
        .sort()
        .map(key => [key, (params as Record<string, unknown>)[key]])
    );
  }

  private fetchProjectCalendarRowsPage(
    baseParams: ListParams,
    pageNumber: number,
    pageSize: number
  ): Promise<{
    items?: TenderProject[] | null;
    meta?: { totalCount?: number | null; totalPages?: number | null } | null;
  }> {
    return firstValueFrom(
      this.projectsFacade.api
        .listWithMeta({
          ...baseParams,
          pageNumber,
          pageSize
        })
        .pipe(takeUntil(this.destroy$))
    );
  }

  private hasProjectCalendarDates(project: TenderProject): boolean {
    const source = project as TenderProject & Record<string, unknown>;
    return (
      this.hasProjectCalendarDateValue(source.deadline) ||
      this.hasProjectCalendarDateValue(source.dueDate) ||
      this.hasProjectCalendarDateValue(source.startDate) ||
      this.hasProjectCalendarDateValue(source.startedDate) ||
      this.hasProjectCalendarDateValue(source.endDate) ||
      this.hasProjectCalendarDateValue(source.finishedDate) ||
      this.hasProjectCalendarDateValue(source.acceptDate) ||
      this.hasProjectCalendarDateValue(source.acceptedDate)
    );
  }

  private hasProjectCalendarDateValue(value: unknown): boolean {
    if (value == null) {
      return false;
    }
    const text = String(value).trim();
    if (!text) {
      return false;
    }
    const parsed = new Date(text);
    return Number.isFinite(parsed.getTime());
  }

  private areProjectCalendarRowsEquivalent(
    currentRows: readonly TenderRow[],
    nextRows: readonly TenderRow[]
  ): boolean {
    if (currentRows === nextRows) {
      return true;
    }
    if (currentRows.length !== nextRows.length) {
      return false;
    }

    for (let index = 0; index < currentRows.length; index += 1) {
      if (!this.isProjectCalendarRowEquivalent(currentRows[index], nextRows[index])) {
        return false;
      }
    }

    return true;
  }

  private isProjectCalendarRowEquivalent(left: TenderRow, right: TenderRow): boolean {
    return (
      left.id === right.id &&
      left.title === right.title &&
      left.startDate === right.startDate &&
      left.endDate === right.endDate &&
      left.deadline === right.deadline &&
      left.acceptDate === right.acceptDate &&
      left.assignTo === right.assignTo &&
      left.status === right.status &&
      left.ts === right.ts &&
      left.owner === right.owner &&
      left.top === right.top &&
      left.doi === right.doi &&
      left.country === right.country &&
      left.description === right.description
    );
  }

  scheduleActivityPrefetch(rows: readonly TenderRow[]): void {
    void rows;
    // Tender Projects should not issue background details/activity requests on list load.
  }

  protected override canPrefetchActivity(): boolean {
    return false;
  }

  protected override prefetchActivityForRow(row: TenderRow | null): void {
    void row;
    // Details are fetched only after explicit openDetails().
  }

  protected override prefetchActivityForRows(rows: readonly TenderRow[]): void {
    void rows;
  }

  private deferInitialPageSkeletonHide(requestToken: number): void {
    return deferTenderProjectsInitialPageSkeletonHide(this.fetchHost(), requestToken);
  }

  private clearPageSkeletonHideTimer(): void {
    return clearTenderProjectsPageSkeletonHideTimer(this.fetchHost());
  }

  private startProjectsAutoRefresh(): void {
    return startTenderProjectsAutoRefresh(this.autoRefreshHost());
  }

  private stopProjectsAutoRefresh(): void {
    return stopTenderProjectsAutoRefresh(this.autoRefreshHost());
  }

  private subscribeToNotificationRoute(): void {
    return subscribeTenderProjectsNotificationRoute(
      this as unknown as TenderProjectsNotificationRouteHost
    );
  }

  private async flushPendingProjectNotificationRouteIntent(): Promise<void> {
    return flushTenderProjectsNotificationRouteIntent(
      this as unknown as TenderProjectsNotificationRouteHost
    );
  }

  private syncProjectNotificationRouteState(intent: ProjectNotificationRouteIntent | null): void {
    return syncTenderProjectsNotificationRouteState(
      this as unknown as TenderProjectsNotificationRouteHost,
      intent
    );
  }

  private findRowByProjectId(projectId: number): TenderRow | null {
    if (!projectId || !this.rows?.length) {
      return null;
    }
    return (
      this.rows.find(
        row => getProjectIdFromTenderRow(row, value => this.parseId(value)) === projectId
      ) ?? null
    );
  }

  private async primeChecklistsForRow(row: TenderRow | null): Promise<void> {
    const projectId = getProjectIdFromTenderRow(row, value => this.parseId(value));
    if (!row || !projectId) {
      return;
    }

    const currentRow = this.findRowByProjectId(projectId) ?? row;
    if (currentRow.checklistsLoaded) {
      return;
    }

    const existingTask = this.checklistPrefetchInFlight.get(projectId);
    if (existingTask) {
      await existingTask;
      return;
    }

    const task = firstValueFrom(
      this.tenderProjectChecklistsFacade.getByProjectId(projectId).pipe(
        map(items => {
          this.applyPrefetchedChecklists(projectId, items ?? []);
          return void 0;
        }),
        catchError(err => {
          this.debugWarn('[ProjectDetails] Failed to prefetch project checklists.', err);
          return of(void 0);
        })
      )
    ).finally(() => {
      this.checklistPrefetchInFlight.delete(projectId);
    });

    this.checklistPrefetchInFlight.set(projectId, task);
    await task;
  }

  private async primeProjectDetailsForRow(row: TenderRow | null): Promise<void> {
    const projectId = getProjectIdFromTenderRow(row, value => this.parseId(value));
    if (!row || !projectId) {
      return;
    }

    if (this.projectDetailsPrefetched.has(projectId)) {
      return;
    }

    const existingTask = this.projectDetailsPrefetchInFlight.get(projectId);
    if (existingTask) {
      await existingTask;
      return;
    }

    const task = firstValueFrom(
      this.projectsFacade.api
        .getDetails(projectId, {
          includeActivity: true,
          includeSupplementalActivity: false
        })
        .pipe(
          map(details => {
            this.applyPrefetchedProjectDetails(projectId, details);
            return void 0;
          }),
          catchError(err => {
            this.debugWarn('[ProjectDetails] Failed to prefetch aggregated project details.', err);
            return of(void 0);
          })
        )
    ).finally(() => {
      this.projectDetailsPrefetchInFlight.delete(projectId);
    });

    this.projectDetailsPrefetchInFlight.set(projectId, task);
    await task;
  }

  private openProjectDetailsPanel(
    row: TenderRow,
    options?: {
      syncRoute?: boolean;
      prefetchedDetails?: ProjectDetailsResponse | null;
      notificationFocus?: ProjectNotificationFocus | null;
    }
  ): void {
    const projectId = getProjectIdFromTenderRow(row, value => this.parseId(value));
    this.projectNotificationFocus = options?.notificationFocus ?? null;
    if (!projectId) {
      this.projectDetailsSaveErrorMessage = '';
      this.projectDetailsSaveFieldIssues = [];
      this.selectedRow = row;
      this.showDetails = true;
      this.activities = [];
      this.activityLoading = false;
      this.projectDetailsLoading = false;
      if (options?.syncRoute !== false) {
        this.syncProjectNotificationRouteState(null);
      }
      this.cdr.markForCheck();
      return;
    }

    const applySelection = () => {
      const resolvedRow = this.findRowByProjectId(projectId) ?? row;
      this.projectDetailsSaveErrorMessage = '';
      this.projectDetailsSaveFieldIssues = [];
      this.selectedRow = resolvedRow;
      this.showDetails = true;
      this.restoreAuditForRowFromCache(resolvedRow);
      this.cdr.markForCheck();
    };

    applySelection();

    if (options?.syncRoute !== false) {
      this.syncProjectNotificationRouteState({
        panel: 'details',
        projectId,
        section: null,
        commentId: null,
        checklistId: null
      });
    }

    if (options?.prefetchedDetails?.project) {
      this.applyPrefetchedProjectDetails(projectId, options.prefetchedDetails);
      this.projectDetailsLoading = false;
      this.activityLoading = false;
      this.cdr.markForCheck();
      return;
    }

    if (this.projectDetailsPrefetched.has(projectId)) {
      this.projectDetailsLoading = false;
      this.activityLoading = false;
      this.cdr.markForCheck();
      return;
    }

    this.projectDetailsLoading = true;
    this.activityLoading = true;
    this.cdr.markForCheck();

    void this.primeProjectDetailsForRow(row)
      .then(() => {
        if (
          this.selectedRow &&
          getProjectIdFromTenderRow(this.selectedRow, value => this.parseId(value)) === projectId
        ) {
          this.projectDetailsLoading = false;
          this.activityLoading = false;
          this.cdr.markForCheck();
        }
      })
      .catch(err => {
        this.debugWarn('[ProjectDetails] Failed to load project details payload.', err);
        this.projectDetailsLoading = false;
        this.activityLoading = false;
        this.loadAuditForRow(this.findRowByProjectId(projectId) ?? row);
        this.toast('Failed to load full project details', 'error', 6000);
        this.cdr.markForCheck();
      });
  }

  private applyPrefetchedProjectDetails(
    projectId: number,
    details: ProjectDetailsResponse | null | undefined
  ): void {
    if (!details?.project) {
      return;
    }

    const mappedRow = this.mapToRow(details.project);
    const nextChecklists = this.mapAndSortChecklistItems(details.checklists ?? []);
    const targetRow = this.findRowByProjectId(projectId) ?? this.selectedRow ?? null;
    const hydratedRow = targetRow
      ? Object.assign(targetRow, mappedRow, {
          checklists: nextChecklists,
          checklistsLoaded: true
        })
      : ({
          ...mappedRow,
          checklists: nextChecklists,
          checklistsLoaded: true
        } as TenderRow);

    if (
      this.selectedRow &&
      getProjectIdFromTenderRow(this.selectedRow, value => this.parseId(value)) === projectId
    ) {
      Object.assign(this.selectedRow, hydratedRow);
    }

    if (details.includesActivity) {
      seedTenderProjectActivityFeedCache(
        this.activityHost(),
        projectId,
        hydratedRow,
        details.activity ?? [],
        details.includesSupplementalActivity
      );
    }

    this.projectDetailsPrefetched.add(projectId);
    this.writeProjectsCache(this.rows);
    this.cdr.markForCheck();
  }

  private applyPrefetchedChecklists(projectId: number, items: ProjectChecklist[]): void {
    const next = this.mapAndSortChecklistItems(items);
    const targetRow = this.findRowByProjectId(projectId);
    if (targetRow) {
      targetRow.checklists = next;
      targetRow.checklistsLoaded = true;
    }
    if (
      this.selectedRow &&
      getProjectIdFromTenderRow(this.selectedRow, value => this.parseId(value)) === projectId
    ) {
      this.selectedRow.checklists = next;
      this.selectedRow.checklistsLoaded = true;
    }
    this.writeProjectsCache(this.rows);
    this.cdr.markForCheck();
  }

  private mapAndSortChecklistItems(items: readonly CheckList[]): ChecklistItem[] {
    if (!items.length) {
      return [];
    }

    const mapped = items.map(item => this.mapChecklistItem(item));
    const hasOrder = mapped.every(item => Number.isFinite(item.order ?? Number.NaN));
    const ordered = hasOrder
      ? [...mapped].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      : [...mapped];

    const active = ordered.filter(item => !item.done);
    const done = ordered.filter(item => item.done);
    const grouped = [...active, ...done];
    for (const item of grouped) {
      const subItems = item.subItems ?? [];
      if (subItems.length > 1) {
        const activeSubs = subItems.filter(sub => !sub.done);
        const doneSubs = subItems.filter(sub => sub.done);
        item.subItems = [...activeSubs, ...doneSubs];
      }
    }
    return grouped;
  }

  private mapChecklistItem(item: CheckList): ChecklistItem {
    const notes = parseChecklistNotesEnvelope(item.notes, () => this.createChecklistSubItemId());
    return {
      id: item.id,
      text: (item.name ?? '').trim(),
      done: Boolean(item.isCompleted),
      subItems: notes.subItems.map(sub => this.cloneChecklistSubItem(sub)),
      noteText: notes.noteText,
      order: notes.order,
      notesEnvelope: notes.envelope
    };
  }

  private cloneChecklistSubItem(sub: ChecklistSubItem): ChecklistSubItem {
    return { ...sub };
  }

  private createChecklistSubItemId(): string {
    const rand = Math.random().toString(36).slice(2, 8);
    return `sub-${Date.now().toString(36)}-${rand}`;
  }

  private tryAutoRefreshProjects(force = false): void {
    return tryTenderProjectsAutoRefresh(this.autoRefreshHost(), force);
  }

  private flushDeferredProjectsRefresh(): void {
    return flushDeferredTenderProjectsRefresh(this.autoRefreshHost());
  }

  private finishPrimaryProjectsFetch(requestToken: number): void {
    return finishTenderProjectsPrimaryFetch(this.autoRefreshHost(), requestToken);
  }

  private subscribeToProjectRealtimeUpdates(): void {
    this.projectsFacade.realtime
      .messages()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: message => {
          this.refreshOpenProjectDetailsFromRealtimeMessage(message);
          if (this.shouldRefreshProjectsFromRealtimeMessage(message)) this.tryAutoRefreshProjects();
        },
        error: (err: unknown) => {
          if (environment.enableDebugLogs) {
            console.error('[TenderProjects] Realtime project subscription error:', err);
          }
        }
      });
  }

  private shouldRefreshProjectsFromRealtimeMessage(message: unknown): boolean {
    return shouldRefreshTenderProjectsFromRealtimeMessage(message);
  }

  private refreshOpenProjectDetailsFromRealtimeMessage(message: unknown): void {
    if (!this.showDetails || !this.selectedRow) {
      return;
    }

    const projectId = extractTenderProjectsRealtimeProjectId(message);
    if (!projectId) {
      return;
    }

    const selectedProjectId = getProjectIdFromTenderRow(this.selectedRow, value =>
      this.parseId(value)
    );
    if (!selectedProjectId || selectedProjectId !== projectId) {
      return;
    }

    if (this.projectDetailsRealtimeRefreshInFlight.has(projectId)) {
      return;
    }

    const task = firstValueFrom(
      this.projectsFacade.api
        .getDetails(projectId, {
          includeActivity: true,
          includeSupplementalActivity: false
        })
        .pipe(
          map(details => {
            this.applyPrefetchedProjectDetails(projectId, details);
            return void 0;
          }),
          catchError(err => {
            this.debugWarn(
              '[TenderProjects] Failed to refresh open project details from realtime.',
              err
            );
            return of(void 0);
          })
        )
    ).finally(() => {
      this.projectDetailsRealtimeRefreshInFlight.delete(projectId);
    });

    this.projectDetailsRealtimeRefreshInFlight.set(projectId, task);
    void task;
  }

  private markNewlyCreatedRowForVisualConfirm(row: TenderRow): void {
    return markTenderProjectsRowForVisualConfirm(this.pinningHost(), row);
  }

  private pinNewlyCreatedRowToTop(rows: TenderRow[]): TenderRow[] {
    return pinTenderProjectsNewRowToTop(this.pinningHost(), rows);
  }

  private showNewlyCreatedRowAtTop(): void {
    return showTenderProjectsNewRowAtTop(this.pinningHost());
  }

  private initProjectsSyncChannel(): void {
    return initTenderProjectsSyncChannel(this.syncHost());
  }

  private destroyProjectsSyncChannel(): void {
    return destroyTenderProjectsSyncChannel(this.syncHost());
  }

  private createSyncClientId(): string {
    return createTenderProjectsSyncClientId(this.isBrowser);
  }
  private broadcastProjectsRefresh(reason: string): void {
    return broadcastTenderProjectsRefreshSignal(this.syncHost(), reason);
  }
  private broadcastLookupsRefresh(reason: string): void {
    return broadcastTenderProjectLookupsRefreshSignal(this.syncHost(), reason);
  }

  private projectsRefreshStorageKey(): string {
    return tenderProjectsRefreshStorageKey(this.syncHost());
  }
  private lookupsRefreshStorageKey(): string {
    return tenderProjectsLookupsRefreshStorageKey(this.syncHost());
  }
  private projectsSyncScope(): string {
    return tenderProjectsSyncScope(this.syncHost());
  }

  onPageSizeChange(newSize: number) {
    const nextState = buildTenderProjectsPageSizeState({
      newSize,
      gridConfig: this.gridConfig,
      tablePageSizeOptions: this.tablePageSizeOptions
    });
    this.currentPageSize = nextState.currentPageSize;
    this.currentProjectsPage = 1;
    this.gridConfig = nextState.gridConfig;
    this.projectGridConfig = nextState.projectGridConfig;
    this.syncProjectGridConfig();
    this.cdr.markForCheck();
    this.fetchProjects();
  }
  private async loadLookups() {
    await this.ensureAuthReadyForProjects();
    if (this.presenterDestroyed) {
      return;
    }
    await loadTenderProjectLookups({
      getLookupsLoadInFlight: () => this.lookupsLoadInFlight,
      setLookupsLoadInFlight: task => {
        this.lookupsLoadInFlight = task;
      },
      isLookupsFresh: now =>
        this.lookupsLoaded &&
        (this.lookupsLoadedAt ?? 0) > 0 &&
        now - (this.lookupsLoadedAt ?? 0) < this.LOOKUPS_MEMORY_TTL_MS,
      debugLog: (message, payload) => this.debugLog(message, payload),
      api: {
        statuses: () => this.api.statuses(),
        typesOfProjects: () => this.api.typesOfProjects(),
        tenderStages: () => this.api.tenderStages(),
        degreesOfImportances: () => this.api.degreesOfImportances(),
        owners: () => this.api.owners(),
        ownerTypes: () => this.api.ownerTypes(),
        countries: () => this.api.countries(),
        assignToSettings: () => this.api.assignToSettings(),
        inChargeSettings: () => this.api.inChargeSettings()
      },
      setLookups: lookups => {
        this.statuses = lookups.statuses;
        this.top = lookups.top;
        this.stages = lookups.stages;
        this.doi = lookups.doi;
        this.owners = lookups.owners;
        this.ownerTypes = lookups.ownerTypes;
        this.countries = lookups.countries;
        this.assignToSettings = lookups.assignToSettings;
        this.inChargeSettings = lookups.inChargeSettings;
        this.applyLookupPresentationState();
      },
      setLookupsLoaded: value => {
        this.lookupsLoaded = value;
      },
      setLookupsLoadedAt: value => {
        this.lookupsLoadedAt = value;
      },
      hadCachedLookups: this.hadCachedLookups,
      rebuildLookupMaps: () => this.rebuildLookupMaps(),
      rehydrateRowsFromLookups: () => this.rehydrateRowsFromLookups(),
      markForCheck: () => this.zone.run(() => this.cdr.markForCheck()),
      writeLookupsCache: () => this.writeLookupsCache(),
      toastError: message => this.toast(message, 'error')
    });
  }

  private ensureAuthReadyForProjects(): Promise<void> {
    if (this.authBootstrapCompleted) {
      return Promise.resolve();
    }
    if (this.authBootstrapTask) {
      return this.authBootstrapTask;
    }

    this.authBootstrapTask = this.authSessionFacade
      .initializeSession()
      .catch(error => {
        this.debugWarn(
          '[TenderProjects] Auth bootstrap before initial page load failed; continuing with current session state.',
          error
        );
      })
      .finally(() => {
        this.authBootstrapCompleted = true;
        this.authBootstrapTask = null;
      });

    return this.authBootstrapTask;
  }

  private resolveId(list: IdName[], name: string | undefined | null): number | null {
    if (!name) return null;
    const key = name.toLowerCase().trim();
    if (!key) return null;
    const nameMap = this.getLookupNameMap(list);
    const cached = nameMap?.get(key);
    if (cached) return cached.id;
    return findTenderProjectLookupByName(list, name)?.id ?? null;
  }

  private buildCreateDtoFromRow(row: TenderRow): CreateProjectDto | null {
    return buildTenderProjectCreateDto({
      row,
      lookups: {
        statuses: this.statuses,
        top: this.top,
        stages: this.stages,
        doi: this.doi,
        owners: this.owners,
        ownerTypes: this.ownerTypes,
        countries: this.countries,
        assignToSettings: this.assignToSettings,
        inChargeSettings: this.inChargeSettings
      },
      debugLog: (message, payload) => this.debugLog(message, payload),
      resolveId: (list, name) => this.resolveId(list, name),
      parseNumberOrNull: value => this.parseNumberOrNull(value),
      normalizeApiDate: value => normalizeProjectApiDate(value),
      normalizeLabel: value => this.normalizeLabel(value)
    });
  }

  private buildUpdateDtoFromRow(row: TenderRow): UpdateProjectDto | null {
    return buildTenderProjectUpdateDto({
      row,
      lookups: {
        statuses: this.statuses,
        top: this.top,
        stages: this.stages,
        doi: this.doi,
        owners: this.owners,
        ownerTypes: this.ownerTypes,
        countries: this.countries,
        assignToSettings: this.assignToSettings,
        inChargeSettings: this.inChargeSettings
      },
      debugLog: (message, payload) => this.debugLog(message, payload),
      resolveId: (list, name) => this.resolveId(list, name),
      parseNumberOrNull: value => this.parseNumberOrNull(value),
      normalizeApiDate: value => normalizeProjectApiDate(value),
      normalizeLabel: value => this.normalizeLabel(value),
      parseId: value => this.parseId(value),
      toastError: message => this.toast(message, 'error')
    });
  }
}
