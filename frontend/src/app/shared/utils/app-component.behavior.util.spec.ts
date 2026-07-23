import { describe, expect, it } from 'vitest';

import {
  buildAppSearchHighlightSegments,
  formatAppSearchPath,
  scoreAppSearchItem
} from './app-component.behavior.util';

describe('app-component.behavior.util', () => {
  it('prioritizes exact label matches over looser matches', () => {
    const exactMatch = {
      key: 'projects',
      label: 'Tender Projects',
      ico: 'folder2-open',
      path: 'tender/projects',
      searchTerms: ['bids']
    };
    const looseMatch = {
      key: 'reports',
      label: 'Reports',
      ico: 'file-earmark-bar-graph',
      path: 'tender/reports',
      searchTerms: ['tender projects', 'estimation']
    };

    expect(scoreAppSearchItem(exactMatch, 'tender projects')).toBeGreaterThan(
      scoreAppSearchItem(looseMatch, 'tender projects')
    );
  });

  it('builds highlight segments for matching query tokens', () => {
    expect(buildAppSearchHighlightSegments('Tender Projects', 'pro')).toEqual([
      { text: 'Tender ', matched: false },
      { text: 'Pro', matched: true },
      { text: 'jects', matched: false }
    ]);
  });

  it('formats route paths for display in the search menu', () => {
    expect(formatAppSearchPath('account/settings')).toBe('account / settings');
  });
});
