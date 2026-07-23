import { Directive } from '@angular/core';
import type { AuditTrail, CreateProjectCommentPayload } from './tender-projects.contracts';
import type {
  Activity,
  ActivityNotePayload
} from './tender-project-details/tabs/activity-tab.component';
import { TenderProjectsComponentState } from './tender-projects.component.state';
import {
  addPendingTenderProjectAudit,
  addPendingTenderProjectComment,
  loadTenderProjectAuditForRow,
  restoreTenderProjectActivityFromCache,
  prefetchTenderProjectActivityForRow,
  prefetchTenderProjectActivityForRows,
  mapPendingTenderProjectAuditActivity,
  mapPendingTenderProjectActivity,
  onAddTenderProjectNote,
  pendingTenderProjectActivities,
  readPendingTenderProjectAudits,
  readPendingTenderProjectComments,
  removePendingTenderProjectAudit,
  removePendingTenderProjectComment,
  syncPendingTenderProjectAudits,
  syncPendingTenderProjectComments,
  writePendingTenderProjectAudits,
  writePendingTenderProjectComments,
  type TenderProjectsActivityHost
} from './tender-projects.activity.helper';
import type { PendingProjectAudit, PendingProjectComment } from './tender-projects.types';
import type { TenderRow } from './tender-project-details/project-details.component';

@Directive()
export abstract class TenderProjectsComponentPresenterActivityBase extends TenderProjectsComponentState {
  protected abstract recordProjectAudit(payload: AuditTrail | null | undefined): void;

  protected activityHost(): TenderProjectsActivityHost {
    return this as unknown as TenderProjectsActivityHost;
  }

  onAddNote(payload: ActivityNotePayload) {
    return onAddTenderProjectNote(this.activityHost(), payload);
  }

  onAuditRecorded(payload: AuditTrail) {
    this.recordProjectAudit(payload);
  }

  protected readPendingAudits(): PendingProjectAudit[] {
    return readPendingTenderProjectAudits(this.activityHost());
  }

  protected writePendingAudits(items: PendingProjectAudit[]): void {
    return writePendingTenderProjectAudits(this.activityHost(), items);
  }

  protected addPendingAudit(payload: AuditTrail): string {
    return addPendingTenderProjectAudit(this.activityHost(), payload);
  }

  protected removePendingAudit(id: string): void {
    return removePendingTenderProjectAudit(this.activityHost(), id);
  }

  protected syncPendingAudits(projectId?: number): void {
    return syncPendingTenderProjectAudits(this.activityHost(), projectId);
  }

  protected readPendingComments(): PendingProjectComment[] {
    return readPendingTenderProjectComments(this.activityHost());
  }

  protected writePendingComments(items: PendingProjectComment[]): void {
    return writePendingTenderProjectComments(this.activityHost(), items);
  }

  protected addPendingComment(payload: CreateProjectCommentPayload): string {
    return addPendingTenderProjectComment(this.activityHost(), payload);
  }

  protected removePendingComment(id: string): void {
    return removePendingTenderProjectComment(this.activityHost(), id);
  }

  protected syncPendingComments(projectId?: number): void {
    return syncPendingTenderProjectComments(this.activityHost(), projectId);
  }

  protected pendingActivitiesForProject(projectId: number): Activity[] {
    return pendingTenderProjectActivities(this.activityHost(), projectId, this.selectedRow);
  }

  protected mapPendingToActivity(item: PendingProjectComment): Activity {
    return mapPendingTenderProjectActivity(this.activityHost(), item);
  }

  protected mapPendingAuditToActivity(item: PendingProjectAudit): Activity | null {
    return mapPendingTenderProjectAuditActivity(this.activityHost(), item, this.selectedRow);
  }

  protected loadAuditForRow(row: TenderRow | null) {
    return loadTenderProjectAuditForRow(this.activityHost(), row);
  }

  protected restoreAuditForRowFromCache(row: TenderRow | null): void {
    const projectId = row?.id ?? null;
    if (!projectId) {
      this.activities = [];
      this.activityLoading = false;
      this.cdr.markForCheck();
      return;
    }
    restoreTenderProjectActivityFromCache(this.activityHost(), projectId, row);
  }

  protected override prefetchActivityForRow(row: TenderRow | null): void {
    prefetchTenderProjectActivityForRow(this.activityHost(), row);
  }

  protected override prefetchActivityForRows(rows: readonly TenderRow[]): void {
    prefetchTenderProjectActivityForRows(this.activityHost(), rows);
  }
}
