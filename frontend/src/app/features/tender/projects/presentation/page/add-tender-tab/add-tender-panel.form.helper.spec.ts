import { describe, expect, it } from 'vitest';

import {
  extractLookupErrorMessage,
  resolveTenderCurrency,
  sanitizeSelectText
} from './add-tender-panel.form.helper';

describe('extractLookupErrorMessage', () => {
  it('prefers array validation errors over a generic backend message', () => {
    const err = {
      originalError: {
        error: {
          message: 'Validation failed',
          errors: ['Owner name is required.']
        }
      }
    };

    expect(extractLookupErrorMessage(err as never)).toBe('Owner name is required.');
  });

  it('prefers keyed validation errors over a generic backend message', () => {
    const err = {
      originalError: {
        error: {
          message: 'Validation failed',
          errors: {
            Name: ['Owner name is required.']
          }
        }
      }
    };

    expect(extractLookupErrorMessage(err as never)).toBe('Owner name is required.');
  });
});

describe('resolveTenderCurrency', () => {
  it('resolves a known country without throwing even when region introspection is unavailable', () => {
    expect(() => resolveTenderCurrency('Saudi Arabia')).not.toThrow();
    expect(resolveTenderCurrency('Saudi Arabia').code).toBe('SAR');
  });
});

describe('sanitizeSelectText', () => {
  it('keeps real lookup values that match old label-like words', () => {
    expect(sanitizeSelectText('Owner')).toBe('Owner');
    expect(sanitizeSelectText('Status')).toBe('Status');
  });

  it('still clears explicit select placeholders', () => {
    expect(sanitizeSelectText('Select owner type')).toBe('');
    expect(sanitizeSelectText('Choose status')).toBe('');
  });
});
