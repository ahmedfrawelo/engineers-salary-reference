import {
  ChangeDetectorRef,
  Component,
  DoCheck,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AUTH_USER_FACADE } from '@core/auth/auth-user.facade';
import { PermissionService } from '@core/authorization/permission.service';
import { TenderProjectsFeatureFacade } from '@features/tender/projects';
import { AppIconDirective } from '@shared/icons/app-icon.directive';
import { DateInputComponent } from '@shared/ui/date-input.component';
import { OverlayPanelComponent } from '@shared/ui/overlay-panel.component';
import { SearchSelectComponent } from '@shared/ui/search-select.component';
import type { AuditTrail, DirectoryUser, IdName } from '../tender-projects.contracts';
import { TenderProjectChecklistsFacade } from '../../tender-project-checklists.facade';
import { TenderProjectDirectoryFacade } from '../../tender-project-directory.facade';
import { resolveTenderProjectLookupDisplayLabel } from '../tender-projects.lookup.util';
import { ProjectDetailsLookupBase } from './project-details.lookup.base';
import {
  buildProjectDetailsSnapshot,
  resolvePendingProjectDetailsAction,
  type PendingProjectDetailsAction,
  type ProjectTitleRenamePayload
} from './project-details.panel-action.util';
import {
  normalizeProjectValidationIssues,
  type ProjectValidationIssueInput,
  type ProjectValidationField,
  summarizeProjectValidation,
  type ProjectValidationIssue,
  type ProjectValidationSummary
} from './project-details.validation.util';
import type {
  ChecklistItem,
  ProjectDetailsChecklistActionFailedEvent,
  ProjectDetailsLookupCreateFailedEvent,
  ProjectDetailsLookupCreatedEvent,
  ProjectDetailsLookupUpdateFailedEvent,
  ProjectDetailsLookupUpdatedEvent,
  TenderRow
} from './project-details.models';
import { OverviewTabComponent } from './tabs/overview-tab.component';
import type { Activity, ActivityNotePayload, MentionUser } from './tabs/activity-tab.models';
import type {
  ProjectNotificationFocus,
  ProjectNotificationFocusSection
} from '../tender-projects.notification-route.helper';
import { environment } from '../../../../../../../environments/environment';

export type {
  ChecklistItem,
  ChecklistSubItem,
  LookupKind,
  RenamePayload,
  Status,
  TenderRow
} from './project-details.models';

type ProjectSidebarSectionId =
  | 'overview'
  | 'description'
  | 'delay-reason'
  | 'checklists'
  | 'attachments'
  | 'activity';

type ProjectSidebarItem = {
  id: ProjectSidebarSectionId;
  label: string;
};

@Component({
  selector: 'tender-project-details',
  standalone: true,
  imports: [
    FormsModule,
    AppIconDirective,
    DateInputComponent,
    OverlayPanelComponent,
    SearchSelectComponent,
    OverviewTabComponent
  ],
  templateUrl: './project-details.component.html',
  styleUrls: ['./project-details.component.scss']
})
export class TenderProjectDetailsComponent
  extends ProjectDetailsLookupBase
  implements OnInit, OnChanges, DoCheck, OnDestroy
{
  private readonly AUTO_SAVE_DEBOUNCE_MS = 900;
  private readonly projectsFacade = inject(TenderProjectsFeatureFacade);
  protected api = this.projectsFacade.api;
  protected readonly checklistsApi = inject(TenderProjectChecklistsFacade);
  private readonly directory = inject(TenderProjectDirectoryFacade);

  @Input() row!: TenderRow;
  @Input() open = false;
  @Input() projectList: TenderRow[] = [];
  @Input() activities: Activity[] = [];
  @Input() activityLoading = false;
  @Input() detailsLoading = false;
  @Input() notificationFocus: ProjectNotificationFocus | null = null;
  @Input() saveBusy = false;
  @Input() saveErrorMessage = '';
  @Input() saveFieldIssues: ProjectValidationIssueInput[] = [];
  @Input() ownersList: IdName[] = [];
  @Input() ownerTypesList: IdName[] = [];
  @Input() countriesList: IdName[] = [];
  @Input() stagesList: IdName[] = [];
  @Input() typesList: IdName[] = [];
  @Input() statusesList: IdName[] = [];
  @Input() importanceList: IdName[] = [];
  @Input() assignToSettingsList: IdName[] = [];
  @Input() inChargeSettingsList: IdName[] = [];
  @Input() canEdit = true;
  @Input() canDelete = true;

  @Output() save = new EventEmitter<TenderRow>();
  @Output() switchProject = new EventEmitter<TenderRow>();
  @Output() lookupCreated = new EventEmitter<ProjectDetailsLookupCreatedEvent>();
  @Output() lookupCreateFailed = new EventEmitter<ProjectDetailsLookupCreateFailedEvent>();
  @Output() lookupUpdated = new EventEmitter<ProjectDetailsLookupUpdatedEvent>();
  @Output() lookupUpdateFailed = new EventEmitter<ProjectDetailsLookupUpdateFailedEvent>();
  @Output() checklistActionFailed = new EventEmitter<ProjectDetailsChecklistActionFailedEvent>();
  @Output() saveDeferred = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();
  @Output() addNote = new EventEmitter<ActivityNotePayload>();
  @Output() auditRecorded = new EventEmitter<AuditTrail>();

  buffer!: TenderRow;
  projectLabel = (row: TenderRow) => row?.title || 'Project';
  protected pendingLookups = 0;
  protected deferSave = false;
  checklistCreateInFlight = false;
  checklistLoadInFlight = false;
  protected cdr = inject(ChangeDetectorRef);
  protected zone = inject(NgZone);
  private readonly host = inject(ElementRef<HTMLElement>);

  owners: string[] = [];
  ownersSignal = signal<IdName[]>([]);
  ownerTypes: string[] = [];
  ownerTypeLookups: IdName[] = [];
  countries: string[] = [];
  countriesSignal = signal<IdName[]>([]);
  statuses: string[] = [];
  statusLookups: IdName[] = [];
  stages: string[] = [];
  stageLookups: IdName[] = [];
  types: string[] = [];
  typeLookups: IdName[] = [];
  importances: string[] = [];
  importanceLookups: IdName[] = [];
  peopleOptions: string[] = [];
  mentionUsers: MentionUser[] = [];
  mobileSection: 'details' | 'activity' = 'details';
  projectSidebarOpen = false;
  activeProjectSidebarSection: ProjectSidebarSectionId = 'overview';
  projectCommentDraft = '';
  private peopleOptionsLoaded = false;
  private peopleOptionsLoading = false;
  private readonly headerDateFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric'
  });
  private readonly activityDateTimeFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
  private readonly projectDateFormatter = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  private readonly saveTimeFormatter = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  });
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private scheduledAutoSaveSnapshot: string | null = null;
  private queuedAutoSaveSnapshot: string | null = null;
  private pendingPanelAction: PendingProjectDetailsAction | null = null;
  private pendingPanelActionWaitingForSave = false;
  private pendingPanelActionSaveCycleFinished = false;
  private lastSavedAtLabel = '';
  private lastSaveBusy = false;
  protected checklistLoadToken = 0;
  protected readonly authUserFacade = inject(AUTH_USER_FACADE);
  protected readonly permission = inject(PermissionService);
  protected readonly checklistPersistedState = new Map<number, ChecklistItem>();
  @ViewChild(OverviewTabComponent) private overviewTab?: OverviewTabComponent;
  private notificationFocusTimer: ReturnType<typeof setTimeout> | null = null;
  private lastAppliedNotificationFocusKey = '';

  canViewProjectField(field: string): boolean {
    return this.permission.canViewField(`Permissions.Project.Fields.${field}`, [
      'Permissions.Project.View'
    ]);
  }

  canEditProjectField(field: string): boolean {
    return this.permission.canEditField(`Permissions.Project.Fields.${field}`, [
      'Permissions.Project.Edit'
    ]);
  }

  canViewChecklist(): boolean {
    return this.permission.canAny([
      'Permissions.CheckList.View',
      'Permissions.CheckList.Create',
      'Permissions.CheckList.Edit',
      'Permissions.CheckList.Delete'
    ]);
  }

  canCreateOwner(): boolean {
    return this.permission.can('Permissions.Owner.Create');
  }

  canRenameOwnerLookup(): boolean {
    return this.permission.can('Permissions.Owner.Edit');
  }

  canCreateCountry(): boolean {
    return this.permission.can('Permissions.Country.Create');
  }

  canCreateOwnerType(): boolean {
    return this.permission.can('Permissions.OwnerType.Create');
  }

  canRenameCountryLookup(): boolean {
    return this.permission.can('Permissions.Country.Edit');
  }

  canRenameOwnerTypeLookup(): boolean {
    return this.permission.can('Permissions.OwnerType.Edit');
  }

  canCreateStage(): boolean {
    return this.permission.can('Permissions.TenderStage.Create');
  }

  canRenameStageLookup(): boolean {
    return this.permission.can('Permissions.TenderStage.Edit');
  }

  canCreateType(): boolean {
    return this.permission.can('Permissions.TypeOfProject.Create');
  }

  canRenameTypeLookup(): boolean {
    return this.permission.can('Permissions.TypeOfProject.Edit');
  }

  canCreateStatus(): boolean {
    return this.permission.can('Permissions.Status.Create');
  }

  canRenameStatusLookup(): boolean {
    return this.permission.can('Permissions.Status.Edit');
  }

  canCreateImportance(): boolean {
    return this.canEditProjectField('DegreeOfImportance');
  }

  canRenameImportanceLookup(): boolean {
    return this.canEditProjectField('DegreeOfImportance');
  }

  hasFieldError(field: ProjectValidationField): boolean {
    return this.getFieldIssue(field)?.severity === 'error';
  }

  hasFieldWarning(field: ProjectValidationField): boolean {
    return this.getFieldIssue(field)?.severity === 'warning';
  }

  projectOwnerOptions(): string[] {
    return this.ownersSignal().map(
      owner => resolveTenderProjectLookupDisplayLabel(owner) ?? owner.name
    );
  }

  projectCountryOptions(): string[] {
    return this.countriesSignal().map(
      country => resolveTenderProjectLookupDisplayLabel(country) ?? country.name
    );
  }

  projectOwnerTypeOptions(): string[] {
    return this.ownerTypeLookups.map(
      ownerType => resolveTenderProjectLookupDisplayLabel(ownerType) ?? ownerType.name
    );
  }

  displayProjectText(value: unknown, fallback: string): string {
    if (value == null) {
      return fallback;
    }
    const text = String(value).trim();
    if (!text || text === '-') {
      return fallback;
    }
    return text;
  }

  isProjectPlaceholder(value: unknown, fallback: string): boolean {
    return this.displayProjectText(value, fallback) === fallback;
  }

  displayProjectMoney(value: number | string | null | undefined, fallback: string): string {
    if (value == null || value === '') {
      return fallback;
    }
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(parsed);
  }

  isProjectMoneyPlaceholder(value: number | string | null | undefined, fallback: string): boolean {
    return this.displayProjectMoney(value, fallback) === fallback;
  }

  displayProjectPercent(value: number | string | null | undefined, fallback: string): string {
    if (value == null || value === '') {
      return fallback;
    }
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    const percent = parsed * 100;
    const formatted = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(percent);
    return `${formatted}%`;
  }

  isProjectPercentPlaceholder(
    value: number | string | null | undefined,
    fallback: string
  ): boolean {
    return this.displayProjectPercent(value, fallback) === fallback;
  }

  formatProjectDate(value?: string | null): string {
    const iso = this.normalizeProjectDate(value);
    if (!iso) {
      return '';
    }
    const parsed = this.parseProjectDate(iso);
    return parsed ? this.projectDateFormatter.format(parsed) : iso;
  }

  onProjectPriceInput(event: Event): void {
    if (!this.canEdit) {
      return;
    }
    const raw = (event.target as HTMLInputElement | null)?.value.replace(/[^\d.]/g, '') ?? '';
    if (!raw) {
      this.buffer.price = undefined;
      return;
    }
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      this.buffer.price = parsed;
      return;
    }
    this.buffer.price = undefined;
  }

  setProjectOwner(value: string): void {
    this.buffer.owner = (value || '').trim();
    this.buffer.ownerId = undefined;
  }

  setProjectOwnerType(value: string): void {
    this.buffer.ownerType = (value || '').trim();
    this.buffer.ownerTypeId = undefined;
  }

  setProjectCountry(value: string): void {
    this.buffer.country = (value || '').trim();
    this.buffer.countryId = undefined;
  }

  setProjectStage(value: string): void {
    this.buffer.ts = (value || '').trim();
    this.buffer.tenderStageId = undefined;
  }

  setProjectType(value: string): void {
    this.buffer.top = (value || '').trim();
    this.buffer.typeOfProjectId = undefined;
  }

  setProjectStatus(value: string): void {
    this.buffer.status = ((value || '').trim() || 'New') as TenderRow['status'];
    this.buffer.statusId = undefined;
  }

  setProjectImportance(value: string): void {
    this.buffer.doi = (value || '').trim();
    this.buffer.degreeOfImportanceId = undefined;
  }

  autoGrowTextarea(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement | null;
    if (!textarea) {
      return;
    }
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  get validationSummary(): ProjectValidationSummary {
    return summarizeProjectValidation(this.buffer, this.saveValidationIssues);
  }

  get validationPreview(): ProjectValidationIssue[] {
    return this.validationSummary.issues.slice(0, 3);
  }

  get validationOverflowCount(): number {
    return Math.max(0, this.validationSummary.issues.length - this.validationPreview.length);
  }

  get hasValidationIssues(): boolean {
    return this.validationSummary.issues.length > 0;
  }

  get projectAttentionCount(): number {
    return this.validationSummary.errorCount + this.validationSummary.warningCount;
  }

  get saveStateLabel(): string {
    switch (this.saveStateKind) {
      case 'failed':
        return 'Save failed';
      case 'saving':
        return 'Saving';
      case 'deferred':
        return 'Waiting for lookup sync';
      case 'dirty':
        return 'Unsaved changes';
      case 'saved':
        return 'Saved';
      default:
        return 'Ready';
    }
  }

  get saveStateDetail(): string {
    switch (this.saveStateKind) {
      case 'failed':
        return this.saveErrorMessage || 'Please review the highlighted fields and try again.';
      case 'saving':
        return 'Changes are being autosaved in the background.';
      case 'deferred':
        return 'Autosave will continue after the pending lookup update finishes.';
      case 'dirty':
        return 'Your edits are local and will be autosaved automatically.';
      case 'saved':
        return this.lastSavedAtLabel
          ? `Last synced at ${this.lastSavedAtLabel}.`
          : 'Changes are saved.';
      default:
        return 'Edits save automatically while you work.';
    }
  }

  get activityCountLabel(): string {
    if (this.activityLoading) {
      return 'Loading activity';
    }
    const count = this.activities.length;
    return count === 1 ? '1 update' : `${count} updates`;
  }

  get saveStateKind(): 'idle' | 'dirty' | 'saving' | 'deferred' | 'saved' | 'failed' {
    return this.currentSaveState();
  }

  get statusAnnouncement(): string {
    return `${this.saveStateLabel}. ${this.saveStateDetail}`;
  }

  get validationAnnouncement(): string {
    if (!this.hasValidationIssues) {
      return 'No validation issues found.';
    }
    const total = this.validationSummary.errorCount + this.validationSummary.warningCount;
    return `${total} validation issue${total === 1 ? '' : 's'} found.`;
  }

  get canRetrySave(): boolean {
    return (
      !this.saveBusy &&
      !this.detailsLoading &&
      this.open &&
      this.canEdit &&
      this.isDirty() &&
      (this.saveStateKind === 'dirty' || this.saveStateKind === 'failed')
    );
  }

  get saveValidationIssues(): ProjectValidationIssue[] {
    return normalizeProjectValidationIssues(this.saveFieldIssues);
  }

  get projectHeaderCode(): string {
    const id = this.getRowId(this.buffer ?? this.row);
    return id != null ? `${id}` : 'Project';
  }

  get projectReferenceLabel(): string {
    const id = this.getRowId(this.buffer ?? this.row);
    return id != null ? `#${id}` : 'Project';
  }

  get projectCreatedLabel(): string {
    const createdAt = this.buffer?.createdAt ?? this.row?.createdAt ?? null;
    if (!createdAt) {
      return 'Created --';
    }

    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) {
      return 'Created --';
    }

    return `Created ${this.headerDateFormatter.format(date)}`;
  }

  get projectSidebarItems(): ProjectSidebarItem[] {
    const items: ProjectSidebarItem[] = [{ id: 'overview', label: 'Overview' }];
    if (this.canViewProjectField('Description')) {
      items.push({ id: 'description', label: 'Description' });
    }
    if (this.canViewProjectField('DelayReasons')) {
      items.push({ id: 'delay-reason', label: 'Delay reason' });
    }
    if (this.canViewChecklist()) {
      items.push({ id: 'checklists', label: 'Checklists' });
    }
    items.push({ id: 'attachments', label: 'Attachments' }, { id: 'activity', label: 'Activity' });
    return items;
  }

  ngOnInit(): void {
    this.applyLookupInputs();
    if (!this.hasLookupInputs()) {
      this.loadOptionsFromAPI();
    }
    if (this.canEdit) {
      this.ensurePeopleOptionsLoaded();
    }
    this.lastSaveBusy = this.saveBusy;
  }

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['row']) {
      this.rememberRowSaveState(ch['row']);
      this.clearAutoSaveTimer();
      this.scheduledAutoSaveSnapshot = null;
      this.queuedAutoSaveSnapshot = null;
      this.mobileSection = 'details';
      this.activeProjectSidebarSection = 'overview';
      this.buffer = { ...(this.row || ({} as TenderRow)) };
      if (!this.buffer.checklists) this.buffer.checklists = [];
      this.setChecklistBusy(false);
      if (this.row?.checklistsLoaded) {
        this.applyChecklistSnapshot(this.row.checklists ?? [], true);
        this.setChecklistLoad(false);
      } else if (!this.detailsLoading) {
        this.loadChecklistsForRow();
      }
    }
    if (ch['detailsLoading'] && !this.detailsLoading) {
      if (this.row?.checklistsLoaded) {
        this.applyChecklistSnapshot(this.row.checklists ?? [], true);
        this.setChecklistLoad(false);
      } else if (this.row) {
        this.loadChecklistsForRow();
      }
    }
    if (
      ch['ownersList'] ||
      ch['ownerTypesList'] ||
      ch['countriesList'] ||
      ch['stagesList'] ||
      ch['typesList'] ||
      ch['statusesList'] ||
      ch['importanceList'] ||
      ch['assignToSettingsList'] ||
      ch['inChargeSettingsList']
    ) {
      this.applyLookupInputs();
    }

    if (ch['canEdit'] && this.canEdit) {
      this.ensurePeopleOptionsLoaded();
    }
    if (ch['saveBusy']) {
      const saveJustFinished = this.lastSaveBusy && !this.saveBusy;
      if (saveJustFinished) {
        this.queuedAutoSaveSnapshot = null;
        if (this.pendingPanelActionWaitingForSave) {
          this.pendingPanelActionSaveCycleFinished = true;
        }
      }
      this.lastSaveBusy = this.saveBusy;
    }
    if (ch['open'] && !this.open) {
      this.clearAutoSaveTimer();
      this.scheduledAutoSaveSnapshot = null;
      this.clearPendingPanelAction();
      this.clearNotificationFocusTimer();
      this.lastAppliedNotificationFocusKey = '';
    }
    if (
      ch['row'] ||
      ch['open'] ||
      ch['activities'] ||
      ch['activityLoading'] ||
      ch['detailsLoading'] ||
      ch['notificationFocus']
    ) {
      this.scheduleNotificationFocus();
    }
    this.tryResolvePendingPanelAction();
  }

  ngDoCheck(): void {
    this.maybeScheduleAutoSave();
    this.tryResolvePendingPanelAction();
  }

  ngOnDestroy(): void {
    this.clearAutoSaveTimer();
    this.clearPendingPanelAction();
    this.clearNotificationFocusTimer();
  }

  protected override setChecklistLoad(value: boolean): void {
    super.setChecklistLoad(value);
    if (!value) {
      this.scheduleNotificationFocus();
    }
  }

  @HostListener('dblclick', ['$event'])
  onDbl(e: MouseEvent): void {
    const el = (e.target as HTMLElement)?.closest('overlay-panel .modal-hdr .ttl');
    if (
      el &&
      this.canEdit &&
      this.canEditProjectField('Name') &&
      this.canViewProjectField('Name')
    ) {
      setTimeout(() => this.focusRename(), 0);
    }
  }

  onClosePanel(): void {
    if (this.queuePendingPanelAction({ type: 'close' })) {
      return;
    }
    this.flushAutoSave();
    this.close.emit();
  }

  onProjectSwitch(row: TenderRow | null): void {
    if (!row || row === this.row) return;
    if (this.row?.id != null && row.id === this.row.id) return;
    if (this.queuePendingPanelAction({ type: 'switch', row })) {
      return;
    }
    this.switchProject.emit(row);
  }

  onProjectRename(
    payload:
      | ProjectTitleRenamePayload
      | {
          from: string | TenderRow | null;
          to: string;
        }
  ): void {
    if (!this.canEdit || !this.canEditProjectField('Name')) {
      return;
    }
    const next = (payload?.to ?? '').trim();
    if (!next) return;
    if ((this.buffer?.title ?? '').trim().toLowerCase() === next.toLowerCase()) {
      return;
    }
    this.buffer.title = next;
    this.cdr.markForCheck();
  }

  setMobileSection(section: 'details' | 'activity'): void {
    if (this.mobileSection === section) {
      return;
    }
    this.mobileSection = section;
    this.activeProjectSidebarSection = section === 'activity' ? 'activity' : 'overview';
    this.cdr.markForCheck();
  }

  toggleProjectSidebar(): void {
    this.projectSidebarOpen = !this.projectSidebarOpen;
    this.cdr.markForCheck();
  }

  openProjectSidebarSection(sectionId: ProjectSidebarSectionId): void {
    this.activeProjectSidebarSection = sectionId;
    if (sectionId === 'activity') {
      this.mobileSection = 'activity';
    } else {
      this.mobileSection = 'details';
    }
    this.cdr.markForCheck();
    setTimeout(() => {
      const target = this.host.nativeElement.querySelector(
        `[data-project-section="${sectionId}"]`
      ) as HTMLElement | null;
      target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }, 0);
  }

  private scheduleNotificationFocus(): void {
    if (!this.open || !this.notificationFocus) {
      return;
    }
    this.clearNotificationFocusTimer();
    const delay =
      this.detailsLoading || this.activityLoading || this.checklistLoadInFlight ? 140 : 40;
    this.notificationFocusTimer = setTimeout(() => {
      this.notificationFocusTimer = null;
      this.applyNotificationFocus();
    }, delay);
  }

  private applyNotificationFocus(): void {
    const focus = this.notificationFocus;
    if (!this.open || !focus) {
      return;
    }

    const section = this.resolveNotificationFocusSection(focus);
    if (!section) {
      return;
    }

    const key = this.buildNotificationFocusKey(focus);
    const selector = this.resolveNotificationTargetSelector(focus);
    if (!selector && key === this.lastAppliedNotificationFocusKey) {
      return;
    }

    this.openProjectSidebarSection(section);

    if (!selector) {
      this.lastAppliedNotificationFocusKey = key;
      return;
    }

    setTimeout(() => {
      const target = this.host.nativeElement.querySelector(selector) as HTMLElement | null;
      if (!target) {
        if (this.detailsLoading || this.activityLoading || this.checklistLoadInFlight) {
          this.scheduleNotificationFocus();
        }
        return;
      }

      this.scrollNotificationTargetIntoView(target);
      this.lastAppliedNotificationFocusKey = key;
    }, 180);
  }

  private clearNotificationFocusTimer(): void {
    if (!this.notificationFocusTimer) {
      return;
    }
    clearTimeout(this.notificationFocusTimer);
    this.notificationFocusTimer = null;
  }

  private resolveNotificationFocusSection(
    focus: ProjectNotificationFocus
  ): ProjectSidebarSectionId | null {
    const section = focus.section;
    if (section && this.isProjectSidebarSection(section)) {
      return section;
    }
    if (focus.commentId) {
      return 'activity';
    }
    if (focus.checklistId) {
      return 'checklists';
    }
    return null;
  }

  private isProjectSidebarSection(
    value: ProjectNotificationFocusSection
  ): value is ProjectSidebarSectionId {
    return this.projectSidebarItems.some(item => item.id === value);
  }

  private resolveNotificationTargetSelector(focus: ProjectNotificationFocus): string | null {
    if (focus.commentId) {
      return `[data-project-activity-id="${focus.commentId}"]`;
    }
    if (focus.checklistId) {
      return `[data-project-checklist-id="${focus.checklistId}"]`;
    }
    return null;
  }

  private buildNotificationFocusKey(focus: ProjectNotificationFocus): string {
    return [
      this.getRowId(this.row) ?? 'project',
      focus.section ?? '',
      focus.commentId ?? '',
      focus.checklistId ?? ''
    ].join(':');
  }

  private scrollNotificationTargetIntoView(target: HTMLElement): void {
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    target.classList.add('notification-focus-pulse');
    target.scrollIntoView({
      block: 'center',
      behavior: reduceMotion ? 'auto' : 'smooth'
    });
    setTimeout(() => target.classList.remove('notification-focus-pulse'), 1600);
  }

  activityNotificationTargetId(activity: Activity): number | null {
    return this.readPositiveNumber(activity.id);
  }

  isNotificationFocusedActivity(activity: Activity): boolean {
    const commentId = this.notificationFocus?.commentId ?? null;
    return !!commentId && this.activityNotificationTargetId(activity) === commentId;
  }

  private readPositiveNumber(value: unknown): number | null {
    const parsed = Number(String(value ?? '').trim());
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  trackProjectActivity(index: number, activity: Activity): string {
    return (
      activity.key ??
      activity.signature ??
      `${activity.at ?? activity.when ?? 'activity'}:${activity.title ?? activity.text ?? index}`
    );
  }

  projectActivityBody(activity: Activity): string {
    const title = (activity.title ?? activity.text ?? activity.meta ?? '').trim();
    const detail = this.projectActivityDetail(activity);
    const subject = this.projectActivitySubject(activity);

    if ((activity.kind ?? 'other') === 'note') {
      const note = detail || title;
      return note ? `${subject} commented: ${note}` : `${subject} added a comment`;
    }

    const changeSentence =
      this.projectActivityChangeSentence(detail) || this.projectActivityChangeSentence(title);
    if (changeSentence) {
      return `${subject} ${changeSentence}`;
    }

    const titleSentence = this.projectActivityTitleSentence(title, activity.kind);
    if (titleSentence) {
      return `${subject} ${titleSentence}`;
    }

    const fallbackSentence = this.projectActivityFallbackSentence(detail, title);
    if (fallbackSentence) {
      return `${subject} ${fallbackSentence}`;
    }

    return `${subject} changed project details`;
  }

  projectActivityTime(activity: Activity): string {
    if (typeof activity.at === 'number' && Number.isFinite(activity.at)) {
      const date = new Date(activity.at);
      if (!Number.isNaN(date.getTime())) {
        return this.formatProjectActivityTimestamp(date);
      }
    }

    const fullTime = (activity.fullTime ?? '').trim();
    if (fullTime) {
      const parsed = new Date(fullTime);
      if (!Number.isNaN(parsed.getTime())) {
        return this.formatProjectActivityTimestamp(parsed);
      }
      return fullTime;
    }

    const relativeTime = (activity.when ?? '').trim();
    if (relativeTime) {
      return relativeTime;
    }

    return '';
  }

  onProjectCommentInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.projectCommentDraft = input?.value ?? '';
  }

  onProjectCommentKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }
    event.preventDefault();
    this.submitProjectComment();
  }

  submitProjectComment(): void {
    const text = this.projectCommentDraft.trim();
    if (!text) {
      return;
    }
    this.addNote.emit({ text, mentions: [], handles: [] });
    this.projectCommentDraft = '';
    this.cdr.markForCheck();
  }

  trackValidationIssue(index: number, issue: ProjectValidationIssue): string {
    return `${issue.field}:${issue.severity}:${index}`;
  }

  retrySave(): void {
    if (!this.canRetrySave) {
      return;
    }
    this.flushAutoSave();
  }

  focusFirstValidationIssue(): void {
    const firstIssue =
      this.validationSummary.issues.find(issue => issue.severity === 'error') ??
      this.validationSummary.issues[0];
    if (!firstIssue) {
      return;
    }
    this.focusValidationField(firstIssue.field);
  }

  focusValidationField(field: ProjectValidationField): void {
    if (field === 'title') {
      this.focusRename();
      return;
    }

    this.setMobileSection('details');
    setTimeout(() => {
      const container = document.querySelector(
        `[data-project-field="${field}"]`
      ) as HTMLElement | null;
      const target = container?.querySelector(
        '.ss-inline-input, .ss-trigger, .date-trigger, input:not([readonly]), textarea:not([readonly])'
      ) as HTMLElement | null;
      if (target) {
        target.focus({ preventScroll: true });
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
          target.select?.();
        }
        container?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }
      this.overviewTab?.focusValidationField(field);
    }, 0);
  }

  private focusRename(): void {
    const input = document.querySelector(
      '.project-title-slot .ss-inline-input'
    ) as HTMLInputElement | null;
    input?.focus();
    input?.select?.();
  }

  private projectActivityActor(activity: Activity): string {
    const actor = (activity.actor ?? '').trim();
    if (!actor) {
      return '';
    }
    if (actor.includes('@')) {
      return actor.split('@')[0] ?? actor;
    }
    return actor;
  }

  private projectActivitySubject(activity: Activity): string {
    const actor = this.projectActivityActor(activity);
    if (!actor) {
      return 'Someone';
    }
    return this.isCurrentProjectActivityActor(actor) ? 'You' : actor;
  }

  private projectActivityDetail(activity: Activity): string {
    return (activity.detailShort ?? activity.detail ?? activity.detailLong ?? '').trim();
  }

  private projectActivityChangeSentence(value: string): string {
    const firstLine = this.projectActivityFirstLine(value);
    if (!firstLine) {
      return '';
    }

    const rangeMatch = firstLine.match(/^([^:]+):\s*(.*?)\s*->\s*(.*)$/);
    if (rangeMatch) {
      const [, field = '', from = '', to = ''] = rangeMatch;
      const normalizedField = this.projectActivityFieldLabel(field);
      return `changed ${normalizedField} from ${from.trim()} to ${to.trim()}`;
    }

    const valueMatch = firstLine.match(/^([^:]+):\s*(.+)$/);
    if (valueMatch) {
      const [, field = '', value = ''] = valueMatch;
      const normalizedField = this.projectActivityFieldLabel(field);
      return `changed ${normalizedField}: ${value.trim()}`;
    }

    if (this.isGenericProjectActivityUpdateTitle(firstLine)) {
      return '';
    }

    if (this.isProjectActivityVerbPhrase(firstLine)) {
      return this.lowercaseProjectActivityText(firstLine);
    }

    return '';
  }

  private projectActivityTitleSentence(title: string, kind?: Activity['kind']): string {
    const normalizedTitle = title.trim();
    const normalizedKind = (kind ?? 'other').toLowerCase();
    const lowerTitle = normalizedTitle.toLowerCase();

    if (normalizedKind === 'created' || lowerTitle.includes('created')) {
      return 'created this project';
    }
    if (
      normalizedKind === 'deleted' ||
      lowerTitle.includes('deleted') ||
      lowerTitle.includes('removed')
    ) {
      return 'deleted this project';
    }
    if (normalizedKind === 'approved' || lowerTitle.includes('approved')) {
      return 'approved this project';
    }
    if (normalizedKind === 'rejected' || lowerTitle.includes('rejected')) {
      return 'rejected this project';
    }
    if (normalizedKind === 'submitted' || lowerTitle.includes('submitted')) {
      return 'submitted this project';
    }
    if (this.isGenericProjectActivityUpdateTitle(normalizedTitle)) {
      return 'changed project details';
    }
    const trailingVerbSentence = this.projectActivityTrailingVerbSentence(normalizedTitle);
    if (trailingVerbSentence) {
      return trailingVerbSentence;
    }
    if (this.isProjectActivityVerbPhrase(normalizedTitle)) {
      return this.lowercaseProjectActivityText(normalizedTitle);
    }
    if (!normalizedTitle) {
      return '';
    }
    return '';
  }

  private isGenericProjectActivityUpdateTitle(value: string): boolean {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    return /^(updated|update|modified)(\s+(project|details?|record|item|status|field))?$/.test(
      normalized
    );
  }

  private projectActivityTextsMatch(left: string, right: string): boolean {
    const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
    return normalize(left) === normalize(right);
  }

  private projectActivityFallbackSentence(detail: string, title: string): string {
    const firstDetailLine = this.projectActivityFirstLine(detail);
    if (firstDetailLine) {
      if (this.isProjectActivityVerbPhrase(firstDetailLine)) {
        return this.lowercaseProjectActivityText(firstDetailLine);
      }
      if (!this.projectActivityTextsMatch(firstDetailLine, title)) {
        return `changed ${this.lowercaseProjectActivityText(firstDetailLine)}`;
      }
    }

    const firstTitleLine = this.projectActivityFirstLine(title);
    if (!firstTitleLine || this.isGenericProjectActivityUpdateTitle(firstTitleLine)) {
      return '';
    }
    if (this.isProjectActivityVerbPhrase(firstTitleLine)) {
      return this.lowercaseProjectActivityText(firstTitleLine);
    }
    return `changed ${this.lowercaseProjectActivityText(firstTitleLine)}`;
  }

  private projectActivityFirstLine(value: string): string {
    return (
      value
        .split('\n')
        .map(line => line.replace(/^-\s*/, '').trim())
        .find(Boolean) ?? ''
    );
  }

  private projectActivityTrailingVerbSentence(value: string): string {
    const match = value
      .trim()
      .match(
        /^(.*?)\s+(updated|modified|changed|renamed|assigned|approved|rejected|submitted|uploaded|downloaded|imported|exported|shared|archived|restored|deleted|created|removed)$/i
      );
    if (!match) {
      return '';
    }

    const [, subject = '', verb = ''] = match;
    const object = this.lowercaseProjectActivityText(subject);
    if (!object) {
      return '';
    }

    switch (verb.toLowerCase()) {
      case 'updated':
      case 'modified':
      case 'changed':
      case 'renamed':
        return `changed ${object}`;
      case 'removed':
      case 'deleted':
        return `deleted ${object}`;
      case 'created':
        return `created ${object}`;
      default:
        return `${verb.toLowerCase()} ${object}`;
    }
  }

  private isProjectActivityVerbPhrase(value: string): boolean {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    if (this.isGenericProjectActivityUpdateTitle(normalized)) {
      return false;
    }
    return /^(changed|updated|modified|assigned|approved|rejected|submitted|uploaded|downloaded|imported|exported|shared|archived|restored|commented|added|removed|renamed)\s+\S+/.test(
      normalized
    );
  }

  private projectActivityFieldLabel(value: string): string {
    const cleaned = value.trim().replace(/\s+/g, ' ');
    if (!cleaned) {
      return 'field';
    }
    if (/^[A-Z0-9\s]+$/.test(cleaned)) {
      return cleaned;
    }
    return cleaned.toLowerCase();
  }

  private lowercaseProjectActivityText(value: string): string {
    const cleaned = value.trim();
    if (!cleaned) {
      return '';
    }
    return cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
  }

  private isCurrentProjectActivityActor(actor: string): boolean {
    const currentUser = this.authUserFacade.user();
    const candidates = new Set<string>();
    const addCandidate = (value: string | null | undefined) => {
      const normalized = this.normalizeProjectActivityIdentity(value);
      if (normalized) {
        candidates.add(normalized);
      }
    };

    addCandidate(currentUser?.name);
    addCandidate(currentUser?.email);

    const email = currentUser?.email?.trim();
    if (email && email.includes('@')) {
      addCandidate(email.split('@')[0] ?? '');
    }

    return candidates.has(this.normalizeProjectActivityIdentity(actor));
  }

  private normalizeProjectActivityIdentity(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
  }

  private formatProjectActivityTimestamp(date: Date): string {
    const formatted = this.activityDateTimeFormatter.format(date);
    return formatted
      .replace(',', ' at')
      .replace(/\bAM\b/g, 'am')
      .replace(/\bPM\b/g, 'pm');
  }

  private normalizeProjectDate(value?: string | null): string {
    if (!value) {
      return '';
    }
    const match = String(value).match(/\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : '';
  }

  private parseProjectDate(value: string): Date | null {
    const [year, month, day] = value.split('-').map(entry => Number(entry));
    if (!year || !month || !day) {
      return null;
    }
    return new Date(year, month - 1, day);
  }

  private getFieldIssue(field: ProjectValidationField): ProjectValidationIssue | null {
    return this.validationSummary.issues.find(issue => issue.field === field) ?? null;
  }

  private queuePendingPanelAction(action: PendingProjectDetailsAction): boolean {
    if (!this.open || !this.canEdit || !this.row?.id || !this.isDirty()) {
      return false;
    }

    this.pendingPanelAction = action;
    this.pendingPanelActionWaitingForSave = false;
    this.pendingPanelActionSaveCycleFinished = false;
    this.tryResolvePendingPanelAction();
    return true;
  }

  private tryResolvePendingPanelAction(): void {
    const currentSnapshot = this.buildAutoSaveSnapshot(this.buffer);
    const persistedSnapshot = this.buildAutoSaveSnapshot(this.row);
    const decision = resolvePendingProjectDetailsAction({
      action: this.pendingPanelAction,
      currentSnapshot,
      persistedSnapshot,
      saveBusy: this.saveBusy,
      detailsLoading: this.detailsLoading,
      pendingLookups: this.pendingLookups,
      waitingForSave: this.pendingPanelActionWaitingForSave,
      saveCycleFinished: this.pendingPanelActionSaveCycleFinished
    });

    switch (decision.type) {
      case 'request-save':
        this.pendingPanelActionWaitingForSave = true;
        this.pendingPanelActionSaveCycleFinished = false;
        this.clearAutoSaveTimer();
        this.scheduledAutoSaveSnapshot = null;
        this.requestAutoSave(decision.snapshot);
        return;
      case 'emit-close':
        this.clearPendingPanelAction();
        this.close.emit();
        return;
      case 'emit-switch':
        this.clearPendingPanelAction();
        this.switchProject.emit(decision.row);
        return;
      case 'clear':
        this.clearPendingPanelAction();
        return;
      default:
        return;
    }
  }

  private maybeScheduleAutoSave(): void {
    if (!this.open || !this.canEdit || this.saveBusy || this.detailsLoading || !this.row?.id) {
      return;
    }

    const currentSnapshot = this.buildAutoSaveSnapshot(this.buffer);
    const persistedSnapshot = this.buildAutoSaveSnapshot(this.row);
    if (!currentSnapshot || currentSnapshot === persistedSnapshot) {
      this.queuedAutoSaveSnapshot = null;
      this.clearAutoSaveTimer();
      this.scheduledAutoSaveSnapshot = null;
      return;
    }

    if (
      currentSnapshot === this.queuedAutoSaveSnapshot ||
      currentSnapshot === this.scheduledAutoSaveSnapshot
    ) {
      return;
    }

    this.scheduleAutoSave(currentSnapshot);
  }

  private scheduleAutoSave(snapshot: string): void {
    this.clearAutoSaveTimer();
    this.scheduledAutoSaveSnapshot = snapshot;
    this.autoSaveTimer = setTimeout(() => {
      this.autoSaveTimer = null;
      this.scheduledAutoSaveSnapshot = null;
      this.requestAutoSave(snapshot);
    }, this.AUTO_SAVE_DEBOUNCE_MS);
  }

  private requestAutoSave(expectedSnapshot: string): void {
    if (
      !this.open ||
      !this.canEdit ||
      this.saveBusy ||
      this.detailsLoading ||
      !this.row?.id ||
      this.buildAutoSaveSnapshot(this.buffer) !== expectedSnapshot
    ) {
      return;
    }

    this.queuedAutoSaveSnapshot = expectedSnapshot;
    if (this.pendingLookups > 0) {
      const shouldAnnounceDeferredSave = !this.deferSave;
      this.deferSave = true;
      if (shouldAnnounceDeferredSave) {
        this.saveDeferred.emit();
      }
      return;
    }

    this.save.emit({ ...this.buffer });
  }

  private flushAutoSave(): void {
    if (!this.open || !this.canEdit || this.saveBusy || this.detailsLoading || !this.row?.id) {
      return;
    }

    const currentSnapshot = this.buildAutoSaveSnapshot(this.buffer);
    const persistedSnapshot = this.buildAutoSaveSnapshot(this.row);
    if (!currentSnapshot || currentSnapshot === persistedSnapshot) {
      return;
    }

    this.clearAutoSaveTimer();
    this.scheduledAutoSaveSnapshot = null;
    this.requestAutoSave(currentSnapshot);
  }

  private clearAutoSaveTimer(): void {
    if (!this.autoSaveTimer) {
      return;
    }
    clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = null;
  }

  private clearPendingPanelAction(): void {
    this.pendingPanelAction = null;
    this.pendingPanelActionWaitingForSave = false;
    this.pendingPanelActionSaveCycleFinished = false;
  }

  private isDirty(): boolean {
    const currentSnapshot = this.buildAutoSaveSnapshot(this.buffer);
    if (!currentSnapshot) {
      return false;
    }

    return currentSnapshot !== this.buildAutoSaveSnapshot(this.row);
  }

  private buildAutoSaveSnapshot(row: TenderRow | null | undefined): string {
    return buildProjectDetailsSnapshot(row);
  }

  private currentSaveState(): 'idle' | 'dirty' | 'saving' | 'deferred' | 'saved' | 'failed' {
    if (this.saveErrorMessage && this.isDirty()) {
      return 'failed';
    }
    if (this.saveBusy) {
      return 'saving';
    }
    if (this.deferSave && this.pendingLookups > 0) {
      return 'deferred';
    }
    if (this.isDirty()) {
      return 'dirty';
    }
    if (this.lastSavedAtLabel) {
      return 'saved';
    }
    return 'idle';
  }

  private rememberRowSaveState(change: SimpleChanges['row']): void {
    const previousRow = change?.previousValue as TenderRow | null | undefined;
    const currentRow = change?.currentValue as TenderRow | null | undefined;
    const previousRowId = this.getRowId(previousRow);
    const currentRowId = this.getRowId(currentRow);
    const currentSnapshot = this.buildAutoSaveSnapshot(currentRow);

    if (
      this.queuedAutoSaveSnapshot &&
      previousRowId != null &&
      currentRowId === previousRowId &&
      currentSnapshot === this.queuedAutoSaveSnapshot
    ) {
      this.lastSavedAtLabel = this.saveTimeFormatter.format(new Date());
      return;
    }

    if (previousRowId !== currentRowId) {
      this.lastSavedAtLabel = '';
    }
  }

  private getRowId(row: TenderRow | null | undefined): number | null {
    const value = row?.id;
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private hasLookupInputs(): boolean {
    return Boolean(
      this.ownersList?.length &&
      this.ownerTypesList?.length &&
      this.countriesList?.length &&
      this.stagesList?.length &&
      this.typesList?.length &&
      this.statusesList?.length &&
      this.importanceList?.length
    );
  }

  private loadOptionsFromAPI(): void {
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

        this.owners = this.lookupOptions(owners);
        this.ownersSignal.set(owners);
        if (!this.ownerTypesList?.length) {
          this.ownerTypesList = [...ownerTypes];
        }
        this.ownerTypeLookups = [...ownerTypes];
        this.ownerTypes = this.lookupOptions(ownerTypes);
        this.countries = this.lookupOptions(countries);
        this.countriesSignal.set(countries);
        this.statusLookups = [...statuses];
        this.statuses = this.lookupOptions(statuses);
        this.stageLookups = [...stages];
        this.stages = this.lookupOptions(stages);
        this.typeLookups = [...types];
        this.types = this.lookupOptions(types);
        this.importanceLookups = [...importances];
        this.importances = this.lookupOptions(importances);
        if (!this.assignToSettingsList?.length) {
          this.assignToSettingsList = [...assignToSettings];
        }
        if (!this.inChargeSettingsList?.length) {
          this.inChargeSettingsList = [...inChargeSettings];
        }
        this.peopleOptions = this.uniqueOptions([
          ...this.peopleOptions,
          ...assignToSettings.map(
            item => resolveTenderProjectLookupDisplayLabel(item) ?? item.name
          ),
          ...inChargeSettings.map(
            item => resolveTenderProjectLookupDisplayLabel(item) ?? item.name
          ),
          'Unassigned'
        ]);
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
          if (!this.statuses.length) {
            this.statuses = [
              'New',
              'Under Study',
              'Pricing',
              'Submitted',
              'Won',
              'Lost',
              'On Hold'
            ];
          }
          if (!this.importances.length) {
            this.importances = ['Low', 'Normal', 'High', 'Critical'];
          }
          return;
        }

        this.owners = [];
        this.ownersSignal.set([]);
        this.ownerTypes = [];
        this.ownerTypeLookups = [];
        this.countries = [];
        this.countriesSignal.set([]);
        this.statusLookups = [];
        this.statuses = [];
        this.stageLookups = [];
        this.stages = [];
        this.typeLookups = [];
        this.types = [];
        this.importanceLookups = [];
        this.importances = [];
      }
    });
  }

  ensurePeopleOptionsLoaded(): void {
    if (this.peopleOptionsLoaded || this.peopleOptionsLoading) {
      return;
    }

    this.peopleOptionsLoading = true;
    this.directory.list().subscribe({
      next: (users: DirectoryUser[]) => {
        const cleaned = (users ?? []).filter(user => Boolean(user?.name));
        if (cleaned.length) {
          this.peopleOptions = this.buildPeopleOptions(cleaned);
          this.mentionUsers = this.buildMentionUsers(cleaned);
        } else {
          this.ensurePeopleFallback();
        }
        this.peopleOptionsLoaded = true;
        this.peopleOptionsLoading = false;
      },
      error: () => {
        this.ensurePeopleFallback();
        this.peopleOptionsLoaded = true;
        this.peopleOptionsLoading = false;
      }
    });
  }

  private buildPeopleOptions(users: DirectoryUser[]): string[] {
    const names = users
      .map(user => (user?.name ?? '').trim())
      .filter(name => name && !this.isPlaceholderUser(name));
    return this.uniqueOptions([
      ...names,
      ...this.assignToSettingsList.map(
        item => resolveTenderProjectLookupDisplayLabel(item) ?? item.name
      ),
      ...this.inChargeSettingsList.map(
        item => resolveTenderProjectLookupDisplayLabel(item) ?? item.name
      ),
      'Unassigned'
    ]);
  }

  private buildMentionUsers(users: DirectoryUser[]): MentionUser[] {
    const dedupe = new Set<string>();
    const output: MentionUser[] = [];
    for (const user of users) {
      const name = (user?.name ?? '').trim();
      if (!name || this.isPlaceholderUser(name)) {
        continue;
      }
      const key = ((user.email || user.id || name) ?? '').toLowerCase();
      if (!key || dedupe.has(key)) {
        continue;
      }
      dedupe.add(key);
      output.push({
        id: user.id,
        name,
        email: user.email,
        handle: user.handle
      });
    }
    return output;
  }

  private ensurePeopleFallback(): void {
    if (!this.peopleOptions.length) {
      this.peopleOptions = this.uniqueOptions([
        ...this.assignToSettingsList.map(
          item => resolveTenderProjectLookupDisplayLabel(item) ?? item.name
        ),
        ...this.inChargeSettingsList.map(
          item => resolveTenderProjectLookupDisplayLabel(item) ?? item.name
        ),
        'Unassigned'
      ]);
    }
  }

  private uniqueOptions(values: string[]): string[] {
    const seen = new Set<string>();
    const output: string[] = [];
    for (const raw of values) {
      const value = (raw ?? '').trim();
      if (!value) {
        continue;
      }
      const key = value.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      output.push(value);
    }
    return output;
  }

  private isPlaceholderUser(name: string): boolean {
    const key = name.trim().toLowerCase();
    return key === 'unassigned' || key === 'unknown' || key === 'n/a';
  }

  private applyLookupInputs(): void {
    if (this.ownersList?.length) {
      this.owners = this.lookupOptions(this.ownersList);
      this.ownersSignal.set([...this.ownersList]);
    }
    if (this.ownerTypesList?.length) {
      this.ownerTypeLookups = [...this.ownerTypesList];
      this.ownerTypes = this.lookupOptions(this.ownerTypeLookups);
    }
    if (this.countriesList?.length) {
      this.countries = this.lookupOptions(this.countriesList);
      this.countriesSignal.set([...this.countriesList]);
    }
    if (this.stagesList?.length) {
      this.stageLookups = [...this.stagesList];
      this.stages = this.lookupOptions(this.stageLookups);
    }
    if (this.typesList?.length) {
      this.typeLookups = [...this.typesList];
      this.types = this.lookupOptions(this.typeLookups);
    }
    if (this.statusesList?.length) {
      this.statusLookups = [...this.statusesList];
      this.statuses = this.lookupOptions(this.statusesList);
    }
    if (this.importanceList?.length) {
      this.importanceLookups = [...this.importanceList];
      this.importances = this.lookupOptions(this.importanceLookups);
    }
    this.peopleOptions = this.uniqueOptions([
      ...this.peopleOptions,
      ...this.assignToSettingsList.map(
        item => resolveTenderProjectLookupDisplayLabel(item) ?? item.name
      ),
      ...this.inChargeSettingsList.map(
        item => resolveTenderProjectLookupDisplayLabel(item) ?? item.name
      ),
      'Unassigned'
    ]);
  }
}
