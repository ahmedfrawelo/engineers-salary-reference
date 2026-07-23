import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { PageDesignComponent } from '@shared/ui/page-design';
import { AppGridShellComponent } from '@shared/general-list/grid-shell/app-grid-shell.component';
import { DataGridModule, GridColumn, GridConfig } from '@shared/data-grid';
import { AppIconDirective } from '@shared/icons/app-icon.directive';
import {
  ActiveSessionsRealtimeService,
  type ActiveSessionsGeoApiResponse,
  type ActiveSessionsOnlineUser,
  type ActiveSessionsReverseGeoResponse
} from '@infrastructure/realtime/active-sessions-realtime.service';

/* ── geo types ───────────────────────────────────────────────── */

interface GeoInfo {
  country: string;
  country_code: string;
  city: string;
  region: string;
  isp: string;
  flag_emoji: string;
}

interface SessionGridRow extends ActiveSessionsOnlineUser {
  _place: string | null;
  _geo: GeoInfo | null;
  _duration: string;
  _lastSeenTime: string;
}

function isPrivateIp(ip: string): boolean {
  if (!ip || ip === 'Unknown') return true;
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip.startsWith('fc') ||
    ip.startsWith('fd')
  );
}

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return '🌐';
  const base = 0x1f1e6;
  return String.fromCodePoint(
    base + code.toUpperCase().charCodeAt(0) - 65,
    base + code.toUpperCase().charCodeAt(1) - 65
  );
}

const PAGE_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/tender': 'Tender Projects',
  '/tasks': 'Tasks',
  '/account': 'Account',
  '/settings': 'Settings',
  '/settings/access-control': 'Access Control',
  '/settings/appearance': 'Appearance',
  '/settings/active-sessions': 'Active Sessions',
  '/settings/material-classification': 'Material Classification',
  '/tender/material-classification': 'Material Classification',
  '/login': 'Login'
};

function resolvePageLabel(page: string): string {
  if (!page) return '—';
  if (PAGE_LABELS[page]) return PAGE_LABELS[page];
  const prefix = Object.keys(PAGE_LABELS)
    .filter(k => k !== '/' && page.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return prefix ? PAGE_LABELS[prefix] : page;
}

function initials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

const AVATAR_PALETTE = [
  '99,102,241',
  '168,85,247',
  '236,72,153',
  '20,184,166',
  '245,158,11',
  '239,68,68',
  '59,130,246',
  '249,115,22'
];

function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h << 5) - h + id.charCodeAt(i);
    h |= 0;
  }
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

const PAGE_MODULE_COLOR: Record<string, string> = {
  tender: '59,130,246',
  tasks: '168,85,247',
  stores: '20,184,166',
  hr: '245,158,11',
  crm: '236,72,153',
  operations: '249,115,22',
  settings: '99,102,241',
  dashboard: '16,185,129'
};

function pageModuleColor(page: string): string {
  for (const [key, color] of Object.entries(PAGE_MODULE_COLOR)) {
    if (page.includes(key)) return color;
  }
  return '99,102,241';
}

/* ── component ───────────────────────────────────────────────── */

@Component({
  standalone: true,
  selector: 'active-sessions-page',
  imports: [PageDesignComponent, AppGridShellComponent, DataGridModule, AppIconDirective],
  template: `
    <engineers-salary-reference-page-design
      class="proj-page toolbar-soft-rect-actions"
      title="Active Sessions"
      sub="Real-time presence tracking — who's online, where, and what they're doing."
      icon="user-multiple"
      toolbarAriaLabel="Active sessions toolbar"
      [sharedToolbarSearchOnly]="true"
      [sharedToolbarSearchPlaceholder]="'Search by name, email, page, IP…'"
      [sharedToolbarSearchVariant]="'softRect'"
      [sharedToolbarSearchValue]="searchQuery"
      (sharedToolbarSearchChanged)="searchQuery = $event"
    >
      <!-- ══ Header actions ══ -->
      <div header-actions class="as-hdr-actions">
        <div class="as-stats">
          <span class="as-stat">
            <b class="as-stat-n" style="color:var(--app-color-primary)">{{ onlineCount() }}</b>
            <span class="as-stat-l">Online</span>
          </span>
          <span class="as-stat-sep"></span>
          <span class="as-stat">
            <b class="as-stat-n">{{ uniqueUsers() }}</b>
            <span class="as-stat-l">Users</span>
          </span>
          <span class="as-stat-sep"></span>
          <span class="as-stat">
            <b class="as-stat-n">{{ desktopCount() }}</b>
            <span class="as-stat-l">🖥</span>
          </span>
          <span class="as-stat-sep"></span>
          <span class="as-stat">
            <b class="as-stat-n">{{ mobileCount() }}</b>
            <span class="as-stat-l">📱</span>
          </span>
        </div>
        <span class="as-ws-badge" [class.live]="wsConnected()" [class.dead]="!wsConnected()">
          <span class="as-ws-dot"></span>{{ wsConnected() ? 'Live' : 'Reconnecting' }}
        </span>
        <button class="as-refresh" title="Refresh" (click)="refresh()">
          <i appIcon="arrow-repeat" class="as-refresh-icon" aria-hidden="true"></i>
        </button>
      </div>

      <!-- ══ Toolbar left: device filter ══ -->
      <div toolbar-left class="as-filters">
        <button class="as-pill" [class.on]="deviceFilter === ''" (click)="deviceFilter = ''">
          All
        </button>
        <button
          class="as-pill"
          [class.on]="deviceFilter === 'desktop'"
          (click)="deviceFilter = 'desktop'"
        >
          🖥 Desktop
        </button>
        <button
          class="as-pill"
          [class.on]="deviceFilter === 'mobile'"
          (click)="deviceFilter = 'mobile'"
        >
          📱 Mobile
        </button>
        <button
          class="as-pill"
          [class.on]="deviceFilter === 'tablet'"
          (click)="deviceFilter = 'tablet'"
        >
          📋 Tablet
        </button>
        <span class="as-count"
          >{{ filteredUsers().length }} session{{ filteredUsers().length !== 1 ? 's' : '' }}</span
        >
      </div>

      <!-- ══ Data grid ══ -->
      <app-grid-shell page-table class="table-area-shell">
        <div shell-body>
          <engineers-salary-reference-data-grid
            [data]="gridData()"
            [columns]="gridColumns"
            [config]="gridConfig"
          ></engineers-salary-reference-data-grid>
        </div>
      </app-grid-shell>
    </engineers-salary-reference-page-design>
  `,
  styles: [
    `
      /* ══ HEADER ACTIONS ══ */
      .as-hdr-actions {
        display: flex;
        align-items: center;
        gap: 0.65rem;
      }
      .as-stats {
        display: flex;
        align-items: center;
      }
      .as-stat {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 0 0.65rem;
        gap: 0.03rem;
      }
      .as-stat-n {
        font-size: 1rem;
        font-weight: 700;
        line-height: 1.2;
      }
      .as-stat-l {
        font-size: 0.63rem;
        color: rgba(var(--fg), 0.42);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .as-stat-sep {
        width: 1px;
        height: 1.4rem;
        background: rgba(var(--border), 0.3);
      }

      .as-ws-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.22rem 0.6rem;
        border-radius: 999px;
        font-size: 0.72rem;
        font-weight: 600;
        border: 1px solid;
      }
      .as-ws-badge.live {
        color: rgb(16, 185, 129);
        border-color: rgba(16, 185, 129, 0.35);
        background: rgba(16, 185, 129, 0.08);
      }
      .as-ws-badge.dead {
        color: rgb(245, 158, 11);
        border-color: rgba(245, 158, 11, 0.35);
        background: rgba(245, 158, 11, 0.08);
      }
      .as-ws-dot {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: currentColor;
      }
      .as-ws-badge.live .as-ws-dot {
        animation: as-blink 2s infinite;
      }
      @keyframes as-blink {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.2;
        }
      }

      .as-refresh {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        border: 1px solid rgba(var(--border), 0.45);
        border-radius: 8px;
        background: transparent;
        color: rgba(var(--fg), 0.5);
        cursor: pointer;
        transition: all 0.15s;
      }
      .as-refresh:hover {
        background: rgba(var(--surface), 0.8);
        color: rgb(var(--fg));
      }
      .as-refresh-icon {
        width: 13px;
        height: 13px;
      }

      /* ══ TOOLBAR FILTERS ══ */
      .as-filters {
        display: flex;
        align-items: center;
        gap: 0.3rem;
      }
      .as-pill {
        padding: 0.24rem 0.65rem;
        border-radius: 999px;
        border: 1px solid rgba(var(--border), 0.38);
        background: transparent;
        color: rgba(var(--fg), 0.5);
        font-size: 0.73rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.14s;
      }
      .as-pill.on,
      .as-pill:hover {
        background: rgba(var(--primary), 0.1);
        border-color: rgba(var(--primary), 0.4);
        color: rgb(var(--primary));
      }
      .as-count {
        margin-left: 0.2rem;
        font-size: 0.73rem;
        color: rgba(var(--fg), 0.38);
        white-space: nowrap;
      }
    `
  ]
})
export class ActiveSessionsComponent implements OnInit, OnDestroy {
  private readonly realtime = inject(ActiveSessionsRealtimeService);

  readonly onlineUsers = this.realtime.onlineUsers;
  readonly onlineCount = this.realtime.onlineCount;
  readonly wsConnected = this.realtime.wsConnected;

  searchQuery = '';
  deviceFilter = '';

  /* ── IP Geo ── */
  private readonly _geoMap = signal<Map<string, GeoInfo | 'loading' | 'failed'>>(new Map());

  readonly resolvedGeo = computed(() => {
    const map = this._geoMap();
    const out = new Map<string, GeoInfo>();
    map.forEach((v, k) => {
      if (v !== 'loading' && v !== 'failed') out.set(k, v as GeoInfo);
    });
    return out;
  });

  /* ── Reverse geo ── */
  private readonly _reverseGeoMap = signal<Map<string, string | 'loading' | 'failed'>>(new Map());

  readonly resolvedPlaces = computed(() => {
    const map = this._reverseGeoMap();
    const out = new Map<string, string>();
    map.forEach((v, k) => {
      if (v !== 'loading' && v !== 'failed') out.set(k, v as string);
    });
    return out;
  });

  reverseGeoKey(lat: number, lng: number): string {
    return `${lat.toFixed(4)},${lng.toFixed(4)}`;
  }

  /* ── Derived counts ── */
  readonly uniqueUsers = computed(() => new Set(this.onlineUsers().map(u => u.userId)).size);
  readonly desktopCount = computed(
    () => this.onlineUsers().filter(u => u.device === 'desktop').length
  );
  readonly mobileCount = computed(
    () => this.onlineUsers().filter(u => u.device === 'mobile' || u.device === 'tablet').length
  );

  readonly filteredUsers = computed(() => {
    const q = this.searchQuery.toLowerCase().trim();
    const d = this.deviceFilter;
    return this.onlineUsers().filter(u => {
      const matchSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.currentPage.toLowerCase().includes(q) ||
        resolvePageLabel(u.currentPage).toLowerCase().includes(q) ||
        (u.ip ?? '').toLowerCase().includes(q) ||
        (u.browser ?? '').toLowerCase().includes(q) ||
        (u.os ?? '').toLowerCase().includes(q);
      const matchDevice = !d || u.device === d;
      return matchSearch && matchDevice;
    });
  });

  /* ── Grid data (pre-enriched for cellRenderer) ── */
  private readonly _tick = signal(0);

  readonly gridData = computed((): SessionGridRow[] => {
    this._tick(); // re-run every second for duration
    const users = this.filteredUsers();
    const geoMap = this.resolvedGeo();
    const placeMap = this.resolvedPlaces();
    const now = Date.now();

    return users.map(u => ({
      ...u,
      _geo: u.ip && !isPrivateIp(u.ip) ? (geoMap.get(u.ip) ?? null) : null,
      _place:
        u.latitude && u.longitude
          ? (placeMap.get(this.reverseGeoKey(u.latitude, u.longitude)) ?? null)
          : null,
      _duration: formatDuration(now - u.connectedAt),
      _lastSeenTime: new Date(u.lastSeenAt).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    }));
  });

  /* ── Grid config ── */
  readonly gridConfig: GridConfig = {
    simpleMode: true,
    hover: true,
    density: 'comfortable',
    selectable: false,
    emptyMessage: 'No active sessions',
    ariaLabel: 'Active sessions'
  };

  /* ── Grid columns ── */
  readonly gridColumns: GridColumn<SessionGridRow>[] = [
    {
      field: 'name',
      header: 'User',
      width: 230,
      minWidth: 180,
      sortable: true,
      cellRenderer: (_, row) => {
        const u = row as SessionGridRow;
        const color = avatarColor(u.userId || u.sessionId);

        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;align-items:center;gap:9px;padding:6px 0;';

        const avWrap = document.createElement('div');
        avWrap.style.cssText = 'position:relative;flex-shrink:0;';

        const av = document.createElement('div');
        av.style.cssText = `width:34px;height:34px;border-radius:50%;background:rgba(${color},0.12);border:1.5px solid rgba(${color},0.35);color:rgb(${color});display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.76rem;`;
        av.textContent = initials(u.name);

        const dot = document.createElement('span');
        dot.style.cssText =
          'position:absolute;bottom:0;right:0;width:8px;height:8px;border-radius:50%;background:rgb(16,185,129);border:1.5px solid var(--app-bg,#1a1a1a);';

        avWrap.append(av, dot);

        const info = document.createElement('div');
        info.style.cssText = 'display:flex;flex-direction:column;gap:2px;min-width:0;';

        const name = document.createElement('span');
        name.style.cssText =
          'font-weight:600;font-size:0.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
        name.textContent = u.name || '—';

        const email = document.createElement('span');
        email.style.cssText =
          'font-size:0.68rem;opacity:0.45;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
        email.textContent = u.email;

        info.append(name, email);

        if (u.roles?.length) {
          const rolesRow = document.createElement('div');
          rolesRow.style.cssText = 'display:flex;gap:3px;flex-wrap:wrap;margin-top:1px;';
          u.roles.slice(0, 2).forEach(r => {
            const chip = document.createElement('span');
            chip.style.cssText =
              'padding:1px 5px;border-radius:4px;font-size:0.62rem;font-weight:600;background:rgba(var(--primary),0.08);border:1px solid rgba(var(--primary),0.2);color:rgb(var(--primary));text-transform:capitalize;';
            chip.textContent = r;
            rolesRow.append(chip);
          });
          info.append(rolesRow);
        }

        wrap.append(avWrap, info);
        return wrap;
      }
    },
    {
      field: 'currentPage',
      header: 'Current Page',
      width: 185,
      minWidth: 140,
      sortable: true,
      cellRenderer: (_, row) => {
        const u = row as SessionGridRow;
        const page = u.currentPage || '';
        const color = pageModuleColor(page);
        const label = resolvePageLabel(page);

        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;padding:4px 0;';

        const pill = document.createElement('div');
        pill.style.cssText = `display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;border:1px solid rgba(${color},0.35);background:rgba(${color},0.08);font-size:0.73rem;font-weight:600;width:fit-content;max-width:100%;overflow:hidden;white-space:nowrap;`;

        const dotEl = document.createElement('span');
        dotEl.style.cssText = `width:5px;height:5px;border-radius:50%;background:rgb(${color});flex-shrink:0;`;

        const lblEl = document.createElement('span');
        lblEl.style.cssText = 'overflow:hidden;text-overflow:ellipsis;';
        lblEl.textContent = label;

        pill.append(dotEl, lblEl);

        const path = document.createElement('code');
        path.style.cssText =
          'font-size:0.62rem;opacity:0.32;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:monospace;';
        path.textContent = page;

        wrap.append(pill, path);
        return wrap;
      }
    },
    {
      field: 'device',
      header: 'Device / Browser',
      width: 160,
      minWidth: 130,
      sortable: true,
      cellRenderer: (_, row) => {
        const u = row as SessionGridRow;
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;padding:4px 0;';

        const devColors: Record<string, string> = {
          desktop: '59,130,246',
          mobile: '16,185,129',
          tablet: '245,158,11'
        };
        const dc = devColors[u.device] || '99,102,241';
        const devIcons: Record<string, string> = { desktop: '🖥', mobile: '📱', tablet: '📋' };

        const dev = document.createElement('span');
        dev.style.cssText = `display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:6px;border:1px solid rgba(${dc},0.35);color:rgb(${dc});background:rgba(${dc},0.07);font-size:0.7rem;font-weight:600;width:fit-content;text-transform:capitalize;`;
        dev.textContent = `${devIcons[u.device] ?? '💻'} ${u.device}`;
        wrap.append(dev);

        [u.browser, u.os].forEach(val => {
          if (!val) return;
          const chip = document.createElement('span');
          chip.style.cssText =
            'display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:5px;font-size:0.67rem;opacity:0.65;background:rgba(var(--surface),0.5);border:1px solid rgba(var(--border),0.25);width:fit-content;';
          chip.textContent = val;
          wrap.append(chip);
        });

        return wrap;
      }
    },
    {
      field: 'ip',
      header: 'Location',
      width: 230,
      minWidth: 180,
      cellRenderer: (_, row) => {
        const u = row as SessionGridRow;
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;padding:4px 0;';

        // IP + language
        const ipRow = document.createElement('div');
        ipRow.style.cssText = 'display:flex;align-items:center;gap:5px;flex-wrap:wrap;';

        const ip = document.createElement('code');
        ip.style.cssText =
          'font-family:monospace;font-size:0.72rem;font-weight:600;background:rgba(var(--surface),0.55);border:1px solid rgba(var(--border),0.22);padding:1px 6px;border-radius:5px;';
        ip.textContent = u.ip || '—';
        ipRow.append(ip);

        if (u.language) {
          const lang = document.createElement('span');
          lang.style.cssText =
            'font-size:0.62rem;padding:1px 5px;border-radius:4px;background:rgba(var(--primary),0.06);border:1px solid rgba(var(--primary),0.16);color:rgb(var(--primary));font-family:monospace;';
          lang.textContent = u.language;
          ipRow.append(lang);
        }
        wrap.append(ipRow);

        // GPS
        if (u.latitude && u.longitude) {
          const gps = document.createElement('a');
          gps.href = `https://www.google.com/maps?q=${u.latitude},${u.longitude}`;
          gps.target = '_blank';
          gps.rel = 'noopener';
          gps.style.cssText =
            'display:inline-flex;align-items:center;gap:4px;text-decoration:none;padding:2px 7px;border-radius:6px;border:1px solid rgba(16,185,129,0.28);background:rgba(16,185,129,0.07);color:rgb(16,185,129);font-size:0.69rem;font-weight:600;width:fit-content;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';

          const locText = u._place || `${u.latitude.toFixed(4)}, ${u.longitude.toFixed(4)}`;
          gps.textContent = `📍 ${locText}`;

          if (u.locationAccuracy) {
            const acc = document.createElement('span');
            acc.style.cssText =
              'font-size:0.6rem;color:rgba(16,185,129,0.55);margin-left:2px;flex-shrink:0;';
            acc.textContent = `±${Math.round(u.locationAccuracy)}m`;
            gps.append(acc);
          }
          wrap.append(gps);
        }

        // IP geo
        if (u._geo) {
          const geo = document.createElement('span');
          geo.style.cssText = 'font-size:0.72rem;font-weight:500;';
          geo.textContent = `${u._geo.flag_emoji} ${u._geo.city}${u._geo.city ? ', ' : ''}${u._geo.country}`;
          wrap.append(geo);

          if (u._geo.isp) {
            const isp = document.createElement('span');
            isp.style.cssText =
              'font-size:0.63rem;opacity:0.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px;';
            isp.textContent = u._geo.isp;
            wrap.append(isp);
          }
        } else if (u.ip && isPrivateIp(u.ip)) {
          const local = document.createElement('span');
          local.style.cssText = 'font-size:0.68rem;opacity:0.38;font-style:italic;';
          local.textContent = '🏠 Local / Dev';
          wrap.append(local);
        }

        if (u.timezone) {
          const tz = document.createElement('span');
          tz.style.cssText = 'font-size:0.62rem;opacity:0.35;';
          tz.textContent = `🌍 ${u.timezone}`;
          wrap.append(tz);
        }

        return wrap;
      }
    },
    {
      field: 'connectedAt',
      header: 'Duration',
      width: 110,
      minWidth: 90,
      align: 'right',
      sortable: true,
      cellRenderer: (_, row) => {
        const u = row as SessionGridRow;
        const color = avatarColor(u.userId || u.sessionId);

        const wrap = document.createElement('div');
        wrap.style.cssText =
          'display:flex;flex-direction:column;align-items:flex-end;gap:3px;padding:4px 0;';

        const dur = document.createElement('span');
        dur.style.cssText = `font-size:0.8rem;font-weight:700;font-family:monospace;color:rgb(${color});`;
        dur.textContent = u._duration;

        const seen = document.createElement('span');
        seen.style.cssText = 'font-size:0.65rem;opacity:0.36;font-family:monospace;';
        seen.textContent = u._lastSeenTime;

        wrap.append(dur, seen);
        return wrap;
      }
    }
  ];

  /* ── Geo fetch ── */
  private fetchReverseGeo(lat: number, lng: number): void {
    const key = this.reverseGeoKey(lat, lng);
    this._reverseGeoMap.update(m => new Map(m).set(key, 'loading'));
    this.realtime.fetchReverseGeo(lat, lng).subscribe({
      next: (res: ActiveSessionsReverseGeoResponse) => {
        const a = res?.address ?? {};
        const road = a.road ?? a.pedestrian ?? a.footway ?? a.path ?? '';
        const houseNo = a.house_number ?? '';
        const street = houseNo && road ? `${houseNo} ${road}` : road;
        const suburb = a.suburb ?? a.neighbourhood ?? a.quarter ?? a.city_district ?? '';
        const city = a.city ?? a.town ?? a.village ?? a.county ?? '';
        const country = a.country ?? '';
        const parts = [street, suburb, city, country].filter(Boolean);
        const place =
          parts.join(', ') || res?.display_name?.split(',').slice(0, 3).join(',') || '—';
        this._reverseGeoMap.update(m => new Map(m).set(key, place));
      },
      error: () => this._reverseGeoMap.update(m => new Map(m).set(key, 'failed'))
    });
  }

  private fetchGeo(ip: string): void {
    this._geoMap.update(m => new Map(m).set(ip, 'loading'));
    this.realtime.fetchGeo(ip).subscribe({
      next: (res: ActiveSessionsGeoApiResponse) => {
        if (!res?.success) {
          this._geoMap.update(m => new Map(m).set(ip, 'failed'));
          return;
        }
        const info: GeoInfo = {
          country: res.country ?? '',
          country_code: res.country_code ?? '',
          city: res.city ?? '',
          region: res.region ?? '',
          isp: res.connection?.isp ?? res.connection?.org ?? '',
          flag_emoji: res.flag?.emoji ?? countryFlag(res.country_code ?? '')
        };
        this._geoMap.update(m => new Map(m).set(ip, info));
      },
      error: () => this._geoMap.update(m => new Map(m).set(ip, 'failed'))
    });
  }

  private autoRefreshTimer: ReturnType<typeof setInterval> | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      const users = this.onlineUsers();
      const geoMap = this._geoMap();
      const revMap = this._reverseGeoMap();

      users
        .map(u => u.ip)
        .filter(ip => ip && !isPrivateIp(ip) && !geoMap.has(ip))
        .forEach(ip => this.fetchGeo(ip));

      users
        .filter(u => u.latitude && u.longitude)
        .forEach(u => {
          const key = this.reverseGeoKey(u.latitude!, u.longitude!);
          if (!revMap.has(key)) this.fetchReverseGeo(u.latitude!, u.longitude!);
        });
    });
  }

  ngOnInit(): void {
    this.realtime.requestSnapshot();
    this.tickTimer = setInterval(() => this._tick.update(n => n + 1), 1000);
    this.autoRefreshTimer = setInterval(() => this.realtime.requestSnapshot(), 30_000);
  }

  refresh(): void {
    this.realtime.requestSnapshot();
  }

  ngOnDestroy(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.autoRefreshTimer) clearInterval(this.autoRefreshTimer);
  }
}
