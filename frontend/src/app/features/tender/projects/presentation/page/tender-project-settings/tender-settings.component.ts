import {
  Component,
  EventEmitter,
  Input,
  Output,
  HostListener,
  signal,
  inject,
  OnInit,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { AppIconDirective } from '@shared/icons/app-icon.directive';
import { OverlayPanelComponent } from '@shared/ui/overlay-panel.component';
import { TenderProjectsFeatureFacade } from '@features/tender/projects';
import { AUTH_USER_FACADE } from '@core/auth/auth-user.facade';
import { StretchTabsIndicatorDirective } from '../../../../../../shared/directives/stretch-tabs-indicator.directive';
import { findTenderSettingsConflict } from './tender-settings.validation.util';
import {
  getTenderSettingsAddButtonLabel,
  getTenderSettingsFirstColumnLabel,
  SettingItem,
  TabKey,
  Tone,
  TENDER_SETTINGS_PRESET_CUSTOMS,
  TENDER_SETTINGS_TONES
} from './tender-settings.models';
import type { IdName } from '../tender-projects.contracts';
import {
  LooseValue,
  TenderProjectSettingsUtilityBase
} from './tender-settings.component.utility.base';
import {
  broadcastTenderProjectsSync,
  createTenderProjectsSyncClientId
} from '../tender-projects.presenter.logic';
import { ToastService } from '@shared/toast/toast.service';
import { environment } from '../../../../../../../environments/environment';

@Component({
  selector: 'tender-project-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    DragDropModule,
    AppIconDirective,
    OverlayPanelComponent,
    StretchTabsIndicatorDirective
  ],
  templateUrl: './tender-settings.component.html',
  styleUrls: ['./tender-settings.component.scss']
})
export class TenderProjectSettingsComponent
  extends TenderProjectSettingsUtilityBase
  implements OnInit, OnChanges, OnDestroy
{
  private readonly isBrowser = typeof window !== 'undefined';
  private readonly PROJECTS_SYNC_CHANNEL_NAME = 'engineers-salary-reference.tender.projects.sync';
  private readonly LOOKUPS_REFRESH_BROADCAST_KEY = 'engineers-salary-reference.tender.projects.lookups.refresh';
  private readonly syncClientId = createTenderProjectsSyncClientId(this.isBrowser);
  private syncChannel: BroadcastChannel | null = null;
  private _open = false;
  @Input() set open(value: boolean) {
    const next = Boolean(value);
    const opening = !this._open && next;
    this._open = next;
    if (opening && !this.hasLoadedOnce) {
      this.ensureDataReady();
    }
  }
  get open(): boolean {
    return this._open;
  }
  @Input() lookupsReady = false;
  @Input() statusesList: IdName[] | null = [];
  @Input() stagesList: IdName[] | null = [];
  @Input() typesList: IdName[] | null = [];
  @Input() importanceList: IdName[] | null = [];
  @Input() countriesList: IdName[] | null = [];
  @Input() ownersList: IdName[] | null = [];
  @Input() ownerTypesList: IdName[] | null = [];
  @Input() assignToSettingsList: IdName[] | null = [];
  @Input() inChargeSettingsList: IdName[] | null = [];
  @Output() close = new EventEmitter<void>();

  private readonly projectsFacade = inject(TenderProjectsFeatureFacade);
  protected readonly authUserFacade = inject(AUTH_USER_FACADE);
  private readonly toast = inject(ToastService);
  protected api = this.projectsFacade.api;
  private cdr = inject(ChangeDetectorRef);

  tab = signal<TabKey>('status');
  loading = false;
  error: string | null = null;
  formError: string | null = null;
  private hasLoadedOnce = false;

  status = signal<SettingItem[]>([]);
  stage = signal<SettingItem[]>([]);
  type = signal<SettingItem[]>([]);
  importance = signal<SettingItem[]>([]);
  country = signal<SettingItem[]>([]);
  owner = signal<SettingItem[]>([]);
  ownerType = signal<SettingItem[]>([]);
  assignTo = signal<SettingItem[]>([]);
  inCharge = signal<SettingItem[]>([]);

  protected readonly LS_KEY_TONES = 'tender_settings_tones';
  protected readonly LS_KEY_CUSTOM = 'tender_settings_customizations';

  ngOnInit() {
    this.syncFromProvidedLookups();
    if (this.open && !this.hasLoadedOnce) {
      this.ensureDataReady();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!this.hasLookupInputChanges(changes)) {
      return;
    }
    const hydrated = this.syncFromProvidedLookups();
    if (!hydrated && this.open && !this.hasLoadedOnce) {
      this.ensureDataReady();
    }
  }

  ngOnDestroy(): void {
    if (!this.syncChannel) {
      return;
    }
    try {
      this.syncChannel.close();
    } catch {
      // Ignore channel close errors.
    }
    this.syncChannel = null;
  }

  tones: Tone[] = TENDER_SETTINGS_TONES;
  presetCustoms = TENDER_SETTINGS_PRESET_CUSTOMS;

  creating = false;
  editing: SettingItem | null = null;

  editName = '';
  editCustomLabel = '';
  editTone: Tone | '' = '';
  editToneMode: 'preset' | 'custom' = 'preset';
  editCustom: string = '#84c718';

  toneOpen = false;

  addBtnLabel() {
    return getTenderSettingsAddButtonLabel(this.tab());
  }
  firstColLabel() {
    return getTenderSettingsFirstColumnLabel(this.tab());
  }

  private hasLookupInputChanges(changes: SimpleChanges): boolean {
    return [
      'lookupsReady',
      'statusesList',
      'stagesList',
      'typesList',
      'importanceList',
      'countriesList',
      'ownersList',
      'ownerTypesList',
      'assignToSettingsList',
      'inChargeSettingsList'
    ].some(key => key in changes);
  }

  private ensureDataReady() {
    if (this.hasLoadedOnce) {
      return;
    }
    if (this.syncFromProvidedLookups()) {
      return;
    }
    if (!this.hasLoadedOnce && !this.loading) {
      this.loadAllFromAPI();
    }
  }

  private hasProvidedLookups(): boolean {
    return [
      this.statusesList,
      this.stagesList,
      this.typesList,
      this.importanceList,
      this.countriesList,
      this.ownersList,
      this.ownerTypesList,
      this.assignToSettingsList,
      this.inChargeSettingsList
    ].some(list => Array.isArray(list) && list.length > 0);
  }

  private syncFromProvidedLookups(): boolean {
    if (!this.lookupsReady && !this.hasProvidedLookups()) {
      return false;
    }

    this.applyLookupCollections({
      statuses: this.statusesList ?? [],
      stages: this.stagesList ?? [],
      types: this.typesList ?? [],
      degreesOfImportance: this.importanceList ?? [],
      countries: this.countriesList ?? [],
      owners: this.ownersList ?? [],
      ownerTypes: this.ownerTypesList ?? [],
      assignToSettings: this.assignToSettingsList ?? [],
      inChargeSettings: this.inChargeSettingsList ?? []
    });
    this.hasLoadedOnce = true;
    this.loading = false;
    this.error = null;
    this.cdr.markForCheck();
    return true;
  }

  private applyLookupCollections(data: {
    statuses: IdName[];
    stages: IdName[];
    types: IdName[];
    degreesOfImportance: IdName[];
    countries: IdName[];
    owners: IdName[];
    ownerTypes: IdName[];
    assignToSettings: IdName[];
    inChargeSettings: IdName[];
  }) {
    const savedTones = this.loadTonesFromStorage();
    const savedCustom = this.loadCustomizationsFromStorage();

    this.status.set(this.mergeWithCustomizations(data.statuses, 'status', savedTones, savedCustom));
    this.stage.set(this.mergeWithCustomizations(data.stages, 'stage', savedTones, savedCustom));
    this.type.set(this.mergeWithCustomizations(data.types, 'type', savedTones, savedCustom));
    this.importance.set(
      this.mergeWithCustomizations(data.degreesOfImportance, 'importance', savedTones, savedCustom)
    );
    this.country.set(
      this.mergeWithCustomizations(data.countries, 'country', savedTones, savedCustom)
    );
    this.owner.set(this.mergeWithCustomizations(data.owners, 'owner', savedTones, savedCustom));
    this.ownerType.set(
      this.mergeWithCustomizations(data.ownerTypes, 'ownerType', savedTones, savedCustom)
    );
    this.assignTo.set(
      this.mergeWithCustomizations(data.assignToSettings, 'assignTo', savedTones, savedCustom)
    );
    this.inCharge.set(
      this.mergeWithCustomizations(data.inChargeSettings, 'inCharge', savedTones, savedCustom)
    );
  }

  // ? ????? ???????? ?? API
  private loadAllFromAPI() {
    if (this.loading) {
      return;
    }
    this.loading = true;
    this.error = null;
    this.api
      .bootstrap({
        pageNumber: 1,
        pageSize: 1
      })
      .subscribe({
        next: bootstrap => {
          this.applyLookupCollections({
            statuses: bootstrap.lookups.statuses ?? [],
            stages: bootstrap.lookups.stages ?? [],
            types: bootstrap.lookups.types ?? [],
            degreesOfImportance: bootstrap.lookups.degreesOfImportance ?? [],
            countries: bootstrap.lookups.countries ?? [],
            owners: bootstrap.lookups.owners ?? [],
            ownerTypes: bootstrap.lookups.ownerTypes ?? [],
            assignToSettings: bootstrap.lookups.assignToSettings ?? [],
            inChargeSettings: bootstrap.lookups.inChargeSettings ?? []
          });
          this.hasLoadedOnce = true;
          this.loading = false;
          this.error = null;
          this.cdr.markForCheck();
        },
        error: (err: unknown) => {
          if (environment.enableDebugLogs) console.error('Failed to load settings:', err);
          this.error = 'Failed to load settings from backend';
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  setTab(k: TabKey) {
    this.tab.set(k);
    this.cancelEdit();
  }

  items(): SettingItem[] {
    switch (this.tab()) {
      case 'status':
        return this.status();
      case 'stage':
        return this.stage();
      case 'type':
        return this.type();
      case 'importance':
        return this.importance();
      case 'country':
        return this.country();
      case 'owner':
        return this.owner();
      case 'ownerType':
        return this.ownerType();
      case 'assignTo':
        return this.assignTo();
      case 'inCharge':
        return this.inCharge();
    }
  }

  trackById(_index: number, item: SettingItem) {
    return item.id;
  }

  startCreate() {
    this.creating = true;
    this.editing = null;
    this.formError = null;
    this.editName = '';
    this.editCustomLabel = '';
    this.editTone = '';
    this.editToneMode = 'preset';
    this.editCustom = '#84c718';
    this.toneOpen = false;
  }
  startEdit(it: SettingItem) {
    this.creating = false;
    this.editing = { ...it };
    this.formError = null;
    this.editName = it.name;
    this.editCustomLabel = it.customLabel || '';
    if (it.customHex) {
      this.editToneMode = 'custom';
      this.editCustom = it.customHex;
      this.editTone = '';
    } else {
      this.editToneMode = 'preset';
      this.editTone = it.tone ?? '';
      this.editCustom = '#84c718';
    }
    this.toneOpen = false;
  }
  cancelEdit() {
    this.creating = false;
    this.editing = null;
    this.formError = null;
    this.editName = '';
    this.editCustomLabel = '';
    this.editTone = '';
    this.editToneMode = 'preset';
    this.editCustom = '#84c718';
    this.toneOpen = false;
    this.cdr.markForCheck();
  }

  toggleTone() {
    this.toneOpen = !this.toneOpen;
  }
  @HostListener('document:click') onDoc() {
    if (this.toneOpen) this.toneOpen = false;
  }

  switchMode(m: 'preset' | 'custom') {
    this.editToneMode = m;
    if (m === 'preset') this.editCustom = '#84c718';
    else this.editTone = '';
  }
  clearFormError() {
    if (!this.formError) return;
    this.formError = null;
  }
  selectPreset(t: '' | Tone) {
    this.editTone = t as LooseValue;
  }

  private validateDraft(name: string, customLabel?: string): boolean {
    const conflict = findTenderSettingsConflict(this.currentSignal()(), {
      id: this.editing?.id,
      name,
      customLabel
    });
    if (!conflict) {
      this.formError = null;
      return true;
    }
    this.formError = conflict.message;
    this.cdr.markForCheck();
    return false;
  }

  applyEdit() {
    const name = (this.editName || '').trim();
    const customLabel = this.normalizeLabel(this.editCustomLabel);
    const tone =
      this.editToneMode === 'preset'
        ? ((this.editTone || undefined) as Tone | undefined)
        : undefined;
    const customHex =
      this.editToneMode === 'custom' ? this.normalizeHex(this.editCustom) : undefined;
    const resolvedTone = customHex ? undefined : tone;
    if (!name) return;
    if (!this.validateDraft(name, customLabel)) return;

    const tab = this.tab();
    const arrSig = this.currentSignal();

    if (this.creating) {
      // ? ????? ???? - ??????? API
      const newOrder = arrSig().length;
      const payload = this.buildLookupPayload(name, customLabel, resolvedTone, customHex, newOrder);
      this.loading = true;
      this.callCreateAPI(tab, payload).subscribe({
        next: created => {
          const createdIdNum = this.coerceId((created as LooseValue)?.id);
          const createdId = createdIdNum ?? (created as LooseValue)?.id ?? this.makeId();
          const createdName = (created as LooseValue)?.name ?? name;
          const createdTone =
            this.normalizeTone((created as LooseValue)?.tone) ??
            (customHex ? undefined : resolvedTone);
          const createdCustomHex =
            this.normalizeHex((created as LooseValue)?.customHex) ?? customHex;
          const createdCustomLabel =
            this.normalizeLabel((created as LooseValue)?.customLabel) ?? customLabel;
          const createdOrder = this.normalizeOrder((created as LooseValue)?.order) ?? newOrder;
          arrSig.update(arr => [
            ...arr,
            {
              id: createdId,
              name: createdName,
              customLabel: createdCustomLabel ?? undefined,
              order: createdOrder,
              tone: createdCustomHex ? undefined : createdTone,
              customHex: createdCustomHex ?? undefined
            }
          ]);
          this.broadcastLookupsRefresh('create');
          this.loading = false;
          this.cdr.markForCheck();
          this.cancelEdit();
          this.loadAllFromAPI();
        },
        error: err => {
          if (environment.enableDebugLogs) console.error('Create failed:', err);
          this.loading = false;
          this.cdr.markForCheck();
          this.toast.error('Failed to save. Please try again.');
        }
      });
    } else if (this.editing) {
      const rawId = this.editing.id;
      const resolvedId = this.coerceId(rawId);
      if (resolvedId == null) {
        // ???? ??? - ???? ??????
        arrSig.update(arr =>
          arr.map(x =>
            this.idsMatch(x.id, rawId)
              ? {
                  ...x,
                  name,
                  customLabel,
                  tone: resolvedTone,
                  customHex,
                  ...(customHex ? { tone: undefined } : null)
                }
              : x
          )
        );
        this.cancelEdit();
        return;
      }

      // ? ????? ????? - ??????? API
      // Optimistic UI update for immediate feedback
      const previousItems = arrSig().map(item => ({ ...item }));
      arrSig.update(arr =>
        arr.map(x =>
          this.idsMatch(x.id, resolvedId)
            ? {
                ...x,
                name,
                customLabel,
                tone: resolvedTone,
                customHex,
                ...(customHex ? { tone: undefined } : null)
              }
            : x
        )
      );
      this.cdr.markForCheck();

      const existingOrder = this.normalizeOrder(this.editing.order);
      const payload = this.buildLookupPayload(
        name,
        customLabel,
        resolvedTone,
        customHex,
        existingOrder
      );
      this.loading = true;
      this.callUpdateAPI(tab, resolvedId, payload).subscribe({
        next: updated => {
          const updatedId = this.coerceId((updated as LooseValue)?.id) ?? resolvedId;
          const updatedName = (updated as LooseValue)?.name ?? name;
          const updatedTone =
            this.normalizeTone((updated as LooseValue)?.tone) ??
            (customHex ? undefined : resolvedTone);
          const updatedCustomHex =
            this.normalizeHex((updated as LooseValue)?.customHex) ?? customHex;
          const updatedCustomLabel =
            this.normalizeLabel((updated as LooseValue)?.customLabel) ?? customLabel;
          const updatedOrder =
            this.normalizeOrder((updated as LooseValue)?.order) ?? existingOrder ?? undefined;
          arrSig.update(arr =>
            arr.map(x =>
              this.idsMatch(x.id, resolvedId)
                ? {
                    id: updatedId,
                    name: updatedName,
                    customLabel: updatedCustomLabel ?? undefined,
                    order: updatedOrder ?? x.order,
                    tone: updatedCustomHex ? undefined : updatedTone,
                    customHex: updatedCustomHex ?? undefined
                  }
                : x
            )
          );
          this.broadcastLookupsRefresh('update');
          this.loading = false;
          this.cdr.markForCheck();
          this.cancelEdit();
          this.loadAllFromAPI();
        },
        error: err => {
          if (environment.enableDebugLogs) console.error('Update failed:', err);
          arrSig.set(previousItems);
          this.loading = false;
          this.cdr.markForCheck();
          this.toast.error('Failed to save. Please try again.');
        }
      });
    }
  }

  remove(it: SettingItem) {
    const tab = this.tab();
    const arrSig = this.currentSignal();
    const id = it.id;
    const resolvedId = this.coerceId(id);

    if (resolvedId == null) {
      // ???? ???
      arrSig.update(arr => arr.filter(x => !this.idsMatch(x.id, id)));
      this.cdr.markForCheck();
      return;
    }

    this.toast.action(
      'danger',
      `Delete "${it.name}"? This cannot be undone.`,
      'Delete',
      () => this.confirmRemoveSetting(tab, arrSig, id, resolvedId),
      5000,
      undefined,
      { title: 'Confirm delete' }
    );
  }

  private confirmRemoveSetting(
    tab: TabKey,
    arrSig: ReturnType<TenderProjectSettingsComponent['currentSignal']>,
    itemId: SettingItem['id'],
    resolvedId: number
  ): void {
    this.loading = true;
    this.callDeleteAPI(tab, resolvedId).subscribe({
      next: () => {
        arrSig.update(arr => arr.filter(x => !this.idsMatch(x.id, itemId)));
        this.broadcastLookupsRefresh('delete');
        this.loading = false;
        this.cdr.markForCheck();
        this.loadAllFromAPI();
      },
      error: err => {
        if (environment.enableDebugLogs) console.error('Delete failed:', err);
        this.loading = false;
        this.cdr.markForCheck();
        this.toast.error('Failed to delete. Please try again.');
      }
    });
  }

  // ? Drag & Drop handlers
  onDrop(event: CdkDragDrop<SettingItem[]>) {
    if (event.previousIndex === event.currentIndex) return;

    const tab = this.tab();
    const arrSig = this.currentSignal();
    const items = [...arrSig()];

    moveItemInArray(items, event.previousIndex, event.currentIndex);

    // Update orders and save to localStorage
    items.forEach((item, idx) => {
      const resolvedId = this.coerceId(item.id);
      if (resolvedId != null) {
        this.saveCustomizationsToStorage(tab, resolvedId, item.customLabel, idx);
      }
    });

    // Update signal with new order
    const reordered = items.map((it, idx) => ({ ...it, order: idx }));
    arrSig.set(reordered);
    this.broadcastLookupsRefresh('reorder');
    this.persistOrder(tab, reordered);
  }

  private persistOrder(tab: TabKey, items: SettingItem[]) {
    items.forEach((item, idx) => {
      const resolvedId = this.coerceId(item.id);
      if (resolvedId == null) return;
      const payload = this.buildOrderPayload(item, idx);
      this.callUpdateAPI(tab, resolvedId, payload).subscribe({
        error: err => {
          if (environment.enableDebugLogs) console.error('Failed to save order:', err);
        }
      });
    });
  }

  onClose() {
    this.close.emit();
  }

  private getSyncChannel(): BroadcastChannel | null {
    if (!this.isBrowser || typeof BroadcastChannel === 'undefined') {
      return null;
    }
    if (this.syncChannel) {
      return this.syncChannel;
    }
    try {
      this.syncChannel = new BroadcastChannel(this.PROJECTS_SYNC_CHANNEL_NAME);
    } catch {
      this.syncChannel = null;
    }
    return this.syncChannel;
  }

  private broadcastLookupsRefresh(reason: string): void {
    broadcastTenderProjectsSync('lookups', reason, {
      isBrowser: this.isBrowser,
      channel: this.getSyncChannel(),
      scope: this.scopedStorageKey(this.PROJECTS_SYNC_CHANNEL_NAME),
      sourceId: this.syncClientId,
      storageKey: this.scopedStorageKey(this.LOOKUPS_REFRESH_BROADCAST_KEY)
    });
  }
}
