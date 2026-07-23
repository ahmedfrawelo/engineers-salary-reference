export type SafeValue = number | string | boolean;

export type SafeFunction = (...args: SafeValue[]) => SafeValue;

export interface SafeExpressionContext {
  variables?: Record<string, SafeValue>;
  functions?: Record<string, SafeFunction>;
}

type TokenType = 'number' | 'string' | 'identifier' | 'operator' | 'paren' | 'comma' | 'eof';

type Token = {
  type: TokenType;
  value: string;
};

const twoCharOperators = new Set(['>=', '<=', '==', '!=', '&&', '||', '<>']);
const singleCharOperators = new Set(['+', '-', '*', '/', '^', '>', '<', '!', '=']);

class Lexer {
  private index = 0;

  constructor(private readonly input: string) {}

  nextToken(): Token {
    this.skipWhitespace();

    if (this.index >= this.input.length) {
      return { type: 'eof', value: '' };
    }

    const ch = this.input[this.index];

    if (this.isDigit(ch) || (ch === '.' && this.isDigit(this.peek()))) {
      return this.readNumber();
    }

    if (ch === '"') {
      return this.readString();
    }

    if (this.isAlpha(ch) || ch === '_') {
      return this.readIdentifier();
    }

    if (ch === '(' || ch === ')') {
      this.index += 1;
      return { type: 'paren', value: ch };
    }

    if (ch === ',') {
      this.index += 1;
      return { type: 'comma', value: ',' };
    }

    const twoChar = this.input.slice(this.index, this.index + 2);
    if (twoCharOperators.has(twoChar)) {
      this.index += 2;
      return { type: 'operator', value: twoChar === '<>' ? '!=' : twoChar };
    }

    if (singleCharOperators.has(ch)) {
      this.index += 1;
      return { type: 'operator', value: ch === '=' ? '==' : ch };
    }

    throw new Error(`Unexpected character "${ch}" in expression.`);
  }

  private skipWhitespace(): void {
    while (this.index < this.input.length && /\s/.test(this.input[this.index])) {
      this.index += 1;
    }
  }

  private readNumber(): Token {
    const start = this.index;
    while (this.index < this.input.length && /[0-9.]/.test(this.input[this.index])) {
      this.index += 1;
    }
    return { type: 'number', value: this.input.slice(start, this.index) };
  }

  private readString(): Token {
    this.index += 1; // Skip opening quote
    let value = '';
    while (this.index < this.input.length) {
      const ch = this.input[this.index];
      if (ch === '"') {
        this.index += 1;
        return { type: 'string', value };
      }
      if (ch === '\\') {
        const next = this.input[this.index + 1];
        if (next === '"' || next === '\\') {
          value += next;
          this.index += 2;
          continue;
        }
      }
      value += ch;
      this.index += 1;
    }
    throw new Error('Unterminated string literal in expression.');
  }

  private readIdentifier(): Token {
    const start = this.index;
    while (this.index < this.input.length && /[A-Za-z0-9_]/.test(this.input[this.index])) {
      this.index += 1;
    }
    return { type: 'identifier', value: this.input.slice(start, this.index) };
  }

  private peek(): string {
    return this.input[this.index + 1] || '';
  }

  private isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9';
  }

  private isAlpha(ch: string): boolean {
    return (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z');
  }
}

class ExpressionParser {
  private readonly variables: Record<string, SafeValue>;
  private readonly functions: Record<string, SafeFunction>;
  private current: Token;
  private previousToken: Token | null = null;

  constructor(expression: string, context: SafeExpressionContext) {
    this.lexer = new Lexer(expression);
    this.variables = this.normalizeRecord(context.variables);
    this.functions = this.normalizeRecord(context.functions);
    this.current = this.lexer.nextToken();
  }

  private readonly lexer: Lexer;

  parse(): SafeValue {
    const value = this.parseOr();
    this.expect('eof');
    return value;
  }

  private parseOr(): SafeValue {
    let left = this.parseAnd();
    while (this.matchOperator('||')) {
      const right = this.parseAnd();
      left = this.toBoolean(left) || this.toBoolean(right);
    }
    return left;
  }

  private parseAnd(): SafeValue {
    let left = this.parseEquality();
    while (this.matchOperator('&&')) {
      const right = this.parseEquality();
      left = this.toBoolean(left) && this.toBoolean(right);
    }
    return left;
  }

  private parseEquality(): SafeValue {
    let left = this.parseComparison();
    while (this.matchOperator('==') || this.matchOperator('!=')) {
      const operator = this.previous().value;
      const right = this.parseComparison();
      const result = this.equals(left, right);
      left = operator === '!=' ? !result : result;
    }
    return left;
  }

  private parseComparison(): SafeValue {
    let left = this.parseTerm();
    while (
      this.matchOperator('>') ||
      this.matchOperator('>=') ||
      this.matchOperator('<') ||
      this.matchOperator('<=')
    ) {
      const operator = this.previous().value;
      const right = this.parseTerm();
      left = this.compare(operator, left, right);
    }
    return left;
  }

  private parseTerm(): SafeValue {
    let left = this.parseFactor();
    while (this.matchOperator('+') || this.matchOperator('-')) {
      const operator = this.previous().value;
      const right = this.parseFactor();
      left =
        operator === '+'
          ? this.toNumber(left) + this.toNumber(right)
          : this.toNumber(left) - this.toNumber(right);
    }
    return left;
  }

  private parseFactor(): SafeValue {
    let left = this.parsePower();
    while (this.matchOperator('*') || this.matchOperator('/')) {
      const operator = this.previous().value;
      const right = this.parsePower();
      if (operator === '*') {
        left = this.toNumber(left) * this.toNumber(right);
      } else {
        left = this.toNumber(left) / this.toNumber(right);
      }
    }
    return left;
  }

  private parsePower(): SafeValue {
    const left = this.parseUnary();
    if (!this.matchOperator('^')) {
      return left;
    }

    const right = this.parsePower();
    return Math.pow(this.toNumber(left), this.toNumber(right));
  }

  private parseUnary(): SafeValue {
    if (this.matchOperator('!')) {
      return !this.toBoolean(this.parseUnary());
    }
    if (this.matchOperator('-')) {
      return -this.toNumber(this.parseUnary());
    }
    if (this.matchOperator('+')) {
      return this.toNumber(this.parseUnary());
    }
    return this.parsePrimary();
  }

  private parsePrimary(): SafeValue {
    if (this.matchType('number')) {
      return Number(this.previous().value);
    }
    if (this.matchType('string')) {
      return this.previous().value;
    }
    if (this.matchType('identifier')) {
      const name = this.previous().value;
      if (this.check('paren', '(')) {
        return this.parseFunctionCall(name);
      }
      return this.resolveVariable(name);
    }
    if (this.matchType('paren', '(')) {
      const value = this.parseOr();
      this.expect('paren', ')');
      return value;
    }
    throw new Error(`Unexpected token "${this.current.value}" in expression.`);
  }

  private parseFunctionCall(name: string): SafeValue {
    this.expect('paren', '(');
    const args: SafeValue[] = [];
    if (!this.check('paren', ')')) {
      do {
        args.push(this.parseOr());
      } while (this.matchType('comma'));
    }
    this.expect('paren', ')');

    const fn = this.functions[this.normalizeKey(name)];
    if (!fn) {
      throw new Error(`Unknown function "${name}".`);
    }
    return fn(...args);
  }

  private resolveVariable(name: string): SafeValue {
    const key = this.normalizeKey(name);
    if (key === 'TRUE') {
      return true;
    }
    if (key === 'FALSE') {
      return false;
    }
    if (Object.prototype.hasOwnProperty.call(this.variables, key)) {
      return this.variables[key];
    }
    throw new Error(`Unknown identifier "${name}".`);
  }

  private compare(operator: string, left: SafeValue, right: SafeValue): boolean {
    if (typeof left === 'string' || typeof right === 'string') {
      const l = String(left);
      const r = String(right);
      switch (operator) {
        case '>':
          return l > r;
        case '>=':
          return l >= r;
        case '<':
          return l < r;
        case '<=':
          return l <= r;
      }
      return false;
    }

    const lNum = this.toNumber(left);
    const rNum = this.toNumber(right);
    switch (operator) {
      case '>':
        return lNum > rNum;
      case '>=':
        return lNum >= rNum;
      case '<':
        return lNum < rNum;
      case '<=':
        return lNum <= rNum;
      default:
        return false;
    }
  }

  private equals(left: SafeValue, right: SafeValue): boolean {
    if (typeof left === 'string' || typeof right === 'string') {
      return String(left) === String(right);
    }
    return this.toNumber(left) === this.toNumber(right);
  }

  private toNumber(value: SafeValue): number {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }
    const cleaned = value.replace(/,/g, '').trim();
    const num = Number(cleaned);
    return Number.isNaN(num) ? 0 : num;
  }

  private toBoolean(value: SafeValue): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value !== 0 && !Number.isNaN(value);
    }
    return value.trim().length > 0;
  }

  private normalizeRecord<T>(record?: Record<string, T>): Record<string, T> {
    if (!record) {
      return {};
    }
    const normalized: Record<string, T> = {};
    Object.entries(record).forEach(([key, value]) => {
      normalized[this.normalizeKey(key)] = value;
    });
    return normalized;
  }

  private normalizeKey(value: string): string {
    return value.trim().toUpperCase();
  }

  private matchOperator(value: string): boolean {
    return this.matchType('operator', value);
  }

  private matchType(type: TokenType, value?: string): boolean {
    if (this.current.type !== type) {
      return false;
    }
    if (value !== undefined && this.current.value !== value) {
      return false;
    }
    this.advance();
    return true;
  }

  private check(type: TokenType, value?: string): boolean {
    if (this.current.type !== type) {
      return false;
    }
    if (value !== undefined && this.current.value !== value) {
      return false;
    }
    return true;
  }

  private expect(type: TokenType, value?: string): void {
    if (!this.matchType(type, value)) {
      throw new Error('Unexpected token in expression.');
    }
  }

  private advance(): void {
    this.previousToken = this.current;
    this.current = this.lexer.nextToken();
  }

  private previous(): Token {
    return this.previousToken ?? this.current;
  }
}

export function safeEvaluateExpression(
  expression: string,
  context: SafeExpressionContext = {}
): SafeValue {
  const parser = new ExpressionParser(expression, context);
  return parser.parse();
}
