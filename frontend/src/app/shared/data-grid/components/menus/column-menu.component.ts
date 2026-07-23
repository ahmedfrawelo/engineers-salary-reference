import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  inject,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import {
  InsertColumnLeftIcon,
  InsertColumnRightIcon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowLeftRightIcon,
  ArrowReloadHorizontalIcon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  ArrowUpDownIcon,
  Cancel01Icon,
  ClipboardCopyIcon,
  FilterIcon,
  GridIcon,
  LayoutThreeColumnIcon,
  MinusSignIcon,
  PencilEdit01Icon,
  PinIcon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
  ViewIcon,
  ViewOffIcon
} from '@shared/icons/app-icon.registry';
import { GridColumn } from '../../models';

type LooseValue = ReturnType<typeof JSON.parse>;

export interface ColumnMenuAction {
  type:
    | 'align-left'
    | 'align-center'
    | 'align-right'
    | 'sort-asc'
    | 'sort-desc'
    | 'clear-sort'
    | 'pin-left'
    | 'pin-right'
    | 'unpin'
    | 'freeze'
    | 'unfreeze'
    | 'hide'
    | 'rename-column'
    | 'add-column-left'
    | 'add-column-right'
    | 'delete-column'
    | 'show-all'
    | 'copy-column'
    | 'copy-header'
    | 'autosize'
    | 'autosize-all'
    | 'group'
    | 'ungroup'
    | 'filter'
    | 'clear-filter'
    | 'reset'
    | 'export-column';
  column: GridColumn<LooseValue>;
  data?: LooseValue;
}

@Component({
  selector: 'engineers-salary-reference-column-menu',
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone: false,
  templateUrl: './column-menu.component.html',
  styleUrls: ['./column-menu.component.scss']
})
export class ColumnMenuComponent implements AfterViewInit, OnChanges, OnDestroy {
  readonly menuIcons = {
    pin: PinIcon,
    align: TextAlignLeftIcon,
    autosize: ArrowLeftRightIcon,
    sort: ArrowUpDownIcon,
    filter: FilterIcon,
    group: GridIcon,
    columns: LayoutThreeColumnIcon,
    copy: ClipboardCopyIcon,
    edit: PencilEdit01Icon,
    addColumnLeft: InsertColumnLeftIcon,
    addColumnRight: InsertColumnRightIcon,
    deleteColumn: Cancel01Icon,
    reset: ArrowReloadHorizontalIcon,
    pinLeft: ArrowLeft01Icon,
    pinRight: ArrowRight01Icon,
    noPin: MinusSignIcon,
    alignLeft: TextAlignLeftIcon,
    alignCenter: TextAlignCenterIcon,
    alignRight: TextAlignRightIcon,
    autosizeAll: LayoutThreeColumnIcon,
    sortAsc: ArrowUp01Icon,
    sortDesc: ArrowDown01Icon,
    clear: Cancel01Icon,
    view: ViewIcon,
    viewOff: ViewOffIcon
  } as const;

  private _column: GridColumn<LooseValue> | null = null;
  @Input()
  set column(value: GridColumn<LooseValue> | null) {
    this._column = value;
  }
  get column(): GridColumn<LooseValue> | null {
    return this._column;
  }

  private _position = { x: 0, y: 0 };
  @Input()
  set position(value: { x: number; y: number } | null | undefined) {
    this._position = value ?? { x: 0, y: 0 };
  }
  get position(): { x: number; y: number } {
    return this._position;
  }

  private _allColumns: GridColumn<LooseValue>[] = [];
  @Input()
  set allColumns(value: GridColumn<LooseValue>[] | null | undefined) {
    this._allColumns = value ?? [];
  }
  get allColumns(): GridColumn<LooseValue>[] {
    return this._allColumns;
  }

  private readonly _onActionClick = new EventEmitter<ColumnMenuAction>();
  @Output()
  get onActionClick(): EventEmitter<ColumnMenuAction> {
    return this._onActionClick;
  }

  private readonly _onClose = new EventEmitter<void>();
  @Output()
  get onClose(): EventEmitter<void> {
    return this._onClose;
  }

  private readonly _onToggleColumn = new EventEmitter<GridColumn<LooseValue>>();
  @Output()
  get onToggleColumn(): EventEmitter<GridColumn<LooseValue>> {
    return this._onToggleColumn;
  }

  private _selectAllCheckbox?: ElementRef<HTMLInputElement>;
  @ViewChild('selectAllCheckbox')
  set selectAllCheckbox(value: ElementRef<HTMLInputElement> | undefined) {
    this._selectAllCheckbox = value;
  }
  get selectAllCheckbox(): ElementRef<HTMLInputElement> | undefined {
    return this._selectAllCheckbox;
  }

  activeSubmenu: string | null = null;
  submenuPosition = { x: 0, y: 0 };
  nestedSubmenuPosition = { x: 0, y: 0 };
  private hideTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly pendingTimers = new Set<ReturnType<typeof setTimeout>>();
  private destroyed = false;
  columnSearchTerm = '';
  private readonly cdr = inject(ChangeDetectorRef);

  ngAfterViewInit() {
    this.scheduleMenuTask(() => this.updateSelectAllCheckbox(), 0);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['allColumns']) {
      this.scheduleMenuTask(() => this.updateSelectAllCheckbox(), 0);
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.pendingTimers.delete(this.hideTimeout);
      this.hideTimeout = null;
    }
    this.pendingTimers.forEach(timer => clearTimeout(timer));
    this.pendingTimers.clear();
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.onClose.emit();
  }

  showSubmenu(menu: string, event: MouseEvent) {
    this.keepSubmenuOpen();
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    if (menu === 'choose-columns') {
      this.activeSubmenu = menu;
      const parentSubmenu = target.closest('.submenu') as HTMLElement;
      if (parentSubmenu) {
        const parentRect = parentSubmenu.getBoundingClientRect();
        let x = parentRect.right + 4;
        let y = rect.top;
        const estimatedHeight = 400;
        const estimatedWidth = 250;

        if (y + estimatedHeight > viewportHeight) {
          y = Math.max(10, viewportHeight - estimatedHeight - 10);
        }

        if (x + estimatedWidth > viewportWidth) {
          x = parentRect.left - estimatedWidth - 4;
        }

        this.nestedSubmenuPosition = { x, y };
      } else {
        this.nestedSubmenuPosition = {
          x: rect.right + 4,
          y: rect.top
        };
      }
    } else {
      this.activeSubmenu = menu;
      let x = rect.right + 4;
      let y = rect.top;
      const estimatedHeight = 300;
      const estimatedWidth = 200;

      if (y + estimatedHeight > viewportHeight) {
        y = Math.max(10, viewportHeight - estimatedHeight - 10);
      }

      if (x + estimatedWidth > viewportWidth) {
        x = rect.left - estimatedWidth - 4;
      }

      this.submenuPosition = { x, y };
    }
  }

  hideSubmenu() {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.pendingTimers.delete(this.hideTimeout);
    }
    this.hideTimeout = this.scheduleMenuTask(() => {
      this.activeSubmenu = null;
      this.hideTimeout = null;
    }, 150);
  }

  keepSubmenuOpen() {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.pendingTimers.delete(this.hideTimeout);
      this.hideTimeout = null;
    }
  }

  preventHide() {
    this.keepSubmenuOpen();
  }

  onAction(type: ColumnMenuAction['type']) {
    if (this.column) {
      this.onActionClick.emit({ type, column: this.column });
      this.scheduleMenuTask(() => {
        this.onClose.emit();
      }, 50);
    }
  }

  filteredColumns(): GridColumn<LooseValue>[] {
    if (!this.columnSearchTerm.trim()) {
      return this.allColumns;
    }
    const term = this.columnSearchTerm.toLowerCase();
    return this.allColumns.filter(col =>
      String(col.header ?? '')
        .toLowerCase()
        .includes(term)
    );
  }

  areAllColumnsVisible(): boolean {
    return this.allColumns.every(col => !col.hidden);
  }

  areSomeColumnsHidden(): boolean {
    const hiddenCount = this.allColumns.filter(col => col.hidden).length;
    return hiddenCount > 0 && hiddenCount < this.allColumns.length;
  }

  toggleAllColumns() {
    if (!this.allColumns.length) {
      return;
    }

    const allVisible = this.areAllColumnsVisible();
    if (!allVisible) {
      this.allColumns.forEach(col => {
        col.hidden = false;
      });
      this.onToggleColumn.emit(this.allColumns[0]);
      this.updateSelectAllCheckbox();
    }
  }

  private updateSelectAllCheckbox() {
    if (this.destroyed) {
      return;
    }
    if (this.selectAllCheckbox?.nativeElement) {
      const indeterminate = this.areSomeColumnsHidden();
      const checked = this.areAllColumnsVisible();
      this.selectAllCheckbox.nativeElement.indeterminate = indeterminate;
      this.selectAllCheckbox.nativeElement.checked = checked;
      this.cdr.detectChanges();
    }
  }

  toggleColumnVisibility(column: GridColumn<LooseValue>) {
    this.onToggleColumn.emit(column);
    this.scheduleMenuTask(() => this.updateSelectAllCheckbox(), 10);
  }

  private scheduleMenuTask(task: () => void, delay: number): ReturnType<typeof setTimeout> {
    const timer = setTimeout(() => {
      this.pendingTimers.delete(timer);
      if (!this.destroyed) {
        task();
      }
    }, delay);
    this.pendingTimers.add(timer);
    return timer;
  }
}
