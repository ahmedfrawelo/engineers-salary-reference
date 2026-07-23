import type { Observable } from 'rxjs';

export interface ProjectsRealtimePort {
  streamAll(): Observable<unknown>;
}
