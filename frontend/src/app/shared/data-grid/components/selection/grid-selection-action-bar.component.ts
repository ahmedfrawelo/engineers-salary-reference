import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  Input,
  inject,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges
} from '@angular/core';

import type {
  GridSelectionBulkEditField,
  GridSelectionBulkEditOption,
  GridSelectionBulkEditRequest
} from '../../models';

@Component({
  selector: 'engineers-salary-reference-grid-selection-action-bar',
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone: false,
  templateUrl: './grid-selection-action-bar.component.html',
  styleUrls: ['./grid-selection-action-bar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GridSelectionActionBarComponent implements OnDestroy, OnChanges {
  private _selectedCount = 0;
  @Input()
  set selectedCount(value: number | null | undefined) {
    this._selectedCount = value ?? 0;
  }
  get selectedCount(): number {
    return this._selectedCount;
  }

  private _hasAggregateFooter = false;
  @Input()
  set hasAggregateFooter(value: boolean | null | undefined) {
    this._hasAggregateFooter = value ?? false;
  }
  get hasAggregateFooter(): boolean {
    return this._hasAggregateFooter;
  }

  private _showSelectVisibleAction = true;
  @Input()
  set showSelectVisibleAction(value: boolean | null | undefined) {
    this._showSelectVisibleAction = value ?? true;
  }
  get showSelectVisibleAction(): boolean {
    return this._showSelectVisibleAction;
  }

  private _showExportActions = true;
  @Input()
  set showExportActions(value: boolean | null | undefined) {
    this._showExportActions = value ?? true;
  }
  get showExportActions(): boolean {
    return this._showExportActions;
  }

  private _showExportVisibleAction = false;
  @Input()
  set showExportVisibleAction(value: boolean | null | undefined) {
    this._showExportVisibleAction = value ?? false;
  }
  get showExportVisibleAction(): boolean {
    return this._showExportVisibleAction;
  }

  private _showBookmarkAction = false;
  @Input()
  set showBookmarkAction(value: boolean | null | undefined) {
    this._showBookmarkAction = value ?? false;
  }
  get showBookmarkAction(): boolean {
    return this._showBookmarkAction;
  }

  private _showQualityAction = true;
  @Input()
  set showQualityAction(value: boolean | null | undefined) {
    this._showQualityAction = value ?? true;
  }
  get showQualityAction(): boolean {
    return this._showQualityAction;
  }

  private _showAuditAction = true;
  @Input()
  set showAuditAction(value: boolean | null | undefined) {
    this._showAuditAction = value ?? true;
  }
  get showAuditAction(): boolean {
    return this._showAuditAction;
  }

  private _showHeadlineAction = true;
  @Input()
  set showHeadlineAction(value: boolean | null | undefined) {
    this._showHeadlineAction = value ?? true;
  }
  get showHeadlineAction(): boolean {
    return this._showHeadlineAction;
  }

  private _showShareAction = true;
  @Input()
  set showShareAction(value: boolean | null | undefined) {
    this._showShareAction = value ?? true;
  }
  get showShareAction(): boolean {
    return this._showShareAction;
  }

  private _showSnapshotAction = false;
  @Input()
  set showSnapshotAction(value: boolean | null | undefined) {
    this._showSnapshotAction = value ?? false;
  }
  get showSnapshotAction(): boolean {
    return this._showSnapshotAction;
  }

  private _qualityPanelOpen = false;
  @Input()
  set qualityPanelOpen(value: boolean | null | undefined) {
    this._qualityPanelOpen = value ?? false;
  }
  get qualityPanelOpen(): boolean {
    return this._qualityPanelOpen;
  }

  private _auditTrailOpen = false;
  @Input()
  set auditTrailOpen(value: boolean | null | undefined) {
    this._auditTrailOpen = value ?? false;
  }
  get auditTrailOpen(): boolean {
    return this._auditTrailOpen;
  }

  private _headlinePanelOpen = true;
  @Input()
  set headlinePanelOpen(value: boolean | null | undefined) {
    this._headlinePanelOpen = value ?? true;
  }
  get headlinePanelOpen(): boolean {
    return this._headlinePanelOpen;
  }

  private _colorScaleEnabled = false;
  @Input()
  set colorScaleEnabled(value: boolean | null | undefined) {
    this._colorScaleEnabled = value ?? false;
  }
  get colorScaleEnabled(): boolean {
    return this._colorScaleEnabled;
  }

  private _anomalyAlertsEnabled = false;
  @Input()
  set anomalyAlertsEnabled(value: boolean | null | undefined) {
    this._anomalyAlertsEnabled = value ?? false;
  }
  get anomalyAlertsEnabled(): boolean {
    return this._anomalyAlertsEnabled;
  }

  private _highContrastEnabled = false;
  @Input()
  set highContrastEnabled(value: boolean | null | undefined) {
    this._highContrastEnabled = value ?? false;
  }
  get highContrastEnabled(): boolean {
    return this._highContrastEnabled;
  }

  private _forecastEnabled = false;
  @Input()
  set forecastEnabled(value: boolean | null | undefined) {
    this._forecastEnabled = value ?? false;
  }
  get forecastEnabled(): boolean {
    return this._forecastEnabled;
  }

  private _snapshotManagerOpen = false;
  @Input()
  set snapshotManagerOpen(value: boolean | null | undefined) {
    this._snapshotManagerOpen = value ?? false;
  }
  get snapshotManagerOpen(): boolean {
    return this._snapshotManagerOpen;
  }

  private _showEditAction = false;
  @Input()
  set showEditAction(value: boolean | null | undefined) {
    this._showEditAction = value ?? false;
  }
  get showEditAction(): boolean {
    return this._showEditAction;
  }

  private _showDeleteAction = true;
  @Input()
  set showDeleteAction(value: boolean | null | undefined) {
    this._showDeleteAction = value ?? true;
  }
  get showDeleteAction(): boolean {
    return this._showDeleteAction;
  }

  private _showMoreAction = false;
  @Input()
  set showMoreAction(value: boolean | null | undefined) {
    this._showMoreAction = value ?? false;
  }
  get showMoreAction(): boolean {
    return this._showMoreAction;
  }

  private _bulkEditFields: GridSelectionBulkEditField[] = [];
  @Input()
  set bulkEditFields(value: GridSelectionBulkEditField[] | null | undefined) {
    this._bulkEditFields = value ?? [];
  }
  get bulkEditFields(): GridSelectionBulkEditField[] {
    return this._bulkEditFields;
  }

  private _undoAvailable = false;
  @Input()
  set undoAvailable(value: boolean | null | undefined) {
    this._undoAvailable = value ?? false;
  }
  get undoAvailable(): boolean {
    return this._undoAvailable;
  }

  private _undoLabel = '';
  @Input()
  set undoLabel(value: string | null | undefined) {
    this._undoLabel = value ?? '';
  }
  get undoLabel(): string {
    return this._undoLabel;
  }

  private readonly _clearRequested = new EventEmitter<void>();
  @Output()
  get clearRequested(): EventEmitter<void> {
    return this._clearRequested;
  }

  private readonly _clearUndoRequested = new EventEmitter<void>();
  @Output()
  get clearUndoRequested(): EventEmitter<void> {
    return this._clearUndoRequested;
  }

  private readonly _undoRequested = new EventEmitter<void>();
  @Output()
  get undoRequested(): EventEmitter<void> {
    return this._undoRequested;
  }

  private readonly _selectVisibleRequested = new EventEmitter<void>();
  @Output()
  get selectVisibleRequested(): EventEmitter<void> {
    return this._selectVisibleRequested;
  }

  private readonly _selectAllRequested = new EventEmitter<void>();
  @Output()
  get selectAllRequested(): EventEmitter<void> {
    return this._selectAllRequested;
  }

  private readonly _invertSelectionRequested = new EventEmitter<void>();
  @Output()
  get invertSelectionRequested(): EventEmitter<void> {
    return this._invertSelectionRequested;
  }

  private readonly _copyRequested = new EventEmitter<void>();
  @Output()
  get copyRequested(): EventEmitter<void> {
    return this._copyRequested;
  }

  private readonly _exportVisibleRequested = new EventEmitter<void>();
  @Output()
  get exportVisibleRequested(): EventEmitter<void> {
    return this._exportVisibleRequested;
  }

  private readonly _exportExcelRequested = new EventEmitter<void>();
  @Output()
  get exportExcelRequested(): EventEmitter<void> {
    return this._exportExcelRequested;
  }

  private readonly _exportCsvRequested = new EventEmitter<void>();
  @Output()
  get exportCsvRequested(): EventEmitter<void> {
    return this._exportCsvRequested;
  }

  private readonly _exportPdfRequested = new EventEmitter<void>();
  @Output()
  get exportPdfRequested(): EventEmitter<void> {
    return this._exportPdfRequested;
  }

  private readonly _copyJsonRequested = new EventEmitter<void>();
  @Output()
  get copyJsonRequested(): EventEmitter<void> {
    return this._copyJsonRequested;
  }

  private readonly _copyInsightsRequested = new EventEmitter<void>();
  @Output()
  get copyInsightsRequested(): EventEmitter<void> {
    return this._copyInsightsRequested;
  }

  private readonly _bulkEditRequested = new EventEmitter<GridSelectionBulkEditRequest>();
  @Output()
  get bulkEditRequested(): EventEmitter<GridSelectionBulkEditRequest> {
    return this._bulkEditRequested;
  }

  private readonly _bookmarkRequested = new EventEmitter<void>();
  @Output()
  get bookmarkRequested(): EventEmitter<void> {
    return this._bookmarkRequested;
  }

  private readonly _qualityRequested = new EventEmitter<void>();
  @Output()
  get qualityRequested(): EventEmitter<void> {
    return this._qualityRequested;
  }

  private readonly _auditRequested = new EventEmitter<void>();
  @Output()
  get auditRequested(): EventEmitter<void> {
    return this._auditRequested;
  }

  private readonly _headlineRequested = new EventEmitter<void>();
  @Output()
  get headlineRequested(): EventEmitter<void> {
    return this._headlineRequested;
  }

  private readonly _shareViewRequested = new EventEmitter<void>();
  @Output()
  get shareViewRequested(): EventEmitter<void> {
    return this._shareViewRequested;
  }

  private readonly _snapshotRequested = new EventEmitter<void>();
  @Output()
  get snapshotRequested(): EventEmitter<void> {
    return this._snapshotRequested;
  }

  private readonly _colorScaleRequested = new EventEmitter<void>();
  @Output()
  get colorScaleRequested(): EventEmitter<void> {
    return this._colorScaleRequested;
  }

  private readonly _anomalyAlertsRequested = new EventEmitter<void>();
  @Output()
  get anomalyAlertsRequested(): EventEmitter<void> {
    return this._anomalyAlertsRequested;
  }

  private readonly _highContrastRequested = new EventEmitter<void>();
  @Output()
  get highContrastRequested(): EventEmitter<void> {
    return this._highContrastRequested;
  }

  private readonly _forecastRequested = new EventEmitter<void>();
  @Output()
  get forecastRequested(): EventEmitter<void> {
    return this._forecastRequested;
  }

  private readonly _editRequested = new EventEmitter<void>();
  @Output()
  get editRequested(): EventEmitter<void> {
    return this._editRequested;
  }

  private readonly _deleteRequested = new EventEmitter<void>();
  @Output()
  get deleteRequested(): EventEmitter<void> {
    return this._deleteRequested;
  }

  private readonly _moreRequested = new EventEmitter<void>();
  @Output()
  get moreRequested(): EventEmitter<void> {
    return this._moreRequested;
  }

  moreMenuOpen = false;
  copyMenuOpen = false;
  exportMenuOpen = false;
  bulkEditExpanded = false;
  bulkEditField = '';
  bulkEditDraft = '';
  bulkEditSelectKey = '';
  bulkEditError = '';
  statusMessage = '';
  private statusTimeout: ReturnType<typeof setTimeout> | null = null;
  private bulkEditFieldLookup = new Map<string, GridSelectionBulkEditField>();
  private bulkEditOptionLookup = new Map<string, Map<string, GridSelectionBulkEditOption>>();
  private menuDomListenersAttached = false;
  private readonly documentPointerDownHandler = (event: PointerEvent) =>
    this.handleDocumentPointerDown(event);
  private readonly documentKeydownHandler = (event: KeyboardEvent) =>
    this.handleDocumentKeydown(event);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly cdr = inject(ChangeDetectorRef);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['bulkEditFields']) {
      this.rebuildBulkEditLookups();
      this.syncBulkEditField();
    }

    if (!this.undoAvailable && this.selectedCount === 0) {
      this.closeMoreMenu();
    }
  }

  ngOnDestroy(): void {
    if (this.statusTimeout) {
      clearTimeout(this.statusTimeout);
    }
    this.detachMenuDomListeners();
  }

  @HostBinding('class.has-aggregate-footer')
  get hasAggregateFooterClass(): boolean {
    return this.hasAggregateFooter;
  }

  @HostBinding('class.is-visible')
  get isVisibleClass(): boolean {
    return this.selectedCount > 0 || this.undoAvailable;
  }

  get hasBulkEditFields(): boolean {
    return this.bulkEditFields.length > 0;
  }

  get hasSelection(): boolean {
    return this.selectedCount > 0;
  }

  get editActionLabel(): string {
    return this.selectedCount > 1 ? 'Edit Selected' : 'Edit';
  }

  get deleteActionLabel(): string {
    return this.selectedCount > 1 ? 'Delete Selected' : 'Delete';
  }

  get bulkEditActionLabel(): string {
    return this.selectedCount > 1 ? 'Bulk Edit' : 'Quick Edit';
  }

  get undoSummaryLabel(): string {
    return this.undoLabel.trim() || 'Selection updated';
  }

  get hasExportPanelActions(): boolean {
    return this.showExportActions || this.showExportVisibleAction;
  }

  get selectedBulkEditField(): GridSelectionBulkEditField | null {
    return this.bulkEditFieldLookup.get(this.bulkEditField) ?? null;
  }

  get bulkEditInputType(): 'text' | 'number' | 'date' {
    const kind = this.selectedBulkEditField?.kind;
    if (kind === 'number' || kind === 'date') {
      return kind;
    }
    return 'text';
  }

  toggleMoreMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.moreMenuOpen = !this.moreMenuOpen;
    this.copyMenuOpen = false;
    this.exportMenuOpen = false;
    if (this.moreMenuOpen) {
      this.attachMenuDomListeners();
      this.moreRequested.emit();
      this.syncBulkEditField();
      return;
    }
    this.detachMenuDomListeners();
    this.bulkEditExpanded = false;
  }

  toggleCopyMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.copyMenuOpen = !this.copyMenuOpen;
    this.exportMenuOpen = false;
    this.moreMenuOpen = false;
    this.bulkEditExpanded = false;
    if (this.copyMenuOpen) {
      this.attachMenuDomListeners();
      return;
    }
    this.detachMenuDomListenersIfIdle();
  }

  toggleExportMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.exportMenuOpen = !this.exportMenuOpen;
    this.copyMenuOpen = false;
    this.moreMenuOpen = false;
    this.bulkEditExpanded = false;
    if (this.exportMenuOpen) {
      this.attachMenuDomListeners();
      return;
    }
    this.detachMenuDomListenersIfIdle();
  }

  closeMoreMenu(): void {
    const wasOpen =
      this.moreMenuOpen || this.copyMenuOpen || this.exportMenuOpen || this.bulkEditExpanded;
    this.moreMenuOpen = false;
    this.copyMenuOpen = false;
    this.exportMenuOpen = false;
    this.bulkEditExpanded = false;
    this.bulkEditError = '';
    this.detachMenuDomListeners();
    if (wasOpen) {
      this.cdr.markForCheck();
    }
  }

  toggleBulkEdit(event: MouseEvent | KeyboardEvent | Event): void {
    event.stopPropagation();
    if (!this.hasBulkEditFields) {
      return;
    }
    if (!this.moreMenuOpen) {
      this.moreMenuOpen = true;
      this.attachMenuDomListeners();
      this.moreRequested.emit();
    }
    this.bulkEditExpanded = !this.bulkEditExpanded;
    this.bulkEditError = '';
    this.syncBulkEditField();
  }

  closeBulkEdit(event?: MouseEvent | KeyboardEvent | Event): void {
    event?.stopPropagation();
    this.bulkEditExpanded = false;
    this.bulkEditError = '';
  }

  openBulkEditEditor(): boolean {
    if (!this.hasSelection || !this.hasBulkEditFields) {
      return false;
    }

    this.moreMenuOpen = true;
    this.copyMenuOpen = false;
    this.exportMenuOpen = false;
    this.bulkEditExpanded = true;
    this.bulkEditError = '';
    this.syncBulkEditField();
    this.attachMenuDomListeners();
    this.moreRequested.emit();
    this.cdr.markForCheck();
    return true;
  }

  triggerAction(emitter: EventEmitter<void>, statusMessage?: string): void {
    emitter.emit();
    if (statusMessage) {
      this.showStatus(statusMessage);
    }
    this.closeMoreMenu();
  }

  triggerMenuAction(
    emitter: EventEmitter<void>,
    event: MouseEvent | KeyboardEvent,
    statusMessage?: string
  ): void {
    event.stopPropagation();
    emitter.emit();
    if (statusMessage) {
      this.showStatus(statusMessage);
    }
    this.closeMoreMenu();
  }

  onBulkEditFieldChange(field: string): void {
    this.bulkEditField = field;
    this.bulkEditError = '';
    const selectedField = this.selectedBulkEditField;
    const nextSelectKey = selectedField?.options?.[0]?.key ?? '';
    this.bulkEditSelectKey = nextSelectKey;
    this.bulkEditDraft = '';
  }

  onBulkEditDraftChange(value: string): void {
    this.bulkEditDraft = value;
    this.bulkEditError = '';
  }

  onBulkEditSelectChange(key: string): void {
    this.bulkEditSelectKey = key;
    this.bulkEditError = '';
  }

  submitBulkEdit(event: MouseEvent | KeyboardEvent | Event): void {
    event.stopPropagation();
    const request = this.buildBulkEditRequest();
    if (!request) {
      return;
    }

    this.bulkEditRequested.emit(request);
    this.showStatus(`${this.bulkEditActionLabel} applied`);
    this.closeMoreMenu();
  }

  private buildBulkEditRequest(): GridSelectionBulkEditRequest | null {
    const field = this.selectedBulkEditField;
    if (!field) {
      this.bulkEditError = 'Choose a column first.';
      return null;
    }

    if (field.kind === 'select') {
      const option = this.bulkEditOptionLookup.get(field.field)?.get(this.bulkEditSelectKey);
      if (!option) {
        this.bulkEditError = 'Choose a value first.';
        return null;
      }
      return {
        field: field.field,
        value: option.value
      };
    }

    if (field.kind === 'number') {
      const raw = this.bulkEditDraft.trim();
      if (!raw) {
        return {
          field: field.field,
          value: null
        };
      }
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) {
        this.bulkEditError = 'Enter a valid number.';
        return null;
      }
      return {
        field: field.field,
        value: parsed
      };
    }

    if (field.kind === 'date') {
      return {
        field: field.field,
        value: this.bulkEditDraft.trim() || null
      };
    }

    return {
      field: field.field,
      value: this.bulkEditDraft
    };
  }

  private syncBulkEditField(): void {
    if (!this.bulkEditFields.length) {
      this.bulkEditField = '';
      this.bulkEditSelectKey = '';
      this.bulkEditDraft = '';
      this.bulkEditExpanded = false;
      return;
    }

    const stillExists = this.bulkEditFieldLookup.has(this.bulkEditField);
    if (!stillExists) {
      this.bulkEditField = this.bulkEditFields[0]?.field ?? '';
      this.bulkEditDraft = '';
    }

    const selectedField = this.selectedBulkEditField;
    if (selectedField?.kind === 'select') {
      const hasCurrentOption =
        this.bulkEditOptionLookup.get(selectedField.field)?.has(this.bulkEditSelectKey) ?? false;
      if (!hasCurrentOption) {
        this.bulkEditSelectKey = selectedField.options?.[0]?.key ?? '';
      }
      return;
    }

    this.bulkEditSelectKey = '';
  }

  private rebuildBulkEditLookups(): void {
    const fieldLookup = new Map<string, GridSelectionBulkEditField>();
    const optionLookup = new Map<string, Map<string, GridSelectionBulkEditOption>>();

    for (const field of this.bulkEditFields) {
      fieldLookup.set(field.field, field);
      if (field.kind !== 'select' || !field.options?.length) {
        continue;
      }
      optionLookup.set(
        field.field,
        new Map(
          field.options.map(option => [option.key, option] as [string, GridSelectionBulkEditOption])
        )
      );
    }

    this.bulkEditFieldLookup = fieldLookup;
    this.bulkEditOptionLookup = optionLookup;
  }

  private showStatus(message: string): void {
    this.statusMessage = message;
    this.cdr.markForCheck();
    if (this.statusTimeout) {
      clearTimeout(this.statusTimeout);
    }
    this.statusTimeout = setTimeout(() => {
      this.statusMessage = '';
      this.statusTimeout = null;
      this.cdr.markForCheck();
    }, 1800);
  }

  private handleDocumentPointerDown(event: PointerEvent): void {
    if (!this.hasOpenFloatingMenu()) {
      return;
    }
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.closeMoreMenu();
    }
  }

  private handleDocumentKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') {
      return;
    }
    if (this.bulkEditExpanded) {
      this.closeBulkEdit();
      this.cdr.markForCheck();
      return;
    }
    this.closeMoreMenu();
  }

  private hasOpenFloatingMenu(): boolean {
    return this.moreMenuOpen || this.copyMenuOpen || this.exportMenuOpen;
  }

  private detachMenuDomListenersIfIdle(): void {
    if (!this.hasOpenFloatingMenu()) {
      this.detachMenuDomListeners();
    }
  }

  private attachMenuDomListeners(): void {
    if (this.menuDomListenersAttached || typeof document === 'undefined') {
      return;
    }
    document.addEventListener('pointerdown', this.documentPointerDownHandler, true);
    document.addEventListener('keydown', this.documentKeydownHandler);
    this.menuDomListenersAttached = true;
  }

  private detachMenuDomListeners(): void {
    if (!this.menuDomListenersAttached || typeof document === 'undefined') {
      return;
    }
    document.removeEventListener('pointerdown', this.documentPointerDownHandler, true);
    document.removeEventListener('keydown', this.documentKeydownHandler);
    this.menuDomListenersAttached = false;
  }
}
