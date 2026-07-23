export type ThemeScope = 'root' | 'dark' | 'light' | 'aurora' | 'teal' | 'violet' | 'amber';
export type ThemeTokenId =
  | 'primary'
  | 'bg0'
  | 'bg1'
  | 'surface'
  | 'border'
  | 'border-strong'
  | 'fg'
  | 'muted';

export type ThemeOverrides = Partial<Record<ThemeScope, Partial<Record<ThemeTokenId, string>>>>;

export type ThemeScopeMeta = {
  id: ThemeScope;
  label: string;
  description: string;
  badge?: string;
};

export type ThemeTokenDefinition = {
  id: ThemeTokenId;
  label: string;
  description?: string;
};

const STORAGE_KEY = 'engineers-salary-reference.themeOverrides';
const APP_THEME_STORAGE_KEY = 'engineers-salary-reference.theme';
const LEGACY_THEME_STORAGE_KEY = 'app-theme';
const LOCALHOST_APPEARANCE_RECOVERY_KEY = 'engineers-salary-reference.localAppearanceRecovery.v1';
const VALID_APP_THEMES = new Set(['auto', 'dark', 'light', 'aurora', 'teal', 'violet', 'amber']);

export const THEME_SCOPE_META: ThemeScopeMeta[] = [
  {
    id: 'root',
    label: 'Default / Dark',
    description: 'Base workspace palette used when the theme is Dark or not explicitly set.'
  },
  {
    id: 'dark',
    label: 'Forced Dark',
    description: 'Overrides applied when html[data-theme="dark"] is explicitly set.'
  },
  {
    id: 'light',
    label: 'Light Theme',
    description: 'High-contrast palette for bright workspaces.'
  },
  {
    id: 'aurora',
    label: 'Aurora Theme',
    description: 'Glassy, neon-inspired palette with layered backgrounds.',
    badge: 'Experimental'
  },
  {
    id: 'teal',
    label: 'Ocean Accent',
    description: 'Accent-only theme used for teal CTA variations.'
  },
  {
    id: 'violet',
    label: 'Grape Accent',
    description: 'Accent-only theme anchored to violet gradients.'
  },
  {
    id: 'amber',
    label: 'Sunset Accent',
    description: 'Accent-only theme for warm amber CTAs.'
  }
];

const FULL_TOKEN_SET: ThemeTokenDefinition[] = [
  {
    id: 'primary',
    label: 'Primary Accent',
    description: 'Buttons, highlight actions, send-mail animation.'
  },
  { id: 'bg0', label: 'Base Background', description: 'Main body background.' },
  { id: 'bg1', label: 'Canvas / Shell', description: 'Panels and cards background.' },
  { id: 'surface', label: 'Surface', description: 'Cards, inputs, tables.' },
  { id: 'border', label: 'Border', description: 'Soft outlines, separators.' },
  { id: 'border-strong', label: 'Strong Border', description: 'Focused outlines, table headers.' },
  { id: 'fg', label: 'Foreground', description: 'Primary text color.' },
  { id: 'muted', label: 'Muted Foreground', description: 'Secondary labels and metadata.' }
];

const PRIMARY_ONLY: ThemeTokenDefinition[] = [
  { id: 'primary', label: 'Primary Accent', description: 'Used when this accent mode is active.' }
];

export const THEME_TOKENS: Record<ThemeScope, ThemeTokenDefinition[]> = {
  root: FULL_TOKEN_SET,
  dark: FULL_TOKEN_SET,
  light: FULL_TOKEN_SET,
  aurora: FULL_TOKEN_SET,
  teal: PRIMARY_ONLY,
  violet: PRIMARY_ONLY,
  amber: PRIMARY_ONLY
};

export const DEFAULT_THEME_VALUES: Record<ThemeScope, Record<ThemeTokenId, string>> = {
  root: {
    primary: '#84c718',
    bg0: '#111111',
    bg1: '#191919',
    surface: '#202020',
    border: '#2a2a2a',
    'border-strong': '#3a3a3a',
    fg: '#eaecef',
    muted: '#6e6e6e'
  },
  dark: {
    primary: '#84c718',
    bg0: '#111111',
    bg1: '#191919',
    surface: '#202020',
    border: '#2a2a2a',
    'border-strong': '#3a3a3a',
    fg: '#eaecef',
    muted: '#6e6e6e'
  },
  light: {
    primary: '#84c718',
    bg0: '#ffffff',
    bg1: '#f9f9f9',
    surface: '#ffffff',
    border: '#e8e8e8',
    'border-strong': '#d6d6d6',
    fg: '#1f232b',
    muted: '#8d8d8d'
  },
  aurora: {
    primary: '#84c718',
    bg0: '#0a0f14',
    bg1: '#101820',
    surface: '#121c28',
    border: '#466982',
    'border-strong': '#3a5c76',
    fg: '#dce9f0',
    muted: '#94a2b1'
  },
  teal: {
    primary: '#12b886',
    bg0: '#111111',
    bg1: '#191919',
    surface: '#202020',
    border: '#2a2a2a',
    'border-strong': '#3a3a3a',
    fg: '#eaecef',
    muted: '#6e6e6e'
  },
  violet: {
    primary: '#8b5cf6',
    bg0: '#111111',
    bg1: '#191919',
    surface: '#202020',
    border: '#2a2a2a',
    'border-strong': '#3a3a3a',
    fg: '#eaecef',
    muted: '#6e6e6e'
  },
  amber: {
    primary: '#f59e0b',
    bg0: '#111111',
    bg1: '#191919',
    surface: '#202020',
    border: '#2a2a2a',
    'border-strong': '#3a3a3a',
    fg: '#eaecef',
    muted: '#6e6e6e'
  }
};

const HEX_REGEX = /^#?[0-9a-f]{6}$/i;
const FOREGROUND_MIN_CONTRAST = 2.2;
const MUTED_MIN_CONTRAST = 1.45;
const BORDER_MIN_CONTRAST = 1.04;

export function normalizeHex(value: string): string {
  const trimmed = (value || '').trim();
  if (!HEX_REGEX.test(trimmed)) {
    return '#000000';
  }
  return (trimmed.startsWith('#') ? trimmed : `#${trimmed}`).toLowerCase();
}

export function hexToRgbString(hex: string): string {
  const normalized = normalizeHex(hex);
  const intVal = parseInt(normalized.slice(1), 16);
  const r = (intVal >> 16) & 255;
  const g = (intVal >> 8) & 255;
  const b = intVal & 255;
  return `${r} ${g} ${b}`;
}

export function loadThemeOverrides(): ThemeOverrides {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || !parsed) {
      window.localStorage.removeItem(STORAGE_KEY);
      return {};
    }
    const sanitized = sanitizeThemeOverrides(parsed as ThemeOverrides);
    const nextRaw = JSON.stringify(sanitized);
    if (!nextRaw || nextRaw === '{}' || nextRaw === 'null') {
      window.localStorage.removeItem(STORAGE_KEY);
      return {};
    }
    if (nextRaw !== JSON.stringify(parsed)) {
      window.localStorage.setItem(STORAGE_KEY, nextRaw);
    }
    return sanitized;
  } catch {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore storage cleanup errors
    }
    return {};
  }
}

export function recoverLocalAppearanceState(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const host = window.location.hostname.toLowerCase();
  const isLocalHost =
    host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1';

  if (!isLocalHost) {
    return;
  }

  try {
    if (window.sessionStorage.getItem(LOCALHOST_APPEARANCE_RECOVERY_KEY) === '1') {
      return;
    }

    let changed = false;

    if (window.localStorage.getItem(STORAGE_KEY)) {
      window.localStorage.removeItem(STORAGE_KEY);
      changed = true;
    }

    if (window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY)) {
      window.localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
      changed = true;
    }

    const storedTheme = window.localStorage.getItem(APP_THEME_STORAGE_KEY);
    if (storedTheme && !VALID_APP_THEMES.has(storedTheme)) {
      window.localStorage.removeItem(APP_THEME_STORAGE_KEY);
      changed = true;
    }

    if (changed && !window.localStorage.getItem(APP_THEME_STORAGE_KEY)) {
      window.localStorage.setItem(APP_THEME_STORAGE_KEY, 'light');
    }

    window.sessionStorage.setItem(LOCALHOST_APPEARANCE_RECOVERY_KEY, '1');
  } catch {
    // ignore storage recovery failures
  }
}

export function saveThemeOverrides(overrides: ThemeOverrides): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides ?? {}));
  } catch {
    // ignore quota errors
  }
}

export function applyThemeOverrides(overrides: ThemeOverrides | null): void {
  if (typeof document === 'undefined') return;
  const styleId = 'engineers-salary-reference-theme-overrides';
  const existing = document.getElementById(styleId) as HTMLStyleElement | null;
  const css = buildOverrideCss(overrides);

  if (!css) {
    if (existing?.parentNode) {
      existing.parentNode.removeChild(existing);
    }
    return;
  }

  if (existing) {
    existing.textContent = css;
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = css;
  document.head.appendChild(style);
}

function buildOverrideCss(overrides: ThemeOverrides | null): string {
  if (!overrides) return '';
  const blocks: string[] = [];

  (Object.keys(overrides) as ThemeScope[]).forEach(scope => {
    const tokens = overrides[scope];
    if (!tokens || Object.keys(tokens).length === 0) return;

    const selector = scope === 'root' ? ':root' : `html[data-theme="${scope}"]`;
    const lines = Object.entries(tokens)
      .map(([token, hex]) => {
        if (!hex || !HEX_REGEX.test(hex)) return '';
        const rgb = hexToRgbString(hex);
        return `  --${token}: ${rgb};`;
      })
      .filter(Boolean)
      .join('\n');

    if (lines) {
      blocks.push(`${selector} {\n${lines}\n}`);
    }
  });

  return blocks.length ? `/* Theme overrides */\n${blocks.join('\n\n')}` : '';
}

function sanitizeThemeOverrides(overrides: ThemeOverrides): ThemeOverrides {
  const sanitized: ThemeOverrides = {};

  (Object.keys(overrides) as ThemeScope[]).forEach(scope => {
    const scopeTokens = sanitizeScopeOverrides(scope, overrides[scope]);
    if (scopeTokens && Object.keys(scopeTokens).length > 0) {
      sanitized[scope] = scopeTokens;
    }
  });

  return sanitized;
}

function sanitizeScopeOverrides(
  scope: ThemeScope,
  tokens: Partial<Record<ThemeTokenId, string>> | undefined
): Partial<Record<ThemeTokenId, string>> | null {
  if (!tokens || typeof tokens !== 'object') {
    return null;
  }

  const next: Partial<Record<ThemeTokenId, string>> = {};
  const tokenEntries = Object.entries(tokens) as Array<[ThemeTokenId, string]>;
  for (const [token, hex] of tokenEntries) {
    if (!hex || !HEX_REGEX.test(hex)) {
      continue;
    }
    next[token] = normalizeHex(hex);
  }

  if (Object.keys(next).length === 0) {
    return null;
  }

  const defaults = DEFAULT_THEME_VALUES[scope] ?? DEFAULT_THEME_VALUES.root;
  const effective = { ...defaults, ...next };
  const backgroundTokens: ThemeTokenId[] = ['bg0', 'bg1', 'surface'];

  const hasForegroundContrastIssue = backgroundTokens.every(
    background => contrastRatio(effective.fg, effective[background]) < FOREGROUND_MIN_CONTRAST
  );
  if (hasForegroundContrastIssue) {
    delete next.fg;
  }

  const nextEffectiveAfterFg = { ...defaults, ...next };
  const hasMutedContrastIssue = backgroundTokens.every(
    background =>
      contrastRatio(nextEffectiveAfterFg.muted, nextEffectiveAfterFg[background]) <
      MUTED_MIN_CONTRAST
  );
  if (hasMutedContrastIssue) {
    delete next.muted;
  }

  const nextEffectiveAfterText = { ...defaults, ...next };
  if (
    contrastRatio(nextEffectiveAfterText.border, nextEffectiveAfterText.bg1) < BORDER_MIN_CONTRAST
  ) {
    delete next.border;
  }
  if (
    contrastRatio(nextEffectiveAfterText['border-strong'], nextEffectiveAfterText.bg1) <
    BORDER_MIN_CONTRAST
  ) {
    delete next['border-strong'];
  }

  return Object.keys(next).length > 0 ? next : null;
}

function contrastRatio(firstHex: string, secondHex: string): number {
  const first = relativeLuminance(hexToRgbTuple(firstHex));
  const second = relativeLuminance(hexToRgbTuple(secondHex));
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

function hexToRgbTuple(hex: string): [number, number, number] {
  const normalized = normalizeHex(hex);
  const intVal = parseInt(normalized.slice(1), 16);
  return [(intVal >> 16) & 255, (intVal >> 8) & 255, intVal & 255];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map(value => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function cloneThemeOverrides(source?: ThemeOverrides): ThemeOverrides {
  return source ? JSON.parse(JSON.stringify(source)) : {};
}

export function effectiveHex(
  scope: ThemeScope,
  token: ThemeTokenId,
  overrides: ThemeOverrides
): string {
  const overrideValue = overrides?.[scope]?.[token];
  if (overrideValue && HEX_REGEX.test(overrideValue)) {
    return normalizeHex(overrideValue);
  }

  const defaults = DEFAULT_THEME_VALUES[scope] ?? DEFAULT_THEME_VALUES.root;
  const fallback = defaults[token] ?? DEFAULT_THEME_VALUES.root[token];
  return normalizeHex(fallback);
}

export function removeTokenOverride(
  overrides: ThemeOverrides,
  scope: ThemeScope,
  token: ThemeTokenId
): ThemeOverrides {
  const next = cloneThemeOverrides(overrides);
  if (next[scope]) {
    delete next[scope]![token];
    if (Object.keys(next[scope]!).length === 0) {
      delete next[scope];
    }
  }
  return next;
}
