import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OnDemandPreloadingStrategy } from './preloading-strategy.service';

describe('OnDemandPreloadingStrategy', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('defers explicitly marked routes so initial navigation keeps the main thread', () => {
    vi.useFakeTimers();
    const strategy = new OnDemandPreloadingStrategy();
    const load = vi.fn(() => of('loaded'));

    strategy.preload({ path: 'projects', data: { preload: true } }, load).subscribe();

    expect(load).not.toHaveBeenCalled();
    vi.advanceTimersByTime(11_999);
    expect(load).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(load).toHaveBeenCalledOnce();
  });

  it('does not preload unmarked routes', () => {
    const strategy = new OnDemandPreloadingStrategy();
    const load = vi.fn(() => of('loaded'));

    strategy.preload({ path: 'project-breakdown' }, load).subscribe();

    expect(load).not.toHaveBeenCalled();
  });
});
