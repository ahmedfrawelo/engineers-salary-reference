import type { TenderRow } from './tender-project-details/project-details.component';
import { broadcastTenderProjectsSync } from './tender-projects.presenter.logic';
import { environment } from '../../../../../../environments/environment';

type GridLike = {
  onPageChange(page: number): void;
};

type ChangeDetectorLike = {
  markForCheck(): void;
};

export interface TenderProjectsPinningHost {
  NEWLY_CREATED_ROW_PIN_MS: number;
  newlyCreatedRowKey: string | null;
  newlyCreatedRowPinUntil: number;
  grid?: GridLike | null;
  cdr: ChangeDetectorLike;
  getRowKeyValue(row: TenderRow, label?: string): string | null;
}

export interface TenderProjectsSyncHost {
  isBrowser: boolean;
  PROJECTS_REFRESH_BROADCAST_KEY: string;
  LOOKUPS_REFRESH_BROADCAST_KEY: string;
  PROJECTS_SYNC_CHANNEL_NAME: string;
  projectsSyncChannel: BroadcastChannel | null;
  syncClientId: string;
  scopedStorageKey(key: string): string;
  handleIncomingProjectsSync(kind: 'projects' | 'lookups'): void;
}

export function markTenderProjectsRowForVisualConfirm(
  host: TenderProjectsPinningHost,
  row: TenderRow
): void {
  const key = host.getRowKeyValue(row);
  if (!key) return;
  host.newlyCreatedRowKey = key;
  host.newlyCreatedRowPinUntil = Date.now() + host.NEWLY_CREATED_ROW_PIN_MS;
}

export function pinTenderProjectsNewRowToTop(
  host: TenderProjectsPinningHost,
  rows: TenderRow[]
): TenderRow[] {
  if (!rows?.length || !host.newlyCreatedRowKey) return rows;
  if (Date.now() > host.newlyCreatedRowPinUntil) {
    host.newlyCreatedRowKey = null;
    host.newlyCreatedRowPinUntil = 0;
    return rows;
  }
  const index = rows.findIndex(row => host.getRowKeyValue(row) === host.newlyCreatedRowKey);
  if (index <= 0) return rows;
  const next = [...rows];
  const [item] = next.splice(index, 1);
  next.unshift(item);
  return next;
}

export function showTenderProjectsNewRowAtTop(host: TenderProjectsPinningHost): void {
  host.grid?.onPageChange(1);
  host.cdr.markForCheck();
}

export function tenderProjectsRefreshStorageKey(host: TenderProjectsSyncHost): string {
  return host.scopedStorageKey(host.PROJECTS_REFRESH_BROADCAST_KEY);
}

export function tenderProjectsLookupsRefreshStorageKey(host: TenderProjectsSyncHost): string {
  return host.scopedStorageKey(host.LOOKUPS_REFRESH_BROADCAST_KEY);
}

export function tenderProjectsSyncScope(host: TenderProjectsSyncHost): string {
  return host.scopedStorageKey(host.PROJECTS_SYNC_CHANNEL_NAME);
}

export function initTenderProjectsSyncChannel(host: TenderProjectsSyncHost): void {
  if (!host.isBrowser || typeof BroadcastChannel === 'undefined' || host.projectsSyncChannel)
    return;
  try {
    host.projectsSyncChannel = new BroadcastChannel(host.PROJECTS_SYNC_CHANNEL_NAME);
    host.projectsSyncChannel.onmessage = event => {
      const data = event?.data as
        | { kind?: 'projects' | 'lookups'; sourceId?: string; scope?: string }
        | undefined;
      if (
        !data?.kind ||
        (data.scope && data.scope !== tenderProjectsSyncScope(host)) ||
        (data.sourceId && data.sourceId === host.syncClientId)
      ) {
        return;
      }
      host.handleIncomingProjectsSync(data.kind);
    };
  } catch (err) {
    if (environment.enableDebugLogs) {
      console.warn(
        '[TenderProjects] BroadcastChannel init failed, using storage fallback only.',
        err
      );
    }
    host.projectsSyncChannel = null;
  }
}

export function destroyTenderProjectsSyncChannel(host: TenderProjectsSyncHost): void {
  if (!host.projectsSyncChannel) return;
  try {
    host.projectsSyncChannel.close();
  } catch {
    // ignore channel close errors
  }
  host.projectsSyncChannel = null;
}

export function broadcastTenderProjectsRefreshSignal(
  host: TenderProjectsSyncHost,
  reason: string
): void {
  broadcastTenderProjectsSync('projects', reason, {
    isBrowser: host.isBrowser,
    channel: host.projectsSyncChannel,
    scope: tenderProjectsSyncScope(host),
    sourceId: host.syncClientId,
    storageKey: tenderProjectsRefreshStorageKey(host)
  });
}

export function broadcastTenderProjectLookupsRefreshSignal(
  host: TenderProjectsSyncHost,
  reason: string
): void {
  broadcastTenderProjectsSync('lookups', reason, {
    isBrowser: host.isBrowser,
    channel: host.projectsSyncChannel,
    scope: tenderProjectsSyncScope(host),
    sourceId: host.syncClientId,
    storageKey: tenderProjectsLookupsRefreshStorageKey(host)
  });
}
