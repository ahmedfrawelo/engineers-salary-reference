import { REGION_CURRENCY } from '@shared/data/region-currency-map';
import type { TenderRow } from '../tender-project-details/project-details.component';
import type { IdName } from '../tender-projects.contracts';
import {
  findTenderProjectLookupByName,
  resolveTenderProjectLookupDisplayLabel
} from '../tender-projects.lookup.util';
import type { FormModel, TenderImportance } from './add-tender-panel.models';

type LooseValue = ReturnType<typeof JSON.parse>;
type OptionalField = { key: string; label: string };

const EMPTY_CURRENCY = { code: '', symbol: '' };
const CURRENCY_CODE_SET = new Set<string>(Object.values(REGION_CURRENCY));
const REGION_ALIASES: Record<string, string> = {
  ksa: 'SA',
  uae: 'AE',
  uk: 'GB',
  usa: 'US',
  us: 'US'
};

let regionNameMapCache: Map<string, string> | null = null;

export function buildUniqueOptions(values: string[]): string[] {
  const output: string[] = [];
  const seen = new Set<string>();
  for (const raw of values || []) {
    const value = (raw ?? '').trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(value);
  }
  return output;
}

export function isPlaceholderUser(name: string): boolean {
  const key = name.trim().toLowerCase();
  return key === 'unassigned' || key === 'unknown' || key === 'n/a';
}

export function getLookupLabel(item: IdName | null | undefined): string {
  return resolveTenderProjectLookupDisplayLabel(item) ?? item?.name ?? '';
}

export function buildLookupOptions(list: IdName[]): string[] {
  return buildUniqueOptions((list ?? []).map(item => getLookupLabel(item)));
}

export function resolveTenderCurrency(country: string): { code: string; symbol: string } {
  const code = resolveCurrencyCode(country);
  return code ? { code, symbol: '' } : EMPTY_CURRENCY;
}

function resolveCurrencyCode(country: string): string {
  const raw = (country ?? '').trim();
  if (!raw) {
    return '';
  }
  const fromText = extractCurrencyCode(raw);
  if (fromText) {
    return fromText;
  }
  const region = resolveRegionCode(raw);
  return region ? REGION_CURRENCY[region] || '' : '';
}

function extractCurrencyCode(value: string): string {
  const upper = value.toUpperCase();
  if (/^[A-Z]{3}$/.test(upper) && CURRENCY_CODE_SET.has(upper)) {
    return upper;
  }
  const matches = upper.match(/\b[A-Z]{3}\b/g) || [];
  for (const code of matches) {
    if (CURRENCY_CODE_SET.has(code)) {
      return code;
    }
  }
  return '';
}

function resolveRegionCode(country: string): string {
  const raw = (country ?? '').trim();
  if (!raw) {
    return '';
  }

  const normalized = normalizeName(raw);
  const alias = REGION_ALIASES[normalized];
  if (alias) {
    return alias;
  }

  const upper = raw.toUpperCase();
  if (REGION_CURRENCY[upper]) {
    return upper;
  }

  const tokens = upper.match(/[A-Z]{2,3}/g) || [];
  for (const token of tokens) {
    const tokenNorm = normalizeName(token);
    const tokenAlias = REGION_ALIASES[tokenNorm];
    if (tokenAlias) {
      return tokenAlias;
    }
    if (token.length === 2 && REGION_CURRENCY[token]) {
      return token;
    }
  }

  const regionNameMap = getRegionNameMap();
  const byName = regionNameMap.get(normalized);
  if (byName) {
    return byName;
  }

  const stripped = raw.replace(/\s*[\(\[].*?[\)\]]\s*$/, '').trim();
  if (stripped && stripped !== raw) {
    return regionNameMap.get(normalizeName(stripped)) || '';
  }
  return '';
}

function getRegionNameMap(): Map<string, string> {
  if (regionNameMapCache) {
    return regionNameMapCache;
  }

  const map = new Map<string, string>();
  const intlCtor = Intl as LooseValue;
  const regionCodes = getSupportedRegionCodes(intlCtor);
  const locales = getLocaleCandidates();
  const display =
    typeof intlCtor.DisplayNames === 'function'
      ? new intlCtor.DisplayNames(locales, { type: 'region' })
      : null;

  for (const code of regionCodes) {
    const region = String(code).toUpperCase();
    if (!REGION_CURRENCY[region]) {
      continue;
    }
    if (display) {
      const name = display.of(region);
      if (name) {
        addRegionName(map, name, region);
      }
    }
    addRegionName(map, region, region);
  }

  for (const [aliasName, region] of Object.entries(REGION_ALIASES)) {
    addRegionName(map, aliasName, region);
  }

  regionNameMapCache = map;
  return map;
}

function getSupportedRegionCodes(intlCtor: LooseValue): string[] {
  if (typeof intlCtor.supportedValuesOf === 'function') {
    try {
      const values = intlCtor.supportedValuesOf('region');
      if (Array.isArray(values) && values.length) {
        return values.map((value: unknown) => String(value).toUpperCase());
      }
    } catch {
      // Older engines may expose supportedValuesOf but reject "region".
    }
  }

  return Object.keys(REGION_CURRENCY);
}

function addRegionName(map: Map<string, string>, name: string, region: string): void {
  const key = normalizeName(name);
  if (key && !map.has(key)) {
    map.set(key, region);
  }
}

function normalizeName(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function getLocaleCandidates(): string[] {
  const locales: string[] = [];
  if (typeof document !== 'undefined') {
    const lang = document.documentElement?.lang;
    if (lang) {
      locales.push(lang);
    }
  }
  if (typeof navigator !== 'undefined') {
    for (const lang of navigator.languages || []) {
      if (lang && !locales.includes(lang)) {
        locales.push(lang);
      }
    }
  }
  if (!locales.length) {
    locales.push('en');
  }
  return locales;
}

export function createEmptyTenderFormModel(): FormModel {
  return {
    title: '',
    description: '',
    owner: '',
    ownerType: '',
    deadline: '',
    startDate: '',
    endDate: '',
    top: '',
    ts: '',
    price: null,
    assignTo: '',
    acceptDate: '',
    status: '',
    prb: null,
    consultant: '',
    delayReasons: '',
    doi: '',
    country: '',
    inCharge: ''
  };
}

export function createInitialTenderFormState(row: TenderRow): {
  model: FormModel;
  importance: TenderImportance;
  country: string;
} {
  const importance = normalizeSeedText(row.doi) as TenderImportance;
  const country = normalizeSeedText(row.country);
  return {
    importance,
    country,
    model: {
      title: normalizeSeedText(row.title),
      description: normalizeSeedText(row.description),
      owner: normalizeSeedText(row.owner),
      ownerType: normalizeSeedText(row.ownerType),
      deadline: normalizeDateForInput(row.deadline),
      startDate: normalizeDateForInput(row.startDate),
      endDate: normalizeDateForInput(row.endDate),
      top: normalizeSeedText(row.top),
      ts: normalizeSeedText(row.ts),
      price: normalizeSeedNumber(row.price),
      assignTo: normalizeSeedText(row.assignTo),
      acceptDate: normalizeDateForInput(row.acceptDate),
      status: normalizeSeedText(row.status) as FormModel['status'],
      prb: normalizeSeedNumber(row.prb),
      consultant: normalizeSeedText(row.consultant),
      delayReasons: normalizeSeedText(row.delayReasons),
      doi: importance,
      country,
      inCharge: normalizeSeedText(row.inCharge)
    }
  };
}

export function normalizeSeedText(value: unknown): string {
  if (value == null) {
    return '';
  }
  const text = String(value).trim();
  if (!text || text === '-' || text === '\uFFFD' || text === '\u2014') {
    return '';
  }
  return text;
}

export function normalizeSeedNumber(value: unknown): number | null {
  if (value == null) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const text = String(value).trim();
  if (!text || text === '-' || text === '\uFFFD' || text === '\u2014') {
    return null;
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeDateForInput(value: unknown): string {
  const raw = normalizeSeedText(value);
  if (!raw) {
    return '';
  }
  const isoMatch = raw.match(/\d{4}-\d{2}-\d{2}/);
  if (isoMatch) {
    return isoMatch[0];
  }
  const dmyMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmyMatch) {
    const [, dd, mm, yyyy] = dmyMatch;
    return `${yyyy}-${mm}-${dd}`;
  }
  return raw;
}

export function addOption(list: string[], value: string): string[] {
  const key = value.trim().toLowerCase();
  if (!key || list.some(item => item.trim().toLowerCase() === key)) {
    return list;
  }
  return [...list, value];
}

export function hasOptionName(list: string[], name: string): boolean {
  const key = name.trim().toLowerCase();
  return list.some(item => item.trim().toLowerCase() === key);
}

export function findLookupByName(list: IdName[], name: string): IdName | null {
  return findTenderProjectLookupByName(list, name);
}

export function updateLookupList(list: IdName[], item: IdName): IdName[] {
  const index = list.findIndex(entry => entry.id === item.id);
  if (index === -1) {
    return [...list, item];
  }
  const next = [...list];
  next[index] = { ...next[index], ...item };
  return next;
}

export function replaceOption(list: string[], from: string, to: string): string[] {
  const fromKey = from.trim().toLowerCase();
  const toKey = to.trim().toLowerCase();
  const next = list.map(item => (item.trim().toLowerCase() === fromKey ? to : item));
  const seen = new Set<string>();
  const output: string[] = [];

  for (const item of next) {
    const key = item.trim().toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(item);
  }

  if (!seen.has(toKey) && toKey) {
    output.push(to);
  }
  return output;
}

export function extractLookupErrorMessage(err: LooseValue): string {
  if (!err) {
    return 'Please check your connection and try again';
  }
  const original = err.originalError ?? err;
  const errors = original.error?.Errors || original.error?.errors;
  if (Array.isArray(errors) && errors.length) {
    return String(errors[0]);
  }
  if (errors && typeof errors === 'object') {
    for (const value of Object.values(errors as Record<string, unknown>)) {
      if (Array.isArray(value) && value.length) {
        return String(value[0]);
      }
      if (value != null && String(value).trim()) {
        return String(value);
      }
    }
  }
  const serverMessage = original.error?.Message || original.error?.message;
  if (serverMessage) {
    return String(serverMessage);
  }
  return err.message || 'Please check your connection and try again';
}

export function isPlaceholderSelectValue(value: unknown): boolean {
  const text = String(value ?? '').trim();
  if (!text) return true;
  const lower = text.toLowerCase();
  if (lower === '-' || lower === '—') return true;
  if (lower === 'select' || lower.startsWith('select ')) return true;
  if (lower === 'choose' || lower.startsWith('choose ')) return true;
  return false;
}

export function sanitizeSelectText(value: unknown): string {
  const text = String(value ?? '').trim();
  return isPlaceholderSelectValue(text) ? '' : text;
}

export function getEmptyOptionalFields(model: FormModel, importance: string): OptionalField[] {
  const labels: Record<string, string> = {
    owner: 'Owner',
    ownerType: 'Owner Type',
    assignTo: 'Assign To',
    inCharge: 'In Charge',
    deadline: 'Deadline',
    price: 'Price',
    country: 'Country',
    status: 'Status',
    ts: 'TS',
    top: 'TOP',
    importance: 'Importance'
  };
  const blanks: OptionalField[] = [];
  if (!sanitizeSelectText(model.owner)) blanks.push({ key: 'owner', label: labels.owner });
  if (!sanitizeSelectText(model.ownerType))
    blanks.push({ key: 'ownerType', label: labels.ownerType });
  if (!sanitizeSelectText(model.assignTo)) blanks.push({ key: 'assignTo', label: labels.assignTo });
  if (!sanitizeSelectText(model.inCharge)) blanks.push({ key: 'inCharge', label: labels.inCharge });
  if (!model.deadline?.trim()) blanks.push({ key: 'deadline', label: labels.deadline });
  if (model.price == null || Number.isNaN(model.price as number))
    blanks.push({ key: 'price', label: labels.price });
  if (!sanitizeSelectText(model.country)) blanks.push({ key: 'country', label: labels.country });
  if (!sanitizeSelectText(model.status)) blanks.push({ key: 'status', label: labels.status });
  if (!sanitizeSelectText(model.ts)) blanks.push({ key: 'ts', label: labels.ts });
  if (!sanitizeSelectText(model.top)) blanks.push({ key: 'top', label: labels.top });
  if (!sanitizeSelectText(importance)) blanks.push({ key: 'importance', label: labels.importance });
  return blanks;
}

export function isWarnFieldBlank(key: string, model: FormModel, importance: string): boolean {
  switch (key) {
    case 'owner':
      return !sanitizeSelectText(model.owner);
    case 'ownerType':
      return !sanitizeSelectText(model.ownerType);
    case 'assignTo':
      return !sanitizeSelectText(model.assignTo);
    case 'inCharge':
      return !sanitizeSelectText(model.inCharge);
    case 'deadline':
      return !String(model.deadline ?? '').trim();
    case 'price':
      return model.price == null || Number.isNaN(model.price as number);
    case 'country':
      return !sanitizeSelectText(model.country);
    case 'status':
      return !sanitizeSelectText(model.status);
    case 'ts':
      return !sanitizeSelectText(model.ts);
    case 'top':
      return !sanitizeSelectText(model.top);
    case 'importance':
      return !sanitizeSelectText(importance);
    default:
      return false;
  }
}
