import { ValidationError } from '../errors';

export class EmailValueObject {
  private constructor(private readonly normalized: string) {}

  static create(raw: string): EmailValueObject {
    const value = String(raw ?? '')
      .trim()
      .toLowerCase();

    if (!value) {
      throw new ValidationError('Email is required.');
    }

    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    if (!isValid) {
      throw new ValidationError('Invalid email format.');
    }

    return new EmailValueObject(value);
  }

  static tryCreate(raw: string): EmailValueObject | null {
    try {
      return EmailValueObject.create(raw);
    } catch {
      return null;
    }
  }

  toString(): string {
    return this.normalized;
  }
}
