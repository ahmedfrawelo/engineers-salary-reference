/**
 * ENGINEERS_SALARY_REFERENCE DataGrid public API entrypoint.
 */

// Components
export { DataGridModule } from './module';
export { DataGridComponent } from './component';
export {
  FilterMenuComponent,
  ColumnMenuComponent,
  ColumnVisibilityPanelComponent,
  GridSkeletonLoaderComponent,
  GridCalculateFooterComponent
} from './components';

// Models & Types
export {
  GridColumn,
  GridConfig,
  SortState,
  FilterState,
  PaginationState,
  GridChangeEvent,
  GridAggregateFooterConfig,
  GridAggregateFooterChangeEvent,
  GridAggregateFooterResult,
  GridAggregateOperation,
  GridAggregateScope,
  GridAggregateScopeOption,
  GridRemoteGroupSummary,
  ExportOptions,
  ExportPresentationMeta,
  GridState,
  ColumnType,
  FilterType,
  GridDateGroupInterval,
  SortDirection,
  CellAlignment,
  FilterOperator,
  CellContext,
  CellStyle,
  ExcelExportOptions,
  PdfExportOptions,
  RowAction,
  DensityMode,
  GridFilterOptionValue,
  GridFilterOptionsLoader,
  GridInsertedRowContext,
  GridInsertedRowReason,
  GridHeaderSelectConfig,
  GridCellSearchSelectConfig
} from './models';

// Services
export {
  DataGridService,
  KeyboardNavigationService,
  type CellPosition,
  type NavigationAction,
  type KeyboardNavigationConfig,
  PerformanceMonitorService,
  type PerformanceMetric,
  type PerformanceStats
} from './services';

// Public DOM helpers
export {
  resolveDataGridMainScrollHost,
  getUnifiedDataGridColumnWidth,
  resolvePersistedGridRemoteGrouping,
  type RemoteGroupingParams
} from './utils';

// Cell Renderers
export {
  RenderCellDirective,
  CellRenderers,
  dateRenderer,
  numberRenderer,
  currencyRenderer,
  percentageRenderer,
  booleanRenderer,
  statusBadgeRenderer,
  linkRenderer,
  imageRenderer,
  avatarRenderer,
  tagListRenderer,
  progressBarRenderer,
  ratingRenderer,
  fileSizeRenderer,
  highlightRenderer,
  truncateRenderer,
  enumRenderer,
  multilineRenderer,
  actionButtonsRenderer,
  conditionalRenderer,
  iconRenderer,
  combineRenderers,
  DEFAULT_STATUS_BADGE_CONFIG,
  ICON_MAP,
  type StatusConfig,
  type ActionButton
} from './renderers';
