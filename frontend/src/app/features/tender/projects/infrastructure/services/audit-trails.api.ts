import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiClient } from '@infrastructure/http/api-client.service';
import { unwrapApiResponse, ApiResponseLike } from '@infrastructure/http/api-response.util';

export type AuditTrail = {
  id?: number;
  entityName?: string | null;
  entityId?: number | string | null;
  actionType?: string | null;
  action?: string | null;
  message?: string | null;
  description?: string | null;
  details?: string | null;
  createdAt?: string | null;
  createdOn?: string | null;
  timestamp?: string | null;
  userName?: string | null;
  user?: string | null;
  performedBy?: string | null;
  createdBy?: string | null;
  [key: string]: unknown;
};

type ApiResponse<T> = ApiResponseLike<T>;

@Injectable({ providedIn: 'root' })
export class AuditTrailsApi {
  private api = inject(ApiClient);

  create(payload: AuditTrail): Observable<AuditTrail> {
    return this.api
      .post<ApiResponse<AuditTrail> | AuditTrail>('audit-trails', payload)
      .pipe(map(res => unwrapApiResponse(res)));
  }

  // GET /api/AuditTrails
  getAll(): Observable<AuditTrail[]> {
    return this.api
      .get<ApiResponse<AuditTrail[]>>('audit-trails')
      .pipe(map(res => unwrapApiResponse(res) ?? []));
  }

  // GET /api/AuditTrails/{id}
  getById(id: number): Observable<AuditTrail> {
    return this.api
      .get<ApiResponse<AuditTrail>>(`audit-trails/${id}`)
      .pipe(map(res => unwrapApiResponse(res)));
  }

  // GET /api/AuditTrails/user/{userId}
  getByUserId(userId: number): Observable<AuditTrail[]> {
    return this.api
      .get<ApiResponse<AuditTrail[]>>(`audit-trails/user/${userId}`)
      .pipe(map(res => unwrapApiResponse(res) ?? []));
  }

  // GET /api/AuditTrails/entity/{entityName}
  getByEntityName(entityName: string): Observable<AuditTrail[]> {
    const encoded = encodeURIComponent(entityName);
    return this.api
      .get<ApiResponse<AuditTrail[]>>(`audit-trails/entity/${encoded}`)
      .pipe(map(res => unwrapApiResponse(res) ?? []));
  }

  // GET /api/AuditTrails/actiontypes
  getActionTypes(): Observable<string[]> {
    return this.api
      .get<ApiResponse<string[]>>('audit-trails/action-types')
      .pipe(map(res => unwrapApiResponse(res) ?? []));
  }

  // GET /api/AuditTrails/action/{actionType}
  getByActionType(actionType: string): Observable<AuditTrail[]> {
    const encoded = encodeURIComponent(actionType);
    return this.api
      .get<ApiResponse<AuditTrail[]>>(`audit-trails/action/${encoded}`)
      .pipe(map(res => unwrapApiResponse(res) ?? []));
  }
}
