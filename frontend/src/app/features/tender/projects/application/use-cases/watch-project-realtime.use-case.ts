import type { Observable } from 'rxjs';
import type { ProjectsRealtimePort } from '../ports/projects-realtime.port';

export class WatchProjectRealtimeUseCase {
  constructor(private readonly realtimePort: ProjectsRealtimePort) {}

  execute(): Observable<unknown> {
    return this.realtimePort.streamAll();
  }
}
