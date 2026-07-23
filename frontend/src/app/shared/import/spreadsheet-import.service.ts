import { Injectable } from '@angular/core';

export type SpreadsheetImportRow = {
  rowNumber: number;
  values: Record<string, string>;
};

export type SpreadsheetImportResult = {
  fileName: string;
  sheetName: string;
  headers: string[];
  rows: SpreadsheetImportRow[];
  rowCount: number;
};

export type SpreadsheetMatrixResult = {
  fileName: string;
  sheetName: string;
  sheetNames: string[];
  isExcel: boolean;
  format: string;
  matrix: unknown[][];
};

export type SpreadsheetPreviewResult = {
  headers: string[];
  rows: SpreadsheetImportRow[];
  rowCount: number;
  headerRowUi: number;
  headerRowOptionCount: number;
};

type SheetMatrix = unknown[][];
type SheetJsLike = {
  read: (
    data: ArrayBuffer,
    options: { type: 'array'; bookSheets?: boolean; sheets?: string | string[] }
  ) => {
    SheetNames: string[];
    Sheets: Record<string, unknown>;
  };
  utils: {
    sheet_to_json: (sheet: unknown, options: { header: 1; defval: '' }) => SheetMatrix;
  };
};

const EXCEL_FILE_PATTERN = /\.(xls|xlsx|xlsm|xlsb|xltx|xltm)$/i;
const CSV_FILE_PATTERN = /\.csv$/i;
export const SPREADSHEET_IMPORT_EXTENSIONS = [
  '.csv',
  '.xls',
  '.xlsx',
  '.xlsm',
  '.xlsb',
  '.xltx',
  '.xltm'
] as const;
let sheetJsLoader: Promise<SheetJsLike> | null = null;

@Injectable({ providedIn: 'root' })
export class SpreadsheetImportService {
  readonly acceptedFileTypes = SPREADSHEET_IMPORT_EXTENSIONS.join(',');

  async parseFile(file: File): Promise<SpreadsheetImportResult> {
    const matrixResult = await this.readMatrix(file);
    const preview = this.previewMatrix(matrixResult.matrix, 1);
    return {
      fileName: matrixResult.fileName,
      sheetName: matrixResult.sheetName,
      headers: preview.headers,
      rows: preview.rows,
      rowCount: preview.rowCount
    };
  }

  async readMatrix(file: File, sheetName?: string | null): Promise<SpreadsheetMatrixResult> {
    const fileName = file.name || 'import';
    if (EXCEL_FILE_PATTERN.test(fileName)) {
      const sheetJs = await this.loadSheetJs();
      const workbook = sheetJs.read(await file.arrayBuffer(), { type: 'array' });
      const sheetNames = workbook.SheetNames ?? [];
      const selectedSheetName = sheetName && sheetNames.includes(sheetName) ? sheetName : sheetNames[0];
      const sheet = selectedSheetName ? workbook.Sheets[selectedSheetName] : null;
      if (!selectedSheetName || !sheet) {
        throw new Error('No sheet was found in this file.');
      }

      return {
        fileName,
        sheetName: selectedSheetName,
        sheetNames,
        isExcel: true,
        format: this.getFileExtension(fileName),
        matrix: sheetJs.utils.sheet_to_json(sheet, { header: 1, defval: '' })
      };
    }
    if (CSV_FILE_PATTERN.test(fileName)) {
      return {
        fileName,
        sheetName: 'CSV',
        sheetNames: [],
        isExcel: false,
        format: 'CSV',
        matrix: this.parseCsvText(await file.text())
      };
    }
    throw new Error('Use an Excel or CSV file.');
  }

  previewMatrix(
    matrix: SheetMatrix,
    headerRowUi = 1,
    rowLimit = Number.POSITIVE_INFINITY
  ): SpreadsheetPreviewResult {
    if (!matrix.some(row => row.some(cell => String(cell ?? '').trim().length > 0))) {
      throw new Error('No readable rows were found in this file.');
    }

    const clampedHeaderRowIndex = Math.max(
      0,
      Math.min((Number(headerRowUi) || 1) - 1, Math.max(matrix.length - 1, 0))
    );
    const headers = matrix[clampedHeaderRowIndex]
      .map((cell, index) => String(cell ?? '').trim() || `Column ${index + 1}`)
      .map((header, index, source) => this.uniqueHeader(header, index, source));
    const rows: SpreadsheetImportRow[] = [];
    let rowCount = 0;
    matrix.slice(clampedHeaderRowIndex + 1).forEach((row, index) => {
      const importRow = this.toImportRow(row, headers, clampedHeaderRowIndex + index + 2);
      if (!Object.values(importRow.values).some(value => value.trim().length > 0)) {
        return;
      }
      rowCount++;
      if (rows.length < rowLimit) {
        rows.push(importRow);
      }
    });

    return {
      headers,
      rows,
      rowCount,
      headerRowUi: clampedHeaderRowIndex + 1,
      headerRowOptionCount: Math.min(matrix.length, 80)
    };
  }

  private toImportRow(row: unknown[], headers: string[], rowNumber: number): SpreadsheetImportRow {
    const values: Record<string, string> = {};
    headers.forEach((header, index) => {
      values[header] = String(row[index] ?? '').trim();
    });
    return { rowNumber, values };
  }

  private uniqueHeader(header: string, index: number, source: string[]): string {
    const previousCount = source
      .slice(0, index)
      .filter(candidate => candidate.trim().toLowerCase() === header.trim().toLowerCase()).length;
    return previousCount > 0 ? `${header} ${previousCount + 1}` : header;
  }

  private parseCsvText(text: string): SheetMatrix {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;

    for (let index = 0; index < text.length; index++) {
      const char = text[index];
      const next = text[index + 1];
      if (char === '"' && quoted && next === '"') {
        cell += '"';
        index++;
        continue;
      }
      if (char === '"') {
        quoted = !quoted;
        continue;
      }
      if (char === ',' && !quoted) {
        row.push(cell);
        cell = '';
        continue;
      }
      if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && next === '\n') {
          index++;
        }
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
        continue;
      }
      cell += char;
    }

    row.push(cell);
    rows.push(row);
    return rows;
  }

  private getFileExtension(fileName: string): string {
    const dotIndex = fileName.lastIndexOf('.');
    return dotIndex >= 0 && dotIndex < fileName.length - 1
      ? fileName.slice(dotIndex + 1).toUpperCase()
      : 'File';
  }

  private async loadSheetJs(): Promise<SheetJsLike> {
    sheetJsLoader ??= import('xlsx-js-style').then(module => {
      const loaded = (module.default ?? module) as SheetJsLike;
      if (!loaded?.read || !loaded?.utils?.sheet_to_json) {
        throw new Error('Excel parser is not available.');
      }
      return loaded;
    });
    return sheetJsLoader;
  }
}
