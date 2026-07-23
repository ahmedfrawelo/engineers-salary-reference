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
    border: '#4a4e56',
    'border-strong': '#363a42',
    fg: '#e8eaee',
    muted: '#a2a6ae'
  },
  dark: {
    primary: '#84c718',
    bg0: '#111111',
    bg1: '#191919',
    surface: '#202020',
    border: '#4a4e56',
    'border-strong': '#363a42',
    fg: '#e8eaee',
    muted: '#a2a6ae'
  },
  light: {
    primary: '#84c718',
    bg0: '#ffffff',
    bg1: '#fcfcfc',
    surface: '#fbfcfe',
    border: '#d0d6e0',
    'border-strong': '#b8beca',
    fg: '#1e2535',
    muted: '#646e82'
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
    border: '#4a4e56',
    'border-strong': '#363a42',
    fg: '#e8eaee',
    muted: '#a2a6ae'
  },
  violet: {
    primary: '#8b5cf6',
    bg0: '#111111',
    bg1: '#191919',
    surface: '#202020',
    border: '#4a4e56',
    'border-strong': '#363a42',
    fg: '#e8eaee',
    muted: '#a2a6ae'
  },
  amber: {
    primary: '#f59e0b',
    bg0: '#111111',
    bg1: '#191919',
    surface: '#202020',
    border: '#4a4e56',
    'border-strong': '#363a42',
    fg: '#e8eaee',
    muted: '#a2a6ae'
  }
};

const HEX_REGEX = /^#?[0-9a-f]{6}$/i;

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
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
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
