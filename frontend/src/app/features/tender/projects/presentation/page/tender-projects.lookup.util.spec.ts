import { describe, expect, it } from 'vitest';

import type { IdName } from './tender-projects.contracts';
import {
  findTenderProjectLookupByName,
  resolveTenderProjectLookupDisplayLabel,
  resolveTenderProjectLookupDisplayLabelById,
  tenderProjectLookupMatchesLabel
} from './tender-projects.lookup.util';

describe('tender-project lookup utilities', () => {
  it('prefers customLabel when resolving display text', () => {
    const item: IdName = {
      id: 7,
      name: 'Done To Review',
      customLabel: 'Review Ready'
    };

    expect(resolveTenderProjectLookupDisplayLabel(item)).toBe('Review Ready');
  });

  it('resolves display labels by id', () => {
    const list: IdName[] = [
      { id: 3, name: 'Saudi Arabia', customLabel: 'KSA' },
      { id: 4, name: 'Egypt' }
    ];

    expect(resolveTenderProjectLookupDisplayLabelById(list, 3)).toBe('KSA');
    expect(resolveTenderProjectLookupDisplayLabelById(list, 4)).toBe('Egypt');
  });

  it('matches lookups by custom label as well as raw name', () => {
    const owner: IdName = {
      id: 11,
      name: 'United Maintenance Co.',
      customLabel: 'UNIMAC'
    };

    expect(tenderProjectLookupMatchesLabel(owner, 'UNIMAC')).toBe(true);
    expect(tenderProjectLookupMatchesLabel(owner, 'United Maintenance Co.')).toBe(true);
  });

  it('finds items using a custom label', () => {
    const list: IdName[] = [
      { id: 1, name: 'New' },
      { id: 2, name: 'Done To Review', customLabel: 'Review Ready' }
    ];

    expect(findTenderProjectLookupByName(list, 'Review Ready')?.id).toBe(2);
    expect(findTenderProjectLookupByName(list, 'Done To Review')?.id).toBe(2);
  });
});
