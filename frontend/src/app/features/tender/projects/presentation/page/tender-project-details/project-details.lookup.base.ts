import type { Observable } from 'rxjs';
import {
  findTenderProjectLookupByName,
  resolveTenderProjectLookupDisplayLabel
} from '../tender-projects.lookup.util';
import type { IdName } from '../tender-projects.contracts';
import { ProjectDetailsChecklistBase } from './project-details.checklist.base';
import type {
  ProjectDetailsLookupCreateFailedEvent,
  ProjectDetailsLookupCreatedEvent,
  ProjectDetailsLookupUpdateFailedEvent,
  ProjectDetailsLookupUpdatedEvent,
  RenamePayload,
  Status,
  TenderRow
} from './project-details.models';
import { environment } from '../../../../../../../environments/environment';

type LookupUpdateResponse = { name?: string | null } | null | undefined;

interface ProjectDetailsLookupApi {
  createOwner(name: string, countryId: number): Observable<IdName>;
  createOwnerType(name: string): Observable<IdName>;
  createCountry(name: string): Observable<IdName>;
  createTenderStage(name: string): Observable<IdName>;
  createTypeOfProject(name: string): Observable<IdName>;
  createStatus(name: string): Observable<IdName>;
  createDegreeOfImportance(name: string): Observable<IdName>;
  updateOwner(id: number, name: string): Observable<LookupUpdateResponse>;
  updateOwnerType(id: number, name: string): Observable<LookupUpdateResponse>;
  updateCountry(id: number, name: string): Observable<LookupUpdateResponse>;
  updateTenderStage(id: number, name: string): Observable<LookupUpdateResponse>;
  updateTypeOfProject(id: number, name: string): Observable<LookupUpdateResponse>;
  updateStatus(id: number, name: string): Observable<LookupUpdateResponse>;
  updateDegreeOfImportance(id: number, name: string): Observable<LookupUpdateResponse>;
}

type IdNameSignal = {
  (): IdName[];
  set(value: IdName[]): void;
};

export abstract class ProjectDetailsLookupBase extends ProjectDetailsChecklistBase {
  protected abstract api: ProjectDetailsLookupApi;
  protected abstract pendingLookups: number;
  protected abstract deferSave: boolean;

  abstract override buffer: TenderRow;
  abstract owners: string[];
  abstract ownersSignal: IdNameSignal;
  abstract ownerTypes: string[];
  abstract ownerTypeLookups: IdName[];
  abstract countries: string[];
  abstract countriesSignal: IdNameSignal;
  abstract statuses: string[];
  abstract statusLookups: IdName[];
  abstract stages: string[];
  abstract stageLookups: IdName[];
  abstract types: string[];
  abstract typeLookups: IdName[];
  abstract importances: string[];
  abstract importanceLookups: IdName[];
  abstract peopleOptions: string[];
  abstract save: { emit(value: TenderRow): void };
  abstract saveDeferred: { emit(value: void): void };
  abstract delete: { emit(value: void): void };
  abstract lookupCreated: { emit(value: ProjectDetailsLookupCreatedEvent): void };
  abstract lookupCreateFailed: {
    emit(value: ProjectDetailsLookupCreateFailedEvent): void;
  };
  abstract lookupUpdated: { emit(value: ProjectDetailsLookupUpdatedEvent): void };
  abstract lookupUpdateFailed: {
    emit(value: ProjectDetailsLookupUpdateFailedEvent): void;
  };

  onCreateOwner(name: string): void {
    const next = name.trim();
    if (!next) return;
    const existing = this.findLookupByName(this.ownersSignal(), next);
    if (existing) {
      this.buffer.owner = this.lookupLabel(existing);
      this.buffer.ownerId = existing.id;
      return;
    }
    const countryId =
      this.buffer.countryId ??
      this.findLookupByName(this.countriesSignal(), this.buffer.country)?.id ??
      null;
    if (!countryId) {
      this.lookupCreateFailed.emit({
        type: 'owner',
        name: next,
        message: 'Select a country first'
      });
      return;
    }
    if (!this.tryBeginLookup()) return;
    this.api.createOwner(next, countryId).subscribe({
      next: created => {
        const current = this.ownersSignal();
        const nextList = [...current, created];
        this.ownersSignal.set(nextList);
        this.owners = this.lookupOptions(nextList);
        this.buffer.owner = this.lookupLabel(created);
        this.buffer.ownerId = created.id;
        this.lookupCreated.emit({ type: 'owner', item: created });
        this.endLookup();
      },
      error: err => {
        if (environment.enableDebugLogs) console.error('Failed to create owner:', err);
        this.lookupCreateFailed.emit({
          type: 'owner',
          name: next,
          message: this.extractErrorMessage(err)
        });
        this.endLookup();
      }
    });
  }

  onCreateCountry(name: string): void {
    const next = name.trim();
    if (!next) return;
    const existing = this.findLookupByName(this.countriesSignal(), next);
    if (existing) {
      this.buffer.country = this.lookupLabel(existing);
      this.buffer.countryId = existing.id;
      return;
    }
    if (!this.tryBeginLookup()) return;
    this.api.createCountry(next).subscribe({
      next: created => {
        const current = this.countriesSignal();
        const nextList = [...current, created];
        this.countriesSignal.set(nextList);
        this.countries = this.lookupOptions(nextList);
        this.buffer.country = this.lookupLabel(created);
        this.buffer.countryId = created.id;
        this.lookupCreated.emit({ type: 'country', item: created });
        this.endLookup();
      },
      error: err => {
        if (environment.enableDebugLogs) console.error('Failed to create country:', err);
        this.lookupCreateFailed.emit({
          type: 'country',
          name: next,
          message: this.extractErrorMessage(err)
        });
        this.endLookup();
      }
    });
  }

  onCreateOwnerType(name: string): void {
    const next = name.trim();
    if (!next) return;
    const existing = this.findLookupByName(this.ownerTypeLookups, next);
    if (existing) {
      this.buffer.ownerType = this.lookupLabel(existing);
      this.buffer.ownerTypeId = existing.id;
      return;
    }
    if (!this.tryBeginLookup()) return;
    this.api.createOwnerType(next).subscribe({
      next: created => {
        this.ownerTypeLookups = this.updateLookupList(this.ownerTypeLookups, created);
        this.ownerTypes = this.lookupOptions(this.ownerTypeLookups);
        this.buffer.ownerType = this.lookupLabel(created);
        this.buffer.ownerTypeId = created.id;
        this.lookupCreated.emit({ type: 'ownerType', item: created });
        this.endLookup();
      },
      error: err => {
        if (environment.enableDebugLogs) console.error('Failed to create owner type:', err);
        this.lookupCreateFailed.emit({
          type: 'ownerType',
          name: next,
          message: this.extractErrorMessage(err)
        });
        this.endLookup();
      }
    });
  }

  onCreateStage(name: string): void {
    const next = name.trim();
    if (!next) return;
    const existing = this.findLookupByName(this.stageLookups, next);
    if (existing) {
      this.buffer.ts = this.lookupLabel(existing);
      this.buffer.tenderStageId = existing.id;
      return;
    }
    if (!this.tryBeginLookup()) return;
    this.api.createTenderStage(next).subscribe({
      next: created => {
        this.stageLookups = this.updateLookupList(this.stageLookups, created);
        this.stages = this.lookupOptions(this.stageLookups);
        this.buffer.ts = this.lookupLabel(created);
        this.buffer.tenderStageId = created.id;
        this.lookupCreated.emit({ type: 'stage', item: created });
        this.endLookup();
      },
      error: err => {
        if (environment.enableDebugLogs) console.error('Failed to create stage:', err);
        this.lookupCreateFailed.emit({
          type: 'stage',
          name: next,
          message: this.extractErrorMessage(err)
        });
        this.endLookup();
      }
    });
  }

  onCreateType(name: string): void {
    const next = name.trim();
    if (!next) return;
    const existing = this.findLookupByName(this.typeLookups, next);
    if (existing) {
      this.buffer.top = this.lookupLabel(existing);
      this.buffer.typeOfProjectId = existing.id;
      return;
    }
    if (!this.tryBeginLookup()) return;
    this.api.createTypeOfProject(next).subscribe({
      next: created => {
        this.typeLookups = this.updateLookupList(this.typeLookups, created);
        this.types = this.lookupOptions(this.typeLookups);
        this.buffer.top = this.lookupLabel(created);
        this.buffer.typeOfProjectId = created.id;
        this.lookupCreated.emit({ type: 'type', item: created });
        this.endLookup();
      },
      error: err => {
        if (environment.enableDebugLogs) console.error('Failed to create type:', err);
        this.lookupCreateFailed.emit({
          type: 'type',
          name: next,
          message: this.extractErrorMessage(err)
        });
        this.endLookup();
      }
    });
  }

  onCreateStatus(name: string): void {
    const next = name.trim();
    if (!next) return;
    const existing = this.findLookupByName(this.statusLookups, next);
    if (existing) {
      this.buffer.status = this.lookupLabel(existing) as Status;
      this.buffer.statusId = existing.id;
      return;
    }
    if (!this.tryBeginLookup()) return;
    this.api.createStatus(next).subscribe({
      next: created => {
        this.statusLookups = this.updateLookupList(this.statusLookups, created);
        this.statuses = this.lookupOptions(this.statusLookups);
        this.buffer.status = this.lookupLabel(created) as Status;
        this.buffer.statusId = created.id;
        this.lookupUpdated.emit({ type: 'status', item: created });
        this.endLookup();
      },
      error: err => {
        if (environment.enableDebugLogs) console.error('Failed to create status:', err);
        this.lookupUpdateFailed.emit({
          type: 'status',
          name: next,
          message: this.extractErrorMessage(err)
        });
        this.endLookup();
      }
    });
  }

  onCreateImportance(name: string): void {
    const next = name.trim();
    if (!next) return;
    const existing = this.findLookupByName(this.importanceLookups, next);
    if (existing) {
      this.buffer.doi = this.lookupLabel(existing);
      this.buffer.degreeOfImportanceId = existing.id;
      return;
    }
    if (!this.tryBeginLookup()) return;
    this.api.createDegreeOfImportance(next).subscribe({
      next: created => {
        this.importanceLookups = this.updateLookupList(this.importanceLookups, created);
        this.importances = this.lookupOptions(this.importanceLookups);
        this.buffer.doi = this.lookupLabel(created);
        this.buffer.degreeOfImportanceId = created.id;
        this.lookupUpdated.emit({ type: 'importance', item: created });
        this.endLookup();
      },
      error: err => {
        if (environment.enableDebugLogs) console.error('Failed to create importance:', err);
        this.lookupUpdateFailed.emit({
          type: 'importance',
          name: next,
          message: this.extractErrorMessage(err)
        });
        this.endLookup();
      }
    });
  }

  onCreateAssignee(name: string): void {
    const next = name.trim();
    if (!next) return;
    this.buffer.assignTo = next;
    if (!this.hasName(this.peopleOptions, next)) {
      this.peopleOptions = [...this.peopleOptions, next];
    }
  }

  onCreateInCharge(name: string): void {
    const next = name.trim();
    if (!next) return;
    this.buffer.inCharge = next;
    if (!this.hasName(this.peopleOptions, next)) {
      this.peopleOptions = [...this.peopleOptions, next];
    }
  }

  onRenameOwner(payload: RenamePayload): void {
    const currentName = (payload?.from ?? this.buffer.owner ?? '').trim();
    const nextName = (payload?.to ?? '').trim();
    if (!currentName || !nextName) return;
    if (currentName.toLowerCase() === nextName.toLowerCase()) return;
    const current =
      this.findLookupByName(this.ownersSignal(), currentName) ??
      this.findLookupByName(this.ownersSignal(), this.buffer.owner);
    if (!current?.id) {
      this.lookupUpdateFailed.emit({ type: 'owner', name: nextName, message: 'Owner not found' });
      return;
    }
    const conflict = this.findLookupByName(this.ownersSignal(), nextName);
    if (conflict && conflict.id !== current.id) {
      this.lookupUpdateFailed.emit({
        type: 'owner',
        name: nextName,
        message: 'Name already exists'
      });
      return;
    }
    if (!this.tryBeginLookup()) return;
    this.api.updateOwner(current.id, nextName).subscribe({
      next: updated => {
        const item = { id: current.id, name: updated?.name ?? nextName };
        const nextList = this.updateLookupList(this.ownersSignal(), item);
        this.ownersSignal.set(nextList);
        this.owners = this.lookupOptions(nextList);
        this.buffer.owner = this.lookupLabel(nextList.find(entry => entry.id === item.id) ?? item);
        this.buffer.ownerId = item.id;
        this.lookupUpdated.emit({ type: 'owner', item });
        this.endLookup();
      },
      error: err => {
        if (environment.enableDebugLogs) console.error('Failed to update owner:', err);
        this.lookupUpdateFailed.emit({
          type: 'owner',
          name: nextName,
          message: this.extractErrorMessage(err)
        });
        this.endLookup();
      }
    });
  }

  onRenameCountry(payload: RenamePayload): void {
    const currentName = (payload?.from ?? this.buffer.country ?? '').trim();
    const nextName = (payload?.to ?? '').trim();
    if (!currentName || !nextName) return;
    if (currentName.toLowerCase() === nextName.toLowerCase()) return;
    const current =
      this.findLookupByName(this.countriesSignal(), currentName) ??
      this.findLookupByName(this.countriesSignal(), this.buffer.country);
    if (!current?.id) {
      this.lookupUpdateFailed.emit({
        type: 'country',
        name: nextName,
        message: 'Country not found'
      });
      return;
    }
    const conflict = this.findLookupByName(this.countriesSignal(), nextName);
    if (conflict && conflict.id !== current.id) {
      this.lookupUpdateFailed.emit({
        type: 'country',
        name: nextName,
        message: 'Name already exists'
      });
      return;
    }
    if (!this.tryBeginLookup()) return;
    this.api.updateCountry(current.id, nextName).subscribe({
      next: updated => {
        const item = { id: current.id, name: updated?.name ?? nextName };
        const nextList = this.updateLookupList(this.countriesSignal(), item);
        this.countriesSignal.set(nextList);
        this.countries = this.lookupOptions(nextList);
        this.buffer.country = this.lookupLabel(
          nextList.find(entry => entry.id === item.id) ?? item
        );
        this.buffer.countryId = item.id;
        this.lookupUpdated.emit({ type: 'country', item });
        this.endLookup();
      },
      error: err => {
        if (environment.enableDebugLogs) console.error('Failed to update country:', err);
        this.lookupUpdateFailed.emit({
          type: 'country',
          name: nextName,
          message: this.extractErrorMessage(err)
        });
        this.endLookup();
      }
    });
  }

  onRenameOwnerType(payload: RenamePayload): void {
    const currentName = (payload?.from ?? this.buffer.ownerType ?? '').trim();
    const nextName = (payload?.to ?? '').trim();
    if (!currentName || !nextName) return;
    if (currentName.toLowerCase() === nextName.toLowerCase()) return;
    const current = this.findLookupByName(this.ownerTypeLookups, currentName);
    if (!current?.id) {
      this.lookupUpdateFailed.emit({
        type: 'ownerType',
        name: nextName,
        message: 'Owner type not found'
      });
      return;
    }
    const conflict = this.findLookupByName(this.ownerTypeLookups, nextName);
    if (conflict && conflict.id !== current.id) {
      this.lookupUpdateFailed.emit({
        type: 'ownerType',
        name: nextName,
        message: 'Name already exists'
      });
      return;
    }
    if (!this.tryBeginLookup()) return;
    this.api.updateOwnerType(current.id, nextName).subscribe({
      next: updated => {
        const item = { id: current.id, name: updated?.name ?? nextName };
        this.ownerTypeLookups = this.updateLookupList(this.ownerTypeLookups, item);
        this.ownerTypes = this.lookupOptions(this.ownerTypeLookups);
        this.buffer.ownerType = this.lookupLabel(
          this.ownerTypeLookups.find(entry => entry.id === item.id) ?? item
        );
        this.buffer.ownerTypeId = item.id;
        this.lookupUpdated.emit({ type: 'ownerType', item });
        this.endLookup();
      },
      error: err => {
        if (environment.enableDebugLogs) console.error('Failed to update owner type:', err);
        this.lookupUpdateFailed.emit({
          type: 'ownerType',
          name: nextName,
          message: this.extractErrorMessage(err)
        });
        this.endLookup();
      }
    });
  }

  onRenameStage(payload: RenamePayload): void {
    const currentName = (payload?.from ?? this.buffer.ts ?? '').trim();
    const nextName = (payload?.to ?? '').trim();
    if (!currentName || !nextName) return;
    if (currentName.toLowerCase() === nextName.toLowerCase()) return;
    const current = this.findLookupByName(this.stageLookups, currentName);
    if (!current?.id) {
      this.lookupUpdateFailed.emit({ type: 'stage', name: nextName, message: 'Stage not found' });
      return;
    }
    const conflict = this.findLookupByName(this.stageLookups, nextName);
    if (conflict && conflict.id !== current.id) {
      this.lookupUpdateFailed.emit({
        type: 'stage',
        name: nextName,
        message: 'Name already exists'
      });
      return;
    }
    if (!this.tryBeginLookup()) return;
    this.api.updateTenderStage(current.id, nextName).subscribe({
      next: updated => {
        const item = { id: current.id, name: updated?.name ?? nextName };
        this.stageLookups = this.updateLookupList(this.stageLookups, item);
        this.stages = this.lookupOptions(this.stageLookups);
        this.buffer.ts = this.lookupLabel(
          this.stageLookups.find(entry => entry.id === item.id) ?? item
        );
        this.buffer.tenderStageId = item.id;
        this.lookupUpdated.emit({ type: 'stage', item });
        this.endLookup();
      },
      error: err => {
        if (environment.enableDebugLogs) console.error('Failed to update stage:', err);
        this.lookupUpdateFailed.emit({
          type: 'stage',
          name: nextName,
          message: this.extractErrorMessage(err)
        });
        this.endLookup();
      }
    });
  }

  onRenameType(payload: RenamePayload): void {
    const currentName = (payload?.from ?? this.buffer.top ?? '').trim();
    const nextName = (payload?.to ?? '').trim();
    if (!currentName || !nextName) return;
    if (currentName.toLowerCase() === nextName.toLowerCase()) return;
    const current = this.findLookupByName(this.typeLookups, currentName);
    if (!current?.id) {
      this.lookupUpdateFailed.emit({ type: 'type', name: nextName, message: 'Type not found' });
      return;
    }
    const conflict = this.findLookupByName(this.typeLookups, nextName);
    if (conflict && conflict.id !== current.id) {
      this.lookupUpdateFailed.emit({
        type: 'type',
        name: nextName,
        message: 'Name already exists'
      });
      return;
    }
    if (!this.tryBeginLookup()) return;
    this.api.updateTypeOfProject(current.id, nextName).subscribe({
      next: updated => {
        const item = { id: current.id, name: updated?.name ?? nextName };
        this.typeLookups = this.updateLookupList(this.typeLookups, item);
        this.types = this.lookupOptions(this.typeLookups);
        this.buffer.top = this.lookupLabel(
          this.typeLookups.find(entry => entry.id === item.id) ?? item
        );
        this.buffer.typeOfProjectId = item.id;
        this.lookupUpdated.emit({ type: 'type', item });
        this.endLookup();
      },
      error: err => {
        if (environment.enableDebugLogs) console.error('Failed to update type:', err);
        this.lookupUpdateFailed.emit({
          type: 'type',
          name: nextName,
          message: this.extractErrorMessage(err)
        });
        this.endLookup();
      }
    });
  }

  onRenameStatus(payload: RenamePayload): void {
    const currentName = (payload?.from ?? this.buffer.status ?? '').trim();
    const nextName = (payload?.to ?? '').trim();
    if (!currentName || !nextName) return;
    if (currentName.toLowerCase() === nextName.toLowerCase()) return;
    const current = this.findLookupByName(this.statusLookups, currentName);
    if (!current?.id) {
      this.lookupUpdateFailed.emit({
        type: 'status',
        name: nextName,
        message: 'Status not found'
      });
      return;
    }
    const conflict = this.findLookupByName(this.statusLookups, nextName);
    if (conflict && conflict.id !== current.id) {
      this.lookupUpdateFailed.emit({
        type: 'status',
        name: nextName,
        message: 'Name already exists'
      });
      return;
    }
    if (!this.tryBeginLookup()) return;
    this.api.updateStatus(current.id, nextName).subscribe({
      next: updated => {
        const item = { id: current.id, name: updated?.name ?? nextName };
        this.statusLookups = this.updateLookupList(this.statusLookups, item);
        this.statuses = this.lookupOptions(this.statusLookups);
        this.buffer.status = this.lookupLabel(
          this.statusLookups.find(entry => entry.id === item.id) ?? item
        ) as Status;
        this.buffer.statusId = item.id;
        this.lookupUpdated.emit({ type: 'status', item });
        this.endLookup();
      },
      error: err => {
        if (environment.enableDebugLogs) console.error('Failed to update status:', err);
        this.lookupUpdateFailed.emit({
          type: 'status',
          name: nextName,
          message: this.extractErrorMessage(err)
        });
        this.endLookup();
      }
    });
  }

  onRenameImportance(payload: RenamePayload): void {
    const currentName = (payload?.from ?? this.buffer.doi ?? '').trim();
    const nextName = (payload?.to ?? '').trim();
    if (!currentName || !nextName) return;
    if (currentName.toLowerCase() === nextName.toLowerCase()) return;
    const current = this.findLookupByName(this.importanceLookups, currentName);
    if (!current?.id) {
      this.lookupUpdateFailed.emit({
        type: 'importance',
        name: nextName,
        message: 'Importance not found'
      });
      return;
    }
    const conflict = this.findLookupByName(this.importanceLookups, nextName);
    if (conflict && conflict.id !== current.id) {
      this.lookupUpdateFailed.emit({
        type: 'importance',
        name: nextName,
        message: 'Name already exists'
      });
      return;
    }
    if (!this.tryBeginLookup()) return;
    this.api.updateDegreeOfImportance(current.id, nextName).subscribe({
      next: updated => {
        const item = { id: current.id, name: updated?.name ?? nextName };
        this.importanceLookups = this.updateLookupList(this.importanceLookups, item);
        this.importances = this.lookupOptions(this.importanceLookups);
        this.buffer.doi = this.lookupLabel(
          this.importanceLookups.find(entry => entry.id === item.id) ?? item
        );
        this.buffer.degreeOfImportanceId = item.id;
        this.lookupUpdated.emit({ type: 'importance', item });
        this.endLookup();
      },
      error: err => {
        if (environment.enableDebugLogs) console.error('Failed to update importance:', err);
        this.lookupUpdateFailed.emit({
          type: 'importance',
          name: nextName,
          message: this.extractErrorMessage(err)
        });
        this.endLookup();
      }
    });
  }

  onRenameAssignee(payload: RenamePayload): void {
    const currentName = (payload?.from ?? this.buffer.assignTo ?? '').trim();
    const nextName = (payload?.to ?? '').trim();
    if (!currentName || !nextName) return;
    if (currentName.toLowerCase() === nextName.toLowerCase()) return;
    if (this.hasName(this.peopleOptions, nextName)) {
      this.buffer.assignTo = nextName;
      return;
    }
    this.peopleOptions = this.replaceOption(this.peopleOptions, currentName, nextName);
    this.buffer.assignTo = nextName;
  }

  onRenameInCharge(payload: RenamePayload): void {
    const currentName = (payload?.from ?? this.buffer.inCharge ?? '').trim();
    const nextName = (payload?.to ?? '').trim();
    if (!currentName || !nextName) return;
    if (currentName.toLowerCase() === nextName.toLowerCase()) return;
    if (this.hasName(this.peopleOptions, nextName)) {
      this.buffer.inCharge = nextName;
      return;
    }
    this.peopleOptions = this.replaceOption(this.peopleOptions, currentName, nextName);
    this.buffer.inCharge = nextName;
  }

  onSave(): void {
    if (this.pendingLookups > 0) {
      this.deferSave = true;
      this.saveDeferred.emit();
      return;
    }
    this.emitSave();
  }

  onDelete(): void {
    this.delete.emit();
  }

  protected lookupLabel(item: IdName | null | undefined): string {
    return resolveTenderProjectLookupDisplayLabel(item) ?? item?.name ?? '';
  }

  protected lookupOptions(list: IdName[]): string[] {
    return (list ?? []).map(item => this.lookupLabel(item));
  }

  protected findLookupByName(list: IdName[], name: string): IdName | null {
    return findTenderProjectLookupByName(list, name);
  }

  protected updateLookupList(list: IdName[], item: IdName): IdName[] {
    const index = list.findIndex(entry => entry.id === item.id);
    if (index === -1) return [...list, item];
    const next = [...list];
    next[index] = { ...next[index], ...item };
    return next;
  }

  private hasName(list: string[], name: string): boolean {
    const key = name.trim().toLowerCase();
    return list.some(item => item.trim().toLowerCase() === key);
  }

  private replaceOption(list: string[], from: string, to: string): string[] {
    const fromKey = from.trim().toLowerCase();
    const toKey = to.trim().toLowerCase();
    const next = list.map(item => (item.trim().toLowerCase() === fromKey ? to : item));
    const seen = new Set<string>();
    const output: string[] = [];
    for (const item of next) {
      const key = item.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      output.push(item);
    }
    if (!seen.has(toKey) && toKey) output.push(to);
    return output;
  }

  private beginLookup(): void {
    this.pendingLookups += 1;
  }

  private tryBeginLookup(): boolean {
    if (this.pendingLookups > 0) {
      return false;
    }
    this.beginLookup();
    return true;
  }

  private endLookup(): void {
    this.pendingLookups = Math.max(0, this.pendingLookups - 1);
    if (this.pendingLookups === 0 && this.deferSave) {
      this.deferSave = false;
      this.emitSave();
    }
  }

  private emitSave(): void {
    this.save.emit({ ...this.buffer });
  }
}
