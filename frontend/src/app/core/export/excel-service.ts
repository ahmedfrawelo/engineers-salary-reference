import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

type ExcelStyle = Record<string, unknown>;
type ExcelRow = Record<string, unknown>;
type XlsxRuntime = typeof import('xlsx-js-style');
type XlsxRuntimeModule = XlsxRuntime & {
  default?: XlsxRuntime;
};
type XlsxGlobal = {
  utils: {
    decode_range: (range: string) => { s: { c: number }; e: { c: number } };
    encode_cell: (cell: { r: number; c: number }) => string;
  };
};

/**
 * Excel Export Options
 */
export interface ExcelExportOptions {
  filename?: string;
  sheetName?: string;
  includeHeaders?: boolean;
  columnWidths?: number[];
  headerStyle?: ExcelStyle;
  cellStyle?: ExcelStyle;
  autoFilter?: boolean;
  freezePane?: { row: number; col: number };
}

/**
 * Excel Import Options
 */
export interface ExcelImportOptions {
  headerRow?: number;
  sheetIndex?: number;
  sheetName?: string;
  dateFormat?: string;
}

/**
 * Excel Import Result
 */
export interface ExcelImportResult<T = ExcelRow> {
  data: T[];
  headers: string[];
  sheetNames: string[];
  rowCount: number;
}

/**
 * Advanced Excel Service
 *
 * Import and export Excel files with advanced features
 *
 * Features:
 * - Export to XLSX with styling
 * - Import from XLSX/XLS
 * - Multiple sheets support
 * - Formula support
 * - Cell formatting
 * - Auto-filter
 * - Freeze panes
 * - Merged cells
 *
 * NOTE: Requires xlsx-js-style library
 * Install: npm install xlsx-js-style
 *
 * @example
 * ```typescript
 * // Export to Excel
 * await this.excelService.exportToExcel(data, {
 *   filename: 'suppliers.xlsx',
 *   sheetName: 'الموردين',
 *   autoFilter: true
 * });
 *
 * // Import from Excel
 * const result = await this.excelService.importFromExcel(file);
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class ExcelService {
  private async loadXlsx(): Promise<XlsxRuntime> {
    const module = (await import('xlsx-js-style')) as XlsxRuntimeModule;
    const xlsx = typeof module.read === 'function' ? module : module.default;
    if (!xlsx || typeof xlsx.read !== 'function' || !xlsx.utils) {
      throw new Error('Excel parser failed to load.');
    }
    return xlsx;
  }

  /**
   * Export data to Excel file
   */
  async exportToExcel<T extends ExcelRow = ExcelRow>(
    data: T[],
    options: ExcelExportOptions = {}
  ): Promise<void> {
    const XLSX = await this.loadXlsx();

    const {
      filename = `export_${Date.now()}.xlsx`,
      sheetName = 'Sheet1',
      includeHeaders = true,
      autoFilter = true,
      freezePane
    } = options;

    // Convert data to worksheet
    const worksheet = XLSX.utils.json_to_sheet(data, {
      header: includeHeaders ? undefined : [],
      skipHeader: !includeHeaders
    });

    // Apply column widths
    if (options.columnWidths) {
      worksheet['!cols'] = options.columnWidths.map(w => ({ wch: w }));
    } else {
      // Auto-size columns
      worksheet['!cols'] = this.calculateColumnWidths(data);
    }

    // Apply auto-filter
    if (autoFilter && data.length > 0) {
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      worksheet['!autofilter'] = { ref: XLSX.utils.encode_range(range) };
    }

    // Apply freeze pane
    if (freezePane) {
      worksheet['!freeze'] = {
        xSplit: freezePane.col,
        ySplit: freezePane.row,
        topLeftCell: XLSX.utils.encode_cell({ r: freezePane.row, c: freezePane.col })
      };
    }

    // Apply header styling
    if (includeHeaders && options.headerStyle) {
      this.applyHeaderStyle(worksheet, options.headerStyle);
    }

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Write file
    XLSX.writeFile(workbook, filename);

    if (environment.enableDebugLogs) console.log(`[ExcelService] Exported: ${filename}`);
  }

  /**
   * Export multiple sheets to Excel
   */
  async exportMultipleSheets(
    sheets: Array<{ name: string; data: ExcelRow[] }>,
    filename: string = `export_${Date.now()}.xlsx`
  ): Promise<void> {
    const XLSX = await this.loadXlsx();

    const workbook = XLSX.utils.book_new();

    for (const sheet of sheets) {
      const worksheet = XLSX.utils.json_to_sheet(sheet.data);
      worksheet['!cols'] = this.calculateColumnWidths(sheet.data);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
    }

    XLSX.writeFile(workbook, filename);

    if (environment.enableDebugLogs)
      console.log(`[ExcelService] Exported ${sheets.length} sheets: ${filename}`);
  }

  /**
   * Import Excel file
   */
  async importFromExcel<T extends ExcelRow = ExcelRow>(
    file: File,
    options: ExcelImportOptions = {}
  ): Promise<ExcelImportResult<T>> {
    const XLSX = await this.loadXlsx();

    const { headerRow = 0, sheetIndex = 0, sheetName } = options;

    // Read file
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    // Get sheet
    const sheet = sheetName
      ? workbook.Sheets[sheetName]
      : workbook.Sheets[workbook.SheetNames[sheetIndex]];

    if (!sheet) {
      throw new Error(`Sheet not found: ${sheetName || sheetIndex}`);
    }

    // Convert to JSON
    const rawData = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: null,
      blankrows: false
    });

    if (rawData.length === 0) {
      return {
        data: [],
        headers: [],
        sheetNames: workbook.SheetNames,
        rowCount: 0
      };
    }

    // Extract headers
    const headers = rawData[headerRow] as string[];

    // Extract data rows
    const dataRows = rawData.slice(headerRow + 1);

    // Convert to objects
    const data = dataRows.map(row => {
      const obj: ExcelRow = {};
      headers.forEach((header, index) => {
        obj[header] = (row as unknown[])[index];
      });
      return obj as T;
    });

    if (environment.enableDebugLogs)
      console.log(`[ExcelService] Imported ${data.length} rows from ${file.name}`);

    return {
      data,
      headers,
      sheetNames: workbook.SheetNames,
      rowCount: data.length
    };
  }

  /**
   * Read Excel file preview (first 10 rows)
   */
  async previewExcel(file: File, sheetIndex: number = 0): Promise<unknown[]> {
    const XLSX = await this.loadXlsx();

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', sheetRows: 11 });
    const sheet = workbook.Sheets[workbook.SheetNames[sheetIndex]];

    return XLSX.utils.sheet_to_json(sheet, { header: 1 });
  }

  /**
   * Get sheet names from Excel file
   */
  async getSheetNames(file: File): Promise<string[]> {
    const XLSX = await this.loadXlsx();

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', bookSheets: true });

    return workbook.SheetNames;
  }

  /**
   * Create Excel template for import
   */
  async createImportTemplate(
    columns: Array<{ name: string; example?: string }>,
    filename: string = 'import_template.xlsx'
  ): Promise<void> {
    const XLSX = await this.loadXlsx();

    // Create headers
    const headers = columns.map(col => col.name);

    // Create example row
    const exampleRow = columns.map(col => col.example || '');

    // Create worksheet
    const data = [headers, exampleRow];
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Style headers
    const headerRange = XLSX.utils.decode_range(
      'A1:' + XLSX.utils.encode_col(headers.length - 1) + '1'
    );

    for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!worksheet[cellAddress]) continue;

      worksheet[cellAddress].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '00C37A' } },
        alignment: { horizontal: 'center' }
      };
    }

    // Auto-size columns
    worksheet['!cols'] = columns.map(col => ({ wch: Math.max(col.name.length, 15) }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');

    XLSX.writeFile(workbook, filename);

    if (environment.enableDebugLogs) console.log(`[ExcelService] Created template: ${filename}`);
  }

  /**
   * Validate imported Excel data
   */
  validateImportedData<T extends ExcelRow = ExcelRow>(
    data: T[],
    rules: Record<keyof T, (value: unknown) => boolean | string>
  ): { valid: boolean; errors: Array<{ row: number; field: string; message: string }> } {
    const errors: Array<{ row: number; field: string; message: string }> = [];
    const typedRules = rules as Record<string, (value: unknown) => boolean | string>;

    data.forEach((row, index) => {
      Object.entries(typedRules).forEach(([field, validator]) => {
        const value = (row as Record<string, unknown>)[field];
        const result = validator(value);

        if (result !== true) {
          errors.push({
            row: index + 2, // +2 for header row and 0-index
            field,
            message: typeof result === 'string' ? result : 'Invalid value'
          });
        }
      });
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculate optimal column widths
   */
  private calculateColumnWidths(data: ExcelRow[]): Array<{ wch: number }> {
    if (data.length === 0) return [];

    const keys = Object.keys(data[0]);
    const widths: number[] = [];

    keys.forEach((key, colIndex) => {
      // Start with header width
      let maxWidth = key.length;

      // Check first 100 rows for max content width
      const sampleSize = Math.min(data.length, 100);
      for (let i = 0; i < sampleSize; i++) {
        const value = data[i][key];
        if (value != null) {
          const strValue = value.toString();
          maxWidth = Math.max(maxWidth, strValue.length);
        }
      }

      // Cap at 50 characters
      widths.push(Math.min(maxWidth + 2, 50));
    });

    return widths.map(w => ({ wch: w }));
  }

  /**
   * Apply header styling
   */
  private applyHeaderStyle(worksheet: Record<string, unknown>, style: ExcelStyle): void {
    const range = worksheet['!ref'];
    if (!range) return;

    const xlsx = (window as Window & { XLSX?: XlsxGlobal }).XLSX;
    if (!xlsx || typeof range !== 'string') {
      return;
    }
    const decoded = xlsx.utils.decode_range(range);

    for (let col = decoded.s.c; col <= decoded.e.c; col++) {
      const cellAddress = xlsx.utils.encode_cell({ r: 0, c: col });
      if (!worksheet[cellAddress]) continue;

      (worksheet[cellAddress] as Record<string, unknown>).s = style;
    }
  }
}
