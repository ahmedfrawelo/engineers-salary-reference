type LooseValue = ReturnType<typeof JSON.parse>;
type HelperContext = Record<string, LooseValue>;

export const REMOTE_DATA_STRUCTURE_REFRESH_FALLBACK_MS = 15_000;

function isRemoteRefreshPending(ctx: HelperContext): boolean {
  return typeof ctx.remoteDataStructureRefreshPending === 'function'
    ? Boolean(ctx.remoteDataStructureRefreshPending())
    : true;
}

function unrefTimer(timer: LooseValue): void {
  if (timer && typeof timer === 'object' && typeof timer.unref === 'function') {
    timer.unref();
  }
}

export function clearRemoteDataStructureRefreshFallbackTimer(ctx: HelperContext): void {
  if (!ctx.remoteDataStructureRefreshFallbackTimer) {
    return;
  }
  clearTimeout(ctx.remoteDataStructureRefreshFallbackTimer as ReturnType<typeof setTimeout>);
  ctx.remoteDataStructureRefreshFallbackTimer = null;
}

export function clearRemoteDataStructureRefreshPending(ctx: HelperContext): void {
  clearRemoteDataStructureRefreshFallbackTimer(ctx);
  ctx.remoteDataStructureRefreshToken = Number(ctx.remoteDataStructureRefreshToken ?? 0) + 1;
  ctx.remoteDataStructureRefreshSawLoading = false;
  ctx.remoteDataStructureRefreshPending?.set?.(false);
}

export function beginRemoteDataStructureRefresh(ctx: HelperContext): void {
  if (!ctx.config?.remoteData || typeof ctx.remoteDataStructureRefreshPending?.set !== 'function') {
    return;
  }

  clearRemoteDataStructureRefreshFallbackTimer(ctx);

  const token = Number(ctx.remoteDataStructureRefreshToken ?? 0) + 1;
  const sourceRows = typeof ctx.dataSignal === 'function' ? ctx.dataSignal() : undefined;
  ctx.remoteDataStructureRefreshToken = token;
  ctx.remoteDataStructureRefreshSawLoading = Boolean(ctx.loading);
  ctx.remoteDataStructureRefreshPending.set(true);

  const fallbackTimer = setTimeout(() => {
    ctx.remoteDataStructureRefreshFallbackTimer = null;
    if (ctx.remoteDataStructureRefreshToken !== token || ctx.loading) {
      return;
    }

    if (!isRemoteRefreshPending(ctx)) {
      return;
    }

    const currentRows = typeof ctx.dataSignal === 'function' ? ctx.dataSignal() : undefined;
    if (sourceRows !== undefined && currentRows !== sourceRows) {
      return;
    }

    clearRemoteDataStructureRefreshPending(ctx);
  }, REMOTE_DATA_STRUCTURE_REFRESH_FALLBACK_MS);

  ctx.remoteDataStructureRefreshFallbackTimer = fallbackTimer;
  unrefTimer(fallbackTimer);
}
