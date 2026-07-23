import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { CheckListsApi } from '../infrastructure/services/checklists.api';
import type {
  CheckList,
  CreateCheckListDto,
  UpdateCheckListDto
} from './page/tender-projects.contracts';

@Injectable({ providedIn: 'root' })
export class TenderProjectChecklistsFacade {
  private readonly checklistsApi = inject(CheckListsApi);

  getByProjectId(projectId: number): Observable<CheckList[]> {
    return this.checklistsApi.getByProjectId(projectId);
  }

  create(payload: CreateCheckListDto): Observable<CheckList> {
    return this.checklistsApi.create(payload);
  }

  update(projectId: number, id: number, payload: UpdateCheckListDto): Observable<CheckList> {
    return this.checklistsApi.update(projectId, id, payload);
  }

  delete(projectId: number, id: number): Observable<void> {
    return this.checklistsApi.delete(projectId, id);
  }
}
