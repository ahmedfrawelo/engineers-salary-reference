type LooseValue = ReturnType<typeof JSON.parse>;
/**
 * Formula Engine Service
 * Parses and evaluates Excel-like formulas in DataGrid cells.
 * Supports A1 references after grid-level normalization, ranges, pricing math, and common functions.
 */

import { Injectable } from '@angular/core';
import { safeEvaluateExpression } from '../../../utils/safe-expression.util';
import { reportGridError } from '../../utils';

export interface CellReference {
  row: number;
  col: number;
}

export interface RangeReference {
  start: CellReference;
  end: CellReference;
}

@Injectable({
  providedIn: 'root'
})
export class FormulaEngineService {
  // Track cells currently being evaluated to detect circular references.
  private evaluationStack = new Set<string>();

  /**
   * Evaluate a formula and return the result
   * @param formula - The formula string (e.g., "=A1+B1")
   * @param getCellValue - Function to get value of a cell by reference
   * @param currentRow - Current row index (0-based)
   * @param currentCol - Current column index (0-based)
   */
  evaluate(
    formula: string,
    getCellValue: (row: number, col: number) => LooseValue,
    currentRow: number = 0,
    currentCol: number = 0
  ): LooseValue {
    if (!formula || typeof formula !== 'string') {
      return formula;
    }

    // If doesn't start with =, it's not a formula
    if (!formula.trim().startsWith('=')) {
      return formula;
    }

    // Detect circular references before recursively evaluating formulas.
    const cellKey = `${currentRow}:${currentCol}`;
    if (this.evaluationStack.has(cellKey)) {
      return '#CIRCULAR!';
    }

    this.evaluationStack.add(cellKey);

    try {
      // Remove the = sign
      const expression = formula.substring(1).trim();

      // Replace cell references with their values
      const resolvedExpression = this.resolveCellReferences(expression, getCellValue);

      // Evaluate the expression
      return this.evaluateExpression(resolvedExpression);
    } catch (error) {
      return '#ERROR!';
    } finally {
      // Always remove the cell from the evaluation stack, even after errors.
      this.evaluationStack.delete(cellKey);
    }
  }

  /**
   * Parse cell reference (e.g., "A1" -> {row: 0, col: 0})
   */
  parseCellReference(ref: string): CellReference | null {
    const match = ref.trim().toUpperCase().match(/^([A-Z]+)(\d+)$/);
    if (!match) return null;

    const col = this.columnLetterToIndex(match[1]);
    const row = parseInt(match[2], 10) - 1; // Convert to 0-based

    return { row, col };
  }

  /**
   * Parse range reference (e.g., "A1:A10" -> {start: {row:0, col:0}, end: {row:9, col:0}})
   */
  parseRangeReference(ref: string): RangeReference | null {
    const match = ref.trim().toUpperCase().match(/^([A-Z]+\d+):([A-Z]+\d+)$/);
    if (!match) return null;

    const start = this.parseCellReference(match[1]);
    const end = this.parseCellReference(match[2]);

    if (!start || !end) return null;

    return { start, end };
  }

  /**
   * Convert column letter to index (A=0, B=1, Z=25, AA=26, etc.)
   */
  columnLetterToIndex(letter: string): number {
    let index = 0;
    for (let i = 0; i < letter.length; i++) {
      index = index * 26 + (letter.charCodeAt(i) - 64);
    }
    return index - 1; // Convert to 0-based
  }

  /**
   * Convert column index to letter (0=A, 1=B, 25=Z, 26=AA, etc.)
   */
  columnIndexToLetter(index: number): string {
    let letter = '';
    index = index + 1; // Convert to 1-based
    while (index > 0) {
      const remainder = (index - 1) % 26;
      letter = String.fromCharCode(65 + remainder) + letter;
      index = Math.floor((index - 1) / 26);
    }
    return letter;
  }

  /**
   * Get cell reference string from row/col indices (e.g., row=0, col=0 -> "A1")
   */
  getCellReferenceString(row: number, col: number): string {
    return `${this.columnIndexToLetter(col)}${row + 1}`;
  }

  /**
   * Resolve all cell references in an expression
   */
  private resolveCellReferences(
    expression: string,
    getCellValue: (row: number, col: number) => LooseValue
  ): string {
    // Handle functions first (they may contain ranges)
    expression = this.resolveFunctions(expression, getCellValue);

    // Replace individual cell references (e.g., A1, B2, etc.)
    expression = expression.replace(/\b([A-Z]+\d+)\b/gi, match => {
      const cellRef = this.parseCellReference(match);
      if (!cellRef) return match;

      const value = getCellValue(cellRef.row, cellRef.col);
      return this.valueToString(value);
    });

    return expression;
  }

  /**
   * Resolve functions like SUM, AVERAGE, IF, etc.
   */
  private resolveFunctions(
    expression: string,
    getCellValue: (row: number, col: number) => LooseValue
  ): string {
    expression = this.replaceFunctionCalls(expression, 'SUM', args => {
      const values = this.resolveFunctionArgumentValues(args, getCellValue);
      const sum = values.reduce((acc, val) => acc + this.toNumber(val), 0);
      return sum.toString();
    });

    expression = this.replaceFunctionCalls(expression, 'AVERAGE', args => {
      const values = this.resolveFunctionArgumentValues(args, getCellValue);
      const numericValues = values.filter(value => this.isNumericValue(value));
      const sum = numericValues.reduce((acc, val) => acc + this.toNumber(val), 0);
      const avg = numericValues.length > 0 ? sum / numericValues.length : 0;
      return avg.toString();
    });

    expression = this.replaceFunctionCalls(expression, 'COUNT', args => {
      const values = this.resolveFunctionArgumentValues(args, getCellValue);
      const count = values.filter(value => this.isNumericValue(value)).length;
      return count.toString();
    });

    expression = this.replaceFunctionCalls(expression, 'MAX', args => {
      const values = this.resolveFunctionArgumentValues(args, getCellValue)
        .filter(value => this.isNumericValue(value))
        .map(v => this.toNumber(v));
      const max = values.length > 0 ? Math.max(...values) : 0;
      return max.toString();
    });

    expression = this.replaceFunctionCalls(expression, 'MIN', args => {
      const values = this.resolveFunctionArgumentValues(args, getCellValue)
        .filter(value => this.isNumericValue(value))
        .map(v => this.toNumber(v));
      const min = values.length > 0 ? Math.min(...values) : 0;
      return min.toString();
    });

    expression = this.replaceFunctionCalls(expression, 'PRODUCT', args => {
      const values = this.resolveFunctionArgumentValues(args, getCellValue)
        .filter(value => this.isNumericValue(value))
        .map(v => this.toNumber(v));
      const product = values.length ? values.reduce((acc, val) => acc * val, 1) : 0;
      return product.toString();
    });

    expression = this.replaceFunctionCalls(expression, 'ROUND', args => {
      const value = this.resolveFunctionNumberArgument(args, 0, getCellValue, 0);
      const digits = this.resolveFunctionNumberArgument(args, 1, getCellValue, 0);
      const factor = Math.pow(10, Math.trunc(digits));
      return (Math.round(value * factor) / factor).toString();
    });

    expression = this.replaceFunctionCalls(expression, 'ROUNDUP', args => {
      const value = this.resolveFunctionNumberArgument(args, 0, getCellValue, 0);
      const digits = this.resolveFunctionNumberArgument(args, 1, getCellValue, 0);
      const factor = Math.pow(10, Math.trunc(digits));
      const rounded = value >= 0 ? Math.ceil(value * factor) : Math.floor(value * factor);
      return (rounded / factor).toString();
    });

    expression = this.replaceFunctionCalls(expression, 'ROUNDDOWN', args => {
      const value = this.resolveFunctionNumberArgument(args, 0, getCellValue, 0);
      const digits = this.resolveFunctionNumberArgument(args, 1, getCellValue, 0);
      const factor = Math.pow(10, Math.trunc(digits));
      const rounded = value >= 0 ? Math.floor(value * factor) : Math.ceil(value * factor);
      return (rounded / factor).toString();
    });

    expression = this.replaceFunctionCalls(expression, 'ABS', args => {
      return Math.abs(this.resolveFunctionNumberArgument(args, 0, getCellValue, 0)).toString();
    });

    expression = this.replaceFunctionCalls(expression, 'SQRT', args => {
      const value = this.resolveFunctionNumberArgument(args, 0, getCellValue, 0);
      return value < 0 ? '#NUM!' : Math.sqrt(value).toString();
    });

    expression = this.replaceFunctionCalls(expression, 'POWER', args => {
      const base = this.resolveFunctionNumberArgument(args, 0, getCellValue, 0);
      const exponent = this.resolveFunctionNumberArgument(args, 1, getCellValue, 1);
      return Math.pow(base, exponent).toString();
    });

    expression = this.replaceFunctionCalls(expression, 'MOD', args => {
      const value = this.resolveFunctionNumberArgument(args, 0, getCellValue, 0);
      const divisor = this.resolveFunctionNumberArgument(args, 1, getCellValue, 1);
      return divisor === 0 ? '#DIV/0!' : (value % divisor).toString();
    });

    expression = this.replaceFunctionCalls(expression, 'CEILING', args => {
      const value = this.resolveFunctionNumberArgument(args, 0, getCellValue, 0);
      const significance = Math.abs(this.resolveFunctionNumberArgument(args, 1, getCellValue, 1)) || 1;
      return (Math.ceil(value / significance) * significance).toString();
    });

    expression = this.replaceFunctionCalls(expression, 'FLOOR', args => {
      const value = this.resolveFunctionNumberArgument(args, 0, getCellValue, 0);
      const significance = Math.abs(this.resolveFunctionNumberArgument(args, 1, getCellValue, 1)) || 1;
      return (Math.floor(value / significance) * significance).toString();
    });

    expression = this.replaceFunctionCalls(expression, 'AND', args => {
      const values = this.resolveFunctionArgumentValues(args, getCellValue);
      return (values.length > 0 && values.every(value => this.toBoolean(value))).toString();
    });

    expression = this.replaceFunctionCalls(expression, 'OR', args => {
      const values = this.resolveFunctionArgumentValues(args, getCellValue);
      return values.some(value => this.toBoolean(value)).toString();
    });

    expression = this.replaceFunctionCalls(expression, 'NOT', args => {
      const value = this.resolveFunctionScalarValue(
        this.splitFunctionArguments(args)[0] ?? '',
        getCellValue
      );
      return (!this.toBoolean(value)).toString();
    });

    expression = this.replaceFunctionCalls(expression, 'IF', args => {
      const segments = this.splitFunctionArguments(args);
      if (segments.length < 2) {
        return '"#ERROR!"';
      }

      const condition = this.resolveFunctionScalarValue(segments[0], getCellValue);
      const trueValue = this.resolveFunctionScalarValue(segments[1], getCellValue);
      const falseValue =
        segments.length > 2 ? this.resolveFunctionScalarValue(segments[2], getCellValue) : false;

      return this.valueToString(condition ? trueValue : falseValue);
    });

    return expression;
  }

  private replaceFunctionCalls(
    expression: string,
    functionName: string,
    resolver: (args: string) => string
  ): string {
    let result = '';
    let index = 0;

    while (index < expression.length) {
      const matchIndex = this.findFunctionCallIndex(expression, functionName, index);
      if (matchIndex < 0) {
        result += expression.slice(index);
        break;
      }

      const openParenIndex = this.findFunctionOpenParenIndex(expression, matchIndex + functionName.length);
      if (openParenIndex < 0) {
        result += expression.slice(index);
        break;
      }

      const closeParenIndex = this.findMatchingParenIndex(expression, openParenIndex);
      if (closeParenIndex < 0) {
        result += expression.slice(index);
        break;
      }

      result += expression.slice(index, matchIndex);
      result += resolver(expression.slice(openParenIndex + 1, closeParenIndex));
      index = closeParenIndex + 1;
    }

    return result;
  }

  private findFunctionCallIndex(expression: string, functionName: string, startIndex: number): number {
    const upperExpression = expression.toUpperCase();
    const upperName = functionName.toUpperCase();
    let matchIndex = upperExpression.indexOf(upperName, startIndex);

    while (matchIndex >= 0) {
      const before = matchIndex === 0 ? '' : expression[matchIndex - 1];
      const after = expression[matchIndex + functionName.length] ?? '';
      const isWordBoundaryBefore = !/[A-Za-z0-9_]/.test(before);
      const isWordBoundaryAfter = !/[A-Za-z0-9_]/.test(after);
      const openParenIndex = this.findFunctionOpenParenIndex(expression, matchIndex + functionName.length);
      if (isWordBoundaryBefore && isWordBoundaryAfter && openParenIndex >= 0) {
        return matchIndex;
      }
      matchIndex = upperExpression.indexOf(upperName, matchIndex + upperName.length);
    }

    return -1;
  }

  private findFunctionOpenParenIndex(expression: string, searchIndex: number): number {
    let index = searchIndex;
    while (index < expression.length && /\s/.test(expression[index])) {
      index += 1;
    }
    return expression[index] === '(' ? index : -1;
  }

  private findMatchingParenIndex(expression: string, openParenIndex: number): number {
    let depth = 0;
    let inString = false;

    for (let index = openParenIndex; index < expression.length; index++) {
      const char = expression[index];
      const previous = index > 0 ? expression[index - 1] : '';
      if (char === '"' && previous !== '\\') {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (char === '(') {
        depth += 1;
        continue;
      }

      if (char === ')') {
        depth -= 1;
        if (depth === 0) {
          return index;
        }
      }
    }

    return -1;
  }

  private splitFunctionArguments(args: string): string[] {
    const segments: string[] = [];
    let current = '';
    let depth = 0;
    let inString = false;

    for (let index = 0; index < args.length; index++) {
      const char = args[index];
      const previous = index > 0 ? args[index - 1] : '';

      if (char === '"' && previous !== '\\') {
        inString = !inString;
        current += char;
        continue;
      }

      if (!inString) {
        if (char === '(') {
          depth += 1;
        } else if (char === ')') {
          depth = Math.max(0, depth - 1);
        } else if (char === ',' && depth === 0) {
          segments.push(current.trim());
          current = '';
          continue;
        }
      }

      current += char;
    }

    if (current.trim()) {
      segments.push(current.trim());
    }

    return segments;
  }

  private resolveFunctionArgumentValues(
    args: string,
    getCellValue: (row: number, col: number) => LooseValue
  ): LooseValue[] {
    return this.splitFunctionArguments(args).flatMap(segment =>
      this.resolveSingleFunctionArgumentValues(segment, getCellValue)
    );
  }

  private resolveSingleFunctionArgumentValues(
    argument: string,
    getCellValue: (row: number, col: number) => LooseValue
  ): LooseValue[] {
    const trimmed = argument.trim();
    if (!trimmed) {
      return [];
    }

    const rangeValues = this.getRangeValues(trimmed, getCellValue);
    if (rangeValues.length > 0) {
      return rangeValues;
    }

    return [this.resolveFunctionScalarValue(trimmed, getCellValue)];
  }

  private resolveFunctionScalarValue(
    argument: string,
    getCellValue: (row: number, col: number) => LooseValue
  ): LooseValue {
    const trimmed = argument.trim();
    if (!trimmed) {
      return 0;
    }

    const resolvedArgument = this.resolveCellReferences(trimmed, getCellValue);
    return this.evaluateExpression(resolvedArgument);
  }

  private resolveFunctionNumberArgument(
    args: string,
    index: number,
    getCellValue: (row: number, col: number) => LooseValue,
    fallback: number
  ): number {
    const segment = this.splitFunctionArguments(args)[index];
    if (segment === undefined) {
      return fallback;
    }

    const value = this.resolveFunctionScalarValue(segment, getCellValue);
    const number = this.toNumber(value);
    return Number.isFinite(number) ? number : fallback;
  }

  /**
   * Get all values in a range (e.g., "A1:A10" or "A1:B5")
   */
  private getRangeValues(
    rangeRef: string,
    getCellValue: (row: number, col: number) => LooseValue
  ): LooseValue[] {
    const range = this.parseRangeReference(rangeRef);
    if (!range) return [];

    const values: LooseValue[] = [];

    for (let row = range.start.row; row <= range.end.row; row++) {
      for (let col = range.start.col; col <= range.end.col; col++) {
        values.push(getCellValue(row, col));
      }
    }

    return values;
  }

  /**
   * Convert value to string for evaluation
   */
  private valueToString(value: LooseValue): string {
    if (value === null || value === undefined || value === '') {
      return '0';
    }
    if (typeof value === 'string') {
      const error = this.normalizeFormulaError(value);
      if (error) {
        return error;
      }
      // If it's a string that looks like a number, return it as-is
      const num = parseFloat(value.replace(/,/g, ''));
      if (!isNaN(num)) {
        return num.toString();
      }
      // Otherwise, wrap in quotes for string comparison
      const escaped = value
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
      return `"${escaped}"`;
    }
    return String(value);
  }

  /**
   * Convert value to number (handle strings with commas)
   */
  private toNumber(value: LooseValue): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'string') {
      const cleaned = value.replace(/,/g, '').trim();
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  }

  private toBoolean(value: LooseValue): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value !== 0 && !Number.isNaN(value);
    }
    if (typeof value === 'string') {
      const trimmed = value.trim().toLowerCase();
      if (!trimmed || trimmed === 'false' || trimmed === '0') {
        return false;
      }
      return true;
    }
    return false;
  }

  private isNumericValue(value: LooseValue): boolean {
    if (typeof value === 'number') {
      return Number.isFinite(value);
    }
    if (typeof value !== 'string') {
      return false;
    }
    const cleaned = value.replace(/,/g, '').trim();
    return cleaned !== '' && Number.isFinite(Number(cleaned));
  }

  /**
   * Safely evaluate a mathematical expression
   */
  private evaluateExpression(expression: string): LooseValue {
    try {
      const normalizedExpression = this.normalizePercentLiterals(expression);
      const propagatedError = this.findFormulaError(normalizedExpression);
      if (propagatedError) {
        return propagatedError;
      }

      const result = safeEvaluateExpression(normalizedExpression);
      if (typeof result === 'number') {
        if (Number.isNaN(result)) {
          return '#NUM!';
        }
        if (!Number.isFinite(result)) {
          return '#DIV/0!';
        }
      }
      return result;
    } catch (error) {
      reportGridError('[FormulaEngine] Error evaluating expression:', expression, error);
      return '#ERROR!';
    }
  }

  private normalizePercentLiterals(expression: string): string {
    return expression.replace(/(\d+(?:\.\d+)?)\s*%/g, '($1/100)');
  }

  private findFormulaError(expression: string): string | null {
    const match = expression.match(/#(?:DIV\/0|VALUE|REF|NAME|NUM|N\/A|ERROR|CIRCULAR)!?/i);
    return match ? this.normalizeFormulaError(match[0]) : null;
  }

  private normalizeFormulaError(value: string): string | null {
    const normalized = String(value || '').trim().toUpperCase();
    if (!normalized) {
      return null;
    }

    if (normalized === '#N/A') {
      return '#N/A';
    }

    const match = normalized.match(/^#(?:DIV\/0|VALUE|REF|NAME|NUM|ERROR|CIRCULAR)!$/);
    return match ? match[0] : null;
  }

  /**
   * Check if a string is a formula
   */
  isFormula(value: LooseValue): boolean {
    return typeof value === 'string' && value.trim().startsWith('=');
  }

  /**
   * Get all cell references used in a formula
   */
  getFormulaDependencies(formula: string): CellReference[] {
    if (!this.isFormula(formula)) return [];

    const deps: CellReference[] = [];
    const expression = formula.substring(1).trim();

    // Find all cell references (A1, B2, etc.)
    const matches = expression.match(/\b([A-Z]+\d+)\b/gi);
    if (matches) {
      matches.forEach(match => {
        const ref = this.parseCellReference(match);
        if (ref) {
          deps.push(ref);
        }
      });
    }

    // Find all range references (A1:A10, etc.)
    const rangeMatches = expression.match(/\b([A-Z]+\d+):([A-Z]+\d+)\b/gi);
    if (rangeMatches) {
      rangeMatches.forEach(match => {
        const range = this.parseRangeReference(match);
        if (range) {
          for (let row = range.start.row; row <= range.end.row; row++) {
            for (let col = range.start.col; col <= range.end.col; col++) {
              deps.push({ row, col });
            }
          }
        }
      });
    }

    return deps;
  }
}
