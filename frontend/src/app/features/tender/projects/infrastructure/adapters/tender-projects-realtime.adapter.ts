import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable } from 'rxjs';
import { WebSocketService } from '@infrastructure/realtime/websocket.service';
import { runtimeConfig } from '@core/runtime-config';
import { environment } from '@env/environment';
import type { ProjectsRealtimePort } from '../../application/ports/projects-realtime.port';

export function supportsSalaryReportEventStream(baseUrl: string): boolean {
  try {
    return !new URL(baseUrl).hostname.endsWith('.workers.dev');
  } catch {
    // Relative development API URLs are served by the ASP.NET backend, which
    // supports the salary report event stream.
    return true;
  }
}

@Injectable({ providedIn: 'root' })
export class TenderProjectsRealtimeAdapter implements ProjectsRealtimePort {
  private readonly websocket = inject(WebSocketService);

  streamAll(): Observable<unknown> {
    if (this.isSalaryReportsRoute()) {
      return this.streamSalaryReportEvents();
    }

    return this.websocket.onAll();
  }

  private streamSalaryReportEvents(): Observable<unknown> {
    const runtime = runtimeConfig();
    const baseUrl = String(runtime.apiBaseUrl ?? environment.API_BASE_URL ?? '/api').replace(/\/+$/, '');

    // The public Worker API intentionally has no durable event broker. Opening
    // an EventSource there only produces a browser-visible 404 on every visit.
    if (!supportsSalaryReportEventStream(baseUrl)) {
      return EMPTY;
    }

    return new Observable(observer => {
      if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
        observer.complete();
        return undefined;
      }

      const source = new EventSource(`${baseUrl}/salary-reports/events`);
      source.onmessage = event => {
        try {
          observer.next(JSON.parse(event.data) as unknown);
        } catch {
          // Ignore malformed events; EventSource stays connected for later valid messages.
        }
      };

      return () => source.close();
    });
  }

  private isSalaryReportsRoute(): boolean {
    return typeof window !== 'undefined' && window.location.pathname.startsWith('/salary-reports');
  }
}
