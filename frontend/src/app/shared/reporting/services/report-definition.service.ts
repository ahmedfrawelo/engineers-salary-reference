import { Injectable } from '@angular/core';
import type {
  ReportingFieldDefinition,
  ReportingMetricDefinition,
  ReportingQuery,
  ReportingResolvedMetric,
  ReportingTemplateDefinition
} from '../models/reporting.models';
import { readReportingValue, runReportingQuery, summarizeReportingRows } from './reporting-engine.service';

@Injectable({ providedIn: 'root' })
export class ReportDefinitionService {
  searchableFields(definition: ReportingTemplateDefinition): string[] {
    return getSearchableReportingFields(definition);
  }

  exportRows<T extends object>(
    rows: readonly T[],
    definition: ReportingTemplateDefinition
  ): Record<string, unknown>[] {
    return buildReportingExportRows(rows, definition);
  }

  resolveMetrics<T extends object>(
    rows: readonly T[],
    definition: ReportingTemplateDefinition
  ): ReportingResolvedMetric[] {
    return resolveReportingMetrics(rows, definition);
  }

  queryForDefinition(definition: ReportingTemplateDefinition, query: ReportingQuery): ReportingQuery {
    return {
      ...query,
      search: query.search ?? {
        term: '',
        fields: getSearchableReportingFields(definition)
      },
      sort: query.sort ?? definition.defaultSort
    };
  }
}

export function getSearchableReportingFields(definition: ReportingTemplateDefinition): string[] {
  return definition.fields.filter(field => field.searchable).map(field => field.key);
}

export function buildReportingExportRows<T extends object>(
  rows: readonly T[],
  definition: ReportingTemplateDefinition
): Record<string, unknown>[] {
  const fields = definition.fields.filter(field => field.exportable !== false);
  return rows.map(row =>
    fields.reduce<Record<string, unknown>>((record, field) => {
      record[field.label] = readReportingValue(row, field.key);
      return record;
    }, {})
  );
}

export function resolveReportingMetrics<T extends object>(
  rows: readonly T[],
  definition: ReportingTemplateDefinition
): ReportingResolvedMetric[] {
  return (definition.metrics ?? []).map(metric => {
    const rawValue = resolveMetricValue(rows, metric);
    return {
      key: metric.key,
      label: metric.label,
      value: formatMetricValue(rawValue, metric),
      rawValue,
      note: metric.note,
      tone: metric.tone ?? 'neutral'
    };
  });
}

function resolveMetricValue<T extends object>(
  rows: readonly T[],
  metric: ReportingMetricDefinition
): number {
  if (metric.aggregation === 'count') {
    return rows.length;
  }

  if (metric.aggregation === 'countWhere') {
    return runReportingQuery(rows, { filters: metric.where ?? [] }).filteredRows;
  }

  if (!metric.field) {
    return 0;
  }

  const summary = summarizeReportingRows(rows, {
    sumFields: metric.aggregation === 'sum' || metric.aggregation === 'average' ? [metric.field] : [],
    averageFields: metric.aggregation === 'average' ? [metric.field] : []
  });

  if (metric.aggregation === 'average') {
    return summary.averages[metric.field] ?? 0;
  }

  return summary.sums[metric.field] ?? 0;
}

function formatMetricValue(value: number, metric: ReportingMetricDefinition): string {
  switch (metric.format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
      }).format(value);
    case 'percent':
      return `${Math.round(value)}%`;
    default:
      return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
  }
}
