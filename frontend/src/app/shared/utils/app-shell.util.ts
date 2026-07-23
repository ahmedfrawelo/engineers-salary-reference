export type ThemeId = 'auto' | 'dark' | 'light' | 'aurora' | 'teal' | 'violet' | 'amber';
const VALID_THEMES: readonly ThemeId[] = [
  'auto',
  'dark',
  'light',
  'aurora',
  'teal',
  'violet',
  'amber'
];

const AUTH_ROUTE_SEGMENTS = ['login', 'signup'] as const;

function stripUrlDecorations(url: string): string {
  return String(url ?? '')
    .split('?')[0]
    .split('#')[0];
}

export function isAuthRoute(
  url: string,
  authRoutes: readonly string[] = AUTH_ROUTE_SEGMENTS
): boolean {
  const clean = stripUrlDecorations(url);
  return authRoutes.some(route => clean === `/${route}` || clean.startsWith(`/${route}/`));
}

export function normalizeAppUrl(url: string): string {
  return stripUrlDecorations(url).replace(/^\//, '');
}

export function parseStoredTheme(raw: string | null): ThemeId | null {
  return raw && VALID_THEMES.includes(raw as ThemeId) ? (raw as ThemeId) : null;
}

export function parseStoredSidebarCollapsed(raw: string | null): boolean | null {
  if (raw === 'true') {
    return true;
  }
  if (raw === 'false') {
    return false;
  }
  return null;
}

export function loadStoredArea<T extends string>(
  isBrowser: boolean,
  allowedAreas: Record<T, unknown>
): T | null {
  if (!isBrowser || typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem('engineers-salary-reference.currentArea');
    return raw && raw in allowedAreas ? (raw as T) : null;
  } catch {
    return null;
  }
}

export function persistStoredArea<T extends string>(isBrowser: boolean, area: T): void {
  if (!isBrowser || typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem('engineers-salary-reference.currentArea', area);
  } catch {}
}

export function persistStoredTheme(isBrowser: boolean, storageKey: string, theme: ThemeId): void {
  if (!isBrowser || typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(storageKey, theme);
  } catch {}
}

export function persistStoredSidebarCollapsed(
  isBrowser: boolean,
  storageKey: string,
  collapsed: boolean
): void {
  if (!isBrowser || typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(storageKey, String(collapsed));
  } catch {}
}

export function applyAppRouteClasses(
  isBrowser: boolean,
  doc: Document | undefined,
  url: string
): void {
  if (!isBrowser || !doc) {
    return;
  }
  const clean = stripUrlDecorations(url);
  const authRoute = isAuthRoute(clean);
  doc.body.classList.toggle('auth-route', authRoute);
  doc.body.classList.toggle('tender-projects-page', clean.startsWith('/tender/projects'));
  doc.body.classList.toggle('salary-reports-page', clean.startsWith('/salary-reports'));
  doc.body.classList.toggle('submit-report-page', clean.startsWith('/submit-report'));
  doc.body.classList.toggle('tender-suppliers-page', clean.startsWith('/tender/suppliers'));
  doc.body.classList.toggle(
    'tender-material-classification-page',
    clean.startsWith('/tender/material-classification')
  );
  doc.body.classList.toggle('tender-boq-page', clean.startsWith('/tender/boq'));
  doc.body.classList.toggle(
    'settings-page',
    clean === '/settings' || clean.startsWith('/settings/')
  );
  doc.body.classList.toggle(
    'team-tasks-page',
    clean.startsWith('/tasks') || clean.startsWith('/tender/tasks')
  );
}

export function showPostLoginWelcomeToast(
  isBrowser: boolean,
  debugLog: (...args: unknown[]) => void,
  showSuccess: (message: string, ttlMs: number) => void
): void {
  if (!isBrowser || typeof window === 'undefined') {
    return;
  }
  try {
    const welcomeFlag = localStorage.getItem('engineers-salary-reference.showWelcome');
    if (!welcomeFlag) {
      return;
    }
    const data = JSON.parse(welcomeFlag);
    const userName = data?.userName || 'User';
    const age = Date.now() - (data?.timestamp || 0);
    if (age < 5000) {
      debugLog('[App] Showing welcome message for:', userName);
      showSuccess(`Welcome ${userName}!`, 6000);
    }
    localStorage.removeItem('engineers-salary-reference.showWelcome');
  } catch (error) {
    console.error('[App] Failed to read welcome flag:', error);
  }
}

export function getAppScale(isBrowser: boolean, reference?: HTMLElement): number {
  if (!isBrowser) {
    return 1;
  }
  if (reference) {
    const rect = reference.getBoundingClientRect();
    const offsetWidth = reference.offsetWidth || reference.clientWidth;
    if (rect.width > 0 && offsetWidth > 0) {
      const measured = rect.width / offsetWidth;
      if (Number.isFinite(measured) && measured > 0) {
        return measured;
      }
    }
  }
  const rootScale = getComputedStyle(document.documentElement)
    .getPropertyValue('--app-scale')
    .trim();
  const parsedRoot = Number.parseFloat(rootScale);
  if (Number.isFinite(parsedRoot) && parsedRoot > 0) {
    return parsedRoot;
  }
  const bodyZoom = Number.parseFloat(getComputedStyle(document.body).zoom || '');
  return Number.isFinite(bodyZoom) && bodyZoom > 0 ? bodyZoom : 1;
}

export function getSidebarOpenWidth(isBrowser: boolean): number {
  if (!isBrowser) {
    return 0;
  }
  const value = getComputedStyle(document.documentElement).getPropertyValue('--sideW-open');
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
