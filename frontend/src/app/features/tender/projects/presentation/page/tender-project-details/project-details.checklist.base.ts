import type { ChangeDetectorRef, NgZone } from '@angular/core';
import type { Observable } from 'rxjs';
import { extractProjectDetailsErrorMessage } from './project-details.error.util';
import {
  normalizeChecklistOrderValue,
  parseChecklistNotesEnvelope,
  parseChecklistOrderValue,
  serializeChecklistNotesEnvelope
} from './project-details-checklist-notes.util';
import type { AuditTrail, CheckList } from '../tender-projects.contracts';
import type {
  ChecklistItem,
  ChecklistSubItem,
  ChecklistTogglePayload,
  ProjectDetailsChecklistActionFailedEvent,
  TenderRow
} from './project-details.models';

type ChecklistAuditAction = 'create' | 'update' | 'delete';
type ChecklistMutationAction = 'load' | 'create' | 'update' | 'delete';

type ChecklistApiResponse<T> = Observable<T>;

interface ProjectDetailsChecklistApi {
  getByProjectId(projectId: number): ChecklistApiResponse<CheckList[]>;
  create(payload: {
    name: string;
    isCompleted: boolean;
    projectId: number;
    notes: string | null;
  }): ChecklistApiResponse<CheckList | null>;
  update(
    projectId: number,
    id: number,
    payload: {
      id: number;
      name: string;
      isCompleted: boolean;
      notes: string | null;
    }
  ): ChecklistApiResponse<CheckList | null>;
  delete(projectId: number, id: number): ChecklistApiResponse<void>;
}

interface ProjectDetailsAuthUserFacade {
  user(): { name?: string | null; email?: string | null } | null | undefined;
}

export abstract class ProjectDetailsChecklistBase {
  protected abstract checklistsApi: ProjectDetailsChecklistApi;
  protected abstract cdr: ChangeDetectorRef;
  protected abstract zone: NgZone;
  protected abstract checklistLoadToken: number;
  protected abstract authUserFacade: ProjectDetailsAuthUserFacade;
  protected abstract checklistPersistedState: Map<number, ChecklistItem>;

  abstract buffer: TenderRow;
  abstract row: TenderRow;
  abstract checklistCreateInFlight: boolean;
  abstract checklistLoadInFlight: boolean;
  abstract auditRecorded: { emit(value: AuditTrail): void };
  abstract checklistActionFailed: {
    emit(value: ProjectDetailsChecklistActionFailedEvent): void;
  };

  protected loadChecklistsForRow(): void {
    const projectId = this.resolveChecklistProjectId();
    if (!projectId) {
      this.applyChecklistSnapshot([], true);
      this.setChecklistLoad(false);
      return;
    }
    this.setChecklistLoad(true);
    const token = ++this.checklistLoadToken;
    this.checklistsApi.getByProjectId(projectId).subscribe({
      next: items => {
        if (token !== this.checklistLoadToken) return;
        const mapped = (items ?? []).map(item => this.mapChecklist(item));
        this.applyChecklistSnapshot(mapped, true);
        this.setChecklistLoad(false);
      },
      error: err => {
        if (token !== this.checklistLoadToken) return;
        this.applyChecklistSnapshot([], false);
        this.setChecklistLoad(false);
        this.emitChecklistError('load', err);
      }
    });
  }

  onCreateChecklist(name?: string | null): void {
    if (this.checklistCreateInFlight) {
      return;
    }
    this.invalidateChecklistLoad();
    const projectId = this.resolveChecklistProjectId();
    if (!projectId) {
      this.emitChecklistError('create', new Error('Missing project ID'));
      return;
    }
    this.setChecklistBusy(true);
    const trimmed = (name ?? '').trim();
    const nextName = trimmed || this.getNextChecklistName(projectId);
    const order = this.getNextChecklistOrder();
    const notes = this.serializeChecklistNotes({ text: nextName, done: false, order });
    this.checklistsApi.create({ name: nextName, isCompleted: false, projectId, notes }).subscribe({
      next: created => {
        const mapped = created ? this.mapChecklist(created) : null;
        if (mapped?.id) {
          const list = this.buffer.checklists ?? [];
          this.applyChecklistSnapshot([...list, mapped]);
          this.emitChecklistAudit('create', null, mapped);
        } else {
          this.loadChecklistsForRow();
        }
        this.setChecklistBusy(false);
      },
      error: err => {
        this.setChecklistBusy(false);
        this.emitChecklistError('create', err);
      }
    });
  }

  onToggleChecklist(payload: ChecklistTogglePayload): void {
    this.invalidateChecklistLoad();
    const item = payload?.item;
    const id = this.parseChecklistId(item?.id);
    if (!id) return;
    const previous = payload.previous;
    const previousItem = this.getPersistedChecklistItem(id) ?? {
      ...(this.cloneChecklistItem(item) ?? { text: item?.text ?? '', done: previous }),
      done: previous
    };
    const projectId = this.resolveChecklistProjectId();
    if (!projectId) {
      item.done = previous;
      this.emitChecklistError('update', new Error('Missing project ID'));
      return;
    }
    const name = (item.text ?? '').trim();
    if (!name) {
      item.done = previous;
      this.emitChecklistError('update', new Error('Checklist name is required'));
      return;
    }
    const notes = this.serializeChecklistNotes(item);
    this.checklistsApi
      .update(projectId, id, { id, name, isCompleted: item.done, notes })
      .subscribe({
        next: updated => {
          const mapped = updated ? this.mapChecklist(updated) : null;
          if (mapped?.id) {
            this.replaceChecklist(id, mapped);
            this.emitChecklistAudit('update', previousItem, mapped);
          } else {
            this.emitChecklistAudit('update', previousItem, this.cloneChecklistItem(item));
            this.loadChecklistsForRow();
          }
        },
        error: err => {
          item.done = previous;
          this.emitChecklistError('update', err);
        }
      });
  }

  onUpdateChecklist(item: ChecklistItem): void {
    this.invalidateChecklistLoad();
    const projectId = this.resolveChecklistProjectId();
    if (!projectId) {
      this.emitChecklistError('update', new Error('Missing project ID'));
      this.loadChecklistsForRow();
      return;
    }
    const id = this.parseChecklistId(item?.id);
    if (!id) {
      this.loadChecklistsForRow();
      return;
    }
    const previousItem = this.getPersistedChecklistItem(id);
    const name = (item.text ?? '').trim();
    if (!name) {
      this.emitChecklistError('update', new Error('Checklist name is required'));
      this.loadChecklistsForRow();
      return;
    }
    const notes = this.serializeChecklistNotes(item);
    this.checklistsApi
      .update(projectId, id, { id, name, isCompleted: item.done, notes })
      .subscribe({
        next: updated => {
          const mapped = updated ? this.mapChecklist(updated) : null;
          if (mapped?.id) {
            this.replaceChecklist(id, mapped);
            this.emitChecklistAudit('update', previousItem, mapped);
          } else {
            this.emitChecklistAudit('update', previousItem, this.cloneChecklistItem(item));
            this.loadChecklistsForRow();
          }
        },
        error: err => {
          this.emitChecklistError('update', err);
          this.loadChecklistsForRow();
        }
      });
  }

  onDeleteChecklist(item: ChecklistItem): void {
    this.invalidateChecklistLoad();
    const projectId = this.resolveChecklistProjectId();
    if (!projectId) {
      this.emitChecklistError('delete', new Error('Missing project ID'));
      return;
    }
    if (!item) return;
    const id = this.parseChecklistId(item.id);
    if (!id) {
      const list = this.buffer.checklists ?? [];
      const updated = list.filter(entry => entry !== item);
      this.applyChecklistSnapshot(updated);
      return;
    }
    const previousItem = this.getPersistedChecklistItem(id) ?? this.cloneChecklistItem(item);
    this.checklistsApi.delete(projectId, id).subscribe({
      next: () => {
        this.removeChecklistById(id);
        this.emitChecklistAudit('delete', previousItem, null);
        this.loadChecklistsForRow();
      },
      error: err => {
        this.emitChecklistError('delete', err);
      }
    });
  }

  protected setChecklistBusy(value: boolean): void {
    this.zone.run(() => {
      this.checklistCreateInFlight = value;
      this.cdr.markForCheck();
      this.queueChecklistRefresh();
    });
  }

  protected extractErrorMessage(err: unknown): string {
    return extractProjectDetailsErrorMessage(err);
  }

  private mapChecklist(item: CheckList): ChecklistItem {
    const id = this.parseChecklistId(item?.id);
    const notes = this.parseChecklistNotes(item?.notes);
    return {
      id: id ?? undefined,
      text: (item.name ?? '').trim(),
      done: Boolean(item.isCompleted),
      subItems: notes.subItems,
      noteText: notes.noteText,
      order: notes.order,
      notesEnvelope: notes.envelope
    };
  }

  private parseChecklistNotes(raw: string | null | undefined): {
    noteText: string | null;
    subItems: ChecklistSubItem[];
    order: number | null;
    envelope: Record<string, unknown> | null;
  } {
    return parseChecklistNotesEnvelope(raw, () => this.newSubItemId());
  }

  private serializeChecklistNotes(item: ChecklistItem): string | null {
    return serializeChecklistNotesEnvelope(item);
  }

  private newSubItemId(): string {
    const rand = Math.random().toString(36).slice(2, 8);
    return `sub-${Date.now().toString(36)}-${rand}`;
  }

  private parseChecklistId(value: unknown): number | null {
    if (value == null) return null;
    if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
    const parsed = Number(String(value).trim());
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private parseChecklistOrder(value: unknown): number | null {
    return parseChecklistOrderValue(value);
  }

  private normalizeChecklistOrder(value: unknown): number | null {
    return normalizeChecklistOrderValue(value);
  }

  private getNextChecklistName(projectId: number): string {
    const base = 'New item';
    const existing = new Set(
      (this.buffer.checklists ?? []).map(item => (item.text ?? '').trim().toLowerCase())
    );
    let i = 1;
    while (existing.has(`${base} ${i}-${projectId}`.toLowerCase())) i += 1;
    return `${base} ${i}-${projectId}`;
  }

  private getNextChecklistOrder(): number {
    const list = this.buffer.checklists ?? [];
    const orders = list
      .map(item => this.normalizeChecklistOrder(item.order))
      .filter((value): value is number => value != null);
    if (!orders.length) return list.length;
    return Math.max(...orders) + 1;
  }

  protected applyChecklistSnapshot(items: ChecklistItem[], markLoaded = true): void {
    this.zone.run(() => {
      const next = this.sortChecklists(items);
      this.buffer.checklists = next;
      this.buffer.checklistsLoaded = markLoaded;
      if (this.row) {
        this.row.checklists = next;
        this.row.checklistsLoaded = markLoaded;
      }
      this.refreshChecklistPersistedState(next);
      this.cdr.markForCheck();
      this.queueChecklistRefresh();
    });
  }

  private sortChecklists(items: ChecklistItem[]): ChecklistItem[] {
    if (!items?.length) return items;
    const hasOrder = items.every(item => Number.isFinite(item.order ?? NaN));
    const ordered = hasOrder
      ? [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      : [...items];
    const grouped = this.groupChecklistsByDone(ordered);
    for (const item of grouped) {
      const subs = item.subItems ?? [];
      if (subs.length > 1) {
        item.subItems = this.groupSubItemsByDone(subs);
      }
    }
    return grouped;
  }

  private groupChecklistsByDone(list: ChecklistItem[]): ChecklistItem[] {
    const active: ChecklistItem[] = [];
    const done: ChecklistItem[] = [];
    for (const item of list) {
      if (item?.done) done.push(item);
      else active.push(item);
    }
    return [...active, ...done];
  }

  private groupSubItemsByDone(list: ChecklistSubItem[]): ChecklistSubItem[] {
    const active: ChecklistSubItem[] = [];
    const done: ChecklistSubItem[] = [];
    for (const sub of list) {
      if (sub?.done) done.push(sub);
      else active.push(sub);
    }
    return [...active, ...done];
  }

  protected setChecklistLoad(value: boolean): void {
    this.zone.run(() => {
      this.checklistLoadInFlight = value;
      this.cdr.markForCheck();
      this.queueChecklistRefresh();
    });
  }

  private invalidateChecklistLoad(): void {
    this.checklistLoadToken += 1;
    this.buffer.checklistsLoaded = false;
    if (this.row) {
      this.row.checklistsLoaded = false;
    }
    if (this.checklistLoadInFlight) {
      this.setChecklistLoad(false);
    }
  }

  private queueChecklistRefresh(): void {
    queueMicrotask(() => {
      if ((this.cdr as { destroyed?: boolean }).destroyed) return;
      this.cdr.detectChanges();
    });
  }

  private replaceChecklist(targetId: number, next: ChecklistItem): void {
    const list = this.buffer.checklists ?? [];
    const index = list.findIndex(item => item.id === targetId);
    if (index === -1) {
      this.applyChecklistSnapshot([...list, next]);
      return;
    }
    const updated = [...list];
    updated[index] = next;
    this.applyChecklistSnapshot(updated);
  }

  private removeChecklistById(targetId: number): void {
    const list = this.buffer.checklists ?? [];
    const updated = list.filter(item => item.id !== targetId);
    this.applyChecklistSnapshot(updated);
  }

  private refreshChecklistPersistedState(items: ChecklistItem[]): void {
    this.checklistPersistedState.clear();
    for (const item of items ?? []) {
      const id = this.parseChecklistId(item?.id);
      if (!id) continue;
      const snapshot = this.cloneChecklistItem(item);
      if (!snapshot) continue;
      this.checklistPersistedState.set(id, snapshot);
    }
  }

  private getPersistedChecklistItem(id: number | null | undefined): ChecklistItem | null {
    if (!id) return null;
    const item = this.checklistPersistedState.get(id);
    return item ? this.cloneChecklistItem(item) : null;
  }

  private cloneChecklistItem(item: ChecklistItem | null | undefined): ChecklistItem | null {
    if (!item) return null;
    return {
      ...item,
      subItems: (item.subItems ?? []).map(sub => ({ ...sub })),
      notesEnvelope:
        item.notesEnvelope && typeof item.notesEnvelope === 'object'
          ? { ...item.notesEnvelope }
          : (item.notesEnvelope ?? null)
    };
  }

  private emitChecklistAudit(
    action: ChecklistAuditAction,
    previousItem?: ChecklistItem | null,
    nextItem?: ChecklistItem | null
  ): void {
    const audit = this.buildChecklistAudit(action, previousItem, nextItem);
    if (!audit) {
      return;
    }
    this.auditRecorded.emit(audit);
  }

  private buildChecklistAudit(
    action: ChecklistAuditAction,
    previousItem?: ChecklistItem | null,
    nextItem?: ChecklistItem | null
  ): AuditTrail | null {
    const projectId = this.resolveChecklistProjectId();
    const current = nextItem ?? previousItem;
    if (!projectId || !current) {
      return null;
    }

    const nowIso = new Date().toISOString();
    const user = this.authUserFacade.user();
    const actor = user?.name?.trim() || user?.email?.trim() || 'You';
    const projectTitle = (this.buffer?.title ?? this.row?.title ?? '').trim() || undefined;
    const checklistLabel = (nextItem?.text ?? previousItem?.text ?? '').trim() || 'Checklist item';
    const changes = this.buildChecklistAuditChanges(previousItem, nextItem);
    if (action === 'update' && !changes.length) {
      return null;
    }

    const messages = {
      create: 'Created checklist',
      update: changes.length === 1 ? `Updated checklist ${changes[0].field}` : 'Updated checklist',
      delete: 'Deleted checklist'
    } as const;

    const audit: AuditTrail = {
      entityName: 'Projects',
      entityId: projectId,
      actionType:
        action === 'create'
          ? 'checklist-created'
          : action === 'delete'
            ? 'checklist-deleted'
            : 'checklist-updated',
      action:
        action === 'create'
          ? 'checklist-created'
          : action === 'delete'
            ? 'checklist-deleted'
            : 'checklist-updated',
      message: messages[action],
      description: changes.length ? JSON.stringify(changes) : checklistLabel,
      details: changes.length ? JSON.stringify(changes) : checklistLabel,
      changes: changes.length ? changes : undefined,
      createdAt: nowIso,
      createdOn: nowIso,
      timestamp: nowIso,
      userName: actor,
      performedBy: actor,
      createdBy: actor,
      entityDisplayName: projectTitle,
      targetName: projectTitle,
      referenceName: checklistLabel,
      field: changes.length === 1 ? changes[0].field : action === 'delete' ? 'Checklist' : undefined
    };
    (audit as Record<string, unknown>)['projectId'] = projectId;
    const checklistId = this.parseChecklistId(current.id);
    if (checklistId) {
      (audit as Record<string, unknown>)['checklistId'] = checklistId;
    }
    return audit;
  }

  private buildChecklistAuditChanges(
    previousItem?: ChecklistItem | null,
    nextItem?: ChecklistItem | null
  ): Array<{ field: string; from?: string; to?: string }> {
    const normalize = (value: string | null): string => (value ?? '').trim().toLowerCase();
    const asText = (value: unknown): string | null => {
      const text = String(value ?? '').trim();
      return text ? text : null;
    };
    const asStatus = (item?: ChecklistItem | null): string | null =>
      item ? (item.done ? 'Completed' : 'In Progress') : null;
    const asOrder = (item?: ChecklistItem | null): string | null => {
      const order = this.normalizeChecklistOrder(item?.order);
      return order == null ? null : String(order + 1);
    };
    const asSubtasks = (item?: ChecklistItem | null): string | null => {
      const subItems = item?.subItems ?? [];
      if (!subItems.length) {
        return null;
      }
      const summary = subItems
        .map(sub => `${sub.done ? '[x]' : '[ ]'} ${(sub.text ?? '').trim() || 'Subtask'}`)
        .join(', ');
      return summary.length > 180 ? `${summary.slice(0, 177)}...` : summary;
    };

    const fields: Array<{
      field: string;
      read: (item?: ChecklistItem | null) => string | null;
    }> = [
      { field: 'Checklist', read: item => asText(item?.text) },
      { field: 'Status', read: item => asStatus(item) },
      { field: 'Note', read: item => asText(item?.noteText) },
      { field: 'Order', read: item => asOrder(item) },
      { field: 'Subtasks', read: item => asSubtasks(item) }
    ];

    const changes: Array<{ field: string; from?: string; to?: string }> = [];
    for (const descriptor of fields) {
      const from = descriptor.read(previousItem);
      const to = descriptor.read(nextItem);
      if (!from && !to) {
        continue;
      }
      if (normalize(from) === normalize(to)) {
        continue;
      }
      changes.push({
        field: descriptor.field,
        from: from ?? undefined,
        to: to ?? undefined
      });
    }
    return changes;
  }

  private emitChecklistError(action: ChecklistMutationAction, err: unknown): void {
    this.checklistActionFailed.emit({ action, message: this.extractErrorMessage(err) });
  }

  private resolveChecklistProjectId(): number | null {
    const rowWithProjectId = this.row as (TenderRow & { projectId?: unknown }) | null;
    const bufferWithProjectId = this.buffer as TenderRow & { projectId?: unknown };
    return this.parseChecklistId(
      rowWithProjectId?.projectId ??
        this.row?.id ??
        bufferWithProjectId?.projectId ??
        this.buffer?.id
    );
  }
}
