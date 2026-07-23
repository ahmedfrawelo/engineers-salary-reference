import type { IdName } from '../tender-projects.contracts';
import { type Observable } from 'rxjs';

import type { TenderProjectSettingsComponent } from './tender-settings.component';
import {
  type LookupPayload,
  type SettingItem,
  type TabKey,
  type Tone
} from './tender-settings.models';
import { getTenderProjectPillStyle } from '../tender-project-pill-style.util';

export type LooseValue = ReturnType<typeof JSON.parse>;

type TenderSettingsOwnerPayload = {
  name: string;
  countryId: number | null;
  customLabel: string | null;
  tone: Tone | null;
  customHex: string | null;
  order: number | null;
};

type TenderSettingsUserScopeHost = {
  user(): { id?: unknown; email?: unknown } | null | undefined;
};

type TenderSettingsApiContract = {
  createStatus(payload: LookupPayload): Observable<unknown>;
  createTenderStage(payload: LookupPayload): Observable<unknown>;
  createTypeOfProject(payload: LookupPayload): Observable<unknown>;
  createDegreeOfImportance(payload: LookupPayload): Observable<unknown>;
  createCountry(payload: LookupPayload): Observable<unknown>;
  createOwner(payload: TenderSettingsOwnerPayload): Observable<unknown>;
  createOwnerType(payload: LookupPayload): Observable<unknown>;
  createAssignToSetting(payload: LookupPayload): Observable<unknown>;
  createInChargeSetting(payload: LookupPayload): Observable<unknown>;
  updateStatus(id: number, payload: LookupPayload): Observable<unknown>;
  updateTenderStage(id: number, payload: LookupPayload): Observable<unknown>;
  updateTypeOfProject(id: number, payload: LookupPayload): Observable<unknown>;
  updateDegreeOfImportance(id: number, payload: LookupPayload): Observable<unknown>;
  updateCountry(id: number, payload: LookupPayload): Observable<unknown>;
  updateOwner(id: number, payload: TenderSettingsOwnerPayload): Observable<unknown>;
  updateOwnerType(id: number, payload: LookupPayload): Observable<unknown>;
  updateAssignToSetting(id: number, payload: LookupPayload): Observable<unknown>;
  updateInChargeSetting(id: number, payload: LookupPayload): Observable<unknown>;
  deleteStatus(id: number): Observable<unknown>;
  deleteTenderStage(id: number): Observable<unknown>;
  deleteTypeOfProject(id: number): Observable<unknown>;
  deleteDegreeOfImportance(id: number): Observable<unknown>;
  deleteCountry(id: number): Observable<unknown>;
  deleteOwner(id: number): Observable<unknown>;
  deleteOwnerType(id: number): Observable<unknown>;
  deleteAssignToSetting(id: number): Observable<unknown>;
  deleteInChargeSetting(id: number): Observable<unknown>;
};

export abstract class TenderProjectSettingsUtilityBase {
  protected abstract readonly authUserFacade: TenderSettingsUserScopeHost;
  protected abstract readonly LS_KEY_TONES: string;
  protected abstract readonly LS_KEY_CUSTOM: string;
  protected abstract api: TenderSettingsApiContract;

  protected get self(): TenderProjectSettingsComponent {
    return this as unknown as TenderProjectSettingsComponent;
  }

  protected coerceId(value: unknown): number | null {
    if (value == null) return null;
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    const text = String(value).trim();
    if (!text) return null;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
  }

  protected idsMatch(a: unknown, b: unknown): boolean {
    const left = this.coerceId(a);
    const right = this.coerceId(b);
    if (left != null && right != null) {
      return left === right;
    }
    return a === b;
  }

  protected normalizeLabel(value: unknown): string | undefined {
    if (value == null) return undefined;
    const text = String(value).trim();
    return text ? text : undefined;
  }

  protected normalizeTone(value: unknown): Tone | undefined {
    if (value == null) return undefined;
    const key = String(value).trim().toLowerCase();
    if (!key) return undefined;
    const normalized = key === 'grey' ? 'gray' : key;
    return this.self.tones.includes(normalized as Tone) ? (normalized as Tone) : undefined;
  }

  protected normalizeHex(value: unknown): string | undefined {
    if (value == null) return undefined;
    const raw = String(value).trim();
    if (!raw) return undefined;
    const hex = raw.startsWith('#') ? raw : `#${raw}`;
    if (!/^#([0-9a-fA-F]{3}){1,2}$/.test(hex)) return undefined;
    return hex.toLowerCase();
  }

  protected normalizeOrder(value: unknown): number | undefined {
    if (value == null) return undefined;
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
  }

  protected mergeWithCustomizations(
    items: IdName[],
    tab: TabKey,
    savedTones: LooseValue,
    savedCustom: LooseValue
  ): SettingItem[] {
    void tab;
    void savedTones;
    void savedCustom;
    const merged = items.map((item: IdName, index: number) => {
      const raw = item as LooseValue;
      const resolvedId = this.coerceId(raw.id) ?? raw.id;
      const apiTone = this.normalizeTone(
        raw.tone ?? raw.toneName ?? raw.toneValue ?? raw.colorTone ?? raw.color
      );
      const apiCustomHex = this.normalizeHex(
        raw.customHex ??
          raw.colorHex ??
          raw.hex ??
          raw.toneHex ??
          raw.hexColor ??
          raw.customColor ??
          raw.color
      );
      const apiCustomLabel = this.normalizeLabel(
        raw.customLabel ?? raw.CustomLabel ?? raw.label ?? raw.Label
      );
      const apiOrder = this.normalizeOrder(
        raw.order ?? raw.Order ?? raw.sortOrder ?? raw.sortIndex ?? raw.displayOrder ?? raw.sequence
      );
      const apiName = this.normalizeLabel(
        raw.name ??
          raw.Name ??
          raw.countryName ??
          raw.CountryName ??
          raw.displayName ??
          raw.DisplayName ??
          raw.title ??
          raw.Title ??
          raw.value ??
          raw.Value ??
          raw.text ??
          raw.Text ??
          raw.label ??
          raw.Label
      );
      const resolvedCustomHex = apiCustomHex;
      const resolvedTone = resolvedCustomHex ? undefined : apiTone;

      return {
        id: resolvedId,
        name: apiName ?? (resolvedId != null ? String(resolvedId) : ''),
        customLabel: apiCustomLabel,
        order: apiOrder ?? index,
        tone: resolvedTone,
        customHex: resolvedCustomHex
      };
    });

    return merged.sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
  }

  protected loadTonesFromStorage(): LooseValue {
    return {};
  }

  protected saveTonesToStorage(tab: TabKey, id: number, tone?: Tone, customHex?: string): void {
    void tab;
    void id;
    void tone;
    void customHex;
  }

  protected loadCustomizationsFromStorage(): LooseValue {
    return {};
  }

  protected saveCustomizationsToStorage(
    tab: TabKey,
    id: number,
    customLabel?: string,
    order?: number
  ): void {
    void tab;
    void id;
    void customLabel;
    void order;
  }

  protected scopedStorageKey(baseKey: string): string {
    const user = this.authUserFacade.user();
    const rawScope = user?.id ?? user?.email ?? 'anon';
    const scope =
      String(rawScope)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '_') || 'anon';
    return `${baseKey}:${scope}`;
  }

  protected buildLookupPayload(
    name: string,
    customLabel?: string,
    tone?: Tone,
    customHex?: string,
    order?: number
  ): LookupPayload {
    const payload: LookupPayload = {
      name,
      customLabel: customLabel ?? null,
      tone: tone ?? null,
      customHex: customHex ?? null
    };
    if (order !== undefined) {
      payload.order = order;
    }
    return payload;
  }

  protected buildOrderPayload(item: SettingItem, order: number): LookupPayload {
    const payload: LookupPayload = { name: item.name, order };
    if (item.customLabel !== undefined) payload.customLabel = item.customLabel;
    if (item.tone !== undefined) payload.tone = item.tone;
    if (item.customHex !== undefined) payload.customHex = item.customHex;
    return payload;
  }

  protected callCreateAPI(tab: TabKey, payload: LookupPayload) {
    switch (tab) {
      case 'status':
        return this.api.createStatus(payload);
      case 'stage':
        return this.api.createTenderStage(payload);
      case 'type':
        return this.api.createTypeOfProject(payload);
      case 'importance':
        return this.api.createDegreeOfImportance(payload);
      case 'country':
        return this.api.createCountry(payload);
      case 'owner': {
        const ownerPayload: TenderSettingsOwnerPayload = {
          name: payload.name,
          countryId: null,
          customLabel: payload.customLabel ?? null,
          tone: payload.tone ?? null,
          customHex: payload.customHex ?? null,
          order: payload.order ?? null
        };
        return this.api.createOwner(ownerPayload);
      }
      case 'ownerType':
        return this.api.createOwnerType(payload);
      case 'assignTo':
        return this.api.createAssignToSetting(payload);
      case 'inCharge':
        return this.api.createInChargeSetting(payload);
      default:
        return this.api.createStatus(payload);
    }
  }

  protected callUpdateAPI(tab: TabKey, id: number, payload: LookupPayload) {
    switch (tab) {
      case 'status':
        return this.api.updateStatus(id, payload);
      case 'stage':
        return this.api.updateTenderStage(id, payload);
      case 'type':
        return this.api.updateTypeOfProject(id, payload);
      case 'importance':
        return this.api.updateDegreeOfImportance(id, payload);
      case 'country':
        return this.api.updateCountry(id, payload);
      case 'owner': {
        const ownerPayload: TenderSettingsOwnerPayload = {
          name: payload.name,
          countryId: null,
          customLabel: payload.customLabel ?? null,
          tone: payload.tone ?? null,
          customHex: payload.customHex ?? null,
          order: payload.order ?? null
        };
        return this.api.updateOwner(id, ownerPayload);
      }
      case 'ownerType':
        return this.api.updateOwnerType(id, payload);
      case 'assignTo':
        return this.api.updateAssignToSetting(id, payload);
      case 'inCharge':
        return this.api.updateInChargeSetting(id, payload);
      default:
        return this.api.updateStatus(id, payload);
    }
  }

  protected callDeleteAPI(tab: TabKey, id: number) {
    switch (tab) {
      case 'status':
        return this.api.deleteStatus(id);
      case 'stage':
        return this.api.deleteTenderStage(id);
      case 'type':
        return this.api.deleteTypeOfProject(id);
      case 'importance':
        return this.api.deleteDegreeOfImportance(id);
      case 'country':
        return this.api.deleteCountry(id);
      case 'owner':
        return this.api.deleteOwner(id);
      case 'ownerType':
        return this.api.deleteOwnerType(id);
      case 'assignTo':
        return this.api.deleteAssignToSetting(id);
      case 'inCharge':
        return this.api.deleteInChargeSetting(id);
      default:
        return this.api.deleteStatus(id);
    }
  }

  protected currentSignal() {
    switch (this.self.tab()) {
      case 'status':
        return this.self.status;
      case 'stage':
        return this.self.stage;
      case 'type':
        return this.self.type;
      case 'importance':
        return this.self.importance;
      case 'country':
        return this.self.country;
      case 'owner':
        return this.self.owner;
      case 'ownerType':
        return this.self.ownerType;
      case 'assignTo':
        return this.self.assignTo;
      case 'inCharge':
        return this.self.inCharge;
      default:
        return this.self.status;
    }
  }

  toneClass(tone?: Tone, isCustom = false): string {
    if (isCustom) return 'pill custom';
    return tone ? `pill tone-${tone}` : 'pill';
  }

  pillStyle(tone?: Tone, customHex?: string): Record<string, string> | null {
    return getTenderProjectPillStyle(tone, customHex);
  }

  previewColor(): string {
    if (this.self.editToneMode === 'custom') return this.self.editCustom;
    const palette: Record<Tone, string> = {
      green: 'var(--app-color-grid-pill-tone-green)',
      yellow: 'var(--app-color-grid-pill-tone-yellow)',
      red: 'var(--app-color-grid-pill-tone-red)',
      blue: 'var(--app-color-grid-pill-tone-blue)',
      purple: 'var(--app-color-grid-pill-tone-purple)',
      gray: 'var(--app-color-grid-pill-tone-gray)',
      teal: 'var(--app-color-grid-pill-tone-teal)',
      orange: 'var(--app-color-grid-pill-tone-orange)'
    };
    return (this.self.editTone ? palette[this.self.editTone] : '') || '';
  }

  protected makeId(): string {
    const segment = () =>
      Math.floor((1 + Math.random()) * 0x10000)
        .toString(16)
        .slice(1);
    return `${segment()}${segment()}-${segment()}-${segment()}-${segment()}-${segment()}${segment()}${segment()}`;
  }
}
