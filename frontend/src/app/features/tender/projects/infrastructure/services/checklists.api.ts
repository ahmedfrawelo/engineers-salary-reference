import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiClient } from '@infrastructure/http/api-client.service';
import { unwrapApiResponse, ApiResponseLike } from '@infrastructure/http/api-response.util';
import { TENDER_PROJECTS_ENDPOINTS } from './tender-projects-endpoints';

export type CheckList = {
  id: number;
  name: string;
  isCompleted: boolean;
  notes: string | null;
  assignedTo: string | null;
  projectId: number;
  tone?: string | null;
  customLabel?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type ApiResponse<T> = ApiResponseLike<T>;

export type CreateCheckListDto = {
  name: string;
  isCompleted: boolean;
  notes?: string | null;
  assignedTo?: string | null;
  projectId: number;
  tone?: string | null;
  customLabel?: string | null;
};

export type UpdateCheckListDto = {
  id: number;
  name?: string | null;
  isCompleted?: boolean | null;
  notes?: string | null;
  assignedTo?: string | null;
};

@Injectable({ providedIn: 'root' })
export class CheckListsApi {
  private api = inject(ApiClient);

  getByProjectId(projectId: number, cacheBust: number = Date.now()): Observable<CheckList[]> {
    return this.api
      .get<ApiResponse<CheckList[]>>(TENDER_PROJECTS_ENDPOINTS.projectChecklists(projectId), {
        _: cacheBust
      })
      .pipe(map(res => unwrapApiResponse(res) ?? []));
  }

  create(payload: CreateCheckListDto): Observable<CheckList> {
    return this.api
      .post<
        ApiResponse<CheckList>
      >(TENDER_PROJECTS_ENDPOINTS.projectChecklists(payload.projectId), payload)
      .pipe(map(res => unwrapApiResponse(res)));
  }

  update(projectId: number, id: number, payload: UpdateCheckListDto): Observable<CheckList> {
    return this.api
      .put<
        ApiResponse<CheckList>
      >(TENDER_PROJECTS_ENDPOINTS.projectChecklistById(projectId, id), payload)
      .pipe(map(res => unwrapApiResponse(res)));
  }

  toggleCompleted(projectId: number, id: number): Observable<CheckList> {
    return this.api
      .patch<
        ApiResponse<CheckList>
      >(TENDER_PROJECTS_ENDPOINTS.projectChecklistToggle(projectId, id), {})
      .pipe(map(res => unwrapApiResponse(res)));
  }

  delete(projectId: number, id: number): Observable<void> {
    return this.api
      .delete<ApiResponse<null>>(TENDER_PROJECTS_ENDPOINTS.projectChecklistById(projectId, id))
      .pipe(map(() => void 0));
  }
}
