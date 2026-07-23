import { CommonModule } from '@angular/common';
import {
  CdkDragDrop,
  CdkDragEnter,
  CdkDragExit,
  DragDropModule,
  moveItemInArray
} from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewEncapsulation
} from '@angular/core';
import { HugeiconsIconComponent, type IconSvgObject } from '@hugeicons/angular';
import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  Search01Icon
} from '@shared/icons/app-icon.registry';
import { SideDrawerComponent } from '@shared/ui/side-drawer.component';
import { AppIconDirective } from '@shared/icons/app-icon.directive';
import { getAppScale } from '../../../utils/app-shell.util';

type SharedColumnsPanelTab = 'shown' | 'hidden';

type SharedColumnsPanelItem = {
  key: string;
  label: string;
  icon?: string;
  hugeIcon?: IconSvgObject;
  hugeIconSize?: string | number;
  hugeIconStrokeWidth?: number;
  pinned?: boolean;
};

@Component({
  selector: 'engineers-salary-reference-shared-columns-panel',
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule,
    HugeiconsIconComponent,
    SideDrawerComponent,
    AppIconDirective
  ],
  encapsulation: ViewEncapsulation.None,
  host: {
    style: 'display: contents;'
  },
  templateUrl: './shared-columns-panel.component.html',
  styleUrls: ['./shared-columns-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SharedColumnsPanelComponent implements OnChanges {
  readonly backIcon = ArrowLeft01Icon;
  readonly closeIcon = Cancel01Icon;
  readonly searchIcon = Search01Icon;
  readonly clearSearchIcon = Cancel01Icon;
  readonly expandIcon = ArrowDown01Icon;
  readonly collapseIcon = ArrowRight01Icon;
  @Input() open = false;
  @Input() activeTab: SharedColumnsPanelTab = 'shown';
  @Input() shownColumns: SharedColumnsPanelItem[] = [];
  @Input() hiddenColumns: SharedColumnsPanelItem[] = [];
  @Input() allowReorder = true;
  @Input() width = 304;
  @Input() showBack = false;
  @Input() zIndex: number | null = null;
  @Input() topInset: number | null = null;
  @Input() ignoreOutsideSelectors = '';
  @Input() panelClass =
    'columns-drawer columns-drawer--clickup columns-drawer--sidebar page-design-columns-drawer';

  @Output() closed = new EventEmitter<void>();
  @Output() back = new EventEmitter<void>();
  @Output() showAll = new EventEmitter<void>();
  @Output() hideAll = new EventEmitter<void>();
  @Output() reset = new EventEmitter<void>();
  @Output() tabChange = new EventEmitter<SharedColumnsPanelTab>();
  @Output() shownReorder = new EventEmitter<CdkDragDrop<SharedColumnsPanelItem[]>>();
  @Output() hiddenReorder = new EventEmitter<CdkDragDrop<SharedColumnsPanelItem[]>>();
  @Output() shownOrderChange = new EventEmitter<string[]>();
  @Output() hiddenOrderChange = new EventEmitter<string[]>();
  @Output() toggleColumn = new EventEmitter<string>();

  searchTerm = '';
  shownExpanded = true;
  hiddenExpanded = true;
  dragScale = 1;
  hiddenReceivingDrag = false;
  private filteredShownCacheSource: SharedColumnsPanelItem[] | null = null;
  private filteredShownCacheTerm = '';
  private filteredShownCache: SharedColumnsPanelItem[] = [];
  private filteredHiddenCacheSource: SharedColumnsPanelItem[] | null = null;
  private filteredHiddenCacheTerm = '';
  private filteredHiddenCache: SharedColumnsPanelItem[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    this.syncDragScale();

    if (changes['open']) {
      this.searchTerm = '';
      this.hiddenReceivingDrag = false;
      if (this.open) {
        this.shownExpanded = true;
        this.hiddenExpanded = true;
        this.ensureActiveTabVisible();
      }
    }

    if (changes['activeTab'] && this.open) {
      this.ensureActiveTabVisible();
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.syncDragScale();
  }

  get hasSearch(): boolean {
    return this.normalizedSearchTerm().length > 0;
  }

  get filteredShownColumns(): SharedColumnsPanelItem[] {
    return this.getFilteredColumns('shown', this.shownColumns);
  }

  get filteredHiddenColumns(): SharedColumnsPanelItem[] {
    return this.getFilteredColumns('hidden', this.hiddenColumns);
  }

  closePanel(): void {
    this.searchTerm = '';
    this.closed.emit();
  }

  clearSearch(): void {
    this.searchTerm = '';
  }

  onSearchInput(value: string): void {
    this.searchTerm = value ?? '';
  }

  toggleSection(tab: SharedColumnsPanelTab): void {
    if (tab === 'shown') {
      this.shownExpanded = !this.shownExpanded;
      if (this.shownExpanded) {
        this.tabChange.emit('shown');
      }
      return;
    }

    this.hiddenExpanded = !this.hiddenExpanded;
    if (this.hiddenExpanded) {
      this.tabChange.emit('hidden');
    }
  }

  private getFilteredColumns(
    type: SharedColumnsPanelTab,
    columns: SharedColumnsPanelItem[]
  ): SharedColumnsPanelItem[] {
    const term = this.normalizedSearchTerm();
    if (type === 'shown') {
      if (this.filteredShownCacheSource === columns && this.filteredShownCacheTerm === term) {
        return this.filteredShownCache;
      }
      this.filteredShownCacheSource = columns;
      this.filteredShownCacheTerm = term;
      this.filteredShownCache = this.filterColumns(columns, term);
      return this.filteredShownCache;
    }

    if (this.filteredHiddenCacheSource === columns && this.filteredHiddenCacheTerm === term) {
      return this.filteredHiddenCache;
    }
    this.filteredHiddenCacheSource = columns;
    this.filteredHiddenCacheTerm = term;
    this.filteredHiddenCache = this.filterColumns(columns, term);
    return this.filteredHiddenCache;
  }

  private filterColumns(columns: SharedColumnsPanelItem[], term: string): SharedColumnsPanelItem[] {
    if (!term) {
      return columns;
    }
    return columns.filter(column => column.label.toLowerCase().includes(term));
  }

  private normalizedSearchTerm(): string {
    return this.searchTerm.trim().toLowerCase();
  }

  private ensureActiveTabVisible(): void {
    if (this.activeTab === 'hidden') {
      this.hiddenExpanded = true;
      return;
    }

    this.shownExpanded = true;
  }

  private syncDragScale(): void {
    this.dragScale = getAppScale(typeof document !== 'undefined');
  }

  onShownDropped(event: CdkDragDrop<SharedColumnsPanelItem[]>): void {
    this.hiddenReceivingDrag = false;

    if (event.previousContainer !== event.container) {
      const moved = this.resolveDraggedColumn(event, this.filteredHiddenColumns);
      if (!moved) {
        return;
      }
      this.toggleColumn.emit(moved.key);
      this.tabChange.emit('shown');
      return;
    }

    if (event.previousIndex === event.currentIndex) {
      return;
    }
    const order = [...(event.container.data ?? this.filteredShownColumns)].map(
      column => column.key
    );
    moveItemInArray(order, event.previousIndex, event.currentIndex);
    this.shownReorder.emit(event);
    this.shownOrderChange.emit(order);
  }

  onHiddenDropped(event: CdkDragDrop<SharedColumnsPanelItem[]>): void {
    this.hiddenReceivingDrag = false;

    if (event.previousContainer !== event.container) {
      const moved = this.resolveDraggedColumn(event, this.filteredShownColumns);
      if (!moved) {
        return;
      }
      this.toggleColumn.emit(moved.key);
      this.tabChange.emit('hidden');
      return;
    }

    if (event.previousIndex === event.currentIndex) {
      return;
    }
    const order = [...(event.container.data ?? this.filteredHiddenColumns)].map(
      column => column.key
    );
    moveItemInArray(order, event.previousIndex, event.currentIndex);
    this.hiddenReorder.emit(event);
    this.hiddenOrderChange.emit(order);
  }

  onHiddenListEntered(_: CdkDragEnter<SharedColumnsPanelItem[]>): void {
    this.hiddenReceivingDrag = true;
  }

  onHiddenListExited(_: CdkDragExit<SharedColumnsPanelItem[]>): void {
    this.hiddenReceivingDrag = false;
  }

  private resolveDraggedColumn(
    event: CdkDragDrop<SharedColumnsPanelItem[]>,
    fallbackSource: SharedColumnsPanelItem[]
  ): SharedColumnsPanelItem | null {
    const dataColumn = event.item.data as SharedColumnsPanelItem | null | undefined;
    if (dataColumn?.key) {
      return dataColumn;
    }

    const source = event.previousContainer.data ?? fallbackSource;
    return source[event.previousIndex] ?? null;
  }
}
