import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiClient } from '@infrastructure/http/api-client.service';
import { ApiResponseLike, isApiResponse } from '@infrastructure/http/api-response.util';
import type { SharedSavedFilterDefinition, SharedSavedFilterItem } from '../models';
import { normalizeSharedSavedFilterDefinition } from './page-design.saved-filters';

type LooseRecord = Record<string, unknown>;
type SavedFilterListResponse = ApiResponseLike<unknown>;
type SavedFilterItemResponse = ApiResponseLike<unknown>;

type UpsertSavedFilterPayload = {
  pageKey: string;
  name: string;
  definition: SharedSavedFilterDefinition;
};

const SAVED_FILTERS_ENDPOINT = 'saved-filters';

const toRecord = (value: unknown): LooseRecord => (value ?? {}) as LooseRecord;

const hasOwn = (obj: LooseRecord, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

const readProp = <T = unknown>(obj: LooseRecord, keys: string[]): T | undefined => {
  for (const key of keys) {
    if (hasOwn(obj, key)) {
      return obj[key] as T;
    }
  }
  return undefined;
};

const readPayloadData = (payload: unknown): unknown => {
  if (isApiResponse<unknown>(payload as ApiResponseLike<unknown>)) {
    return readProp(toRecord(payload), ['data', 'Data']);
  }
  return payload;
};

const normalizeSavedFilterDefinition = (value: unknown): SharedSavedFilterDefinition => {
  const normalized = normalizeSharedSavedFilterDefinition(
    toRecord(value) as SharedSavedFilterDefinition
  );
  return normalized ?? { groups: [] };
};

const normalizeSavedFilter = (value: unknown): SharedSavedFilterItem | null => {
  const record = toRecord(value);
  const id = Number(readProp(record, ['id', 'Id']) ?? 0);
  const pageKey = String(readProp(record, ['pageKey', 'PageKey']) ?? '').trim();
  const name = String(readProp(record, ['name', 'Name']) ?? '').trim();

  if (!Number.isFinite(id) || id <= 0 || !pageKey || !name) {
    return null;
  }

  return {
    id,
    pageKey,
    name,
    definition: normalizeSavedFilterDefinition(readProp(record, ['definition', 'Definition'])),
    createdAt: String(readProp(record, ['createdAt', 'CreatedAt']) ?? '').trim() || null,
    updatedAt: String(readProp(record, ['updatedAt', 'UpdatedAt']) ?? '').trim() || null
  };
};

const normalizeSavedFilterList = (payload: unknown): SharedSavedFilterItem[] => {
  const data = readPayloadData(payload);
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map(item => normalizeSavedFilter(item))
    .filter((item): item is SharedSavedFilterItem => !!item);
};

const normalizeSavedFilterItem = (payload: unknown): SharedSavedFilterItem => {
  const item = normalizeSavedFilter(readPayloadData(payload));
  if (!item) {
    return {
      id: 0,
      pageKey: '',
      name: '',
      definition: { groups: [] },
      createdAt: null,
      updatedAt: null
    };
  }
  return item;
};

@Injectable({ providedIn: 'root' })
export class PageDesignSavedFiltersApi {
  private readonly api = inject(ApiClient);

  list(pageKey: string): Observable<SharedSavedFilterItem[]> {
    return this.api
      .get<SavedFilterListResponse>(SAVED_FILTERS_ENDPOINT, { pageKey })
      .pipe(map(payload => normalizeSavedFilterList(payload)));
  }

  save(payload: UpsertSavedFilterPayload): Observable<SharedSavedFilterItem> {
    return this.api
      .post<SavedFilterItemResponse>(SAVED_FILTERS_ENDPOINT, payload)
      .pipe(map(response => normalizeSavedFilterItem(response)));
  }

  remove(id: number): Observable<void> {
    return this.api
      .delete<ApiResponseLike<null> | null>(`${SAVED_FILTERS_ENDPOINT}/${id}`)
      .pipe(map(() => void 0));
  }
}
