type PillStyleMap = Record<string, string>;

const TENDER_PROJECT_TONE_STYLE_MAP: Record<string, PillStyleMap> = {
  green: {
    '--tp-pill-fg': 'var(--app-color-grid-pill-tone-green)',
    '--tp-pill-border': 'var(--app-color-grid-pill-tone-border)',
    '--tp-pill-bg': 'var(--app-color-grid-pill-tone-bg)'
  },
  yellow: {
    '--tp-pill-fg': 'var(--app-color-grid-pill-tone-yellow)',
    '--tp-pill-border': 'var(--app-color-grid-pill-tone-border)',
    '--tp-pill-bg': 'var(--app-color-grid-pill-tone-bg)'
  },
  red: {
    '--tp-pill-fg': 'var(--app-color-grid-pill-tone-red)',
    '--tp-pill-border': 'var(--app-color-grid-pill-tone-border)',
    '--tp-pill-bg': 'var(--app-color-grid-pill-tone-bg)'
  },
  blue: {
    '--tp-pill-fg': 'var(--app-color-grid-pill-tone-blue)',
    '--tp-pill-border': 'var(--app-color-grid-pill-tone-border)',
    '--tp-pill-bg': 'var(--app-color-grid-pill-tone-bg)'
  },
  purple: {
    '--tp-pill-fg': 'var(--app-color-grid-pill-tone-purple)',
    '--tp-pill-border': 'var(--app-color-grid-pill-tone-border)',
    '--tp-pill-bg': 'var(--app-color-grid-pill-tone-bg)'
  },
  teal: {
    '--tp-pill-fg': 'var(--app-color-grid-pill-tone-teal)',
    '--tp-pill-border': 'var(--app-color-grid-pill-tone-border)',
    '--tp-pill-bg': 'var(--app-color-grid-pill-tone-bg)'
  },
  orange: {
    '--tp-pill-fg': 'var(--app-color-grid-pill-tone-orange)',
    '--tp-pill-border': 'var(--app-color-grid-pill-tone-border)',
    '--tp-pill-bg': 'var(--app-color-grid-pill-tone-bg)'
  },
  gray: {
    '--tp-pill-fg': 'var(--app-color-grid-pill-tone-gray)',
    '--tp-pill-border': 'var(--app-color-grid-pill-border)',
    '--tp-pill-bg': 'var(--app-color-grid-pill-surface)'
  }
};

function normalizeToneKey(value: unknown): string | null {
  if (value == null) return null;
  const key = String(value).trim().toLowerCase();
  if (!key) return null;
  return key === 'grey' ? 'gray' : key;
}

function normalizeHex(value: unknown): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const hex = raw.startsWith('#') ? raw : `#${raw}`;
  return /^#([0-9a-fA-F]{3}){1,2}$/.test(hex) ? hex.toLowerCase() : null;
}

export function getTenderProjectPillStyle(
  tone?: string | null,
  customHex?: string | null
): PillStyleMap | null {
  const normalizedCustomHex = normalizeHex(customHex);
  if (normalizedCustomHex) {
    return {
      '--tp-pill-fg': normalizedCustomHex,
      '--tp-pill-border': `color-mix(in oklab, ${normalizedCustomHex} 22%, transparent)`,
      '--tp-pill-bg': `color-mix(in oklab, ${normalizedCustomHex} 10%, var(--app-color-grid-pill-surface))`
    };
  }

  const normalizedTone = normalizeToneKey(tone);
  return normalizedTone ? (TENDER_PROJECT_TONE_STYLE_MAP[normalizedTone] ?? null) : null;
}

export function applyTenderProjectPillStyle(
  element: HTMLElement,
  tone?: string | null,
  customHex?: string | null
): void {
  const styleMap = getTenderProjectPillStyle(tone, customHex);
  if (!styleMap) {
    return;
  }

  for (const [property, value] of Object.entries(styleMap)) {
    element.style.setProperty(property, value);
  }
}
