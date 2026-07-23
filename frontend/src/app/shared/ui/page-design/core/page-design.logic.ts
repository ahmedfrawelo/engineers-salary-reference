import { Directive, HostListener, OnDestroy } from '@angular/core';
import type { SharedToolbarAction, SharedToolbarActionVariant } from '../models';
import type { AssigneeFilterSelection } from '@shared/ui/assignee-filter-menu.component';
import { PageDesignLogicColumnsBase } from './page-design.logic.columns.base';

type SharedToolbarPressTarget = 'columns' | 'views' | 'filters' | 'customize';
type SharedToolbarSurface = 'columns' | 'filter' | 'customize' | 'search' | 'group';
type SharedToolbarClassCacheEntry = { key: string; classes: Record<string, boolean> };

@Directive()
export abstract class PageDesignLogicBase extends PageDesignLogicColumnsBase implements OnDestroy {
  private readonly sharedToolbarPointerHandled = new Set<SharedToolbarPressTarget>();
  private readonly sharedToolbarActionClassCache = new WeakMap<
    SharedToolbarAction,
    SharedToolbarClassCacheEntry
  >();
  private sharedToolbarSearchClassCacheVariant: SharedToolbarActionVariant | null = null;
  private sharedToolbarSearchClassCache: Record<string, boolean> = {};
  private sharedToolbarSearchFrameId: number | null = null;
  private sharedToolbarSearchPendingValue: string | null = null;
  private sharedToolbarDocumentPointerListenerAttached = false;
  private sharedFilterPanelWindowListenersAttached = false;
  private readonly sharedToolbarDocumentPointerHandler = (event: PointerEvent) =>
    this.onDocumentPointerDown(event);
  private readonly sharedFilterPanelResizeHandler = () =>
    this.requestSharedFilterPanelPositionUpdate();
  private readonly sharedFilterPanelScrollHandler = () =>
    this.requestSharedFilterPanelPositionUpdate();

  protected onSharedColumnsPointerDown(event: PointerEvent): void {
    this.handleSharedToolbarPointerDown(event, 'columns', () => this.toggleSharedColumnsPanel());
  }

  protected onSharedColumnsClick(event?: Event): void {
    this.handleSharedToolbarClick(event, 'columns', () => this.toggleSharedColumnsPanel());
  }

  protected onSharedViewsPointerDown(event: PointerEvent, anchor: HTMLElement): void {
    this.handleSharedToolbarPointerDown(event, 'views', () => this.openSharedViews(anchor));
  }

  protected onSharedViewsClick(event: Event | undefined, anchor: HTMLElement): void {
    this.handleSharedToolbarClick(event, 'views', () => this.openSharedViews(anchor));
  }

  private openSharedViews(anchor: HTMLElement): void {
    if (!anchor) {
      return;
    }
    this.closeSharedToolbarSurfaces();
    this.sharedToolbarSurfaceOpened.emit('views');
    if (this.sharedViewsRequested.observers.length) {
      this.sharedViewsRequested.emit(anchor);
      return;
    }
    this.dataGrid?.toggleSnapshotManager();
  }

  protected emitSharedSelectionEdit(): void {
    this.closeSharedToolbarSurfaces();
    this.sharedToolbarSelectionEditRequested.emit();
  }

  protected emitSharedSelectionDelete(): void {
    this.closeSharedToolbarSurfaces();
    this.sharedToolbarSelectionDeleteRequested.emit();
  }

  protected toggleSharedToolbarSearch(): void {
    if (this.sharedToolbarSearchOpen) {
      this.sharedToolbarSearchOpen = false;
      this.syncSharedToolbarDocumentListener();
      this.cdr.markForCheck();
      return;
    }

    this.closeSharedToolbarSurfaces('search');
    this.sharedToolbarSurfaceOpened.emit('search');
    this.sharedToolbarSearchOpen = true;
    this.syncSharedToolbarDocumentListener();
    this.cdr.markForCheck();
    queueMicrotask(() => {
      const input = this.sharedToolbarSearchInputRef?.nativeElement;
      if (!input) return;
      input.focus();
      input.select();
    });
  }

  protected onSharedToolbarSearchTogglePointerDown(event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.toggleSharedToolbarSearch();
  }

  protected onSharedToolbarSearchToggleKeydown(event: Event): void {
    if (!(event instanceof KeyboardEvent)) {
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.toggleSharedToolbarSearch();
  }

  protected onSharedToolbarSearchInput(value: string): void {
    const next = value ?? '';
    this.sharedToolbarSearchTerm = next;
    this.syncSharedToolbarDocumentListener();
    this.scheduleSharedToolbarSearchDispatch(next);
    this.cdr.markForCheck();
  }

  protected clearSharedToolbarSearch(event?: Event): void {
    event?.stopPropagation();
    this.sharedToolbarSearchTerm = '';
    this.syncSharedToolbarDocumentListener();
    this.cancelSharedToolbarSearchDispatch();
    this.dispatchSharedToolbarSearch('');
    this.cdr.markForCheck();
    queueMicrotask(() => this.sharedToolbarSearchInputRef?.nativeElement?.focus());
  }

  protected onSharedToolbarSearchKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    this.sharedToolbarSearchOpen = false;
    this.syncSharedToolbarDocumentListener();
    this.cdr.markForCheck();
  }

  protected onDocumentPointerDown(event: PointerEvent): void {
    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }
    const element = target instanceof Element ? target : target.parentElement;

    if (this.sharedFilterPanelOpen) {
      const filterHost = this.sharedFiltersMenuRef?.nativeElement;
      const clickedFilterOverlay = !!element?.closest('.proj-filter-select-overlay');
      if (filterHost && !filterHost.contains(target) && !clickedFilterOverlay) {
        this.closeSharedFilterPanel();
      }
    }

    if (!this.sharedToolbarSearchOpen || this.sharedToolbarSearchTerm.trim().length > 0) {
      return;
    }

    const clickedInsideSearch = !!element?.closest('.proj-toolbar-search');

    if (clickedInsideSearch) {
      return;
    }

    this.sharedToolbarSearchOpen = false;
    this.syncSharedToolbarDocumentListener();
    this.cdr.markForCheck();
  }

  protected emitSharedToolbarAction(action: SharedToolbarAction): void {
    if (!action || action.disabled) return;
    if (!action.keepSurfacesOpen) {
      this.closeSharedToolbarSurfaces();
    }
    this.sharedToolbarActionTriggered.emit(action.id);
  }

  protected onSharedToolbarCustomizePointerDown(event: PointerEvent): void {
    this.handleSharedToolbarPointerDown(event, 'customize', () => this.runSharedToolbarCustomize());
  }

  protected onSharedToolbarCustomizeClick(event?: Event): void {
    this.handleSharedToolbarClick(event, 'customize', () => this.runSharedToolbarCustomize());
  }

  private runSharedToolbarCustomize(): void {
    if (this.sharedToolbarCustomizeRequested.observers.length) {
      this.closeSharedToolbarSurfaces();
      this.sharedToolbarCustomizeRequested.emit();
      return;
    }
    this.toggleSharedCustomizePanel();
  }

  protected onSharedToolbarAssigneeSelectionChange(selection: AssigneeFilterSelection): void {
    this.sharedToolbarAssigneeSelectionChanged.emit(selection);
  }

  protected onSharedToolbarMineQuickToggle(): void {
    this.closeSharedToolbarSurfaces();
    this.sharedToolbarMineQuickToggleRequested.emit();
  }

  protected onSharedToolbarMineQuickClear(event: Event): void {
    this.closeSharedToolbarSurfaces();
    this.sharedToolbarMineQuickClearRequested.emit(event);
  }

  protected onSharedToolbarMineQuickOptionToggle(key: string): void {
    this.sharedToolbarMineQuickOptionToggled.emit(key);
  }

  protected onSharedToolbarExternalPanelOpened(): void {
    this.sharedColumnsPanelTopInset = this.readSharedColumnsPanelTopInset();
    this.closeSharedToolbarSurfaces();
    this.cdr.markForCheck();
  }

  protected onSharedGroupMenuOpened(): void {
    this.closeSharedToolbarSurfaces('group');
  }

  protected sharedToolbarActionClass(action: SharedToolbarAction): Record<string, boolean> {
    if (!action) {
      return {};
    }
    const tone = action?.tone ?? 'default';
    const variant = action?.variant ?? 'default';
    const className = action?.className ?? '';
    const cacheKey = [tone, variant, className, action?.active ? 1 : 0].join('\u001f');
    const cached = this.sharedToolbarActionClassCache.get(action);
    if (cached?.key === cacheKey) {
      return cached.classes;
    }

    const classes: Record<string, boolean> = {
      'proj-toolbar-btn--primary': tone === 'primary',
      'proj-toolbar-btn--accent': tone === 'accent',
      'proj-toolbar-btn--danger': tone === 'danger',
      'proj-toolbar-btn--page-pill': variant === 'pagePill',
      'proj-toolbar-btn--soft-rect': variant === 'softRect',
      'is-active': !!action?.active
    };
    if (className) {
      classes[className] = true;
    }
    this.sharedToolbarActionClassCache.set(action, { key: cacheKey, classes });
    return classes;
  }

  protected sharedToolbarSearchClass(): Record<string, boolean> {
    const variant = this.sharedToolbarSearchVariant ?? 'default';
    if (this.sharedToolbarSearchClassCacheVariant === variant) {
      return this.sharedToolbarSearchClassCache;
    }

    this.sharedToolbarSearchClassCacheVariant = variant;
    this.sharedToolbarSearchClassCache = {
      'proj-toolbar-search--page-pill': variant === 'pagePill',
      'proj-toolbar-search--soft-rect': variant === 'softRect'
    };
    return this.sharedToolbarSearchClassCache;
  }

  protected toggleSharedFilterPanel(): void {
    if (this.sharedFilterPanelOpen) {
      this.closeSharedFilterPanel();
      return;
    }
    this.openSharedFilterPanel();
  }

  protected onSharedFilterTriggerPointerDown(event?: PointerEvent): void {
    this.handleSharedToolbarPointerDown(event, 'filters', () => this.toggleSharedFilterPanel());
  }

  protected onSharedFilterTriggerClick(event?: Event): void {
    this.handleSharedToolbarClick(event, 'filters', () => this.toggleSharedFilterPanel());
  }

  @HostListener('engineers-salary-referenceDataGridFilterPanelRequested', ['$event'])
  protected onDataGridFilterPanelRequested(event: Event): void {
    if (!this.sharedTenderGridToolbar) {
      return;
    }
    const detail = (event as CustomEvent<{ field?: string }>).detail ?? {};
    const field = String(detail.field ?? '').trim();
    if (!field) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.openSharedFilterPanel();
    this.openSharedFilterForColumn(field);
  }

  protected closeSharedFilterPanel(): void {
    if (!this.sharedFilterPanelOpen) {
      this.resetSharedFilterPanelPosition();
      return;
    }
    this.sharedFilterPanelOpen = false;
    this.resetSharedFilterPanelPosition();
    this.syncSharedFilterPanelWindowListeners();
    this.syncSharedToolbarDocumentListener();
    this.cdr.markForCheck();
  }

  protected toggleSharedColumnsPanel(): void {
    if (this.sharedColumnsPanelOpen) this.closeSharedColumnsPanel();
    else this.openSharedColumnsPanel();
  }

  protected closeSharedColumnsPanel(): void {
    if (
      !this.sharedColumnsPanelOpen &&
      !this.sharedColumnsFromCustomize &&
      !this.sharedColumnsSearchTerm
    ) {
      return;
    }
    this.sharedColumnsPanelOpen = false;
    this.sharedColumnsFromCustomize = false;
    this.sharedColumnsSearchTerm = '';
    this.cdr.markForCheck();
  }

  protected toggleSharedCustomizePanel(): void {
    if (this.sharedCustomizePanelOpen) this.closeSharedCustomizePanel();
    else this.openSharedCustomizePanel();
  }

  protected closeSharedCustomizePanel(): void {
    if (!this.sharedCustomizePanelOpen) {
      return;
    }
    this.sharedCustomizePanelOpen = false;
    this.sharedCustomizePanelClosed.emit();
    this.cdr.markForCheck();
  }

  protected openSharedColumnsFromCustomize(): void {
    this.closeSharedCustomizePanel();
    this.openSharedColumnsPanel(true);
  }

  protected onSharedColumnsBack(): void {
    this.sharedColumnsPanelOpen = false;
    this.sharedColumnsSearchTerm = '';
    this.sharedColumnsFromCustomize = false;
    this.openSharedCustomizePanel();
  }

  protected openSharedFiltersFromCustomize(): void {
    this.closeSharedCustomizePanel();
    queueMicrotask(() => {
      this.openSharedFilterPanel();
    });
  }

  protected openSharedGroupFromCustomize(): void {
    this.closeSharedToolbarSurfaces('group');
    queueMicrotask(() => {
      const menu = this.sharedGroupMenuRef;
      if (menu) {
        menu.openMenu();
      }
      this.cdr.markForCheck();
    });
  }

  protected sharedCustomizeFieldsSummary(): string {
    return `${this.sharedShownColumnsPanelOptions().length} shown`;
  }

  protected sharedCustomizeFilterSummary(): string {
    const count = this.sharedActiveFilterCount();
    return count ? `${count} active` : 'None';
  }

  protected sharedCustomizeGroupSummary(): string {
    return this.sharedGroupLabel();
  }

  protected toggleSharedColumnsSection(section: 'shown' | 'hidden'): void {
    if (section === 'shown') {
      this.sharedColumnsShownExpanded = !this.sharedColumnsShownExpanded;
    } else {
      this.sharedColumnsHiddenExpanded = !this.sharedColumnsHiddenExpanded;
    }
    this.cdr.markForCheck();
  }

  protected onSharedColumnsSearchInput(value: string): void {
    this.sharedColumnsSearchTerm = value ?? '';
  }

  protected clearSharedColumnsSearch(event?: Event): void {
    event?.stopPropagation();
    this.sharedColumnsSearchTerm = '';
  }

  private openSharedColumnsPanel(fromCustomize = false): void {
    this.closeSharedToolbarSurfaces('columns');
    this.sharedToolbarSurfaceOpened.emit('columns');
    this.sharedColumnsPanelOpen = true;
    this.sharedColumnsFromCustomize = fromCustomize;
    this.sharedCustomizePanelOpen = false;
    this.sharedColumnsPanelTopInset = this.readSharedColumnsPanelTopInset();
    this.sharedColumnsShownExpanded = true;
    this.sharedColumnsHiddenExpanded = true;
    this.cdr.markForCheck();
  }

  private openSharedCustomizePanel(): void {
    this.closeSharedToolbarSurfaces('customize');
    this.sharedToolbarSurfaceOpened.emit('customize');
    this.sharedCustomizePanelOpen = true;
    this.sharedColumnsPanelOpen = false;
    this.sharedColumnsSearchTerm = '';
    this.sharedColumnsPanelTopInset = this.readSharedColumnsPanelTopInset();
    this.cdr.markForCheck();
  }

  private openSharedFilterPanel(): void {
    this.closeSharedToolbarSurfaces('filter');
    this.sharedToolbarSurfaceOpened.emit('filter');
    this.syncSharedToolbarFiltersFromGrid();
    this.sharedFilterPanelOpen = true;
    this.syncSharedFilterPanelWindowListeners();
    this.syncSharedToolbarDocumentListener();
    this.cdr.markForCheck();
    this.scheduleSharedFilterPanelPositionUpdate();
  }

  private handleSharedToolbarPointerDown(
    event: Event | undefined,
    target: SharedToolbarPressTarget,
    action: () => void
  ): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.sharedToolbarPointerHandled.add(target);
    action();
  }

  private handleSharedToolbarClick(
    event: Event | undefined,
    target: SharedToolbarPressTarget,
    action: () => void
  ): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.sharedToolbarPointerHandled.has(target)) {
      this.sharedToolbarPointerHandled.delete(target);
      return;
    }
    action();
  }

  private closeSharedGroupMenu(): void {
    this.sharedGroupMenuRef?.closeMenu();
  }

  private closeSharedToolbarSurfaces(except?: SharedToolbarSurface): void {
    if (except !== 'group') {
      this.closeSharedGroupMenu();
    }
    if (except !== 'filter') {
      this.closeSharedFilterPanel();
    }
    if (except !== 'columns') {
      this.closeSharedColumnsPanel();
    }
    if (except !== 'customize') {
      this.closeSharedCustomizePanel();
    }
    if (except !== 'search' && this.sharedToolbarSearchOpen) {
      this.sharedToolbarSearchOpen = false;
      this.syncSharedToolbarDocumentListener();
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy(): void {
    this.cancelSharedToolbarSearchDispatch();
    this.cancelSharedToolbarFiltersApply();
    this.detachSharedToolbarDocumentListener();
    this.detachSharedFilterPanelWindowListeners();
    this.resetSharedFilterPanelPosition();
  }

  private scheduleSharedToolbarSearchDispatch(value: string): void {
    this.sharedToolbarSearchPendingValue = value;
    if (this.sharedToolbarSearchFrameId != null) {
      return;
    }

    if (typeof requestAnimationFrame === 'undefined') {
      this.flushSharedToolbarSearchDispatch();
      return;
    }

    this.sharedToolbarSearchFrameId = requestAnimationFrame(() => {
      this.sharedToolbarSearchFrameId = null;
      this.flushSharedToolbarSearchDispatch();
    });
  }

  private flushSharedToolbarSearchDispatch(): void {
    const value = this.sharedToolbarSearchPendingValue;
    if (value == null) {
      return;
    }
    this.sharedToolbarSearchPendingValue = null;
    this.dispatchSharedToolbarSearch(value);
  }

  private dispatchSharedToolbarSearch(value: string): void {
    if (this.sharedToolbarSearchChanged.observers.length) {
      this.sharedToolbarSearchChanged.emit(value);
      return;
    }
    this.dataGrid?.onGlobalSearch(value);
  }

  private cancelSharedToolbarSearchDispatch(): void {
    if (this.sharedToolbarSearchFrameId != null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.sharedToolbarSearchFrameId);
    }
    this.sharedToolbarSearchFrameId = null;
    this.sharedToolbarSearchPendingValue = null;
  }

  private syncSharedToolbarDocumentListener(): void {
    const shouldListen =
      this.sharedFilterPanelOpen ||
      (this.sharedToolbarSearchOpen && this.sharedToolbarSearchTerm.trim().length === 0);
    if (shouldListen) {
      this.attachSharedToolbarDocumentListener();
    } else {
      this.detachSharedToolbarDocumentListener();
    }
  }

  private attachSharedToolbarDocumentListener(): void {
    if (this.sharedToolbarDocumentPointerListenerAttached || typeof document === 'undefined') {
      return;
    }
    this.sharedToolbarDocumentPointerListenerAttached = true;
    document.addEventListener('pointerdown', this.sharedToolbarDocumentPointerHandler);
  }

  private detachSharedToolbarDocumentListener(): void {
    if (!this.sharedToolbarDocumentPointerListenerAttached || typeof document === 'undefined') {
      return;
    }
    this.sharedToolbarDocumentPointerListenerAttached = false;
    document.removeEventListener('pointerdown', this.sharedToolbarDocumentPointerHandler);
  }

  private syncSharedFilterPanelWindowListeners(): void {
    if (this.sharedFilterPanelOpen) {
      this.attachSharedFilterPanelWindowListeners();
    } else {
      this.detachSharedFilterPanelWindowListeners();
    }
  }

  private attachSharedFilterPanelWindowListeners(): void {
    if (this.sharedFilterPanelWindowListenersAttached || typeof window === 'undefined') {
      return;
    }
    this.sharedFilterPanelWindowListenersAttached = true;
    window.addEventListener('resize', this.sharedFilterPanelResizeHandler, { passive: true });
    window.addEventListener('scroll', this.sharedFilterPanelScrollHandler, { passive: true });
  }

  private detachSharedFilterPanelWindowListeners(): void {
    if (!this.sharedFilterPanelWindowListenersAttached || typeof window === 'undefined') {
      return;
    }
    this.sharedFilterPanelWindowListenersAttached = false;
    window.removeEventListener('resize', this.sharedFilterPanelResizeHandler);
    window.removeEventListener('scroll', this.sharedFilterPanelScrollHandler);
  }
}
