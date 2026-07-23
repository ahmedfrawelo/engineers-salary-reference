import {
  extractRealtimeEvent,
  isTenderProjectsRealtimeEvent
} from './tender-projects.realtime-events';
import { extractTenderProjectsRealtimeProjectIdFromCandidate } from './tender-projects.realtime.util';

type IntervalHandle = ReturnType<typeof setInterval> | null;

export interface TenderProjectsAutoRefreshHost {
  isBrowser: boolean;
  pageBootstrapPending: boolean;
  PROJECTS_AUTO_REFRESH_MS: number;
  PROJECTS_REFRESH_MIN_INTERVAL_MS: number;
  refreshLookupsOnAutoRefresh: boolean;
  selectedRows: unknown[];
  deferredProjectsRefreshWhileBusy: boolean;
  projectsAutoRefreshTimer: IntervalHandle;
  projectsPrimaryFetchInFlight: boolean;
  queuedProjectsRefresh: boolean;
  projectsAutoRefreshBackoffUntil: number;
  lastProjectsRefreshTriggerAt: number;
  fetchToken: number;
  showAdd: boolean;
  showDetails: boolean;
  showSettings: boolean;
  deleteDialogOpen: boolean;
  doc: Document;
  loadLookups(): Promise<void>;
  fetchProjects(): void;
}

export function startTenderProjectsAutoRefresh(host: TenderProjectsAutoRefreshHost): void {
  if (!host.isBrowser || host.projectsAutoRefreshTimer != null) {
    return;
  }
  host.projectsAutoRefreshTimer = setInterval(() => {
    tryTenderProjectsAutoRefresh(host);
  }, host.PROJECTS_AUTO_REFRESH_MS);
}

export function stopTenderProjectsAutoRefresh(host: TenderProjectsAutoRefreshHost): void {
  if (host.projectsAutoRefreshTimer == null) {
    return;
  }
  clearInterval(host.projectsAutoRefreshTimer);
  host.projectsAutoRefreshTimer = null;
}

export function tryTenderProjectsAutoRefresh(
  host: TenderProjectsAutoRefreshHost,
  force = false
): void {
  if (!host.isBrowser) {
    return;
  }
  if (host.pageBootstrapPending) {
    host.deferredProjectsRefreshWhileBusy = true;
    return;
  }
  if (host.selectedRows.length > 0) {
    host.deferredProjectsRefreshWhileBusy = true;
    return;
  }
  if (!force && typeof navigator !== 'undefined' && navigator.onLine === false) {
    host.deferredProjectsRefreshWhileBusy = true;
    return;
  }
  if (host.doc.visibilityState === 'hidden') {
    return;
  }
  if (host.showAdd || host.showDetails || host.showSettings || host.deleteDialogOpen) {
    host.deferredProjectsRefreshWhileBusy = true;
    return;
  }
  if (host.projectsPrimaryFetchInFlight) {
    host.queuedProjectsRefresh = true;
    return;
  }
  const now = Date.now();
  if (!force && now < host.projectsAutoRefreshBackoffUntil) {
    return;
  }
  if (!force && now - host.lastProjectsRefreshTriggerAt < host.PROJECTS_REFRESH_MIN_INTERVAL_MS) {
    return;
  }
  host.lastProjectsRefreshTriggerAt = now;
  if (host.refreshLookupsOnAutoRefresh) {
    void host.loadLookups();
  }
  host.fetchProjects();
}

export function flushDeferredTenderProjectsRefresh(host: TenderProjectsAutoRefreshHost): void {
  if (!host.deferredProjectsRefreshWhileBusy) return;
  host.deferredProjectsRefreshWhileBusy = false;
  tryTenderProjectsAutoRefresh(host, true);
}

export function finishTenderProjectsPrimaryFetch(
  host: TenderProjectsAutoRefreshHost,
  requestToken: number
): void {
  if (requestToken !== host.fetchToken) return;
  host.projectsPrimaryFetchInFlight = false;
  if (!host.queuedProjectsRefresh) return;
  host.queuedProjectsRefresh = false;
  tryTenderProjectsAutoRefresh(host, true);
}

export function shouldRefreshTenderProjectsFromRealtimeMessage(message: unknown): boolean {
  return isTenderProjectsRealtimeEvent(extractRealtimeEvent(message));
}

export function extractTenderProjectsRealtimeProjectId(message: unknown): number | null {
  const event = extractRealtimeEvent(message);
  return extractTenderProjectsRealtimeProjectIdFromCandidate(event);
}
