import { FormulaEngineService } from './formula-engine.service';

describe('FormulaEngineService', () => {
  let service: FormulaEngineService;

  const values = new Map<string, unknown>([
    ['0:0', 43],
    ['0:1', 5],
    ['0:2', null],
    ['1:0', 2],
    ['1:1', 3],
    ['2:0', ''],
    ['2:1', 7],
    ['3:0', '#DIV/0!']
  ]);

  const getCellValue = (row: number, col: number): unknown => values.get(`${row}:${col}`) ?? null;

  beforeEach(() => {
    service = new FormulaEngineService();
  });

  it('evaluates arithmetic references with normal operator precedence', () => {
    expect(service.evaluate('=A1 + B1 * 2', getCellValue)).toBe(53);
  });

  it('evaluates ranges while treating blank cells like Excel aggregate inputs', () => {
    expect(service.evaluate('=SUM(A1:A3)', getCellValue)).toBe(45);
    expect(service.evaluate('=AVERAGE(A1:A3)', getCellValue)).toBe(22.5);
    expect(service.evaluate('=COUNT(A1:A3)', getCellValue)).toBe(2);
  });

  it('supports pricing math helpers used by item breakdown formulas', () => {
    expect(service.evaluate('=ROUND(A1 * 5%, 2)', getCellValue)).toBe(2.15);
    expect(service.evaluate('=PRODUCT(A2:B2)', getCellValue)).toBe(6);
    expect(service.evaluate('=POWER(B2, 2) + A2^3', getCellValue)).toBe(17);
    expect(service.evaluate('=MOD(A1, 10)', getCellValue)).toBe(3);
  });

  it('supports rounding helpers without returning #ERROR', () => {
    expect(service.evaluate('=ROUNDUP(1.21, 1)', getCellValue)).toBe(1.3);
    expect(service.evaluate('=ROUNDDOWN(1.29, 1)', getCellValue)).toBe(1.2);
    expect(service.evaluate('=CEILING(1.21, 0.5)', getCellValue)).toBe(1.5);
    expect(service.evaluate('=FLOOR(1.79, 0.5)', getCellValue)).toBe(1.5);
  });

  it('supports conditional formulas', () => {
    expect(service.evaluate('=IF(AND(A1>40, B1=5), "OK", "NO")', getCellValue)).toBe('OK');
    expect(service.evaluate('=IF(OR(A1<10, NOT(B1=5)), "NO", "OK")', getCellValue)).toBe('OK');
  });

  it('returns spreadsheet-style errors for impossible math', () => {
    expect(service.evaluate('=1/0', getCellValue)).toBe('#DIV/0!');
    expect(service.evaluate('=MOD(A1, 0)', getCellValue)).toBe('#DIV/0!');
    expect(service.evaluate('=SQRT(-1)', getCellValue)).toBe('#NUM!');
  });

  it('propagates referenced formula errors instead of converting them to numbers', () => {
    expect(service.evaluate('=A4 + 1', getCellValue)).toBe('#DIV/0!');
  });
});
