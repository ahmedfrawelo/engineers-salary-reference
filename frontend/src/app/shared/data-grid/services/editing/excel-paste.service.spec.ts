import { describe, expect, it } from 'vitest';

import { ExcelPasteService } from './excel-paste.service';

describe('ExcelPasteService', () => {
  const service = new ExcelPasteService();

  it('parses Excel TSV with CRLF and keeps empty cells in the middle', () => {
    expect(service.parseExcelData('Item\tUnit\tPrice\r\nFan\t\t1200\r\n')).toEqual([
      ['Item', 'Unit', 'Price'],
      ['Fan', '', '1200']
    ]);
  });

  it('parses quoted TSV cells that contain tabs and line breaks', () => {
    expect(service.parseExcelData('"Fan\tInline"\t"Line 1\r\nLine 2"\tSAR')).toEqual([
      ['Fan\tInline', 'Line 1\r\nLine 2', 'SAR']
    ]);
  });

  it('parses CSV with escaped quotes', () => {
    expect(service.parseExcelData('"Fan, Supply","Brand ""A""",950')).toEqual([
      ['Fan, Supply', 'Brand "A"', '950']
    ]);
  });
});
