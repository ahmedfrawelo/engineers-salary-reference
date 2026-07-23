import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiClient } from '@infrastructure/http/api-client.service';
import { ApiResponseLike, unwrapApiResponse } from '@infrastructure/http/api-response.util';
import { TENDER_PROJECTS_ENDPOINTS } from './tender-projects-endpoints';

type LooseValue = ReturnType<typeof JSON.parse>;
export type CommentMention = {
  id?: string;
  name?: string;
  email?: string;
  handle?: string;
};

export type CreateProjectCommentPayload = {
  projectId: number;
  message: string;
  mentions?: CommentMention[];
  entityName?: string;
  entityId?: number | string;
  projectTitle?: string | null;
};

export type ProjectCommentResponse = {
  id?: number | string;
  message?: string;
  createdAt?: string;
  userName?: string;
  raw?: unknown;
};

@Injectable({ providedIn: 'root' })
export class ProjectCommentsApi {
  private api = inject(ApiClient);

  create(payload: CreateProjectCommentPayload): Observable<ProjectCommentResponse> {
    const normalizedMentions = (payload.mentions ?? [])
      .map(m => ({ userId: m.id ?? undefined, id: m.id ?? undefined }))
      .filter(m => m.userId);

    return this.api
      .post<ApiResponseLike<LooseValue>>(
        TENDER_PROJECTS_ENDPOINTS.projectComments(payload.projectId),
        {
          message: payload.message,
          mentions: normalizedMentions
        }
      )
      .pipe(map(res => this.mapResponse(res, payload.message)));
  }

  private mapResponse(
    response: ApiResponseLike<LooseValue>,
    fallbackMessage: string
  ): ProjectCommentResponse {
    const unwrapped = unwrapApiResponse(response);
    if (unwrapped && typeof unwrapped === 'object') {
      const record = unwrapped as Record<string, unknown>;
      return {
        id: (record.id ?? record.Id ?? record.commentId ?? record.noteId) as
          | number
          | string
          | undefined,
        message: (record.message ??
          record.note ??
          record.description ??
          record.details ??
          fallbackMessage) as string | undefined,
        createdAt: (record.createdAt ?? record.createdOn ?? record.timestamp ?? record.date) as
          | string
          | undefined,
        userName: (record.userName ?? record.createdBy ?? record.performedBy ?? record.user) as
          | string
          | undefined,
        raw: response
      };
    }
    return { message: fallbackMessage, raw: response };
  }
}
