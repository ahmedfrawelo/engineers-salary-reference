import { Injectable } from '@angular/core';
import type { ReportingExportPayload } from '../models/reporting.models';

export function buildReportCsv(rows: Record<string, unknown>[]): string {
  const headers = resolveReportHeaders(rows);
  const csvRows = rows.map(row => headers.map(header => escapeReportCsvValue(row[header])).join(','));
  return [headers.join(','), ...csvRows].join('\n');
}

export function buildReportFileName(title: string, extension: string, date = new Date()): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `${slug || 'report'}-${date.toISOString().slice(0, 10)}.${extension}`;
}

@Injectable({ providedIn: 'root' })
export class ReportExportService {
  exportJson(payload: ReportingExportPayload): void {
    this.download(
      JSON.stringify(payload, null, 2),
      buildReportFileName(payload.title, 'json'),
      'application/json'
    );
  }

  exportCsv(payload: ReportingExportPayload): void {
    this.download(buildReportCsv(payload.rows), buildReportFileName(payload.title, 'csv'), 'text/csv');
  }

  printCurrentView(): void {
    window.print();
  }

  private download(content: string, filename: string, type: string): void {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}

function resolveReportHeaders(rows: Record<string, unknown>[]): string[] {
  return Array.from(
    rows.reduce((headers, row) => {
      Object.keys(row).forEach(key => headers.add(key));
      return headers;
    }, new Set<string>())
  );
}

function escapeReportCsvValue(value: unknown): string {
  const normalized = value == null ? '' : String(value);
  if (!/[",\n\r]/.test(normalized)) {
    return normalized;
  }
  return `"${normalized.replace(/"/g, '""')}"`;
}
