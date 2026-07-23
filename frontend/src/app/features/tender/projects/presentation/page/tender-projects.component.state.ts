import {
  ChangeDetectorRef,
  Directive,
  ElementRef,
  NgZone,
  ViewChild,
  inject,
  DOCUMENT
} from '@angular/core';
import { Subject, of, type Observable } from 'rxjs';
import { environment } from '../../../../../../environments/environment';
import { DataGridComponent, getUnifiedDataGridColumnWidth } from '@shared/data-grid';
import {
  FilterState,
  GridColumn,
  GridConfig,
  SortState,
  GridRemoteGroupSummary,
  type GridFilterOptionValue
} from '@shared/data-grid';
import { TenderRow } from './tender-project-details/project-details.component';
import { Activity } from './tender-project-details/tabs/activity-tab.component';
import { TenderProjectsFeatureFacade } from '@features/tender/projects';
import { AUTH_USER_FACADE } from '@core/auth/auth-user.facade';
import { PermissionService } from '@core/authorization/permission.service';
import { TenderProjectsAuditHelper } from './tender-projects-audit.helper';
import { resolveTenderProjectLookupDisplayLabel } from './tender-projects.lookup.util';
import type {
  ActivityFeedRequestOptions,
  ProjectListFilter,
  ProjectActivityFeedItem
} from '@features/tender/projects';
import {
  buildTenderProjectsGridConfig,
  buildTenderProjectsProjectGridConfig,
  createTenderProjectLookupIdMaps,
  createTenderProjectLookupNameMaps,
  createTenderProjectsAuditTimeFormatter,
  TENDER_PROJECTS_CACHE_LIMITS,
  TENDER_PROJECTS_STORAGE_KEYS,
  TENDER_PROJECTS_TONE_NAMES
} from './tender-projects.state.defaults';
import type { IdName } from './tender-projects.contracts';
import type {
  LookupIdMaps,
  LookupNameMaps,
  LookupToneItem,
  LookupToneKey,
  ToneInfo,
  ToneName
} from './tender-projects.types';

@Directive()
export abstract class TenderProjectsComponentState {
  protected abstract normalizeLabel(value: unknown): string | null;
  protected abstract parseId(value: unknown): number | null;
  protected abstract pickName(...values: unknown[]): string | null;
  protected abstract getRowKeyValue(row: TenderRow, label?: string): string | null;
  protected abstract getCachedElement(
    field: string,
    row: TenderRow,
    factory: () => HTMLElement
  ): HTMLElement;
  protected abstract formatPercentFromDecimal(value: unknown, fallback?: string): string;
  protected abstract formatDate(iso?: unknown): string;
  protected abstract parseNumberOrNull(value: unknown): number | null;
  protected abstract formatMoney(value: number): string;
  protected abstract resolveNameById(list: IdName[], id?: number | string | null): string | null;
  protected canPrefetchActivity(): boolean {
    return true;
  }
  protected prefetchActivityForRow(_row: TenderRow | null): void {}
  protected prefetchActivityForRows(rows: readonly TenderRow[]): void {
    for (const row of rows) {
      this.prefetchActivityForRow(row);
    }
  }
  protected usesServerDrivenProjectRows(): boolean {
    return false;
  }
  protected loadProjectFilterOptions(
    _field: string,
    _optionSearch?: string
  ): Observable<GridFilterOptionValue[]> {
    return of([]);
  }
  protected buildProjectFilterOptionsLoader(field: string) {
    return () => this.loadProjectFilterOptions(field);
  }
  protected buildProjectListApiFilters(): ProjectListFilter[] {
    return [];
  }
  protected onProjectQueryStateChanged(): void {}

  protected readonly doc = inject(DOCUMENT);
  protected readonly hostRef = inject(ElementRef<HTMLElement>);
  protected readonly isBrowser = typeof window !== 'undefined';
  protected cdr = inject(ChangeDetectorRef);
  protected zone = inject(NgZone);
  protected readonly projectsFacade = inject(TenderProjectsFeatureFacade);
  protected readonly authUserFacade = inject(AUTH_USER_FACADE);
  protected readonly permission = inject(PermissionService);
  protected api = this.projectsFacade.api;
  protected readonly activityFeedApi: {
    getActivityFeed(
      projectId: number,
      options?: ActivityFeedRequestOptions
    ): Observable<ProjectActivityFeedItem[]>;
  } = this.projectsFacade.api;
  protected auditApi = this.projectsFacade.audit;
  protected readonly auditWriteApi = this.projectsFacade.audit;
  protected commentsApi = this.projectsFacade.comments;
  protected destroy$ = new Subject<void>();
  protected cellRendererCache = new Map<string, WeakMap<TenderRow, HTMLElement>>();
  protected readonly LS_KEY_TONES = TENDER_PROJECTS_STORAGE_KEYS.tones;
  protected readonly LS_KEY_CUSTOM = TENDER_PROJECTS_STORAGE_KEYS.customizations;
  protected readonly LS_KEY_PROJECTS_CACHE = TENDER_PROJECTS_STORAGE_KEYS.projectsCache;
  protected readonly LS_KEY_LOOKUPS_CACHE = TENDER_PROJECTS_STORAGE_KEYS.lookupsCache;
  protected readonly PROJECTS_CACHE_TTL_MS = TENDER_PROJECTS_CACHE_LIMITS.projectsCacheTtlMs;
  protected readonly LOOKUPS_CACHE_TTL_MS = TENDER_PROJECTS_CACHE_LIMITS.lookupsCacheTtlMs;
  protected readonly LOOKUPS_MEMORY_TTL_MS = TENDER_PROJECTS_CACHE_LIMITS.lookupsMemoryTtlMs;
  protected readonly PROJECTS_CACHE_MAX_ROWS = TENDER_PROJECTS_CACHE_LIMITS.projectsCacheMaxRows;
  protected readonly pageFetchConcurrency = TENDER_PROJECTS_CACHE_LIMITS.pageFetchConcurrency;
  // Salary Reports reuses the Tender grid surface, but has its own state and rendering profile.
  // Keep this stable for the component lifetime so config updates do not repeatedly read location.
  protected readonly isSalaryReportsGrid =
    this.isBrowser && window.location.pathname === '/salary-reports';
  readonly refreshLookupsOnAutoRefresh = !this.isSalaryReportsGrid;
  readonly preserveUnchangedFetchedRows = this.isSalaryReportsGrid;
  readonly projectGridStateKey = this.isSalaryReportsGrid
    ? 'salary-reports-grid-v2'
    : 'tender-projects-grid';
  protected readonly debugMode = environment.enableDebugLogs;
  protected fetchToken = 0;
  protected hadCachedLookups = false;
  protected lookupsLoadedAt: number | null = null;
  protected lookupsLoadInFlight: Promise<void> | null = null;
  protected rowKeySet = new Set<string>();
  protected lookupIdMaps: LookupIdMaps = createTenderProjectLookupIdMaps();
  protected lookupNameMaps: LookupNameMaps = createTenderProjectLookupNameMaps();
  protected toneCache: Record<string, { tone?: string; customHex?: string }> | null = null;
  protected customizationsCache: Record<string, { customLabel?: string; order?: number }> | null =
    null;
  protected readonly toneNames = TENDER_PROJECTS_TONE_NAMES;
  protected readonly auditTimeFormatter = createTenderProjectsAuditTimeFormatter();
  protected readonly auditHelper = new TenderProjectsAuditHelper({
    normalizeLabel: value => this.normalizeLabel(value),
    parseId: value => this.parseId(value),
    pickName: (...values) => this.pickName(...values),
    auditTimeFormatter: this.auditTimeFormatter
  });
  @ViewChild(DataGridComponent) protected grid?: DataGridComponent<TenderRow>;
  @ViewChild(DataGridComponent, { read: ElementRef })
  protected dataGridEl?: ElementRef<HTMLElement>;
  @ViewChild('saveViewBtn') protected saveViewBtn?: ElementRef<HTMLButtonElement>;
  protected lastSnapshotAnchor?: HTMLElement;
  protected snapshotMenuObserver: MutationObserver | null = null;
  protected snapshotMenuRaf: number | null = null;
  protected snapshotOutsideClickHandler: ((event: Event) => void) | null = null;

  // Salary Reports starts with a remote request; keep the grid in its loading
  // state during the first change-detection pass instead of showing fake Page 1 of 1.
  loading = this.isSalaryReportsGrid;
  pageSkeletonLoading = false;
  error: string | null = null;

  protected readonly fetchPageSize = 100;
  readonly tablePageSizeOptions = [10, 20, 50, 100, 200];

  showDetails = false;
  selectedRow: TenderRow | null = null;
  selectedRows: TenderRow[] = [];
  deleteDialogOpen = false;
  deleteDialogTargets: TenderRow[] = [];
  deleteInProgress = false;
  showAdd = false;
  editingPanelTarget: TenderRow | null = null;
  bulkEditTargets: TenderRow[] = [];
  bulkEditBaseline: TenderRow | null = null;
  addPanelSeedRow: TenderRow | null = null;
  showSettings = false;

  get bulkEditMode(): boolean {
    return this.bulkEditTargets.length > 1;
  }

  get bulkEditCount(): number {
    return this.bulkEditTargets.length;
  }

  get addPanelEditMode(): boolean {
    return !!this.editingPanelTarget || this.bulkEditMode;
  }

  get addPanelTitle(): string {
    if (this.bulkEditMode) {
      return `Edit ${this.bulkEditCount} Projects`;
    }
    if (this.editingPanelTarget) {
      return 'Edit Project';
    }
    return 'New Project';
  }

  activities: Activity[] = [];
  activityLoading = false;
  projectDetailsLoading = false;
  protected readonly activityPrefetchInFlight = new Set<number>();
  protected auditLoadToken = 0;
  protected readonly commentCacheKey = 'engineers-salary-reference.project.comments.pending';
  protected readonly auditCacheKey = 'engineers-salary-reference.project.audit.pending';
  protected pendingSyncInFlight = false;
  protected lastPendingSync = 0;
  protected pendingAuditSyncInFlight = false;
  protected lastPendingAuditSync = 0;

  rows: TenderRow[] = [];
  protected projectCalendarRows: TenderRow[] = [];
  protected projectCalendarRowsLoading = false;

  lookupsLoaded = false;
  owners: IdName[] = [];
  ownerTypes: IdName[] = [];
  statuses: IdName[] = [];
  top: IdName[] = []; // TypesOfProjects
  stages: IdName[] = []; // TenderStages
  doi: IdName[] = []; // DegreesOfImportances
  countries: IdName[] = [];
  assignToSettings: IdName[] = [];
  inChargeSettings: IdName[] = [];

  currentPageSize = 100;
  protected currentProjectsPage = 1;
  protected totalProjectRecords = 0;
  protected gridSortStates: SortState[] = [];
  protected gridFilterStates: FilterState[] = [];
  protected gridGroupColumnsState: string[] = [];
  protected gridGroupDateIntervalsState: Record<
    string,
    'day' | 'week' | 'month' | 'quarter' | 'year'
  > = {};
  projectRemoteGroups: GridRemoteGroupSummary[] = [];

  // ====== DataGrid Config ======
  gridConfig: GridConfig = buildTenderProjectsGridConfig(
    this.currentPageSize,
    this.tablePageSizeOptions
  );
  projectGridConfig: GridConfig = buildTenderProjectsProjectGridConfig(this.gridConfig);

  // ====== DataGrid Columns ======
  private getCachedCellRendererElement(
    cacheField: string,
    row: TenderRow | null | undefined,
    factory: () => HTMLElement
  ): HTMLElement {
    if (!row || typeof row !== 'object') {
      return factory();
    }

    return this.getCachedElement(cacheField, row, factory);
  }

  private renderTitleLink = (value: unknown, row: TenderRow) => {
    if (!row || typeof row !== 'object') {
      const span = document.createElement('span');
      span.textContent = '-';
      return span;
    }

    const safeLabel = this.normalizeLabel(value) ?? '-';
    const dataKey =
      this.getRowKeyValue(row, safeLabel) ?? `name:${encodeURIComponent(safeLabel.toLowerCase())}`;
    return this.getCachedCellRendererElement('proj-link-v1:title', row, () => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'link data-grid-link data-grid-link--project';
      btn.textContent = safeLabel;
      btn.setAttribute('data-link', 'project');
      btn.setAttribute('data-field', 'title');
      btn.setAttribute('data-kind', 'project');
      btn.setAttribute('data-key', dataKey);
      if (row.id != null) btn.setAttribute('data-row-id', String(row.id));
      btn.setAttribute('aria-label', `Project: ${safeLabel}`);
      btn.setAttribute('role', 'button');
      btn.setAttribute('tabindex', '0');
      return btn;
    });
  };

  private renderMutedPill = (value: unknown) => {
    const span = document.createElement('span');
    span.className = 'pill pill-muted';
    const label = document.createElement('span');
    label.className = 'pill__label';
    label.textContent = this.normalizeLabel(value) ?? '-';
    span.append(label);
    return span;
  };

  private renderPercentPill = (value: unknown, row: TenderRow) =>
    this.getCachedCellRendererElement('pill:prb', row, () => {
      const span = document.createElement('span');
      span.className = 'pill prb-pill';
      const label = document.createElement('span');
      label.className = 'pill__label';
      label.textContent = this.formatPercentFromDecimal(value, '—');
      span.append(label);
      return span;
    });

  private loadToneCache(): Record<string, { tone?: string; customHex?: string }> {
    return {};
  }

  private getToneCache(): Record<string, { tone?: string; customHex?: string }> {
    if (!this.toneCache) {
      this.toneCache = this.loadToneCache();
    }
    return this.toneCache;
  }

  private loadCustomizationsCache(): Record<string, { customLabel?: string; order?: number }> {
    return {};
  }

  private getCustomizationsCache(): Record<string, { customLabel?: string; order?: number }> {
    if (!this.customizationsCache) {
      this.customizationsCache = this.loadCustomizationsCache();
    }
    return this.customizationsCache;
  }

  protected refreshToneCache() {
    this.toneCache = this.loadToneCache();
  }

  protected refreshCustomizationCache() {
    this.customizationsCache = this.loadCustomizationsCache();
  }

  protected refreshLookupPresentationCaches() {
    this.refreshToneCache();
    this.refreshCustomizationCache();
  }

  protected scopedStorageKey(baseKey: string): string {
    const user = this.authUserFacade.user();
    const rawScope = user?.id ?? user?.email ?? 'anon';
    const scope =
      String(rawScope)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '_') || 'anon';
    return `${baseKey}:${scope}`;
  }

  protected debugLog(...args: unknown[]) {
    if (!this.debugMode) return;
    console.log(...args);
  }

  protected debugWarn(...args: unknown[]) {
    if (!this.debugMode) return;
    console.warn(...args);
  }

  protected applyLookupPresentationState() {
    this.statuses = this.applyLookupPresentation('status', this.statuses);
    this.top = this.applyLookupPresentation('type', this.top);
    this.stages = this.applyLookupPresentation('stage', this.stages);
    this.doi = this.applyLookupPresentation('importance', this.doi);
    this.owners = this.applyLookupPresentation('owner', this.owners);
    this.ownerTypes = this.applyLookupPresentation('ownerType', this.ownerTypes);
    this.countries = this.applyLookupPresentation('country', this.countries);
    this.assignToSettings = this.applyLookupPresentation('assignTo', this.assignToSettings);
    this.inChargeSettings = this.applyLookupPresentation('inCharge', this.inChargeSettings);
  }

  private normalizeOrder(value: unknown): number | null {
    if (value == null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private applyLookupPresentation(tab: LookupToneKey, list: IdName[]): IdName[] {
    const tones = this.getToneCache();
    const customizations = this.getCustomizationsCache();

    return [...(list ?? [])]
      .map((item, index) => {
        const resolvedId = this.parseId(item?.id);
        const raw = (item ?? {}) as LookupToneItem & Record<string, unknown>;
        const key = resolvedId ? `${tab}_${resolvedId}` : '';
        const cachedTone = key ? tones[key] : null;
        const cachedCustom = key ? customizations[key] : null;
        const customLabel =
          this.normalizeLabel(raw.customLabel ?? raw['CustomLabel'] ?? raw.label ?? raw['Label']) ??
          this.normalizeLabel(cachedCustom?.customLabel) ??
          undefined;
        const customHex =
          this.normalizeHex(
            raw.customHex ??
              raw['colorHex'] ??
              raw['hex'] ??
              raw['toneHex'] ??
              raw['hexColor'] ??
              raw['customColor']
          ) ??
          this.normalizeHex(cachedTone?.customHex) ??
          undefined;
        const tone = customHex
          ? undefined
          : (this.normalizeTone(
              raw.tone ?? raw['toneName'] ?? raw['toneValue'] ?? raw['colorTone'] ?? raw.color
            ) ??
            this.normalizeTone(cachedTone?.tone) ??
            undefined);
        const order =
          this.normalizeOrder(
            raw.order ?? raw['Order'] ?? raw['sortOrder'] ?? raw['sortIndex'] ?? raw['displayOrder']
          ) ??
          this.normalizeOrder(cachedCustom?.order) ??
          index;

        return {
          ...item,
          ...(customLabel ? { customLabel } : {}),
          ...(tone ? { tone } : { tone: undefined }),
          ...(customHex ? { customHex } : { customHex: undefined }),
          order
        } satisfies IdName;
      })
      .sort(
        (left, right) =>
          (this.normalizeOrder(left.order) ?? 0) - (this.normalizeOrder(right.order) ?? 0)
      );
  }

  protected rebuildLookupMaps() {
    const reset = (target: LookupIdMaps[keyof LookupIdMaps]) => {
      target.clear();
    };
    const resetName = (target: LookupNameMaps[keyof LookupNameMaps]) => {
      target.clear();
    };

    reset(this.lookupIdMaps.statuses);
    reset(this.lookupIdMaps.top);
    reset(this.lookupIdMaps.stages);
    reset(this.lookupIdMaps.doi);
    reset(this.lookupIdMaps.owners);
    reset(this.lookupIdMaps.ownerTypes);
    reset(this.lookupIdMaps.countries);
    reset(this.lookupIdMaps.assignToSettings);
    reset(this.lookupIdMaps.inChargeSettings);

    resetName(this.lookupNameMaps.statuses);
    resetName(this.lookupNameMaps.top);
    resetName(this.lookupNameMaps.stages);
    resetName(this.lookupNameMaps.doi);
    resetName(this.lookupNameMaps.owners);
    resetName(this.lookupNameMaps.ownerTypes);
    resetName(this.lookupNameMaps.countries);
    resetName(this.lookupNameMaps.assignToSettings);
    resetName(this.lookupNameMaps.inChargeSettings);

    this.populateLookupMaps(
      this.statuses,
      this.lookupIdMaps.statuses,
      this.lookupNameMaps.statuses
    );
    this.populateLookupMaps(this.top, this.lookupIdMaps.top, this.lookupNameMaps.top);
    this.populateLookupMaps(this.stages, this.lookupIdMaps.stages, this.lookupNameMaps.stages);
    this.populateLookupMaps(this.doi, this.lookupIdMaps.doi, this.lookupNameMaps.doi);
    this.populateLookupMaps(this.owners, this.lookupIdMaps.owners, this.lookupNameMaps.owners);
    this.populateLookupMaps(
      this.ownerTypes,
      this.lookupIdMaps.ownerTypes,
      this.lookupNameMaps.ownerTypes
    );
    this.populateLookupMaps(
      this.countries,
      this.lookupIdMaps.countries,
      this.lookupNameMaps.countries
    );
    this.populateLookupMaps(
      this.assignToSettings,
      this.lookupIdMaps.assignToSettings,
      this.lookupNameMaps.assignToSettings
    );
    this.populateLookupMaps(
      this.inChargeSettings,
      this.lookupIdMaps.inChargeSettings,
      this.lookupNameMaps.inChargeSettings
    );
  }

  private populateLookupMaps(
    list: IdName[],
    idMap: Map<number, string>,
    nameMap: Map<string, IdName>
  ) {
    for (const item of list ?? []) {
      const parsedId = this.parseId(item?.id);
      if (parsedId) {
        idMap.set(parsedId, resolveTenderProjectLookupDisplayLabel(item) ?? item?.name ?? '');
      }
      const candidates = [
        item?.name,
        resolveTenderProjectLookupDisplayLabel(item),
        (item as LookupToneItem | null | undefined)?.label
      ];
      for (const candidate of candidates) {
        const key = (candidate ?? '').trim().toLowerCase();
        if (key) {
          nameMap.set(key, item);
        }
      }
    }
  }

  protected getLookupIdMap(list: IdName[]): Map<number, string> | null {
    if (list === this.statuses) return this.lookupIdMaps.statuses;
    if (list === this.top) return this.lookupIdMaps.top;
    if (list === this.stages) return this.lookupIdMaps.stages;
    if (list === this.doi) return this.lookupIdMaps.doi;
    if (list === this.owners) return this.lookupIdMaps.owners;
    if (list === this.ownerTypes) return this.lookupIdMaps.ownerTypes;
    if (list === this.countries) return this.lookupIdMaps.countries;
    if (list === this.assignToSettings) return this.lookupIdMaps.assignToSettings;
    if (list === this.inChargeSettings) return this.lookupIdMaps.inChargeSettings;
    return null;
  }

  protected getLookupNameMap(list: IdName[]): Map<string, IdName> | null {
    if (list === this.statuses) return this.lookupNameMaps.statuses;
    if (list === this.top) return this.lookupNameMaps.top;
    if (list === this.stages) return this.lookupNameMaps.stages;
    if (list === this.doi) return this.lookupNameMaps.doi;
    if (list === this.owners) return this.lookupNameMaps.owners;
    if (list === this.ownerTypes) return this.lookupNameMaps.ownerTypes;
    if (list === this.countries) return this.lookupNameMaps.countries;
    if (list === this.assignToSettings) return this.lookupNameMaps.assignToSettings;
    if (list === this.inChargeSettings) return this.lookupNameMaps.inChargeSettings;
    return null;
  }

  private normalizeTone(value: unknown): ToneName | null {
    if (!value) return null;
    const key = String(value).trim().toLowerCase();
    if (!key) return null;
    const normalized = key === 'grey' ? 'gray' : key;
    return this.toneNames.has(normalized as ToneName) ? (normalized as ToneName) : null;
  }

  private normalizeHex(value: unknown): string | null {
    if (!value) return null;
    const raw = String(value).trim();
    if (!raw) return null;
    const hex = raw.startsWith('#') ? raw : `#${raw}`;
    if (!/^#([0-9a-fA-F]{3}){1,2}$/.test(hex)) return null;
    return hex.toLowerCase();
  }

  private findLookupToneItem(
    list: LookupToneItem[],
    id?: number | null,
    label?: string | null
  ): LookupToneItem | null {
    const parsedId = this.parseId(id);
    if (parsedId) {
      const byId = list.find(item => this.parseId(item.id) === parsedId);
      if (byId) return byId;
    }
    const key = (label ?? '').trim().toLowerCase();
    if (!key) return null;
    return (
      list.find(item => {
        const name = (item.name ?? '').trim().toLowerCase();
        const customLabel = (item.customLabel ?? '').trim().toLowerCase();
        const altLabel = (item.label ?? '').trim().toLowerCase();
        return name === key || customLabel === key || altLabel === key;
      }) ?? null
    );
  }

  private resolveLookupTone(
    tab: LookupToneKey,
    list: IdName[],
    id?: number | null,
    label?: string | null
  ): ToneInfo | null {
    const toneList = list as LookupToneItem[];
    const item = this.findLookupToneItem(toneList, id, label);
    const raw = (item ?? {}) as LookupToneItem & Record<string, unknown>;
    const tone = this.normalizeTone(
      item?.tone ?? raw['toneName'] ?? raw['toneValue'] ?? raw['colorTone'] ?? raw['color']
    );
    const customHex = this.normalizeHex(
      item?.customHex ??
        raw['colorHex'] ??
        raw['hex'] ??
        raw['toneHex'] ??
        raw['hexColor'] ??
        raw['customColor'] ??
        raw['color']
    );

    if (tone || customHex) {
      return { tone: tone ?? undefined, customHex: customHex ?? undefined };
    }

    const resolvedId = this.parseId(item?.id ?? id);
    if (resolvedId) {
      const cached = this.getToneCache()[`${tab}_${resolvedId}`];
      const cachedTone = this.normalizeTone(cached?.tone);
      const cachedHex = this.normalizeHex(cached?.customHex);
      if (cachedTone || cachedHex) {
        return { tone: cachedTone ?? undefined, customHex: cachedHex ?? undefined };
      }
    }

    return null;
  }

  private renderToneSpan(
    label: string,
    toneInfo: ToneInfo | null,
    fallbackClass: string
  ): HTMLElement {
    const span = document.createElement('span');
    const labelNode = document.createElement('span');
    labelNode.className = 'pill__label';
    labelNode.textContent = label;
    span.append(labelNode);

    if (toneInfo?.customHex) {
      span.className = 'pill custom';
      span.style.setProperty('--custom', toneInfo.customHex);
      return span;
    }

    if (toneInfo?.tone) {
      span.className = `pill tone-${toneInfo.tone}`;
      return span;
    }

    span.className = fallbackClass;
    return span;
  }

  private renderLookupPill(
    value: unknown,
    tab: LookupToneKey,
    list: IdName[],
    id?: number | null,
    fallbackClass = 'pill',
    row?: TenderRow | null,
    cacheField?: string
  ): HTMLElement {
    return this.getCachedCellRendererElement(cacheField ?? `pill:${tab}`, row, () => {
      const rawLabel = this.normalizeLabel(value);
      const matchedItem = this.findLookupToneItem(list as LookupToneItem[], id, rawLabel);
      const resolvedLabel =
        resolveTenderProjectLookupDisplayLabel(matchedItem) ??
        rawLabel ??
        this.resolveNameById(list, id) ??
        '-';
      const toneInfo = this.resolveLookupTone(tab, list, id, rawLabel ?? resolvedLabel);
      return this.renderToneSpan(resolvedLabel, toneInfo, fallbackClass);
    });
  }

  private renderStatusPill = (value: unknown, row: TenderRow) =>
    this.renderLookupPill(
      value,
      'status',
      this.statuses,
      row?.statusId,
      'pill',
      row,
      'pill:status'
    );

  gridColumns: GridColumn<TenderRow>[] = [
    {
      field: 'title',
      header: 'Discipline',
      icon: 'file-earmark-text',
      ...getUnifiedDataGridColumnWidth('primaryTitle'),
      sortable: true,
      filterable: true,
      filterOptionsLoader: this.buildProjectFilterOptionsLoader('title'),
      cellClass: 'proj-link-cell',
      cellRenderer: this.renderTitleLink,
      showTooltip: true
    },
    {
      field: 'owner',
      header: 'Country',
      icon: 'building',
      ...getUnifiedDataGridColumnWidth('pillText'),
      filterType: 'select',
      sortable: true,
      filterable: true,
      filterOptionsLoader: this.buildProjectFilterOptionsLoader('owner'),
      cellRenderer: (value, row) =>
        this.renderLookupPill(value, 'owner', this.owners, row.ownerId, 'pill', row, 'pill:owner')
    },
    {
      field: 'ownerType',
      header: 'City',
      icon: 'briefcase',
      ...getUnifiedDataGridColumnWidth('compactText'),
      filterType: 'select',
      sortable: true,
      filterable: true,
      filterOptionsLoader: this.buildProjectFilterOptionsLoader('ownerType'),
      cellRenderer: (value, row) =>
        this.renderLookupPill(
          value,
          'ownerType',
          this.ownerTypes,
          row.ownerTypeId,
          'pill pill-muted',
          row,
          'pill:owner-type'
        )
    },
    {
      field: 'deadline',
      header: 'Years of Experience',
      icon: 'hourglass-split',
      ...getUnifiedDataGridColumnWidth('shortText'),
      filterType: 'number',
      sortable: true,
      filterable: true,
      filterOptionsLoader: this.buildProjectFilterOptionsLoader('deadline'),
      format: (v: unknown) => String(v ?? '-')
    },
    {
      field: 'startDate',
      header: 'Company Type',
      icon: 'calendar-event',
      ...getUnifiedDataGridColumnWidth('shortText'),
      filterType: 'select',
      sortable: true,
      filterable: true,
      filterOptionsLoader: this.buildProjectFilterOptionsLoader('startDate'),
      format: (v: unknown) => String(v ?? '-')
    },
    {
      field: 'endDate',
      header: 'Work Mode',
      icon: 'calendar2-check',
      ...getUnifiedDataGridColumnWidth('shortText'),
      filterType: 'select',
      sortable: true,
      filterable: true,
      filterOptionsLoader: this.buildProjectFilterOptionsLoader('endDate'),
      format: (v: unknown) => String(v ?? '-')
    },
    {
      field: 'price',
      header: 'Monthly Net Salary',
      icon: 'cash-stack',
      ...getUnifiedDataGridColumnWidth('currency'),
      type: 'number',
      align: 'left',
      sortable: true,
      filterable: true,
      filterOptionsLoader: this.buildProjectFilterOptionsLoader('price'),
      cellRenderer: (v: unknown, row: TenderRow) => {
        const parsed = this.parseNumberOrNull(v);
        if (parsed == null) return '-';
        const rawCurrency = String(row.customLabel ?? '').trim().toUpperCase();
        const currency = /^[A-Z]{3}$/.test(rawCurrency) ? rawCurrency : 'EGP';
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
          maximumFractionDigits: 0
        }).format(parsed);
      }
    },
    {
      field: 'assignTo',
      header: 'Housing Provided',
      icon: 'person',
      ...getUnifiedDataGridColumnWidth('compactText'),
      filterType: 'select',
      sortable: true,
      filterable: true,
      filterOptionsLoader: this.buildProjectFilterOptionsLoader('assignTo'),
      cellRenderer: (value, row) =>
        this.renderLookupPill(
          value,
          'assignTo',
          this.assignToSettings,
          null,
          'pill',
          row,
          'pill:assign-to'
        )
    },
    {
      field: 'acceptDate',
      header: 'Transportation Provided',
      icon: 'calendar-check',
      ...getUnifiedDataGridColumnWidth('shortText'),
      filterType: 'select',
      sortable: true,
      filterable: true,
      filterOptionsLoader: this.buildProjectFilterOptionsLoader('acceptDate'),
      format: (v: unknown) => String(v ?? '-')
    },
    {
      field: 'status',
      header: 'Annual Bonus',
      icon: 'flag',
      ...getUnifiedDataGridColumnWidth('shortText'),
      filterType: 'select',
      sortable: true,
      filterable: true,
      filterOptionsLoader: this.buildProjectFilterOptionsLoader('status'),
      cellRenderer: this.renderStatusPill
    },
    {
      field: 'consultant',
      header: 'Salary Fairness',
      icon: 'briefcase',
      ...getUnifiedDataGridColumnWidth('mediumText'),
      filterType: 'select',
      sortable: true,
      filterable: true,
      filterOptionsLoader: this.buildProjectFilterOptionsLoader('consultant'),
    },
    {
      field: 'prb',
      header: 'Daily Work Hours',
      icon: 'percent',
      ...getUnifiedDataGridColumnWidth('narrowText'),
      sortable: true,
      filterable: true,
      filterOptionsLoader: this.buildProjectFilterOptionsLoader('prb'),
      format: (value: unknown) => {
        const parsed = this.parseNumberOrNull(value);
        return parsed != null ? String(parsed) : '-';
      },
      headerTooltip: 'Years of Experience'
    },
    {
      field: 'doi',
      header: 'Recommend This Field',
      icon: 'exclamation-circle',
      ...getUnifiedDataGridColumnWidth('shortText'),
      filterType: 'select',
      sortable: true,
      filterable: true,
      filterOptionsLoader: this.buildProjectFilterOptionsLoader('doi'),
      cellRenderer: (value, row) =>
        this.renderLookupPill(
          value,
          'importance',
          this.doi,
          row.degreeOfImportanceId,
          'pill',
          row,
          'pill:importance'
        ),
      headerTooltip: 'Work Mode'
    },
    {
      field: 'country',
      header: 'Professional Certificate',
      icon: 'geo-alt',
      ...getUnifiedDataGridColumnWidth('narrowText'),
      filterType: 'select',
      sortable: true,
      filterable: true,
      filterOptionsLoader: this.buildProjectFilterOptionsLoader('country'),
      cellRenderer: (value, row) =>
        this.renderLookupPill(
          value,
          'country',
          this.countries,
          row.countryId,
          'pill',
          row,
          'pill:country'
        )
    },
    {
      field: 'inCharge',
      header: 'Benefits',
      icon: 'person-badge',
      ...getUnifiedDataGridColumnWidth('compactText'),
      filterType: 'select',
      sortable: true,
      filterable: true,
      filterOptionsLoader: this.buildProjectFilterOptionsLoader('inCharge'),
      cellRenderer: (value, row) =>
        this.renderLookupPill(
          value,
          'inCharge',
          this.inChargeSettings,
          null,
          'pill',
          row,
          'pill:in-charge'
        )
    },
    {
      field: 'delayReasons',
      header: 'Highest Education',
      icon: 'hourglass-split',
      ...getUnifiedDataGridColumnWidth('wideText'),
      sortable: true,
      filterable: true,
      filterOptionsLoader: this.buildProjectFilterOptionsLoader('delayReasons'),
      showTooltip: true
    },
    {
      field: 'description',
      header: 'Negotiation Advice',
      icon: 'chat-text',
      ...getUnifiedDataGridColumnWidth('wideText'),
      sortable: true,
      filterable: true,
      filterOptionsLoader: this.buildProjectFilterOptionsLoader('description'),
      showTooltip: true
    },
    {
      field: 'createdAt',
      header: 'Additional Day Off',
      icon: 'calendar-plus',
      ...getUnifiedDataGridColumnWidth('compactText'),
      sortable: true,
      filterable: true,
      filterOptionsLoader: this.buildProjectFilterOptionsLoader('createdAt'),
      format: (value: unknown) => String(value ?? '-')
    }
  ];
}
