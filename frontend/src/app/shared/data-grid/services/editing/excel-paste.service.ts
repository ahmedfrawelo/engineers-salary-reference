type LooseValue = ReturnType<typeof JSON.parse>;
/**
 * Excel Paste Service
 * Handles pasting data from Excel, Google Sheets, or any TSV/CSV source
 */

import { Injectable } from '@angular/core';
import { GridColumn } from '../../models';

@Injectable({
  providedIn: 'root'
})
export class ExcelPasteService {
  /**
   * Parse clipboard data (TSV or CSV format from Excel/Google Sheets)
   * @param clipboardData - The clipboard text data
   * @returns 2D array of values
   */
  parseExcelData(clipboardData: string): string[][] {
    if (!clipboardData) return [];

    const normalized = clipboardData.replace(/\uFEFF/g, '');

    if (clipboardData.includes('\t')) {
      return this.parseDelimited(normalized, '\t');
    }

    if (clipboardData.includes(',')) {
      return this.parseDelimited(normalized, ',');
    }

    return this.trimTrailingEmptyRows(
      normalized.split(/\r\n|\n|\r/).map(line => [line])
    );
  }

  /**
   * Parse Tab-Separated Values (TSV)
   * This is what Excel uses when copying cells
   */
  private parseTSV(data: string): string[][] {
    return this.parseDelimited(data, '\t');
  }

  /**
   * Parse Comma-Separated Values (CSV)
   * Handles quoted values properly
   */
  private parseCSV(data: string): string[][] {
    return this.parseDelimited(data, ',');
  }

  private parseDelimited(data: string, delimiter: '\t' | ','): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let insideQuotes = false;

    for (let index = 0; index < data.length; index++) {
      const char = data[index];
      const nextChar = data[index + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          cell += '"';
          index++;
        } else {
          insideQuotes = !insideQuotes;
        }
        continue;
      }

      if (char === delimiter && !insideQuotes) {
        row.push(cell);
        cell = '';
        continue;
      }

      if ((char === '\n' || char === '\r') && !insideQuotes) {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
        if (char === '\r' && nextChar === '\n') {
          index++;
        }
        continue;
      }

      cell += char;
    }

    row.push(cell);
    rows.push(row);

    return this.trimTrailingEmptyRows(rows);
  }

  private trimTrailingEmptyRows(rows: string[][]): string[][] {
    let end = rows.length;
    while (end > 0 && rows[end - 1]?.every(cell => cell === '')) {
      end--;
    }
    return rows.slice(0, end);
  }

  /**
   * Apply pasted data to grid starting from cell (startRow, startCol)
   * @param data - 2D array of pasted values
   * @param startRow - Starting row index (0-based)
   * @param startCol - Starting column index (0-based)
   * @param gridData - The grid's data array (will be modified)
   * @param columns - The grid's column definitions
   * @returns The number of rows and columns pasted
   */
  applyPastedData<T = LooseValue>(
    data: string[][],
    startRow: number,
    startCol: number,
    gridData: T[],
    columns: GridColumn<T>[]
  ): { rowsAffected: number; colsAffected: number } {
    let rowsAffected = 0;
    let colsAffected = 0;

    data.forEach((row, rowOffset) => {
      const targetRow = startRow + rowOffset;

      // Add new row if needed
      if (targetRow >= gridData.length) {
        gridData.push({} as T);
      }

      row.forEach((value, colOffset) => {
        const targetCol = startCol + colOffset;

        if (targetCol < columns.length) {
          const column = columns[targetCol];
          const field = column.field as string;

          // Convert value to appropriate type
          const convertedValue = this.convertValue(value, column);

          // Set the value
          (gridData[targetRow] as LooseValue)[field] = convertedValue;

          colsAffected = Math.max(colsAffected, colOffset + 1);
        }
      });

      rowsAffected++;
    });

    return { rowsAffected, colsAffected };
  }

  /**
   * Convert pasted value to appropriate type based on column definition
   */
  private convertValue(value: string, column: GridColumn<LooseValue>): LooseValue {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    // If column specifies a type, convert accordingly
    const cellType = column.cellType || column.type;

    switch (cellType) {
      case 'number':
        // Remove commas and convert to number
        const cleaned = value.replace(/,/g, '').trim();
        const num = parseFloat(cleaned);
        return isNaN(num) ? value : num;

      case 'boolean':
        const lower = value.toLowerCase().trim();
        if (lower === 'true' || lower === '1' || lower === 'yes') return true;
        if (lower === 'false' || lower === '0' || lower === 'no') return false;
        return value;

      case 'date':
        // Try to parse as date
        const date = new Date(value);
        return isNaN(date.getTime()) ? value : date.toISOString();

      case 'formula':
        // Keep formulas as-is if they start with =
        return value.startsWith('=') ? value : value;

      case 'text':
      default:
        return value;
    }
  }

  /**
   * Validate pasted data before applying
   * @returns Error message if validation fails, null otherwise
   */
  validatePastedData(
    data: string[][],
    startRow: number,
    startCol: number,
    gridData: LooseValue[],
    columns: GridColumn<LooseValue>[],
    maxRows?: number,
    maxCols?: number
  ): string | null {
    // Check if paste would exceed grid bounds
    const endRow = startRow + data.length - 1;
    const endCol = startCol + Math.max(...data.map(row => row.length)) - 1;

    if (maxRows && endRow >= maxRows) {
      return `Cannot paste: Would exceed maximum rows (${maxRows})`;
    }

    if (endCol >= columns.length) {
      return `Cannot paste: Would exceed available columns (${columns.length})`;
    }

    // Check if columns are editable
    const nonEditableCols: string[] = [];
    for (let colOffset = 0; colOffset < Math.max(...data.map(row => row.length)); colOffset++) {
      const targetCol = startCol + colOffset;
      if (targetCol < columns.length) {
        const column = columns[targetCol];
        if (column.editable === false) {
          nonEditableCols.push(column.header);
        }
      }
    }

    if (nonEditableCols.length > 0) {
      return `Cannot paste: The following columns are not editable: ${nonEditableCols.join(', ')}`;
    }

    return null; // Validation passed
  }

  /**
   * Get preview of paste operation
   * Shows which cells will be affected
   */
  getPastePreview(
    data: string[][],
    startRow: number,
    startCol: number
  ): { startRow: number; startCol: number; endRow: number; endCol: number; cellCount: number } {
    const rowCount = data.length;
    const colCount = Math.max(...data.map(row => row.length), 0);

    return {
      startRow,
      startCol,
      endRow: startRow + rowCount - 1,
      endCol: startCol + colCount - 1,
      cellCount: rowCount * colCount
    };
  }
}
