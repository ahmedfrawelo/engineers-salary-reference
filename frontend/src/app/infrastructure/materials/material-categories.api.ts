import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { ApiClient } from '@infrastructure/http/api-client.service';
import { environment } from '@env/environment';
import { ApiResponse, unwrapApiResponse } from '@infrastructure/http/api-response.util';

type LooseValue = ReturnType<typeof JSON.parse>;

// ? Material Category ?? ??? Swagger
export interface MaterialCategory {
  id: number;
  name: string;
}

export interface CreateMaterialCategoryDto {
  name: string;
}

export interface UpdateMaterialCategoryDto {
  id: number;
  name: string;
}

export type ListParams = {
  pageNumber?: number;
  pageSize?: number;
};

@Injectable({ providedIn: 'root' })
export class MaterialCategoriesApi {
  private api = inject(ApiClient);
  private readonly mockMode = environment.useMock;
  private readonly defaultListParams: ListParams = { pageNumber: 1, pageSize: 200 };
  private readonly resourcePath = environment.materialCategoriesResource ?? 'material-categories';

  // GET /api/MaterialCategories
  list(params: ListParams = this.defaultListParams): Observable<MaterialCategory[]> {
    if (this.mockMode) {
      return of([]);
    }
    return this.api
      .get<ApiResponse<MaterialCategory[]> | MaterialCategory[]>(this.resourcePath, params)
      .pipe(
        map(res => this.normalizeMaterialCategoriesList(res)),
        catchError(err => {
          console.error('[MaterialCategoriesApi] List failed:', err);
          return throwError(() => err);
        })
      );
  }

  // GET /api/MaterialCategories/{id}
  get(id: number): Observable<MaterialCategory> {
    if (this.mockMode) {
      return of({ id, name: 'Mock Category' });
    }
    return this.api
      .get<ApiResponse<MaterialCategory> | MaterialCategory>(`${this.resourcePath}/${id}`)
      .pipe(
        map(res => unwrapApiResponse(res)),
        catchError(err => {
          console.error(`[MaterialCategoriesApi] Get ${id} failed:`, err);
          return throwError(() => err);
        })
      );
  }

  // POST /api/MaterialCategories
  create(dto: CreateMaterialCategoryDto): Observable<MaterialCategory> {
    if (this.mockMode) {
      return of({ id: Date.now(), name: dto.name });
    }
    return this.api
      .post<ApiResponse<MaterialCategory> | MaterialCategory>(this.resourcePath, dto)
      .pipe(
        map(res => unwrapApiResponse(res)),
        catchError(err => {
          console.error('[MaterialCategoriesApi] Create failed:', err);
          return throwError(() => err);
        })
      );
  }

  // PUT /api/MaterialCategories/{id}
  update(id: number, dto: UpdateMaterialCategoryDto): Observable<MaterialCategory> {
    if (this.mockMode) {
      return of({ id: dto.id, name: dto.name });
    }
    return this.api
      .put<ApiResponse<MaterialCategory> | MaterialCategory>(`${this.resourcePath}/${id}`, dto)
      .pipe(
        map(res => unwrapApiResponse(res)),
        catchError(err => {
          console.error(`[MaterialCategoriesApi] Update ${id} failed:`, err);
          return throwError(() => err);
        })
      );
  }

  // DELETE /api/MaterialCategories/{id}
  remove(id: number): Observable<void> {
    if (this.mockMode) {
      return of(undefined);
    }
    return this.api.delete<ApiResponse<null> | null>(`${this.resourcePath}/${id}`).pipe(
      map(() => undefined),
      catchError(err => {
        console.error(`[MaterialCategoriesApi] Delete ${id} failed:`, err);
        return throwError(() => err);
      })
    );
  }

  // ? Helper: Find or Create by name
  findOrCreate(name: string): Observable<MaterialCategory> {
    if (!name || !name.trim()) {
      return throwError(() => new Error('Material category name is required'));
    }

    const trimmedName = name.trim();
    const normalizedName = trimmedName.toLowerCase();

    return this.list({ pageNumber: 1, pageSize: 10000 }).pipe(
      map(categories => categories.find(c => c.name.toLowerCase() === normalizedName) ?? null),
      catchError(err => {
        console.error('[MaterialCategoriesApi] List failed for findOrCreate:', err);
        return of(null);
      }),
      switchMap(existing => (existing ? of(existing) : this.create({ name: trimmedName }))),
      catchError(err => {
        console.error('[MaterialCategoriesApi] findOrCreate failed:', err);
        return throwError(() => err);
      })
    );
  }

  private normalizeMaterialCategoriesList(
    payload: ApiResponse<MaterialCategory[]> | MaterialCategory[] | LooseValue
  ): MaterialCategory[] {
    const unwrapped = unwrapApiResponse(payload);
    const list = this.extractList(unwrapped);
    return list
      .map(raw => this.normalizeMaterialCategory(raw))
      .filter((category): category is MaterialCategory => Boolean(category && category.name));
  }

  private extractList(value: LooseValue): LooseValue[] {
    if (Array.isArray(value)) {
      return value;
    }
    if (value?.items && Array.isArray(value.items)) {
      return value.items;
    }
    if (value?.result && Array.isArray(value.result)) {
      return value.result;
    }
    if (value?.results && Array.isArray(value.results)) {
      return value.results;
    }
    if (value?.list && Array.isArray(value.list)) {
      return value.list;
    }
    if (value?.rows && Array.isArray(value.rows)) {
      return value.rows;
    }
    if (value?.data && Array.isArray(value.data)) {
      return value.data;
    }
    if (value?.data?.items && Array.isArray(value.data.items)) {
      return value.data.items;
    }
    if (value?.data?.result && Array.isArray(value.data.result)) {
      return value.data.result;
    }
    if (value?.data?.results && Array.isArray(value.data.results)) {
      return value.data.results;
    }
    return [];
  }

  private normalizeMaterialCategory(value: LooseValue): MaterialCategory | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const id = Number(value['id'] ?? value['Id'] ?? value['materialCategoryId'] ?? 0);
    const rawName = value['name'] ?? value['Name'] ?? value['materialCategory'] ?? '';
    const name = String(rawName ?? '').trim();
    if (!name) {
      return null;
    }

    return {
      id: Number.isFinite(id) && id > 0 ? id : 0,
      name
    };
  }
}
