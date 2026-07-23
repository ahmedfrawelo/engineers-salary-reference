import { describe, expect, it, vi } from 'vitest';
import {
  applyFilterMenuSearchHelper,
  buildFilterMenuOptionsHelper
} from './data-grid.component.runtime-filter-menu';

describe('data-grid filter menu runtime', () => {
  it('passes the current option search term to remote filter option loaders', async () => {
    const loader = vi.fn().mockReturnValue([{ label: 'Alpha', value: 'Alpha' }]);
    const ctx = {
      filterStates: () => [],
      getFilterOptionKey: (value: unknown) => String(value),
      getFilterOptionLabel: (_column: unknown, value: unknown) => String(value),
      getFilteredDataExcludingField: () => [],
      cdr: { detectChanges: vi.fn() },
      filterOptionsRequestToken: 0,
      filterOptionsLoading: false,
      filterOptions: [],
      filterPlaceholder: '',
      filterMenuSearchTerm: 'alp',
      activeFilterColumn: null
    };
    const column = { field: 'owner', header: 'Owner', filterOptionsLoader: loader };

    await buildFilterMenuOptionsHelper(ctx, column);

    expect(loader).toHaveBeenCalledWith({ field: 'owner', optionSearch: 'alp' });
    expect(ctx.filterOptions).toEqual([{ label: 'Alpha', value: 'Alpha', checked: true }]);
  });

  it('reloads remote filter options when the menu search term changes', () => {
    const loader = vi.fn().mockReturnValue([{ label: 'Beta', value: 'Beta' }]);
    const ctx = {
      filterStates: () => [],
      getFilterOptionKey: (value: unknown) => String(value),
      getFilterOptionLabel: (_column: unknown, value: unknown) => String(value),
      getFilteredDataExcludingField: () => [],
      cdr: { detectChanges: vi.fn() },
      filterOptionsRequestToken: 0,
      filterOptionsLoading: false,
      filterOptions: [],
      filterPlaceholder: '',
      filterMenuSearchTerm: '',
      activeFilterColumn: null
    };
    const column = { field: 'owner', header: 'Owner', filterOptionsLoader: loader };

    applyFilterMenuSearchHelper(ctx, column, 'beta');

    expect(ctx.filterMenuSearchTerm).toBe('beta');
    expect(loader).toHaveBeenCalledWith({ field: 'owner', optionSearch: 'beta' });
  });
});
