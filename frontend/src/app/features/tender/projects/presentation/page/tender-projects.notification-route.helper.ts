import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject, firstValueFrom } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import type { ProjectDetailsResponse } from '@features/tender/projects';
import type { TenderProject } from './tender-projects.contracts';
import type { TenderRow } from './tender-project-details/project-details.component';

export type ProjectNotificationRouteIntent = {
  panel: 'details' | null;
  projectId: number | null;
  section?: ProjectNotificationFocusSection | null;
  commentId?: number | null;
  checklistId?: number | null;
};

export type ProjectNotificationFocusSection =
  | 'overview'
  | 'description'
  | 'delay-reason'
  | 'checklists'
  | 'attachments'
  | 'activity';

export type ProjectNotificationFocus = {
  section: ProjectNotificationFocusSection | null;
  commentId: number | null;
  checklistId: number | null;
};

export interface TenderProjectsNotificationRouteHost {
  readonly route: ActivatedRoute;
  readonly router: Router;
  readonly destroy$: Subject<void>;
  readonly showDetails: boolean;
  pendingProjectNotificationRouteIntent: ProjectNotificationRouteIntent | null;
  projectRouteSyncInFlight: boolean;
  projectRouteNavigationInFlight: boolean;
  closeOverlay(syncRoute?: boolean): void;
  findRowByProjectId(projectId: number): TenderRow | null;
  openProjectDetailsPanel(
    row: TenderRow,
    options?: {
      syncRoute?: boolean;
      prefetchedDetails?: ProjectDetailsResponse | null;
      notificationFocus?: ProjectNotificationFocus | null;
    }
  ): void;
  projectsFacade: {
    api: {
      getDetails(
        projectId: number,
        options: {
          includeActivity: boolean;
          includeSupplementalActivity: boolean;
        }
      ): Observable<ProjectDetailsResponse | null>;
    };
  };
  mapToRow(project: TenderProject): TenderRow;
}

export function subscribeTenderProjectsNotificationRoute(
  host: TenderProjectsNotificationRouteHost
): void {
  host.route.queryParamMap.pipe(takeUntil(host.destroy$)).subscribe(params => {
    if (host.projectRouteNavigationInFlight) {
      return;
    }

    const intent = readProjectNotificationRouteIntent({
      panel: params.get('panel'),
      projectId: params.get('projectId'),
      section: params.get('section') ?? params.get('focus'),
      commentId: params.get('commentId'),
      checklistId: params.get('checklistId')
    });

    if (!intent.panel || !intent.projectId) {
      host.pendingProjectNotificationRouteIntent = null;
      if (host.showDetails) {
        host.closeOverlay(false);
      }
      return;
    }

    host.pendingProjectNotificationRouteIntent = intent;
    void flushTenderProjectsNotificationRouteIntent(host);
  });
}

export async function flushTenderProjectsNotificationRouteIntent(
  host: TenderProjectsNotificationRouteHost
): Promise<void> {
  if (host.projectRouteSyncInFlight || !host.pendingProjectNotificationRouteIntent?.projectId) {
    return;
  }

  const intent = host.pendingProjectNotificationRouteIntent;
  host.pendingProjectNotificationRouteIntent = null;
  host.projectRouteSyncInFlight = true;

  try {
    await applyProjectNotificationRouteIntent(host, intent);
  } finally {
    host.projectRouteSyncInFlight = false;
    const nextIntent =
      host.pendingProjectNotificationRouteIntent as ProjectNotificationRouteIntent | null;
    if (nextIntent?.projectId) {
      void flushTenderProjectsNotificationRouteIntent(host);
    }
  }
}

export function syncTenderProjectsNotificationRouteState(
  host: TenderProjectsNotificationRouteHost,
  intent: ProjectNotificationRouteIntent | null
): void {
  const queryParams = intent
    ? {
        panel: intent.panel ?? null,
        projectId: intent.projectId ?? null,
        section: intent.section ?? null,
        commentId: intent.commentId ?? null,
        checklistId: intent.checklistId ?? null
      }
    : {
        panel: null,
        projectId: null,
        section: null,
        commentId: null,
        checklistId: null
      };

  host.projectRouteNavigationInFlight = true;
  void host.router
    .navigate([], {
      relativeTo: host.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true
    })
    .finally(() => {
      host.projectRouteNavigationInFlight = false;
    });
}

export function readProjectNotificationRouteIntent(value: {
  panel: string | null;
  projectId: string | null;
  section?: string | null;
  commentId?: string | null;
  checklistId?: string | null;
}): ProjectNotificationRouteIntent {
  const panel = String(value.panel ?? '')
    .trim()
    .toLowerCase();
  const projectId = readPositiveRouteId(value.projectId);
  const commentId = readPositiveRouteId(value.commentId ?? null);
  const checklistId = readPositiveRouteId(value.checklistId ?? null);
  const section =
    readProjectNotificationFocusSection(value.section ?? null) ??
    (commentId ? 'activity' : checklistId ? 'checklists' : null);
  return {
    panel: panel === 'details' || projectId ? 'details' : null,
    projectId,
    section,
    commentId,
    checklistId
  };
}

export function resolveProjectNotificationFocus(
  intent: ProjectNotificationRouteIntent
): ProjectNotificationFocus | null {
  const section =
    intent.section ?? (intent.commentId ? 'activity' : intent.checklistId ? 'checklists' : null);

  if (!section && !intent.commentId && !intent.checklistId) {
    return null;
  }

  return {
    section,
    commentId: intent.commentId ?? null,
    checklistId: intent.checklistId ?? null
  };
}

function readPositiveRouteId(value: string | null): number | null {
  const parsed = Number(String(value ?? '').trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function readProjectNotificationFocusSection(
  value: string | null
): ProjectNotificationFocusSection | null {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  switch (normalized) {
    case 'overview':
    case 'description':
    case 'delay-reason':
    case 'checklists':
    case 'attachments':
    case 'activity':
      return normalized;
    default:
      return null;
  }
}

async function applyProjectNotificationRouteIntent(
  host: TenderProjectsNotificationRouteHost,
  intent: ProjectNotificationRouteIntent
): Promise<void> {
  if (!intent.projectId) {
    return;
  }

  const row = host.findRowByProjectId(intent.projectId);
  const notificationFocus = resolveProjectNotificationFocus(intent);
  if (row) {
    host.openProjectDetailsPanel(row, { syncRoute: false, notificationFocus });
    return;
  }

  const details = await firstValueFrom(
    host.projectsFacade.api.getDetails(intent.projectId, {
      includeActivity: true,
      includeSupplementalActivity: false
    })
  ).catch(() => null);

  if (!details?.project) {
    return;
  }

  host.openProjectDetailsPanel(host.mapToRow(details.project), {
    syncRoute: false,
    prefetchedDetails: details,
    notificationFocus
  });
}
