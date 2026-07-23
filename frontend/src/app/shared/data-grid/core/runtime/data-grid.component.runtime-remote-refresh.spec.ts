import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  beginRemoteDataStructureRefresh,
  clearRemoteDataStructureRefreshPending,
  REMOTE_DATA_STRUCTURE_REFRESH_FALLBACK_MS
} from './data-grid.component.runtime-remote-refresh';

describe('data-grid.component.runtime-remote-refresh', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('keeps one fallback timer per remote structural refresh', () => {
    vi.useFakeTimers();
    let pending = false;
    const pendingSignal = Object.assign(
      vi.fn(() => pending),
      {
        set: vi.fn((value: boolean) => {
          pending = value;
        })
      }
    );
    const rows = [{ id: 1 }];
    const ctx = {
      config: { remoteData: true },
      loading: false,
      dataSignal: vi.fn(() => rows),
      remoteDataStructureRefreshPending: pendingSignal,
      remoteDataStructureRefreshToken: 0,
      remoteDataStructureRefreshFallbackTimer: null as ReturnType<typeof setTimeout> | null
    };

    beginRemoteDataStructureRefresh(ctx);
    const firstTimer = ctx.remoteDataStructureRefreshFallbackTimer;
    beginRemoteDataStructureRefresh(ctx);
    const secondTimer = ctx.remoteDataStructureRefreshFallbackTimer;

    expect(firstTimer).not.toBeNull();
    expect(secondTimer).not.toBeNull();
    expect(secondTimer).not.toBe(firstTimer);
    expect(pendingSignal.set).toHaveBeenCalledWith(true);

    vi.advanceTimersByTime(REMOTE_DATA_STRUCTURE_REFRESH_FALLBACK_MS);

    expect(pendingSignal.set).toHaveBeenLastCalledWith(false);
    expect(ctx.remoteDataStructureRefreshFallbackTimer).toBeNull();
  });

  it('clears pending refresh state and cancels its fallback timer explicitly', () => {
    vi.useFakeTimers();
    let pending = false;
    const pendingSignal = Object.assign(
      vi.fn(() => pending),
      {
        set: vi.fn((value: boolean) => {
          pending = value;
        })
      }
    );
    const ctx = {
      config: { remoteData: true },
      loading: false,
      dataSignal: vi.fn(() => [{ id: 1 }]),
      remoteDataStructureRefreshPending: pendingSignal,
      remoteDataStructureRefreshToken: 0,
      remoteDataStructureRefreshSawLoading: true,
      remoteDataStructureRefreshFallbackTimer: null as ReturnType<typeof setTimeout> | null
    };

    beginRemoteDataStructureRefresh(ctx);
    clearRemoteDataStructureRefreshPending(ctx);
    vi.advanceTimersByTime(REMOTE_DATA_STRUCTURE_REFRESH_FALLBACK_MS);

    expect(pendingSignal.set).toHaveBeenLastCalledWith(false);
    expect(ctx.remoteDataStructureRefreshSawLoading).toBe(false);
    expect(ctx.remoteDataStructureRefreshFallbackTimer).toBeNull();
  });
});
