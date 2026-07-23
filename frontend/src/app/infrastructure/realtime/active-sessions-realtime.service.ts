import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { OnlineUser } from '@platform/angular/realtime/presence.models';
import { PresenceService } from '@platform/angular/realtime/presence.service';
import { WebSocketService } from '@platform/angular/realtime/websocket.service';
import type { Observable } from 'rxjs';

export type ActiveSessionsOnlineUser = OnlineUser;

export interface ActiveSessionsGeoApiResponse {
  success?: boolean;
  country?: string;
  country_code?: string;
  city?: string;
  region?: string;
  connection?: {
    isp?: string;
    org?: string;
  };
  flag?: {
    emoji?: string;
  };
}

export interface ActiveSessionsReverseGeoResponse {
  address?: {
    road?: string;
    pedestrian?: string;
    footway?: string;
    path?: string;
    house_number?: string;
    suburb?: string;
    neighbourhood?: string;
    quarter?: string;
    city_district?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    country?: string;
  };
  display_name?: string;
}

@Injectable({ providedIn: 'root' })
export class ActiveSessionsRealtimeService {
  private readonly presenceService = inject(PresenceService);
  private readonly wsService = inject(WebSocketService);
  private readonly http = inject(HttpClient);

  readonly onlineUsers = this.presenceService.onlineUsers;
  readonly onlineCount = this.presenceService.onlineCount;
  readonly wsConnected = this.wsService.connected;

  requestSnapshot(): void {
    this.presenceService.requestSnapshot();
  }

  fetchGeo(ip: string): Observable<ActiveSessionsGeoApiResponse> {
    return this.http.get<ActiveSessionsGeoApiResponse>(`https://ipwho.is/${ip}`);
  }

  fetchReverseGeo(lat: number, lng: number): Observable<ActiveSessionsReverseGeoResponse> {
    return this.http.get<ActiveSessionsReverseGeoResponse>(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
  }
}
