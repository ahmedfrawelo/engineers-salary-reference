import { describe, expect, it } from 'vitest';

import { resolveInlineSearchCommitCandidate } from './search-select.inline-commit.util';

describe('resolveInlineSearchCommitCandidate', () => {
  it('returns the exact option when the typed query fully matches an option label', () => {
    const options = ['Saudi Arabia', 'Egypt'];

    const candidate = resolveInlineSearchCommitCandidate(options, options, 'saudi arabia');

    expect(candidate).toBe('Saudi Arabia');
  });

  it('returns the unique filtered option when the query narrows the list to one result', () => {
    const options = ['Saudi Arabia', 'Egypt'];
    const filtered = ['Saudi Arabia'];

    const candidate = resolveInlineSearchCommitCandidate(options, filtered, 'saud');

    expect(candidate).toBe('Saudi Arabia');
  });

  it('supports object options through the provided display function', () => {
    const options = [
      { id: 1, name: 'Built TECH' },
      { id: 2, name: 'ENGINEERS_SALARY_REFERENCE' }
    ];
    const filtered = [options[0]];

    const candidate = resolveInlineSearchCommitCandidate(
      options,
      filtered,
      'built',
      option => option.name
    );

    expect(candidate).toEqual(options[0]);
  });

  it('returns null when the filtered list still contains multiple options', () => {
    const options = ['Saudi Arabia', 'South Africa'];

    const candidate = resolveInlineSearchCommitCandidate(options, options, 'sa');

    expect(candidate).toBeNull();
  });
});
