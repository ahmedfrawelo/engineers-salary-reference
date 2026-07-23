import { describe, expect, it } from 'vitest';

import { isDefaultGridContext, isDefaultGridHost } from './data-grid-layout-host.util';

describe('data-grid-layout-host.util', () => {
  function createHost(attributes: Record<string, string | null> = {}): HTMLElement {
    return {
      getAttribute(name: string) {
        return attributes[name] ?? null;
      }
    } as HTMLElement;
  }

  it('detects default-grid hosts from DOM attrs', () => {
    const host = createHost({
      'data-grid-layout-preset': 'default'
    });

    expect(isDefaultGridHost(host)).toBe(true);
  });

  it('detects default-grid context from host or config', () => {
    const host = createHost({
      'data-grid-layout-preset': 'default'
    });

    expect(isDefaultGridContext({ elementRef: { nativeElement: host } })).toBe(true);
    expect(isDefaultGridContext({})).toBe(true);
  });

  it('treats hosts without an explicit preset as the shared default grid', () => {
    const genericHost = createHost();

    expect(isDefaultGridHost(genericHost)).toBe(true);
    expect(isDefaultGridContext({ elementRef: { nativeElement: genericHost } })).toBe(true);
    expect(isDefaultGridHost(null)).toBe(false);
    expect(isDefaultGridContext(null)).toBe(true);
  });
});
