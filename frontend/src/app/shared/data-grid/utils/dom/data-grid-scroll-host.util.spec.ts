import { describe, expect, it } from 'vitest';
import { resolveDataGridMainScrollHost } from './data-grid-scroll-host.util';

describe('data-grid-scroll-host.util', () => {
  it('returns null for nullish roots', () => {
    expect(resolveDataGridMainScrollHost(null)).toBeNull();
    expect(resolveDataGridMainScrollHost(undefined)).toBeNull();
  });

  it('resolves the main scroll host from a container', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <engineers-salary-reference-data-grid>
        <div data-grid-scroll-host="main"></div>
      </engineers-salary-reference-data-grid>
    `;

    const scrollHost = resolveDataGridMainScrollHost(root);

    expect(scrollHost).toBeInstanceOf(HTMLElement);
    expect(scrollHost?.getAttribute('data-grid-scroll-host')).toBe('main');
  });

  it('returns the element itself when it is already the main scroll host', () => {
    const scrollHost = document.createElement('div');
    scrollHost.setAttribute('data-grid-scroll-host', 'main');

    expect(resolveDataGridMainScrollHost(scrollHost)).toBe(scrollHost);
  });
});
