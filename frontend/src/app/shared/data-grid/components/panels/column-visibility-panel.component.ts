import { Component, Input, Output, EventEmitter, OnInit, OnChanges } from '@angular/core';
import { GridColumn } from '../../models';

@Component({
  selector: 'engineers-salary-reference-column-visibility-panel',
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone: false,
  template: `
    <div class="column-visibility-panel solid" [class.rtl]="rtl" (click)="$event.stopPropagation()">
      <div class="panel-header">
        <h4>Column Visibility</h4>
        <button type="button" class="close-btn" (click)="onClose.emit()">&times;</button>
      </div>

      <div class="panel-search">
        <input
          type="text"
          class="search-input"
          placeholder="Search columns..."
          [(ngModel)]="searchTerm"
          (input)="filterColumns()"
        />
      </div>

      <div class="panel-actions">
        <button type="button" class="action-btn" (click)="showAll()">Show All</button>
        <button type="button" class="action-btn" (click)="hideAll()">Hide All</button>
      </div>

      <div class="column-list">
        @for (column of filteredColumns; track column) {
          <label class="column-item">
            <input type="checkbox" [checked]="!column.hidden" (change)="toggleColumn(column)" />
            <span>{{ column.header }}</span>
          </label>
        }

        @if (filteredColumns.length === 0) {
          <div class="empty-message">No columns found</div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .column-visibility-panel {
        position: relative;
        width: 100%;
        background-color: rgba(5, 8, 13, 0.94);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 14px;
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.03);
        min-width: 0;
        max-height: 360px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        isolation: isolate;
      }

      .column-visibility-panel.rtl {
        direction: rtl;
      }

      .column-visibility-panel.solid {
        background-color: rgba(5, 8, 13, 0.94);
        mix-blend-mode: normal;
      }

      .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid rgb(var(--border, 74 74 74) / 0.4);
        background-color: inherit;
        position: relative;
        z-index: 1;

        h4 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: rgb(var(--fg, 230 230 230));
        }

        .close-btn {
          background: transparent;
          border: none;
          color: rgba(var(--fg, 230 230 230), 0.7);
          font-size: 24px;
          line-height: 1;
          cursor: pointer;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: all 0.2s;

          &:hover {
            background: rgba(var(--fg, 255 255 255), 0.1);
            color: rgb(var(--fg, 255 255 255));
          }
        }
      }

      .panel-search {
        padding: 12px 16px;
        border-bottom: 1px solid rgb(var(--border, 74 74 74) / 0.4);
        background-color: inherit;
        position: relative;
        z-index: 1;

        .search-input {
          width: 100%;
          padding: 8px 12px;
          font-size: 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 4px;
          background: #111720;
          color: rgb(var(--fg, 224 224 224));
          outline: none;

          &:focus {
            border-color: rgb(var(--primary, 0 145 234));
            box-shadow: 0 0 0 2px rgb(var(--primary, 0 145 234) / 0.2);
          }

          &::placeholder {
            color: rgba(var(--fg, 224 224 224), 0.4);
          }
        }
      }

      .panel-actions {
        display: flex;
        gap: 8px;
        padding: 12px 16px;
        border-bottom: 1px solid rgb(var(--border, 74 74 74) / 0.4);
        background-color: inherit;
        position: relative;
        z-index: 1;

        .action-btn {
          flex: 1;
          padding: 6px 12px;
          font-size: 11px;
          font-weight: 500;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 4px;
          background: #101722;
          color: rgb(var(--fg, 230 230 230));
          cursor: pointer;
          transition: all 0.2s;

          &:hover {
            background: rgba(var(--primary, 0 145 234), 0.1);
            border-color: rgb(var(--primary, 0 145 234));
            color: rgb(var(--primary, 0 145 234));
          }
        }
      }

      .column-list {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
        max-height: 350px;
        background-color: inherit;
        position: relative;
        z-index: 1;
      }

      .column-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        font-size: 12px;
        color: rgb(var(--fg, 224 224 224));
        cursor: pointer;
        border-radius: 4px;
        transition: background-color 0.1s;
        background: #0f141d;
        border: 1px solid rgba(255, 255, 255, 0.04);
        margin-bottom: 6px;

        &:hover {
          background-color: #182131;
          border-color: rgba(255, 255, 255, 0.12);
        }

        input[type='checkbox'] {
          cursor: pointer;
          width: 16px;
          height: 16px;
          accent-color: rgb(var(--primary, 0 145 234));
        }

        span {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }

      .empty-message {
        padding: 24px;
        text-align: center;
        color: rgba(var(--fg, 224 224 224), 0.5);
        font-size: 12px;
        background: inherit;
      }
    `
  ]
})
export class ColumnVisibilityPanelComponent<T = unknown> implements OnInit, OnChanges {
  private _columns: GridColumn<T>[] = [];
  @Input()
  set columns(value: GridColumn<T>[] | null | undefined) {
    this._columns = value ?? [];
  }
  get columns(): GridColumn<T>[] {
    return this._columns;
  }

  private _rtl = false;
  @Input()
  set rtl(value: boolean | null | undefined) {
    this._rtl = value ?? false;
  }
  get rtl(): boolean {
    return this._rtl;
  }

  private readonly _onToggle = new EventEmitter<{ column: GridColumn<T>; hidden: boolean }>();
  @Output()
  get onToggle(): EventEmitter<{ column: GridColumn<T>; hidden: boolean }> {
    return this._onToggle;
  }

  private readonly _onClose = new EventEmitter<void>();
  @Output()
  get onClose(): EventEmitter<void> {
    return this._onClose;
  }

  searchTerm = '';
  filteredColumns: GridColumn<T>[] = [];

  ngOnInit() {
    this.filterColumns();
  }

  ngOnChanges() {
    this.filterColumns();
  }

  filterColumns() {
    const term = this.searchTerm.toLowerCase().trim();
    if (!term) {
      this.filteredColumns = [...this.columns];
    } else {
      this.filteredColumns = this.columns.filter(col =>
        String(col.header ?? '')
          .toLowerCase()
          .includes(term)
      );
    }
  }

  toggleColumn(column: GridColumn<T>) {
    const newHiddenState = !column.hidden;
    this.onToggle.emit({ column, hidden: newHiddenState });
  }

  showAll() {
    this.columns.forEach(col => {
      if (col.hidden) {
        this.onToggle.emit({ column: col, hidden: false });
      }
    });
  }

  hideAll() {
    this.columns.forEach(col => {
      if (!col.hidden) {
        this.onToggle.emit({ column: col, hidden: true });
      }
    });
  }
}
