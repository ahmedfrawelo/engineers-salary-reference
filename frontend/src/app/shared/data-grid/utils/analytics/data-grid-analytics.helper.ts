type LooseValue = ReturnType<typeof JSON.parse>;
type HelperContext = Record<string, LooseValue>;

function isAppendRow(row: LooseValue): boolean {
  return !!row && typeof row === 'object' && Boolean((row as Record<string, unknown>).__appendRow);
}

function collectNumericColumns(ctx: HelperContext, limit?: number) {
  const descriptors: Array<{ column: LooseValue; field: string; stats?: LooseValue }> = [];

  for (const column of ctx.visibleColumns()) {
    if (!ctx.isNumericColumn(column)) {
      continue;
    }

    const field = ctx.getColumnField(column);
    descriptors.push({
      column,
      field,
      stats: ctx.getColumnStats ? ctx.getColumnStats(field) : undefined
    });

    if (typeof limit === 'number' && descriptors.length >= limit) {
      break;
    }
  }

  return descriptors;
}

export function getSelectionInsightsHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const selected = ctx.selectedRows();
  if (selected.length === 0) {
    return null;
  }

  const numericColumns = collectNumericColumns(ctx);
  const accumulators: Array<{
    column: LooseValue;
    field: string;
    sum: number;
    min: number;
    max: number;
    count: number;
  }> = [];
  for (const { column, field } of numericColumns) {
    accumulators.push({
      column,
      field,
      sum: 0,
      min: Number.POSITIVE_INFINITY,
      max: Number.NEGATIVE_INFINITY,
      count: 0
    });
  }

  for (const row of selected) {
    if (isAppendRow(row)) {
      continue;
    }

    for (const metric of accumulators) {
      const value = ctx.normalizeNumericValue(ctx.getRowFieldValue(row, metric.field));
      if (value === null) {
        continue;
      }

      metric.sum += value;
      metric.count += 1;
      if (value < metric.min) {
        metric.min = value;
      }
      if (value > metric.max) {
        metric.max = value;
      }
    }
  }

  const metrics: LooseValue[] = [];
  for (const metric of accumulators) {
    if (metric.count <= 0) {
      continue;
    }
    metrics.push({
      header: metric.column.header,
      field: metric.field,
      sum: metric.sum,
      min: metric.min,
      max: metric.max,
      avg: metric.sum / metric.count,
      count: metric.count
    });
  }

  const totalRecords = ctx.paginationState().totalRecords || ctx.dataSignal().length;
  const percentage = totalRecords ? Math.round((selected.length / totalRecords) * 1000) / 10 : 0;

  return {
    count: selected.length,
    percentage,
    metrics
  };
}

export function getColumnInsightsHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const field = ctx.insightColumnField();
  if (!field) {
    return null;
  }

  const column = ctx.visibleColumns().find((col: LooseValue) => ctx.getColumnField(col) === field);
  if (!column) {
    return null;
  }

  let totalValues = 0;
  let numericCount = 0;
  let numericSum = 0;
  let numericMin = Number.POSITIVE_INFINITY;
  let numericMax = Number.NEGATIVE_INFINITY;
  const frequencyMap = new Map<string, number>();

  const rows = ctx.processedData();
  for (const row of rows) {
    if (isAppendRow(row)) {
      continue;
    }

    const value = ctx.getRowFieldValue(row, field);
    if (value === undefined || value === null) {
      continue;
    }

    totalValues += 1;

    const textValue = String(value);
    frequencyMap.set(textValue, (frequencyMap.get(textValue) ?? 0) + 1);

    const numericValue = ctx.normalizeNumericValue(value);
    if (numericValue === null) {
      continue;
    }

    numericCount += 1;
    numericSum += numericValue;
    if (numericValue < numericMin) {
      numericMin = numericValue;
    }
    if (numericValue > numericMax) {
      numericMax = numericValue;
    }
  }

  if (!totalValues) {
    return null;
  }

  const topValues = Array.from(frequencyMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([label, count]) => ({
      label,
      count,
      percentage: Math.round((count / totalValues) * 100)
    }));

  const numericStats = numericCount
    ? {
        min: numericMin,
        max: numericMax,
        avg: numericSum / numericCount,
        sum: numericSum
      }
    : null;

  return {
    field,
    header: column.header,
    type: column.type,
    totalValues,
    distinctValues: frequencyMap.size,
    numericStats,
    topValues
  };
}

export function getAnomalySummaryHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  if (!ctx.showAnomalyAlerts()) {
    return { rows: 0, cells: 0 };
  }

  const data = ctx.getFilteredSortedData();
  const numericColumns = collectNumericColumns(ctx);
  if (!numericColumns.length || !data.length) {
    return { rows: 0, cells: 0 };
  }

  const anomalyRows = new Set<number>();
  let cells = 0;

  for (let rowIndex = 0; rowIndex < data.length; rowIndex += 1) {
    const row = data[rowIndex];
    if (isAppendRow(row)) {
      continue;
    }

    for (const { field, stats } of numericColumns) {
      if (!stats) {
        continue;
      }

      const value = ctx.normalizeNumericValue(ctx.getRowFieldValue(row, field));
      if (ctx.isValueAnomaly(value, stats)) {
        anomalyRows.add(rowIndex);
        cells += 1;
      }
    }
  }

  return { rows: anomalyRows.size, cells };
}

export function getHeadlineMetricsHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  return {
    totalRows: ctx.paginationState().totalRecords || ctx.dataSignal().length,
    filters: ctx.filterStates().length,
    selection: ctx.selectedRows().length,
    snapshots: ctx.savedSnapshots().length,
    anomalies: ctx.anomalySummary().rows
  };
}

export function getDataQualitySummaryHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const sourceRows = ctx.processedData();
  const rows: LooseValue[] = [];
  for (const row of sourceRows) {
    if (!isAppendRow(row)) {
      rows.push(row);
    }
  }
  const columns = ctx.visibleColumns();

  if (rows.length === 0 || columns.length === 0) {
    return {
      score: 100,
      emptyPercent: 0,
      duplicateRows: 0,
      zeroPercent: 0,
      issues: []
    };
  }

  const columnFields: Array<{ field: string }> = [];
  for (const column of columns) {
    columnFields.push({ field: ctx.getColumnField(column) });
  }
  const totalCells = rows.length * columnFields.length;
  let emptyCells = 0;
  let zeroCells = 0;
  const duplicateMap = new Map<string, number>();

  for (const row of rows) {
    const keyParts: string[] = [];

    for (const { field } of columnFields) {
      const value = ctx.getRowFieldValue(row, field);
      keyParts.push(String(value ?? ''));

      if (value === null || value === undefined || value === '') {
        emptyCells += 1;
      }

      const numeric = ctx.normalizeNumericValue(value);
      if (numeric === 0) {
        zeroCells += 1;
      }
    }

    const key = keyParts.join('|');
    duplicateMap.set(key, (duplicateMap.get(key) ?? 0) + 1);
  }

  let duplicateRows = 0;
  for (const count of duplicateMap.values()) {
    if (count > 1) {
      duplicateRows += count - 1;
    }
  }

  const emptyPercent = Math.round((emptyCells / totalCells) * 1000) / 10;
  const zeroPercent = Math.round((zeroCells / totalCells) * 1000) / 10;
  const duplicatePercent = Math.round((duplicateRows / rows.length) * 1000) / 10;

  let score = 100 - emptyPercent * 0.4 - duplicatePercent * 0.4 - zeroPercent * 0.2;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const issues: Array<{
    label: string;
    detail: string;
    severity: 'high' | 'medium' | 'low';
  }> = [];
  if (emptyPercent > 10) {
    issues.push({
      label: 'Missing data',
      detail: `${emptyPercent}% of cells empty`,
      severity: emptyPercent > 25 ? 'high' : 'medium'
    });
  }
  if (duplicateRows > 0) {
    issues.push({
      label: 'Duplicate rows',
      detail: `${duplicateRows} duplicates detected`,
      severity: duplicateRows > rows.length * 0.1 ? 'high' : 'medium'
    });
  }
  if (zeroPercent > 15) {
    issues.push({
      label: 'Zero values',
      detail: `${zeroPercent}% zero entries`,
      severity: 'low'
    });
  }

  return {
    score,
    emptyPercent,
    zeroPercent,
    duplicateRows,
    issues
  };
}

export function getKpiTickerHelper(ctx: HelperContext, ...args: LooseValue[]): LooseValue {
  const numericColumns = collectNumericColumns(ctx, 3);
  const rows = ctx.processedData();
  if (!numericColumns.length || !rows.length) {
    return [];
  }

  const accumulators: Array<{
    header: string;
    field: string;
    min: number;
    max: number;
    sum: number;
    count: number;
  }> = [];
  for (const { column, field } of numericColumns) {
    accumulators.push({
      header: column.header,
      field,
      min: Number.POSITIVE_INFINITY,
      max: Number.NEGATIVE_INFINITY,
      sum: 0,
      count: 0
    });
  }

  for (const row of rows) {
    if (isAppendRow(row)) {
      continue;
    }

    for (const metric of accumulators) {
      const value = ctx.normalizeNumericValue(ctx.getRowFieldValue(row, metric.field));
      if (value === null) {
        continue;
      }

      metric.sum += value;
      metric.count += 1;
      if (value < metric.min) {
        metric.min = value;
      }
      if (value > metric.max) {
        metric.max = value;
      }
    }
  }

  const ticker: LooseValue[] = [];
  for (const metric of accumulators) {
    if (!metric.count) {
      ticker.push({ header: metric.header, min: null, max: null, avg: null });
      continue;
    }

    ticker.push({
      header: metric.header,
      min: metric.min,
      max: metric.max,
      avg: metric.sum / metric.count
    });
  }
  return ticker;
}
