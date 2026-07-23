import { Injectable, inject } from '@angular/core';
import { defer, type Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { UsersApi } from '@infrastructure/users/users.api';
import type { DirectoryUser } from './page/tender-projects.contracts';

@Injectable({ providedIn: 'root' })
export class TenderProjectDirectoryFacade {
  private readonly usersApi = inject(UsersApi);
  private usersList$: Observable<DirectoryUser[]> | null = null;

  list(): Observable<DirectoryUser[]> {
    if (!this.usersList$) {
      this.usersList$ = defer(() => this.usersApi.list()).pipe(
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }

    return this.usersList$;
  }

  refresh(): Observable<DirectoryUser[]> {
    this.usersList$ = null;
    return this.list();
  }
}
