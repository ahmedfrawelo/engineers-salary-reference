import { Observable, from, of, throwError } from 'rxjs';
import { environment } from '../../../../../../environments/environment';
import { catchError, finalize, map, mergeMap, takeUntil, timeout } from 'rxjs/operators';

import { TenderRow } from './tender-project-details/project-details.component';
import {
  Activity,
  ActivityNotePayload
} from './tender-project-details/tabs/activity-tab.component';
import type { AuditTrail, CreateProjectCommentPayload } from './tender-projects.contracts';
import type { PendingProjectAudit, PendingProjectComment } from './tender-projects.types';
import { getProjectIdFromTenderRow } from './tender-projects.mapping.util';
import type {
  ActivityFeedRequestOptions,
  ProjectActivityFeedItem
} from '@features/tender/projects';

const ACTIVITY_VIEW_CACHE_KEY = 'engineers-salary-reference.project.activity.view';
const ACTIVITY_REQUEST_TIMEOUT_MS = 3_000;
const ACTIVITY_PREFETCH_ROW_LIMIT = 8;
const ACTIVITY_PREFETCH_CONCURRENCY = 4;

type ActivityCacheState = {
  loaded: boolean;
  complete: boolean;
  items: Activity[];
};

export interface TenderProjectsActivityHost {
  activities: Activity[];
  activityLoading: boolean;
  activityPrefetchInFlight: Set<number>;
  auditLoadToken: number;
  pendingSyncInFlight: boolean;
  lastPendingSync: number;
  pendingAuditSyncInFlight: boolean;
  lastPendingAuditSync: number;
  selectedRow: TenderRow | null;
  commentCacheKey: string;
  auditCacheKey: string;
  destroy$: { closed?: boolean };
  activityFeedApi: {
    getActivityFeed(
      projectId: number,
      options?: ActivityFeedRequestOptions
    ): Observable<ProjectActivityFeedItem[]>;
  };
  auditApi: {
    getAll(): Observable<AuditTrail[]>;
    getByEntityName(name: string): Observable<AuditTrail[]>;
  };
  auditWriteApi: {
    create(payload: AuditTrail): Observable<unknown>;
  };
  commentsApi: {
    create(payload: CreateProjectCommentPayload): Observable<unknown>;
  };
  auditHelper: {
    formatRelativeTime(date: Date): string;
    stripMentions(value: string): string;
    getAuditEntityNames(): string[];
    mapAuditToActivity(item: AuditTrail, row: TenderRow): Activity | null;
    groupActivities(items: Activity[]): Activity[];
    dedupeAudit(items: AuditTrail[]): AuditTrail[];
    resolveAuditEntityId(item: AuditTrail): number | null;
    auditTextHaystack(item: AuditTrail): string;
    parseAuditDate(item: AuditTrail): Date | null;
  };
  auditTimeFormatter: {
    format(date: Date): string;
  };
  cdr: {
    markForCheck(): void;
  };
  parseId(value: unknown): number | null;
  normalizeLabel(value: unknown): string | null;
  scopedStorageKey(key: string): string;
  toast(msg: string, kind?: 'info' | 'error' | 'success', ttlMs?: number): void;
}

export function onAddTenderProjectNote(
  self: TenderProjectsActivityHost,
  payload: ActivityNotePayload
): void {
  const text = payload?.text?.trim() ?? '';
  if (!text) return;
  const now = new Date();
  const when = self.auditHelper.formatRelativeTime(now);
  const mentionSig = (payload?.handles ?? [])
    .map(handle => handle.trim().toLowerCase())
    .filter(Boolean)
    .join('|');
  const cleaned = self.auditHelper.stripMentions(text);
  self.activities = [
    {
      when,
      title: 'Comment',
      detail: text,
      tone: 'info',
      icon: 'chat-right-text',
      kind: 'note',
      actor: 'You',
      at: now.getTime(),
      fullTime: self.auditTimeFormatter.format(now),
      signature: `note:${cleaned.toLowerCase()}${mentionSig ? `|${mentionSig}` : ''}`
    },
    ...self.activities
  ];

  const row = self.selectedRow;
  const projectId = getProjectIdFromTenderRow(row, value => self.parseId(value));
  if (projectId) {
    writeCachedTenderProjectActivities(self, projectId, self.activities);
  }
  if (!projectId) return;

  const commentPayload: CreateProjectCommentPayload = {
    projectId,
    message: text,
    mentions: (payload?.mentions ?? []).map(mention => ({
      id: mention.id,
      name: mention.name,
      email: mention.email,
      handle: mention.handle
    })),
    entityName: 'Project',
    entityId: projectId,
    projectTitle: row?.title ?? null
  };

  const pendingId = addPendingTenderProjectComment(self, commentPayload);
  self.commentsApi.create(commentPayload).subscribe({
    next: () => {
      removePendingTenderProjectComment(self, pendingId);
      const currentId = getProjectIdFromTenderRow(self.selectedRow, value => self.parseId(value));
      if (currentId && currentId === projectId && self.selectedRow) {
        loadTenderProjectAuditForRow(self, self.selectedRow);
      }
    },
    error: err => {
      if (environment.enableDebugLogs) console.error('[Comments] Failed to save comment', err);
      self.toast('Saved locally. Will sync when backend is ready.', 'info', 6000);
    }
  });
}

export function readPendingTenderProjectComments(
  self: TenderProjectsActivityHost
): PendingProjectComment[] {
  try {
    const raw = localStorage.getItem(self.scopedStorageKey(self.commentCacheKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function writePendingTenderProjectComments(
  self: TenderProjectsActivityHost,
  items: PendingProjectComment[]
): void {
  try {
    localStorage.setItem(self.scopedStorageKey(self.commentCacheKey), JSON.stringify(items));
  } catch {
    // ignore storage failures
  }
}

export function readPendingTenderProjectAudits(
  self: TenderProjectsActivityHost
): PendingProjectAudit[] {
  try {
    const raw = localStorage.getItem(self.scopedStorageKey(self.auditCacheKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function writePendingTenderProjectAudits(
  self: TenderProjectsActivityHost,
  items: PendingProjectAudit[]
): void {
  try {
    localStorage.setItem(self.scopedStorageKey(self.auditCacheKey), JSON.stringify(items));
  } catch {
    // ignore storage failures
  }
}

export function addPendingTenderProjectComment(
  self: TenderProjectsActivityHost,
  payload: CreateProjectCommentPayload
): string {
  const entry: PendingProjectComment = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    payload,
    createdAt: new Date().toISOString()
  };
  const items = readPendingTenderProjectComments(self);
  items.push(entry);
  writePendingTenderProjectComments(self, items);
  return entry.id;
}

export function addPendingTenderProjectAudit(
  self: TenderProjectsActivityHost,
  payload: AuditTrail
): string {
  const createdAt =
    self.normalizeLabel(payload.createdAt ?? payload.createdOn ?? payload.timestamp) ??
    new Date().toISOString();
  const entry: PendingProjectAudit = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    payload: {
      ...payload,
      createdAt,
      createdOn: self.normalizeLabel(payload.createdOn) ?? createdAt,
      timestamp: self.normalizeLabel(payload.timestamp) ?? createdAt
    },
    createdAt
  };
  const items = readPendingTenderProjectAudits(self);
  items.push(entry);
  writePendingTenderProjectAudits(self, items);
  return entry.id;
}

export function removePendingTenderProjectComment(
  self: TenderProjectsActivityHost,
  id: string
): void {
  if (!id) return;
  const items = readPendingTenderProjectComments(self);
  const next = items.filter(item => item.id !== id);
  if (next.length !== items.length) {
    writePendingTenderProjectComments(self, next);
  }
}

export function removePendingTenderProjectAudit(
  self: TenderProjectsActivityHost,
  id: string
): void {
  if (!id) return;
  const items = readPendingTenderProjectAudits(self);
  const next = items.filter(item => item.id !== id);
  if (next.length !== items.length) {
    writePendingTenderProjectAudits(self, next);
  }
}

export function syncPendingTenderProjectComments(
  self: TenderProjectsActivityHost,
  projectId?: number
): void {
  const now = Date.now();
  if (self.pendingSyncInFlight) return;
  if (now - self.lastPendingSync < 5000) return;
  const items = readPendingTenderProjectComments(self);
  if (!items.length) return;
  const target = projectId ? items.filter(item => item.payload.projectId === projectId) : items;
  if (!target.length) return;
  self.pendingSyncInFlight = true;
  self.lastPendingSync = now;
  from(target)
    .pipe(
      mergeMap(
        item =>
          self.commentsApi.create(item.payload).pipe(
            map(() => item.id),
            catchError(() => of(null))
          ),
        1
      ),
      takeUntil(self.destroy$ as never)
    )
    .subscribe({
      next: id => {
        if (id) removePendingTenderProjectComment(self, id);
      },
      error: () => {
        self.pendingSyncInFlight = false;
      },
      complete: () => {
        self.pendingSyncInFlight = false;
      }
    });
}

function pendingTenderProjectAuditEntityId(
  self: TenderProjectsActivityHost,
  payload: AuditTrail | null | undefined
): number | null {
  if (!payload) return null;
  const record = payload as Record<string, unknown>;
  return (
    self.auditHelper.resolveAuditEntityId(payload) ??
    self.parseId(record['projectId'] ?? record['recordId'] ?? record['targetId'])
  );
}

export function syncPendingTenderProjectAudits(
  self: TenderProjectsActivityHost,
  projectId?: number
): void {
  const now = Date.now();
  if (self.pendingAuditSyncInFlight) return;
  if (now - self.lastPendingAuditSync < 5000) return;
  const items = readPendingTenderProjectAudits(self);
  if (!items.length) return;
  const target = projectId
    ? items.filter(item => pendingTenderProjectAuditEntityId(self, item.payload) === projectId)
    : items;
  if (!target.length) return;
  self.pendingAuditSyncInFlight = true;
  self.lastPendingAuditSync = now;
  from(target)
    .pipe(
      mergeMap(
        item =>
          self.auditWriteApi.create(item.payload).pipe(
            map(() => item.id),
            catchError(() => of(null))
          ),
        1
      ),
      takeUntil(self.destroy$ as never)
    )
    .subscribe({
      next: id => {
        if (id) removePendingTenderProjectAudit(self, id);
      },
      error: () => {
        self.pendingAuditSyncInFlight = false;
      },
      complete: () => {
        self.pendingAuditSyncInFlight = false;
      }
    });
}

export function recordTenderProjectAudit(
  self: TenderProjectsActivityHost,
  payload: AuditTrail
): void {
  const projectId = pendingTenderProjectAuditEntityId(self, payload);
  if (!projectId) return;

  const nowIso = new Date().toISOString();
  const actor = self.normalizeLabel(
    payload.userName ?? payload.user ?? payload.performedBy ?? payload.createdBy
  );
  const normalized: AuditTrail = {
    ...payload,
    entityName: self.normalizeLabel(payload.entityName) ?? 'Projects',
    entityId: projectId,
    createdAt: self.normalizeLabel(payload.createdAt) ?? nowIso,
    createdOn:
      self.normalizeLabel(payload.createdOn) ?? self.normalizeLabel(payload.createdAt) ?? nowIso,
    timestamp:
      self.normalizeLabel(payload.timestamp) ??
      self.normalizeLabel(payload.createdAt) ??
      self.normalizeLabel(payload.createdOn) ??
      nowIso,
    userName: actor ?? payload.userName ?? undefined,
    performedBy: actor ?? payload.performedBy ?? undefined,
    createdBy: actor ?? payload.createdBy ?? undefined
  };
  (normalized as Record<string, unknown>)['projectId'] = projectId;

  const pendingId = addPendingTenderProjectAudit(self, normalized);
  const activeProjectId = getProjectIdFromTenderRow(self.selectedRow, value => self.parseId(value));
  if (activeProjectId && activeProjectId === projectId && self.selectedRow) {
    const activity = mapPendingTenderProjectAuditActivity(
      self,
      { id: pendingId, payload: normalized, createdAt: String(normalized.createdAt ?? nowIso) },
      self.selectedRow
    );
    if (activity) {
      applyTenderProjectActivities(self, projectId, [activity, ...self.activities]);
      self.cdr.markForCheck();
    }
  }

  self.lastPendingAuditSync = Date.now();
  self.auditWriteApi
    .create(normalized)
    .pipe(takeUntil(self.destroy$ as never))
    .subscribe({
      next: () => {
        removePendingTenderProjectAudit(self, pendingId);
        const currentId = getProjectIdFromTenderRow(self.selectedRow, value => self.parseId(value));
        if (currentId && currentId === projectId && self.selectedRow) {
          loadTenderProjectAuditForRow(self, self.selectedRow);
        }
      },
      error: err => {
        if (environment.enableDebugLogs)
          console.warn('[Audit] Failed to persist project activity entry', err);
      }
    });
}

export function pendingTenderProjectActivities(
  self: TenderProjectsActivityHost,
  projectId: number,
  row?: TenderRow | null
): Activity[] {
  if (!projectId) return [];
  const pendingComments = readPendingTenderProjectComments(self)
    .filter(item => item.payload?.projectId === projectId)
    .sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return tb - ta;
    });
  const pendingAudits = readPendingTenderProjectAudits(self)
    .filter(item => pendingTenderProjectAuditEntityId(self, item.payload) === projectId)
    .sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return tb - ta;
    });
  const auditActivities = pendingAudits
    .map(item => mapPendingTenderProjectAuditActivity(self, item, row ?? self.selectedRow))
    .filter((item): item is Activity => Boolean(item));
  const commentActivities = pendingComments.map(item =>
    mapPendingTenderProjectActivity(self, item)
  );
  return [...auditActivities, ...commentActivities].sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
}

export function mapPendingTenderProjectActivity(
  self: TenderProjectsActivityHost,
  item: PendingProjectComment
): Activity {
  const date = new Date(item.createdAt);
  const time = Number.isNaN(date.getTime()) ? new Date() : date;
  return {
    when: self.auditHelper.formatRelativeTime(time),
    title: 'Comment',
    detail: item.payload?.message ?? '',
    tone: 'info',
    icon: 'chat-right-text',
    kind: 'note',
    actor: 'You',
    at: time.getTime(),
    fullTime: self.auditTimeFormatter.format(time),
    signature: `pending:${item.id}`
  };
}

export function mapPendingTenderProjectAuditActivity(
  self: TenderProjectsActivityHost,
  item: PendingProjectAudit,
  row?: TenderRow | null
): Activity | null {
  if (!row) return null;
  return self.auditHelper.mapAuditToActivity(item.payload, row);
}

function activityCacheStorageKey(self: TenderProjectsActivityHost, projectId: number): string {
  return self.scopedStorageKey(`${ACTIVITY_VIEW_CACHE_KEY}:${projectId}`);
}

function readCachedTenderProjectActivities(
  self: TenderProjectsActivityHost,
  projectId: number
): ActivityCacheState {
  if (!projectId) return { loaded: false, complete: false, items: [] };
  try {
    const raw = localStorage.getItem(activityCacheStorageKey(self, projectId));
    if (!raw) return { loaded: false, complete: false, items: [] };
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return { loaded: true, complete: true, items: parsed.filter(Boolean) };
    }
    if (parsed && typeof parsed === 'object') {
      const record = parsed as { items?: unknown; loaded?: unknown; complete?: unknown };
      const items = Array.isArray(record.items) ? record.items.filter(Boolean) : [];
      return {
        loaded: record.loaded !== false,
        complete: record.complete !== false,
        items
      };
    }
    return { loaded: false, complete: false, items: [] };
  } catch {
    return { loaded: false, complete: false, items: [] };
  }
}

function writeCachedTenderProjectActivities(
  self: TenderProjectsActivityHost,
  projectId: number,
  items: Activity[],
  loaded = true,
  complete = true
): void {
  if (!projectId) return;
  try {
    localStorage.setItem(
      activityCacheStorageKey(self, projectId),
      JSON.stringify({
        loaded,
        complete,
        items: (items ?? []).slice(0, 250)
      })
    );
  } catch {
    // ignore storage failures
  }
}

function applyTenderProjectActivities(
  self: TenderProjectsActivityHost,
  projectId: number,
  activities: Activity[],
  complete = true
): void {
  const grouped = self.auditHelper.groupActivities(activities ?? []);
  self.activities = grouped;
  writeCachedTenderProjectActivities(self, projectId, grouped, true, complete);
}

export function seedTenderProjectActivityFeedCache(
  self: TenderProjectsActivityHost,
  projectId: number,
  row: TenderRow,
  items: ProjectActivityFeedItem[],
  complete = false
): void {
  const mapped = (items ?? [])
    .map(item => self.auditHelper.mapAuditToActivity(mapFeedItemsToAuditTrails([item])[0], row))
    .filter((activity): activity is Activity => Boolean(activity));
  const pending = pendingTenderProjectActivities(self, projectId, row);
  const merged = pending.length ? [...pending, ...mapped] : mapped;
  const grouped = self.auditHelper.groupActivities(merged);
  writeCachedTenderProjectActivities(self, projectId, grouped, true, complete);

  const activeProjectId = getProjectIdFromTenderRow(self.selectedRow, value => self.parseId(value));
  if (activeProjectId === projectId) {
    self.activities = grouped;
    self.cdr.markForCheck();
  }
}

export function restoreTenderProjectActivityFromCache(
  self: TenderProjectsActivityHost,
  projectId: number,
  row: TenderRow | null
): void {
  if (!projectId || !row) {
    self.activities = [];
    self.activityLoading = false;
    self.cdr.markForCheck();
    return;
  }

  const pending = pendingTenderProjectActivities(self, projectId, row);
  const cached = readCachedTenderProjectActivities(self, projectId);
  const merged = pending.length ? [...pending, ...cached.items] : cached.items;

  if (pending.length || cached.loaded) {
    applyTenderProjectActivities(self, projectId, merged, cached.complete);
  } else {
    self.activities = [];
  }

  self.activityLoading = false;
  self.cdr.markForCheck();
}

function buildTenderProjectActivityRequest(
  self: TenderProjectsActivityHost,
  projectId: number,
  options?: {
    includeSupplemental?: boolean;
  }
): Observable<AuditTrail[]> {
  const includeSupplemental = options?.includeSupplemental ?? true;

  try {
    const getActivityFeed = self.activityFeedApi?.getActivityFeed;
    return typeof getActivityFeed === 'function'
      ? getActivityFeed.call(self.activityFeedApi, projectId, { includeSupplemental }).pipe(
          timeout(ACTIVITY_REQUEST_TIMEOUT_MS),
          map(items => mapFeedItemsToAuditTrails(items))
        )
      : throwError(() => new Error('Project activity endpoint is unavailable.'));
  } catch (err) {
    if (environment.enableDebugLogs)
      console.error('[Audit] Failed to initialize activity request:', err);
    return throwError(() => err);
  }
}

export function primeTenderProjectActivityForRow(
  self: TenderProjectsActivityHost,
  row: TenderRow | null
): Observable<void> {
  if (!row) return of(void 0);
  const projectId = getProjectIdFromTenderRow(row, value => self.parseId(value));
  if (!projectId) return of(void 0);

  const cached = readCachedTenderProjectActivities(self, projectId);
  if (cached.loaded) {
    return of(void 0);
  }

  return buildTenderProjectActivityRequest(self, projectId, {
    includeSupplemental: false
  }).pipe(
    map(items => {
      const mapped = items
        .map(item => self.auditHelper.mapAuditToActivity(item, row))
        .filter((item): item is Activity => Boolean(item));
      const pending = pendingTenderProjectActivities(self, projectId, row);
      const merged = pending.length ? [...pending, ...mapped] : mapped;
      writeCachedTenderProjectActivities(
        self,
        projectId,
        self.auditHelper.groupActivities(merged),
        true,
        false
      );
      return void 0;
    }),
    catchError(err => {
      if (environment.enableDebugLogs)
        console.warn('[Audit] Failed to prime activity cache for project panel.', err);
      writeCachedTenderProjectActivities(self, projectId, [], true, false);
      return of(void 0);
    })
  );
}

function beginTenderProjectActivityPrefetch(
  self: TenderProjectsActivityHost,
  row: TenderRow | null
): Observable<void> {
  if (!row) return of(void 0);
  const projectId = getProjectIdFromTenderRow(row, value => self.parseId(value));
  if (!projectId) return of(void 0);

  const cached = readCachedTenderProjectActivities(self, projectId);
  if (cached.loaded || self.activityPrefetchInFlight.has(projectId)) {
    return of(void 0);
  }

  self.activityPrefetchInFlight.add(projectId);
  return primeTenderProjectActivityForRow(self, row).pipe(
    finalize(() => {
      self.activityPrefetchInFlight.delete(projectId);
    })
  );
}

export function prefetchTenderProjectActivityForRow(
  self: TenderProjectsActivityHost,
  row: TenderRow | null
): void {
  beginTenderProjectActivityPrefetch(self, row)
    .pipe(takeUntil(self.destroy$ as never))
    .subscribe({
      error: err => {
        if (environment.enableDebugLogs)
          console.warn('[Audit] Failed to prefetch activity for project row.', err);
      }
    });
}

export function prefetchTenderProjectActivityForRows(
  self: TenderProjectsActivityHost,
  rows: readonly TenderRow[] | null | undefined,
  limit = ACTIVITY_PREFETCH_ROW_LIMIT
): void {
  if (!Array.isArray(rows) || !rows.length || limit <= 0) {
    return;
  }

  const candidates: TenderRow[] = [];
  const seenProjectIds = new Set<number>();
  for (const row of rows) {
    const projectId = getProjectIdFromTenderRow(row, value => self.parseId(value));
    if (!projectId || seenProjectIds.has(projectId)) {
      continue;
    }
    seenProjectIds.add(projectId);
    candidates.push(row);
    if (candidates.length >= limit) {
      break;
    }
  }

  if (!candidates.length) {
    return;
  }

  from(candidates)
    .pipe(
      mergeMap(row => beginTenderProjectActivityPrefetch(self, row), ACTIVITY_PREFETCH_CONCURRENCY),
      takeUntil(self.destroy$ as never)
    )
    .subscribe({
      error: err => {
        if (environment.enableDebugLogs)
          console.warn('[Audit] Failed to prefetch activity for visible project rows.', err);
      }
    });
}

function hydrateTenderProjectActivityHistory(
  self: TenderProjectsActivityHost,
  projectId: number,
  row: TenderRow,
  token: number
): void {
  buildTenderProjectActivityRequest(self, projectId, {
    includeSupplemental: true
  })
    .pipe(takeUntil(self.destroy$ as never))
    .subscribe({
      next: items => {
        if (token !== self.auditLoadToken) return;
        try {
          const mapped = items
            .map(item => self.auditHelper.mapAuditToActivity(item, row))
            .filter((item): item is Activity => Boolean(item));
          const currentPending = pendingTenderProjectActivities(self, projectId, row);
          const merged = currentPending.length ? [...currentPending, ...mapped] : mapped;
          applyTenderProjectActivities(self, projectId, merged, true);
          self.cdr.markForCheck();
        } catch (err) {
          if (environment.enableDebugLogs)
            console.error('[Audit] Failed to hydrate full activity history:', err);
        }
      },
      error: err => {
        if (token !== self.auditLoadToken) return;
        if (environment.enableDebugLogs)
          console.warn('[Audit] Full activity history hydration failed.', err);
      }
    });
}

export function loadTenderProjectAuditForRow(
  self: TenderProjectsActivityHost,
  row: TenderRow | null
): void {
  if (!row) {
    self.activities = [];
    self.activityLoading = false;
    return;
  }
  const projectId = getProjectIdFromTenderRow(row, value => self.parseId(value));
  if (!projectId) {
    self.activities = [];
    self.activityLoading = false;
    return;
  }
  syncPendingTenderProjectComments(self, projectId);
  syncPendingTenderProjectAudits(self, projectId);

  const pending = pendingTenderProjectActivities(self, projectId, row);
  const cached = readCachedTenderProjectActivities(self, projectId);
  const hasVisibleActivities = pending.length > 0 || cached.items.length > 0;
  const hasResolvedInitialState = pending.length > 0 || cached.loaded;
  if (hasVisibleActivities) {
    applyTenderProjectActivities(
      self,
      projectId,
      pending.length ? [...pending, ...cached.items] : cached.items
    );
  } else if (hasResolvedInitialState) {
    applyTenderProjectActivities(self, projectId, pending);
  } else {
    self.activities = [];
  }

  const token = ++self.auditLoadToken;
  self.activityLoading = !hasResolvedInitialState;
  self.cdr.markForCheck();
  buildTenderProjectActivityRequest(self, projectId, {
    includeSupplemental: false
  })
    .pipe(
      takeUntil(self.destroy$ as never),
      finalize(() => {
        if (token !== self.auditLoadToken) return;
        self.activityLoading = false;
        self.cdr.markForCheck();
      })
    )
    .subscribe({
      next: items => {
        if (token !== self.auditLoadToken) return;
        try {
          const mapped = items
            .map(item => self.auditHelper.mapAuditToActivity(item, row))
            .filter((item): item is Activity => Boolean(item));
          const currentPending = pendingTenderProjectActivities(self, projectId, row);
          const baseMerged = currentPending.length ? [...currentPending, ...mapped] : mapped;
          const merged =
            cached.complete && cached.items.length ? [...baseMerged, ...cached.items] : baseMerged;
          applyTenderProjectActivities(self, projectId, merged, cached.complete);
          hydrateTenderProjectActivityHistory(self, projectId, row, token);
        } catch (err) {
          self.activities = hasVisibleActivities ? self.activities : [];
          if (environment.enableDebugLogs)
            console.error('[Audit] Failed to render activity feed:', err);
          self.toast('Failed to load activity', 'error', 6000);
        }
        self.cdr.markForCheck();
      },
      error: err => {
        if (token !== self.auditLoadToken) return;
        if (!hasResolvedInitialState) {
          applyTenderProjectActivities(self, projectId, pending, false);
        }
        self.activityLoading = false;
        if (environment.enableDebugLogs) console.error('[Audit] Failed to load activity:', err);
        self.toast('Failed to load activity', 'error', 6000);
        self.cdr.markForCheck();
      }
    });
}

function mapFeedItemsToAuditTrails(items: ProjectActivityFeedItem[]): AuditTrail[] {
  return items.map(item => {
    const isComment = item.type === 1 || item.type === 'Comment';
    const trail: AuditTrail = {
      id: item.id,
      entityName: item.entityType,
      entityId: item.entityId,
      createdAt: item.createdAt,
      userName: item.createdByUserName,
      user: item.createdByUserName,
      performedBy: item.createdByUserName,
      actionType: isComment ? 'Comment' : (item.actionType ?? undefined)
    };
    if (isComment) {
      trail['message'] = item.body ?? undefined;
      trail['body'] = item.body ?? undefined;
      if (item.hasMentions) trail['mentions'] = item.mentionedUserNames;
    } else {
      if (item.changes?.length) {
        // Multiple field changes — feed to extractAuditChanges via 'changes' key
        trail['changes'] = item.changes.map(c => ({
          field: c.field,
          oldValue: c.oldValue ?? undefined,
          newValue: c.newValue ?? undefined
        }));
      } else {
        trail['fieldName'] = item.fieldName ?? undefined;
        trail['oldValue'] = item.oldValue ?? undefined;
        trail['newValue'] = item.newValue ?? undefined;
      }
    }
    return trail;
  });
}
