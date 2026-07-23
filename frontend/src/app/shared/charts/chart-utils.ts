export type LinearScale = (value: number) => number;

export const CHART_PALETTE = [
  '#22c55e',
  '#60a5fa',
  '#f59e0b',
  '#a78bfa',
  '#ef4444',
  '#34d399',
  '#eab308',
  '#38bdf8',
  '#f97316',
  '#2dd4bf',
  '#c084fc',
  '#f43f5e'
];

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function linearScale(
  domainMin: number,
  domainMax: number,
  rangeMin: number,
  rangeMax: number
): LinearScale {
  if (domainMax === domainMin) {
    return () => (rangeMin + rangeMax) / 2;
  }
  const m = (rangeMax - rangeMin) / (domainMax - domainMin);
  return (value: number) => rangeMin + (value - domainMin) * m;
}

export function bandScale(labels: string[], rangeMin: number, rangeMax: number, padding = 0.2) {
  const count = Math.max(labels.length, 1);
  const full = rangeMax - rangeMin;
  const step = full / (count + padding * 2);
  const bandwidth = step * (1 - padding);
  const offset = rangeMin + step * padding;
  const positions = new Map<string, number>();
  labels.forEach((label, idx) => {
    positions.set(label, offset + idx * step);
  });
  return {
    step,
    bandwidth,
    position: (label: string) => positions.get(label) ?? offset
  };
}

export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) return [min];
  const range = niceNum(max - min, false);
  const step = niceNum(range / (count - 1), true);
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + step * 0.5; v += step) {
    ticks.push(+v.toFixed(10));
  }
  return ticks;
}

function niceNum(range: number, round: boolean): number {
  const exponent = Math.floor(Math.log10(range));
  const fraction = range / Math.pow(10, exponent);
  let niceFraction: number;
  if (round) {
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;
  } else {
    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 5) niceFraction = 5;
    else niceFraction = 10;
  }
  return niceFraction * Math.pow(10, exponent);
}

export function formatNumber(value: number, compact = false): string {
  if (!Number.isFinite(value)) return '--';
  if (compact) {
    return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(
      value
    );
  }
  return new Intl.NumberFormat('en').format(value);
}

export function formatPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '--';
  return `${value.toFixed(digits)}%`;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const raw = hex.replace('#', '').trim();
  if (raw.length === 3) {
    const r = parseInt(raw[0] + raw[0], 16);
    const g = parseInt(raw[1] + raw[1], 16);
    const b = parseInt(raw[2] + raw[2], 16);
    return { r, g, b };
  }
  const value = parseInt(raw.padEnd(6, '0'), 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) =>
    Math.round(clamp(v, 0, 255))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function interpolateColor(from: string, to: string, t: number): string {
  const start = hexToRgb(from);
  const end = hexToRgb(to);
  const tt = clamp01(t);
  return rgbToHex(lerp(start.r, end.r, tt), lerp(start.g, end.g, tt), lerp(start.b, end.b, tt));
}

export function colorRamp(
  value: number,
  min: number,
  max: number,
  from = '#0f172a',
  to = '#22c55e'
): string {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) return to;
  const span = max - min;
  const t = span === 0 ? 1 : (value - min) / span;
  return interpolateColor(from, to, t);
}
