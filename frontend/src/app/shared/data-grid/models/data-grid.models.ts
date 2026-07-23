import type { Observable } from 'rxjs';

import type {
  SearchSelectOptionHierarchy,
  SearchSelectOptionPresentation
} from '../../ui/search-select.component';

/**
 * Core data models for the ENGINEERS_SALARY_REFERENCE data grid.
 */

// ===== Column Definitions =====

export type ColumnType = 'text' | 'number' | 'date' | 'boolean' | 'dropdown' | 'custom';
export type FilterType = 'text' | 'number' | 'date' | 'select' | 'multiSelect' | 'boolean';
export type SortDirection = 'asc' | 'desc' | null;
export type GridDateGroupInterval = 'day' | 'week' | 'month' | 'quarter' | 'year';
export type CellAlignment = 'left' | 'center' | 'right';
export type GridRowRecord = Record<string, unknown>;
export type GridLooseValue = ReturnType<typeof JSON.parse>;
export type GridAggregateOperation =
  | 'sum'
  | 'avg'
  | 'count'
  | 'min'
  | 'max'
  | 'distinct'
  | 'median'
  | 'percent';
export type GridAggregateScope = 'page' | 'filtered' | 'all';
export type GridFilterOptionValue = { label: string; value: GridLooseValue };
export type GridSelectionBulkEditFieldKind = 'text' | 'number' | 'date' | 'select';
export type GridSelectionBulkEditOption = {
  key: string;
  label: string;
  value: GridLooseValue;
};
export type GridSelectionBulkEditField = {
  field: string;
  label: string;
  kind: GridSelectionBulkEditFieldKind;
  options?: GridSelectionBulkEditOption[];
};
export type GridSelectionBulkEditRequest = {
  field: string;
  value: GridLooseValue | null;
};
export type GridInsertedRowReason = 'append' | 'insert' | 'duplicate' | 'paste' | 'unknown';
export type GridInsertedRowContext = {
  reason: GridInsertedRowReason;
  referenceRow?: GridLooseValue | null;
};
export type GridFilterOptionsLoaderContext = {
  field: string;
  optionSearch?: string;
};
export type GridFilterOptionsLoader<T = GridRowRecord> = (
  context?: GridFilterOptionsLoaderContext
) =>
  | GridFilterOptionValue[]
  | Promise<GridFilterOptionValue[]>
  | Observable<GridFilterOptionValue[]>;

export interface GridHeaderSelectConfig<T = GridRowRecord, Option = string> {
  options: readonly Option[];
  value?: Option | null;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  allowInlineSearch?: boolean;
  searchPlaceholder?: string;
  overlayPanelClass?: string | string[] | null;
  overlayWidthAnchorSelector?: string;
  displayFn?: (option: Option) => string;
  valueChange?: (value: Option | null, column: GridColumn<T>) => void;
}

export interface GridCellSearchSelectConfig<T = GridRowRecord, Option = unknown> {
  options: readonly Option[] | ((row: T, column: GridColumn<T>) => readonly Option[]);
  value?: (row: T, column: GridColumn<T>, options: readonly Option[]) => Option | null;
  displayFn?: (option: Option) => string;
  optionPresentation?: (
    option: Option,
    row: T,
    column: GridColumn<T>
  ) => SearchSelectOptionPresentation | null | undefined;
  optionHierarchy?: (
    option: Option,
    row: T,
    column: GridColumn<T>
  ) => SearchSelectOptionHierarchy | null | undefined;
  showOptionPresentation?: boolean;
  placeholder?: string | ((row: T, column: GridColumn<T>) => string);
  disabled?: boolean | ((row: T, column: GridColumn<T>) => boolean);
  allowClear?: boolean;
  allowInlineSearch?: boolean;
  inlineTextValue?: (row: T, column: GridColumn<T>) => string | null | undefined;
  inlineTextInputMode?: string;
  inlineSuffix?: string | ((row: T, column: GridColumn<T>) => string | null | undefined);
  inlineTextCommit?: (value: string, row: T, column: GridColumn<T>) => void;
  searchPlaceholder?: string;
  noResultsText?: string;
  overlayPanelClass?: string | string[] | null;
  overlayWidthAnchorSelector?: string;
  overlayMinWidth?: number;
  optionFiltersEnabled?: boolean;
  optionFilterTitle?: string;
  search?: (query: string, row: T, column: GridColumn<T>) => void;
  valueChange?: (value: Option | null, row: T, column: GridColumn<T>) => void;
}

export interface GridColumn<T = GridRowRecord> {
  field: keyof T | string;
  header: string;
  headerEditable?: boolean;
  type?: ColumnType;
  width?: number | string;
  minWidth?: number;
  maxWidth?: number;
  fillRemaining?: boolean; // Let this column absorb leftover viewport width when the grid underflows.
  sortable?: boolean;
  filterable?: boolean;
  filterType?: FilterType;
  groupDateIntervals?: GridDateGroupInterval[];
  editable?: boolean;
  canEdit?: (row: T, column: GridColumn<T>) => boolean;
  resizable?: boolean;
  frozen?: boolean; // Deprecated: use `pinned` instead.
  pinned?: 'left' | 'right'; // Pin the column to the left or right edge.
  hidden?: boolean;
  align?: CellAlignment;

  // Header enhancements
  icon?: string; // Optional header icon identifier.
  headerTooltip?: string; // Optional tooltip for the header cell.
  headerSelect?: GridHeaderSelectConfig<T>; // Optional mapped dropdown rendered inside the header cell.

  // Custom renderers
  cellRenderer?: (value: GridLooseValue, row: T, column: GridColumn<T>) => string | HTMLElement;
  renderAsHtml?: boolean; // Set to true if cellRenderer returns HTML string that needs innerHTML
  textClickAction?: boolean; // Emit onCellAction when clicking text marked with data-grid-cell-text-action.
  textDoubleClickEdit?: boolean; // Let double-click on marked text edit instead of firing the click action.
  cellClass?: string | ((value: GridLooseValue, row: T) => string);
  headerClass?: string;

  // Formatting
  format?: (value: GridLooseValue) => string;
  emptyDisplayValue?: string;
  wrapEditor?: boolean; // Text editors wrap by default; set false to force single-line editing.

  // Tooltips
  showTooltip?: boolean; // Whether the cell should show a tooltip.
  getTooltip?: (value: GridLooseValue, row: T) => string; // Custom tooltip content builder.

  // Dropdown options (for dropdown columns)
  options?: GridFilterOptionValue[];
  searchSelect?: GridCellSearchSelectConfig<T>;
  filterOptionsLoader?: GridFilterOptionsLoader<T>;

  // Validation (for editable cells)
  validator?: (value: GridLooseValue, row: T) => boolean | string;

  // Aggregation
  aggregate?: GridAggregateOperation;

  // Spreadsheet mode support.
  cellType?: 'text' | 'number' | 'formula' | 'date' | 'select' | 'search-select'; // Cell type for spreadsheet mode
  allowFormulas?: boolean; // Allow formulas in this column (default: true if cellType='formula')
}

// ===== Grid Configuration =====

export type DensityMode = 'compact' | 'comfortable' | 'spacious';

export interface GridConfig {
  // Simple mode - hides all advanced features for a cleaner interface
  simpleMode?: boolean;
  remoteData?: boolean;
  remoteCurrentPage?: number;
  remoteTotalRecords?: number;

  // Performance options.
  enableCache?: boolean; // Enable result caching (default: true)
  cacheSize?: number; // Max cache entries (default: 50)
  virtualScrollBuffer?: number; // Buffer rows before/after viewport (default: 5)
  debounceTime?: number; // Debounce time for filters in ms (default: 300)
  trackRowsByBusinessId?: boolean; // Preserve row controls across refreshes when row IDs are unique.

  // Selection
  selectable?: boolean;
  selectMode?: 'single' | 'multiple' | 'checkbox';
  pinSelectionColumn?: boolean;

  // Pagination
  pagination?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
  persistColumnWidths?: boolean; // Persist column width changes in saved grid state (default: true)
  persistColumnLayout?: boolean; // Persist column order/hidden/pinned state in saved grid state (default: true)

  // Sorting
  multiSort?: boolean;

  // Filtering
  showFilter?: boolean;
  filterDelay?: number; // debounce delay in ms
  showFilterChips?: boolean; // Show active filter chips.
  enableQuickFilter?: boolean; // Enable quick-filter inputs in column headers.
  quickFilterPlaceholder?: string; // Placeholder text for quick filter inputs
  disableFilters?: boolean; // Disable filter actions, for example while loading.

  // Virtual scrolling
  virtualScroll?: boolean;
  rowHeight?: number;

  // Editing
  editMode?: 'cell' | 'row' | 'none';
  singleClickEdit?: boolean; // Start editing on single body-cell click
  enterNavigatesNextCell?: boolean; // Save current edit and move to the next cell on Enter
  enterNavigationDirection?: 'right' | 'down'; // Direction used after saving with Enter
  appendRow?: boolean; // Show a permanent blank row at the bottom that creates a real row on click
  appendRowHint?: string; // Hint shown in the blank append row
  prepareInsertedRow?: (
    row: GridLooseValue,
    context: GridInsertedRowContext
  ) => GridLooseValue | void; // Normalize generated rows before the grid inserts them.
  onRowInserted?: (
    row: GridLooseValue,
    context: GridInsertedRowContext
  ) => void; // Notify owners when append/duplicate/paste creates a row internally.

  // Export
  exportable?: boolean;
  exportFormats?: ('excel' | 'csv' | 'pdf')[];
  exportTitle?: string;
  exportSubtitle?: string;
  exportFileName?: string;
  exportAppName?: string;
  exportFooter?: string;

  // UI
  striped?: boolean;
  bordered?: boolean;
  hover?: boolean; // Disable row/header/cell hover interactions and hover-only affordances when false
  dense?: boolean;
  density?: DensityMode; // Visual density preset.
  rtl?: boolean;
  fullScreenMode?: boolean; // Start the grid in fullscreen mode.
  showBottomScrollbarBand?: boolean; // Render the secondary horizontal scrollbar band (default: true).
  reserveAggregateFooterBand?: boolean; // Reserve footer height before async aggregate footer inputs render.

  // Loading
  loading?: boolean;
  loadingMessage?: string;

  // Empty state
  emptyMessage?: string;

  // Row styling
  rowClass?: string | ((row: GridLooseValue, index: number) => string);

  // Row actions
  rowActions?: RowAction[]; // Row-level actions shown in the actions column.
  enableBookmarks?: boolean; // Show bookmark actions + drawer (default: false)

  // ===== 🔥 NEW: Spreadsheet Mode =====
  spreadsheetMode?: boolean; // Enable Excel-like spreadsheet behavior
  enableFormulas?: boolean; // Support =A1+B1 formulas (default: true if spreadsheetMode)
  enableExcelPaste?: boolean; // Paste from Excel/TSV/CSV (default: true if spreadsheetMode)
  enableCellNavigation?: boolean; // Arrow keys, Enter, Tab navigation (default: true if spreadsheetMode)
  showFormulaBar?: boolean; // Show formula bar at top (default: false)
  allowCellFormatting?: boolean; // Allow bold, colors, etc. (default: false)
  cellTypes?: { [key: string]: 'text' | 'number' | 'formula' | 'date' | 'select' | 'search-select' }; // Cell type per column
  autoCalculate?: boolean; // Auto-recalculate formulas on change (default: true)

  // ===== Column Auto-sizing =====
  autoSizeColumns?: boolean; // Automatically size columns based on content (default: false)

  // ===== Accessibility =====
  ariaLabel?: string; // ARIA label for the grid (default: 'Data grid')
  ariaDescription?: string; // ARIA description for the grid
}

// ===== Sort State =====

export interface SortState {
  field: string;
  direction: SortDirection;
  order?: number; // for multi-sort
}

// ===== Filter State =====

export interface FilterState {
  field: string;
  value: GridLooseValue;
  operator?: FilterOperator;
  joinWithPrev?: 'and' | 'or';
}

export type FilterOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'
  | 'between'
  | 'in'
  | 'notIn'
  | 'isEmpty'
  | 'notEmpty'
  | 'menuSearch'
  | 'globalSearch';

// ===== Pagination State =====

export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
}

export interface GridRemoteGroupSummary {
  field: string;
  key: string;
  value?: unknown;
  count: number;
}

// ===== Grid Change Event =====

export interface GridChangeEvent {
  type:
    | 'sort'
    | 'filter'
    | 'page'
    | 'pageSize'
    | 'selection'
    | 'edit'
    | 'aggregate'
    | 'group'
    | 'groupExpansion';
  sorts?: SortState[];
  filters?: FilterState[];
  pagination?: PaginationState;
  selectedRows?: GridLooseValue[];
  groupColumns?: string[];
  groupDateIntervals?: Record<string, GridDateGroupInterval>;
  expandedGroups?: string[];
  groupExpansionAuto?: boolean;
  editedCell?: {
    row: GridLooseValue;
    field: string;
    oldValue: GridLooseValue;
    newValue: GridLooseValue;
  };
}

export interface GridAggregateScopeOption {
  value: GridAggregateScope;
  label: string;
  shortLabel?: string;
  description?: string;
}

export interface GridAggregateFooterResult {
  field: string;
  operation: GridAggregateOperation;
  value: unknown;
}

export interface GridAggregateFooterConfig<T = GridRowRecord> {
  enabled: boolean;
  scope: GridAggregateScope;
  scopeOptions?: readonly GridAggregateScopeOption[];
  loading?: boolean;
  totalRows?: number;
  summaryText?: string;
  results?: Record<string, GridAggregateFooterResult>;
  emptyPrimaryText?: string;
  emptySecondaryText?: string;
  loadingPrimaryText?: string;
  currentOperation?: (column: GridColumn<T>) => GridAggregateOperation | null;
  operationLabel?: (operation: GridAggregateOperation) => string;
  supportsOperation?: (column: GridColumn<T>, operation: GridAggregateOperation) => boolean;
  formatValue?: (column: GridColumn<T>, result: GridAggregateFooterResult) => string;
}

export type GridAggregateFooterChangeEvent<T = GridRowRecord> =
  | {
      type: 'scope';
      scope: GridAggregateScope;
    }
  | {
      type: 'operation';
      column: GridColumn<T>;
      operation: GridAggregateOperation | null;
    };

// ===== Export Event =====

export interface ExportOptions {
  format: 'excel' | 'csv' | 'pdf';
  fileName?: string;
  allData?: boolean; // export all data or current page only
  selectedOnly?: boolean;
  includeHeaders?: boolean;
}

export interface ExportPresentationMeta {
  title?: string;
  subtitle?: string;
  scopeLabel?: string;
  appName?: string;
  footerText?: string;
  generatedAt?: Date;
}

// ===== Cell Context =====

export interface CellContext<T = GridRowRecord> {
  value: GridLooseValue;
  row: T;
  rowIndex: number;
  column: GridColumn<T>;
  isEditing: boolean;
}

// ===== Export Configuration =====

export interface ExcelExportOptions {
  sheetName?: string;
  creator?: string;
  includeFilters?: boolean;
  includeAggregates?: boolean;
}

export interface PdfExportOptions {
  orientation?: 'portrait' | 'landscape';
  pageSize?: 'A4' | 'A3' | 'letter';
  title?: string;
  includePageNumbers?: boolean;
}

// ===== Cell Styles =====

export interface CellStyle {
  backgroundColor?: string;
  color?: string;
  fontWeight?: string;
  fontSize?: string;
  textAlign?: CellAlignment;
  padding?: string;
  border?: string;
}

// ===== Grid State =====

export interface GridState {
  sorts: SortState[];
  filters: FilterState[];
  columnOrder: string[];
  columnWidths: Record<string, number | string>;
  hiddenColumns: string[];
  columnDefinitions?: Record<
    string,
    {
      type?: ColumnType;
      cellType?: GridColumn['cellType'];
      options?: GridFilterOptionValue[];
    }
  >;
  pinnedColumns?: Record<string, 'left' | 'right'>;
  columnAggregates?: Record<string, GridAggregateOperation>;
  groupHeaderAggregates?: boolean;
  groupFooterAggregates?: boolean;
  grandTotalAggregates?: boolean;
  pageSize: number;
  groupColumns: string[];
  groupDateIntervals?: Record<string, GridDateGroupInterval>;
  expandedGroups?: string[];
  groupExpansionAuto?: boolean;
  version: string; // Reserved for forward compatibility.
}

// ===== Row Actions =====

export interface RowAction {
  icon: string; // Action icon identifier, emoji, or unicode glyph.
  label: string; // Action label shown to users.
  action: (row: GridLooseValue) => void; // Callback invoked when the action runs.
  color?: string; // Optional action color.
  show?: (row: GridLooseValue) => boolean; // Optional visibility predicate.
}
