import type { WaiterBoardFetchScope } from '@/lib/waiter-board-live';

/**
 * Single surface representation for waiter board cold/list hydration.
 * Do not pair a separate ready-flag + error — that allows illegal combos.
 */
export type WaiterBoardSurface = 'loading' | 'failed' | 'ready';

export type WaiterBoardFetchFailureKind = 'unauthorized' | 'failed';

export function initialWaiterBoardSurface(hasFloorStatic: boolean): WaiterBoardSurface {
  return hasFloorStatic ? 'ready' : 'loading';
}

/** Cold start / retry: show loading chrome while refresh runs from failed. */
export function surfaceForRefreshStart(surface: WaiterBoardSurface): WaiterBoardSurface {
  return surface === 'failed' ? 'loading' : surface;
}

export function surfaceAfterRefreshSuccess(
  scope: WaiterBoardFetchScope,
  current: WaiterBoardSurface,
): WaiterBoardSurface {
  if (scope === 'full') return 'ready';
  return current;
}

/** Only HTTP 401 is session-exit; 403/429/5xx/network stay retryable failed. */
export function classifyWaiterBoardFetchFailure(err: unknown): WaiterBoardFetchFailureKind {
  const status =
    typeof err === 'object' && err !== null && 'status' in err
      ? Number((err as { status?: unknown }).status)
      : NaN;
  if (status === 401) return 'unauthorized';
  return 'failed';
}

/** Ready stays ready (stale-while-revalidate); cold path becomes failed. */
export function surfaceAfterRefreshFailure(
  current: WaiterBoardSurface,
  kind: WaiterBoardFetchFailureKind,
): WaiterBoardSurface | 'auth-exit' {
  if (kind === 'unauthorized') return 'auth-exit';
  return current === 'ready' ? current : 'failed';
}
