import type { StaffBoardFetchFailureKind } from '@/lib/staff-board-fetch-failure';
import type { WaiterBoardFetchScope } from '@/lib/waiter-board-live';

/**
 * Single surface representation for waiter board cold/list hydration.
 * Do not pair a separate ready-flag + error — that allows illegal combos.
 */
export type WaiterBoardSurface = 'loading' | 'failed' | 'ready';

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

/** Ready stays ready (stale-while-revalidate); cold path becomes failed. */
export function surfaceAfterRefreshFailure(
  current: WaiterBoardSurface,
  kind: StaffBoardFetchFailureKind,
): WaiterBoardSurface | 'auth-exit' {
  if (kind === 'unauthorized') return 'auth-exit';
  return current === 'ready' ? current : 'failed';
}
