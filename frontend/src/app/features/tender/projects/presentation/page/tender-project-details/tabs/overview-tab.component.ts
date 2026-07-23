import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  Signal,
  ViewChild,
  computed,
  inject,
  signal
} from '@angular/core';

import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
  transferArrayItem
} from '@angular/cdk/drag-drop';
import { OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TenderRow, ChecklistItem, ChecklistSubItem } from '../project-details.component';
import type { IdName } from '../../tender-projects.contracts';
import { AppIconDirective } from '@shared/icons/app-icon.directive';
import { PermissionService } from '@core/authorization/permission.service';
import { SearchSelectComponent } from '@shared/ui/search-select.component';
import { DateInputComponent } from '@shared/ui/date-input.component';
import { ToastService } from '@shared/toast/toast.service';
import { resolveTenderProjectLookupDisplayLabel } from '../../tender-projects.lookup.util';
import {
  collectProjectValidationIssues,
  normalizeProjectValidationIssues,
  type ProjectValidationField,
  type ProjectValidationIssueInput,
  type ProjectValidationIssue
} from '../project-details.validation.util';

type RenamePayload = { from: string | null; to: string };
type ChecklistTogglePayload = { item: ChecklistItem; previous: boolean };
type UndoAction = {
  message: string;
  commit: () => void;
  restore: () => void;
  item?: ChecklistItem | null;
};

@Component({
  selector: 'overview-tab',
  standalone: true,
  imports: [
    FormsModule,
    DragDropModule,
    AppIconDirective,
    SearchSelectComponent,
    DateInputComponent
  ],
  templateUrl: './overview-tab.component.html',
  styleUrls: ['./overview-tab.component.scss']
})
export class OverviewTabComponent implements AfterViewInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly permission = inject(PermissionService);
  private readonly toast = inject(ToastService);
  @Input() row!: TenderRow;
  @Input() editing = false;
  @Input() checklistBusy = false;
  @Input() checklistLoading = false;
  @Input() allowEditWhileSync = true;
  @Input() externalValidationIssues: ProjectValidationIssueInput[] = [];
  @Input() owners: Signal<IdName[]> = signal([]);
  @Input() countries: Signal<IdName[]> = signal([]);
  @Input() peopleOptions: string[] = [];
  @Input() statuses: string[] = [];
  @Input() stages: string[] = [];
  @Input() types: string[] = [];
  @Input() importances: string[] = [];
  @Input() renderMode: 'full' | 'fields' | 'checklists' = 'full';
  @Input() notificationChecklistFocusId: number | null = null;
  readonly ownerOptions = computed(() =>
    this.owners().map(owner => resolveTenderProjectLookupDisplayLabel(owner) ?? owner.name)
  );
  readonly countryOptions = computed(() =>
    this.countries().map(country => resolveTenderProjectLookupDisplayLabel(country) ?? country.name)
  );

  @Input() height: number | string = 'auto';

  @Output() requestCreateChecklist = new EventEmitter<string | null>();
  @Output() requestToggleChecklist = new EventEmitter<ChecklistTogglePayload>();
  @Output() requestUpdateChecklist = new EventEmitter<ChecklistItem>();
  @Output() requestDeleteChecklist = new EventEmitter<ChecklistItem>();
  @Output() requestCreateOwner = new EventEmitter<string>();
  @Output() requestCreateCountry = new EventEmitter<string>();
  @Output() requestCreateStage = new EventEmitter<string>();
  @Output() requestCreateType = new EventEmitter<string>();
  @Output() requestCreateStatus = new EventEmitter<string>();
  @Output() requestCreateImportance = new EventEmitter<string>();
  @Output() requestCreateAssignee = new EventEmitter<string>();
  @Output() requestCreateInCharge = new EventEmitter<string>();
  @Output() requestRenameOwner = new EventEmitter<RenamePayload>();
  @Output() requestRenameCountry = new EventEmitter<RenamePayload>();
  @Output() requestRenameStage = new EventEmitter<RenamePayload>();
  @Output() requestRenameType = new EventEmitter<RenamePayload>();
  @Output() requestRenameStatus = new EventEmitter<RenamePayload>();
  @Output() requestRenameImportance = new EventEmitter<RenamePayload>();
  @Output() requestRenameAssignee = new EventEmitter<RenamePayload>();
  @Output() requestRenameInCharge = new EventEmitter<RenamePayload>();

  @ViewChild('delayReasonArea') delayReasonArea?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('checklistAddInput') checklistAddInput?: ElementRef<HTMLInputElement>;
  private saveTimers = new Map<string, number>();
  private undoToastId: string | null = null;
  private undoAction: UndoAction | null = null;
  private subDrafts = new WeakMap<ChecklistItem, string>();
  private subAddOpen = new WeakMap<ChecklistItem, boolean>();
  private subAddFocusId: string | null = null;
  private subListIds = new WeakMap<ChecklistItem, string>();
  private subListIdSeed = 0;
  private checklistCollapsed = new WeakMap<ChecklistItem, boolean>();
  checklistAddOpen = false;
  quickAddText = '';
  readonly checklistSkeletonRows = [0, 1, 2];

  get checklistTotal(): number {
    return this.row?.checklists?.length ?? 0;
  }

  get checklistDone(): number {
    return (this.row?.checklists ?? []).filter(item => item.done).length;
  }

  get checklistProgress(): number {
    const total = this.checklistTotal;
    if (!total) return 0;
    return Math.round((this.checklistDone / total) * 100);
  }

  get checklistEditable(): boolean {
    return (
      this.canEditChecklist() &&
      !this.checklistLoading &&
      (this.allowEditWhileSync || !this.checklistBusy)
    );
  }

  get validationIssues(): ProjectValidationIssue[] {
    return collectProjectValidationIssues(
      this.row,
      normalizeProjectValidationIssues(this.externalValidationIssues)
    );
  }

  canShowProjectSection(fields: string[]): boolean {
    return fields.some(field => this.canViewProjectField(field));
  }

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

  canCreateChecklist(): boolean {
    return this.permission.canAny(['Permissions.CheckList.Create', 'Permissions.CheckList.Edit']);
  }

  canEditChecklist(): boolean {
    return this.permission.canAny(['Permissions.CheckList.Edit', 'Permissions.CheckList.Create']);
  }

  canDeleteChecklist(): boolean {
    return this.permission.can('Permissions.CheckList.Delete');
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

  canRenameCountryLookup(): boolean {
    return this.permission.can('Permissions.Country.Edit');
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

  fieldMessage(field: ProjectValidationField): string {
    return this.getFieldIssue(field)?.message ?? '';
  }

  focusValidationField(field: ProjectValidationField): boolean {
    const hostElement = this.host.nativeElement as HTMLElement;
    const container = hostElement.querySelector(
      `[data-project-field="${field}"]`
    ) as HTMLElement | null;
    if (!container) {
      return false;
    }

    const target = container.querySelector(
      '.ss-inline-input, .date-trigger, input:not([readonly]), textarea:not([readonly]), .ss-trigger'
    ) as HTMLElement | null;
    if (!target) {
      return false;
    }

    target.focus({ preventScroll: true });
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      target.select?.();
    }

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    container.scrollIntoView({
      block: 'center',
      behavior: reduceMotion ? 'auto' : 'smooth'
    });
    return true;
  }

  get quickAddHasValue(): boolean {
    return !!(this.quickAddText ?? '').trim();
  }

  isChecklistCollapsed(item: ChecklistItem): boolean {
    return this.checklistCollapsed.get(item) ?? false;
  }

  toggleChecklistCollapse(item: ChecklistItem, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    if (!item?.subItems?.length) return;
    const next = !this.isChecklistCollapsed(item);
    this.checklistCollapsed.set(item, next);
    if (next) this.closeSubAdd(item);
  }

  get subDropListIds(): string[] {
    const list = this.row?.checklists ?? [];
    return list.map((item, index) => this.subDropId(item, index));
  }

  subDropId(item: ChecklistItem, index: number): string {
    const id = item?.id;
    if (typeof id === 'number' && Number.isFinite(id)) return `sub-${id}`;
    const cached = this.subListIds.get(item);
    if (cached) return cached;
    const next = `sub-temp-${++this.subListIdSeed}-${index}`;
    this.subListIds.set(item, next);
    return next;
  }

  subAddInputId(item: ChecklistItem, index: number): string {
    return `${this.subDropId(item, index)}-add`;
  }

  getSubItems(item: ChecklistItem): ChecklistSubItem[] {
    if (!item.subItems) item.subItems = [];
    return item.subItems;
  }

  trackChecklist(index: number, item: ChecklistItem): number | string | ChecklistItem {
    return item.id ?? item;
  }

  isNotificationFocusedChecklist(item: ChecklistItem): boolean {
    return !!this.notificationChecklistFocusId && item?.id === this.notificationChecklistFocusId;
  }

  trackSubItem(index: number, item: ChecklistSubItem): string {
    return item.id ?? `${index}`;
  }

  onChecklistDrop(event: CdkDragDrop<ChecklistItem[]>) {
    if (!this.checklistEditable) return;
    this.commitUndo();
    const list = event.container.data;
    if (!list || event.previousIndex === event.currentIndex) return;
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.applyDoneGrouping();
  }

  onSubDrop(item: ChecklistItem, event: CdkDragDrop<ChecklistSubItem[]>) {
    if (!this.checklistEditable) return;
    this.commitUndoIfItem(item);
    const target = item;
    const targetItems = this.getSubItems(target);
    if (event.previousContainer === event.container) {
      if (event.previousIndex === event.currentIndex) return;
      moveItemInArray(targetItems, event.previousIndex, event.currentIndex);
      this.applySubDoneGrouping(target);
      this.requestUpdateChecklist.emit(target);
      return;
    }
    const source = this.findChecklistBySubList(event.previousContainer.data);
    if (!source) return;
    if (source !== target) {
      this.commitUndoIfItem(source);
    }
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );
    this.applySubDoneGrouping(source);
    if (source !== target) {
      this.applySubDoneGrouping(target);
    }
    this.requestUpdateChecklist.emit(source);
    if (source !== target) {
      this.requestUpdateChecklist.emit(target);
    }
  }

  subDone(item: ChecklistItem): number {
    return (item?.subItems ?? []).filter(sub => sub.done).length;
  }

  subProgress(item: ChecklistItem): number {
    const total = item?.subItems?.length ?? 0;
    if (!total) return 0;
    return Math.round((this.subDone(item) / total) * 100);
  }

  private findChecklistBySubList(list: ChecklistSubItem[]): ChecklistItem | null {
    const items = this.row?.checklists ?? [];
    for (const item of items) {
      if (item.subItems === list) return item;
    }
    return null;
  }

  getSubDraft(item: ChecklistItem): string {
    return this.subDrafts.get(item) ?? '';
  }

  setSubDraft(item: ChecklistItem, value: string): void {
    this.subDrafts.set(item, value);
  }

  subDraftHasValue(item: ChecklistItem): boolean {
    return !!this.getSubDraft(item).trim();
  }

  isSubAddOpen(item: ChecklistItem): boolean {
    return this.subAddOpen.get(item) ?? false;
  }

  openSubAdd(item: ChecklistItem, index: number): void {
    if (!this.checklistEditable) return;
    const list = this.row?.checklists ?? [];
    for (const entry of list) {
      this.subAddOpen.set(entry, false);
    }
    this.subAddOpen.set(item, true);
    this.checklistCollapsed.set(item, false);
    if (!this.subDrafts.has(item)) {
      this.subDrafts.set(item, '');
    }
    this.subAddFocusId = this.subAddInputId(item, index);
    this.focusSubAdd();
  }

  closeSubAdd(item: ChecklistItem): void {
    this.subAddOpen.set(item, false);
    this.subAddFocusId = null;
  }

  private focusChecklistAdd(): void {
    if (!this.checklistAddOpen) return;
    window.setTimeout(() => {
      this.checklistAddInput?.nativeElement?.focus();
    }, 0);
  }

  private focusSubAdd(): void {
    const id = this.subAddFocusId;
    if (!id) return;
    window.setTimeout(() => {
      const el = document.getElementById(id);
      if (el instanceof HTMLInputElement) el.focus();
    }, 0);
  }

  get heightStyle(): string {
    if (typeof this.height === 'number') return `${this.height}px`;
    const value = `${this.height ?? ''}`.trim();
    return value || 'auto';
  }

  ngAfterViewInit(): void {
    if (this.delayReasonArea?.nativeElement) {
      this.resizeTextarea(this.delayReasonArea.nativeElement);
    }
  }
  ngOnDestroy(): void {
    for (const handle of this.saveTimers.values()) {
      window.clearTimeout(handle);
    }
    this.saveTimers.clear();
    this.commitUndo();
  }

  toggleChecklistAdd(event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    if (!this.checklistEditable) return;
    this.checklistAddOpen = !this.checklistAddOpen;
    if (!this.checklistAddOpen) {
      this.quickAddText = '';
    } else {
      this.focusChecklistAdd();
    }
  }
  closeChecklistAdd(): void {
    this.checklistAddOpen = false;
    this.quickAddText = '';
  }
  submitQuickAdd() {
    if (!this.checklistEditable) return;
    this.commitUndo();
    const name = (this.quickAddText ?? '').trim();
    if (!name) return;
    this.requestCreateChecklist.emit(name);
    this.closeChecklistAdd();
  }
  remove(i: number) {
    if (!this.checklistEditable) return;
    const list = this.row.checklists ?? [];
    const item = list[i];
    if (!item) return;
    const next = list.filter((_, index) => index !== i);
    this.row.checklists = next;
    this.queueUndo({
      message: 'Checklist deleted.',
      item,
      restore: () => {
        const current = this.row.checklists ?? [];
        const insertAt = Math.min(i, current.length);
        const restored = [...current];
        restored.splice(insertAt, 0, item);
        this.row.checklists = restored;
      },
      commit: () => {
        this.requestDeleteChecklist.emit(item);
      }
    });
  }
  onChecklistToggle(item: ChecklistItem, done: boolean) {
    if (!this.checklistEditable) return;
    this.commitUndoIfItem(item);
    const previous = item.done;
    item.done = done;
    this.applyDoneGrouping(item);
    this.requestToggleChecklist.emit({ item, previous });
  }
  onChecklistCommit(item: ChecklistItem) {
    if (!this.checklistEditable) return;
    this.commitUndoIfItem(item);
    this.flushChecklistUpdate(item);
    this.requestUpdateChecklist.emit(item);
  }
  onChecklistTextChange(item: ChecklistItem, value: string) {
    if (!this.checklistEditable) return;
    this.commitUndoIfItem(item);
    item.text = value;
    if ((value ?? '').trim()) {
      this.scheduleChecklistUpdate(item);
    }
  }
  submitSubAdd(item: ChecklistItem) {
    if (!this.checklistEditable) return;
    this.commitUndoIfItem(item);
    const draft = (this.subDrafts.get(item) ?? '').trim();
    if (!draft) return;
    if (!item.subItems) item.subItems = [];
    item.subItems = [...item.subItems, this.newSubItem(draft)];
    this.applySubDoneGrouping(item);
    this.subDrafts.set(item, '');
    this.subAddOpen.set(item, false);
    this.subAddFocusId = null;
    this.requestUpdateChecklist.emit(item);
  }
  removeSubItem(item: ChecklistItem, index: number) {
    if (!this.checklistEditable) return;
    if (!item.subItems?.length) return;
    this.commitUndoIfItem(item);
    const list = [...item.subItems];
    const [removed] = list.splice(index, 1);
    if (!removed) return;
    item.subItems = list;
    this.applySubDoneGrouping(item);
    this.queueUndo({
      message: 'Subtask deleted.',
      item,
      restore: () => {
        const current = item.subItems ?? [];
        const insertAt = Math.min(index, current.length);
        const restored = [...current];
        restored.splice(insertAt, 0, removed);
        item.subItems = restored;
      },
      commit: () => {
        this.requestUpdateChecklist.emit(item);
      }
    });
  }
  onSubToggle(item: ChecklistItem, sub: ChecklistSubItem, done: boolean) {
    if (!this.checklistEditable) return;
    this.commitUndoIfItem(item);
    sub.done = done;
    this.applySubDoneGrouping(item);
    this.requestUpdateChecklist.emit(item);
  }
  onSubCommit(item: ChecklistItem, sub: ChecklistSubItem) {
    if (!this.checklistEditable) return;
    this.commitUndoIfItem(item);
    sub.text = (sub.text ?? '').trim();
    this.flushSubUpdate(item, sub);
    this.requestUpdateChecklist.emit(item);
  }
  onSubTextChange(item: ChecklistItem, sub: ChecklistSubItem, value: string) {
    if (!this.checklistEditable) return;
    this.commitUndoIfItem(item);
    sub.text = value;
    if ((value ?? '').trim()) {
      this.scheduleSubUpdate(item, sub);
    }
  }

  private undoDelete() {
    if (!this.undoAction) return;
    this.undoAction.restore();
    this.clearUndo();
  }

  private queueUndo(action: UndoAction) {
    this.commitUndo();
    this.undoAction = action;
    this.undoToastId = this.toast.action(
      'info',
      action.message,
      'Undo',
      () => this.undoDelete(),
      5000,
      () => {
        if (this.undoAction === action) {
          this.commitUndo();
        }
      }
    );
  }

  private commitUndo() {
    if (!this.undoAction) return;
    const pending = this.undoAction;
    this.clearUndo();
    pending.commit();
  }

  private commitUndoIfItem(item: ChecklistItem) {
    if (!this.undoAction?.item) return;
    if (this.undoAction.item === item) {
      this.commitUndo();
    }
  }

  private clearUndo() {
    if (this.undoToastId) {
      this.toast.remove(this.undoToastId);
      this.undoToastId = null;
    }
    this.undoAction = null;
  }

  private applyChecklistOrder(list: ChecklistItem[], skipItem?: ChecklistItem) {
    const changed: ChecklistItem[] = [];
    list.forEach((item, index) => {
      if (item.order !== index) {
        item.order = index;
        if (item.id && item !== skipItem) changed.push(item);
      }
    });
    if (!changed.length) return;
    for (const item of changed) {
      this.requestUpdateChecklist.emit(item);
    }
  }

  private applyDoneGrouping(skipItem?: ChecklistItem) {
    const list = this.row?.checklists ?? [];
    if (list.length < 2) {
      this.applyChecklistOrder(list, skipItem);
      return;
    }
    const next = this.groupChecklistsByDone(list);
    if (!this.isSameChecklistOrder(list, next)) {
      this.row.checklists = next;
    }
    this.applyChecklistOrder(this.row.checklists ?? [], skipItem);
  }

  private groupChecklistsByDone(list: ChecklistItem[]): ChecklistItem[] {
    const active: ChecklistItem[] = [];
    const done: ChecklistItem[] = [];
    for (const item of list) {
      if (item?.done) done.push(item);
      else active.push(item);
    }
    return [...active, ...done];
  }

  private isSameChecklistOrder(a: ChecklistItem[], b: ChecklistItem[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  private applySubDoneGrouping(item: ChecklistItem) {
    const list = this.getSubItems(item);
    if (list.length < 2) return;
    const next = this.groupSubItemsByDone(list);
    if (!this.isSameSubOrder(list, next)) {
      item.subItems = next;
    }
  }

  private groupSubItemsByDone(list: ChecklistSubItem[]): ChecklistSubItem[] {
    const active: ChecklistSubItem[] = [];
    const done: ChecklistSubItem[] = [];
    for (const sub of list) {
      if (sub?.done) done.push(sub);
      else active.push(sub);
    }
    return [...active, ...done];
  }

  private isSameSubOrder(a: ChecklistSubItem[], b: ChecklistSubItem[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  private newSubItem(text = 'Sub item'): ChecklistSubItem {
    const rand = Math.random().toString(36).slice(2, 6);
    return { id: `sub-${Date.now().toString(36)}-${rand}`, text, done: false };
  }

  private scheduleChecklistUpdate(item: ChecklistItem) {
    const id = item.id;
    if (!id) return;
    this.scheduleUpdate(`chk:${id}`, () => this.requestUpdateChecklist.emit(item));
  }

  private flushChecklistUpdate(item: ChecklistItem) {
    const id = item.id;
    if (!id) return;
    this.flushUpdate(`chk:${id}`);
  }

  private scheduleSubUpdate(item: ChecklistItem, sub: ChecklistSubItem) {
    const id = item.id;
    if (!id || !sub?.id) return;
    this.scheduleUpdate(`sub:${id}:${sub.id}`, () => this.requestUpdateChecklist.emit(item));
  }

  private flushSubUpdate(item: ChecklistItem, sub: ChecklistSubItem) {
    const id = item.id;
    if (!id || !sub?.id) return;
    this.flushUpdate(`sub:${id}:${sub.id}`);
  }

  private scheduleUpdate(key: string, fn: () => void) {
    const prev = this.saveTimers.get(key);
    if (prev) window.clearTimeout(prev);
    const handle = window.setTimeout(() => {
      this.saveTimers.delete(key);
      fn();
    }, 650);
    this.saveTimers.set(key, handle);
  }

  private flushUpdate(key: string) {
    const prev = this.saveTimers.get(key);
    if (prev) window.clearTimeout(prev);
    this.saveTimers.delete(key);
  }

  autoGrow(e: Event) {
    const el = e.target as HTMLTextAreaElement | null;
    if (el) this.resizeTextarea(el);
  }

  private resizeTextarea(el: HTMLTextAreaElement) {
    const next = el.scrollHeight;
    if (next > el.clientHeight) {
      el.style.height = `${next}px`;
    }
  }

  onMoneyInput(e: Event) {
    if (!this.editing) return;
    const raw = (e.target as HTMLInputElement).value.replace(/[^\d.]/g, '');
    const n = Number(raw);
    if (isFinite(n)) this.row.price = n;
  }
  money(v: number) {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v);
  }
  displayMoney(value: number | string | null | undefined, fallback: string): string {
    if (value == null || value === '') return fallback;
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return this.money(parsed);
  }
  isMoneyPlaceholder(value: number | string | null | undefined, fallback: string): boolean {
    return this.displayMoney(value, fallback) === fallback;
  }
  displayPercent(value: number | string | null | undefined, fallback: string): string {
    if (value == null || value === '') return fallback;
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    const percent = parsed * 100;
    const formatted = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(percent);
    return `${formatted}%`;
  }
  isPercentPlaceholder(value: number | string | null | undefined, fallback: string): boolean {
    return this.displayPercent(value, fallback) === fallback;
  }
  displayText(value: unknown, fallback: string): string {
    if (value == null) return fallback;
    const text = String(value).trim();
    if (!text || text === '-' || text === '-') return fallback;
    return text;
  }
  isPlaceholder(value: unknown, fallback: string): boolean {
    return this.displayText(value, fallback) === fallback;
  }

  onCreateOwner(name: string) {
    const next = name.trim();
    if (!next) return;
    this.requestCreateOwner.emit(next);
  }
  onRenameOwner(payload: RenamePayload) {
    const next = payload?.to?.trim();
    const from = payload?.from ?? this.row.owner ?? '';
    if (!next || !from) return;
    this.requestRenameOwner.emit({ from, to: next });
  }
  onCreateCountry(name: string) {
    const next = name.trim();
    if (!next) return;
    this.requestCreateCountry.emit(next);
  }
  onRenameCountry(payload: RenamePayload) {
    const next = payload?.to?.trim();
    const from = payload?.from ?? this.row.country ?? '';
    if (!next || !from) return;
    this.requestRenameCountry.emit({ from, to: next });
  }
  onCreateStage(name: string) {
    const next = name.trim();
    if (!next) return;
    this.requestCreateStage.emit(next);
  }
  onRenameStage(payload: RenamePayload) {
    const next = payload?.to?.trim();
    const from = payload?.from ?? this.row.ts ?? '';
    if (!next || !from) return;
    this.requestRenameStage.emit({ from, to: next });
  }
  onCreateType(name: string) {
    const next = name.trim();
    if (!next) return;
    this.requestCreateType.emit(next);
  }
  onCreateStatus(name: string) {
    const next = name.trim();
    if (!next) return;
    this.requestCreateStatus.emit(next);
  }
  onCreateImportance(name: string) {
    const next = name.trim();
    if (!next) return;
    this.requestCreateImportance.emit(next);
  }
  onRenameType(payload: RenamePayload) {
    const next = payload?.to?.trim();
    const from = payload?.from ?? this.row.top ?? '';
    if (!next || !from) return;
    this.requestRenameType.emit({ from, to: next });
  }
  onRenameStatus(payload: RenamePayload) {
    const next = payload?.to?.trim();
    const from = payload?.from ?? this.row.status ?? '';
    if (!next || !from) return;
    this.requestRenameStatus.emit({ from, to: next });
  }
  onRenameImportance(payload: RenamePayload) {
    const next = payload?.to?.trim();
    const from = payload?.from ?? this.row.doi ?? '';
    if (!next || !from) return;
    this.requestRenameImportance.emit({ from, to: next });
  }
  onCreateAssignee(name: string) {
    const next = name.trim();
    if (!next) return;
    this.row.assignTo = next;
    this.requestCreateAssignee.emit(next);
  }
  onRenameAssignee(payload: RenamePayload) {
    const next = payload?.to?.trim();
    const from = payload?.from ?? this.row.assignTo ?? '';
    if (!next || !from) return;
    this.row.assignTo = next;
    this.requestRenameAssignee.emit({ from, to: next });
  }
  onCreateInCharge(name: string) {
    const next = name.trim();
    if (!next) return;
    this.row.inCharge = next;
    this.requestCreateInCharge.emit(next);
  }
  setOwner(value: string) {
    this.row.owner = (value || '').trim();
    this.row.ownerId = undefined;
  }
  setCountry(value: string) {
    this.row.country = (value || '').trim();
    this.row.countryId = undefined;
  }
  setStage(value: string) {
    this.row.ts = (value || '').trim();
    this.row.tenderStageId = undefined;
  }
  setType(value: string) {
    this.row.top = (value || '').trim();
    this.row.typeOfProjectId = undefined;
  }
  setStatus(value: string) {
    this.row.status = ((value || '').trim() || 'New') as TenderRow['status'];
    this.row.statusId = undefined;
  }
  setImportance(value: string) {
    this.row.doi = (value || '').trim();
    this.row.degreeOfImportanceId = undefined;
  }
  onRenameInCharge(payload: RenamePayload) {
    const next = payload?.to?.trim();
    const from = payload?.from ?? this.row.inCharge ?? '';
    if (!next || !from) return;
    this.row.inCharge = next;
    this.requestRenameInCharge.emit({ from, to: next });
  }

  private readonly dateFormatter = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  formatDate(value?: string | null): string {
    const iso = this.normalizeDate(value);
    if (!iso) return '';
    const parsed = this.parseDate(iso);
    return parsed ? this.dateFormatter.format(parsed) : iso;
  }

  private normalizeDate(value?: string | null): string {
    if (!value) return '';
    const match = String(value).match(/\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : '';
  }

  private parseDate(value: string): Date | null {
    const [y, m, d] = value.split('-').map(v => Number(v));
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }

  private getFieldIssue(field: ProjectValidationField): ProjectValidationIssue | null {
    return this.validationIssues.find(issue => issue.field === field) ?? null;
  }
}
