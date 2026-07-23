import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  QueryList,
  SimpleChanges,
  ViewChild,
  ViewChildren,
  inject,
  OnChanges,
  OnInit
} from '@angular/core';
import { Observable } from 'rxjs';

import { FormsModule } from '@angular/forms';
import { AppIconDirective } from '@shared/icons/app-icon.directive';
import { OverlayPanelComponent } from '@shared/ui/overlay-panel.component';
import { SearchSelectComponent } from '@shared/ui/search-select.component';
import { DateInputComponent } from '@shared/ui/date-input.component';
import { TenderRow } from '../tender-project-details/project-details.component';
import { TenderProjectsFeatureFacade } from '@features/tender/projects';
import type { DirectoryUser, IdName } from '../tender-projects.contracts';
import { TenderProjectDirectoryFacade } from '../../tender-project-directory.facade';
import {
  addOption,
  buildLookupOptions,
  buildUniqueOptions,
  createEmptyTenderFormModel,
  createInitialTenderFormState,
  extractLookupErrorMessage,
  findLookupByName,
  getEmptyOptionalFields,
  getLookupLabel,
  hasOptionName,
  isPlaceholderUser,
  isWarnFieldBlank,
  replaceOption,
  resolveTenderCurrency,
  sanitizeSelectText,
  updateLookupList
} from './add-tender-panel.form.helper';
import type {
  FormModel,
  LookupKind,
  RenamePayload,
  Status,
  TenderImportance
} from './add-tender-panel.models';
import { environment } from '../../../../../../../environments/environment';
type LooseValue = ReturnType<typeof JSON.parse>;

@Component({
  selector: 'add-tender-panel',
  standalone: true,
  imports: [
    FormsModule,
    OverlayPanelComponent,
    SearchSelectComponent,
    DateInputComponent,
    AppIconDirective
  ],
  templateUrl: './add-tender-panel.component.html',
  styleUrl: './add-tender-panel.component.scss'
})
export class AddTenderPanelComponent implements OnInit, OnChanges {
  private readonly projectsFacade = inject(TenderProjectsFeatureFacade);
  private api = this.projectsFacade.api;
  private readonly directory = inject(TenderProjectDirectoryFacade);
  @ViewChild(OverlayPanelComponent)
  private readonly overlayPanel?: OverlayPanelComponent;
  @ViewChild('titleInputArea', { read: ElementRef })
  private readonly titleInputArea?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('descriptionEditorShell', { read: ElementRef })
  private readonly descriptionEditorShell?: ElementRef<HTMLElement>;
  @ViewChild('delayReasonEditorShell', { read: ElementRef })
  private readonly delayReasonEditorShell?: ElementRef<HTMLElement>;
  @ViewChildren(SearchSelectComponent)
  private readonly searchSelects?: QueryList<SearchSelectComponent<string>>;

  private _open = false;
  @Input() set open(v: boolean) {
    const opening = !this._open && v === true;
    this._open = v;
    if (opening) this.initializeForm();
  }
  get open() {
    return this._open;
  }
  @Input() editMode = false;
  @Input() bulkEdit = false;
  @Input() bulkEditCount = 0;
  @Input() panelTitle = '';
  @Input() initialValue: TenderRow | null = null;
  get resolvedTitle(): string {
    const explicit = (this.panelTitle ?? '').trim();
    if (explicit) {
      return explicit;
    }
    if (this.bulkEdit) {
      const count = Math.max(this.bulkEditCount || 0, 2);
      return `Edit ${count} Projects`;
    }
    if (this.editMode) {
      return 'Edit Project';
    }
    return 'New Project';
  }

  @Output() save = new EventEmitter<TenderRow>();
  @Output() close = new EventEmitter<void>();
  @Output() lookupUpdated = new EventEmitter<{ type: LookupKind; item: IdName }>();
  @Output() lookupUpdateFailed = new EventEmitter<{
    type: LookupKind;
    name: string;
    message: string;
  }>();

  model: FormModel = createEmptyTenderFormModel();
  private initial = '';

  importance: TenderImportance = '';

  titleError = false;
  titleTooLong = false;
  dateError = '';
  private warnSet = new Set<string>();
  private reviewWarnMode = false;
  warn = (k: string) =>
    this.warnSet.has(k) ||
    (this.reviewWarnMode && isWarnFieldBlank(k, this.model, this.importance));

  softWarn = { show: false, items: [] as string[] };
  private pendingSave = false;
  private pendingLookupRequests = 0;
  private deferLookupSave = false;
  private softWarnAutoContinueTimer: ReturnType<typeof setTimeout> | null = null;
  private panelRefitQueued = false;
  closeConfirm = false;
  descriptionExpanded = false;
  delayReasonExpanded = false;
  panelMinHeight = 0;
  panelMaxHeight = 720;
  panelAutoFit = false;

  @Input() ownersList: IdName[] = [];
  @Input() ownerTypesList: IdName[] = [];
  @Input() countriesList: IdName[] = [];
  @Input() stagesList: IdName[] = [];
  @Input() typesList: IdName[] = [];
  @Input() statusesList: IdName[] = [];
  @Input() importanceList: IdName[] = [];
  @Input() assignToSettingsList: IdName[] = [];
  @Input() inChargeSettingsList: IdName[] = [];
  @Input() projectList: TenderRow[] = [];

  titleOptions: string[] = [];
  statusOptions: string[] = [];
  tsOptions: string[] = [];
  topOptions: string[] = [];
  importanceOptions: string[] = [];
  countryOptions: string[] = [];
  ownerOptions: string[] = [];
  ownerTypeOptions: string[] = [];
  peopleOptions: string[] = []; // For assignTo & inCharge

  get activeTabLabel(): string {
    if (this.bulkEdit) {
      return 'Edit Projects';
    }
    if (this.editMode) {
      return 'Edit Project';
    }
    return 'New Project';
  }

  get primaryActionLabel(): string {
    if (this.bulkEdit) {
      return 'Apply Changes';
    }
    if (this.editMode) {
      return 'Update Project';
    }
    return 'Create Project';
  }

  get titlePlaceholder(): string {
    if (this.bulkEdit) {
      return 'Project title';
    }
    return this.editMode ? 'Project title' : 'Project name';
  }

  get showDescriptionEditor(): boolean {
    return this.descriptionExpanded || !!this.model.description?.trim();
  }

  get showDelayReasonEditor(): boolean {
    return this.delayReasonExpanded || !!this.model.delayReasons?.trim();
  }

  get panelMetaStatus(): string {
    if (this.pendingLookupRequests > 0) {
      return 'Syncing lookups...';
    }
    if (this.softWarn.show) {
      return 'Review recommended fields';
    }
    return '';
  }

  ngOnInit() {
    this.applyProjectTitles();
    this.applyLookupInputs();
    if (!this.hasAllLookupInputs()) {
      this.loadOptionsFromAPI();
    }
    this.loadPeopleOptions();
  }

  private hasAllLookupInputs(): boolean {
    return !!(
      this.statusesList?.length &&
      this.stagesList?.length &&
      this.typesList?.length &&
      this.importanceList?.length &&
      this.ownerTypesList?.length &&
      this.countriesList?.length &&
      this.ownersList?.length
    );
  }

  ngOnChanges(changes: SimpleChanges) {
    if (
      changes['ownersList'] ||
      changes['countriesList'] ||
      changes['stagesList'] ||
      changes['typesList'] ||
      changes['statusesList'] ||
      changes['importanceList'] ||
      changes['assignToSettingsList'] ||
      changes['inChargeSettingsList']
    ) {
      this.applyLookupInputs();
    }
    if (changes['projectList']) {
      this.applyProjectTitles();
    }
    if (
      this.open &&
      (changes['initialValue'] ||
        changes['editMode'] ||
        changes['bulkEdit'] ||
        changes['panelTitle'])
    ) {
      this.initializeForm();
    }
  }

  private loadOptionsFromAPI() {
    this.api.loadAllLookups().subscribe({
      next: data => {
        const owners = this.ownersList?.length ? this.ownersList : data.owners;
        const ownerTypes = this.ownerTypesList?.length ? this.ownerTypesList : data.ownerTypes;
        const countries = this.countriesList?.length ? this.countriesList : data.countries;
        const stages = this.stagesList?.length ? this.stagesList : data.stages;
        const types = this.typesList?.length ? this.typesList : data.types;
        const statuses = this.statusesList?.length ? this.statusesList : data.statuses;
        const importances = this.importanceList?.length
          ? this.importanceList
          : data.degreesOfImportance;
        const assignToSettings = this.assignToSettingsList?.length
          ? this.assignToSettingsList
          : (data.assignToSettings ?? []);
        const inChargeSettings = this.inChargeSettingsList?.length
          ? this.inChargeSettingsList
          : (data.inChargeSettings ?? []);
        if (!this.ownersList?.length) this.ownersList = owners;
        if (!this.ownerTypesList?.length) this.ownerTypesList = ownerTypes;
        if (!this.countriesList?.length) this.countriesList = countries;
        if (!this.stagesList?.length) this.stagesList = stages;
        if (!this.typesList?.length) this.typesList = types;
        if (!this.statusesList?.length) this.statusesList = statuses;
        if (!this.importanceList?.length) this.importanceList = importances;
        if (!this.assignToSettingsList?.length) this.assignToSettingsList = assignToSettings;
        if (!this.inChargeSettingsList?.length) this.inChargeSettingsList = inChargeSettings;

        this.statusOptions = buildLookupOptions(statuses);
        this.tsOptions = buildLookupOptions(stages);
        this.topOptions = buildLookupOptions(types);
        this.importanceOptions = buildLookupOptions(importances);
        this.countryOptions = buildLookupOptions(countries);
        this.ownerOptions = buildLookupOptions(owners);
        this.ownerTypeOptions = buildLookupOptions(ownerTypes);
        this.peopleOptions = buildUniqueOptions([
          ...this.peopleOptions,
          ...assignToSettings.map(item => getLookupLabel(item)),
          ...inChargeSettings.map(item => getLookupLabel(item)),
          'Unassigned'
        ]);

        if (!this.peopleOptions.length) {
          this.ensurePeopleFallback();
        }
      },
      error: err => {
        if (environment.enableDebugLogs) console.error('Failed to load options:', err);
        if (
          this.ownersList?.length ||
          this.ownerTypesList?.length ||
          this.countriesList?.length ||
          this.stagesList?.length ||
          this.typesList?.length ||
          this.statusesList?.length ||
          this.importanceList?.length
        ) {
          this.applyLookupInputs();
          return;
        }

        this.statusOptions = [];
        this.tsOptions = [];
        this.topOptions = [];
        this.importanceOptions = [];
        this.countryOptions = [];
        this.ownerOptions = [];
        this.ownerTypeOptions = [];
        if (!this.peopleOptions.length) {
          this.ensurePeopleFallback();
        }
      }
    });
  }

  private loadPeopleOptions() {
    this.directory.list().subscribe({
      next: (users: DirectoryUser[]) => {
        const names = (users ?? [])
          .map(user => (user?.name ?? '').trim())
          .filter(name => name && !isPlaceholderUser(name));
        if (names.length) {
          this.peopleOptions = buildUniqueOptions([
            ...names,
            ...this.assignToSettingsList.map(item => getLookupLabel(item)),
            ...this.inChargeSettingsList.map(item => getLookupLabel(item)),
            'Unassigned'
          ]);
          return;
        }
        this.ensurePeopleFallback();
      },
      error: () => this.ensurePeopleFallback()
    });
  }

  private ensurePeopleFallback() {
    if (!this.peopleOptions.length) {
      this.peopleOptions = buildUniqueOptions([
        ...this.assignToSettingsList.map(item => getLookupLabel(item)),
        ...this.inChargeSettingsList.map(item => getLookupLabel(item)),
        'Unassigned'
      ]);
    }
  }

  private applyLookupInputs() {
    if (this.statusesList?.length) {
      this.statusOptions = buildLookupOptions(this.statusesList);
    }
    if (this.stagesList?.length) {
      this.tsOptions = buildLookupOptions(this.stagesList);
    }
    if (this.typesList?.length) {
      this.topOptions = buildLookupOptions(this.typesList);
    }
    if (this.importanceList?.length) {
      this.importanceOptions = buildLookupOptions(this.importanceList);
    }
    if (this.ownerTypesList?.length) {
      this.ownerTypeOptions = buildLookupOptions(this.ownerTypesList);
    }
    if (this.countriesList?.length) {
      this.countryOptions = buildLookupOptions(this.countriesList);
    }
    if (this.ownersList?.length) {
      this.ownerOptions = buildLookupOptions(this.ownersList);
    }
    this.peopleOptions = buildUniqueOptions([
      ...this.peopleOptions,
      ...this.assignToSettingsList.map(item => getLookupLabel(item)),
      ...this.inChargeSettingsList.map(item => getLookupLabel(item)),
      'Unassigned'
    ]);
  }

  private applyProjectTitles() {
    if (this.projectList?.length) {
      this.titleOptions = buildUniqueOptions(this.projectList.map(item => item.title ?? ''));
    } else {
      this.titleOptions = [];
    }
  }

  currency: { code: string; symbol: string } = { code: '', symbol: '' };

  private initializeForm() {
    this.resetForm();
    if (this.initialValue) {
      this.applyInitialValue(this.initialValue);
    }
    this.initial = JSON.stringify(this.model) + '|' + this.importance;
    this.queuePanelRefit();
  }

  private applyInitialValue(row: TenderRow) {
    const seeded = createInitialTenderFormState(row);
    this.model = seeded.model;
    this.importance = seeded.importance;
    this.onCountryChange(seeded.country);
    this.descriptionExpanded = !!this.model.description?.trim();
    this.delayReasonExpanded = !!this.model.delayReasons?.trim();
    if (this.descriptionExpanded || this.delayReasonExpanded) {
      this.enablePanelExpansion();
    }
    this.titleError = false;
    this.titleTooLong = false;
    this.dateError = '';
  }

  private resetForm() {
    this.model = createEmptyTenderFormModel();
    this.importance = '';
    this.currency = { code: '', symbol: '' };
    this.titleError = false;
    this.titleTooLong = false;
    this.dateError = '';
    this.warnSet.clear();
    this.reviewWarnMode = false;
    this.clearSoftWarnAutoContinueTimer();
    this.softWarn = { show: false, items: [] };
    this.pendingSave = false;
    this.pendingLookupRequests = 0;
    this.deferLookupSave = false;
    this.closeConfirm = false;
    this.descriptionExpanded = false;
    this.delayReasonExpanded = false;
    this.restoreBasePanelSizing();
    this.initial = JSON.stringify(this.model) + '|' + this.importance;
  }

  openDescriptionEditor(): void {
    this.descriptionExpanded = true;
    this.enablePanelExpansion();
    this.queuePanelRefit();
  }

  openDelayReasonEditor(): void {
    this.delayReasonExpanded = true;
    this.enablePanelExpansion();
    this.queuePanelRefit();
  }

  focusTextarea(textarea: HTMLTextAreaElement | null): void {
    textarea?.focus();
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    if (!this.open || this.softWarn.show || this.closeConfirm) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    this.collapseDescriptionEditorIfEmpty(target);
    this.collapseDelayReasonEditorIfEmpty(target);
  }

  onTitleKeydown(event: KeyboardEvent, textarea: HTMLTextAreaElement): void {
    if (event.key !== 'Enter') return;
    if (!event.shiftKey) {
      event.preventDefault();
      return;
    }

    event.stopPropagation();
    queueMicrotask(() => this.resizeTitleTextarea(textarea));
  }

  onTitleInput(textarea: HTMLTextAreaElement): void {
    this.resizeTitleTextarea(textarea);
    this.syncPanelSizing();
    this.queuePanelRefit();
  }

  onCountryChange(c: '' | string) {
    if (!c) {
      this.currency = { code: '', symbol: '' };
      return;
    }
    this.currency = resolveTenderCurrency(c);
  }

  setTitle(value: string) {
    this.model.title = value || '';
    this.titleError = false;
    this.titleTooLong = (value || '').trim().length > 200;
  }

  setCountry(value: string) {
    const next = value || '';
    this.model.country = next;
    this.onCountryChange(next);
  }

  setStatus(value: string) {
    this.model.status = (value || '') as Status | '';
  }

  setImportance(value: string) {
    this.importance = (value || '') as TenderImportance;
  }

  onCreateTitle(name: string) {
    const next = name.trim();
    if (!next) return;
    this.setTitle(next);
    this.titleOptions = addOption(this.titleOptions, next);
  }
  onRenameTitle(payload: RenamePayload) {
    const from = (payload?.from ?? this.model.title ?? '').trim();
    const to = (payload?.to ?? '').trim();
    if (!from || !to) return;
    if (from.toLowerCase() === to.toLowerCase()) return;
    this.titleOptions = replaceOption(this.titleOptions, from, to);
    this.setTitle(to);
  }

  onCreateOwner(name: string) {
    const next = name.trim();
    if (!next) return;
    const existing = findLookupByName(this.ownersList, next);
    if (existing) {
      this.model.owner = getLookupLabel(existing);
      return;
    }
    const countryId = findLookupByName(this.countriesList, this.model.country)?.id ?? null;
    this.createLookup(
      'owner',
      next,
      value => this.api.createOwner(value, countryId),
      item => {
        const nextList = updateLookupList(this.ownersList, item);
        this.ownersList = nextList;
        this.ownerOptions = buildLookupOptions(nextList);
        this.model.owner = getLookupLabel(nextList.find(entry => entry.id === item.id) ?? item);
      }
    );
  }
  onCreateCountry(name: string) {
    const next = name.trim();
    if (!next) return;
    const existing = findLookupByName(this.countriesList, next);
    if (existing) {
      this.setCountry(getLookupLabel(existing));
      return;
    }
    this.createLookup(
      'country',
      next,
      value => this.api.createCountry(value),
      item => {
        const nextList = updateLookupList(this.countriesList, item);
        this.countriesList = nextList;
        this.countryOptions = buildLookupOptions(nextList);
        this.setCountry(getLookupLabel(nextList.find(entry => entry.id === item.id) ?? item));
      }
    );
  }
  onCreateOwnerType(name: string) {
    const next = name.trim();
    if (!next) return;
    const existing = findLookupByName(this.ownerTypesList, next);
    if (existing) {
      this.model.ownerType = getLookupLabel(existing);
      return;
    }
    this.createLookup(
      'ownerType',
      next,
      value => this.api.createOwnerType(value),
      item => {
        const nextList = updateLookupList(this.ownerTypesList, item);
        this.ownerTypesList = nextList;
        this.ownerTypeOptions = buildLookupOptions(nextList);
        this.model.ownerType = getLookupLabel(nextList.find(entry => entry.id === item.id) ?? item);
      }
    );
  }
  onCreateStage(name: string) {
    const next = name.trim();
    if (!next) return;
    const existing = findLookupByName(this.stagesList, next);
    if (existing) {
      this.model.ts = getLookupLabel(existing);
      return;
    }
    this.createLookup(
      'stage',
      next,
      value => this.api.createTenderStage(value),
      item => {
        const nextList = updateLookupList(this.stagesList, item);
        this.stagesList = nextList;
        this.tsOptions = buildLookupOptions(nextList);
        this.model.ts = getLookupLabel(nextList.find(entry => entry.id === item.id) ?? item);
      }
    );
  }
  onCreateType(name: string) {
    const next = name.trim();
    if (!next) return;
    const existing = findLookupByName(this.typesList, next);
    if (existing) {
      this.model.top = getLookupLabel(existing);
      return;
    }
    this.createLookup(
      'type',
      next,
      value => this.api.createTypeOfProject(value),
      item => {
        const nextList = updateLookupList(this.typesList, item);
        this.typesList = nextList;
        this.topOptions = buildLookupOptions(nextList);
        this.model.top = getLookupLabel(nextList.find(entry => entry.id === item.id) ?? item);
      }
    );
  }
  onCreateStatus(name: string) {
    const next = name.trim();
    if (!next) return;
    const existing = findLookupByName(this.statusesList, next);
    if (existing) {
      this.setStatus(getLookupLabel(existing));
      return;
    }
    this.createLookup(
      'status',
      next,
      value => this.api.createStatus(value),
      item => {
        const nextList = updateLookupList(this.statusesList, item);
        this.statusesList = nextList;
        this.statusOptions = buildLookupOptions(nextList);
        this.setStatus(getLookupLabel(nextList.find(entry => entry.id === item.id) ?? item));
      }
    );
  }
  onCreateImportance(name: string) {
    const next = name.trim();
    if (!next) return;
    const existing = findLookupByName(this.importanceList, next);
    if (existing) {
      this.setImportance(getLookupLabel(existing));
      return;
    }
    this.createLookup(
      'importance',
      next,
      value => this.api.createDegreeOfImportance(value),
      item => {
        const nextList = updateLookupList(this.importanceList, item);
        this.importanceList = nextList;
        this.importanceOptions = buildLookupOptions(nextList);
        this.setImportance(getLookupLabel(nextList.find(entry => entry.id === item.id) ?? item));
      }
    );
  }
  onCreateAssignee(name: string) {
    this.updatePersonField('assignTo', name);
  }
  onCreateInCharge(name: string) {
    this.updatePersonField('inCharge', name);
  }
  onRenameOwner(payload: RenamePayload) {
    const from = (payload?.from ?? this.model.owner ?? '').trim();
    const to = (payload?.to ?? '').trim();
    this.renameLookup(
      'owner',
      from,
      to,
      this.ownersList,
      (id, name) => this.api.updateOwner(id, name),
      item => {
        const nextList = updateLookupList(this.ownersList, item);
        this.ownersList = nextList;
        this.ownerOptions = buildLookupOptions(nextList);
        this.model.owner = getLookupLabel(nextList.find(entry => entry.id === item.id) ?? item);
      }
    );
  }
  onRenameCountry(payload: RenamePayload) {
    const from = (payload?.from ?? this.model.country ?? '').trim();
    const to = (payload?.to ?? '').trim();
    this.renameLookup(
      'country',
      from,
      to,
      this.countriesList,
      (id, name) => this.api.updateCountry(id, name),
      item => {
        const nextList = updateLookupList(this.countriesList, item);
        this.countriesList = nextList;
        this.countryOptions = buildLookupOptions(nextList);
        this.setCountry(getLookupLabel(nextList.find(entry => entry.id === item.id) ?? item));
      }
    );
  }
  onRenameOwnerType(payload: RenamePayload) {
    const from = (payload?.from ?? this.model.ownerType ?? '').trim();
    const to = (payload?.to ?? '').trim();
    this.renameLookup(
      'ownerType',
      from,
      to,
      this.ownerTypesList,
      (id, name) => this.api.updateOwnerType(id, name),
      item => {
        const nextList = updateLookupList(this.ownerTypesList, item);
        this.ownerTypesList = nextList;
        this.ownerTypeOptions = buildLookupOptions(nextList);
        this.model.ownerType = getLookupLabel(nextList.find(entry => entry.id === item.id) ?? item);
      }
    );
  }
  onRenameStage(payload: RenamePayload) {
    const from = (payload?.from ?? this.model.ts ?? '').trim();
    const to = (payload?.to ?? '').trim();
    this.renameLookup(
      'stage',
      from,
      to,
      this.stagesList,
      (id, name) => this.api.updateTenderStage(id, name),
      item => {
        const nextList = updateLookupList(this.stagesList, item);
        this.stagesList = nextList;
        this.tsOptions = buildLookupOptions(nextList);
        this.model.ts = getLookupLabel(nextList.find(entry => entry.id === item.id) ?? item);
      }
    );
  }
  onRenameType(payload: RenamePayload) {
    const from = (payload?.from ?? this.model.top ?? '').trim();
    const to = (payload?.to ?? '').trim();
    this.renameLookup(
      'type',
      from,
      to,
      this.typesList,
      (id, name) => this.api.updateTypeOfProject(id, name),
      item => {
        const nextList = updateLookupList(this.typesList, item);
        this.typesList = nextList;
        this.topOptions = buildLookupOptions(nextList);
        this.model.top = getLookupLabel(nextList.find(entry => entry.id === item.id) ?? item);
      }
    );
  }
  onRenameStatus(payload: RenamePayload) {
    const from = (payload?.from ?? this.model.status ?? '').trim();
    const to = (payload?.to ?? '').trim();
    this.renameLookup(
      'status',
      from,
      to,
      this.statusesList,
      (id, name) => this.api.updateStatus(id, name),
      item => {
        const nextList = updateLookupList(this.statusesList, item);
        this.statusesList = nextList;
        this.statusOptions = buildLookupOptions(nextList);
        this.setStatus(getLookupLabel(nextList.find(entry => entry.id === item.id) ?? item));
      }
    );
  }
  onRenameImportance(payload: RenamePayload) {
    const from = (payload?.from ?? this.importance ?? '').trim();
    const to = (payload?.to ?? '').trim();
    this.renameLookup(
      'importance',
      from,
      to,
      this.importanceList,
      (id, name) => this.api.updateDegreeOfImportance(id, name),
      item => {
        const nextList = updateLookupList(this.importanceList, item);
        this.importanceList = nextList;
        this.importanceOptions = buildLookupOptions(nextList);
        this.setImportance(getLookupLabel(nextList.find(entry => entry.id === item.id) ?? item));
      }
    );
  }
  onRenameAssignee(payload: RenamePayload) {
    this.renamePersonField('assignTo', payload);
  }
  onRenameInCharge(payload: RenamePayload) {
    this.renamePersonField('inCharge', payload);
  }
  onNumberWheel(e: WheelEvent) {
    (e.target as HTMLInputElement | null)?.blur();
  }

  private updatePersonField(field: 'assignTo' | 'inCharge', name: string): void {
    const next = name.trim();
    if (!next) return;
    this.model[field] = next;
    this.peopleOptions = addOption(this.peopleOptions, next);
  }

  private renamePersonField(field: 'assignTo' | 'inCharge', payload: RenamePayload): void {
    const from = (payload?.from ?? this.model[field] ?? '').trim();
    const to = (payload?.to ?? '').trim();
    if (!from || !to || from.toLowerCase() === to.toLowerCase()) return;
    if (!hasOptionName(this.peopleOptions, to)) {
      this.peopleOptions = replaceOption(this.peopleOptions, from, to);
    }
    this.model[field] = to;
  }

  private renameLookup(
    type: LookupKind,
    from: string,
    to: string,
    list: IdName[],
    updateFn: (id: number, name: string) => LooseValue,
    apply: (item: IdName) => void
  ): void {
    if (!from || !to) return;
    if (from.toLowerCase() === to.toLowerCase()) return;
    if (this.pendingLookupRequests > 0) return;
    const current = findLookupByName(list, from);
    if (!current?.id) {
      const label = type.charAt(0).toUpperCase() + type.slice(1);
      this.lookupUpdateFailed.emit({ type, name: to, message: `${label} not found` });
      return;
    }
    const conflict = findLookupByName(list, to);
    if (conflict && conflict.id !== current.id) {
      this.lookupUpdateFailed.emit({ type, name: to, message: 'Name already exists' });
      return;
    }
    this.beginLookupRequest();
    updateFn(current.id, to).subscribe({
      next: (updated: IdName) => {
        const item = { id: current.id, name: updated?.name ?? to };
        apply(item);
        this.lookupUpdated.emit({ type, item });
        this.endLookupRequest(true);
      },
      error: (err: LooseValue) => {
        if (environment.enableDebugLogs) console.error('Failed to update lookup:', err);
        this.lookupUpdateFailed.emit({ type, name: to, message: extractLookupErrorMessage(err) });
        this.endLookupRequest(false);
      }
    });
  }
  private createLookup(
    type: LookupKind,
    name: string,
    createFn: (name: string) => Observable<IdName>,
    apply: (item: IdName) => void
  ): void {
    const next = name.trim();
    if (!next) return;
    if (this.pendingLookupRequests > 0) return;
    this.beginLookupRequest();
    createFn(next).subscribe({
      next: (created: IdName) => {
        const item = { id: created?.id, name: created?.name ?? next };
        apply(item);
        this.lookupUpdated.emit({ type, item });
        this.endLookupRequest(true);
      },
      error: (err: LooseValue) => {
        if (environment.enableDebugLogs) console.error('Failed to create lookup:', err);
        this.lookupUpdateFailed.emit({ type, name: next, message: extractLookupErrorMessage(err) });
        this.endLookupRequest(false);
      }
    });
  }
  private beginLookupRequest(): void {
    this.pendingLookupRequests += 1;
  }
  private endLookupRequest(success: boolean): void {
    this.pendingLookupRequests = Math.max(0, this.pendingLookupRequests - 1);
    if (!success) {
      this.deferLookupSave = false;
      return;
    }
    if (this.pendingLookupRequests === 0 && this.deferLookupSave) {
      this.deferLookupSave = false;
      this.performSave();
    }
  }
  private markWarnTemporarily(keys: string[]) {
    keys.forEach(k => this.warnSet.add(k));
    setTimeout(() => {
      keys.forEach(k => this.warnSet.delete(k));
    }, 1600);
  }

  private clearSoftWarnAutoContinueTimer() {
    if (this.softWarnAutoContinueTimer) {
      clearTimeout(this.softWarnAutoContinueTimer);
      this.softWarnAutoContinueTimer = null;
    }
  }

  trySave() {
    if (!this.bulkEdit) {
      const titleValue = this.model.title?.trim() ?? '';
      this.titleError = !titleValue;
      this.titleTooLong = titleValue.length > 200;
      if (this.titleError || this.titleTooLong) return;

      // Date range validation
      this.dateError = '';
      const sd = this.model.startDate ? new Date(this.model.startDate) : null;
      const dl = this.model.deadline ? new Date(this.model.deadline) : null;
      const ed = this.model.endDate ? new Date(this.model.endDate) : null;
      if (sd && dl && sd > dl) {
        this.dateError = 'Start Date cannot be after Deadline';
        return;
      }
      if (sd && ed && sd > ed) {
        this.dateError = 'Start Date cannot be after End Date';
        return;
      }
      if (dl && ed && dl > ed) {
        this.dateError = 'Deadline cannot be after End Date';
        return;
      }
      const blanks = getEmptyOptionalFields(this.model, this.importance);
      if (blanks.length) {
        this.markWarnTemporarily(blanks.map(b => b.key));
        this.reviewWarnMode = false;
        this.softWarn = { show: true, items: blanks.map(b => b.label) };
        this.pendingSave = true;
        return;
      }
      this.reviewWarnMode = false;
      this.softWarn = { show: false, items: [] };
      this.pendingSave = false;
      this.performSave();
      return;
    }
    this.titleError = false;
    this.reviewWarnMode = false;
    this.softWarn = { show: false, items: [] };
    this.pendingSave = false;
    this.performSave();
  }

  dismissSoftWarn() {
    this.clearSoftWarnAutoContinueTimer();
    this.reviewWarnMode = true;
    this.softWarn.show = false;
    this.pendingSave = false;
  }
  confirmSaveAnyway() {
    this.clearSoftWarnAutoContinueTimer();
    this.reviewWarnMode = false;
    this.softWarn.show = false;
    if (this.pendingSave) this.performSave();
    this.pendingSave = false;
  }

  private performSave() {
    this.commitPendingInlineSelections();
    if (this.pendingLookupRequests > 0) {
      this.deferLookupSave = true;
      return;
    }
    const title = (this.model.title || '').trim();
    const owner = sanitizeSelectText(this.model.owner);
    const ownerType = sanitizeSelectText(this.model.ownerType);
    const assignTo = sanitizeSelectText(this.model.assignTo);
    const inCharge = sanitizeSelectText(this.model.inCharge);
    const top = sanitizeSelectText(this.model.top);
    const ts = sanitizeSelectText(this.model.ts);
    const countryValue = sanitizeSelectText(this.model.country);
    const statusValue = sanitizeSelectText(this.model.status);
    const importance = sanitizeSelectText(this.importance);
    const country = countryValue;
    const status = statusValue as Status | '';
    const price = this.model.price != null ? this.model.price : undefined;
    const ownerId = findLookupByName(this.ownersList, owner)?.id;
    const ownerTypeId = findLookupByName(this.ownerTypesList, ownerType)?.id;
    const statusId = findLookupByName(this.statusesList, status)?.id;
    const tenderStageId = findLookupByName(this.stagesList, ts)?.id;
    const typeOfProjectId = findLookupByName(this.typesList, top)?.id;
    const degreeOfImportanceId = findLookupByName(this.importanceList, importance)?.id;
    const countryId = findLookupByName(this.countriesList, country)?.id;
    const row: TenderRow = {
      title,
      description: this.model.description?.trim() || null,
      owner,
      ownerId,
      ownerType,
      ownerTypeId,
      deadline: this.model.deadline || '',
      startDate: this.model.startDate || '',
      endDate: this.model.endDate || '',
      top,
      typeOfProjectId,
      ts,
      tenderStageId,
      price,
      assignTo,
      acceptDate: this.model.acceptDate || '',
      status: status as Status,
      statusId,
      prb: this.model.prb ?? null,
      consultant: this.model.consultant?.trim() || '',
      delayReasons: this.model.delayReasons?.trim() || '',
      doi: importance,
      degreeOfImportanceId,
      country,
      countryId,
      inCharge
    };

    this.save.emit(row);
  }

  private commitPendingInlineSelections(): void {
    this.searchSelects?.forEach(select => select.commitPendingInlineValue());
  }

  private isDirty(): boolean {
    const current = JSON.stringify(this.model) + '|' + this.importance;
    return current !== this.initial;
  }

  onRequestClose() {
    if (this.isDirty()) {
      this.closeConfirm = true;
      return;
    }
    this.close.emit();
  }
  forceClose() {
    this.closeConfirm = false;
    this.close.emit();
  }

  private collapseDescriptionEditorIfEmpty(target: Node): void {
    if (!this.descriptionExpanded || !!this.model.description?.trim()) {
      return;
    }

    const host = this.descriptionEditorShell?.nativeElement;
    if (host?.contains(target)) {
      return;
    }

    this.descriptionExpanded = false;
    this.syncPanelSizing();
    this.queuePanelRefit();
  }

  private collapseDelayReasonEditorIfEmpty(target: Node): void {
    if (!this.delayReasonExpanded || !!this.model.delayReasons?.trim()) {
      return;
    }

    const host = this.delayReasonEditorShell?.nativeElement;
    if (host?.contains(target)) {
      return;
    }

    this.delayReasonExpanded = false;
    this.syncPanelSizing();
    this.queuePanelRefit();
  }

  private resizeTitleTextarea(textarea: HTMLTextAreaElement): void {
    if (!textarea) return;

    const minHeight = 35;
    const maxHeight = 160;
    textarea.style.setProperty('height', `${minHeight}px`, 'important');
    const nextHeight = Math.min(maxHeight, Math.max(minHeight, textarea.scrollHeight));
    textarea.style.setProperty('height', `${nextHeight}px`, 'important');
    textarea.style.setProperty(
      'overflow-y',
      textarea.scrollHeight > maxHeight ? 'auto' : 'hidden',
      'important'
    );
  }

  private queuePanelRefit(): void {
    if (this.panelRefitQueued) return;
    this.panelRefitQueued = true;
    requestAnimationFrame(() => {
      this.panelRefitQueued = false;
      this.overlayPanel?.requestLayoutRefit();
    });
  }

  private enablePanelExpansion(): void {
    this.panelMaxHeight = 980;
    this.panelAutoFit = true;
  }

  private restoreBasePanelSizing(): void {
    this.panelMinHeight = 0;
    this.panelMaxHeight = 720;
    this.panelAutoFit = false;
  }

  private syncPanelSizing(): void {
    if (this.shouldKeepExpandedSizing()) {
      this.enablePanelExpansion();
      return;
    }

    this.restoreBasePanelSizing();
  }

  private shouldKeepExpandedSizing(): boolean {
    return this.descriptionExpanded || this.delayReasonExpanded || this.isTitleExpanded();
  }

  private isTitleExpanded(): boolean {
    const textarea = this.titleInputArea?.nativeElement;
    if (textarea) {
      return textarea.scrollHeight > 35;
    }

    return (this.model.title ?? '').includes('\n');
  }
}
