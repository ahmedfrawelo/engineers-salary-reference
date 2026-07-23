import { SpreadsheetImportService } from './spreadsheet-import.service';

describe('SpreadsheetImportService', () => {
  let service: SpreadsheetImportService;

  beforeEach(() => {
    service = new SpreadsheetImportService();
  });

  it('parses CSV files into headers and non-empty rows', async () => {
    const file = new File(
      [
        'Main Category,Sub Category,Tags,Tags\n' +
          'Air Handling Units,Chilled Water Air Handling Units,"fire; hvac",direct\n' +
          ',,,\n' +
          'Air Outlets,Return Diffuser,,'
      ],
      'categories.csv',
      { type: 'text/csv' }
    );

    const result = await service.parseFile(file);

    expect(result.fileName).toBe('categories.csv');
    expect(result.sheetName).toBe('CSV');
    expect(result.headers).toEqual(['Main Category', 'Sub Category', 'Tags', 'Tags 2']);
    expect(result.rowCount).toBe(2);
    expect(result.rows[0]).toEqual({
      rowNumber: 2,
      values: {
        'Main Category': 'Air Handling Units',
        'Sub Category': 'Chilled Water Air Handling Units',
        Tags: 'fire; hvac',
        'Tags 2': 'direct'
      }
    });
    expect(result.rows[1].values['Sub Category']).toBe('Return Diffuser');
  });

  it('rejects unsupported file types', async () => {
    const file = new File(['x'], 'categories.txt', { type: 'text/plain' });

    await expect(service.parseFile(file)).rejects.toThrow('Use an Excel or CSV file.');
  });
});
