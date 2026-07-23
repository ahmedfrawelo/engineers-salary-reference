import type {
  AreaRangeDatum,
  BoxplotDatum,
  CalendarDatum,
  CandlestickDatum,
  ChartDatum,
  ChordLink,
  ChordNode,
  DumbbellDatum,
  BulletDatum,
  FunnelDatum,
  GaugeDatum,
  GanttDatum,
  HeatmapDatum,
  LineSeries,
  LollipopDatum,
  MekkoDatum,
  NetworkLink,
  NetworkNode,
  OhlcDatum,
  ParallelSeries,
  ParetoDatum,
  PolarAreaDatum,
  PyramidDatum,
  RadarSeries,
  RadialDatum,
  RangeBarDatum,
  RidgelineDatum,
  SankeyLink,
  SankeyNode,
  ScatterDatum,
  StackedSeries,
  SlopeDatum,
  SunburstDatum,
  TernaryDatum,
  TileMapDatum,
  TimelineLane,
  TreeNode,
  TreemapDatum,
  UpsetDatum,
  VennIntersection,
  VennSet,
  ViolinDatum,
  WaffleDatum,
  WaterfallDatum,
  WordCloudDatum
} from '@shared/charts/chart-types';

export type ReportingTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

export type ReportingChartKind =
  | 'areaRange'
  | 'bar'
  | 'boxplot'
  | 'bump'
  | 'calendarHeatmap'
  | 'candlestick'
  | 'chord'
  | 'dumbbell'
  | 'line'
  | 'gauge'
  | 'gantt'
  | 'histogram'
  | 'lollipop'
  | 'mekko'
  | 'network'
  | 'ohlc'
  | 'parallelCoordinates'
  | 'pareto'
  | 'stackedBar'
  | 'stepLine'
  | 'stream'
  | 'radar'
  | 'radialBar'
  | 'rangeBar'
  | 'ridgeline'
  | 'sankey'
  | 'scatter'
  | 'slope'
  | 'sparkline'
  | 'sunburst'
  | 'ternary'
  | 'tilemap'
  | 'timeline'
  | 'tree'
  | 'heatmap'
  | 'bullet'
  | 'pie'
  | 'polarArea'
  | 'pyramid'
  | 'treemap'
  | 'upset'
  | 'venn'
  | 'violin'
  | 'waffle'
  | 'funnel'
  | 'waterfall'
  | 'wordCloud';

export interface ReportingMetricCard {
  label: string;
  value: string;
  note: string;
  delta?: string;
  trend?: 'up' | 'down' | 'flat';
  tone: Exclude<ReportingTone, 'danger'>;
}

export interface ReportingFilterOption {
  label: string;
  value: string;
}

export interface ReportingFilterGroup {
  key: string;
  label: string;
  description?: string;
  defaultValue?: string;
  options: ReportingFilterOption[];
}

export interface ReportingSelectFilter {
  key: string;
  label: string;
  value: string;
  placeholder: string;
  options: ReportingFilterOption[];
}

export interface ReportingDateFilter {
  key: string;
  label: string;
  value: string;
}

export interface ReportingChipFilterGroup {
  key: string;
  label: string;
  values: string[];
  options: Array<ReportingFilterOption & { tone?: ReportingTone }>;
}

export interface ReportingToggleFilter {
  key: string;
  label: string;
  value: boolean;
}

export interface ReportingRangeFilter {
  key: string;
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
}

export interface ReportingActiveFilterChip {
  key: string;
  label: string;
  value: string;
}

export type ReportingRegisterViewMode = 'cards' | 'table';
export type ReportingSortDirection = 'asc' | 'desc';

export type ReportingDataRow = Record<string, unknown>;

export type ReportingFilterOperator =
  | 'equals'
  | 'in'
  | 'contains'
  | 'gte'
  | 'lte'
  | 'between'
  | 'truthy'
  | 'falsy';

export type ReportingSortValueType = 'string' | 'number' | 'date' | 'rank';

export interface ReportingQuerySearch {
  term: string;
  fields: string[];
}

export interface ReportingQueryFilter {
  field: string;
  operator: ReportingFilterOperator;
  value?: unknown;
}

export interface ReportingQuerySort {
  field: string;
  direction: ReportingSortDirection;
  valueType?: ReportingSortValueType;
  rankOrder?: readonly string[];
}

export interface ReportingQuery {
  search?: ReportingQuerySearch;
  filters?: ReportingQueryFilter[];
  sort?: ReportingQuerySort;
}

export interface ReportingQueryResult<T extends object> {
  rows: T[];
  totalRows: number;
  filteredRows: number;
  activeFilterCount: number;
}

export interface ReportingSummaryRequest {
  countFields?: string[];
  sumFields?: string[];
  averageFields?: string[];
}

export interface ReportingSummaryResult {
  totalRows: number;
  counts: Record<string, Record<string, number>>;
  sums: Record<string, number>;
  averages: Record<string, number>;
}

export type ReportingFieldType = 'string' | 'number' | 'date' | 'boolean' | 'currency' | 'percent';
export type ReportingMetricAggregation = 'count' | 'sum' | 'average' | 'countWhere';

export interface ReportingFieldDefinition {
  key: string;
  label: string;
  type: ReportingFieldType;
  searchable?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  exportable?: boolean;
  align?: 'left' | 'right';
  rankOrder?: readonly string[];
}

export interface ReportingMetricDefinition {
  key: string;
  label: string;
  aggregation: ReportingMetricAggregation;
  field?: string;
  where?: ReportingQueryFilter[];
  format?: 'number' | 'currency' | 'percent';
  note?: string;
  tone?: Exclude<ReportingTone, 'danger'>;
}

export interface ReportingTemplateDefinition {
  id: string;
  title: string;
  description?: string;
  fields: ReportingFieldDefinition[];
  metrics?: ReportingMetricDefinition[];
  defaultSort?: ReportingQuerySort;
}

export interface ReportingResolvedMetric {
  key: string;
  label: string;
  value: string;
  rawValue: number;
  note?: string;
  tone: Exclude<ReportingTone, 'danger'>;
}

export interface ReportingRegisterSortState {
  key: string;
  direction: ReportingSortDirection;
}

export interface ReportingRegisterSummaryChip {
  label: string;
  value: string;
}

export interface ReportingRegisterColumn {
  key: string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'right';
}

export interface ReportingRegisterAction {
  key: string;
  label: string;
  icon: string;
  linkKey?: string;
}

export interface ReportingRegisterRow {
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
  statusTone?: ReportingTone;
  link?: string | null;
  starred?: boolean;
  cells: Record<string, string | number | null | undefined>;
}

export interface ReportingActionItem {
  title: string;
  owner: string;
  due: string;
  status: string;
  tone: ReportingTone;
  note?: string;
}

export interface ReportingDetailRecord {
  id: string;
  title: string;
  summary: string;
  type: string;
  status: string;
  owner: string;
  department: string;
  lastRun: string;
  nextRun?: string | null;
  createdAt: string;
  updatedAt: string;
  periodStart: string;
  periodEnd: string;
  rows: number;
  value: number;
  variance: number;
  confidence: number;
  health: number;
  priority: string;
  format: string;
  tags: string[];
  starred: boolean;
}

export interface ReportingDetailMetric {
  label: string;
  value: string;
  note: string;
  tone: ReportingTone;
}

export interface ReportingDetailPageLink {
  key: string;
  label: string;
  shortLabel?: string;
  caption?: string;
  path: string;
  icon?: string;
  exact?: boolean;
  reportId?: string;
}

export interface ReportingDetailPageDefinition {
  link: ReportingDetailPageLink;
  report: ReportingDetailRecord;
  kicker: string;
  description: string;
  spotlight: string;
  filterGroups: ReportingFilterGroup[];
  metrics: ReportingDetailMetric[];
  charts: ReportingChartCard[];
  insights: ReportingDetailMetric[];
  actionItems: ReportingActionItem[];
}

export interface ReportingDetailExecutiveCard {
  label: string;
  value: string;
  note: string;
  tone: ReportingTone;
}

export interface ReportingDetailBoardItem {
  label: string;
  value: string;
  note: string;
}

export interface ReportingChartCard {
  kind: ReportingChartKind;
  title: string;
  caption: string;
  exportName: string;
  layout?: 'default' | 'wide';
  height?: number;
  areaRangeData?: AreaRangeDatum[];
  barData?: ChartDatum[];
  boxplotData?: BoxplotDatum[];
  calendarHeatmapData?: CalendarDatum[];
  candlestickData?: CandlestickDatum[];
  chordNodes?: ChordNode[];
  chordLinks?: ChordLink[];
  dumbbellData?: DumbbellDatum[];
  labels?: string[];
  lineSeries?: LineSeries[];
  gaugeData?: GaugeDatum;
  ganttData?: GanttDatum[];
  histogramValues?: number[];
  lollipopData?: LollipopDatum[];
  mekkoData?: MekkoDatum[];
  networkNodes?: NetworkNode[];
  networkLinks?: NetworkLink[];
  ohlcData?: OhlcDatum[];
  parallelAxes?: string[];
  parallelSeries?: ParallelSeries[];
  paretoData?: ParetoDatum[];
  polarAreaData?: PolarAreaDatum[];
  pyramidData?: PyramidDatum[];
  radialBarData?: RadialDatum[];
  rangeBarData?: RangeBarDatum[];
  ridgelineData?: RidgelineDatum[];
  sankeyNodes?: SankeyNode[];
  sankeyLinks?: SankeyLink[];
  stackedSeries?: StackedSeries[];
  radarAxes?: string[];
  radarSeries?: RadarSeries[];
  radarMax?: number;
  scatterData?: ScatterDatum[];
  slopeData?: SlopeDatum[];
  sparklineValues?: number[];
  sunburstData?: SunburstDatum[];
  ternaryData?: TernaryDatum[];
  ternaryLabels?: [string, string, string];
  tilemapData?: TileMapDatum[];
  timelineLanes?: TimelineLane[];
  treeRoot?: TreeNode | null;
  heatmapData?: HeatmapDatum[];
  bulletData?: BulletDatum[];
  pieData?: ChartDatum[];
  treemapData?: TreemapDatum[];
  upsetSets?: string[];
  upsetData?: UpsetDatum[];
  vennSets?: VennSet[];
  vennIntersections?: VennIntersection[];
  violinData?: ViolinDatum[];
  waffleData?: WaffleDatum[];
  funnelData?: FunnelDatum[];
  waterfallData?: WaterfallDatum[];
  wordCloudData?: WordCloudDatum[];
}

export interface ReportingExportPayload {
  title: string;
  subtitle?: string;
  generatedAt?: string;
  rows: Record<string, unknown>[];
}
