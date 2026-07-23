import { describe, expect, it } from 'vitest';

import {
  extractProjectApiErrorDetails,
  extractProjectApiErrorMessage
} from './tender-projects.value.util';

describe('tender project API error parsing', () => {
  it('prefers keyed validation errors and returns field issues', () => {
    const error = {
      originalError: {
        error: {
          message: 'Validation failed',
          errors: {
            ProjectName: ['Project name already exists.'],
            OwnerId: ['Owner is required.']
          }
        }
      }
    };

    expect(extractProjectApiErrorDetails(error as never)).toEqual({
      message: 'Project name already exists.',
      fieldIssues: [
        { field: 'ProjectName', message: 'Project name already exists.' },
        { field: 'OwnerId', message: 'Owner is required.' }
      ]
    });
  });

  it('falls back to array validation errors before a generic backend message', () => {
    const error = {
      originalError: {
        error: {
          message: 'Validation failed',
          errors: ['Deadline is required.']
        }
      }
    };

    expect(extractProjectApiErrorMessage(error as never)).toBe('Deadline is required.');
  });

  it('uses the backend message when no field-level details are available', () => {
    const error = {
      originalError: {
        error: {
          message: 'Unable to save project right now.'
        }
      }
    };

    expect(extractProjectApiErrorDetails(error as never)).toEqual({
      message: 'Unable to save project right now.',
      fieldIssues: []
    });
  });
});
