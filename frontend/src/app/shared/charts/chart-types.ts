export type ChartDatum = {
  label: string;
  value: number;
  color?: string;
  meta?: Record<string, unknown>;
};

export type TreemapDatum = {
  label: string;
  value: number;
  color?: string;
  meta?: Record<string, unknown>;
};

export type ParetoDatum = {
  label: string;
  value: number;
  color?: string;
  meta?: Record<string, unknown>;
};

export type BoxplotDatum = {
  label: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  meta?: Record<string, unknown>;
};

export type LineSeries = {
  label: string;
  values: number[];
  color?: string;
  area?: boolean;
};

export type ScatterDatum = {
  x: number;
  y: number;
  size?: number;
  label?: string;
  color?: string;
  meta?: Record<string, unknown>;
};

export type HeatmapDatum = {
  x: string;
  y: string;
  value: number;
  color?: string;
  meta?: Record<string, unknown>;
};

export type RadarSeries = {
  label: string;
  values: number[];
  color?: string;
};

export type GaugeDatum = {
  label?: string;
  value: number;
  min?: number;
  max?: number;
  target?: number;
};

export type FunnelDatum = {
  label: string;
  value: number;
  color?: string;
};

export type WaterfallDatum = {
  label: string;
  value: number;
  color?: string;
};

export type StackedSeries = {
  label: string;
  values: number[];
  color?: string;
};

export type CandlestickDatum = {
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  color?: string;
};

export type OhlcDatum = {
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  color?: string;
};

export type RangeBarDatum = {
  label: string;
  min: number;
  max: number;
  color?: string;
};

export type BulletDatum = {
  label: string;
  value: number;
  target?: number;
  max?: number;
  color?: string;
};

export type LollipopDatum = {
  label: string;
  value: number;
  color?: string;
};

export type CalendarDatum = {
  date: string | Date;
  value: number;
};

export type RadialDatum = {
  label?: string;
  value: number;
  max?: number;
  color?: string;
};

export type GanttDatum = {
  label: string;
  start: string | Date;
  end: string | Date;
  color?: string;
};

export type SlopeDatum = {
  label: string;
  start: number;
  end: number;
  color?: string;
};

export type SankeyNode = {
  id: string;
  label: string;
  value?: number;
  color?: string;
};

export type SankeyLink = {
  source: string;
  target: string;
  value: number;
  color?: string;
};

export type ChordNode = {
  id: string;
  label: string;
  value?: number;
  color?: string;
};

export type ChordLink = {
  source: string;
  target: string;
  value: number;
  color?: string;
};

export type SunburstDatum = {
  label: string;
  value: number;
  color?: string;
};

export type NetworkNode = {
  id: string;
  label: string;
  group?: string;
  value?: number;
  color?: string;
};

export type NetworkLink = {
  source: string;
  target: string;
  value?: number;
  color?: string;
};

export type ViolinDatum = {
  label: string;
  values: number[];
  color?: string;
};

export type ParallelSeries = {
  label: string;
  values: number[];
  color?: string;
};

export type PolarAreaDatum = {
  label: string;
  value: number;
  color?: string;
};

export type DumbbellDatum = {
  label: string;
  start: number;
  end: number;
  color?: string;
};

export type RidgelineDatum = {
  label: string;
  values: number[];
  color?: string;
};

export type AreaRangeDatum = {
  label: string;
  min: number;
  max: number;
  color?: string;
};

export type PyramidDatum = {
  label: string;
  left: number;
  right: number;
  color?: string;
};

export type WordCloudDatum = {
  label: string;
  value: number;
  color?: string;
};

export type WaffleDatum = {
  label: string;
  value: number;
  color?: string;
};

export type MekkoSegment = {
  label: string;
  value: number;
  color?: string;
};

export type MekkoDatum = {
  label: string;
  total: number;
  segments: MekkoSegment[];
};

export type VennSet = {
  id: string;
  label: string;
  value: number;
  color?: string;
};

export type VennIntersection = {
  sets: string[];
  value: number;
};

export type UpsetDatum = {
  sets: string[];
  value: number;
};

export type TernaryDatum = {
  a: number;
  b: number;
  c: number;
  label?: string;
  color?: string;
};

export type TreeNode = {
  id: string;
  label: string;
  value?: number;
  children?: TreeNode[];
};

export type TimelineItem = {
  label: string;
  start: string | Date;
  end: string | Date;
  color?: string;
};

export type TimelineLane = {
  label: string;
  items: TimelineItem[];
};

export type TileMapDatum = {
  label: string;
  value: number;
  color?: string;
  row?: number;
  col?: number;
};
