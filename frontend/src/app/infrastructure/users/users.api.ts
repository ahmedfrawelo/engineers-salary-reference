import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiClient } from '@infrastructure/http/api-client.service';
import { environment } from '../../../environments/environment';
import { runtimeConfig } from '../../core/runtime-config';

type LooseValue = ReturnType<typeof JSON.parse>;
export type DirectoryUser = {
  id?: string;
  name: string;
  email?: string;
  handle?: string;
};

@Injectable({ providedIn: 'root' })
export class UsersApi {
  private api = inject(ApiClient);
  private readonly initialRuntime = runtimeConfig();

  private get mockMode(): boolean {
    const current = runtimeConfig();
    const runtimeFlag = current.useMock ?? this.initialRuntime.useMock;
    return Boolean(runtimeFlag ?? environment.useMock);
  }

  list(): Observable<DirectoryUser[]> {
    if (this.mockMode) {
      return of([]);
    }
    return this.api.get<LooseValue>('Users').pipe(
      map(res => this.mapUsers(res)),
      catchError(() =>
        this.api.get<LooseValue>('Users/paged', { page: 1, pageSize: 200 }).pipe(
          map(res => this.mapUsers(res)),
          catchError(() => of([]))
        )
      )
    );
  }

  private mapUsers(response: LooseValue): DirectoryUser[] {
    const raw = this.extractUsers(response);
    if (!raw.length) {
      return [];
    }
    const mapped = raw
      .map(user => this.mapUser(user))
      .filter((user): user is DirectoryUser => !!user);
    const seen = new Set<string>();
    const output: DirectoryUser[] = [];
    for (const user of mapped) {
      const key = (user.email || user.id || user.name).toLowerCase();
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      output.push(user);
    }
    return output;
  }

  private mapUser(user: LooseValue): DirectoryUser | null {
    if (!user) {
      return null;
    }
    const base = this.unwrapUser(user);
    const name = this.resolveUserName(base);
    const email = this.resolveUserEmail(base);
    const id = this.resolveUserId(base);
    const display = name || (email ? email.split('@')[0] : '');
    if (!display) {
      return null;
    }
    return {
      id: id ?? undefined,
      name: display,
      email: email || undefined
    };
  }

  private extractUsers(response: LooseValue): LooseValue[] {
    if (!response) {
      return [];
    }
    if (Array.isArray(response)) {
      return response;
    }
    const direct =
      response.data ??
      response.Data ??
      response.items ??
      response.Items ??
      response.users ??
      response.Users ??
      response.result ??
      response.Result ??
      response.payload ??
      response.Payload ??
      response.value ??
      response.Value;
    if (Array.isArray(direct)) {
      return direct;
    }
    if (direct && typeof direct === 'object') {
      const nested =
        direct.items ?? direct.Items ?? direct.users ?? direct.Users ?? direct.data ?? direct.Data;
      if (Array.isArray(nested)) {
        return nested;
      }
    }
    return [];
  }

  private resolveUserName(user: LooseValue): string {
    const direct =
      user?.fullName ??
      user?.FullName ??
      user?.displayName ??
      user?.DisplayName ??
      user?.name ??
      user?.Name ??
      user?.userName ??
      user?.UserName ??
      user?.username ??
      user?.Username ??
      '';
    const normalized = this.normalizeText(direct);
    if (normalized) {
      return normalized;
    }
    const first = this.normalizeText(
      user?.firstName ??
        user?.FirstName ??
        user?.givenName ??
        user?.GivenName ??
        user?.name?.first ??
        user?.name?.First
    );
    const last = this.normalizeText(
      user?.lastName ??
        user?.LastName ??
        user?.familyName ??
        user?.FamilyName ??
        user?.name?.last ??
        user?.name?.Last
    );
    return [first, last].filter(Boolean).join(' ').trim();
  }

  private resolveUserEmail(user: LooseValue): string {
    const email =
      user?.email ??
      user?.Email ??
      user?.emailAddress ??
      user?.EmailAddress ??
      user?.userEmail ??
      user?.UserEmail ??
      user?.user_email ??
      user?.User_Email ??
      user?.userName ??
      user?.UserName ??
      user?.username ??
      user?.Username ??
      '';
    return this.normalizeText(email);
  }

  private resolveUserId(user: LooseValue): string | null {
    const id = user?.id ?? user?.Id ?? user?.userId ?? user?.UserId ?? user?.uid ?? user?.UID;
    if (id === null || id === undefined) {
      return null;
    }
    return typeof id === 'string' ? id : String(id);
  }

  private unwrapUser(payload: LooseValue): LooseValue {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return payload;
    }
    const candidates = [
      payload,
      payload.user,
      payload.User,
      payload.profile,
      payload.Profile,
      payload.account,
      payload.Account,
      payload.details,
      payload.Details
    ];
    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        continue;
      }
      if (this.hasUserIdentityFields(candidate)) {
        return candidate;
      }
    }
    return payload;
  }

  private hasUserIdentityFields(user: LooseValue): boolean {
    return Boolean(
      user?.id ??
      user?.Id ??
      user?.userId ??
      user?.UserId ??
      user?.email ??
      user?.Email ??
      user?.userName ??
      user?.UserName ??
      user?.username ??
      user?.Username ??
      user?.fullName ??
      user?.FullName ??
      user?.name ??
      user?.Name
    );
  }

  private normalizeText(value: LooseValue): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return value.trim();
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    const candidate =
      value?.name ??
      value?.Name ??
      value?.label ??
      value?.Label ??
      value?.title ??
      value?.Title ??
      value?.text ??
      value?.Text;
    if (typeof candidate === 'string') {
      return candidate.trim();
    }
    return String(value).trim();
  }
}
