export interface OnlineUser {
  sessionId: string;
  userId: string;
  name: string;
  email: string;
  roles: string[];
  currentPage: string;
  pageTitle: string;
  device: 'desktop' | 'mobile' | 'tablet';
  ip: string;
  browser: string;
  os: string;
  timezone: string;
  language: string;
  latitude?: number;
  longitude?: number;
  locationAccuracy?: number;
  connectedAt: number;
  lastSeenAt: number;
}

export interface PresenceHeartbeatPayload {
  sessionId: string;
  page: string;
  pageTitle: string;
  device: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  os: string;
  timezone: string;
  language: string;
  latitude?: number;
  longitude?: number;
  locationAccuracy?: number;
}

export interface PresenceLeavePayload {
  sessionId: string;
}

export interface PresenceSnapshot {
  users: OnlineUser[];
  timestamp: number;
}
