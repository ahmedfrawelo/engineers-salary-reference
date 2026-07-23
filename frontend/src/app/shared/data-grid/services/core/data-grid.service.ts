import { Injectable } from '@angular/core';
import { GridColumn, SortState, FilterState, ExportPresentationMeta } from '../../models';
import {
  calculateColumnWidth,
  compareValues,
  getFilterCacheKey,
  getNestedValue,
  getSortCacheKey,
  getVisibleRange,
  matchesFilter,
  normalizeNumericValue,
  setCacheItem,
  validateCellValue
} from '../data';
import {
  arrayBufferToBase64,
  AutoTableRenderer,
  buildExportFileName,
  buildPdfHeaderContext,
  drawPdfFooter,
  drawPdfHeader,
  humanizeLabel,
  JsPdfConstructor,
  PdfDocumentLike,
  PdfPalette,
  resolveAssetUrl,
  resolveAutoTablePageNumber,
  toPdfText,
  XlsxCell,
  XlsxModuleLike
} from '../export';
import { GRID_FEEDBACK_MESSAGES, showGridAlert } from '../../utils/feedback';
import { debugGridWarn, reportGridError } from '../../utils';

/**
 * Shared data operations for the grid, including sorting, filtering,
 * exporting, aggregation, and bounded caching helpers.
 */
@Injectable()
export class DataGridService {
  private static readonly pdfFontName = 'Amiri';
  private static pdfFontCache: { normal?: string; bold?: string } | null = null;
  private static pdfFontLoad: Promise<void> | null = null;

  // ===== Performance Caching =====
  private sortCache = new Map<string, unknown[]>();
  private filterCache = new Map<string, unknown[]>();
  private readonly CACHE_SIZE_LIMIT = 50; // Prevent memory bloat

  // ===== Sorting =====

  applySorts<T>(data: T[], sorts: SortState[]): T[] {
    if (sorts.length === 0) return data;
    const cacheKey = getSortCacheKey(data, sorts);
    const cached = this.sortCache.get(cacheKey);
    if (cached) {
      return cached as T[];
    }
    const result = [...data].sort((a, b) => {
      for (const sort of sorts) {
        const aValue = getNestedValue(a, sort.field);
        const bValue = getNestedValue(b, sort.field);

        const comparison = compareValues(aValue, bValue);

        if (comparison !== 0) {
          return sort.direction === 'asc' ? comparison : -comparison;
        }
      }
      return 0;
    });
    setCacheItem(this.sortCache, cacheKey, result, this.CACHE_SIZE_LIMIT);
    return result;
  }

  // ===== Filtering =====

  applyFilters<T>(data: T[], filters: FilterState[], columns: GridColumn<T>[]): T[] {
    if (filters.length === 0) {
      return data;
    }
    const cacheKey = getFilterCacheKey(data, filters);
    const cached = this.filterCache.get(cacheKey);
    if (cached) {
      return cached as T[];
    }
    const columnFilterTypeByField = new Map<string, string>();
    columns.forEach(column => {
      columnFilterTypeByField.set(String(column.field), column.filterType || 'text');
    });

    // Separate global search filters from regular filters
    const globalSearchFilters = filters.filter(f => f.operator === 'globalSearch');
    const regularFilters = filters.filter(
      f => f.operator !== 'globalSearch' && f.operator !== 'menuSearch'
    );
    const result = data.filter(row => {
      const matchesRegularFilters =
        regularFilters.length === 0
          ? true
          : regularFilters.reduce<boolean>((acc, filter, index) => {
              const field = String(filter.field);
              const value = getNestedValue(row, field);
              const filterType = columnFilterTypeByField.get(field) || 'text';
              const currentMatch = matchesFilter(
                value,
                filter.value,
                filter.operator || 'contains',
                filterType
              );

              if (index === 0) {
                return currentMatch;
              }

              return filter.joinWithPrev === 'or' ? acc || currentMatch : acc && currentMatch;
            }, true);

      if (!matchesRegularFilters) {
        return false;
      }

      return (
        globalSearchFilters.length === 0 ||
        globalSearchFilters.some(filter => {
          const field = String(filter.field);
          const value = getNestedValue(row, field);
          const filterType = columnFilterTypeByField.get(field) || 'text';
          return matchesFilter(value, filter.value, 'contains', filterType);
        })
      );
    });

    setCacheItem(this.filterCache, cacheKey, result, this.CACHE_SIZE_LIMIT);
    return result;
  }

  // ===== Export to Excel =====

  async exportToExcel<T>(
    data: T[],
    columns: GridColumn<T>[],
    fileName: string,
    meta?: ExportPresentationMeta
  ): Promise<void> {
    try {
      // Dynamically import styled XLSX library
      const XLSX = (await import('xlsx-js-style')) as unknown as XlsxModuleLike;
      const generatedAt = meta?.generatedAt ?? new Date();
      const colCount = Math.max(columns.length, 1);
      const emptyRow = () => new Array(colCount).fill('');
      const padRow = (row: unknown[]) => {
        if (row.length === colCount) {
          return row;
        }
        if (row.length > colCount) {
          return row.slice(0, colCount);
        }
        return [...row, ...new Array(colCount - row.length).fill('')];
      };

      const appName = meta?.appName || 'ENGINEERS_SALARY_REFERENCE Portal';
      const title = meta?.title || humanizeLabel(fileName);
      const subtitle = meta?.subtitle || '';
      const leftMeta = `Generated: ${generatedAt.toLocaleString('en-US')}`;
      const rightParts = [`Rows: ${data.length}`, `Columns: ${columns.length}`];
      if (meta?.scopeLabel) {
        rightParts.push(`Scope: ${meta.scopeLabel}`);
      }
      const rightMeta = rightParts.join(' | ');

      const rows: unknown[][] = [];
      let rowIndex = 0;
      const barRow = rowIndex;
      rows.push(emptyRow());
      rows[barRow][0] = appName;
      rowIndex += 1;

      const titleRow = rowIndex;
      rows.push(emptyRow());
      rows[titleRow][0] = title;
      rowIndex += 1;

      let subtitleRow: number | null = null;
      if (subtitle) {
        subtitleRow = rowIndex;
        rows.push(emptyRow());
        rows[subtitleRow][0] = subtitle;
        rowIndex += 1;
      }

      const metaRow = rowIndex;
      rows.push(emptyRow());
      const leftMergeEnd = Math.max(0, Math.floor((colCount - 1) / 2));
      const rightMergeStart = Math.min(colCount - 1, leftMergeEnd + 1);
      rows[metaRow][0] = leftMeta;
      rows[metaRow][rightMergeStart] = rightMeta;
      rowIndex += 1;

      const dividerRow = rowIndex;
      rows.push(emptyRow());
      rowIndex += 1;

      const headerRow = rowIndex;
      const headers = padRow(columns.map(col => col.header));
      rows.push(headers);
      rowIndex += 1;

      const dataStartRow = rowIndex;
      const body = data.map(row =>
        padRow(
          columns.map(col => {
            const value = getNestedValue(row, col.field as string);

            if (col.format) {
              return col.format(value);
            }
            if (value instanceof Date) {
              return value.toLocaleDateString('en-US');
            }
            if (typeof value === 'number') {
              return value;
            }
            return value ?? '';
          })
        )
      );
      rows.push(...body);

      const worksheet = XLSX.utils.aoa_to_sheet(rows);

      const merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = [
        { s: { r: barRow, c: 0 }, e: { r: barRow, c: colCount - 1 } },
        { s: { r: titleRow, c: 0 }, e: { r: titleRow, c: colCount - 1 } }
      ];
      if (subtitleRow !== null) {
        merges.push({ s: { r: subtitleRow, c: 0 }, e: { r: subtitleRow, c: colCount - 1 } });
      }
      if (colCount > 1) {
        merges.push({ s: { r: metaRow, c: 0 }, e: { r: metaRow, c: leftMergeEnd } });
        merges.push({ s: { r: metaRow, c: rightMergeStart }, e: { r: metaRow, c: colCount - 1 } });
      }
      worksheet['!merges'] = merges;

      // Column widths based on content
      const columnWidths = columns.map(col => {
        const headerLength = col.header.length;
        const maxContentLength = Math.max(
          ...data.slice(0, 100).map(row => {
            const value = getNestedValue(row, col.field as string);
            return String(value || '').length;
          })
        );
        return { wch: Math.min(Math.max(headerLength, maxContentLength, 10), 50) };
      });
      worksheet['!cols'] = columnWidths.length ? columnWidths : [{ wch: 20 }];

      const colors = {
        brand: 'FF0C8B7F',
        text: 'FF212529',
        muted: 'FF6C757D',
        line: 'FFE2E6EA',
        zebra: 'FFF8FAFC'
      };

      const thinBorder = { style: 'thin', color: { rgb: colors.line } };
      const borderAll = {
        top: thinBorder,
        right: thinBorder,
        bottom: thinBorder,
        left: thinBorder
      };

      const setCellStyle = (r: number, c: number, style: Record<string, unknown>) => {
        const ref = XLSX.utils.encode_cell({ r, c });
        const cell = (worksheet[ref] as XlsxCell | undefined) ?? { t: 's', v: '' };
        cell.s = style;
        worksheet[ref] = cell;
      };

      const setRowStyle = (r: number, style: Record<string, unknown>) => {
        for (let c = 0; c < colCount; c += 1) {
          setCellStyle(r, c, style);
        }
      };

      const barStyle = {
        font: { bold: true, color: { rgb: 'FFFFFFFF' }, sz: 10 },
        fill: { fgColor: { rgb: colors.brand } },
        alignment: { horizontal: 'right', vertical: 'center' }
      };
      const titleStyle = {
        font: { bold: true, color: { rgb: colors.text }, sz: 16 },
        alignment: { horizontal: 'left', vertical: 'center' }
      };
      const subtitleStyle = {
        font: { color: { rgb: colors.muted }, sz: 10 },
        alignment: { horizontal: 'left', vertical: 'center' }
      };
      const metaLeftStyle = {
        font: { color: { rgb: colors.muted }, sz: 9 },
        alignment: { horizontal: 'left', vertical: 'center' }
      };
      const metaRightStyle = {
        font: { color: { rgb: colors.muted }, sz: 9 },
        alignment: { horizontal: 'right', vertical: 'center' }
      };
      const dividerStyle = {
        border: { bottom: thinBorder }
      };
      const headerStyle = {
        font: { bold: true, color: { rgb: 'FFFFFFFF' }, sz: 10 },
        fill: { fgColor: { rgb: colors.brand } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: borderAll
      };
      const dataStyle = {
        font: { color: { rgb: colors.text }, sz: 9 },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: borderAll
      };
      const zebraStyle = {
        font: { color: { rgb: colors.text }, sz: 9 },
        fill: { fgColor: { rgb: colors.zebra } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: borderAll
      };

      setRowStyle(barRow, barStyle);
      setRowStyle(titleRow, titleStyle);
      if (subtitleRow !== null) {
        setRowStyle(subtitleRow, subtitleStyle);
      }
      if (colCount === 1) {
        setCellStyle(metaRow, 0, metaLeftStyle);
      } else {
        for (let c = 0; c <= leftMergeEnd; c += 1) {
          setCellStyle(metaRow, c, metaLeftStyle);
        }
        for (let c = rightMergeStart; c < colCount; c += 1) {
          setCellStyle(metaRow, c, metaRightStyle);
        }
      }
      setRowStyle(dividerRow, dividerStyle);
      setRowStyle(headerRow, headerStyle);

      for (let r = 0; r < body.length; r += 1) {
        const rowStyle = r % 2 === 0 ? zebraStyle : dataStyle;
        setRowStyle(dataStartRow + r, rowStyle);
      }

      // Create workbook with metadata
      const workbook = XLSX.utils.book_new();
      workbook.Props = {
        Title: meta?.title || fileName,
        Subject: meta?.subtitle || 'ENGINEERS_SALARY_REFERENCE Portal Export',
        Author: meta?.appName || 'ENGINEERS_SALARY_REFERENCE Portal',
        CreatedDate: generatedAt
      };

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');

      // Save file with timestamp
      XLSX.writeFile(workbook, buildExportFileName(fileName, 'xlsx', generatedAt));
    } catch (error) {
      reportGridError('Error exporting to Excel:', error);
      showGridAlert(GRID_FEEDBACK_MESSAGES.excelExportFailed);
    }
  }

  // ===== Export to CSV =====

  exportToCSV<T>(
    data: T[],
    columns: GridColumn<T>[],
    fileName: string,
    meta?: ExportPresentationMeta
  ): void {
    try {
      const generatedAt = meta?.generatedAt ?? new Date();
      // Prepare headers
      const headers = columns.map(col => col.header).join(',');

      // Prepare rows
      const rows = data.map(row => {
        return columns
          .map(col => {
            const value = getNestedValue(row, col.field as string);
            const formatted = col.format ? col.format(value) : value;
            // Escape commas and quotes
            return `"${String(formatted).replace(/"/g, '""')}"`;
          })
          .join(',');
      });

      // Combine
      const csv = [headers, ...rows].join('\n');

      // Add BOM for Excel Arabic support
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });

      // Download
      this.downloadBlob(blob, buildExportFileName(fileName, 'csv', generatedAt));
    } catch (error) {
      reportGridError('Error exporting to CSV:', error);
      showGridAlert(GRID_FEEDBACK_MESSAGES.csvExportFailed);
    }
  }

  // ===== Export to PDF =====

  async exportToPDF<T>(
    data: T[],
    columns: GridColumn<T>[],
    fileName: string,
    meta?: ExportPresentationMeta
  ): Promise<void> {
    try {
      // Dynamically import jsPDF and autoTable
      const jsPDFModule = await import('jspdf');
      const JsPdfCtor = (jsPDFModule.default || jsPDFModule.jsPDF) as JsPdfConstructor;
      const autoTable = (await import('jspdf-autotable')).default as AutoTableRenderer;

      // Determine orientation based on number of columns
      const orientation = columns.length > 6 ? 'landscape' : 'portrait';

      // Create PDF
      const doc = new JsPdfCtor({
        orientation: orientation,
        unit: 'mm',
        format: 'a4'
      });

      const pdfFont = await this.ensurePdfFont(doc);
      const canProcessArabic = pdfFont === DataGridService.pdfFontName;
      const generatedAt = meta?.generatedAt ?? new Date();

      const palette: PdfPalette = {
        brand: [12, 139, 127],
        text: [33, 37, 41],
        muted: [108, 117, 125],
        line: [226, 230, 234],
        zebra: [248, 250, 252]
      };

      const headerContext = buildPdfHeaderContext(
        doc,
        {
          title: meta?.title || humanizeLabel(fileName),
          subtitle: meta?.subtitle,
          appName: meta?.appName || 'ENGINEERS_SALARY_REFERENCE Portal',
          footerText: meta?.footerText || 'ENGINEERS_SALARY_REFERENCE Portal - Operations Management System',
          scopeLabel: meta?.scopeLabel,
          generatedAt,
          rowCount: data.length,
          columnCount: columns.length
        },
        canProcessArabic
      );

      // Prepare table data
      const headers = [columns.map(col => toPdfText(doc, col.header, canProcessArabic))];
      const body = data.map(row =>
        columns.map(col => {
          const value = getNestedValue(row, col.field as string);

          if (col.format) {
            return toPdfText(doc, col.format(value), canProcessArabic);
          } else if (value instanceof Date) {
            return toPdfText(doc, value.toLocaleDateString('en-US'), canProcessArabic);
          } else if (typeof value === 'number') {
            return toPdfText(doc, value.toLocaleString('en-US'), canProcessArabic);
          } else {
            return toPdfText(doc, value ?? '', canProcessArabic);
          }
        })
      );

      // Generate table with autoTable
      const columnStyles: Record<number, { cellWidth: 'auto' | 'wrap'; halign: 'center' }> =
        columns.reduce<Record<number, { cellWidth: 'auto' | 'wrap'; halign: 'center' }>>(
          (acc, col, index) => {
            acc[index] = {
              cellWidth: col.type === 'number' ? 'auto' : 'wrap',
              halign: 'center'
            };
            return acc;
          },
          {}
        );

      autoTable(doc, {
        head: headers,
        body: body,
        startY: headerContext.layout.tableStartY,
        theme: 'grid',
        styles: {
          font: pdfFont,
          fontSize: orientation === 'landscape' ? 8 : 9,
          cellPadding: 2.5,
          halign: 'center',
          valign: 'middle',
          lineColor: palette.line,
          lineWidth: 0.1,
          textColor: palette.text,
          overflow: 'linebreak'
        },
        headStyles: {
          fillColor: palette.brand,
          textColor: 255,
          font: pdfFont,
          fontStyle: 'bold',
          halign: 'center',
          fontSize: orientation === 'landscape' ? 9 : 10
        },
        alternateRowStyles: {
          fillColor: palette.zebra
        },
        columnStyles,
        margin: { top: headerContext.layout.tableStartY, left: 10, right: 10, bottom: 15 },
        didDrawPage: (data: unknown) => {
          const pageNumber = resolveAutoTablePageNumber(data);
          drawPdfHeader(doc, headerContext, palette, pdfFont, canProcessArabic);
          drawPdfFooter(doc, headerContext, palette, pdfFont, canProcessArabic, pageNumber);
        }
      });

      // Save PDF with timestamp
      doc.save(buildExportFileName(fileName, 'pdf', generatedAt));
    } catch (error) {
      reportGridError('Error exporting to PDF:', error);
      showGridAlert(GRID_FEEDBACK_MESSAGES.pdfExportFailed);
    }
  }

  // ===== Utilities =====

  private async ensurePdfFont(doc: PdfDocumentLike): Promise<string> {
    try {
      await this.loadPdfFontData();
      const cache = DataGridService.pdfFontCache;
      if (!cache?.normal) {
        return 'helvetica';
      }

      doc.addFileToVFS('Amiri-Regular.ttf', cache.normal);
      doc.addFont('Amiri-Regular.ttf', DataGridService.pdfFontName, 'normal');

      if (cache.bold) {
        doc.addFileToVFS('Amiri-Bold.ttf', cache.bold);
        doc.addFont('Amiri-Bold.ttf', DataGridService.pdfFontName, 'bold');
      } else {
        doc.addFont('Amiri-Regular.ttf', DataGridService.pdfFontName, 'bold');
      }

      if (typeof doc.setLanguage === 'function') {
        doc.setLanguage('ar');
      }

      return DataGridService.pdfFontName;
    } catch (error) {
      debugGridWarn('[DataGrid] PDF font load failed, using default font.', error);
      return 'helvetica';
    }
  }

  private async loadPdfFontData(): Promise<void> {
    if (DataGridService.pdfFontCache?.normal) {
      return;
    }

    if (!DataGridService.pdfFontLoad) {
      DataGridService.pdfFontLoad = (async () => {
        const [normal, bold] = await Promise.all([
          this.fetchFontBase64('assets/fonts/Amiri-Regular.ttf'),
          this.fetchFontBase64('assets/fonts/Amiri-Bold.ttf')
        ]);
        DataGridService.pdfFontCache = { normal, bold };
      })();
    }

    await DataGridService.pdfFontLoad;
  }

  private async fetchFontBase64(path: string): Promise<string> {
    const response = await fetch(resolveAssetUrl(path));
    if (!response.ok) {
      throw new Error(`Failed to load font: ${path}`);
    }
    const buffer = await response.arrayBuffer();
    return arrayBufferToBase64(buffer);
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  // ===== Aggregation =====

  calculateAggregate<T>(
    data: T[],
    field: string,
    aggregateType: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct' | 'median' | 'percent'
  ): number {
    if (aggregateType === 'count') {
      return data.length;
    }

    if (aggregateType === 'distinct') {
      const unique = new Set<string>();
      data.forEach(row => {
        const value = getNestedValue(row, field);
        if (value === null || value === undefined || value === '') {
          return;
        }
        if (typeof value === 'object') {
          try {
            unique.add(JSON.stringify(value));
          } catch {
            unique.add(String(value));
          }
          return;
        }
        unique.add(`${typeof value}:${value}`);
      });
      return unique.size;
    }

    const numericValues = data
      .map(row => getNestedValue(row, field))
      .map(value => normalizeNumericValue(value))
      .filter((value): value is number => value !== null);

    if (!numericValues.length) {
      return Number.NaN;
    }

    switch (aggregateType) {
      case 'sum':
        return numericValues.reduce((sum, val) => sum + val, 0);

      case 'avg':
        return numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length;

      case 'min':
        return Math.min(...numericValues);

      case 'max':
        return Math.max(...numericValues);

      case 'median': {
        const sorted = [...numericValues].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 0) {
          return (sorted[mid - 1] + sorted[mid]) / 2;
        }
        return sorted[mid];
      }

      case 'percent':
        return Number.NaN;

      default:
        return Number.NaN;
    }
  }

  // ===== Virtual Scrolling Helpers =====

  getVisibleRange(
    scrollTop: number,
    containerHeight: number,
    rowHeight: number,
    totalRows: number
  ): { start: number; end: number } {
    return getVisibleRange(scrollTop, containerHeight, rowHeight, totalRows);
  }

  // ===== Column Resizing =====

  calculateColumnWidth(
    headerText: string,
    data: unknown[],
    field: string,
    minWidth = 100,
    maxWidth = 500
  ): number {
    return calculateColumnWidth(headerText, data, field, minWidth, maxWidth);
  }

  // ===== Data Validation =====

  validateCellValue(value: unknown, column: GridColumn): boolean | string {
    return validateCellValue(value, column);
  }

  // ===== Cache Management =====

  /**
   * Clear all cache buckets.
   */
  clearCache(): void {
    this.sortCache.clear();
    this.filterCache.clear();
  }

  /**
   * Return cache statistics for diagnostics.
   */
  getCacheStats(): { sortCacheSize: number; filterCacheSize: number } {
    return {
      sortCacheSize: this.sortCache.size,
      filterCacheSize: this.filterCache.size
    };
  }
}
